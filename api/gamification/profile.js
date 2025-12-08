/**
 * Gamification Profile API
 * GET /api/gamification/profile?email=xxx - Get user's gamification profile
 */

import { createClient } from '@supabase/supabase-js';
import { getUserPoints, getUserBadges, BADGES } from '../lib/gamification.js';

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

  if (!email) {
    return res.status(400).json({ error: 'Missing email parameter' });
  }

  const db = getSupabase();

  if (!db) {
    // Demo data
    return res.status(200).json({
      email,
      points: 1250,
      level: 3,
      badges: [
        { ...BADGES.first_build, earned_at: new Date().toISOString() },
        { ...BADGES.referral_rookie, earned_at: new Date().toISOString() },
      ],
      streak: { current: 5, longest: 12 },
      rank: 7,
      nextLevelPoints: 2000,
      _demo: true,
    });
  }

  try {
    // Get points
    const points = await getUserPoints(db, email);

    // Get badges
    const badges = await getUserBadges(db, email);

    // Get streak
    const { data: streakData } = await db
      .from('user_streaks')
      .select('*')
      .eq('email', email)
      .single();

    const streak = streakData
      ? { current: streakData.current_streak, longest: streakData.longest_streak }
      : { current: 0, longest: 0 };

    // Calculate level (every 1000 points = 1 level)
    const level = Math.floor(points / 1000) + 1;
    const nextLevelPoints = level * 1000;

    // Get rank
    const { data: allPoints } = await db
      .from('user_points')
      .select('email, points');

    const totals = {};
    (allPoints || []).forEach(p => {
      totals[p.email] = (totals[p.email] || 0) + p.points;
    });

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const rank = sorted.findIndex(([e]) => e === email) + 1;

    // Get recent point history
    const { data: history } = await db
      .from('user_points')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(10);

    return res.status(200).json({
      email,
      points,
      level,
      badges,
      streak,
      rank: rank || null,
      nextLevelPoints,
      history: history || [],
    });
  } catch (err) {
    console.error('[PROFILE] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
