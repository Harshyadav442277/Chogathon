# Project scope

Status: in progress (agreed 2026-10-21, see [MEMORY.md](MEMORY.md)). Full design: [WORLD_BIBLE.md](../chog-hivemind/WORLD_BIBLE.md).

## Project

| Field | Value |
| :--- | :--- |
| Name | Chog Hivemind: Monadia |
| Target user | Chog Genesis holders, plus anyone curious (no wallet needed to watch, chat or drop rumors) |
| What the user can do | Watch 1,969 AI Chogs live on a 3D fantasy continent; click any Chog to see its Status Window; holders whisper to their own Chog (it may obey, twist or ignore); anyone can drop rumors and chat with any Chog |
| What stops working without the Chog NFT | Everything: each citizen *is* a token. Traits generate its personality and house, memories are keyed to the token ID, only the holder (checked with `ownerOf` on Monad) can whisper, and the society is exactly the collection |
| Smallest complete demo | Open `/world`, find a Chog, open its Status Window, whisper as its holder, see the response in the feed and the idea spread as a meme |

## Features

Weights from [RULES.md](../RULES.md#judging).

| Feature | Criterion | Proof in the demo | Status (local) |
| :--- | :--- | :--- | :--- |
| 3D continent with 9 regions, 203 places, roads, all Chogs placed as portrait tokens | Novelty, Fun | `/world` renders; tokens show real Chog art | Works locally |
| Agent simulation: posts, replies, reposts, follows, moves, memories | Novelty, Retention | Feed and speech bubbles change every tick | Works locally (offline brain) |
| Whisper with free will (obey / twist / ignore) | Novelty, Fun | Whisper log on the profile shows the response | Built; gated by `ownerOf`, not yet tested with a real holder wallet |
| Memes, influence cascades, Mayor poll | Retention | `/meme/:id` cascade, `/leaderboard` | Works locally |
| Rumors and chat for non-holders | Clarity, Fun | Rumor box, chat box | Works locally (offline replies without an API key) |
| Daily Hive Times | Retention | `/times` | Works locally (offline template) |
| Status Window, search and fly-to in 3D | Clarity, Execution | Search "Mochi" → camera flies → panel opens | Works locally |

## Season simulation prototype (2026-10-22, see [SIM_PLAN.md](SIM_PLAN.md))
| Feature | Judging criterion it serves |
|---|---|
| All 1,969 Chogs are agents (work, wander, quest, meet, fight, rest), including a Demon King, 4 generals and 195 henchmen | Novelty, Chog NFT essential |
| Season arc: generals break the seals, march on the castle, any job can land the final blow and become Hero | Fun, Retention (a new season re-rolls jobs) |
| Constellation powers: 3 Star Points a day to grant skills (60) or give quests (36) to any Chog; skills change how long quests take | Retention, Chog NFT essential (holders only) |
| Live view: season bar, Star Stream chronicle, Status Window with quest progress, skills and recent actions | Clarity |
| Template narration (no model needed); deterministic, seeded mechanics; fast-forward check `npx tsx scripts/season-sim.ts` | Execution |

## Out of scope for the deadline

Jobs, unique cheats and the 10,080-skill catalog from WORLD_BIBLE.md (planned, not built), $CHOG integration, real-time multiplayer, mobile-native apps.

## Existing work and attribution

All application code was written during the event (from 2026-10-20). Reused: open-source libraries listed in `chog-hivemind/package.json`; Three.js skill documents from OpenAEC Foundation (MIT); Chog artwork and metadata are read from the Chog Genesis collection on Monad. Design ideas reference MiroFish (AGPL-3.0, pipeline concepts only, no code copied).
