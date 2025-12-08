/**
 * Leaderboard API
 * GET /api/gamification/leaderboard - Get top users
 */

import { createClient } from '@supabase/supabase-js';
import { getLeaderboard } from '../lib/gamification.js';

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

  const limit = parseInt(req.query.limit) || 10;
  const db = getSupabase();

  if (!db) {
    // Demo data
    return res.status(200).json({
      leaderboard: [
        { rank: 1, email: 'top@example.com', points: 5200, level: 6 },
        { rank: 2, email: 'second@example.com', points: 3800, level: 4 },
        { rank: 3, email: 'third@example.com', points: 2500, level: 3 },
        { rank: 4, email: 'fourth@example.com', points: 1800, level: 2 },
        { rank: 5, email: 'fifth@example.com', points: 1200, level: 2 },
      ],
      _demo: true,
    });
  }

  try {
    const leaders = await getLeaderboard(db, limit);

    const leaderboard = leaders.map((entry, index) => ({
      rank: index + 1,
      email: entry.email,
      points: entry.points,
      level: Math.floor(entry.points / 1000) + 1,
    }));

    return res.status(200).json({ leaderboard });
  } catch (err) {
    console.error('[LEADERBOARD] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
