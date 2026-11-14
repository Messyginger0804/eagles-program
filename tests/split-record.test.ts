import { describe, expect, it } from 'vitest';
import type { Game, ScheduleEvent } from '../src/lib/schema.ts';
import { splitRecordLine, siteTag } from '../src/lib/format.ts';
import { mergeSchedule, splitRecord } from '../src/lib/season.ts';

type G = Pick<Game, 'status' | 'result' | 'location'>;
const g = (location: G['location'], result: G['result'], status: G['status'] = 'final'): G => ({ location, result, status });

describe('splitRecord', () => {
  it('is all zeros with no games', () => {
    expect(splitRecord([])).toEqual({ home: { w: 0, l: 0, t: 0 }, away: { w: 0, l: 0, t: 0 }, neutral: { w: 0, l: 0, t: 0 } });
  });
  it('splits wins, losses and ties by site', () => {
    const r = splitRecord([g('home', 'W'), g('home', 'W'), g('away', 'L'), g('away', 'W'), g('neutral', 'T'), g('home', 'L')]);
    expect(r.home).toEqual({ w: 2, l: 1, t: 0 });
    expect(r.away).toEqual({ w: 1, l: 1, t: 0 });
    expect(r.neutral).toEqual({ w: 0, l: 0, t: 1 });
  });
  it('ignores scheduled games and games without a site', () => {
    const r = splitRecord([g('neutral', null, 'scheduled'), g('home', null, 'scheduled'), g(null, 'W')]);
    expect(r.neutral).toEqual({ w: 0, l: 0, t: 0 });
    expect(r.home.w + r.away.w).toBe(0);
  });
});

const game = (id: string, date: string | null, status: Game['status'] = 'final') => ({ id, date, status }) as Game;
const ev = (date: string, kind: ScheduleEvent['kind']) => ({ date, kind, opponentName: null, location: null, note: null }) as ScheduleEvent;
const ids = (items: ReturnType<typeof mergeSchedule>) => items.map((i) => (i.type === 'game' ? i.game.id : `${i.event.kind}@${i.event.date}`));

describe('mergeSchedule', () => {
  it('interleaves events by date and keeps undated games last', () => {
    const out = mergeSchedule(
      [game('b', '2026-09-11'), game('c', '2026-09-25'), game('tbd', null, 'scheduled'), game('a', '2026-08-28')],
      [ev('2026-09-18', 'bye'), ev('2026-08-14', 'scrimmage')],
    );
    expect(ids(out)).toEqual(['scrimmage@2026-08-14', 'a', 'b', 'bye@2026-09-18', 'c', 'tbd']);
  });
  it('puts a game before an event on the same date', () => {
    expect(ids(mergeSchedule([game('x', '2026-09-18')], [ev('2026-09-18', 'bye')]))).toEqual(['x', 'bye@2026-09-18']);
  });
  it('does not mutate its inputs and works without events', () => {
    const games = [game('b', '2026-09-11'), game('a', '2026-08-28')];
    expect(ids(mergeSchedule(games, []))).toEqual(['a', 'b']);
    expect(games[0]!.id).toBe('b');
  });
});

describe('split record display', () => {
  const z = { w: 0, l: 0, t: 0 };
  it('shows home and away, and neutral only when played', () => {
    expect(splitRecordLine({ home: { w: 5, l: 0, t: 0 }, away: { w: 4, l: 2, t: 0 }, neutral: z })).toBe('Home 5-0 · Away 4-2');
    expect(splitRecordLine({ home: z, away: z, neutral: { w: 1, l: 0, t: 0 } })).toBe('Home 0-0 · Away 0-0 · Neutral 1-0');
  });
  it('tags the site in capitals', () => {
    expect([siteTag('home'), siteTag('away'), siteTag('neutral'), siteTag(null)]).toEqual(['HOME', 'AWAY', 'NEUTRAL', null]);
  });
});
