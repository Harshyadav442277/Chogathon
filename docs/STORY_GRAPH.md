# The story graph

One small, deterministic engine ([`chog-hivemind/src/story/engine.ts`](../chog-hivemind/src/story/engine.ts)) tells every story in ChogSekai: the season novel (the Chronicle), each Chog's life story, and the Star Stream lines. There is no model: the text is pre-written, but it is organised as a graph with grammar and seeded randomness, so no two seasons or Chogs read alike while every story still obeys its graph.

| Story | Data | Walker | What varies |
|---|---|---|---|
| **The Monadia Cycle** (Chronicle) | [`data/story/`](../chog-hivemind/data/story): `arcs`, `spine_*`, `arc_*`, `interludes_*`, `grammar_*` | [`sim3/novel.ts`](../chog-hivemind/src/sim3/novel.ts) | The season's premise (8 arcs), which optional beats are told, which variant of each, who plays each role |
| **Life stories** | `life_a`, `life_b`, `life_past` + the trait/temperament tables in [`sim3/lore.ts`](../chog-hivemind/src/sim3/lore.ts) | [`sim3/life.ts`](../chog-hivemind/src/sim3/life.ts) | NFT traits, job, season record, relationships, past lives |
| **Star Stream** | `stream_a`, `stream_work` | [`sim3/narrate.ts`](../chog-hivemind/src/sim3/narrate.ts) | Quest kind, job track, job, event |

## Nodes (beats) and edges

A graph is a list of nodes. A node says **when** it can happen and **what it sets**:

| Field | Meaning |
|---|---|
| `trigger` | A milestone: `season_start`, `progress_N`, `seals_N`, `phase_2`, `phase_3`, `last_stand`, `hero`, `season_end`, `quests_N`, `level_N`, `king_hp_N`, `first_raid`, `party_first`, `ko_first`, `gift_first`, `gift_5`, `rival_first`, `nemesis_first`, `siege_first`, `underdog_first` |
| `after` | Node ids that must already have happened (all of them): the graph's edges |
| `afterAny` | At least one of these must have happened |
| `requires` / `unless` | A condition over the story state, e.g. `hero_track=craft && !traitor` |
| `arc` | Only for this premise (or list); omitted means every premise |
| `slot` | Beats in the same slot compete: only one is told (weighted, seeded). This is how a raid that held and a raid that fell are two beats in one slot |
| `chance` | 0..1: the share of seasons in which an optional beat is told (stable per season) |
| `weight` | Preference inside a slot |
| `sets` | Flags added to the state when told; later beats can require them (`betrayed`, `cost`, `mentor_lynx`...) |
| `variants` | The text: several alternatives, each with an optional `if`; one is chosen by seed, and never the one used by the same beat in the previous season |
| `repeat` | Expands a node for `{n}` = 1..4 (the four seals) |

Conditions are `name`, `!name`, `name=value`, `name!=value`, `name>n`, `>=`, `<`, `<=`, joined with `&&` and `||`.

## Text

Expanded in this order, all seeded by season + node id (or Chog id):

| Syntax | Meaning |
|---|---|
| `<symbol>` | A grammar fragment: one of several alternatives, recursively expanded. `symbol@arc` alternatives join the pool when that premise is active, so one beat reads in the voice of the season. An alternative may start with `?cond?` |
| `{=a\|b\|c}` | One of the inline alternatives |
| `[[cond\|text]]` | Kept only when the condition holds (a bare name means "has a value") |
| `{pointer}` / `{pointer\|fallback}` | A value from the simulation: a Chog's name, a place, a number |
| `{#key one/many}` | The number and the right word (`3 quests`) |
| `*text*` | Italics (the game converts it) |

A name such as `Cashew the Quiet #1260` is written in full the first time in a text and shortened to `Cashew` afterwards.

## The Chronicle graph

Every season picks a **premise** (arc) from the eight, never one of the last three, by seed (Season 1 is the Lantern): *The Lantern at the Crossroads* (portal fantasy, a long winter, a guardian who returns), *The Morning That Kept Returning* (one Chog remembers every ending), *The Quiet Throne* (the war from the demon castle), *The Small Thing That Grew* (a nobody founds a nation), *The Maligned* (a rumour, and the way back), *The Gate That Would Not Open* (Status Windows and a locked world), *The Worst Party in Monadia* (a comedy of errors) and *The Hidden Quest* (the stars hand one nobody a quest log). These are original stories that use the shapes of well-known portal and isekai fantasy; no names, characters or text come from any other work.

The **spine** is shared by every arc and is written with the grammar, with case variants:

```mermaid
flowchart TD
  start([season_start]) --> prem{{premise: 1 of 8 arcs}}
  prem --> world[world / rules]
  world --> guild[guild opens]
  guild --> party[first party] & ko[first knock-out]
  world --> raid{first raid}
  raid -->|held| rh[raid held]
  raid -->|lost| rl[raid lost]
  world --> gen[generals wake]
  gen --> ally{ally slot}
  ally --> twist{twist slot}
  twist -->|betrayal / secret / cost| crisis[crisis]
  crisis --> rise[the turn]
  gen --> seal1[seal 1..4]
  seal1 -->|slayer was a nemesis / rival / sponsored / plain| seal2[...]
  rise --> march[phase 3: the march]
  march --> ls[last stand]
  ls --> hero{hero}
  hero -->|adventurer / craft / civic / service / land| h[who they were]
  hero --> climax[arc climax]
  climax --> end([epilogue])
```

Beyond the spine: ~45 optional interludes (market day, a bad batch of bread, the smith's masterpiece, the miner's find, a night without swords...), most keyed to a job (`{j_baker}`, `{j_blacksmith}`, `{j_healer}`...), each told in some seasons only.

## Life stories

For one Chog the walker collects facts: NFT traits (eyes, mouth, head, accessory, tier, skin, background), job and track, this season's record (quests, knock-outs, raids, parties, gifts, level, gold, skills), relationships (companion, friend, rival, nemesis, sponsor), and past lives. Sections are told in order: **Before the Summoning**, **The Summoning**, **This Season**, **Bonds**, **What People Say**, **Legacy**, then **Past Lives**. Origin and rumours are stable for a Chog (seeded by id); the season sections change as the Chog's season does. Epithets ("Sealbreaker", "the Stubborn", "Star-Touched"...) are earned from the record.

## Adding content

1. Add nodes or grammar to a file in `data/story/`.
2. `cd chog-hivemind && npx tsx scripts/story-lint.ts`: checks that symbols and pointers exist, edges point at real nodes, optional pointers are guarded, and every beat renders under every arc with no leftover markup. It prints the size of the story.
3. `TURSO_DATABASE_URL=file:data/season-sim.db npx tsx scripts/story-preview.ts` after `npx tsx scripts/season-sim.ts 200` shows a simulated season's chapters and sample life stories.

## Size (check date 2026-10-23, from the lint script)

See the output of `scripts/story-lint.ts` for the current numbers.
