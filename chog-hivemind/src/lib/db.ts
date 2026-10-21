import { createClient, type Client, type InStatement, type Row } from "@libsql/client";

let client: Client | null = null;

export function db(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL || "file:hivemind.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export async function all<T = Row>(sql: string, args: any[] = []): Promise<T[]> {
  const r = await db().execute({ sql, args });
  return r.rows as unknown as T[];
}

export async function one<T = Row>(sql: string, args: any[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export async function run(sql: string, args: any[] = []) {
  return db().execute({ sql, args });
}

export async function batch(stmts: InStatement[]) {
  if (!stmts.length) return;
  for (let i = 0; i < stmts.length; i += 200) await db().batch(stmts.slice(i, i + 200), "write");
}

export async function getState(key: string, fallback = ""): Promise<string> {
  const r = await one<{ value: string }>("SELECT value FROM state WHERE key = ?", [key]);
  return r?.value ?? fallback;
}

export async function setState(key: string, value: string | number) {
  await run(
    "INSERT INTO state(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, String(value)],
  );
}

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS chogs (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    meta_n INTEGER,
    image TEXT,
    traits TEXT NOT NULL,
    persona TEXT NOT NULL,
    house TEXT NOT NULL,
    location TEXT NOT NULL,
    mood TEXT NOT NULL DEFAULT 'curious',
    activity REAL NOT NULL DEFAULT 0.5,
    influence REAL NOT NULL DEFAULT 0,
    bond INTEGER NOT NULL DEFAULT 30,
    owner TEXT,
    homes INTEGER NOT NULL DEFAULT 1,
    allegiance INTEGER,
    last_tick INTEGER NOT NULL DEFAULT 0,
    posts INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS chogs_house ON chogs(house)`,
  `CREATE INDEX IF NOT EXISTS chogs_influence ON chogs(influence DESC)`,
  `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chog_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    parent_id INTEGER,
    text TEXT NOT NULL,
    meme_id INTEGER,
    depth INTEGER NOT NULL DEFAULT 0,
    location TEXT,
    likes INTEGER NOT NULL DEFAULT 0,
    reposts INTEGER NOT NULL DEFAULT 0,
    replies INTEGER NOT NULL DEFAULT 0,
    tick INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS posts_tick ON posts(tick DESC)`,
  `CREATE INDEX IF NOT EXISTS posts_chog ON posts(chog_id, id DESC)`,
  `CREATE INDEX IF NOT EXISTS posts_meme ON posts(meme_id)`,
  `CREATE INDEX IF NOT EXISTS posts_parent ON posts(parent_id)`,
  `CREATE TABLE IF NOT EXISTS follows (src INTEGER NOT NULL, dst INTEGER NOT NULL, PRIMARY KEY (src, dst))`,
  `CREATE INDEX IF NOT EXISTS follows_dst ON follows(dst)`,
  `CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chog_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    importance INTEGER NOT NULL DEFAULT 1,
    tick INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS memories_chog ON memories(chog_id, id DESC)`,
  `CREATE TABLE IF NOT EXISTS memes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin_chog INTEGER NOT NULL,
    origin_kind TEXT NOT NULL,
    text TEXT NOT NULL,
    adopters INTEGER NOT NULL DEFAULT 0,
    created_tick INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS adoptions (
    meme_id INTEGER NOT NULL,
    chog_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    depth INTEGER NOT NULL,
    tick INTEGER NOT NULL,
    PRIMARY KEY (meme_id, chog_id)
  )`,
  `CREATE TABLE IF NOT EXISTS injections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    chog_id INTEGER,
    location TEXT,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    response TEXT,
    post_id INTEGER,
    meme_id INTEGER,
    day TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS injections_status ON injections(status)`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    location TEXT,
    tick INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS editions (
    day TEXT PRIMARY KEY,
    headline TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS polls (
    day TEXT NOT NULL,
    candidate INTEGER NOT NULL,
    votes INTEGER NOT NULL,
    PRIMARY KEY (day, candidate)
  )`,
  `CREATE TABLE IF NOT EXISTS ratelimits (key TEXT PRIMARY KEY, count INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];

// Columns added after the first release; ALTER fails harmlessly if they already exist.
const ADDED_COLUMNS = [
  `ALTER TABLE injections ADD COLUMN target_chog INTEGER`,
  `ALTER TABLE posts ADD COLUMN cheers INTEGER NOT NULL DEFAULT 0`,
];

export async function migrate() {
  // Local file DB: WAL lets the web server read while the sim loop writes.
  if (!process.env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL.startsWith("file:")) {
    try {
      await run("PRAGMA journal_mode = WAL");
      await run("PRAGMA busy_timeout = 5000");
    } catch {}
  }
  for (const s of SCHEMA) await run(s);
  for (const s of ADDED_COLUMNS) {
    try {
      await run(s);
    } catch {}
  }
}
