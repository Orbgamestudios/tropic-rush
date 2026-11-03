// The aim display: a soft cone on the ground while the player drags the aim stick (as wide as the
// hero's shot spread and as long as their range, dimming when there's nothing in it to lock onto),
// and a reticle that shows what's being aimed at. A white one hovers on the building that letting
// go would lock onto. On a lock, an orange one snaps in over it, kicks with every hit, and bursts
// off the building as it falls. It's all one shader on a flat plane, redrawn by the graphics chip,
// so it costs a draw call a marker and no textures.

import * as THREE from "three";
import { HEROES, type HeroKind, shotSpread } from "../logic/heroes";
import {
  aimStretch,
  lockCandidate,
  patientCandidate,
  type RaidHero,
  type RaidState,
} from "../logic/raid";
import { angleOf, distance, type Vec2 } from "../logic/vec";

/** The cone never draws narrower than this either side, so a precise rifle still shows. */
const MIN_HALF_ANGLE = 0.07;
/** Seconds for a reticle to snap in, for a hit's kick to die away, and for a fallen one to go. */
const SNAP_SECONDS = 0.16;
const KICK_SECONDS = 0.18;
const BURST_SECONDS = 0.5;

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
  uniform float uLive;
  varying float vRadius;
  varying float vSide;
  void main() {
    float r = vRadius / uLength;
    // A soft fill that brightens towards the far edge, with crisp bright rims on every side.
    float fill = 0.1 + 0.22 * smoothstep(0.2, 1.0, r);
    float rim = max(smoothstep(0.9, 1.0, vSide), smoothstep(0.965, 0.995, r));
    float sweep = smoothstep(0.08, 0.0, abs(fract(r - uTime * 0.9) - 0.5) - 0.42) * 0.12;
    float alpha = (fill + rim * 0.75 + sweep) * smoothstep(0.0, 0.12, r);
    gl_FragColor = vec4(1.0, 1.0, mix(0.72, 1.0, uLive), alpha * mix(0.45, 1.0, uLive));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const RETICLE_VERTEX = /* glsl */ `
  varying vec2 vPlace;
  void main() {
    vPlace = uv * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RETICLE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uSnap;
  uniform float uKick;
  uniform float uFade;
  uniform float uTime;
  varying vec2 vPlace;
  /** How far outside a box a point is. */
  float box(vec2 p, vec2 size) {
    vec2 d = abs(p) - size;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }
  void main() {
    float r = length(vPlace);
    // Four corner brackets, closing in as it locks and thrown back by each hit.
    vec2 corner = abs(vPlace);
    float reach = 0.58 + (1.0 - uSnap) * 0.26 + uKick * 0.09;
    float arm = 0.2;
    float bracket = min(
      box(corner - vec2(reach, reach - arm * 0.5), vec2(0.028, arm * 0.5)),
      box(corner - vec2(reach - arm * 0.5, reach), vec2(arm * 0.5, 0.028))
    );
    // Three arcs turning the other way, tightening as it locks.
    float angle = atan(vPlace.y, vPlace.x);
    float gaps = smoothstep(0.1, 0.16, abs(fract(angle * 0.477 + uTime * 0.28) - 0.5));
    float radius = 0.4 + (1.0 - uSnap) * 0.14;
    float arcs = (abs(r - radius) - 0.016) + (1.0 - gaps) * 0.2;
    float dot = r - 0.05 - uKick * 0.05;
    float mark = min(min(bracket, arcs), dot);
    // A hard dark edge keeps it readable on sand, grass and rooftops alike.
    float shape = 1.0 - smoothstep(0.0, 0.016, mark);
    float edge = 1.0 - smoothstep(0.016, 0.05, mark);
    // A ring thrown out by each hit, and a soft glow.
    float wave = (1.0 - smoothstep(0.0, 0.03, abs(r - (0.42 + (1.0 - uKick) * 0.5)))) * uKick;
    float glow = exp(-max(mark, 0.0) * 9.0) * 0.3;
    vec3 color = mix(vec3(0.03, 0.05, 0.1), uColor, max(shape, wave));
    float alpha = max(max(shape, edge * 0.75), max(wave, glow * step(r, 1.0)));
    gl_FragColor = vec4(color, alpha * uFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface Marker {
  mesh: THREE.Mesh;
  snap: THREE.IUniform<number>;
  kick: THREE.IUniform<number>;
  fade: THREE.IUniform<number>;
  time: THREE.IUniform<number>;
}

function reticle(color: number): Marker {
  const uniforms = {
    uColor: { value: new THREE.Color(color).multiplyScalar(1.5) },
    uSnap: { value: 0 },
    uKick: { value: 0 },
    uFade: { value: 1 },
    uTime: { value: 0 },
  };
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: RETICLE_VERTEX,
      fragmentShader: RETICLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 9;
  mesh.visible = false;
  return {
    mesh,
    snap: uniforms.uSnap,
    kick: uniforms.uKick,
    fade: uniforms.uFade,
    time: uniforms.uTime,
  };
}

/** A little past the mark and back, so a lock lands with a snap. */
function overshoot(t: number): number {
  const s = 1.7;
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

export class AimView {
  readonly root = new THREE.Group();
  private cone: THREE.Mesh | null = null;
  private coneKind: HeroKind | null = null;
  private readonly live = { value: 1 };
  private readonly material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uHalf: { value: 0.1 },
      uLength: { value: 10 },
      uTime: { value: 0 },
      uLive: this.live,
    },
    vertexShader: CONE_VERTEX,
    fragmentShader: CONE_FRAGMENT,
  });
  private readonly candidate = reticle(0xffffff);
  private readonly locked = reticle(0xff8a3a);
  private readonly burst = reticle(0xffd66a);
  /** What the locked reticle is on, and how far its lock and kick have gone. */
  private lockedOn: { pos: Vec2; radius: number } | null = null;
  private lockedId: number | null = null;
  private snap = 0;
  private candidateSnap = 0;
  private candidateId: number | null = null;
  private kick = 0;
  private burstAge = BURST_SECONDS;
  private lastTime = 0;

  constructor() {
    this.root.add(this.candidate.mesh, this.locked.mesh, this.burst.mesh);
  }

  /** A hit landed: if it was on what's locked, the reticle feels it. */
  hit(pos: Vec2): void {
    const on = this.lockedOn;
    if (on && distance(pos, on.pos) <= on.radius + 1) this.kick = 1;
  }

  /** A building fell: if it was what's locked, the reticle bursts off it. */
  fell(pos: Vec2, radius: number): void {
    const on = this.lockedOn;
    if (!on || distance(pos, on.pos) > 0.5) return;
    this.burstAge = 0;
    this.burst.mesh.position.copy(this.locked.mesh.position);
    this.burst.mesh.scale.setScalar(radius + 1.4);
    this.burst.snap.value = 1;
  }

  update(
    state: RaidState,
    hero: RaidHero | undefined,
    preview: Vec2 | null,
    ground: (x: number, y: number) => number,
    time: number,
  ): void {
    const dt = Math.max(0, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    this.updateBurst(dt, time);
    if (!hero?.alive) {
      if (this.cone) this.cone.visible = false;
      this.candidate.mesh.visible = false;
      this.locked.mesh.visible = false;
      this.lockedOn = null;
      return;
    }
    if (this.coneKind !== hero.kind) this.buildCone(hero.kind, hero.mods.spread, hero.mods.range);
    const cone = this.cone;
    const y = ground(hero.pos.x, hero.pos.y) + 0.12;
    (this.material.uniforms.uTime as THREE.IUniform<number>).value = time;

    if (cone) {
      cone.visible = preview !== null && !hero.inBoat;
      if (preview) {
        cone.position.set(hero.pos.x, y, hero.pos.y);
        cone.rotation.set(-Math.PI / 2, 0, -angleOf(preview));
        // It opens up as the hero moves, the same as their shots do.
        const { width, length } = aimStretch(hero);
        cone.scale.set(length, width, 1);
      }
    }

    if (HEROES[hero.kind].attack.kind === "heal") {
      this.markPatients(state, hero, preview, ground, time, dt);
      return;
    }
    // Which building letting go would lock onto.
    const next = preview ? lockCandidate(state, hero, preview) : null;
    this.live.value += ((next ? 1 : 0) - this.live.value) * Math.min(1, dt * 14);
    const target =
      hero.targetId === null ? null : state.buildings.find((b) => b.id === hero.targetId);
    const on = target && !target.destroyed ? target : null;
    this.show(next && on && next.id === on.id ? null : next, next?.id ?? null, on, on?.id ?? null, {
      ground,
      time,
      dt,
    });
  }

  /** The same two reticles for a medic, on crewmates instead of buildings. */
  private markPatients(
    state: RaidState,
    hero: RaidHero,
    preview: Vec2 | null,
    ground: (x: number, y: number) => number,
    time: number,
    dt: number,
  ): void {
    const ringFor = (h: RaidHero | null | undefined) =>
      h ? { pos: h.pos, radius: HEROES[h.kind].radius } : null;
    const next = preview ? patientCandidate(state, hero, preview) : null;
    const patient = state.heroes.find((h) => h.id === hero.patientId && h.alive) ?? null;
    this.live.value = 1;
    this.show(
      next === patient ? null : ringFor(next),
      next?.id ?? null,
      ringFor(patient),
      patient?.id ?? null,
      { ground, time, dt },
    );
  }

  private show(
    hover: { pos: Vec2; radius: number } | null,
    hoverId: number | null,
    lock: { pos: Vec2; radius: number } | null,
    lockId: number | null,
    frame: { ground: (x: number, y: number) => number; time: number; dt: number },
  ): void {
    const { ground, time, dt } = frame;
    if (hoverId !== this.candidateId) {
      this.candidateId = hoverId;
      this.candidateSnap = 0;
    }
    if (lockId !== this.lockedId) {
      this.lockedId = lockId;
      this.snap = 0;
      this.kick = 0;
    }
    this.candidateSnap = Math.min(1, this.candidateSnap + dt / SNAP_SECONDS);
    this.snap = Math.min(1, this.snap + dt / SNAP_SECONDS);
    this.kick = Math.max(0, this.kick - dt / KICK_SECONDS);
    this.place(this.candidate, hover, ground, time, overshoot(this.candidateSnap), 0.5, 0);
    this.place(this.locked, lock, ground, time, overshoot(this.snap), 1, this.kick);
    this.lockedOn = lock;
  }

  private place(
    m: Marker,
    b: { pos: Vec2; radius: number } | null | undefined,
    ground: (x: number, y: number) => number,
    time: number,
    snap: number,
    spin: number,
    kick: number,
  ): void {
    m.mesh.visible = !!b;
    if (!b) return;
    m.mesh.position.set(b.pos.x, ground(b.pos.x, b.pos.y) + 0.15, b.pos.y);
    m.mesh.scale.setScalar((b.radius + 1.4) * (1 + kick * 0.05));
    m.mesh.rotation.z = Math.PI / 4;
    m.snap.value = snap;
    m.kick.value = kick;
    m.time.value = time * spin;
  }

  private updateBurst(dt: number, time: number): void {
    const { burst } = this;
    this.burstAge += dt;
    const t = this.burstAge / BURST_SECONDS;
    burst.mesh.visible = t < 1;
    if (t >= 1) return;
    burst.mesh.scale.multiplyScalar(1 + dt * 2.4);
    burst.fade.value = (1 - t) ** 2;
    burst.kick.value = 1 - t;
    burst.time.value = time;
    burst.mesh.rotation.z = Math.PI / 4 + t * 0.8;
  }

  private buildCone(kind: HeroKind, tighter: number, extraRange: number): void {
    if (this.cone) {
      this.root.remove(this.cone);
      this.cone.geometry.dispose();
    }
    const half = Math.max(MIN_HALF_ANGLE, shotSpread(kind, tighter));
    const range = HEROES[kind].attack.range + extraRange;
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
    for (const { mesh } of [this.candidate, this.locked, this.burst]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}
