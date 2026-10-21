// MiroFish/OASIS-style recommender: recency 0.4, popularity 0.3, relevance 0.3.
import type { Agent, FeedItem } from "./types";

const W_RECENCY = 0.4;
const W_POPULARITY = 0.3;
const W_RELEVANCE = 0.3;
const ECHO_CHAMBER = 0.5;

export function rankFeed(
  agent: Agent,
  pool: FeedItem[],
  following: Set<number>,
  tick: number,
  size = 10,
  rand: () => number = Math.random,
): FeedItem[] {
  const scored = pool
    .filter((p) => p.chog_id !== agent.id)
    .map((p) => {
      const recency = Math.exp(-(tick - p.tick) / 6);
      // Human cheers count triple: people steer what the swarm notices.
      const popularity = Math.min(1, Math.log1p(p.likes + 2 * p.reposts + p.replies + 3 * (p.cheers || 0)) / Math.log1p(60));
      let relevance = 0;
      if (following.has(p.chog_id)) relevance += 0.5;
      if (p.location && p.location === agent.location) relevance += 0.3;
      if (p.house === agent.house) relevance += 0.2 * (1 + ECHO_CHAMBER);
      if (p.kind === "news") relevance += 0.4;
      const score =
        W_RECENCY * recency + W_POPULARITY * popularity + W_RELEVANCE * Math.min(1, relevance) + 0.15 * rand();
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, size).map((s) => s.p);
}
