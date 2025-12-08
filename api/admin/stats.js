/**
 * Admin Stats API
 * GET /api/admin/stats - Dashboard metrics
 */

import { createClient } from '@supabase/supabase-js';

let supabase = null;
function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return supabase;
}

const priceMap = {
  'basic-crud': 2500,
  'contractor-crm': 10000,
  'booking-platform': 7500,
  'freelancer-invoices': 5000,
  'agency-dashboard': 8000,
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = getSupabase();

  if (!db) {
    // Demo data
    return res.status(200).json({
      stats: {
        totalIntakes: 12,
        deployed: 8,
        conversionRate: 66.7,
        revenue: 45000,
        avgBuildTime: 4.2,
        templateBreakdown: [
          { template: 'contractor-crm', count: 3 },
          { template: 'freelancer-invoices', count: 2 },
          { template: 'booking-platform', count: 2 },
          { template: 'basic-crud', count: 1 },
        ],
      },
      projects: [],
      flags: [],
      _demo: true,
    });
  }

  try {
    // Get all projects
    const { data: projects, error } = await db
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ADMIN] DB Error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    const totalIntakes = projects.length;
    const deployed = projects.filter(p => p.status === 'deployed').length;
    const conversionRate = totalIntakes > 0 ? ((deployed / totalIntakes) * 100).toFixed(1) : 0;

    // Calculate revenue
    const revenue = projects
      .filter(p => p.status === 'deployed')
      .reduce((sum, p) => sum + (p.price || priceMap[p.template] || 5000), 0);

    // Calculate avg build time (in minutes)
    const deployedWithTime = projects.filter(p => p.status === 'deployed' && p.completed_at && p.created_at);
    const avgBuildTime = deployedWithTime.length > 0
      ? deployedWithTime.reduce((sum, p) => {
          const buildTime = new Date(p.completed_at) - new Date(p.created_at);
          return sum + buildTime;
        }, 0) / deployedWithTime.length / 1000 / 60
      : 0;

    // Template breakdown
    const templateCounts = {};
    projects.forEach(p => {
      templateCounts[p.template] = (templateCounts[p.template] || 0) + 1;
    });
    const templateBreakdown = Object.entries(templateCounts)
      .map(([template, count]) => ({ template, count }))
      .sort((a, b) => b.count - a.count);

    // Get feature flags
    const { data: flags } = await db
      .from('feature_flags')
      .select('*');

    return res.status(200).json({
      stats: {
        totalIntakes,
        deployed,
        conversionRate: parseFloat(conversionRate),
        revenue,
        avgBuildTime: parseFloat(avgBuildTime.toFixed(1)),
        templateBreakdown,
      },
      projects: projects.slice(0, 20),
      flags: flags || [],
    });
  } catch (err) {
    console.error('[ADMIN] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
