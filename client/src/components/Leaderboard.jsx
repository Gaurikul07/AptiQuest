const ROW = 54;

// Rows are absolutely positioned by rank so a change in order animates smoothly.
export default function Leaderboard({ entries, meId, limit = 10, title = 'Leaderboard' }) {
  const rows = entries.slice(0, limit);
  return (
    <section className="board">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">Scores appear after the first round.</p>
      ) : (
        <ol style={{ height: rows.length * ROW }}>
          {[...rows].sort((a, b) => a.id.localeCompare(b.id)).map((e) => (
            <li key={e.id} className={e.id === meId ? 'me' : ''} style={{ top: (e.rank - 1) * ROW, height: ROW - 6 }}>
              <span className="rank">{e.rank}</span>
              <span className="who">
                {e.name}
                {e.college && <small>{e.college}</small>}
              </span>
              <span className="pts">{e.score}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
