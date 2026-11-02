// The home island's overgrowth: every obstacle the crew hasn't cleared yet, drawn with the same
// swaying plants and mossy rocks as a raid island's jungle, in the same culled chunks. Thickets
// are bushes and ferns, groves are palms, dense jungle is broadleaf trees, rocks are a few stones
// and a boulder is one huge rock. A soft shade texture darkens the ground under it all, and
// lifts as patches are cleared. Open ground gets the raid island's grass tufts and flowers.
// Also the gold outline on a tapped obstacle and the burst of leaves or chips when one is cleared.

import * as THREE from "three";
import {
  buildableTiles,
  type CrewLayout,
  footprint,
  GRID_ORIGIN,
  type Obstacle,
  obstacleById,
  obstacles,
  TILE,
} from "../logic/crewIsland";
import { homeHeight } from "../logic/island";
import { createRng } from "../logic/rng";
import {
  bushGeometry,
  chunked,
  elephantEarGeometry,
  fernGeometry,
  flowerGeometry,
  jungleTreeGeometry,
  type PropInstance,
  palmGeometry,
  pebblesGeometry,
  rockGeometry,
  swaying,
  tuftGeometry,
} from "./props";
import type { SceneryMap } from "./scenery";
import { vertexColored } from "./shapes";
import { SHADE_HALF } from "./terrain";

const KINDS = [
  "palm",
  "tree",
  "ear",
  "fern",
  "bush",
  "rock",
  "pebbles",
  "tuft",
  "red",
  "yellow",
  "white",
] as const;
type Kind = (typeof KINDS)[number];

let geometries: Record<Kind, THREE.BufferGeometry> | null = null;

function shapes(): Record<Kind, THREE.BufferGeometry> {
  geometries ??= {
    palm: palmGeometry(),
    tree: jungleTreeGeometry(),
    ear: elephantEarGeometry(),
    fern: fernGeometry(),
    bush: bushGeometry(),
    rock: rockGeometry(),
    pebbles: pebblesGeometry(),
    tuft: tuftGeometry(),
    red: flowerGeometry(0xff5a6e, 0xffe066),
    yellow: flowerGeometry(0xffd23f, 0xff8a1c),
    white: flowerGeometry(0xf4f1ff, 0xffc93a),
  };
  return geometries;
}

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** What grows on one obstacle, spread over its tiles. */
function plantsFor(o: Obstacle, out: Record<Kind, PropInstance[]>): void {
  const rng = createRng(hash(o.id));
  const x0 = GRID_ORIGIN.x + o.x * TILE;
  const y0 = GRID_ORIGIN.y + o.y * TILE;
  const w = o.w * TILE;
  const h = o.h * TILE;
  const put = (kind: Kind, size: number, squash = 1, inset = 0.15) => {
    out[kind].push({
      x: x0 + w * (inset + rng() * (1 - inset * 2)),
      y: y0 + h * (inset + rng() * (1 - inset * 2)),
      rotation: rng() * Math.PI * 2,
      scale: new THREE.Vector3(size, size * squash, size),
    });
  };
  const many = (kind: Kind, count: number, min: number, spread: number, inset = 0.05) => {
    for (let i = 0; i < count; i++) put(kind, min + rng() * spread, 1, inset);
  };
  switch (o.kind) {
    case "brush":
      put("bush", 0.7 + rng() * 0.3, 1, 0.3);
      put("fern", 0.9 + rng() * 0.3, 1, 0.1);
      break;
    case "thicket":
      many("bush", 2, 1, 0.6);
      many("fern", 3, 0.9, 0.5);
      break;
    case "grove":
      many("palm", 2, 0.95, 0.45, 0.2);
      put("bush", 1.1 + rng() * 0.4);
      put("ear", 1 + rng() * 0.5);
      many("fern", 4, 0.9, 0.5);
      break;
    case "rocks":
      put("rock", 1 + rng() * 0.5, 0.9);
      put("rock", 0.7 + rng() * 0.4, 0.9);
      put("pebbles", 1.3, 1, 0.1);
      many("fern", 2, 0.8, 0.4);
      break;
    case "jungle":
      many("tree", 3, 1.05, 0.6, 0.16);
      many("ear", 2, 1.1, 0.6);
      many("fern", 5, 1, 0.5);
      break;
    case "boulder":
      out.rock.push({
        x: x0 + w / 2,
        y: y0 + h / 2,
        rotation: rng() * Math.PI * 2,
        scale: new THREE.Vector3(2.6, 2.2, 2.4),
      });
      many("pebbles", 2, 1.1, 0.4);
      many("fern", 3, 0.9, 0.4);
      break;
  }
}

