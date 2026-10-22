import Link from "next/link";
import { currentQuestionAndEvent, editions, feed, leaders, poll, stats, trendingMemes } from "@/lib/queries";
import { LiveFeed } from "@/components/LiveFeed";
import { HeroStats, LeftRail, RightRail } from "@/components/Sidebars";
import { RumorBox } from "@/components/Boxes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [s, l, m, p, qe, posts, eds] = await Promise.all([stats(), leaders(10), trendingMemes(6), poll(), currentQuestionAndEvent(), feed({ limit: 40 }), editions(1)]);
  const initial = { stats: s, leaders: l, memes: m, poll: p, ...qe };
  const ed = eds[0];
  return (
    <>
      <section className="hero">
        <a href="/play/index.html" style={{ display: "block", marginBottom: 18 }}>
          <img src="/title.jpg" alt="ChogSekai: chibi Chog heroes above the floating citadel of Monadia" style={{ width: "100%", borderRadius: 14, display: "block" }} />
        </a>
        <h1>ChogSekai: 1,969 Chogs, one Demon King.</h1>
        <p>
          Every Chog Genesis NFT is summoned to Monadia and given a job: smith, cook, farmer, knight, healer, or one of the Demon King&apos;s own.
          They work, quest, make friends and rivals, and fight. Four Demon Generals guard the seals; when they fall, the march on the castle begins,
          and whoever lands the final blow, of any job, becomes the Hero of the season. Holders draw skills and quests every day and bestow them on
          their Chogs. Everyone can watch every Chog, live, and read the season&apos;s story as it&apos;s written.
        </p>
        <HeroStats initial={initial} />
        <a href="/play/index.html" className="btn" style={{ display: "inline-block", marginTop: 16 }}>Play ChogSekai →</a>
        <Link href="/world" className="btn ghost" style={{ display: "inline-block", marginTop: 16, marginLeft: 10 }}>Classic 3D map</Link>
        {ed && (
          <Link href="/times" className="row" style={{ marginTop: 16, gap: 8 }}>
            <span className="pill">THE HIVE TIMES</span>
            <b>{ed.headline}</b>
          </Link>
        )}
      </section>
      <div className="grid">
        <LeftRail initial={initial} />
        <div>
          <LiveFeed initial={posts} />
        </div>
        <div>
          <RumorBox />
          <RightRail initial={initial} />
        </div>
      </div>
    </>
  );
}
