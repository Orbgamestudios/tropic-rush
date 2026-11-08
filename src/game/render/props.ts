// Everything that grows or lies on the raid island: the rules' palms and boulders,
// plus a dense jungle around the base's clearing (broadleaf trees, palms, elephant-ear plants),
// ferns, flowers and grass across the open ground, and whatever the tide has left on the beach.
// Each kind is one merged geometry drawn with instancing, so thousands of plants cost a couple of
// dozen draw calls on the phone. Plants sway in the wind in the vertex shader.

import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { HOME_CLIFFS } from "../logic/crewIsland";
import { HOME_SHAPE, homeHeight, type IslandLayout, type IslandShape } from "../logic/island";
import { createRng, type Rng } from "../logic/rng";
import { lotTide, TIDE_LOTS } from "../logic/tides";
import { smoothstep, type Vec2 } from "../logic/vec";
import { meadowTint } from "./meadow";
import { COLORS } from "./palette";
import type { SceneryMap } from "./scenery";
import { merge, painted, vertexColored } from "./shapes";
import { SKY } from "./sky";
import { plantPicture } from "./thumbnails";

// ---------------------------------------------------------------------------------------------
// Wind

const wind = { value: 0 };
/** The hero the camera follows; plants between them and the camera dissolve. */
const focus = { value: new THREE.Vector3(0, -100, 0) };
const swayMaterials = new Map<string, THREE.MeshLambertMaterial>();

/**
 * Like vertexColored(), but the higher a vertex sits, the more it sways in the wind. With
 * `dissolve`, plants between the camera and the hero fade away; that uses `discard`, which stops
 * an iPhone's graphics chip skipping hidden surfaces, so it's only for plants tall enough to need it.
 * `stiff` is for rock: it fades away the same, and stands still.
 */
