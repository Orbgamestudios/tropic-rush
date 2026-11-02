// A few fireflies over the land after dark, blinking on and off as they wander. They're one draw
// call of tiny quads, moved entirely in the vertex shader, so they cost no work per frame, and by
// day they aren't drawn at all.

import * as THREE from "three";
import { createRng } from "../logic/rng";
import { SKY } from "./sky";

/** Spread over a whole island: only a handful are in view, and fewer lit at any moment. */
const COUNT = 110;
const SPREAD = 85;
/** How much dark it takes for them to come out. */
const SHOW_FROM = 0.45;
/** Ground this high counts as land, not sea. */
const LAND = 0.5;

const VERTEX = /* glsl */ `
  attribute vec4 iSpot;
  uniform float uTime;
  uniform float uDark;
  varying vec2 vUv;
  varying float vGlow;
  void main() {
    float seed = iSpot.w;
    float t = uTime * 0.35 + seed;
    vec3 wander = vec3(
      sin(t) + 0.6 * sin(t * 2.3 + seed),
      0.45 * sin(t * 1.7 + seed * 2.0),
      cos(t * 0.8) + 0.6 * cos(t * 1.9 + seed)
    ) * 1.5;
    float blink = sin(uTime * (0.9 + fract(seed) * 0.7) + seed * 7.0);
    vGlow = smoothstep(0.3, 0.9, blink) * min(uDark, 1.0);
    vUv = position.xy * 2.0;
    vec4 view = viewMatrix * vec4(iSpot.xyz + wander, 1.0);
    // Unlit ones shrink to nothing, so they fill no pixels.
    view.xy += position.xy * step(0.01, vGlow) * 0.9;
    gl_Position = projectionMatrix * view;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying float vGlow;
  void main() {
    float a = max(0.0, 1.0 - dot(vUv, vUv));
    float halo = a * a * a;
    float core = halo * halo * halo * halo;
    gl_FragColor = vec4(vec3(0.72, 1.0, 0.28) * vGlow * (halo * 0.45 + core * 2.4), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Fireflies {
  readonly mesh: THREE.Mesh;
  private readonly time = { value: 0 };

  constructor(seed: number, groundAt: (x: number, z: number) => number) {
    const rng = createRng(seed + 919);
    const spots = new Float32Array(COUNT * 4);
    let placed = 0;
    for (let tries = 0; tries < COUNT * 6 && placed < COUNT; tries++) {
      const x = (rng() - 0.5) * 2 * SPREAD;
      const z = (rng() - 0.5) * 2 * SPREAD;
      const ground = groundAt(x, z);
      if (ground < LAND) continue;
      spots.set([x, ground + 1 + rng() * 1.8, z, rng() * 100], placed * 4);
      placed++;
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute("position", quad.getAttribute("position"));
    geometry.setAttribute("iSpot", new THREE.InstancedBufferAttribute(spots, 4));
    geometry.instanceCount = placed;
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: { uTime: this.time, uDark: SKY.dark },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.visible = false;
  }

  update(time: number): void {
    this.mesh.visible = SKY.dark.value >= SHOW_FROM;
    this.time.value = time;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
