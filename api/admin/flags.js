/**
 * Feature Flags API
 * POST /api/admin/flags - Toggle feature flag
 */

import { createClient } from '@supabase/supabase-js';

let supabase = null;
function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return supabase;
}

// Admin auth check
function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  const configuredKey = process.env.ADMIN_API_KEY;
  const demoKey = process.env.NODE_ENV !== 'production' ? 'buildlab2024' : null;
  const adminKey = configuredKey || demoKey;

  if (!adminKey) return false;

  if (!authHeader) return false;

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  return token === adminKey;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin authentication
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, enabled } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Missing flag name' });
  }

  const db = getSupabase();

  if (!db) {
    return res.status(200).json({ success: true, demo: true });
  }

  try {
    const { error } = await db
      .from('feature_flags')
      .upsert({
        name,
        enabled,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'name',
      });

    if (error) {
      console.error('[FLAGS] Error:', error);
      return res.status(500).json({ error: 'Failed to update flag' });
    }

    console.log('[FLAGS] Updated:', name, '→', enabled);
    return res.status(200).json({ success: true, name, enabled });
  } catch (err) {
    console.error('[FLAGS] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
