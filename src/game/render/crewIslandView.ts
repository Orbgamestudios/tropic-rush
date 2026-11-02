// Draws the crew island: the same island as a raid (ground, sea, beach, mist and the moored
// gunboat), the overgrowth, buildings on their tile footprints, the placement preview, and name
// tags for crewmates moving things. Also owns the home camera (drag to pan, pinch or wheel to
// zoom).

import * as THREE from "three";
import { VIEW_YAW } from "../config";
import { BUILDINGS, type BuildingType } from "../logic/buildings";
import {
  buildingCenter,
  buildJobOn,
  type CrewLayout,
  footprint,
  GRID_ORIGIN,
  HOME_START,
  type Obstacle,
  obstacleById,
  type PlacedBuilding,
  TILE,
} from "../logic/crewIsland";
import { formatDuration } from "../logic/economy";
import type { HeroKind } from "../logic/heroes";
import { homeHeight, landingPoints } from "../logic/island";
import { angleOf, clamp, lerp, sub, type Vec2, vec } from "../logic/vec";
import type { JobPin } from "../ui/crewUi";
import { buildClouds, type CloudView } from "./clouds";
import { Fireflies } from "./fireflies";
import { visibleBox } from "./heroAssets";
import { HomeHeroes } from "./homeHeroes";
import { buildingLamps, LightPool } from "./lightPool";
import { buildingModel, gunboatModel } from "./models";
import { OvergrowthView } from "./overgrowth";
import { COLORS, material } from "./palette";
import { buildShore, updateWind } from "./props";
import { homeScenery } from "./scenery";
import { at, barrel, cyl, flatten, rbox, vertexColored } from "./shapes";
import { overlayOpacity } from "./sky";
import type { Stage } from "./stage";
import { buildTerrain, type TerrainView } from "./terrain";
import { buildTileGrid } from "./tileGrid";

/**
 * A building on the crew island: its 3D model, repainted in crew colors and turned to face the
 * beach, standing straight on the grass.
 */
function crewBuildingModel(type: BuildingType, rotated: boolean): THREE.Group {
  const key = `${type}|${rotated}`;
  let template = crewModels.get(key);
  if (!template) {
    template = makeCrewBuilding(type, rotated);
    crewModels.set(key, template);
  }
  return template.clone(true);
}

const crewModels = new Map<string, THREE.Group>();
const SINK = 0.15;

/** Drawn over a building while a crewmate is moving it. */
const heldMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.55,
});

let signTemplate: THREE.Group | null = null;

/** A tiny signboard with a green arrow: this building can be upgraded right now. */
function upgradeSign(): THREE.Group {
  if (!signTemplate) {
    signTemplate = new THREE.Group();
    signTemplate.add(at(cyl(0.06, 0.07, 0.8, COLORS.woodDark, 6), 0, 0.4, 0));
    signTemplate.add(at(rbox(1, 1, 0.14, 0xf7f7f2), 0, 1.15, 0));
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.38);
    shape.lineTo(0.34, 0);
    shape.lineTo(0.13, 0);
    shape.lineTo(0.13, -0.36);
    shape.lineTo(-0.13, -0.36);
    shape.lineTo(-0.13, 0);
    shape.lineTo(-0.34, 0);
    shape.closePath();
    const arrow = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
    signTemplate.add(at(new THREE.Mesh(arrow, material(0x2fc84a)), 0, 1.15, 0.05));
    // Square on to the camera, however the building is turned.
    signTemplate.rotation.y = VIEW_YAW;
    flatten(signTemplate);
  }
  return signTemplate.clone(true);
}

const scaffolds = new Map<string, THREE.Group>();

/** Laid flat over hills and rooftops alike, so it ignores the depth of what's under it. */
function overlay(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
}

