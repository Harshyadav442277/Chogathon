import { json } from "@/lib/api";
import { all, batch, getState, setState } from "@/lib/db";
import { allOwners } from "@/lib/chain";
import { getSession, judgeChogIds } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return json({ user: null });
  if (s.judge) {
    const ids = judgeChogIds();
    const chogs = ids.length
      ? await all<any>(`SELECT id, name, house, bond FROM chogs WHERE id IN (${ids.map(() => "?").join(",")})`, ids)
      : [];
    return json({ user: { address: "judge", judge: true, chogs } });
  }
  const addr = s.address.toLowerCase();
  let chogs = await all<any>(`SELECT id, name, house, bond FROM chogs WHERE owner = ? ORDER BY id`, [addr]);
  const synced = Number(await getState("owners_synced_at", "0"));
  if (!chogs.length && Date.now() - synced > 5 * 60_000) {
    try {
      const owners = await allOwners();
      await batch([...owners.entries()].map(([id, o]) => ({ sql: `UPDATE chogs SET owner = ? WHERE id = ?`, args: [o, id] })));
      await setState("owners_synced_at", Date.now());
      chogs = await all<any>(`SELECT id, name, house, bond FROM chogs WHERE owner = ? ORDER BY id`, [addr]);
    } catch {}
  }
  return json({
    user: {
      address: addr,
      chogs: chogs.map((c) => ({ id: Number(c.id), name: c.name, house: c.house, bond: Number(c.bond) })),
    },
  });
}
