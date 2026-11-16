# MaxPreps: where the site's data comes from

Roster, schedule, scores and season stats come from MaxPreps. Look here when doing the weekly data update or auditing the site for accuracy.

## URLs
- Team home: https://www.maxpreps.com/tx/dallas/wilmer-hutchins-eagles/football/ (`MAXPREPS_TEAM_URL` in `src/config.ts`)
- Schedule and results: `<team home>schedule/`
- Roster: `<team home>roster/`
- Stats: `<team home>stats/`
- Full per-player stats (print view): https://www.maxpreps.com/print/team_stats.aspx?admin=0&bygame=0&league=0&print=1&schoolid=480a3ca5-78ac-408c-94dd-a1f69c30b37f&ssid=2286cd80-c46d-4739-8dd1-92a67ca8daa7
  - `schoolid` is the school. `ssid` is the 2026 season (MaxPreps calls it "26-27"). For a new season, take the print link from the stats page to get the new `ssid`.

## Fetching
- `curl -sL -A 'Mozilla/5.0' <url>` works; no browser needed.
- Pages embed their data as JSON in `<script id="__NEXT_DATA__">`. The stats page only embeds the top leader per stat there, so use the print view for full tables (11 HTML tables, one per category).
- Team, schedule and roster pages: parse `__NEXT_DATA__`. Box score pages (each game's `maxprepsUrl` on the schedule) embed Next.js flight data instead.
- MaxPreps does not publish scoring plays, takeaways, scrimmages or byes, so those can't be checked against it. A playoff game can show "Date is TBA" (contest dated 1900-01-01) until its date is set.

## How our data lines up
- The 11 stat categories match MaxPreps one to one: passing, rushing, receiving, allPurpose, totalYards, tackles, sacks, defensive, points, patsFieldGoals, touchdowns. Same columns. A blank on MaxPreps is null in the DB.
- Match rows on jersey number plus name.
- Games played (GP) is MaxPreps' per-player GP. It can trail the team record when a game has no stats entered (2026-11-16: record 9-2, 10 games with stats).
- MaxPreps team-total rows have quirks (e.g. tackles TFL total 100.0; points-category TDs 4 vs 11 rushing TDs). We store player rows only, so ignore team totals.
- MaxPreps can lag behind our scoring plays; `check:stats` warns on TD mismatches.

## Other sources (checked 2026-11-16)
- **SI High School (ScoreBook Live), secondary source:** https://www.si.com/high-school/stats/texas/football/teams/263968-wilmerhutchins-eagles/games
  - Has every game: schedule, final scores, home/away and playoff round labels. Spot-checked scores match MaxPreps. No quarter scores, scoring plays or player stats.
  - Fetch with `curl -sL -A 'Mozilla/5.0'`. Game data is in `ld+json` SportsEvent blocks plus an embedded GraphQL payload. The `startDate` time offsets look wrong, so use only the date. robots.txt allows crawling.
  - An unscheduled game shows a 23:59 placeholder with blank time and venue. Lindale game page: https://www.si.com/high-school/stats/texas/football/games/6969646-wilmerhutchins-vs-lindale
- **Nothing useful:** Dave Campbell's (davecampbells.com; empty for 2026, previews paywalled), UIL brackets (link back to MaxPreps), lonestarfootball.net, Dallas ISD athletics, ScoreStream (JS only), Rank One, Hudl (404), Dallas Morning News / SportsDay (old archives only).
- **Not checked yet:** NFHS Network, GameChanger, local TV scoreboards.

## Audit log
- 2026-11-16: everything comparable matched MaxPreps.
  - Player season stats: 11/11 categories, every row and column.
  - Roster: 35/35 players (name, number, positions, grade, height/weight); 2 staff.
  - Games: 11/11 on date, opponent, both scores, home/away and district flag. Quarter scores: 4/4 games where MaxPreps has them.
  - Team: 9-2 overall, 7-1 district; district name, colors and coaches.
  - Open: Lindale Area-round game. Ours says 2026-11-20 at City Bank Stadium, Forney. MaxPreps says date TBA. SI shows Lindale as home with no venue and a placeholder date (2026-11-19 23:59).
  - Gap: opponents' `maxprepsTeamUrl` is null for all 11 played opponents.
