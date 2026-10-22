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
  // Story threads (src/sim3/threads.ts)
  rivals_open: [
    "[THREAD] {a} and {b} have sparred again, and neither will admit the other is better. A rivalry is born.",
    "[THREAD] {a} and {b} have sparred twice now, and neither will admit the other is better. A rivalry is born.",
    "[THREAD] Every evening {a} finds {b} at the training ground. They call it practice. Everyone else calls it a rivalry.",
  ],
  rivals_grow: [
    "[THREAD] {a} and {b} keep score in chalk on the guild wall. The tally is suspiciously even.",
    "[THREAD] Bout after bout, argument after argument. {a} and {b} now train only to beat each other.",
  ],
  rivals_payoff: [
    "[THREAD] When {a} brought down {boss}, the first to cheer was {b}. Some rivalries end in a friendship.",
    "[THREAD] {a} struck down {boss}. Somewhere, {b} sighed, smiled, and started training harder.",
  ],
  nemesis_open: [
    "[THREAD] {boss} has knocked {a} out twice. {a} wakes in the temple with one name on their lips.",
    "[THREAD] Twice beaten by {boss}. {a} does not sleep that night. A nemesis is chosen.",
  ],
  nemesis_return: [
    "[THREAD] {a} is back in front of {boss}. This time, they don't flinch.",
    "[THREAD] Scarred but standing, {a} returns to face {boss} again.",
  ],
  nemesis_payoff: [
    "[THREAD] Revenge. {a}, beaten twice by {boss}, is the one who finally ends it.",
    "[THREAD] The third time, {a} won. {boss} will haunt no one again.",
  ],
  siege_open: [
    "[THREAD] {place} has been raided {n} times. Its people start building walls out of anything they can find.",
    "[THREAD] Smoke over {place} again. The town is under siege, and everyone knows it.",
  ],
  siege_payoff: [
    "[THREAD] Raid after raid, held. {place} is no longer a target; it is a fortress. {a} stood first on the wall.",
  ],
  sponsor_open: [
    "[THREAD] A star has chosen {a}. Others will be watching what they do with it.",
    "[THREAD] {a} looks up at the night sky and feels, for the first time, that someone up there is watching.",
  ],
  sponsor_step: ["[THREAD] {a} finished the task the stars set. The Constellation is pleased."],
  sponsor_payoff: ["[THREAD] The star that chose {a} was right: {a} brought down {boss}."],
  underdog_open: [
    "[THREAD] Nobody expected {a} among the Hero candidates. {a} didn't either.",
    "[THREAD] Not a knight, not a mage. Yet {a} now stands among the five most talked-about Chogs in Monadia.",
  ],
  underdog_payoff: ["[THREAD] The underdog did it. {a}, who was never meant to be a hero, brought down {boss}."],
};

export function narrate(kind: string, seed: number, vars: Record<string, string | number>): string {
  const list = T[kind] ?? [kind];
  const line = list[Math.abs(seed) % list.length];
  return line.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
