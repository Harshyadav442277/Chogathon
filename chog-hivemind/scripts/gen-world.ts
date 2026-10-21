// Build data/world.json for Monadia v2: places (POIs), cities with building plots, roads and nature props.
// Deterministic from SEED. Also copies the result to ../game/data/world.json for the Godot client.
//   npm run gen:world
import { copyFileSync, writeFileSync } from "node:fs";
import {
  DEMON_PLATEAU, forestAt, height, HOLLOW_CRATER, isLand, lavaAt, mulberry32, regionAt, REGION_BY_ID, REGIONS,
  riverDist, SEED, SPIRE_LAKE, VOLCANO, WORLD_D, WORLD_W, type RegionId,
} from "../src/world/terrain";

export type PoiKind = "capital" | "district" | "town" | "village" | "tavern" | "wild" | "dungeon" | "obelisk" | "dock" | "lighthouse";
export type Poi = { id: string; name: string; kind: PoiKind; region: RegionId; x: number; y: number; z: number; legacy?: string; city?: string };
export type Building = { id: number; type: string; name: string; city: string; region: RegionId; x: number; z: number; rot: number; s: number };

const rand = mulberry32(SEED * 7);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

const pois: Poi[] = [];
const buildings: Building[] = [];
const blocked: { x: number; z: number; r: number }[] = []; // footprint discs (cities, buildings)

const free = (x: number, z: number, r: number) => blocked.every((b) => Math.hypot(b.x - x, b.z - z) >= b.r + r);
const landAround = (x: number, z: number, rad: number, n = 16) => {
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (height(x + Math.cos(a) * rad, z + Math.sin(a) * rad) > 1.6) ok++;
  }
  return ok / n;
};
const flatness = (x: number, z: number, rad: number) => {
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const h = height(x + Math.cos(a) * rad, z + Math.sin(a) * rad);
    lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  return hi - lo;
};

// ---------------------------------------------------------------- shop / building names
const SHOP_NAMES: Record<string, string[]> = {
  blacksmith: ["The Ember Anvil", "Hammer & Hearth", "Sparkforge Smithy", "Old Iron Works"],
  weaponsmith: ["Blades of the Brave", "The Sharp Chog", "Edge & Hilt"],
  armorsmith: ["Iron Shell Armory", "The Sturdy Plate", "Bulwark & Co."],
  alchemist: ["Bubbling Cauldron", "The Green Candle Lab", "Potions of the Pond", "Mirage Elixirs"],
  general_store: ["Mon Market Goods", "Everything Store", "The Pocket Emporium", "Supplies & Snacks"],
  library: ["Grand Library", "Archive of Echoes", "House of Pages"],
  academy: ["Academy of Arcana", "Refraction Academy", "School of the Stars"],
  temple: ["Temple of Good Mornings", "Chapel of Small Sorrows", "Shrine of the Spire"],
  tavern: ["The Molten Mug", "The Soggy Ledger", "The Cracked Lens", "The Sleepy Frog", "The Purple Pint", "The Finality Inn"],
  restaurant: ["Frog Leg Bistro", "The Hungry Chog", "Gas-Free Grill", "Noodle Nook"],
  bakery: ["Crumb & Candle", "Moonbread Bakery", "The Warm Loaf"],
  flower_shop: ["Petals & Pond", "Moonpetal Florist", "Bloom Boutique"],
  toyshop: ["Wonderworks Toys", "The Wind-Up Chog", "Puppets & Plush"],
  tailor: ["Threads of Monad", "The Fine Stitch"],
  jeweler: ["Glimmer Gems", "Crown & Coin Jewelers"],
  post_office: ["Royal Post", "Wind of the Roads Couriers"],
  stables: ["Swift Hoof Stables", "Frogsteed Stables"],
  barracks: ["Barracks of the Bold", "Garrison", "Watch House"],
  guild_hall: ["Adventurers' Guild", "Guild Hall"],
  market: ["Grand Market", "Bazaar"],
  keep: ["City Hall", "Hall of Proclamations"],
};
const nameFor = (type: string, city: string) => {
  const list = SHOP_NAMES[type];
  if (!list) return "";
  return list[buildings.filter((b) => b.type === type).length % list.length] + (type === "guild_hall" || type === "keep" ? ` of ${city}` : "");
};

