import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';
import { getProfile, levelOf, levelProgress } from '../services/profile.js';

export default function Home() {
  const { session } = useGame();
  const profile = getProfile();
  const lp = levelProgress(profile.xp);
  return (
    <div className="home">
      <section className="hero">
        <h1>Battle your campus. Beat the clock.</h1>
        <p>Live aptitude quizzes where speed and accuracy both count. Join with a code, climb the leaderboard, then see exactly which topics to practise next.</p>
        <div className="row">
          <Link className="btn btn-primary" to="/join">Join a battle</Link>
          <Link className="btn" to="/create">Host a quiz</Link>
          <Link className="btn btn-ghost" to="/practice">Practise solo</Link>
        </div>
        {session && (
          <p className="notice">
            You are in room <b>{session.roomCode}</b> as {session.role === 'host' ? 'host' : session.name}.{' '}
            <Link to={`/room/${session.roomCode}`}>Return to the room</Link>
          </p>
        )}
      </section>

      <section className="cards">
        <Link to="/create" className="card"><h3>Quiz creator</h3><p>Write questions with topics, difficulty, images and tables. Save sets and reuse them.</p></Link>
        <Link to="/join" className="card"><h3>Join battle</h3><p>Enter a short room code on your phone or laptop and wait in the lobby.</p></Link>
        <Link to="/practice" className="card"><h3>Adaptive practice</h3><p>Pick a topic and drill it with instant explanations.</p></Link>
        <Link to="/league" className="card"><h3>Campus league</h3><p>Colleges earn season points from every completed match.</p></Link>
      </section>

      <section className="panel profile">
        <h3>Your progress on this device</h3>
        <div className="stats">
          <div><b>Level {levelOf(profile.xp)}</b><span>{lp.into} / {lp.size} XP</span></div>
          <div><b>{profile.streak}</b><span>day streak</span></div>
          <div><b>{profile.bestScore}</b><span>best score</span></div>
          <div><b>{profile.matches}</b><span>matches played</span></div>
        </div>
        <div className="skill-bar"><div className="fill-strong" style={{ width: `${(lp.into / lp.size) * 100}%` }} /></div>
      </section>
    </div>
  );
}
