// Draws the crew island: the sand island, buildings as simple blocks on their tile footprints,
// the placement preview, and name tags for crewmates moving things. Also owns the home
// camera (drag to pan, pinch or wheel to zoom).

import * as THREE from "three";
import { BUILDINGS, type BuildingType } from "../logic/buildings";
import {
  buildingCenter,
  type CrewLayout,
  footprint,
  type PlacedBuilding,
  TILE,
  ZONES,
  zoneBounds,
  zoneOf,
} from "../logic/crewIsland";
import { clamp, lerp, type Vec2, vec } from "../logic/vec";
import { buildHomeIsland, type HomeIslandView, homeHeight, PLATEAU } from "./homeIsland";
import { COLORS } from "./palette";
import { rbox } from "./shapes";
import type { Stage } from "./stage";

const BLOCK_HEIGHT: Record<BuildingType, number> = {
  headquarters: 6,
  gunTurret: 2.4,
  mortar: 1.8,
  harpoon: 2,
  flamethrower: 2.6,
  watchtower: 5,
  goldMine: 2.4,
  lumberCamp: 2.2,
  quarry: 2,
  scrapYard: 1.8,
  storehouse: 2.6,
  refinery: 3.6,
};

const DEFENSES = new Set<BuildingType>([
  "gunTurret",
  "mortar",
  "harpoon",
  "flamethrower",
  "watchtower",
]);

function blockColor(type: BuildingType): number {
  if (type === "headquarters") return COLORS.crewBlue;
  if (DEFENSES.has(type)) return 0x5c6f86;
  if (type === "storehouse" || type === "refinery") return 0x8a8f96;
  return COLORS.woodLight;
}

/** A placeholder block for a building: a base in its color with a crew-blue roof band. */
function blockModel(type: BuildingType, rotated: boolean): THREE.Group {
  const { w, h } = footprint(type, rotated);
  const height = BLOCK_HEIGHT[type];
  const g = new THREE.Group();
  const width = w * TILE - 0.5;
  const depth = h * TILE - 0.5;
  const base = rbox(width, height, depth, blockColor(type));
  base.position.y = height / 2;
  g.add(base);
  const roof = rbox(
    width + 0.1,
    0.35,
    depth + 0.1,
    type === "headquarters" ? COLORS.crewBlueDark : COLORS.crewBlue,
  );
  roof.position.y = height + 0.1;
  g.add(roof);
  // Own materials, so one block can fade (while a crewmate holds it) without fading the rest.
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.material = (o.material as THREE.MeshStandardMaterial).clone();
  });
  return g;
}

/** Ground height for a building: its zone's terrace, or the terrain under it if it's off-grid. */
function groundFor(b: Pick<PlacedBuilding, "type" | "x" | "y" | "rotated">): number {
  const zone = zoneOf(b);
  if (zone) return zone.height;
  const c = buildingCenter(b);
  return Math.max(PLATEAU, homeHeight(c.x, c.y));
}

const MIN_DISTANCE = 22;
const MAX_DISTANCE = 165;
const PITCH = 0.98; // about 56 degrees

