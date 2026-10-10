import { Link, NavLink } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';

export default function Navbar() {
  const { conn, session } = useGame();
  return (
    <header className="nav">
      <Link to="/" className="brand">AptiQuest</Link>
      <nav>
        <NavLink to="/create">Quizzes</NavLink>
        <NavLink to="/join">Join</NavLink>
        <NavLink to="/practice">Practice</NavLink>
        <NavLink to="/league">League</NavLink>
        {session && <NavLink to={`/room/${session.roomCode}`} className="nav-live">Live room</NavLink>}
      </nav>
      <span className={`conn conn-${conn}`} title={`Server connection: ${conn}`}>
        <i /> {conn === 'online' ? 'Online' : conn === 'offline' ? 'Reconnecting' : 'Connecting'}
      </span>
    </header>
  );
}
