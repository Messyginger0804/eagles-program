# Deploy

Hosting: GitHub Pages, deployed by GitHub Actions from `.github/workflows/deploy.yml`. Static output only (`dist`).

## Pipeline
Triggers: push to `main`, or manual `workflow_dispatch`. Job `build` (ubuntu): checkout, setup-node using `.nvmrc` with npm cache, `npm ci`, `npm test`, `npm run check:stats`, `npm run build`, `npm run check:links`, then upload `dist` as the Pages artifact. Job `deploy` (needs `build`, environment `github-pages`) publishes it. Concurrency group `pages` does not cancel in-progress runs. Permissions: contents read, pages write, id-token write.

Any failing step (tests, data checks, link check) blocks the deploy.

## Custom domain
The site is served at the custom domain root: `site` in `astro.config.mjs` holds the domain and `base` is `/`. The domain itself is set in the repo's GitHub Pages settings; there is no `CNAME` file in `public/` because the deploy uses Actions rather than a branch. Do not add a `CNAME` file expecting it to matter.

## Gotchas
- Previously the site was served under a sub-path; it moved to the domain root in the "custom-domain" change. Hardcoded root paths in `src/styles/global.css` and `BASE` in `scripts/check-links.ts` assume `/`.
- Merging a data change to `db/eagles.db` is a deploy; run `npm run check:stats` locally first.
- No env vars or secrets are used by the workflow.
