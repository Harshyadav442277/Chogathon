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

When a decision changes, add a new dated row explaining what replaced it.