export function swaying(dissolve = true, stiff = false): THREE.MeshLambertMaterial {
  const key = `${dissolve}-${stiff}`;
  const made = swayMaterials.get(key);
  if (made) return made;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (!stiff) m.color = SKY.forest.value;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.uniforms.uFocus = focus;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uWind;\nvarying vec3 vSwayWorld;",
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 rootPos = instanceMatrix[3].xyz;
        #else
          vec3 rootPos = vec3(0.0);
        #endif
        float lift = ${stiff ? "0.0" : "max(position.y, 0.0)"};
        float phase = uWind * 1.4 + rootPos.x * 0.21 + rootPos.z * 0.17;
        float gust = 0.6 + 0.4 * sin(uWind * 0.37 + rootPos.x * 0.03);
        float bend = lift * lift * 0.012 * gust;
        transformed.x += sin(phase) * bend;
        transformed.z += cos(phase * 0.8 + 1.3) * bend * 0.7;
        // Leaves flutter a little on top of the sway.
        transformed.y += sin(phase * 3.1 + position.x * 4.0 + position.z * 3.0) * 0.015 * lift;
        vec4 swayWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          swayWorld = instanceMatrix * swayWorld;
        #endif
        vSwayWorld = (modelMatrix * swayWorld).xyz;`,
      );
    if (!dissolve) return;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uFocus;\nvarying vec3 vSwayWorld;",
      )
      .replace(
        "#include <clipping_planes_fragment>",
        /* glsl */ `#include <clipping_planes_fragment>
        // Dissolve anything between the camera and the hero, in a soft dithered tube.
        vec3 toHero = uFocus - cameraPosition;
        float along = clamp(dot(vSwayWorld - cameraPosition, toHero) / dot(toHero, toHero), 0.0, 1.0);
        float gap = length(vSwayWorld - (cameraPosition + toHero * along));
        float cut = smoothstep(5.5, 2.5, gap) * smoothstep(0.98, 0.9, along);
        float noiseCut = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
        if (noiseCut < cut * 0.85) discard;`,
      );
  };
  m.customProgramCacheKey = () => `tropic-sway-${key}`;
  swayMaterials.set(key, m);
  return m;
}

/** Advances the wind and tells the plants where the followed hero is; call once a frame. */
export function updateWind(time: number, hero: THREE.Vector3 | null): void {
  wind.value = time;
  if (hero) focus.value.copy(hero);
  else focus.value.set(0, -100, 0);
}

// ---------------------------------------------------------------------------------------------
// Small plants drawn flat: each kind is drawn once into a picture, and every plant of that kind is
// a card with it on, turned to face the camera and swaying in the wind. Two triangles a plant
// rather than dozens, with thousands of them on an island. The Ultra graphics setting keeps them
// solid.

let solid = false;

/** Keeps the small plants solid (Ultra) or draws them as cards. Islands drawn after this follow it. */
export function setSolidPlants(on: boolean): void {
  solid = on;
}

export function solidPlants(): boolean {
  return solid;
}

/** How far the camera looks down, in radians: the cards are drawn as seen from about here. */
const CARD_PITCH = 0.95;

const cards = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material }>();

function card(name: string, plant: () => THREE.BufferGeometry) {
  let made = cards.get(name);
  if (made) return made;
  const picture = plantPicture(plant(), CARD_PITCH);
  const map = new THREE.CanvasTexture(picture.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(
    picture.right - picture.left,
    picture.top - picture.bottom,
  );
  geometry.translate((picture.left + picture.right) / 2, (picture.bottom + picture.top) / 2, 0);
  // Lit as the ground is, from above, whichever way the card turns.
  const normals = geometry.getAttribute("normal");
  for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);
  const material = new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
  material.color = SKY.forest.value;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <project_vertex>",
        /* glsl */ `
        // Stood upright on its root and turned square to the camera, flipped for some of them so
        // they don't all lean the same way, its top swaying in the wind.
        vec4 root = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 rootWorld = instanceMatrix[3].xyz;
        float size = length(instanceMatrix[0].xyz);
        float flip = instanceMatrix[0].x < 0.0 ? -1.0 : 1.0;
        float lift = max(transformed.y, 0.0) * size;
        float phase = uWind * 1.4 + rootWorld.x * 0.21 + rootWorld.z * 0.17;
        float gust = 0.6 + 0.4 * sin(uWind * 0.37 + rootWorld.x * 0.03);
        vec4 mvPosition = root + vec4(transformed.x * size * flip, transformed.y * size, 0.0, 0.0);
        mvPosition.x += sin(phase) * lift * lift * 0.05 * gust;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  material.customProgramCacheKey = () => "tropic-plant-card";
  made = { geometry, material };
  cards.set(name, made);
  return made;
}

/** A kind of small plant over the island: solid on Ultra, otherwise cards. */
export function smallPlants(
  name: string,
  plant: () => THREE.BufferGeometry,
  items: readonly PropInstance[],
  material: THREE.Material,
  ground: (x: number, y: number) => number,
  blend = false,
): THREE.Group {
  if (solid) return chunked(plant(), items, false, material, ground, blend);
  const { geometry, material: flat } = card(name, plant);
  return chunked(geometry, items, false, flat, ground, blend);
}

// ---------------------------------------------------------------------------------------------
// Shapes

/** A lumpy blob: an icosahedron pushed in and out by a few sine waves. */
export function lump(
  radius: number,
  detail: number,
  seed: number,
  color: number,
): THREE.BufferGeometry {
  // Welded so the normals come out smooth instead of faceted.
  const raw = new THREE.IcosahedronGeometry(radius, detail);
  raw.deleteAttribute("normal");
  raw.deleteAttribute("uv");
  const g = mergeVertices(raw);
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

export function palmGeometry(): THREE.BufferGeometry {
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

/** A snowy pine for the northern islands: tiers of dark needles, each with snow lying on it. */
export function pineGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.14, 0.26, 1.4, 7);
  trunk.translate(0, 0.7, 0);
  parts.push(painted(trunk, 0x5e4430));
  const tiers = [
    [1.0, 1.9, 2.0],
    [2.2, 1.55, 1.8],
    [3.3, 1.2, 1.6],
    [4.3, 0.8, 1.4],
  ] as const;
  tiers.forEach(([y, r, h], i) => {
    const needles = new THREE.ConeGeometry(r, h, 8);
    needles.translate(0, y + h / 2, 0);
    parts.push(painted(needles, i % 2 ? 0x2c5e43 : 0x31694a));
    const snow = new THREE.ConeGeometry(r * 0.78, h * 0.5, 8);
    snow.translate(0, y + h * 0.76, 0);
    parts.push(painted(snow, i % 2 ? 0xe9f0f6 : 0xf5f8fb));
  });
  return merge(parts);
}

