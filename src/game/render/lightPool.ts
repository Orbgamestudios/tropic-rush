// Light at dusk and at night, without a single real light: those would add to every pixel of every
// material. Instead, one draw call of soft discs on the ground brightens whatever is already drawn
// there, multiplying it the way a lamp would, and a second adds a small halo to each lamp. Buildings
// keep lamps; weapons and explosions throw short flashes. By day neither draw call happens at all.

import * as THREE from "three";
import type { BuildingType } from "../logic/buildings";
import { BUILDINGS } from "../logic/buildings";
import { SKY } from "./sky";

const LAMPS = 70;
const FOLLOWERS = 8;
const FLASHES = 28;
/** Below this much dark nothing is lit, and nothing is drawn. */
const LAMPS_SHOW = 0.02;
const SQUARE = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];

const WARM = 0xffc27a;
const LANTERN = 0xffe0a8;
const FIRE = 0xff8038;
const GOLD = 0xffcf5a;
const ENEMY = 0xff5a28;

/** A lamp's place on a building: shares of its radius and height. */
interface LampSpot {
  /** Along the side facing the camera. */
  across: number;
  /** Out towards the camera. */
  out: number;
  /** Up the building. */
  up: number;
  reach: number;
  power: number;
  color: number;
  flicker?: boolean;
}

const BUILDING_LAMPS: Partial<Record<BuildingType, readonly LampSpot[]>> = {
  headquarters: [
    { across: -0.55, out: 1, up: 0.42, reach: 10, power: 2.6, color: WARM },
    { across: 0.55, out: 1, up: 0.42, reach: 10, power: 2.6, color: WARM },
  ],
  gunTurret: [{ across: 0, out: 1, up: 0.5, reach: 6.5, power: 2, color: LANTERN }],
  mortar: [{ across: 0, out: 1, up: 0.4, reach: 6, power: 2, color: LANTERN }],
  harpoon: [{ across: 0, out: 1, up: 0.45, reach: 6.5, power: 2, color: LANTERN }],
  flamethrower: [
    { across: 0, out: 0.9, up: 0.5, reach: 7, power: 2.6, color: FIRE, flicker: true },
  ],
  watchtower: [{ across: 0, out: 0.2, up: 1, reach: 14, power: 1.8, color: LANTERN }],
  goldMine: [{ across: 0, out: 1, up: 0.4, reach: 8, power: 2.4, color: GOLD }],
  lumberCamp: [{ across: 0.5, out: 1, up: 0.2, reach: 8, power: 2.6, color: FIRE, flicker: true }],
  quarry: [{ across: 0, out: 1, up: 0.45, reach: 7, power: 2, color: LANTERN }],
  scrapYard: [{ across: 0, out: 1, up: 0.4, reach: 7, power: 2, color: WARM }],
  refinery: [{ across: 0, out: 1, up: 0.3, reach: 9.5, power: 3, color: FIRE, flicker: true }],
};

export interface Lamp {
  x: number;
  y: number;
  z: number;
  /** How far its pool of light reaches, in meters. */
  reach: number;
  /** How much brighter it makes the middle of that pool. */
  power: number;
  color: number;
  /** The halo round the lamp itself, in meters: 0 for none. */
  halo: number;
  /** How high the halo sits above the pool. */
  height: number;
  flicker: boolean;
}

/** The lamps on a building standing here: facing the camera, so its halos aren't hidden. */
export function buildingLamps(
  type: BuildingType,
  x: number,
  y: number,
  z: number,
  enemy = false,
): Lamp[] {
  const spec = BUILDINGS[type];
  const diagonal = Math.SQRT1_2 * spec.radius;
  const tint = new THREE.Color();
  return (BUILDING_LAMPS[type] ?? []).map((spot) => ({
    x: x + (spot.across - spot.out) * diagonal,
    y,
    z: z + (spot.across + spot.out) * diagonal,
    reach: spot.reach,
    power: spot.power,
    color: enemy ? tint.setHex(spot.color).lerp(new THREE.Color(ENEMY), 0.4).getHex() : spot.color,
    halo: Math.min(1.1, 0.45 + spot.reach * 0.05),
    height: spot.up * spec.height,
    flicker: spot.flicker ?? false,
  }));
}

