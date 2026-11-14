// Pure helpers over already-parsed data objects. No file I/O.
import type { Game, Player, Roster, ScoringPlay, SeasonStats, StatCategory } from './schema.ts';

type StatRow = StatCategory['rows'][number];

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Parse "A. Lomax (Sr)" into { initial: "a", last: "lomax" }. */
export function parseAbbrev(nameAbbrev: string): { initial: string; last: string } {
  const base = nameAbbrev.replace(/\([^)]*\)/g, '').trim();
  const m = base.match(/^([^\s.]+)\.?\s+(.+)$/);
  if (!m) return { initial: '', last: norm(base) };
  return { initial: norm(m[1]).slice(0, 1), last: norm(m[2]) };
}

export interface RowMatch {
  row: StatRow;
  player: Player;
}
export interface UnmatchedRow {
  row: StatRow;
  reason: 'none' | 'ambiguous';
  candidates: Player[];
}
export interface JoinResult {
  matched: RowMatch[];
  unmatched: UnmatchedRow[];
}

/** Find the roster player for one season-stat row (number, tie-broken by nameAbbrev). */
export function matchRow(roster: Roster, row: StatRow): { player: Player } | { reason: 'none' | 'ambiguous'; candidates: Player[] } {
  const sameNumber = roster.players.filter((p) => p.number === row.number);
  if (sameNumber.length === 0) return { reason: 'none', candidates: [] };
  if (sameNumber.length === 1) return { player: sameNumber[0]! };
  const { initial, last } = parseAbbrev(row.nameAbbrev);
  const byLast = sameNumber.filter((p) => norm(p.lastName) === last);
  const byBoth = byLast.filter((p) => initial && norm(p.firstName).startsWith(initial));
  if (byBoth.length === 1) return { player: byBoth[0]! };
  if (byBoth.length === 0 && byLast.length === 1) return { player: byLast[0]! };
  if (byLast.length === 0) {
    // Last name didn't match; fall back to the initial alone.
    const byInitial = sameNumber.filter((p) => initial && norm(p.firstName).startsWith(initial));
    if (byInitial.length === 1) return { player: byInitial[0]! };
  }
  return { reason: 'ambiguous', candidates: sameNumber };
}

/** Join every season-stat row (across categories) to roster players. */
export function joinSeasonStats(roster: Roster, stats: SeasonStats): JoinResult {
  const matched: RowMatch[] = [];
  const unmatched: UnmatchedRow[] = [];
  for (const cat of stats.categories) {
    for (const row of cat.rows) {
      const r = matchRow(roster, row);
      if ('player' in r) matched.push({ row, player: r.player });
      else unmatched.push({ row, reason: r.reason, candidates: r.candidates });
    }
  }
  return { matched, unmatched };
}

export interface PlayerCategoryStats {
  key: string;
  label: string;
  columns: StatCategory['columns'];
  stats: StatRow['stats'];
}

/** The season categories in which this player has a row. */
export function playerSeasonStats(roster: Roster, stats: SeasonStats, player: Player): PlayerCategoryStats[] {
  const out: PlayerCategoryStats[] = [];
  for (const cat of stats.categories) {
    for (const row of cat.rows) {
      const r = matchRow(roster, row);
      if ('player' in r && r.player.careerId === player.careerId) {
        out.push({ key: cat.key, label: cat.label, columns: cat.columns, stats: row.stats });
      }
    }
  }
  return out;
}

/** True if a play/takeaway player reference is this roster player (number + last name). */
export function refMatchesPlayer(ref: { number: string; name: string } | null, player: Player): boolean {
  if (!ref || ref.number !== player.number) return false;
  const n = norm(ref.name);
  const last = norm(player.lastName);
  return n === last || n.endsWith(last);
}

export interface GameLogEntry {
  gameId: string;
  date: string | null;
  opponent: string;
  scoring: { play: ScoringPlay; role: 'scorer' | 'passer' }[];
  takeaways: Game['takeaways'];
  stats: PlayerCategoryStats[] | null;
}

