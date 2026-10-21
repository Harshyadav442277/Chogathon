"use client";
// Buildings, landmarks and nature, all as instanced meshes (one draw call per shape).
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { height, isLand, mulberry32, REGION_BY_ID, regionAt, SEED, WORLD_D, WORLD_W, type RegionId } from "../terrain";

type Shape = "box" | "roof" | "cyl" | "cone" | "crystal" | "sphere" | "rock" | "glowBox" | "glowSphere";
type Part = { s: Shape; x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number; c: string };
export type Poi = { id: string; name: string; kind: string; region: string; x: number; y: number; z: number };

const WALL: Record<string, string> = {
  capital: "#ece4ff", emberforge: "#8a6a5a", tidecry: "#dfe8ee", prism: "#f2e6cc", dreamveil: "#fff4dc",
  hollow: "#4a4560", frogsong: "#cfe3c0", rugcoast: "#c9a77a", wastes: "#a59d90",
};
const ROOF: Record<string, string> = {
  capital: "#7b4dff", emberforge: "#c0392b", tidecry: "#2f6f9f", prism: "#8e6cd9", dreamveil: "#e6a93c",
  hollow: "#2a2738", frogsong: "#4f8a3c", rugcoast: "#7a4b2a", wastes: "#6d675e",
};

function house(parts: Part[], x: number, z: number, region: string, scale = 1, rnd = Math.random) {
  const y = height(x, z);
  const w = (2.2 + rnd() * 1.2) * scale, d = (2 + rnd() * 1) * scale, h = (1.8 + rnd() * 1.4) * scale;
  const ry = rnd() * Math.PI;
  parts.push({ s: "box", x, y: y + h / 2, z, sx: w, sy: h, sz: d, ry, c: WALL[region] });
  parts.push({ s: "roof", x, y: y + h + 0.9 * scale, z, sx: w * 0.85, sy: 1.8 * scale, sz: d * 0.85, ry: ry + Math.PI / 4, c: ROOF[region] });
}

function ring(n: number, r: number, rnd: () => number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    return [Math.cos(a) * r * (0.8 + rnd() * 0.4), Math.sin(a) * r * (0.8 + rnd() * 0.4)] as const;
  });
}

