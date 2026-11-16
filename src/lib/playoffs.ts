// Pure helper: where the team stands in the playoff bracket. No file I/O.
import type { Game } from './schema.ts';

export interface PlayoffRoundInfo {
  name: string;
  weekLabel: string;
  site: string | null;
}

export interface PlayoffOutlook {
  /** A playoff game ended in a loss (or a tie, which is treated as the end of the run). */
  eliminated: boolean;
  /** Won the final round. */
  champion: boolean;
  /** Rounds after the last real playoff game, empty once eliminated or champion. */
  placeholders: PlayoffRoundInfo[];
  /** Unplayed scheduled playoff games plus placeholders. 0 once eliminated or champion. */
  gamesLeft: number;
}

/** Other names the same round goes by. Keys and values are normalized (see normRound). */
const ROUND_ALIASES: Record<string, string> = {
  'state final': 'state championship',
  'state finals': 'state championship',
  championship: 'state championship',
  bidistrict: 'bi district',
};

/**
 * Normalize a round name for matching: lowercase, any whitespace (including NBSP) to one space, drop
 * parentheticals ("Regional Final (State Quarterfinal)" -> "regional final"), "-" like a space, drop a
 * trailing "round", then apply the alias list.
 */
export function normRound(s: string | null): string {
  const n = (s ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[-\s\u00a0]+/g, ' ')
    .trim()
    .replace(/ round$/, '')
    .trim();
  return ROUND_ALIASES[n] ?? n;
}

export function playoffOutlook(games: Game[], rounds: PlayoffRoundInfo[]): PlayoffOutlook {
  const po = games.filter((g) => g.playoff);
  const none = { eliminated: false, champion: false, placeholders: [], gamesLeft: 0 };
  if (po.length === 0 || rounds.length === 0) return { ...none };
  const names = rounds.map((r) => normRound(r.name));
  const idxOf = (g: Game) => (g.round == null ? -1 : names.indexOf(normRound(g.round)));
  const finals = po.filter((g) => g.status === 'final');
  const lastIdx = rounds.length - 1;
  // Latest playoff game by date (no date = still to be scheduled, so last); ties keep list order.
  const latest = po.map((g, i) => ({ g, i })).sort((a, b) => (a.g.date ?? '9999').localeCompare(b.g.date ?? '9999') || a.i - b.i).pop()!.g;
  // A final with result null (forfeit, unreported) is unknown: it consumes its round but is neither
  // eliminated nor champion. check-stats warns about it.
  const champion =
    finals.some((g) => g.result === 'W' && idxOf(g) === lastIdx) ||
    (po.length >= rounds.length && latest.status === 'final' && latest.result === 'W');
  const eliminated = !champion && finals.some((g) => g.result === 'L' || g.result === 'T');
  if (champion || eliminated) return { ...none, eliminated, champion };
  // One game per round: rounds accounted for are the furthest matched round or the number of playoff
  // games, whichever is larger. A name we don't know (or no name) therefore never adds a placeholder.
  const accounted = Math.min(rounds.length, Math.max(Math.max(...po.map(idxOf)) + 1, po.length));
  const placeholders = rounds.slice(accounted);
  const scheduled = po.filter((g) => g.status === 'scheduled').length;
  const gamesLeft = Math.min(scheduled + placeholders.length, rounds.length - finals.length);
  return { eliminated: false, champion: false, placeholders, gamesLeft };
}

/** "5 games to a state title" / "1 game to a state title". */
export function gamesLeftLine(n: number): string {
  return n === 1 ? '1 game to a state title' : `${n} games to a state title`;
}
