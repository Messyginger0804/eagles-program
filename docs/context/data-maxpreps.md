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

## How our data lines up
- The 11 stat categories match MaxPreps one to one: passing, rushing, receiving, allPurpose, totalYards, tackles, sacks, defensive, points, patsFieldGoals, touchdowns. Same columns. A blank on MaxPreps is null in the DB.
- Match rows on jersey number plus name.
- Games played (GP) is MaxPreps' per-player GP. It can trail the team record when a game has no stats entered (2026-11-16: record 9-2, 10 games with stats).
- MaxPreps team-total rows have quirks (e.g. tackles TFL total 100.0; points-category TDs 4 vs 11 rushing TDs). We store player rows only, so ignore team totals.
- MaxPreps can lag behind our scoring plays; `check:stats` warns on TD mismatches.

## Audit log
- 2026-11-16: player season stats matched MaxPreps exactly (11/11 categories, every row and column).
