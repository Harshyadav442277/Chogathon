"use client";
import Link from "next/link";
import { useState } from "react";

export const HOUSE_META: Record<string, { name: string; color: string }> = {
  laser: { name: "House Laser", color: "var(--laser)" },
  teardrop: { name: "House Teardrop", color: "var(--teardrop)" },
  glass: { name: "House Glass", color: "var(--glass)" },
  moonbeam: { name: "House Moonbeam", color: "var(--moonbeam)" },
};

export const LOC_NAMES: Record<string, string> = {
  plaza: "Purple Plaza", market: "Mon Market", arcade: "Block 143 Arcade", gardens: "Gasless Gardens",
  docks: "Rug Docks", hall: "Town Hall", cave: "Skull Cave", pond: "Chog Pond",
};

export function timeAgo(ms: number) {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function HouseBadge({ house }: { house: string }) {
  const h = HOUSE_META[house] ?? { name: house, color: "var(--muted)" };
  return <span className="badge" style={{ color: h.color }}>{h.name}</span>;
}

const GATEWAY = "https://gateway.pinata.cloud/ipfs/";
export function Avatar({ id, image, size = 44 }: { id: number; image?: string | null; size?: number }) {
  const [src, setSrc] = useState<string | null>(id > 0 ? `/chogs/${id}.webp` : null);
  if (!src)
    return (
      <div className="avatar ph" style={{ width: size, height: size, background: "var(--accent)", fontSize: size * 0.4 }}>
        {id > 0 ? "C" : "📣"}
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="avatar"
      src={src}
      width={size}
      height={size}
      alt={`Chog ${id}`}
      loading="lazy"
      onError={() => setSrc(image && !src.startsWith("http") ? image.replace("ipfs://", GATEWAY) : null)}
    />
  );
}

export type PostView = {
  id: number; chog_id: number; name: string; house: string; kind: string; text: string; meme_id: number | null;
  likes: number; reposts: number; replies: number; location: string | null; created_at: number;
  parent_name: string | null; parent_text: string | null;
};

export function Post({ p, fresh }: { p: PostView; fresh?: boolean }) {
  const isNews = p.kind === "news";
  return (
    <div className={`post ${isNews ? "news" : ""} ${fresh ? "fresh" : ""}`}>
      <Link href={p.chog_id > 0 ? `/chog/${p.chog_id}` : "#"}><Avatar id={p.chog_id} size={42} /></Link>
      <div className="body">
        <div className="meta">
          {p.chog_id > 0 ? (
            <Link href={`/chog/${p.chog_id}`} className="name">{p.name}</Link>
          ) : (
            <span className="name">📣 The Hive Crier</span>
          )}
          {p.chog_id > 0 && <HouseBadge house={p.house} />}
          {p.kind === "repost" && <span className="pill">↻ reposted</span>}
          {p.kind === "reply" && p.parent_name && <span className="muted small">replying to {p.parent_name}</span>}
          {p.location && <span className="muted tiny">· {LOC_NAMES[p.location] ?? p.location}</span>}
          <span className="muted tiny">· {timeAgo(p.created_at)}</span>
        </div>
        <div className="text">{p.text}</div>
        {p.kind === "reply" && p.parent_text && <div className="quote">{p.parent_text}</div>}
        {!isNews && (
          <div className="acts">
            <span>♥ {p.likes}</span>
            <span>↻ {p.reposts}</span>
            <span>💬 {p.replies}</span>
            {p.meme_id && <Link href={`/meme/${p.meme_id}`} className="meme">◆ meme #{p.meme_id}</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
