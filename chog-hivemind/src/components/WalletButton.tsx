"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Me = { address: string; judge?: boolean; chogs: { id: number; name: string; house: string; bond: number }[] } | null;

declare global {
  interface Window { ethereum?: any }
}

export function signInMessage(address: string, issuedAt: string) {
  return `Sign in to ChogSekai\n\nThis only proves you own this wallet. It costs nothing and sends no transaction.\n\nAddress: ${address}\nIssued: ${issuedAt}`;
}

export function useMe() {
  const [me, setMe] = useState<Me>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = async () => {
    const r = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    setMe(r?.user ?? null);
    setLoaded(true);
  };
  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener("hive:auth", on);
    return () => window.removeEventListener("hive:auth", on);
  }, []);
  return { me, loaded, refresh };
}

export function WalletButton() {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [code, setCode] = useState("");

  const connect = async () => {
    setMsg("");
    if (!window.ethereum) {
      setMsg("No wallet found. Install MetaMask / Rabby, or use a judge code.");
      setOpen(true);
      return;
    }
    setBusy(true);
    try {
      const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
      const issuedAt = new Date().toISOString();
      const message = signInMessage(address, issuedAt);
      const signature = await window.ethereum.request({ method: "personal_sign", params: [message, address] });
      const r = await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, signature, issuedAt }) }).then((r) => r.json());
      if (r.error) throw new Error(r.error);
      window.dispatchEvent(new Event("hive:auth"));
      setOpen(true);
    } catch (e: any) {
      setMsg(e?.message || "Sign-in cancelled.");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const judge = async () => {
    const r = await fetch("/api/auth/judge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }).then((r) => r.json());
    if (r.error) setMsg(r.error);
    else window.dispatchEvent(new Event("hive:auth"));
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.dispatchEvent(new Event("hive:auth"));
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      {me ? (
        <button className="btn ghost small" onClick={() => setOpen(!open)}>
          {me.judge ? "Judge" : `${me.address.slice(0, 6)}…${me.address.slice(-4)}`} · {me.chogs.length} chog{me.chogs.length === 1 ? "" : "s"}
        </button>
      ) : (
        <button className="btn small" onClick={connect} disabled={busy}>{busy ? "Check your wallet…" : "Connect wallet"}</button>
      )}
      {open && (
        <div className="card" style={{ position: "absolute", right: 0, top: 44, width: 300, zIndex: 30 }}>
          {me ? (
            <>
              <h3>Your Chogs</h3>
              {me.chogs.length === 0 && <p className="small muted">This wallet holds no Chog Genesis. You can still chat with any Chog and drop rumors.</p>}
              <div className="col">
                {me.chogs.map((c) => (
                  <Link key={c.id} href={`/chog/${c.id}`} onClick={() => setOpen(false)} className="row between small">
                    <span>{c.name}</span><span className="muted">bond {c.bond}</span>
                  </Link>
                ))}
              </div>
              <button className="btn ghost small" style={{ marginTop: 10 }} onClick={logout}>Sign out</button>
            </>
          ) : (
            <>
              {msg && <div className="notice err small" style={{ marginBottom: 8 }}>{msg}</div>}
              <h3>Judge access</h3>
              <div className="row">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="judge code" />
                <button className="btn small" onClick={judge}>Go</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
