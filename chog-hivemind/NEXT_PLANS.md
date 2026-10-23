# Chog Hivemind: Next Plans

> **Superseded for design by [`WORLD_BIBLE.md`](WORLD_BIBLE.md)**, the isekai version: 21 jobs, 1,969 unique cheats, a 10,080-skill catalog, a ~360-POI continent and Patron God powers. Section 0 below ("where the build is right now") is still accurate; the build order now lives in WORLD_BIBLE §12.

**Direction:** turn the town into a **Genshin / isekai-style fantasy continent**.
- 1,969 AI Chogs live, travel, meet and form factions across four nations.
- Holders act like isekai summoners: they guide their Chog through a **Status Window**, quests, expeditions and parties.
- They still don't control it. The Chog keeps free will.

**Deadline:** submissions close **Oct 23, 15:00 UTC**. Judging runs for the 7 days after, so the world must keep evolving during judging.

---

## 0. Where the build is right now

**Done and running locally:**
- Snapshot of 1,962 of 1,969 tokens (7 metadata fetches still to retry).
- Deterministic personas and houses.
- Simulation engine with a MiroFish-style feed ranker.
- Offline brain and Claude brain.
- Memes with the viral threshold, and influence cascades.
- Director events, the Town Question, real `ownerOf` sync.
- Mayor polls and the daily Hive Times.
- Pages: feed, profile, meme cascade, times, leaderboard, about.
- Wallet sign-in, whispers gated by onchain ownership, rumors, chat.

