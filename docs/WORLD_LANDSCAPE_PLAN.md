# Monadia landscape and buildings: build plan (Developer A, `feat/world`)

Written 2026-10-21. Owner: Developer A. **Status: built locally 2026-10-21** (511 buildings, 4,174 props, 76 roads, 129 places; web build data pack 4.9 MB). Rendering checked natively and in headless Chrome; not deployed. Contract with the character work: [WORKSPLIT.md](WORKSPLIT.md).

## 1. Continent shape
The single ellipse is replaced by a **designed continent built from region "lobes"** (warped discs that merge). The gaps between them become bays and fjords; extra small discs become islands.

| Region | Where | Landscape type | Signature features |
|---|---|---|---|
| **Emberforge Peaks** (House Laser) | North-west | **Volcanic badlands** | **Mount Cinderheart**, the volcano: an 85-unit cone with a crater, glowing lava flows down five channels, ash fields, black rock, dead trees, a smoke plume |
| **Tidecry Coast** (House Teardrop) | South-west | **Rainy coast** | Sea cliffs, dense pine forests, the River Weeping to a delta, lighthouse point |
| **Prism Expanse** (House Glass) | North-east | **Crystal desert** | Dunes, flat-topped mesas, giant crystal spires, an oasis with palms |
| **Dreamveil Meadows** (House Moonbeam) | South-east | **Golden meadows** | Rolling hills, flower fields, lakes, round golden trees, windmills, the Moonlit River |
| Hive Capital | Centre | Lake basin | The city ring around Spire Lake, the Hive Spire on its island, the Royal River south to the sea |
| The Hollow | North | Sunken crater | Bone spikes, glowing mushrooms |
| Frogsong Wetlands | East | Marsh | Lagoons, reeds, lily pads |
| Rug Coast & Pirate Isles | South sea | Islands | 5–7 small islands, docks |
| Unminted Wastes | West rim | Rocky waste | Mesas, ruins |
| **Demon Realm** | Far north, across the **Bridge of Liquidation** | Cursed land | Dark spikes, a purple glow, the **Demon King's Castle** on a plateau |

**Rivers** are polylines carved below sea level, so the sea fills them.

**Colors** come from region plus height plus slope bands: beach sand, grass or forest, rock, snow on high non-volcanic peaks, black volcanic rock. **Lava is stored in the vertex alpha channel** and the terrain shader makes it glow and flicker.

## 2. Settlements: about 300 buildings
| Place | Count | Layout |
|---|---|---|
| Hive Capital | ~55 | Spire on the lake island; Royal Castle, Guild HQ, Grand Library, Academy, Grand Temple, Colosseum, Market; a ring of shops; houses |
| 4 nation capitals (Zapstone Citadel, Rainhaven, Glasshold, Lullaby Hollow) | ~40 each | City Hall keep in the centre → ring 1: barracks, guild hall, temple, library, academy → ring 2: smiths, alchemist, store, tavern, restaurant, bakery, flower shop, toy shop, tailor, jeweler, post office, stables → ring 3: houses → walls with 4 gates and towers |
| Towns and villages | ~70 | Farms with barns and windmills, mines, fisheries, lumber mills, a tavern, houses |
| Frontier | ~20 | Lighthouse, docks, dungeon gates, waypoint obelisks, the Demon King's Castle |

- **Building types (one type per job workplace):** castle, keep, barracks, guild_hall, blacksmith, weaponsmith, armorsmith, alchemist, general_store, library, academy, temple, tavern, restaurant, bakery, flower_shop, toyshop, tailor, jeweler, market, post_office, stables, farm, mine, fishery, lumberyard, plus house_small, house_large, windmill, tower, wall, gate, dock, lighthouse, obelisk, dungeon, demon_castle, colosseum, spire, fountain.
- **Each type is built procedurally in Godot** (walls, roofs, chimneys, windows, signs, awnings, domes) as one vertex-colored mesh. Every copy of a type is a single `MultiMesh`, so roughly 40 draw calls for every building.
- **Windows and signs glow at night**, again via the vertex alpha channel.

## 3. Nature props (~7,000, instanced per type)
Pine, oak, golden round tree, palm, dead tree, rock, boulder, crystal, flower patch, reeds, lily pad, glow mushroom, bone spike, lava rock, demon spike. They're placed by the generator, per biome, avoiding buildings, roads and water.

## 4. Roads
Roads run from the capital to the nation capitals, the towns and the frontier, drawn as flat dirt ribbons that hug the ground.

## 5. Chogs at their real workplaces (shared `data.ts`, additive)
- At "home", a Chog stands **outside the building of its job type** in its nation's capital: a blacksmith at a blacksmith, an adventurer at its nation's guild hall, a farmer at a farm.
- When the simulation sends it elsewhere, it goes to that place, as before.

## 6. Files
- `chog-hivemind/src/world/terrain.ts`: continent v2 (shape, regions, volcano, rivers, colors, lava)
- `chog-hivemind/scripts/gen-world.ts`: places, cities and building plots, props, roads → `data/world.json` (also copied to `game/data/`)
- `chog-hivemind/scripts/export-terrain.ts`: height plus color plus lava grids → `game/data/*.bin`
- `game/scripts/terrain.gd` and `game/shaders/terrain.gdshader`: mesh with lava glow
- `game/scripts/architect.gd`: procedural mesh builder for building and prop types
- `game/scripts/settlements.gd`: buildings, props, roads and labels from `world.json`
- `game/shaders/water.gdshader`: animated water

