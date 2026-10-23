// Checks the story graph: every symbol exists, every pointer is known, edges point at real nodes, and every beat
// renders (under every arc) without leftover markup. Prints the size of the story. Usage: npx tsx scripts/story-lint.ts
import { condNamesIn, expand, pointersIn, symbolsIn, type Env } from "../src/story/engine";
import { GRAPH, NODE_BY_ID } from "../src/story/chronicle";
import { JOB_BY_ID } from "../src/sim2/season";
import { LIFE_GRAMMAR, LIFE_NODES } from "../src/sim3/life";
import { EVENTS, STREAM_GRAMMAR } from "../src/sim3/narrate";

const JOBS = Object.keys(JOB_BY_ID).map((j) => `j_${j}`);
const POINTERS = new Set([
  "season", "arc", "king", "seals", "kingHp", "progress", "chogs", "g1", "g2", "g3", "g4", "r1", "r2", "r3", "r4",
  "w1", "w2", "w3", "w1job", "w2job", "w3job", "w1home", "w2home", "w3home", "townA", "townB", "townC", "dungeonA", "dungeonB",
  "firstQuester", "firstQuesterJob", "firstQuest", "firstQuestPlace", "questsDone", "raidsHeld", "raidsLost", "mostRaided", "mostRaidedCount",
  "raid_held", "raidTown", "raidSize", "raidDefender", "raidOutcome", "firstFallen", "firstFallenQuest", "partyA", "partyB", "partyQuest",
  "levelFive", "levelFiveJob", "nemesisA", "nemesisBoss", "underdog", "underdogJob", "traitor", "traitorJobA",
  "cand1", "cand2", "cand3", "cand1job", "cand2job", "cand3job", "rivalA", "rivalB", "rivalCount", "siegeTown",
  "giftChog", "giftName", "giftSponsor", "slayer", "slain", "slainRegion", "slayerJob", "slayerJobA", "slayerLevel", "slayerNemesis", "slayerRival", "slayerSponsor",
  "sealNo", "sealOrd", "sealOrdCap", "sealsLeft", "slayers", "hero", "heroJob", "heroJobA", "heroHome", "heroLevel", "hero_track", "heroCompanion", "heroRival", "heroSponsor",
  ...JOBS,
]);
const flags = new Set(GRAPH.nodes.flatMap((n) => n.sets ?? []));
const known = new Set([...POINTERS, ...flags, ...GRAPH.nodes.map((n) => `seen_${n.id.replace(/\W/g, "_")}`)]);
// Pointers that are legitimately absent in some seasons: they must sit inside [[cond|...]], carry a fallback, or the node must require them.
const OPTIONAL = new Set(["mostRaided", "mostRaidedCount", "rivalA", "rivalB", "rivalCount", "siegeTown", "firstFallen", "firstFallenQuest", "partyA", "partyB", "partyQuest",
  "levelFive", "levelFiveJob", "nemesisA", "nemesisBoss", "underdog", "underdogJob", "giftChog", "giftName", "giftSponsor", "slayerRival", "slayerSponsor", "slayerNemesis",
  "heroCompanion", "heroRival", "heroSponsor", "raidDefender", "firstQuester", "firstQuesterJob", "firstQuest", "firstQuestPlace"]);

// Pointers a trigger guarantees (the fact it fires on).
const GUARANTEED: [RegExp, string[]][] = [
  [/^quests_/, ["firstQuester", "firstQuesterJob", "firstQuest", "firstQuestPlace"]],
  [/^party_first$/, ["partyA", "partyB", "partyQuest"]],
  [/^ko_first$/, ["firstFallen", "firstFallenQuest"]],
  [/^level_/, ["levelFive", "levelFiveJob"]],
  [/^rival_first$/, ["rivalA", "rivalB", "rivalCount"]],
  [/^nemesis_first$/, ["nemesisA", "nemesisBoss"]],
  [/^underdog_first$/, ["underdog", "underdogJob"]],
  [/^siege_first$/, ["siegeTown"]],
  [/^gift_/, ["giftChog", "giftName", "giftSponsor"]],
  [/^hero$/, ["heroCompanion"].slice(0, 0)],
];
const guaranteed = (trigger: string | undefined) => new Set(GUARANTEED.filter(([re]) => trigger && re.test(trigger)).flatMap(([, l]) => l));

let errors = 0;
const err = (m: string) => { errors++; console.log("ERROR", m); };
const grammarKeys = new Set(Object.keys(GRAPH.grammar).map((k) => k.split("@")[0]));
const arcIds = new Set(GRAPH.arcs.map((a) => a.id));

