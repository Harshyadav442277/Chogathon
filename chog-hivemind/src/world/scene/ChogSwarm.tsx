"use client";
// All 1,969 Chogs in one draw call: camera-facing portrait tokens sampled from the atlas.
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { height } from "../terrain";
import { getWorld, HOUSE_COLORS, setWorld, useWorld } from "../store";

const COLS = 45, ROWS = 44, SUPPLY = 1969;

const vertexShader = /* glsl */ `
  attribute float aIndex;
  attribute vec3 aColor;
  attribute float aSel;
  uniform float uScale;
  uniform float uMinScreen;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vIndex;
  varying float vSel;
  void main() {
    vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float s = max(uScale, -center.z * uMinScreen) * (1.0 + aSel * 0.8);
    center.xy += position.xy * s;
    center.y += s * 0.5;
    gl_Position = projectionMatrix * center;
    vUv = uv; vColor = aColor; vIndex = aIndex; vSel = aSel;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uCols;
  uniform float uRows;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vIndex;
  varying float vSel;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    if (r > 0.5) discard;
    vec3 col;
    if (r > 0.41) {
      col = mix(vColor, vec3(1.0, 0.85, 0.3), vSel);
    } else {
      float c = mod(vIndex, uCols);
      float row = floor(vIndex / uCols);
      vec2 tuv = vec2((c + vUv.x) / uCols, 1.0 - (row + 1.0 - vUv.y) / uRows);
      vec4 t = texture2D(uAtlas, tuv);
      col = t.a < 0.1 ? vColor * 0.7 : t.rgb;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function ChogSwarm() {
  const atlas = useLoader(THREE.TextureLoader, "/atlas/chogs.webp");
  const positions = useWorld((s) => s.positions);
  const selected = useWorld((s) => s.selectedChog);
  const myChogs = useWorld((s) => s.myChogs);
  const ref = useRef<THREE.InstancedMesh>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const count = positions?.ids.length ?? 0;
  const cur = useRef<Float32Array>(new Float32Array(0));
  const tgt = useRef<Float32Array>(new Float32Array(0));

  useMemo(() => {
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = 4;
  }, [atlas]);

  const { geometry, material } = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.setAttribute("aIndex", new THREE.InstancedBufferAttribute(new Float32Array(SUPPLY), 1));
    g.setAttribute("aColor", new THREE.InstancedBufferAttribute(new Float32Array(SUPPLY * 3), 3));
    g.setAttribute("aSel", new THREE.InstancedBufferAttribute(new Float32Array(SUPPLY), 1));
    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uAtlas: { value: atlas }, uCols: { value: COLS }, uRows: { value: ROWS }, uScale: { value: 2.6 }, uMinScreen: { value: 0.011 } },
    });
    return { geometry: g, material: m };
  }, [atlas]);

  // New positions from the server: set targets (and snap on first load).
  useEffect(() => {
    if (!positions || !ref.current) return;
    const n = positions.ids.length;
    const first = cur.current.length !== n * 3;
    if (first) cur.current = new Float32Array(n * 3);
    tgt.current = new Float32Array(n * 3);
    const idx = geometry.getAttribute("aIndex") as THREE.InstancedBufferAttribute;
    const colA = geometry.getAttribute("aColor") as THREE.InstancedBufferAttribute;
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = positions.x[i], z = positions.z[i];
      const y = Math.max(height(x, z), 0.3);
      tgt.current.set([x, y, z], i * 3);
      if (first) cur.current.set([x, y, z], i * 3);
      idx.setX(i, positions.ids[i] - 1);
      col.set(HOUSE_COLORS[positions.house[i]] ?? "#ffffff");
      colA.setXYZ(i, col.r, col.g, col.b);
    }
    idx.needsUpdate = true;
    colA.needsUpdate = true;
    ref.current.count = n;
  }, [positions, geometry]);

  useEffect(() => {
    if (!positions) return;
    const sel = geometry.getAttribute("aSel") as THREE.InstancedBufferAttribute;
    const mine = new Set(myChogs);
    for (let i = 0; i < positions.ids.length; i++) {
      const id = positions.ids[i];
      sel.setX(i, id === selected ? 1 : mine.has(id) ? 0.5 : 0);
    }
    sel.needsUpdate = true;
  }, [positions, selected, myChogs, geometry]);

  // Smoothly walk tokens toward their targets.
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!count) {
      mesh.count = 0;
      return;
    }
    const a = cur.current, b = tgt.current;
    const k = 1 - Math.exp(-delta * 1.2);
    for (let i = 0; i < count * 3; i++) a[i] += (b[i] - a[i]) * k;
    for (let i = 0; i < count; i++) {
      m4.makeTranslation(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Screen-space picking (tokens are billboards, so ray-vs-quad would be wrong).
  useEffect(() => {
    const el = gl.domElement;
    const v = new THREE.Vector3();
    let last = 0;
    const pick = (e: PointerEvent): number => {
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const a = cur.current;
      let best = -1, bestD = 18 * 18;
      for (let i = 0; i < count; i++) {
        v.set(a[i * 3], a[i * 3 + 1] + 1.3, a[i * 3 + 2]).project(camera);
        if (v.z > 1) continue;
        const sx = (v.x * 0.5 + 0.5) * rect.width, sy = (-v.y * 0.5 + 0.5) * rect.height;
        const d = (sx - px) ** 2 + (sy - py) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    };
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - last < 60) return;
      last = now;
      const i = pick(e);
      const pos = getWorld().positions;
      const hover = i >= 0 && pos ? { id: pos.ids[i], x: e.clientX, y: e.clientY } : null;
      if ((hover?.id ?? null) !== (getWorld().hover?.id ?? null)) setWorld({ hover });
      el.style.cursor = hover ? "pointer" : "";
    };
    let downAt = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return; // it was a drag
      const i = pick(e);
      const pos = getWorld().positions;
      if (i >= 0 && pos) setWorld({ selectedChog: pos.ids[i], selectedPoi: null });
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [gl, camera, count]);

  return <instancedMesh ref={ref} args={[geometry, material, SUPPLY]} frustumCulled={false} />;
}

/** Current animated position of a Chog (for bubbles and fly-to). */
export function chogWorldPos(id: number): [number, number, number] | null {
  const p = getWorld().positions;
  if (!p) return null;
  const i = p.ids.indexOf(id);
  if (i < 0) return null;
  const x = p.x[i], z = p.z[i];
  return [x, Math.max(height(x, z), 0.3), z];
}
