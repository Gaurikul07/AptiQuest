const BASE = import.meta.env.VITE_SERVER_URL || '';

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Is it running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  listQuizzes: () => request('/api/quizzes'),
  getQuiz: (id) => request(`/api/quizzes/${id}`),
  createQuiz: (body) => request('/api/quizzes', { method: 'POST', body }),
  updateQuiz: (id, body) => request(`/api/quizzes/${id}`, { method: 'PUT', body }),
  deleteQuiz: (id) => request(`/api/quizzes/${id}`, { method: 'DELETE' }),
  createMatch: (body) => request('/api/matches', { method: 'POST', body }),
  getRoom: (code) => request(`/api/rooms/${encodeURIComponent(code)}`),
  getResults: (id) => request(`/api/matches/${id}/results`),
  colleges: () => request('/api/colleges'),
  collegeBoard: () => request('/api/leaderboard/colleges'),
  playerBoard: () => request('/api/leaderboard/players'),
  topics: () => request('/api/topics'),
  startPractice: (body) => request('/api/practice/start', { method: 'POST', body }),
  answerPractice: (id, body) => request(`/api/practice/${id}/answer`, { method: 'POST', body }),
};