/**
 * A copy of a plant or rock with snow lying on whatever faces up: the more it faces the sky, the
 * whiter.
 */
export function snowCapped(source: THREE.BufferGeometry, amount = 1): THREE.BufferGeometry {
  const g = source.clone();
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  const normals = g.getAttribute("normal");
  const colors = g.getAttribute("color");
  if (!colors) return g;
  const white = new THREE.Color(0xf3f7fb);
  const c = new THREE.Color();
  for (let i = 0; i < colors.count; i++) {
    const up = smoothstep(0.35, 0.75, normals.getY(i)) * amount;
    c.fromBufferAttribute(colors as THREE.BufferAttribute, i).lerp(white, up);
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  return g;
}

export function jungleTreeGeometry(): THREE.BufferGeometry {
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

export function elephantEarGeometry(): THREE.BufferGeometry {
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

export function fernGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + (i % 2) * 0.25;
    const frond = blade(0.95 + (i % 3) * 0.15, 0.24, i % 2 ? 0x4ea83f : 0x62bd4c);
    frond.rotateZ(0.65 - (i % 2) * 0.2);
    frond.rotateY(angle);
    parts.push(frond);
  }
  return merge(parts);
}

export function flowerGeometry(petal: number, heart: number): THREE.BufferGeometry {
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

export function tuftGeometry(): THREE.BufferGeometry {
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

export function bushGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const blobs = [
    [0, 0.45, 0, 0.6],
    [0.45, 0.35, 0.15, 0.45],
    [-0.4, 0.35, 0.2, 0.42],
    [0.05, 0.32, -0.42, 0.42],
  ] as const;
  blobs.forEach(([x, y, z, r], i) => {
    // Plenty of these on an island: only the two big lumps get the finer mesh.
    const g = lump(r, i < 2 ? 1 : 0, i * 2.3, i % 2 ? COLORS.bush : 0x5aab4c);
    g.translate(x, y, z);
    parts.push(g);
  });
  // A few red berries.
  for (let i = 0; i < 3; i++) {
    const berry = new THREE.SphereGeometry(0.06, 4, 3);
    const a = i * 1.3;
    berry.translate(Math.cos(a) * 0.5, 0.45 + (i % 2) * 0.2, Math.sin(a) * 0.5);
    parts.push(painted(berry, 0xd93b3b));
  }
  return merge(parts);
}

export function rockGeometry(): THREE.BufferGeometry {
  // Welded so the normals come out smooth instead of faceted.
  const raw = new THREE.IcosahedronGeometry(1, 2);
  raw.deleteAttribute("normal");
  raw.deleteAttribute("uv");
  const geometry = mergeVertices(raw);
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

/** One lump of a cliff, with moss where it faces the sky and darker rock towards the bottom. */
function cliffLump(
  seed: number,
  sx: number,
  sy: number,
  sz: number,
  x: number,
  y: number,
  z: number,
): THREE.BufferGeometry {
  const raw = new THREE.IcosahedronGeometry(1, 3);
  raw.deleteAttribute("normal");
  raw.deleteAttribute("uv");
  const g = mergeVertices(raw);
  const pos = g.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Blocky ledges: the rock is pushed in and out in steps as it rises.
    const ledge = Math.round((v.y + seed) * 2.6) / 2.6 - seed;
    const bump =
      1 +
      0.16 * Math.sin(v.x * 3.3 + seed) * Math.cos(v.z * 2.7 - seed) +
      0.09 * Math.sin(ledge * 7.1 + seed * 2);
    v.set(v.x * bump * sx, (v.y * 0.7 + ledge * 0.3) * sy, v.z * bump * sz);
    pos.setXYZ(i, v.x + x, v.y + y, v.z + z);
  }
  g.computeVertexNormals();
  const normal = g.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  const low = new THREE.Color(0x77705f);
  const high = new THREE.Color(0xb1a993);
  const moss = new THREE.Color(0x5f9a44);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const lift = Math.max(0, Math.min(1, (pos.getY(i) + 0.5) / 2));
    c.copy(low).lerp(high, lift);
    c.lerp(moss, Math.max(0, Math.min(1, (normal.getY(i) - 0.6) * 3.2)) * 0.85);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

/** A great stack of boulders, about 1 across and 2 tall before it's scaled. */
export function cliffGeometry(): THREE.BufferGeometry {
  return merge([
    cliffLump(1.3, 1, 1.5, 0.95, 0, 0.5, 0),
    cliffLump(2.7, 0.72, 0.95, 0.7, 0.62, -0.1, 0.34),
    cliffLump(4.1, 0.66, 0.8, 0.8, -0.58, -0.25, -0.3),
    cliffLump(5.9, 0.5, 0.62, 0.5, 0.12, 1.45, -0.1),
  ]);
}

/** The great boulders at the back of the crew's island. */
export function homeCliffs(): THREE.Group {
  const rng = createRng(0xc11f);
  const items: PropInstance[] = HOME_CLIFFS.map((c) => ({
    x: c.x,
    y: c.y,
    rotation: rng() * Math.PI * 2,
    scale: new THREE.Vector3(c.r * 0.92, c.r * (0.95 + rng() * 0.5), c.r * 0.92),
    sink: -0.4,
  }));
  const group = new THREE.Group();
  group.add(instanced(cliffGeometry(), items, true, vertexColored(), homeHeight));
  return group;
}

export function pebblesGeometry(): THREE.BufferGeometry {
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

function coconutGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.17, 8, 6);
  g.scale(1, 0.9, 1.1);
  g.translate(0, 0.13, 0);
  return painted(g, 0x6a4a2e);
}

function seaweedGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const frond = new THREE.BoxGeometry(0.75, 0.03, 0.08);
    frond.rotateY(i * 1.1);
    frond.translate((i - 1.5) * 0.09, 0.03, (i % 2) * 0.1);
    parts.push(painted(frond, i % 2 ? 0x2f7a4a : 0x3f8f58));
  }
  return merge(parts);
}

