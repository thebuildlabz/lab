/**
 * Badges API
 * GET /api/gamification/badges - Get all available badges
 * GET /api/gamification/badges?email=xxx - Get user's earned badges
 */

import { createClient } from '@supabase/supabase-js';
import { BADGES, getUserBadges } from '../lib/gamification.js';

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

  const { email } = req.query;

  // If no email, return all available badges
  if (!email) {
    const allBadges = Object.values(BADGES).map(badge => ({
      ...badge,
      earned: false,
    }));
    return res.status(200).json({ badges: allBadges });
  }

  const db = getSupabase();

  if (!db) {
    // Demo data
    const demoBadges = Object.values(BADGES).map((badge, i) => ({
      ...badge,
      earned: i < 3,
      earned_at: i < 3 ? new Date().toISOString() : null,
    }));
    return res.status(200).json({ badges: demoBadges, _demo: true });
  }

  try {
    const earnedBadges = await getUserBadges(db, email);
    const earnedIds = new Set(earnedBadges.map(b => b.id));

    const badges = Object.values(BADGES).map(badge => ({
      ...badge,
      earned: earnedIds.has(badge.id),
      earned_at: earnedBadges.find(b => b.id === badge.id)?.earned_at || null,
    }));

    return res.status(200).json({ badges });
  } catch (err) {
    console.error('[BADGES] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
