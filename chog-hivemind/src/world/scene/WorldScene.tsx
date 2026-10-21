"use client";
import { MapControls, Sky, Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { getWorld } from "../store";
import { ChogSwarm } from "./ChogSwarm";
import { Bubbles, HoverTip, Labels } from "./Overlays";
import { Props, Roads, type Poi } from "./Props";
import { Terrain, Water } from "./Terrain";

type World = { regions: { id: string; name: string; x: number; z: number; accent: string }[]; pois: Poi[]; roads: [number, number][] };

/** Sun position from the real UTC clock: the world shares the players' day and night. */
function sunFor(date: Date) {
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const angle = ((hours - 6) / 24) * Math.PI * 2; // 06:00 sunrise, 18:00 sunset
  const elev = Math.sin(angle);
  return { pos: new THREE.Vector3(Math.cos(angle) * 300, elev * 300, -120), elev };
}

function Lighting() {
  const { pos, elev } = useMemo(() => sunFor(new Date()), []);
  const day = Math.max(0, elev);
  const night = elev < 0;
  return (
    <>
      <Sky sunPosition={night ? [pos.x, 2, pos.z] : pos.toArray()} turbidity={6} rayleigh={night ? 0.2 : 1.6} mieCoefficient={0.004} />
      {night && <Stars radius={500} depth={60} count={4000} factor={5} fade />}
      <hemisphereLight args={[night ? "#7c86ff" : "#dfe9ff", night ? "#1b1630" : "#6b8f5a", night ? 0.55 : 0.9]} />
      <directionalLight
        position={night ? [-200, 260, 120] : pos.toArray()}
        intensity={night ? 0.55 : 0.9 + day * 1.4}
        color={night ? "#9fb2ff" : elev < 0.25 ? "#ffcf9e" : "#fff6e5"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-340}
        shadow-camera-right={340}
        shadow-camera-top={260}
        shadow-camera-bottom={-260}
        shadow-camera-near={10}
        shadow-camera-far={900}
        shadow-bias={-0.0006}
      />
      <fog attach="fog" args={[night ? "#1d1838" : "#cfe2f7", 380, 980]} />
      <color attach="background" args={[night ? "#120f24" : "#bcd8f5"]} />
    </>
  );
}

/** Smoothly flies the camera to whatever the HUD or a click asked for. */
function CameraRig() {
  const controls = useThree((s) => s.controls) as any;
  const camera = useThree((s) => s.camera);
  const goal = useRef<{ at: number; target: THREE.Vector3; pos: THREE.Vector3 } | null>(null);
  const lastAt = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    const f = getWorld().flyTo;
    if (f && f.at !== lastAt.current) {
      lastAt.current = f.at;
      const dist = f.dist ?? 70;
      const dir = tmp.copy(camera.position).sub(controls?.target ?? new THREE.Vector3()).normalize();
      if (dir.y < 0.5) dir.set(dir.x, 0.75, dir.z).normalize();
      const target = new THREE.Vector3(f.x, 2, f.z);
      goal.current = { at: f.at, target, pos: target.clone().add(dir.multiplyScalar(dist)) };
    }
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.exp(-delta * 3);
    controls.target.lerp(g.target, k);
    camera.position.lerp(g.pos, k);
    controls.update();
    // Arrived: hand control back to the user.
    if (camera.position.distanceTo(g.pos) < 0.5) goal.current = null;
  });
  return null;
}

export function WorldScene({ world }: { world: World }) {
  return (
    <>
      <Lighting />
      <Terrain />
      <Water />
      <Props pois={world.pois} />
      <Roads pois={world.pois} roads={world.roads} />
      <Suspense fallback={null}>
        <ChogSwarm />
      </Suspense>
      <Labels pois={world.pois} regions={world.regions} />
      <Bubbles />
      <HoverTip />
      <MapControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={25}
        maxDistance={560}
        minPolarAngle={0.35}
        maxPolarAngle={1.2}
        screenSpacePanning={false}
        target={[0, 0, 20]}
      />
      <CameraRig />
    </>
  );
}
