export default function SkillMap({ topics, title = 'Skill map' }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {topics.map((t) => (
        <div key={t.topic} className="skill">
          <div className="skill-head">
            <span>{t.topic}</span>
            <span className={`tag tag-${t.label.replace(/\s/g, '-')}`}>{t.label}</span>
          </div>
          <div className="skill-bar"><div style={{ width: `${t.accuracy}%` }} className={`fill-${t.label.replace(/\s/g, '-')}`} /></div>
          <small className="muted">{t.correct} of {t.total} correct ({t.accuracy}%)</small>
        </div>
      ))}
    </section>
  );
}
