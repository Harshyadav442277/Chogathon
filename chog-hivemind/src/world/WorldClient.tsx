"use client";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChatBox, WhisperBox } from "@/components/Boxes";
import { useMe } from "@/components/WalletButton";
import { getWorld, HOUSE_COLORS, HOUSE_NAMES, setWorld, useWorld, type Positions } from "./store";
import { WorldScene } from "./scene/WorldScene";
import type { Poi } from "./scene/Props";

type World = { regions: { id: string; name: string; house: string | null; x: number; z: number; accent: string; blurb: string }[]; pois: Poi[]; roads: [number, number][] };

const POI_KIND: Record<string, string> = {
  capital: "Capital", district: "District", town: "Town", village: "Village", tavern: "Tavern", wild: "Wilds", dungeon: "Dungeon", obelisk: "Waypoint Obelisk", dock: "Docks", lighthouse: "Lighthouse",
};

function usePositions() {
  useEffect(() => {
    let stop = false;
    const load = async () => {
      const r = await fetch("/api/world/positions", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (!stop && r?.ids) setWorld({ positions: r as Positions });
    };
    load();
    const t = setInterval(load, 10000);
    return () => { stop = true; clearInterval(t); };
  }, []);
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const h = now.getUTCHours();
  const phase = h < 5 ? "Night" : h < 8 ? "Dawn" : h < 17 ? "Day" : h < 20 ? "Dusk" : "Night";
  return <span>{phase} · {String(h).padStart(2, "0")}:{String(now.getUTCMinutes()).padStart(2, "0")} UTC</span>;
}

function Search({ world }: { world: World }) {
  const positions = useWorld((s) => s.positions);
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2 || !positions) return [];
    const num = Number(s.replace(/[^0-9]/g, ""));
    const chogs = positions.ids
      .map((id, i) => ({ type: "chog" as const, id, i, label: positions.names[i] }))
      .filter((c) => c.label.toLowerCase().includes(s) || (num && (c.id === num || c.label.endsWith(`#${num}`))))
      .slice(0, 6);
    const pois = world.pois.map((p, i) => ({ type: "poi" as const, id: i, i, label: p.name })).filter((p) => p.label.toLowerCase().includes(s)).slice(0, 5);
    return [...chogs, ...pois];
  }, [q, positions, world.pois]);
  return (
    <div className="w-search">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a Chog (#1462, Mochi) or a place…" />
      {results.length > 0 && (
        <div className="w-results">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => {
                if (r.type === "chog" && positions) setWorld({ selectedChog: r.id, selectedPoi: null, flyTo: { x: positions.x[r.i], z: positions.z[r.i], dist: 45, at: Date.now() } });
                else { const p = world.pois[r.i]; setWorld({ selectedPoi: r.i, selectedChog: null, flyTo: { x: p.x, z: p.z, dist: 90, at: Date.now() } }); }
                setQ("");
              }}
            >
              {r.type === "chog" ? "🐸" : "📍"} {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusWindow({ id, world }: { id: number; world: World }) {
  const [c, setC] = useState<any>(null);
  const positions = useWorld((s) => s.positions);
  useEffect(() => {
    setC(null);
    fetch(`/api/chog/${id}`).then((r) => r.json()).then((r) => setC(r.chog)).catch(() => {});
  }, [id]);
  const i = positions?.ids.indexOf(id) ?? -1;
  const poi = i >= 0 && positions ? world.pois[positions.poi[i]] : null;
  const houseIdx = i >= 0 && positions ? positions.house[i] : 0;
  return (
    <div className="w-panel">
      <div className="w-status-head">【STATUS】<button onClick={() => setWorld({ selectedChog: null })}>✕</button></div>
      {!c ? <p className="muted small">Reading the Status Window…</p> : (
        <>
          <div className="row" style={{ gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/chogs/${id}.webp`} width={72} height={72} alt="" style={{ borderRadius: 12, border: `2px solid ${HOUSE_COLORS[houseIdx]}` }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{c.name}</div>
              <div className="small" style={{ color: HOUSE_COLORS[houseIdx] }}>{HOUSE_NAMES[houseIdx]} · token #{c.id}</div>
              <div className="small muted">📍 {poi?.name ?? "somewhere"} · mood: {c.mood}</div>
            </div>
          </div>
          <div className="w-stats">
            <div><b>{c.influence.toFixed(1)}</b><span>influence (#{c.rank})</span></div>
            <div><b>{c.bond}</b><span>bond</span></div>
            <div><b>{c.posts}</b><span>posts</span></div>
            <div><b>{c.followers}</b><span>followers</span></div>
          </div>
          <div className="w-kv">
            <span>Temperament</span><b>{c.persona.temperament}</b>
            <span>Calling</span><b>{c.persona.job}</b>
            <span>Obsession</span><b>{c.persona.obsession}</b>
            <span>Voice</span><b>{c.persona.voice}</b>
          </div>
          {c.memories?.length > 0 && (
            <div className="small" style={{ marginTop: 8 }}>
              <div className="muted tiny">LATEST MEMORY</div>“{c.memories[0].text}”
            </div>
          )}
          {c.feed?.[0] && (
            <div className="small" style={{ marginTop: 8 }}>
              <div className="muted tiny">LAST SAID</div>“{c.feed[0].text}”
            </div>
          )}
          <Link className="btn small" href={`/chog/${id}`} style={{ display: "inline-block", marginTop: 10 }}>Open full profile →</Link>
          <div style={{ marginTop: 10 }}><WhisperBox chogId={id} name={c.name} /></div>
          <ChatBox chogId={id} name={c.name} />
        </>
      )}
    </div>
  );
}

function PoiPanel({ index, world }: { index: number; world: World }) {
  const positions = useWorld((s) => s.positions);
  const p = world.pois[index];
  const region = world.regions.find((r) => r.id === p.region);
  const here = useMemo(() => (positions ? positions.ids.map((id, i) => ({ id, i })).filter(({ i }) => positions.poi[i] === index) : []), [positions, index]);
  return (
    <div className="w-panel">
      <div className="w-status-head">{POI_KIND[p.kind] ?? "Place"}<button onClick={() => setWorld({ selectedPoi: null })}>✕</button></div>
      <div style={{ fontWeight: 800, fontSize: 20 }}>{p.name}</div>
      <div className="small" style={{ color: region?.accent }}>{region?.name}</div>
      <p className="small muted">{region?.blurb}</p>
      <div className="small"><b>{here.length}</b> Chogs here right now</div>
      <div className="w-faces">
        {here.slice(0, 40).map(({ id, i }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={id} src={`/chogs/${id}.webp`} alt="" title={positions!.names[i]} onClick={() => setWorld({ selectedChog: id, selectedPoi: null })} style={{ borderColor: HOUSE_COLORS[positions!.house[i]] }} />
        ))}
      </div>
    </div>
  );
}

export default function WorldClient() {
  const [world, setWorldData] = useState<World | null>(null);
  const [dpr, setDpr] = useState(1.5);
  const selectedChog = useWorld((s) => s.selectedChog);
  const selectedPoi = useWorld((s) => s.selectedPoi);
  const positions = useWorld((s) => s.positions);
  const { me } = useMe();
  usePositions();
  useEffect(() => { fetch("/api/world").then((r) => r.json()).then(setWorldData); }, []);
  useEffect(() => { setWorld({ myChogs: me?.chogs.map((c) => c.id) ?? [] }); }, [me]);

  const regionCounts = useMemo(() => {
    if (!positions || !world) return {};
    const out: Record<string, number> = {};
    positions.poi.forEach((pi) => { const r = world.pois[pi]?.region; if (r) out[r] = (out[r] ?? 0) + 1; });
    return out;
  }, [positions, world]);

  return (
    <div className="w-root">
      {world && (
        <Canvas shadows dpr={dpr} camera={{ position: [0, 300, 360], fov: 45, near: 1, far: 2000 }} gl={{ antialias: true }}>
          <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
          <WorldScene world={world} />
        </Canvas>
      )}
      {!world && <div className="w-loading">Summoning Monadia…</div>}

      <div className="w-hud-top">
        <div className="w-title">
          <div className="w-brand">MONADIA</div>
          <div className="tiny muted"><Clock /> · tick {positions?.tick ?? "…"} · {positions?.ids.length ?? "…"} Chogs alive</div>
        </div>
        {world && <Search world={world} />}
        {me && me.chogs.length > 0 && positions && (
          <button
            className="btn small"
            onClick={() => {
              const id = me.chogs[0].id;
              const i = positions.ids.indexOf(id);
              if (i >= 0) setWorld({ selectedChog: id, selectedPoi: null, flyTo: { x: positions.x[i], z: positions.z[i], dist: 40, at: Date.now() } });
            }}
          >
            ⭐ Find my Chog
          </button>
        )}
      </div>

      {world && (
        <div className="w-legend">
          {world.regions.map((r) => (
            <button key={r.id} onClick={() => setWorld({ flyTo: { x: r.x, z: r.z, dist: 170, at: Date.now() } })}>
              <span style={{ background: r.accent }} />
              {r.name}
              <em>{regionCounts[r.id] ?? 0}</em>
            </button>
          ))}
          <div className="tiny muted" style={{ marginTop: 6 }}>Drag to pan · right-drag to rotate · scroll to zoom · click a Chog</div>
        </div>
      )}

      {world && selectedChog != null && <StatusWindow id={selectedChog} world={world} />}
      {world && selectedChog == null && selectedPoi != null && <PoiPanel index={selectedPoi} world={world} />}
    </div>
  );
}

export { getWorld };