interface Chip {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
}

const SHADE_SIZE = 128;
const DETAIL_DISTANCE = 95;

function disposeInstances(group: THREE.Group): void {
  group.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) o.dispose();
  });
}

export class OvergrowthView {
  readonly root = new THREE.Group();
  /** The ground shade: red is jungle floor, green is stony ground (see TerrainOptions). */
  readonly shade: THREE.DataTexture;
  private readonly shadeData = new Uint8Array(SHADE_SIZE * SHADE_SIZE * 4);
  private readonly plants = new THREE.Group();
  /** The small plants, which a zoomed-out camera can't make out anyway. */
  private readonly detail = new THREE.Group();
  private key = "";
  private readonly mark: THREE.Mesh;
  private readonly chips: Chip[] = [];
  private readonly chipGeometry = new THREE.BoxGeometry(0.22, 0.22, 0.08);
  private readonly leafMaterial = new THREE.MeshLambertMaterial({ color: 0x5cbb4c });
  private readonly stoneMaterial = new THREE.MeshLambertMaterial({ color: 0xa8a293 });

  constructor(private readonly map: SceneryMap) {
    this.shade = new THREE.DataTexture(this.shadeData, SHADE_SIZE, SHADE_SIZE, THREE.RGBAFormat);
    this.shade.magFilter = THREE.LinearFilter;
    this.shade.minFilter = THREE.LinearFilter;
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    this.mark = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        color: 0xffd84a,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.mark.renderOrder = 2;
    this.mark.visible = false;
    this.root.add(this.plants, this.detail, this.mark);
  }

  /** Redraws the plants and shade when obstacles are cleared or buildings change. */
  sync(layout: Pick<CrewLayout, "cleared" | "buildings">): void {
    const { cleared, buildings } = layout;
    const key = `${cleared.length}:${cleared[cleared.length - 1] ?? ""}:${buildings
      .map((b) => `${b.id}${b.x}.${b.y}.${b.rotated}`)
      .join()}`;
    if (key === this.key) return;
    this.key = key;
    disposeInstances(this.plants);
    disposeInstances(this.detail);
    this.plants.clear();
    this.detail.clear();

    const done = new Set(cleared);
    const out = Object.fromEntries(KINDS.map((k) => [k, []])) as unknown as Record<
      Kind,
      PropInstance[]
    >;
    const covered = new Set<string>();
    this.shadeData.fill(0);
    for (const o of obstacles()) {
      if (done.has(o.id)) continue;
      plantsFor(o, out);
      const stony = o.kind === "rocks" || o.kind === "boulder";
      for (let ty = o.y; ty < o.y + o.h; ty++) {
        for (let tx = o.x; tx < o.x + o.w; tx++) {
          covered.add(`${tx},${ty}`);
          this.paintShade(tx, ty, stony ? 1 : 0, stony ? 120 : 255);
        }
      }
    }
    this.shade.needsUpdate = true;
    for (const b of buildings) {
      const { w, h } = footprint(b.type, b.rotated);
      for (let ty = b.y; ty < b.y + h; ty++)
        for (let tx = b.x; tx < b.x + w; tx++) covered.add(`${tx},${ty}`);
    }
    this.growOpenGround(covered, out);

    const g = shapes();
    // Nothing here hides a hero, so none of it needs the dissolve.
    const sway = swaying(false);
    const still = vertexColored();
    const add = (kind: Kind, shadow: boolean, material: THREE.Material, small = false) =>
      (small ? this.detail : this.plants).add(
        chunked(g[kind], out[kind], shadow, material, homeHeight),
      );
    // Only the tall plants cast shadows: the rest would double their cost for little you can see.
    add("palm", true, sway);
    add("tree", true, sway);
    add("ear", false, sway);
    add("bush", false, sway);
    add("rock", false, still);
    add("fern", false, sway, true);
    add("pebbles", false, still, true);
    add("tuft", false, sway, true);
    add("red", false, sway, true);
    add("yellow", false, sway, true);
    add("white", false, sway, true);
  }

