import { describe, expect, it } from 'vitest';
import type { Game } from '../src/lib/schema.ts';
import { PLAYOFF_ROUNDS } from '../src/config.ts';
import { gamesLeftLine, playoffOutlook } from '../src/lib/playoffs.ts';

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

describe('gamesLeftLine', () => {
  it('handles singular and plural', () => {
    expect(gamesLeftLine(1)).toBe('1 more game to a state title');
    expect(gamesLeftLine(5)).toBe('Up to 5 more games to a state title');
  });
});
