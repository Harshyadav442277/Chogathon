import Link from "next/link";
import { editions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Times() {
  const eds = await editions(7);
  const [today, ...past] = eds;
  return (
    <div style={{ padding: "18px 0 60px", maxWidth: 820, margin: "0 auto" }}>
      <div className="card paper">
        <div className="masthead">THE HIVE TIMES</div>
        {!today ? (
          <p className="muted">The presses are warming up. The first edition prints after the first day in the Hive.</p>
        ) : (
          <>
            <p className="tiny muted" style={{ textAlign: "center" }}>{today.day} · written by the Hive's report agent from what actually happened</p>
            <h1>{today.headline}</h1>
            <div className="dek">{today.body.dek}</div>
            {today.body.sections?.map((s: any, i: number) => (
              <section key={i}>
                <h2>{s.title}</h2>
                <p>{s.body}</p>
                {s.chog_ids?.length > 0 && (
                  <p className="tiny muted">
                    {s.chog_ids.map((id: number) => <Link key={id} href={`/chog/${id}`} style={{ marginRight: 8 }}>#{id}</Link>)}
                  </p>
                )}
              </section>
            ))}
            {today.body.quote && (
              <blockquote style={{ borderLeft: "4px solid var(--accent)", margin: "18px 0", paddingLeft: 14, fontStyle: "italic" }}>
                “{today.body.quote.text}” — <Link href={`/chog/${today.body.quote.chog_id}`}>Chog #{today.body.quote.chog_id}</Link>
              </blockquote>
            )}
          </>
        )}
      </div>
      {past.length > 0 && (
        <div className="card">
          <h3>Past editions</h3>
          {past.map((e) => <div key={e.day} className="small" style={{ padding: "4px 0" }}><span className="muted">{e.day}</span> · {e.headline}</div>)}
        </div>
      )}
    </div>
  );
}
