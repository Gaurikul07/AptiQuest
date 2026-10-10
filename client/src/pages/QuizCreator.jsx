import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useGame } from '../context/GameContext.jsx';

const blankQuestion = () => ({
  topic: '', difficulty: 'Medium', timeLimit: 20, questionText: '', imageUrl: '', tableText: '',
  options: ['', '', '', ''], correctOption: 0, explanation: '',
});

// Table editor format: one row per line, cells separated by commas, first line = headers.
const parseTable = (text) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const [head, ...rows] = lines.map((l) => l.split(',').map((c) => c.trim()));
  return { headers: head, rows };
};
const tableToText = (t) => (t ? [t.headers, ...t.rows].map((r) => r.join(', ')).join('\n') : '');

export default function QuizCreator() {
  const nav = useNavigate();
  const { createRoom } = useGame();
  const [quizzes, setQuizzes] = useState([]);
  const [topics, setTopics] = useState([]);
  const [quiz, setQuiz] = useState({ id: null, title: '', questions: [blankQuestion()] });
  const [hostName, setHostName] = useState(() => localStorage.getItem('aptiquest.hostName') || '');
  const [college, setCollege] = useState(() => localStorage.getItem('aptiquest.hostCollege') || '');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    api.listQuizzes().then(setQuizzes).catch((e) => setMsg({ type: 'error', text: e.message }));
    api.topics().then(setTopics).catch(() => {});
  };
  useEffect(refresh, []);

  const setQ = (i, patch) => setQuiz((z) => ({ ...z, questions: z.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) }));
  const setOption = (i, j, value) => setQ(i, { options: quiz.questions[i].options.map((o, k) => (k === j ? value : o)) });
  const move = (i, dir) => setQuiz((z) => {
    const qs = [...z.questions];
    const j = i + dir;
    if (j < 0 || j >= qs.length) return z;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    return { ...z, questions: qs };
  });
  const remove = (i) => setQuiz((z) => ({ ...z, questions: z.questions.length > 1 ? z.questions.filter((_, k) => k !== i) : z.questions }));
  const duplicate = (i) => setQuiz((z) => {
    const qs = [...z.questions];
    qs.splice(i + 1, 0, { ...qs[i], id: undefined, options: [...qs[i].options] });
    return { ...z, questions: qs };
  });

  const payload = () => ({
    title: quiz.title,
    hostName,
    questions: quiz.questions.map((q) => ({
      id: q.id, topic: q.topic || 'General', difficulty: q.difficulty, timeLimit: Number(q.timeLimit),
      questionText: q.questionText, imageUrl: q.imageUrl || null, table: parseTable(q.tableText),
      options: q.options, correctOption: q.correctOption, explanation: q.explanation || null,
    })),
  });

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = payload();
      const res = quiz.id ? await api.updateQuiz(quiz.id, body) : await api.createQuiz(body);
      setMsg({ type: 'ok', text: 'Quiz saved.' });
      await loadQuiz(res.id);
      refresh();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setBusy(false); }
  };

  const loadQuiz = async (id) => {
    const q = await api.getQuiz(id);
    setQuiz({
      id: q.id, title: q.title,
      questions: q.questions.map((x) => ({
        id: x.id, topic: x.topic, difficulty: x.difficulty, timeLimit: x.timeLimit, questionText: x.questionText,
        imageUrl: x.imageUrl || '', tableText: tableToText(x.table), options: x.options,
        correctOption: x.correctOption, explanation: x.explanation || '',
      })),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const host = async (id) => {
    setMsg(null);
    if (!hostName.trim()) return setMsg({ type: 'error', text: 'Enter your host name first.' });
    localStorage.setItem('aptiquest.hostName', hostName);
    localStorage.setItem('aptiquest.hostCollege', college);
    try {
      const code = await createRoom({ quizId: id, hostName, college });
      nav(`/room/${code}`);
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this quiz? Past results are kept.')) return;
    await api.deleteQuiz(id);
    if (quiz.id === id) setQuiz({ id: null, title: '', questions: [blankQuestion()] });
    refresh();
  };

  return (
    <div className="creator">
      <section className="panel">
        <h2>Saved quizzes</h2>
        <div className="form two">
          <label>Your host name<input value={hostName} maxLength={24} onChange={(e) => setHostName(e.target.value)} placeholder="Prof. Rao" /></label>
          <label>Room college (optional)<input value={college} maxLength={60} onChange={(e) => setCollege(e.target.value)} placeholder="Default college for players" /></label>
        </div>
        {quizzes.length === 0 ? <p className="muted">No quizzes yet. Build one below.</p> : (
          <ul className="quizlist">
            {quizzes.map((z) => (
              <li key={z.id}>
                <div><b>{z.title}</b><small>{z.questionCount} questions</small></div>
                <div className="row">
                  <button className="btn btn-primary" onClick={() => host(z.id)}>Host</button>
                  <button className="btn" onClick={() => loadQuiz(z.id)}>Edit</button>
                  <button className="btn btn-ghost" onClick={() => del(z.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {msg && <p className={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</p>}
      </section>

      <section className="panel">
        <div className="row spread">
          <h2>{quiz.id ? 'Edit quiz' : 'New quiz'}</h2>
          {quiz.id && <button className="btn btn-ghost" onClick={() => setQuiz({ id: null, title: '', questions: [blankQuestion()] })}>Start a new quiz</button>}
        </div>
        <label className="form">Quiz title
          <input value={quiz.title} maxLength={120} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} placeholder="Placement round 1" />
        </label>
        <datalist id="topics">{topics.map((t) => <option key={t.topic} value={t.topic} />)}</datalist>

        {quiz.questions.map((q, i) => (
          <fieldset key={q.id ?? `new-${i}`} className="qedit">
            <legend>Question {i + 1}</legend>
            <div className="row spread">
              <div className="row">
                <button className="btn btn-small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">Up</button>
                <button className="btn btn-small" onClick={() => move(i, 1)} disabled={i === quiz.questions.length - 1} aria-label="Move down">Down</button>
                <button className="btn btn-small" onClick={() => duplicate(i)}>Duplicate</button>
              </div>
              <button className="btn btn-small btn-ghost" onClick={() => remove(i)} disabled={quiz.questions.length === 1}>Remove</button>
            </div>
            <label className="form">Question
              <textarea rows={2} value={q.questionText} onChange={(e) => setQ(i, { questionText: e.target.value })} />
            </label>
            <div className="form three">
              <label>Topic<input list="topics" value={q.topic} onChange={(e) => setQ(i, { topic: e.target.value })} placeholder="Percentages" /></label>
              <label>Difficulty
                <select value={q.difficulty} onChange={(e) => setQ(i, { difficulty: e.target.value })}>
                  <option>Easy</option><option>Medium</option><option>Hard</option>
                </select>
              </label>
              <label>Time limit (s)<input type="number" min={5} max={180} value={q.timeLimit} onChange={(e) => setQ(i, { timeLimit: e.target.value })} /></label>
            </div>
            <div className="opts">
              {q.options.map((o, j) => (
                <label key={j} className="optrow">
                  <input type="radio" name={`correct-${i}`} checked={q.correctOption === j} onChange={() => setQ(i, { correctOption: j })} aria-label={`Option ${j + 1} is correct`} />
                  <input value={o} onChange={(e) => setOption(i, j, e.target.value)} placeholder={`Option ${j + 1}`} />
                </label>
              ))}
              <small className="muted">Select the radio button next to the correct option.</small>
            </div>
            <label className="form">Explanation shown after the round (optional)
              <input value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} />
            </label>
            <details>
              <summary>Add an image or table</summary>
              <label className="form">Image URL<input value={q.imageUrl} onChange={(e) => setQ(i, { imageUrl: e.target.value })} placeholder="https://..." /></label>
              <label className="form">Table (one row per line, cells separated by commas, first line is the header)
                <textarea rows={4} value={q.tableText} onChange={(e) => setQ(i, { tableText: e.target.value })} placeholder={'Year, Sales\n2023, 120\n2024, 150'} />
              </label>
            </details>
          </fieldset>
        ))}
        <div className="row">
          <button className="btn" onClick={() => setQuiz((z) => ({ ...z, questions: [...z.questions, blankQuestion()] }))}>Add question</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save quiz'}</button>
        </div>
      </section>
    </div>
  );
}
