import { pathToFileURL } from 'node:url';
import { db } from './db.js';
import { validateQuiz, createQuiz } from '../services/quizService.js';

const Q = (topic, difficulty, questionText, options, correctOption, explanation, timeLimit = 20) => ({
  topic, difficulty, questionText, options, correctOption, explanation, timeLimit,
});

const warmup = [
  Q('Percentages', 'Easy', 'What is 20% of 150?', ['20', '25', '30', '40'], 2, '20% = 1/5, and 150 / 5 = 30.'),
  Q('Percentages', 'Medium', 'A price rises from 80 to 100. What is the percentage increase?', ['20%', '25%', '30%', '15%'], 1, 'Increase = 20, and 20 / 80 = 25%.'),
  Q('Logical Reasoning', 'Easy', 'All roses are flowers. Some flowers fade quickly. Which conclusion definitely follows?', ['Some roses fade quickly', 'All flowers are roses', 'Roses are flowers', 'No flower is a rose'], 2, 'The first statement says every rose is a flower.'),
  Q('Logical Reasoning', 'Medium', 'Pointing to a man, Riya says, "He is the son of my mother\'s only brother." How is the man related to Riya?', ['Cousin', 'Uncle', 'Brother', 'Nephew'], 0, 'Her mother\'s brother is her maternal uncle; his son is her cousin.', 30),
  Q('Logical Reasoning', 'Medium', 'Facing north, Arun turns right, then right again, then left. Which direction is he facing now?', ['North', 'East', 'South', 'West'], 1, 'North -> East -> South -> East.'),
  Q('Number Series', 'Easy', 'Find the next number: 2, 6, 12, 20, 30, ?', ['40', '42', '44', '36'], 1, 'Differences are 4, 6, 8, 10, so the next difference is 12: 30 + 12 = 42.'),
  Q('Number Series', 'Easy', 'Find the next number: 3, 6, 12, 24, ?', ['36', '42', '48', '54'], 2, 'Each term doubles.'),
  Q('Time & Work', 'Medium', 'A can finish a job in 10 days and B in 15 days. Working together, how many days do they need?', ['5', '6', '7.5', '8'], 1, 'Combined rate = 1/10 + 1/15 = 1/6 per day.', 30),
  Q('Time & Work', 'Medium', '12 workers finish a job in 15 days. How many days will 18 workers need?', ['8', '9', '10', '12'], 2, 'Total work = 12 x 15 = 180 worker-days; 180 / 18 = 10.', 30),
  Q('Ratio & Proportion', 'Easy', 'Two numbers are in the ratio 3:5 and their sum is 160. What is the smaller number?', ['60', '64', '96', '100'], 0, '160 / 8 = 20 per part, so the smaller number is 3 x 20 = 60.'),
];

const bank = [
  Q('Percentages', 'Medium', 'If 40% of a number is 60, what is the number?', ['120', '150', '180', '240'], 1, '60 / 0.4 = 150.'),
  Q('Percentages', 'Medium', 'After a 10% discount a shirt costs 450 rupees. What was the original price?', ['480', '495', '500', '520'], 2, '450 / 0.9 = 500.'),
  Q('Logical Reasoning', 'Easy', 'In a code, CAT is written as DBU. How is DOG written in that code?', ['EPH', 'EOH', 'DPH', 'FPI'], 0, 'Every letter moves one step forward: D->E, O->P, G->H.'),
  Q('Number Series', 'Easy', 'Find the next number: 1, 4, 9, 16, 25, ?', ['30', '34', '36', '49'], 2, 'These are square numbers; the next is 6 x 6.'),
  Q('Number Series', 'Hard', 'Find the next number: 5, 11, 23, 47, ?', ['93', '95', '97', '99'], 1, 'Each term is double the previous term plus 1: 47 x 2 + 1 = 95.'),
  Q('Time & Work', 'Medium', 'A completes a task in 12 days. B is twice as efficient as A. How many days will B take alone?', ['4', '6', '8', '24'], 1, 'Twice as fast means half the time.'),
  Q('Speed & Distance', 'Medium', 'A 120 m long train passes a pole in 6 seconds. What is its speed?', ['60 km/h', '72 km/h', '80 km/h', '90 km/h'], 1, '120 m / 6 s = 20 m/s = 72 km/h.'),
  Q('Speed & Distance', 'Hard', 'A car covers 150 km at 50 km/h and returns at 75 km/h. What is the average speed for the whole trip?', ['60 km/h', '62.5 km/h', '65 km/h', '70 km/h'], 0, 'Average = 2 x 50 x 75 / (50 + 75) = 60 km/h.', 30),
];

export function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM quiz').get().n;
  if (count > 0) return false;
  for (const [title, questions] of [['Placement Warm-up (demo)', warmup], ['Practice Question Bank', bank]]) {
    const { error, value } = validateQuiz({ title, hostName: 'AptiQuest', questions });
    if (error) throw new Error(`Seed data invalid: ${error}`);
    createQuiz(value);
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(seedIfEmpty() ? 'Seeded demo quizzes.' : 'Database already has quizzes; nothing to seed.');
}
