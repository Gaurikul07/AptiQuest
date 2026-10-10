import { db, upsertCollege } from '../database/db.js';
import { computeLeague } from './leagueService.js';

// Persist a finished match in one transaction. `ranked` comes from roomManager.rankedPlayers,
// `results` maps player id -> analytics result (mutated here to add leaguePoints).
export function persistMatch(room, ranked, results) {
  const run = db.transaction(() => {
    const roomCollegeId = upsertCollege(room.collegeName);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO matches (quiz_id, quiz_title, room_code, college_id, status, total_questions, started_at, finished_at)
         VALUES (?, ?, ?, ?, 'FINISHED', ?, ?, ?)`
      )
      .run(
        room.quiz.id,
        room.quiz.title,
        room.code,
        roomCollegeId,
        room.quiz.questions.length,
        new Date(room.matchStartedAt || Date.now()).toISOString(),
        new Date().toISOString()
      );
    const matchId = Number(lastInsertRowid);

    const league = computeLeague(ranked);
    const insertPlayer = db.prepare(
      `INSERT INTO match_player (match_id, display_name, college_id, score, correct_count, answered_count, accuracy, avg_response_ms, rank, xp_earned, league_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertAnswer = db.prepare(
      `INSERT INTO answer (match_id, match_player_id, question_id, topic, response_ms, is_correct, points) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (const entry of ranked) {
      const player = room.players.get(entry.id);
      const r = results.get(entry.id);
      const leaguePoints = league.perPlayer.get(entry.id) || 0;
      r.leaguePoints = leaguePoints;
      const mpId = Number(
        insertPlayer.run(
          matchId, player.name, upsertCollege(player.college), player.score, r.correct, r.answered,
          r.accuracy, r.avgResponseMs, entry.rank, r.xpEarned, leaguePoints
        ).lastInsertRowid
      );
      for (const [qIndex, a] of player.answers) {
        const q = room.quiz.questions[qIndex];
        insertAnswer.run(matchId, mpId, q.id, q.topic, a.responseMs, a.isCorrect ? 1 : 0, a.points);
      }
    }

    const leagueAwarded = [];
    for (const [college, points] of league.perCollege) {
      db.prepare('INSERT INTO college_points (match_id, college_id, points) VALUES (?, ?, ?)').run(matchId, upsertCollege(college), points);
      leagueAwarded.push({ college, points });
    }
    leagueAwarded.sort((a, b) => b.points - a.points);
    return { matchId, leagueAwarded };
  });
  return run();
}

export function getMatchResults(matchId) {
  const match = db
    .prepare(
      `SELECT m.id, m.quiz_title AS quizTitle, m.room_code AS roomCode, m.total_questions AS totalQuestions,
              m.started_at AS startedAt, m.finished_at AS finishedAt, c.name AS college
       FROM matches m LEFT JOIN college c ON c.id = m.college_id WHERE m.id = ?`
    )
    .get(matchId);
  if (!match) return null;
  const players = db
    .prepare(
      `SELECT mp.rank, mp.display_name AS name, c.name AS college, mp.score, mp.correct_count AS correct,
              mp.answered_count AS answered, mp.accuracy, mp.avg_response_ms AS avgResponseMs,
              mp.xp_earned AS xpEarned, mp.league_points AS leaguePoints
       FROM match_player mp LEFT JOIN college c ON c.id = mp.college_id
       WHERE mp.match_id = ? ORDER BY mp.rank`
    )
    .all(matchId);
  const colleges = db
    .prepare('SELECT c.name, cp.points FROM college_points cp JOIN college c ON c.id = cp.college_id WHERE cp.match_id = ? ORDER BY cp.points DESC')
    .all(matchId);
  return { match, players, colleges };
}
