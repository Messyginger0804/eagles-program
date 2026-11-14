import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canonical, openReadOnly, readGames, readOpponents, readRoster, readSeasonStats, readTeam } from '../src/lib/db.ts';
import { exportDir } from '../scripts/db-export.ts';
import { dumpSql } from '../scripts/db-dump.ts';
import { importDir } from '../scripts/db-import.ts';

const fixtures = new URL('./fixtures/data', import.meta.url).pathname;
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
let tmp: string, dbPath: string;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'eagles-db-'));
  dbPath = join(tmp, 'test.db');
  importDir(dbPath, fixtures);
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('db round trip', () => {
  it('reads back the fixture objects exactly', () => {
    const db = openReadOnly(dbPath);
    expect(canonical(readTeam(db))).toBe(canonical(read(`${fixtures}/team.json`)));
    expect(canonical(readRoster(db))).toBe(canonical(read(`${fixtures}/roster.json`)));
    expect(canonical(readSeasonStats(db))).toBe(canonical(read(`${fixtures}/season-stats.json`)));
    for (const g of readGames(db)) expect(canonical(g)).toBe(canonical(read(`${fixtures}/games/${g.id}.json`)));
    for (const o of readOpponents(db)) expect(canonical(o)).toBe(canonical(read(`${fixtures}/opponents/${o.slug}.json`)));
    expect(readGames(db).length).toBe(readdirSync(`${fixtures}/games`).length);
    db.close();
  });
  it('exports JSON equal to the input', () => {
    const out = join(tmp, 'export');
    exportDir(dbPath, out);
    for (const rel of ['team.json', 'roster.json', 'season-stats.json']) {
      expect(canonical(read(join(out, rel)))).toBe(canonical(read(join(fixtures, rel))));
    }
    for (const f of readdirSync(`${fixtures}/games`)) expect(canonical(read(join(out, 'games', f)))).toBe(canonical(read(join(fixtures, 'games', f))));
  });
  it('is idempotent (re-import leaves the dump unchanged)', () => {
    const before = dumpSql(dbPath);
    importDir(dbPath, fixtures);
    expect(dumpSql(dbPath)).toBe(before);
  });
});
