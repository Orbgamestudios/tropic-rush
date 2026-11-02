// The world map: the crew's home on a deep blue sea, little 3D islands round it with palms and a
// base, and banks of cloud over everything not yet reached. The camera drags and pinches over all
// of it. It can go on forever, so regions are only built as they come into view, each in a handful
// of draw calls, and cloud lifts from a region when the crew earns its way in.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRng } from "../logic/rng";
import { clamp, lerp } from "../logic/vec";
import {
  chartedRegions,
  islandRadius,
  type MapIsland,
  REGION,
  regionKey,
  type WorldProgress,
} from "../logic/worldMap";
import { cloudTexture } from "./clouds";
import { buildingModel, gunboatModel } from "./models";
import { NOISE_CELLS, noiseTexture } from "./noiseTexture";
import { COLORS } from "./palette";
import {
  bushGeometry,
  instanced,
  jungleTreeGeometry,
  lump,
  type PropInstance,
  palmGeometry,
  swaying,
} from "./props";
import { merge, vertexColored } from "./shapes";
import type { Stage } from "./stage";

const PITCH = 1.12;
/** The nearest and furthest the camera gets. */
const DISTANCE = [62, 190] as const;
const START_DISTANCE = 112;
const LOOK_Z = 2;
/** How far past the open regions the camera can drift, as a share of a region. */
const PAN_MARGIN = 0.42;
/** Regions are built once they're this near the middle of the view, in regions. */
const BUILD_REACH = { x: 1.4, y: 1.5 } as const;
const CLOUD_PUFFS = 22;
const CLOUD_LIFT_SECONDS = 2.6;
const SMOKE_STEPS = 4;

const OCEAN_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  uniform sampler2D uNoise;
  float noise(vec2 p) { return texture2D(uNoise, p / ${NOISE_CELLS.toFixed(1)}).r; }
  void main() {
    vec2 p = vWorld.xz;
    // Slow patches of lighter and darker water, then a few thin wave crests.
    vec3 color = vec3(0.01, 0.11, 0.33) * (0.82 + noise(p * 0.06 + uTime * 0.012) * 0.4);
    float a = noise(p * 0.22 + vec2(uTime * 0.08, 0.0));
    float b = noise(p * 0.55 - vec2(0.0, uTime * 0.06));
    color += vec3(0.5, 0.75, 0.95) * smoothstep(0.66, 0.74, a * 0.55 + b * 0.45) * 0.035;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function shallowsTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const c = size / 2;
    const grad = g.createRadialGradient(c, c, c * 0.45, c, c, c);
    grad.addColorStop(0, "rgba(150, 240, 225, 0.95)");
    grad.addColorStop(0.6, "rgba(90, 215, 215, 0.5)");
    grad.addColorStop(1, "rgba(60, 190, 210, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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
  shallows: THREE.BufferGeometry[];
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
    shallows: [],
    palms: [],
    trees: [],
    bushes: [],
    enemyHqs: [],
    crewHqs: [],
    towers: [],
  };
}

/** One island's coast, a few overlapping blobs of sand and grass, and its trees. */
function addLand(batch: Batch, seed: number, x: number, z: number, radius: number): void {
  const rng = createRng(seed);
  // The land turns as one, so no two coasts face the same way.
  const turn = rng() * Math.PI * 2;
  const place = (g: THREE.BufferGeometry, y = 0) => {
    g.rotateY(turn);
    g.translate(x, y, z);
    return g;
  };
  const shelf = new THREE.PlaneGeometry(radius * 4.4, radius * 3.4);
  shelf.rotateX(-Math.PI / 2);
  batch.shallows.push(place(shelf, 0.05));
  const blob = (bx: number, bz: number, size: number, stretch: number, detail: number) => {
    const sand = lump(radius * size * 1.2, detail, seed % 100, COLORS.sand);
    sand.scale(1, 0.14, stretch);
    sand.translate(bx, 0, bz);
    const grass = lump(radius * size, detail, (seed % 100) + 3, 0x6fbf4c);
    grass.scale(0.95, 0.2, stretch * 0.87);
    grass.translate(bx, 0.25, bz - radius * 0.04);
    batch.land.push(place(sand), place(grass));
  };
  blob(0, 0, 1, 0.7 + rng() * 0.3, 2);
  // One or two headlands off the main body, for a coastline with some shape.
  const headlands = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < headlands; i++) {
    const a = rng() * Math.PI * 2;
    blob(Math.cos(a) * radius * 0.75, Math.sin(a) * radius * 0.5, 0.42 + rng() * 0.2, 0.8, 1);
  }
  const count = Math.round(5 + radius * 1.6);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = radius * (0.5 + rng() * 0.42);
    const lx = Math.cos(a) * r;
    const lz = Math.sin(a) * r * 0.72;
    const item: PropInstance = {
      x: x + lx * Math.cos(turn) + lz * Math.sin(turn),
      y: z - lx * Math.sin(turn) + lz * Math.cos(turn),
      rotation: rng() * 6.28,
      scale: new THREE.Vector3().setScalar(0.28 + rng() * 0.14),
    };
    const roll = rng();
    (roll < 0.4 ? batch.palms : roll < 0.7 ? batch.trees : batch.bushes).push(item);
  }
}

