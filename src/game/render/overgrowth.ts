// The home island's overgrowth: every obstacle the crew hasn't cleared yet, drawn from the same
// swaying plants and mossy rocks as the raid islands. Thickets are bushes and ferns, groves are
// palms, dense jungle is broadleaf trees, rocks are a few stones and a boulder is one huge
// rock. Also the gold outline on a tapped obstacle and the burst of leaves or chips when one is
// cleared.

import * as THREE from "three";
import { GRID_ORIGIN, type Obstacle, obstacles, TILE } from "../logic/crewIsland";
import { createRng } from "../logic/rng";
import { homeHeight } from "./homeIsland";
import {
  bushGeometry,
  elephantEarGeometry,
  fernGeometry,
  instanced,
  jungleTreeGeometry,
  type PropInstance,
  palmGeometry,
  pebblesGeometry,
  rockGeometry,
  swaying,
} from "./props";
import { vertexColored } from "./shapes";

type Kind = "palm" | "tree" | "ear" | "fern" | "bush" | "rock" | "pebbles";

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
  const put = (kind: Kind, size: number, squash = 1, inset = 0.2) => {
    out[kind].push({
      x: x0 + w * (inset + rng() * (1 - inset * 2)),
      y: y0 + h * (inset + rng() * (1 - inset * 2)),
      rotation: rng() * Math.PI * 2,
      scale: new THREE.Vector3(size, size * squash, size),
    });
  };
  switch (o.kind) {
    case "brush":
      put("bush", 0.7 + rng() * 0.3, 1, 0.3);
      put("fern", 0.8 + rng() * 0.3, 1, 0.1);
      break;
    case "thicket":
      put("bush", 1.2 + rng() * 0.4);
      put("bush", 0.9 + rng() * 0.4);
      put("ear", 0.9 + rng() * 0.3);
      for (let i = 0; i < 3; i++) put("fern", 0.8 + rng() * 0.4, 1, 0.05);
      break;
    case "grove":
      for (let i = 0; i < 3; i++) put("palm", 0.75 + rng() * 0.3);
      put("bush", 1 + rng() * 0.4);
      for (let i = 0; i < 3; i++) put("fern", 0.9 + rng() * 0.4, 1, 0.05);
      break;
    case "rocks":
      put("rock", 0.9 + rng() * 0.4, 0.9);
      put("rock", 0.6 + rng() * 0.3, 0.9);
      put("pebbles", 1.2, 1, 0.1);
      break;
    case "jungle":
      for (let i = 0; i < 4; i++) put("tree", 0.7 + rng() * 0.35, 1, 0.18);
      for (let i = 0; i < 3; i++) put("ear", 1 + rng() * 0.4, 1, 0.08);
      for (let i = 0; i < 4; i++) put("fern", 1 + rng() * 0.4, 1, 0.05);
      break;
    case "boulder":
      out.rock.push({
        x: x0 + w / 2,
        y: y0 + h / 2,
        rotation: rng() * Math.PI * 2,
        scale: new THREE.Vector3(2.5, 2.1, 2.3),
      });
      put("pebbles", 1.4, 1, 0.05);
      put("pebbles", 1.1, 1, 0.05);
      break;
  }
}

interface Chip {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
}

export class OvergrowthView {
  readonly root = new THREE.Group();
  private readonly plants = new THREE.Group();
  /** Darker ground under each uncleared patch, so it reads as "not buildable yet". */
  private readonly patchGeometry = (() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  private readonly patchMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  private key = "";
  private readonly mark: THREE.Mesh;
  private readonly chips: Chip[] = [];
  private readonly chipGeometry = new THREE.BoxGeometry(0.22, 0.22, 0.08);
  private readonly leafMaterial = new THREE.MeshStandardMaterial({ color: 0x5cbb4c });
  private readonly stoneMaterial = new THREE.MeshStandardMaterial({ color: 0xa8a293 });

  constructor() {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    this.mark = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        color: 0xffd84a,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.mark.renderOrder = 2;
    this.mark.visible = false;
    this.root.add(this.plants, this.mark);
  }

  /** Redraws the plants when the set of cleared obstacles changes. */
  sync(cleared: readonly string[]): void {
    const key = `${cleared.length}:${cleared[cleared.length - 1] ?? ""}`;
    if (key === this.key) return;
    this.key = key;
    for (const child of this.plants.children) (child as THREE.InstancedMesh).dispose();
    this.plants.clear();
    const done = new Set(cleared);
    const out: Record<Kind, PropInstance[]> = {
      palm: [],
      tree: [],
      ear: [],
      fern: [],
      bush: [],
      rock: [],
      pebbles: [],
    };
    for (const o of obstacles()) if (!done.has(o.id)) plantsFor(o, out);
    const g = shapes();
    const sway = swaying();
    const ground = (x: number, y: number) => homeHeight(x, y);
    const open = obstacles().filter((o) => !done.has(o.id));
    const patches = new THREE.InstancedMesh(
      this.patchGeometry,
      this.patchMaterial,
      Math.max(1, open.length),
    );
    patches.count = open.length;
    patches.renderOrder = 1;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    open.forEach((o, i) => {
      const cx = GRID_ORIGIN.x + (o.x + o.w / 2) * TILE;
      const cy = GRID_ORIGIN.y + (o.y + o.h / 2) * TILE;
      m.makeScale(o.w * TILE - 0.15, 1, o.h * TILE - 0.15);
      m.setPosition(cx, homeHeight(cx, cy) + 0.05, cy);
      patches.setMatrixAt(i, m);
      const stony = o.kind === "rocks" || o.kind === "boulder";
      patches.setColorAt(
        i,
        color.set(stony ? 0x8a7f6a : o.kind === "jungle" ? 0x2f6b2c : 0x3f7f35),
      );
    });
    patches.instanceMatrix.needsUpdate = true;
    if (patches.instanceColor) patches.instanceColor.needsUpdate = true;
    this.plants.add(patches);
    this.plants.add(
      instanced(g.palm, out.palm, true, sway, ground),
      instanced(g.tree, out.tree, true, sway, ground),
      instanced(g.ear, out.ear, false, sway, ground),
      instanced(g.fern, out.fern, false, sway, ground),
      instanced(g.bush, out.bush, true, sway, ground),
      instanced(g.rock, out.rock, true, vertexColored(), ground),
      instanced(g.pebbles, out.pebbles, false, vertexColored(), ground),
    );
  }

  /** Outlines the obstacle whose clearing panel is open. */
  highlight(id: string | null): void {
    const o = id ? obstacles().find((x) => x.id === id) : undefined;
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
    for (const child of this.plants.children) (child as THREE.InstancedMesh).dispose();
    this.patchGeometry.dispose();
    this.patchMaterial.dispose();
    this.chipGeometry.dispose();
    this.leafMaterial.dispose();
    this.stoneMaterial.dispose();
    this.mark.geometry.dispose();
    (this.mark.material as THREE.Material).dispose();
  }
}
