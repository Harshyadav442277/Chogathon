// Generates data/skills.json (60 skills) and data/quests.json (36 quests) for the season simulation.
// Deterministic: names and flavour are hand-written lists; numbers follow from rank / tier.
// Run: node scripts/gen-library.mjs
import { writeFileSync } from "node:fs";

// --- Skills: 6 schools x 10, ranks 1 (F) .. 5 (S) -----------------------------------------------------
// tags decide which quests a skill speeds up; power adds to combat; speed is the quest-speed bonus.
const SCHOOLS = {
  blade: { tags: ["combat", "melee"], names: [
    "Quick Slash", "Twin Cut", "Riposte", "Cleave", "Whirlwind", "Moonfang Edge", "Thousand Cuts", "Dragonsplitter", "Blade Dance", "Sword Saint's Stance"] },
  bulwark: { tags: ["defense", "combat"], names: [
    "Brace", "Shield Wall", "Taunt", "Iron Skin", "Guardian's Oath", "Bastion", "Unbreakable", "Aegis of Dawn", "Last Bastion", "Fortress Heart"] },
  arcane: { tags: ["magic", "lore"], names: [
    "Spark", "Frost Bolt", "Arcane Missile", "Fireball", "Chain Lightning", "Mana Shield", "Meteor Call", "Time Skip", "Gravity Well", "Starfall"] },
  holy: { tags: ["heal", "faith"], names: [
    "Mend", "Bless", "Purify", "Sanctuary", "Holy Light", "Revive", "Divine Shield", "Smite the Unclean", "Choir of Stars", "Miracle"] },
  craft: { tags: ["craft", "trade"], names: [
    "Haggle", "Quick Hands", "Sturdy Build", "Master Forge", "Potion Brewing", "Enchanting", "Rune Carving", "Golem Assembly", "Philosopher's Touch", "Legendary Craft"] },
  wild: { tags: ["survival", "scout"], names: [
    "Forage", "Track", "Camouflage", "Beast Friend", "Eagle Eye", "Trailblazer", "Pathfinder", "Storm Rider", "Wild Heart", "Spirit of the Forest"] },
};
const FLAVOR = {
  blade: "A sword technique.", bulwark: "A defensive art.", arcane: "A spell from the academy.",
  holy: "A prayer the temples teach.", craft: "A trade secret.", wild: "A wilderness skill.",
};
const RANKS = ["F", "E", "D", "C", "B", "A", "S"];
const skills = [];
for (const [school, def] of Object.entries(SCHOOLS)) {
  def.names.forEach((name, i) => {
    const rank = 1 + Math.floor(i / 2); // 1..5, two skills per rank
    skills.push({
      id: `${school}_${i + 1}`,
      name,
      school,
      tags: def.tags,
      rank: RANKS[rank],
      tier: rank,
      power: 4 + rank * 5,          // added to combat power
      speed: +(0.15 + rank * 0.07).toFixed(2), // quest speed bonus when a tag matches
      desc: `${FLAVOR[school]} Rank ${RANKS[rank]}: +${4 + rank * 5} power; quests needing ${def.tags.join(" or ")} go ${Math.round((0.15 + rank * 0.07) * 100)}% faster.`,
    });
  });
}

// --- Quests: 6 kinds x 5 tiers + 4 generals + 1 seal + 1 king ------------------------------------------
// effort is in "work units"; an average level-1 Chog without matching skills does ~1 unit per tick.
const KINDS = {
  gather: { tags: ["survival", "scout"], site: "wild", names: ["Herbs by the River", "Moonmoss Harvest", "Crystal Shards", "Phoenix Feathers", "Starlight Dew"] },
  craft: { tags: ["craft", "trade"], site: "town", names: ["Mend the Town Gate", "Arm the Militia", "Forge Guild Blades", "Brew the Siege Potions", "Build the Seal Engine"] },
  hunt: { tags: ["combat", "melee"], site: "wild", names: ["Slime Trouble", "Wolf Pack at the Pass", "Ogre on the Road", "Wyvern Nest", "The Abyssal Hound"] },
  escort: { tags: ["defense", "faith"], site: "town", names: ["Escort the Baker's Cart", "Pilgrims to the Temple", "Caravan to the Capital", "Guard the Royal Envoy", "The Last Refugees"] },
  explore: { tags: ["scout", "lore"], site: "dungeon", names: ["Map Floor One", "The Whispering Corridor", "Sunken Library", "The Mirror Halls", "Heart of the Labyrinth"] },
  cleanse: { tags: ["faith", "magic"], site: "dungeon", names: ["Bless the Well", "Banish the Will-o'-Wisps", "Purge the Cursed Shrine", "Break the Blood Totem", "Silence the Abyss Choir"] },
};
const quests = [];
for (const [kind, def] of Object.entries(KINDS)) {
  def.names.forEach((name, i) => {
    const tier = i + 1;
    quests.push({
      id: `${kind}_${tier}`, name, kind, tags: def.tags, tier, site: def.site,
      effort: 6 + tier * 6, xp: 20 * tier, gold: 8 * tier, story: tier,
      desc: `A tier ${tier} ${kind} quest. Chogs with ${def.tags.join(" or ")} skills finish it faster.`,
    });
  });
}
const GENERALS = [
  ["general_emberforge", "Face the General of Liquidation", "emberforge"],
  ["general_tidecry", "Silence the Drowned Archivist", "tidecry"],
  ["general_prism", "Shatter the Mirror Wraith", "prism"],
  ["general_dreamveil", "Wake from the Nightmare Shepherd", "dreamveil"],
];
for (const [id, name, region] of GENERALS) {
  quests.push({ id, name, kind: "boss", tags: ["combat", "defense"], tier: 6, site: "dungeon", region, boss: "general",
    effort: 30, xp: 200, gold: 60, story: 8, desc: "Strike at a Demon General. Every blow wears down its HP; when it falls, one seal breaks." });
}
quests.push({ id: "seal_ritual", name: "Read the Broken Seals", kind: "boss", tags: ["lore", "faith"], tier: 6, site: "town", boss: "seal",
  effort: 24, xp: 150, gold: 30, story: 6, desc: "Study the broken seals so the march on the castle can begin." });
quests.push({ id: "demon_king", name: "Storm the Demon King's Castle", kind: "boss", tags: ["combat", "magic", "heal"], tier: 7, site: "castle", boss: "king",
  effort: 40, xp: 400, gold: 120, story: 15, desc: "The final battle. The Chog who lands the last blow becomes the Hero of the season." });

writeFileSync(new URL("../data/skills.json", import.meta.url), JSON.stringify({ version: 1, skills }, null, 1));
writeFileSync(new URL("../data/quests.json", import.meta.url), JSON.stringify({ version: 1, quests }, null, 1));
console.log(`${skills.length} skills, ${quests.length} quests`);
