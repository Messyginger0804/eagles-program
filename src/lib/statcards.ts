import type { PlayerCategoryStats } from './season';

/** Keep only categories where some stat other than games played is non-zero. */
export function nonEmptyCategories<T extends Pick<PlayerCategoryStats, 'stats'>>(cats: T[]): T[] {
  return cats.filter((c) =>
    Object.entries(c.stats).some(([k, v]) => k !== 'gp' && v != null && v !== 0),
  );
}
