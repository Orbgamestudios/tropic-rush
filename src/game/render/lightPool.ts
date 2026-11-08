// Light at dusk and at night, without a single real light: those would add to every pixel of every
// material. Instead, one draw call of soft discs on the ground brightens whatever is already drawn
// there, multiplying it the way a lamp would; a second gives the same discs a touch of the light's
// own color, which a multiply can't bring to a channel the night has left black; and a third adds a
// little glare at each lamp. Buildings keep lamps; weapons and explosions throw short flashes. By day
// none of the three draw calls happens.

import * as THREE from "three";
import type { BuildingType } from "../logic/buildings";
import { BUILDINGS } from "../logic/buildings";
import { SKY } from "./sky";

const LAMPS = 70;
const FOLLOWERS = 8;
const FLASHES = 28;
const GLINTS = 220;
/** Below this much dark nothing is lit, and nothing is drawn. */
const LAMPS_SHOW = 0.02;
const SQUARE = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];

// What lights a building, by the color of its light: an oil lantern's flame is about 1900 K, a
// warm floodlight 3000 K, a lab's tubes 6500 K and an open furnace 1700 K.
const FLAME = 0xff8a3c;
const BULB = 0xffb46e;
const TUBE = 0xdde8ff;
const FURNACE = 0xff7024;

/** Buildings lit by a fire of their own, whatever else they have. */
const FIRES: Partial<Record<BuildingType, number>> = {
  flamethrower: FLAME,
  refinery: FURNACE,
};

/**
 * Where a lantern hangs on a building whose model has no lamps yet, and how far it lights: shares
 * of its radius and height.
 */
interface LanternSpot {
  /** Along the side facing the camera. */
  across: number;
  /** Out towards the camera. */
  out: number;
  /** Up the building. */
  up: number;
  reach: number;
}

const LANTERNS: Partial<Record<BuildingType, readonly LanternSpot[]>> = {
  headquarters: [
    { across: -0.55, out: 1, up: 0.42, reach: 17 },
    { across: 0.55, out: 1, up: 0.42, reach: 17 },
  ],
  gunTurret: [{ across: 0, out: 1, up: 0.5, reach: 11 }],
  mortar: [{ across: 0, out: 1, up: 0.4, reach: 10 }],
  harpoon: [{ across: 0, out: 1, up: 0.45, reach: 11 }],
  flamethrower: [{ across: 0, out: 0.9, up: 0.5, reach: 12 }],
  watchtower: [{ across: 0, out: 0.2, up: 1, reach: 22 }],
  goldMine: [{ across: 0, out: 1, up: 0.4, reach: 13 }],
  lumberCamp: [{ across: 0.5, out: 1, up: 0.2, reach: 13 }],
  quarry: [{ across: 0, out: 1, up: 0.45, reach: 12 }],
  scrapYard: [{ across: 0, out: 1, up: 0.4, reach: 12 }],
  refinery: [{ across: 0, out: 1, up: 0.3, reach: 15 }],
  laboratory: [{ across: 0.2, out: 1, up: 0.4, reach: 13 }],
};

/** How far a building's floodlights and a lantern reach, against the figures above. */
const FLOODLIGHT_REACH = 0.7;
const LANTERN_REACH = 0.6;
/** How much light lands right under each, against the moonlight there already. */
const FLOODLIGHT_POWER = 7;
const LANTERN_POWER = 9;
/** The glare round each lamp on a model, in meters, and how many of a building's lamps get one. */
const GLINT_SIZE = 0.8;
const GLINTS_EACH = 6;

export interface Lamp {
  x: number;
  y: number;
  z: number;
  /** How far its pool of light reaches, in meters. */
  reach: number;
  /** How much light lands in the middle of that pool. */
  power: number;
  color: number;
  /** The glow round the lamp itself, in meters: 0 for none. */
  halo: number;
  /** How high the lamp is over its pool, where its glow sits; a small lamp higher up lights wider. */
  height: number;
  /** Lamps seen on a model: each gets a point of glare instead of one soft glow over the pool. */
  glints?: readonly THREE.Vector3[];
  /**
   * A small lamp, whose light falls away from right under it. Otherwise it spreads evenly, like a
   * fire's or a glow's.
   */
  point?: boolean;
  flicker: boolean;
}

/**
 * The light from a building standing here. A model with lamps is floodlit from them; until then a
 * lantern lights the side facing the camera, its flame out of sight.
 */
