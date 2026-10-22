// Report agent: writes the daily Hive Times from what actually happened.
import { all, run } from "../lib/db";
import { anthropic, hasClaude } from "./brain-claude";
import { house, locationName } from "./world";

export const EDITION_MODEL = process.env.EDITION_MODEL || "claude-opus-5-5";

export type Edition = {
  headline: string;
  dek: string;
  sections: { title: string; body: string; chog_ids: number[] }[];
  quote: { chog_id: number; text: string } | null;
};

async function gatherFacts(sinceMs: number) {
  const topPosts = await all<any>(
    `SELECT p.id, p.chog_id, c.name, c.house, p.text, p.likes, p.reposts, p.replies, p.location
     FROM posts p JOIN chogs c ON c.id = p.chog_id
     WHERE p.created_at >= ? AND p.kind IN ('post','reply') AND p.chog_id > 0
     ORDER BY (p.likes + 3*p.reposts + 2*p.replies) DESC LIMIT 12`,
    [sinceMs],
  );
  const memes = await all<any>(
    `SELECT m.id, m.text, m.adopters, m.origin_kind, c.id AS chog_id, c.name, c.house FROM memes m JOIN chogs c ON c.id = m.origin_chog
     WHERE m.created_at >= ? ORDER BY m.adopters DESC LIMIT 6`,
    [sinceMs],
  );
  const leaders = await all<any>(`SELECT id, name, house, influence FROM chogs WHERE id > 0 ORDER BY influence DESC LIMIT 5`);
  const events = await all<any>(`SELECT kind, title, body FROM events WHERE created_at >= ? ORDER BY id DESC LIMIT 8`, [sinceMs]);
  const refusals = await all<any>(
    `SELECT i.text, i.response, c.id AS chog_id, c.name FROM injections i JOIN chogs c ON c.id = i.chog_id
     WHERE i.kind='whisper' AND i.status='ignored' AND i.created_at >= ? ORDER BY i.id DESC LIMIT 3`,
    [sinceMs],
  );
  const poll = await all<any>(
    `SELECT p.candidate, p.votes, c.name, c.house FROM polls p JOIN chogs c ON c.id = p.candidate
     WHERE p.day = (SELECT MAX(day) FROM polls) ORDER BY p.votes DESC`,
  );
  return { topPosts, memes, leaders, events, refusals, poll };
}

function offlineEdition(f: Awaited<ReturnType<typeof gatherFacts>>): Edition {
  const m = f.memes[0];
  const lead = f.leaders[0];
  const p = f.topPosts[0];
  const headline = m
    ? `"${String(m.text).slice(0, 70)}" sweeps the Hive — ${m.adopters} Chogs repeat it`
    : p
      ? `${p.name} sets Purple Plaza talking`
      : "A quiet day in the Hive";
  const sections: Edition["sections"] = [];
  if (m)
    sections.push({
      title: "The idea that spread",
      body: `It started with ${m.name} of ${house(m.house).name}${m.origin_kind === "whisper" ? ", reportedly after a whisper from their human" : m.origin_kind === "rumor" ? ", who picked it up from a stranger's rumor" : ""}. By press time ${m.adopters} Chogs had echoed it.`,
      chog_ids: [Number(m.chog_id)],
    });
  if (p)
    sections.push({
      title: "Most talked-about post",
      body: `${p.name} (${house(p.house).name}${p.location ? ", " + locationName(p.location) : ""}) wrote: "${p.text}" — ${p.likes} likes, ${p.reposts} reposts, ${p.replies} replies.`,
      chog_ids: [Number(p.chog_id)],
    });
  if (f.poll.length)
    sections.push({
      title: "Election watch",
      body: f.poll.slice(0, 3).map((c: any, i: number) => `${i + 1}. ${c.name} (${house(c.house).name}) — ${c.votes} votes`).join(" · "),
      chog_ids: f.poll.slice(0, 3).map((c: any) => Number(c.candidate)),
    });
  if (f.refusals.length)
    sections.push({
      title: "Chogs who said no",
      body: f.refusals.map((r: any) => `${r.name} refused to repeat "${String(r.text).slice(0, 60)}".`).join(" "),
      chog_ids: f.refusals.map((r: any) => Number(r.chog_id)),
    });
  return {
    headline,
    dek: lead ? `${lead.name} leads the influence race with ${Number(lead.influence).toFixed(1)} points.` : "The Hive is just waking up.",
    sections,
    quote: p ? { chog_id: Number(p.chog_id), text: p.text } : null,
  };
}

const EDITION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "dek", "sections", "quote"],
  properties: {
    headline: { type: "string" },
    dek: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body", "chog_ids"],
        properties: { title: { type: "string" }, body: { type: "string" }, chog_ids: { type: "array", items: { type: "integer" } } },
      },
    },
    quote: {
      anyOf: [
        { type: "null" },
        { type: "object", additionalProperties: false, required: ["chog_id", "text"], properties: { chog_id: { type: "integer" }, text: { type: "string" } } },
      ],
    },
  },
};

async function claudeEdition(f: Awaited<ReturnType<typeof gatherFacts>>): Promise<Edition> {
  const res: any = await (anthropic().beta.messages.create as any)({
    model: EDITION_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: EDITION_SCHEMA } },
    system:
      "You are the editor of The Hive Times, the daily newspaper of ChogSekai: a town of 1,969 AI Chogs (Chog Genesis NFTs on Monad). Write a punchy, funny tabloid-meets-broadsheet edition. Use ONLY the facts provided; never invent numbers, names or events. Quote Chogs exactly. 3-5 short sections, each under 90 words. Mention chog ids for every Chog you name.",
    messages: [{ role: "user", content: `FACTS (JSON):\n${JSON.stringify(f)}` }],
  });
  if (res.stop_reason === "refusal") throw new Error("refusal");
  const text = res.content.find((b: any) => b.type === "text")?.text ?? "";
  return JSON.parse(text) as Edition;
}

export async function writeEdition(dayStr = new Date().toISOString().slice(0, 10)) {
  const since = Date.now() - 24 * 3600_000;
  const facts = await gatherFacts(since);
  let ed: Edition;
  try {
    ed = hasClaude() ? await claudeEdition(facts) : offlineEdition(facts);
  } catch (e) {
    console.error("edition via Claude failed, using offline:", (e as Error).message);
    ed = offlineEdition(facts);
  }
  await run(
    `INSERT INTO editions(day, headline, body, created_at) VALUES(?,?,?,?)
     ON CONFLICT(day) DO UPDATE SET headline = excluded.headline, body = excluded.body, created_at = excluded.created_at`,
    [dayStr, ed.headline, JSON.stringify(ed), Date.now()],
  );
  return ed;
}
