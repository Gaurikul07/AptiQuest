import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';
import { api } from '../services/api.js';

export default function JoinRoom() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { joinRoom, session, conn } = useGame();
  const [code, setCode] = useState((params.get('code') || '').toUpperCase());
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [colleges, setColleges] = useState([]);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.colleges().then(setColleges).catch(() => {}); }, []);
  useEffect(() => {
    setInfo(null);
    if (code.length !== 5) return;
    api.getRoom(code).then(setInfo).catch(() => setInfo({ exists: false }));
  }, [code]);
  useEffect(() => { if (info?.college && !college) setCollege(info.college); }, [info]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const joined = await joinRoom({ roomCode: code, name, college });
      nav(`/room/${joined}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="narrow">
      <h1>Join a battle</h1>
      {session && <p className="notice">You are already in room {session.roomCode}. Joining a new room will need you to leave it first (use the room page).</p>}
      <form className="panel form" onSubmit={submit}>
        <label>Room code
          <input className="code-input" value={code} maxLength={5} autoCapitalize="characters" autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABCDE" required />
        </label>
        {info?.exists === false && <p className="error">No room with that code.</p>}
        {info?.exists && <p className={info.joinable ? 'ok' : 'error'}>{info.joinable ? `${info.quizTitle} - ${info.players} in the lobby` : 'That match has already started.'}</p>}
        <label>Display name
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
        </label>
        <label>College (optional)
          <input value={college} maxLength={60} list="colleges" onChange={(e) => setCollege(e.target.value)} placeholder="Counts towards your college's league score" />
          <datalist id="colleges">{colleges.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy || conn !== 'online' || code.length !== 5 || !name.trim() || !!session}>
          {busy ? 'Joining...' : 'Join lobby'}
        </button>
        {conn !== 'online' && <small className="muted">Waiting for the server connection...</small>}
      </form>
    </div>
  );
}
