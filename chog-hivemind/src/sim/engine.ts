// One simulation tick: pick active Chogs, rank their feeds, ask the brain, apply actions.
import type { InStatement } from "@libsql/client";
import { all, batch, getState, one, run, setState } from "../lib/db";
import { offlineStep } from "./brain-offline";
import { claudeStep, hasClaude } from "./brain-claude";
import { rankFeed } from "./feed";
import { HOLDER_KINDS, type Agent, type Decision, type FeedItem, type Injection, type Memory, type StepInput, type WorldContext } from "./types";
import { LOCATION_IDS, MOODS } from "./world";
import { runDirector } from "./director";
import { cleanText } from "../lib/moderation";

const now = () => Date.now();
const VIRAL_THRESHOLD = 3;
export const today = () => new Date().toISOString().slice(0, 10);

type ChogRow = {
  id: number; name: string; image: string | null; house: string; location: string; mood: string;
  bond: number; influence: number; owner: string | null; persona: string; activity: number; last_tick: number;
};

const toAgent = (r: ChogRow): Agent => ({
  id: Number(r.id), name: r.name, image: r.image, house: r.house, location: r.location, mood: r.mood,
  bond: Number(r.bond), influence: Number(r.influence), owner: r.owner, persona: JSON.parse(r.persona),
});

async function selectActive(tick: number, target: number, forced: number[]): Promise<Agent[]> {
  const hour = new Date().getUTCHours();
  // Over-sample, then filter by active hours and activity level (MiroFish activation rule).
  const rows = await all<ChogRow>(
    `SELECT * FROM chogs WHERE id > 0 AND last_tick < ? ORDER BY RANDOM() LIMIT ?`,
    [tick, target * 10],
  );
  const chosen: Agent[] = [];
  for (const r of rows) {
    const a = toAgent(r);
    const inHours = a.persona.activeHours.includes(hour);
    const p = a.persona.activity * (inHours ? 1 : 0.15) * (a.owner ? 1.2 : 1);
    if (Math.random() < p) chosen.push(a);
    if (chosen.length >= target) break;
  }
  if (forced.length) {
    const have = new Set(chosen.map((c) => c.id));
    const extra = await all<ChogRow>(
      `SELECT * FROM chogs WHERE id IN (${forced.map(() => "?").join(",")})`,
      forced,
    );
    for (const r of extra) if (!have.has(Number(r.id))) chosen.push(toAgent(r));
  }
  return chosen;
}

async function worldContext(tick: number): Promise<WorldContext> {
  const ev = await one<{ title: string; body: string }>(
    `SELECT title, body FROM events WHERE kind != 'question' ORDER BY id DESC LIMIT 1`,
  );
  const q = await one<{ title: string }>(`SELECT title FROM events WHERE kind = 'question' ORDER BY id DESC LIMIT 1`);
  const memes = await all<{ id: number; text: string; adopters: number }>(
    `SELECT id, text, adopters FROM memes ORDER BY adopters DESC, id DESC LIMIT 5`,
  );
  return {
    tick,
    hourUtc: new Date().getUTCHours(),
    event: ev ?? null,
    question: q?.title ?? null,
    memes: memes.map((m) => ({ id: Number(m.id), text: m.text, adopters: Number(m.adopters) })),
  };
}

async function postPool(tick: number): Promise<FeedItem[]> {
  const rows = await all<any>(
    `SELECT p.id, p.chog_id, c.name, c.house, p.kind, p.text, p.meme_id, p.depth, p.likes, p.reposts, p.replies, p.cheers, p.tick, p.location
     FROM posts p JOIN chogs c ON c.id = p.chog_id
     WHERE p.tick >= ? ORDER BY p.id DESC LIMIT 400`,
    [tick - 36],
  );
  return rows.map((r) => ({
    ...r,
    id: Number(r.id), chog_id: Number(r.chog_id), meme_id: r.meme_id == null ? null : Number(r.meme_id),
    depth: Number(r.depth), likes: Number(r.likes), reposts: Number(r.reposts), replies: Number(r.replies),
    cheers: Number(r.cheers ?? 0), tick: Number(r.tick),
  }));
}

