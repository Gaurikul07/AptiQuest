import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';
import Lobby from './Lobby.jsx';
import QuizRoom from './QuizRoom.jsx';
import Results from './Results.jsx';

export default function Room() {
  const { code } = useParams();
  const nav = useNavigate();
  const { session, room, final, conn, resumeError, leave } = useGame();
  const upper = code.toUpperCase();

  useEffect(() => {
    if (!session || session.roomCode !== upper) nav(`/join?code=${upper}`, { replace: true });
  }, [session, upper, nav]);

  if (!session || session.roomCode !== upper) return null;

  if (resumeError) {
    return (
      <div className="narrow panel">
        <h2>Cannot rejoin this room</h2>
        <p className="error">{resumeError}</p>
        <button className="btn" onClick={() => { leave(); nav('/'); }}>Back to home</button>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="narrow panel center">
        <h2>{conn === 'online' ? 'Restoring your session...' : 'Reconnecting...'}</h2>
        <p className="muted">Your score and progress are kept on the server.</p>
        <button className="btn btn-ghost" onClick={() => { leave(); nav('/'); }}>Leave</button>
      </div>
    );
  }
  const banner = conn !== 'online' && <p className="banner">Connection lost. Reconnecting; your progress is safe.</p>;
  if (room.status === 'LOBBY') return <>{banner}<Lobby /></>;
  if (room.status === 'FINISHED') return <>{banner}{final ? <Results /> : <p className="center muted">Calculating results...</p>}</>;
  return <>{banner}<QuizRoom /></>;
}
