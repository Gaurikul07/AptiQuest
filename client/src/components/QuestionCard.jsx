const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// reveal = { correctOptionId, yourOptionId } once the round has closed.
export default function QuestionCard({ question, onPick, disabled, chosenId, reveal, distribution }) {
  const t = question.table;
  return (
    <section className="qcard">
      <div className="qmeta">
        <span className="chip">{question.topic}</span>
        <span className={`chip diff-${question.difficulty}`}>{question.difficulty}</span>
        <span className="muted">Question {question.index + 1} of {question.total}</span>
      </div>
      <h2 className="qtext">{question.questionText}</h2>
      {question.imageUrl && <img className="qimg" src={question.imageUrl} alt="Question illustration" />}
      {t && (
        <div className="table-wrap">
          <table className="qtable">
            <thead><tr>{t.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      <div className="options">
        {question.options.map((o, i) => {
          let cls = 'option';
          if (reveal) {
            if (o.id === reveal.correctOptionId) cls += ' correct';
            else if (o.id === chosenId) cls += ' wrong';
            else cls += ' dim';
          } else if (o.id === chosenId) cls += ' chosen';
          const count = distribution?.[i]?.count;
          return (
            <button key={o.id} className={cls} disabled={disabled} onClick={() => onPick?.(o.id)}>
              <b>{LETTERS[i]}</b>
              <span>{o.text}</span>
              {count !== undefined && <em>{count}</em>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
