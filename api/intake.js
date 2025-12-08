/**
 * Intake API - The Dispatcher (Production Version)
 *
 * Receives intake → saves to DB → triggers deploy → sends email
 */

// Template matching
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
  base += (data.features?.length || 0) * 500;
  base += (data.integrations?.length || 0) * 1000;
  if (data.timeline === '48h') base *= 1.2;
  return Math.round(base);
}

// Supabase client (lazy init)
let supabase = null;
function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return supabase;
}

// Send welcome email via Resend
async function sendWelcomeEmail(email, name, projectId, appName) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[EMAIL] No RESEND_API_KEY - skipping email');
    return;
  }

  const statusUrl = `${process.env.VITE_API_URL || 'https://buildlab.com'}/status/${projectId}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Build Lab <hello@buildlab.com>',
      to: email,
      subject: `Building your app: ${appName}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Your app is being built!</h1>
          <p>Hi ${name},</p>
          <p>We've received your idea for <strong>${appName}</strong> and started building it.</p>
          <p><strong>Project ID:</strong> <code>${projectId}</code></p>
          <p>
            <a href="${statusUrl}" style="display: inline-block; background: #333; color: #fff; padding: 12px 24px; text-decoration: none; margin: 16px 0;">
              Track Progress
            </a>
          </p>
          <p>We'll email you again when it's live (typically 5-10 minutes).</p>
          <p style="color: #666; margin-top: 32px;">— Build Lab</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('[EMAIL] Send failed:', error);
  } else {
    console.log('[EMAIL] Welcome email sent to:', email);
  }
}

// Log event to database
async function logEvent(projectId, eventType, message) {
  const db = getSupabase();
  if (!db) return;

  await db.from('project_events').insert({
    project_id: projectId,
    event_type: eventType,
    message,
  }).catch(err => console.error('[EVENT] Log failed:', err));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { appIdea, problem, name, email, features = [], integrations = [], timeline } = req.body;

  // Validate
  if (!appIdea || !email || !name) {
    return res.status(400).json({ error: 'Missing required fields: appIdea, email, name' });
  }

  const projectId = generateProjectId();
  const template = selectTemplate(features, integrations, appIdea);
  const price = calculatePrice(req.body);
  const appName = appIdea.slice(0, 50).replace(/[^a-zA-Z0-9\s-]/g, '').trim();

  console.log('[INTAKE] New project:', projectId, '→', template);

  // Save to database (if configured)
  const db = getSupabase();
  if (db) {
    try {
      const { error: dbError } = await db.from('projects').insert({
        project_id: projectId,
        app_name: appName,
        email,
        founder_name: name,
        problem: problem || null,
        features,
        integrations,
        template,
        timeline: timeline || '72h',
        price,
        status: 'pending',
        progress: 10,
      });

      if (dbError) {
        console.error('[INTAKE] DB Error:', dbError);
        // Continue anyway - don't fail the request
      } else {
        await logEvent(projectId, 'intake_received', `Intake for: ${appName}`);
      }
    } catch (err) {
      console.error('[INTAKE] DB Exception:', err);
    }
  }

  // Trigger GitHub Action
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const FACTORY_REPO = process.env.FACTORY_REPO || 'thebuildlabz/factory';
  const [owner, repo] = FACTORY_REPO.split('/');
  let deployTriggered = false;

  if (GITHUB_TOKEN) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/deploy-template.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: {
              projectId,
              template,
              appName,
              email,
              companyName: name,
            },
          }),
        }
      );

      if (response.status === 204) {
        console.log('[INTAKE] GitHub Action dispatched');
        deployTriggered = true;

        // Update status in DB
        if (db) {
          await db.from('projects')
            .update({ status: 'building', progress: 30 })
            .eq('project_id', projectId);
          await logEvent(projectId, 'deploy_started', 'GitHub Action triggered');
        }
      } else {
        const errorText = await response.text();
        console.error('[INTAKE] GitHub dispatch failed:', response.status, errorText);
      }
    } catch (err) {
      console.error('[INTAKE] GitHub dispatch error:', err.message);
    }
  } else {
    console.log('[INTAKE] No GITHUB_TOKEN - demo mode');
  }

  // Send welcome email
  try {
    await sendWelcomeEmail(email, name, projectId, appName);
  } catch (err) {
    console.error('[INTAKE] Email error:', err.message);
  }

  return res.status(201).json({
    success: true,
    projectId,
    template,
    price,
    status: deployTriggered ? 'building' : 'pending',
    statusUrl: `/status/${projectId}`,
    message: `Building your ${template} app...`,
  });
}
