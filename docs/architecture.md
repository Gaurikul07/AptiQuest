# AptiQuest architecture

## Layers

```
React pages  ->  GameContext (socket + state)  ->  Socket.IO / REST
                                                      |
                 socket handlers (thin)  ->  game engine (room manager, question engine)
                                                      |
                 services (quiz, scoring, analytics, league, results)  ->  SQLite
```

* **Handlers are thin.** `socket/roomHandlers.js` and `socket/quizHandlers.js` authenticate the socket and delegate.
* **The engine owns match state.** `game/roomManager.js` holds rooms and players in memory; `game/questionEngine.js` runs the state machine `LOBBY -> QUESTION -> ROUND_RESULTS -> ... -> FINISHED`.
* **Services are independent.** Scoring has no knowledge of rooms or the UI. Analytics and league read recorded answers. A future team-battle mode can add its own scoring layer and reuse validation and timing.
* **Quiz data and live state are separate.** Quizzes live in SQLite; a running match copies the quiz into memory and persists results at the end.

## Match state machine

| State | Entered by | Behaviour |
|---|---|---|
| LOBBY | room created | players join; host sees participants |
| QUESTION | host starts, or previous result pause ends | per-player payload sent; server deadline set; timer armed |
| ROUND_RESULTS | deadline reached (idempotent close) | answers revealed, scores and leaderboard broadcast, pause |
| FINISHED | last round closed | analytics computed, results persisted, league points awarded |

## Data model

`college`, `quiz`, `question`, `matches`, `match_player`, `answer`, `college_points`. The planned `Player` table is folded into `match_player` because the MVP has no accounts. `question_id` on `answer` is deliberately not a foreign key, so editing a quiz never erases history. `matches` is used instead of `match` to avoid an SQL keyword.

## Extension roadmap

| Phase | Add | Touches |
|---|---|---|
| 2 | login, profiles, server-side XP and streaks, match history | auth, `player` table |
| 3 | seasons, team battles, daily challenges | league service, a team scoring layer |
| 4 | AI question drafts (host approves), adaptive difficulty | optional AI service, schema validation |
| 5 | faculty analytics, exports, moderation | reporting routes |
| Scale | several server instances | shared room state, Socket.IO adapter, durable sessions |
