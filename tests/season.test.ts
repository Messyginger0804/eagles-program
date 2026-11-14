import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GameSchema, RosterSchema, SeasonStatsSchema } from '../src/lib/schema.ts';
import { findPlayers, joinSeasonStats, leaders, playerGameLog, playerSeasonStats, scoringSum, seniors, sortGames } from '../src/lib/season.ts';

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
