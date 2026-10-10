import crypto from 'node:crypto';
import { getQuiz } from '../services/quizService.js';

// Active rooms live in memory (single-server prototype). Completed results go to SQLite.
export const rooms = new Map();
export const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 200);

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid typos
const newToken = () => crypto.randomBytes(16).toString('hex');
const newId = () => crypto.randomBytes(4).toString('hex');

function generateCode() {
  for (let i = 0; i < 1000; i++) {
    let code = '';
    for (const b of crypto.randomBytes(5)) code += ALPHABET[b % ALPHABET.length];
    if (!rooms.has(code)) return code;
  }
  throw new Error('Could not allocate a room code');
}

export const getRoom = (code) => rooms.get(String(code || '').trim().toUpperCase());

export function createRoom({ quizId, hostName, collegeName }) {
  const quiz = getQuiz(quizId, { includeAnswers: true });
  if (!quiz) return { error: 'Quiz not found', status: 404 };
  if (!quiz.questions.length) return { error: 'This quiz has no questions', status: 400 };
  const room = {
    code: generateCode(),
    quiz,
    hostName: String(hostName || 'Host').trim().slice(0, 24) || 'Host',
    hostToken: newToken(),
    hostSocketId: null,
    hostConnected: false,
    collegeName: String(collegeName || '').trim().slice(0, 60) || null,
    status: 'LOBBY', // LOBBY -> QUESTION -> ROUND_RESULTS -> ... -> FINISHED
    players: new Map(), // public id -> player
    qIndex: -1,
    roundStartedAt: null,
    deadline: null,
    timer: null,
    matchStartedAt: null,
    matchId: null,
    lastHostRound: null,
    finalBase: null,
    createdAt: Date.now(),
  };
  rooms.set(room.code, room);
  return { room };
}

export function addPlayer(room, { name, college }) {
  if (!room) return { error: 'Room not found. Check the code and try again.' };
  if (room.status !== 'LOBBY') return { error: 'This match has already started.' };
  if (room.players.size >= MAX_PLAYERS) return { error: 'This room is full.' };
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!cleanName) return { error: 'Enter a display name.' };
  for (const p of room.players.values()) {
    if (p.name.toLowerCase() === cleanName.toLowerCase()) return { error: 'That name is taken in this room. Pick another.' };
  }
  const player = {
    id: newId(),
    token: newToken(), // secret session token, never broadcast
    name: cleanName,
    college: String(college || room.collegeName || '').trim().slice(0, 60) || null,
    socketId: null,
    connected: false,
    score: 0,
    answers: new Map(), // qIndex -> { questionId, chosenIndex, isCorrect, responseMs, points }
    optionMaps: new Map(), // qIndex -> { optionToken: originalIndex }  (server-side shuffle mapping)
    payloads: new Map(), // qIndex -> payload sent to this player
    lastRound: null,
    final: null,
  };
  room.players.set(player.id, player);
  return { player };
}

// Identify who owns a session token.
export function findActor(room, token) {
  if (!token) return null;
  if (token === room.hostToken) return { role: 'host' };
  for (const p of room.players.values()) if (p.token === token) return { role: 'player', player: p };
  return null;
}

export function publicRoomState(room) {
  const ranked = rankedPlayers(room);
  const rankOf = new Map(ranked.map((r) => [r.id, r.rank]));
  return {
    code: room.code,
    status: room.status,
    quizTitle: room.quiz.title,
    totalQuestions: room.quiz.questions.length,
    college: room.collegeName,
    qIndex: room.qIndex,
    host: { name: room.hostName, connected: room.hostConnected },
    players: [...room.players.values()].map((p) => ({
      id: p.id, name: p.name, college: p.college, connected: p.connected, score: p.score, rank: rankOf.get(p.id),
    })),
  };
}

export function rankedPlayers(room) {
  const list = [...room.players.values()].map((p) => ({
    p,
    // average accepted response time; players with no answers sort last among ties
    avgMs: p.answers.size ? [...p.answers.values()].reduce((s, a) => s + a.responseMs, 0) / p.answers.size : Infinity,
  }));
  // Higher score first; ties broken by faster average response, then name.
  list.sort((a, b) => b.p.score - a.p.score || (a.avgMs === b.avgMs ? 0 : a.avgMs - b.avgMs) || a.p.name.localeCompare(b.p.name));
  return list.map((x, i) => ({
    rank: i + 1, id: x.p.id, name: x.p.name, college: x.p.college, score: x.p.score, connected: x.p.connected,
  }));
}

export function scheduleCleanup(room, ms = 30 * 60 * 1000) {
  setTimeout(() => rooms.delete(room.code), ms).unref();
}

// Remove abandoned lobbies so memory does not grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.status === 'LOBBY' && now - room.createdAt > 3 * 60 * 60 * 1000) rooms.delete(code);
  }
}, 10 * 60 * 1000).unref();