async function pendingInjections(): Promise<Injection[]> {
  const rows = await all<any>(
    `SELECT i.id, i.kind, i.chog_id, i.location, i.target_chog, i.author, i.text, t.name AS target_name
     FROM injections i LEFT JOIN chogs t ON t.id = i.target_chog WHERE i.status = 'pending' ORDER BY i.id LIMIT 120`,
  );
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    chog_id: r.chog_id == null ? null : Number(r.chog_id),
    target_chog: r.target_chog == null ? null : Number(r.target_chog),
  }));
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export async function tick(opts: { agents?: number; brain?: "auto" | "offline" | "claude" } = {}) {
  const t = Number(await getState("tick", "0")) + 1;
  await setState("tick", t);
  const useClaude = opts.brain === "claude" || (opts.brain !== "offline" && hasClaude());
  const target = opts.agents ?? Number(process.env.TICK_AGENTS || (useClaude ? 30 : 60));

  await runDirector(t);

  const injections = await pendingInjections();
  const whisperFor = new Map<number, Injection>();
  const rumorsByLoc = new Map<string, Injection[]>();
  for (const inj of injections) {
    // One holder action per Chog per tick; the rest wait for the next tick.
    if (HOLDER_KINDS.includes(inj.kind) && inj.chog_id != null && !whisperFor.has(inj.chog_id)) whisperFor.set(inj.chog_id, inj);
    if (inj.kind === "rumor" && inj.location) rumorsByLoc.set(inj.location, [...(rumorsByLoc.get(inj.location) ?? []), inj]);
  }

  const agents = await selectActive(t, target, [...whisperFor.keys()]);
  const world = await worldContext(t);
  const posts = await postPool(t);
  const postById = new Map(posts.map((p) => [p.id, p]));

  const ids = agents.map((a) => a.id);
  const follows = ids.length
    ? await all<{ src: number; dst: number }>(
        `SELECT src, dst FROM follows WHERE src IN (${ids.map(() => "?").join(",")})`,
        ids,
      )
    : [];
  const followMap = new Map<number, Set<number>>();
  for (const f of follows) {
    const s = followMap.get(Number(f.src)) ?? new Set<number>();
    s.add(Number(f.dst));
    followMap.set(Number(f.src), s);
  }
  const memRows = ids.length
    ? await all<any>(
        `SELECT chog_id, text, importance, tick FROM memories WHERE chog_id IN (${ids.map(() => "?").join(",")}) ORDER BY id DESC LIMIT ${ids.length * 12}`,
        ids,
      )
    : [];
  const memMap = new Map<number, Memory[]>();
  for (const m of memRows) {
    const l = memMap.get(Number(m.chog_id)) ?? [];
    l.push({ text: m.text, importance: Number(m.importance), tick: Number(m.tick) });
    memMap.set(Number(m.chog_id), l);
  }

  // Each rumor is heard by up to 3 Chogs standing in that location.
  const rumorFor = new Map<number, Injection>();
  for (const [loc, list] of rumorsByLoc) {
    const here = agents.filter((a) => a.location === loc && !whisperFor.has(a.id) && !rumorFor.has(a.id));
    for (const inj of list) for (const a of here.splice(0, 3)) rumorFor.set(a.id, inj);
  }

  // Introductions: make sure the target's latest post is in the introduced Chog's feed.
  const introTargets = [...whisperFor.values()].filter((i) => i.kind === "introduce" && i.target_chog).map((i) => i.target_chog!);
  if (introTargets.length) {
    const latest = await all<any>(
      `SELECT p.id, p.chog_id, c.name, c.house, p.kind, p.text, p.meme_id, p.depth, p.likes, p.reposts, p.replies, p.cheers, p.tick, p.location
       FROM posts p JOIN chogs c ON c.id = p.chog_id
       WHERE p.id IN (SELECT MAX(id) FROM posts WHERE chog_id IN (${introTargets.map(() => "?").join(",")}) GROUP BY chog_id)`,
      introTargets,
    );
    for (const r of latest) {
      const fi: FeedItem = { ...r, id: Number(r.id), chog_id: Number(r.chog_id), meme_id: r.meme_id == null ? null : Number(r.meme_id), depth: Number(r.depth), likes: Number(r.likes), reposts: Number(r.reposts), replies: Number(r.replies), cheers: Number(r.cheers ?? 0), tick: Number(r.tick) };
      if (!postById.has(fi.id)) { posts.push(fi); postById.set(fi.id, fi); }
    }
  }

  const inputs: StepInput[] = agents.map((agent) => {
    const inj = whisperFor.get(agent.id) ?? rumorFor.get(agent.id) ?? null;
    let feed = rankFeed(agent, posts, followMap.get(agent.id) ?? new Set(), t);
    if (inj?.kind === "introduce" && inj.target_chog) {
      const theirs = posts.filter((p) => p.chog_id === inj.target_chog).sort((a, b) => b.id - a.id)[0];
      if (theirs && !feed.some((f) => f.id === theirs.id)) feed = [theirs, ...feed.slice(0, 9)];
    }
    return {
    agent,
    feed,
    memories: (memMap.get(agent.id) ?? [])
      .sort((a, b) => b.importance * 3 + b.tick / 10 - (a.importance * 3 + a.tick / 10))
      .slice(0, 5),
    injection: inj,
    world,
  };
  });

  let errors = 0;
  const decisions = await pool(inputs, useClaude ? 8 : 32, async (inp) => {
    try {
      return useClaude ? await claudeStep(inp) : await offlineStep(inp);
    } catch (e) {
      errors++;
      if (errors <= 3) console.error(`brain error for #${inp.agent.id}:`, (e as Error).message);
      return offlineStep(inp);
    }
  });

  const stats = { tick: t, agents: agents.length, posts: 0, replies: 0, reposts: 0, likes: 0, moves: 0, follows: 0, adoptions: 0, injections: 0, brain: useClaude ? "claude" : "offline", errors };
  const handledRumors = new Set<number>();
  for (let i = 0; i < inputs.length; i++) {
    await apply(inputs[i], decisions[i], t, postById, stats, handledRumors);
  }
  // Rumors that nobody picked up this tick expire after a while.
  await run(`UPDATE injections SET status = 'faded' WHERE kind = 'rumor' AND status = 'pending' AND created_at < ?`, [now() - 6 * 3600_000]);
  return stats;
}