function addIsland(batch: Batch, island: MapIsland): void {
  const radius = islandRadius(island.size);
  addLand(batch, island.seed, island.x, island.y, radius);
  // A taste of the base: a headquarters, and towers the harder it gets. Square on, like home.
  const scale = new THREE.Vector3().setScalar(0.16 + island.size * 0.05);
  const base = { x: island.x, y: island.y, rotation: 0, scale };
  (island.taken ? batch.crewHqs : batch.enemyHqs).push(base);
  if (island.taken) return;
  const towers = Math.min(3, 1 + Math.floor(island.hq / 5));
  for (let i = 0; i < towers; i++) {
    const a = i * 2.2 + 0.6;
    batch.towers.push({
      x: island.x + Math.cos(a) * radius * 0.5,
      y: island.y + Math.sin(a) * radius * 0.36,
      rotation: 0,
      scale: new THREE.Vector3().setScalar(0.18),
    });
  }
}

function buildBatch(batch: Batch, shallows: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  if (batch.land.length > 0) {
    group.add(new THREE.Mesh(merge(batch.land), vertexColored()));
    const glow = mergeGeometries(batch.shallows, false);
    if (glow) group.add(new THREE.Mesh(glow, shallows));
  }
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

/** A region's cloud bank: big soft sheets with smaller puffs on them, as one mesh. */
function cloudGeometry(column: number, row: number): THREE.BufferGeometry {
  const rng = createRng(Math.imul(column, 7919) ^ Math.imul(row, 104729) ^ 0x2f1);
  const quads: THREE.BufferGeometry[] = [];
  const cx = column * REGION.w;
  const cz = row * REGION.h;
  const put = (x: number, y: number, z: number, size: number) => {
    const quad = new THREE.PlaneGeometry(size, size * 0.66);
    quad.rotateX(-PITCH);
    quad.translate(x, y, z);
    quads.push(quad);
  };
  // Four sheets overlap to hide the sea, whichever way the camera comes at it.
  for (const [dx, dz] of [
    [-0.27, -0.27],
    [0.27, -0.27],
    [-0.27, 0.27],
    [0.27, 0.27],
  ] as const) {
    put(cx + dx * REGION.w, 7, cz + dz * REGION.h, REGION.w * 0.74);
  }
  for (let i = 0; i < CLOUD_PUFFS; i++) {
    put(
      cx + (rng() - 0.5) * REGION.w * 0.86,
      8 + rng() * 7,
      cz + (rng() - 0.5) * REGION.h * 0.86,
      26 + rng() * 20,
    );
  }
  const merged = mergeGeometries(quads, false) ?? new THREE.BufferGeometry();
  for (const q of quads) q.dispose();
  return merged;
}

interface RegionView {
  group: THREE.Group;
  /** What the region's islands looked like when it was built. */
  look: string;
}

interface Lifting {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
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
  private readonly cloudRoot = new THREE.Group();
  private readonly clouds = new Map<string, THREE.Mesh>();
  private readonly lifting: Lifting[] = [];
  private readonly cloudMaterial: THREE.MeshBasicMaterial;
  private readonly shallows = new THREE.MeshBasicMaterial({
    map: shallowsTexture(),
    transparent: true,
    depthWrite: false,
  });
  private readonly boat = gunboatModel();
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
      uniforms: { uTime: { value: 0 }, uNoise: { value: noiseTexture() } },
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
    this.root.add(this.sea, this.regionRoot, this.cloudRoot);

    // Home in the middle, and the gunboat at anchor beside it.
    const home = newBatch();
    addLand(home, 5, 0, 0, 6.5);
    home.crewHqs.push({
      x: 0,
      y: 0,
      rotation: 0,
      scale: new THREE.Vector3().setScalar(0.32),
    });
    this.root.add(buildBatch(home, this.shallows));
    this.boat.root.scale.setScalar(0.5);
    this.root.add(this.boat.root);

    const puff = cloudTexture();
    for (let i = 0; i < SMOKE_STEPS; i++) {
      const material = new THREE.SpriteMaterial({ map: puff, color: 0x6f747a, depthWrite: false });
      material.transparent = true;
      this.smokeMaterials.push(material);
    }
    // Tilted to face the camera, so the sheets reach down through the sea: no depth test.
    this.cloudMaterial = new THREE.MeshBasicMaterial({
      map: puff,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.root.visible = false;
    stage.scene.add(this.root);
  }

  /** Lays the world out as it stands. `reveal` lists regions whose cloud lifts as you watch. */
  setWorld(
    islands: readonly MapIsland[],
    world: WorldProgress,
    reveal: readonly string[] = [],
  ): void {
    this.islands = islands;
    const { open } = chartedRegions(world);
    const spots = open.map((key) => key.split(",").map(Number) as [number, number]);
    const columns = spots.map(([c]) => c);
    const rows = spots.map(([, r]) => r);
    const west = Math.min(...columns);
    const east = Math.max(...columns);
    const north = Math.min(...rows);
    const south = Math.max(...rows);
    this.bounds = {
      west: (west - 0.5 - PAN_MARGIN) * REGION.w,
      east: (east + 0.5 + PAN_MARGIN) * REGION.w,
      north: (north - 0.5 - PAN_MARGIN) * REGION.h,
      south: (south + 0.5 + PAN_MARGIN) * REGION.h,
    };
    // Cloud fills the whole box round the open water, right past the edge of where you can pan.
    const wanted = new Set<string>();
    for (let c = west - 2; c <= east + 2; c++) {
      for (let r = north - 2; r <= south + 2; r++) {
        if (!open.includes(regionKey(c, r))) wanted.add(regionKey(c, r));
      }
    }
    for (const [key, mesh] of this.clouds) {
      if (wanted.has(key)) continue;
      this.clouds.delete(key);
      if (reveal.includes(key)) this.lift(mesh);
      else this.dropCloud(mesh);
    }
    for (const key of wanted) {
      if (this.clouds.has(key)) continue;
      const [c = 0, r = 0] = key.split(",").map(Number);
      const mesh = new THREE.Mesh(cloudGeometry(c, r), this.cloudMaterial);
      mesh.renderOrder = 5;
      this.cloudRoot.add(mesh);
      this.clouds.set(key, mesh);
    }
    // Regions rebuild only when something on them has changed.
    for (const [key, view] of this.regions) {
      if (view.look === this.lookOf(key)) continue;
      this.dropRegion(key, view);
    }
    this.placeSmoke();
  }

  private lift(mesh: THREE.Mesh): void {
    const material = this.cloudMaterial.clone();
    mesh.material = material;
    this.lifting.push({ mesh, material, age: 0 });
  }

  private dropCloud(mesh: THREE.Mesh): void {
    this.cloudRoot.remove(mesh);
    mesh.geometry.dispose();
  }

  private lookOf(region: string): string {
    return this.islands
      .filter((i) => i.region === region)
      .map((i) => `${i.id}${i.taken ? "t" : ""}${i.hq}`)
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
    const group = buildBatch(batch, this.shallows);
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
      if (!island.retaken) continue;
      this.smokeMaterials.forEach((material, i) => {
        const puff = new THREE.Sprite(material);
        this.root.add(puff);
        this.smoke.push({ puff, x: island.x, z: island.y, phase: i / SMOKE_STEPS });
      });
    }
  }

  show(on: boolean): void {
    if (on === this.root.visible) return;
    this.root.visible = on;
    const { scene } = this.stage;
    if (on) {
      this.savedBackground = scene.background;
      this.savedFog = scene.fog;
      scene.background = new THREE.Color(0x0a2f5a);
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
    this.cloudRoot.position.x = Math.sin(time * 0.05) * 3;
    this.cloudRoot.position.z = Math.cos(time * 0.04) * 2;
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
    for (let i = this.lifting.length - 1; i >= 0; i--) {
      const l = this.lifting[i];
      if (!l) continue;
      l.age += dt;
      const t = Math.min(1, l.age / CLOUD_LIFT_SECONDS);
      l.material.opacity = 1 - t * t;
      l.mesh.position.y = t * t * 26;
      if (t >= 1) {
        this.dropCloud(l.mesh);
        l.material.dispose();
        this.lifting.splice(i, 1);
      }
    }

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
