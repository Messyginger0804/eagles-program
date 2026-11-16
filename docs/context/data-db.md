# Data: SQLite DB and how pages read it

All site data is one SQLite file committed to git: `db/eagles.db`, schema in `db/schema.sql` (applied idempotently by the importer; rollback journal only, no WAL files, which are gitignored).

## Schema (see `db/schema.sql`)
Tables include `meta` (current_season, school slug of the home team, next_game_id, roster_as_of), `schools`, `team_seasons`, `players`, `coaches`, `games` plus per-game tables (labels, venues, scoring plays, takeaways), stat tables (categories, columns, rows, values), `highlights`, `opponent_results`, and `schedule_events` (scrimmages and byes). Read the file for the exact columns.

## How pages get data
1. `src/lib/db.ts` opens the DB read-only with `node:sqlite` (`DatabaseSync`), rebuilds spec-format objects (team, roster, season stats, games, opponents, schedule events) and validates them with zod schemas in `src/lib/schema.ts`.
2. `src/lib/data.ts` wraps that for Astro pages (same API as the older JSON glob loader). Season comes from `meta.current_season`.
3. Pages are rendered at build time; there is no runtime DB.

DB path defaults to `db/eagles.db` relative to cwd; override with the `EAGLES_DB` env var. `readScheduleEvents` returns `[]` if the table is missing (older DBs).

## JSON spec format
`team.json`, `roster.json`, `season-stats.json`, `schedule-events.json`, `games/*.json`, `opponents/*.json`. Import and export convert between this and the DB (see `ops-scripts.md`). Test fixtures use the same format in `tests/fixtures/data/`.

## Game-by-game stats
Game-scoped stat categories (`stat_categories.game_id`) hold per-game player stats, spec field `games/*.json` `playerStats` (same shape as season stats, no `gp` or per-game-rate columns, `nameAbbrev` copied from the season rows). Shown by `BoxScore.astro` on game pages and as a stat line (`statLine` in `format.ts`) in each player's game log. `null` means MaxPreps has no stats for that game. MaxPreps has no per-player passing or rushing lines, so those are absent.

## Gotchas
- Roster import is a full snapshot: players missing from `roster.json` are removed. Games are upserted by id; games not in the import dir are left alone.
- Requires Node 24 for `node:sqlite`.
- Binary diffs: enable the sqlite3 textconv once per clone (see `ops-scripts.md`).

Display names: use `fullName()` / `firstWithNick()` in `format.ts`, never `${firstName} ${lastName}`; nicknames (`Darrick “DJ” Todd`) come from `PLAYER_NICKNAMES` in `src/config.ts`, keyed by MaxPreps `career_id`, so they survive roster re-imports (not a DB field). `shortName()` stays "D. Todd".
