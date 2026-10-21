// Deterministic continent of Monadia (v2). Shared by the world generator, the server and the clients.
// Continent = merged, noise-warped region "lobes" (bays between them, islands around), plus a volcano,
// rivers carved below sea level, a crater, mesas, lakes and the Demon Realm across a land bridge.
import { createNoise2D } from "simplex-noise";

export const SEED = 143;
export const WORLD_W = 760; // x extent of the playable area (units)
export const WORLD_D = 640; // z extent (north = -z)
export const SEA = 0;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n1 = createNoise2D(mulberry32(SEED));
const n2 = createNoise2D(mulberry32(SEED + 1));
const n3 = createNoise2D(mulberry32(SEED + 2));
const n4 = createNoise2D(mulberry32(SEED + 3));

function fbm(x: number, z: number, oct = 4) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * n1(x * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s; // ~[-1, 1]
}
const ridged = (x: number, z: number) => 1 - Math.abs(n2(x, z));
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export type RegionId =
  | "capital" | "emberforge" | "tidecry" | "prism" | "dreamveil"
  | "hollow" | "frogsong" | "rugcoast" | "wastes" | "demon";

export type Region = {
  id: RegionId; name: string; house: string | null; x: number; z: number; r: number;
  ground: [string, string]; accent: string; blurb: string;
};

export const REGIONS: Region[] = [
  { id: "capital", name: "The Hive Capital", house: null, x: 0, z: 10, r: 100, ground: ["#8fbf7a", "#a9c98a"], accent: "#a97bff", blurb: "A purple spire-city around Spire Lake, where the election is decided and the Adventurers' Guild HQ stands." },
  { id: "emberforge", name: "Emberforge Peaks", house: "laser", x: -205, z: -95, r: 130, ground: ["#5b4740", "#7a4a36"], accent: "#ff7a3d", blurb: "Volcanic badlands under Mount Cinderheart. House Laser's homeland." },
  { id: "tidecry", name: "Tidecry Coast", house: "teardrop", x: -195, z: 150, r: 120, ground: ["#4f8a63", "#3f7258"], accent: "#7fe7ff", blurb: "Rainy cliffs, pine forests and the River Weeping. House Teardrop's homeland." },
  { id: "prism", name: "Prism Expanse", house: "glass", x: 205, z: -95, r: 130, ground: ["#dcc9a0", "#cdb284"], accent: "#c9a7ff", blurb: "A crystal desert of dunes, mesas and mirages. House Glass's homeland." },
  { id: "dreamveil", name: "Dreamveil Meadows", house: "moonbeam", x: 200, z: 150, r: 125, ground: ["#9ccc65", "#e2c460"], accent: "#ffe08a", blurb: "Golden meadows, flower fields, lakes and windmills. House Moonbeam's homeland." },
  { id: "hollow", name: "The Hollow", house: null, x: 0, z: -160, r: 72, ground: ["#4a4560", "#3a3550"], accent: "#8ef0c4", blurb: "A sunken crater where the Skull Chogs gather at night." },
  { id: "frogsong", name: "Frogsong Wetlands", house: null, x: 325, z: 30, r: 70, ground: ["#5d8f5a", "#6fa36a"], accent: "#b6f09c", blurb: "Marshes, lagoons and the original Chog Pond." },
  { id: "rugcoast", name: "Rug Coast & Pirate Isles", house: null, x: -10, z: 255, r: 55, ground: ["#c9b98f", "#8a9a6a"], accent: "#ffd166", blurb: "Smugglers, pirates and the infamous Rug Docks." },
  { id: "wastes", name: "The Unminted Wastes", house: null, x: -340, z: 30, r: 62, ground: ["#8a8478", "#6d675e"], accent: "#ffffff", blurb: "The edge of the ledger. Rumors of a golden Chog." },
  { id: "demon", name: "The Demon Realm", house: null, x: 0, z: -275, r: 72, ground: ["#2d2238", "#3b2347"], accent: "#ff3df2", blurb: "Across the Bridge of Liquidation waits the Demon King's Castle." },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, Region>;

// ---- Landmarks -------------------------------------------------------------------------------
export const VOLCANO = { x: -235, z: -125, r: 72, h: 88, crater: 10 };
export const SPIRE_LAKE = { x: 0, z: 10, r: 30 };
export const HOLLOW_CRATER = { x: 0, z: -160, r: 42 };
export const DEMON_PLATEAU = { x: 0, z: -285, r: 26 };
const PIRATE_ISLES = [[-55, 250, 26], [-5, 268, 22], [45, 245, 20], [-90, 285, 15], [25, 300, 16], [80, 280, 13]] as const;
const BRIDGE = { ax: 0, az: -200, bx: 0, bz: -232, w: 9 };

/** Rivers: polylines from highlands to the sea (x, z). Carved below sea level so the sea fills them. */
export const RIVERS: { name: string; width: number; pts: [number, number][] }[] = [
  { name: "River Weeping", width: 5, pts: [[-140, 55], [-165, 95], [-190, 130], [-215, 175], [-250, 215], [-290, 245]] },
  { name: "Moonlit River", width: 5, pts: [[135, 75], [165, 115], [195, 150], [235, 190], [270, 235], [305, 265]] },
  { name: "Royal River", width: 4.5, pts: [[0, 40], [8, 80], [-4, 120], [10, 165], [0, 205]] },
  { name: "Ashflow", width: 4, pts: [[-175, -40], [-210, -10], [-250, 15], [-290, 40]] },
];
// Lava channels radiate from the volcano crater.
const LAVA_DIRS = [0.4, 1.55, 2.6, 3.9, 5.1];

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp01(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/** Distance to the nearest river centreline (and that river's width). */
export function riverDist(x: number, z: number): { d: number; w: number } {
  let best = { d: 1e9, w: 0 };
  for (const r of RIVERS) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const d = segDist(x, z, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]);
      if (d < best.d) best = { d, w: r.width };
    }
  }
  return best;
}

