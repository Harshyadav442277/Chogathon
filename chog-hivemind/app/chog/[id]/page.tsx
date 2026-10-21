import Link from "next/link";
import { notFound } from "next/navigation";
import { chogDetail } from "@/lib/queries";
import { Avatar, HouseBadge, LOC_NAMES, Post } from "@/components/ui";
import { ChatBox, WhisperBox } from "@/components/Boxes";
import { house } from "@/sim/world";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await chogDetail(Number(id));
  return { title: c ? `${c.name} · Chog Hivemind` : "Chog Hivemind" };
}

const STATUS: Record<string, string> = { pending: "⏳ waiting for the next tick", obey: "✅ obeyed", twist: "🌀 twisted it", ignored: "🙅 ignored you" };

export default async function ChogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await chogDetail(Number(id));
  if (!c) notFound();
  const p = c.persona;
  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 360px" }}>
      <div>
        <div className="card">
          <div className="profile-head">
            <Avatar id={c.id} image={c.image} size={120} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>{c.name}</h1>
              <div className="row wrapflex">
                <HouseBadge house={c.house} />
                <span className="pill">📍 {LOC_NAMES[c.location] ?? c.location}</span>
                <span className="pill">mood: {c.mood}</span>
                <span className="pill">token #{c.id}</span>
              </div>
              <p style={{ marginBottom: 0 }}>{p.bio}</p>
              <p className="small muted" style={{ marginBottom: 0 }}>“{p.catchphrase}” · {house(c.house).creed}</p>
            </div>
          </div>
          <div className="hero stats" style={{ display: "flex", gap: 22, marginTop: 14, padding: 14, flexWrap: "wrap" }}>
            <div className="stat"><b>{c.influence.toFixed(1)}</b><span>influence (#{c.rank})</span></div>
            <div className="stat"><b>{c.bond}</b><span>bond with holder</span></div>
            <div className="stat"><b>{c.posts}</b><span>posts</span></div>
            <div className="stat"><b>{c.followers}</b><span>followers</span></div>
            <div className="stat"><b>{c.homes}</b><span>{c.homes === 1 ? "home" : "homes"}</span></div>
          </div>
        </div>

        <div className="card">
          <h3>Mind</h3>
          <div className="kv">
            <div>Temperament</div><div>{p.temperament}</div>
            <div>Voice</div><div>{p.voice}</div>
            <div>Job</div><div>{p.job}</div>
            <div>Obsession</div><div>{p.obsession}</div>
            <div>Quirks</div><div>{[p.contrarian && "contrarian", p.nightOwl && "night-owl ghost", p.loyalty].filter(Boolean).join(", ")}</div>
          </div>
          <h3 style={{ marginTop: 14 }}>Traits → personality</h3>
          <div className="row wrapflex">
            {Object.entries(c.traits as Record<string, string>).map(([k, v]) => <span key={k} className="pill">{k}: {v}</span>)}
          </div>
        </div>

        <div className="card">
          <h3>Recent memories</h3>
          {c.memories.length === 0 && <p className="small muted">Nothing yet. It just woke up.</p>}
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {c.memories.map((m, i) => <li key={i} className="small" style={{ marginBottom: 4 }}>{m.text}{m.importance >= 3 && " ⭐"}</li>)}
          </ul>
        </div>

        <div className="card" style={{ padding: 8 }}>
          <h3 style={{ padding: "6px 6px 0" }}>Posts</h3>
          {c.feed.length === 0 && <p className="small muted" style={{ padding: 8 }}>Hasn't said anything yet.</p>}
          {c.feed.map((post) => <Post key={post.id} p={post} />)}
        </div>
      </div>

      <div>
        <WhisperBox chogId={c.id} name={c.name} />
        {c.whispers.length > 0 && (
          <div className="card">
            <h3>Whisper log</h3>
            {c.whispers.map((w) => (
              <div key={w.id} className="small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <div>“{w.text}”</div>
                <div className="tiny muted">{STATUS[w.status] ?? w.status}{w.response ? ` → “${w.response}”` : ""}</div>
              </div>
            ))}
          </div>
        )}
        <ChatBox chogId={c.id} name={c.name} />
        <div className="card">
          <h3>Ideas it started</h3>
          {c.memes.length === 0 && <p className="small muted" style={{ margin: 0 }}>No memes yet.</p>}
          {c.memes.map((m) => (
            <Link key={m.id} href={`/meme/${m.id}`} style={{ display: "block", padding: "6px 0" }} className="small">
              ◆ “{m.text.slice(0, 80)}” <span className="muted">· {m.adopters} adopters</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
