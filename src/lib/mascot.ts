import type { Game } from './schema.ts';

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/**
 * True when the upcoming game is a mirror matchup: the opponent's mascot equals ours
 * (case-insensitive, trimmed) and the game is not final. Missing/blank mascots never match.
 */
export function isMascotMirror(game: Pick<Game, 'status' | 'opponent'> | undefined, teamMascot: string | null | undefined): boolean {
  if (!game || game.status === 'final') return false;
  const ours = norm(teamMascot);
  return ours !== '' && ours === norm(game.opponent.mascot);
}
