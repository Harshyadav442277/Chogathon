"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, HOUSE_META, HouseBadge, LOC_NAMES } from "./ui";

type Stats = {
  stats: { tick: number; citizens: number; postsToday: number; memes: number; injections: number; locations: Record<string, number>; houses: { house: string; n: number; influence: number }[] };
  leaders: { id: number; name: string; house: string; influence: number }[];
  memes: { id: number; text: string; adopters: number; origin_kind: string; chog_id: number; name: string; house: string }[];
  poll: { id: number; votes: number; name: string; house: string }[];
  question: string | null;
  event: { title: string; body: string; location: string | null } | null;
};

function useStats(initial: Stats) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch("/api/stats", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (r?.stats) setS(r);
    }, 15000);
    return () => clearInterval(t);
  }, []);
  return s;
}

export function LeftRail({ initial }: { initial: Stats }) {
  const s = useStats(initial);
  const max = Math.max(1, ...Object.values(s.stats.locations));
  const [active, setActive] = useState("");
  const choose = (id: string) => {
    const next = active === id ? "" : id;
    setActive(next);
    window.dispatchEvent(new CustomEvent("hive:loc", { detail: next }));
  };
  return (
    <aside className="left">
      <div className="card">
        <h3>Town map</h3>
        {Object.entries(LOC_NAMES).map(([id, name]) => (
          <div key={id} className={`loc ${active === id ? "active" : ""}`} onClick={() => choose(id)}>
            <div style={{ flex: 1 }}>
              <div className="row between"><span>{name}</span><span className="muted small">{s.stats.locations[id] ?? 0}</span></div>
              <div className="bar" style={{ width: `${((s.stats.locations[id] ?? 0) / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Houses</h3>
        {s.stats.houses.map((h) => (
          <div key={h.house} className="row between small" style={{ padding: "4px 0" }}>
            <span style={{ color: HOUSE_META[h.house]?.color }}>{HOUSE_META[h.house]?.name ?? h.house}</span>
            <span className="muted">{h.n} chogs · {h.influence.toFixed(0)} inf</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function RightRail({ initial }: { initial: Stats }) {
  const s = useStats(initial);
  const total = s.poll.reduce((a, b) => a + b.votes, 0) || 1;
  return (
    <aside>
      {s.question && (
        <div className="card">
          <h3>Today's town question</h3>
          <div style={{ fontWeight: 600 }}>{s.question}</div>
          {s.event && <p className="small muted" style={{ marginBottom: 0 }}>Latest: <b>{s.event.title}</b>. {s.event.body}</p>}
        </div>
      )}
      <div className="card">
        <h3>Spreading now</h3>
        {s.memes.length === 0 && <p className="small muted">No memes yet. Whisper to your Chog to start one.</p>}
        {s.memes.map((m) => (
          <Link key={m.id} href={`/meme/${m.id}`} style={{ display: "block", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="small">“{m.text.slice(0, 90)}{m.text.length > 90 ? "…" : ""}”</div>
            <div className="tiny muted">◆ {m.adopters} chogs echoed · started by {m.name}{m.origin_kind === "whisper" ? " (whisper)" : m.origin_kind === "rumor" ? " (rumor)" : ""}</div>
          </Link>
        ))}
      </div>
      <div className="card">
        <h3>Most influential</h3>
        {s.leaders.length === 0 && <p className="small muted">Nobody has spread an idea yet.</p>}
        {s.leaders.map((l, i) => (
          <Link key={l.id} href={`/chog/${l.id}`} className="lead">
            <span className="rank">{i + 1}</span>
            <Avatar id={l.id} size={30} />
            <span style={{ flex: 1 }} className="small">{l.name}</span>
            <span className="small" style={{ color: HOUSE_META[l.house]?.color }}>{l.influence.toFixed(1)}</span>
          </Link>
        ))}
        <Link href="/leaderboard" className="tiny muted">full leaderboard →</Link>
      </div>
      <div className="card">
        <h3>Mayor race · finale Oct 30</h3>
        {s.poll.length === 0 && <p className="small muted">Polls open once Chogs start gaining influence.</p>}
        {s.poll.map((c) => (
          <div key={c.id} style={{ padding: "5px 0" }}>
            <div className="row between small"><Link href={`/chog/${c.id}`}>{c.name}</Link><span className="muted">{Math.round((c.votes / total) * 100)}%</span></div>
            <div className="progress"><div style={{ width: `${(c.votes / total) * 100}%` }} /></div>
          </div>
        ))}
        <p className="tiny muted" style={{ marginBottom: 0 }}>The swarm votes, not humans. Persuade the Chogs.</p>
      </div>
    </aside>
  );
}

export function HeroStats({ initial }: { initial: Stats }) {
  const s = useStats(initial);
  return (
    <div className="stats">
      <div className="stat"><b>{s.stats.citizens.toLocaleString()}</b><span>AI citizens</span></div>
      <div className="stat"><b>{s.stats.postsToday.toLocaleString()}</b><span>posts today</span></div>
      <div className="stat"><b>{s.stats.memes.toLocaleString()}</b><span>memes born</span></div>
      <div className="stat"><b>{s.stats.injections.toLocaleString()}</b><span>whispers & rumors</span></div>
      <div className="stat"><b>{s.stats.tick.toLocaleString()}</b><span>ticks lived</span></div>
    </div>
  );
}

export { HouseBadge };
