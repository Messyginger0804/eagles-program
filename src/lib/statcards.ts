import type { PlayerCategoryStats } from './season';

/** Keep only categories where some stat other than games played is non-zero. */
export function nonEmptyCategories<T extends Pick<PlayerCategoryStats, 'stats'>>(cats: T[]): T[] {
  return cats.filter((c) =>
    Object.entries(c.stats).some(([k, v]) => k !== 'gp' && v != null && v !== 0),
  );
}

/** True if some stat other than games played is non-zero. */
export function hasRealStats(stats: Record<string, number | null>): boolean {
  return Object.entries(stats).some(([k, v]) => k !== 'gp' && v != null && v !== 0);
}

/** Rows where at least one stat other than gp is non-zero. */
export function realRows<T extends { stats: Record<string, number | null> }>(rows: T[]): T[] {
  return rows.filter((r) => hasRealStats(r.stats));
}
