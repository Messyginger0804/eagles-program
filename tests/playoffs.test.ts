import { describe, expect, it } from 'vitest';
import type { Game } from '../src/lib/schema.ts';
import { PLAYOFF_ROUNDS } from '../src/config.ts';
import { gamesLeftLine, normRound, playoffOutlook } from '../src/lib/playoffs.ts';

const rounds = PLAYOFF_ROUNDS[2026]!;
const g = (round: string | null, status: Game['status'], result: Game['result'] = null, playoff = true) =>
  ({ id: `${round}-${status}`, round, status, result, playoff }) as Game;
const regular = [g(null, 'final', 'W', false), g(null, 'final', 'L', false)];

describe('playoffOutlook', () => {
  it('mid-run: Bi-District W + Area scheduled leaves 4 placeholders and 5 games', () => {
    const o = playoffOutlook([...regular, g('Bi-District', 'final', 'W'), g('Area', 'scheduled')], rounds);
    expect(o.eliminated).toBe(false);
    expect(o.champion).toBe(false);
    expect(o.placeholders.map((r) => r.name)).toEqual(['Regional Semifinal', 'Regional Final (State Quarterfinal)', 'State Semifinal', 'State Championship']);
    expect(o.gamesLeft).toBe(5);
  });
  it('matches round names case-insensitively', () => {
    const o = playoffOutlook([g('bi-district', 'final', 'W'), g(' AREA ', 'scheduled')], rounds);
    expect(o.placeholders).toHaveLength(4);
  });
  it('a finished round with no next game scheduled yet still counts the later rounds', () => {
    const o = playoffOutlook([g('Bi-District', 'final', 'W'), g('Area', 'final', 'W')], rounds);
    expect(o.placeholders).toHaveLength(4);
    expect(o.gamesLeft).toBe(4);
  });
  it('eliminated: a playoff loss gives no placeholders and 0', () => {
    const o = playoffOutlook([g('Bi-District', 'final', 'W'), g('Area', 'final', 'L')], rounds);
    expect(o).toMatchObject({ eliminated: true, champion: false, placeholders: [], gamesLeft: 0 });
  });
  it('eliminated: a playoff tie also ends the run', () => {
    const o = playoffOutlook([g('Bi-District', 'final', 'T')], rounds);
    expect(o).toMatchObject({ eliminated: true, placeholders: [], gamesLeft: 0 });
  });
  it('champion: a win in the final round', () => {
    const o = playoffOutlook([g('Area', 'final', 'W'), g('State Championship', 'final', 'W')], rounds);
    expect(o).toMatchObject({ eliminated: false, champion: true, placeholders: [], gamesLeft: 0 });
  });
  it('final round scheduled leaves no placeholders and 1 game', () => {
    const o = playoffOutlook([g('Area', 'final', 'W'), g('State Championship', 'scheduled')], rounds);
    expect(o.placeholders).toEqual([]);
    expect(o.gamesLeft).toBe(1);
  });
  it('no playoff games: nothing', () => {
    expect(playoffOutlook(regular, rounds)).toEqual({ eliminated: false, champion: false, placeholders: [], gamesLeft: 0 });
  });
  it('an unknown round name falls back to game order', () => {
    const o = playoffOutlook([g('Mystery', 'final', 'W'), g('Other', 'scheduled')], rounds);
    expect(o.placeholders.map((r) => r.name)).toEqual(['Regional Semifinal', 'Regional Final (State Quarterfinal)', 'State Semifinal', 'State Championship']);
  });
});