/** Per-player game log (WH plays only), ordered by game date. Games with no involvement are omitted. */
export function playerGameLog(roster: Roster, games: Game[], player: Player): GameLogEntry[] {
  const out: GameLogEntry[] = [];
  for (const g of sortGames(games)) {
    const scoring: GameLogEntry['scoring'] = [];
    for (const play of g.scoring) {
      if (play.team !== 'WH') continue;
      if (refMatchesPlayer(play.player, player)) scoring.push({ play, role: 'scorer' });
      else if (refMatchesPlayer(play.passer, player)) scoring.push({ play, role: 'passer' });
    }
    const takeaways = g.takeaways.filter((t) => t.team === 'WH' && refMatchesPlayer(t.player, player));
    let stats: PlayerCategoryStats[] | null = null;
    if (g.playerStats) {
      const found = playerSeasonStats(roster, { asOf: null, gamesPlayed: 1, categories: g.playerStats.categories }, player);
      if (found.length) stats = found;
    }
    if (scoring.length || takeaways.length || stats) {
      out.push({ gameId: g.id, date: g.date, opponent: g.opponent.name, scoring, takeaways, stats });
    }
  }
  return out;
}

/** Top n rows of a category column, descending. Ties keep source order. Null values are excluded. */
export function leaders(stats: SeasonStats, categoryKey: string, columnKey: string, n: number): { number: string; nameAbbrev: string; value: number }[] {
  const cat = stats.categories.find((c) => c.key === categoryKey);
  if (!cat) return [];
  return cat.rows
    .flatMap((r) => {
      const v = r.stats[columnKey];
      return typeof v === 'number' ? [{ number: r.number, nameAbbrev: r.nameAbbrev, value: v }] : [];
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

export function seniors(roster: Roster): Player[] {
  return roster.players.filter((p) => p.grade === 12);
}

/** Numeric query: exact jersey match (may return several). Text query: case-insensitive name match. */
export function findPlayers(roster: Roster, query: string): Player[] {
  const q = query.trim();
  if (!q) return [];
  if (/^\d+$/.test(q)) return roster.players.filter((p) => p.number === q);
  const nq = norm(q);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return roster.players.filter((p) => {
    const full = `${p.firstName} ${p.lastName}`.toLowerCase();
    return norm(`${p.firstName}${p.lastName}`).includes(nq) || terms.every((t) => full.includes(t));
  });
}

/** Sort by date ascending; scheduled / null-date games last (stable). */
export function sortGames(games: Game[]): Game[] {
  const rank = (g: Game) => (g.status === 'scheduled' || g.date === null ? 1 : 0);
  return [...games].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.date && b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    return 0;
  });
}

export const SCORING_POINTS: Record<ScoringPlay['type'], number> = {
  rushTD: 6, passTD: 6, intReturnTD: 6, fumbleReturnTD: 6, puntReturnTD: 6, kickReturnTD: 6, otherTD: 6,
  fieldGoal: 3, safety: 2, patKick: 1, twoPtRush: 2, twoPtPass: 2,
  patKickMissed: 0, twoPtFailed: 0,
};

/** Points per team from scoring plays. */
export function scoringSum(scoring: ScoringPlay[]): { wh: number; opp: number } {
  const sum = { wh: 0, opp: 0 };
  for (const p of scoring) sum[p.team === 'WH' ? 'wh' : 'opp'] += SCORING_POINTS[p.type];
  return sum;
}

const TD_TYPES = new Set<ScoringPlay['type']>(['rushTD', 'passTD', 'intReturnTD', 'fumbleReturnTD', 'puntReturnTD', 'kickReturnTD', 'otherTD']);

/** WH touchdowns per player (scorer) across games, keyed by roster careerId; plays whose scorer is not on the roster are returned separately. */
export function scoringTouchdowns(roster: Roster, games: Game[]): { byCareerId: Map<string, number>; unmatched: { gameId: string; play: ScoringPlay }[] } {
  const byCareerId = new Map<string, number>();
  const unmatched: { gameId: string; play: ScoringPlay }[] = [];
  for (const g of games) {
    for (const play of g.scoring) {
      if (play.team !== 'WH' || !TD_TYPES.has(play.type) || !play.player) continue;
      const p = roster.players.find((pl) => refMatchesPlayer(play.player, pl));
      if (p) byCareerId.set(p.careerId, (byCareerId.get(p.careerId) ?? 0) + 1);
      else unmatched.push({ gameId: g.id, play });
    }
  }
  return { byCareerId, unmatched };
}
