/**
 * Project Status API
 *
 * GET /api/project/[id] - Get project status from database
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing project ID' });
  }

  const db = getSupabase();

  // If no database, return demo data
  if (!db) {
    return res.status(200).json({
      projectId: id,
      appName: 'Demo App',
      status: 'deployed',
      progress: 100,
      template: 'contractor-crm',
      deployUrl: `https://${id}.vercel.app`,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      _demo: true,
    });
  }

  try {
    const { data, error } = await db
      .from('projects')
      .select('*')
      .eq('project_id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get recent events
    const { data: events } = await db
      .from('project_events')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    return res.status(200).json({
      projectId: data.project_id,
      appName: data.app_name,
      email: data.email,
      founderName: data.founder_name,
      template: data.template,
      status: data.status,
      progress: data.progress,
      deployUrl: data.deployed_url,
      error: data.error_message,
      features: data.features,
      integrations: data.integrations,
      timeline: data.timeline,
      price: data.price,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      completedAt: data.completed_at,
      events: events || [],
    });
  } catch (err) {
    console.error('[PROJECT] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
