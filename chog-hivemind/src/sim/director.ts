// Director: injects world events, syncs real onchain ownership, runs daily polls.
import { all, batch, getState, one, run, setState } from "../lib/db";
import { allOwners, blockNumber } from "../lib/chain";
import { HOUSES, LOCATIONS, locationName, hash } from "./world";

const now = () => Date.now();
const day = () => new Date().toISOString().slice(0, 10);

const QUESTIONS = [
  "Should Skulls be allowed to vote in the Hivemind election?",
  "Is Monad actually the fastest chain, or is that just House Laser propaganda?",
  "Who really rugged the Rug Docks in 2023?",
  "Should the town build a second pond?",
  "Is the golden Chog real?",
  "Which house would survive a bear market?",
  "Should the Mayor be the most influential Chog or the kindest one?",
  "Are the arcade high scores rigged?",
  "Should Mon Market ban hot takes after midnight?",
  "Is it rude to repost without replying?",
  "What is the one rule every Chog should follow?",
  "Do whispers from humans make us smarter or weaker?",
];

const WORLD_EVENTS = [
  { title: "Fog rolls into Chog Pond", body: "Nobody can see who is talking. Rumors travel twice as fast.", location: "pond" },
  { title: "Arcade tournament at Block 143", body: "A leaderboard reset sparks accusations of cheating.", location: "arcade" },
  { title: "Mon Market flash sale", body: "Every stall slashes prices for one hour. Hustlers are thrilled.", location: "market" },
  { title: "Town Hall debate night", body: "Candidates for Mayor are expected to speak. Bring snacks.", location: "hall" },
  { title: "Strange lights in Skull Cave", body: "The night owls claim they saw a glowing Chog deep inside.", location: "cave" },
  { title: "Gasless Gardens bloom", body: "Purple flowers everywhere. Even House Laser calmed down.", location: "gardens" },
  { title: "A ship docks at Rug Docks", body: "Crates labeled 'definitely not a rug' are being unloaded.", location: "docks" },
  { title: "Purple Plaza street festival", body: "Music, frog-shaped snacks and a lot of loud opinions.", location: "plaza" },
  { title: "Validator blackout drill", body: "The town practices what happens if blocks stop. Panic is optional.", location: "hall" },
  { title: "A mysterious letter appears", body: "Someone pinned an unsigned note to the Town Hall door: 'the hive is listening.'", location: "hall" },
];

async function postNews(tick: number, title: string, body: string, location: string | null) {
  // News posts come from the town crier (the lowest-id Chog acts as narrator voice only in UI).
  await run(`INSERT INTO events(kind, title, body, location, tick, created_at) VALUES('event', ?, ?, ?, ?, ?)`, [title, body, location, tick, now()]);
  await run(
    `INSERT INTO posts(chog_id, kind, text, location, tick, created_at) VALUES(0, 'news', ?, ?, ?, ?)`,
    [`${title}. ${body}`, location, tick, now()],
  );
}

async function syncOwners(tick: number) {
  let owners: Map<number, string>;
  try {
    owners = await allOwners();
  } catch (e) {
    console.error("owner sync failed:", (e as Error).message);
    return;
  }
  if (owners.size < 100) return;
  const rows = await all<{ id: number; name: string; owner: string | null; location: string }>(`SELECT id, name, owner, location FROM chogs WHERE id > 0`);
  const stmts: any[] = [];
  const movers: string[] = [];
  for (const r of rows) {
    const o = owners.get(Number(r.id));
    if (!o) continue;
    if (r.owner && r.owner !== o) {
      movers.push(r.name);
      stmts.push(
        { sql: `UPDATE chogs SET owner = ?, homes = homes + 1, bond = 30 WHERE id = ?`, args: [o, r.id] },
        { sql: `INSERT INTO memories(chog_id, text, importance, tick) VALUES(?, ?, 4, ?)`, args: [r.id, "I moved into a new home today. New human, same me.", tick] },
      );
    } else if (!r.owner) {
      stmts.push({ sql: `UPDATE chogs SET owner = ? WHERE id = ?`, args: [o, r.id] });
    }
  }
  await batch(stmts);
  for (const name of movers.slice(0, 3)) {
    await postNews(tick, `${name} moved to a new home`, "A real onchain transfer just happened. Same Chog, new human. Neighbors are curious.", null);
  }
  await setState("owners_synced_at", now());
}