export function buildingLamps(
  type: BuildingType,
  x: number,
  y: number,
  z: number,
  /** Where the model's own lamps are, in the world. */
  spots: readonly THREE.Vector3[],
): Lamp[] {
  const spec = BUILDINGS[type];
  const lanterns = LANTERNS[type] ?? [];
  const fire = FIRES[type];
  if (spots.length > 0) {
    const middle = new THREE.Vector3();
    for (const spot of spots) middle.add(spot);
    middle.divideScalar(spots.length);
    const reach = Math.max(...lanterns.map((l) => l.reach), spec.radius * 2.5) * FLOODLIGHT_REACH;
    const step = Math.max(1, spots.length / GLINTS_EACH);
    return [
      {
        x: middle.x,
        y,
        z: middle.z,
        reach,
        power: FLOODLIGHT_POWER,
        color: fire ?? (type === "laboratory" ? TUBE : BULB),
        halo: GLINT_SIZE,
        height: Math.max(0.5, middle.y - y),
        glints: Array.from(
          { length: Math.min(GLINTS_EACH, spots.length) },
          (_, i) => spots[Math.floor(i * step)] as THREE.Vector3,
        ),
        point: true,
        flicker: fire !== undefined,
      },
    ];
  }
  const diagonal = Math.SQRT1_2 * spec.radius;
  return lanterns.map((spot) => ({
    x: x + (spot.across - spot.out) * diagonal,
    y,
    z: z + (spot.across + spot.out) * diagonal,
    reach: spot.reach * LANTERN_REACH,
    power: LANTERN_POWER,
    color: fire ?? FLAME,
    halo: 0,
    height: spot.up * spec.height,
    point: true,
    flicker: true,
  }));
}

/** Pools multiply where they overlap, so lamps packed close share their light, or they'd blow out. */
function sharedPower(lamp: Lamp, lamps: readonly Lamp[]): number {
  let crowd = 0;
  for (const other of lamps) {
    if (other === lamp) continue;
    const near = ((other.x - lamp.x) ** 2 + (other.z - lamp.z) ** 2) / lamp.reach ** 2;
    if (near < 1) crowd += (1 - near) ** 2;
  }
  return lamp.power / (1 + crowd);
}

/** How high a lamp is over its pool, as a share of its reach; 0 for light that spreads evenly. */
function poolCore(lamp: Lamp): number {
  return lamp.point ? Math.min(0.6, Math.max(0.16, lamp.height / lamp.reach)) : 0;
}

const POOL_VERTEX = /* glsl */ `
  attribute vec4 iSpot;
  attribute vec4 iColor;
  attribute float iShape;
  uniform float uTime;
  uniform float uDark;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vCore;
  void main() {
    vUv = position.xy * 2.0;
    float wobble = iColor.a > 0.0 ? 0.88 + 0.12 * sin(uTime * 9.0 + iColor.a) * sin(uTime * 5.3 + iColor.a * 2.0) : 1.0;
    vColor = iColor.rgb * wobble * uDark;
    vCore = iShape * iShape;
    vec3 world = iSpot.xyz + vec3(position.x, 0.0, position.y) * iSpot.w * 2.0;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

/** How much light lands on a spot in a pool, out of what lands right under the light. */
const POOL_FALL = /* glsl */ `
  float poolFall(vec2 at, float core) {
    float d2 = dot(at, at);
    float edge = max(0.0, 1.0 - d2);
    // A lamp is brightest right under it and falls away the way a real one does; anything else
    // spreads its light evenly. Either way it's gone by its reach.
    return edge * edge * (core > 0.0 ? pow(core / (core + d2), 1.5) : 1.0);
  }
`;

const POOL_FRAGMENT = /* glsl */ `
  uniform vec3 uBalance;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vCore;
  ${POOL_FALL}
  void main() {
    vec3 light = vColor * uBalance * poolFall(vUv, vCore);
    // What's on screen is finished color, not light: this is the same brightening in those terms.
    gl_FragColor = vec4(pow(1.0 + light, vec3(0.4545)) - 1.0, 1.0);
  }
`;

/**
 * How much of a light's own color everything it falls on gives back. Every surface reflects a little
 * of every color, but the night's grading leaves the darkest channel black, and multiplying black
 * by any light leaves it black: without this, warm light on grass would only make it greener.
 */
const SPILL = 0.004;

const SPILL_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vCore;
  ${POOL_FALL}
  void main() {
    vec3 spill = 1.0 - exp(-vColor * poolFall(vUv, vCore) * ${SPILL});
    gl_FragColor = vec4(pow(spill, vec3(0.4545)), 1.0);
  }
`;

