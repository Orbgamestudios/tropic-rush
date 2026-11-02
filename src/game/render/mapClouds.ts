// The cloud over the world map: one sheet, drawn in a single call however far the crew has come.
// Where the sky is clear is painted once into a small mask. Every patch is painted oversized and
// joined to its neighbor, then the mask is blurred and the shader draws the edge further in than
// it was painted: gaps too narrow to survive that close up, so the clear sky is one open stretch of
// sea with a smooth shore of cloud, not patches with strands of cloud left between islands. A new
// splotch dissolves open from the old mask to the new one.

import * as THREE from "three";
import type { SkyHole } from "../logic/worldMap";
import { NOISE_CELLS, noiseTexture } from "./noiseTexture";
import { SKY } from "./sky";

const MASK_WIDTH = 512;
const MASK_HEIGHT = 340;
/** How much sky the mask covers past the furthest splotch, in map units. */
const MASK_MARGIN = 70;
/** How far past its true edge each patch of sky is painted, and so the widest gap that closes. */
const GROW = 16;
/** Patches are joined by a band this wide at most, either side, in map units. */
const JOIN_WIDTH = 15;
/** The sheet follows the camera, and is always bigger than the view. */
const SHEET = { width: 1100, depth: 800, height: 6 } as const;
const LIFT_SECONDS = 2.6;

