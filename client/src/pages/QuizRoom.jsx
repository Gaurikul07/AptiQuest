import { useGame } from '../context/GameContext.jsx';
import Timer from '../components/Timer.jsx';
import QuestionCard from '../components/QuestionCard.jsx';
import Leaderboard from '../components/Leaderboard.jsx';

export default function QuizRoom() {
  const g = useGame();
  const { question, roundResult, leaderboard, offset, session, progress, answered, chosenOptionId, answerNote, you, room } = g;
  const isHost = session.role === 'host';
  if (!question) return <p className="center muted">Waiting for the next question...</p>;

  const closed = !!roundResult;
  const me = room.players.find((p) => p.name === session.name);
  const meId = you?.id || me?.id;
  const reveal = closed && !isHost ? { correctOptionId: roundResult.correctOptionId, yourOptionId: roundResult.yourOptionId } : null;

  // Host sees the correct option highlighted by text once the round closes.
  const hostQuestion = isHost && closed
    ? { ...question, options: question.options.map((o) => ({ ...o, id: o.text === roundResult.correctText ? 'correct' : o.id })) }
    : question;
  const hostReveal = isHost && closed ? { correctOptionId: 'correct' } : null;

  const myRank = roundResult?.rank;
  return (
    <div className="battle">
      <div className="battle-main">
        <div className="progress"><div style={{ width: `${((question.index + (closed ? 1 : 0)) / question.total) * 100}%` }} /></div>
        {!closed && <Timer deadline={question.deadline} offset={offset} total={question.timeLimit} />}

        <QuestionCard
          question={hostQuestion}
          onPick={isHost ? undefined : g.submitAnswer}
          disabled={isHost || answered || closed}
          chosenId={chosenOptionId}
          reveal={reveal || hostReveal}
          distribution={isHost && closed ? roundResult.distribution : undefined}
        />

        {!isHost && !closed && answered && !answerNote && <p className="notice">Answer locked in. The result is revealed when time is up.</p>}
        {!isHost && answerNote && <p className="error">{answerNote}</p>}
        {isHost && !closed && progress && <p className="notice">{progress.answered} of {progress.total} players have answered.</p>}

        {closed && !isHost && (
          <div className={`result ${roundResult.isCorrect ? 'good' : 'bad'}`}>
            <h3>{!roundResult.answered ? 'No answer submitted' : roundResult.isCorrect ? `Correct! +${roundResult.points}` : 'Not this time'}</h3>
            <p>Total {roundResult.totalScore} pts - rank {myRank}</p>
            {roundResult.explanation && <p className="muted">{roundResult.explanation}</p>}
          </div>
        )}
        {closed && isHost && (
          <div className="result good">
            <h3>Answer: {roundResult.correctText}</h3>
            <p>{roundResult.answered} of {roundResult.totalPlayers} answered.</p>
            {roundResult.explanation && <p className="muted">{roundResult.explanation}</p>}
          </div>
        )}
        {closed && <p className="muted center">{roundResult.isLast ? 'Final results coming up...' : 'Next question starting shortly...'}</p>}
      </div>
      <aside className="battle-side">
        <Leaderboard entries={leaderboard} meId={meId} />
      </aside>
    </div>
  );
}
