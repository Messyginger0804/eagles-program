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

const key = (s: string | null) => (s ?? '').trim().toLowerCase();

export function playoffOutlook(games: Game[], rounds: PlayoffRoundInfo[]): PlayoffOutlook {
  const po = games.filter((g) => g.playoff);
  const done = { eliminated: false, champion: false, placeholders: [], gamesLeft: 0 };
  if (po.length === 0 || rounds.length === 0) return { ...done };
  const finals = po.filter((g) => g.status === 'final');
  const finalName = key(rounds[rounds.length - 1]!.name);
  const champion = finals.some((g) => g.result === 'W' && key(g.round) === finalName);
  const eliminated = !champion && finals.some((g) => g.result === 'L' || g.result === 'T');
  if (champion || eliminated) return { ...done, eliminated, champion };
  // Last round with a real game. A round name we don't know falls back to the game's order (one game per round).
  let last = -1;
  po.forEach((g, i) => {
    const idx = rounds.findIndex((r) => key(r.name) === key(g.round));
    last = Math.max(last, idx >= 0 ? idx : Math.min(i, rounds.length - 1));
  });
  const placeholders = rounds.slice(last + 1);
  const scheduled = po.filter((g) => g.status === 'scheduled').length;
  return { eliminated: false, champion: false, placeholders, gamesLeft: scheduled + placeholders.length };
}

/** "Up to 5 more games to a state title" / "1 more game to a state title". */
export function gamesLeftLine(n: number): string {
  return n === 1 ? '1 more game to a state title' : `Up to ${n} more games to a state title`;
}
