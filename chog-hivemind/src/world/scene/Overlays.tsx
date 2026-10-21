"use client";
// DOM overlays anchored in 3D: region names, POI labels, speech bubbles, hover tooltip.
// Every <Html> stays mounted; only visibility and content change. Mounting/unmounting
// drei <Html> roots during a render triggers React 19 "synchronously unmount" errors.
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { height } from "../terrain";
import { getWorld, HOUSE_COLORS, setWorld, useWorld } from "../store";
import type { Poi } from "./Props";

type Region = { id: string; name: string; x: number; z: number; accent: string };

const KIND_ICON: Record<string, string> = {
  capital: "🏰", district: "🏛️", town: "🏘️", village: "🏡", tavern: "🍺", wild: "🌿", dungeon: "🕳️", obelisk: "🔷", dock: "⚓", lighthouse: "🗼",
};
const HIDDEN: React.CSSProperties = { display: "none" };

/** Camera distance to its target, bucketed so React re-renders rarely. */
function useZoom() {
  const [zoom, setZoom] = useState<{ dist: number; tx: number; tz: number }>({ dist: 400, tx: 0, tz: 0 });
  const controls = useThree((s) => s.controls) as any;
  const camera = useThree((s) => s.camera);
  const last = useRef(0);
  const zero = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    if (state.clock.elapsedTime - last.current < 0.3) return;
    last.current = state.clock.elapsedTime;
    const t: THREE.Vector3 = controls?.target ?? zero;
    const dist = camera.position.distanceTo(t);
    if (Math.abs(dist - zoom.dist) > 8 || Math.hypot(t.x - zoom.tx, t.z - zoom.tz) > 12) setZoom({ dist, tx: t.x, tz: t.z });
  });
  return zoom;
}

export function Labels({ pois, regions }: { pois: Poi[]; regions: Region[] }) {
  const zoom = useZoom();
  const far = zoom.dist > 260;
  const visible = useMemo(() => {
    if (far) return new Set(pois.map((p, i) => (p.kind === "capital" ? i : -1)).filter((i) => i >= 0));
    const radius = zoom.dist * 0.9;
    return new Set(
      pois
        .map((p, i) => ({ p, i, d: Math.hypot(p.x - zoom.tx, p.z - zoom.tz) }))
        .filter(({ p, d }) => d < radius && (zoom.dist < 150 || ["capital", "tavern", "dungeon", "obelisk", "town"].includes(p.kind)))
        .sort((a, b) => a.d - b.d)
        .slice(0, 70)
        .map(({ i }) => i),
    );
  }, [pois, far, zoom]);

  return (
    <>
      {regions.map((r) => (
        <Html key={r.id} position={[r.x, Math.max(height(r.x, r.z), 2) + 30, r.z]} center zIndexRange={[10, 0]} style={far ? { pointerEvents: "none" } : HIDDEN}>
          <div className="w-region" style={{ color: r.accent }}>{r.name}</div>
        </Html>
      ))}
      {pois.map((p, i) => (
        <Html key={p.id} position={[p.x, p.y + (p.kind === "capital" ? 22 : 7), p.z]} center zIndexRange={[20, 11]} style={visible.has(i) ? undefined : HIDDEN}>
          <button className={`w-poi ${p.kind}`} onClick={() => setWorld({ selectedPoi: i, selectedChog: null, flyTo: { x: p.x, z: p.z, dist: 90, at: Date.now() } })}>
            {KIND_ICON[p.kind] ?? "📍"} {p.name}
          </button>
        </Html>
      ))}
    </>
  );
}

const BUBBLE_SLOTS = 14;

export function Bubbles() {
  const positions = useWorld((s) => s.positions);
  const zoom = useZoom();
  const bubbles = useMemo(() => {
    if (!positions || zoom.dist > 240) return [];
    const index = new Map(positions.ids.map((id, i) => [id, i]));
    const seen = new Set<number>();
    return positions.bubbles
      .filter((b) => {
        if (seen.has(b.chog) || !index.has(b.chog)) return false;
        seen.add(b.chog);
        return true;
      })
      .map((b) => {
        const i = index.get(b.chog)!;
        return { ...b, x: positions.x[i], z: positions.z[i], house: positions.house[i], name: positions.names[i], d: Math.hypot(positions.x[i] - zoom.tx, positions.z[i] - zoom.tz) };
      })
      .filter((b) => b.d < zoom.dist * 0.8)
      .sort((a, b) => a.d - b.d)
      .slice(0, BUBBLE_SLOTS);
  }, [positions, zoom]);
  return (
    <>
      {Array.from({ length: BUBBLE_SLOTS }, (_, slot) => {
        const b = bubbles[slot];
        return (
          <Html key={slot} position={b ? [b.x, Math.max(height(b.x, b.z), 0.3) + 5.5, b.z] : [0, -100, 0]} center zIndexRange={[40, 30]} style={b ? undefined : HIDDEN}>
            {b && (
              <div className="w-bubble" style={{ borderColor: HOUSE_COLORS[b.house] }} onClick={() => setWorld({ selectedChog: b.chog, selectedPoi: null })}>
                <b>{b.name}</b> {b.text.length > 90 ? b.text.slice(0, 89) + "…" : b.text}
              </div>
            )}
          </Html>
        );
      })}
    </>
  );
}

export function HoverTip() {
  const hover = useWorld((s) => s.hover);
  const positions = getWorld().positions;
  const i = hover && positions ? positions.ids.indexOf(hover.id) : -1;
  const ok = i >= 0 && positions;
  return (
    <Html
      position={ok ? [positions.x[i], Math.max(height(positions.x[i], positions.z[i]), 0.3) + 4, positions.z[i]] : [0, -100, 0]}
      center
      zIndexRange={[60, 50]}
      style={ok ? { pointerEvents: "none" } : HIDDEN}
    >
      {ok && (
        <div className="w-tip" style={{ borderColor: HOUSE_COLORS[positions.house[i]] }}>
          {positions.names[i]} <span>· {positions.mood[i]}</span>
        </div>
      )}
    </Html>
  );
}
