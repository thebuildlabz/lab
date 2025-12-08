/**
 * Gamification System
 * Points, badges, streaks, and leaderboard
 */

// Point values for different actions
export const POINT_VALUES = {
  intake_submit: 100,        // Submit an intake
  project_deployed: 500,     // Project goes live
  referral_click: 10,        // Someone clicks your referral
  referral_conversion: 250,  // Someone converts from your referral
  streak_day: 50,            // Daily login streak bonus
  first_project: 200,        // First project bonus
  speed_demon: 100,          // Project deployed in < 1 hour
};

// Badge definitions
export const BADGES = {
  first_build: {
    id: 'first_build',
    name: 'First Build',
    description: 'Launched your first app',
    icon: '🚀',
    points: 200,
  },
  speed_demon: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'App deployed in under 1 hour',
    icon: '⚡',
    points: 100,
  },
  referral_rookie: {
    id: 'referral_rookie',
    name: 'Referral Rookie',
    description: 'Got your first referral conversion',
    icon: '🤝',
    points: 150,
  },
  referral_pro: {
    id: 'referral_pro',
    name: 'Referral Pro',
    description: '5 referral conversions',
    icon: '🌟',
    points: 500,
  },
  referral_legend: {
    id: 'referral_legend',
    name: 'Referral Legend',
    description: '25 referral conversions',
    icon: '👑',
    points: 2500,
  },
  streak_3: {
    id: 'streak_3',
    name: 'On Fire',
    description: '3-day activity streak',
    icon: '🔥',
    points: 100,
  },
  streak_7: {
    id: 'streak_7',
    name: 'Weekly Warrior',
    description: '7-day activity streak',
    icon: '💪',
    points: 300,
  },
  streak_30: {
    id: 'streak_30',
    name: 'Monthly Master',
    description: '30-day activity streak',
    icon: '🏆',
    points: 1000,
  },
  multi_builder: {
    id: 'multi_builder',
    name: 'Multi Builder',
    description: 'Launched 3 apps',
    icon: '🏗️',
    points: 300,
  },
  power_builder: {
    id: 'power_builder',
    name: 'Power Builder',
    description: 'Launched 10 apps',
    icon: '⚙️',
    points: 1000,
  },
};

// Award points to a user
export async function awardPoints(db, email, action, metadata = {}) {
  if (!db || !email || !action) return null;

  const points = POINT_VALUES[action] || 0;
  if (points === 0) return null;

  try {
    // Insert point record
    const { data, error } = await db.from('user_points').insert({
      email,
      action,
      points,
      metadata,
    }).select().single();

    if (error) {
      console.error('[POINTS] Award error:', error);
      return null;
    }

    console.log('[POINTS] Awarded', points, 'to', email, 'for', action);

    // Check for badge unlocks
    await checkBadgeUnlocks(db, email);

    return data;
  } catch (err) {
    console.error('[POINTS] Exception:', err);
    return null;
  }
}

// Get user's total points
export async function getUserPoints(db, email) {
  if (!db || !email) return 0;

  try {
    const { data, error } = await db
      .from('user_points')
      .select('points')
      .eq('email', email);

    if (error) return 0;
    return data.reduce((sum, row) => sum + row.points, 0);
  } catch (err) {
    return 0;
  }
}

// Get user's badges
export async function getUserBadges(db, email) {
  if (!db || !email) return [];

  try {
    const { data, error } = await db
      .from('user_badges')
      .select('*')
      .eq('email', email);

    if (error) return [];
    return data.map(b => ({ ...BADGES[b.badge_id], earned_at: b.created_at }));
  } catch (err) {
    return [];
  }
}

// Award a badge
export async function awardBadge(db, email, badgeId) {
  if (!db || !email || !badgeId) return false;

  const badge = BADGES[badgeId];
  if (!badge) return false;

  try {
    // Check if already has badge
    const { data: existing } = await db
      .from('user_badges')
      .select('id')
      .eq('email', email)
      .eq('badge_id', badgeId)
      .single();

    if (existing) return false; // Already has badge

    // Award badge
    const { error } = await db.from('user_badges').insert({
      email,
      badge_id: badgeId,
    });

    if (error) {
      console.error('[BADGE] Award error:', error);
      return false;
    }

    // Award bonus points for badge (directly insert since badge_earned isn't in POINT_VALUES)
    if (badge.points > 0) {
      await db.from('user_points').insert({
        email,
        action: 'badge_earned',
        points: badge.points,
        metadata: { badge_id: badgeId },
      }).catch(err => console.error('[BADGE] Points error:', err));
      console.log('[BADGE] Awarded', badge.points, 'bonus points for', badgeId);
    }

    console.log('[BADGE] Awarded', badgeId, 'to', email);
    return true;
  } catch (err) {
    console.error('[BADGE] Exception:', err);
    return false;
  }
}

