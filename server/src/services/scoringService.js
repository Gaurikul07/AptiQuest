// Scoring rules live here so game modes and the UI never need to know the formula.
//   incorrect / unanswered -> 0
//   correct                -> 100 + 50 * (1 - t / T)   (t = server-measured elapsed time, T = time limit)
export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;

export function scoreAnswer({ isCorrect, elapsedMs, timeLimitMs }) {
  if (!isCorrect) return 0;
  const ratio = Math.min(1, Math.max(0, elapsedMs / timeLimitMs));
  return Math.round(BASE_POINTS + MAX_SPEED_BONUS * (1 - ratio));
}

const PLACEMENT_XP = { 1: 50, 2: 30, 3: 20 };
export function xpFor(score, rank) {
  return 20 + Math.round(score / 10) + (PLACEMENT_XP[rank] || 0);
}
