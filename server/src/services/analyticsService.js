// Derives per-player and per-room analytics from recorded answers.
// Definitions (also documented in the README):
//   accuracy         = correct answers / ALL questions in the match (unanswered counts as wrong)
//   avgResponseMs    = mean server-measured time of ACCEPTED answers only (unanswered excluded)
//   topic accuracy   = correct / questions of that topic in the match
//   topic label      = needs >= MIN_TOPIC_QUESTIONS questions, otherwise "not enough data"
export const MIN_TOPIC_QUESTIONS = 2;
export const STRONG_AT = 70;
export const WEAK_BELOW = 50;

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export function labelTopic(total, accuracy) {
  if (total < MIN_TOPIC_QUESTIONS) return 'not enough data';
  if (accuracy >= STRONG_AT) return 'strong';
  if (accuracy < WEAK_BELOW) return 'weak';
  return 'developing';
}

function difficultyFor(accuracy) {
  if (accuracy < 40) return 'Easy';
  if (accuracy < 70) return 'Medium';
  return 'Hard';
}

export function analyzePlayer(player, questions) {
  const topicMap = new Map();
  let correct = 0;
  let answered = 0;
  let responseSum = 0;

  questions.forEach((q, index) => {
    const a = player.answers.get(index);
    const t = topicMap.get(q.topic) || { topic: q.topic, total: 0, answered: 0, correct: 0 };
    t.total += 1;
    if (a) {
      answered += 1;
      t.answered += 1;
      responseSum += a.responseMs;
      if (a.isCorrect) {
        correct += 1;
        t.correct += 1;
      }
    }
    topicMap.set(q.topic, t);
  });

  const topics = [...topicMap.values()].map((t) => {
    const accuracy = pct(t.correct, t.total);
    return { ...t, accuracy, label: labelTopic(t.total, accuracy) };
  });

  const eligible = topics.filter((t) => t.total >= MIN_TOPIC_QUESTIONS);
  const weakest = [...eligible].sort((a, b) => a.accuracy - b.accuracy)[0] || null;
  const strongest = [...eligible].sort((a, b) => b.accuracy - a.accuracy)[0] || null;

  let recommendation;
  if (weakest && weakest.accuracy < STRONG_AT) {
    recommendation = {
      topic: weakest.topic,
      difficulty: difficultyFor(weakest.accuracy),
      message: `${weakest.topic} is your weakest area (${weakest.correct}/${weakest.total} correct). Try a short ${difficultyFor(weakest.accuracy)} practice round.`,
    };
  } else if (strongest) {
    recommendation = {
      topic: strongest.topic,
      difficulty: 'Hard',
      message: `No weak areas found in this match. Push ${strongest.topic} with a Hard round.`,
    };
  } else {
    recommendation = {
      topic: null,
      difficulty: 'Medium',
      message: 'Not enough questions per topic yet. Play a longer match to unlock your skill map.',
    };
  }

  return {
    total: questions.length,
    answered,
    correct,
    accuracy: pct(correct, questions.length),
    avgResponseMs: answered ? Math.round(responseSum / answered) : null,
    topics,
    recommendation,
  };
}

// Aggregate topic performance across everyone in the room (host / faculty view).
export function summarizeTopics(results) {
  const map = new Map();
  for (const r of results) {
    for (const t of r.topics) {
      const m = map.get(t.topic) || { topic: t.topic, total: 0, correct: 0 };
      m.total += t.total;
      m.correct += t.correct;
      map.set(t.topic, m);
    }
  }
  return [...map.values()]
    .map((m) => {
      const accuracy = pct(m.correct, m.total);
      return { ...m, accuracy, label: labelTopic(m.total, accuracy) };
    })
    .sort((a, b) => a.accuracy - b.accuracy);
}
