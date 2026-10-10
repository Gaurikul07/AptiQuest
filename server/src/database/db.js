import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.DB_FILE || path.join(dir, '../../data/aptiquest.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

export const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));

export function upsertCollege(name) {
  const clean = String(name || '').trim().slice(0, 60);
  if (!clean) return null;
  db.prepare('INSERT OR IGNORE INTO college (name) VALUES (?)').run(clean);
  return db.prepare('SELECT id FROM college WHERE name = ?').get(clean).id;
}
