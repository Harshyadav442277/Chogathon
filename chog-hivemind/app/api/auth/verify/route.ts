import { isAddress } from "viem";
import { err, json } from "@/lib/api";
import { publicClient } from "@/lib/chain";
import { setSession, signInMessage } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { address, signature, issuedAt } = await req.json().catch(() => ({}));
  if (!isAddress(address) || typeof signature !== "string" || typeof issuedAt !== "string") return err("Bad request.");
  const t = Date.parse(issuedAt);
  if (!t || Math.abs(Date.now() - t) > 10 * 60_000) return err("Sign-in expired, try again.");
  const ok = await publicClient
    .verifyMessage({ address, message: signInMessage(address, issuedAt), signature: signature as `0x${string}` })
    .catch(() => false);
  if (!ok) return err("Signature did not match.", 401);
  await setSession({ address: address.toLowerCase() });
  return json({ ok: true });
}
