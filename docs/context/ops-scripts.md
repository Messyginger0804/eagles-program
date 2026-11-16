# Scripts and npm commands

Node version: `.nvmrc` is `24`; `package.json` engines `>=24`. Node runs the `.ts` scripts directly (`node scripts/x.ts`), and `node:sqlite` needs 24.

## npm scripts (`package.json`)
- `dev`, `build`, `preview`: `astro dev|build|preview`.
- `check`: `astro check` (type check).
- `test`: `vitest run` (see `testing-vitest.md`).
- `check:stats`, `check:links`, `db:import`, `db:export`, `db:dump`: wrap the scripts below.

## scripts/
- `check-stats.ts`: data sanity checks. Reads the DB by default (`--db <path>`), or a JSON dir with `--data <dir>`. Errors (nonzero exit) include schema failures, `nextGameId` matching no game, complete scoring that does not sum to the final score, and scorers not on the roster. Game stats: errors for `playerStats` on a non-final game or a row matching no or several roster players. Warnings cover final games with `playerStats` null, season totals that differ from the sum of the games (`gameStatMismatches` in `season.ts`), partial scoring, null quarters, duplicate jersey numbers, TD mismatches and players with no stats.
- `check-links.ts`: run after `build`. Walks `dist/**/*.html` and fails if an internal URL is not root-relative or points to a missing file (`BASE = '/'`).
- `db-import.ts`: imports a JSON dir into the DB in one transaction, validated by zod, idempotent. `npm run db:import -- --data <dir> [--db <path>]`. Exports `DB_PATH`, `SCHEMA_PATH`, `importDir`.
- `db-export.ts`: writes the JSON spec dir from the DB: `npm run db:export -- --out <dir> [--db <path>] [--season <year>]`.
- `db-dump.ts`: deterministic SQL text dump for readable git diffs. Enable once per clone: `git config diff.sqlite3.textconv "node scripts/db-dump.ts"` (`.gitattributes` maps `*.db` to the `sqlite3` driver).
- `make-art.mjs`: derives `public/art/*` from the poster image (needs `sharp`). See `site-astro.md`.
- `make-icons.mjs`: recolors the PNG app icons in `public/brand/` (apple-touch-icon, favicon-48, icon-192, icon-512) from the old #16478E to royal #0A4598 (needs `sharp`). Run `node scripts/make-icons.mjs`; run it once only, as it rewrites the PNGs in place and a second run shifts them further.

## Weekly data update (from README)
1. Pull data to JSON in a scratch dir (outside the repo). The source is MaxPreps; see data-maxpreps.md for URLs and fetching.
2. `npm run db:import -- --data <dir>`
3. `npm run check:stats`
4. Commit `db/eagles.db` and push. Merging to `main` deploys (see `ops-deploy.md`).

Hand edits: open the DB in DB Browser for SQLite, Write Changes, then run `npm run check:stats`.