describe('playoffOutlook robustness', () => {
  const left4 = ['Regional Semifinal', 'Regional Final (State Quarterfinal)', 'State Semifinal', 'State Championship'];
  it('a variant round name ("Area Round") does not double count', () => {
    const o = playoffOutlook([g('Area Round', 'scheduled')], rounds);
    expect(o.placeholders.map((r) => r.name)).toEqual(left4);
    expect(o.gamesLeft).toBe(5);
  });
  it('a null round is placed by game count, not as an extra round', () => {
    const o = playoffOutlook([g('Bi-District', 'final', 'W'), g(null, 'scheduled')], rounds);
    expect(o.placeholders.map((r) => r.name)).toEqual(left4);
    expect(o.gamesLeft).toBe(5);
  });
  it('a final playoff game with a null result is unknown: consumes its round, not eliminated or champion', () => {
    const o = playoffOutlook([g('Bi-District', 'final', null), g('Area', 'scheduled')], rounds);
    expect(o).toMatchObject({ eliminated: false, champion: false });
    expect(o.placeholders).toHaveLength(4);
    expect(o.gamesLeft).toBe(5);
  });
  it('a season missing from the config yields nothing', () => {
    const o = playoffOutlook([g('Area', 'scheduled')], PLAYOFF_ROUNDS[1999] ?? []);
    expect(o).toEqual({ eliminated: false, champion: false, placeholders: [], gamesLeft: 0 });
  });
  it('champion via the "State Final" alias', () => {
    const names = ['Bi-District', 'Area', 'Regional Semifinal', 'Regional Final', 'State Semifinal'];
    const o = playoffOutlook([...names.map((n) => g(n, 'final', 'W')), g('State Final', 'final', 'W')], rounds);
    expect(o).toMatchObject({ champion: true, placeholders: [], gamesLeft: 0 });
  });
  it('champion when playoff games equal the round count and the last is a win, whatever the names', () => {
    const o = playoffOutlook(['a', 'b', 'c', 'd', 'e', 'f'].map((n) => g(n, 'final', 'W')), rounds);
    expect(o.champion).toBe(true);
  });
  it('games out of round order give the same answer', () => {
    const o = playoffOutlook([g('Area', 'scheduled'), g('Bi-District', 'final', 'W')], rounds);
    expect(o.placeholders.map((r) => r.name)).toEqual(left4);
    expect(o.gamesLeft).toBe(5);
  });
  it('a scheduled game in the same round as a would-be placeholder is not counted twice', () => {
    const o = playoffOutlook([g('Bi-District', 'final', 'W'), g('Area', 'final', 'W'), g('Regional Semifinal', 'scheduled')], rounds);
    expect(o.placeholders.map((r) => r.name)).toEqual(left4.slice(1));
    expect(o.gamesLeft).toBe(4);
  });
  it('handles NBSP, hyphen, parenthetical and trailing "round"', () => {
    expect(normRound('Bi\u00a0District')).toBe('bi district');
    expect(normRound('Bi-District Round')).toBe('bi district');
    expect(normRound('Regional  Final (State Quarterfinal)')).toBe('regional final');
    const o = playoffOutlook([g('Bi-District', 'final', 'W'), g('Area\u00a0Round', 'scheduled')], rounds);
    expect(o.placeholders).toHaveLength(4);
  });
  it('gamesLeft never exceeds rounds minus completed playoff games', () => {
    const cases: Game[][] = [
      [g('Mystery', 'scheduled')],
      [g('Bi-District', 'final', 'W'), g('x', 'scheduled'), g('y', 'scheduled')],
      [g('Bi-District', 'final', null), g('Area', 'final', null), g('Area Round', 'scheduled')],
      [g(null, 'scheduled'), g(null, 'scheduled'), g(null, 'scheduled')],
    ];
    for (const c of cases) {
      const done = c.filter((x) => x.status === 'final').length;
      expect(playoffOutlook(c, rounds).gamesLeft).toBeLessThanOrEqual(rounds.length - done);
    }
  });
});

describe('gamesLeftLine', () => {
  it('handles singular and plural', () => {
    expect(gamesLeftLine(1)).toBe('1 more game to a state title');
    expect(gamesLeftLine(5)).toBe('Up to 5 more games to a state title');
  });
});
