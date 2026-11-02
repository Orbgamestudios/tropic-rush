// The world map: the crew's home on a deep blue sea, little 3D islands round it with palms and a
// base, and cloud over everything not yet reached. The camera drags and pinches over all of it. It
// can go on forever, so regions are only built as they come into view, each in a handful of draw
// calls, and splotches of cloud lift as the crew earns its way out.

import * as THREE from "three";
import { HOME_SHAPE, type IslandShape } from "../logic/island";
import { islandShape } from "../logic/islandShapes";
import { createRng } from "../logic/rng";
import { clamp, lerp } from "../logic/vec";
import {
  clearSky,
  islandRadius,
  type MapIsland,
  REGION,
  type WorldProgress,
} from "../logic/worldMap";
import { cloudTexture } from "./clouds";
import { type Lamp, LightPool } from "./lightPool";
import { MapClouds } from "./mapClouds";
import { MapShallows } from "./mapShallows";
import { buildingModel, gunboatModel } from "./models";
import { NOISE_CELLS, noiseTexture } from "./noiseTexture";
import { COLORS } from "./palette";
import {
  bushGeometry,
  instanced,
  jungleTreeGeometry,
  type PropInstance,
  palmGeometry,
  swaying,
} from "./props";
import { merge, vertexColored } from "./shapes";
import { SKY } from "./sky";
import type { Stage } from "./stage";

const PITCH = 1.12;
/** The nearest and furthest the camera gets. */
const DISTANCE = [62, 190] as const;
const START_DISTANCE = 112;
const LOOK_Z = 2;
/** How far past the clear sky the camera can drift, in map units. */
const PAN_MARGIN = 26;
/** Regions are built once they're this near the middle of the view, in regions. */
const BUILD_REACH = { x: 1.4, y: 1.5 } as const;
const SMOKE_STEPS = 4;
/** How big the crew's own island is drawn. */
const HOME_RADIUS = 6.5;
const CREW_LIGHT = 0xffc680;
const RAIDER_LIGHT = 0xff6a3c;

