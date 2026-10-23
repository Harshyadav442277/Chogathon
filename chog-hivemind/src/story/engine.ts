// The story-graph engine: one small, deterministic machinery behind the Chronicle (season novel), every Chog's life
// story and the Star Stream lines. No model: pre-written text with logic, but abundant and seeded, so no two seasons
// or Chogs read the same while every story still obeys the graph.
//
// A graph is a list of NODES (story beats). A node says when it can happen and what it sets:
//   trigger   a milestone (season_start, progress_50, seals_2, ...): the beat becomes possible at that moment
//   after     node ids that must already have happened (all of them: the graph's edges)
//   afterAny  at least one of these ids must have happened
//   requires  a condition over the story state ("hero_track=craft && !traitor"); unless = the negated form
//   arc       only for this premise (or list of premises); omitted = every premise
//   slot      beats in the same slot compete: at most one is told (chosen by weight, seeded)
//   chance    0..1: the share of seasons in which this optional beat is told (seeded, so stable per season)
//   sets      flags added to the story state when told: later beats can require them
//   variants  the text: several alternatives, each with an optional condition; one is chosen, seeded
//
// Text syntax (expanded in this order):
//   <symbol>        a grammar fragment: one of several alternatives, chosen by seed, recursively expanded;
//                   "symbol@arc" alternatives are added to the pool when that premise is active; an
//                   alternative may start with ?cond? to be offered only when the condition holds
//   {=a|b|c}        one of the inline alternatives
//   [[cond|text]]   kept only when the condition holds (a bare pointer name means "has a value")
//   {pointer}       a value from the simulation: a Chog's name, a place, a number; {pointer|fallback}
import { hash } from "../sim/world";

export type Env = Record<string, unknown>;
export type Variant = { if?: string; text: string; w?: number };
export type StoryNode = {
  id: string; title?: string; trigger?: string; arc?: string | string[]; slot?: string;
  after?: string[]; afterAny?: string[]; requires?: string; unless?: string;
  sets?: string[]; chance?: number; weight?: number; plain?: boolean; variants: Variant[];
  section?: string; order?: number;  // life-story beats: which section they belong to and where they sit in it
};
export type Grammar = Record<string, string[]>;
export type ExpandCx = { env: Env; grammar: Grammar; seed: string };

const truthy = (v: unknown) => v !== undefined && v !== null && v !== "" && v !== false && v !== 0 && v !== "0";

/** Conditions: atoms joined by && and ||; atoms are `name`, `!name`, `name=value`, `name!=value`, `name>n`, `>=`, `<`, `<=`. */
export function evalCond(cond: string | undefined, env: Env): boolean {
  if (!cond || !cond.trim()) return true;
  return cond.split("||").some((or) => or.split("&&").every((atom) => evalAtom(atom.trim(), env)));
}

function evalAtom(a: string, env: Env): boolean {
  if (a.startsWith("!")) return !evalAtom(a.slice(1).trim(), env);
  const m = a.match(/^([\w.]+)\s*(>=|<=|!=|=|>|<)\s*(.+)$/);
  if (!m) return truthy(env[a]);
  const [, k, op, raw] = m;
  const v = env[k];
  if (op === "=") return String(v ?? "") === raw.trim();
  if (op === "!=") return String(v ?? "") !== raw.trim();
  const n = Number(v ?? 0), r = Number(raw);
  return op === ">" ? n > r : op === "<" ? n < r : op === ">=" ? n >= r : n <= r;
}

/** Stable pseudo-random integer in [0, n) from a seed string. */
export const roll = (seed: string, n: number) => (n <= 1 ? 0 : hash(seed) % n);

/** True when an optional beat (chance < 1) is part of this story: stable for the same seed. */
export const chanceOk = (seed: string, chance = 1) => chance >= 1 || (hash(seed) % 10000) / 10000 < chance;

export function pickWeighted<T extends { weight?: number }>(items: T[], seed: string): T {
  const total = items.reduce((s, x) => s + (x.weight ?? 1), 0);
  let t = ((hash(seed) % 100000) / 100000) * total;
  for (const x of items) if ((t -= x.weight ?? 1) < 0) return x;
  return items[items.length - 1];
}

