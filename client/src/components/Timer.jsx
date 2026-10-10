import { useEffect, useState } from 'react';

// Pure display: counts down to a SERVER deadline. The server, not this timer, decides when a round ends.
export default function Timer({ deadline, offset, total }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - (Date.now() + offset)));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, deadline - (Date.now() + offset)));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [deadline, offset]);
  const pct = Math.min(100, (left / (total * 1000)) * 100);
  const secs = Math.ceil(left / 1000);
  return (
    <div className={`timer ${secs <= 5 ? 'timer-low' : ''}`} role="timer" aria-label={`${secs} seconds left`}>
      <div className="timer-bar"><div style={{ width: `${pct}%` }} /></div>
      <span className="timer-num">{secs}s</span>
    </div>
  );
}