const VERTEX = /* glsl */ `
  varying vec2 vMap;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vMap = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMask;
  uniform sampler2D uBefore;
  uniform sampler2D uNoise;
  uniform vec4 uBox;
  uniform float uLift;
  uniform float uTime;
  uniform vec3 uUnlit;
  varying vec2 vMap;
  float noise(vec2 p) { return texture2D(uNoise, p / ${NOISE_CELLS.toFixed(1)}).r; }
  void main() {
    vec2 p = vMap;
    float large = noise(p * 0.05 + vec2(uTime * 0.012, 0.0));
    float middle = noise(p * 0.13 - vec2(0.0, uTime * 0.016));
    float small = noise(p * 0.34 + vec2(uTime * 0.02, -uTime * 0.01));
    float billow = large * 0.5 + middle * 0.33 + small * 0.17;
    vec2 uv = (p - uBox.xy) / uBox.zw + (vec2(large, middle) - 0.5) * 0.012;
    float before = texture2D(uBefore, uv).r;
    float now = texture2D(uMask, uv).r;
    // A new splotch tears open from its thin spots first.
    float clear = mix(before, now, smoothstep(billow - 0.25, billow + 0.25, uLift * 1.5 - 0.25));
    // The painted patches ran past their true edge, so the shore is drawn well inside them.
    float alpha = 1.0 - smoothstep(0.62, 0.86, clear + (billow - 0.5) * 0.14);
    if (alpha < 0.004) discard;
    // Bright where it billows up, blue-grey in the folds.
    float light = smoothstep(0.3, 0.68, billow) * 0.7 + smoothstep(0.42, 0.62, small) * 0.3;
    vec3 color = mix(vec3(0.66, 0.74, 0.86), vec3(1.0, 0.99, 0.97), light);
    gl_FragColor = vec4(color * uUnlit, alpha * 0.97);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function maskCanvas(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = MASK_WIDTH;
  canvas.height = MASK_HEIGHT;
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return { canvas, texture };
}

/** The nearest patch to this one that's closer to home. */
function nearerHome(hole: SkyHole, holes: readonly SkyHole[]): SkyHole | null {
  const away = Math.hypot(hole.x, hole.y);
  let best: SkyHole | null = null;
  let gap = Number.POSITIVE_INFINITY;
  for (const other of holes) {
    if (Math.hypot(other.x, other.y) >= away) continue;
    const d = Math.hypot(other.x - hole.x, other.y - hole.y);
    if (d < gap) {
      best = other;
      gap = d;
    }
  }
  return best;
}

/** Blurs a canvas by shrinking it and bringing it back: canvas filters don't work on iPhones. */
function soften(canvas: HTMLCanvasElement, by: number): void {
  const small = document.createElement("canvas");
  small.width = Math.ceil(canvas.width / by);
  small.height = Math.ceil(canvas.height / by);
  const s = small.getContext("2d");
  const g = canvas.getContext("2d");
  if (!s || !g) return;
  s.imageSmoothingQuality = "high";
  g.imageSmoothingQuality = "high";
  s.drawImage(canvas, 0, 0, small.width, small.height);
  g.drawImage(small, 0, 0, canvas.width, canvas.height);
}

export class MapClouds {
  readonly mesh: THREE.Mesh;
  private readonly now = maskCanvas();
  private readonly before = maskCanvas();
  private readonly box = new THREE.Vector4(0, 0, 1, 1);
  private readonly lift = { value: 1 };
  private readonly time = { value: 0 };
  private drawn: readonly SkyHole[] = [];

  constructor() {
    const geometry = new THREE.PlaneGeometry(SHEET.width, SHEET.depth);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: {
          uMask: { value: this.now.texture },
          uBefore: { value: this.before.texture },
          uNoise: { value: noiseTexture() },
          uBox: { value: this.box },
          uLift: this.lift,
          uTime: this.time,
          uUnlit: SKY.unlit,
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        // Over everything on the map, the islands' trees included.
        depthTest: false,
      }),
    );
    this.mesh.renderOrder = 5;
    this.mesh.frustumCulled = false;
  }

  private paint(canvas: HTMLCanvasElement, holes: readonly SkyHole[]): void {
    const g = canvas.getContext("2d");
    if (!g) return;
    const { x, y, z, w } = this.box;
    const sx = MASK_WIDTH / z;
    const sy = MASK_HEIGHT / w;
    g.fillStyle = "#000";
    g.fillRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
    g.fillStyle = "#fff";
    const spot = (cx: number, cy: number, radius: number) => {
      g.beginPath();
      g.ellipse((cx - x) * sx, (cy - y) * sy, radius * sx, radius * sy, 0, 0, Math.PI * 2);
      g.fill();
    };
    for (const hole of holes) spot(hole.x, hole.y, hole.radius + GROW);
    // Each patch reaches back towards home, so none is left cut off behind a band of cloud.
    for (const hole of holes) {
      const towards = nearerHome(hole, holes);
      if (!towards) continue;
      const gap = Math.hypot(towards.x - hole.x, towards.y - hole.y);
      const width = Math.min(JOIN_WIDTH, hole.radius, towards.radius) + GROW;
      for (let along = 0; along < gap; along += width / 2) {
        const t = along / gap;
        spot(hole.x + (towards.x - hole.x) * t, hole.y + (towards.y - hole.y) * t, width);
      }
    }
    soften(canvas, Math.max(2, Math.round(GROW * sx)));
  }

  /** Paints the sky as it stands. With `animate`, whatever's new dissolves open. */
  setSky(holes: readonly SkyHole[], animate: boolean): void {
    const west = Math.min(...holes.map((h) => h.x - h.radius)) - MASK_MARGIN;
    const east = Math.max(...holes.map((h) => h.x + h.radius)) + MASK_MARGIN;
    const north = Math.min(...holes.map((h) => h.y - h.radius)) - MASK_MARGIN;
    const south = Math.max(...holes.map((h) => h.y + h.radius)) + MASK_MARGIN;
    this.box.set(west, north, east - west, south - north);
    this.paint(this.before.canvas, animate ? this.drawn : holes);
    this.paint(this.now.canvas, holes);
    // Canvases read top row first, where the mask wants its first row: no flip.
    this.now.texture.flipY = false;
    this.before.texture.flipY = false;
    this.now.texture.needsUpdate = true;
    this.before.texture.needsUpdate = true;
    this.drawn = holes;
    this.lift.value = animate ? 0 : 1;
  }

  update(time: number, dt: number, x: number, z: number): void {
    this.time.value = time;
    this.mesh.position.set(x, SHEET.height, z);
    if (this.lift.value < 1) this.lift.value = Math.min(1, this.lift.value + dt / LIFT_SECONDS);
  }
}
