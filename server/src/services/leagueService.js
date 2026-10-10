import { db } from '../database/db.js';

// College league rules (capped so large colleges cannot win just by sending more players):
//   every player earns  PARTICIPATION + placement bonus (1st 50, 2nd 30, 3rd 20)
//   a college earns the sum of its TOP_N_PER_COLLEGE players' points in that match
export const PARTICIPATION = 10;
export const PLACEMENT_BONUS = { 1: 50, 2: 30, 3: 20 };
export const TOP_N_PER_COLLEGE = 5;

export function computeLeague(rankedWithCollege) {
  const perPlayer = new Map();
  const byCollege = new Map();
  for (const p of rankedWithCollege) {
    const pts = PARTICIPATION + (PLACEMENT_BONUS[p.rank] || 0);
    perPlayer.set(p.id, pts);
    if (!p.college) continue;
    const list = byCollege.get(p.college) || [];
    list.push(pts);
    byCollege.set(p.college, list);
  }
  const perCollege = new Map();
  for (const [college, list] of byCollege) {
    const top = list.sort((a, b) => b - a).slice(0, TOP_N_PER_COLLEGE);
    perCollege.set(college, top.reduce((s, n) => s + n, 0));
  }
  return { perPlayer, perCollege };
}

export function collegeLeaderboard() {
  return db
    .prepare(
      `SELECT c.name AS name,
              SUM(cp.points) AS points,
              COUNT(DISTINCT cp.match_id) AS matches,
              (SELECT COUNT(DISTINCT lower(mp.display_name)) FROM match_player mp WHERE mp.college_id = c.id) AS players
       FROM college_points cp JOIN college c ON c.id = cp.college_id
       GROUP BY c.id ORDER BY points DESC, matches ASC LIMIT 50`
    )
    .all();
}

// No accounts in the MVP, so players are grouped by display name + college.
export function playerLeaderboard() {
  return db
    .prepare(
      `SELECT mp.display_name AS name, c.name AS college,
              COUNT(*) AS matches, SUM(mp.score) AS totalScore, MAX(mp.score) AS bestScore,
              SUM(mp.league_points) AS leaguePoints, SUM(mp.xp_earned) AS xp
       FROM match_player mp LEFT JOIN college c ON c.id = mp.college_id
       GROUP BY lower(mp.display_name), mp.college_id
       ORDER BY leaguePoints DESC, totalScore DESC LIMIT 50`
    )
    .all();
}

export function listColleges() {
  return db.prepare('SELECT name FROM college ORDER BY name').all().map((r) => r.name);
}