function bottleGeometry(): THREE.BufferGeometry {
  const glass = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
  const neck = new THREE.CylinderGeometry(0.03, 0.05, 0.12, 8);
  neck.translate(0, 0.2, 0);
  const cork = new THREE.CylinderGeometry(0.033, 0.033, 0.05, 6);
  cork.translate(0, 0.27, 0);
  const all = merge([painted(glass, 0x5fb89a), painted(neck, 0x5fb89a), painted(cork, 0xb78a56)]);
  all.rotateZ(Math.PI / 2 - 0.08);
  all.translate(0, 0.08, 0);
  return all;
}

function washedUpCrateGeometry(): THREE.BufferGeometry {
  const parts = [painted(new THREE.BoxGeometry(0.8, 0.62, 0.8), 0x9a7a52)];
  for (const y of [0.2, -0.2]) {
    const slat = new THREE.BoxGeometry(0.84, 0.1, 0.84);
    slat.translate(0, y, 0);
    parts.push(painted(slat, 0x7a5c3a));
  }
  const all = merge(parts);
  all.rotateZ(0.14);
  all.translate(0, 0.24, 0);
  return all;
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
  ground: (x: number, y: number) => number = homeHeight,
  blend = false,
): THREE.InstancedMesh {
  const meshes = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  meshes.count = items.length;
  const tint = new THREE.Color();
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  items.forEach((item, i) => {
    quat.setFromAxisAngle(up, item.rotation);
    at.set(item.x, Math.max(-0.4, ground(item.x, item.y)) + (item.sink ?? 0), item.y);
    matrix.compose(at, quat, item.scale);
    meshes.setMatrixAt(i, matrix);
    if (blend) meshes.setColorAt(i, meadowTint(item.x, item.y, tint));
  });
  meshes.instanceMatrix.needsUpdate = true;
  meshes.castShadow = castShadow;
  meshes.receiveShadow = true;
  meshes.computeBoundingSphere();
  return meshes;
}