function buildPoi(parts: Part[], p: Poi, rnd: () => number) {
  const accent = REGION_BY_ID[p.region as RegionId]?.accent ?? "#ffffff";
  const y = height(p.x, p.z);
  switch (p.kind) {
    case "capital": {
      if (p.region === "capital") {
        // The Hive Spire on its lake island
        parts.push({ s: "cyl", x: 0, y: 0.6, z: 0, sx: 10, sy: 1.6, sz: 10, ry: 0, c: "#cfc3ea" });
        parts.push({ s: "cyl", x: 0, y: 10, z: 0, sx: 3.2, sy: 18, sz: 3.2, ry: 0, c: "#e9e1ff" });
        parts.push({ s: "cone", x: 0, y: 24, z: 0, sx: 4, sy: 10, sz: 4, ry: 0, c: "#7b4dff" });
        parts.push({ s: "glowSphere", x: 0, y: 30, z: 0, sx: 1.6, sy: 1.6, sz: 1.6, ry: 0, c: "#c9a7ff" });
        for (const [dx, dz] of ring(6, 6.5, rnd)) parts.push({ s: "cyl", x: dx, y: 4, z: dz, sx: 1.2, sy: 7, sz: 1.2, ry: 0, c: "#e9e1ff" }, { s: "cone", x: dx, y: 8.8, z: dz, sx: 1.6, sy: 2.6, sz: 1.6, ry: 0, c: "#7b4dff" });
        break;
      }
      parts.push({ s: "cyl", x: p.x, y: y + 7, z: p.z, sx: 2.6, sy: 14, sz: 2.6, ry: 0, c: WALL[p.region] });
      parts.push({ s: "cone", x: p.x, y: y + 16.5, z: p.z, sx: 3.4, sy: 5, sz: 3.4, ry: 0, c: ROOF[p.region] });
      parts.push({ s: "glowSphere", x: p.x, y: y + 19.5, z: p.z, sx: 1, sy: 1, sz: 1, ry: 0, c: accent });
      for (const [dx, dz] of ring(7, 8, rnd)) house(parts, p.x + dx, p.z + dz, p.region, 1.15, rnd);
      break;
    }
    case "district": for (const [dx, dz] of ring(3, 3.2, rnd)) house(parts, p.x + dx, p.z + dz, p.region, 1, rnd); break;
    case "town": for (const [dx, dz] of ring(4, 4.2, rnd)) house(parts, p.x + dx, p.z + dz, p.region, 0.95, rnd); break;
    case "village": for (const [dx, dz] of ring(2, 2.6, rnd)) house(parts, p.x + dx, p.z + dz, p.region, 0.8, rnd); break;
    case "tavern": {
      house(parts, p.x, p.z, p.region, 1.5, rnd);
      parts.push({ s: "glowBox", x: p.x + 1.9, y: y + 1.6, z: p.z, sx: 0.3, sy: 1, sz: 1.4, ry: 0, c: "#ffcf6e" });
      parts.push({ s: "glowSphere", x: p.x + 2.6, y: y + 3.3, z: p.z + 1.2, sx: 0.5, sy: 0.5, sz: 0.5, ry: 0, c: "#ffb84d" });
      parts.push({ s: "cyl", x: p.x + 2.6, y: y + 1.5, z: p.z + 1.2, sx: 0.15, sy: 3, sz: 0.15, ry: 0, c: "#5a3d2b" });
      break;
    }
    case "dungeon": {
      parts.push({ s: "rock", x: p.x - 1.6, y: y + 1.8, z: p.z, sx: 1.4, sy: 3.6, sz: 1.4, ry: rnd(), c: "#3d3a4a" });
      parts.push({ s: "rock", x: p.x + 1.6, y: y + 1.8, z: p.z, sx: 1.4, sy: 3.6, sz: 1.4, ry: rnd(), c: "#3d3a4a" });
      parts.push({ s: "box", x: p.x, y: y + 3.9, z: p.z, sx: 4.6, sy: 0.9, sz: 1.6, ry: 0, c: "#2e2b38" });
      parts.push({ s: "glowBox", x: p.x, y: y + 1.4, z: p.z, sx: 1.6, sy: 2.6, sz: 0.2, ry: 0, c: "#8ef0c4" });
      break;
    }
    case "obelisk": {
      parts.push({ s: "box", x: p.x, y: y + 5, z: p.z, sx: 1.4, sy: 10, sz: 1.4, ry: Math.PI / 4, c: "#2b2740" });
      parts.push({ s: "glowBox", x: p.x, y: y + 6, z: p.z, sx: 0.5, sy: 6, sz: 1.5, ry: Math.PI / 4, c: accent });
      parts.push({ s: "crystal", x: p.x, y: y + 11.5, z: p.z, sx: 1.2, sy: 1.8, sz: 1.2, ry: 0, c: accent });
      break;
    }
    case "lighthouse": {
      parts.push({ s: "cyl", x: p.x, y: y + 6, z: p.z, sx: 1.8, sy: 12, sz: 1.8, ry: 0, c: "#f5f5f5" });
      parts.push({ s: "cyl", x: p.x, y: y + 9, z: p.z, sx: 1.85, sy: 1.6, sz: 1.85, ry: 0, c: "#d64545" });
      parts.push({ s: "glowSphere", x: p.x, y: y + 13, z: p.z, sx: 1.2, sy: 1.2, sz: 1.2, ry: 0, c: "#fff3b0" });
      break;
    }
    case "dock": {
      house(parts, p.x, p.z, p.region, 1, rnd);
      parts.push({ s: "box", x: p.x + 4, y: 0.6, z: p.z + 2, sx: 8, sy: 0.4, sz: 2, ry: 0.4, c: "#7a5636" });
      parts.push({ s: "cone", x: p.x + 7, y: 3, z: p.z + 4, sx: 1.6, sy: 3.5, sz: 0.2, ry: 0, c: "#f0e6d0" });
      break;
    }
    case "wild": {
      const r = p.region;
      if (r === "prism") for (let i = 0; i < 5; i++) parts.push({ s: "crystal", x: p.x + (rnd() - 0.5) * 6, y: y + 2 + rnd() * 2, z: p.z + (rnd() - 0.5) * 6, sx: 1 + rnd(), sy: 3 + rnd() * 4, sz: 1 + rnd(), ry: rnd() * 3, c: "#c9a7ff" });
      else if (r === "dreamveil" || r === "frogsong") {
        parts.push({ s: "cyl", x: p.x, y: y + 3, z: p.z, sx: 0.9, sy: 6, sz: 0.9, ry: 0, c: "#6b4a2f" });
        parts.push({ s: "sphere", x: p.x, y: y + 8, z: p.z, sx: 5, sy: 4.2, sz: 5, ry: 0, c: r === "dreamveil" ? "#f2c94c" : "#6fbf73" });
        parts.push({ s: "glowSphere", x: p.x + 2, y: y + 9, z: p.z + 1, sx: 0.4, sy: 0.4, sz: 0.4, ry: 0, c: "#fff1a8" });
      } else if (r === "emberforge") {
        parts.push({ s: "rock", x: p.x, y: y + 4, z: p.z, sx: 2.2, sy: 8, sz: 2.2, ry: rnd(), c: "#2f2a2e" });
        parts.push({ s: "glowSphere", x: p.x, y: y + 0.4, z: p.z + 2.4, sx: 1.4, sy: 0.4, sz: 1.4, ry: 0, c: "#ff6a2a" });
      } else {
        for (const [dx, dz] of ring(5, 3, rnd)) parts.push({ s: "box", x: p.x + dx, y: y + 1.6, z: p.z + dz, sx: 0.8, sy: 3.2, sz: 0.5, ry: Math.atan2(dz, dx), c: r === "hollow" ? "#d8d2c4" : "#8d8a80" });
      }
      break;
    }
  }
}

