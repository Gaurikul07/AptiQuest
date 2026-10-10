// Classic podium order: 2nd, 1st, 3rd.
export default function Podium({ podium }) {
  const slot = (rank) => podium.find((p) => p.rank === rank);
  return (
    <div className="podium" aria-label="Top three players">
      {[2, 1, 3].map((rank) => {
        const p = slot(rank);
        return (
          <div key={rank} className={`step step-${rank}`}>
            {p ? (
              <>
                <strong>{p.name}</strong>
                <span className="muted">{p.score} pts</span>
              </>
            ) : <span className="muted">-</span>}
            <div className="block">{rank}</div>
          </div>
        );
      })}
    </div>
  );
}
