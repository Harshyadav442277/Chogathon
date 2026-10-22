import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET || "dev-only-secret-change-me";
const COOKIE = "hive_session";

export type Session = { address: string; judge?: boolean; exp: number };

const sign = (payload: string) => createHmac("sha256", SECRET).update(payload).digest("base64url");

export function encodeSession(s: Session): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token?: string): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  return decodeSession(c.get(COOKIE)?.value);
}

export async function setSession(s: Omit<Session, "exp">) {
  const c = await cookies();
  const exp = Date.now() + 7 * 24 * 3600_000;
  c.set(COOKIE, encodeSession({ ...s, exp }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 24 * 3600 });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}

export function signInMessage(address: string, issuedAt: string) {
  return `Sign in to ChogSekai\n\nThis only proves you own this wallet. It costs nothing and sends no transaction.\n\nAddress: ${address}\nIssued: ${issuedAt}`;
}

export const judgeChogIds = () =>
  (process.env.JUDGE_CHOG_IDS || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => n > 0);
