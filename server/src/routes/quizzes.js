import { Router } from 'express';
import { validateQuiz, createQuiz, updateQuiz, listQuizzes, getQuiz, deleteQuiz, getTopics } from '../services/quizService.js';

const router = Router();
const parseId = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

router.get('/quizzes', (_req, res) => res.json(listQuizzes()));

// NOTE: the MVP has no accounts, so the editor endpoint returns answer keys to anyone who asks.
// Add host authentication (Phase 2) before exposing this publicly.
router.get('/quizzes/:id', (req, res) => {
  const quiz = getQuiz(parseId(req.params.id), { includeAnswers: true });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  res.json(quiz);
});

router.post('/quizzes', (req, res) => {
  const { error, value } = validateQuiz(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json({ id: createQuiz(value) });
});

router.put('/quizzes/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id || !getQuiz(id)) return res.status(404).json({ error: 'Quiz not found' });
  const { error, value } = validateQuiz(req.body);
  if (error) return res.status(400).json({ error });
  updateQuiz(id, value);
  res.json({ id });
});

router.delete('/quizzes/:id', (req, res) => {
  if (!deleteQuiz(parseId(req.params.id))) return res.status(404).json({ error: 'Quiz not found' });
  res.json({ ok: true });
});

router.get('/topics', (_req, res) => res.json(getTopics()));

export default router;
