// Everything that grows or lies on the raid island: the rules' palms, boulders and sandbag walls,
// plus a dense jungle around the base's clearing (broadleaf trees, palms, elephant-ear plants),
// ferns, flowers and grass across the open ground, and driftwood, starfish and shells on the
// beach. Each kind is one merged geometry drawn with instancing, so thousands of plants cost a
// couple of dozen draw calls on the phone. Plants sway in the wind in the vertex shader.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { beachWidth, type IslandLayout, shoreDistance, terrainHeight } from "../logic/island";
import { createRng, type Rng } from "../logic/rng";
import { COLORS } from "./palette";
import type { SceneryMap } from "./scenery";
import { merge, painted, vertexColored } from "./shapes";

// ---------------------------------------------------------------------------------------------
// Wind

const wind = { value: 0 };
let swayMaterial: THREE.MeshStandardMaterial | null = null;

/** Like vertexColored(), but the higher a vertex sits, the more it sways in the wind. */
function swaying(): THREE.MeshStandardMaterial {
  if (swayMaterial) return swayMaterial;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 rootPos = instanceMatrix[3].xyz;
        #else
          vec3 rootPos = vec3(0.0);
        #endif
        float lift = max(position.y, 0.0);
        float phase = uWind * 1.4 + rootPos.x * 0.21 + rootPos.z * 0.17;
        float gust = 0.6 + 0.4 * sin(uWind * 0.37 + rootPos.x * 0.03);
        float bend = lift * lift * 0.012 * gust;
        transformed.x += sin(phase) * bend;
        transformed.z += cos(phase * 0.8 + 1.3) * bend * 0.7;
        // Leaves flutter a little on top of the sway.
        transformed.y += sin(phase * 3.1 + position.x * 4.0 + position.z * 3.0) * 0.015 * lift;`,
      );
  };
  m.customProgramCacheKey = () => "tropic-sway";
  swayMaterial = m;
  return m;
}

/** Advances the wind; call once a frame. */
export function updateWind(time: number): void {
  wind.value = time;
}

// ---------------------------------------------------------------------------------------------
// Shapes

/** A lumpy blob: an icosahedron pushed in and out by a few sine waves. */
function lump(radius: number, detail: number, seed: number, color: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const pos = g.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + 0.13 * Math.sin(v.x * 4.1 + seed) + 0.1 * Math.sin(v.y * 5.3 + v.z * 3.7 + seed);
    v.multiplyScalar(k);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return painted(g, color);
}

/** A leaf blade: a flattened, pointed spindle lying along +x from the origin. */
function blade(length: number, width: number, color: number): THREE.BufferGeometry {
  // Four sides and two rings: a flat diamond with a slight ridge, 8 triangles.
  const g = new THREE.SphereGeometry(1, 4, 2);
  g.scale(length / 2, 0.035, width / 2);
  g.translate(length / 2, 0, 0);
  return painted(g, color);
}

function palmGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // A gently curved, ringed trunk out of tapered segments.
  let x = 0;
  let y = 0;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.CylinderGeometry(0.19 - i * 0.017, 0.25 - i * 0.017, 1.08, 7, 1, true);
    seg.rotateZ(-0.05 - i * 0.028);
    seg.translate(x, y + 0.54, 0);
    parts.push(painted(seg, i % 2 ? COLORS.palmTrunk : 0x8c6440));
    x += 0.06 + i * 0.035;
    y += 1.02;
  }
  // Drooping fronds: each a chain of leaf pieces bending down along an arc.
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const angle = (i / fronds) * Math.PI * 2 + (i % 2) * 0.2;
    const lift = 0.5 - (i % 3) * 0.18;
    let fx = 0;
    let fy = 0;
    for (let s = 0; s < 4; s++) {
      const pitch = lift - s * 0.38;
      const len = 0.75 - s * 0.08;
      const piece = blade(len, 0.62 - s * 0.1, s % 2 ? COLORS.palmLeaf : 0x4fa640);
      piece.rotateZ(pitch);
      piece.translate(fx, fy, 0);
      piece.rotateY(angle);
      piece.translate(x, y + 0.08, 0);
      parts.push(piece);
      fx += Math.cos(pitch) * len * 0.92;
      fy += Math.sin(pitch) * len * 0.92;
    }
  }
  for (let i = 0; i < 4; i++) {
    const nut = new THREE.SphereGeometry(0.15, 5, 4);
    nut.translate(x + Math.cos(i * 1.7) * 0.2, y - 0.12, Math.sin(i * 1.7) * 0.2);
    parts.push(painted(nut, 0x5e4026));
  }
  return merge(parts);
}

function jungleTreeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.22, 0.42, 4.2, 8);
  trunk.translate(0, 2.1, 0);
  parts.push(painted(trunk, 0x6e5238));
  for (let i = 0; i < 3; i++) {
    const root = new THREE.ConeGeometry(0.22, 1.1, 5);
    root.rotateZ(1.05);
    root.translate(0.4, 0.25, 0);
    root.rotateY((i / 3) * Math.PI * 2 + 0.4);
    parts.push(painted(root, 0x5f4630));
  }
  const crowns = [
    [0, 4.9, 0, 1.9, 0x3f9a3d],
    [1.3, 4.3, 0.5, 1.4, 0x4cab45],
    [-1.1, 4.4, -0.6, 1.5, 0x358c38],
    [0.3, 4.2, -1.3, 1.3, 0x4cab45],
    [-0.4, 5.9, 0.4, 1.3, 0x5cbb4c],
  ] as const;
  crowns.forEach(([x, y, z, r, color], i) => {
    const blob = lump(r, 1, i * 1.7, color);
    blob.scale(1, 0.78, 1);
    blob.translate(x, y, z);
    parts.push(blob);
  });
  return merge(parts);
}

function elephantEarGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + (i % 2) * 0.3;
    const tall = 0.7 + (i % 3) * 0.25;
    const stalk = new THREE.CylinderGeometry(0.025, 0.04, tall, 5);
    stalk.translate(0, tall / 2, 0);
    stalk.rotateZ(-0.35);
    stalk.rotateY(angle);
    parts.push(painted(stalk, 0x4c8a35));
    // A broad heart-shaped leaf tipped towards the light.
    const leaf = new THREE.SphereGeometry(1, 6, 3);
    leaf.scale(0.55, 0.04, 0.4);
    leaf.translate(0.5, 0, 0);
    leaf.rotateZ(-0.5);
    leaf.translate(Math.sin(0.35) * tall, Math.cos(0.35) * tall, 0);
    leaf.rotateY(angle);
    parts.push(painted(leaf, i % 2 ? 0x3e9a3c : 0x52b148));
  }
  return merge(parts);
}

function fernGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + (i % 2) * 0.25;
    const frond = blade(0.95 + (i % 3) * 0.15, 0.24, i % 2 ? 0x4ea83f : 0x62bd4c);
    frond.rotateZ(0.65 - (i % 2) * 0.2);
    frond.rotateY(angle);
    parts.push(frond);
  }
  return merge(parts);
}

function flowerGeometry(petal: number, heart: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const leaf = blade(0.34, 0.12, 0x5bb04a);
    leaf.rotateZ(0.5);
    leaf.rotateY((i / 4) * Math.PI * 2);
    parts.push(leaf);
  }
  const heads = [
    [0, 0.42, 0],
    [0.16, 0.32, 0.1],
    [-0.12, 0.36, -0.12],
  ] as const;
  for (const [x, y, z] of heads) {
    const stem = new THREE.CylinderGeometry(0.012, 0.018, y, 3, 1, true);
    stem.translate(x * 0.5, y / 2, z * 0.5);
    parts.push(painted(stem, 0x4a8f38));
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      const leaf = new THREE.SphereGeometry(0.06, 4, 2);
      leaf.scale(1, 0.4, 0.7);
      leaf.translate(x + Math.cos(a) * 0.06, y, z + Math.sin(a) * 0.06);
      parts.push(painted(leaf, petal));
    }
    const middle = new THREE.SphereGeometry(0.035, 4, 2);
    middle.translate(x, y + 0.02, z);
    parts.push(painted(middle, heart));
  }
  return merge(parts);
}

function tuftGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const tall = 0.35 + (i % 3) * 0.12;
    const g = new THREE.ConeGeometry(0.06, tall, 3);
    g.translate(0, tall / 2, 0);
    g.rotateZ(0.25 + (i % 2) * 0.2);
    g.rotateY((i / 7) * Math.PI * 2);
    parts.push(painted(g, i % 2 ? COLORS.grass : 0x6cbb4a));
  }
  return merge(parts);
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
    const g = lump(r, 1, i * 2.3, i % 2 ? COLORS.bush : 0x5aab4c);
    g.translate(x, y, z);
    parts.push(g);
  });
  // A few red berries.
  for (let i = 0; i < 5; i++) {
    const berry = new THREE.SphereGeometry(0.06, 4, 3);
    const a = i * 1.3;
    berry.translate(Math.cos(a) * 0.5, 0.45 + (i % 2) * 0.2, Math.sin(a) * 0.5);
    parts.push(painted(berry, 0xd93b3b));
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
  // Mossy tops: green where the surface faces up.
  const colors = new Float32Array(pos.count * 3);
  const rock = new THREE.Color(COLORS.rock);
  const moss = new THREE.Color(0x6aa548);
  const normal = geometry.getAttribute("normal");
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const up = normal.getY(i);
    c.copy(rock).lerp(moss, Math.max(0, Math.min(1, (up - 0.75) * 4)) * 0.8);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function pebblesGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stones = [
    [0, 0, 0.32],
    [0.45, 0.2, 0.2],
    [-0.3, 0.35, 0.18],
    [0.1, -0.4, 0.22],
  ] as const;
  stones.forEach(([x, z, r], i) => {
    const g = lump(r, 0, i, i % 2 ? 0xa9a393 : 0x928c7c);
    g.scale(1, 0.6, 1);
    g.translate(x, r * 0.3, z);
    parts.push(g);
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

function driftwoodGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const log = new THREE.CylinderGeometry(0.16, 0.22, 2.6, 7);
  log.rotateZ(Math.PI / 2);
  log.translate(0, 0.16, 0);
  parts.push(painted(log, 0xb7a58c));
  const branch = new THREE.CylinderGeometry(0.05, 0.09, 0.9, 5);
  branch.rotateZ(Math.PI / 2 - 0.5);
  branch.rotateY(0.6);
  branch.translate(0.6, 0.32, 0.25);
  parts.push(painted(branch, 0xa8957b));
  return merge(parts);
}

function starfishGeometry(color: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.ConeGeometry(0.07, 0.24, 5);
    arm.rotateZ(-Math.PI / 2);
    arm.translate(0.12, 0, 0);
    arm.scale(1, 0.45, 1);
    arm.rotateY((i / 5) * Math.PI * 2);
    parts.push(painted(arm, color));
  }
  const middle = new THREE.SphereGeometry(0.07, 8, 4);
  middle.scale(1, 0.45, 1);
  parts.push(painted(middle, color));
  const all = merge(parts);
  all.translate(0, 0.03, 0);
  return all;
}

function shellGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.09, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, 0.6, 1.2);
  return painted(g, 0xf6e4d4);
}

// ---------------------------------------------------------------------------------------------
// Placement

export interface PropInstance {
  x: number;
  y: number;
  rotation: number;
  scale: THREE.Vector3;
  /** Extra height above the ground (driftwood half-buried, starfish on the sand). */
  sink?: number;
}

export function instanced(
  geometry: THREE.BufferGeometry,
  items: readonly PropInstance[],
  castShadow = true,
  material: THREE.Material = vertexColored(),
): THREE.InstancedMesh {
  const meshes = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  meshes.count = items.length;
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  items.forEach((item, i) => {
    quat.setFromAxisAngle(up, item.rotation);
    at.set(item.x, Math.max(-0.4, terrainHeight(item.x, item.y)) + (item.sink ?? 0), item.y);
    matrix.compose(at, quat, item.scale);
    meshes.setMatrixAt(i, matrix);
  });
  meshes.instanceMatrix.needsUpdate = true;
  meshes.castShadow = castShadow;
  meshes.receiveShadow = true;
  meshes.computeBoundingSphere();
  return meshes;
}

const ISLAND_EXTENT = 112;
/** Plants are split into square chunks this wide, so the ones off screen aren't drawn. */
const CHUNK = 40;

/** Like instanced(), but one mesh per chunk of the island, each culled on its own. */
function chunked(
  geometry: THREE.BufferGeometry,
  items: readonly PropInstance[],
  castShadow: boolean,
  material: THREE.Material,
): THREE.Group {
  const cells = new Map<string, PropInstance[]>();
  for (const it of items) {
    const key = `${Math.floor(it.x / CHUNK)},${Math.floor(it.y / CHUNK)}`;
    const list = cells.get(key) ?? [];
    list.push(it);
    cells.set(key, list);
  }
  const g = new THREE.Group();
  for (const list of cells.values()) g.add(instanced(geometry, list, castShadow, material));
  return g;
}

/** Calls `visit` at jittered points on a grid over the island, `cell` meters apart. */
function sample(rng: Rng, cell: number, visit: (x: number, y: number) => void): void {
  for (let gx = -ISLAND_EXTENT; gx < ISLAND_EXTENT; gx += cell) {
    for (let gy = -ISLAND_EXTENT; gy < ISLAND_EXTENT; gy += cell) {
      visit(gx + rng() * cell, gy + rng() * cell);
    }
  }
}

function item(rng: Rng, x: number, y: number, size: number, squash = 1): PropInstance {
  return {
    x,
    y,
    rotation: rng() * Math.PI * 2,
    scale: new THREE.Vector3(size, size * squash, size),
  };
}

/** Builds every static prop on the island. */
export function buildProps(layout: IslandLayout, map: SceneryMap): THREE.Group {
  const root = new THREE.Group();
  const rng = createRng(layout.seed + 17);

  // The rules' own obstacles: palms (walk-through), boulders and sandbags (cover).
  const palms: PropInstance[] = [];
  const rocks: PropInstance[] = [];
  const sandbags: PropInstance[] = [];
  for (const o of layout.obstacles) {
    const base = {
      x: o.pos.x,
      y: o.pos.y,
      rotation: o.rotation,
      scale: new THREE.Vector3(1, 1, 1),
    };
    if (o.kind === "palm") palms.push({ ...base, scale: new THREE.Vector3().setScalar(o.scale) });
    if (o.kind === "rock")
      rocks.push({ ...base, scale: new THREE.Vector3(o.scale * 1.1, o.scale, o.scale * 0.95) });
    if (o.kind === "sandbag") sandbags.push({ ...base, rotation: -o.rotation });
  }
  const bushes = layout.decor.map((d) => ({
    x: d.pos.x,
    y: d.pos.y,
    rotation: d.rotation,
    scale: new THREE.Vector3().setScalar(d.scale),
  }));

  // The jungle: big trees and palms crowding in around the clearing, plants under them.
  const trees: PropInstance[] = [];
  const ears: PropInstance[] = [];
  const pebbles: PropInstance[] = [];
  sample(rng, 3.2, (x, y) => {
    const j = map.jungle(x, y);
    if (j < 0.15 || map.room(x, y) < 2.5) return;
    const roll = rng();
    if (roll < j * 0.42) trees.push(item(rng, x, y, 0.8 + rng() * 0.75));
    else if (roll < j * 0.52) palms.push(item(rng, x, y, 0.9 + rng() * 0.45));
    else if (roll < j * 0.75) ears.push(item(rng, x, y, 0.8 + rng() * 0.6));
    else if (roll < j * 0.8) pebbles.push(item(rng, x, y, 0.7 + rng() * 0.9));
  });

  // Palms along the top of the beach.
  sample(rng, 4, (x, y) => {
    const sd = shoreDistance(x, y);
    const top = beachWidth(x, y);
    if (sd < top - 3 || sd > top + 5 || map.room(x, y) < 2 || map.trail(x, y) < 4) return;
    if (rng() < 0.16) palms.push(item(rng, x, y, 0.85 + rng() * 0.4));
  });

  // Low plants on the open grass: ferns, flowers and tufts, kept off the trail and buildings.
  const ferns: PropInstance[] = [];
  const flowers: PropInstance[][] = [[], [], []];
  const tufts: PropInstance[] = [];
  sample(rng, 2.1, (x, y) => {
    const g = map.grass(x, y);
    if (g < 0.5 || map.room(x, y) < 1.1 || map.trail(x, y) < 2.6) return;
    const j = map.jungle(x, y);
    const roll = rng();
    if (roll < 0.14 + 0.45 * j) ferns.push(item(rng, x, y, 0.7 + rng() * 0.6));
    else if (roll < 0.19 + 0.5 * j)
      flowers[Math.floor(rng() * 3)]?.push(item(rng, x, y, 0.9 + rng() * 0.6));
  });
  sample(rng, 1.5, (x, y) => {
    const g = map.grass(x, y);
    if (g < 0.2 || map.room(x, y) < 0.7 || map.trail(x, y) < 1.9) return;
    if (rng() < 0.3 + 0.2 * (1 - g)) tufts.push(item(rng, x, y, 0.7 + rng() * 0.8));
  });

  // The beach: driftwood up the sand, starfish and shells near the water.
  const driftwood: PropInstance[] = [];
  const stars: PropInstance[][] = [[], []];
  const shells: PropInstance[] = [];
  sample(rng, 3, (x, y) => {
    const sd = shoreDistance(x, y);
    if (sd < 0.6 || sd > beachWidth(x, y) - 1 || map.room(x, y) < 2) return;
    if (Math.hypot(x - layout.spawn.x, y - layout.spawn.y) < 7) return;
    const roll = rng();
    if (sd > 4 && roll < 0.018)
      driftwood.push({ ...item(rng, x, y, 0.8 + rng() * 0.5), sink: -0.05 });
    else if (sd < 4.5 && roll < 0.07)
      stars[rng() < 0.6 ? 0 : 1]?.push({ ...item(rng, x, y, 0.9 + rng() * 0.6), sink: 0.01 });
    else if (roll < 0.12) shells.push({ ...item(rng, x, y, 0.8 + rng() * 0.8), sink: 0.01 });
  });

  const sway = swaying();
  root.add(
    chunked(palmGeometry(), palms, true, sway),
    chunked(jungleTreeGeometry(), trees, true, sway),
    chunked(elephantEarGeometry(), ears, false, sway),
    instanced(rockGeometry(), rocks),
    instanced(pebblesGeometry(), pebbles),
    instanced(bushGeometry(), bushes, true, sway),
    instanced(sandbagPileGeometry(), sandbags),
    chunked(fernGeometry(), ferns, false, sway),
    chunked(flowerGeometry(0xff5a6e, 0xffe066), flowers[0] ?? [], false, sway),
    chunked(flowerGeometry(0xffd23f, 0xff8a1c), flowers[1] ?? [], false, sway),
    chunked(flowerGeometry(0xf4f1ff, 0xffc93a), flowers[2] ?? [], false, sway),
    chunked(tuftGeometry(), tufts, false, sway),
    instanced(driftwoodGeometry(), driftwood),
    instanced(starfishGeometry(0xff7a45), stars[0] ?? [], false),
    instanced(starfishGeometry(0xe85a9a), stars[1] ?? [], false),
    instanced(shellGeometry(), shells, false),
  );
  return root;
}
