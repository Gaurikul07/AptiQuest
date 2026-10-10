# AptiQuest: Campus Battle Arena

A real-time multiplayer aptitude quiz platform. Hosts build quiz sets, players join with a short room code, the server runs every timer and score, and the results turn into a topic skill map, an Adaptive Battle practice round and a college league.

**Stack:** React + Vite, Node.js + Express, Socket.IO, SQLite (`better-sqlite3`).

## Quick start

Requires Node.js 18 or newer (20+ recommended).

```bash
npm run setup          # installs root, server, client and test dependencies
npm run dev            # server on :4000, client on :5173
```

Open http://localhost:5173. The first server start seeds two demo quizzes ("Placement Warm-up (demo)" with 10 questions, and a practice question bank).

To try it on phones, keep them on the same Wi-Fi and open `http://<your-computer-ip>:5173` (Vite is started with `host: true`).

### Demo flow (about 2 minutes)

1. **Quizzes**: enter a host name, press **Host** on the demo quiz. You land in the lobby with a 5-character code.
2. On a phone or a second browser tab open **Join**, enter the code and a name (and a college).
3. Host presses **Start battle**. Everyone gets the same question with a synchronised countdown and options in a different order per player.
4. After each round the answer is revealed, the leaderboard animates, and the next question starts automatically.
5. The results screen shows the podium, accuracy, average response time, skill map, Adaptive Battle button, and the league points the match added.
6. Refresh a player's tab mid-question: the session is restored and a question already answered stays answered.

### Single-origin / production-style run

```bash
npm run build          # builds client/dist
npm start              # the server also serves the built client on :4000
```

Copy `.env.example` to `server/.env` for `PORT`, `CLIENT_ORIGIN`, `RESULT_PAUSE_MS` and `DB_FILE`. If the client is hosted separately, set `VITE_SERVER_URL` for the client build and set `CLIENT_ORIGIN` on the server to the client's origin. Use HTTPS/WSS for any public deployment and a host that supports long-lived WebSocket connections and persistent disk (SQLite file) for the server.

## How scoring works

```
incorrect or unanswered : 0
correct                 : round(100 + 50 * (1 - t / T))
```

`t` is the **server-measured** time between the question being sent and the answer arriving; `T` is the question's time limit. A correct answer is worth 100 to 150 points. Ties on the leaderboard are broken by faster average response time, then name.

## Timing and network-delay policy

* The server owns the clock. When a round starts it records `roundStartedAt` and `deadline = roundStartedAt + timeLimit`, and sends the deadline with the question.
* The browser countdown is display only. It is corrected using the server's `serverNow` timestamp in the question payload, so a wrong device clock only shifts the visual countdown.
* An answer is accepted only if the **server's receipt time** is at or before the deadline. Any timestamp from a client is ignored.
* The server also closes the round itself with a timer at the deadline, even if players never answered. Closing is idempotent (guarded by round index and state), so it cannot run twice.
* Players on slow networks are not compensated: their answer counts as received when it reaches the server. Their speed bonus is computed from that receipt time, and an answer that arrives after the deadline is rejected. This is deliberate. Any compensation would need client-reported timing, which cannot be trusted. The trade-off is that a player with high latency loses a little speed bonus or can miss the deadline narrowly.
* If a player disconnects, the round still closes on time. When they reconnect inside the same round they get the same question with the remaining time. If they already answered, they are restored as answered and cannot answer again.

## Fairness and security rules implemented

| Requirement | Where |
|---|---|
| Correct answer hidden until the round closes | question payloads never contain the key; `round:result` reveals it (`game/questionEngine.js`) |
| Per-player option shuffling | each player gets a random order and random opaque option ids; the id-to-option mapping stays on the server |
| Duplicate answers rejected | `submitAnswer` checks `player.answers` |
| Late answers rejected | server receipt time vs deadline, plus round-state check |
| Only the host can start | `room:start` checks the socket's authenticated host role |
| Reconnection | secret session token stored in the browser, `session:resume` restores state |
| Abuse limits | per-socket message cap on `answer:submit`, input validation on every REST body |

## Definitions used in analytics

* **Accuracy** = correct answers / all questions in the match (unanswered counts as wrong).
* **Average response time** = mean of accepted answers only (unanswered excluded).
* **Topic strength**: a topic needs at least 2 questions in the match to be labelled. Strong = 70% or more, weak = under 50%, otherwise developing; fewer than 2 questions shows "not enough data".
* **Adaptive Battle**: rule based. It picks the weakest labelled topic and recommends Easy (under 40%), Medium (under 70%) or Hard, then draws practice questions for that topic from every saved quiz. If nothing is weak it suggests a Hard round on the strongest topic. No AI service is required.
* **XP** = 20 + score / 10 + placement bonus (50 / 30 / 20 for the top three). Level = 1 per 300 XP. XP, streak and best score are stored in the browser (no accounts yet).

