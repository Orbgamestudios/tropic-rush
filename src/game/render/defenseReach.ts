// How far each enemy defense can shoot: a thin red line on the ground, only the stretch of it near
// the hero, so it warns of the edge without covering the base in red. It fades in as they near it
// and out as they leave. All of them are one instanced mesh, so a base full of guns is a single
// draw call, and defenses nowhere near the hero cost nothing.

import * as THREE from "three";
import { BUILDINGS } from "../logic/buildings";
import { terrainHeight } from "../logic/island";
import type { RaidBuilding, RaidHero, RaidState } from "../logic/raid";
import { distance } from "../logic/vec";

/** The line starts to show from this far outside a defense's reach, in meters. */
const FADE_DISTANCE = 8;
/** Seconds to fade in or out. */
const FADE_SECONDS = 0.4;
/** The line shows fully this far from the hero, in meters, and has gone by the second distance. */
const NEAR_METERS = 5;
const FAR_METERS = 12;
/** How far in from the line its faint glow reaches, in meters. */
const GLOW_WIDTH = 2.5;

const VERTEX = /* glsl */ `
  attribute float aFade;
  attribute float aInner;
  attribute float aRange;
  varying vec2 vPlace;
  varying vec2 vWorld;
  varying float vFade;
  varying float vInner;
  varying float vRange;
  void main() {
    vPlace = position.xz;
    vFade = aFade;
    vInner = aInner;
    vRange = aRange;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec2 uHero;
  varying vec2 vPlace;
  varying vec2 vWorld;
  varying float vFade;
  varying float vInner;
  varying float vRange;
  void main() {
    float r = length(vPlace);
    // Meters in from the edge of the defense's reach.
    float inside = (1.0 - r) * vRange;
    float line = smoothstep(0.0, 0.12, inside) * (1.0 - smoothstep(0.3, 0.55, inside));
    float glow = (1.0 - smoothstep(0.0, ${GLOW_WIDTH.toFixed(1)}, inside)) * step(0.0, inside);
    // Only the stretch of it near the hero shows.
    float near = 1.0 - smoothstep(${NEAR_METERS.toFixed(1)}, ${FAR_METERS.toFixed(1)}, length(vWorld - uHero));
    float blind = 1.0 - smoothstep(vInner - 0.012, vInner, r);
    float alpha = (line * 0.5 + glow * 0.1) * near * (1.0 - blind);
    gl_FragColor = vec4(1.0, 0.3, 0.2, alpha * vFade);
  }
`;

interface Reach {
  building: RaidBuilding;
  range: number;
  fade: number;
}

export class DefenseReach {
  readonly mesh: THREE.InstancedMesh;
  private readonly fades: Float32Array;
  private readonly fadeAttribute: THREE.InstancedBufferAttribute;
  private readonly reaches: Reach[] = [];
  private readonly hero = new THREE.Vector2();

  constructor(state: RaidState) {
    const defenses = state.buildings.filter((b) => BUILDINGS[b.type].attack);
    const geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.fades = new Float32Array(defenses.length);
    this.fadeAttribute = new THREE.InstancedBufferAttribute(this.fades, 1);
    this.fadeAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aFade", this.fadeAttribute);
    const inner = new Float32Array(defenses.length);
    const ranges = new Float32Array(defenses.length);
    this.mesh = new THREE.InstancedMesh(
      geometry,
      // Laid flat over hills and rooftops alike, so it ignores the depth of what's under it.
      new THREE.ShaderMaterial({
        uniforms: { uHero: { value: this.hero } },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
      Math.max(1, defenses.length),
    );
    const matrix = new THREE.Matrix4();
    defenses.forEach((b, i) => {
      const attack = BUILDINGS[b.type].attack;
      if (!attack) return;
      const { range } = attack;
      // A mortar can't hit anything inside its blind spot, so the circle leaves that out.
      inner[i] = attack.kind === "mortar" ? attack.minRange / range : 0;
      ranges[i] = range;
      matrix.makeScale(range, 1, range);
      matrix.setPosition(b.pos.x, Math.max(0, terrainHeight(b.pos.x, b.pos.y)) + 0.3, b.pos.y);
      this.mesh.setMatrixAt(i, matrix);
      this.reaches.push({ building: b, range, fade: 0 });
    });
    geometry.setAttribute("aInner", new THREE.InstancedBufferAttribute(inner, 1));
    geometry.setAttribute("aRange", new THREE.InstancedBufferAttribute(ranges, 1));
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  update(hero: RaidHero | undefined, dt: number): void {
    let any = false;
    const step = dt / FADE_SECONDS;
    if (hero) this.hero.set(hero.pos.x, hero.pos.y);
    this.reaches.forEach((reach, i) => {
      const { building } = reach;
      let wanted = 0;
      if (hero?.alive && !building.destroyed) {
        // Well inside, the line is too far off to matter; the falloff round the hero hides it.
        const outside = distance(hero.pos, building.pos) - reach.range;
        wanted = Math.max(0, Math.min(1, 1 - outside / FADE_DISTANCE));
      }
      if (reach.fade === wanted) {
        any ||= wanted > 0;
        return;
      }
      const gap = wanted - reach.fade;
      reach.fade += Math.sign(gap) * Math.min(Math.abs(gap), step);
      this.fades[i] = reach.fade;
      this.fadeAttribute.needsUpdate = true;
      any ||= reach.fade > 0;
    });
    this.mesh.visible = any;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