  /** Leaves out the smallest plants once the camera is this far back. */
  setDistance(distance: number): void {
    this.detail.visible = distance < DETAIL_DISTANCE;
  }

  private paintShade(tx: number, ty: number, channel: number, amount: number): void {
    const x = GRID_ORIGIN.x + (tx + 0.5) * TILE;
    const y = GRID_ORIGIN.y + (ty + 0.5) * TILE;
    const i = Math.floor(((x + SHADE_HALF) / (SHADE_HALF * 2)) * SHADE_SIZE);
    const j = Math.floor(((y + SHADE_HALF) / (SHADE_HALF * 2)) * SHADE_SIZE);
    if (i < 0 || j < 0 || i >= SHADE_SIZE || j >= SHADE_SIZE) return;
    this.shadeData[(j * SHADE_SIZE + i) * 4 + channel] = amount;
  }

  /** Grass tufts, ferns and flowers on free tiles, the same on every phone. */
  private growOpenGround(covered: Set<string>, out: Record<Kind, PropInstance[]>): void {
    const rng = createRng(0x51a7);
    const flowers = ["red", "yellow", "white"] as const;
    for (const t of buildableTiles()) {
      // Always draw the same numbers per tile, so each tile keeps its plants as things change.
      const [roll, a, b, size, turn] = [rng(), rng(), rng(), rng(), rng()];
      if (covered.has(`${t.x},${t.y}`) || roll > 0.5) continue;
      const x = GRID_ORIGIN.x + (t.x + a) * TILE;
      const y = GRID_ORIGIN.y + (t.y + b) * TILE;
      if (this.map.trail(x, y) < 2.2) continue;
      const kind: Kind =
        roll < 0.36 ? "tuft" : roll < 0.43 ? "fern" : (flowers[Math.floor(a * 3)] ?? "tuft");
      out[kind].push({
        x,
        y,
        rotation: turn * Math.PI * 2,
        scale: new THREE.Vector3().setScalar(0.7 + size * 0.7),
      });
    }
  }

  /** Outlines the obstacle whose clearing panel is open. */
  highlight(id: string | null): void {
    const o = id ? obstacleById(id) : undefined;
    this.mark.visible = !!o;
    if (!o) return;
    const cx = GRID_ORIGIN.x + (o.x + o.w / 2) * TILE;
    const cy = GRID_ORIGIN.y + (o.y + o.h / 2) * TILE;
    this.mark.scale.set(o.w * TILE + 0.4, 1, o.h * TILE + 0.4);
    this.mark.position.set(cx, homeHeight(cx, cy) + 0.08, cy);
  }

  /** A burst of leaves (or stone chips) flying off a cleared obstacle. */
  burst(o: Obstacle): void {
    const cx = GRID_ORIGIN.x + (o.x + o.w / 2) * TILE;
    const cy = GRID_ORIGIN.y + (o.y + o.h / 2) * TILE;
    const stony = o.kind === "rocks" || o.kind === "boulder";
    for (let i = 0; i < 26; i++) {
      const mesh = new THREE.Mesh(
        this.chipGeometry,
        stony ? this.stoneMaterial : this.leafMaterial,
      );
      mesh.position.set(
        cx + (Math.random() - 0.5) * o.w * TILE,
        homeHeight(cx, cy) + 0.5 + Math.random(),
        cy + (Math.random() - 0.5) * o.h * TILE,
      );
      this.root.add(mesh);
      this.chips.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          4 + Math.random() * 5,
          (Math.random() - 0.5) * 6,
        ),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 1.1 + Math.random() * 0.4,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const c = this.chips[i];
      if (!c) continue;
      c.life -= dt;
      c.velocity.y -= 14 * dt;
      c.mesh.position.addScaledVector(c.velocity, dt);
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.scale.setScalar(Math.max(0.01, Math.min(1, c.life * 2)));
      if (c.life <= 0) {
        this.root.remove(c.mesh);
        this.chips.splice(i, 1);
      }
    }
  }

  dispose(): void {
    disposeInstances(this.plants);
    disposeInstances(this.detail);
    this.shade.dispose();
    this.chipGeometry.dispose();
    this.leafMaterial.dispose();
    this.stoneMaterial.dispose();
    this.mark.geometry.dispose();
    (this.mark.material as THREE.Material).dispose();
  }
}
