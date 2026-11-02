// The cloud over the world map: one sheet, drawn in a single call however far the crew has come.
// Where the sky is clear is painted once into a small mask, and the shader tears the edges of it
// with noise, so splotches of open sea have soft, wandering coasts of cloud rather than corners.
// A new splotch dissolves open from the old mask to the new one.

import * as THREE from "three";
import type { SkyHole } from "../logic/worldMap";
import { NOISE_CELLS, noiseTexture } from "./noiseTexture";
import { SKY } from "./sky";

const MASK_WIDTH = 512;
const MASK_HEIGHT = 340;
/** How much sky the mask covers past the furthest splotch, in map units. */
const MASK_MARGIN = 70;
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
    vec2 uv = (p - uBox.xy) / uBox.zw + (vec2(middle, large) - 0.5) * 0.035;
    float before = texture2D(uBefore, uv).r;
    float now = texture2D(uMask, uv).r;
    // A new splotch tears open from its thin spots first.
    float clear = mix(before, now, smoothstep(billow - 0.25, billow + 0.25, uLift * 1.5 - 0.25));
    float alpha = 1.0 - smoothstep(0.3, 0.62, clear + (billow - 0.5) * 0.7);
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
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#000";
    g.fillRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
    g.globalCompositeOperation = "lighter";
    for (const hole of holes) {
      const cx = (hole.x - x) * sx;
      const cy = (hole.y - y) * sy;
      // Drawn as a circle and stretched, since the mask isn't square to the map.
      g.save();
      g.translate(cx, cy);
      g.scale(sx, sy);
      const glow = g.createRadialGradient(0, 0, hole.radius * 0.6, 0, 0, hole.radius * 1.12);
      glow.addColorStop(0, "#fff");
      glow.addColorStop(1, "#000");
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, 0, hole.radius * 1.12, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
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
