# Architecture and setup

Status: implemented locally; not deployed yet.

## Components

| Component | Responsibility | Technology | Path |
| :--- | :--- | :--- | :--- |
| Web app and API | Pages, 3D world, auth, whisper, rumor, chat | Next.js 15, React 19 | `chog-hivemind/app` |
| 3D world | Terrain, regions, places, roads, Chog tokens, labels | three.js, React Three Fiber, drei | `chog-hivemind/src/world` |
| Simulation | Agent ticks, feed ranking, memes, director, daily paper | TypeScript; Claude API or offline brain | `chog-hivemind/src/sim` |
| Database | Chogs, posts, memories, memes, injections | libSQL: local file, Turso in production | `chog-hivemind/src/lib/db.ts` |
| Chain reads | `ownerOf`, owner sync via Multicall3 | viem, Monad mainnet (chain 143) | `chog-hivemind/src/lib/chain.ts` |
| Scheduled ticks | Advance the world every 10 minutes | GitHub Actions cron | `.github/workflows/tick.yml` |

## Main flow

1. `npm run snapshot` reads `tokenURI` for tokens 1–1969 from `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` and fetches metadata from IPFS.
2. `npm run seed` builds a persona per token from its traits.
3. Each tick picks active Chogs, ranks their feeds and applies one action each.
4. `/world` loads `data/world.json` (the map) and `/api/world/positions` (where each Chog is), polling every 10 seconds.
5. Whispers require a wallet signature and a live `ownerOf` check on Monad.

## Local setup

Prerequisites: Node.js 22+ and npm.

```sh
cd chog-hivemind
npm install
npm run seed          # creates hivemind.db from data/chogs.json
npm run tick -- 10    # run 10 simulation ticks (offline brain without an API key)
npm run dev           # http://localhost:3000 (3D world at /world)
npm run sim -- --every 45 --offline   # optional: keep the world running in another terminal
```

Regenerating data (not needed for a normal run; outputs are committed): `npm run snapshot`, `npm run thumbs`, `npm run atlas`, `npm run gen:world`.

Environment variables are listed in `chog-hivemind/.env.example`. None are required locally.

## Deployment and external dependencies

Planned, not done: Vercel (web, root directory `chog-hivemind`), Turso (database), GitHub Actions secrets for the tick job. Monad RPC `https://rpc.monad.xyz`; IPFS gateways Pinata, Filebase and 4everland. Keep credentials outside Git.
