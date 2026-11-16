import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { statLine } from '../src/lib/format.ts';
import { GameSchema, RosterSchema, SeasonStatsSchema } from '../src/lib/schema.ts';
import { findPlayers, gameStatMismatches, joinSeasonStats, leaders, playerGameLog, playerSeasonStats, scoringSum, seniors, sortGames, sumGameStats } from '../src/lib/season.ts';

const read = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/data/${f}`, import.meta.url), 'utf8'));
const roster = RosterSchema.parse(read('roster.json'));
const stats = SeasonStatsSchema.parse(read('season-stats.json'));
const final = GameSchema.parse(read('games/2026-11-13-eastern-hills.json'));
const scheduled = GameSchema.parse(read('games/2026-tbd-lindale.json'));
const byNum = (n: string, i = 0) => roster.players.filter((p) => p.number === n)[i]!;

describe('joinSeasonStats', () => {
  const { matched, unmatched } = joinSeasonStats(roster, stats);
  it('matches all fixture rows', () => {
    expect(unmatched).toEqual([]);
    expect(matched.length).toBe(9);
  });
  it('breaks duplicate-number ties by initial and by last name', () => {
    const name = (abbrev: string) => matched.find((m) => m.row.nameAbbrev === abbrev)!.player.firstName;
    expect(name('J. Smith (Sr)')).toBe('Jordan');
    expect(name('K. Smith (Fr)')).toBe('Kyle');
    expect(name('S. Adams (So)')).toBe('Sam');
    expect(name('T. Baker (Jr)')).toBe('Tom');
  });
  it('reports unmatched and ambiguous rows', () => {
    const bad = SeasonStatsSchema.parse({ asOf: null, gamesPlayed: 1, categories: [{ key: 'x', label: 'X', columns: [], rows: [
      { number: '99', nameAbbrev: 'Z. Nobody (Sr)', stats: {} },
      { number: '5', nameAbbrev: 'X. Jones (Sr)', stats: {} },
    ] }] });
    const r = joinSeasonStats(roster, bad);
    expect(r.unmatched.map((u) => u.reason)).toEqual(['none', 'ambiguous']);
  });
  it('builds a per-player view', () => {
    const cats = playerSeasonStats(roster, stats, byNum('5', 0)).map((c) => c.key);
    expect(cats).toEqual(['sacks']);
    expect(playerSeasonStats(roster, stats, byNum('6')).map((c) => c.key)).toEqual(['rushing', 'touchdowns']);
  });
});

describe('scoringSum', () => {
  it('sums the fixture game to its final score', () => {
    expect(scoringSum(final.scoring)).toEqual(final.score);
  });
  it('scores each type', () => {
    const p = (type: any) => ({ quarter: 1, time: null, team: 'WH' as const, type, player: null, passer: null, yards: null, scoreAfter: null });
    expect(scoringSum([p('rushTD'), p('patKick'), p('twoPtPass'), p('fieldGoal'), p('safety'), p('patKickMissed'), p('twoPtFailed')]).wh).toBe(14);
  });
});

describe('findPlayers', () => {
  it('numeric query matches jersey exactly, possibly several', () => {
    expect(findPlayers(roster, '5').length).toBe(2);
    expect(findPlayers(roster, '0').map((p) => p.lastName)).toEqual(['Johnson']);
    expect(findPlayers(roster, '00').map((p) => p.lastName)).toEqual(['Stats']);
    expect(findPlayers(roster, '2')).toEqual([]);
  });
  it('text query matches names case-insensitively', () => {
    expect(findPlayers(roster, 'lomax').map((p) => p.number)).toEqual(['6']);
    expect(findPlayers(roster, 'ANTERIO LOMAX').length).toBe(1);
    expect(findPlayers(roster, 'smith').length).toBe(3);
  });
});

describe('playerGameLog', () => {
  it('collects scoring and takeaways for WH players', () => {
    const lomax = playerGameLog(roster, [final, scheduled], byNum('6'));
    expect(lomax).toHaveLength(1);
    expect(lomax[0]!.scoring.map((s) => s.play.type)).toEqual(['rushTD', 'rushTD', 'rushTD', 'twoPtPass']);
    const smith = playerGameLog(roster, [final], byNum('3'));
    expect(smith[0]!.takeaways[0]!.type).toBe('interception');
  });
  it('credits the passer and ignores opponents with the same number', () => {
    const todd = playerGameLog(roster, [final], byNum('10'))[0]!;
    expect(todd.scoring.map((s) => s.role)).toEqual(['scorer', 'passer']);
    // OPP #5 Kendrid Durst is a passer in the data; WH #5 Smiths must not pick it up.
    expect(playerGameLog(roster, [final], byNum('5', 0))).toEqual([]);
  });
});

describe('game stats', () => {
  it('playerGameLog returns game stats for a player in the game, null otherwise', () => {
    const adams = playerGameLog(roster, [final], byNum('11', 0))[0]!;
    expect(adams.stats!.map((c) => c.key)).toEqual(['sacks']);
    expect(adams.stats![0]!.stats['sacks']).toBe(2);
    expect(playerGameLog(roster, [final], byNum('6'))[0]!.stats!.map((c) => c.key)).toEqual(['touchdowns']);
    expect(playerGameLog(roster, [final], byNum('3'))[0]!.stats).toBeNull();
    expect(playerGameLog(roster, [{ ...final, playerStats: null }], byNum('11', 0))).toEqual([]);
  });
  it('statLine summarizes non-zero stats', () => {
    const adams = playerGameLog(roster, [final], byNum('11', 0))[0]!;
    expect(statLine(adams.stats)).toBe('2 sacks');
    expect(statLine(null)).toBe('');
    expect(statLine([{ key: 'sacks', label: 'Sacks', columns: [], stats: { sacks: 1 } }, { key: 'tackles', label: 'Tackles', columns: [], stats: { totTckls: 5, tfl: 0 } }])).toBe('5 tackles, 1 sack');
  });
  it('sumGameStats adds, takes max for lng and skips nulls and rates', () => {
    const mk = (stats: Record<string, number | null>) => ({ ...final, playerStats: { categories: [{ key: 'receiving', label: 'Receiving', columns: [], rows: [{ number: '6', nameAbbrev: 'A. Lomax (Sr)', stats }] }] } });
    const sums = sumGameStats(roster, [mk({ rec: 3, yds: 31, avg: 10.3, lng: 20, td: null }), mk({ rec: 2, yds: 10, avg: 5, lng: 12, td: 1 })]);
    expect(sums.get(`${byNum('6').careerId}|receiving`)).toEqual({ rec: 5, yds: 41, lng: 20, td: 1 });
  });
  it('gameStatMismatches compares season totals with game sums', () => {
    const all = gameStatMismatches(roster, stats, [final]);
    expect(all.find((m) => m.player.number === '11' && m.categoryKey === 'sacks')).toMatchObject({ season: 8, games: 2 });
    expect(all.find((m) => m.categoryKey === 'touchdowns' && m.column === 'tdRush')).toMatchObject({ season: 9, games: 3 });
    const matching = { ...final, playerStats: { categories: [{ key: 'touchdowns', label: 'Touchdowns', columns: [], rows: [{ number: '6', nameAbbrev: 'A. Lomax (Sr)', stats: { tdRush: 9, total: 9 } }] }] } };
    expect(gameStatMismatches(roster, stats, [matching]).filter((m) => m.categoryKey === 'touchdowns' && m.player.number === '6')).toEqual([]);
  });
});

describe('misc', () => {
  it('sorts scheduled games last', () => {
    expect(sortGames([scheduled, final]).map((g) => g.id)).toEqual([final.id, scheduled.id]);
  });
  it('leaders and seniors', () => {
    expect(leaders(stats, 'rushing', 'yds', 2).map((r) => r.number)).toEqual(['6', '10']);
    expect(seniors(roster).map((p) => p.number).sort()).toEqual(['10', '5', '6']);
  });
});

describe('check-stats smoke', () => {
  it('runs on fixtures with exit 0', async () => {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, ['scripts/check-stats.ts', '--data', 'tests/fixtures/data'], { encoding: 'utf8' });
    expect(r.stdout).toContain('0 error(s)');
    expect(r.status).toBe(0);
  });
});

describe('check-stats game stats', () => {
  it('errors on a non-final game with playerStats and on an unmatched row', async () => {
    const { spawnSync } = await import('node:child_process');
    const { cpSync, mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'check-stats-'));
    cpSync(new URL('./fixtures/data', import.meta.url), dir, { recursive: true });
    const bad = { ...scheduled, playerStats: { categories: [{ key: 'sacks', label: 'Sacks', columns: [{ key: 'sacks', label: 'Sacks' }], rows: [{ number: '99', nameAbbrev: 'Z. Nobody (Sr)', stats: { sacks: 1 } }] }] } };
    writeFileSync(join(dir, 'games', `${scheduled.id}.json`), JSON.stringify(bad));
    const r = spawnSync(process.execPath, ['scripts/check-stats.ts', '--data', dir], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('playerStats present but status is scheduled');
    expect(r.stdout).toContain('matches no roster player');
  });
});

describe('game data gaps', () => {
  it('requires scoringStatus and accepts null quarters/location', () => {
    expect(final.scoringStatus).toBe('complete');
    expect(scheduled.scoringStatus).toBe('none');
    expect(GameSchema.safeParse({ ...scheduled, location: null, date: null }).success).toBe(true);
    expect(scheduled.quarters).toBeNull();
    const { scoringStatus: _s, ...rest } = final;
    expect(GameSchema.safeParse(rest).success).toBe(false);
    expect(GameSchema.safeParse({ ...final, quarters: null, scoringStatus: 'partial' }).success).toBe(true);
  });
});
