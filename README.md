# Wilmer-Hutchins Eagles Game-Day Program

Static fan-edition game-day program for the Wilmer-Hutchins Eagles, built with Astro. Pages: schedule, roster, stats, matchup, seniors/coaches, per-game and per-player pages, and a booklet-order `/print`.

Live site: https://messyginger0804.github.io/eagles-program/

## Deploy

Hosted on GitHub Pages as a project site (`base: '/eagles-program'`). Pushing or merging to `main` runs `.github/workflows/deploy.yml`: tests, `check:stats`, build, `check:links`, then the `dist` artifact is published to Pages. It can also be run manually (`workflow_dispatch`). Internal URLs go through `withBase()` in `src/lib/url.ts`.

`npm run check:links` (after `npm run build`) fails if any internal URL in `dist` lacks the `/eagles-program/` prefix or points to a missing file.

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run check` (astro check), `npm test`, `npm run check:stats` (data sanity checks)
- `npm run db:import -- --data <dir>`, `npm run db:export -- --out <dir>`, `npm run db:dump`

## Data

All data lives in a SQLite file committed to git: `db/eagles.db` (schema in `db/schema.sql`). The site stays static: the build reads the DB read-only (`src/lib/db.ts`, validated with zod) and renders HTML. Requires Node 24 (`node:sqlite`).

`db:import` takes a directory in the JSON spec format (`team.json`, `roster.json`, `season-stats.json`, `games/*.json`, `opponents/*.json`), validates it, and upserts in one transaction. Re-importing the same data changes nothing. `db:export` writes the same JSON back out.

## Weekly update

1. Chrome pull writes JSON to a scratch dir.
2. `npm run db:import -- --data <scratch dir>`
3. `npm run check:stats`
4. Commit and push `db/eagles.db`.

## Hand edits

Open `db/eagles.db` in DB Browser for SQLite, edit, and Write Changes (the DB uses a rollback journal, no WAL files). Then run `npm run check:stats`.

## Git diffs

`.gitattributes` maps `*.db` to a `sqlite3` diff driver. Enable readable diffs once per clone:
`git config diff.sqlite3.textconv "node scripts/db-dump.ts"` (`npm run db:dump` prints the SQL text dump).