const POOL_VERTEX = /* glsl */ `
  attribute vec4 iSpot;
  attribute vec4 iColor;
  uniform float uTime;
  uniform float uDark;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = position.xy * 2.0;
    float wobble = iColor.a > 0.0 ? 0.88 + 0.12 * sin(uTime * 9.0 + iColor.a) * sin(uTime * 5.3 + iColor.a * 2.0) : 1.0;
    vColor = iColor.rgb * wobble * uDark;
    vec3 world = iSpot.xyz + vec3(position.x, 0.0, position.y) * iSpot.w * 2.0;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const POOL_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    float a = max(0.0, 1.0 - dot(vUv, vUv));
    gl_FragColor = vec4(vColor * a * a, 1.0);
  }
`;

const HALO_VERTEX = /* glsl */ `
  attribute vec4 iSpot;
  attribute vec4 iColor;
  uniform float uTime;
  uniform float uDark;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = position.xy * 2.0;
    float wobble = iColor.a > 0.0 ? 0.8 + 0.2 * sin(uTime * 9.0 + iColor.a) : 1.0;
    vColor = iColor.rgb * wobble * uDark;
    vec4 view = viewMatrix * vec4(iSpot.xyz, 1.0);
    view.xy += position.xy * iSpot.w * 2.0;
    // Pulled towards the camera, so the wall it hangs on doesn't cut it in half.
    view.z += 0.8;
    gl_Position = projectionMatrix * view;
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    float a = max(0.0, 1.0 - dot(vUv, vUv));
    gl_FragColor = vec4(vColor * a * a * a, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface Flash {
  x: number;
  y: number;
  z: number;
  reach: number;
  r: number;
  g: number;
  b: number;
  age: number;
  life: number;
}

class Discs {
  readonly geometry = new THREE.InstancedBufferGeometry();
  readonly spot: THREE.InstancedBufferAttribute;
  readonly color: THREE.InstancedBufferAttribute;

  constructor(capacity: number) {
    this.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([...SQUARE.flatMap((v, i) => (i % 2 ? [v, 0] : [v]))]),
        3,
      ),
    );
    this.spot = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.spot.setUsage(THREE.DynamicDrawUsage);
    this.color.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute("iSpot", this.spot);
    this.geometry.setAttribute("iColor", this.color);
    this.geometry.instanceCount = 0;
  }

  /** Marks what changed for upload, in whole instances. */
  touch(first: number, count: number): void {
    for (const attribute of [this.spot, this.color]) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(first * 4, count * 4);
      attribute.needsUpdate = true;
    }
  }
}

const tint = new THREE.Color();

export class LightPool {
  readonly root = new THREE.Group();
  private readonly pools = new Discs(LAMPS + FOLLOWERS + FLASHES);
  private readonly halos = new Discs(LAMPS);
  private readonly time = { value: 0 };
  private readonly poolMesh: THREE.Mesh;
  private readonly haloMesh: THREE.Mesh;
  private lampCount = 0;
  private followerCount = 0;
  private flashes: Flash[] = [];
  /** The lamps' pools changed and still need uploading. */
  private lampsDirty = false;

  constructor() {
    const uniforms = { uTime: this.time, uDark: SKY.dark };
    this.poolMesh = new THREE.Mesh(
      this.pools.geometry,
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: POOL_VERTEX,
        fragmentShader: POOL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        // What's there already, plus that much again times the light: light lands on things
        // rather than fogging over them.
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.DstColorFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneFactor,
      }),
    );
    this.haloMesh = new THREE.Mesh(
      this.halos.geometry,
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: HALO_VERTEX,
        fragmentShader: HALO_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.poolMesh.frustumCulled = false;
    this.haloMesh.frustumCulled = false;
    this.poolMesh.renderOrder = 3;
    this.haloMesh.renderOrder = 7;
    this.root.add(this.poolMesh, this.haloMesh);
    this.root.visible = false;
  }

  /** Replaces the lamps that stay put. Only call this when they've changed. */
  setLamps(lamps: readonly Lamp[]): void {
    const count = Math.min(lamps.length, LAMPS);
    for (let i = 0; i < count; i++) {
      const lamp = lamps[i] as Lamp;
      const phase = lamp.flicker ? 1 + ((i * 2.4) % 6) : 0;
      tint.setHex(lamp.color);
      this.pools.spot.setXYZW(i, lamp.x, lamp.y + 0.2, lamp.z, lamp.reach);
      this.pools.color.setXYZW(
        i,
        tint.r * lamp.power,
        tint.g * lamp.power,
        tint.b * lamp.power,
        phase,
      );
      this.halos.spot.setXYZW(i, lamp.x, lamp.y + lamp.height, lamp.z, lamp.halo);
      this.halos.color.setXYZW(i, tint.r * 1.3, tint.g * 1.3, tint.b * 1.3, phase);
    }
    this.lampCount = count;
    this.lampsDirty = true;
    this.halos.touch(0, count);
    this.halos.geometry.instanceCount = count;
    this.followerCount = 0;
  }

  /** Whether lights show at the moment: there's no point working out where one goes if not. */
  get active(): boolean {
    return this.root.visible;
  }

  /** A light that goes round with someone. Call for each, every frame, then `update`. */
  follow(x: number, y: number, z: number, reach: number, power: number, color: number): void {
    if (this.followerCount >= FOLLOWERS || !this.root.visible) return;
    const i = this.lampCount + this.followerCount++;
    tint.setHex(color);
    this.pools.spot.setXYZW(i, x, y + 0.2, z, reach);
    this.pools.color.setXYZW(i, tint.r * power, tint.g * power, tint.b * power, 0);
  }

  /** A burst of light that dies away, from a gun or a blast. */
  flash(
    x: number,
    y: number,
    z: number,
    color: number,
    reach: number,
    power: number,
    life: number,
  ): void {
    if (!this.root.visible || this.flashes.length >= FLASHES) return;
    tint.setHex(color);
    this.flashes.push({
      x,
      y,
      z,
      reach,
      r: tint.r * power,
      g: tint.g * power,
      b: tint.b * power,
      age: 0,
      life,
    });
  }

  update(dt: number, time: number): void {
    const lit = SKY.dark.value >= LAMPS_SHOW;
    this.root.visible = lit;
    if (!lit) {
      this.followerCount = 0;
      this.flashes.length = 0;
      return;
    }
    this.time.value = time;
    const first = this.lampCount;
    let i = first + this.followerCount;
    let write = 0;
    for (const flash of this.flashes) {
      flash.age += dt;
      if (flash.age >= flash.life) continue;
      this.flashes[write++] = flash;
      const left = 1 - flash.age / flash.life;
      const fade = left * left;
      this.pools.spot.setXYZW(i, flash.x, flash.y + 0.2, flash.z, flash.reach);
      this.pools.color.setXYZW(i, flash.r * fade, flash.g * fade, flash.b * fade, 0);
      i++;
    }
    this.flashes.length = write;
    if (this.lampsDirty || i !== this.pools.geometry.instanceCount || i > first) {
      const from = this.lampsDirty ? 0 : first;
      this.pools.geometry.instanceCount = i;
      this.pools.touch(from, i - from);
      this.lampsDirty = false;
    }
    this.followerCount = 0;
  }

  dispose(): void {
    for (const mesh of [this.poolMesh, this.haloMesh]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}