/** Bamboo poles and planks round a footprint: the sign that a building is being worked on. */
function scaffold(type: BuildingType, rotated: boolean): THREE.Group {
  const { w, h } = footprint(type, rotated);
  const tall = Math.min(BUILDINGS[type].height + 1, 9);
  const key = `${w}|${h}|${tall}`;
  let template = scaffolds.get(key);
  if (!template) {
    template = new THREE.Group();
    const hw = (w * TILE) / 2 + 0.1;
    const hd = (h * TILE) / 2 + 0.1;
    for (const [x, z] of [
      [hw, hd],
      [-hw, hd],
      [hw, -hd],
      [-hw, -hd],
    ] as const) {
      const pole = cyl(0.09, 0.11, tall, COLORS.bamboo, 6);
      pole.position.set(x, tall / 2, z);
      template.add(pole);
    }
    for (let y = 1.4; y < tall; y += 2.2) {
      for (const z of [hd, -hd]) {
        const bar = barrel(0.07, hw * 2, COLORS.bamboo, 6);
        bar.position.set(-hw, y, z);
        template.add(bar);
      }
      for (const x of [hw, -hw]) {
        const bar = barrel(0.07, hd * 2, COLORS.bamboo, 6);
        bar.rotation.y = Math.PI / 2;
        bar.position.set(x, y, hd);
        template.add(bar);
      }
    }
    flatten(template);
    scaffolds.set(key, template);
  }
  return template.clone(true);
}

function makeCrewBuilding(type: BuildingType, rotated: boolean): THREE.Group {
  const { w, h } = footprint(type, rotated);
  const g = new THREE.Group();
  const width = w * TILE - 0.3;
  const depth = h * TILE - 0.3;
  const model = buildingModel(type, true).root;
  // Models face +x; face the beach (+z, towards the camera), or turn a quarter more if rotated.
  model.rotation.y = -Math.PI / 2 + (rotated ? Math.PI / 2 : 0);
  const box = visibleBox(model);
  const size = box.getSize(new THREE.Vector3());
  const fit = Math.min(
    1,
    (width - 0.4) / Math.max(0.1, size.x),
    (depth - 0.4) / Math.max(0.1, size.z),
  );
  model.scale.setScalar(fit);
  // Sunk a little, so it doesn't float where the ground rolls away under it.
  model.position.y = -SINK;
  g.add(model);
  flatten(g);
  return g;
}

/** Roughly how tall a building stands, for name tags. */
function buildingHeight(type: BuildingType): number {
  return BUILDINGS[type].height;
}

/** Ground height under a building's middle. */
function groundFor(b: Pick<PlacedBuilding, "type" | "x" | "y" | "rotated">): number {
  const c = buildingCenter(b);
  return Math.max(0, homeHeight(c.x, c.y));
}

/** Fixes the home island's mist and beach dressing, the same for everyone. */
const HOME_SEED = 7;

const MIN_DISTANCE = 22;
const MAX_DISTANCE = 165;
const PITCH = 0.98; // about 56 degrees
const SELECTION_OPACITY = 0.4;
const REACH_FILL_OPACITY = 0.13;
const REACH_EDGE_OPACITY = 0.75;
/** How far the camera can pan (meters): the whole island, out to its shores. */
const PAN_X = 90;
const PAN_BACK = -82;
const PAN_FRONT = 78;

/** The home island's camera: always at the diamond angle, panned and zoomed by the player. */
class HomeCamera {
  readonly focus = new THREE.Vector3(HOME_START.x, 1, HOME_START.y + 3);
  distance = 62;
  private readonly smoothFocus = this.focus.clone();
  private smoothDistance = this.distance;
  private readonly raycaster = new THREE.Raycaster();

  constructor(private readonly stage: Stage) {}

  pan(dx: number, dy: number): void {
    const fov = THREE.MathUtils.degToRad(this.stage.camera.fov);
    const perPixel = (2 * this.smoothDistance * Math.tan(fov / 2)) / this.stage.height;
    const across = dx * perPixel;
    const along = (dy * perPixel) / Math.sin(PITCH);
    const c = Math.cos(VIEW_YAW);
    const s = Math.sin(VIEW_YAW);
    this.focus.x = clamp(this.focus.x - c * across - s * along, -PAN_X, PAN_X);
    this.focus.z = clamp(this.focus.z + s * across - c * along, PAN_BACK, PAN_FRONT);
  }