function addBuilding(type: string, city: string, region: RegionId, x: number, z: number, rot: number, s = 1, foot = 4.5, force = false): Building | null {
  if (!force) {
    if (height(x, z) < 1.7) return null;
    if (riverDist(x, z).d < 7) return null;
    if (lavaAt(x, z) > 0) return null;
    if (!free(x, z, foot * s)) return null;
  }
  const b: Building = { id: buildings.length, type, name: nameFor(type, city), city, region, x: r1(x), z: r1(z), rot: r2(rot), s: r2(s) };
  buildings.push(b);
  blocked.push({ x, z, r: foot * s });
  return b;
}

/** Ring layout facing the centre; tries small angular nudges when a slot is blocked or wet. */
function ring(types: string[], cx: number, cz: number, rad: number, city: string, region: RegionId, opts: { s?: number; foot?: number; offset?: number } = {}) {
  const placed: Building[] = [];
  const n = types.length;
  types.forEach((type, i) => {
    for (const nudge of [0, 0.12, -0.12, 0.24, -0.24]) {
      const a = ((i + (opts.offset ?? 0)) / n) * Math.PI * 2 + nudge;
      const x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
      const b = addBuilding(type, city, region, x, z, Math.atan2(cx - x, cz - z), opts.s ?? 1, opts.foot ?? 4.5);
      if (b) { placed.push(b); break; }
    }
  });
  return placed;
}

// ---------------------------------------------------------------- 1. cities
const SHOPS = ["blacksmith", "weaponsmith", "armorsmith", "alchemist", "general_store", "tavern", "restaurant", "bakery", "flower_shop", "toyshop", "tailor", "jeweler", "post_office", "stables", "market", "blacksmith", "alchemist", "general_store", "restaurant", "bakery", "tavern"];

function placePoi(p: Omit<Poi, "y" | "id">): Poi {
  const poi: Poi = { id: slug(p.name), ...p, x: r1(p.x), z: r1(p.z), y: r2(Math.max(height(p.x, p.z), 0.5)) };
  pois.push(poi);
  return poi;
}

// Hive Capital around Spire Lake
{
  const city = "The Hive Capital";
  const { x: cx, z: cz } = SPIRE_LAKE;
  placePoi({ name: "The Hive Spire", kind: "capital", region: "capital", x: cx, z: cz });
  addBuilding("spire", city, "capital", cx, cz, 0, 1.4, 8, true);
  blocked.push({ x: cx, z: cz, r: SPIRE_LAKE.r });
  const inner = ring(["castle", "guild_hall", "library", "academy", "temple", "colosseum", "market", "fountain", "keep"], cx, cz, 44, city, "capital", { s: 1.25, foot: 6 });
  ring([...SHOPS.slice(0, 15), "barracks", "post_office", "tavern", "restaurant"], cx, cz, 60, city, "capital", { offset: 0.5 });
  ring(Array(22).fill(0).map((_, i) => (i % 3 === 0 ? "house_large" : "house_small")), cx, cz, 74, city, "capital", { s: 0.9, foot: 3.5 });
  const byType = (t: string) => inner.find((b) => b.type === t);
  const legacy: [string, string, string][] = [["Hive Spire Square", "fountain", "plaza"], ["Town Hall", "keep", "hall"], ["Mon Market", "market", "market"], ["Block 143 Arcade", "colosseum", "arcade"], ["Adventurers' Guild HQ", "guild_hall", ""], ["Royal Library", "library", ""]];
  for (const [name, t, leg] of legacy) {
    const b = byType(t);
    if (b) placePoi({ name, kind: "district", region: "capital", x: b.x - Math.sin(b.rot) * 6, z: b.z - Math.cos(b.rot) * 6, ...(leg ? { legacy: leg } : {}), city });
  }
  // Gasless Gardens: a park on the south shore
  placePoi({ name: "Gasless Gardens", kind: "district", region: "capital", x: cx + 6, z: cz + 50, legacy: "gardens", city });
}

