import { describe, expect, it } from 'vitest';
import { nonEmptyCategories } from '../src/lib/statcards.ts';

describe('nonEmptyCategories', () => {
  it('drops categories with only gp / zeros / nulls', () => {
    const cats: { key: string; stats: Record<string, number | null> }[] = [
      { key: 'passing', stats: { gp: 9, yds: 0, td: null } },
      { key: 'defense', stats: { gp: 9, tkl: 12, sack: 0 } },
    ];
    expect(nonEmptyCategories(cats).map((c) => c.key)).toEqual(['defense']);
  });
  it('returns empty when nothing has data', () => {
    expect(nonEmptyCategories([{ stats: { gp: 3, a: 0 } }])).toEqual([]);
  });
});
