// The cloud over the world map: one sheet, drawn in a single call however far the crew has come.
// Its look comes from a tile baked ahead of time by scripts/make-clouds.mjs, puffs and all, already
// lit by the sun, so the phone only looks it up: twice, at two sizes, drifting past each other.
// Where the sky is clear is painted once into a small mask. Every patch is painted oversized and
// joined to its neighbor, then the mask is blurred and the shader draws the edge further in than
// it was painted: gaps too narrow to survive that close up, so the clear sky is one open stretch of
// sea, not patches with strands of cloud left between islands. Towards that edge only the thickest
// puffs are left, so the deck breaks up the way real cloud does, and throws a shadow on the sea. A
// new splotch dissolves open from the old mask to the new one.

import * as THREE from "three";
import type { SkyHole } from "../logic/worldMap";
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
/** How far the cloud's shadow falls from it on the sea, in map units. */
const SHADOW_FALLS = { x: 16, y: 21 } as const;

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
  uniform sampler2D uTile;
  uniform vec4 uBox;
  uniform float uLift;
  uniform float uTime;
  uniform vec3 uUnlit;
  varying vec2 vMap;
  void main() {
    vec2 p = vMap;
    vec2 wide = texture2D(uTile, p / 130.0 + vec2(uTime * 0.0035, uTime * 0.0012)).rg;
    vec2 near = texture2D(uTile, p / 47.0 - vec2(uTime * 0.0026, -uTime * 0.0048)).rg;
    float thick = smoothstep(0.3, 0.74, wide.r * 0.62 + near.r * 0.38);
    float lit = wide.g * 0.55 + near.g * 0.45;
    vec2 uv = (p - uBox.xy) / uBox.zw + (vec2(wide.r, near.r) - 0.5) * 0.02;
    float before = texture2D(uBefore, uv).r;
    float now = texture2D(uMask, uv).r;
    // A new splotch tears open from its thin spots first.
    float clear = mix(before, now, smoothstep(thick - 0.25, thick + 0.25, uLift * 1.5 - 0.25));
    // The painted patches ran past their true edge, so the shore is drawn well inside them. Deep in
    // the bank it's solid, and towards the edge only the thickest puffs stay.
    float cover = 1.0 - smoothstep(0.32, 0.92, clear);
    float edge = 1.06 - cover * 1.9;
    float alpha = smoothstep(edge, edge + 0.28, thick);
    float under = texture2D(uMask, uv + vec2(${SHADOW_FALLS.x}.0, ${SHADOW_FALLS.y}.0) / uBox.zw).r;
    float shadow = (1.0 - smoothstep(0.45, 0.9, under)) * 0.22 * (1.0 - alpha);
    if (alpha + shadow < 0.004) discard;
    // Bright on the sun's side of each puff, blue-grey in the hollows.
    vec3 cloud = mix(vec3(0.54, 0.62, 0.78), vec3(1.0, 0.995, 0.98), smoothstep(0.6, 0.92, lit));
    vec3 color = mix(vec3(0.02, 0.1, 0.2), cloud * uUnlit, alpha);
    gl_FragColor = vec4(color, alpha + shadow);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

let tile: THREE.Texture | null = null;

function cloudTile(): THREE.Texture {
  if (tile) return tile;
  tile = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/map-clouds.webp`);
  tile.wrapS = THREE.RepeatWrapping;
  tile.wrapT = THREE.RepeatWrapping;
  return tile;
}

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
          uTile: { value: cloudTile() },
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