const CAPITALS: { region: RegionId; name: string; hint: [number, number]; avoid?: (x: number, z: number) => boolean }[] = [
  { region: "emberforge", name: "Zapstone Citadel", hint: [-150, -45], avoid: (x, z) => Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.r + 35 },
  { region: "tidecry", name: "Rainhaven", hint: [-240, 110] },
  { region: "prism", name: "Glasshold", hint: [200, -80] },
  { region: "dreamveil", name: "Lullaby Hollow", hint: [245, 110] },
];
for (const C of CAPITALS) {
  let best: { x: number; z: number; score: number } | null = null;
  for (let i = 0; i < 900; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 45;
    const x = C.hint[0] + Math.cos(a) * d, z = C.hint[1] + Math.sin(a) * d;
    if (C.avoid?.(x, z)) continue;
    if (riverDist(x, z).d < 52) continue;
    const land = landAround(x, z, 50, 20);
    if (land < 0.95 || height(x, z) < 2) continue;
    const score = flatness(x, z, 30) + Math.hypot(x - C.hint[0], z - C.hint[1]) * 0.05;
    if (!best || score < best.score) best = { x, z, score };
  }
  if (!best) { console.warn("no site for", C.name); continue; }
  const { x: cx, z: cz } = best;
  placePoi({ name: C.name, kind: "capital", region: C.region, x: cx, z: cz });
  addBuilding("keep", C.name, C.region, cx, cz, 0, 1.3, 7, true);
  ring(["barracks", "guild_hall", "temple", "library", "academy", "fountain"], cx, cz, 15, C.name, C.region, { foot: 4.2 });
  ring(SHOPS.slice(0, 11), cx, cz, 25, C.name, C.region, { foot: 3.8 });
  ring(SHOPS.slice(11), cx, cz, 33, C.name, C.region, { foot: 3.8, offset: 0.5 });
  ring(Array(16).fill(0).map((_, i) => (i % 4 === 0 ? "house_large" : "house_small")), cx, cz, 41, C.name, C.region, { s: 0.9, foot: 3 });
  // Walls: 4 gates on the cardinal directions, towers between, wall segments in the gaps.
  const W = 49;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const x = cx + Math.cos(a) * W, z = cz + Math.sin(a) * W;
    const type = i % 6 === 0 ? "gate" : i % 3 === 0 ? "tower" : "wall";
    addBuilding(type, C.name, C.region, x, z, -a, 1, 1.5, true);
  }
  blocked.push({ x: cx, z: cz, r: 54 });
  // Districts as POIs (legacy-free) so the old simulation locations still make sense here.
  placePoi({ name: `${C.name} Market Square`, kind: "district", region: C.region, x: cx + 8, z: cz + 6, city: C.name });
}

