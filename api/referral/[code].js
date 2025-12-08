/**
 * Referral Info API
 * GET /api/referral/:code - Get referral stats
 */

import { createClient } from '@supabase/supabase-js';

let supabase = null;
function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return supabase;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Missing referral code' });
  }

  const db = getSupabase();

  if (!db) {
    // Demo data
    return res.status(200).json({
      code,
      clicks: 12,
      conversions: 3,
      earnings: 750,
      _demo: true,
    });
  }

  try {
    const { data: referral, error } = await db
      .from('referrals')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !referral) {
      return res.status(404).json({ error: 'Referral code not found' });
    }

    // Calculate earnings ($250 per conversion)
    const earnings = referral.conversions * 250;

    return res.status(200).json({
      code: referral.code,
      clicks: referral.clicks,
      conversions: referral.conversions,
      earnings,
      createdAt: referral.created_at,
    });
  } catch (err) {
    console.error('[REFERRAL] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
