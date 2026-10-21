// Build data/world.json: points of interest, roads and region labels for Monadia. Deterministic.
//   npm run gen:world
import { writeFileSync } from "node:fs";
import { height, isLand, mulberry32, regionAt, REGIONS, SEED, type RegionId } from "../src/world/terrain";

export type PoiKind = "capital" | "district" | "town" | "village" | "tavern" | "wild" | "dungeon" | "obelisk" | "dock" | "lighthouse";
export type Poi = { id: string; name: string; kind: PoiKind; region: RegionId; x: number; y: number; z: number; legacy?: string };

const rand = mulberry32(SEED * 7);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type Spec = { capital?: string; districts?: string[]; towns?: string[]; wilds?: string[]; dungeons?: string[]; taverns?: string[]; special?: { name: string; kind: PoiKind; legacy?: string }[] };

const SPECS: Record<RegionId, Spec> = {
  capital: {
    capital: "The Hive Spire",
    districts: ["Hive Spire Square", "Town Hall", "Mon Market", "Block 143 Arcade", "Gasless Gardens", "Adventurers' Guild HQ", "Summoning Circle", "Royal Library", "Colosseum 143", "Lantern Bridge", "Validator Quarter", "Mempool Docks", "Hive Times Press"],
    taverns: ["The Purple Pint", "The Finality Inn"],
    special: [{ name: "Obelisk Prime", kind: "obelisk" }],
  },
  emberforge: {
    capital: "Zapstone Citadel",
    districts: ["Laser Forge", "Arena of Sparks", "Hall of Proclamations", "Cinder Market"],
    towns: ["Ashfall", "Brimstone Hollow", "Sparkwell", "Kettle Ridge", "Ironmouth", "Emberlee", "Fuse Crossing", "Glowworm Steps"],
    wilds: ["Valley of Burning Candles", "Thunder Steps", "Obsidian Teeth", "The Slagfields", "Lightning Orchard", "Scorchmoss Gorge", "Rumbling Caldera"],
    dungeons: ["The Liquidation Pits", "Forge of the First Laser", "Ash Mines of 2022"],
    taverns: ["The Molten Mug", "The Fried Circuit", "Last Candle Standing", "The Bull Run Inn"],
    special: [{ name: "Ember Obelisk", kind: "obelisk" }],
  },
  tidecry: {
    capital: "Rainhaven",
    districts: ["Memory Archive", "Lantern Canals", "Chapel of Small Sorrows", "Moonrise Pier"],
    towns: ["Drizzlemere", "Saltlight", "Puddleport", "Hushwater", "Gloamtide", "Kelpford", "Whimper Bay", "Old Mooring"],
    wilds: ["Valley of Lost Letters", "Weeping Falls", "Shipwreck Shallows", "Fogbound Moors", "The Tear Glacier", "Drowned Bell Reef"],
    dungeons: ["The Abyssal Archive", "Sunken Mint", "Lighthouse of Unsent Messages"],
    taverns: ["The Soggy Ledger", "The Crying Kraken", "Rain Check Inn", "The Barnacle & Bottle"],
    special: [{ name: "The Weeping Lighthouse", kind: "lighthouse" }, { name: "Mist Harbor", kind: "dock" }, { name: "Tide Obelisk", kind: "obelisk" }],
  },
  prism: {
    capital: "Glasshold",
    districts: ["Hall of Mirrors", "Oracle Spire", "Shard Bazaar", "Refraction Academy", "Vault of Receipts"],
    towns: ["Mirageville", "Facet", "Echo Dunes", "Sandlens", "Quartzcross", "Veil Oasis", "Splinter Gulch", "Lumen Well"],
    wilds: ["Valley of a Thousand Reflections", "The Glass Sea", "Dunes That Lie", "Prism Canyon", "The Starless Basin", "Mirage Gardens"],
    dungeons: ["Labyrinth of Mirrors", "Tomb of the First Rugpull", "The Unverified Contract"],
    taverns: ["The Cracked Lens", "Two-Faced Tankard", "The Side-Eye Saloon", "Oasis of Rumors"],
    special: [{ name: "Prism Obelisk", kind: "obelisk" }],
  },
  dreamveil: {
    capital: "Lullaby Hollow",
    districts: ["The Moon Well", "Festival Green", "Starfall Orchard", "Windmill Quarter", "Temple of Good Mornings"],
    towns: ["Gm Grove", "Snoozeberry", "Hopscotch", "Cloverbrook", "Daydream Dell", "Lanternfall", "Puffwick", "Honeyhill"],
    wilds: ["Valley of Sleeping Giants", "Moonpetal Fields", "Whispering Wheat", "Cloud Windmills", "Lantern Lake", "Wishing Hill"],
    dungeons: ["The Nightmare Below the Well", "Lucid Labyrinth", "Hibernation Vault"],
    taverns: ["The Sleepy Frog", "The Gm & Gn", "Moonshine Meadhall", "The Pillow Fort"],
    special: [{ name: "Moon Obelisk", kind: "obelisk" }],
  },
  hollow: {
    special: [{ name: "Hollow of Skulls", kind: "dungeon", legacy: "cave" }, { name: "Ossuary of Old Wallets", kind: "dungeon" }],
    wilds: ["The Lich's Library", "Bone Garden", "Whispering Crater"],
    taverns: ["Bonefire Inn"],
  },
  frogsong: {
    special: [{ name: "Chog Pond", kind: "wild", legacy: "pond" }, { name: "Frog Shrine of Fwog", kind: "wild" }],
    wilds: ["Lily Labyrinth", "Ribbit Rapids", "Frogsong Springs"],
    towns: ["Croakton", "Lilypad Landing"],
    taverns: ["The Toad & Tadpole"],
  },
  rugcoast: {
    special: [{ name: "Rug Docks", kind: "dock", legacy: "docks" }, { name: "Smuggler's Cove", kind: "dungeon" }],
    wilds: ["Isle of Exit Liquidity", "Bounty Board of the Damned"],
    towns: ["Port Slippage"],
    taverns: ["The Rugged Anchor"],
  },
  wastes: {
    wilds: ["Ruins of Testnet", "The Genesis Crater", "Edge of the Ledger", "Golden Chog Sightings"],
    dungeons: ["Vault of Unminted Things"],
  },
};