## 7. Building detail and interiors (added 2026-10-21)
- **Exterior detail:** every house-style building has a stone foundation, timber corner posts and floor beams, a framed door with step and lamp, framed windows with sills and region-tinted shutters, side windows, roof trim and a ridge beam.
- **Interiors:** click an enterable building to open a cutaway room with its own camera.
  - Built procedurally by `game/scripts/interior_catalog.gd` and shown by `game/scripts/interiors.gd`.
  - Enterable (25 types): tavern, guild hall, blacksmith, weaponsmith, armorsmith, alchemist, general store, library, academy, temple, keep, castle, barracks, restaurant, bakery, flower shop, toy shop, tailor, jeweler, colosseum, spire (Election Hall), Demon King's throne room, dungeon, post office, market.
- **Who's inside:** the Chogs whose workplace is that building, as round NFT portraits wandering around the room. Click one for its Status Window.
- **Story panel:** `GET /api/v2/building/:id` (`chog-hivemind/src/world/buildings.ts`) returns the building's story beat (tied to the season and the region's Demon General), who works there with job titles, and overheard posts.
- **Leaving:** Esc or the Back button.

## 8. Level of detail (added 2026-10-21)
- **Terrain:** the height/color grid is now 641 x 561 (about 1.4 units per cell, double the old resolution). `game/scripts/terrain.gd` splits it into 64 x 64-cell chunks. Each chunk has three meshes: full detail within 170 units of the camera, half detail within 360, quarter detail beyond. Meshes are built on demand, two per frame. Skirts hide cracks between neighbouring detail levels.
- **Ground cover:** full-detail chunks add grass tufts on green ground and pebbles on sand and rock. They are hidden once the camera moves away.
- **Shader detail:** `game/shaders/terrain.gdshader` adds colour patches, speckle and grain that fade out with distance, plus an animated foam line on the shore.
- **Buildings:** above a camera height of 250, buildings switch to simple stand-ins and small props are hidden.
- **Flat cities:** the four capitals sit on fixed sites (`CITY_SITES` in `chog-hivemind/src/world/terrain.ts`). The ground is flattened under each one, so buildings and roads no longer float or sink on slopes.
- **Measured natively (Intel integrated GPU):** wide view about 36–45 fps; mid zoom 60 fps with 103 draw calls; Zapstone close-up 56 fps with 117 draw calls. The web pck grew from 4.96 MB to 6.8 MB.

## 9. Close-up detail pass (added 2026-10-21)
- **No more blocky ground:** terrain chunks use smooth per-vertex normals and blended per-vertex colors instead of flat-shaded cells.
- **Procedural surface textures, no downloaded art:**
  - All noise comes from one baked 256 x 256 tileable texture, `game/textures/noise.png` (made by `game/tools/make_noise.py`). Each noise lookup is a single mipmapped texture read, which keeps it fast and stops distant shimmer.
  - **Ground** (`terrain.gdshader`): grass blades with lush and dry patches and tiny wildflowers; dirt with pebbles; sand ripples; rock strata on steep slopes. Bump lighting on all of them, fading out with distance.
  - **Buildings and props** (`vcol.gdshader`): every surface carries a material tag (`Architect.M_*` in UV2) for brick with mortar, plaster with grime and exposed-brick patches, wood planks with grain and knots, overlapping roof shingles with moss, leaves, bark, cracked mossy rock, cloth. Also contact shading near the ground and wind sway on leaves.
- **Geometry:**
  - Houses get diagonal timber braces, barge boards on the roof edges, flower boxes, a plank door and wooden shutters.
  - New near meshes: jagged layered pines; clustered, wobbly oak and gold-tree canopies with branches and root flares; curved palms with drooping fronds; irregular rocks and boulders with moss caps; flower patches on stems.
  - Ground cover is now bent grass-blade tufts that sway in the wind, flower clumps and irregular pebbles. It uses its own double-sided shader, `grass.gdshader`, and shrinks away smoothly 55–95 units from the camera.
- **Level of detail per instance:** buildings within 190 units and props within 150 units of the camera use detailed meshes; everything else uses the cheap versions. Swapping happens inside one near and one far MultiMesh per type, so draw calls don't grow. Tiny props are not drawn when far.
- **Camera:** the look-at point now follows the ground height and the camera never goes below the terrain. Minimum zoom distance is 14 (was 25), so close-ups are reachable.
- **Measured natively (Intel integrated GPU, 1440 x 900, after 12 s warm-up):**
  - Committed build before this pass: Zapstone view 37 fps.
  - After this pass: 32–37 fps there (runs vary about ±5 fps). Street close-up 35, forest 33–36, meadow 30–31, wide view 32–34.
  - Wide view uses 157 draw calls, over the 150 budget (90 of them are terrain chunks).

## 10. Checks
- Native and web screenshots: wide view, mid zoom over a capital, close-up of the volcano.
- Draw calls under 150.
- Headless import and run show no errors.
- Load size stays under about 16 MB with Brotli.
