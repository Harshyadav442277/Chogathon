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

/** Every command costs 1 energy, so energy used = commands sent today. */
export async function energyLeft(author: string): Promise<number> {
  const r = await one<{ n: number }>(
    `SELECT COUNT(*) n FROM injections WHERE author = ? AND day = ? AND kind IN (${HOLDER_KINDS.map(() => "?").join(",")})`,
    [author, today(), ...HOLDER_KINDS],
  );
  return Math.max(0, ENERGY_PER_DAY - Number(r?.n ?? 0));
}
