import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';

export default function Lobby() {
  const { room, session, startMatch, leave } = useGame();
  const nav = useNavigate();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const isHost = session.role === 'host';
  const joinUrl = `${window.location.origin}/join?code=${room.code}`;

  const start = async () => {
    setError('');
    try {
      const res = await startMatch();
      if (!res.ok) setError(res.error);
    } catch (e) { setError(e.message); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(joinUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="lobby">
      <section className="panel center">
        <p className="muted">{room.quizTitle} - {room.totalQuestions} questions{room.college ? ` - ${room.college}` : ''}</p>
        <div className="roomcode" aria-label={`Room code ${room.code.split('').join(' ')}`}>{room.code}</div>
        <p className="muted">Players join at <b>{window.location.host}/join</b> with this code.</p>
        <div className="row center-row">
          <button className="btn btn-ghost" onClick={copy}>{copied ? 'Link copied' : 'Copy join link'}</button>
          {isHost ? (
            <button className="btn btn-primary" onClick={start} disabled={room.players.length === 0}>Start battle</button>
          ) : (
            <span className="notice">Waiting for {room.host.name} to start...</span>
          )}
        </div>
        {isHost && room.players.length === 0 && <small className="muted">Start unlocks when the first player joins.</small>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel">
        <h3>In the lobby ({room.players.length})</h3>
        {room.players.length === 0 ? <p className="muted">Nobody yet. Share the code.</p> : (
          <ul className="players">
            {room.players.map((p) => (
              <li key={p.id} className={!isHost && p.name === session.name ? 'me' : ''}>
                <i className={p.connected ? 'dot on' : 'dot'} title={p.connected ? 'Connected' : 'Disconnected'} />
                <span>{p.name}{p.name === session.name && !isHost ? ' (you)' : ''}</span>
                {p.college && <small>{p.college}</small>}
              </li>
            ))}
          </ul>
        )}
        <small className="muted">Host: {room.host.name} {room.host.connected ? '' : '(offline)'}</small>
      </section>
      <button className="btn btn-ghost" onClick={() => { leave(); nav('/'); }}>Leave room</button>
    </div>
  );
}
