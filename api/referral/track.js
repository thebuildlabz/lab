/**
 * Referral Track API
 * GET /api/referral/track?code=XXX - Track referral click
 * POST /api/referral/track - Record conversion
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
  const db = getSupabase();

  // GET: Track click and redirect to intake
  if (req.method === 'GET') {
    const { code } = req.query;

    if (!code) {
      return res.redirect(302, '/intake');
    }

    // Track the click (read/increment/write since Supabase doesn't have db.raw)
    if (db) {
      try {
        const { data: referral } = await db
          .from('referrals')
          .select('clicks')
          .eq('code', code)
          .single();

        if (referral) {
          await db.from('referrals')
            .update({
              clicks: (referral.clicks || 0) + 1,
              last_click_at: new Date().toISOString()
            })
            .eq('code', code);
          console.log('[REFERRAL] Click tracked for:', code);
        }
      } catch (err) {
        console.error('[REFERRAL] Click track error:', err);
      }
    }

    // Redirect to intake with referral code
    return res.redirect(302, `/intake?ref=${code}`);
  }

  // POST: Record conversion (called from intake)
  if (req.method === 'POST') {
    const { code, newProjectId } = req.body;

    if (!code || !newProjectId) {
      return res.status(400).json({ error: 'Missing code or newProjectId' });
    }

    if (!db) {
      return res.status(200).json({ success: true, demo: true });
    }

    try {
      // Get the referral
      const { data: referral, error: fetchError } = await db
        .from('referrals')
        .select('*')
        .eq('code', code)
        .single();

      if (fetchError || !referral) {
        console.log('[REFERRAL] Code not found:', code);
        return res.status(200).json({ success: false, reason: 'code_not_found' });
      }

      // Update conversion count
      await db.from('referrals')
        .update({
          conversions: referral.conversions + 1,
          last_conversion_at: new Date().toISOString()
        })
        .eq('code', code);

      // Log the conversion
      await db.from('referral_conversions').insert({
        referral_id: referral.id,
        referrer_project_id: referral.project_id,
        referred_project_id: newProjectId,
      });

      console.log('[REFERRAL] Conversion recorded:', code, '→', newProjectId);
      return res.status(200).json({ success: true, referrerId: referral.project_id });
    } catch (err) {
      console.error('[REFERRAL] Conversion error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
