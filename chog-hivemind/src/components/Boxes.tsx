"use client";
import { useState } from "react";
import { useMe } from "./WalletButton";
import { LOC_NAMES } from "./ui";
import { GIFTS } from "@/sim/world";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ error: "Something went wrong." }));
}

export function RumorBox() {
  const [location, setLocation] = useState("plaza");
  const [text, setText] = useState("");
  const [res, setRes] = useState<{ ok?: boolean; message?: string; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="card">
      <h3>Drop a rumor</h3>
      <p className="small muted" style={{ marginTop: 0 }}>Anyone can. Chogs nearby might pick it up and spread it. Or laugh at you.</p>
      <div className="col">
        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          {Object.entries(LOC_NAMES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <textarea rows={2} maxLength={140} value={text} onChange={(e) => setText(e.target.value)} placeholder="psst… the arcade high scores are rigged" />
        <button className="btn" disabled={busy || text.trim().length < 3} onClick={async () => { setBusy(true); setRes(await post("/api/rumor", { location, text })); setBusy(false); setText(""); }}>
          Whisper it into the crowd
        </button>
        {res && <div className={`notice ${res.error ? "err" : ""}`}>{res.error || res.message}</div>}
      </div>
    </div>
  );
}

const CARE_TABS = [
  { kind: "whisper", label: "💭 Whisper", verb: "Whisper" },
  { kind: "nudge", label: "🧭 Journey", verb: "Send it there" },
  { kind: "introduce", label: "🤝 Introduce", verb: "Introduce" },
  { kind: "gift", label: "🎁 Gift", verb: "Give gift" },
] as const;

export function CareBox({ chogId, name }: { chogId: number; name: string }) {
  const { me, loaded, refresh } = useMe();
  const [kind, setKind] = useState<(typeof CARE_TABS)[number]["kind"]>("whisper");
  const [text, setText] = useState("");
  const [location, setLocation] = useState("plaza");
  const [gift, setGift] = useState(0);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ id: number; name: string }[]>([]);
  const [target, setTarget] = useState<{ id: number; name: string } | null>(null);
  const [res, setRes] = useState<{ ok?: boolean; message?: string; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!loaded) return null;
  const mine = me?.chogs.some((c) => c.id === chogId);
  const energy = me?.energy;
  const search = async (v: string) => {
    setQ(v);
    setTarget(null);
    if (v.trim().length < 1) return setFound([]);
    const r = await fetch(`/api/search?q=${encodeURIComponent(v.trim())}`).then((r) => r.json()).catch(() => ({ results: [] }));
    setFound((r.results ?? []).filter((c: { id: number }) => c.id !== chogId).slice(0, 6));
  };
  const ready =
    kind === "whisper" ? text.trim().length >= 3 : kind === "introduce" ? !!target : true;
  const send = async () => {
    setBusy(true);
    setRes(await post("/api/care", { chogId, kind, text, location, gift, targetChog: target?.id }));
    setBusy(false);
    if (kind === "whisper") setText("");
    refresh();
  };
  return (
    <div className="card" style={{ borderColor: mine ? "var(--accent2)" : undefined }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>Care &amp; Command</h3>
        {mine && energy && <span className="pill" title="Refills at 00:00 UTC. Never sold.">⚡ {energy.left}/{energy.max} Mon Energy</span>}
      </div>
      {!mine ? (
        <p className="small muted" style={{ margin: "8px 0 0" }}>
          Only {name}'s holder can whisper to it, send it on a journey, introduce it or give it gifts. {me ? "This wallet doesn't hold it." : "Connect the holding wallet."}
        </p>
      ) : (
        <div className="col" style={{ marginTop: 8 }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {CARE_TABS.map((t) => (
              <button key={t.kind} className={`tab ${kind === t.kind ? "active" : ""}`} onClick={() => { setKind(t.kind); setRes(null); }}>{t.label}</button>
            ))}
          </div>
          <p className="small muted" style={{ margin: 0 }}>Each costs 1 energy, once per Chog per day. {name} decides whether to obey, twist or ignore you. Higher bond = more obedient.</p>
          {kind === "whisper" && (
            <>
              <textarea rows={3} maxLength={140} value={text} onChange={(e) => setText(e.target.value)} placeholder="tell everyone House Glass is secretly running Town Hall" />
              <span className="tiny muted">{text.length}/140</span>
            </>
          )}
          {kind === "nudge" && (
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              {Object.entries(LOC_NAMES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          )}
          {kind === "introduce" && (
            <>
              <input value={target ? target.name : q} onChange={(e) => search(e.target.value)} placeholder="search a Chog by name or #id" />
              {!target && found.map((c) => (
                <button key={c.id} className="btn ghost small" style={{ textAlign: "left" }} onClick={() => { setTarget(c); setFound([]); }}>{c.name}</button>
              ))}
            </>
          )}
          {kind === "gift" && (
            <select value={gift} onChange={(e) => setGift(Number(e.target.value))}>
              {GIFTS.map((g, i) => <option key={g} value={i}>{g}</option>)}
            </select>
          )}
          <button className="btn" disabled={busy || !ready || (energy?.left ?? 0) < 1} onClick={send}>
            {CARE_TABS.find((t) => t.kind === kind)!.verb}
          </button>
          {res && <div className={`notice ${res.error ? "err" : ""}`}>{res.error || res.message}</div>}
        </div>
      )}
    </div>
  );
}

export function ChatBox({ chogId, name }: { chogId: number; name: string }) {
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    const m = text.trim();
    if (m.length < 3) return;
    setBusy(true);
    setError("");
    setText("");
    const next = [...msgs, { role: "user" as const, text: m }];
    setMsgs(next);
    const r = await post("/api/chat", { chogId, message: m, history: msgs });
    if (r.error) setError(r.error);
    else setMsgs([...next, { role: "assistant", text: r.reply }]);
    setBusy(false);
  };
  return (
    <div className="card">
      <h3>Talk to {name}</h3>
      <div className="chat">
        {msgs.length === 0 && <p className="small muted" style={{ margin: 0 }}>Ask about the rumors, its house, the election, or whatever is on its mind. It remembers you were here.</p>}
        {msgs.map((m, i) => <div key={i} className={`bubble ${m.role === "user" ? "me" : "them"}`}>{m.text}</div>)}
        {busy && <div className="bubble them muted">…</div>}
      </div>
      {error && <div className="notice err small">{error}</div>}
      <div className="row" style={{ marginTop: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !busy && send()} placeholder={`say gm to ${name}`} maxLength={300} />
        <button className="btn" onClick={send} disabled={busy}>Send</button>
      </div>
    </div>
  );
}
