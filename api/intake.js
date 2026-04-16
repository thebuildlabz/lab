import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createReferral, trackReferralConversion } from './lib/referral.js';
import { awardPoints, updateStreak } from './lib/gamification.js';
import { fetchWithTimeout, withRetry, getCorrelationId, setCorrelationId, logWithCorrelation } from './lib/utils.js';

const TEMPLATE_MAP = {
  'contractor-crm': ['invoice', 'quote', 'contractor', 'roofing', 'hvac', 'plumbing'],
  'freelancer-invoices': ['freelance', 'payment', 'billing'],
  'booking-platform': ['booking', 'appointment', 'schedule', 'salon', 'spa', 'fitness'],
  'agency-dashboard': ['agency', 'client', 'project', 'reporting'],
};

function selectTemplate(features, integrations, appIdea) {
  const allText = [...features, ...integrations, appIdea].join(' ').toLowerCase();
  for (const [template, keywords] of Object.entries(TEMPLATE_MAP)) {
    if (keywords.some(kw => allText.includes(kw))) return template;
  }
  return 'basic-crud';
}

function generateProjectId() {
  return 'prj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function calculatePrice(data) {
  let base = 2500;
  const fc = data.features ? data.features.length : 0;
  const ic = data.integrations ? data.integrations.length : 0;
  base += fc * 500 + ic * 1000;
  if (data.timeline === '48h') base *= 1.2;
  return Math.round(base);
}

// Request validation schema
const IntakeSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  appIdea: z.string().min(10).max(5000),
  problem: z.string().max(2000).optional(),
  features: z.array(z.string()).optional(),
  integrations: z.array(z.string()).optional(),
  timeline: z.enum(['48h', '72h', 'standard']).optional(),
  ref: z.string().optional(),
});

let supabase = null;
function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return supabase;
}

