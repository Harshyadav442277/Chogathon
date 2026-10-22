# Deploying ChogSekai (free tiers)

| Part | Service | Why |
|---|---|---|
| Website, APIs, the Godot game at `/play` | Vercel (Hobby) | Next.js host; static files for the web build |
| Database | Turso (free) | libSQL, same as local; ~5 GB, 10M rows written per month |
| Simulation ticks | GitHub Actions (`.github/workflows/tick.yml`) | Free on public repos; every 10 minutes, connects to Turso directly |

Measured locally (2026-10-22): about 1,300 rows written per tick at the production interval, so roughly
2.7M rows over 14 days for the season simulation, inside Turso's free tier.

## What the owner provides (never paste secrets into chat or commit them)

Create `chog-hivemind/.env.deploy` on the deploying machine (gitignored by `.env.*`) with:

```
VERCEL_TOKEN=...            # vercel.com > Account Settings > Tokens > Create (expiry 30 days is enough)
TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io
TURSO_AUTH_TOKEN=...        # turso.tech dashboard > your database > Create token (read & write)
JUDGE_CODE=...              # any phrase; give it to judges only in the submission's private field
JUDGE_CHOG_IDS=173,681,875,1007,1420
```

`SESSION_SECRET` and `CRON_SECRET` are generated during deployment and stored only in Vercel.

GitHub Actions secrets (repo **Settings > Secrets and variables > Actions**, needs repo admin):
- Secrets: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- Variables: `SEASON_HOURS=24`, `SIM_TICK_SECONDS=600`

## Deployment steps (run from `chog-hivemind/`)

1. **Seed the hosted database** (with the Turso variables from `.env.deploy` in the environment):
   `npm run seed`, then `npm run season -- 1`, then one tick: `npm run tick -- 1 --offline`.
2. **Link and configure Vercel:** `npx vercel link --yes --token $VERCEL_TOKEN`, then add the production
   environment variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET`, `CRON_SECRET`,
   `JUDGE_CODE`, `JUDGE_CHOG_IDS`, `SEASON_HOURS=24`, `SIM_TICK_SECONDS=600`.
3. **Deploy:** `npx vercel deploy --prod --token $VERCEL_TOKEN` (uploads this folder, including the
   committed web build in `public/play/`; `.vercelignore` keeps local databases and env files out).
4. **GitHub Actions:** set the secrets and variables above; run the `hive-tick` workflow once by hand
   (Actions tab > hive-tick > Run workflow) and check its log for a tick line.
5. **Optional backup ticker:** a free scheduler (e.g. cron-job.org) calling
   `https://<site>/api/cron/tick` with header `Authorization: Bearer <CRON_SECRET>` every 10 minutes. The
   database lock prevents overlapping ticks.

## Checks after deploying (record results in DEMO.md as "deployed")
- `/api/v2/season` shows season 1, phase 1, and `startedAt` close to the deploy time.
- `/api/world/positions` returns 1,962 ids with states.
- `/play/index.html` shows the title screen, then the world; the Status Window opens on a Chog.
- Judge sign-in in Daily Pull works with `JUDGE_CODE`; drawing a hand and bestowing a card applies on the next tick.
- The `hive-tick` workflow runs every ~10 minutes (some runs may be late).
