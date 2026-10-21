import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { one, run } from "./db";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "local").split(",")[0].trim();
  return createHash("sha256").update(ip + (process.env.SESSION_SECRET || "")).digest("hex").slice(0, 16);
}

/** Increment a daily counter; returns false once `max` is exceeded. */
export async function rateLimit(bucket: string, max: number): Promise<boolean> {
  const key = `${bucket}:${new Date().toISOString().slice(0, 10)}`;
  await run(
    `INSERT INTO ratelimits(key, count) VALUES(?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1`,
    [key],
  );
  const r = await one<{ count: number }>(`SELECT count FROM ratelimits WHERE key = ?`, [key]);
  return Number(r?.count ?? 0) <= max;
}
