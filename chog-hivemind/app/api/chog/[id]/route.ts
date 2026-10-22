import { chogDetail } from "@/lib/queries";
import { err, json } from "@/lib/api";
import { one } from "@/lib/db";
import { lifeOf } from "@/sim3/life";
import { ensureSimSchema, placeName, QUEST_BY_ID, questTicks, SKILL_BY_ID } from "@/sim3/sim";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = await chogDetail(Number(id));
  if (!c) return err("not found", 404);
  const { owner, ...pub } = c;
  const agent = await agentDetail(Number(id));
  return json({ chog: { ...pub, owned: !!owner }, agent, life: agent ? await lifeOf(Number(id), String(pub.name)) : null });
}

/** What this Chog is doing in the season simulation: state, quest progress, skills, HP, recent log. */
async function agentDetail(id: number) {
  await ensureSimSchema();
  const a = await one<any>(`SELECT * FROM agents WHERE chog_id = ?`, [id]);
  if (!a) return null;
  const skills: string[] = JSON.parse(a.skills || "[]");
  const q = a.quest ? QUEST_BY_ID.get(a.quest) : undefined;
  const level = Number(a.level);
  return {
    state: a.state, place: placeName(String(a.place)), level, xp: Number(a.xp), xpNext: level * 50, hp: Number(a.hp), maxhp: Number(a.maxhp),
    gold: Number(a.gold), story: Number(a.story), kills: Number(a.kills),
    quest: q ? { id: q.id, name: q.name, desc: q.desc, pct: Math.min(100, Math.round((100 * Number(a.qprog)) / Math.max(1, Number(a.qneed)))),
      expectedTicks: questTicks(skills, level, q), fromStars: !!a.qgiver } : null,
    skills: skills.map((s) => SKILL_BY_ID.get(s)).filter(Boolean).map((s) => ({ id: s!.id, name: s!.name, rank: s!.rank, school: s!.school, desc: s!.desc })),
    log: JSON.parse(a.log || "[]") as string[],
  };
}
