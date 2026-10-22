// Template narration for the season simulation: pre-written lines with slots, picked by a seed so the
// Star Stream reads varied without any model. {a} / {b} are Chog names, {place}, {quest}, {skill}, {boss}, {n}.

const T: Record<string, string[]> = {
  quest_start: [
    "{a} took \"{quest}\" from the guild board and set off for {place}.",
    "{a} pinned \"{quest}\" to their pack and headed to {place}.",
    "\"Someone has to do it,\" said {a}, accepting \"{quest}\".",
  ],
  quest_done: [
    "{a} completed \"{quest}\" at {place}. (+{n} XP)",
    "\"{quest}\": done. {a} returns from {place} a little stronger. (+{n} XP)",
    "The guild stamps \"{quest}\" complete. {a} earned {n} XP.",
  ],
  quest_fail: [
    "{a} was knocked out during \"{quest}\" and carried back to the temple.",
    "\"{quest}\" was too much for {a} today. They'll be back.",
  ],
  level_up: ["{a} reached level {n}!", "Level {n}! {a} feels the stars watching.", "{a} levelled up to {n}."],
  boss_hit: [
    "{a} struck {boss} for {n} damage!",
    "{a} landed a blow on {boss} ({n} damage).",
    "{boss} roars as {a} hits for {n}.",
  ],
  general_down: [
    "[SEAL BROKEN] {boss} has fallen to {a}! {n} of 4 seals are broken.",
    "[SEAL BROKEN] {a} defeated {boss}. The Demon King's castle trembles ({n}/4 seals).",
  ],
  march: ["[SCENARIO] All four seals are broken. The march on the Demon King's castle begins!"],
  hero: [
    "[HERO] {a} the {job} landed the final blow. The Demon King is defeated! {a} is the Hero of Season {n}.",
  ],
  last_stand: ["[SCENARIO] Last Stand: the stars burn bright. Every blow against the Demon King now strikes three times as hard."],
  raid_start: [
    "[RAID] {n} demons pour out of the dark toward {place}!",
    "[RAID] Imps and dark knights are raiding {place} ({n} attackers)!",
  ],
  raid_won: [
    "[RAID] {place} held! {a} and the defenders drove the demons back.",
    "[RAID] The demons broke against {place}'s defenders. {a} fought bravely.",
  ],
  raid_lost: [
    "[RAID] {place} was overrun. {n} defenders were hurt; the demons withdrew with loot.",
    "[RAID] Smoke over {place}: the demons won this night ({n} hurt).",
  ],
  train: ["{a} and {b} sparred in {place}.", "{b} showed {a} a few tricks in {place}.", "{a} trained with {b} until sunset."],
  trade: ["{a} traded with {b} in {place}.", "{a} sold {b} a sturdy pack.", "{b} and {a} haggled loudly in {place}."],
  gossip: [
    "{a} told {b}: \"I heard {boss} is getting stronger.\"",
    "{a} and {b} argued about who will become the Hero.",
    "{b} whispered to {a} about a secret path into the dungeon.",
  ],
  heal: ["{a} healed {b}'s wounds.", "{a} patched {b} up in {place}."],
  party: ["{b} joined {a} on \"{quest}\".", "{a} and {b} formed a party for \"{quest}\"."],
  gift_skill: [
    "[CONSTELLATION] A star granted {a} the skill \"{skill}\".",
    "[CONSTELLATION] \"{skill}\" was carved into {a}'s Status Window by a watching star.",
  ],
  gift_quest: [
    "[CONSTELLATION] A star gave {a} the quest \"{quest}\".",
    "[CONSTELLATION] {a} received a scenario from the stars: \"{quest}\".",
  ],
  season: ["[SCENARIO] Season {n} begins. 1,969 Chogs are summoned to Monadia, and somewhere a Demon King awakens."],
};

export function narrate(kind: string, seed: number, vars: Record<string, string | number>): string {
  const list = T[kind] ?? [kind];
  const line = list[Math.abs(seed) % list.length];
  return line.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