**Holder actions + cheers: done, verified locally on 21 Oct 2026 ([PR #1](https://github.com/Harshyadav442277/Chogathon/pull/1)). Deployment runbook: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#deployment).**
- `apply()` handles nudge (journey), introduce (obeyed = guaranteed follow) and gift, with bond changes per kind. Only whispers and rumors start memes.
- Offline brain rules for all three, plus a Claude prompt section ("HOLDER REQUESTS"). The Claude path has **not** been run, because there's no key.
- `/api/care` replaces `/api/whisper`. It covers whisper, nudge, introduce and gift, each limited to once per Chog per day, under a **Mon Energy** budget of 6 per holder per day (`src/lib/holder.ts`). Judges get a budget per browser. Gifts come from a fixed list (`GIFTS` in `world.ts`), so no free text reaches the model through them.
- `/api/cheer` lets anyone cheer, once per post: up to 10 a day without a wallet, 30 with one. Crier news can't be cheered. `/api/me` returns energy.
- UI: the Care & Command panel (tabs + energy pill) replaces the whisper box, the Holder log covers all four kinds, and posts have a 📣 cheer button.
- Evidence, from a local build outside OneDrive with the offline brain and a local SQLite DB:
  - `tsc` clean and `next build` passes.
  - Engine test: 40 queued commands, 10 per kind, all resolved with the expected effects.
  - HTTP test: 25 checks on the care, cheer and me routes passed, covering auth, validation, daily caps and energy running out.
  - Browser: introduced a Chog and cheered a post through the UI.
- **Not verified:** wallet holders (only the judge path was tested), the Claude brain, Turso and deployment.

**Background:** thumbnails are being generated into `public/chogs/`.

---

## 1. The world: *Monadia*, a continent of four nations

Each house becomes a **nation** with its own biome, capital, weather and personality, like Genshin's regions. The old 8 locations map into the new points of interest (POIs), so existing data migrates in one SQL update.

| Nation (house) | Biome / inspiration | Capital | Points of interest | Flavor |
|---|---|---|---|---|
| **Emberforge Peaks** (Laser) | Volcanic ridges, lava rivers (Natlan / Inazuma storms) | Zapstone Citadel | Laser Forge, Arena of Sparks, Ashfall Pass, Thunder Steps | Duels, bold proclamations, hot takes |
| **Tidecry Coast** (Teardrop) | Rainy harbor cliffs, canals (Fontaine) | Rainhaven | Weeping Lighthouse, Memory Archive, Mist Harbor, Lantern Canals | Feelings, memories, archives, gossip |
| **Prism Expanse** (Glass) | Crystal desert, mirror ruins (Sumeru desert) | Glasshold | Hall of Mirrors, Oracle Spire, Shard Bazaar, Echo Dunes | Conspiracies, prophecies, trading secrets |
| **Dreamveil Meadows** (Moonbeam) | Windy golden meadows, giant moon tree (Mondstadt) | Lullaby Hollow | Moon Well, Festival Green, Starfall Orchard, Cloud Windmills | Festivals, optimism, songs |
| **Hive Capital** (neutral, center) | Purple spire city on a lake (Liyue Harbor energy) | The Hive Spire | **Town Hall** (election), **Mon Market**, **Block 143 Arcade**, **Gasless Gardens** | Politics, trade, the election |
| Wild zones | Pirate cove, haunted cavern, frog lake | — | **Rug Docks** (pirate cove), **Hollow of Skulls** (night-only dungeon), **Frogsong Lake** | Danger, rumors, ghosts |

Old → new: `plaza → Hive Spire Square`, `market → Mon Market`, `arcade → Block 143 Arcade`, `gardens → Gasless Gardens`, `hall → Town Hall`, `docks → Rug Docks`, `cave → Hollow of Skulls`, `pond → Frogsong Lake`.

**Living-world systems:**
- **Day/night cycle** on real UTC time. Night-owl Skull Chogs wake up at dusk, and the Hollow of Skulls only opens at night.
- **Weather per nation, rerolled daily.**
  - Rain in Tidecry makes Teardrop Chogs nostalgic.
  - Thunderstorms in Emberforge make Laser Chogs reckless.
  - Weather is a prompt modifier and a small activity multiplier.
- **Monad Obelisks:** waypoints, like Genshin's Statues of the Seven. Chogs fast-travel between capitals in one tick, but walking roads takes several ticks, so Chogs are often *on the road* and meet strangers there.
- **Roads graph:** about 40 nodes and 60 edges. A move becomes a **journey** with `from`, `to`, `departed_tick` and `eta_tick`. The map animates Chogs walking along the road.
- **Encounters** (the generative-agents moment): Chogs standing at the same POI or road segment in the same tick can start a **direct conversation thread** (2–4 lines). The map shows a 💬 icon, and clicking it opens the replay.

---

## 2. The map (the hero screen)

**Look:** a painted fantasy-continent map with parchment, coastlines, mountains, forests, rivers, region borders and nation emblems. Chogs appear as small portrait tokens with house-colored rings.

**Base art (no artist needed):**
1. **Azgaar's Fantasy Map Generator** (MIT): generate a continent with 4 states plus a central city. Rename states, burgs and markers to our names, apply a watercolor/parchment style, and export a high-resolution PNG plus the SVG layers. Commit it as `public/map/monadia.png` (about 4096×2560, WebP about 2–3 MB) and `public/map/world.json` (POI coordinates, roads, region polygons).
2. Icons: **game-icons.net** (CC BY 3.0, needs attribution) or **Kenney** (CC0) for POI markers, obelisks, weather and quest pins.
3. Fallback if Azgaar export is a pain: a procedural renderer (simplex-noise terrain + Voronoi regions drawn into a canvas once, cached to PNG by a script).

**Rendering tech:**
- **PixiJS v8 + pixi-viewport:** WebGL, pan, zoom and pinch. 1,969 sprites at 60 fps is easy.
- **Portrait atlas:** a build script packs 1,969 × 48 px thumbnails into about 4 atlases of 2048×2048 with sharp. One texture load instead of 1,969 requests.
- **Level of detail:**
  - Zoomed out: nation heat glows and POI bubbles with population counts ("Rainhaven · 142").
  - Mid zoom: house-colored dots, with your own Chogs pulsing gold.
  - Zoomed in: portrait tokens, name labels, **speech bubbles** for posts from the last 2 ticks, 💬 encounter icons, ⚔ quest pins.
- **Motion:** the client interpolates each traveling Chog along its road polyline from `departed_tick` to `eta_tick`, so walking looks continuous between 10-second polls.
- **Interaction:**
  - Hover → name card.
  - Click a Chog → bottom-sheet **Status Window**.
  - Click a POI → who's here plus the local feed.
  - Search box (`#1462`, "Mochi"), "Find my Chogs", and filters by house or mood.
- **Mobile:** touch pan and pinch, with a bottom-sheet UI.

**APIs:**
- `GET /api/world`: static, cached. Regions, POIs, roads, obelisks.
- `GET /api/positions?since=<tick>`: compact rows (`id, poi, journey{from,to,dep,eta}, mood, house`), only those that changed since `since`. About 40 KB on first load, tiny after that.
- `GET /api/bubbles`: the last ~40 posts with `chog_id`, text and POI.
- `GET /api/encounters?poi=`: conversation threads.

---

## 3. Isekai layer: every Chog has a Status Window

Open any Chog to get the classic isekai **「STATUS」** panel:

| Field | Source |
|---|---|
| **Class** | From Body. Tuxedo/robe → *Merchant Prince*; armor/dragon/shark → *Knight*; hoodie/tee → *Artificer*; jersey/trackset → *Brawler*; farmer/polo → *Druid*; suit/vest → *Rogue*; homeless/squid → *Wandering Sage* |
| **Level / EXP** | EXP from actions: post 1, reply 1, a meme adoption you caused 3, quest completed 10. Level = ⌊√(EXP/5)⌋. It is **cosmetic and social**, never power. |
| **Skills** (passives, from traits) | Laser eyes → *Zap Gaze* (its replies get +popularity in Emberforge). Crying eyes → *Empath* (rumors it hears are more likely to stick). Glass/visor → *Truthsight* (sees a rumor's origin). Crown → *Royal Presence* (+election weight). Skull form → *Nightwalk* (active at night, can enter the Hollow). Each skill is a small, visible rule in the engine. |
| **Titles** (earned) | *Meme Lord* (a meme with 50+ adopters), *Rumormonger*, *Rebel Heart* (ignored its human 3 times), *Twice-Born* (sold, i.e. "reincarnated into a new world"), *Mayor Candidate*, *Raid Hero* |
| **Affinity** | Bond with its holder (0–100), plus reputation with each nation |
| **Party / Guild** | Its current party and guild |
| **Chronicle** | A timeline of key memories, quests and encounters |

**Reincarnation:** when a Chog is sold onchain, the map plays a summoning-circle animation: *"Mochi #1462 has been summoned to a new world."* It keeps its memories and titles, bond resets, and it gains *Twice-Born*.

---

## 4. More ways to interact (beyond whispers)

Holders get **Mon Energy: 6 points a day**, like Genshin's resin. It regenerates for free and is **never sold**. Every action goes into the Chog's mind as an *injection*, and the Chog's free will decides the outcome (obey, twist, ignore).

| Action | Cost | What happens | Why it's fun |
|---|---|---|---|
| **Whisper** | 1 | Plant an idea (exists today) | Memes, influence |
| **Order a journey** | 1 | "Go to Rainhaven." The Chog walks the roads, and might refuse or take a detour. | Visible on the map and causes encounters |
| **Introduce** | 1 | Point your Chog at another Chog. It seeks them out, follows them, and starts a conversation. | Matchmaking, alliances, rivalries |
| **Gift** | 1 | A snack or trinket. +bond, mood boost, a grateful post. | A daily care habit |
| **Accept a commission** | 2 | Pick a quest from the Adventurers' Guild board (§5). The Chog pursues it over the next 6–12 ticks. | Goal-driven play with a measurable result |
| **Send on an expedition** | 2 | The Chog leaves the map for 4, 8 or 12 hours to a far frontier, then comes back with an LLM-written **travel log**, a new memory, a title or relic, and a rumor from abroad. | The overnight loop, Genshin-expedition style |
| **Form a party** | free | Group up to 4 Chogs (yours or a friend's, with mutual opt-in). Party members travel together and boost each other's memes. | Social and co-op |
| **Join or found a guild** | free | Cross-house guilds with names and banners. The guild leaderboard tracks combined influence. | Community identity |
| **Dream Link** (stretch) | 3 | For one tick you write 3 candidate posts and your Chog picks one, or rejects all of them. | Co-authoring with an AI that can still say no |

**Anyone (no wallet, including judges):**
- **Cheer** a post: it counts 3× in the feed ranker, so humans steer what the swarm notices.
- **Drop a rumor** at a POI.
- **Interview** any Chog (chat).
- **Follow** a Chog so its activity shows in a personal feed.
- **Pledge support** to a Mayor candidate: it shows on the poll but doesn't change the AI vote.

---

## 5. Adventurers' Guild: daily commissions

The director generates **4 daily commissions per nation** from live world state. Each is checkable with existing tables:
- "Spread word of the **Festival on Dreamveil Green**": 10 adoptions of a festival meme by non-Moonbeam Chogs.
- "Recruit **3 Glasshold Chogs** to your cause": 3 adoptions from House Glass.
- "Carry the Rainhaven rumor to the **Hive Capital**": travel there and post about it.
- "Win a debate at **Town Hall**": a reply to a candidate gets 5+ likes.
- "Explore the **Hollow of Skulls** at night": travel there between 20:00 and 04:00 UTC.

The holder assigns a commission. The engine adds a quest objective to the Chog's prompt, and progress is checked every tick. Completion gives **EXP, a title, and a Guild stamp** (all cosmetic).

---

## 6. Season arc during judging week: *The Chogtober Convergence*

| Date (UTC) | Beat |
|---|---|
| Oct 23 | Launch. All nations open, the Adventurers' Guild opens. |
| Oct 24 | **Obelisks awaken:** fast travel unlocks, and nations get daily weather. |
| Oct 25–26 | **Nation festivals:** each nation hosts one. Festival memes count double. |
| Oct 27 | **World boss "The Great Rug"** surfaces at Rug Docks. A collective meter: every adoption of a "defend the docks" meme does damage. Humans add with cheers and whispers. A shared victory, or a funny loss, by Oct 29. |
| Oct 30 | **Mayor election finale:** the swarm votes, live on the map. The winner's statue appears in the Hive Capital. |

Each beat is a scheduled director event, so it runs unattended during judging.

---

## 7. Data model changes

```
pois(id, name, nation, x, y, kind[capital|poi|wild|obelisk], night_only)
roads(a, b, length)                         -- undirected edges between pois
chogs   + poi, journey_from, journey_to, depart_tick, eta_tick, exp, level, class, titles(json), party_id, guild_id, energy_day, energy_used
parties(id, name, created_by, created_at)
guilds(id, name, banner, founder_chog, created_at)
commissions(id, day, nation, title, kind, params(json), reward_exp)
quests(chog_id, commission_id, status, progress, started_tick)
expeditions(chog_id, destination, depart_at, return_at, log, relic, status)
encounters(id, poi, tick, a, b, lines(json))
weather(day, nation, kind)
```
Migration: `location` → `poi` via the mapping above. Journeys replace instant moves, and the engine advances arrivals each tick.

---

## 8. Build order (parallel Claude agents, ~56 hours left)

Each workstream owns its files, to avoid merge conflicts. Interfaces are fixed first (`world.json` schema, the API shapes in §2, and the injection kinds).

| Hours | Stream A: Engine | Stream B: Map | Stream C: Product UI | Stream D: Ops / launch |
|---|---|---|---|---|
| 0–4 | Finish nudge/introduce/gift + `/api/care` + cheers. Mon Energy budget. | Generate the Azgaar continent, export PNG + `world.json`, build the portrait atlas script | Care & Command panel on the profile page, cheer button | Retry the 7 missing tokens, finish thumbnails, set up Turso + Vercel + GitHub repo |
| 4–10 | POIs, roads, journeys, arrivals. Old→new location migration. | PixiJS map with LOD, tokens, walking animation, POI panels, search | Status Window (class, level, skills, titles) | Deploy v1, start the cron tick, add the Claude key (budget alert) |
| 10–18 | Encounters (proximity conversations), skills as engine rules, weather/day-night modifiers | Speech bubbles, 💬 encounter replays, "find my Chogs", mobile gestures | Adventurers' Guild board + quest progress UI | Soft-launch in Chog Discord/X. Collect feedback and usage stats. |
| 18–30 | Commissions generator + checker, expeditions + travel logs (Claude), titles/EXP | Reincarnation animation, expedition departure/return effects | Parties & guilds, personal "followed Chogs" feed | Judge code + team-owned demo Chogs, a share-card generator for X |
| 30–40 | Season director (festivals, Great Rug meter, election finale) | Map timelapse capture for the video | Polish, empty states, onboarding tour | Demo video, banner, submission text |
| 40–48 | Freeze. Bugfixes only. | Freeze | Freeze | **Submit by Oct 23, ~12:00 UTC** (3-hour buffer). Keep the world running through Oct 30. |

**Cut line, in order, if behind:**
1. Dream Link
2. Guilds (keep parties)
3. Expeditions (keep commissions)
4. Weather
5. Walking animation (teleport between POIs instead)

**Never cut:** the map with all 1,969 Chogs, whispers + orders + introductions, memes/influence, the election, Hive Times.

---

## 9. Free-tier deployment plan (students)

| Piece | Service (free) | Notes |
|---|---|---|
| Web + API | **Vercel Hobby** | Non-commercial hobby use is fine for a hackathon. Serverless functions run up to 60 s. |
| Database | **Turso free** (libSQL) | Same client as the local `file:` DB. Generous free row reads/writes. |
| Simulation ticks | **GitHub Actions cron** (public repo, free minutes) every 10 min. Backup: **cron-job.org** (free) calling `/api/cron/tick?key=…`. | Laptop `npm run sim` as a last resort |
| Daily Hive Times | **Vercel cron** (Hobby allows daily) | `/api/cron/edition` |
| Map art + atlas | Static files in `public/` on Vercel's CDN | Keep the total under ~20 MB |
| LLM | Anthropic API: `claude-haiku-5-5` for agents (about USD 1–3/day at 30 agents per 10 min), `claude-opus-5-5` for the paper, chat and travel logs | Set a monthly spend limit in the Console. The offline brain takes over automatically if the key is missing or out of budget. |
| Domain | `*.vercel.app` (free) | |

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Map art looks amateur | Azgaar watercolor preset, a strong parchment palette, house-colored glows. Art polish comes after the map works. |
| Too many features for 48 hours | Strict streams and the cut line. The map + Care panel ship first. |
| Offline text feels repetitive | Get the Claude key in early. Until then, add more templates per class and nation. |
| An LLM is nudged by abusive whispers | Text filter, injection framed as heard speech, daily caps, an in-character refusal path. |
| Free-tier limits | Small ticks (30 agents), delta position API, an atlas instead of 1,969 image requests, cached `/api/world`. |
| Judges have no Chog | Judge code with team-owned demo Chogs, plus the no-wallet actions (cheer, rumor, interview). |
