import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GameSchema, RosterSchema } from '../src/lib/schema.ts';
import { pbpCoverageNote, playByPlayTouchdowns } from '../src/lib/season.ts';

const read = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/data/${f}`, import.meta.url), 'utf8'));
const roster = RosterSchema.parse(read('roster.json'));
const base = read('games/2026-11-13-eastern-hills.json');
const ref = (number: string, name: string) => ({ number, name });
const play = (type: string, player: unknown, passer: unknown = null, team = 'WH') =>
  ({ quarter: 1, time: null, team, type, player, passer, yards: null, scoreAfter: null });
const game = (id: string, scoringStatus: string, scoring: unknown[], status = 'final') =>
  GameSchema.parse({ ...base, id, status, scoringStatus, scoring });

const lomax = ref('6', 'Anterio Lomax');
const salas = ref('23', 'Salas');
const todd = ref('10', 'Todd');

describe('playByPlayTouchdowns', () => {
  const games = [
    game('2026-09-01-a', 'complete', [play('rushTD', lomax), play('passTD', salas, todd), play('kickReturnTD', lomax), play('fieldGoal', null), play('rushTD', ref('6', 'Lomax'), null, 'OPP')]),
    game('2026-09-08-b', 'partial', [play('rushTD', lomax)]),
    game('2026-09-15-c', 'none', [play('rushTD', lomax)]),
    game('2026-09-22-d', 'complete', [play('rushTD', lomax)], 'scheduled'),
  ];
  const r = playByPlayTouchdowns(roster, games);
  const by = (n: string) => r.rows.find((x) => x.player.number === n)!;

  it('counts only final complete/partial games and reports coverage', () => {
    expect(r.coverage).toEqual({ complete: 1, partial: 1, none: 1, played: 3 });
    expect(by('6')).toMatchObject({ rushing: 2, returns: 1, receiving: 0, passing: 0, total: 3 });
  });
  it('attributes passTD to receiver and passer separately', () => {
    expect(by('23')).toMatchObject({ receiving: 1, passing: 0, total: 1 });
    expect(by('10')).toMatchObject({ passing: 1, receiving: 0, total: 1 });
  });
  it('ignores opponent plays and non-TD plays, and sorts by total', () => {
    expect(r.rows.map((x) => x.player.number)).toEqual(['6', '23', '10']);
    expect(r.rows[0]!.total).toBe(3);
  });
  it('reports unmatched scorer refs', () => {
    const u = playByPlayTouchdowns(roster, [game('2026-09-01-a', 'complete', [play('rushTD', ref('77', 'Ghost'))])]);
    expect(u.rows).toEqual([]);
    expect(u.unmatched).toHaveLength(1);
  });
  it('formats the coverage note', () => {
    expect(pbpCoverageNote(r.coverage)).toBe(
      "Counted from MaxPreps play-by-play for 2 of 3 games (1 partial). Games without play-by-play aren't included, so these are minimums.",
    );
  });
});
