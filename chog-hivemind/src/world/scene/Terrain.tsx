"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { colorAt, height, WORLD_D, WORLD_W } from "../terrain";

export function Terrain() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(WORLD_W * 1.35, WORLD_D * 1.45, 300, 220);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = height(x, z);
      pos.setY(i, h);
      const c = colorAt(x, z, h);
      // Palette values are sRGB; vertex colors must be in linear working space.
      col.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}

export function Water() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
      <planeGeometry args={[WORLD_W * 3, WORLD_D * 3]} />
      <meshStandardMaterial color="#2f74c0" transparent opacity={0.93} roughness={0.2} metalness={0.1} />
    </mesh>
  );
}
