/**
 * Project Update API
 *
 * POST /api/project/update - Called by GitHub Action to update status
 */

// Supabase client (lazy init)
let supabase = null;
function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return supabase;
}

// Send deployment email via Resend
async function sendDeploymentEmail(email, appName, url, projectId) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[EMAIL] No RESEND_API_KEY - skipping email');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Build Lab <hello@buildlab.com>',
      to: email,
      subject: `Your app is LIVE: ${appName}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Your app is ready!</h1>
          <p>Great news - <strong>${appName}</strong> is now live.</p>
          <p>
            <a href="${url}" style="display: inline-block; background: #333; color: #fff; padding: 12px 24px; text-decoration: none; margin: 16px 0;">
              View Your App
            </a>
          </p>
          <div style="background: #f5f5f5; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Demo Login:</strong></p>
            <p style="margin: 0; font-family: monospace;">Email: demo@buildlab.com</p>
            <p style="margin: 0; font-family: monospace;">Password: demo123</p>
          </div>
          <p>Questions? Just reply to this email.</p>
          <p style="color: #666; margin-top: 32px;">— Build Lab</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('[EMAIL] Send failed:', error);
  } else {
    console.log('[EMAIL] Deployment email sent to:', email);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API key
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.STATUS_API_KEY;

  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { projectId, status, deployUrl, email, completedAt } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'Missing projectId' });
  }

  console.log('[UPDATE] Project:', projectId, '→', status, deployUrl);

  const db = getSupabase();

  if (!db) {
    // Demo mode - just acknowledge
    console.log('[UPDATE] No database - demo mode');
    return res.status(200).json({ success: true, demo: true });
  }

  try {
    // Get current project data for email
    const { data: project } = await db
      .from('projects')
      .select('app_name, email, founder_name')
      .eq('project_id', projectId)
      .single();

    // Update project status
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (deployUrl) {
      updateData.deployed_url = deployUrl;
    }

    if (status === 'deployed') {
      updateData.progress = 100;
      updateData.completed_at = completedAt || new Date().toISOString();
    } else if (status === 'failed') {
      updateData.progress = 0;
    } else if (status === 'building') {
      updateData.progress = 50;
    }

    const { error: updateError } = await db
      .from('projects')
      .update(updateData)
      .eq('project_id', projectId);

    if (updateError) {
      console.error('[UPDATE] DB Error:', updateError);
      return res.status(500).json({ error: 'Database update failed' });
    }

    // Log event
    await db.from('project_events').insert({
      project_id: projectId,
      event_type: status === 'deployed' ? 'deploy_complete' : status === 'failed' ? 'deploy_failed' : 'status_update',
      message: `Status: ${status}${deployUrl ? ` - ${deployUrl}` : ''}`,
    }).catch(err => console.error('[EVENT] Log failed:', err));

    // Send deployment email if successful
    if (status === 'deployed' && deployUrl && project) {
      const recipientEmail = email || project.email;
      if (recipientEmail) {
        try {
          await sendDeploymentEmail(recipientEmail, project.app_name, deployUrl, projectId);
        } catch (emailErr) {
          console.error('[UPDATE] Email error:', emailErr);
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[UPDATE] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
