// Star Pulls (gacha) for Constellations, the NFT holders. Each season a player gets GACHA_PULLS pulls (default 5),
// unlocked one at a time across the season (the first at once, then one every season / 5). A pull reveals
// GACHA_OFFERS cards (default 4: two skills, two quests, weighted by rarity); the player chooses one and bestows
// it on a Chog they hold (GACHA_OWN_ONLY=0: any Chog). Offers are seeded by player + season + pull number, so
// the same pull always reveals the same cards.
import { allOwners } from "../lib/chain";
import { mulberry32 } from "../world/terrain";
import { hash } from "../sim/world";
import { QUESTS, SKILLS, type Quest, type Skill } from "./sim";

export const GACHA = {
  pulls: process.env.GACHA_PULLS ? Number(process.env.GACHA_PULLS) : 5,
  offers: process.env.GACHA_OFFERS ? Number(process.env.GACHA_OFFERS) : 4,
  ownOnly: process.env.GACHA_OWN_ONLY !== "0",
};

export const GACHA_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS star_pulls (
    author TEXT NOT NULL, season INTEGER NOT NULL, pulls TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL, PRIMARY KEY (author, season)
  )`,
];

export type Card = { kind: "skill" | "quest"; id: string };
/** One pull: the cards offered, and (once chosen) which one went to which Chog. */
export type Pull = { offers: Card[]; chosen: number | null; chog: number | null; at: number };

/** Rarity by tier 1..5 (common .. legendary). Index = tier - 1. */
const RARITY = [40, 28, 18, 10, 4];
const QUEST_POOL = QUESTS.filter((q) => !q.boss || q.boss === "seal");

function weighted<T>(items: T[], weight: (t: T) => number, r: () => number): T {
  let t = r() * items.reduce((s, x) => s + weight(x), 0);
  for (const x of items) if ((t -= weight(x)) <= 0) return x;
  return items[items.length - 1];
}

/** How many pulls are unlocked `now` in a season that started at `startedAt` and lasts `seasonMs`. */
export function unlocked(startedAt: number, seasonMs: number, now = Date.now()): { count: number; nextAt: number | null } {
  const step = seasonMs / GACHA.pulls;
  const count = Math.min(GACHA.pulls, 1 + Math.max(0, Math.floor((now - startedAt) / step)));
  return { count, nextAt: count < GACHA.pulls ? Math.round(startedAt + count * step) : null };
}

/** The cards offered by pull number `n` (0-based): half skills, half quests, no repeats within the season. */
export function drawOffers(author: string, season: number, n: number, earlier: Pull[]): Card[] {
  const r = mulberry32(hash(`pull:${author}:${season}:${n}`));
  const seen = new Set(earlier.flatMap((p) => p.offers.map((c) => `${c.kind}:${c.id}`)));
  const out: Card[] = [];
  for (let i = 0; i < GACHA.offers; i++) {
    const kind: Card["kind"] = i % 2 === 0 ? "skill" : "quest";
    let card: Card = { kind, id: "" };
    for (let attempt = 0; attempt < 12; attempt++) {
      card = kind === "skill"
        ? { kind, id: weighted(SKILLS, (s: Skill) => RARITY[s.tier - 1] ?? 1, r).id }
        : { kind, id: weighted(QUEST_POOL, (q: Quest) => RARITY[Math.min(5, q.tier) - 1] ?? 1, r).id };
      if (!seen.has(`${kind}:${card.id}`)) break;
    }
    seen.add(`${kind}:${card.id}`);
    out.push(card);
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "skill" ? -1 : 1));
}

let ownersCache: { at: number; map: Map<number, string> } | null = null;

/** Chog ids held by `address` (live ownerOf snapshot via Multicall, cached 10 minutes). */
export async function ownedChogs(address: string): Promise<number[]> {
  if (!ownersCache || Date.now() - ownersCache.at > 600_000) {
    try {
      ownersCache = { at: Date.now(), map: await allOwners() };
    } catch {
      if (!ownersCache) return [];
    }
  }
  const a = address.toLowerCase();
  return [...ownersCache.map.entries()].filter(([, o]) => o === a).map(([id]) => id);
}