async function sendWelcomeEmail(email, name, projectId, appName, referralCode, correlationId) {
  if (!process.env.RESEND_API_KEY) return;
  const baseUrl = process.env.VITE_API_URL || 'https://buildlab.com';
  const statusUrl = baseUrl + '/status/' + projectId;
  const refUrl = referralCode ? baseUrl + '/intake?ref=' + referralCode : null;
  
  let refHtml = refUrl ? '<div style="background:#f0fdf4;border:1px solid #86efac;padding:16px;margin:16px 0;border-radius:8px"><p style="margin:0 0 8px;font-weight:bold;color:#166534">Earn $250 for each friend!</p><p style="margin:0"><a href="' + refUrl + '">' + refUrl + '</a></p></div>' : '';
  
  const html = '<div style="font-family:system-ui;max-width:600px;margin:0 auto"><h1>Your app is being built!</h1><p>Hi ' + name + ',</p><p>We received your idea for <strong>' + appName + '</strong>.</p><p><a href="' + statusUrl + '" style="display:inline-block;background:#333;color:#fff;padding:12px 24px;text-decoration:none">Track Progress</a></p>' + refHtml + '</div>';

  try {
    const response = await withRetry(
      () => fetchWithTimeout(
        'https://api.resend.com/emails',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
          body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Build Lab <hello@buildlab.com>', to: email, subject: 'Building: ' + appName, html }),
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
    logWithCorrelation(correlationId, 'error', 'Welcome email failed', { projectId, email, error: err.message });
    
    // Log to database for retry queue
    const db = getSupabase();
    if (db) {
      try {
        await db.from('project_events').insert({
          project_id: projectId,
          event_type: 'email_failed',
          message: `Welcome email failed: ${err.message}`,
        });
      } catch (dbErr) {
        logWithCorrelation(correlationId, 'error', 'Failed to log email error to DB', { error: dbErr.message });
      }
    }
    throw err; // Re-throw to be handled by caller
  }
}

async function logEvent(projectId, eventType, message) {
  const db = getSupabase();
  if (db) await db.from('project_events').insert({ project_id: projectId, event_type: eventType, message }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Get correlation ID for distributed tracing
  const correlationId = getCorrelationId(req);
  setCorrelationId(res, correlationId);

  // Request validation with Zod
  const validated = IntakeSchema.safeParse(req.body);
  if (!validated.success) {
    logWithCorrelation(correlationId, 'warn', 'Invalid intake request', { errors: validated.error.issues });
    return res.status(400).json({ error: 'Validation failed', issues: validated.error.issues });
  }

  const { appIdea, problem, name, email, features, integrations, timeline, ref } = validated.data;

  // Idempotency protection
  const idempotencyKey = req.headers['idempotency-key'] || `${email}-${Date.now()}`;
  const db = getSupabase();
  
  if (db) {
    try {
      const { data: existing } = await db
        .from('projects')
        .select('project_id, status, created_at')
        .eq('email', email)
        .eq('app_name', appIdea.slice(0, 50).replace(/[^a-zA-Z0-9\s-]/g, '').trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Check if duplicate request within last 5 minutes
      if (existing && existing.created_at) {
        const timeDiff = Date.now() - new Date(existing.created_at).getTime();
        if (timeDiff < 5 * 60 * 1000) { // 5 minutes
          logWithCorrelation(correlationId, 'info', 'Duplicate intake request detected', { 
            projectId: existing.project_id,
            cached: true 
          });
          return res.status(200).json({
            success: true,
            cached: true,
            projectId: existing.project_id,
            status: existing.status,
            message: 'Request already processed',
          });
        }
      }
    } catch (idempotencyErr) {
      logWithCorrelation(correlationId, 'warn', 'Idempotency check failed', { error: idempotencyErr.message });
      // Continue processing - don't block on idempotency check failure
    }
  }

  const projectId = generateProjectId();
  const template = selectTemplate(features || [], integrations || [], appIdea);
  const price = calculatePrice(validated.data);
  const appName = appIdea.slice(0, 50).replace(/[^a-zA-Z0-9\s-]/g, '').trim();

  logWithCorrelation(correlationId, 'info', 'Processing intake request', { projectId, email, template, idempotencyKey });

  let referralCode = null;

  if (db) {
    try {
      const { error } = await db.from('projects').insert({
        project_id: projectId, app_name: appName, email, founder_name: name,
        problem: problem || null, features: features || [], integrations: integrations || [],
        template, timeline: timeline || '72h', price, status: 'pending', progress: 10,
      });
      if (!error) {
        await logEvent(projectId, 'intake_received', 'Intake: ' + appName);
        referralCode = await createReferral(db, projectId);
        if (ref) await trackReferralConversion(db, ref, projectId);
        
        // Gamification: Award points and update streak
        await awardPoints(db, email, 'intake_submit', { projectId });
        await updateStreak(db, email);
      } else {
        logWithCorrelation(correlationId, 'error', 'Database insert failed', { projectId, error: error.message });
      }
    } catch (err) {
      logWithCorrelation(correlationId, 'error', 'Database error', { projectId, error: err.message });
    }
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const [owner, repo] = (process.env.FACTORY_REPO || 'thebuildlabz/factory').split('/');
  let deployTriggered = false;

  if (GITHUB_TOKEN) {
    try {
      const response = await withRetry(
        () => fetchWithTimeout(
          `https://api.github.com/repos/${owner}/${repo}/actions/workflows/deploy-template.yml/dispatches`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + GITHUB_TOKEN,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({ ref: 'main', inputs: { projectId, template, appName, email, companyName: name } }),
          },
          10000 // 10 second timeout
        ),
        3 // max retries
      );

      if (response.status === 204) {
        deployTriggered = true;
        logWithCorrelation(correlationId, 'info', 'GitHub Action triggered', { projectId });
        if (db) {
          await db.from('projects').update({ status: 'building', progress: 30 }).eq('project_id', projectId);
          await logEvent(projectId, 'deploy_started', 'GitHub Action triggered');
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        logWithCorrelation(correlationId, 'error', 'GitHub API error', { 
          projectId, 
          status: response.status, 
          error: errorText 
        });
      }
    } catch (err) {
      logWithCorrelation(correlationId, 'error', 'GitHub dispatch failed', { projectId, error: err.message });
    }
  }

  // Send welcome email with proper error handling
  try {
    await sendWelcomeEmail(email, name, projectId, appName, referralCode, correlationId);
    logWithCorrelation(correlationId, 'info', 'Welcome email sent', { projectId, email });
  } catch {
    // Error already logged in sendWelcomeEmail, but don't fail the request
    logWithCorrelation(correlationId, 'warn', 'Welcome email failed but continuing', { projectId, email });
  }

  return res.status(201).json({
    success: true, projectId, template, price, referralCode,
    status: deployTriggered ? 'building' : 'pending',
    statusUrl: '/status/' + projectId,
    message: 'Building your ' + template + ' app...',
  });
}
