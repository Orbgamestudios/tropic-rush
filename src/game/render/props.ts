// Palms, boulders, bushes, sandbag walls and grass tufts. Each kind is one merged geometry drawn
// with instancing, so dozens of props cost a handful of draw calls on the phone.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  beachWidth,
  type IslandLayout,
  shoreDistance,
  shoreRadius,
  terrainHeight,
} from "../logic/island";
import { createRng } from "../logic/rng";
import { COLORS } from "./palette";
import { merge, painted, vertexColored } from "./shapes";

function palmGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // A gently curved trunk out of a few tapered segments.
  let x = 0;
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.CylinderGeometry(0.2 - i * 0.02, 0.26 - i * 0.02, 1.25, 9);
    seg.rotateZ(-0.05 - i * 0.03);
    seg.translate(x, y + 0.62, 0);
    parts.push(painted(seg, i % 2 ? COLORS.palmTrunk : 0x8c6440));
    x += 0.07 + i * 0.04;
    y += 1.18;
  }
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const leaf = new THREE.SphereGeometry(1, 10, 6);
    leaf.scale(1.65, 0.09, 0.42);
    leaf.translate(1.45, 0, 0);
    leaf.rotateZ(-0.38 - (i % 2) * 0.12);
    leaf.rotateY(angle);
    leaf.translate(x, y + 0.1, 0);
    parts.push(painted(leaf, i % 2 ? COLORS.palmLeaf : 0x4fa640));
  }
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.SphereGeometry(0.16, 8, 6);
    nut.translate(x + Math.cos(i * 2.1) * 0.22, y - 0.12, Math.sin(i * 2.1) * 0.22);
    parts.push(painted(nut, 0x6b4a2b));
  }
  return merge(parts);
}

function rockGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const pos = geometry.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const bump = 1 + 0.12 * Math.sin(v.x * 3.1 + v.z * 2.3) + 0.08 * Math.sin(v.y * 4.7);
    v.multiplyScalar(bump);
    pos.setXYZ(i, v.x, v.y * 0.72, v.z);
  }
  geometry.computeVertexNormals();
  return painted(geometry, COLORS.rock);
}

function bushGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const blobs = [
    [0, 0.45, 0, 0.6],
    [0.45, 0.35, 0.15, 0.45],
    [-0.4, 0.35, 0.2, 0.42],
    [0.05, 0.32, -0.42, 0.42],
  ] as const;
  blobs.forEach(([x, y, z, r], i) => {
    const g = new THREE.SphereGeometry(r, 12, 9);
    g.translate(x, y, z);
    parts.push(painted(g, i % 2 ? COLORS.bush : 0x5aab4c));
  });
  return merge(parts);
}

export function sandbagPileGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bags = [
    [-0.42, 0.21, 0],
    [0.42, 0.21, 0],
    [0, 0.58, 0],
  ] as const;
  for (const [x, y, z] of bags) {
    const bag = new RoundedBoxGeometry(0.88, 0.42, 0.6, 2, 0.17);
    bag.translate(x, y, z);
    parts.push(painted(bag, COLORS.sandbag));
  }
  return merge(parts);
}

function tuftGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.ConeGeometry(0.07, 0.5, 4);
    blade.translate(0, 0.25, 0);
    blade.rotateZ(0.35 * (i % 2 ? 1 : -1));
    blade.rotateY((i / 4) * Math.PI * 2);
    parts.push(painted(blade, COLORS.grass));
  }
  return merge(parts);
}

export interface PropInstance {
  x: number;
  y: number;
  rotation: number;
  scale: THREE.Vector3;
}

export function instanced(
  geometry: THREE.BufferGeometry,
  items: readonly PropInstance[],
  castShadow = true,
): THREE.InstancedMesh {
  const meshes = new THREE.InstancedMesh(geometry, vertexColored(), Math.max(1, items.length));
  meshes.count = items.length;
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  items.forEach((item, i) => {
    quat.setFromAxisAngle(up, item.rotation);
    matrix.compose(
      new THREE.Vector3(item.x, terrainHeight(item.x, item.y), item.y),
      quat,
      item.scale,
    );
    meshes.setMatrixAt(i, matrix);
  });
  meshes.instanceMatrix.needsUpdate = true;
  meshes.castShadow = castShadow;
  meshes.receiveShadow = true;
  return meshes;
}

/** Builds every static prop on the island. */
export function buildProps(layout: IslandLayout): THREE.Group {
  const root = new THREE.Group();
  const palms: PropInstance[] = [];
  const rocks: PropInstance[] = [];
  const sandbags: PropInstance[] = [];
  for (const o of layout.obstacles) {
    const item = {
      x: o.pos.x,
      y: o.pos.y,
      rotation: o.rotation,
      scale: new THREE.Vector3(1, 1, 1),
    };
    if (o.kind === "palm") palms.push({ ...item, scale: new THREE.Vector3().setScalar(o.scale) });
    if (o.kind === "rock")
      rocks.push({ ...item, scale: new THREE.Vector3(o.scale * 1.1, o.scale, o.scale * 0.95) });
    if (o.kind === "sandbag") sandbags.push({ ...item, rotation: -o.rotation });
  }
  const bushes = layout.decor.map((d) => ({
    x: d.pos.x,
    y: d.pos.y,
    rotation: d.rotation,
    scale: new THREE.Vector3().setScalar(d.scale),
  }));

  // Tufts of grass scattered where the grass thins out into the sand.
  const tufts: PropInstance[] = [];
  const rng = createRng(layout.seed + 17);
  for (let i = 0; i < 900 && tufts.length < 160; i++) {
    const angle = rng() * Math.PI * 2;
    const r = shoreRadius(angle) * (0.55 + rng() * 0.45);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    const band = shoreDistance(x, y) - beachWidth(x, y);
    if (band < -3 || band > 0.5) continue;
    tufts.push({
      x,
      y,
      rotation: rng() * 6.28,
      scale: new THREE.Vector3().setScalar(0.7 + rng() * 0.7),
    });
  }

  root.add(instanced(palmGeometry(), palms));
  root.add(instanced(rockGeometry(), rocks));
  root.add(instanced(bushGeometry(), bushes));
  root.add(instanced(sandbagPileGeometry(), sandbags));
  root.add(instanced(tuftGeometry(), tufts, false));
  return root;
}