for (const [k, list] of Object.entries(GRAPH.grammar)) {
  if (k.includes("@") && !arcIds.has(k.split("@")[1])) err(`grammar ${k}: unknown arc`);
  for (const alt of list) {
    const text = alt.replace(/^\?[^?]*\?/, "");
    for (const s of symbolsIn(text)) if (!grammarKeys.has(s)) err(`grammar ${k}: unknown symbol <${s}>`);
    for (const p of pointersIn(text)) if (!known.has(p) && !p.startsWith("w")) err(`grammar ${k}: unknown pointer {${p}}`);
  }
}

const ids = new Set<string>();
for (const n of GRAPH.nodes) {
  if (ids.has(n.id)) err(`duplicate node id ${n.id}`);
  ids.add(n.id);
  for (const a of [...(n.after ?? []), ...(n.afterAny ?? [])]) if (!NODE_BY_ID.has(a)) err(`${n.id}: after ${a} does not exist`);
  if (n.arc) for (const a of Array.isArray(n.arc) ? n.arc : [n.arc]) if (!arcIds.has(a)) err(`${n.id}: unknown arc ${a}`);
  if (!n.variants.length) err(`${n.id}: no variants`);
  for (const name of [...condNamesIn(n.requires), ...condNamesIn(n.unless)]) if (!known.has(name)) err(`${n.id}: unknown name in condition: ${name}`);
  for (const v of n.variants) {
    for (const name of condNamesIn(v.if)) if (!known.has(name)) err(`${n.id}: unknown name in variant condition: ${name}`);
    for (const s of symbolsIn(v.text)) if (!grammarKeys.has(s)) err(`${n.id}: unknown symbol <${s}>`);
    const bare = v.text.replace(/\[\[[^|\]]+\|[^\]]*\]\]/g, "").replace(/\{(\w+)\|[^}]*\}/g, "");
    for (const p of pointersIn(bare)) {
      if (!known.has(p)) err(`${n.id}: unknown pointer {${p}}`);
      else if (OPTIONAL.has(p) && !condNamesIn(n.requires).includes(p) && !n.trigger?.startsWith("seals_") && !guaranteed(n.trigger).has(p)) err(`${n.id}: optional pointer {${p}} used without [[ ]], fallback or requires`);
    }
  }
}

// Render every variant under every arc with a full env: no leftovers.
const env: Env = {};
for (const p of POINTERS) env[p] = `<${p}>`;
Object.assign(env, { season: 3, kingHp: 40, progress: 50, raid_held: true, hero_track: "craft", seal: [] });
let words = 0, variants = 0;
for (const arc of GRAPH.arcs) {
  for (const n of GRAPH.nodes) {
    if (n.arc && !(Array.isArray(n.arc) ? n.arc.includes(arc.id) : n.arc === arc.id)) continue;
    for (const [i, v] of n.variants.entries()) {
      const out = expand(v.text, { env: { ...env, arc: arc.id, betrayed: true, cost: true }, grammar: GRAPH.grammar, seed: `lint:${n.id}:${i}` });
      if (/[<>{}]|\[\[|\]\]/.test(out.replace(/<(\w+)>/g, ""))) err(`${n.id}[${i}] (${arc.id}): leftover markup: ${out.match(/.{0,30}[<>{}\[\]].{0,30}/)?.[0]}`);
      if (arc.id === GRAPH.arcs[0].id || n.arc) { words += out.split(/\s+/).length; variants++; }
    }
  }
}

// ---- Life graph ----
const LIFE_KEYS = new Set(["a", "name", "jobid", "job", "jobA", "track", "home", "level", "gold", "kills", "skillsN", "skillList", "titleName", "demon", "tier", "skull", "radio",
  "temper", "quirk", "dream", "fear", "motto", "food", "hobby", "secret", "talent", "quests", "fails", "held", "hurt", "raidsMade", "parties", "gifts", "trains", "trades",
  "gossips", "heals", "slays", "is_hero", "is_fallen", "ranked", "companion", "companionN", "friend", "rival", "nemesis", "sponsor", "seasonsPast", "heroSeasons", "pastSlays", "pastJobs",
  "p_season", "p_job", "p_jobA", "p_level", "p_quests", "p_fails", "p_slays", "p_hero", "p_demon"]);
