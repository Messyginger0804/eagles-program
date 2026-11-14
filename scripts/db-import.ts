// Import a spec-format JSON dir into the SQLite DB (db/eagles.db), validated with zod, in one transaction.
// Idempotent: parts that already match the DB are not rewritten, so re-importing changes nothing.
// Usage: node scripts/db-import.ts [--data <dir>] [--db <path>]   (npm run db:import -- --data <dir>)
//
// Semantics: team.json, roster.json (full snapshot: players missing from it are removed), season-stats.json,
// games/*.json (upsert by id; games not in the dir are left alone) and opponents/*.json are read from <dir>.
// The imported team.json season becomes meta.current_season.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import {
  GameSchema, OpponentSchema, ScheduleEventsSchema, RosterSchema, SeasonStatsSchema, TeamSchema, formatIssues,
  type Game, type Opponent, type ScheduleEvent, type Roster, type SeasonStats, type StatCategory, type Team,
} from '../src/lib/schema.ts';
import { canonical, getMeta, readScheduleEvents, readGame, readOpponent, readRoster, readSeasonStats, readTeam } from '../src/lib/db.ts';

export const SCHEMA_PATH = fileURLToPath(new URL('../db/schema.sql', import.meta.url));
export const DB_PATH = fileURLToPath(new URL('../db/eagles.db', import.meta.url));

export interface DataSet {
  team: Team;
  roster: Roster | null;
  stats: SeasonStats | null;
  games: Game[];
  opponents: Opponent[];
  /** null = file absent (leave existing events alone). */
  events: ScheduleEvent[] | null;
}

