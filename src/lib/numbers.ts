// Read-only helper: jersey-number index for the home grid and the number sheet.
// Only fields the site already shows (number, name, positions, grade, height, weight, one stat highlight).
import type { Player, Roster, SeasonStats } from './schema.ts';
import { byNumber, firstWithNick, gradeLabel, statHighlight } from './format.ts';

export interface SheetPlayer {
  first: string;
  last: string;
  pos: string[];
  grade: string | null;
  ht: string | null;
  wt: number | null;
  stat: string | null;
  href: string;
}
export interface NumberEntry {
  number: string;
  /** Player page for a unique number; the roster filtered by that number when several players share it. */
  href: string;
  players: SheetPlayer[];
}

/** One entry per distinct jersey number, sorted numerically. `hrefFor` builds base-prefixed URLs. */
export function numberIndex(
  roster: Roster,
  stats: SeasonStats,
  hrefFor: (path: string) => string,
): NumberEntry[] {
  const byNum = new Map<string, Player[]>();
  for (const p of byNumber(roster.players)) {
    byNum.set(p.number, [...(byNum.get(p.number) ?? []), p]);
  }
  return [...byNum.entries()].map(([number, ps]) => ({
    number,
    href: ps.length === 1 ? hrefFor(`/players/${ps[0]!.slug}`) : hrefFor(`/roster?q=${encodeURIComponent(number)}`),
    players: ps.map((p) => ({
      first: firstWithNick(p),
      last: p.lastName,
      pos: p.positions,
      grade: p.grade == null ? null : gradeLabel(p.grade),
      ht: p.height,
      wt: p.weight,
      stat: statHighlight(roster, stats, p),
      href: hrefFor(`/players/${p.slug}`),
    })),
  }));
}
