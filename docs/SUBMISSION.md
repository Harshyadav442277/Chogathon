# Submission preparation

Status: **draft text written 2026-10-22, not submitted.** No event entry has been submitted or verified through this repository setup.

Deadline: **23 October 2026, 15:00 UTC / 8:30 pm IST.** Use the [official dashboard](https://chogathon.chog.xyz/dashboard). Check [RULES.md](../RULES.md) for the complete event reference.

Every claim below is backed by [DEMO.md](DEMO.md). Before pasting, re-check anything marked **(check)**.

## Entry information

| Field | Value |
| :--- | :--- |
| Project name | ChogSekai |
| Team members and public X / Discord handles | GitHub: Harshyadav442277, avaramahmood. X / Discord handles: **to fill** |
| Description, maximum 8,000 characters | See [Description](#description) below |
| Why the Chog NFT is essential | See [Why the Chog NFT is essential](#why-the-chog-nft-is-essential) below |
| Working app URL | https://chogsekai.vercel.app/play |
| Demo video, maximum three minutes | **To record**; outline in [Video outline](#video-outline) |
| Banner | **To add** in `assets/` (the key art is the obvious choice; its source and rights need confirming first) |
| Repository | https://github.com/Harshyadav442277/Chogathon |
| Tech stack | See [Tech stack](#tech-stack) below |
| Pre-existing work and attribution | See [Existing work and attribution](#existing-work-and-attribution) below |
| Actual feedback or usage | None recorded. State this plainly; do not count our own test wallets or judge-code sessions |
| Next steps | See [Next steps](#next-steps) below |
| Optional go to market plan, maximum 8,000 characters | Skip unless time allows |

Put the contact email and private judge access instructions directly into the organizer only form fields. Judge instructions allow up to 8,000 characters. Do not store private values here.

## Description

> **ChogSekai: every Chog Genesis NFT is summoned into a fantasy world, and you are a star watching over them.**
>
> All 1,969 Chog Genesis NFTs live as agents on Monadia, a 3D fantasy continent you can explore in the browser. Every Chog gets a job each season, one of 31: smiths, cooks, farmers, miners, guards, administrators, and adventurers in party roles (main DPS, sub DPS, tank, healer, support, buffer). They walk to work and do their jobs in their own outfits with their own tools. They form parties, take quests, spar, and fight. 200 of them are the Demon King's faction: the King, four Generals and their henchmen.
>
> **A season is a story with an ending.** The Generals fall one by one and the seals break. Then the army marches on the Demon King's castle. Whichever Chog lands the final blow becomes the Hero of the season, and it can be a farmer as easily as a knight. Then a new season starts, every job re-rolls, and the Chogs remember what happened before.
>
> **You play as a Constellation, a god who can only nudge.** If you hold a Chog, you get 5 Star Pulls per season, unlocked over the course of the season. Each pull shows four cards (skills or quests) and you choose one to bestow on a Chog you hold. Skills change how fast your Chog finishes quests. Quests send it somewhere new. You don't control your Chog directly; you shape its odds and watch what it does with them.
>
> **Everything is written down.**
> - The **Star Stream** narrates the world live: parties forming, raids, sparring, gossip, and your gifts arriving.
> - Click any Chog to open its **Status Window**: NFT portrait, job, level, HP, stats, skills, current quest and recent actions.
> - **Life** tells that Chog's biography across seasons: its summoning, quests, companions, titles and greatest moment.
> - **The Monadia Cycle** is a 29-chapter season novel that writes itself as the season unfolds, starring the season's real Chogs.
>
> **Anyone can watch without a wallet.** Open the link, press Enter Monadia, zoom into a town, and click a Chog. Holders sign a free message (no transaction, no gas) to start pulling.
>
> **Why come back:** a new season every day, new jobs, a new Hero, a new chapter of the novel, and five new pulls. Your Chog's history carries over, so every season adds to its story.
>
> Built during Chogathon 2026: a Godot 4 web client streaming from a Next.js simulation server that ticks the whole world every 10 minutes.

Length: about 2,400 characters, well under the 8,000 limit.

## Why the Chog NFT is essential

> The world *is* the collection. There are exactly 1,969 citizens because there are 1,969 Chog Genesis tokens (contract `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` on Monad). Each Chog's portrait is its NFT art, and its stats and history are keyed to its token id. Only a wallet that holds a Chog (checked live on Monad with `balanceOf` / `ownerOf`) can use Star Pulls, and gifts can only be bestowed on Chogs that wallet holds. Without the NFT you can watch; with it, you have a hand in the story.

**(check)** Holder sign-in has not been tested with a real holder wallet yet (only judge mode and a non-holder rejection). Test before submitting, or soften the wording.

## Tech stack

> Godot 4.7.2 (GDScript, Compatibility renderer, single-threaded web export) for the 3D client; Next.js 15 / TypeScript for the simulation server and APIs; libSQL on Turso for the world state; viem for Monad on-chain ownership checks; wallet sign-in by signed message; Vercel hosting; GitHub Actions running the world tick on a schedule. Terrain, buildings and characters are generated procedurally in code; the main theme and UI sounds are synthesized in code.

## Existing work and attribution

> All application code was written during the event; the repository's first commit is 2026-10-18. Reused: open-source libraries (see `chog-hivemind/package.json`) and the Godot engine; Chog artwork and metadata are read from the Chog Genesis collection on Monad. Music: the main theme and UI sounds are original; four tracks are from Free To Use (Aylex: Guardians, Glorious, Dark Frequency; Pufino: There Be Dragons), credited in the README and in game. The season novel is original prose; its shape is a homage to classic portal fantasy, with no names, characters or text from any other work. Agent-design ideas reference MiroFish (concepts only, no code). AI coding assistants were used during development.

**(check)** Where the key art came from and whether we may publish it. **(check)** Whether the rules require any specific AI-tool disclosure; keep the last sentence either way.

## Next steps

> Bring a language model back into the agents so Chogs talk and scheme in their own voice (the server already supports it; the live world runs on templates). Let holders whisper to their own Chog. Optional $CHOG integration for the bonus. Season archives and a Hall of Heroes page. Mobile controls.

## Judge access instructions (private field; do not commit the code)

> 1. Open https://chogsekai.vercel.app/play on a desktop browser, wait for the loading screen, and press **Enter Monadia**.
> 2. The top-left bar shows the season: phase, seals, the Demon King's HP. The Star Stream (bottom left) narrates live.
> 3. Scroll to zoom into a town (it takes a lot of scrolling), for example The Hive Capital in the middle, then click any small Chog to open its Status Window. Press **Life** for its biography.
> 4. Press **Chronicle** (top right) to read this season's chapters of *The Monadia Cycle*.
> 5. Press **Star Pulls**, enter the judge code `<code from Vercel env JUDGE_CODE>` and press **Judge sign-in**. Pull, choose one of the four cards and bestow it on one of the judge Chogs. The gift takes effect on the next world tick (every 10 minutes or so) and appears in the Star Stream and the Chog's Status Window.

**(check)** The judge Chog ids in Vercel (`JUDGE_CHOG_IDS`; DEPLOY.md lists 173, 681, 875, 1007, 1420). **(check)** Ticks currently arrive every 3–5 hours, not 10 minutes (see GAPS.md); fix that or change "every 10 minutes" in step 5 and in the description.

## Video outline

Max 3 minutes; upload unlisted to YouTube or Drive (anyone with the link, Viewer) and open it while signed out.

1. 0:00–0:20: key art, title, "every Chog Genesis NFT lives in this world".
2. 0:20–0:50: the continent from above, then zoom into a town: Chogs working in their outfits, a party at the guild.
3. 0:50–1:20: click a Chog: Status Window, Life.
4. 1:20–2:00: Star Pulls: sign in, pull, choose a card, bestow; the next tick narrates it in the Star Stream.
5. 2:00–2:30: season bar, Generals, Demon King; Chronicle chapter.
6. 2:30–3:00: "a new season every day, your Chog's story carries over"; URL.

## Final checks

Use the Status column to track completion. These are team preparation checks based on the official deliverables.

| Check | Status |
| :--- | :--- |
| Existing registration and team membership confirmed | Open |
| One designated teammate owns the single project submission | Open |
| Description explains the working experience and what is new | Drafted 2026-10-22 |
| Essential Chog NFT behavior explained and demonstrated | Explained; holder sign-in not yet demonstrated |
| Working demo and exact testing instructions verified | Signed-out journey verified on the deployed site 2026-10-22 (DEMO.md); Star Pulls with the judge code not yet re-checked in the browser |
| Video is at most three minutes and opens while signed out | Open |
| Repository link, stack and existing work disclosed | Drafted 2026-10-22 |
| Banner and other shared assets are appropriate to publish | Open (key art source) |
| Real feedback reported accurately, or lack of feedback stated | Drafted: none recorded |
| Contact email and any private access details supplied in the form | Open |
| Submitted entry re-opened and confirmation recorded | Open |

## Submission record

| Field | Value |
| :--- | :--- |
| Submitted by | Not submitted |
| Submitted at, including timezone | Not submitted |
| Entry URL | Not available |
| Confirmation evidence | Not available |

A prepared repository, uploaded video or saved draft does not confirm an event submission. Record success evidence after the final submission action.