// Check and award badges based on user stats
export async function checkBadgeUnlocks(db, email) {
  if (!db || !email) return;

  try {
    // Get user stats
    const { data: projects } = await db
      .from('projects')
      .select('*')
      .eq('email', email);

    const { data: referrals } = await db
      .from('referrals')
      .select('conversions')
      .in('project_id', (projects || []).map(p => p.project_id));

    const deployedCount = (projects || []).filter(p => p.status === 'deployed').length;
    const totalConversions = (referrals || []).reduce((sum, r) => sum + r.conversions, 0);

    // Check badges
    if (deployedCount >= 1) await awardBadge(db, email, 'first_build');
    if (deployedCount >= 3) await awardBadge(db, email, 'multi_builder');
    if (deployedCount >= 10) await awardBadge(db, email, 'power_builder');
    if (totalConversions >= 1) await awardBadge(db, email, 'referral_rookie');
    if (totalConversions >= 5) await awardBadge(db, email, 'referral_pro');
    if (totalConversions >= 25) await awardBadge(db, email, 'referral_legend');

    // Check for speed demon (deployed in < 1 hour)
    for (const p of (projects || [])) {
      if (p.status === 'deployed' && p.completed_at && p.created_at) {
        const buildTime = new Date(p.completed_at) - new Date(p.created_at);
        if (buildTime < 60 * 60 * 1000) { // < 1 hour
          await awardBadge(db, email, 'speed_demon');
          break;
        }
      }
    }
  } catch (err) {
    console.error('[BADGE] Check error:', err);
  }
}

// Update user streak
export async function updateStreak(db, email) {
  if (!db || !email) return null;

  try {
    const today = new Date().toISOString().split('T')[0];

    // Get current streak
    const { data: streak } = await db
      .from('user_streaks')
      .select('*')
      .eq('email', email)
      .single();

    if (!streak) {
      // First activity - create streak
      await db.from('user_streaks').insert({
        email,
        current_streak: 1,
        longest_streak: 1,
        last_activity: today,
      });
      return { current: 1, longest: 1 };
    }

    const lastDate = new Date(streak.last_activity);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day - no change
      return { current: streak.current_streak, longest: streak.longest_streak };
    } else if (diffDays === 1) {
      // Consecutive day - increment streak
      const newStreak = streak.current_streak + 1;
      const newLongest = Math.max(newStreak, streak.longest_streak);

      await db.from('user_streaks').update({
        current_streak: newStreak,
        longest_streak: newLongest,
        last_activity: today,
      }).eq('email', email);

      // Award streak points
      await awardPoints(db, email, 'streak_day', { streak: newStreak });

      // Check streak badges
      if (newStreak >= 3) await awardBadge(db, email, 'streak_3');
      if (newStreak >= 7) await awardBadge(db, email, 'streak_7');
      if (newStreak >= 30) await awardBadge(db, email, 'streak_30');

      return { current: newStreak, longest: newLongest };
    } else {
      // Streak broken - reset to 1
      await db.from('user_streaks').update({
        current_streak: 1,
        last_activity: today,
      }).eq('email', email);

      return { current: 1, longest: streak.longest_streak };
    }
  } catch (err) {
    console.error('[STREAK] Error:', err);
    return null;
  }
}

// Get leaderboard
export async function getLeaderboard(db, limit = 10) {
  if (!db) return [];

  try {
    const { data, error } = await db.rpc('get_leaderboard', { limit_count: limit });

    if (error) {
      // Fallback to manual calculation
      const { data: points } = await db
        .from('user_points')
        .select('email, points');

      if (!points) return [];

      const totals = {};
      points.forEach(p => {
        totals[p.email] = (totals[p.email] || 0) + p.points;
      });

      return Object.entries(totals)
        .map(([email, points]) => ({ email, points }))
        .sort((a, b) => b.points - a.points)
        .slice(0, limit);
    }

    return data || [];
  } catch (err) {
    console.error('[LEADERBOARD] Error:', err);
    return [];
  }
}
