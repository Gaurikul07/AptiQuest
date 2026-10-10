import crypto from 'node:crypto';
import { scoreAnswer, xpFor } from '../services/scoringService.js';
import { analyzePlayer, summarizeTopics } from '../services/analyticsService.js';
import { persistMatch } from '../services/resultsService.js';
import { rankedPlayers, publicRoomState, scheduleCleanup } from './roomManager.js';

export const RESULT_PAUSE_MS = Number(process.env.RESULT_PAUSE_MS || 5000);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const currentQuestion = (room) => room.quiz.questions[room.qIndex];
const answeredCount = (room) => [...room.players.values()].filter((p) => p.answers.has(room.qIndex)).length;
export const progressInfo = (room) => ({
  answered: room.status === 'QUESTION' || room.status === 'ROUND_RESULTS' ? answeredCount(room) : 0,
  total: room.players.size,
});

function basePayload(room, qIndex) {
  const q = room.quiz.questions[qIndex];
  return {
    questionId: q.id,
    index: qIndex,
    total: room.quiz.questions.length,
    topic: q.topic,
    difficulty: q.difficulty,
    questionText: q.questionText,
    imageUrl: q.imageUrl,
    table: q.table,
    timeLimit: q.timeLimit,
  };
}

// Each player gets their own option order and opaque option ids. The mapping back to the
// real option index only exists on the server, so the client can never tell which is correct.
export function playerQuestion(room, player) {
  const qIndex = room.qIndex;
  let payload = player.payloads.get(qIndex);
  if (!payload) {
    const q = room.quiz.questions[qIndex];
    const map = {};
    const options = shuffle(q.options.map((text, i) => ({ text, i }))).map(({ text, i }) => {
      const id = 'o_' + crypto.randomBytes(5).toString('hex');
      map[id] = i;
      return { id, text };
    });
    player.optionMaps.set(qIndex, map);
    payload = { ...basePayload(room, qIndex), options };
    player.payloads.set(qIndex, payload);
  }
  return { ...payload, startedAt: room.roundStartedAt, deadline: room.deadline, serverNow: Date.now() };
}

export function hostQuestion(room) {
  const q = currentQuestion(room);
  return {
    ...basePayload(room, room.qIndex),
    options: q.options.map((text, i) => ({ id: 'h' + i, text })),
    startedAt: room.roundStartedAt,
    deadline: room.deadline,
    serverNow: Date.now(),
  };
}

const optionIdFor = (player, qIndex, originalIndex) => {
  const map = player.optionMaps.get(qIndex) || {};
  return Object.keys(map).find((id) => map[id] === originalIndex) || null;
};
export const chosenOptionId = (player, qIndex) => {
  const a = player.answers.get(qIndex);
  return a ? optionIdFor(player, qIndex, a.chosenIndex) : null;
};

const toHost = (io, room, event, data) => {
  if (room.hostConnected && room.hostSocketId) io.to(room.hostSocketId).emit(event, data);
};

export function startMatch(room, io) {
  if (room.status !== 'LOBBY') return { ok: false, error: 'The match has already started.' };
  if (room.players.size === 0) return { ok: false, error: 'Wait for at least one player to join.' };
  room.matchStartedAt = Date.now();
  room.qIndex = 0;
  startRound(room, io);
  return { ok: true };
}

function startRound(room, io) {
  const q = currentQuestion(room);
  room.status = 'QUESTION';
  room.roundStartedAt = Date.now();
  room.deadline = room.roundStartedAt + q.timeLimit * 1000;
  room.closing = false;

  io.to(room.code).emit('room:state', publicRoomState(room));
  for (const player of room.players.values()) {
    if (player.connected && player.socketId) io.to(player.socketId).emit('quiz:question', playerQuestion(room, player));
  }
  toHost(io, room, 'quiz:question', hostQuestion(room));
  toHost(io, room, 'room:progress', progressInfo(room));

  const idx = room.qIndex;
  clearTimeout(room.timer);
  room.timer = setTimeout(() => closeRound(room, io, idx), q.timeLimit * 1000);
}

// Validate and record one answer. Everything is decided from server-side state and the
// server's own receipt time; nothing the client claims about time is trusted.
export function submitAnswer(room, player, data, receivedAt = Date.now()) {
  const reject = (reason) => ({ ok: false, reason });
  if (room.status !== 'QUESTION') return reject('round-closed');
  const q = currentQuestion(room);
  if (!data || Number(data.questionId) !== q.id) return reject('wrong-question');
  if (receivedAt > room.deadline) return reject('late');
  if (player.answers.has(room.qIndex)) return reject('duplicate');
  const map = player.optionMaps.get(room.qIndex);
  const chosenIndex = typeof data.optionId === 'string' && map ? map[data.optionId] : undefined;
  if (chosenIndex === undefined) return reject('invalid-option');

  const responseMs = Math.max(0, receivedAt - room.roundStartedAt);
  const isCorrect = chosenIndex === q.correctOption;
  const points = scoreAnswer({ isCorrect, elapsedMs: responseMs, timeLimitMs: q.timeLimit * 1000 });
  player.answers.set(room.qIndex, { questionId: q.id, chosenIndex, isCorrect, responseMs, points });
  player.score += points;
  // Correctness is deliberately NOT returned here; it is revealed when the round closes.
  return { ok: true, accepted: true, questionId: q.id };
}

