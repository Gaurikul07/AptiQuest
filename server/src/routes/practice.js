import crypto from 'node:crypto';
import { Router } from 'express';
import { getPracticeQuestions } from '../services/quizService.js';

// Adaptive Battle / practice: solo rounds. Answers are still checked on the server.
const router = Router();
const sessions = new Map();

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

router.post('/practice/start', (req, res) => {
  const topic = req.body?.topic ? String(req.body.topic) : null;
  const difficulty = ['Easy', 'Medium', 'Hard'].includes(req.body?.difficulty) ? req.body.difficulty : 'Medium';
  const count = Math.min(10, Math.max(1, Number(req.body?.count) || 5));
  const picked = getPracticeQuestions({ topic, difficulty, count });
  if (!picked.length) return res.status(404).json({ error: 'No questions found for that topic yet.' });

  const id = crypto.randomBytes(8).toString('hex');
  const questions = new Map();
  const payload = picked.map((q) => {
    const map = {};
    const options = shuffle(q.options.map((text, i) => ({ text, i }))).map(({ text, i }) => {
      const oid = 'p_' + crypto.randomBytes(4).toString('hex');
      map[oid] = i;
      return { id: oid, text };
    });
    questions.set(q.id, { map, correct: q.correctOption, explanation: q.explanation, answered: false });
    return { questionId: q.id, topic: q.topic, difficulty: q.difficulty, questionText: q.questionText, imageUrl: q.imageUrl, table: q.table, timeLimit: q.timeLimit, options };
  });
  sessions.set(id, { questions, createdAt: Date.now() });
  setTimeout(() => sessions.delete(id), 60 * 60 * 1000).unref();
  res.json({ practiceId: id, questions: payload });
});

router.post('/practice/:id/answer', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Practice session expired' });
  const q = session.questions.get(Number(req.body?.questionId));
  if (!q) return res.status(400).json({ error: 'Unknown question' });
  if (q.answered) return res.status(409).json({ error: 'Already answered' });
  const chosen = q.map[req.body?.optionId];
  if (chosen === undefined) return res.status(400).json({ error: 'Invalid option' });
  q.answered = true;
  const correctOptionId = Object.keys(q.map).find((k) => q.map[k] === q.correct);
  res.json({ isCorrect: chosen === q.correct, correctOptionId, explanation: q.explanation });
});

export default router;