// Old 8 sim locations -> capital districts / frontier POIs.
const LEGACY: Record<string, string> = {
  "Hive Spire Square": "plaza", "Mon Market": "market", "Block 143 Arcade": "arcade",
  "Gasless Gardens": "gardens", "Town Hall": "hall",
};

const pois: Poi[] = [];
const MIN_GAP = 9;

function farEnough(x: number, z: number, gap = MIN_GAP) {
  return pois.every((p) => Math.hypot(p.x - x, p.z - z) >= gap);
}

function place(name: string, kind: PoiKind, region: RegionId, near?: { x: number; z: number; r: number }, legacy?: string) {
  const R = REGIONS.find((r) => r.id === region)!;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const spread = near ? near.r : 105;
    const cx = near ? near.x : R.x, cz = near ? near.z : R.z;
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * spread;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const h = height(x, z);
    const coastal = kind === "dock" || kind === "lighthouse";
    if (coastal) {
      const nearWater = !isLand(x + 8, z) || !isLand(x - 8, z) || !isLand(x, z + 8) || !isLand(x, z - 8);
      if (h < 1.2 || h > 5 || !nearWater) continue;
    } else if (h < 2) continue;
    if (!near && regionAt(x, z) !== region) continue;
    if (!farEnough(x, z, kind === "district" ? 6 : MIN_GAP)) continue;
    // keep the capital lake clear
    if (region === "capital" && Math.hypot(x, z) < 34 && kind !== "capital") continue;
    pois.push({ id: slug(name), name, kind, region, x: +x.toFixed(1), y: +Math.max(h, 0.5).toFixed(2), z: +z.toFixed(1), ...(legacy ? { legacy } : {}) });
    return pois[pois.length - 1];
  }
  console.warn(`could not place ${name} in ${region}`);
  return null;
}

