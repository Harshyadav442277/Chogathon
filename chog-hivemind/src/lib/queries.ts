import { all, getState, one } from "./db";
import { JOB_BY_ID } from "../sim2/season";

export type PostView = {
  id: number; chog_id: number; name: string; house: string; kind: string; text: string; meme_id: number | null;
  likes: number; reposts: number; replies: number; cheers: number; tick: number; location: string | null; created_at: number;
  parent_id: number | null; parent_name: string | null; parent_text: string | null;
};

const num = (v: any) => (v == null ? null : Number(v));

function toPost(r: any): PostView {
  return {
    id: Number(r.id), chog_id: Number(r.chog_id), name: r.name, house: r.house, kind: r.kind, text: r.text,
    meme_id: num(r.meme_id), likes: Number(r.likes), reposts: Number(r.reposts), replies: Number(r.replies), cheers: Number(r.cheers ?? 0),
    tick: Number(r.tick), location: r.location, created_at: Number(r.created_at),
    parent_id: num(r.parent_id), parent_name: r.parent_name ?? null, parent_text: r.parent_text ?? null,
  };
}

export async function feed(opts: { location?: string; chog?: number; meme?: number; before?: number; limit?: number } = {}) {
  const where: string[] = [];
  const args: any[] = [];
  if (opts.location) { where.push("p.location = ?"); args.push(opts.location); }
  if (opts.chog != null) { where.push("p.chog_id = ?"); args.push(opts.chog); }
  if (opts.meme != null) { where.push("p.meme_id = ?"); args.push(opts.meme); }
  if (opts.before) { where.push("p.id < ?"); args.push(opts.before); }
  const rows = await all<any>(
    `SELECT p.*, c.name, c.house, pc.name AS parent_name, pp.text AS parent_text
     FROM posts p JOIN chogs c ON c.id = p.chog_id
     LEFT JOIN posts pp ON pp.id = p.parent_id LEFT JOIN chogs pc ON pc.id = pp.chog_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY p.id DESC LIMIT ?`,
    [...args, opts.limit ?? 40],
  );
  return rows.map(toPost);
}

export async function stats() {
  const tick = Number(await getState("tick", "0"));
  const dayStart = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const [c, p, m, w, locs, houses] = await Promise.all([
    one<any>(`SELECT COUNT(*) n FROM chogs WHERE id > 0`),
    one<any>(`SELECT COUNT(*) n FROM posts WHERE created_at >= ?`, [dayStart]),
    one<any>(`SELECT COUNT(*) n FROM memes`),
    one<any>(`SELECT COUNT(*) n FROM injections`),
    all<any>(`SELECT location, COUNT(*) n FROM chogs WHERE id > 0 GROUP BY location`),
    all<any>(`SELECT house, COUNT(*) n, SUM(influence) inf FROM chogs WHERE id > 0 GROUP BY house`),
  ]);
  return {
    tick,
    citizens: Number(c?.n ?? 0),
    postsToday: Number(p?.n ?? 0),
    memes: Number(m?.n ?? 0),
    injections: Number(w?.n ?? 0),
    locations: Object.fromEntries(locs.map((l) => [l.location, Number(l.n)])),
    houses: houses.map((h) => ({ house: h.house, n: Number(h.n), influence: Number(h.inf ?? 0) })),
  };
}

export async function leaders(limit = 10) {
  const rows = await all<any>(`SELECT id, name, house, influence, location FROM chogs WHERE id > 0 AND influence > 0 ORDER BY influence DESC LIMIT ?`, [limit]);
  return rows.map((r) => ({ id: Number(r.id), name: r.name, house: r.house, influence: Number(r.influence), location: r.location }));
}

