// Player progress lives in this browser (no accounts in the MVP).
const KEY = 'aptiquest.profile';
const XP_PER_LEVEL = 300;

const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

export function getProfile() {
  try {
    return { xp: 0, matches: 0, streak: 0, lastPlayed: null, bestScore: 0, recorded: [], ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return { xp: 0, matches: 0, streak: 0, lastPlayed: null, bestScore: 0, recorded: [] };
  }
}

export const levelOf = (xp) => Math.floor(xp / XP_PER_LEVEL) + 1;
export const levelProgress = (xp) => ({ into: xp % XP_PER_LEVEL, size: XP_PER_LEVEL });

// Idempotent per match id, so a page refresh on the results screen never double-counts.
export function recordMatch(matchId, score, xpEarned) {
  const p = getProfile();
  const key = String(matchId);
  if (matchId == null || p.recorded.includes(key)) return p;
  const gap = p.lastPlayed ? daysBetween(p.lastPlayed, today()) : null;
  if (gap === null || gap > 1) p.streak = 1;
  else if (gap === 1) p.streak += 1;
  p.lastPlayed = today();
  p.xp += xpEarned;
  p.matches += 1;
  p.bestScore = Math.max(p.bestScore, score);
  p.recorded = [...p.recorded.slice(-49), key];
  localStorage.setItem(KEY, JSON.stringify(p));
  return p;
}
