import { getRoom, addPlayer, findActor, publicRoomState } from '../game/roomManager.js';
import { startMatch, restoredState, progressInfo, toHost } from '../game/questionEngine.js';

const reply = (cb, data) => typeof cb === 'function' && cb(data);

export function registerRoomHandlers(io, socket) {
  // Player joins a lobby with a room code.
  socket.on('room:join', (payload = {}, cb) => {
    if (socket.data.roomCode) return reply(cb, { ok: false, error: 'You are already in a room.' });
    const room = getRoom(payload.roomCode);
    const result = addPlayer(room, { name: payload.name, college: payload.college });
    if (result.error) return reply(cb, { ok: false, error: result.error });

    const { player } = result;
    player.socketId = socket.id;
    player.connected = true;
    socket.join(room.code);
    socket.data = { roomCode: room.code, role: 'player', actorId: player.id };
    io.to(room.code).emit('room:state', publicRoomState(room));
    toHost(io, room, 'room:progress', progressInfo(room));
    reply(cb, {
      ok: true,
      roomCode: room.code,
      token: player.token,
      player: { id: player.id, name: player.name, college: player.college },
      room: publicRoomState(room),
    });
  });

  // Reconnect (page refresh, dropped network) using the secret session token.
  socket.on('session:resume', (payload = {}, cb) => {
    const room = getRoom(payload.roomCode);
    if (!room) return reply(cb, { ok: false, error: 'This room no longer exists.' });
    const actor = findActor(room, payload.token);
    if (!actor) return reply(cb, { ok: false, error: 'Session not recognised.' });

    if (actor.role === 'host') {
      room.hostSocketId = socket.id;
      room.hostConnected = true;
      socket.data = { roomCode: room.code, role: 'host', actorId: 'host' };
    } else {
      actor.player.socketId = socket.id;
      actor.player.connected = true;
      socket.data = { roomCode: room.code, role: 'player', actorId: actor.player.id };
    }
    socket.join(room.code);
    socket.emit('session:restored', restoredState(room, actor));
    io.to(room.code).emit('room:state', publicRoomState(room));
    toHost(io, room, 'room:progress', progressInfo(room));
    reply(cb, { ok: true });
  });

  // Only the authenticated host socket may start the match.
  socket.on('room:start', (_payload, cb) => {
    const room = getRoom(socket.data.roomCode);
    if (!room || socket.data.role !== 'host' || room.hostSocketId !== socket.id) {
      return reply(cb, { ok: false, error: 'Only the host can start the match.' });
    }
    reply(cb, startMatch(room, io));
  });

  socket.on('disconnect', () => {
    const room = getRoom(socket.data?.roomCode);
    if (!room) return;
    if (socket.data.role === 'host') {
      if (room.hostSocketId !== socket.id) return; // a newer socket already took over
      room.hostConnected = false;
    } else {
      const player = room.players.get(socket.data.actorId);
      if (!player || player.socketId !== socket.id) return;
      player.connected = false;
      player.socketId = null;
    }
    io.to(room.code).emit('room:state', publicRoomState(room));
  });
}