/** The text variant of a node for this state: only those whose condition holds, one chosen by seed. `avoid` skips an index. */
export function pickVariant(node: StoryNode, env: Env, seed: string, avoid = -1): { text: string; index: number } {
  const ok = node.variants.map((v, i) => ({ v, i })).filter(({ v }) => evalCond(v.if, env));
  const pool = ok.length ? ok : node.variants.map((v, i) => ({ v, i }));
  const fresh = pool.length > 1 ? pool.filter((p) => p.i !== avoid) : pool;
  const pick = pickWeighted(fresh.map((p) => ({ ...p, weight: p.v.w ?? 1 })), seed);
  return { text: pick.v.text, index: pick.i };
}

const ALT_COND = /^\?([^?]*)\?([\s\S]*)$/;

/** State shared by one expansion: symbol counters (so repeats differ) and the names already said in full. */
type St = { counts: Record<string, number>; names: Set<string> };

/** "Cashew the Quiet #1260" -> "Cashew": a name is spelled out once, then shortened for the rest of the text. */
export const shortName = (s: string) => s.replace(/\s+#\d+$/, "").replace(/\s+the\s+\w+$/i, "");
const NAME = /#\d+$/;

function inner(text: string, cx: ExpandCx, depth: number, st: St): string {
  const counts = st.counts;
  let out = text;
  const arc = String(cx.env.arc ?? "");
  if (depth < 7) {
    out = out.replace(/<([a-z][a-z0-9_]*)>/g, (_, sym: string) => {
      const pool = [...(arc ? cx.grammar[`${sym}@${arc}`] ?? [] : []), ...(cx.grammar[sym] ?? [])]
        .map((alt) => { const m = alt.match(ALT_COND); return m ? { cond: m[1], text: m[2] } : { cond: "", text: alt }; })
        .filter((alt) => evalCond(alt.cond, cx.env));
      if (!pool.length) return "";
      const n = (counts[sym] = (counts[sym] ?? 0) + 1);
      const alt = pool[roll(`${cx.seed}|${sym}|${n}|${depth}`, pool.length)];
      return inner(alt.text, cx, depth + 1, st);
    });
  }
  out = out.replace(/\{=([^}]*)\}/g, (_, alts: string) => {
    const list = alts.split("|");
    const n = (counts["="] = (counts["="] ?? 0) + 1);
    return list[roll(`${cx.seed}|alt|${n}|${depth}`, list.length)];
  });
  out = out.replace(/\[\[([^|\]]+)\|([^\]]*)\]\]/g, (_, cond: string, body: string) => (evalCond(cond, cx.env) ? body : ""));
  // {#key singular/plural}: the number, then the right word ("1 quest", "3 quests")
  out = out.replace(/\{#(\w+) ([^/}]+)\/([^}]+)\}/g, (_, k: string, one: string, many: string) => {
    const n = Number(cx.env[k] ?? 0);
    return `${n} ${n === 1 ? one : many}`;
  });
  out = out.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (_, k: string, fallback?: string) => {
    const v = cx.env[k];
    if (!truthy(v)) return fallback ?? "someone";
    const val = String(v);
    if (!NAME.test(val)) return val;
    if (st.names.has(val)) return shortName(val);
    st.names.add(val);
    return val;
  });
  return out;
}

/** Fills a template for this state. Same text + env + seed always gives the same result. */
export function expand(text: string, cx: ExpandCx): string {
  return tidy(inner(text, cx, 0, { counts: {}, names: new Set() }));
}

/** Spacing, apostrophes after names ending in s, and capital letters at sentence starts. */
export function tidy(s: string): string {
  return s
    .replace(/s's\b/g, "s'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.;:!?])/g, "$1")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    // Not after a closing quote: “...,” said Ana and “...?” said Ana keep their lower-case speech tags.
    .replace(/(^|[.!?]\s+|\n)([a-z])/g, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}

// ---- Lint helpers (scripts/story-lint.ts) ----------------------------------------------------------------
export const pointersIn = (text: string) => [...text.matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)].map((m) => m[1]);
export const symbolsIn = (text: string) => [...text.matchAll(/<([a-z][a-z0-9_]*)>/g)].map((m) => m[1]);
export const condNamesIn = (cond: string | undefined) =>
  (cond ?? "").split(/&&|\|\||!/).map((a) => a.trim().match(/^[\w.]+/)?.[0]).filter((x): x is string => !!x);
