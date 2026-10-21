# Team decisions

Keep a short shared record of agreed decisions. This file contains project history for both authors.

| Date | Decision | Reason |
| :--- | :--- | :--- |
| 2026-10-18 | Prepare rules and a simple folder structure only | Current requested scope |
| 2026-10-18 | Publish this repository publicly on GitHub | Requested sharing method |
| 2026-10-18 | Leave the idea, project name and tech stack undecided | To be agreed later |
| 2026-10-18 | Keep event facts in RULES.md and submission preparation in SUBMISSION.md | Give both authors one place to update each |
| 2026-10-21 | Idea chosen: **Chog Hivemind**, an AI society where every Chog Genesis NFT is an agent; code lives in [chog-hivemind/](../chog-hivemind/) | Replaces the "undecided" rows above. Picked over a learning-duel battler because the posted entries already include several trait-based battlers |
| 2026-10-21 | Add **Monadia**, a 3D isekai world map (React Three Fiber) as the main view, at `/world` | Requested by the user; design in [chog-hivemind/WORLD_BIBLE.md](../chog-hivemind/WORLD_BIBLE.md) |
| 2026-10-21 | Stack: Next.js 15, libSQL (local file / Turso), Claude API with an offline fallback brain, three.js via React Three Fiber | Free-tier deployable; runs without an API key |
| 2026-10-21 | Installed MIT-licensed Three.js skills from OpenAEC Foundation into `.claude/skills/`, plus project skills `swarm-sim` and `isekai-world-3d` | Requested by the user; license kept in `.claude/skills/THREEJS_SKILLS_LICENSE` |
| 2026-10-21 | **Agreed:** rebuild the client in Godot 4.7.2 (3D, web export) as an isekai god-sim with jobs, adventurer roles, Demon King seasons and Constellation players; see [GODOT_GAME_PLAN.md](GODOT_GAME_PLAN.md) | Requested by the user; answers recorded in §12 of that plan |
| 2026-10-21 | Installed 32 skills from gamedev-skills/awesome-gamedev-agent-skills (Apache-2.0) into `.claude/skills/` | Requested by the user; LICENSE and NOTICE kept alongside |
| 2026-10-21 | Godot de-risk gate **passed locally**: Godot 4.7.2 single-threaded web export served at `/play` renders the continent and all Chogs, calls the API, opens the Status Window. Directional shadows disabled (they over-brightened the Compatibility renderer) | Continue with the Godot client; keep three.js `/world` until deployed |
| 2026-10-21 | Two-developer split: A = landscape + buildings (`feat/world`), B = characters (`feat/characters`); file ownership and contract in [WORKSPLIT.md](WORKSPLIT.md) | Parallel work without merge conflicts |
| 2026-10-21 | Buildings and props are generated procedurally in Godot (`game/scripts/catalog.gd`) instead of downloading Kenney kits | No downloads or licensing, about +0.45 MB to the web build, shapes fit each job |
| 2026-10-21 | Positions feed: Chogs at work stand outside their job's building (new additive `building` field) and never in water | Makes jobs visible on the map |
| 2026-10-21 | Enterable interiors for 25 mid/large building types, with a story panel per building | Requested by the user: interiors that go along with the story |

When a decision changes, add a new dated row explaining what replaced it.
