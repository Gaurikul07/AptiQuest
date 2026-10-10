import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function CollegeLeague() {
  const [tab, setTab] = useState('colleges');
  const [colleges, setColleges] = useState(null);
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.collegeBoard().then(setColleges).catch((e) => setError(e.message));
    api.playerBoard().then(setPlayers).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="narrow wide">
      <h1>Campus league</h1>
      <p className="muted">
        Every completed match adds points. Each player earns 10 for taking part plus 50, 30 or 20 for finishing first, second or third.
        A college scores its best five players per match, so bigger teams cannot win on numbers alone.
      </p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'colleges'} className={tab === 'colleges' ? 'on' : ''} onClick={() => setTab('colleges')}>Colleges</button>
        <button role="tab" aria-selected={tab === 'players'} className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>Players</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        {tab === 'colleges' ? (
          colleges && colleges.length === 0 ? <p className="panel muted">No league results yet. Finish a match with players from a college to see it here.</p> : (
            <table className="league">
              <thead><tr><th>#</th><th>College</th><th>Points</th><th>Matches</th><th>Players</th></tr></thead>
              <tbody>{(colleges || []).map((c, i) => <tr key={c.name}><td>{i + 1}</td><td>{c.name}</td><td><b>{c.points}</b></td><td>{c.matches}</td><td>{c.players}</td></tr>)}</tbody>
            </table>
          )
        ) : (
          players && players.length === 0 ? <p className="panel muted">No players yet.</p> : (
            <table className="league">
              <thead><tr><th>#</th><th>Player</th><th>College</th><th>League pts</th><th>Best score</th><th>Matches</th></tr></thead>
              <tbody>{(players || []).map((p, i) => <tr key={`${p.name}-${p.college}`}><td>{i + 1}</td><td>{p.name}</td><td>{p.college || '-'}</td><td><b>{p.leaguePoints}</b></td><td>{p.bestScore}</td><td>{p.matches}</td></tr>)}</tbody>
            </table>
          )
        )}
      </div>
      <small className="muted">Players are grouped by display name and college because the MVP has no accounts.</small>
    </div>
  );
}
