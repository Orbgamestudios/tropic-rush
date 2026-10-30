// Draws the crew island: the same island as a raid (ground, sea, beach, mist and the moored
// gunboat), the overgrowth, buildings on their tile footprints, the placement preview, and name
// tags for crewmates moving things. Also owns the home camera (drag to pan, pinch or wheel to
// zoom).

import * as THREE from "three";
import { BUILDINGS, type BuildingType } from "../logic/buildings";
import {
  buildingCenter,
  type CrewLayout,
  footprint,
  HOME_START,
  type Obstacle,
  type PlacedBuilding,
  TILE,
} from "../logic/crewIsland";
import { homeHeight, landingPoints } from "../logic/island";
import { angleOf, clamp, lerp, sub, type Vec2, vec } from "../logic/vec";
import { buildClouds, type CloudView } from "./clouds";
import { visibleBox } from "./heroAssets";
import { buildingModel, gunboatModel } from "./models";
import { OvergrowthView } from "./overgrowth";
import { COLORS } from "./palette";
import { buildShore, updateWind } from "./props";
import { homeScenery } from "./scenery";
import { rbox } from "./shapes";
import type { Stage } from "./stage";
import { buildTerrain, type TerrainView } from "./terrain";
import { buildTileGrid } from "./tileGrid";

/** Enemy paint becomes crew paint on the home island: rust to crew blue, charcoal to steel. */
const CREW_PAINT = new Map<number, number>([
  [COLORS.enemyRust, COLORS.crewBlue],
  [COLORS.enemyDark, 0x55657e],
]);

/**
 * A building on the crew island: its 3D model, repainted in crew colors and turned to face the
 * beach, standing on a paved pad the size of its footprint.
 */
function crewBuildingModel(type: BuildingType, rotated: boolean): THREE.Group {
  const { w, h } = footprint(type, rotated);
  const g = new THREE.Group();
  const width = w * TILE - 0.3;
  const depth = h * TILE - 0.3;
  const pad = rbox(width, 0.3, depth, 0xd8ccb0);
  pad.position.y = 0.15;
  pad.receiveShadow = true;
  const trim = rbox(width + 0.12, 0.16, depth + 0.12, COLORS.crewBlueDark);
  trim.position.y = 0.06;
  // A stone footing, so the pad sits level where the ground rolls away under it.
  const footing = rbox(width + 0.2, 2.4, depth + 0.2, 0xb4a88e);
  footing.position.y = -1.15;
  g.add(footing, trim, pad);
  const model = buildingModel(type).root;
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
  model.position.y = 0.3;
  g.add(model);
  // Own materials, so one building can fade (while a crewmate holds it) without fading the rest.
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = true;
    const m = (o.material as THREE.MeshStandardMaterial).clone();
    const paint = m.color ? CREW_PAINT.get(m.color.getHex()) : undefined;
    if (paint !== undefined) m.color.setHex(paint);
    o.material = m;
  });
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
/** How far the camera can pan (meters): the whole island, out to its shores. */
const PAN_X = 90;
const PAN_BACK = -82;
const PAN_FRONT = 78;

/** The home island's camera: always facing north, panned and zoomed by the player. */
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
    this.focus.x = clamp(this.focus.x - dx * perPixel, -PAN_X, PAN_X);
    this.focus.z = clamp(this.focus.z - (dy * perPixel) / Math.sin(PITCH), PAN_BACK, PAN_FRONT);
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
    cam.position.set(
      this.smoothFocus.x,
      this.smoothFocus.y + Math.sin(PITCH) * this.smoothDistance,
      this.smoothFocus.z + Math.cos(PITCH) * this.smoothDistance,
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
  private readonly blocks = new Map<string, { group: THREE.Group; key: string }>();
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
  private readonly tags = new Map<string, HTMLDivElement>();
  private readonly overgrowth: OvergrowthView;

  constructor(
    private readonly stage: Stage,
    private readonly labelLayer: HTMLElement,
  ) {
    this.camera = new HomeCamera(stage);
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
    this.selection = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xffd84a,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.selection.renderOrder = 2;
    this.selection.visible = false;
    this.root.add(this.selection);
  }

  /** Mirrors the layout: adds, moves and removes building blocks. */
  sync(layout: CrewLayout, hiddenId: string | null, holders: readonly Holder[]): void {
    this.overgrowth.sync(layout);
    const live = new Set<string>();
    for (const b of layout.buildings) {
      live.add(b.id);
      const key = `${b.type}|${b.rotated}`;
      let entry = this.blocks.get(b.id);
      if (!entry || entry.key !== key) {
        if (entry) this.root.remove(entry.group);
        entry = { group: crewBuildingModel(b.type, b.rotated), key };
        this.blocks.set(b.id, entry);
        this.root.add(entry.group);
      }
      const center = buildingCenter(b);
      entry.group.position.set(center.x, groundFor(b), center.y);
      entry.group.visible = b.id !== hiddenId;
      const held = holders.some((h) => h.buildingId === b.id);
      entry.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          (o.material as THREE.MeshStandardMaterial).transparent = held;
          (o.material as THREE.MeshStandardMaterial).opacity = held ? 0.55 : 1;
        }
      });
    }
    for (const [id, entry] of this.blocks) {
      if (live.has(id)) continue;
      this.root.remove(entry.group);
      this.blocks.delete(id);
    }
    this.placeTags(layout, holders);
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
          o.material = new THREE.MeshStandardMaterial({
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
        (o.material as THREE.MeshStandardMaterial).color.set(preview.valid ? 0xd8ffe0 : 0xffc4bd);
    });
  }

  showSelection(b: PlacedBuilding | null): void {
    this.selection.visible = b !== null;
    if (!b) return;
    const center = buildingCenter(b);
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

  /** Leaves or stone chips flying off a cleared obstacle. */
  burst(o: Obstacle): void {
    this.overgrowth.burst(o);
  }

  update(dt: number, time: number): void {
    this.camera.update(dt);
    this.overgrowth.update(dt);
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
    this.overgrowth.dispose();
    this.clouds.dispose();
    this.root.remove(this.clouds.root);
    for (const tag of this.tags.values()) tag.remove();
    this.tags.clear();
    this.root.remove(this.terrain.root);
    this.terrain.dispose();
    this.root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