// Idempotent: guarded by status + round index so a timer firing twice cannot double-close.
export function closeRound(room, io, qIndex) {
  if (room.status !== 'QUESTION' || room.qIndex !== qIndex || room.closing) return;
  room.closing = true;
  room.status = 'ROUND_RESULTS';
  clearTimeout(room.timer);

  const q = currentQuestion(room);
  const ranked = rankedPlayers(room);
  const rankOf = new Map(ranked.map((r) => [r.id, r.rank]));
  const isLast = qIndex === room.quiz.questions.length - 1;
  const nextAt = Date.now() + RESULT_PAUSE_MS;

  const counts = q.options.map(() => 0);
  for (const player of room.players.values()) {
    const a = player.answers.get(qIndex);
    if (a) counts[a.chosenIndex] += 1;
    const map = player.optionMaps.get(qIndex) || {};
    player.lastRound = {
      questionId: q.id,
      index: qIndex,
      correctOptionId: Object.keys(map).find((id) => map[id] === q.correctOption) || null,
      correctText: q.options[q.correctOption],
      explanation: q.explanation,
      yourOptionId: chosenOptionId(player, qIndex),
      answered: !!a,
      isCorrect: !!a?.isCorrect,
      points: a?.points || 0,
      totalScore: player.score,
      rank: rankOf.get(player.id),
      isLast,
      nextAt,
    };
    if (player.connected && player.socketId) io.to(player.socketId).emit('round:result', player.lastRound);
  }

  room.lastHostRound = {
    questionId: q.id,
    index: qIndex,
    correctText: q.options[q.correctOption],
    explanation: q.explanation,
    distribution: q.options.map((text, i) => ({ text, count: counts[i], correct: i === q.correctOption })),
    answered: answeredCount(room),
    totalPlayers: room.players.size,
    isLast,
    nextAt,
  };
  toHost(io, room, 'round:result', room.lastHostRound);
  io.to(room.code).emit('room:state', publicRoomState(room));
  io.to(room.code).emit('leaderboard:update', { qIndex, leaderboard: ranked.slice(0, 10) });

  room.timer = setTimeout(() => {
    if (room.status !== 'ROUND_RESULTS' || room.qIndex !== qIndex) return;
    if (isLast) finishMatch(room, io);
    else {
      room.qIndex += 1;
      startRound(room, io);
    }
  }, RESULT_PAUSE_MS);
}

export function finishMatch(room, io) {
  if (room.status === 'FINISHED') return;
  room.status = 'FINISHED';
  clearTimeout(room.timer);
  const questions = room.quiz.questions;
  const ranked = rankedPlayers(room);

  const results = new Map();
  for (const entry of ranked) {
    const player = room.players.get(entry.id);
    const analytics = analyzePlayer(player, questions);
    results.set(entry.id, {
      ...analytics,
      rank: entry.rank,
      score: entry.score,
      xpEarned: xpFor(entry.score, entry.rank),
    });
  }

  let persisted = { matchId: null, leagueAwarded: [] };
  try {
    persisted = persistMatch(room, ranked, results);
    room.matchId = persisted.matchId;
  } catch (err) {
    console.error('Failed to persist match results:', err);
  }

  room.finalBase = {
    matchId: persisted.matchId,
    quizTitle: room.quiz.title,
    totalQuestions: questions.length,
    podium: ranked.slice(0, 3),
    leaderboard: ranked.slice(0, 50),
    topicSummary: summarizeTopics([...results.values()]),
    leagueAwarded: persisted.leagueAwarded,
    totalPlayers: ranked.length,
  };

  for (const player of room.players.values()) {
    player.final = { ...room.finalBase, you: results.get(player.id) };
    if (player.connected && player.socketId) io.to(player.socketId).emit('quiz:finished', player.final);
  }
  toHost(io, room, 'quiz:finished', { ...room.finalBase, you: null });
  io.to(room.code).emit('room:state', publicRoomState(room));
  scheduleCleanup(room);
}

// Everything a (re)connecting client needs to continue exactly where it left off.
export function restoredState(room, actor) {
  const state = {
    role: actor.role,
    room: publicRoomState(room),
    leaderboard: rankedPlayers(room).slice(0, 10),
    serverNow: Date.now(),
    progress: progressInfo(room),
    question: null,
    answered: false,
    chosenOptionId: null,
    roundResult: null,
    final: null,
    you: null,
  };
  const live = room.status === 'QUESTION' || room.status === 'ROUND_RESULTS';

  if (actor.role === 'host') {
    if (live) state.question = hostQuestion(room);
    if (room.status === 'ROUND_RESULTS') state.roundResult = room.lastHostRound;
    if (room.status === 'FINISHED') state.final = { ...room.finalBase, you: null };
    return state;
  }

  const p = actor.player;
  const rank = rankedPlayers(room).find((r) => r.id === p.id)?.rank;
  state.you = { id: p.id, name: p.name, college: p.college, score: p.score, rank };
  if (live) {
    state.question = playerQuestion(room, p);
    state.answered = p.answers.has(room.qIndex); // already answered? no second attempt after reconnect
    state.chosenOptionId = chosenOptionId(p, room.qIndex);
  }
  if (room.status === 'ROUND_RESULTS') state.roundResult = p.lastRound;
  if (room.status === 'FINISHED') state.final = p.final;
  return state;
}

export { toHost };
