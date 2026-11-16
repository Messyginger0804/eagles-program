// Display helpers. Pure functions; no data access except where noted.
import type { Game, Player, Roster, ScoringPlay, SeasonStats } from './schema.ts';
import { PLAYER_NICKNAMES } from '../config.ts';
import { playerSeasonStats, matchRow, type PlayerCategoryStats } from './season.ts';

export const WH_NAME = 'Wilmer-Hutchins';
export const GRADE_LABELS: Record<number, string> = { 9: 'Fr', 10: 'So', 11: 'Jr', 12: 'Sr' };
export const gradeLabel = (g: number | null) => (g == null ? '—' : (GRADE_LABELS[g] ?? String(g)));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11-13" -> "Nov 13" (no timezone math). Null -> "TBA". */
export function shortDate(d: string | null): string {
  if (!d) return 'TBA';
  const [, m, day] = d.split('-').map(Number);
  return `${MONTHS[m! - 1]} ${day}`;
}
export function longDate(d: string | null): string {
  if (!d) return 'Date TBA';
  return `${shortDate(d)}, ${d.slice(0, 4)}`;
}

export function recordStr(r: { w: number; l: number; t?: number }): string {
  return `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;
}

export const STATS_CAVEAT = (n: number) =>
  `Stats as entered on MaxPreps through ${n} games — may be incomplete.`;

/** Numeric jersey sort, then name. Works for player and opponent roster entries. */
export function byNumber<T extends { number: string; lastName: string; firstName: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0) ||
      a.number.localeCompare(b.number) ||
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName),
  );
}

const OFF = new Set(['QB', 'RB', 'HB', 'FB', 'WR', 'TE', 'OL', 'C', 'G', 'T', 'OT', 'OG', 'ATH']);
const DEF = new Set(['DL', 'DE', 'DT', 'NG', 'LB', 'OLB', 'MLB', 'ILB', 'DB', 'CB', 'S', 'FS', 'SS', 'ATH']);
const ST = new Set(['K', 'P', 'LS', 'KR', 'PR']);
/** Position groups a player belongs to. ATH counts as offense and defense. */
export function positionGroups(positions: string[]): ('offense' | 'defense' | 'special')[] {
  const out = new Set<'offense' | 'defense' | 'special'>();
  for (const p of positions.map((x) => x.toUpperCase())) {
    if (OFF.has(p)) out.add('offense');
    if (DEF.has(p)) out.add('defense');
    if (ST.has(p)) out.add('special');
  }
  return [...out];
}

/** Opponent slug from a game id like "2026-11-13-eastern-hills" or "2026-tbd-lindale". */
export function opponentSlug(game: Game): string {
  return game.id.replace(/^\d{4}-(\d{2}-\d{2}|tbd)-/, '');
}

const PLAY_LABEL: Record<ScoringPlay['type'], string> = {
  rushTD: 'rushing TD', passTD: 'passing TD', intReturnTD: 'interception return TD',
  fumbleReturnTD: 'fumble return TD', puntReturnTD: 'punt return TD', kickReturnTD: 'kick return TD',
  otherTD: 'TD', fieldGoal: 'field goal', safety: 'safety', patKick: 'PAT kick',
  patKickMissed: 'missed PAT kick', twoPtRush: '2-pt rush', twoPtPass: '2-pt pass', twoPtFailed: 'failed 2-pt try',
};
export function playDesc(p: ScoringPlay, role: 'scorer' | 'passer' = 'scorer'): string {
  const yd = p.yards != null ? `${p.yards}-yd ` : '';
  if (p.type === 'passTD') return role === 'passer' ? `${yd}TD pass` : `${yd}receiving TD`;
  return `${yd}${PLAY_LABEL[p.type]}`;
}

export const takeawayLabel = (t: 'interception' | 'fumbleRecovery') =>
  t === 'interception' ? 'Interception' : 'Fumble recovery';

export interface GameBadge { key: string; label: string; kind: 'playoff' | 'district' | 'special' }

/** Ordered badges for a game: playoff round (or "Playoff"), District, Senior Night, Homecoming, Feeder Night. */
export function gameBadges(g: Pick<Game, 'playoff' | 'round' | 'districtGame'> & { labels?: Game['labels'] }): GameBadge[] {
  const out: GameBadge[] = [];
  if (g.playoff) out.push({ key: 'playoff', label: g.round?.trim() || 'Playoff', kind: 'playoff' });
  if (g.districtGame) out.push({ key: 'district', label: 'District', kind: 'district' });
  if (g.labels?.includes('seniorNight')) out.push({ key: 'seniorNight', label: 'Senior Night', kind: 'special' });
  if (g.labels?.includes('homecoming')) out.push({ key: 'homecoming', label: 'Homecoming', kind: 'special' });
  if (g.labels?.includes('feederNight')) out.push({ key: 'feederNight', label: 'Feeder Night', kind: 'special' });
  return out;
}

/** Playoff round name for headers ("Area Round"), "Playoffs" when none is stored, null for non-playoff games. */
export function roundName(g: Pick<Game, 'playoff' | 'round'>): string | null {
  return g.playoff ? (g.round?.trim() || 'Playoffs') : null;
}

/** "at Eastern Hills", "vs. Pinkston", etc. */
export function gameLabel(g: Game): string {
  const prefix = g.location === 'away' ? 'at' : 'vs.';
  return `${prefix} ${g.opponent.name}`;
}
export const locationLabel = (l: Game['location']) =>
  l === 'home' ? 'Home' : l === 'away' ? 'Away' : l === 'neutral' ? 'Neutral site' : 'Site TBA';

/** Venue name when known, else the home/away/neutral label ("Site TBA" if nothing is set). */
export function siteLabel(g: Pick<Game, 'location'> & { venue?: Game['venue'] }): string {
  return g.venue?.name ?? locationLabel(g.location);
}
/** Google Maps search link for a venue ("name, address"). */
export function mapsUrl(v: NonNullable<Game['venue']>): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name}, ${v.address}`)}`;
}

/** Primary sort column per stat category (desc). */
export const PRIMARY_STAT: Record<string, string> = {
  passing: 'yds', rushing: 'yds', receiving: 'yds', allPurpose: 'total', totalYards: 'total',
  tackles: 'totTckls', sacks: 'sacks', defensive: 'int', points: 'totPts',
  patsFieldGoals: 'pat', touchdowns: 'total',
};
export function primaryKey(cat: { key: string; columns: { key: string }[] }): string {
  const k = PRIMARY_STAT[cat.key];
  return k && cat.columns.some((c) => c.key === k) ? k : (cat.columns[0]?.key ?? '');
}

const HIGHLIGHTS: { cat: string; col: string; text: (v: number) => string }[] = [
  { cat: 'touchdowns', col: 'total', text: (v) => `${v} touchdown${v === 1 ? '' : 's'}` },
  { cat: 'rushing', col: 'yds', text: (v) => `${v} rushing yards` },
  { cat: 'receiving', col: 'yds', text: (v) => `${v} receiving yards` },
  { cat: 'passing', col: 'yds', text: (v) => `${v} passing yards` },
  { cat: 'tackles', col: 'totTckls', text: (v) => `${v} total tackles` },
  { cat: 'sacks', col: 'sacks', text: (v) => `${v} sack${v === 1 ? '' : 's'}` },
  { cat: 'defensive', col: 'int', text: (v) => `${v} interception${v === 1 ? '' : 's'}` },
  { cat: 'patsFieldGoals', col: 'pat', text: (v) => `${v} PATs made` },
  { cat: 'points', col: 'totPts', text: (v) => `${v} points` },
];
/** One-line season stat highlight, or null if the player has no non-zero stat. */
export function statHighlight(roster: Roster, stats: SeasonStats, player: Player): string | null {
  const mine = playerSeasonStats(roster, stats, player);
  for (const h of HIGHLIGHTS) {
    const v = mine.find((c) => c.key === h.cat)?.stats[h.col];
    if (typeof v === 'number' && v > 0) return h.text(v);
  }
  return null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const STAT_PHRASES: { cat: string; col: string; text: (v: number) => string }[] = [
  { cat: 'touchdowns', col: 'total', text: (v) => plural(v, 'TD') },
  { cat: 'receiving', col: 'rec', text: (v) => plural(v, 'catch', 'catches') },
  { cat: 'receiving', col: 'yds', text: (v) => `${v} rec yds` },
  { cat: 'tackles', col: 'totTckls', text: (v) => plural(v, 'tackle') },
  { cat: 'tackles', col: 'tfl', text: (v) => `${v} TFL` },
  { cat: 'sacks', col: 'sacks', text: (v) => plural(v, 'sack') },
  { cat: 'defensive', col: 'int', text: (v) => plural(v, 'INT') },
  { cat: 'defensive', col: 'pd', text: (v) => plural(v, 'pass breakup') },
  { cat: 'defensive', col: 'fmbRec', text: (v) => plural(v, 'fumble recovery', 'fumble recoveries') },
  { cat: 'patsFieldGoals', col: 'pat', text: (v) => plural(v, 'PAT') },
  { cat: 'patsFieldGoals', col: 'fg', text: (v) => plural(v, 'FG') },
];
/** One-line game stat summary for a player, e.g. "5 tackles, 1 sack"; empty string if nothing non-zero. */
export function statLine(stats: PlayerCategoryStats[] | null): string {
  if (!stats) return '';
  const parts: string[] = [];
  for (const p of STAT_PHRASES) {
    const v = stats.find((c) => c.key === p.cat)?.stats[p.col];
    if (typeof v === 'number' && v > 0) parts.push(p.text(v));
  }
  return parts.join(', ');
}

export const fmtStat = (v: number | null | undefined) => (v == null ? '—' : String(v));

export function paragraphs(s: string): string[] {
  return s.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
}

/** Roster player for a stat row (same matching rule as joinSeasonStats), or undefined. */
export function playerForStatRow(roster: Roster, row: { number: string; nameAbbrev: string }): Player | undefined {
  const m = matchRow(roster, { stats: {}, ...row } as Parameters<typeof matchRow>[1]);
  return 'player' in m ? m.player : undefined;
}

/** Short site tag for schedule cards: "HOME", "AWAY", "NEUTRAL"; null when unknown. */
export const siteTag = (l: Game['location']) => (l ? l.toUpperCase() : null);

/** "Home 5-0 · Away 4-2", plus "Neutral 0-1" only once a neutral-site game is final. */
export function splitRecordLine(r: { home: { w: number; l: number; t: number }; away: { w: number; l: number; t: number }; neutral: { w: number; l: number; t: number } }): string {
  const parts = [`Home ${recordStr(r.home)}`, `Away ${recordStr(r.away)}`];
  if (r.neutral.w + r.neutral.l + r.neutral.t > 0) parts.push(`Neutral ${recordStr(r.neutral)}`);
  return parts.join(' · ');
}

/** "Jaylen" + "Gaston" -> "J. Gaston". Uses the first letter of the first name; no initial when the first name is empty. */
export function shortName(firstName: string, lastName: string): string {
  const initial = firstName.trim().charAt(0).toUpperCase();
  return initial ? `${initial}. ${lastName}` : lastName;
}

/** First name with the nickname in curly quotes when one is configured: `Darrick “DJ”`. */
export function firstWithNick(p: { firstName: string; careerId?: string }): string {
  const nick = p.careerId ? PLAYER_NICKNAMES[p.careerId] : undefined;
  return nick ? `${p.firstName} \u201C${nick}\u201D` : p.firstName;
}

/** Display name: `Darrick “DJ” Todd` when a nickname is configured, else `First Last`. */
export function fullName(p: { firstName: string; lastName: string; careerId?: string }): string {
  return `${firstWithNick(p)} ${p.lastName}`;
}