// ---------------------------------------------------------------- 2. other places
type Spec = { towns?: string[]; villages?: number; wilds?: string[]; dungeons?: string[]; taverns?: string[]; special?: { name: string; kind: PoiKind; legacy?: string; at?: [number, number] }[] };
const SPECS: Partial<Record<RegionId, Spec>> = {
  capital: { towns: ["Bridgewater", "Validator's Rest"], villages: 3, wilds: ["Spire Lake Shore"], special: [{ name: "Obelisk Prime", kind: "obelisk" }] },
  emberforge: {
    towns: ["Ashfall", "Brimstone Hollow", "Sparkwell", "Kettle Ridge", "Ironmouth", "Fuse Crossing"], villages: 4,
    wilds: ["Valley of Burning Candles", "Thunder Steps", "Obsidian Teeth", "The Slagfields"], dungeons: ["The Liquidation Pits", "Forge of the First Laser"],
    taverns: ["The Fried Circuit", "Last Candle Standing"], special: [{ name: "Mount Cinderheart", kind: "wild", at: [VOLCANO.x, VOLCANO.z + VOLCANO.r * 0.55] }, { name: "Ember Obelisk", kind: "obelisk" }],
  },
  tidecry: {
    towns: ["Drizzlemere", "Saltlight", "Puddleport", "Hushwater", "Gloamtide", "Kelpford"], villages: 4,
    wilds: ["Valley of Lost Letters", "Weeping Falls", "Fogbound Moors", "Shipwreck Shallows"], dungeons: ["The Abyssal Archive", "Sunken Mint"],
    taverns: ["The Crying Kraken", "Rain Check Inn"], special: [{ name: "The Weeping Lighthouse", kind: "lighthouse" }, { name: "Mist Harbor", kind: "dock" }, { name: "Tide Obelisk", kind: "obelisk" }],
  },
  prism: {
    towns: ["Mirageville", "Facet", "Echo Dunes", "Sandlens", "Quartzcross", "Veil Oasis"], villages: 4,
    wilds: ["Valley of a Thousand Reflections", "The Glass Sea", "Dunes That Lie", "Prism Canyon"], dungeons: ["Labyrinth of Mirrors", "Tomb of the First Rugpull"],
    taverns: ["Two-Faced Tankard", "The Side-Eye Saloon"], special: [{ name: "Prism Obelisk", kind: "obelisk" }],
  },
  dreamveil: {
    towns: ["Gm Grove", "Snoozeberry", "Hopscotch", "Cloverbrook", "Daydream Dell", "Lanternfall"], villages: 5,
    wilds: ["Moonpetal Fields", "Whispering Wheat", "Lantern Lake", "Wishing Hill"], dungeons: ["The Nightmare Below the Well", "Lucid Labyrinth"],
    taverns: ["The Gm & Gn", "Moonshine Meadhall"], special: [{ name: "Moon Obelisk", kind: "obelisk" }],
  },
  hollow: { wilds: ["Bone Garden", "Whispering Crater"], taverns: ["Bonefire Inn"], special: [{ name: "Hollow of Skulls", kind: "dungeon", legacy: "cave", at: [HOLLOW_CRATER.x, HOLLOW_CRATER.z] }, { name: "Ossuary of Old Wallets", kind: "dungeon" }] },
  frogsong: { towns: ["Croakton"], villages: 2, wilds: ["Lily Labyrinth", "Ribbit Rapids"], taverns: ["The Toad & Tadpole"], special: [{ name: "Chog Pond", kind: "wild", legacy: "pond" }, { name: "Frog Shrine of Fwog", kind: "wild" }] },
  rugcoast: { towns: ["Port Slippage"], wilds: ["Isle of Exit Liquidity"], taverns: ["The Rugged Anchor"], special: [{ name: "Rug Docks", kind: "dock", legacy: "docks" }, { name: "Smuggler's Cove", kind: "dungeon" }] },
  wastes: { wilds: ["Ruins of Testnet", "The Genesis Crater", "Edge of the Ledger"], dungeons: ["Vault of Unminted Things"] },
  demon: {
    wilds: ["Ashen Gate", "Field of Broken Wallets"],
    special: [{ name: "Demon King's Castle", kind: "dungeon", at: [DEMON_PLATEAU.x, DEMON_PLATEAU.z] }, { name: "Bridge of Liquidation", kind: "wild", at: [0, -216] }],
  },
};

const VPRE = ["Little", "Old", "Upper", "Lower", "East", "West", "Mossy", "Sunny", "Misty", "Quiet"];
const VROOT: Partial<Record<RegionId, string[]>> = {
  emberforge: ["Cinder", "Spark", "Ash", "Flint", "Kiln", "Volt"], tidecry: ["Drizzle", "Brine", "Gull", "Kelp", "Fog", "Tide"],
  prism: ["Shard", "Glint", "Dune", "Facet", "Mirror", "Quartz"], dreamveil: ["Clover", "Honey", "Moon", "Daisy", "Lantern", "Wheat"],
  capital: ["Spire", "Hive", "Royal", "Lake", "Purple", "Crown"], frogsong: ["Lily", "Reed", "Croak", "Bog", "Pond", "Fen"],
};
const VSUF = ["ford", "stead", "wick", "hollow", "brook", "ridge", "dale", "haven"];

