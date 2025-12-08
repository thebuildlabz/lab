// Referral helper functions

export function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createReferral(db, projectId) {
  if (!db) return null;
  const code = generateReferralCode();
  try {
    const { error } = await db.from('referrals').insert({
      project_id: projectId,
      code: code,
      clicks: 0,
      conversions: 0,
    });
    if (error) {
      console.error('[REFERRAL] Create error:', error);
      return null;
    }
    console.log('[REFERRAL] Created code:', code, 'for', projectId);
    return code;
  } catch (err) {
    console.error('[REFERRAL] Exception:', err);
    return null;
  }
}

export async function trackReferralConversion(db, referralCode, newProjectId) {
  if (!db || !referralCode) return;
  try {
    const { data: referral } = await db.from('referrals').select('*').eq('code', referralCode).single();
    if (!referral) return;
    await db.from('referrals').update({
      conversions: referral.conversions + 1,
      last_conversion_at: new Date().toISOString()
    }).eq('code', referralCode);
    await db.from('referral_conversions').insert({
      referral_id: referral.id,
      referrer_project_id: referral.project_id,
      referred_project_id: newProjectId,
    });
    console.log('[REFERRAL] Conversion:', referralCode);
  } catch (err) {
    console.error('[REFERRAL] Conversion error:', err);
  }
}
