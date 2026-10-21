---
name: isekai-world-3d
description: Art direction, world layout and game-feel rules for the Chog Hivemind 3D isekai world (Monadia), built with React Three Fiber. Use when adding or changing anything in the 3D world: terrain, regions, points of interest, buildings, Chog tokens, camera, lighting, UI overlays or performance. Pairs with the threejs-* skills for API details and WORLD_BIBLE.md for lore.
---

# Isekai World 3D (Monadia)

The 3D world is a **living diorama**: a stylized fantasy continent seen from a tilted god's-eye camera, in the spirit of Genshin Impact's world map and isekai anime opening shots. The player is a Patron God looking down on 1,969 AI Chogs going about their lives. It is not an action game: no player avatar, no combat physics.

## 1. Art direction
- **Style:** low-poly, flat-shaded, saturated pastel toon. Use `MeshToonMaterial` or `MeshStandardMaterial` with `flatShading` and roughness ≥ 0.8. Use vertex colors for terrain, not textures.
- **Palette per nation** (keep consistent with the house colors in the UI):
  | Nation | House | Ground | Accent | Mood |
  |---|---|---|---|---|
  | Emberforge Peaks | Laser `#ff4d6d` | charcoal `#3b2f35`, rust `#7a3b2e` | lava `#ff7a3d` emissive | dramatic, high peaks |
  | Tidecry Coast | Teardrop `#4dabf7` | slate `#4f6d7a`, moss `#5f8a6b` | lantern teal `#7fe7ff` | rainy cliffs, canals |
  | Prism Expanse | Glass `#b197fc` | sand `#d9c7a3` | crystal violet `#c9a7ff` emissive | flat dunes plus crystal spires |
  | Dreamveil Meadows | Moonbeam `#ffd43b` | meadow `#9ccc65`, gold `#e6c65a` | lantern warm `#ffe08a` | rolling hills, trees |
  | Hive Capital | neutral purple | stone `#b7a8d6` | spire glow `#a97bff` | central lake city |
- **Sky:** a gradient dome driven by real UTC time (dawn peach → day sky blue → dusk magenta → night indigo with stars). Distance fog uses the same color.
- **Readability first:** POI labels and Chog tokens must read at a glance. Labels are DOM overlays (`drei <Html>`) with a dark pill background, shown only above a zoom threshold.

## 2. World layout rules
- **Coordinates:** world units ≈ meters. The continent spans about **600 × 420** units, centered on the origin. y is up, and sea level is y = 0.
- **Regions:** four nations around the Hive Capital (center), with frontiers at the edges:
  - Emberforge: north-west
  - Tidecry: south-west, coastline
  - Prism: north-east
  - Dreamveil: south-east
  - Rug Coast / Pirate Isles: south-sea islands
  - The Hollow: a sunken crater, north
  - Frogsong Wetlands: east
  - Cloud Archipelago: floating islands above the center-north
  - Unminted Wastes: the far rim, kept dim
- **Terrain:** `height(x, z)` comes from seeded simplex noise (fbm) times a continent mask (radial falloff) plus per-region shaping (ridged peaks in Emberforge, crater in the Hollow, flattening in Prism, gentle hills in Dreamveil, a basin lake in the Capital). The same deterministic function runs on the server (to place POIs) and the client (to render the mesh). Never ship a heightmap file.
- **POIs:** every POI sits on the terrain at `height(x, z)`, never inside water (except docks and lighthouses, which sit on the shoreline). Minimum spacing is 9 units. Capitals have 4–8 sub-buildings, villages 2–4, and wild POIs 1 landmark.
- **Roads:** a minimum spanning tree over POIs plus about 25% of extra short edges. Draw them as flat ribbons slightly above the terrain.

## 3. Rendering rules (performance budget)
- **Draw calls < 150:** every repeated thing (trees, rocks, houses, crystals, Chog tokens) is ONE `InstancedMesh` per geometry/material pair.
- **Chog tokens:** a single `InstancedMesh` of camera-facing quads. A custom shader samples a **portrait atlas** (`public/atlas/chogs.webp`, a 64 px grid) using a per-instance `aAtlasIndex` attribute, and a per-instance house color draws the ring. One draw call for all 1,969.
- **Picking:** raycast the token InstancedMesh (`instanceId` → chog id). Throttle hover to pointer moves; never raycast every frame.
- **Motion:** positions update from the API about every 10 s. Lerp each instance toward its target in `useFrame` using `delta`, reusing a scratch `Object3D` and `Vector3` (never allocate in the loop).
- **Shadows:** one directional sun with a single 2048 shadow map covering the continent. Only buildings cast shadows; terrain receives.
- **dpr:** `[1, 1.75]`. Use `PerformanceMonitor` to drop to 1 on weak GPUs.

## 4. Camera and controls
- `MapControls` (pan with left drag, rotate with right drag, zoom with the wheel). Polar angle is clamped to 25°–70° so the camera never goes under the ground or straight down; zoom distance is 40–520.
- **Fly-to:** search `#1462`, a name, or a POI → smooth camera tween (damped lerp of target and position over about 1 s).
- Start framing: the whole continent at a 50° tilt, slowly drifting until the user interacts.

## 5. Game-feel checklist
- Hovering a Chog shows a name tooltip and lifts its token slightly.
- Clicking opens the **Status Window** side panel (blue "【STATUS】" style).
- Recent posts (last 2 ticks) float as **speech bubbles** above their authors, with at most 24 on screen, nearest to the camera first.
- Taverns get a warm point-light glow at night (a fake glow sprite, not real lights; at most 8 real point lights in the scene).
- Region names float large at far zoom and fade at near zoom; POI names do the opposite.
- The HUD (DOM, not WebGL) shows: clock and weather, population per region, search, a "find my Chogs" button, and a legend.

## 6. File map
| File | Purpose |
|---|---|
| `src/world/terrain.ts` | Seeded noise, `height(x, z)`, `regionAt(x, z)`, biome colors (shared by server and client) |
| `scripts/gen-world.ts` | Builds `data/world.json` (POIs, roads, region anchors) deterministically |
| `scripts/atlas.mjs` | Packs thumbnails into `public/atlas/chogs.webp` + `atlas.json` |
| `app/world/page.tsx` | Route with the HUD |
| `src/world/*.tsx` | R3F components: `Terrain`, `Water`, `Sky`, `Props`, `Pois`, `Roads`, `ChogSwarm`, `Bubbles`, `CameraRig` |
| `app/api/world/route.ts`, `app/api/world/positions/route.ts` | Static world JSON; live positions |
