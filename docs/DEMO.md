# Demo and verification

Status: local tests only. No deployment or demo video yet.

## Access

| Field | Value |
| :--- | :--- |
| App URL | Not deployed. Local: http://localhost:3000/world |
| Prerequisites | See [ARCHITECTURE.md](ARCHITECTURE.md#local-setup) |
| Demo video | Not recorded |

Keep any private judge credentials in the event form, outside this repository.

## Exact demo steps

| Step | Exact action | Expected result | Verified result |
| :--- | :--- | :--- | :--- |
| 1 | Open `/world` | Continent with region names, capitals and Chog portrait tokens; the HUD shows UTC time, tick and Chog count | Local, 2026-10-21: renders, 1,962 Chogs, no page errors (Playwright, headless Chrome) |
| 2 | Type "Mochi" in search, pick the first result | Camera flies to that Chog; the Status Window shows name, house, location, stats, latest memory | Local, 2026-10-21: panel filled with token #149 details |
| 3 | Click a place label (e.g. a tavern) | Place panel lists the Chogs currently there | Built; not yet checked in an automated test |
| 4 | Drop a rumor on the home page | Within one tick a nearby Chog obeys, twists or ignores it; obey/twist creates a meme | Local, 2026-10-20: rumor twisted and became meme #2 (test database) |
| 6 | Open `/play` (Godot web build) | Continent, labels, Star Stream and all Chog tokens render; clicking a Chog opens the Status Window with its season job, title, level and stats | Local, 2026-10-21: passes in headless Chrome (WebGL 2, single-threaded build); token #111 showed "Petal Picker (Florist)", Hollow of Skulls |
| 5 | Connect a wallet holding a Chog and whisper to it | Whisper queued; the response appears in its whisper log | Ownership gate verified to reject a non-holder (HTTP 403); not tested with a real holder |

## Verification record

| Check | Environment and date | Result and evidence |
| :--- | :--- | :--- |
| Setup from a fresh clone | Not run | To do before submission |
| Complete judge journey | Local only, 2026-10-21 | Steps 1, 2, 4 and 6 pass locally |
| Network failure behavior | Not run | Offline brain covers a missing API key; chain or IPFS outages not tested |
| Deployed demo | Not run | No deployment yet |
| Chibi characters (`feat/characters`, steps 1–2: static bodies, portrait face, picking) | Local native Godot 4.7.2, opengl3, 1440×900, 2026-10-21; not the web build | All 1,962 Chogs render as chibis with their own portrait. `-- --select=181` gives the gold ring and opens the Status Window ("Waffle the Wise", Main DPS, Hollow of Skulls). A temporary picking self-check hit 34 of 34 on-screen Chogs. A standalone probe drew 1,969 instances in **1** draw call. In the full game, counts vary by frame (40 shown vs 43 hidden), so the per-frame difference can't be pinned down there. Character update: 2 µs avg when nobody moves. **Not yet measured:** cost while Chogs walk, and the web build. Headless `--import` and `--quit-after 300`: no errors |
| Chibi walking (`feat/characters`, step 3: constant-speed walking, facing direction, leg/arm swing and bob in the shader) | Local native Godot 4.7.2, opengl3, 1440×900, 2026-10-21; not the web build | With `-- --walk-test --perf`, all 1,962 Chogs walk at once: character update **avg ~0.8 ms, max 1.4 ms per frame** at about 600 FPS, after spacing out terrain-height lookups. Before that change it was 1.3 ms avg, 2.8 ms max. Walkers arrive and drop out of the update (1,962 → 1,720 during the log). Live path: one `npm run tick -- 1 --offline` during play moved 1 Chog, and the client walked it (`walking 1`, about 12 µs per frame). A screenshot shows arms and legs mid-swing. **Not measured:** the web build. WebAssembly GDScript will be slower than native, so the 3 ms budget still has to be checked there. Headless checks: no errors |
| Work and fight animations (`feat/characters`, step 4; needs the `track` field from PR #2) | Local native Godot 4.7.2, opengl3, 2026-10-21, after merging `main` (world v2); not the web build | Work loops per job track: hammer (craft), bow (service), dig (land), salute (civic) and sword drill (adventurers in town). Fight: lunge, shake, and a red/white flash on hit. All of it is shader-only, so the CPU cost is unchanged. Window recordings (ffmpeg gdigrab, 3 s): **fight** at Hollow of Skulls clearly shows lunges and ring flashes; **dig** at Lower Cloverstead shows the heads leaning. **Weak point:** at mid zoom, raised arms sit behind the portrait head, so the work types are hard to tell apart. The hammer, salute and drill motions were made bigger after the recordings and have not been re-recorded. Headless `--import` / `--quit-after 300` and the native shader compile: no errors |
| Role props and job tools (`feat/characters`, step 5) | Local native Godot 4.7.2, opengl3, 2026-10-21; not the web build | All props are in the one chibi mesh (still 1 draw call). Adventurers carry their role prop (sword, daggers, shield, staff, book, banner). Civilians carry their track's tool (hammer, tray, shovel, spear). Props are tall so they poke out past the portrait. Screenshots: at Lower Cloverstead, farmers' shovels show in the dig pose. At Hollow of Skulls, trays and spears are clear. Nearby counts from the API (21 service, 6 civic, 10 craft, 18 adventurers) fit what is visible. I did not check every one of the 10 props one by one. **GPU cost (desktop GPU, 1440×900, whole continent in view):** frame time 1.82 ms with characters hidden, 2.10 ms with characters without props, 2.72 ms with props. So the characters cost ~0.3 ms without props and ~0.9 ms with them. Skipping the pose math for hidden props made no measurable difference, so I took it out. **Risk:** integrated laptop GPUs and the web build are not measured. If they are too slow, a shared 'pole + head' prop shaped per Chog in the shader would cut prop vertices to about a third. Headless checks: no errors |
