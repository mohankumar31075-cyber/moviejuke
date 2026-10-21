// Access rules from the PRD (§5):
//  • Free tier: notes/video/audio for everyone; English + GK quizzes free.
//  • One-time trial (30–60 min of quiz time) unlocks ALL subjects.
//  • Subscription (Rs 149/month) unlocks all subjects, unlimited quizzes.
//  • Certificates: free users only within free subjects + trial time.
//  • School-licensed students (via teacher class) get all subjects.

import { getDb, saveDb } from '../store.js';

export const FREE_SUBJECTS = ['eng', 'gk'];

export function trialLeft(user) {
  if (!user) return 0;
  return Math.max(0, (user.trialSecondsTotal || 0) - (user.trialSecondsUsed || 0));
}

export function isSubscribed(user) {
  return !!user && user.subscription?.status === 'active' && ['monthly', 'staff', 'teacher', 'school'].includes(user.subscription?.plan);
}

export function hasSchoolAccess(profile) {
  return !!(profile && profile.schoolClassId);
}

export function accessState(user, profile) {
  const tLeft = trialLeft(user);
  return {
    subscribed: isSubscribed(user),
    school: hasSchoolAccess(profile),
    trialSecondsLeft: tLeft,
    trialSecondsTotal: user?.trialSecondsTotal || 0,
    freeSubjects: FREE_SUBJECTS,
    warning: tLeft > 0 && tLeft <= 300,
  };
}

export function subjectUnlocked(user, profile, subjectId) {
  if (FREE_SUBJECTS.includes(subjectId)) return true;
  if (isSubscribed(user) || hasSchoolAccess(profile)) return true;
  return trialLeft(user) > 0;
}

export function requireUnlocked(user, profile, subjectId) {
  return subjectUnlocked(user, profile, subjectId)
    ? { ok: true }
    : {
        ok: false,
        code: 'PAYWALL',
        message: 'This subject needs a subscription (₹149/month) or an active free trial. English and GK stay free.',
      };
}

/** Count quiz time against the one-time trial (server-side, per account). */
export function consumeTrial(user, seconds) {
  if (!user || isSubscribed(user) || hasSchoolAccess(null)) return { used: 0, left: trialLeft(user) };
  const before = trialLeft(user);
  const use = Math.min(before, Math.max(0, Math.round(seconds)));
  user.trialSecondsUsed = (user.trialSecondsUsed || 0) + use;
  saveDb();
  return { used: use, left: trialLeft(user) };
}
