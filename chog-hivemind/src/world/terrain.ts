// Deterministic continent of Monadia. Shared by the world generator (server) and the 3D renderer (client).
import { createNoise2D } from "simplex-noise";

export const SEED = 143;
export const WORLD_W = 640; // x extent (units)
export const WORLD_D = 460; // z extent (units)
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

export type RegionId =
  | "capital" | "emberforge" | "tidecry" | "prism" | "dreamveil"
  | "hollow" | "frogsong" | "rugcoast" | "wastes";

export type Region = {
  id: RegionId; name: string; house: string | null; x: number; z: number;
  ground: [string, string]; accent: string; blurb: string;
};

export const REGIONS: Region[] = [
  { id: "capital", name: "The Hive Capital", house: null, x: 0, z: 0, ground: ["#b7a8d6", "#8fbf7a"], accent: "#a97bff", blurb: "A purple spire-city on a lake, where the election is decided." },
  { id: "emberforge", name: "Emberforge Peaks", house: "laser", x: -175, z: -105, ground: ["#5a3f3f", "#7a3b2e"], accent: "#ff7a3d", blurb: "Volcanic ridges and thunder. House Laser's homeland." },
  { id: "tidecry", name: "Tidecry Coast", house: "teardrop", x: -175, z: 115, ground: ["#5f8a6b", "#4f6d7a"], accent: "#7fe7ff", blurb: "Rainy cliffs, canals and lighthouses. House Teardrop's homeland." },
  { id: "prism", name: "Prism Expanse", house: "glass", x: 175, z: -105, ground: ["#d9c7a3", "#c9b28a"], accent: "#c9a7ff", blurb: "A crystal desert of mirrors and mirages. House Glass's homeland." },
  { id: "dreamveil", name: "Dreamveil Meadows", house: "moonbeam", x: 175, z: 115, ground: ["#9ccc65", "#e6c65a"], accent: "#ffe08a", blurb: "Golden meadows, windmills and a giant moon tree. House Moonbeam's homeland." },
  { id: "hollow", name: "The Hollow", house: null, x: 0, z: -175, ground: ["#3a3550", "#2b2740"], accent: "#8ef0c4", blurb: "A sunken crater where the Skull Chogs gather at night." },
  { id: "frogsong", name: "Frogsong Wetlands", house: null, x: 285, z: 15, ground: ["#5d8f5a", "#6fa36a"], accent: "#b6f09c", blurb: "Marshes, lily pads and the original Chog Pond." },
  { id: "rugcoast", name: "Rug Coast & Pirate Isles", house: null, x: -20, z: 190, ground: ["#c9b98f", "#8a9a6a"], accent: "#ffd166", blurb: "Smugglers, pirates and the infamous Rug Docks." },
  { id: "wastes", name: "The Unminted Wastes", house: null, x: -285, z: -10, ground: ["#8a8478", "#6d675e"], accent: "#ffffff", blurb: "The edge of the ledger. Rumors of a golden Chog." },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, Region>;

/** Soft region weights (inverse-distance with domain warp) used for blending terrain and color. */
export function regionWeights(x: number, z: number): { id: RegionId; w: number }[] {
  const wx = x + n3(x * 0.01, z * 0.01) * 28;
  const wz = z + n3(z * 0.01 + 50, x * 0.01) * 28;
  const out = REGIONS.map((r) => {
    const d = Math.hypot(wx - r.x, wz - r.z) + 1;
    return { id: r.id, w: 1 / Math.pow(d, 3.2) };
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

/** Continent mask: 1 on land, 0 in open sea. Adds island noise for the Pirate Isles. */
function landMask(x: number, z: number) {
  const ex = x / (WORLD_W * 0.47), ez = z / (WORLD_D * 0.45);
  const d = Math.sqrt(ex * ex + ez * ez) + fbm(x * 0.006 + 9, z * 0.006 - 3, 3) * 0.22;
  let m = 1 - smooth(0.78, 1.02, d);
  // Pirate isles south of the continent
  const isl = Math.max(0, n2(x * 0.03 + 4, z * 0.03 - 8)) * (1 - smooth(20, 90, Math.hypot(x + 20, z - 205)));
  m = Math.max(m, smooth(0.25, 0.55, isl));
  return m;
}

/** Terrain height in world units. Sea level = 0. */
export function height(x: number, z: number): number {
  const mask = landMask(x, z);
  const base = 3 + fbm(x * 0.008, z * 0.008) * 6;
  let h = 0;
  for (const { id, w } of regionWeights(x, z)) {
    if (w < 0.01) continue;
    let r = base;
    switch (id) {
      case "emberforge": r = 8 + Math.pow(ridged(x * 0.012, z * 0.012), 2.2) * 46 + fbm(x * 0.03, z * 0.03) * 3; break;
      case "tidecry": r = 6 + fbm(x * 0.015, z * 0.015) * 9 + ridged(x * 0.02, z * 0.02) * 6; break;
      case "prism": r = 4 + Math.sin(x * 0.07 + n1(x * 0.01, z * 0.01) * 3) * 1.2 + fbm(x * 0.01, z * 0.01) * 2; break;
      case "dreamveil": r = 5 + fbm(x * 0.012, z * 0.012) * 7; break;
      case "capital": {
        const d = Math.hypot(x, z);
        r = d < 30 ? -3 + d * 0.05 : 4 + smooth(30, 55, d) * 3 + fbm(x * 0.02, z * 0.02) * 1.5;
        break;
      }
      case "hollow": {
        const d = Math.hypot(x - REGION_BY_ID.hollow.x, z - REGION_BY_ID.hollow.z);
        r = d < 42 ? 1.5 + d * 0.05 : 1.5 + smooth(42, 58, d) * 22 - smooth(58, 90, d) * 14;
        break;
      }
      case "frogsong": r = 1.2 + fbm(x * 0.03, z * 0.03) * 2.2; break;
      case "rugcoast": r = 2.5 + fbm(x * 0.02, z * 0.02) * 4; break;
      case "wastes": r = 3 + Math.abs(fbm(x * 0.02, z * 0.02)) * 14; break;
    }
    h += r * w;
  }
  return mask * h - (1 - mask) * 8;
}

export function isLand(x: number, z: number) {
  return height(x, z) > 1.2;
}

const hex = (c: string) => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];
const SAND = hex("#e8d9a8"), SNOW = hex("#f4f1ff"), SEAFLOOR = hex("#24548f"), LAVA = hex("#ff6a2a");

/** Vertex color for the terrain at (x, z) with height h. */
export function colorAt(x: number, z: number, h: number): [number, number, number] {
  if (h < 0.2) return SEAFLOOR as [number, number, number];
  if (h < 1.6) return SAND as [number, number, number];
  let c = [0, 0, 0];
  const t = (fbm(x * 0.05, z * 0.05, 2) + 1) / 2;
  for (const { id, w } of regionWeights(x, z)) {
    if (w < 0.01) continue;
    const r = REGION_BY_ID[id];
    const a = hex(r.ground[0]), b = hex(r.ground[1]);
    for (let i = 0; i < 3; i++) c[i] += (a[i] * (1 - t) + b[i] * t) * w;
  }
  const rid = regionAt(x, z);
  if (rid === "emberforge" && h > 38) c = SNOW;
  if (rid === "emberforge" && h < 14 && n2(x * 0.05, z * 0.05) > 0.62) c = LAVA;
  return c as [number, number, number];
}
