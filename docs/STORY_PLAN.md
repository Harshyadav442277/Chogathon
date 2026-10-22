# Story plan: history, threads and the season novel (no AI)

Agreed 2026-10-21. Everything is deterministic: the same isekai every season, told with that season's characters and
events. Text is pre-written prose with **pointers** (slots) filled from the simulation. No language model is used anywhere.

## 1. Movement
- When the simulation sends a Chog far away (quest site, dungeon, castle, home), it **appears there** (spawn) instead of
  walking across lakes and rivers.
- **Local roaming** stays: around its spot each Chog keeps moving and pausing, so nobody stands frozen. Short roams
  check that the whole step stays on dry ground.

## 2. Chog history (kept across seasons)
Table `chog_history`: one structured row per meaningful moment in a Chog's life (`kind`, `season`, `tick`, related
Chog, quest or skill, and the rendered sentence):
summoned (with job), title earned, level milestones, quest completed or failed, raid defended or hurt, first blow on a
boss, boss slain, Hero, gift received (and from which Constellation), friend or rival made, thread payoffs.

Table `season_archive`: per season the Hero, the generals' slayers, the top Chogs and the Constellations who sponsored
them (the Hall of Heroes).

The Status Window gets a **Life** section: a short biography assembled from the history (pointers into fixed
sentences), and a timeline of the latest moments.

## 3. Story threads (character arcs)
Table `threads`: arcs that open, advance and pay off, each with fixed lines per stage:
| Thread | Opens | Advances | Pays off |
|---|---|---|---|
| Rivals | two Chogs spar three times | they keep competing | one saves the other in a raid, or both reach a general |
| Nemesis | a Demon General knocks a Chog out twice | the Chog trains and returns | it lands a blow on, or slays, that general |
| Siege | a town is raided twice | raids continue; rebuild quests | the town holds three raids in a row |
| Sponsored | a Constellation gifts a Chog | the gift is used in a quest | that Chog slays a general or becomes Hero |
| Underdog | a non-adventurer enters the top hero candidates | stays there | it becomes Hero or slays a general |

## 4. The season novel: *The Monadia Cycle*
About 14 fixed chapters, written once as prose with pointers. Each is triggered by a milestone and filled with the
names, places and numbers of the moment it happens:
1. **The Summoning** (season start), 2. **The Guild Opens** (first quests completed), 3. **Smoke on the Horizon**
(first raid), 4. **The Generals Wake** (dungeon phase), 5–8. **The Fall of …** (each general), 9. **The March**,
10. **Last Stand** (if needed), 11. **The Final Blow** (Hero), 12. **Epilogue**, plus interludes at 25%, 50% and 75% of
the season (top candidates, most-raided town, longest friendship).

Stored per season in table `novel` and served by `/api/v2/novel`; a **Chronicle** reader in the HUD shows the chapters
written so far.

## 5. Order
1. Spawn + roaming. 2. History + Life view. 3. Threads. 4. Novel + reader. 5. Docs, commit, web build.
