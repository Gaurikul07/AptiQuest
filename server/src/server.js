import express from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

import quizRoutes from './routes/quizzes.js';
import matchRoutes from './routes/matches.js';
import collegeRoutes from './routes/colleges.js';
import practiceRoutes from './routes/practice.js';
import { registerRoomHandlers } from './socket/roomHandlers.js';
import { registerQuizHandlers } from './socket/quizHandlers.js';
import { seedIfEmpty } from './database/seed.js';

const PORT = Number(process.env.PORT || 4000);
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());

const app = express();
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: Date.now() }));
app.use('/api', quizRoutes);
app.use('/api', matchRoutes);
app.use('/api', collegeRoutes);
app.use('/api', practiceRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Optional single-origin deployment: serve the built React app.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: origins }, pingInterval: 10000, pingTimeout: 10000 });
io.on('connection', (socket) => {
  socket.data = {};
  registerRoomHandlers(io, socket);
  registerQuizHandlers(io, socket);
});

if (seedIfEmpty()) console.log('Seeded demo quizzes.');
server.listen(PORT, () => console.log(`AptiQuest server listening on http://localhost:${PORT}`));