export async function runPoll(tick: number) {
  const candidates = await all<{ id: number; house: string }>(`SELECT id, house FROM chogs WHERE id > 0 ORDER BY influence DESC LIMIT 5`);
  if (!candidates.length) return;
  const candIds = new Set(candidates.map((c) => Number(c.id)));
  const byHouse = new Map<string, number>();
  for (const c of candidates) if (!byHouse.has(c.house)) byHouse.set(c.house, Number(c.id));
  const voters = await all<{ id: number; house: string; allegiance: number | null }>(`SELECT id, house, allegiance FROM chogs WHERE id > 0`);
  const tally = new Map<number, number>();
  for (const v of voters) {
    let pick: number | undefined;
    if (v.allegiance != null && candIds.has(Number(v.allegiance))) pick = Number(v.allegiance);
    else if (byHouse.has(v.house) && hash(`vote:${v.id}:${day()}`) % 100 < 70) pick = byHouse.get(v.house);
    else pick = Number(candidates[hash(`v2:${v.id}:${day()}`) % candidates.length].id);
    if (pick != null) tally.set(pick, (tally.get(pick) ?? 0) + 1);
  }
  await run(`DELETE FROM polls WHERE day = ?`, [day()]);
  await batch(
    [...tally.entries()].map(([c, n]) => ({ sql: `INSERT INTO polls(day, candidate, votes) VALUES(?,?,?)`, args: [day(), c, n] })),
  );
}

export async function runDirector(tick: number) {
  // Daily town question
  const qDay = await getState("question_day");
  if (qDay !== day()) {
    const q = QUESTIONS[hash(day()) % QUESTIONS.length];
    await run(`INSERT INTO events(kind, title, body, tick, created_at) VALUES('question', ?, '', ?, ?)`, [q, tick, now()]);
    await run(`INSERT INTO posts(chog_id, kind, text, location, tick, created_at) VALUES(0, 'news', ?, 'hall', ?, ?)`, [`Today's Town Question: ${q}`, tick, now()]);
    await setState("question_day", day());
  }
  // World event every 6 ticks
  if (tick === 1 || tick % 6 === 0) {
    const last = await one<{ title: string }>(`SELECT title FROM events WHERE kind='event' ORDER BY id DESC LIMIT 1`);
    let ev = WORLD_EVENTS[hash(`ev:${tick}`) % WORLD_EVENTS.length];
    if (last && last.title === ev.title) ev = WORLD_EVENTS[(hash(`ev:${tick}`) + 1) % WORLD_EVENTS.length];
    // Occasionally ground an event in real chain data.
    if (tick % 18 === 0) {
      const bn = await blockNumber();
      if (bn) {
        await postNews(tick, `Monad passes block ${bn.toLocaleString("en-US")}`, "The chain keeps humming. House Laser claims credit. House Glass is suspicious.", "plaza");
      } else await postNews(tick, ev.title, ev.body, ev.location);
    } else {
      await postNews(tick, ev.title, ev.body, ev.location);
    }
  }
  // Real ownership sync (detects sales => "moving house")
  const lastSync = Number(await getState("owners_synced_at", "0"));
  if (process.env.SKIP_CHAIN !== "1" && now() - lastSync > 30 * 60_000) await syncOwners(tick);
  // Daily poll refresh
  if (tick % 6 === 0) await runPoll(tick);
}

export const HOUSE_LIST = HOUSES;
export const LOCATION_LIST = LOCATIONS;
export { locationName };
