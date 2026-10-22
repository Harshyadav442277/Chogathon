# Chog Hivemind: Monadia (context for Claude Code)

@AGENTS.md

## What this is
A Chogathon 2026 entry (deadline **23 Oct 2026, 15:00 UTC**; rules in [RULES.md](RULES.md)). An isekai god-sim:
- All 1,969 Chog Genesis NFTs (Monad, contract `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763`, token ids 1–1969) live as AI agents on a 3D fantasy continent.
- Each Chog gets a job each season (31 jobs: shops, army, administration, farmers… plus adventurer roles: main DPS, sub DPS, tank, healer, support, buffer).
- Players are **Constellations** (gods) who can only nudge their own Chogs: hints, skills, quests, blessings.
- Each season ends when a Hero emerges and defeats the Demon King.

Read first: [docs/GODOT_GAME_PLAN.md](docs/GODOT_GAME_PLAN.md) (agreed plan), [docs/WORKSPLIT.md](docs/WORKSPLIT.md) (who owns which files, the contract), [docs/MEMORY.md](docs/MEMORY.md) (decisions).

## Repo map
| Path | What |
|---|---|
| `game/` | **Godot 4.7.2** client (GDScript only; Compatibility renderer; single-threaded web export) |
| `chog-hivemind/` | Next.js 15 server: the simulation "brain", APIs, wallet auth, and serves the Godot build at `/play` |
| `chog-hivemind/src/sim/` | Agent ticks (offline brain, or Claude when `ANTHROPIC_API_KEY` is set), memes, director, daily paper |
| `chog-hivemind/src/sim2/season.ts` | Seasons and job assignment (`data/jobs.json`) |
| `chog-hivemind/src/world/` | Shared deterministic terrain (`terrain.ts`) and map positions (`data.ts`) |
| `docs/` | Team docs: plan, work split, PRD, architecture, demo evidence, gaps |
| `.claude/skills/` | Project skills: `godot-*`, `game-*`, `rpg`, `procedural-gen`, `performance-optimization`, `isekai-world-3d`, `swarm-sim`, `threejs-*`. Use the matching skill before writing engine code (start with `gamedev-router` if unsure). |

## Run locally
```sh
cd chog-hivemind && npm install && npm run seed && npm run season -- 1 && npm run tick -- 5 --offline && npm run dev
# Godot: open game/project.godot in Godot 4.7.2 (standard, not .NET), press F5. It reads http://localhost:3000.
# Optional: keep the world moving: npm run sim -- --every 45 --offline
# Web build (merger only, on main): GODOT_BIN=/path/to/godot npm run play:build  ->  http://localhost:3000/play
```
Headless checks: `godot --headless --path game --import` (parse errors), then `godot --headless --path game --quit-after 300` (runtime errors).
Native screenshot for visual checks: `godot --path game --rendering-driver opengl3 --resolution 1440x900 -- --shot=out.png`.

## Hard-won rules (don't relearn these)
- **Web export = Compatibility renderer, single-threaded.** No C# (Godot 4 can't export C# to web), no threads, no SDFGI/SSAO.
- **Directional shadows are OFF**: in this renderer they over-brightened every lit surface to white.
- **Triangle winding:** Godot front faces are clockwise. Wrong winding flips normals and makes lit meshes dark.
- **JSON numbers arrive as floats** in Godot: use `GameState.ids` (`PackedInt32Array`) for id lookups, never `Array.find(int)`.
- **Type inference:** `var x := dict["k"]` fails to parse; write `var x: int = dict["k"]`. Same for `max()`: use `maxi()` / `maxf()`.
- **Everything repeated is a `MultiMeshInstance3D`.** No node per Chog or per building. Budget: < 150 draw calls; ≤ 3 ms CPU per frame for characters.
- **Raw data files** (`*.bin`, `*.json` under `game/data/`) load with `FileAccess` and are included by the export filter. Don't make them textures.
- **Never commit** `.env`, `*.db`, credentials or judge details (public repo). Don't commit `public/play/` from a feature branch (binary conflicts); the merger rebuilds it on `main`.

## Working with the other developer
Work only on your branch (`feat/world` or `feat/characters`) and only in files you own (see [docs/WORKSPLIT.md](docs/WORKSPLIT.md)). Merge `origin/main` into your branch every few hours. Shared files need a heads-up and a small PR. Record decisions in `docs/MEMORY.md` and verified behavior in `docs/DEMO.md` (local vs deployed).
