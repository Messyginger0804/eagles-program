# Testing (vitest)

Config: `vitest.config.ts` only sets `include: ['tests/**/*.test.ts']`. Run with `npm test` (`vitest run`). Vitest 5, TypeScript tests importing from `src/lib/*.ts` and `scripts/*.ts` with explicit `.ts` extensions.

## What tests/ covers
- `db.test.ts`: imports the fixtures into a temp DB, checks read-back equals the fixture JSON, export equals input, and re-import is idempotent (SQL dump unchanged).
- `season.test.ts`: season stat joining (duplicate numbers, unmatched/ambiguous rows), scoring sums, player search, game logs, leaders/seniors, and a smoke run of `check-stats` on fixtures (exit 0).
  Also covers game stats: `playerGameLog` stats, `statLine`, `sumGameStats`, `gameStatMismatches`, and check-stats error cases on a temp copy of the fixtures.
- `pbp-tds.test.ts`: play-by-play touchdown leaderboard and coverage note.
- `badges.test.ts`: game badges, round names, venue helpers.
- `split-record.test.ts`: home/away record split and schedule merge with events.
- `playoffs.test.ts`: remaining playoff rounds, games-left count, eliminated and champion cases, name normalization, null rounds/results, the games-left cap.
- `format.test.ts`: `shortName` (box score short names).
- `statcards.test.ts`: hiding all-zero stat categories and rows.

## Conventions
- Fixtures live in `tests/fixtures/data/` in the JSON spec format (team, roster, season-stats, games, opponents). Update them when the schema in `src/lib/schema.ts` changes.
- Tests build temp DBs (`mkdtempSync`) and never touch `db/eagles.db`.
- The deploy workflow runs `npm test` before `check:stats`, build and `check:links` (see `ops-deploy.md`). Astro pages and components have no direct tests; page-level breakage is caught by `build` and `check:links`.
