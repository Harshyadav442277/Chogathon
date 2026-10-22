// A Chog's life story, assembled deterministically from chog_history (no model): fixed sentences with pointers
// into what actually happened. Used by the Status Window's "Life" section.
import { all, getState } from "../lib/db";
import { JOB_BY_ID } from "../sim2/season";

type Row = { season: number; tick: number; kind: string; other: number | null; ref: string | null; text: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

export async function lifeOf(id: number, name: string) {
  const season = Number(await getState("season", "0"));
  const rows = (await all<any>(
    `SELECT season, tick, kind, other, ref, text FROM chog_history WHERE chog_id = ? ORDER BY id DESC LIMIT 600`, [id],
  )).map((r) => ({ season: Number(r.season), tick: Number(r.tick), kind: String(r.kind), other: r.other == null ? null : Number(r.other), ref: r.ref, text: String(r.text) })) as Row[];
  const now = rows.filter((r) => r.season === season);
  const count = (list: Row[], kind: string) => list.filter((r) => r.kind === kind).length;

  // Companions: who this Chog formed parties with most often.
  const mates = new Map<number, number>();
  for (const r of now) if (r.kind === "party" && r.other != null) mates.set(r.other, (mates.get(r.other) ?? 0) + 1);
  const best = [...mates.entries()].sort((a, b) => b[1] - a[1])[0];
  const bestName = best ? (await all<any>(`SELECT name FROM chogs WHERE id = ?`, [best[0]]))[0]?.name : null;

  const s: string[] = [];
  const summoned = now.find((r) => r.kind === "summoned");
  const job = summoned?.ref ? JOB_BY_ID[summoned.ref] : undefined;
  const demon = job?.track === "demon";
  if (summoned) s.push(`In Season ${season}, ${name} ${summoned.text.startsWith("Summoned") ? "was s" : summoned.text.charAt(0).toLowerCase()}${summoned.text.slice(1)}`);
  const done = count(now, "quest_done"), fail = count(now, "quest_fail");
  if (demon) {
    const raids = count(now, "raid_won") + count(now, "raid_lost");
    if (raids) s.push(`It has raided the towns of Monadia ${times(raids)}, winning ${count(now, "raid_won")} of those raids.`);
    if (count(now, "fell")) s.push(now.find((r) => r.kind === "fell")!.text);
  } else {
    if (done || fail) s.push(`Since then they have completed ${plural(done, "quest")}${fail ? ` and been carried back to the temple ${times(fail)}` : ""}.`);
    const held = count(now, "raid_held"), hurt = count(now, "raid_hurt");
    if (held || hurt) s.push(`When demons came, they held the walls ${times(held)}${hurt ? ` and were wounded ${times(hurt)}` : ""}.`);
    if (best && bestName) s.push(`Their most loyal companion is ${bestName}, with whom they have set out ${times(best[1])}.`);
    const gifts = count(now, "gift_skill") + count(now, "gift_quest");
    if (gifts) s.push(`The stars have taken notice: ${plural(gifts, "gift")} from the Constellations so far.`);
  }
  const title = now.find((r) => r.kind === "title");
  if (title?.ref) s.push(`They now carry the title "${title.ref}".`);
  const moment = now.find((r) => r.kind === "hero") ?? now.find((r) => r.kind === "slay_general");
  if (moment) s.push(`Their greatest moment: ${moment.text.charAt(0).toLowerCase()}${moment.text.slice(1)}`);

  // Past lives: one line per earlier season.
  const past: string[] = [];
  const seasons = [...new Set(rows.filter((r) => r.season !== season).map((r) => r.season))].sort((a, b) => b - a);
  for (const n of seasons.slice(0, 5)) {
    const list = rows.filter((r) => r.season === n);
    const j = list.find((r) => r.kind === "summoned")?.ref;
    const deed = list.find((r) => r.kind === "hero") ? "became the Hero" : list.find((r) => r.kind === "slay_general")
      ? "slew a Demon General" : `completed ${plural(count(list, "quest_done"), "quest")}`;
    past.push(`Season ${n}: ${j ? JOB_BY_ID[j]?.name ?? j : "a Chog"} who ${deed}.`);
  }

  return {
    bio: s.join(" "),
    pastLives: past,
    timeline: rows.slice(0, 25).map((r) => ({ season: r.season, tick: r.tick, kind: r.kind, text: r.text })),
    counts: { quests: done, failed: fail, parties: count(now, "party"), gifts: count(now, "gift_skill") + count(now, "gift_quest") },
  };
}
