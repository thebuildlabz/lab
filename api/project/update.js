import { createClient } from '@supabase/supabase-js';
import { awardPoints, checkBadgeUnlocks } from '../lib/gamification.js';
import { fetchWithTimeout, withRetry, getCorrelationId, setCorrelationId, logWithCorrelation } from '../lib/utils.js';

let supabase = null;
function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return supabase;
}

async function sendDeploymentEmail(email, appName, url, referralCode, correlationId, projectId) {
  if (!process.env.RESEND_API_KEY) return;
  const baseUrl = process.env.VITE_API_URL || 'https://buildlab.com';
  const refUrl = referralCode ? baseUrl + '/intake?ref=' + referralCode : null;
  
  let refHtml = refUrl ? '<div style="background:#f0fdf4;border:1px solid #86efac;padding:16px;margin:16px 0;border-radius:8px"><p style="margin:0 0 8px;font-weight:bold;color:#166534">Earn $250 for each friend!</p><p style="margin:0"><a href="' + refUrl + '">' + refUrl + '</a></p></div>' : '';
  
  const html = '<div style="font-family:system-ui;max-width:600px;margin:0 auto"><h1 style="color:#333">Your app is ready!</h1><p><strong>' + appName + '</strong> is now live.</p><p><a href="' + url + '" style="display:inline-block;background:#333;color:#fff;padding:12px 24px;text-decoration:none">View Your App</a></p><div style="background:#f5f5f5;padding:16px;margin:16px 0"><p style="margin:0 0 8px"><strong>Demo Login:</strong></p><p style="margin:0;font-family:monospace">Email: demo@buildlab.com</p><p style="margin:0;font-family:monospace">Password: demo123</p></div>' + refHtml + '<p style="color:#666;margin-top:32px">- Build Lab</p></div>';

  try {
    const response = await withRetry(
      () => fetchWithTimeout(
        'https://api.resend.com/emails',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
          body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Build Lab <hello@buildlab.com>', to: email, subject: 'Your app is LIVE: ' + appName, html }),
        },
        10000 // 10 second timeout
      ),
      3 // max retries
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Resend API error: ${response.status} - ${errorText}`);
    }
  } catch (err) {
    logWithCorrelation(correlationId, 'error', 'Deployment email failed', { projectId, email, error: err.message });
    
    // Log to database for retry queue
    const db = getSupabase();
    if (db) {
      try {
        await db.from('project_events').insert({
          project_id: projectId,
          event_type: 'email_failed',
          message: `Deployment email failed: ${err.message}`,
        });
      } catch (dbErr) {
        logWithCorrelation(correlationId, 'error', 'Failed to log email error to DB', { error: dbErr.message });
      }
    }
    throw err; // Re-throw to be handled by caller
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Get correlation ID for distributed tracing
  const correlationId = getCorrelationId(req);
  setCorrelationId(res, correlationId);

  const authHeader = req.headers.authorization;
  const expectedKey = process.env.STATUS_API_KEY;
  if (expectedKey && authHeader !== 'Bearer ' + expectedKey) {
    logWithCorrelation(correlationId, 'warn', 'Unauthorized status update attempt', {});
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { projectId, status, deployUrl, email, completedAt } = req.body;
  if (!projectId) {
    logWithCorrelation(correlationId, 'warn', 'Missing projectId in update request', {});
    return res.status(400).json({ error: 'Missing projectId' });
  }

  logWithCorrelation(correlationId, 'info', 'Processing project update', { projectId, status, deployUrl });

  const db = getSupabase();
  if (!db) return res.status(200).json({ success: true, demo: true });

  try {
    const { data: project } = await db.from('projects').select('app_name, email, founder_name, created_at').eq('project_id', projectId).single();

    const updateData = { status, updated_at: new Date().toISOString() };
    if (deployUrl) updateData.deployed_url = deployUrl;

    if (status === 'deployed') {
      updateData.progress = 100;
      updateData.completed_at = completedAt || new Date().toISOString();
    } else if (status === 'failed') {
      updateData.progress = 0;
    } else if (status === 'building') {
      updateData.progress = 50;
    }

    const { error: updateError } = await db.from('projects').update(updateData).eq('project_id', projectId);
    if (updateError) {
      console.error('[UPDATE] DB Error:', updateError);
      return res.status(500).json({ error: 'Database update failed' });
    }

    await db.from('project_events').insert({
      project_id: projectId,
      event_type: status === 'deployed' ? 'deploy_complete' : status === 'failed' ? 'deploy_failed' : 'status_update',
      message: 'Status: ' + status + (deployUrl ? ' - ' + deployUrl : ''),
    }).catch(() => {});

    // Gamification: Award points on deployment
    if (status === 'deployed' && project) {
      const userEmail = email || project.email;
      await awardPoints(db, userEmail, 'project_deployed', { projectId });
      
      // Check for speed demon badge (deployed in < 1 hour)
      if (project.created_at) {
        const buildTime = new Date() - new Date(project.created_at);
        if (buildTime < 60 * 60 * 1000) {
          await awardPoints(db, userEmail, 'speed_demon', { projectId, buildTime });
        }
      }
      
      await checkBadgeUnlocks(db, userEmail);
    }

    // Get referral code for email
    let referralCode = null;
    if (status === 'deployed' && project) {
      const { data: referral } = await db.from('referrals').select('code').eq('project_id', projectId).single();
      if (referral) referralCode = referral.code;
    }

    if (status === 'deployed' && deployUrl && project) {
      const recipientEmail = email || project.email;
      if (recipientEmail) {
        try {
          await sendDeploymentEmail(recipientEmail, project.app_name, deployUrl, referralCode, correlationId, projectId);
          logWithCorrelation(correlationId, 'info', 'Deployment email sent', { projectId, email: recipientEmail });
        } catch {
          // Error already logged in sendDeploymentEmail, but don't fail the request
          logWithCorrelation(correlationId, 'warn', 'Deployment email failed but continuing', { projectId, email: recipientEmail });
        }
      }
    }

    logWithCorrelation(correlationId, 'info', 'Project update completed', { projectId, status });
    return res.status(200).json({ success: true });
  } catch (err) {
    logWithCorrelation(correlationId, 'error', 'Project update failed', { projectId, error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
