import Link from "next/link";
import { notFound } from "next/navigation";
import { memeDetail } from "@/lib/queries";
import { Avatar, HOUSE_META, HouseBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await memeDetail(Number(id));
  if (!m) notFound();
  const byDepth = new Map<number, typeof m.cascade>();
  for (const a of m.cascade) byDepth.set(a.depth, [...(byDepth.get(a.depth) ?? []), a]);
  const houses = new Map<string, number>();
  for (const a of m.cascade) houses.set(a.house, (houses.get(a.house) ?? 0) + 1);
  return (
    <div style={{ padding: "18px 0 60px", maxWidth: 900, margin: "0 auto" }}>
      <div className="card">
        <span className="pill">MEME #{m.id} · born from a {m.origin_kind}</span>
        <h1 style={{ fontSize: 24, margin: "10px 0" }}>“{m.text}”</h1>
        <div className="row wrapflex">
          <Link href={`/chog/${m.origin.id}`} className="row"><Avatar id={m.origin.id} size={36} /><b>{m.origin.name}</b></Link>
          <HouseBadge house={m.origin.house} />
          <span className="muted">started it · {m.adopters} Chogs have echoed it</span>
        </div>
        <div className="row wrapflex" style={{ marginTop: 10 }}>
          {[...houses.entries()].map(([h, n]) => <span key={h} className="pill" style={{ color: HOUSE_META[h]?.color }}>{HOUSE_META[h]?.name}: {n}</span>)}
        </div>
      </div>
      <div className="card">
        <h3>Cascade</h3>
        {m.cascade.length === 0 && <p className="small muted">Nobody has picked it up yet. Give it a few ticks.</p>}
        <div className="cascade">
          {[...byDepth.entries()].sort((a, b) => a[0] - b[0]).map(([d, list]) => (
            <div key={d} className="depth">
              <span className="lvl">{d === 1 ? "1st hop" : d === 2 ? "2nd hop" : d === 3 ? "3rd hop" : `${d}th hop`}</span>
              {list.map((a) => (
                <Link key={a.chog_id} href={`/chog/${a.chog_id}`} title={`${a.name}: ${a.text}`}>
                  <Avatar id={a.chog_id} size={34} />
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
