import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { socket, loadSession, saveSession, clearSession, emitAck } from '../socket/socket.js';
import { api } from '../services/api.js';

const Ctx = createContext(null);
export const useGame = () => useContext(Ctx);

const EMPTY = {
  room: null, question: null, answered: false, chosenOptionId: null, answerNote: null,
  roundResult: null, leaderboard: [], final: null, progress: null, you: null,
};

export function GameProvider({ children }) {
  const [conn, setConn] = useState('connecting');
  const [session, setSessionState] = useState(loadSession);
  const [state, setState] = useState(EMPTY);
  const [offset, setOffset] = useState(0); // serverTime ~= Date.now() + offset (display only)
  const [resumeError, setResumeError] = useState(null);

  const sessionRef = useRef(session);
  const stateRef = useRef(state);
  stateRef.current = state;

  const patch = useCallback((p) => setState((s) => ({ ...s, ...p })), []);
  const setSession = useCallback((s) => {
    sessionRef.current = s;
    if (s) saveSession(s); else clearSession();
    setSessionState(s);
  }, []);

  const applyRestored = useCallback((d) => {
    setOffset(d.serverNow - Date.now());
    setState({
      ...EMPTY,
      room: d.room, question: d.question, answered: d.answered, chosenOptionId: d.chosenOptionId,
      roundResult: d.roundResult, leaderboard: d.leaderboard, final: d.final, progress: d.progress, you: d.you,
    });
  }, []);

  const resume = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      const res = await emitAck('session:resume', { roomCode: s.roomCode, token: s.token });
      if (res.ok) setResumeError(null);
      else {
        setResumeError(res.error);
        setSession(null);
        setState(EMPTY);
      }
    } catch { /* socket.io will retry on the next connect */ }
  }, [setSession]);

  useEffect(() => {
    const onConnect = () => { setConn('online'); resume(); };
    const onDisconnect = () => setConn('offline');
    const onQuestion = (q) => {
      setOffset(q.serverNow - Date.now());
      setState((s) => ({ ...s, question: q, answered: false, chosenOptionId: null, answerNote: null, roundResult: null }));
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', (room) => patch({ room }));
    socket.on('quiz:question', onQuestion);
    socket.on('round:result', (roundResult) => patch({ roundResult }));
    socket.on('leaderboard:update', (d) => patch({ leaderboard: d.leaderboard }));
    socket.on('room:progress', (progress) => patch({ progress }));
    socket.on('session:restored', applyRestored);
    socket.on('quiz:finished', (final) => patch({ final }));
    socket.connect();
    return () => {
      socket.off();
      socket.disconnect();
    };
  }, [patch, resume, applyRestored]);

  const createRoom = async ({ quizId, hostName, college }) => {
    const r = await api.createMatch({ quizId, hostName, college });
    setState(EMPTY);
    setSession({ roomCode: r.roomCode, token: r.hostToken, role: 'host', name: hostName || 'Host' });
    await resume();
    return r.roomCode;
  };

  const joinRoom = async ({ roomCode, name, college }) => {
    const res = await emitAck('room:join', { roomCode, name, college });
    if (!res.ok) throw new Error(res.error);
    setState({ ...EMPTY, room: res.room });
    setSession({ roomCode: res.roomCode, token: res.token, role: 'player', name: res.player.name });
    return res.roomCode;
  };

  const startMatch = () => emitAck('room:start', {});

  const submitAnswer = async (optionId) => {
    const q = stateRef.current.question;
    if (!q || stateRef.current.answered) return;
    patch({ answered: true, chosenOptionId: optionId });
    try {
      const res = await emitAck('answer:submit', { questionId: q.questionId, optionId });
      if (!res.ok) {
        const notes = {
          late: 'Too late. The server closed this question before your answer arrived.',
          'round-closed': 'Too late. This round has already closed.',
          duplicate: 'Your first answer was already recorded.',
        };
        patch({ answerNote: notes[res.reason] || 'Your answer could not be accepted.' });
      }
    } catch (e) {
      patch({ answerNote: e.message });
    }
  };

  const leave = () => {
    setSession(null);
    setState(EMPTY);
    setResumeError(null);
  };

  return (
    <Ctx.Provider value={{ conn, session, offset, resumeError, ...state, createRoom, joinRoom, startMatch, submitAnswer, leave }}>
      {children}
    </Ctx.Provider>
  );
}