/** 0..1 lava strength (volcano channels and the crater). */
export function lavaAt(x: number, z: number): number {
  const dx = x - VOLCANO.x, dz = z - VOLCANO.z;
  const d = Math.hypot(dx, dz);
  if (d > VOLCANO.r * 0.95) return 0;
  if (d < VOLCANO.crater * 0.8) return 1;
  const a = Math.atan2(dz, dx);
  let best = 0;
  for (const dir of LAVA_DIRS) {
    let da = Math.abs(((a - dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    da += n3(x * 0.05, z * 0.05) * 0.05; // meander
    const width = 0.05 + (d / VOLCANO.r) * 0.03;
    best = Math.max(best, 1 - smooth(width * 0.4, width, Math.abs(da)));
  }
  return best * (1 - smooth(VOLCANO.r * 0.6, VOLCANO.r * 0.95, d));
}

// ---- Regions ---------------------------------------------------------------------------------
/** Soft region weights (domain-warped inverse distance scaled by each lobe's radius). */
export function regionWeights(x: number, z: number): { id: RegionId; w: number }[] {
  const wx = x + n3(x * 0.008, z * 0.008) * 30;
  const wz = z + n3(z * 0.008 + 50, x * 0.008) * 30;
  const out = REGIONS.map((r) => {
    const d = Math.hypot(wx - r.x, wz - r.z) / r.r + 0.02;
    return { id: r.id, w: 1 / Math.pow(d, 4) };
  });
  const sum = out.reduce((a, b) => a + b.w, 0);
  for (const o of out) o.w /= sum;
  return out;
}

export function regionAt(x: number, z: number): RegionId {
  const ws = regionWeights(x, z);
  let best = ws[0];
  for (const r of ws) if (r.w > best.w) best = r;
  return best.id;
}

/** Land amount: > 0 is land. Union of warped region lobes, pirate isles and the demon bridge. */
function landValue(x: number, z: number): number {
  const wx = x + n4(x * 0.006, z * 0.006) * 34;
  const wz = z + n4(z * 0.006 + 31, x * 0.006) * 34;
  let v = -1;
  for (const r of REGIONS) {
    if (r.id === "rugcoast") continue;
    v = Math.max(v, 1 - Math.hypot(wx - r.x, wz - r.z) / r.r);
  }
  for (const [ix, iz, ir] of PIRATE_ISLES) v = Math.max(v, 1 - Math.hypot(x - ix + n2(x * 0.05, z * 0.05) * 5, z - iz) / ir);
  v = Math.max(v, 1 - segDist(x, z, BRIDGE.ax, BRIDGE.az, BRIDGE.bx, BRIDGE.bz) / BRIDGE.w);
  return v + fbm(x * 0.02 + 7, z * 0.02 - 3, 3) * 0.12; // ragged coastline
}

/** Fixed city sites (chosen once by the generator's flat-site search). The terrain is flattened into a
 *  plateau under each so walls and shops never sit on cliffs. gen-world.ts places the capitals here. */
export const CITY_SITES: { region: RegionId; name: string; x: number; z: number; r: number }[] = [
  { region: "emberforge", name: "Zapstone Citadel", x: -132.9, z: -76.4, r: 56 },
  { region: "tidecry", name: "Rainhaven", x: -235.4, z: 100.8, r: 56 },
  { region: "prism", name: "Glasshold", x: 190.4, z: -76.8, r: 56 },
  { region: "dreamveil", name: "Lullaby Hollow", x: 223.3, z: 94.1, r: 56 },
];
const plateauCache = new Map<string, number>();
function plateau(c: (typeof CITY_SITES)[number]): number {
  let h = plateauCache.get(c.name);
  if (h === undefined) {
    // average of the raw terrain around the centre, kept above sea level
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += rawHeight(c.x + Math.cos(i * 0.52) * c.r * 0.5, c.z + Math.sin(i * 0.52) * c.r * 0.5);
    h = Math.max(3.5, Math.min(14, sum / 12));
    plateauCache.set(c.name, h);
  }
  return h;
}

/** Terrain height in world units. Sea level = 0. */
export function height(x: number, z: number): number {
  let h = rawHeight(x, z);
  for (const c of CITY_SITES) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r * 1.45) {
      const t = smooth(c.r * 1.45, c.r, d); // 0 outside -> 1 inside the city
      h = h * (1 - t) + plateau(c) * t;
    }
  }
  return h;
}

function rawHeight(x: number, z: number): number {
  const land = landValue(x, z);
  if (land < -0.25) return -9;
  const shore = smooth(-0.05, 0.22, land); // 0 at the coast -> 1 inland
  let h = 0;
  for (const { id, w } of regionWeights(x, z)) {
    if (w < 0.01) continue;
    let r = 4;
    switch (id) {
      case "emberforge": {
        r = 7 + fbm(x * 0.02, z * 0.02) * 4 + Math.pow(ridged(x * 0.014, z * 0.014), 2.4) * 30;
        const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
        if (dv < VOLCANO.r) {
          const cone = VOLCANO.h * Math.pow(1 - dv / VOLCANO.r, 1.25);
          const crater = dv < VOLCANO.crater ? (VOLCANO.crater - dv) * 1.6 : 0;
          r = Math.max(r, cone - crater);
        }
        break;
      }
      case "tidecry": r = 6 + fbm(x * 0.016, z * 0.016) * 8 + ridged(x * 0.022, z * 0.022) * 7 + smooth(0.2, 0.45, land) * 6; break;
      case "prism": {
        const dunes = Math.sin(x * 0.09 + n1(x * 0.012, z * 0.012) * 3.2) * 1.4 + 4;
        const mesa = n2(x * 0.018 + 4, z * 0.018) > 0.55 ? 14 : 0; // flat-topped mesas
        r = Math.max(dunes, mesa + fbm(x * 0.05, z * 0.05) * 0.8);
        break;
      }
      case "dreamveil": {
        r = 6 + fbm(x * 0.012, z * 0.012) * 7;
        if (fbm(x * 0.02 + 20, z * 0.02 + 20, 3) < -0.32) r = -1.5; // meadow lakes
        break;
      }
      case "capital": {
        const d = Math.hypot(x - SPIRE_LAKE.x, z - SPIRE_LAKE.z);
        r = d < SPIRE_LAKE.r ? -3 + smooth(SPIRE_LAKE.r - 6, SPIRE_LAKE.r, d) * 4 : 5 + smooth(SPIRE_LAKE.r, SPIRE_LAKE.r + 20, d) * 2 + fbm(x * 0.03, z * 0.03) * 1.2;
        if (Math.hypot(x - SPIRE_LAKE.x, z - SPIRE_LAKE.z) < 9) r = 3.5; // spire island
        break;
      }
      case "hollow": {
        const d = Math.hypot(x - HOLLOW_CRATER.x, z - HOLLOW_CRATER.z);
        r = d < HOLLOW_CRATER.r ? 2 + d * 0.04 : 2 + smooth(HOLLOW_CRATER.r, HOLLOW_CRATER.r + 14, d) * 20 - smooth(HOLLOW_CRATER.r + 14, HOLLOW_CRATER.r + 40, d) * 12;
        break;
      }
      case "frogsong": r = 1.6 + fbm(x * 0.03, z * 0.03) * 2.4; break;
      case "rugcoast": r = 2.5 + fbm(x * 0.03, z * 0.03) * 4; break;
      case "wastes": r = 4 + (n2(x * 0.03, z * 0.03) > 0.35 ? 10 : 0) + Math.abs(fbm(x * 0.03, z * 0.03)) * 5; break;
      case "demon": {
        const d = Math.hypot(x - DEMON_PLATEAU.x, z - DEMON_PLATEAU.z);
        r = d < DEMON_PLATEAU.r ? 16 : 6 + Math.pow(ridged(x * 0.03, z * 0.03), 3) * 22;
        break;
      }
    }
    h += r * w;
  }
  h = h * shore + (1 - shore) * (land > 0 ? 1.5 : -2); // beaches and shallows
  if (land < 0) h = Math.min(h, -2 + land * 12);
  // Rivers
  const rv = riverDist(x, z);
  if (rv.d < rv.w * 2.4) h = Math.min(h, -0.8 + smooth(rv.w * 0.7, rv.w * 2.4, rv.d) * Math.max(h + 0.8, 0));
  // Lava channels sit slightly lower than the slope around them
  const lava = lavaAt(x, z);
  if (lava > 0) h -= lava * 1.2;
  return h;
}

export function isLand(x: number, z: number) {
  return height(x, z) > 1.2;
}

const hex = (c: string) => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v * (1 - t) + b[i] * t);
const SAND = hex("#e8d9a8"), SNOW = hex("#f4f1ff"), SEAFLOOR = hex("#24548f"), SHALLOW = hex("#3f86b8");
const ROCK = hex("#7d7468"), DARKROCK = hex("#2c2427"), ASH = hex("#4a4040"), LAVA = hex("#ff6a1a"), FOREST = hex("#2f5e45");
const MESA = hex("#c98a5a"), FLOWER = hex("#f2a6c8");

