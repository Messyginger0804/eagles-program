// SQLite loader. Rebuilds the spec-format objects from db/eagles.db and validates them with zod.
// Used by the site (read-only), by db-export, and by the importer to detect unchanged rows.
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import {
  GameSchema, OpponentSchema, ScheduleEventsSchema, RosterSchema, SeasonStatsSchema, TeamSchema,
  type Game, type Opponent, type ScheduleEvent, type Roster, type SeasonStats, type StatCategory, type Team,
} from './schema.ts';

type Row = Record<string, any>;

/** Default DB location (repo-root relative; override with EAGLES_DB). */
export function defaultDbPath(): string {
  return process.env['EAGLES_DB'] ?? resolve(process.cwd(), 'db/eagles.db');
}

export function openReadOnly(path: string = defaultDbPath()): DatabaseSync {
  return new DatabaseSync(path, { readOnly: true });
}

const all = (db: DatabaseSync, sql: string, ...p: any[]): Row[] => db.prepare(sql).all(...p) as Row[];
const get = (db: DatabaseSync, sql: string, ...p: any[]): Row | undefined => db.prepare(sql).get(...p) as Row | undefined;

export function getMeta(db: DatabaseSync, key: string): string | null {
  const r = get(db, 'SELECT value FROM meta WHERE key = ?', key);
  return r ? (r['value'] as string | null) : null;
}

export function currentSeason(db: DatabaseSync): number {
  const v = getMeta(db, 'current_season');
  if (!v) throw new Error('db: meta.current_season is not set');
  return Number(v);
}

export function homeSlug(db: DatabaseSync): string {
  const v = getMeta(db, 'school');
  if (!v) throw new Error('db: meta.school is not set');
  return v;
}

const rec = (w: unknown, l: unknown, t: unknown) => ({ w, l, t });
const ref = (n: unknown, name: unknown) => (n == null ? null : { number: n, name });
const bool = (v: unknown) => v === 1 || v === 1n;

function coachesOf(db: DatabaseSync, schoolId: number, season: number) {
  return all(db, 'SELECT name, role FROM coaches WHERE school_id = ? AND season = ? ORDER BY seq', schoolId, season)
    .map((c) => ({ name: c['name'], role: c['role'] }));
}

function categories(db: DatabaseSync, where: string, ...p: any[]): StatCategory[] {
  return all(db, `SELECT id, key, label FROM stat_categories WHERE ${where} ORDER BY seq`, ...p).map((c) => {
    const columns = all(db, 'SELECT key, label FROM stat_columns WHERE category_id = ? ORDER BY seq', c['id'])
      .map((x) => ({ key: x['key'], label: x['label'] }));
    const rows = all(db, 'SELECT seq, number, name_abbrev FROM stat_rows WHERE category_id = ? ORDER BY seq', c['id']).map((r) => {
      const stats: Record<string, number | null> = {};
      for (const v of all(db,
        'SELECT column_key AS k, value FROM stat_values WHERE category_id = ? AND row_seq = ? ORDER BY seq', c['id'], r['seq'])) stats[v['k']] = v['value'];
      return { number: r['number'], nameAbbrev: r['name_abbrev'], stats };
    });
    return { key: c['key'], label: c['label'], columns, rows };
  });
}

export function readTeam(db: DatabaseSync, season = currentSeason(db)): Team {
  const s = get(db, 'SELECT * FROM schools WHERE slug = ?', homeSlug(db));
  const t = s && get(db, 'SELECT * FROM team_seasons WHERE school_id = ? AND season = ?', s['id'], season);
  if (!s || !t) throw new Error(`db: no team_seasons row for home school in season ${season}`);
  return TeamSchema.parse({
    school: s['name'], mascot: s['mascot'], city: s['city'], state: s['state'], season,
    classification: t['classification'], district: t['district'],
    colors: { primary: s['color_primary'], secondary: s['color_secondary'], accent: s['color_accent'] },
    record: {
      overall: rec(t['overall_w'], t['overall_l'], t['overall_t']),
      district: rec(t['district_w'], t['district_l'], t['district_t']),
    },
    coaches: coachesOf(db, s['id'], season),
    maxprepsUrl: s['maxpreps_url'],
    nextGameId: getMeta(db, 'next_game_id'),
  });
}

