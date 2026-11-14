// Rebuild the spec-format JSON dir from the DB.
// Usage: node scripts/db-export.ts --out <dir> [--db <path>] [--season <year>]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { currentSeason, openReadOnly, readGames, readOpponents, readRoster, readScheduleEvents, readSeasonStats, readTeam } from '../src/lib/db.ts';
import { DB_PATH } from './db-import.ts';

export function exportDir(dbPath: string, out: string, season?: number): void {
  const db = openReadOnly(dbPath);
  try {
    const s = season ?? currentSeason(db);
    const write = (rel: string, v: unknown) => writeFileSync(join(out, rel), JSON.stringify(v, null, 2) + '\n');
    mkdirSync(join(out, 'games'), { recursive: true });
    mkdirSync(join(out, 'opponents'), { recursive: true });
    write('team.json', readTeam(db, s));
    write('roster.json', readRoster(db, s));
    write('season-stats.json', readSeasonStats(db, s));
    write('schedule-events.json', readScheduleEvents(db, s));
    for (const g of readGames(db, s)) write(`games/${g.id}.json`, g);
    for (const o of readOpponents(db, s)) write(`opponents/${o.slug}.json`, o);
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  const out = arg('--out');
  if (!out) { console.error('Usage: node scripts/db-export.ts --out <dir> [--db <path>] [--season <year>]'); process.exit(2); }
  const season = arg('--season');
  exportDir(resolve(arg('--db') ?? DB_PATH), resolve(out), season ? Number(season) : undefined);
  console.log(`db-export: wrote ${resolve(out)}`);
}