  zoom(factor: number): void {
    this.distance = clamp(this.distance * factor, MIN_DISTANCE, MAX_DISTANCE);
  }

  /** Points the camera at a world spot (meters). */
  lookAt(x: number, y: number): void {
    this.focus.x = clamp(x, -PAN_X, PAN_X);
    this.focus.z = clamp(y, PAN_BACK, PAN_FRONT);
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 10);
    // Rise and fall with the ground being looked at.
    this.focus.y = Math.max(0, homeHeight(this.focus.x, this.focus.z));
    this.smoothFocus.lerp(this.focus, k);
    this.smoothDistance = lerp(this.smoothDistance, this.distance, k);
    const cam = this.stage.camera;
    const flat = Math.cos(PITCH) * this.smoothDistance;
    cam.position.set(
      this.smoothFocus.x + Math.sin(VIEW_YAW) * flat,
      this.smoothFocus.y + Math.sin(PITCH) * this.smoothDistance,
      this.smoothFocus.z + Math.cos(VIEW_YAW) * flat,
    );
    cam.lookAt(this.smoothFocus);
    this.stage.focusShadows(this.smoothFocus, Math.max(30, this.smoothDistance * 0.75));
    this.stage.setFogRange(this.smoothDistance + 60, this.smoothDistance + 260);
  }

  /** The ground point under a screen position: where the ray first meets the sand, or null. */
  groundPoint(clientX: number, clientY: number, rect: DOMRect): Vec2 | null {
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.stage.camera);
    const { origin, direction } = this.raycaster.ray;
    if (direction.y >= -0.01) return null;
    const above = (t: number) =>
      origin.y +
      direction.y * t -
      homeHeight(origin.x + direction.x * t, origin.z + direction.z * t);
    // March from where the ray drops below the highest ground, then narrow down the crossing.
    const STEP = 1;
    let t = Math.max(0, (origin.y - 12) / -direction.y);
    for (let i = 0; i < 800; i++, t += STEP) {
      if (above(t + STEP) > 0) continue;
      let lo = t;
      let hi = t + STEP;
      for (let k = 0; k < 10; k++) {
        const mid = (lo + hi) / 2;
        if (above(mid) > 0) lo = mid;
        else hi = mid;
      }
      return vec(origin.x + direction.x * hi, origin.z + direction.z * hi);
    }
    return null;
  }
}

export interface Preview {
  building: PlacedBuilding;
  valid: boolean;
}

export interface Holder {
  buildingId: string;
  name: string;
}

