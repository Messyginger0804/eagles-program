// Data checks. Usage: node scripts/check-stats.ts [--db <path>] [--data <jsonDir>]
// Reads db/eagles.db by default; --data checks a JSON dir (fixtures) instead.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { z } from 'zod';
import {
  GameSchema, OpponentSchema, RosterSchema, SeasonStatsSchema, TeamSchema, formatIssues,
  type Game,
} from '../src/lib/schema.ts';
import { currentSeason, openReadOnly, readGames, readOpponents, readRoster, readSeasonStats, readTeam } from '../src/lib/db.ts';
import { DB_PATH } from './db-import.ts';
import { joinSeasonStats, scoringSum, scoringTouchdowns } from '../src/lib/season.ts';

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
const dataArg = arg('--data');
const dir = dataArg ? resolve(dataArg) : resolve(arg('--db') ?? DB_PATH);

const errors: string[] = [];
const warnings: string[] = [];

function load<S extends z.ZodType>(schema: S, rel: string): z.infer<S> | null {
  const file = join(dir, rel);
  if (!existsSync(file)) {
    errors.push(`${rel}: file missing`);
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`${rel}: invalid JSON (${(e as Error).message})`);
    return null;
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    errors.push(`${rel}: schema failure\n${formatIssues(r.error)}`);
    return null;
  }
  return r.data;
}

function loadDir<S extends z.ZodType>(schema: S, sub: string): z.infer<S>[] {
  const d = join(dir, sub);
  if (!existsSync(d)) {
    errors.push(`${sub}/: directory missing`);
    return [];
  }
  return readdirSync(d)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      const v = load(schema, `${sub}/${f}`);
      return v ? [v] : [];
    });
}

function fromDb() {
  try {
    const db = openReadOnly(dir);
    try {
      const season = currentSeason(db);
      return { team: readTeam(db, season), roster: readRoster(db, season), stats: readSeasonStats(db, season), games: readGames(db, season), opponents: readOpponents(db, season) };
    } finally { db.close(); }
  } catch (e) {
    errors.push(`db ${dir}: ${(e as Error).message}`);
    return { team: null, roster: null, stats: null, games: [] as Game[], opponents: [] };
  }
}
const loaded = dataArg
  ? { team: load(TeamSchema, 'team.json'), roster: load(RosterSchema, 'roster.json'), stats: load(SeasonStatsSchema, 'season-stats.json'),
      games: loadDir(GameSchema, 'games') as Game[], opponents: loadDir(OpponentSchema, 'opponents') }
  : fromDb();
const { team, roster, stats, games, opponents } = loaded;

if (team?.nextGameId && !games.some((g) => g.id === team.nextGameId)) {
  errors.push(`team.json: nextGameId "${team.nextGameId}" matches no game`);
}

// Finals: scoring sum must equal score (error if scoringStatus complete, warning if partial).
for (const g of games) {
  if (g.status !== 'final' || !g.score) continue;
  const sum = scoringSum(g.scoring);
  const mismatch = sum.wh !== g.score.wh || sum.opp !== g.score.opp;
  const msg = `games/${g.id}: scoring sums to WH ${sum.wh} - OPP ${sum.opp}, score is WH ${g.score.wh} - OPP ${g.score.opp}`;
  if (g.scoringStatus === 'complete' && mismatch) errors.push(msg);
  else if (g.scoringStatus === 'partial') warnings.push(`${msg} (scoringStatus partial)`);
  else if (g.scoringStatus === 'none' && g.scoring.length > 0) errors.push(`games/${g.id}: scoringStatus none but ${g.scoring.length} scoring plays present`);
}
const noQuarters = games.filter((g) => g.status === 'final' && g.quarters === null);
if (noQuarters.length) warnings.push(`${noQuarters.length} final game(s) with null quarters: ${noQuarters.map((g) => g.id).join(', ')}`);

