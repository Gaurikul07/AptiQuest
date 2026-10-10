import { io } from 'socket.io-client';

// With the Vite proxy (dev) or single-origin hosting, no URL is needed.
export const socket = io(import.meta.env.VITE_SERVER_URL || undefined, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
});

// The session token (not the display name) proves identity when reconnecting.
const KEY = 'aptiquest.session';
export const loadSession = () => {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
};
export const saveSession = (s) => localStorage.setItem(KEY, JSON.stringify(s));
export const clearSession = () => localStorage.removeItem(KEY);

export function emitAck(event, payload, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The server did not respond. Check your connection.')), timeout);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}
