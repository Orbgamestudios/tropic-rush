// Soft banks of mist drifting low over the sea around an island, so the edges of the view fade
// into white puffs the way the beach mockup does. They stay off the landing beach's side so they
// never hide the gunboat. Every puff is a quad tilted towards the camera, all merged into one
// mesh: one draw call for the lot. The crew's own island has a sheet instead (homeClouds): the
// world map's clouds seen close up, clear over the island and reaching out to the edges of the
// view and wrapping round its sides, but kept off the beach in front of the camera.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { VIEW_YAW } from "../config";
import { HOME_SHAPE, type IslandShape } from "../logic/island";
import { createRng } from "../logic/rng";
import { cloudTile } from "./mapClouds";
import { SKY } from "./sky";

const PUFFS = 170;
/** Keeps the biggest puffs off the land, so they never cover a fight on a thin island. */
const OFF_THE_COAST = 14;

export function cloudTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    // A puffy cluster of soft white blobs.
    const puffs: [number, number, number][] = [
      [0.5, 0.55, 0.3],
      [0.32, 0.6, 0.22],
      [0.68, 0.6, 0.22],
      [0.42, 0.42, 0.2],
      [0.6, 0.42, 0.18],
      [0.2, 0.66, 0.14],
      [0.8, 0.66, 0.14],
    ];
    for (const [x, y, r] of puffs) {
      const grad = g.createRadialGradient(x * size, y * size, 0, x * size, y * size, r * size);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      grad.addColorStop(0.55, "rgba(246, 250, 255, 0.65)");
      grad.addColorStop(1, "rgba(225, 236, 248, 0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x * size, y * size, r * size, 0, Math.PI * 2);
      g.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface CloudView {
  root: THREE.Group;
  update(time: number): void;
  dispose(): void;
}

/** How far out from the middle the island's coast lies along a line, in meters. */
function coastAlong(shape: IslandShape, angle: number): number {
  for (let r = shape.reach; r > 0; r -= 3) {
    if (shape.shoreDistance(Math.cos(angle) * r, Math.sin(angle) * r) > 0) return r;
  }
  return 30;
}

export function buildClouds(seed: number, shape: IslandShape = HOME_SHAPE): CloudView {
  const root = new THREE.Group();
  const texture = cloudTexture();
  const rng = createRng(seed + 404);
  const quads: THREE.BufferGeometry[] = [];
  for (let i = 0; i < PUFFS * 3 && quads.length < PUFFS; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = coastAlong(shape, angle) + OFF_THE_COAST + rng() * 30;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (shape.beachSide(x, y) > 0.12) continue;
    const size = 11 + rng() * 15;
    const quad = new THREE.PlaneGeometry(size, size * 0.62);
    // Lean back and turn to face the camera, about 40 degrees up at the diamond angle.
    quad.rotateX(-0.75);
    quad.rotateY(VIEW_YAW);
    quad.translate(x, 2 + rng() * 2.5, y);
    quads.push(quad);
  }
  const geometry = mergeGeometries(quads, false);
  for (const q of quads) q.dispose();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    fog: false,
    opacity: 0.9,
  });
  material.color = SKY.unlit.value;
  const mesh = new THREE.Mesh(geometry ?? new THREE.BufferGeometry(), material);
  mesh.renderOrder = 5;
  root.add(mesh);
  return {
    root,
    update(time) {
      // The banks drift slowly back and forth along the coast and rise and fall a little.
      root.rotation.y = Math.sin(time * 0.02) * 0.03;
      root.position.y = Math.sin(time * 0.3) * 0.2;
    },
    dispose() {
      geometry?.dispose();
      texture.dispose();
      material.dispose();
    },
  };
}

/** The sheet over the crew's island, in meters: wide enough to reach past any view of it. */
const HOME_SHEET = { size: 1400, height: 9 } as const;
/** Clear this far past the coast, solid this far out: the beach and the gunboat stay in the open. */
const CLEAR_PAST = 4;
const SOLID_PAST = 28;
/** How much further out the cloud keeps off the beach in front of the camera, at the bottom of the screen. */
const CAMERA_SIDE_CLEAR = 600;
/**
 * How square on to the camera a way out from the island has to be to count as the beach in front:
 * the cloud fades out over this, as the cosine of the angle between them.
 */
