-- Eagles game-day program data. SQLite, committed to git (db/eagles.db).
-- Applied idempotently by scripts/db-import.ts. Rollback journal only (no WAL files).
PRAGMA journal_mode = DELETE;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,            -- current_season, school (home school slug), next_game_id, roster_as_of
  value TEXT
);

CREATE TABLE IF NOT EXISTS seasons (
  year INTEGER PRIMARY KEY
);

-- Every school: the home school (meta.school) and each opponent. Game-only opponents have NULL optional fields.
CREATE TABLE IF NOT EXISTS schools (
  id              INTEGER PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  mascot          TEXT,
  city            TEXT,
  state           TEXT,
  maxpreps_url    TEXT,
  color_primary   TEXT,
  color_secondary TEXT,
  color_accent    TEXT
);

-- Per school and season: records, district, classification, season-stat header.
CREATE TABLE IF NOT EXISTS team_seasons (
  school_id      INTEGER NOT NULL REFERENCES schools(id),
  season         INTEGER NOT NULL REFERENCES seasons(year),
  classification TEXT,
  district       TEXT,
  overall_w      INTEGER NOT NULL,
  overall_l      INTEGER NOT NULL,
  overall_t      INTEGER NOT NULL,
  district_w     INTEGER,
  district_l     INTEGER,
  district_t     INTEGER,
  stats_as_of    TEXT,               -- season-stats asOf
  games_played   INTEGER,            -- season-stats gamesPlayed
  PRIMARY KEY (school_id, season)
);

CREATE TABLE IF NOT EXISTS coaches (
  school_id INTEGER NOT NULL REFERENCES schools(id),
  season    INTEGER NOT NULL REFERENCES seasons(year),
  seq       INTEGER NOT NULL,
  name      TEXT NOT NULL,
  role      TEXT NOT NULL,
  PRIMARY KEY (school_id, season, seq)
);