## College league rules

Each player in a match earns 10 participation points plus 50, 30 or 20 for first, second and third place. A college receives the sum of its **best five** players' points in that match, so large teams cannot win on numbers alone. Points are stored per match in `college_points`, and the league table is an aggregation of those rows (it is not computed from an in-memory leaderboard). A player's college defaults to the room's college if they leave the field blank. The league starts empty; it fills as real matches finish. Nothing is pre-populated with fake results.

## REST API

| Method and path | Purpose |
|---|---|
| `POST /api/quizzes` | create a quiz |
| `GET /api/quizzes` | list saved quizzes |
| `GET /api/quizzes/:id` | quiz for the editor (includes answer keys) |
| `PUT /api/quizzes/:id` | edit and reorder (question ids are preserved) |
| `DELETE /api/quizzes/:id` | delete a quiz (past results are kept) |
| `POST /api/matches` | create a room from a quiz; returns `roomCode` and `hostToken` |
| `GET /api/rooms/:code` | public room check for the Join screen |
| `GET /api/matches/:id/results` | persisted results for a finished match |
| `GET /api/leaderboard/colleges`, `/players` | league tables |
| `GET /api/topics`, `POST /api/practice/start`, `POST /api/practice/:id/answer` | practice and Adaptive Battle |

## Socket.IO events

| Event | Direction | Payload |
|---|---|---|
| `room:join` | client to server | `{ roomCode, name, college }`; ack `{ ok, token, player, room }` |
| `session:resume` | client to server | `{ roomCode, token }`; ack `{ ok }` |
| `session:restored` | server to client | question, answered flag, score, round result or final results |
| `room:state` | server to client | lobby participants, status, host connection |
| `room:start` | client to server | host only; ack `{ ok, error? }` |
| `quiz:question` | server to client | question, shuffled options, `deadline`, `serverNow` |
| `answer:submit` | client to server | `{ questionId, optionId }`; ack `{ ok, reason? }` |
| `answer:status` | server to client | same as the ack; `reason` is `late`, `duplicate`, `round-closed`, `invalid-option`, `wrong-question` or `rate-limited` |
| `room:progress` | server to host | how many players have answered |
| `round:result` | server to client | correct option, your result, points, rank, explanation |
| `leaderboard:update` | server to room | top 10 |
| `quiz:finished` | server to client | podium, standings, your analytics, skill map, league points |

## Load test (50 simulated clients)

```bash
# terminal 1 (a shorter pause between rounds makes the run quicker)
RESULT_PAUSE_MS=1500 npm start --prefix server
# terminal 2
npm run loadtest                       # defaults: 50 clients, 3 questions, 8 s each
node tests/loadTest.js --clients 50 --questions 5 --seconds 10
```

The script creates a quiz, a room and 50 socket clients, then checks the following: all joins succeed, every valid answer is accepted once, deliberately late answers (every tenth client) and duplicate answers (clients 1, 11, 21...) are rejected, one client disconnects mid-question and resumes with its question restored, the answer key never appears in a question payload, every client receives final results, and the results are persisted. It writes a JSON report to `tests/results/` with connection counts, accepted and rejected answers, errors, and join and answer-ack latency (average, p95, max).

**Record your own measured results here before presenting:**

| Run | Clients connected | Answers accepted | Late rejected | Duplicates rejected | Unexpected errors | Ack latency avg / p95 | Verdict |
|---|---|---|---|---|---|---|---|
| _(fill in from `tests/results/*.json`)_ | | | | | | | |

A single 50-client run on one machine shows that scenario works. It does not guarantee behaviour for every real-world network or a hosted deployment.

## Known limitations (MVP)

* Active rooms are in server memory. A server restart ends running matches (completed results are safe in SQLite). Scaling to several server instances needs shared room state (for example Redis plus the Socket.IO adapter) and durable sessions.
* No login. Host endpoints (including `GET /api/quizzes/:id`, which returns answer keys) are open. Add host authentication before a public deployment. Players are identified in the league by display name and college.
* Images are referenced by URL (no uploads). Tables use a comma-separated editor.
* Practice and Adaptive Battle are solo and untimed.
* Team battles, AI question generation and daily challenges are future phases (see `docs/architecture.md`).

## Project layout

```
client/   React app (pages, components, context, socket and API services)
server/   Express + Socket.IO (routes, socket handlers, services, game engine, SQLite)
tests/    loadTest.js (50-client simulation)
docs/     architecture.md, demo-checklist.md
```