for (const R of REGIONS) {
  const s = SPECS[R.id];
  let cap: Poi | null = null;
  if (s.capital) {
    if (R.id === "capital") {
      pois.push({ id: slug(s.capital), name: s.capital, kind: "capital", region: "capital", x: 0, y: 6, z: 0 });
      cap = pois[pois.length - 1];
    } else cap = place(s.capital, "capital", R.id, { x: R.x, z: R.z, r: 18 });
  }
  const ring = R.id === "capital" ? { x: 0, z: 0, r: 70 } : cap ? { x: cap.x, z: cap.z, r: 26 } : undefined;
  for (const d of s.districts ?? []) place(d, "district", R.id, ring, LEGACY[d]);
  for (const t of s.taverns ?? []) place(t, "tavern", R.id, R.id === "capital" ? ring : undefined);
  for (const sp of s.special ?? []) place(sp.name, sp.kind, R.id, undefined, sp.legacy);
  for (const t of s.towns ?? []) place(t, "town", R.id);
  for (const w of s.wilds ?? []) place(w, "wild", R.id);
  for (const d of s.dungeons ?? []) place(d, "dungeon", R.id);
}

// Fill each nation with small villages so the map feels big and lived-in.
const PRE = ["Little", "Old", "Upper", "Lower", "East", "West", "Mossy", "Sunny", "Misty", "Quiet"];
const ROOT: Record<string, string[]> = {
  emberforge: ["Cinder", "Spark", "Ash", "Flint", "Kiln", "Volt"],
  tidecry: ["Drizzle", "Brine", "Gull", "Kelp", "Fog", "Tide"],
  prism: ["Shard", "Glint", "Dune", "Facet", "Mirror", "Quartz"],
  dreamveil: ["Clover", "Honey", "Moon", "Daisy", "Lantern", "Wheat"],
};
const SUF = ["ford", "stead", "wick", "hollow", "brook", "ridge", "dale", "haven"];
for (const nation of ["emberforge", "tidecry", "prism", "dreamveil"] as RegionId[]) {
  let made = 0;
  for (let i = 0; i < 400 && made < 12; i++) {
    const name = `${PRE[Math.floor(rand() * PRE.length)]} ${ROOT[nation][Math.floor(rand() * 6)]}${SUF[Math.floor(rand() * SUF.length)]}`;
    if (pois.some((p) => p.name === name)) continue;
    if (place(name, "village", nation)) made++;
  }
}

// Roads: minimum spanning tree (Prim) + short extra links.
const roads: [number, number][] = [];
const inTree = new Set<number>([0]);
const dist = (a: Poi, b: Poi) => Math.hypot(a.x - b.x, a.z - b.z);
while (inTree.size < pois.length) {
  let best: [number, number, number] | null = null;
  for (const i of inTree)
    for (let j = 0; j < pois.length; j++) {
      if (inTree.has(j)) continue;
      const d = dist(pois[i], pois[j]);
      if (!best || d < best[2]) best = [i, j, d];
    }
  roads.push([best![0], best![1]]);
  inTree.add(best![1]);
}
const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const have = new Set(roads.map(([a, b]) => key(a, b)));
for (let i = 0; i < pois.length; i++) {
  const near = pois.map((p, j) => [j, dist(pois[i], p)] as const).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3);
  for (const [j, d] of near) if (d < 45 && rand() < 0.35 && !have.has(key(i, j))) { roads.push([i, j]); have.add(key(i, j)); }
}

const regions = REGIONS.map((r) => ({ id: r.id, name: r.name, house: r.house, x: r.x, z: r.z, y: +height(r.x, r.z).toFixed(1), accent: r.accent, blurb: r.blurb }));
const out = { seed: SEED, generatedAt: new Date().toISOString().slice(0, 10), regions, pois, roads };
writeFileSync(new URL("../data/world.json", import.meta.url), JSON.stringify(out));
const byKind = pois.reduce<Record<string, number>>((a, p) => ((a[p.kind] = (a[p.kind] ?? 0) + 1), a), {});
console.log(`POIs: ${pois.length}`, byKind, `roads: ${roads.length}`);
console.log("legacy:", pois.filter((p) => p.legacy).map((p) => `${p.legacy}->${p.name}`).join(", "));