/** Read and validate a JSON dir. Throws one error listing every problem. */
export function readDataDir(dir: string): DataSet {
  const errors: string[] = [];
  const load = <S extends z.ZodType>(schema: S, rel: string, required: boolean): z.infer<S> | null => {
    const file = join(dir, rel);
    if (!existsSync(file)) {
      if (required) errors.push(`${rel}: file missing`);
      return null;
    }
    let raw: unknown;
    try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { errors.push(`${rel}: invalid JSON (${(e as Error).message})`); return null; }
    const r = schema.safeParse(raw);
    if (!r.success) { errors.push(`${rel}: schema failure\n${formatIssues(r.error)}`); return null; }
    return r.data;
  };
  const loadDir = <S extends z.ZodType>(schema: S, sub: string): z.infer<S>[] => {
    const d = join(dir, sub);
    if (!existsSync(d)) return [];
    return readdirSync(d).filter((f) => f.endsWith('.json')).sort()
      .flatMap((f) => { const v = load(schema, `${sub}/${f}`, true); return v ? [v] : []; });
  };
  const team = load(TeamSchema, 'team.json', true);
  const roster = load(RosterSchema, 'roster.json', false);
  const stats = load(SeasonStatsSchema, 'season-stats.json', false);
  const events = load(ScheduleEventsSchema, 'schedule-events.json', false);
  const games = loadDir(GameSchema, 'games');
  const opponents = loadDir(OpponentSchema, 'opponents');
  if (errors.length || !team) throw new Error(`Invalid data in ${dir}:\n${errors.join('\n')}`);
  return { team, roster, stats, games, opponents, events };
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const opponentSlug = (gameId: string) => gameId.replace(/^\d{4}-(\d{2}-\d{2}|tbd)-/, '');
const same = (read: () => unknown, next: unknown): boolean => {
  try { return canonical(read()) === canonical(next); } catch { return false; }
};

/** Open (creating if needed) the DB for writing and apply db/schema.sql. */
export function openWritable(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  // game_labels' CHECK list gained 'feederNight'; SQLite can't alter a CHECK, so rebuild an older table.
  const old = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'game_labels'").get() as { sql: string } | undefined;
  const rebuild = !!old && !old.sql.includes('feederNight');
  if (rebuild) db.exec('ALTER TABLE game_labels RENAME TO game_labels_old');
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  if (rebuild) db.exec('INSERT INTO game_labels SELECT * FROM game_labels_old; DROP TABLE game_labels_old');
  return db;
}

type Counts = Record<string, number>;

export function importDataSet(db: DatabaseSync, data: DataSet): Counts {
  const counts: Counts = { team: 0, roster: 0, stats: 0, games: 0, opponents: 0, events: 0, unchanged: 0 };
  const { team } = data;
  const season = team.season;
  const run = (sql: string, ...p: any[]) => db.prepare(sql).run(...p);
  const one = (sql: string, ...p: any[]) => db.prepare(sql).get(...p) as Record<string, any> | undefined;

  const setMeta = (key: string, value: string | null) => {
    if (getMeta(db, key) === value && one('SELECT 1 AS x FROM meta WHERE key = ?', key)) return;
    run('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
  };

  /** Upsert a school by slug, setting only the given columns. Returns its id. */
  const upsertSchool = (slug: string, f: Record<string, string | null>): number => {
    const cols = Object.keys(f);
    run(
      `INSERT INTO schools(slug, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})
       ON CONFLICT(slug) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}`,
      slug, ...cols.map((c) => f[c]!),
    );
    return one('SELECT id FROM schools WHERE slug = ?', slug)!['id'];
  };

  const writeCoaches = (schoolId: number, coaches: { name: string; role: string }[]) => {
    run('DELETE FROM coaches WHERE school_id = ? AND season = ?', schoolId, season);
    coaches.forEach((c, i) => run('INSERT INTO coaches VALUES (?, ?, ?, ?, ?)', schoolId, season, i, c.name, c.role));
  };

  const writeTeamSeason = (schoolId: number, classification: string | null, district: string | null,
    overall: { w: number; l: number; t: number }, dist: { w: number; l: number; t: number } | null) => {
    run(
      `INSERT INTO team_seasons(school_id, season, classification, district, overall_w, overall_l, overall_t, district_w, district_l, district_t)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(school_id, season) DO UPDATE SET classification = excluded.classification, district = excluded.district,
         overall_w = excluded.overall_w, overall_l = excluded.overall_l, overall_t = excluded.overall_t,
         district_w = excluded.district_w, district_l = excluded.district_l, district_t = excluded.district_t`,
      schoolId, season, classification, district, overall.w, overall.l, overall.t, dist?.w ?? null, dist?.l ?? null, dist?.t ?? null,
    );
  };

  type PlayerIn = {
    number: string; firstName: string; lastName: string; positions: string[]; grade: number | null;
    height: string | null; weight: number | null;
    careerId?: string; athleteId?: string | null; slug?: string; maxprepsUrl?: string; highlights?: { label: string; url: string }[];
  };
  const writePlayers = (schoolId: number, players: PlayerIn[]) => {
    const keep: number[] = [];
    players.forEach((p, i) => {
      run(
        `INSERT INTO players(school_id, season, seq, career_id, athlete_id, number, first_name, last_name, slug, positions, grade, height, weight, maxpreps_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(school_id, season, number, first_name, last_name) DO UPDATE SET seq = excluded.seq, career_id = excluded.career_id,
           athlete_id = excluded.athlete_id, slug = excluded.slug, positions = excluded.positions, grade = excluded.grade,
           height = excluded.height, weight = excluded.weight, maxpreps_url = excluded.maxpreps_url`,
        schoolId, season, i, p.careerId ?? null, p.athleteId ?? null, p.number, p.firstName, p.lastName, p.slug ?? null,
        JSON.stringify(p.positions), p.grade, p.height, p.weight, p.maxprepsUrl ?? null,
      );
      const id = one('SELECT id FROM players WHERE school_id = ? AND season = ? AND number = ? AND first_name = ? AND last_name = ?',
        schoolId, season, p.number, p.firstName, p.lastName)!['id'] as number;
      keep.push(id);
      run('DELETE FROM highlights WHERE player_id = ?', id);
      (p.highlights ?? []).forEach((h, j) => run('INSERT INTO highlights(player_id, seq, label, url) VALUES (?, ?, ?, ?)', id, j, h.label, h.url));
    });
    for (const r of db.prepare('SELECT id FROM players WHERE school_id = ? AND season = ?').all(schoolId, season) as { id: number }[]) {
      if (!keep.includes(r.id)) run('DELETE FROM players WHERE id = ?', r.id); // highlights cascade
    }
  };

  const writeCategories = (owner: { schoolId: number } | { gameId: string }, cats: StatCategory[]) => {
    if ('gameId' in owner) run('DELETE FROM stat_categories WHERE game_id = ?', owner.gameId);
    else run('DELETE FROM stat_categories WHERE game_id IS NULL AND school_id = ? AND season = ?', owner.schoolId, season);
    cats.forEach((c, i) => {
      run('INSERT INTO stat_categories(school_id, season, game_id, seq, key, label) VALUES (?, ?, ?, ?, ?, ?)',
        'gameId' in owner ? null : owner.schoolId, 'gameId' in owner ? null : season, 'gameId' in owner ? owner.gameId : null, i, c.key, c.label);
      const id = one('SELECT last_insert_rowid() AS id')!['id'] as number;
      c.columns.forEach((col, j) => run('INSERT INTO stat_columns VALUES (?, ?, ?, ?)', id, j, col.key, col.label));
      c.rows.forEach((r, j) => {
        run('INSERT INTO stat_rows VALUES (?, ?, ?, ?)', id, j, r.number, r.nameAbbrev);
        Object.entries(r.stats).forEach(([k, v], n) => run('INSERT INTO stat_values VALUES (?, ?, ?, ?, ?)', id, j, n, k, v));
      });
    });
  };

  // --- meta and home school ---
  const homeSlug = slugify(team.school);
  const priorSchool = getMeta(db, 'school');
  if (priorSchool && priorSchool !== homeSlug) throw new Error(`DB home school is "${priorSchool}" but imported team.json is "${homeSlug}"`);
  run('INSERT OR IGNORE INTO seasons(year) VALUES (?)', season);
  setMeta('school', homeSlug);
  setMeta('current_season', String(season));

  // --- team ---
  if (same(() => readTeam(db, season), team)) counts['unchanged']!++;
  else {
    const id = upsertSchool(homeSlug, {
      name: team.school, mascot: team.mascot, city: team.city, state: team.state, maxpreps_url: team.maxprepsUrl,
      color_primary: team.colors.primary, color_secondary: team.colors.secondary, color_accent: team.colors.accent,
    });
    writeTeamSeason(id, team.classification, team.district, team.record.overall, team.record.district);
    writeCoaches(id, team.coaches);
    counts['team']!++;
  }
  const homeId = one('SELECT id FROM schools WHERE slug = ?', homeSlug)!['id'] as number;

  // --- roster ---
  if (data.roster) {
    if (same(() => readRoster(db, season), data.roster)) counts['unchanged']!++;
    else { writePlayers(homeId, data.roster.players); counts['roster']!++; }
    setMeta('roster_as_of', data.roster.asOf);
  }

  // --- season stats ---
  if (data.stats) {
    if (same(() => readSeasonStats(db, season), data.stats)) counts['unchanged']!++;
    else {
      run('UPDATE team_seasons SET stats_as_of = ?, games_played = ? WHERE school_id = ? AND season = ?',
        data.stats.asOf, data.stats.gamesPlayed, homeId, season);
      writeCategories({ schoolId: homeId }, data.stats.categories);
      counts['stats']!++;
    }
  }

  // --- games ---
  for (const g of data.games) {
    if (same(() => readGame(db, g.id), g)) { counts['unchanged']!++; continue; }
    const oppId = upsertSchool(opponentSlug(g.id), { name: g.opponent.name, mascot: g.opponent.mascot, city: g.opponent.city });
    run(
      `INSERT INTO games(id, school_id, season, opponent_school_id, opponent_maxpreps_url, status, date, playoff, round, location, district_game,
         contest_id, maxpreps_url, score_wh, score_opp, result, quarters, record_after_w, record_after_l, record_after_t, scoring_status, replay_url, recap_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET school_id = excluded.school_id, season = excluded.season, opponent_school_id = excluded.opponent_school_id,
         opponent_maxpreps_url = excluded.opponent_maxpreps_url, status = excluded.status, date = excluded.date, playoff = excluded.playoff,
         round = excluded.round, location = excluded.location, district_game = excluded.district_game, contest_id = excluded.contest_id,
         maxpreps_url = excluded.maxpreps_url, score_wh = excluded.score_wh, score_opp = excluded.score_opp, result = excluded.result,
         quarters = excluded.quarters, record_after_w = excluded.record_after_w, record_after_l = excluded.record_after_l,
         record_after_t = excluded.record_after_t, scoring_status = excluded.scoring_status, replay_url = excluded.replay_url, recap_url = excluded.recap_url`,
      g.id, homeId, season, oppId, g.opponent.maxprepsTeamUrl, g.status, g.date, g.playoff ? 1 : 0, g.round, g.location, g.districtGame ? 1 : 0,
      g.contestId, g.maxprepsUrl, g.score?.wh ?? null, g.score?.opp ?? null, g.result, g.quarters ? JSON.stringify(g.quarters) : null,
      g.recordAfter?.w ?? null, g.recordAfter?.l ?? null, g.recordAfter?.t ?? null, g.scoringStatus, g.links.replay, g.links.recap,
    );
    run('DELETE FROM game_venues WHERE game_id = ?', g.id);
    if (g.venue) run('INSERT INTO game_venues(game_id, name, address) VALUES (?, ?, ?)', g.id, g.venue.name, g.venue.address);
    run('DELETE FROM game_labels WHERE game_id = ?', g.id);
    for (const l of new Set(g.labels)) run('INSERT INTO game_labels(game_id, label) VALUES (?, ?)', g.id, l);
    run('DELETE FROM scoring_plays WHERE game_id = ?', g.id);
    g.scoring.forEach((p, i) => run('INSERT INTO scoring_plays VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      g.id, i, p.quarter, p.time, p.team, p.type, p.player?.number ?? null, p.player?.name ?? null,
      p.passer?.number ?? null, p.passer?.name ?? null, p.yards, p.scoreAfter?.wh ?? null, p.scoreAfter?.opp ?? null));
    run('DELETE FROM takeaways WHERE game_id = ?', g.id);
    g.takeaways.forEach((t, i) => run('INSERT INTO takeaways VALUES (?, ?, ?, ?, ?, ?, ?)',
      g.id, i, t.quarter, t.team, t.type, t.player?.number ?? null, t.player?.name ?? null));
    run('DELETE FROM highlights WHERE game_id = ?', g.id);
    g.links.highlights.forEach((h, i) => run('INSERT INTO highlights(game_id, seq, label, url) VALUES (?, ?, ?, ?)', g.id, i, h.label, h.url));
    writeCategories({ gameId: g.id }, g.playerStats?.categories ?? []);
    counts['games']!++;
  }

  // --- opponents ---
  for (const o of data.opponents) {
    if (same(() => readOpponent(db, o.slug, season), o)) { counts['unchanged']!++; continue; }
    const id = upsertSchool(o.slug, {
      name: o.name, mascot: o.mascot, city: o.city, state: o.state, maxpreps_url: o.maxprepsUrl,
      color_primary: o.colors.primary, color_secondary: o.colors.secondary,
    });
    writeTeamSeason(id, o.classification, null, o.record.overall, o.record.district);
    writeCoaches(id, o.coaches);
    writePlayers(id, o.roster);
    run('DELETE FROM opponent_results WHERE school_id = ? AND season = ?', id, season);
    o.results.forEach((r, i) => run('INSERT INTO opponent_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, season, i, r.date, r.opponent, r.location, r.score?.us ?? null, r.score?.them ?? null, r.result));
    counts['opponents']!++;
  }

  if (data.events) {
    if (!same(() => readScheduleEvents(db, season), data.events)) {
      run('DELETE FROM schedule_events WHERE season = ?', season);
      for (const e of data.events) run('INSERT INTO schedule_events VALUES (?, ?, ?, ?, ?, ?)', season, e.date, e.kind, e.opponentName, e.location, e.note);
      counts['events'] = data.events.length;
    }
  }

  setMeta('next_game_id', team.nextGameId);
  return counts;
}

/** Validate dir, then import it into dbPath in one transaction. */
export function importDir(dbPath: string, dir: string): Counts {
  const data = readDataDir(dir); // validate everything before touching the DB
  const db = openWritable(dbPath);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('BEGIN IMMEDIATE');
    try {
      const counts = importDataSet(db, data);
      db.exec('COMMIT');
      return counts;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  const dir = arg('--data');
  if (!dir) { console.error('Usage: node scripts/db-import.ts --data <dir> [--db <path>]'); process.exit(2); }
  const dbPath = resolve(arg('--db') ?? DB_PATH);
  try {
    const c = importDir(dbPath, resolve(dir));
    console.log(`db-import: ${resolve(dir)} -> ${dbPath}`);
    console.log(`  written: team ${c['team']}, roster ${c['roster']}, stats ${c['stats']}, games ${c['games']}, opponents ${c['opponents']}, events ${c['events']}; unchanged: ${c['unchanged']}`);
  } catch (e) {
    console.error(`db-import failed: ${(e as Error).message}`);
    process.exit(1);
  }
}
