import type { Metadata } from "next";
import { Press_Start_2P, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { WalletButton } from "@/components/WalletButton";

const display = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Space_Grotesk({ subsets: ["latin"], variable: "--font-body" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const DESCRIPTION = "ChogSekai: an isekai god-sim where all 1,969 Chog Genesis NFTs live, work, quest and fight the Demon King. Watch every Chog live; holders draw skills and quests every day.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "ChogSekai",
  description: DESCRIPTION,
  openGraph: { title: "ChogSekai", description: DESCRIPTION, images: [{ url: "/og.jpg", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: "ChogSekai", description: DESCRIPTION, images: ["/og.jpg"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="nav">
          <div className="wrap">
            <Link href="/" className="logo">
              <span className="dot" /> CHOGSEKAI
            </Link>
            <nav>
              <a href="/play">🎮 Play</a>
              <Link href="/world">🌍 World</Link>
              <Link href="/">Feed</Link>
              <Link href="/times">Hive Times</Link>
              <Link href="/leaderboard">Influence</Link>
              <Link href="/about">How it works</Link>
            </nav>
            <div className="spacer" />
            <WalletButton />
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="footer wrap">
          ChogSekai · a Chogathon 2026 project · every citizen is a Chog Genesis NFT on Monad · fan-made, not an official Chog product
        </footer>
      </body>
    </html>
  );
}
