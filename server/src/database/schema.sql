-- AptiQuest schema. Active match state lives in memory; completed results are persisted here.
CREATE TABLE IF NOT EXISTS college (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS quiz (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  host_name  TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS question (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id        INTEGER NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,
  topic          TEXT NOT NULL,
  difficulty     TEXT NOT NULL DEFAULT 'Medium',
  question_text  TEXT NOT NULL,
  image_url      TEXT,
  table_json     TEXT,
  options_json   TEXT NOT NULL,
  correct_option INTEGER NOT NULL,
  time_limit     INTEGER NOT NULL DEFAULT 20,
  explanation    TEXT
);
CREATE INDEX IF NOT EXISTS idx_question_quiz ON question(quiz_id, position);
CREATE INDEX IF NOT EXISTS idx_question_topic ON question(topic);

CREATE TABLE IF NOT EXISTS matches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id         INTEGER REFERENCES quiz(id) ON DELETE SET NULL,
  quiz_title      TEXT,
  room_code       TEXT NOT NULL,
  college_id      INTEGER REFERENCES college(id),
  status          TEXT NOT NULL,
  total_questions INTEGER NOT NULL,
  started_at      TEXT,
  finished_at     TEXT
);

CREATE TABLE IF NOT EXISTS match_player (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id        INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  college_id      INTEGER REFERENCES college(id),
  score           INTEGER NOT NULL DEFAULT 0,
  correct_count   INTEGER NOT NULL DEFAULT 0,
  answered_count  INTEGER NOT NULL DEFAULT 0,
  accuracy        REAL NOT NULL DEFAULT 0,
  avg_response_ms INTEGER,
  rank            INTEGER,
  xp_earned       INTEGER NOT NULL DEFAULT 0,
  league_points   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mp_match ON match_player(match_id);

-- question_id is intentionally NOT a foreign key: editing a quiz must not erase history.
CREATE TABLE IF NOT EXISTS answer (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id        INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  match_player_id INTEGER NOT NULL REFERENCES match_player(id) ON DELETE CASCADE,
  question_id     INTEGER NOT NULL,
  topic           TEXT,
  response_ms     INTEGER NOT NULL,
  is_correct      INTEGER NOT NULL,
  points          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS college_points (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  college_id INTEGER NOT NULL REFERENCES college(id),
  points     INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cp_college ON college_points(college_id);