if (roster) {
  // Duplicate jersey numbers.
  const byNumber = new Map<string, string[]>();
  for (const p of roster.players) byNumber.set(p.number, [...(byNumber.get(p.number) ?? []), `${p.firstName} ${p.lastName}`]);
  for (const [n, names] of byNumber) if (names.length > 1) warnings.push(`duplicate jersey #${n}: ${names.join(', ')}`);

  // WH scoring/takeaway players must be on the roster.
  const { byCareerId, unmatched } = scoringTouchdowns(roster, games);
  for (const { gameId, play } of unmatched) {
    errors.push(`games/${gameId}: WH scorer #${play.player!.number} ${play.player!.name} (${play.type}) is not on the roster`);
  }
  for (const g of games) {
    for (const play of g.scoring) {
      if (play.team !== 'WH') continue;
      for (const [role, ref] of [['kicker/scorer', play.player], ['passer', play.passer]] as const) {
        if (!ref) continue;
        const onRoster = roster.players.some((p) => p.number === ref.number && p.lastName && ref.name.toLowerCase().endsWith(p.lastName.toLowerCase()));
        if (!onRoster && !unmatched.some((u) => u.play === play && role === 'kicker/scorer')) {
          errors.push(`games/${g.id}: WH ${role} #${ref.number} ${ref.name} is not on the roster`);
        }
      }
    }
    for (const t of g.takeaways) {
      if (t.team !== 'WH' || !t.player) continue;
      const ref = t.player;
      const onRoster = roster.players.some((p) => p.number === ref.number && ref.name.toLowerCase().endsWith(p.lastName.toLowerCase()));
      if (!onRoster) errors.push(`games/${g.id}: WH takeaway player #${ref.number} ${ref.name} is not on the roster`);
    }
  }

  if (stats) {
    const { matched, unmatched: bad } = joinSeasonStats(roster, stats);
    for (const u of bad) {
      errors.push(
        u.reason === 'none'
          ? `season-stats: row #${u.row.number} "${u.row.nameAbbrev}" matches no roster player`
          : `season-stats: row #${u.row.number} "${u.row.nameAbbrev}" matches more than one roster player (${u.candidates.map((c) => `${c.firstName} ${c.lastName}`).join(', ')})`,
      );
    }

    // TD counts: scoring plays vs. touchdowns category.
    const tdCat = stats.categories.find((c) => c.key === 'touchdowns');
    if (tdCat) {
      const tdFromStats = new Map<string, number>();
      for (const m of matched) {
        if (!tdCat.rows.includes(m.row)) continue;
        const total = m.row.stats['total'] ?? Object.entries(m.row.stats).filter(([k]) => k.startsWith('td') && k !== 'tdG').reduce((a, [, v]) => a + (v ?? 0), 0);
        tdFromStats.set(m.player.careerId, total);
      }
      for (const p of roster.players) {
        const fromPlays = byCareerId.get(p.careerId) ?? 0;
        const fromStats = tdFromStats.get(p.careerId) ?? 0;
        if (fromPlays !== fromStats) {
          const gp = matched.find((m) => m.player.careerId === p.careerId && m.row.stats['gp'] != null)?.row.stats['gp'];
          warnings.push(`TD mismatch #${p.number} ${p.firstName} ${p.lastName}: scoring plays ${fromPlays} vs touchdowns category ${fromStats} (gp ${gp ?? 'n/a'} of ${stats.gamesPlayed} season games; MaxPreps may lag)`);
        }
      }
    }

    // Players with no stats at all.
    const withStats = new Set(matched.map((m) => m.player.careerId));
    const none = roster.players.filter((p) => !withStats.has(p.careerId));
    if (none.length) warnings.push(`${none.length} player(s) with no season stats: ${none.map((p) => `#${p.number} ${p.lastName}`).join(', ')}`);
  }
}

console.log(`check-stats: ${dir}`);
console.log(`  team: ${team ? 'ok' : 'FAILED'}, roster: ${roster?.players.length ?? 'FAILED'} players, season-stats: ${stats ? `${stats.categories.length} categories` : 'FAILED'}, games: ${games.length}, opponents: ${opponents.length}`);
for (const w of warnings) console.log(`WARNING ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