function placeIn(name: string, kind: PoiKind, region: RegionId, opts: { at?: [number, number]; legacy?: string } = {}): Poi | null {
  if (opts.at) {
    const p = placePoi({ name, kind, region, x: opts.at[0], z: opts.at[1], ...(opts.legacy ? { legacy: opts.legacy } : {}) });
    blocked.push({ x: p.x, z: p.z, r: 6 });
    return p;
  }
  const R = REGION_BY_ID[region];
  const coastal = kind === "dock" || kind === "lighthouse";
  for (let i = 0; i < 4000; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * R.r * 0.95;
    const x = R.x + Math.cos(a) * d, z = R.z + Math.sin(a) * d;
    const h = height(x, z);
    if (regionAt(x, z) !== region) continue;
    if (coastal) {
      const nearWater = [0, 1, 2, 3].some((k) => height(x + Math.cos(k * 1.57) * 9, z + Math.sin(k * 1.57) * 9) < 0);
      if (h < 1.8 || h > 6 || !nearWater) continue;
    } else if (h < 2 || (kind !== "wild" && flatness(x, z, 6) > 5)) continue;
    if (lavaAt(x, z) > 0 || riverDist(x, z).d < 9) continue;
    if (!free(x, z, kind === "town" ? 10 : 7)) continue;
    const p = placePoi({ name, kind, region, x, z, ...(opts.legacy ? { legacy: opts.legacy } : {}) });
    blocked.push({ x: p.x, z: p.z, r: kind === "town" ? 9 : 5 }); // rounded coords: the town step looks this up to free it
    return p;
  }
  console.warn(`could not place ${name} (${kind}) in ${region}`);
  return null;
}

for (const R of REGIONS) {
  const s = SPECS[R.id];
  if (!s) continue;
  for (const sp of s.special ?? []) placeIn(sp.name, sp.kind, R.id, { at: sp.at, legacy: sp.legacy });
  for (const t of s.taverns ?? []) placeIn(t, "tavern", R.id);
  for (const t of s.towns ?? []) placeIn(t, "town", R.id);
  for (const w of s.wilds ?? []) placeIn(w, "wild", R.id);
  for (const d of s.dungeons ?? []) placeIn(d, "dungeon", R.id);
  const roots = VROOT[R.id];
  for (let v = 0, tries = 0; roots && v < (s.villages ?? 0) && tries < 80; tries++) {
    const name = `${VPRE[Math.floor(rand() * VPRE.length)]} ${roots[Math.floor(rand() * roots.length)]}${VSUF[Math.floor(rand() * VSUF.length)]}`;
    if (pois.some((p) => p.name === name)) continue;
    if (placeIn(name, "village", R.id)) v++;
  }
}

// ---------------------------------------------------------------- 3. buildings for towns and frontier places
const TOWN_WORK: Partial<Record<RegionId, string[]>> = {
  emberforge: ["mine", "blacksmith", "mine"], tidecry: ["fishery", "lumberyard", "farm"], prism: ["mine", "market", "farm"],
  dreamveil: ["farm", "windmill", "farm"], capital: ["farm", "windmill", "lumberyard"], frogsong: ["fishery", "farm"], rugcoast: ["fishery", "market"], wastes: ["mine"],
};
for (const p of [...pois]) {
  const work = TOWN_WORK[p.region] ?? ["farm"];
  const at = (dx: number, dz: number, type: string, s = 1) => addBuilding(type, p.name, p.region, p.x + dx, p.z + dz, Math.atan2(-dx, -dz), s, 3.2, false);
  // Drop the POI's own reservation so its buildings can use the spot.
  const idx = blocked.findIndex((b) => b.x === p.x && b.z === p.z);
  if (idx >= 0 && p.kind !== "capital") blocked.splice(idx, 1);
  switch (p.kind) {
    case "town": at(0, -6, work[0]); at(6, 3, work[1] ?? "house_large"); at(-6, 3, "house_small"); at(3, 8, "house_small"); at(-4, -10, "tavern", 0.9); break;
    case "village": at(0, -5, work[0]); at(5, 3, "house_small", 0.85); at(-5, 3, "house_small", 0.85); break;
    case "tavern": at(0, 0, "tavern", 1.1); at(6, 4, "house_small", 0.85); break;
    case "dungeon": addBuilding(p.name === "Demon King's Castle" ? "demon_castle" : "dungeon", p.name, p.region, p.x, p.z, 0, p.name === "Demon King's Castle" ? 1.6 : 1, 4, true); break;
    case "obelisk": addBuilding("obelisk", p.name, p.region, p.x, p.z, 0, 1, 2, true); break;
    case "dock": addBuilding("dock", p.name, p.region, p.x, p.z, Math.atan2(p.x, p.z), 1, 3, true); at(-5, -5, "house_small"); break;
    case "lighthouse": addBuilding("lighthouse", p.name, p.region, p.x, p.z, 0, 1, 2.5, true); break;
  }
  if (p.kind !== "capital" && p.kind !== "district") blocked.push({ x: p.x, z: p.z, r: 3 });
}

