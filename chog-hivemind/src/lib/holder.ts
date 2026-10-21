// Holder powers: who may command a Chog, and the daily Mon Energy budget.
import { clientKey } from "./api";
import { one, run } from "./db";
import { ownerOf } from "./chain";
import { judgeChogIds, type Session } from "./session";
import { HOLDER_KINDS } from "../sim/types";

export const ENERGY_PER_DAY = 6;

export const today = () => new Date().toISOString().slice(0, 10);

/** Energy is per holder. Judges share one login, so each judge's browser gets its own budget. */
export async function holderKey(s: Session): Promise<string> {
  return s.judge ? `judge:${await clientKey()}` : s.address.toLowerCase();
}

/** True when this session may command the Chog; refreshes the cached owner on success. */
export async function canCommand(s: Session, id: number): Promise<boolean> {
  if (s.judge) return judgeChogIds().includes(id);
  const owner = await ownerOf(id);
  const ok = !!owner && owner.toLowerCase() === s.address.toLowerCase();
  if (ok) await run(`UPDATE chogs SET owner = ? WHERE id = ?`, [owner!.toLowerCase(), id]);
  return ok;
}

const USED_SQL = `SELECT COUNT(*) FROM injections WHERE author = ? AND day = ? AND kind IN (${HOLDER_KINDS.map(() => "?").join(",")})`;

/** Every command costs 1 energy, so energy used = commands sent today. */
export async function energyLeft(author: string): Promise<number> {
  const r = await one<{ n: number }>(USED_SQL.replace("COUNT(*)", "COUNT(*) n"), [author, today(), ...HOLDER_KINDS]);
  return Math.max(0, ENERGY_PER_DAY - Number(r?.n ?? 0));
}

type Command = { kind: string; chogId: number; location: string | null; target: number | null; author: string; text: string };

/**
 * Queue a command and spend 1 energy in one statement, so parallel requests can't
 * beat the once-per-Chog-per-day rule or the daily budget.
 */
export async function queueCommand(c: Command): Promise<"ok" | "repeat" | "empty"> {
  const day = today();
  const r = await run(
    `INSERT INTO injections(kind, chog_id, location, target_chog, author, text, day, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM injections WHERE kind = ? AND chog_id = ? AND day = ?)
       AND (${USED_SQL}) < ?`,
    [c.kind, c.chogId, c.location, c.target, c.author, c.text, day, Date.now(), c.kind, c.chogId, day, c.author, day, ...HOLDER_KINDS, ENERGY_PER_DAY],
  );
  if (r.rowsAffected) return "ok";
  const dup = await one(`SELECT 1 x FROM injections WHERE kind = ? AND chog_id = ? AND day = ?`, [c.kind, c.chogId, day]);
  return dup ? "repeat" : "empty";
}