export const BEACH_FINDS = "beach finds";
const ISLAND_EXTENT = 112;
/** Plants are split into square chunks this wide, so the ones off screen aren't drawn. */
const CHUNK = 40;

/**
 * Like instanced(), but one mesh per chunk of the island, each culled on its own. With `blend`,
 * each plant takes on the color of the swathe of grass it stands in.
 */
export function chunked(
  geometry: THREE.BufferGeometry,
  items: readonly PropInstance[],
  castShadow: boolean,
  material: THREE.Material,
  ground: (x: number, y: number) => number = homeHeight,
  blend = false,
): THREE.Group {
  const cells = new Map<string, PropInstance[]>();
  for (const it of items) {
    const key = `${Math.floor(it.x / CHUNK)},${Math.floor(it.y / CHUNK)}`;
    const list = cells.get(key) ?? [];
    list.push(it);
    cells.set(key, list);
  }
  const g = new THREE.Group();
  for (const list of cells.values()) {
    g.add(instanced(geometry, list, castShadow, material, ground, blend));
  }
  return g;
}

/** Calls `visit` at jittered points on a grid over the island, `cell` meters apart. */
function sample(
  rng: Rng,
  cell: number,
  visit: (x: number, y: number) => void,
  extent = ISLAND_EXTENT,
): void {
  for (let gx = -extent; gx < extent; gx += cell) {
    for (let gy = -extent; gy < extent; gy += cell) {
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
  const shape = layout.shape ?? HOME_SHAPE;
  const ground = (x: number, y: number) => Math.max(0, shape.height(x, y));
  const extent = shape.reach;

  // The rules' own obstacles: palms (walk-through), boulders and cliffs (cover).
  const palms: PropInstance[] = [];
  const rocks: PropInstance[] = [];
  const cliffs: PropInstance[] = [];
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
    if (o.kind === "cliff") {
      const tall = o.scale * (1.25 + rng() * 0.7);
      cliffs.push({
        ...base,
        scale: new THREE.Vector3(o.scale * 1.08, tall, o.scale * 1.08),
        sink: -0.3,
      });
    }
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
  sample(
    rng,
    3.2,
    (x, y) => {
      const j = map.jungle(x, y);
      if (j < 0.15 || map.room(x, y) < 2.5) return;
      const roll = rng();
      if (roll < j * 0.42) trees.push(item(rng, x, y, 0.8 + rng() * 0.75));
      else if (roll < j * 0.52) palms.push(item(rng, x, y, 0.9 + rng() * 0.45));
      else if (roll < j * 0.75) ears.push(item(rng, x, y, 0.8 + rng() * 0.6));
      else if (roll < j * 0.8) pebbles.push(item(rng, x, y, 0.7 + rng() * 0.9));
    },
    extent,
  );

  // Low plants on the open grass: ferns, flowers and tufts, kept off the trail and buildings.
  const ferns: PropInstance[] = [];
  const flowers: PropInstance[][] = [[], [], []];
  const tufts: PropInstance[] = [];
  sample(
    rng,
    2.1,
    (x, y) => {
      const g = map.grass(x, y);
      if (g < 0.5 || map.room(x, y) < 1.1 || map.trail(x, y) < 2.6) return;
      const j = map.jungle(x, y);
      const roll = rng();
      if (roll < 0.14 + 0.45 * j) ferns.push(item(rng, x, y, 0.7 + rng() * 0.6));
      else if (roll < 0.19 + 0.5 * j)
        flowers[Math.floor(rng() * 3)]?.push(item(rng, x, y, 0.9 + rng() * 0.6));
    },
    extent,
  );
  sample(
    rng,
    1.5,
    (x, y) => {
      const g = map.grass(x, y);
      if (g < 0.2 || map.room(x, y) < 0.7 || map.trail(x, y) < 1.9) return;
      if (rng() < 0.3 + 0.2 * (1 - g)) tufts.push(item(rng, x, y, 0.7 + rng() * 0.8));
    },
    extent,
  );

  const sway = swaying();
  const low = swaying(false);
  if ((layout.snow ?? 0) > 0.5) {
    // The snowy north: pines where the palms and jungle would be, snow on the rocks and bushes,
    // and nothing flowering.
    root.add(
      chunked(snowy.pine(), [...palms, ...trees], true, sway, ground),
      instanced(snowy.rock(), rocks, true, vertexColored(), ground),
      instanced(snowy.cliff(), cliffs, true, swaying(true, true), ground),
      instanced(snowy.pebbles(), pebbles, true, vertexColored(), ground),
      instanced(snowy.bush(), [...bushes, ...ears], true, low, ground, true),
      buildShore(layout.seed, map, layout.spawn, ground, 5, shape, true),
    );
    return root;
  }
  root.add(
    chunked(palmGeometry(), palms, true, sway, ground),
    chunked(jungleTreeGeometry(), trees, true, sway, ground),
    chunked(elephantEarGeometry(), ears, false, sway, ground),
    instanced(rockGeometry(), rocks, true, vertexColored(), ground),
    instanced(cliffGeometry(), cliffs, true, swaying(true, true), ground),
    instanced(pebblesGeometry(), pebbles, true, vertexColored(), ground),
    instanced(bushGeometry(), bushes, true, low, ground, true),
    smallPlants("fern", fernGeometry, ferns, low, ground, true),
    smallPlants("red", () => flowerGeometry(0xff5a6e, 0xffe066), flowers[0] ?? [], low, ground),
    smallPlants("yellow", () => flowerGeometry(0xffd23f, 0xff8a1c), flowers[1] ?? [], low, ground),
    smallPlants("white", () => flowerGeometry(0xf4f1ff, 0xffc93a), flowers[2] ?? [], low, ground),
    smallPlants("tuft", tuftGeometry, tufts, low, ground, true),
    buildShore(layout.seed, map, layout.spawn, ground, 5, shape),
  );
  return root;
}

/** The snowy north's shapes, made the first time they're wanted and kept. */
const snowyShapes = new Map<string, THREE.BufferGeometry>();
const snowyShape = (name: string, make: () => THREE.BufferGeometry) => () => {
  let g = snowyShapes.get(name);
  if (!g) {
    g = make();
    snowyShapes.set(name, g);
  }
  return g;
};
const snowy = {
  pine: snowyShape("pine", pineGeometry),
  rock: snowyShape("rock", () => snowCapped(rockGeometry())),
  cliff: snowyShape("cliff", () => snowCapped(cliffGeometry(), 0.85)),
  pebbles: snowyShape("pebbles", () => snowCapped(pebblesGeometry())),
  bush: snowyShape("bush", () => snowCapped(bushGeometry(), 0.9)),
};

/**
 * The shore every island shares: palms along the top of the sand, and whatever the tide's left on
 * it. `inland` is how far past the top of the sand the palms may grow.
 */
export function buildShore(
  seed: number,
  map: SceneryMap,
  landing: Vec2,
  ground: (x: number, y: number) => number = homeHeight,
  inland = 5,
  shape: IslandShape = HOME_SHAPE,
  snowy = false,
): THREE.Group {
  const rng = createRng(seed + 29);
  const extent = shape.reach;
  const palms: PropInstance[] = [];
  sample(
    rng,
    4,
    (x, y) => {
      const sd = shape.shoreDistance(x, y);
      const top = shape.beachWidth(x, y);
      if (sd < top - 3 || sd > top + inland || map.room(x, y) < 2 || map.trail(x, y) < 4) return;
      if (rng() < 0.16) palms.push(item(rng, x, y, 0.85 + rng() * 0.4));
    },
    extent,
  );

  const root = new THREE.Group();
  root.add(
    chunked(snowy ? pineGeometry() : palmGeometry(), palms, true, swaying(false), ground),
    beachFinds(seed, map, landing, ground, shape),
  );
  return root;
}

let findShapes: ReturnType<typeof makeFindShapes> | null = null;

function makeFindShapes() {
  return {
    driftwood: driftwoodGeometry(),
    stars: [starfishGeometry(0xff7a45), starfishGeometry(0xe85a9a)] as const,
    shell: shellGeometry(),
    coconut: coconutGeometry(),
    seaweed: seaweedGeometry(),
    bottle: bottleGeometry(),
    crate: washedUpCrateGeometry(),
  };
}

/**
 * What's washed up on a beach just now, all one mesh so the lot is a single draw call. It changes
 * with the tide: rebuild it when `tideTurn` moves on.
 */
export function beachFinds(
  seed: number,
  map: SceneryMap,
  landing: Vec2,
  ground: (x: number, y: number) => number,
  shape: IslandShape,
  now = Date.now(),
): THREE.Mesh {
  findShapes ??= makeFindShapes();
  const shapes = findShapes;
  const pieces: THREE.BufferGeometry[] = [];
  const matrix = new THREE.Matrix4();
  const turn = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const spot = new THREE.Vector3();
  const put = (geometry: THREE.BufferGeometry, it: PropInstance, sink: number) => {
    turn.setFromAxisAngle(up, it.rotation);
    spot.set(it.x, Math.max(-0.4, ground(it.x, it.y)) + sink, it.y);
    pieces.push(geometry.clone().applyMatrix4(matrix.compose(spot, turn, it.scale)));
  };
  for (let lot = 0; lot < TIDE_LOTS; lot++) {
    const rng = createRng(Math.imul(seed + lot * 101, 31) + lotTide(seed, lot, now) * 7919);
    sample(
      rng,
      5,
      (x, y) => {
        const sd = shape.shoreDistance(x, y);
        if (sd < 0.6 || sd > shape.beachWidth(x, y) - 1 || map.room(x, y) < 2) return;
        if (Math.hypot(x - landing.x, y - landing.y) < 7) return;
        const roll = rng();
        const it = (size: number) => item(rng, x, y, size * (0.8 + rng() * 0.5));
        if (sd > 4 && roll < 0.03) put(shapes.driftwood, it(1), -0.05);
        else if (sd > 4 && roll < 0.04) put(shapes.crate, it(1), 0);
        else if (roll < 0.07) put(shapes.coconut, it(1), 0);
        else if (sd < 3 && roll < 0.11) put(shapes.seaweed, it(1.1), 0.01);
        else if (sd < 4 && roll < 0.125) put(shapes.bottle, it(1), 0);
        else if (sd < 4.5 && roll < 0.2) put(shapes.stars[rng() < 0.6 ? 0 : 1], it(1.1), 0.01);
        else if (roll < 0.27) put(shapes.shell, it(1), 0.01);
      },
      shape.reach,
    );
  }
  const mesh = new THREE.Mesh(
    pieces.length > 0 ? merge(pieces) : new THREE.BufferGeometry(),
    vertexColored(),
  );
  for (const piece of pieces) piece.dispose();
  mesh.name = BEACH_FINDS;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
