# Simulation prototype plan: the Demon King season

Agreed 2026-10-21 (the user asked for a working prototype with scaled-down numbers and left the gameplan to us).
Builds on [GODOT_GAME_PLAN.md](GODOT_GAME_PLAN.md) §4–6. Deadline: 23 Oct 15:00 UTC.

## 1. The loop in one sentence
Every Chog is an agent with a job, stats, skills and a state; each server tick every agent works, wanders, takes quests,
meets others or fights. Demons raid towns and guard dungeons. Players (NFT holders) nudge any Chog a few times a day with
skills and quests. The world converges on the Demon King's defeat, and the Chog who lands the final blow, of any job,
becomes the Hero of the season.

## 2. Factions (1,969 NFTs)
| Group | Count | Where | Notes |
|---|---|---|---|
| Demon King | 1 | Demon castle | Sealed until the four generals fall. Huge HP pool. |
| Demon Generals | 4 | One dungeon each, in four nations | Boss HP; each death breaks one seal |
| Henchmen: imps, dark knights, cultists | 195 | Dungeons and the demon realm | Raid towns; can be defeated (knocked out, return next day) |
| Everyone else: the 31 existing jobs | 1,769 | Their workplaces and towns | Any of them can become the Hero |

Quotas of the existing jobs are scaled down so the total stays 1,969. Jobs re-roll every season.

## 3. Agents
State per Chog (table `agents`): `state` (work, idle, quest, fight, rest, raid), anchor (workplace building or place),
`quest`, quest progress and required effort, `skills` (ids), HP, level and XP (in `chog_season`), kills, story points.

Every tick, each agent:
1. **Rest:** injured Chogs (HP 0) rest at a temple or tavern and recover.
2. **Quest:** progress += speed. Speed = base × (1 + matching skill tags × 0.35) × (1 + level × 0.04) × stat fit.
   A good skill match makes a quest finish in about half the time, a poor one about 1.6× as long. On completion:
   XP, gold, story points, and for boss quests, damage to a general or the Demon King.
3. **Otherwise**, a weighted choice: keep working (XP), wander the town, take a quest from the guild board
   (adventurers often, everyone else sometimes, so any job can rise), or meet a Chog nearby
   (train, trade, gossip, heal, form a party).
4. **Demons:** henchmen raid a random town each tick; Chogs present defend (power comparison, seeded randomness).

## 4. Season phases (director)
1. **Summoning:** jobs assigned, the guild opens.
2. **Dungeons:** generals appear; quests to clear floors and fight generals.
3. **Seal:** each general that falls breaks a seal (4 seals).
4. **March:** seal broken; parties attack the Demon King (shared HP).
5. **Hero:** final blow → Hero of Season N, Hall of Heroes, then a new season (jobs re-roll).

The season length is configurable (`SEASON_HOURS`, default 168). The director scales boss HP to the live power curve so
the King can't fall before 85% of the season, and a "Last Stand" boost stops it lasting past the end.
`npm run season:sim` fast-forwards a whole season offline to prove it converges.

## 5. Libraries (scaled down for the prototype)
- **60 skills** (`data/skills.json`): 6 schools (Blade, Bulwark, Arcane, Holy, Craft, Wild) × 10, with tags, rank,
  power and quest-speed bonuses.
- **36 quests** (`data/quests.json`): gather, craft, hunt, escort, explore and boss types across tiers, each with
  required tags, effort, location kind and rewards.

## 6. Players
- **Stargazers** (no wallet) watch everything live: every agent's state, quest and log, the Star Stream, the season bar.
- **Constellations** (wallet holding ≥ 1 Chog, or judge mode) get **3 Star Points a day** (reset 00:00 UTC) to:
  - **Grant a skill** from the library to *any* Chog (max 6 skills per Chog);
  - **Give a quest** to *any* Chog (it starts on the next tick; its skills decide how long it takes).
- Every gift is narrated in the Star Stream.

## 7. Narration
Text is template-driven ("pre-written text with logic, like old games"): per event type, several sentence patterns
filled with names, places, skills and outcomes, seeded so it reads varied. No model is needed; Claude is used for
posts only when a key is set.

## 8. Client
- **Placement:** anchors are valid ground spots outside building footprints, water and fountains.
- **Movement:** each Chog wanders around its anchor, alternating walking and standing still.
- **Looks:** demon outfits (horns, dark armour), a larger Demon King and larger generals.
- **States:** work, fight and idle animations.
- **HUD:** season bar (phase, seals, Demon King HP, hero candidates) and a Status Window with level, HP, skills, quest
  progress and recent log. A Constellation panel offers Grant Skill and Give Quest.

## 9. Execution order (cut from the bottom if late)
1. Data: demon jobs, quotas, skills, quests.
2. Server sim: schema, tick, director, battles, narration, player APIs, positions with state and anchors.
3. Fast-forward check that a season converges.
4. Client: placement, wandering, demon looks, HUD, Status Window, player panel.
5. Docs, commit, web build.
6. **Deploy (Vercel + Turso):** needs the team's accounts; see [GAPS.md](GAPS.md).
