// The aim display: a single soft cone on the ground while the player drags the aim stick (as
// wide as the hero's shot spread and as long as their range, with bright edges), a white
// crosshair ring on the building that letting go would lock onto, and an orange one on the
// building the hero is locked onto and firing at.

import * as THREE from "three";
import { HEROES, type HeroKind, shotSpread } from "../logic/heroes";
import { lockCandidate, patientCandidate, type RaidHero, type RaidState } from "../logic/raid";
import { angleOf, type Vec2 } from "../logic/vec";

/** The cone never draws narrower than this either side, so a precise rifle still shows. */
const MIN_HALF_ANGLE = 0.07;

const CONE_VERTEX = /* glsl */ `
  uniform float uHalf;
  varying float vRadius;
  varying float vSide;
  void main() {
    vRadius = length(position.xy);
    vSide = abs(atan(position.y, position.x)) / uHalf;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CONE_FRAGMENT = /* glsl */ `
  uniform float uLength;
  uniform float uTime;
  varying float vRadius;
  varying float vSide;
  void main() {
    float r = vRadius / uLength;
    // A soft fill that brightens towards the far edge, with crisp bright rims on every side.
    float fill = 0.1 + 0.22 * smoothstep(0.2, 1.0, r);
    float rim = max(smoothstep(0.9, 1.0, vSide), smoothstep(0.965, 0.995, r));
    float sweep = smoothstep(0.08, 0.0, abs(fract(r - uTime * 0.9) - 0.5) - 0.42) * 0.12;
    float alpha = (fill + rim * 0.75 + sweep) * smoothstep(0.0, 0.12, r);
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;

function crosshairTexture(color: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const c = size / 2;
    g.strokeStyle = color;
    g.lineCap = "round";
    g.shadowColor = "rgba(0,0,0,0.45)";
    g.shadowBlur = 6;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(c, c, c * 0.72, 0, Math.PI * 2);
    g.stroke();
    // Four ticks pointing in.
    g.lineWidth = 8;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * c * 0.95, c + Math.sin(a) * c * 0.95);
      g.lineTo(c + Math.cos(a) * c * 0.5, c + Math.sin(a) * c * 0.5);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function marker(color: string): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({
      map: crosshairTexture(color),
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 9;
  m.visible = false;
  return m;
}

export class AimView {
  readonly root = new THREE.Group();
  private cone: THREE.Mesh | null = null;
  private coneKind: HeroKind | null = null;
  private readonly material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: { uHalf: { value: 0.1 }, uLength: { value: 10 }, uTime: { value: 0 } },
    vertexShader: CONE_VERTEX,
    fragmentShader: CONE_FRAGMENT,
  });
  private readonly candidate = marker("#ffffff");
  private readonly locked = marker("#ff8a3a");

  constructor() {
    this.root.add(this.candidate, this.locked);
  }

  update(
    state: RaidState,
    hero: RaidHero | undefined,
    preview: Vec2 | null,
    ground: (x: number, y: number) => number,
    time: number,
  ): void {
    const active = hero?.alive && !hero.inBoat;
    if (!hero || !active) {
      if (this.cone) this.cone.visible = false;
      this.candidate.visible = false;
      this.locked.visible = false;
      return;
    }
    if (this.coneKind !== hero.kind) this.buildCone(hero.kind);
    const cone = this.cone;
    const y = ground(hero.pos.x, hero.pos.y) + 0.12;
    (this.material.uniforms.uTime as THREE.IUniform<number>).value = time;

    if (cone) {
      cone.visible = preview !== null;
      if (preview) {
        cone.position.set(hero.pos.x, y, hero.pos.y);
        cone.rotation.set(-Math.PI / 2, 0, -angleOf(preview));
      }
    }

    if (HEROES[hero.kind].attack.kind === "heal") {
      this.markPatients(state, hero, preview, ground, time);
      return;
    }
    // Which building letting go would lock onto.
    const next = preview ? lockCandidate(state, hero, preview) : null;
    this.place(this.candidate, next, ground, time, false);
    const target =
      hero.targetId === null ? null : state.buildings.find((b) => b.id === hero.targetId);
    this.place(this.locked, target && !target.destroyed ? target : null, ground, time, true);
    if (next && target && next.id === target.id) this.candidate.visible = false;
  }

  /** The same two rings for a medic, on crewmates instead of buildings. */
  private markPatients(
    state: RaidState,
    hero: RaidHero,
    preview: Vec2 | null,
    ground: (x: number, y: number) => number,
    time: number,
  ): void {
    const ringFor = (h: RaidHero | null | undefined) =>
      h ? { pos: h.pos, radius: HEROES[h.kind].radius } : null;
    const next = preview ? patientCandidate(state, hero, preview) : null;
    this.place(this.candidate, ringFor(next), ground, time, false);
    const patient = state.heroes.find((h) => h.id === hero.patientId && h.alive);
    this.place(this.locked, ringFor(patient), ground, time, true);
    if (next && next === patient) this.candidate.visible = false;
  }

  private place(
    m: THREE.Mesh,
    b: { pos: Vec2; radius: number } | null | undefined,
    ground: (x: number, y: number) => number,
    time: number,
    spin: boolean,
  ): void {
    m.visible = !!b;
    if (!b) return;
    const pulse = 1 + Math.sin(time * 6) * 0.05;
    m.position.set(b.pos.x, ground(b.pos.x, b.pos.y) + 0.15, b.pos.y);
    m.scale.setScalar((b.radius + 0.9) * pulse);
    m.rotation.z = spin ? time * 1.2 : 0;
  }

  private buildCone(kind: HeroKind): void {
    if (this.cone) {
      this.root.remove(this.cone);
      this.cone.geometry.dispose();
    }
    const half = Math.max(MIN_HALF_ANGLE, shotSpread(kind));
    const range = HEROES[kind].attack.range;
    // A fan in the XY plane centered on +x; the mesh is laid flat and turned to the aim.
    const geometry = new THREE.CircleGeometry(range, 40, -half, half * 2);
    (this.material.uniforms.uHalf as THREE.IUniform<number>).value = half;
    (this.material.uniforms.uLength as THREE.IUniform<number>).value = range;
    this.cone = new THREE.Mesh(geometry, this.material);
    this.cone.renderOrder = 8;
    this.cone.visible = false;
    this.root.add(this.cone);
    this.coneKind = kind;
  }

  dispose(): void {
    this.cone?.geometry.dispose();
    this.material.dispose();
    for (const m of [this.candidate, this.locked]) {
      m.geometry.dispose();
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
  }
}
