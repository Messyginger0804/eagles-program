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
- **Playoff dates, kickoff times and venues** (MaxPreps and SI often lag on these):
  - Dave Campbell's weekly playoff "game times and locations" articles, e.g. https://www.davecampbells.com/articles/2026/11/07/txhsfb-playoffs-game-times-and-locations (gives the weekday and time, not the date). Its team page is empty for 2026 and previews are paywalled.
  - The opponent's local paper. For Lindale that's the Tyler Morning Telegraph (tylerpaper.com), whose recaps give the next game's date, time and venue, e.g. https://tylerpaper.com/2026/11/14/lindale-takes-down-kaufman-in-home-playoff-game-52-22/. KLTV (kltv.com) also covers the Tyler area.
  - NBC DFW playoff schedule pages, e.g. https://www.nbcdfw.com/news/sports/hs-sports/2026-class-4a-texas-high-school-football-bi-district-playoff-schedule/4103102/
- **Score cross-check:** High School Football America's playoff score lists, e.g. https://highschoolfootballamerica.com/final-scores-from-the-opening-round-of-the-2026-uil-texas-high-school-football-playoffs/ (a plain list, easy to parse).
- **NFHS Network:** https://www.nfhsnetwork.com/schools/8f3f8aeaf7 lists games with recap videos (subscription needed). Its dates looked like 2025 under a 2026 label, so verify before trusting them.
- **Nothing useful:** UIL brackets (link back to MaxPreps), lonestarfootball.net, Dallas ISD athletics, ScoreStream (JS only), Rank One, Hudl (404), Dallas Morning News / SportsDay (old archives only), GameChanger (no public team page), FOX 4, WFAA, CBS Texas, KETK, GoFan and Lindale ISD (nothing for 2026 found).
- No source has Wilmer-Hutchins scoring plays, game recaps, scrimmages or byes, so keep hand-entering them.

## Audit log
- 2026-11-16: everything comparable matched MaxPreps.
  - Player season stats: 11/11 categories, every row and column.
  - Roster: 35/35 players (name, number, positions, grade, height/weight); 2 staff.
  - Games: 11/11 on date, opponent, both scores, home/away and district flag. Quarter scores: 4/4 games where MaxPreps has them.
  - Team: 9-2 overall, 7-1 district; district name, colors and coaches.
  - Lindale Area-round game confirmed: Fri 2026-11-20, 7:00 p.m., City Bank Stadium, Forney (Tyler Morning Telegraph 2026-11-14 and Dave Campbell's playoff game times). Matches ours. MaxPreps still said TBA and SI showed a placeholder date.
  - Gap: opponents' `maxprepsTeamUrl` was null for all 11 played opponents. Filled in from the MaxPreps schedule page by PR #11 (2026-11-16).
