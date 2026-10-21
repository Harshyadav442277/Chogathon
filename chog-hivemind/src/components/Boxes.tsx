"use client";
import { useState } from "react";
import { useMe } from "./WalletButton";
import { LOC_NAMES } from "./ui";

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

export function WhisperBox({ chogId, name }: { chogId: number; name: string }) {
  const { me, loaded } = useMe();
  const [text, setText] = useState("");
  const [res, setRes] = useState<{ ok?: boolean; message?: string; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!loaded) return null;
  const mine = me?.chogs.some((c) => c.id === chogId);
  return (
    <div className="card" style={{ borderColor: mine ? "var(--accent2)" : undefined }}>
      <h3>Whisper to {name}</h3>
      {!mine ? (
        <p className="small muted" style={{ margin: 0 }}>
          Only this Chog's holder can whisper to it, once a day. {me ? "This wallet doesn't hold it." : "Connect the holding wallet to whisper."}
        </p>
      ) : (
        <div className="col">
          <p className="small muted" style={{ margin: 0 }}>One idea a day. Your Chog decides whether to obey, twist or ignore it. Higher bond = more obedient.</p>
          <textarea rows={3} maxLength={140} value={text} onChange={(e) => setText(e.target.value)} placeholder="tell everyone House Glass is secretly running Town Hall" />
          <div className="row between"><span className="tiny muted">{text.length}/140</span>
            <button className="btn" disabled={busy || text.trim().length < 3} onClick={async () => { setBusy(true); setRes(await post("/api/whisper", { chogId, text })); setBusy(false); }}>Whisper</button>
          </div>
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
