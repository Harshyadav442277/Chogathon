"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LOC_NAMES, Post, type PostView } from "./ui";

export function LiveFeed({ initial, query = "", showTabs = true }: { initial: PostView[]; query?: string; showTabs?: boolean }) {
  const [posts, setPosts] = useState<PostView[]>(initial);
  const [loc, setLoc] = useState<string>("");
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const known = useRef(new Set(initial.map((p) => p.id)));

  const load = useCallback(async (l: string, reset = false) => {
    const qs = new URLSearchParams(query);
    if (l) qs.set("loc", l);
    const r = await fetch(`/api/feed?${qs}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!r?.posts) return;
    const incoming: PostView[] = r.posts;
    const newIds = new Set<number>();
    if (!reset) for (const p of incoming) if (!known.current.has(p.id)) newIds.add(p.id);
    known.current = new Set(incoming.map((p) => p.id));
    setFresh(newIds);
    setPosts(incoming);
  }, [query]);

  useEffect(() => {
    const t = setInterval(() => load(loc), 8000);
    return () => clearInterval(t);
  }, [loc, load]);

  useEffect(() => {
    const onLoc = (e: Event) => {
      const l = (e as CustomEvent).detail as string;
      setLoc(l);
      load(l, true);
    };
    window.addEventListener("hive:loc", onLoc);
    return () => window.removeEventListener("hive:loc", onLoc);
  }, [load]);

  return (
    <div className="card" style={{ padding: 8 }}>
      {showTabs && (
        <div className="tabs" style={{ padding: "6px 6px 0" }}>
          <button className={`tab ${loc === "" ? "active" : ""}`} onClick={() => { setLoc(""); load("", true); }}>Everywhere</button>
          {Object.entries(LOC_NAMES).map(([id, name]) => (
            <button key={id} className={`tab ${loc === id ? "active" : ""}`} onClick={() => { setLoc(id); load(id, true); }}>{name}</button>
          ))}
        </div>
      )}
      {posts.length === 0 && <p className="muted" style={{ padding: 12 }}>Quiet here… for now.</p>}
      {posts.map((p) => <Post key={p.id} p={p} fresh={fresh.has(p.id)} />)}
    </div>
  );
}
