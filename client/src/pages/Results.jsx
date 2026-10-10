import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';
import Podium from '../components/Podium.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import SkillMap from '../components/SkillMap.jsx';
import { recordMatch, getProfile, levelOf } from '../services/profile.js';

export default function Results() {
  const { final, session, leave } = useGame();
  const nav = useNavigate();
  const you = final.you;
  const isHost = session.role === 'host';

  useEffect(() => {
    if (you) recordMatch(final.matchId ?? `${session.roomCode}-${session.name}`, you.score, you.xpEarned);
  }, [final, you, session]);

  const profile = getProfile();
  const rec = you?.recommendation;
  const secs = you?.avgResponseMs != null ? (you.avgResponseMs / 1000).toFixed(1) : '-';

  return (
    <div className="results">
      <h1>{final.quizTitle}: final results</h1>
      <Podium podium={final.podium} />

      {you && (
        <section className="panel">
          <h3>Your performance</h3>
          <div className="stats">
            <div><b>#{you.rank}</b><span>of {final.totalPlayers}</span></div>
            <div><b>{you.score}</b><span>points</span></div>
            <div><b>{you.accuracy}%</b><span>accuracy ({you.correct}/{you.total})</span></div>
            <div><b>{secs}s</b><span>avg response</span></div>
            <div><b>+{you.xpEarned}</b><span>XP (level {levelOf(profile.xp)})</span></div>
          </div>
        </section>
      )}

      {you && <SkillMap topics={you.topics} title="Your skill map" />}
      {isHost && <SkillMap topics={final.topicSummary} title="Class skill map (all players)" />}

      {rec && (
        <section className="panel adaptive">
          <h3>Adaptive Battle</h3>
          <p>{rec.message}</p>
          {rec.topic && (
            <Link className="btn btn-primary" to={`/practice?topic=${encodeURIComponent(rec.topic)}&difficulty=${rec.difficulty}&auto=1`}>
              Practise {rec.topic} ({rec.difficulty})
            </Link>
          )}
        </section>
      )}

      {final.leagueAwarded.length > 0 && (
        <section className="panel">
          <h3>College league points from this match</h3>
          <ul className="plain">{final.leagueAwarded.map((l) => <li key={l.college}><b>{l.college}</b> +{l.points}</li>)}</ul>
          <Link to="/league">See the league table</Link>
        </section>
      )}

      <Leaderboard entries={final.leaderboard} meId={you ? final.leaderboard.find((l) => l.name === session.name)?.id : null} limit={50} title="Final standings" />
      <div className="row">
        <button className="btn" onClick={() => { leave(); nav('/'); }}>Back to home</button>
        <Link className="btn btn-ghost" to="/league">College league</Link>
      </div>
    </div>
  );
}