/** The home island's camera: always facing north, panned and zoomed by the player. */
class HomeCamera {
  readonly focus = new THREE.Vector3(0, PLATEAU, 9);
  distance = 88;
  private readonly smoothFocus = this.focus.clone();
  private smoothDistance = this.distance;
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLATEAU);

  constructor(private readonly stage: Stage) {}

  pan(dx: number, dy: number): void {
    const fov = THREE.MathUtils.degToRad(this.stage.camera.fov);
    const perPixel = (2 * this.smoothDistance * Math.tan(fov / 2)) / this.stage.height;
    this.focus.x = clamp(this.focus.x - dx * perPixel, -50, 50);
    this.focus.z = clamp(this.focus.z - (dy * perPixel) / Math.sin(PITCH), -100, 38);
  }

  zoom(factor: number): void {
    this.distance = clamp(this.distance * factor, MIN_DISTANCE, MAX_DISTANCE);
  }

  /** Points the camera at a world spot (meters), e.g. a zone's center. */
  lookAt(x: number, y: number): void {
    this.focus.x = clamp(x, -50, 50);
    this.focus.z = clamp(y, -100, 38);
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 10);
    // Rise and fall with the terrace being looked at.
    this.focus.y = Math.max(PLATEAU, homeHeight(this.focus.x, this.focus.z));
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

  /** The ground point under a screen position: the nearest terrace the ray lands on, or null. */
  groundPoint(clientX: number, clientY: number, rect: DOMRect): Vec2 | null {
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.stage.camera);
    const hit = new THREE.Vector3();
    let best: Vec2 | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const zone of ZONES) {
      this.plane.constant = -zone.height;
      if (!this.raycaster.ray.intersectPlane(this.plane, hit)) continue;
      const b = zoneBounds(zone);
      const margin = 4;
      const inside =
        hit.x >= b.x - margin &&
        hit.x <= b.x + b.w + margin &&
        hit.z >= b.y - margin &&
        hit.z <= b.y + b.h + margin;
      const d = hit.distanceTo(this.raycaster.ray.origin);
      if (inside && d < bestDistance) {
        best = vec(hit.x, hit.z);
        bestDistance = d;
      }
    }
    if (best) return best;
    this.plane.constant = -PLATEAU;
    return this.raycaster.ray.intersectPlane(this.plane, hit) ? vec(hit.x, hit.z) : null;
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
  private readonly island: HomeIslandView;
  private readonly blocks = new Map<string, { group: THREE.Group; key: string }>();
  private readonly previewGroup = new THREE.Group();
  private previewKey = "";
  private readonly tilesMaterial = new THREE.MeshBasicMaterial({
    color: 0x5fe08a,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  private readonly tiles: THREE.Mesh;
  private readonly selection: THREE.Mesh;
  private readonly tags = new Map<string, HTMLDivElement>();

  constructor(
    private readonly stage: Stage,
    private readonly labelLayer: HTMLElement,
  ) {
    this.camera = new HomeCamera(stage);
    this.island = buildHomeIsland();
    this.root.add(this.island.root, this.previewGroup);

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
      }),
    );
    this.selection.renderOrder = 2;
    this.selection.visible = false;
    this.root.add(this.selection);
  }

  /** Mirrors the layout: adds, moves and removes building blocks. */
  sync(layout: CrewLayout, hiddenId: string | null, holders: readonly Holder[]): void {
    const live = new Set<string>();
    for (const b of layout.buildings) {
      live.add(b.id);
      const key = `${b.type}|${b.rotated}`;
      let entry = this.blocks.get(b.id);
      if (!entry || entry.key !== key) {
        if (entry) this.root.remove(entry.group);
        entry = { group: blockModel(b.type, b.rotated), key };
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
    this.island.setGridEmphasis(preview !== null);
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
      const ghost = blockModel(b.type, b.rotated);
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
        groundFor(b) + BLOCK_HEIGHT[b.type] + 1.2,
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

  update(dt: number, time: number): void {
    this.camera.update(dt);
    this.island.update(
      time,
      this.stage.fog,
      this.stage.sun.position.clone().sub(this.stage.sun.target.position).normalize(),
    );
  }

  setUnlocked(count: number): void {
    this.unlocked = count;
    this.island.setUnlocked(count);
  }

  private unlocked = 1;

  /** Where each zone's center appears on screen (CSS pixels), for the lock and unlock labels. */
  zoneScreenPositions(): { id: number; x: number; y: number; visible: boolean }[] {
    return ZONES.map((zone) => {
      const b = zoneBounds(zone);
      // Open zones get their name at the front edge, out of the buildings' way; locked ones in
      // the middle, where the Unlock button goes.
      const anchorY = zone.id <= this.unlocked ? b.y + b.h - 1.5 : b.y + b.h / 2;
      const p = new THREE.Vector3(b.x + b.w / 2, zone.height + 1, anchorY).project(
        this.stage.camera,
      );
      const x = ((p.x + 1) / 2) * this.stage.width;
      const y = ((1 - p.y) / 2) * this.stage.height;
      const visible = p.z < 1 && x > 0 && x < this.stage.width && y > 0 && y < this.stage.height;
      return { id: zone.id, x, y, visible };
    });
  }

  /** Building label for menus. */
  static label(type: BuildingType): string {
    return BUILDINGS[type].label;
  }

  dispose(): void {
    for (const tag of this.tags.values()) tag.remove();
    this.tags.clear();
    this.island.dispose();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
