# Demo checklist

## Before presenting
- [ ] `npm run setup` done on the demo machine; `npm run dev` starts both servers
- [ ] Demo quizzes appear under Quizzes
- [ ] Phone and laptop on the same network; phone opens `http://<ip>:5173`
- [ ] 50-client test run saved in `tests/results/` and the numbers copied into the README table
- [ ] Screenshots or a screen recording saved as a backup

## Functional checks
- [ ] Host creates a quiz with several questions, an image or table, and edits and reorders them
- [ ] Player joins with the code; the lobby shows them live
- [ ] All players see the same question; option order differs per player
- [ ] Correct answer stays hidden until the round closes
- [ ] Faster correct answers score more (100 to 150)
- [ ] Late and duplicate answers are rejected
- [ ] Refreshing a player's tab mid-question restores the session and keeps "answered" state
- [ ] Results show podium, accuracy, average time, skill map
- [ ] Adaptive Battle opens a practice round for the weakest topic
- [ ] College league shows points after a match with college names
- [ ] Mobile layout is usable

## Talking points
1. Required features: all of the official AptiQuiz modules are implemented in the core.
2. Server authority: timing, scoring, validation and answer reveal are server-side.
3. Innovation: skill map and Adaptive Battle from simple rules (no AI dependency).
4. Honest limits: in-memory rooms, no login yet (see README).
