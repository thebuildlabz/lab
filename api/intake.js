import { createClient } from '@supabase/supabase-js';
import { createReferral, trackReferralConversion } from './lib/referral.js';

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

let supabase = null;
function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return supabase;
}

async function sendWelcomeEmail(email, name, projectId, appName, referralCode) {
  if (!process.env.RESEND_API_KEY) return;
  const baseUrl = process.env.VITE_API_URL || 'https://buildlab.com';
  const statusUrl = baseUrl + '/status/' + projectId;
  const refUrl = referralCode ? baseUrl + '/intake?ref=' + referralCode : null;
  
  let refHtml = refUrl ? '<div style="background:#f0fdf4;border:1px solid #86efac;padding:16px;margin:16px 0;border-radius:8px"><p style="margin:0 0 8px;font-weight:bold;color:#166534">Earn $250 for each friend!</p><p style="margin:0"><a href="' + refUrl + '">' + refUrl + '</a></p></div>' : '';
  
  const html = '<div style="font-family:system-ui;max-width:600px;margin:0 auto"><h1>Your app is being built!</h1><p>Hi ' + name + ',</p><p>We received your idea for <strong>' + appName + '</strong>.</p><p><a href="' + statusUrl + '" style="display:inline-block;background:#333;color:#fff;padding:12px 24px;text-decoration:none">Track Progress</a></p>' + refHtml + '</div>';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Build Lab <hello@buildlab.com>', to: email, subject: 'Building: ' + appName, html }),
  });
}

async function logEvent(projectId, eventType, message) {
  const db = getSupabase();
  if (db) await db.from('project_events').insert({ project_id: projectId, event_type: eventType, message }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { appIdea, problem, name, email, features, integrations, timeline, ref } = req.body;
  if (!appIdea || !email || !name) return res.status(400).json({ error: 'Missing required fields' });

  const projectId = generateProjectId();
  const template = selectTemplate(features || [], integrations || [], appIdea);
  const price = calculatePrice(req.body);
  const appName = appIdea.slice(0, 50).replace(/[^a-zA-Z0-9\s-]/g, '').trim();

  const db = getSupabase();
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
      }
    } catch (err) { console.error('[INTAKE] DB error:', err); }
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const [owner, repo] = (process.env.FACTORY_REPO || 'thebuildlabz/factory').split('/');
  let deployTriggered = false;

  if (GITHUB_TOKEN) {
    try {
      const r = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/actions/workflows/deploy-template.yml/dispatches', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify({ ref: 'main', inputs: { projectId, template, appName, email, companyName: name } }),
      });
      if (r.status === 204) {
        deployTriggered = true;
        if (db) {
          await db.from('projects').update({ status: 'building', progress: 30 }).eq('project_id', projectId);
          await logEvent(projectId, 'deploy_started', 'GitHub Action triggered');
        }
      }
    } catch (err) { console.error('[INTAKE] GitHub error:', err); }
  }

  try { await sendWelcomeEmail(email, name, projectId, appName, referralCode); } catch (err) {}

  return res.status(201).json({
    success: true, projectId, template, price, referralCode,
    status: deployTriggered ? 'building' : 'pending',
    statusUrl: '/status/' + projectId,
    message: 'Building your ' + template + ' app...',
  });
}