async function apply(
  inp: StepInput,
  d: Decision,
  t: number,
  postById: Map<number, FeedItem>,
  stats: Record<string, any>,
  handledRumors: Set<number>,
) {
  const a = inp.agent;
  const stmts: InStatement[] = [];
  const mood = d.mood && d.mood.length <= 24 ? d.mood.toLowerCase() : a.mood;
  stmts.push({ sql: `UPDATE chogs SET last_tick = ?, mood = ? WHERE id = ?`, args: [t, MOODS.includes(mood) ? mood : mood.replace(/[^a-z ]/g, "").slice(0, 16) || a.mood, a.id] });
  const feedIds = new Set(inp.feed.map((f) => f.id));
  const target = d.target_post_id && feedIds.has(d.target_post_id) ? postById.get(d.target_post_id) : undefined;
  const text = d.text ? cleanText(d.text, 220) : "";
  const inj = inp.injection;
  const injResp = inj ? d.injection_response ?? "ignore" : "none";

  const insertPost = async (kind: string, body: string, parent?: FeedItem, memeId?: number | null, depth = 0) => {
    const r = await run(
      `INSERT INTO posts(chog_id, kind, parent_id, text, meme_id, depth, location, tick, created_at) VALUES(?,?,?,?,?,?,?,?,?)`,
      [a.id, kind, parent?.id ?? null, body, memeId ?? null, depth, a.location, t, now()],
    );
    stats.posts++;
    return Number(r.lastInsertRowid);
  };

  const adopt = async (memeId: number, postId: number, depth: number) => {
    const meme = await one<{ origin_chog: number }>(`SELECT origin_chog FROM memes WHERE id = ?`, [memeId]);
    if (!meme || Number(meme.origin_chog) === a.id) return;
    const r = await run(
      `INSERT OR IGNORE INTO adoptions(meme_id, chog_id, post_id, depth, tick) VALUES(?,?,?,?,?)`,
      [memeId, a.id, postId, Math.max(1, depth), t],
    );
    if (r.rowsAffected) {
      stats.adoptions++;
      await batch([
        { sql: `UPDATE memes SET adopters = adopters + 1 WHERE id = ?`, args: [memeId] },
        { sql: `UPDATE chogs SET influence = influence + ? WHERE id = ?`, args: [1 / Math.max(1, depth), Number(meme.origin_chog)] },
        { sql: `UPDATE chogs SET allegiance = ? WHERE id = ?`, args: [Number(meme.origin_chog), a.id] },
      ]);
    }
  };

  let postId: number | null = null;
  switch (d.action) {
    case "post": {
      if (!text) break;
      let memeId: number | null = null;
      if (inj && (injResp === "obey" || injResp === "twist")) {
        const m = await run(
          `INSERT INTO memes(origin_chog, origin_kind, text, created_tick, created_at) VALUES(?,?,?,?,?)`,
          [a.id, inj.kind, text, t, now()],
        );
        memeId = Number(m.lastInsertRowid);
      } else if (d.echo_meme_id && inp.world.memes.some((m) => m.id === d.echo_meme_id)) {
        memeId = d.echo_meme_id;
      }
      postId = await insertPost("post", text, undefined, memeId, 0);
      if (memeId && memeId === d.echo_meme_id) await adopt(memeId, postId, 2);
      break;
    }
    case "reply": {
      if (!target || !text) break;
      const carries = target.meme_id && d.echo_meme_id === target.meme_id ? target.meme_id : null;
      postId = await insertPost("reply", text, target, carries, target.depth + 1);
      stmts.push({ sql: `UPDATE posts SET replies = replies + 1 WHERE id = ?`, args: [target.id] });
      stats.replies++;
      if (carries) await adopt(carries, postId, target.depth + 1);
      break;
    }
    case "repost": {
      if (!target || target.chog_id === 0) break;
      // Viral threshold (MiroFish/OASIS): a post reposted 3 times becomes a meme credited to its author.
      if (!target.meme_id && target.reposts + 1 >= VIRAL_THRESHOLD) {
        const m = await run(
          `INSERT INTO memes(origin_chog, origin_kind, text, created_tick, created_at) VALUES(?, 'organic', ?, ?, ?)`,
          [target.chog_id, target.text, t, now()],
        );
        target.meme_id = Number(m.lastInsertRowid);
        await run(`UPDATE posts SET meme_id = ? WHERE id = ? OR (parent_id = ? AND kind = 'repost')`, [target.meme_id, target.id, target.id]);
        // Earlier reposters become the meme's first adopters.
        const earlier = await run(
          `INSERT OR IGNORE INTO adoptions(meme_id, chog_id, post_id, depth, tick)
           SELECT ?, chog_id, MIN(id), 1, ? FROM posts WHERE parent_id = ? AND kind = 'repost' AND chog_id != ? GROUP BY chog_id`,
          [target.meme_id, t, target.id, target.chog_id],
        );
        if (earlier.rowsAffected) {
          await batch([
            { sql: `UPDATE memes SET adopters = adopters + ? WHERE id = ?`, args: [earlier.rowsAffected, target.meme_id] },
            { sql: `UPDATE chogs SET influence = influence + ? WHERE id = ?`, args: [earlier.rowsAffected, target.chog_id] },
          ]);
        }
      }
      target.reposts++;
      postId = await insertPost("repost", target.text, target, target.meme_id, target.depth + 1);
      stmts.push({ sql: `UPDATE posts SET reposts = reposts + 1 WHERE id = ?`, args: [target.id] });
      stats.reposts++;
      if (target.meme_id) await adopt(target.meme_id, postId, target.depth + 1);
      break;
    }
    case "like":
      if (target) {
        stmts.push({ sql: `UPDATE posts SET likes = likes + 1 WHERE id = ?`, args: [target.id] });
        stats.likes++;
      }
      break;
    case "follow": {
      const dst = d.target_chog_id;
      if (dst && dst !== a.id && inp.feed.some((f) => f.chog_id === dst)) {
        stmts.push({ sql: `INSERT OR IGNORE INTO follows(src, dst) VALUES(?, ?)`, args: [a.id, dst] });
        stats.follows++;
      }
      break;
    }
    case "move":
      if (d.location && (LOCATION_IDS as string[]).includes(d.location) && d.location !== a.location) {
        stmts.push({ sql: `UPDATE chogs SET location = ? WHERE id = ?`, args: [d.location, a.id] });
        stats.moves++;
      }
      break;
  }

  if (inj && !(inj.kind === "rumor" && handledRumors.has(inj.id))) {
    stats.injections++;
    const status = injResp === "obey" || injResp === "twist" ? injResp : "ignored";
    if (inj.kind === "whisper") {
      const bondDelta = status === "obey" ? 6 : status === "twist" ? 3 : -2;
      stmts.push({ sql: `UPDATE chogs SET bond = MAX(0, MIN(100, bond + ?)) WHERE id = ?`, args: [bondDelta, a.id] });
      stmts.push({
        sql: `UPDATE injections SET status = ?, response = ?, post_id = ?, meme_id = (SELECT meme_id FROM posts WHERE id = ?) WHERE id = ?`,
        args: [status, text || null, postId, postId, inj.id],
      });
    } else if (status !== "ignored") {
      handledRumors.add(inj.id);
      stmts.push({
        sql: `UPDATE injections SET status = ?, response = ?, post_id = ?, meme_id = (SELECT meme_id FROM posts WHERE id = ?) WHERE id = ?`,
        args: [status, text || null, postId, postId, inj.id],
      });
    }
  }
  if (postId) stmts.push({ sql: `UPDATE chogs SET posts = posts + 1 WHERE id = ?`, args: [a.id] });
  if (d.memory) {
    stmts.push({
      sql: `INSERT INTO memories(chog_id, text, importance, tick) VALUES(?,?,?,?)`,
      args: [a.id, cleanText(d.memory, 160), inj ? 3 : 1, t],
    });
  }
  await batch(stmts);
}
