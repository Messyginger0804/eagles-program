import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const url = z.url();
const jersey = z.string().min(1);
const hex = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, 'expected hex color');

const recordPart = z.object({ w: z.number().int(), l: z.number().int(), t: z.number().int() });
const coach = z.object({ name: z.string(), role: z.string() });
const link = z.object({ label: z.string(), url: z.string() });

export const TeamSchema = z.object({
  school: z.string(),
  mascot: z.string(),
  city: z.string(),
  state: z.string(),
  season: z.number().int(),
  classification: z.string(),
  district: z.string().nullable(),
  colors: z.object({ primary: hex, secondary: hex, accent: hex }),
  record: z.object({ overall: recordPart, district: recordPart }),
  coaches: z.array(coach),
  maxprepsUrl: url,
  nextGameId: z.string().nullable(),
});

export const PlayerSchema = z.object({
  careerId: z.string(),
  athleteId: z.string().nullable(),
  number: jersey,
  firstName: z.string(),
  lastName: z.string(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be kebab-case ASCII'),
  positions: z.array(z.string()),
  grade: z.number().int().min(9).max(12).nullable(),
  height: z.string().nullable(),
  weight: z.number().nullable(),
  maxprepsUrl: url,
  highlights: z.array(link),
});

export const RosterSchema = z.object({
  asOf: isoDate,
  players: z.array(PlayerSchema),
});

export const StatCategoryKeys = [
  'passing', 'rushing', 'receiving', 'allPurpose', 'totalYards', 'tackles',
  'sacks', 'defensive', 'points', 'patsFieldGoals', 'touchdowns',
] as const;

export const StatCategorySchema = z.object({
  key: z.string(),
  label: z.string(),
  columns: z.array(z.object({ key: z.string(), label: z.string() })),
  rows: z.array(
    z.object({
      number: jersey,
      nameAbbrev: z.string(),
      stats: z.record(z.string(), z.number().nullable()),
    }),
  ),
});

export const SeasonStatsSchema = z.object({
  asOf: z.string().nullable(),
  gamesPlayed: z.number().int(),
  categories: z.array(StatCategorySchema),
});

const teamSide = z.enum(['WH', 'OPP']);
const playerRef = z.object({ number: jersey, name: z.string() });

export const ScoringTypes = [
  'rushTD', 'passTD', 'intReturnTD', 'fumbleReturnTD', 'puntReturnTD', 'kickReturnTD', 'otherTD',
  'fieldGoal', 'safety', 'patKick', 'patKickMissed', 'twoPtRush', 'twoPtPass', 'twoPtFailed',
] as const;

export const ScoringPlaySchema = z.object({
  quarter: z.number().int().min(1),
  time: z.string().nullable(),
  team: teamSide,
  type: z.enum(ScoringTypes),
  player: playerRef.nullable(),
  passer: playerRef.nullable(),
  yards: z.number().nullable(),
  scoreAfter: z.object({ wh: z.number(), opp: z.number() }).nullable(),
});

export const TakeawaySchema = z.object({
  quarter: z.number().int().min(1),
  team: teamSide,
  type: z.enum(['interception', 'fumbleRecovery']),
  player: playerRef.nullable(),
});

export const GameLabels = ['seniorNight', 'homecoming'] as const;

export const GameSchema = z.object({
  id: z.string().regex(/^\d{4}-(\d{2}-\d{2}|tbd)-[a-z0-9-]+$/, 'id must be YYYY-MM-DD-<opponent-slug>'),
  status: z.enum(['final', 'scheduled']),
  date: isoDate.nullable(),
  playoff: z.boolean(),
  round: z.string().nullable(),
  labels: z.array(z.enum(GameLabels)).default([]),
  venue: z.object({ name: z.string().min(1), address: z.string().min(1) }).nullable().default(null),
  location: z.enum(['home', 'away', 'neutral']).nullable(),
  districtGame: z.boolean(),
  opponent: z.object({
    name: z.string(),
    mascot: z.string().nullable(),
    city: z.string().nullable(),
    maxprepsTeamUrl: url.nullable(),
  }),
  contestId: z.string().nullable(),
  maxprepsUrl: url.nullable(),
  score: z.object({ wh: z.number().int(), opp: z.number().int() }).nullable(),
  result: z.enum(['W', 'L', 'T']).nullable(),
  quarters: z.object({ wh: z.array(z.number()), opp: z.array(z.number()) }).nullable(),
  recordAfter: z.object({ w: z.number().int(), l: z.number().int(), t: z.number().int().optional() }).nullable(),
  scoringStatus: z.enum(['complete', 'partial', 'none']),
  scoring: z.array(ScoringPlaySchema),
  takeaways: z.array(TakeawaySchema),
  playerStats: z.object({ categories: z.array(StatCategorySchema) }).nullable(),
  links: z.object({
    replay: z.string().nullable(),
    recap: z.string().nullable(),
    highlights: z.array(link),
  }),
});

export const OpponentSchema = z.object({
  slug: z.string(),
  name: z.string(),
  mascot: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  classification: z.string().nullable(),
  maxprepsUrl: url,
  colors: z.object({ primary: hex, secondary: hex.nullable() }),
  record: z.object({ overall: recordPart, district: recordPart.nullable() }),
  coaches: z.array(coach),
  roster: z.array(
    z.object({
      number: jersey,
      firstName: z.string(),
      lastName: z.string(),
      positions: z.array(z.string()),
      grade: z.number().int().min(9).max(12).nullable(),
      height: z.string().nullable(),
      weight: z.number().nullable(),
    }),
  ),
  results: z.array(
    z.object({
      date: isoDate.nullable(),
      opponent: z.string(),
      location: z.enum(['home', 'away', 'neutral']).nullable(),
      score: z.object({ us: z.number().int(), them: z.number().int() }).nullable(),
      result: z.enum(['W', 'L', 'T']).nullable(),
    }),
  ),
});

export type Team = z.infer<typeof TeamSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Roster = z.infer<typeof RosterSchema>;
export type StatCategory = z.infer<typeof StatCategorySchema>;
export type SeasonStats = z.infer<typeof SeasonStatsSchema>;
export type ScoringPlay = z.infer<typeof ScoringPlaySchema>;
export type Takeaway = z.infer<typeof TakeawaySchema>;
export type Game = z.infer<typeof GameSchema>;
export type Opponent = z.infer<typeof OpponentSchema>;

/** Format zod issues as "path: message" lines. */
export function formatIssues(err: z.ZodError): string {
  return err.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
}