// ---------------------------------------------------------------- 4. roads
const hubs = pois.filter((p) => ["capital", "town", "village", "tavern", "dungeon", "dock", "lighthouse", "obelisk"].includes(p.kind));
const roads: { a: string; b: string; pts: [number, number][] }[] = [];
const roadSegs: [number, number, number, number][] = [];
function roadPath(A: Poi, B: Poi): [number, number][] | null {
  const len = Math.hypot(A.x - B.x, A.z - B.z);
  const steps = Math.max(2, Math.ceil(len / 5));
  const pts: [number, number][] = [];
  let wet = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // gentle curve so roads don't look ruler-straight
    const bend = Math.sin(t * Math.PI) * len * 0.06 * (((A.x * 13 + B.z * 7) | 0) % 2 ? 1 : -1);
    const nx = -(B.z - A.z) / len, nz = (B.x - A.x) / len;
    const x = A.x + (B.x - A.x) * t + nx * bend, z = A.z + (B.z - A.z) * t + nz * bend;
    if (height(x, z) < 0.8) wet++;
    if (lavaAt(x, z) > 0.2) return null;
    pts.push([r1(x), r1(z)]);
  }
  return wet / (steps + 1) > 0.18 ? null : pts;
}
{
  const inTree = new Set<number>([0]);
  const dist = (a: Poi, b: Poi) => Math.hypot(a.x - b.x, a.z - b.z);
  const tried = new Set<string>();
  while (inTree.size < hubs.length) {
    let best: [number, number, number] | null = null;
    for (const i of inTree)
      for (let j = 0; j < hubs.length; j++) {
        if (inTree.has(j) || tried.has(`${i}-${j}`)) continue;
        const d = dist(hubs[i], hubs[j]);
        if (!best || d < best[2]) best = [i, j, d];
      }
    if (!best) break;
    const pts = roadPath(hubs[best[0]], hubs[best[1]]);
    tried.add(`${best[0]}-${best[1]}`);
    if (pts) roads.push({ a: hubs[best[0]].id, b: hubs[best[1]].id, pts });
    inTree.add(best[1]); // unreachable islands just stay without a road
  }
  // Highways: Hive Capital to every nation capital.
  const caps = pois.filter((p) => p.kind === "capital");
  for (const c of caps.slice(1)) {
    const pts = roadPath(caps[0], c);
    if (pts) roads.push({ a: caps[0].id, b: c.id, pts });
  }
  for (const r of roads) for (let i = 0; i < r.pts.length - 1; i++) roadSegs.push([r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]]);
}
const nearRoad = (x: number, z: number, d: number) =>
  roadSegs.some(([ax, az, bx, bz]) => {
    const dx = bx - ax, dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - (ax + t * dx), z - (az + t * dz)) < d;
  });

