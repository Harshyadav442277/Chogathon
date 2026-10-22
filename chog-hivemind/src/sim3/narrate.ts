// Narration for the season simulation (the Star Stream, Chog logs, memories): lines with slots, picked by a seed
// from data/story/stream_*.json on the story-graph engine (src/story/engine.ts). A line may carry a condition
// ("qkind=hunt", "track=craft", "jobid=baker"): such lines are favoured when they apply, generic ones fill in.
// {a} / {b} are Chog names, {place}, {quest}, {skill}, {boss}, {n}; <symbols> come from the grammar.
import { evalCond, expand, pickWeighted, type Grammar, type Variant } from "../story/engine";
import streamA from "../../data/story/stream_a.json";
import streamWork from "../../data/story/stream_work.json";

type File = { grammar?: Grammar; events: Record<string, Variant[]> };
const FILES = [streamA, streamWork] as unknown as File[];
export const EVENTS: Record<string, Variant[]> = {};
export const STREAM_GRAMMAR: Grammar = {};
for (const f of FILES) {
  for (const [k, list] of Object.entries(f.events)) EVENTS[k] = [...(EVENTS[k] ?? []), ...list];
  for (const [k, list] of Object.entries(f.grammar ?? {})) STREAM_GRAMMAR[k] = [...(STREAM_GRAMMAR[k] ?? []), ...list];
}
STREAM_GRAMMAR.w_rumor = [
  "the Demon King has taken up knitting.", "a dragon was seen buying bread.", "the stars are arguing about who goes first.", "the next Hero will be a baker.",
  "the Hollow has a new tenant.", "somebody found a seam in the sky.", "the capital's bell has learned a new note.", "a goose is leading the Wastes.",
  "there is a door at the bottom of the sea.", "one of the Generals is writing poetry.", "a very small imp is, in fact, the real power in the castle.",
];

/** The narrated line for an event. `vars` may carry qkind (quest type), track and jobid to pick fitting variants. */
export function narrate(kind: string, seed: number, vars: Record<string, unknown>): string {
  const list = EVENTS[kind];
  if (!list) return kind;
  const applies = list.filter((v) => evalCond(v.if, vars));
  const pool = applies.length ? applies : list.filter((v) => !v.if);
  const v = pickWeighted((pool.length ? pool : list).map((x) => ({ x, weight: x.if ? 2 : 1 })), `n:${kind}:${seed}`).x;
  return expand(v.text, { env: vars, grammar: STREAM_GRAMMAR, seed: `${kind}:${seed}` });
}
