// Dev: prints the story state of the season-sim database: arcs per season, chapter counts, and a few life stories.
// Usage: TURSO_DATABASE_URL=file:data/season-sim.db npx tsx scripts/story-preview.ts [chogId ...]
import { all } from "../src/lib/db";
import { lifeOf } from "../src/sim3/life";

async function main() {
  const arcs = await all<any>(`SELECT s.season, s.arc, COUNT(n.chapter) n, SUM(length(n.text)) chars FROM story s LEFT JOIN novel n ON n.season = s.season GROUP BY s.season ORDER BY s.season`);
  for (const a of arcs) console.log(`season ${a.season}: ${a.arc}, ${a.n} chapters, ~${Math.round(Number(a.chars) / 6)} words`);
  const ids = process.argv.slice(2).map(Number).filter(Boolean);
  const pick = ids.length ? ids : (await all<any>(`SELECT chog_id FROM agents ORDER BY story DESC LIMIT 2`)).map((r) => Number(r.chog_id))
    .concat((await all<any>(`SELECT chog_id FROM agents ORDER BY story ASC LIMIT 1`)).map((r) => Number(r.chog_id)));
  for (const id of pick) {
    const c = (await all<any>(`SELECT name FROM chogs WHERE id = ?`, [id]))[0];
    const life = await lifeOf(id, String(c.name));
    console.log(`\n===== ${c.name} (#${id}) · ${life.epithets.join(" · ")}`);
    for (const s of life.sections) { console.log(`\n-- ${s.title}`); for (const p of s.paragraphs) console.log(p + "\n"); }
    console.log("-- Past lives"); for (const p of life.pastLives) console.log(p.season, p.text);
    console.log("-- Timeline sample"); for (const t of life.timeline.slice(0, 6)) console.log(`S${t.season} t${t.tick} ${t.kind}: ${t.text}`);
  }
}
main().then(() => process.exit(0));
