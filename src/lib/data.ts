// Astro data loader on top of the committed SQLite DB (db/eagles.db). Read-only; validated with zod.
// Same exported API as the old JSON glob loader. Season comes from meta.current_season.
import type { DatabaseSync } from 'node:sqlite';
import type { Game, Opponent, ScheduleEvent, Player, Roster, SeasonStats, Team } from './schema.ts';
import { openReadOnly, readGames, readOpponents, readRoster, readScheduleEvents, readSeasonStats, readTeam } from './db.ts';
import { sortGames } from './season.ts';

let _db: DatabaseSync | undefined;
const db = () => (_db ??= openReadOnly());

const cache: { team?: Team; roster?: Roster; stats?: SeasonStats; games?: Game[]; events?: ScheduleEvent[]; opponents?: Opponent[] } = {};

export function getTeam(): Team {
  return (cache.team ??= readTeam(db()));
}
export function getRoster(): Roster {
  return (cache.roster ??= readRoster(db()));
}
export function getSeasonStats(): SeasonStats {
  return (cache.stats ??= readSeasonStats(db()));
}
/** All games, sorted by date with scheduled/null-date games last. */
export function getGames(): Game[] {
  if (!cache.games) {
    const games = readGames(db());
    if (games.length === 0) throw new Error('Missing data: no games in db/eagles.db for the current season');
    cache.games = sortGames(games);
  }
  return cache.games;
}
/** Scrimmages and bye weeks (not games: excluded from records and stats). */
export function getScheduleEvents(): ScheduleEvent[] {
  return (cache.events ??= readScheduleEvents(db()));
}
export function getGame(id: string): Game | undefined {
  return getGames().find((g) => g.id === id);
}
/** The game named by team.nextGameId, else the first scheduled game. */
export function getNextGame(): Game | undefined {
  const id = getTeam().nextGameId;
  const games = getGames();
  return (id ? games.find((g) => g.id === id) : undefined) ?? games.find((g) => g.status === 'scheduled');
}
function getOpponents(): Opponent[] {
  return (cache.opponents ??= readOpponents(db()));
}
export function getOpponent(slug: string): Opponent | undefined {
  return getOpponents().find((o) => o.slug === slug);
}
export function getPlayer(slug: string): Player | undefined {
  return getRoster().players.find((p) => p.slug === slug);
}
