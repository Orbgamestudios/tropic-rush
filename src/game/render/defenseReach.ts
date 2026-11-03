// How far each enemy defense can shoot, in the middle of a fight: a thin line of its own along the
// ground, and only the stretch of it near the hero, which fades in as they come up to it. Nothing is
// filled in, so however many guns overlap they stay lines and the base can still be seen. The lines
// are ribbons that follow the land, all in one mesh, so a base full of guns is a single draw call.

import * as THREE from "three";
import { BUILDINGS } from "../logic/buildings";
import type { RaidBuilding, RaidHero, RaidState } from "../logic/raid";
import { distance } from "../logic/vec";
import { overlayOpacity } from "./sky";

/** The line starts to show from this far outside a defense's reach, in meters. */
const FADE_DISTANCE = 8;
/** The line shows fully this far from the hero, in meters, and has gone by the second distance. */
const NEAR_METERS = 5;
const FAR_METERS = 12;
/** How wide a line is, and how long each straight piece of it, in meters. */
const LINE_WIDTH = 0.5;
const PIECE = 1.5;
const LIFT = 0.3;

const VERTEX = /* glsl */ `
  attribute vec2 aCenter;
  attribute float aRange;
  attribute float aAcross;
  attribute float aSniper;
  attribute float aStanding;
  uniform float uDim;
  uniform vec2 uHero;
  varying float vAcross;
  varying float vAlpha;
  varying float vSniper;
  void main() {
    vAcross = aAcross;
    vSniper = aSniper;
    float outside = length(uHero - aCenter) - aRange;
    float fade = clamp(1.0 - outside / ${FADE_DISTANCE.toFixed(1)}, 0.0, 1.0);
    float near = 1.0 - smoothstep(${NEAR_METERS.toFixed(1)}, ${FAR_METERS.toFixed(1)}, length(position.xz - uHero));
    vAlpha = fade * near * aStanding * uDim;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAcross;
  varying float vAlpha;
  varying float vSniper;
  void main() {
    float line = smoothstep(0.0, 0.3, vAcross) * (1.0 - smoothstep(0.7, 1.0, vAcross));
    vec3 color = mix(vec3(1.0, 0.3, 0.2), vec3(1.0, 0.68, 0.2), vSniper);
    gl_FragColor = vec4(color, line * vAlpha * 0.7);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface Reach {
  building: RaidBuilding;
  range: number;
  /** Where its vertices are, to rub it out when it falls. */
  from: number;
  to: number;
  standing: boolean;
}

export class DefenseReach {
  readonly mesh: THREE.Mesh;
  private readonly reaches: Reach[] = [];
  private readonly standing: THREE.BufferAttribute;
  private readonly hero = new THREE.Vector2();
  private readonly dim = { value: 1 };

  constructor(state: RaidState) {
    const positions: number[] = [];
    const centers: number[] = [];
    const ranges: number[] = [];
    const across: number[] = [];
    const snipers: number[] = [];
    const index: number[] = [];
    const ring = (b: RaidBuilding, radius: number, range: number, sniper: number) => {
      const pieces = Math.max(24, Math.ceil((Math.PI * 2 * radius) / PIECE));
      for (let i = 0; i <= pieces; i++) {
        const angle = (i / pieces) * Math.PI * 2;
        for (const side of [0, 1]) {
          const r = radius - side * LINE_WIDTH;
          const x = b.pos.x + Math.cos(angle) * r;
          const z = b.pos.y + Math.sin(angle) * r;
          positions.push(x, Math.max(0, state.shape.height(x, z)) + LIFT, z);
          centers.push(b.pos.x, b.pos.y);
          ranges.push(range);
          across.push(side);
          snipers.push(sniper);
        }
        if (i === pieces) break;
        const at = positions.length / 3 - 2;
        index.push(at, at + 1, at + 2, at + 1, at + 3, at + 2);
      }
    };
    for (const b of state.buildings) {
      const attack = BUILDINGS[b.type].attack;
      if (!attack) continue;
      const from = positions.length / 3;
      const sniper = attack.kind === "sniper" ? 1 : 0;
      ring(b, attack.range, attack.range, sniper);
      // A mortar can't hit anything inside its blind spot, which has an edge of its own.
      if (attack.kind === "mortar") ring(b, attack.minRange, attack.range, sniper);
      this.reaches.push({
        building: b,
        range: attack.range,
        from,
        to: positions.length / 3,
        standing: true,
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aCenter", new THREE.Float32BufferAttribute(centers, 2));
    geometry.setAttribute("aRange", new THREE.Float32BufferAttribute(ranges, 1));
    geometry.setAttribute("aAcross", new THREE.Float32BufferAttribute(across, 1));
    geometry.setAttribute("aSniper", new THREE.Float32BufferAttribute(snipers, 1));
    this.standing = new THREE.Float32BufferAttribute(new Float32Array(ranges.length).fill(1), 1);
    geometry.setAttribute("aStanding", this.standing);
    geometry.setIndex(index);
    this.mesh = new THREE.Mesh(
      geometry,
      // Laid over hills and rooftops alike, so it ignores the depth of what's under it.
      new THREE.ShaderMaterial({
        uniforms: { uHero: { value: this.hero }, uDim: this.dim },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  update(hero: RaidHero | undefined): void {
    let near = false;
    this.dim.value = overlayOpacity();
    for (const reach of this.reaches) {
      if (reach.standing && reach.building.destroyed) {
        reach.standing = false;
        (this.standing.array as Float32Array).fill(0, reach.from, reach.to);
        this.standing.needsUpdate = true;
      }
      if (!hero || !reach.standing) continue;
      near ||= distance(hero.pos, reach.building.pos) - reach.range < FADE_DISTANCE;
    }
    if (hero) this.hero.set(hero.pos.x, hero.pos.y);
    this.mesh.visible = near && (hero?.alive ?? false);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