const BEACH_CLEAR = [0.5, 0.8] as const;
/** The furthest coast the bake of the island's outline can hold, in meters. */
const OUTLINE_REACH = 220;

const HOME_VERTEX = /* glsl */ `
  varying vec2 vMap;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vMap = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * The map's cloud, closer: the same baked tile at three times the size, with the clear sky round
 * the island's own outline, its edge bent in and out by a slow third look at the tile.
 */
const HOME_FRAGMENT = /* glsl */ `
  uniform sampler2D uTile;
  uniform sampler2D uCoast;
  uniform vec2 uToCamera;
  uniform float uTime;
  uniform vec3 uUnlit;
  varying vec2 vMap;
  void main() {
    vec2 p = vMap;
    vec2 wide = texture2D(uTile, p / 210.0 + vec2(uTime * 0.0021, uTime * 0.0008)).rg;
    vec2 near = texture2D(uTile, p / 96.0 - vec2(uTime * 0.0013, -uTime * 0.0024)).rg;
    float thick = smoothstep(0.12, 0.8, wide.r * 0.72 + near.r * 0.28);
    vec2 flow = texture2D(uTile, p.yx / 520.0 + vec2(uTime * 0.0011, -uTime * 0.0008)).rg - 0.5;
    float angle = atan(p.y, p.x) / 6.2831853 + 0.5;
    float coast = texture2D(uCoast, vec2(angle, 0.5)).r * ${OUTLINE_REACH}.0;
    float out_ = length(p) + (flow.x + flow.y) * 34.0 - coast;
    // Nothing off the beach in front of the camera, at the bottom of the screen; round the sides
    // it comes in as close as anywhere else.
    out_ -= smoothstep(${BEACH_CLEAR[0]}, ${BEACH_CLEAR[1]}, dot(normalize(p), uToCamera)) * ${CAMERA_SIDE_CLEAR}.0;
    float cover = smoothstep(${CLEAR_PAST}.0, ${SOLID_PAST}.0, out_);
    // Deep in the bank it's solid, and towards the clear sky only the thickest puffs stay.
    float edge = 1.02 - cover * 1.5;
    float alpha = smoothstep(edge, edge + 0.52, thick);
    if (alpha < 0.004) discard;
    vec3 cloud = mix(vec3(0.44, 0.54, 0.74), vec3(1.0, 0.995, 0.98), smoothstep(0.34, 0.92, wide.g));
    gl_FragColor = vec4(cloud * uUnlit, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The island's coast all the way round, as a strip of texture: how far out it lies each way. */
function coastStrip(shape: IslandShape): THREE.DataTexture {
  const steps = 256;
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps - 0.5) * Math.PI * 2;
    const reach = Math.min(1, coastAlong(shape, angle) / OUTLINE_REACH);
    data[i * 4] = Math.round(reach * 255);
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, steps, 1);
  texture.wrapS = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** The cloud over the sea round the crew's island: one sheet, drawn in a single call. */
export function homeClouds(shape: IslandShape = HOME_SHAPE): CloudView {
  const root = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(HOME_SHEET.size, HOME_SHEET.size);
  geometry.rotateX(-Math.PI / 2);
  const coast = coastStrip(shape);
  const time = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTile: { value: cloudTile() },
      uCoast: { value: coast },
      // The camera always looks from the same side: this way, along the ground.
      uToCamera: { value: new THREE.Vector2(Math.sin(VIEW_YAW), Math.cos(VIEW_YAW)) },
      uTime: time,
      uUnlit: SKY.unlit,
    },
    vertexShader: HOME_VERTEX,
    fragmentShader: HOME_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = HOME_SHEET.height;
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;
  root.add(mesh);
  return {
    root,
    update(seconds) {
      time.value = seconds;
    },
    dispose() {
      geometry.dispose();
      coast.dispose();
      material.dispose();
    },
  };
}
