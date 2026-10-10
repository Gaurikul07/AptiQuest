// 50-client simulation for AptiQuest.
// Usage:  node loadTest.js [--clients 50] [--server http://localhost:4000] [--questions 3] [--seconds 8]
// Tip:    start the server with RESULT_PAUSE_MS=1500 to make the run faster.
//
// Scenario (per round, by client index):
//   i % 10 === 0  -> submits LATE (after the server deadline)   -> must be rejected
//   i % 10 === 1  -> submits the same answer TWICE              -> second must be rejected as duplicate
//   i === 2       -> disconnects mid-question, resumes session  -> must get the same question, not yet answered
//   everyone else -> answers after a random 0.2s to 3s delay (about 70% pick the correct option)
// Only measured numbers are reported; nothing is estimated.
import { io } from 'socket.io-client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const SERVER = arg('server', 'http://localhost:4000');
const CLIENTS = Number(arg('clients', 50));
const QUESTIONS = Number(arg('questions', 3));
const SECONDS = Number(arg('seconds', 8));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (p, body) => {
  const res = await fetch(SERVER + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`${p}: ${data.error}`);
  return data;
};
const get = async (p) => (await fetch(SERVER + p)).json();
const stats = (arr) => {
  if (!arr.length) return { count: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { count: s.length, avgMs: Math.round(s.reduce((a, b) => a + b, 0) / s.length), p95Ms: q(0.95), maxMs: s.at(-1) };
};

const m = {
  connected: 0, joined: 0, connectErrors: 0, disconnectsUnexpected: 0,
  answersSent: 0, accepted: 0, duplicatesSent: 0, duplicatesRejected: 0, lateSent: 0, lateRejected: 0,
  unexpectedRejections: 0, unexpectedErrors: 0, roundResultsReceived: 0, finished: 0,
  reconnectAttempts: 0, reconnectOk: 0, correctOptionHiddenViolations: 0,
};
const joinLatency = [];
const ackLatency = [];
const problems = [];
const fail = (msg) => { m.unexpectedErrors++; problems.push(msg); };

let keyText = new Map();

async function main() {
  console.log(`AptiQuest load test: ${CLIENTS} clients, ${QUESTIONS} questions x ${SECONDS}s against ${SERVER}`);
  const health = await get('/api/health').catch(() => null);
  if (!health?.ok) throw new Error(`Server not reachable at ${SERVER}`);

  // 1. Create a quiz, then fetch the answer key (the test needs it to answer correctly).
  const quizId = (await post('/api/quizzes', {
    title: `Load test ${new Date().toISOString()}`,
    questions: Array.from({ length: QUESTIONS }, (_, i) => ({
      topic: i % 2 ? 'Logic' : 'Maths', difficulty: 'Easy', timeLimit: SECONDS, questionText: `Load test question ${i + 1}: pick option B`,
      options: ['A', 'B', 'C', 'D'], correctOption: 1,
    })),
  })).id;
  const quiz = await get(`/api/quizzes/${quizId}`);
  keyText = new Map(quiz.questions.map((q) => [q.id, q.options[q.correctOption]]));

  // 2. Host creates the room and connects.
  const { roomCode, hostToken } = await post('/api/matches', { quizId, hostName: 'LoadHost', college: 'Load College' });
  const host = io(SERVER, { transports: ['websocket'] });
  await new Promise((res, rej) => { host.on('connect', res); host.on('connect_error', rej); });
  await new Promise((res) => host.emit('session:resume', { roomCode, token: hostToken }, res));
  let hostFinished = null;
  host.on('quiz:finished', (d) => { hostFinished = d; });

  // 3. Spawn clients and join concurrently.
  const clients = Array.from({ length: CLIENTS }, (_, i) => ({ i, name: `Bot${String(i).padStart(2, '0')}`, token: null, socket: null, roomCode, done: false }));

  await Promise.all(clients.map(async (c) => {
    const socket = io(SERVER, { transports: ['websocket'], reconnection: false });
    c.socket = socket;
    try {
      await new Promise((res, rej) => { socket.on('connect', res); socket.on('connect_error', rej); });
      m.connected++;
    } catch { m.connectErrors++; return; }
    socket.on('disconnect', (reason) => { if (!c.expectedDisconnect && !c.done) m.disconnectsUnexpected++; });
    attachHandlers(c, socket);
    const t0 = Date.now();
    const ack = await new Promise((res) => socket.emit('room:join', { roomCode, name: c.name, college: `College ${c.i % 5}` }, res));
    if (ack?.ok) { c.token = ack.token; m.joined++; joinLatency.push(Date.now() - t0); } else fail(`join failed for ${c.name}: ${ack?.error}`);
  }));
  console.log(`connected ${m.connected}/${CLIENTS}, joined ${m.joined}/${CLIENTS}`);

  // 4. Host starts; wait for everyone to finish.
  const startAck = await new Promise((res) => host.emit('room:start', {}, res));
  if (!startAck.ok) throw new Error(`start failed: ${startAck.error}`);
  const deadline = Date.now() + QUESTIONS * (SECONDS + 10) * 1000 + 30000;
  while (Date.now() < deadline && m.finished < m.joined) await sleep(250);
  await sleep(500);

  // 5. Verify persisted results and the college league via REST.
  let persisted = null;
  if (hostFinished?.matchId) persisted = await get(`/api/matches/${hostFinished.matchId}/results`);
  const league = await get('/api/leaderboard/colleges');

  for (const c of clients) { c.done = true; c.socket?.close(); }
  host.close();

  const expectedLate = m.lateSent, expectedDup = m.duplicatesSent;
  if (m.lateRejected !== expectedLate) fail(`late answers: sent ${expectedLate}, rejected ${m.lateRejected}`);
  if (m.duplicatesRejected !== expectedDup) fail(`duplicate answers: sent ${expectedDup}, rejected ${m.duplicatesRejected}`);
  if (m.reconnectAttempts && m.reconnectOk !== m.reconnectAttempts) fail('reconnect check failed');
  if (m.finished !== m.joined) fail(`only ${m.finished}/${m.joined} clients received final results`);
  if (persisted && persisted.players.length !== m.joined) fail(`persisted ${persisted.players.length} players, expected ${m.joined}`);
  if (!persisted) fail('match results were not persisted / not returned');

  const report = {
    when: new Date().toISOString(), server: SERVER, config: { clients: CLIENTS, questions: QUESTIONS, secondsPerQuestion: SECONDS },
    metrics: m, joinLatency: stats(joinLatency), answerAckLatency: stats(ackLatency),
    persistedPlayers: persisted?.players.length ?? 0, collegeLeaguePreview: league.slice(0, 5), problems,
    verdict: problems.length === 0 && m.connectErrors === 0 && m.unexpectedRejections === 0 ? 'PASS' : 'FAIL',
  };
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `loadtest-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nSaved: ${file}\nVerdict: ${report.verdict}`);
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

function attachHandlers(c, socket) {
  const submit = (q, optionId) => new Promise((resolve) => {
    const t0 = Date.now();
    socket.emit('answer:submit', { questionId: q.questionId, optionId }, (ack) => { ackLatency.push(Date.now() - t0); resolve(ack); });
  });

  socket.on('quiz:question', async (q) => {
    if (JSON.stringify(q).toLowerCase().includes('correct')) m.correctOptionHiddenViolations++;
    const correct = q.options.find((o) => o.text === keyText.get(q.questionId));
    const wrong = q.options.find((o) => o.text !== keyText.get(q.questionId));
    const pick = Math.random() < 0.7 ? correct : wrong;
    const untilDeadline = q.deadline - q.serverNow; // remaining ms according to the server

    if (c.i % 10 === 0) { // LATE submitter
      await sleep(untilDeadline + 300);
      m.answersSent++; m.lateSent++;
      const ack = await submit(q, pick.id);
      if (!ack.ok && (ack.reason === 'late' || ack.reason === 'round-closed')) m.lateRejected++;
      else if (ack.ok) m.unexpectedRejections++, fail(`${c.name}: late answer was accepted!`);
      return;
    }
    if (c.i === 2 && !c.reconnectedOnce) { // RECONNECT test during the first question
      c.reconnectedOnce = true;
      await sleep(400);
      m.reconnectAttempts++;
      c.expectedDisconnect = true;
      socket.disconnect();
      await sleep(600);
      c.expectedDisconnect = false;
      const restored = new Promise((res) => socket.once('session:restored', res));
      socket.connect();
      await new Promise((res) => socket.once('connect', res));
      const ack = await new Promise((res) => socket.emit('session:resume', { roomCode: c.roomCode, token: c.token }, res));
      const state = await Promise.race([restored, sleep(3000).then(() => null)]);
      if (ack?.ok && state?.question?.questionId === q.questionId && state.answered === false) m.reconnectOk++;
      else fail(`${c.name}: reconnect did not restore the question (ack=${JSON.stringify(ack)})`);
      // fall through and answer normally with the restored payload
      const again = state?.question || q;
      const opt = again.options.find((o) => o.text === keyText.get(again.questionId)) || again.options[0];
      m.answersSent++;
      const r = await submit(again, opt.id);
      r.ok ? m.accepted++ : (m.unexpectedRejections++, fail(`${c.name}: post-reconnect answer rejected: ${r.reason}`));
      return;
    }

    await sleep(200 + Math.random() * Math.min(2800, Math.max(0, untilDeadline - 1500)));
    m.answersSent++;
    const ack = await submit(q, pick.id);
    if (ack.ok) m.accepted++; else { m.unexpectedRejections++; fail(`${c.name}: valid answer rejected: ${ack.reason}`); }
    if (c.i % 10 === 1) { // DUPLICATE submitter
      m.answersSent++; m.duplicatesSent++;
      const dup = await submit(q, pick.id);
      if (!dup.ok && dup.reason === 'duplicate') m.duplicatesRejected++; else fail(`${c.name}: duplicate answer was not rejected (${JSON.stringify(dup)})`);
    }
  });
  socket.on('round:result', () => { m.roundResultsReceived++; });
  socket.on('quiz:finished', () => { m.finished++; });
}

main().catch((e) => { console.error('Load test crashed:', e.message); process.exit(2); });