function scatter(parts: Part[], pois: Poi[]) {
  const rnd = mulberry32(SEED * 13);
  const clear = (x: number, z: number) => pois.every((p) => Math.hypot(p.x - x, p.z - z) > (p.kind === "capital" ? 16 : 7));
  for (let i = 0; i < 9000 && parts.length < 9000; i++) {
    const x = (rnd() - 0.5) * WORLD_W * 1.2, z = (rnd() - 0.5) * WORLD_D * 1.25;
    if (!isLand(x, z)) continue;
    const h = height(x, z);
    if (Math.hypot(x, z) < 34) continue;
    if (!clear(x, z)) continue;
    const r = regionAt(x, z);
    const roll = rnd();
    switch (r) {
      case "dreamveil":
        if (roll < 0.55) { parts.push({ s: "cyl", x, y: h + 1, z, sx: 0.35, sy: 2, sz: 0.35, ry: 0, c: "#6b4a2f" }, { s: "sphere", x, y: h + 3, z, sx: 2.2, sy: 2, sz: 2.2, ry: 0, c: rnd() < 0.3 ? "#f2c94c" : "#7cc46a" }); }
        break;
      case "tidecry":
      case "capital":
        if (roll < 0.5) { parts.push({ s: "cyl", x, y: h + 0.6, z, sx: 0.3, sy: 1.2, sz: 0.3, ry: 0, c: "#5a3d2b" }, { s: "cone", x, y: h + 3, z, sx: 1.6, sy: 4, sz: 1.6, ry: 0, c: r === "capital" ? "#5fa36a" : "#2f6b57" }); }
        break;
      case "emberforge":
        if (roll < 0.35) parts.push({ s: "rock", x, y: h + 0.8, z, sx: 1 + rnd() * 1.5, sy: 1 + rnd() * 2.5, sz: 1 + rnd() * 1.5, ry: rnd() * 3, c: "#3b3236" });
        break;
      case "prism":
        if (roll < 0.25) parts.push({ s: "crystal", x, y: h + 1, z, sx: 0.6, sy: 1.5 + rnd() * 2, sz: 0.6, ry: rnd() * 3, c: rnd() < 0.5 ? "#c9a7ff" : "#9fe6ff" });
        break;
      case "frogsong":
        if (roll < 0.4) parts.push({ s: "cyl", x, y: Math.max(h, 0.1) + 0.05, z, sx: 1.2, sy: 0.1, sz: 1.2, ry: 0, c: "#4caf50" });
        break;
      case "hollow":
        if (roll < 0.3) parts.push({ s: "cone", x, y: h + 1.2, z, sx: 0.5, sy: 2.4, sz: 0.5, ry: 0, c: "#d8d2c4" });
        break;
      default:
        if (roll < 0.2) parts.push({ s: "rock", x, y: h + 0.5, z, sx: 1, sy: 1, sz: 1, ry: rnd() * 3, c: "#7d776d" });
    }
  }
}

