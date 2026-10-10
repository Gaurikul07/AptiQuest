import { getRoom } from '../game/roomManager.js';
import { submitAnswer, toHost, progressInfo } from '../game/questionEngine.js';

const reply = (cb, data) => typeof cb === 'function' && cb(data);
const WINDOW_MS = 10_000;
const MAX_MESSAGES = 30;

export function registerQuizHandlers(io, socket) {
  socket.on('answer:submit', (payload = {}, cb) => {
    const receivedAt = Date.now(); // server receipt time: the only clock used for scoring
    const respond = (result) => {
      socket.emit('answer:status', result);
      reply(cb, result);
    };

    // Basic abuse protection: cap messages per socket.
    const recent = (socket.data.answerTimes = (socket.data.answerTimes || []).filter((t) => receivedAt - t < WINDOW_MS));
    recent.push(receivedAt);
    if (recent.length > MAX_MESSAGES) return respond({ ok: false, reason: 'rate-limited' });

    const { roomCode, role, actorId } = socket.data;
    if (role !== 'player') return respond({ ok: false, reason: 'not-a-player' });
    const room = getRoom(roomCode);
    const player = room?.players.get(actorId);
    if (!room || !player || player.socketId !== socket.id) return respond({ ok: false, reason: 'not-in-room' });

    const result = submitAnswer(room, player, payload, receivedAt);
    respond(result);
    if (result.ok) toHost(io, room, 'room:progress', progressInfo(room));
  });
}
