import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import QuizCreator from './pages/QuizCreator.jsx';
import JoinRoom from './pages/JoinRoom.jsx';
import Room from './pages/Room.jsx';
import Practice from './pages/Practice.jsx';
import CollegeLeague from './pages/CollegeLeague.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<QuizCreator />} />
          <Route path="/join" element={<JoinRoom />} />
          <Route path="/room/:code" element={<Room />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/league" element={<CollegeLeague />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