function playerRows(db: DatabaseSync, schoolId: number, season: number): Row[] {
  return all(db, 'SELECT * FROM players WHERE school_id = ? AND season = ? ORDER BY seq', schoolId, season);
}

export function readRoster(db: DatabaseSync, season = currentSeason(db)): Roster {
  const s = get(db, 'SELECT id FROM schools WHERE slug = ?', homeSlug(db));
  if (!s) throw new Error('db: home school missing');
  const asOf = getMeta(db, 'roster_as_of');
  const players = playerRows(db, s['id'], season).map((p) => ({
    careerId: p['career_id'], athleteId: p['athlete_id'], number: p['number'],
    firstName: p['first_name'], lastName: p['last_name'], slug: p['slug'],
    positions: JSON.parse(p['positions']), grade: p['grade'], height: p['height'], weight: p['weight'],
    maxprepsUrl: p['maxpreps_url'],
    highlights: all(db, 'SELECT label, url FROM highlights WHERE player_id = ? ORDER BY seq', p['id'])
      .map((h) => ({ label: h['label'], url: h['url'] })),
  }));
  return RosterSchema.parse({ asOf, players });
}

export function readSeasonStats(db: DatabaseSync, season = currentSeason(db)): SeasonStats {
  const s = get(db, 'SELECT id FROM schools WHERE slug = ?', homeSlug(db));
  const t = s && get(db, 'SELECT stats_as_of, games_played FROM team_seasons WHERE school_id = ? AND season = ?', s['id'], season);
  if (!s || !t) throw new Error(`db: no season stats for season ${season}`);
  return SeasonStatsSchema.parse({
    asOf: t['stats_as_of'], gamesPlayed: t['games_played'],
    categories: categories(db, 'game_id IS NULL AND school_id = ? AND season = ?', s['id'], season),
  });
}

function venueOf(db: DatabaseSync, id: string) {
  const v = get(db, 'SELECT name, address FROM game_venues WHERE game_id = ?', id);
  return v ? { name: v['name'], address: v['address'] } : null;
}

function buildGame(db: DatabaseSync, g: Row): Game {
  const o = get(db, 'SELECT * FROM schools WHERE id = ?', g['opponent_school_id'])!;
  const cats = categories(db, 'game_id = ?', g['id']);
  const recordAfter = g['record_after_w'] == null ? null
    : { w: g['record_after_w'], l: g['record_after_l'], ...(g['record_after_t'] == null ? {} : { t: g['record_after_t'] }) };
  return GameSchema.parse({
    id: g['id'], status: g['status'], date: g['date'], kickoffTime: g['kickoff_time'] ?? null, playoff: bool(g['playoff']), round: g['round'],
    venue: venueOf(db, g['id']),
    labels: all(db, 'SELECT label FROM game_labels WHERE game_id = ? ORDER BY label', g['id']).map((l) => l['label']),
    location: g['location'], districtGame: bool(g['district_game']),
    opponent: { name: o['name'], mascot: o['mascot'], city: o['city'], maxprepsTeamUrl: g['opponent_maxpreps_url'] },
    contestId: g['contest_id'], maxprepsUrl: g['maxpreps_url'],
    score: g['score_wh'] == null ? null : { wh: g['score_wh'], opp: g['score_opp'] },
    result: g['result'],
    quarters: g['quarters'] == null ? null : JSON.parse(g['quarters']),
    recordAfter,
    scoringStatus: g['scoring_status'],
    scoring: all(db, 'SELECT * FROM scoring_plays WHERE game_id = ? ORDER BY seq', g['id']).map((p) => ({
      quarter: p['quarter'], time: p['time'], team: p['team'], type: p['type'],
      player: ref(p['player_number'], p['player_name']), passer: ref(p['passer_number'], p['passer_name']),
      yards: p['yards'],
      scoreAfter: p['score_after_wh'] == null ? null : { wh: p['score_after_wh'], opp: p['score_after_opp'] },
    })),
    takeaways: all(db, 'SELECT * FROM takeaways WHERE game_id = ? ORDER BY seq', g['id']).map((t) => ({
      quarter: t['quarter'], team: t['team'], type: t['type'], player: ref(t['player_number'], t['player_name']),
    })),
    playerStats: cats.length ? { categories: cats } : null,
    links: {
      replay: g['replay_url'], recap: g['recap_url'],
      highlights: all(db, 'SELECT label, url FROM highlights WHERE game_id = ? ORDER BY seq', g['id'])
        .map((h) => ({ label: h['label'], url: h['url'] })),
    },
  });
}