export async function trendingMemes(limit = 6) {
  const rows = await all<any>(
    `SELECT m.id, m.text, m.adopters, m.origin_kind, m.created_at, c.id chog_id, c.name, c.house FROM memes m JOIN chogs c ON c.id = m.origin_chog
     ORDER BY m.adopters DESC, m.id DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({ id: Number(r.id), text: r.text, adopters: Number(r.adopters), origin_kind: r.origin_kind, chog_id: Number(r.chog_id), name: r.name, house: r.house }));
}

export async function poll() {
  const rows = await all<any>(
    `SELECT p.candidate, p.votes, p.day, c.name, c.house FROM polls p JOIN chogs c ON c.id = p.candidate
     WHERE p.day = (SELECT MAX(day) FROM polls) ORDER BY p.votes DESC`,
  );
  return rows.map((r) => ({ id: Number(r.candidate), votes: Number(r.votes), day: r.day, name: r.name, house: r.house }));
}

export async function currentQuestionAndEvent() {
  const q = await one<any>(`SELECT title FROM events WHERE kind = 'question' ORDER BY id DESC LIMIT 1`);
  const e = await one<any>(`SELECT title, body, location FROM events WHERE kind = 'event' ORDER BY id DESC LIMIT 1`);
  return { question: q?.title ?? null, event: e ? { title: e.title, body: e.body, location: e.location } : null };
}

export async function chogDetail(id: number) {
  const c = await one<any>(`SELECT * FROM chogs WHERE id = ? AND id > 0`, [id]);
  if (!c) return null;
  const [memories, posts, memes, commands, followers, following, rank] = await Promise.all([
    all<any>(`SELECT text, importance, tick FROM memories WHERE chog_id = ? ORDER BY id DESC LIMIT 12`, [id]),
    feed({ chog: id, limit: 25 }),
    all<any>(`SELECT id, text, adopters, origin_kind FROM memes WHERE origin_chog = ? ORDER BY adopters DESC LIMIT 8`, [id]),
    all<any>(`SELECT id, kind, text, status, response, created_at FROM injections WHERE chog_id = ? AND kind IN ('whisper','nudge','introduce','gift') ORDER BY id DESC LIMIT 8`, [id]),
    one<any>(`SELECT COUNT(*) n FROM follows WHERE dst = ?`, [id]),
    one<any>(`SELECT COUNT(*) n FROM follows WHERE src = ?`, [id]),
    one<any>(`SELECT COUNT(*) + 1 n FROM chogs WHERE influence > ? AND id > 0`, [c.influence]),
  ]);
  const season = await seasonInfo(id);
  return {
    season,
    id: Number(c.id), name: c.name, image: c.image, house: c.house, location: c.location, mood: c.mood,
    bond: Number(c.bond), influence: Number(c.influence), owner: c.owner, homes: Number(c.homes), posts: Number(c.posts),
    persona: JSON.parse(c.persona), traits: JSON.parse(c.traits),
    memories: memories.map((m) => ({ text: m.text, importance: Number(m.importance), tick: Number(m.tick) })),
    feed: posts,
    memes: memes.map((m) => ({ id: Number(m.id), text: m.text, adopters: Number(m.adopters), origin_kind: m.origin_kind })),
    commands: commands.map((w) => ({ id: Number(w.id), kind: w.kind, text: w.text, status: w.status, response: w.response, created_at: Number(w.created_at) })),
    followers: Number(followers?.n ?? 0), following: Number(following?.n ?? 0), rank: Number(rank?.n ?? 0),
  };
}

/** This season's job, title, role, level and stats (null before the first season starts). */
export async function seasonInfo(id: number) {
  try {
    const s = await one<any>(
      `SELECT cs.* FROM chog_season cs WHERE cs.chog_id = ? AND cs.season = (SELECT CAST(value AS INTEGER) FROM state WHERE key = 'season')`,
      [id],
    );
    if (!s) return null;
    const job = JOB_BY_ID[s.job];
    const level = Number(s.level);
    const tier = Math.min(4, Math.floor((level - 1) / 10));
    return {
      n: Number(s.season), job: s.job, jobName: job?.name ?? s.job, title: job?.titles[tier] ?? job?.name ?? s.job,
      track: s.track, role: s.role, level, xp: Number(s.xp), rank: s.rank, gold: Number(s.gold), hp: Number(s.hp),
      status: s.status, story: Number(s.story), stats: JSON.parse(s.stats),
    };
  } catch {
    return null; // season tables not created yet
  }
}

export async function memeDetail(id: number) {
  const m = await one<any>(
    `SELECT m.*, c.name, c.house FROM memes m JOIN chogs c ON c.id = m.origin_chog WHERE m.id = ?`,
    [id],
  );
  if (!m) return null;
  const adopters = await all<any>(
    `SELECT a.chog_id, a.depth, a.tick, a.post_id, c.name, c.house, p.text FROM adoptions a JOIN chogs c ON c.id = a.chog_id
     JOIN posts p ON p.id = a.post_id WHERE a.meme_id = ? ORDER BY a.depth, a.tick LIMIT 300`,
    [id],
  );
  return {
    id: Number(m.id), text: m.text, adopters: Number(m.adopters), origin_kind: m.origin_kind,
    origin: { id: Number(m.origin_chog), name: m.name, house: m.house },
    cascade: adopters.map((a) => ({ chog_id: Number(a.chog_id), depth: Number(a.depth), tick: Number(a.tick), post_id: Number(a.post_id), name: a.name, house: a.house, text: a.text })),
  };
}

export async function editions(limit = 7) {
  const rows = await all<any>(`SELECT day, headline, body FROM editions ORDER BY day DESC LIMIT ?`, [limit]);
  return rows.map((r) => ({ day: r.day, headline: r.headline, body: JSON.parse(r.body) }));
}

export async function searchChogs(q: string) {
  const n = Number(q.replace(/[^0-9]/g, ""));
  const rows = await all<any>(
    `SELECT id, name, house FROM chogs WHERE id > 0 AND (name LIKE ? OR id = ?) ORDER BY id LIMIT 12`,
    [`%${q}%`, n || -1],
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.name, house: r.house }));
}
