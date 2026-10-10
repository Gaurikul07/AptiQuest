import { db } from '../database/db.js';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export function validateQuiz(body) {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' };
  const title = String(body.title || '').trim();
  if (!title) return { error: 'Quiz title is required' };
  if (title.length > 120) return { error: 'Quiz title is too long (max 120 characters)' };
  if (!Array.isArray(body.questions) || body.questions.length === 0) return { error: 'Add at least one question' };
  if (body.questions.length > 100) return { error: 'A quiz can have at most 100 questions' };

  const questions = [];
  for (const [i, q] of body.questions.entries()) {
    const n = i + 1;
    if (!q || typeof q !== 'object') return { error: `Question ${n} is invalid` };
    const questionText = String(q.questionText || '').trim();
    if (!questionText) return { error: `Question ${n}: question text is required` };
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o ?? '').trim()) : [];
    if (options.length < 2 || options.length > 6 || options.some((o) => !o)) {
      return { error: `Question ${n}: provide 2 to 6 non-empty options` };
    }
    const correctOption = Number(q.correctOption);
    if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) {
      return { error: `Question ${n}: choose which option is correct` };
    }
    const timeLimit = Math.round(Number(q.timeLimit ?? 20));
    if (!(timeLimit >= 5 && timeLimit <= 180)) return { error: `Question ${n}: time limit must be 5 to 180 seconds` };
    const difficulty = q.difficulty || 'Medium';
    if (!DIFFICULTIES.includes(difficulty)) return { error: `Question ${n}: difficulty must be Easy, Medium or Hard` };
    const imageUrl = q.imageUrl ? String(q.imageUrl).trim() : null;
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) return { error: `Question ${n}: image URL must start with http:// or https://` };

    let table = null;
    if (q.table && Array.isArray(q.table.headers) && Array.isArray(q.table.rows)) {
      const headers = q.table.headers.slice(0, 10).map((h) => String(h ?? '').slice(0, 60));
      const rows = q.table.rows.slice(0, 20).map((r) => (Array.isArray(r) ? r.slice(0, 10).map((c) => String(c ?? '').slice(0, 60)) : []));
      if (headers.length && rows.length) table = { headers, rows };
    }

    questions.push({
      id: Number.isInteger(Number(q.id)) && Number(q.id) > 0 ? Number(q.id) : null,
      topic: String(q.topic || 'General').trim().slice(0, 60) || 'General',
      difficulty,
      questionText: questionText.slice(0, 1000),
      imageUrl,
      table,
      options: options.map((o) => o.slice(0, 300)),
      correctOption,
      timeLimit,
      explanation: q.explanation ? String(q.explanation).trim().slice(0, 600) : null,
    });
  }
  return { value: { title, hostName: String(body.hostName || '').trim().slice(0, 40) || null, questions } };
}

function rowToQuestion(r, includeAnswers) {
  const q = {
    id: r.id,
    position: r.position,
    topic: r.topic,
    difficulty: r.difficulty,
    questionText: r.question_text,
    imageUrl: r.image_url,
    table: r.table_json ? JSON.parse(r.table_json) : null,
    options: JSON.parse(r.options_json),
    timeLimit: r.time_limit,
    explanation: r.explanation,
  };
  if (includeAnswers) q.correctOption = r.correct_option;
  return q;
}

const insertQuestion = db.prepare(
  `INSERT INTO question (quiz_id, position, topic, difficulty, question_text, image_url, table_json, options_json, correct_option, time_limit, explanation)
   VALUES (@quizId, @position, @topic, @difficulty, @questionText, @imageUrl, @tableJson, @optionsJson, @correctOption, @timeLimit, @explanation)`
);
const updateQuestion = db.prepare(
  `UPDATE question SET position=@position, topic=@topic, difficulty=@difficulty, question_text=@questionText, image_url=@imageUrl,
     table_json=@tableJson, options_json=@optionsJson, correct_option=@correctOption, time_limit=@timeLimit, explanation=@explanation
   WHERE id=@id AND quiz_id=@quizId`
);

const params = (quizId, q, position) => ({
  quizId,
  position,
  topic: q.topic,
  difficulty: q.difficulty,
  questionText: q.questionText,
  imageUrl: q.imageUrl,
  tableJson: q.table ? JSON.stringify(q.table) : null,
  optionsJson: JSON.stringify(q.options),
  correctOption: q.correctOption,
  timeLimit: q.timeLimit,
  explanation: q.explanation,
});

export const createQuiz = db.transaction((value) => {
  const { lastInsertRowid } = db.prepare('INSERT INTO quiz (title, host_name) VALUES (?, ?)').run(value.title, value.hostName);
  value.questions.forEach((q, i) => insertQuestion.run(params(lastInsertRowid, q, i)));
  return Number(lastInsertRowid);
});

export const updateQuiz = db.transaction((id, value) => {
  const existing = new Set(db.prepare('SELECT id FROM question WHERE quiz_id = ?').all(id).map((r) => r.id));
  db.prepare("UPDATE quiz SET title = ?, host_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(value.title, value.hostName, id);
  const keep = new Set();
  value.questions.forEach((q, i) => {
    if (q.id && existing.has(q.id)) {
      updateQuestion.run({ ...params(id, q, i), id: q.id });
      keep.add(q.id);
    } else {
      keep.add(Number(insertQuestion.run(params(id, q, i)).lastInsertRowid));
    }
  });
  for (const qid of existing) if (!keep.has(qid)) db.prepare('DELETE FROM question WHERE id = ?').run(qid);
});

export function listQuizzes() {
  return db
    .prepare(
      `SELECT q.id, q.title, q.host_name AS hostName, q.updated_at AS updatedAt, COUNT(qs.id) AS questionCount
       FROM quiz q LEFT JOIN question qs ON qs.quiz_id = q.id GROUP BY q.id ORDER BY q.updated_at DESC, q.id DESC`
    )
    .all();
}

export function getQuiz(id, { includeAnswers = false } = {}) {
  const quiz = db.prepare('SELECT id, title, host_name AS hostName FROM quiz WHERE id = ?').get(id);
  if (!quiz) return null;
  const rows = db.prepare('SELECT * FROM question WHERE quiz_id = ? ORDER BY position, id').all(id);
  return { ...quiz, questions: rows.map((r) => rowToQuestion(r, includeAnswers)) };
}

export function deleteQuiz(id) {
  return db.prepare('DELETE FROM quiz WHERE id = ?').run(id).changes > 0;
}

export function getTopics() {
  return db.prepare('SELECT topic, COUNT(*) AS count FROM question GROUP BY topic ORDER BY count DESC, topic').all();
}

// Questions for Adaptive Battle / practice mode, drawn from every saved quiz.
export function getPracticeQuestions({ topic, difficulty, count = 5 }) {
  const rows = topic
    ? db.prepare('SELECT * FROM question WHERE topic = ? COLLATE NOCASE').all(topic)
    : db.prepare('SELECT * FROM question').all();
  const shuffled = rows.sort(() => Math.random() - 0.5);
  const preferred = shuffled.filter((r) => r.difficulty === difficulty);
  const rest = shuffled.filter((r) => r.difficulty !== difficulty);
  return [...preferred, ...rest].slice(0, count).map((r) => rowToQuestion(r, true));
}