export class CrewIslandView {
  readonly root = new THREE.Group();
  readonly camera: HomeCamera;
  private readonly terrain: TerrainView;
  private readonly clouds: CloudView;
  private readonly grid = buildTileGrid();
  private readonly blocks = new Map<
    string,
    {
      group: THREE.Group;
      key: string;
      held: boolean;
      scaffold: THREE.Group | null;
      sign: THREE.Group | null;
    }
  >();
  private readonly lights = new LightPool();
  private readonly fireflies = new Fireflies(7, (x, z) => Math.max(0, homeHeight(x, z)));
  /** What sync() last drew, so a frame where nothing changed costs nothing. */
  private drawn: { layout: CrewLayout | null; hidden: string | null; held: string } = {
    layout: null,
    hidden: null,
    held: "",
  };
  private readonly previewGroup = new THREE.Group();
  private previewKey = "";
  private readonly tilesMaterial = new THREE.MeshBasicMaterial({
    color: 0x5fe08a,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    depthTest: false,
  });
  private readonly tiles: THREE.Mesh;
  private readonly selection: THREE.Mesh;
  /** How far the selected defense reaches. */
  private readonly reach = new THREE.Group();
  private readonly reachFill = overlay(0x6fc6ff, REACH_FILL_OPACITY);
  private readonly reachEdge = overlay(0x9fdcff, REACH_EDGE_OPACITY);
  private readonly selectionMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd84a,
    transparent: true,
    opacity: SELECTION_OPACITY,
    depthWrite: false,
    depthTest: false,
  });
  private readonly tags = new Map<string, HTMLDivElement>();
  private readonly overgrowth: OvergrowthView;
  private readonly heroes: HomeHeroes;

  constructor(
    private readonly stage: Stage,
    private readonly labelLayer: HTMLElement,
  ) {
    this.camera = new HomeCamera(stage);
    this.heroes = new HomeHeroes(stage);
    this.root.add(this.heroes.root, this.lights.root, this.fireflies.mesh);
    const scenery = homeScenery(HOME_START);
    const landing = landingPoints();
    this.overgrowth = new OvergrowthView(scenery);
    this.terrain = buildTerrain(scenery, { height: homeHeight, shade: this.overgrowth.shade });
    this.clouds = buildClouds(HOME_SEED);
    // Beyond the grass it's the raid islands' shore; the grass itself is the overgrowth.
    const shore = buildShore(HOME_SEED, scenery, landing.spawn, homeHeight, -0.5);
    const boat = gunboatModel();
    boat.root.position.set(landing.boat.x, 0, landing.boat.y);
    boat.root.rotation.y = -angleOf(sub(landing.spawn, landing.boat));
    this.root.add(
      this.terrain.root,
      shore,
      boat.root,
      this.clouds.root,
      this.grid,
      this.previewGroup,
      this.overgrowth.root,
    );

    const tileGeometry = new THREE.PlaneGeometry(1, 1);
    tileGeometry.rotateX(-Math.PI / 2);
    this.tiles = new THREE.Mesh(tileGeometry, this.tilesMaterial);
    this.tiles.renderOrder = 2;
    this.tiles.visible = false;
    this.root.add(this.tiles);

    const ringGeometry = new THREE.PlaneGeometry(1, 1);
    ringGeometry.rotateX(-Math.PI / 2);
    this.selection = new THREE.Mesh(ringGeometry, this.selectionMaterial);
    this.selection.renderOrder = 2;
    this.selection.visible = false;
    this.root.add(this.selection);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2),
      this.reachFill,
    );
    const edge = new THREE.Mesh(
      new THREE.RingGeometry(0.975, 1, 72).rotateX(-Math.PI / 2),
      this.reachEdge,
    );
    disc.renderOrder = 2;
    edge.renderOrder = 2;
    this.reach.add(disc, edge);
    this.reach.visible = false;
    this.root.add(this.reach);
  }

  /** Mirrors the layout: adds, moves and removes building blocks. */
  sync(layout: CrewLayout, hiddenId: string | null, holders: readonly Holder[]): void {
    if (holders.length > 0) this.placeTags(layout, holders);
    const held = holders.map((h) => h.buildingId).join();
    const { drawn } = this;
    if (drawn.layout === layout && drawn.hidden === hiddenId && drawn.held === held) return;
    this.drawn = { layout, hidden: hiddenId, held };
    this.overgrowth.sync(layout);
    this.lights.setLamps(
      layout.buildings.flatMap((b) => {
        const { x, y } = buildingCenter(b);
        return buildingLamps(b.type, x, groundFor(b), y);
      }),
    );
    const live = new Set<string>();
    for (const b of layout.buildings) {
      live.add(b.id);
      const key = `${b.type}|${b.rotated}`;
      let entry = this.blocks.get(b.id);
      if (!entry || entry.key !== key) {
        if (entry) this.root.remove(entry.group);
        entry = {
          group: crewBuildingModel(b.type, b.rotated),
          key,
          held: false,
          scaffold: null,
          sign: null,
        };
        this.blocks.set(b.id, entry);
        this.root.add(entry.group);
      }
      const center = buildingCenter(b);
      entry.group.position.set(center.x, groundFor(b), center.y);
      entry.group.visible = b.id !== hiddenId;
      const working = buildJobOn(layout, b.id) !== undefined;
      if (working !== (entry.scaffold !== null)) {
        if (entry.scaffold) entry.group.remove(entry.scaffold);
        entry.scaffold = working ? scaffold(b.type, b.rotated) : null;
        if (entry.scaffold) entry.group.add(entry.scaffold);
      }
      const isHeld = holders.some((h) => h.buildingId === b.id);
      if (isHeld !== entry.held) {
        entry.held = isHeld;
        entry.group.traverse((o) => {
          if (o instanceof THREE.Mesh) o.material = isHeld ? heldMaterial : vertexColored();
        });
      }
    }
    for (const [id, entry] of this.blocks) {
      if (live.has(id)) continue;
      this.root.remove(entry.group);
      this.blocks.delete(id);
    }
    if (holders.length === 0) this.placeTags(layout, holders);
  }

  /** Puts the little upgrade sign on these buildings, at the corner nearest the camera. */
  showUpgradable(layout: CrewLayout, ids: ReadonlySet<string>): void {
    for (const b of layout.buildings) {
      const entry = this.blocks.get(b.id);
      if (!entry) continue;
      const wanted = ids.has(b.id);
      if (wanted === (entry.sign !== null)) continue;
      if (entry.sign) entry.group.remove(entry.sign);
      entry.sign = wanted ? upgradeSign() : null;
      if (!entry.sign) continue;
      const { w, h } = footprint(b.type, b.rotated);
      entry.sign.position.set((-w * TILE) / 2 + 0.5, 0, (h * TILE) / 2 - 0.5);
      entry.group.add(entry.sign);
    }
  }

  showPreview(preview: Preview | null): void {
    this.grid.visible = preview !== null;
    this.tiles.visible = preview !== null;
    if (!preview) {
      this.previewGroup.clear();
      this.previewKey = "";
      return;
    }
    const b = preview.building;
    const key = `${b.type}|${b.rotated}`;
    if (key !== this.previewKey) {
      this.previewGroup.clear();
      const ghost = crewBuildingModel(b.type, b.rotated);
      ghost.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.material = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.55,
          });
          o.castShadow = false;
        }
      });
      this.previewGroup.add(ghost);
      this.previewKey = key;
    }
    const center = buildingCenter(b);
    const { w, h } = footprint(b.type, b.rotated);
    const ground = groundFor(b);
    this.previewGroup.position.set(center.x, ground + 0.05, center.y);
    this.tiles.scale.set(w * TILE, 1, h * TILE);
    this.tiles.position.set(center.x, ground + 0.06, center.y);
    this.tilesMaterial.color.set(preview.valid ? 0x5fe08a : 0xff5a4a);
    this.previewGroup.traverse((o) => {
      if (o instanceof THREE.Mesh)
        (o.material as THREE.MeshLambertMaterial).color.set(preview.valid ? 0xd8ffe0 : 0xffc4bd);
    });
  }

  showSelection(b: PlacedBuilding | null): void {
    this.selection.visible = b !== null;
    const attack = b ? BUILDINGS[b.type].attack : undefined;
    this.reach.visible = attack !== undefined;
    if (!b) return;
    const center = buildingCenter(b);
    if (attack) {
      this.reach.position.set(center.x, groundFor(b) + 0.3, center.y);
      this.reach.scale.set(attack.range, 1, attack.range);
    }
    const { w, h } = footprint(b.type, b.rotated);
    this.selection.scale.set(w * TILE + 0.6, 1, h * TILE + 0.6);
    this.selection.position.set(center.x, groundFor(b) + 0.05, center.y);
  }

  private placeTags(layout: CrewLayout, holders: readonly Holder[]): void {
    const seen = new Set<string>();
    for (const holder of holders) {
      const b = layout.buildings.find((x) => x.id === holder.buildingId);
      if (!b) continue;
      seen.add(holder.buildingId);
      let tag = this.tags.get(holder.buildingId);
      if (!tag) {
        tag = document.createElement("div");
        tag.className = "name-tag";
        this.labelLayer.append(tag);
        this.tags.set(holder.buildingId, tag);
      }
      tag.textContent = `${holder.name} is moving this`;
      const center = buildingCenter(b);
      const p = new THREE.Vector3(
        center.x,
        groundFor(b) + buildingHeight(b.type) + 1.2,
        center.y,
      ).project(this.stage.camera);
      tag.style.transform = `translate(${(((p.x + 1) / 2) * this.stage.width).toFixed(1)}px, ${(((1 - p.y) / 2) * this.stage.height).toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (const [id, tag] of this.tags) {
      if (seen.has(id)) continue;
      tag.remove();
      this.tags.delete(id);
    }
  }

  /** Outlines the obstacle whose clearing panel is open (null hides it). */
  highlightObstacle(id: string | null): void {
    this.overgrowth.highlight(id);
  }

  /** Keeps the unlocked heroes strolling round the base. */
  syncHeroes(kinds: readonly HeroKind[], layout: CrewLayout): void {
    this.heroes.sync(kinds, layout);
  }

  /** The hero under a canvas point, if any. */
  heroAt(x: number, y: number): HeroKind | null {
    return this.heroes.heroAt(x, y);
  }

  /** Where each clearing job's countdown goes, as fractions of the screen's width and height. */
  jobPins(layout: Pick<CrewLayout, "jobs" | "builds" | "buildings">, now: number): JobPin[] {
    const pins: JobPin[] = [];
    const pin = (
      id: string,
      wx: number,
      wz: number,
      up: number,
      doneAt: number,
      build: boolean,
    ) => {
      const p = new THREE.Vector3(wx, homeHeight(wx, wz) + up, wz).project(this.stage.camera);
      const x = (p.x + 1) / 2;
      const y = (1 - p.y) / 2;
      const visible = p.z < 1 && x > 0 && x < 1 && y > 0.1 && y < 1;
      pins.push({
        id,
        x,
        y,
        visible,
        time: formatDuration(doneAt - now),
        building: build,
      });
    };
    for (const job of layout.jobs) {
      const o = obstacleById(job.id);
      if (!o) continue;
      const cx = GRID_ORIGIN.x + (o.x + o.w / 2) * TILE;
      const cy = GRID_ORIGIN.y + (o.y + o.h / 2) * TILE;
      pin(job.id, cx, cy, 5, job.doneAt, false);
    }
    for (const job of layout.builds) {
      const { target } = job;
      if (!("building" in target)) continue;
      const b = layout.buildings.find((x) => x.id === target.building);
      if (!b) continue;
      const c = buildingCenter(b);
      pin(`b:${b.id}`, c.x, c.y, BUILDINGS[b.type].height + 2, job.doneAt, true);
    }
    return pins;
  }

  /** Leaves or stone chips flying off a cleared obstacle. */
  burst(o: Obstacle): void {
    this.overgrowth.burst(o);
  }

  update(dt: number, time: number): void {
    this.camera.update(dt);
    this.overgrowth.setDistance(this.camera.distance);
    this.overgrowth.update(dt);
    this.heroes.update(dt);
    this.lights.update(dt, time);
    this.fireflies.update(time);
    const dim = overlayOpacity();
    this.selectionMaterial.opacity = SELECTION_OPACITY * dim;
    this.reachFill.opacity = REACH_FILL_OPACITY * dim;
    this.reachEdge.opacity = REACH_EDGE_OPACITY * dim;
    updateWind(time, null);
    this.terrain.update(time);
    this.clouds.update(time);
  }

  /** Building label for menus. */
  static label(type: BuildingType): string {
    return BUILDINGS[type].label;
  }

  dispose(): void {
    // The plants share geometry and materials with other views: dispose them separately.
    this.root.remove(this.overgrowth.root);
    this.lights.dispose();
    this.fireflies.dispose();
    this.overgrowth.dispose();
    this.heroes.dispose();
    this.clouds.dispose();
    this.root.remove(this.clouds.root);
    for (const tag of this.tags.values()) tag.remove();
    this.tags.clear();
    this.root.remove(this.terrain.root);
    this.terrain.dispose();
    // Materials are shared with the raids: only the view's own overlays go.
    this.tilesMaterial.dispose();
    this.reachFill.dispose();
    this.reachEdge.dispose();
    this.selectionMaterial.dispose();
    this.root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