const GEOS: Record<Shape, () => THREE.BufferGeometry> = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  glowBox: () => new THREE.BoxGeometry(1, 1, 1),
  roof: () => new THREE.ConeGeometry(0.75, 1, 4),
  cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cone: () => new THREE.ConeGeometry(0.5, 1, 7),
  crystal: () => new THREE.OctahedronGeometry(0.6, 0),
  sphere: () => new THREE.IcosahedronGeometry(0.5, 1),
  glowSphere: () => new THREE.IcosahedronGeometry(0.5, 1),
  rock: () => new THREE.DodecahedronGeometry(0.6, 0),
};

function ShapeInstances({ shape, parts }: { shape: Shape; parts: Part[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => GEOS[shape](), [shape]);
  const glow = shape === "glowBox" || shape === "glowSphere";
  useLayoutEffect(() => {
    const m = ref.current!;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    parts.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z);
      o.rotation.set(0, p.ry, 0);
      o.scale.set(p.sx, p.sy, p.sz);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(p.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [parts]);
  if (!parts.length) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, parts.length]} castShadow={!glow} receiveShadow={!glow}>
      {glow ? <meshBasicMaterial toneMapped={false} /> : <meshStandardMaterial flatShading roughness={0.85} />}
    </instancedMesh>
  );
}

export function Props({ pois }: { pois: Poi[] }) {
  const groups = useMemo(() => {
    const parts: Part[] = [];
    const rnd = mulberry32(SEED * 3);
    for (const p of pois) buildPoi(parts, p, rnd);
    scatter(parts, pois);
    const by = new Map<Shape, Part[]>();
    for (const p of parts) by.set(p.s, [...(by.get(p.s) ?? []), p]);
    return [...by.entries()];
  }, [pois]);
  return <>{groups.map(([s, ps]) => <ShapeInstances key={s} shape={s} parts={ps} />)}</>;
}

export function Roads({ pois, roads }: { pois: Poi[]; roads: [number, number][] }) {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (const [a, b] of roads) {
      const A = pois[a], B = pois[b];
      const steps = Math.max(2, Math.ceil(Math.hypot(A.x - B.x, A.z - B.z) / 4));
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps;
        const x0 = A.x + (B.x - A.x) * t0, z0 = A.z + (B.z - A.z) * t0;
        const x1 = A.x + (B.x - A.x) * t1, z1 = A.z + (B.z - A.z) * t1;
        pts.push(x0, Math.max(height(x0, z0), 0.3) + 0.35, z0, x1, Math.max(height(x1, z1), 0.3) + 0.35, z1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [pois, roads]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#f3e2b8" transparent opacity={0.75} />
    </lineSegments>
  );
}
