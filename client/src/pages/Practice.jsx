import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import QuestionCard from '../components/QuestionCard.jsx';

export default function Practice() {
  const [params] = useSearchParams();
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState(params.get('topic') || '');
  const [difficulty, setDifficulty] = useState(params.get('difficulty') || 'Medium');
  const [session, setSession] = useState(null); // { practiceId, questions }
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');
  const autoStarted = useRef(false);

  useEffect(() => { api.topics().then(setTopics).catch((e) => setError(e.message)); }, []);

  const start = async (t = topic, d = difficulty) => {
    setError('');
    try {
      const s = await api.startPractice({ topic: t || null, difficulty: d, count: 5 });
      setSession(s); setI(0); setChosen(null); setFeedback(null); setScore(0);
    } catch (e) { setError(e.message); }
  };

  // Arriving from the Adaptive Battle button starts the round straight away.
  useEffect(() => {
    if (params.get('auto') && params.get('topic') && !autoStarted.current) {
      autoStarted.current = true;
      start(params.get('topic'), params.get('difficulty') || 'Medium');
    }
  }, []); // eslint-disable-line

  const pick = async (optionId) => {
    const q = session.questions[i];
    setChosen(optionId);
    try {
      const res = await api.answerPractice(session.practiceId, { questionId: q.questionId, optionId });
      setFeedback(res);
      if (res.isCorrect) setScore((s) => s + 1);
    } catch (e) { setError(e.message); }
  };

  if (!session) {
    return (
      <div className="narrow">
        <h1>Practice</h1>
        <p className="muted">Solo rounds of five questions. Answers are checked by the server and explained straight away.</p>
        <div className="panel form">
          <label>Topic
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">Mixed topics</option>
              {topics.map((t) => <option key={t.topic} value={t.topic}>{t.topic} ({t.count})</option>)}
            </select>
          </label>
          <label>Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option>Easy</option><option>Medium</option><option>Hard</option>
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" onClick={() => start()}>Start practice</button>
        </div>
      </div>
    );
  }

  const done = i >= session.questions.length;
  if (done) {
    return (
      <div className="narrow panel center">
        <h2>Round complete</h2>
        <p className="big">{score} / {session.questions.length}</p>
        <p className="muted">{score === session.questions.length ? 'Perfect round. Try a harder difficulty.' : 'Run it again to lock in the weak spots.'}</p>
        <div className="row center-row">
          <button className="btn btn-primary" onClick={() => start()}>Another round</button>
          <button className="btn" onClick={() => setSession(null)}>Change topic</button>
        </div>
      </div>
    );
  }

  const q = session.questions[i];
  const question = { ...q, index: i, total: session.questions.length };
  return (
    <div className="narrow">
      <QuestionCard
        question={question}
        onPick={pick}
        disabled={!!chosen}
        chosenId={chosen}
        reveal={feedback ? { correctOptionId: feedback.correctOptionId } : null}
      />
      {error && <p className="error">{error}</p>}
      {feedback && (
        <div className={`result ${feedback.isCorrect ? 'good' : 'bad'}`}>
          <h3>{feedback.isCorrect ? 'Correct' : 'Not quite'}</h3>
          {feedback.explanation && <p>{feedback.explanation}</p>}
          <button className="btn btn-primary" onClick={() => { setI(i + 1); setChosen(null); setFeedback(null); }}>
            {i + 1 === session.questions.length ? 'See score' : 'Next question'}
          </button>
        </div>
      )}
    </div>
  );
}
