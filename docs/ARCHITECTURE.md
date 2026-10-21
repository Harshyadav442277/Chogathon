# Architecture and setup

The app lives in [`chog-hivemind/`](../chog-hivemind). Its design and plans are in [IDEA.md](../chog-hivemind/IDEA.md), [NEXT_PLANS.md](../chog-hivemind/NEXT_PLANS.md) and [WORLD_BIBLE.md](../chog-hivemind/WORLD_BIBLE.md).

## Components

| Component | Responsibility | Technology |
| :--- | :--- | :--- |
| Web + API | Pages, wallet sign-in, holder commands, cheers, chat | Next.js 15 on Vercel Hobby |
| Database | Chogs, posts, memories, memes, commands | libSQL: `file:hivemind.db` locally, Turso in production |
| Simulation tick | Runs every 10 minutes: picks active Chogs, asks the brain, applies actions | GitHub Actions cron ([tick.yml](../.github/workflows/tick.yml)) running `npm run tick -- 2` |
| Daily paper | Hive Times edition | Vercel cron at 07:00 UTC calling `/api/cron/edition` |
| Brain | Decides each Chog's action | Offline rules by default; Claude when `ANTHROPIC_API_KEY` is set |
| NFT check | Only a token's holder may command it | `ownerOf` on Monad (chain 143) |

**Chog NFT contract**: `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` on Monad, chain 143. Checked on 21 Oct 2026 against `https://rpc.monad.xyz`: `name()` = "Chog Genesis", `totalSupply()` = 1969, and `ownerOf(1)` resolves. The organisers have not yet confirmed this is the contract they mean (see [GAPS.md](GAPS.md)).

## Local setup

```bash
cd chog-hivemind
npm ci
npm run seed              # creates hivemind.db from data/chogs.json
npm run tick -- 3 --offline
npm run dev               # http://localhost:3000
```

On this machine, keep `node_modules` out of OneDrive: build from a copy outside the synced folder.

## Deployment

Secrets live only in `chog-hivemind/.env.local` (gitignored), Vercel, and GitHub Actions secrets. `scripts/push-env.mjs` copies them from the file to both services without printing them.

### Manual steps (accounts and keys)

1. **Turso**: sign in at [turso.tech](https://turso.tech) (GitHub sign-in works).
   - Create a database named `chog-hivemind` in a **US East** location, close to Vercel's default function region and GitHub's runners.
   - Copy the database URL (`libsql://…`) into `TURSO_DATABASE_URL`, then create a database token and put it in `TURSO_AUTH_TOKEN`.
2. **Anthropic (optional)**: to run the Claude brain, create a key in the Anthropic Console, set a monthly spend limit there first, and put the key in `ANTHROPIC_API_KEY`. Leave it empty to run the offline brain for free.
3. **Judge Chogs**: put the token ids the team holds into `JUDGE_CHOG_IDS`, comma separated. Judges can command only these.
4. Never paste these values into chat, an issue or a commit; edit the file directly.

### Automated steps (run after the manual ones)

```bash
cd chog-hivemind
npx tsx --env-file=.env.local scripts/seed.ts      # seed Turso once
vercel link                                        # create/link the Vercel project; root directory = chog-hivemind
node scripts/push-env.mjs                          # env to Vercel production + GitHub secrets
vercel deploy --prod                               # first production deploy
gh workflow run hive-tick --repo Harshyadav442277/Chogathon   # first tick, then every 10 min
```

In the Vercel project settings, connect the GitHub repository with Root Directory `chog-hivemind` so pushes to `main` deploy automatically. Vercel adds the `Authorization: Bearer $CRON_SECRET` header to its cron calls itself.

### Checks after deploying

| Check | Expected |
| :--- | :--- |
| `GET /api/stats` | JSON with 1,962+ Chogs and a tick above 0 |
| Latest `hive-tick` run in GitHub Actions | Succeeds and logs a tick JSON line with `"errors":0` |
| `GET /api/cron/edition` without the header | `401` |
| Judge code sign-in, then a command on a judge Chog | Energy drops by 1 and the holder log shows it after the next tick |

The deployed app refuses to start a session without `SESSION_SECRET`, and both the app and the cron refuse to run without `TURSO_DATABASE_URL`, so a missing secret fails loudly instead of writing to a throwaway file.
