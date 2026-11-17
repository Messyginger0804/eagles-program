import { describe, expect, it } from 'vitest';
import type { Game } from '../src/lib/schema.ts';
import { isMascotMirror } from '../src/lib/mascot.ts';

const g = (mascot: string | null, status: Game['status'] = 'scheduled') =>
  ({ status, opponent: { name: 'Lindale', mascot, city: null, maxprepsTeamUrl: null } }) as Game;

describe('isMascotMirror', () => {
  it('matches the same mascot, ignoring case and whitespace', () => {
    expect(isMascotMirror(g('Eagles'), 'Eagles')).toBe(true);
    expect(isMascotMirror(g('  eagles '), 'EAGLES')).toBe(true);
  });
  it('does not match a different mascot', () => {
    expect(isMascotMirror(g('Hawks'), 'Eagles')).toBe(false);
  });
  it('does not match a final game', () => {
    expect(isMascotMirror(g('Eagles', 'final'), 'Eagles')).toBe(false);
  });
  it('does not match missing or blank mascots, or no game', () => {
    expect(isMascotMirror(g(null), 'Eagles')).toBe(false);
    expect(isMascotMirror(g('  '), '  ')).toBe(false);
    expect(isMascotMirror(g('Eagles'), null)).toBe(false);
    expect(isMascotMirror(undefined, 'Eagles')).toBe(false);
  });
});
