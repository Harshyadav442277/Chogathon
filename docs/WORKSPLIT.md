# Work split: two developers, one repo

Agreed 2026-10-21. Goal: both developers work in parallel without touching the same files. Plan context: [GODOT_GAME_PLAN.md](GODOT_GAME_PLAN.md).

| | Developer A (world) | Developer B (characters) |
|---|---|---|
| Builds | Landscape (coastline, 4 biomes, volcano, rivers, forests), ~300 buildings from Kenney kits, city layouts | 1,969 characters that **walk**, **work** and **fight** |
| Branch | `feat/world` | `feat/characters` |
| Owns (only you edit these) | `game/scripts/terrain.gd`, `game/scripts/settlements.gd`, `game/shaders/terrain*`, `game/shaders/water*`, `game/shaders/lava*`, `game/assets/kenney/**`, `game/data/**`, `chog-hivemind/scripts/gen-world*.ts`, `chog-hivemind/scripts/export-terrain.ts`, `chog-hivemind/data/world*.json`, `chog-hivemind/src/world/terrain.ts` | `game/scripts/characters/**`, `game/shaders/character*.gdshader`, `game/assets/characters/**`, `chog-hivemind/app/api/v2/looks/**` (new, optional) |

**Shared files (small, separate pull requests; tell the other person first):**
- `game/scripts/main.gd`
- `game/autoload/GameState.gd`, `game/autoload/Api.gd`
- `game/scripts/hud.gd`
- `game/project.godot`, `game/export_presets.cfg`
- `chog-hivemind/src/world/data.ts`: positions contract, **additive fields only**

**Build output** (`chog-hivemind/public/play/`) is rebuilt and committed **only on `main`, by whoever merges**, never on a feature branch. Binary files can't be merged, so the build would conflict otherwise.

---

## The contract between the two halves

### 1. Plug-in point (already in `main.gd`)
If `res://scripts/characters/characters.gd` exists, `main.gd` uses it to render the Chogs. Otherwise it falls back to the portrait tokens (`ChogSwarm`). Run the game with `-- --tokens` to force the old tokens for comparison.

`characters.gd` must provide:

```gdscript
extends Node3D
var terrain: Terrain                                          # set by main.gd before _ready; use terrain.height_at(x, z)
func pick(camera: Camera3D, screen_pos: Vector2) -> int       # index of the character under the cursor, or -1
func id_at(index: int) -> int                                 # token id for that index, or -1
func position_of(chog_id: int) -> Vector3                     # current world position (used for the fly-to camera)
```

### 2. Data (`GameState` autoload, refreshed every 10 s)
- Signal `GameState.positions_updated`.
- `GameState.positions` holds parallel arrays, one entry per Chog:
  - `ids`: token id
  - `names`
  - `x`, `z`: world position (y comes from `terrain.height_at`)
  - `house`: 0 Laser, 1 Teardrop, 2 Glass, 3 Moonbeam (`GameState.HOUSE_COLORS`)
  - `poi`: index into `GameState.world.pois`
  - `job`: display name
  - `role`: `""` for civilians, or `main_dps` / `sub_dps` / `tank` / `healer` / `support` / `buffer`
  - `state`: `"work"` or `"fight"`
  - `mood`
- `GameState.ids`: the same ids as a `PackedInt32Array`. JSON numbers arrive as floats, so use this for lookups.
- **Walking is decided on the client:** when a Chog's new `x`/`z` differs from where it stands, it walks there (state `walk`), then resumes the server's state.
- Selection: `GameState.selected`, signal `selection_changed(id)`.
- Portrait atlas: `res://assets/chogs_atlas.webp`, 64 px tiles, 45 columns × 44 rows, slot = tokenId − 1 (see `shaders/chog_token.gdshader` for sampling).
- Per-Chog traits (to generate each character's look), if needed: add `GET /api/v2/looks` (owned by B), returning `{ids:[], traits:[{Body, Head, Eyes, Mouth, Aura, Background, Skin}]}` from the `chogs.traits` column.

### 3. Performance budget (web build, laptop integrated GPU)
- All 1,969 characters in **≤ 3 draw calls**: `MultiMeshInstance3D`, no node per character.
- Animate walk, work and fight **in the shader** (per-instance custom data: state + phase), not with skeletons.
- **≤ 3 ms CPU per frame** for the character update; only touch instances that move.
- The NFT portrait must stay visible (e.g. as the face or a head billboard): the NFT has to be essential.

---

## Setup for a new developer
1. `git clone https://github.com/Harshyadav442277/Chogathon.git && cd Chogathon && git checkout feat/characters`
2. Server:
   ```sh
   cd chog-hivemind
   npm install
   npm run seed
   npm run season -- 1
   npm run tick -- 5 --offline
   npm run dev
   ```
   The site runs at http://localhost:3000. Keep it running; the Godot client reads `/api/world/positions` from it. Optional, in a second terminal, keep the world moving: `npm run sim -- --every 45 --offline`.
3. Godot **4.7.2 stable** (standard build, not .NET) from https://godotengine.org/download/archive/4.7.2-stable/. Open `game/project.godot`; press F5 to run (it talks to `http://localhost:3000`).
4. Web export (only when merging to `main`): install the 4.7.2 export templates, then `cd chog-hivemind && GODOT_BIN=/path/to/godot npm run play:build`, then open http://localhost:3000/play.

## Git flow
1. Work only on your branch, and only in your owned files. Commit small and often.
2. Get the other side's progress: `git fetch origin && git merge origin/main` on your branch, at least every few hours.
3. When a piece works, open a pull request into `main`. The merger runs the game once, rebuilds `public/play`, and commits that build on `main`.
4. Need to change a shared file? Say so first, keep the change minimal, and merge it to `main` quickly so the other branch picks it up.
5. Record decisions in [MEMORY.md](MEMORY.md) and blockers in [GAPS.md](GAPS.md).