/** Vertex color (sRGB 0..1) plus lava/emission amount in the 4th channel. */
export function colorAt(x: number, z: number, h: number): [number, number, number, number] {
  if (h < -1.5) return [...SEAFLOOR, 0] as any;
  if (h < 0.4) return [...SHALLOW, 0] as any;
  const lava = lavaAt(x, z);
  if (lava > 0.35) return [...LAVA, lava] as any;
  if (h < 2.0) return [...SAND, 0] as any;
  const rid = regionAt(x, z);
  const t = (fbm(x * 0.05, z * 0.05, 2) + 1) / 2;
  let c = [0, 0, 0];
  for (const { id, w } of regionWeights(x, z)) {
    if (w < 0.01) continue;
    const r = REGION_BY_ID[id];
    const g = mix(hex(r.ground[0]), hex(r.ground[1]), t);
    for (let i = 0; i < 3; i++) c[i] += g[i] * w;
  }
  // slope from a small finite difference
  const slope = Math.abs(height(x + 1.5, z) - h) + Math.abs(height(x, z + 1.5) - h);
  if (slope > 3.2 && rid !== "prism") c = mix(c, ROCK, clamp01((slope - 3.2) / 3));
  if (rid === "emberforge") {
    const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
    if (dv < VOLCANO.r) c = mix(c, DARKROCK, 1 - dv / VOLCANO.r);
    else if (h > 30) c = mix(c, SNOW, clamp01((h - 30) / 8));
    if (n2(x * 0.03, z * 0.03) > 0.4) c = mix(c, ASH, 0.6);
    if (lava > 0) c = mix(c, LAVA, lava);
  }
  if (rid === "prism" && h > 11) c = mix(c, MESA, 0.8);
  if ((rid === "tidecry" || rid === "dreamveil" || rid === "capital") && n4(x * 0.025, z * 0.025) > 0.25) c = mix(c, FOREST, rid === "dreamveil" ? 0.35 : 0.6);
  if (rid === "dreamveil" && n3(x * 0.06, z * 0.06) > 0.55) c = mix(c, FLOWER, 0.5);
  if (rid === "demon") c = mix(c, hex("#5a2a6a"), clamp01(n2(x * 0.05, z * 0.05)));
  return [c[0], c[1], c[2], lava > 0 ? lava * 0.6 : 0];
}

/** Forest density 0..1 (matches the darker forest tint) for prop placement. */
export function forestAt(x: number, z: number): number {
  return clamp01((n4(x * 0.025, z * 0.025) - 0.15) * 2.5);
}