-- Roster entries for any school and season. career_id/athlete_id/slug/maxpreps_url are NULL for opponents.
CREATE TABLE IF NOT EXISTS players (
  id           INTEGER PRIMARY KEY,
  school_id    INTEGER NOT NULL REFERENCES schools(id),
  season       INTEGER NOT NULL REFERENCES seasons(year),
  seq          INTEGER NOT NULL,
  career_id    TEXT,
  athlete_id   TEXT,
  number       TEXT NOT NULL,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  slug         TEXT,
  positions    TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  grade        INTEGER,
  height       TEXT,
  weight       REAL,
  maxpreps_url TEXT,
  UNIQUE (school_id, season, number, first_name, last_name)
);
CREATE UNIQUE INDEX IF NOT EXISTS players_slug ON players(school_id, season, slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS players_career ON players(school_id, season, career_id) WHERE career_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS games (
  id                     TEXT PRIMARY KEY,   -- YYYY-MM-DD-<opponent-slug> or YYYY-tbd-<opponent-slug>
  school_id              INTEGER NOT NULL REFERENCES schools(id),
  season                 INTEGER NOT NULL REFERENCES seasons(year),
  opponent_school_id     INTEGER NOT NULL REFERENCES schools(id),
  opponent_maxpreps_url  TEXT,               -- game.opponent.maxprepsTeamUrl
  status                 TEXT NOT NULL CHECK (status IN ('final','scheduled')),
  date                   TEXT,
  playoff                INTEGER NOT NULL CHECK (playoff IN (0,1)),
  round                  TEXT,
  location               TEXT CHECK (location IN ('home','away','neutral')),
  district_game          INTEGER NOT NULL CHECK (district_game IN (0,1)),
  contest_id             TEXT,
  maxpreps_url           TEXT,
  score_wh               INTEGER,
  score_opp              INTEGER,
  result                 TEXT CHECK (result IN ('W','L','T')),
  quarters               TEXT,               -- JSON {"wh":[..],"opp":[..]} or NULL
  record_after_w         INTEGER,
  record_after_l         INTEGER,
  record_after_t         INTEGER,
  scoring_status         TEXT NOT NULL CHECK (scoring_status IN ('complete','partial','none')),
  replay_url             TEXT,
  recap_url              TEXT
);
CREATE INDEX IF NOT EXISTS games_season ON games(school_id, season);

-- Optional venue per game (one row max). Replaced on each game upsert.
CREATE TABLE IF NOT EXISTS game_venues (
  game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  address TEXT NOT NULL
);

-- Special-game labels ('seniorNight', 'homecoming'). Replaced wholesale on each game upsert.
CREATE TABLE IF NOT EXISTS game_labels (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  label   TEXT NOT NULL CHECK (label IN ('seniorNight','homecoming')),
  PRIMARY KEY (game_id, label)
);

CREATE TABLE IF NOT EXISTS scoring_plays (
  game_id          TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  seq              INTEGER NOT NULL,
  quarter          INTEGER NOT NULL,
  time             TEXT,
  team             TEXT NOT NULL CHECK (team IN ('WH','OPP')),
  type             TEXT NOT NULL,
  player_number    TEXT,
  player_name      TEXT,
  passer_number    TEXT,
  passer_name      TEXT,
  yards            REAL,
  score_after_wh   INTEGER,
  score_after_opp  INTEGER,
  PRIMARY KEY (game_id, seq)
);

CREATE TABLE IF NOT EXISTS takeaways (
  game_id       TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,
  quarter       INTEGER NOT NULL,
  team          TEXT NOT NULL CHECK (team IN ('WH','OPP')),
  type          TEXT NOT NULL CHECK (type IN ('interception','fumbleRecovery')),
  player_number TEXT,
  player_name   TEXT,
  PRIMARY KEY (game_id, seq)
);

-- Highlight links for either a player or a game.
CREATE TABLE IF NOT EXISTS highlights (
  id        INTEGER PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  game_id   TEXT REFERENCES games(id) ON DELETE CASCADE,
  seq       INTEGER NOT NULL,
  label     TEXT NOT NULL,
  url       TEXT NOT NULL,
  CHECK ((player_id IS NULL) != (game_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS highlights_player ON highlights(player_id, seq) WHERE player_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS highlights_game ON highlights(game_id, seq) WHERE game_id IS NOT NULL;

-- Generic stat table model. A category belongs to a school-season (season stats) or to a game (box score).
CREATE TABLE IF NOT EXISTS stat_categories (
  id        INTEGER PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id),
  season    INTEGER REFERENCES seasons(year),
  game_id   TEXT REFERENCES games(id) ON DELETE CASCADE,
  seq       INTEGER NOT NULL,
  key       TEXT NOT NULL,
  label     TEXT NOT NULL,
  CHECK ((game_id IS NULL AND school_id IS NOT NULL AND season IS NOT NULL)
      OR (game_id IS NOT NULL AND school_id IS NULL AND season IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS stat_categories_season ON stat_categories(school_id, season, key) WHERE game_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stat_categories_game ON stat_categories(game_id, key) WHERE game_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stat_columns (
  category_id INTEGER NOT NULL REFERENCES stat_categories(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  PRIMARY KEY (category_id, seq),
  UNIQUE (category_id, key)
);

CREATE TABLE IF NOT EXISTS stat_rows (
  category_id INTEGER NOT NULL REFERENCES stat_categories(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  number      TEXT NOT NULL,
  name_abbrev TEXT NOT NULL,
  PRIMARY KEY (category_id, seq)
);

-- One value per (row, column). A missing row means the key was absent; value NULL means present-but-null.
CREATE TABLE IF NOT EXISTS stat_values (
  category_id INTEGER NOT NULL,
  row_seq     INTEGER NOT NULL,
  seq         INTEGER NOT NULL,      -- key order within the row
  column_key  TEXT NOT NULL,         -- usually a stat_columns.key, but rows may carry keys with no column
  value       REAL,
  PRIMARY KEY (category_id, row_seq, column_key),
  FOREIGN KEY (category_id, row_seq) REFERENCES stat_rows(category_id, seq) ON DELETE CASCADE
);

-- Opponent schedule results (from an opponent's page).
CREATE TABLE IF NOT EXISTS opponent_results (
  school_id  INTEGER NOT NULL REFERENCES schools(id),
  season     INTEGER NOT NULL REFERENCES seasons(year),
  seq        INTEGER NOT NULL,
  date       TEXT,
  opponent   TEXT NOT NULL,
  location   TEXT CHECK (location IN ('home','away','neutral')),
  score_us   INTEGER,
  score_them INTEGER,
  result     TEXT CHECK (result IN ('W','L','T')),
  PRIMARY KEY (school_id, season, seq)
);
