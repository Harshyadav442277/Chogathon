# Handoff: characters (Developer B, branch `feat/characters`)

Written 2026-10-21 for the second developer and their Claude Code session. Also read: [../CLAUDE.md](../CLAUDE.md), [WORKSPLIT.md](WORKSPLIT.md) (contract), [GODOT_GAME_PLAN.md](GODOT_GAME_PLAN.md) (game design).

## Goal
Replace the flat portrait tokens with **1,969 little 3D characters** that **walk**, **work** and **fight**, so the world feels alive. Time box: **~7 hours**. Developer A is changing the landscape and buildings at the same time on `feat/world`; you never touch each other's files.

## What already exists (read these first)
| File | Why |
|---|---|
| `game/scripts/chog_swarm.gd` | The current renderer: one `MultiMeshInstance3D` for all Chogs, reads `GameState`, lerps toward new positions, screen-space picking. **Copy its structure.** |
| `game/shaders/chog_token.gdshader` | Billboard plus portrait-atlas sampling (`INSTANCE_CUSTOM.r` = atlas slot). Reuse the atlas code for the face. |
| `game/scripts/main.gd` | Loads `res://scripts/characters/characters.gd` automatically if it exists (fallback: tokens; force tokens with `-- --tokens`). |
| `game/autoload/GameState.gd` | Live data every 10 s: `positions` (ids, names, x, z, house, poi, job, role, state, mood), `ids`, `selected`, signals |
| `game/scripts/terrain.gd` | `terrain.height_at(x, z)` stands characters on the ground |

## What to build: `game/scripts/characters/characters.gd` (+ `game/shaders/character.gdshader`)

**Interface (required by `main.gd`):**

```gdscript
extends Node3D
var terrain: Terrain
func pick(camera: Camera3D, screen_pos: Vector2) -> int
func id_at(index: int) -> int
func position_of(chog_id: int) -> Vector3
```

**Look (keep the NFT visible):**
- **Body:** a small low-poly chibi built procedurally (capsule or box torso, sphere head, stub limbs) or one tiny glTF.
  - Color it from the house (`GameState.HOUSE_COLORS`).
  - Optionally vary it by traits through a new `GET /api/v2/looks` (you own `chog-hivemind/app/api/v2/looks/`).
- **Face:** the Chog's NFT portrait from the atlas, as a camera-facing disc on the head (or the head's front face).
- **Role prop for adventurers** (`positions.role`): sword (main_dps), daggers (sub_dps), shield (tank), staff (healer), book (support), banner (buffer). Civilians get a job tool or nothing.

**States (`positions.state` + client-side walk):**

| State | When | Shader animation (no skeletons) |
|---|---|---|
| `walk` | The new server position differs from the current one; move toward it at ~3–5 units/s and face the direction of travel | Bob up and down, sway; legs/arms swing via vertex offset by height band |
| `work` | Server `state == "work"` and standing still | Job loop: hammer bounce (crafts), bow (service), dig (land), salute (civic) |
| `fight` | Server `state == "fight"` | Lunge forward and back, quick shake, red/white flash on hit |

- Store per instance in `INSTANCE_CUSTOM`: `r` = atlas slot, `g` = state (0 walk, 1 work, 2 fight), `b` = phase offset (so the crowd isn't in sync), `a` = highlight (selected / mine).
- Animate with `TIME` in the vertex shader.

**Selection and picking:** keep the screen-space nearest-within-18 px approach from `chog_swarm.gd`. Highlight `GameState.selected`.

## Budget and acceptance checks
- [ ] All Chogs render in **≤ 3 draw calls** (body MultiMesh + face MultiMesh + optional prop MultiMesh).
- [ ] **≤ 3 ms per frame** CPU in the character update: only rewrite transforms of instances that are moving.
- [ ] Web build runs smoothly on a laptop (integrated GPU) with the whole continent in view.
- [ ] Every character shows its own NFT portrait; clicking one opens the Status Window and flies the camera to it.
- [ ] Walk, work and fight are visually distinct at mid zoom.
- [ ] `godot --headless --path game --import` and `--quit-after 300` print no errors.
- [ ] Native screenshot looks right: `godot --path game --rendering-driver opengl3 --resolution 1440x900 -- --shot=chars.png`.

## How to work
1. `git checkout feat/characters`, then run the server (see [../CLAUDE.md](../CLAUDE.md) → Run locally).
2. Build in small steps: one character → 1,969 static characters → walking → work/fight animation → props and polish.
3. Use these skills: `godot-shaders`, `godot-3d-essentials`, `godot-animation`, `performance-optimization`, `game-feel` (in `.claude/skills/`).
4. Commit often on `feat/characters`. Run `git fetch && git merge origin/main` every few hours. When it meets the checks above, open a PR into `main`. The merger rebuilds `public/play`.
5. Need a new server field (e.g. a more precise state)? Add it **additively** in `chog-hivemind/src/world/data.ts` in a tiny separate PR, and tell Developer A.

## Prompt to paste into Claude Code (Developer B)
> Read CLAUDE.md, docs/WORKSPLIT.md and docs/HANDOFF_CHARACTERS.md. I'm Developer B on branch feat/characters. Build game/scripts/characters/characters.gd and game/shaders/character.gdshader per the handoff: 1,969 MultiMesh chibi characters with the NFT portrait as the face, walk/work/fight animated in the shader, screen-space picking, within the performance budget. Only edit files I own. Use the godot-shaders, godot-3d-essentials and performance-optimization skills. Verify with the headless checks and a native screenshot, then commit on feat/characters.
