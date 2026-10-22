// The Chronicle's story graph, assembled from data/story/*.json: arcs (the season's premise), the shared spine
// (guild, raids, seals, hero cases), arc-specific nodes, the interludes and the grammar. `repeat` nodes
// (the four seals) are expanded here: {n} in id / trigger / slot / after becomes 1..4.
import type { Grammar, StoryNode } from "./engine";
import arcsJson from "../../data/story/arcs.json";
import grammarScene from "../../data/story/grammar_scene.json";
import grammarArc from "../../data/story/grammar_arc.json";
import spineEarly from "../../data/story/spine_early.json";
import spineMid from "../../data/story/spine_mid.json";
import spineLate from "../../data/story/spine_late.json";
import interludesA from "../../data/story/interludes_a.json";
import interludesB from "../../data/story/interludes_b.json";
import arcLantern from "../../data/story/arc_lantern.json";
import arcReturner from "../../data/story/arc_returner.json";
import arcOverlord from "../../data/story/arc_overlord.json";
import arcSlime from "../../data/story/arc_slime.json";
import arcShield from "../../data/story/arc_shield.json";
import arcGate from "../../data/story/arc_gate.json";
import arcMisfits from "../../data/story/arc_misfits.json";
import arcHidden from "../../data/story/arc_hidden.json";

export type Arc = { id: string; title: string; blurb: string; weight: number };
type Raw = Omit<StoryNode, "variants"> & { variants: StoryNode["variants"]; repeat?: number[] };
type File = { grammar?: Grammar; nodes?: Raw[] };

const FILES = [grammarScene, grammarArc, spineEarly, spineMid, spineLate, interludesA, interludesB, arcLantern, arcReturner,
  arcOverlord, arcSlime, arcShield, arcGate, arcMisfits, arcHidden] as unknown as File[];

const sub = (s: string | undefined, n: number) => s?.replace(/\{n\}/g, String(n));

function build() {
  const grammar: Grammar = {};
  const nodes: StoryNode[] = [];
  for (const f of FILES) {
    for (const [k, list] of Object.entries(f.grammar ?? {})) grammar[k] = [...(grammar[k] ?? []), ...list];
    for (const raw of f.nodes ?? []) {
      const { repeat, ...node } = raw;
      if (!repeat) { nodes.push(node as StoryNode); continue; }
      for (const n of repeat) nodes.push({ ...node, id: sub(node.id, n)!, trigger: sub(node.trigger, n), slot: sub(node.slot, n), after: node.after?.map((a) => sub(a, n)!) } as StoryNode);
    }
  }
  return { arcs: (arcsJson as { arcs: Arc[] }).arcs, nodes, grammar };
}

export const GRAPH = build();
export const NODE_BY_ID = new Map(GRAPH.nodes.map((n, i) => [n.id, { node: n, index: i }]));