/** Games for a season in id order (same order as the old games/*.json glob). */
export function readGames(db: DatabaseSync, season = currentSeason(db)): Game[] {
  const s = get(db, 'SELECT id FROM schools WHERE slug = ?', homeSlug(db));
  if (!s) throw new Error('db: home school missing');
  return all(db, 'SELECT * FROM games WHERE school_id = ? AND season = ? ORDER BY id', s['id'], season).map((g) => buildGame(db, g));
}

/** One game by id, or undefined. */
export function readGame(db: DatabaseSync, id: string): Game | undefined {
  const g = get(db, 'SELECT * FROM games WHERE id = ?', id);
  return g ? buildGame(db, g) : undefined;
}

/** Preseason scrimmages and bye weeks for a season, by date. Empty if the table is absent (older DBs). */
export function readScheduleEvents(db: DatabaseSync, season = currentSeason(db)): ScheduleEvent[] {
  if (!get(db, "SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'schedule_events'")) return [];
  return ScheduleEventsSchema.parse(all(db, 'SELECT * FROM schedule_events WHERE season = ? ORDER BY date', season).map((r) => ({
    date: r['date'], kind: r['kind'], opponentName: r['opponent_name'], location: r['location'], note: r['note'],
  })));
}

/** An opponent's season stats (same stat tables as ours, keyed by school and season), or null if none are stored. */
function opponentStats(db: DatabaseSync, schoolId: number, season: number, t: Row): SeasonStats | null {
  const categories_ = categories(db, 'game_id IS NULL AND school_id = ? AND season = ?', schoolId, season);
  if (!categories_.length) return null;
  return SeasonStatsSchema.parse({ asOf: t['stats_as_of'], gamesPlayed: t['games_played'] ?? 0, categories: categories_ });
}

function buildOpponent(db: DatabaseSync, s: Row, season: number): Opponent {
  const t = get(db, 'SELECT * FROM team_seasons WHERE school_id = ? AND season = ?', s['id'], season)!;
  return OpponentSchema.parse({
    slug: s['slug'], name: s['name'], mascot: s['mascot'], city: s['city'], state: s['state'],
    classification: t['classification'], maxprepsUrl: s['maxpreps_url'],
    colors: { primary: s['color_primary'], secondary: s['color_secondary'] },
    record: {
      overall: rec(t['overall_w'], t['overall_l'], t['overall_t']),
      district: t['district_w'] == null ? null : rec(t['district_w'], t['district_l'], t['district_t']),
    },
    coaches: coachesOf(db, s['id'], season),
    roster: playerRows(db, s['id'], season).map((p) => ({
      number: p['number'], firstName: p['first_name'], lastName: p['last_name'],
      positions: JSON.parse(p['positions']), grade: p['grade'], height: p['height'], weight: p['weight'],
    })),
    seasonStats: opponentStats(db, s['id'], season, t),
    results: all(db, 'SELECT * FROM opponent_results WHERE school_id = ? AND season = ? ORDER BY seq', s['id'], season).map((r) => ({
      date: r['date'], opponent: r['opponent'], location: r['location'],
      score: r['score_us'] == null ? null : { us: r['score_us'], them: r['score_them'] },
      result: r['result'],
    })),
  });
}

/** Opponent scouting pages (schools other than home that have a team_seasons row for the season). */
export function readOpponents(db: DatabaseSync, season = currentSeason(db)): Opponent[] {
  return all(db,
    `SELECT s.* FROM schools s JOIN team_seasons t ON t.school_id = s.id AND t.season = ?
     WHERE s.slug != ? ORDER BY s.slug`, season, homeSlug(db)).map((s) => buildOpponent(db, s, season));
}

export function readOpponent(db: DatabaseSync, slug: string, season = currentSeason(db)): Opponent | undefined {
  const s = get(db, 'SELECT * FROM schools WHERE slug = ?', slug);
  if (!s || slug === homeSlug(db) || !get(db, 'SELECT 1 AS x FROM team_seasons WHERE school_id = ? AND season = ?', s['id'], season)) return undefined;
  return buildOpponent(db, s, season);
}

/** Order-insensitive JSON for comparing objects. */
export function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : x);
}
