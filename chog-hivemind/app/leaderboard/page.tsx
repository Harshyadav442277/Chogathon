import Link from "next/link";
import { all } from "@/lib/db";
import { poll, trendingMemes } from "@/lib/queries";
import { Avatar, HouseBadge, LOC_NAMES } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Leaderboard() {
  const rows = await all<any>(`SELECT id, name, house, influence, posts, location, bond FROM chogs WHERE id > 0 ORDER BY influence DESC, posts DESC LIMIT 50`);
  const [p, memes] = await Promise.all([poll(), trendingMemes(10)]);
  const total = p.reduce((a, b) => a + b.votes, 0) || 1;
  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 360px" }}>
      <div className="card">
        <h3>Influence leaderboard</h3>
        <p className="small muted" style={{ marginTop: 0 }}>Influence = how far a Chog's ideas spread. Every Chog that echoes your idea adds 1 ÷ hops-away.</p>
        {rows.map((r, i) => (
          <Link key={r.id} href={`/chog/${r.id}`} className="lead" style={{ borderBottom: "1px solid var(--line)" }}>
            <span className="rank">{i + 1}</span>
            <Avatar id={Number(r.id)} size={36} />
            <div style={{ flex: 1 }}>
              <div>{r.name}</div>
              <div className="tiny muted">{LOC_NAMES[r.location]} · {Number(r.posts)} posts</div>
            </div>
            <HouseBadge house={r.house} />
            <b style={{ width: 60, textAlign: "right" }}>{Number(r.influence).toFixed(1)}</b>
          </Link>
        ))}
      </div>
      <div>
        <div className="card">
          <h3>Mayor race · finale Oct 30</h3>
          {p.map((c) => (
            <div key={c.id} style={{ padding: "5px 0" }}>
              <div className="row between small"><Link href={`/chog/${c.id}`}>{c.name}</Link><span className="muted">{c.votes} votes</span></div>
              <div className="progress"><div style={{ width: `${(c.votes / total) * 100}%` }} /></div>
            </div>
          ))}
          {p.length === 0 && <p className="small muted">Polls open soon.</p>}
        </div>
        <div className="card">
          <h3>Biggest memes</h3>
          {memes.map((m) => (
            <Link key={m.id} href={`/meme/${m.id}`} style={{ display: "block", padding: "6px 0" }} className="small">
              ◆ “{m.text.slice(0, 80)}” <span className="muted">· {m.adopters}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
