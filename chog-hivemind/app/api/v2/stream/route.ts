// Star Stream: the system channel Constellations watch. Built from what the simulation recorded.
import { all, getState } from "@/lib/db";

export const dynamic = "force-dynamic";

type Line = { at: number; kind: string; text: string; chog?: number };

export async function GET() {
  const season = Number(await getState("season", "0"));
  const [events, memes, injections, seasons] = await Promise.all([
    all<any>(`SELECT kind, title, body, created_at FROM events ORDER BY id DESC LIMIT 15`),
    all<any>(
      `SELECT m.text, m.adopters, m.created_at, c.id AS chog, c.name FROM memes m JOIN chogs c ON c.id = m.origin_chog ORDER BY m.id DESC LIMIT 10`,
    ),
    all<any>(
      `SELECT i.kind, i.status, i.created_at, c.id AS chog, c.name FROM injections i LEFT JOIN chogs c ON c.id = i.chog_id
       WHERE i.status != 'pending' ORDER BY i.id DESC LIMIT 10`,
    ),
    all<any>(`SELECT n, started_at FROM seasons ORDER BY n DESC LIMIT 1`).catch(() => []),
  ]);
  const lines: Line[] = [];
  for (const s of seasons)
    lines.push({ at: Number(s.started_at), kind: "system", text: `[SCENARIO] Season ${s.n} has begun. 1,969 Chogs have been summoned to Monadia. Every one of them has been given a job.` });
  for (const e of events)
    lines.push({ at: Number(e.created_at), kind: e.kind === "question" ? "question" : "event", text: e.kind === "question" ? `[TOWN QUESTION] ${e.title}` : `[WORLD] ${e.title}. ${e.body}` });
  for (const m of memes)
    lines.push({ at: Number(m.created_at), kind: "meme", chog: Number(m.chog), text: `[STORY] ${m.name}'s words spread: "${String(m.text).slice(0, 90)}" (${m.adopters} echoed)` });
  for (const i of injections) {
    const who = i.name ?? "A Chog";
    const verb = i.status === "obey" ? "followed" : i.status === "twist" ? "twisted" : "ignored";
    lines.push({
      at: Number(i.created_at), kind: "constellation", chog: i.chog == null ? undefined : Number(i.chog),
      text: i.kind === "rumor" ? `[RUMOR] ${who} ${verb} a rumor whispered in the streets.` : `[CONSTELLATION] ${who} ${verb} a message from the stars.`,
    });
  }
  lines.sort((a, b) => b.at - a.at);
  return Response.json({ season, lines: lines.slice(0, 40) });
}