const HALO_VERTEX = /* glsl */ `
  attribute vec4 iSpot;
  attribute vec4 iColor;
  attribute float iShape;
  uniform float uTime;
  uniform float uDark;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPoint;
  void main() {
    vUv = position.xy * 2.0;
    float wobble = iColor.a > 0.0 ? 0.8 + 0.2 * sin(uTime * 9.0 + iColor.a) : 1.0;
    vColor = iColor.rgb * wobble * min(uDark, 1.0);
    vPoint = iShape;
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
  varying float vPoint;
  void main() {
    float d2 = dot(vUv, vUv);
    float edge = max(0.0, 1.0 - d2);
    // A soft glow, or a lamp seen from afar: a hot white point and a little glare round it.
    vec3 soft = vColor * edge * edge * edge;
    float core = exp(-d2 * 140.0);
    float glare = edge * edge * 0.03 / (0.03 + d2);
    vec3 point = vColor * glare * 0.5 + mix(vColor, vec3(1.0), 0.65) * core * 1.8;
    gl_FragColor = vec4(mix(soft, point, vPoint), 1.0);
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
  /** A pool's middle, or whether a halo is a point of glare. */
  readonly shape: THREE.InstancedBufferAttribute;

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
    this.shape = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    for (const attribute of [this.spot, this.color, this.shape]) {
      attribute.setUsage(THREE.DynamicDrawUsage);
    }
    this.geometry.setAttribute("iSpot", this.spot);
    this.geometry.setAttribute("iColor", this.color);
    this.geometry.setAttribute("iShape", this.shape);
    this.geometry.instanceCount = 0;
  }

  /** Marks what changed for upload, in whole instances. */
  touch(first: number, count: number): void {
    for (const attribute of [this.spot, this.color, this.shape]) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(first * attribute.itemSize, count * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }
}

const tint = new THREE.Color();

export class LightPool {
  readonly root = new THREE.Group();
  private readonly pools = new Discs(LAMPS + FOLLOWERS + FLASHES);
  private readonly halos = new Discs(GLINTS);
  private readonly time = { value: 0 };
  private readonly poolMesh: THREE.Mesh;
  private readonly spillMesh: THREE.Mesh;
  private readonly haloMesh: THREE.Mesh;
  private lampCount = 0;
  private followerCount = 0;
  private flashes: Flash[] = [];
  /** The lamps' pools changed and still need uploading. */
  private lampsDirty = false;

  constructor() {
    const uniforms = { uTime: this.time, uDark: SKY.dark, uBalance: SKY.lampBalance };
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
    this.spillMesh = new THREE.Mesh(
      this.pools.geometry,
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: POOL_VERTEX,
        fragmentShader: SPILL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        // Screened over what's there, so it tints without ever going past white.
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcColorFactor,
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
    this.spillMesh.frustumCulled = false;
    this.haloMesh.frustumCulled = false;
    // First of everything see-through: it lights the ground and models, but multiplying a bright
    // overlay like a selection square would blow it out.
    this.poolMesh.renderOrder = -1;
    this.spillMesh.renderOrder = -0.9;
    this.haloMesh.renderOrder = 7;
    this.root.add(this.poolMesh, this.spillMesh, this.haloMesh);
    this.root.visible = false;
  }

  /** Replaces the lamps that stay put. Only call this when they've changed. */
  setLamps(lamps: readonly Lamp[]): void {
    const count = Math.min(lamps.length, LAMPS);
    let glints = 0;
    const halo = (x: number, y: number, z: number, lamp: Lamp, phase: number, point: boolean) => {
      if (glints >= GLINTS) return;
      tint.setHex(lamp.color);
      this.halos.spot.setXYZW(glints, x, y, z, lamp.halo);
      this.halos.color.setXYZW(glints, tint.r * 1.3, tint.g * 1.3, tint.b * 1.3, phase);
      this.halos.shape.setX(glints, point ? 1 : 0);
      glints++;
    };
    for (let i = 0; i < count; i++) {
      const lamp = lamps[i] as Lamp;
      const phase = lamp.flicker ? 1 + ((i * 2.4) % 6) : 0;
      const power = sharedPower(lamp, lamps);
      tint.setHex(lamp.color);
      this.pools.spot.setXYZW(i, lamp.x, lamp.y + 0.2, lamp.z, lamp.reach);
      this.pools.color.setXYZW(i, tint.r * power, tint.g * power, tint.b * power, phase);
      this.pools.shape.setX(i, poolCore(lamp));
      if (lamp.halo <= 0) continue;
      if (lamp.glints) for (const g of lamp.glints) halo(g.x, g.y, g.z, lamp, phase, true);
      else halo(lamp.x, lamp.y + lamp.height, lamp.z, lamp, phase, false);
    }
    this.lampCount = count;
    this.lampsDirty = true;
    this.halos.touch(0, glints);
    this.halos.geometry.instanceCount = glints;
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
    this.pools.shape.setX(i, 0);
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
      this.pools.shape.setX(i, 0);
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
    for (const mesh of [this.poolMesh, this.spillMesh, this.haloMesh]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}
