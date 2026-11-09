// The cloud round an island, the crew's and every raided one alike (homeClouds): the world map's
// clouds seen close up, one sheet clear over the island and reaching out to the edges of the view
// and wrapping round its sides, but kept off the beach in front of the camera.

import * as THREE from "three";
import { VIEW_YAW } from "../config";
import { HOME_SHAPE, type IslandShape } from "../logic/island";
import { cloudTile } from "./mapClouds";
import { SKY } from "./sky";

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
  /** Parts the cloud between the camera and a hero on the ground; null closes it again. */
  seeThrough(eye: THREE.Vector3, hero: THREE.Vector3 | null): void;
  dispose(): void;
}

/** The sheet over an island, in meters: wide enough to reach past any view of it. */
const HOME_SHEET = { size: 1400, height: 9 } as const;
/**
 * Clear this far past the coast, solid this far out, round every island alike. The cloud's drift
 * can bring it in closer, but never in over the land: the coast is always seen clean.
 */
const CLEAR_PAST = 4;
const SOLID_PAST = 28;
/** The gap it parts in where the camera looks down through it at a hero, in meters across. */
const SEE_THROUGH = 15;
/**
 * How square on to the camera a way out from the island has to be to count as the beach in front,
 * as the cosine of the angle between them: the cloud thins out over this whole span, the clearing
 * widening the further out it goes, so its edge is a soft, ragged one and never a straight line.
 */
const BEACH_CLEAR = [0.1, 0.9] as const;
/** The square the distances out to sea are baked over, in meters either way of the middle. */
const SEA_HALF = 200;
const SEA_SIZE = 256;
/** The furthest out to sea the bake holds, in meters: past it is all open sea alike. */
const SEA_FAR = 64;

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
 * the island's own coast, its edge bent in and out by a slow third look at the tile.
 */
const HOME_FRAGMENT = /* glsl */ `
  uniform sampler2D uTile;
  uniform sampler2D uSea;
  uniform vec2 uToCamera;
  uniform float uTime;
  uniform vec3 uUnlit;
  uniform vec3 uSee;
  varying vec2 vMap;
  void main() {
    vec2 p = vMap;
    vec2 wide = texture2D(uTile, p / 210.0 + vec2(uTime * 0.0021, uTime * 0.0008)).rg;
    vec2 near = texture2D(uTile, p / 96.0 - vec2(uTime * 0.0013, -uTime * 0.0024)).rg;
    float thick = smoothstep(0.12, 0.8, wide.r * 0.72 + near.r * 0.28);
    vec2 flow = texture2D(uTile, p.yx / 520.0 + vec2(uTime * 0.0011, -uTime * 0.0008)).rg - 0.5;
    // How far out to sea, straight to the nearest coast; past the bake it's all open sea.
    float sea = texture2D(uSea, p / ${2 * SEA_HALF}.0 + 0.5).r * ${SEA_FAR}.0;
    float out_ = sea + min((flow.x + flow.y) * 34.0, ${CLEAR_PAST}.0);
    // Nothing off the beach in front of the camera, at the bottom of the screen; round the sides
    // it comes in as close as anywhere else. The clearing grows with the distance out and wanders
    // with the cloud's own drift, so it fades away rather than stopping along a line.
    float facing = dot(normalize(p), uToCamera) + (flow.x - flow.y) * 0.6;
    out_ -= smoothstep(${BEACH_CLEAR[0]}, ${BEACH_CLEAR[1]}, facing) * (length(p) * 0.95 + 30.0);
    // Parted where the camera looks down through it at a hero, the same ragged way.
    if (uSee.z > 0.0) {
      float seen = length(p - uSee.xy) + (flow.x - flow.y) * uSee.z * 0.6;
      out_ -= (1.0 - smoothstep(uSee.z * 0.3, uSee.z, seen)) * 60.0;
    }
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

/**
 * How far out to sea every spot round an island is, straight to its nearest coast. Measuring out
 * from the middle instead would jump wherever a coast runs out that way, down the side of a
 * headland, and the cloud would stop dead along it. Land, and water shut in by it like a lagoon,
 * are 0: the cloud keeps off both.
 */
function seaTexture(shape: IslandShape): THREE.DataTexture {
  const cells = SEA_SIZE * SEA_SIZE;
  const out = new Float32Array(cells);
  for (let j = 0; j < SEA_SIZE; j++) {
    for (let i = 0; i < SEA_SIZE; i++) {
      const x = ((i + 0.5) / SEA_SIZE) * 2 * SEA_HALF - SEA_HALF;
      const y = ((j + 0.5) / SEA_SIZE) * 2 * SEA_HALF - SEA_HALF;
      out[j * SEA_SIZE + i] = Math.min(SEA_FAR, -shape.shoreDistance(x, y));
    }
  }
  // Open sea is whatever water the edge of the bake reaches without crossing land.
  const open = new Uint8Array(cells);
  const next: number[] = [];
  const reach = (k: number) => {
    if (open[k] || (out[k] ?? 0) <= 0) return;
    open[k] = 1;
    next.push(k);
  };
  for (let n = 0; n < SEA_SIZE; n++) {
    reach(n);
    reach(cells - 1 - n);
    reach(n * SEA_SIZE);
    reach(n * SEA_SIZE + SEA_SIZE - 1);
  }
  for (let k = next.pop(); k !== undefined; k = next.pop()) {
    const i = k % SEA_SIZE;
    if (i > 0) reach(k - 1);
    if (i < SEA_SIZE - 1) reach(k + 1);
    if (k >= SEA_SIZE) reach(k - SEA_SIZE);
    if (k < cells - SEA_SIZE) reach(k + SEA_SIZE);
  }
  const data = new Uint8Array(cells * 4);
  for (let k = 0; k < cells; k++) {
    data[k * 4] = open[k] ? Math.round(((out[k] ?? 0) / SEA_FAR) * 255) : 0;
    data[k * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, SEA_SIZE, SEA_SIZE);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The cloud over the sea round an island, the crew's or one being raided: one sheet, drawn in a
 * single call.
 */
export function homeClouds(shape: IslandShape = HOME_SHAPE): CloudView {
  const root = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(HOME_SHEET.size, HOME_SHEET.size);
  geometry.rotateX(-Math.PI / 2);
  const sea = seaTexture(shape);
  const time = { value: 0 };
  const see = { value: new THREE.Vector3() };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTile: { value: cloudTile() },
      uSea: { value: sea },
      // The camera always looks from the same side: this way, along the ground.
      uToCamera: { value: new THREE.Vector2(Math.sin(VIEW_YAW), Math.cos(VIEW_YAW)) },
      uTime: time,
      uUnlit: SKY.unlit,
      uSee: see,
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
    seeThrough(eye, hero) {
      // Where the line from the camera down to the hero crosses the sheet, if it does.
      const k = hero ? (eye.y - HOME_SHEET.height) / (eye.y - hero.y) : -1;
      if (!hero || k <= 0 || k >= 1) {
        see.value.z = 0;
        return;
      }
      see.value.set(eye.x + (hero.x - eye.x) * k, eye.z + (hero.z - eye.z) * k, SEE_THROUGH);
    },
    dispose() {
      geometry.dispose();
      sea.dispose();
      material.dispose();
    },
  };
}
