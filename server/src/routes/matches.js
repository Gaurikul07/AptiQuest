import { Router } from 'express';
import { createRoom, getRoom } from '../game/roomManager.js';
import { getMatchResults } from '../services/resultsService.js';

const router = Router();

// Create a room from a saved quiz. Returns the join code and the host's secret session token.
router.post('/matches', (req, res) => {
  const quizId = Number(req.body?.quizId);
  if (!Number.isInteger(quizId)) return res.status(400).json({ error: 'quizId is required' });
  const result = createRoom({ quizId, hostName: req.body.hostName, collegeName: req.body.college });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(201).json({ roomCode: result.room.code, hostToken: result.room.hostToken });
});

// Public room check used by the Join screen.
router.get('/rooms/:code', (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ exists: false, error: 'Room not found' });
  res.json({
    exists: true,
    status: room.status,
    quizTitle: room.quiz.title,
    college: room.collegeName,
    players: room.players.size,
    joinable: room.status === 'LOBBY',
  });
});

router.get('/matches/:id/results', (req, res) => {
  const results = getMatchResults(Number(req.params.id));
  if (!results) return res.status(404).json({ error: 'Match not found' });
  res.json(results);
});

export default router;