// ---------------------------------------------------------------- 5. nature props
export const PROP_TYPES = ["pine", "oak", "goldtree", "palm", "deadtree", "rock", "boulder", "crystal", "flowers", "reeds", "lily", "mushroom", "bonespike", "lavarock", "demonspike"] as const;
const P = Object.fromEntries(PROP_TYPES.map((t, i) => [t, i])) as Record<(typeof PROP_TYPES)[number], number>;
const props = { t: [] as number[], x: [] as number[], z: [] as number[], s: [] as number[], r: [] as number[] };
const prand = mulberry32(SEED * 31);
const STEP = 3.1;
for (let gz = -WORLD_D / 2; gz < WORLD_D / 2; gz += STEP) {
  for (let gx = -WORLD_W / 2; gx < WORLD_W / 2; gx += STEP) {
    const x = gx + (prand() - 0.5) * STEP * 0.9, z = gz + (prand() - 0.5) * STEP * 0.9;
    const h = height(x, z);
    const reg = regionAt(x, z);
    let type: number | null = null;
    const roll = prand();
    const forest = forestAt(x, z);
    if (h < 0.4) {
      if (reg === "frogsong" && h > -1.2 && roll < 0.25) type = P.lily;
    } else if (h < 1.8) {
      if ((reg === "frogsong" || riverDist(x, z).d < 9) && roll < 0.3) type = P.reeds;
    } else {
      const lava = lavaAt(x, z);
      if (lava > 0) continue;
      if (!free(x, z, 1.5) || nearRoad(x, z, 2.5)) continue;
      switch (reg) {
        case "tidecry": if (roll < 0.06 + forest * 0.85) type = P.pine; else if (roll < 0.1 + forest * 0.85) type = P.rock; break;
        case "capital": if (roll < 0.03 + forest * 0.7) type = roll < forest * 0.3 ? P.pine : P.oak; else if (roll < 0.05 + forest * 0.7) type = P.flowers; break;
        case "dreamveil": if (roll < 0.03 + forest * 0.6) type = P.goldtree; else if (roll < 0.13 + forest * 0.6) type = P.flowers; else if (roll < 0.16 + forest * 0.6) type = P.oak; break;
        case "prism": if (roll < 0.05) type = P.crystal; else if (roll < 0.075) type = P.rock; else if (roll < 0.1 && h < 3.5) type = P.palm; break;
        case "emberforge": {
          const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
          if (dv < VOLCANO.r) { if (roll < 0.08) type = P.lavarock; }
          else if (roll < 0.09) type = P.deadtree; else if (roll < 0.15) type = P.boulder; else if (roll < 0.19) type = P.rock;
          break;
        }
        case "hollow": if (roll < 0.06) type = P.bonespike; else if (roll < 0.11) type = P.mushroom; break;
        case "frogsong": if (roll < 0.12) type = P.reeds; else if (roll < 0.2) type = P.oak; break;
        case "rugcoast": if (roll < 0.12) type = P.palm; else if (roll < 0.15) type = P.rock; break;
        case "wastes": if (roll < 0.07) type = P.boulder; else if (roll < 0.1) type = P.deadtree; break;
        case "demon": if (roll < 0.09) type = P.demonspike; else if (roll < 0.12) type = P.deadtree; break;
      }
    }
    if (type == null) continue;
    props.t.push(type); props.x.push(r1(x)); props.z.push(r1(z)); props.s.push(r2(0.7 + prand() * 0.7)); props.r.push(r2(prand() * Math.PI * 2));
  }
}

// ---------------------------------------------------------------- write
const regions = REGIONS.map((r) => ({ id: r.id, name: r.name, house: r.house, x: r.x, z: r.z, y: r1(height(r.x, r.z)), accent: r.accent, blurb: r.blurb }));
const out = {
  version: 2, seed: SEED, generatedAt: new Date().toISOString().slice(0, 10),
  regions, pois, buildings,
  roads: roads.map((r) => ({ a: r.a, b: r.b, pts: r.pts })),
  props: { types: PROP_TYPES, ...props },
  landmarks: { volcano: VOLCANO, spireLake: SPIRE_LAKE, demonPlateau: DEMON_PLATEAU },
};
const target = new URL("../data/world.json", import.meta.url);
writeFileSync(target, JSON.stringify(out));
copyFileSync(target, new URL("../../game/data/world.json", import.meta.url));
const count = (arr: { [k: string]: any }[], k: string) => arr.reduce<Record<string, number>>((a, v) => ((a[v[k]] = (a[v[k]] ?? 0) + 1), a), {});
console.log(`POIs ${pois.length}`, count(pois, "kind"));
console.log(`buildings ${buildings.length}`, count(buildings, "type"));
console.log(`roads ${roads.length}, props ${props.t.length}`);
console.log("legacy:", pois.filter((p) => p.legacy).map((p) => `${p.legacy}->${p.name}`).join(", "));