const OCEAN_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uUnlit;
  uniform sampler2D uShallows;
  uniform vec4 uBox;
  varying vec3 vWorld;
  uniform sampler2D uNoise;
  float noise(vec2 p) { return texture2D(uNoise, p / ${NOISE_CELLS.toFixed(1)}).r; }
  void main() {
    vec2 p = vWorld.xz;
    // Slow patches of lighter and darker water, then a few thin wave crests.
    vec3 color = vec3(0.01, 0.11, 0.33) * (0.82 + noise(p * 0.06 + uTime * 0.012) * 0.4);
    // The shelf round the islands, its edge wandering with the noise, and the sandbanks on it.
    vec2 uv = (p - uBox.xy) / uBox.zw + (vec2(noise(p * 0.1), noise(p * 0.1 + 9.0)) - 0.5) * 0.018;
    float shelf = texture2D(uShallows, uv).r + (noise(p * 0.2) - 0.5) * 0.1;
    color = mix(color, vec3(0.05, 0.5, 0.62), smoothstep(0.2, 0.42, shelf) * 0.9);
    color = mix(color, vec3(0.3, 0.84, 0.76), smoothstep(0.5, 0.82, shelf) * 0.85);
    float a = noise(p * 0.22 + vec2(uTime * 0.08, 0.0));
    float b = noise(p * 0.55 - vec2(0.0, uTime * 0.06));
    color += vec3(0.5, 0.75, 0.95) * smoothstep(0.66, 0.74, a * 0.55 + b * 0.45) * 0.035;
    gl_FragColor = vec4(color * uUnlit, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

let shapes: {
  palm: THREE.BufferGeometry;
  tree: THREE.BufferGeometry;
  bush: THREE.BufferGeometry;
  enemyHq: THREE.BufferGeometry;
  crewHq: THREE.BufferGeometry;
  tower: THREE.BufferGeometry;
} | null = null;

/** The one baked mesh of a building, to draw hundreds of it cheaply. */
function bakedBuilding(root: THREE.Object3D): THREE.BufferGeometry {
  let found: THREE.BufferGeometry | null = null;
  root.traverse((o) => {
    if (!found && o instanceof THREE.Mesh && o.material === vertexColored()) found = o.geometry;
  });
  return found ?? new THREE.BufferGeometry();
}

function sharedShapes(): NonNullable<typeof shapes> {
  shapes ??= {
    palm: palmGeometry(),
    tree: jungleTreeGeometry(),
    bush: bushGeometry(),
    enemyHq: bakedBuilding(buildingModel("headquarters").root),
    crewHq: bakedBuilding(buildingModel("headquarters", true).root),
    tower: bakedBuilding(buildingModel("watchtower").root),
  };
  return shapes;
}

/** Everything drawn on the islands of one region, gathered up to go into a few meshes. */
interface Batch {
  land: THREE.BufferGeometry[];
  palms: PropInstance[];
  trees: PropInstance[];
  bushes: PropInstance[];
  enemyHqs: PropInstance[];
  crewHqs: PropInstance[];
  towers: PropInstance[];
}

function newBatch(): Batch {
  return {
    land: [],
    palms: [],
    trees: [],
    bushes: [],
    enemyHqs: [],
    crewHqs: [],
    towers: [],
  };
}

/** A map island is drawn from this many samples of the real island's land, each way. */
const MODEL_CELLS = 30;

/** Where an island's land lies: its middle, and how far it reaches from there. */
function landBounds(shape: IslandShape): { x: number; z: number; reach: number } {
  let west = Infinity;
  let east = -Infinity;
  let north = Infinity;
  let south = -Infinity;
  for (let x = -shape.reach; x <= shape.reach; x += 6) {
    for (let z = -shape.reach; z <= shape.reach; z += 6) {
      if (shape.shoreDistance(x, z) <= 0) continue;
      west = Math.min(west, x);
      east = Math.max(east, x);
      north = Math.min(north, z);
      south = Math.max(south, z);
    }
  }
  return {
    x: (west + east) / 2,
    z: (north + south) / 2,
    reach: Math.max(east - west, south - north) / 2 + 3,
  };
}

/** One island in miniature: its true coast and hills, shrunk onto the map. */
function addLand(
  batch: Batch,
  seed: number,
  x: number,
  z: number,
  radius: number,
  shape: IslandShape,
): (wx: number, wz: number) => { x: number; y: number } {
  const rng = createRng(seed);
  const { x: mx, z: mz, reach } = landBounds(shape);
  const scale = radius / reach;
  const toMap = (wx: number, wz: number) => ({
    x: x + (wx - mx) * scale,
    y: z + (wz - mz) * scale,
  });
  const sand = new THREE.Color(shape.blackSand ? 0x4a4648 : COLORS.sand);
  const grass = new THREE.Color(0x6fbf4c);
  const rock = new THREE.Color(0x6d6358);
  const lava = new THREE.Color(0xff7a24);
  const step = (reach * 2) / MODEL_CELLS;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const count = MODEL_CELLS + 1;
  const color = new THREE.Color();
  for (let j = 0; j < count; j++) {
    for (let i = 0; i < count; i++) {
      const wx = mx - reach + i * step;
      const wz = mz - reach + j * step;
      const sd = shape.shoreDistance(wx, wz);
      const land = sd > 0;
      const rise = land ? 0.2 + Math.max(0, shape.height(wx, wz)) * scale * 0.9 : -0.25;
      positions.push(x + (wx - mx) * scale, rise, z + (wz - mz) * scale);
      color.copy(sand);
      if (sd > shape.beachWidth(wx, wz)) color.copy(grass);
      if (shape.height(wx, wz) > 11) color.copy(rock);
      if (shape.lava(wx, wz) > 0.3) color.copy(lava);
      colors.push(color.r, color.g, color.b);
    }
  }
  const landAt = (i: number, j: number) => (positions[(j * count + i) * 3 + 1] ?? -1) > 0;
  for (let j = 0; j + 1 < count; j++) {
    for (let i = 0; i + 1 < count; i++) {
      if (!landAt(i, j) && !landAt(i + 1, j) && !landAt(i, j + 1) && !landAt(i + 1, j + 1))
        continue;
      const a = j * count + i;
      const b = a + 1;
      const c = a + count;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  batch.land.push(g);

  const trees = Math.round(6 + radius * 2.4);
  for (let i = 0, made = 0; i < trees * 12 && made < trees; i++) {
    const wx = mx + (rng() - 0.5) * reach * 1.9;
    const wz = mz + (rng() - 0.5) * reach * 1.9;
    if (shape.shoreDistance(wx, wz) <= shape.beachWidth(wx, wz) * 0.6) continue;
    if (shape.lava(wx, wz) > 0 || shape.height(wx, wz) > 9) continue;
    made++;
    const spot = toMap(wx, wz);
    const item: PropInstance = {
      x: spot.x,
      y: spot.y,
      rotation: rng() * 6.28,
      scale: new THREE.Vector3().setScalar(0.24 + rng() * 0.12),
    };
    const roll = rng();
    (roll < 0.4 ? batch.palms : roll < 0.7 ? batch.trees : batch.bushes).push(item);
  }
  return toMap;
}

/** The land a map island shows: player islands are all crew islands. */
function mapShape(island: MapIsland): IslandShape {
  return island.archetype === "player" ? HOME_SHAPE : islandShape(island.seed, island.hq);
}

function addIsland(batch: Batch, island: MapIsland): void {
  const radius = islandRadius(island.size);
  const shape = mapShape(island);
  const toMap = addLand(batch, island.seed, island.x, island.y, radius, shape);
  // A taste of the base: a headquarters, and towers the harder it gets. Square on, like home.
  const scale = new THREE.Vector3().setScalar(0.16 + island.size * 0.05);
  const base = { ...toMap(shape.base.x, shape.base.y), rotation: 0, scale };
  (island.taken || island.rival ? batch.crewHqs : batch.enemyHqs).push(base);
  if (island.taken) return;
  const towers = Math.min(3, 1 + Math.floor(island.hq / 5));
  for (let i = 0; i < towers; i++) {
    const a = i * 2.2 + 0.6;
    batch.towers.push({
      x: base.x + Math.cos(a) * radius * 0.34,
      y: base.y + Math.sin(a) * radius * 0.26,
      rotation: 0,
      scale: new THREE.Vector3().setScalar(0.18),
    });
  }
}

function buildBatch(batch: Batch): THREE.Group {
  const group = new THREE.Group();
  if (batch.land.length > 0) group.add(new THREE.Mesh(merge(batch.land), vertexColored()));
  const s = sharedShapes();
  const sway = swaying(false);
  const still = vertexColored();
  const lifted = () => 0.4;
  group.add(
    instanced(s.palm, batch.palms, false, sway, lifted),
    instanced(s.tree, batch.trees, false, sway, lifted),
    instanced(s.bush, batch.bushes, false, sway, lifted),
    instanced(s.enemyHq, batch.enemyHqs, false, still, lifted),
    instanced(s.crewHq, batch.crewHqs, false, still, lifted),
    instanced(s.tower, batch.towers, false, still, lifted),
  );
  return group;
}

interface RegionView {
  group: THREE.Group;
  /** What the region's islands looked like when it was built. */
  look: string;
}

interface Smoke {
  puff: THREE.Sprite;
  x: number;
  z: number;
  phase: number;
}

export class WorldMapView {
  readonly root = new THREE.Group();
  /** Bumped when the view moves, so the plates only follow it when they need to. */
  moves = 0;
  private readonly ocean: THREE.ShaderMaterial;
  private readonly sea: THREE.Mesh;
  private readonly regions = new Map<string, RegionView>();
  private readonly regionRoot = new THREE.Group();
  private readonly clouds = new MapClouds();
  private readonly shallows = new MapShallows();
  private readonly boat = gunboatModel();
  private readonly lights = new LightPool();
  /** One per step of the rising loop, so each puff can fade as it goes. */
  private readonly smokeMaterials: THREE.SpriteMaterial[] = [];
  private readonly smoke: Smoke[] = [];
  private islands: readonly MapIsland[] = [];
  private bounds = { west: 0, east: 0, north: 0, south: 0 };
  private readonly focus = new THREE.Vector2();
  private readonly target = new THREE.Vector2();
  private distance = START_DISTANCE;
  private targetDistance = START_DISTANCE;
  private savedBackground: THREE.Scene["background"] = null;
  private savedFog: THREE.Scene["fog"] = null;

  constructor(private readonly stage: Stage) {
    this.ocean = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uNoise: { value: noiseTexture() },
        uUnlit: SKY.unlit,
        uShallows: { value: this.shallows.texture },
        uBox: { value: this.shallows.box },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: OCEAN_FRAGMENT,
      // Drawn first and leaving no depth, so the shallows can't flicker against it far off.
      depthWrite: false,
    });
    const sea = new THREE.PlaneGeometry(700, 520);
    sea.rotateX(-Math.PI / 2);
    this.sea = new THREE.Mesh(sea, this.ocean);
    this.sea.renderOrder = -1;
    this.root.add(this.sea, this.regionRoot, this.clouds.mesh, this.lights.root);

    // Home in the middle, and the gunboat at anchor beside it.
    const home = newBatch();
    addLand(home, 5, 0, 0, HOME_RADIUS, HOME_SHAPE);
    home.crewHqs.push({
      x: 0,
      y: 0,
      rotation: 0,
      scale: new THREE.Vector3().setScalar(0.32),
    });
    this.root.add(buildBatch(home));
    this.boat.root.scale.setScalar(0.5);
    this.root.add(this.boat.root);

    const puff = cloudTexture();
    for (let i = 0; i < SMOKE_STEPS; i++) {
      const material = new THREE.SpriteMaterial({ map: puff, color: 0x6f747a, depthWrite: false });
      material.transparent = true;
      this.smokeMaterials.push(material);
    }
    this.root.visible = false;
    stage.scene.add(this.root);
  }

  /** Lays the world out as it stands. With `lifting`, the newest cloud lifts as you watch. */
  setWorld(islands: readonly MapIsland[], world: WorldProgress, lifting = false): void {
    this.islands = islands;
    this.lightIslands(islands);
    const sky = clearSky(world);
    this.bounds = {
      west: Math.min(...sky.map((h) => h.x - h.radius)) - PAN_MARGIN,
      east: Math.max(...sky.map((h) => h.x + h.radius)) + PAN_MARGIN,
      north: Math.min(...sky.map((h) => h.y - h.radius)) - PAN_MARGIN,
      south: Math.max(...sky.map((h) => h.y + h.radius)) + PAN_MARGIN,
    };
    this.clouds.setSky(sky, lifting);
    this.shallows.paint([
      { x: 0, y: 0, radius: HOME_RADIUS },
      ...islands.map((i) => ({ x: i.x, y: i.y, radius: islandRadius(i.size) })),
    ]);
    // Regions rebuild only when something on them has changed.
    for (const [key, view] of this.regions) {
      if (view.look === this.lookOf(key)) continue;
      this.dropRegion(key, view);
    }
    this.placeSmoke();
  }

  private lookOf(region: string): string {
    return this.islands
      .filter((i) => i.region === region)
      .map((i) => `${i.id}${i.taken ? "t" : ""}${i.hq}${i.seed}`)
      .join();
  }

  private dropRegion(key: string, view: RegionView): void {
    this.regionRoot.remove(view.group);
    view.group.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
      else if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.regions.delete(key);
  }

  private buildRegion(key: string): void {
    const batch = newBatch();
    for (const island of this.islands) if (island.region === key) addIsland(batch, island);
    const group = buildBatch(batch);
    this.regionRoot.add(group);
    this.regions.set(key, { group, look: this.lookOf(key) });
  }

  /** Builds at most one region a frame, of those near the view. */
  private buildNearby(): void {
    const c = this.focus.x / REGION.w;
    const r = this.focus.y / REGION.h;
    for (const island of this.islands) {
      if (this.regions.has(island.region)) continue;
      const [column = 0, row = 0] = island.region.split(",").map(Number);
      if (Math.abs(column - c) > BUILD_REACH.x || Math.abs(row - r) > BUILD_REACH.y) continue;
      this.buildRegion(island.region);
      return;
    }
  }

  /** Grey smoke over the islands raiders have retaken, so they stand out on the map. */
  private placeSmoke(): void {
    for (const s of this.smoke) this.root.remove(s.puff);
    this.smoke.length = 0;
    for (const island of this.islands) {
      // Volcanoes smoke too, which makes them easy to spot across the map.
      if (!island.retaken && island.archetype !== "volcano") continue;
      this.smokeMaterials.forEach((material, i) => {
        const puff = new THREE.Sprite(material);
        this.root.add(puff);
        this.smoke.push({ puff, x: island.x, z: island.y, phase: i / SMOKE_STEPS });
      });
    }
  }

  /** After dark, a lit camp on every island, and the crew's own in warmer colors. */
  private lightIslands(islands: readonly MapIsland[]): void {
    const lamp = (x: number, z: number, reach: number, color: number): Lamp => ({
      x,
      y: 0.5,
      z,
      reach,
      power: 1.8,
      color,
      halo: 1.6,
      height: 1.5,
      flicker: false,
    });
    this.lights.setLamps([
      lamp(0, 0, 9, CREW_LIGHT),
      ...islands.map((i) =>
        lamp(i.x, i.y, islandRadius(i.size) * 1.3, i.taken ? CREW_LIGHT : RAIDER_LIGHT),
      ),
    ]);
  }

  show(on: boolean): void {
    if (on === this.root.visible) return;
    this.root.visible = on;
    const { scene, sky } = this.stage;
    sky.cover("map", on);
    if (on) {
      this.savedBackground = scene.background;
      this.savedFog = scene.fog;
      scene.background = sky.mapBackground;
      scene.fog = null;
    } else {
      scene.background = this.savedBackground;
      scene.fog = this.savedFog;
    }
  }

  /** Follows a drag, in screen pixels. */
  pan(dx: number, dy: number): void {
    const fov = THREE.MathUtils.degToRad(this.stage.camera.fov);
    const perPixel = (2 * this.distance * Math.tan(fov / 2)) / this.stage.height;
    this.lookAt(this.target.x - dx * perPixel, this.target.y - (dy * perPixel) / Math.sin(PITCH));
  }

  zoom(factor: number): void {
    this.targetDistance = clamp(this.targetDistance * factor, DISTANCE[0], DISTANCE[1]);
  }

  /** Points the camera at a map spot, smoothly. */
  lookAt(x: number, y: number): void {
    const { west, east, north, south } = this.bounds;
    this.target.set(clamp(x, west, east), clamp(y, north, south));
  }

  /** Jumps straight to a map spot. */
  jumpTo(x: number, y: number): void {
    this.lookAt(x, y);
    this.focus.copy(this.target);
  }

  update(time: number, dt: number): void {
    (this.ocean.uniforms.uTime as THREE.IUniform<number>).value = time;
    this.lights.update(dt, time);
    this.boat.root.position.set(Math.sin(time * 0.1) * 1.5 + 9, 0.1, 6.5);
    this.boat.root.rotation.y = 0.5;
    for (const s of this.smoke) {
      const t = (time * 0.18 + s.phase) % 1;
      s.puff.position.set(s.x + 0.5 + t * 2, 1 + t * 6, s.z - 0.4);
      s.puff.scale.setScalar(1.2 + t * 4.5);
    }
    this.smokeMaterials.forEach((material, i) => {
      material.opacity = Math.sin(Math.PI * ((time * 0.18 + i / SMOKE_STEPS) % 1)) * 0.62;
    });

    const k = 1 - Math.exp(-dt * 9);
    const gap = this.focus.distanceToSquared(this.target);
    const zooming = Math.abs(this.distance - this.targetDistance) > 0.01;
    if (gap > 1e-4 || zooming) this.moves++;
    this.focus.lerp(this.target, k);
    this.distance = lerp(this.distance, this.targetDistance, k);
    this.buildNearby();

    const cam = this.stage.camera;
    const x = this.focus.x;
    const z = this.focus.y + LOOK_Z;
    this.sea.position.set(x, 0, z);
    this.clouds.update(time, dt, x, z);
    cam.position.set(x, Math.sin(PITCH) * this.distance, z + Math.cos(PITCH) * this.distance);
    cam.lookAt(x, 0, z);
    cam.updateMatrixWorld();
  }

  /** Where a map spot appears, as a fraction of the screen's width and height. */
  screen(x: number, y: number): { x: number; y: number } {
    const p = new THREE.Vector3(x, 2, y).project(this.stage.camera);
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
  }
}
