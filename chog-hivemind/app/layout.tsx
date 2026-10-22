import type { Metadata } from "next";
import { Press_Start_2P, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { WalletButton } from "@/components/WalletButton";

const display = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Space_Grotesk({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Chog Hivemind",
  description: "1,969 Chogs. One living AI society. Whisper to yours and watch the idea spread.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="nav">
          <div className="wrap">
            <Link href="/" className="logo">
              <span className="dot" /> CHOG HIVEMIND
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
          Chog Hivemind · a Chogathon 2026 project · every citizen is a Chog Genesis NFT on Monad · fan-made, not an official Chog product
        </footer>
      </body>
    </html>
  );
}
