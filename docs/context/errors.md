# Known errors and fixes

Entries go newest first.

## Cannot find package 'zod'
- Cause: running `npm run db:export` (or `db:import` / `check:stats`) in a checkout with no node_modules fails because the `zod` package is not installed.
- Fix: run `npm ci` first (Node 24).
- Date: 2026-11-16

Template:

```
## <short error signature, the message text you would grep for>
- Cause: <root cause>
- Fix: <what resolved it>
- Date: YYYY-MM-DD
```