const lifeEnv: Env = {};
for (const k of LIFE_KEYS) lifeEnv[k] = k === "demon" || k.startsWith("is_") || k === "ranked" || k === "skull" || k === "radio" || k === "p_hero" || k === "p_demon" ? true : 3;
Object.assign(lifeEnv, { tier: "Rare", temper: "Kind", track: "craft" });
const lifeIds = new Set<string>();
for (const n of LIFE_NODES) {
  if (lifeIds.has(n.id)) err(`duplicate life node ${n.id}`);
  lifeIds.add(n.id);
  for (const name of [...condNamesIn(n.requires), ...condNamesIn(n.unless)]) if (!LIFE_KEYS.has(name)) err(`${n.id}: unknown name in condition: ${name}`);
  for (const v of n.variants) {
    for (const sym of symbolsIn(v.text)) if (!(sym in LIFE_GRAMMAR)) err(`${n.id}: unknown symbol <${sym}>`);
    for (const p of pointersIn(v.text.replace(/\[\[[^|\]]+\|[^\]]*\]\]/g, ""))) if (!LIFE_KEYS.has(p)) err(`${n.id}: unknown pointer {${p}}`);
    for (const m of v.text.matchAll(/\{#(\w+) /g)) if (!LIFE_KEYS.has(m[1])) err(`${n.id}: unknown counter {#${m[1]}}`);
    const out = expand(v.text, { env: lifeEnv, grammar: LIFE_GRAMMAR, seed: `lint:${n.id}` });
    if (/[<>{}]|\[\[|\]\]/.test(out)) err(`${n.id}: leftover markup: ${out.match(/.{0,30}[<>{}\[\]].{0,30}/)?.[0]}`);
  }
}
for (const [k, list] of Object.entries(LIFE_GRAMMAR)) for (const alt of list) for (const sym of symbolsIn(alt)) if (!(sym in LIFE_GRAMMAR)) err(`life grammar ${k}: unknown symbol <${sym}>`);
const lifeWords = LIFE_NODES.reduce((s, n) => s + n.variants.reduce((t, v) => t + v.text.split(/\s+/).length, 0), 0)
  + [...Object.values(LIFE_GRAMMAR)].flat().reduce((s, t) => s + t.split(/\s+/).length, 0);

// ---- Stream events ----
const STREAM_KEYS = new Set(["a", "b", "place", "quest", "skill", "boss", "n", "job", "region", "qkind", "track", "jobid"]);
let streamLines = 0;
for (const [kind, list] of Object.entries(EVENTS)) for (const v of list) {
  streamLines++;
  for (const name of condNamesIn(v.if)) if (!STREAM_KEYS.has(name)) err(`stream ${kind}: unknown name in condition: ${name}`);
  for (const sym of symbolsIn(v.text)) if (!(sym in STREAM_GRAMMAR)) err(`stream ${kind}: unknown symbol <${sym}>`);
  for (const p of pointersIn(v.text)) if (!STREAM_KEYS.has(p)) err(`stream ${kind}: unknown pointer {${p}}`);
}
for (const [k, list] of Object.entries(STREAM_GRAMMAR)) for (const alt of list) for (const sym of symbolsIn(alt)) if (!(sym in STREAM_GRAMMAR)) err(`stream grammar ${k}: unknown symbol <${sym}>`);

const perArc = GRAPH.arcs.map((a) => {
  const nodes = GRAPH.nodes.filter((n) => !n.arc || (Array.isArray(n.arc) ? n.arc.includes(a.id) : n.arc === a.id));
  const w = nodes.reduce((s, n) => s + n.variants.reduce((t, v) => t + v.text.split(/\s+/).length, 0), 0);
  return `${a.id}: ${nodes.length} nodes, ${w} words of variants`;
});
const gWords = Object.values(GRAPH.grammar).flat().reduce((s, t) => s + t.split(/\s+/).length, 0);
console.log(`graph: ${GRAPH.nodes.length} nodes, ${GRAPH.nodes.reduce((s, n) => s + n.variants.length, 0)} variants, ${Object.keys(GRAPH.grammar).length} grammar symbols (${Object.values(GRAPH.grammar).flat().length} fragments, ${gWords} words)`);
console.log(perArc.join("\n"));
console.log(`life graph: ${LIFE_NODES.length} nodes, ${LIFE_NODES.reduce((s, n) => s + n.variants.length, 0)} variants, ~${lifeWords} words (plus ${Object.values(LIFE_GRAMMAR).flat().length} grammar fragments)`);
console.log(`stream: ${Object.keys(EVENTS).length} event kinds, ${streamLines} lines`);
console.log(`${errors} error(s)`);
process.exit(errors ? 1 : 0);
