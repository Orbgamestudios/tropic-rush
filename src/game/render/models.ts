// Placeholder models built from rounded primitives at the design doc's real sizes. Each one is
// a stand-in for a GLB model from the art pipeline; swap them one at a time as models arrive.
// Models face +x (east); the view rotates them to the logic's facing angle.

import * as THREE from "three";
import type { BuildingType } from "../logic/buildings";
import { COLORS, material } from "./palette";
import { at, ball, barrel, cone, cyl, flatten, mesh, rbox } from "./shapes";

export interface BuildingModel {
  root: THREE.Group;
  /** Turns to face the defense's target. */
  head: THREE.Object3D | null;
  /** Shown while a flamethrower is firing. */
  flame: THREE.Object3D | null;
}

const C = COLORS;

/** Enemy paint becomes crew paint on the crew's own buildings: rust to blue, charcoal to steel. */
export const CREW_PAINT = new Map<number, number>([
  [COLORS.enemyRust, COLORS.crewBlue],
  [COLORS.enemyDark, 0x55657e],
]);

/** Repaints a building in crew colors. */
function paintCrew(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const paint = CREW_PAINT.get((o.material as THREE.MeshLambertMaterial).color?.getHex());
    if (paint !== undefined) o.material = material(paint);
  });
}

function flameCone(length: number): THREE.Mesh {
  const geometry = new THREE.ConeGeometry(length * 0.22, length, 14, 1, true);
  geometry.rotateZ(Math.PI / 2);
  geometry.translate(length / 2, 0, 0);
  const m = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xffa23a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  m.visible = false;
  return m;
}

/** Widens a model to its footprint, and how much of that height it takes on: [across, up]. */
const STRETCH: Partial<Record<BuildingType, readonly [number, number]>> = {
  goldMine: [1.55, 1.2],
  lumberCamp: [1.6, 1.2],
  quarry: [1.7, 1.2],
  scrapYard: [1.7, 1.2],
  refinery: [1.6, 1],
  storehouse: [1.2, 1],
  goldVault: [1.2, 1],
  timberShed: [1.2, 1],
  stoneYard: [1.2, 1],
  scrapBin: [1.2, 1],
};

function stretch(root: THREE.Object3D, across: number, up: number): void {
  const wrap = new THREE.Group();
  wrap.scale.set(across, up, across);
  wrap.add(...root.children);
  root.add(wrap);
}

const templates = new Map<string, BuildingModel>();

/**
 * A building, in enemy paint or the crew's. Each one is baked into a mesh or two the first time
 * it's asked for and shared from then on, so a whole base draws in a handful of calls.
 */
export function buildingModel(type: BuildingType, crew = false): BuildingModel {
  const key = `${type}|${crew}`;
  let template = templates.get(key);
  if (!template) {
    template = makeBuilding(type);
    const stretched = STRETCH[type];
    if (stretched) stretch(template.root, stretched[0], stretched[1]);
    if (crew) paintCrew(template.root);
    flatten(template.root, template.head);
    if (template.head) flatten(template.head, template.flame);
    templates.set(key, template);
  }
  const root = template.root.clone(true);
  return {
    root,
    head: root.getObjectByName("head") ?? null,
    flame: root.getObjectByName("flame") ?? null,
  };
}

function makeBuilding(type: BuildingType): BuildingModel {
  const root = new THREE.Group();
  let head: THREE.Object3D | null = null;
  let flame: THREE.Object3D | null = null;
  switch (type) {
    case "headquarters": {
      root.add(at(rbox(7.4, 3.2, 7.4, C.enemyDark), 0, 1.6, 0));
      root.add(at(rbox(7.8, 0.6, 7.8, C.enemyRust), 0, 2.7, 0));
      root.add(at(rbox(4.8, 1.6, 4.8, C.enemyDark), 0, 3.7, 0));
      root.add(at(rbox(5.1, 0.4, 5.1, C.enemyRust), 0, 4.6, 0));
      for (const [x, z] of [
        [3.5, 3.5],
        [-3.5, 3.5],
        [3.5, -3.5],
        [-3.5, -3.5],
      ] as const) {
        root.add(at(cyl(1.15, 1.3, 4.6, C.enemyDark, 14), x, 2.3, z));
        root.add(at(cone(1.4, 1.2, C.enemyRust, 14), x, 5.2, z));
      }
      root.add(at(rbox(2.4, 2.4, 0.5, C.woodDark), 0, 1.2, 3.75));
      // A railing round the roof deck.
      for (let i = -2; i <= 2; i++) {
        for (const side of [-1, 1]) {
          root.add(at(cyl(0.04, 0.04, 0.5, C.metal, 6), i * 1.1, 5.05, side * 2.35));
          root.add(at(cyl(0.04, 0.04, 0.5, C.metal, 6), side * 2.35, 5.05, i * 1.1));
        }
      }
      for (const side of [-1, 1]) {
        root.add(at(rbox(4.8, 0.07, 0.07, C.metal), 0, 5.3, side * 2.35));
        root.add(at(rbox(0.07, 0.07, 4.8, C.metal), side * 2.35, 5.3, 0));
      }
      // The radar dish on its mast, tipped to the sky, and a radio mast beside it.
      root.add(at(cyl(0.18, 0.24, 0.6, C.metal, 10), -0.7, 5.05, -0.5));
      const dish = mesh(new THREE.SphereGeometry(0.9, 18, 8, 0, Math.PI * 2, 0, 1.1), C.tin);
      dish.material = new THREE.MeshLambertMaterial({ color: C.tin, side: THREE.DoubleSide });
      root.add(at(dish, -0.7, 6.05, -0.5, Math.PI - 0.6, 0, 0.4));
      root.add(at(cyl(0.06, 0.06, 0.5, C.darkMetal, 6), -0.7, 5.5, -0.5));
      root.add(at(cyl(0.07, 0.07, 1.8, C.metal, 8), 1.2, 5.6, 1));
      root.add(at(rbox(1.2, 0.6, 0.07, C.enemyRust), 1.85, 6.15, 1));
      // Supplies by the door.
      root.add(at(rbox(0.8, 0.8, 0.8, C.woodLight), 2.3, 0.4, 4.3));
      root.add(at(cyl(0.34, 0.34, 0.9, C.enemyRust, 12), -2.2, 0.45, 4.3));
      break;
    }
    case "gunTurret": {
      root.add(at(cyl(1.05, 1.3, 2.6, C.enemyDark), 0, 1.3, 0));
      head = at(new THREE.Group(), 0, 3.15, 0);
      head.add(rbox(1.8, 1.25, 1.6, C.enemyRust));
      head.add(at(barrel(0.14, 1.9, C.darkMetal), 0.8, 0.1, 0.28));
      head.add(at(barrel(0.14, 1.9, C.darkMetal), 0.8, 0.1, -0.28));
      head.add(at(cyl(0.05, 0.05, 1, C.metal, 6), -0.5, 1, 0));
      root.add(head);
      break;
    }
    case "mortar": {
      root.add(at(cyl(1.6, 1.6, 0.12, C.woodDark, 20), 0, 0.06, 0));
      head = at(new THREE.Group(), 0, 0.5, 0);
      head.add(cyl(0.55, 0.7, 0.4, C.enemyDark));
      const tube = at(barrel(0.38, 3, C.enemyDark), 0, 0.2, 0, 0, 0, 0.95);
      head.add(tube);
      head.add(at(cyl(0.42, 0.42, 0.25, C.enemyRust), 0.62, 0.68, 0, 0, 0, 0.95 - Math.PI / 2));
      root.add(head);
      root.add(at(rbox(0.7, 0.5, 0.5, C.olive), -1.1, 0.25, 0.7));
      break;
    }
    case "harpoon": {
      root.add(at(rbox(2.6, 1.2, 2.6, C.enemyDark), 0, 0.6, 0));
      root.add(at(cyl(0.35, 0.45, 1.2, C.enemyDark), 0, 1.7, 0));
      head = at(new THREE.Group(), 0, 2.5, 0);
      head.add(at(rbox(2.8, 0.45, 0.6, C.enemyRust), 0.2, 0, 0));
      head.add(at(rbox(0.3, 0.3, 3.2, C.woodDark), 1.3, 0.1, 0));
      head.add(at(barrel(0.07, 3.2, C.darkMetal), -0.6, 0.35, 0));
      const tip = at(cone(0.2, 0.55, C.metal, 10), 2.85, 0.35, 0, 0, 0, -Math.PI / 2);
      head.add(tip);
      root.add(head);
      break;
    }
    case "flamethrower": {
      root.add(at(cyl(1.05, 1.35, 2.8, C.enemyDark), 0, 1.4, 0));
      root.add(at(ball(0.95, C.enemyRust), 0, 3.4, 0));
      head = at(new THREE.Group(), 0, 2.9, 0);
      head.add(at(barrel(0.18, 1.7, C.darkMetal), 0.4, 0, 0));
      flame = at(flameCone(9.5), 2.1, 0, 0);
      head.add(flame);
      root.add(head);
      break;
    }
    case "watchtower": {
      for (const [x, z] of [
        [1.1, 1.1],
        [-1.1, 1.1],
        [1.1, -1.1],
        [-1.1, -1.1],
      ] as const) {
        root.add(
          at(cyl(0.15, 0.2, 7.4, C.bamboo, 8), x * 1.1, 3.7, z * 1.1, z * 0.05, 0, -x * 0.05),
        );
        root.add(at(cyl(0.08, 0.08, 4.2, C.bamboo, 6), x * 0.95, 8.5, z * 0.95));
      }
      for (const y of [2.4, 5]) {
        root.add(at(cyl(0.07, 0.07, 2.6, C.bamboo, 6), 0, y, 1.15, 0, 0, Math.PI / 2));
        root.add(at(cyl(0.07, 0.07, 2.6, C.bamboo, 6), 0, y, -1.15, 0, 0, Math.PI / 2));
      }
      // Cross-braces between the legs, and a ladder up the front.
      for (const side of [1, -1]) {
        for (const lean of [0.72, -0.72]) {
          root.add(at(cyl(0.05, 0.05, 3.3, C.woodDark, 6), 0, 3.7, side * 1.22, 0, 0, lean));
          root.add(at(cyl(0.05, 0.05, 3.3, C.woodDark, 6), side * 1.22, 3.7, 0, lean, 0, 0));
        }
      }
      for (const z of [0.3, -0.3]) root.add(at(cyl(0.05, 0.05, 7.2, C.wood, 6), 1.5, 3.6, z));
      for (let y = 0.6; y < 7; y += 0.75)
        root.add(at(cyl(0.04, 0.04, 0.6, C.wood, 6), 1.5, y, 0, Math.PI / 2, 0, 0));
      root.add(at(rbox(3.4, 0.35, 3.4, C.wood), 0, 7.4, 0));
      root.add(at(rbox(3.4, 0.6, 0.15, C.bamboo), 0, 8, 1.65));
      root.add(at(rbox(3.4, 0.6, 0.15, C.bamboo), 0, 8, -1.65));
      root.add(at(rbox(0.15, 0.6, 3.4, C.bamboo), 1.65, 8, 0));
      const roof = at(cone(2.9, 1.5, C.tin, 4), 0, 11.1, 0, 0, Math.PI / 4, 0);
      root.add(roof);
      break;
    }
    case "goldMine": {
      const mound = at(ball(2.9, C.stone, 18), 0, -0.6, -0.4);
      mound.scale.set(1, 0.75, 0.9);
      root.add(mound);
      root.add(at(rbox(1.9, 2.1, 0.7, C.woodDark), 0, 1.05, 2.1));
      root.add(at(rbox(1.3, 1.6, 0.3, 0x2b2420), 0, 0.85, 2.4));
      for (let i = 0; i < 6; i++) {
        root.add(
          at(
            ball(0.32, C.gold, 10),
            1.6 + (i % 3) * 0.45,
            0.3 + Math.floor(i / 3) * 0.35,
            2 + (i % 2) * 0.3,
          ),
        );
      }
      root.add(at(rbox(1.2, 0.7, 0.8, C.enemyRust), -1.8, 0.5, 2.2));
      break;
    }
    case "lumberCamp": {
      root.add(at(rbox(3.4, 2.4, 2.6, C.enemyDark), -0.6, 1.2, -0.8));
      root.add(at(rbox(3.8, 0.25, 3, C.tin), -0.6, 2.55, -0.8, 0.12, 0, 0));
      for (let i = 0; i < 6; i++) {
        const row = i < 3 ? 0 : 1;
        const col = row === 0 ? i : i - 3;
        root.add(
          at(
            barrel(0.33, 3.2, C.wood, 12),
            -1.6,
            0.35 + row * 0.58,
            1.1 + col * 0.66 + row * 0.33 - 0.33,
          ),
        );
      }
      root.add(at(rbox(0.8, 1.1, 0.8, C.enemyRust), 1.9, 0.55, 1.2));
      break;
    }
    case "quarry": {
      const spots = [
        [-1.2, 0, 0.8],
        [0.1, 0, 1.2],
        [1.3, 0, 0.6],
        [-0.5, 1, 0.9],
        [0.8, 1, 0.9],
        [-0.8, 0, -0.6],
      ] as const;
      for (const [x, layer, z] of spots)
        root.add(at(rbox(1.2, 1, 1.2, C.stone), x, 0.5 + layer, z, 0, x * 0.3, 0));
      root.add(at(cyl(0.18, 0.22, 3.2, C.enemyDark, 8), 1.6, 1.6, -1.4));
      root.add(at(rbox(2.8, 0.25, 0.25, C.enemyRust), 0.6, 3.1, -1.4, 0, 0, -0.15));
      break;
    }
    case "scrapYard": {
      const junk = [
        [0, 0.5, 0, 1.6, 1, 1.2, C.enemyRust],
        [1.2, 0.4, 0.9, 1, 0.8, 1, C.metal],
        [-1.1, 0.45, 0.8, 1.2, 0.9, 0.9, C.enemyDark],
        [-0.6, 1.1, -0.3, 0.9, 0.7, 0.9, C.metal],
        [0.9, 0.35, -1, 1.4, 0.7, 0.8, C.enemyDark],
      ] as const;
      junk.forEach(([x, y, z, w, h, d, color], i) => {
        root.add(at(rbox(w, h, d, color), x, y, z, 0.2 * i, 0.5 * i, 0.15 * i));
      });
      root.add(at(barrel(0.45, 1.3, C.enemyRust, 12), -1.8, 0.45, -1, 0, 0.6, 0));
      break;
    }
    case "storehouse": {
      root.add(at(rbox(4.4, 3.2, 3.6, C.enemyDark), 0, 1.6, 0));
      root.add(at(rbox(0.35, 3.35, 3.75, C.enemyRust), 1.2, 1.62, 0));
      root.add(at(rbox(0.35, 3.35, 3.75, C.enemyRust), -1.2, 1.62, 0));
      root.add(at(rbox(1.6, 2.2, 0.2, C.enemyRust), 0, 1.1, 1.82));
      break;
    }
    case "goldVault": {
      root.add(at(rbox(4.2, 2.8, 3.2, C.darkMetal), 0, 1.4, 0));
      root.add(at(rbox(4.4, 0.35, 3.4, C.enemyRust), 0, 2.9, 0));
      // The round vault door with a gold rim and spokes.
      const door = at(cyl(1, 1, 0.25, C.metal, 24), 0, 1.35, 1.66, Math.PI / 2, 0, 0);
      root.add(door);
      root.add(at(cyl(1.08, 1.08, 0.12, C.gold, 24), 0, 1.35, 1.62, Math.PI / 2, 0, 0));
      for (let i = 0; i < 3; i++)
        root.add(at(rbox(1.5, 0.12, 0.12, C.gold), 0, 1.35, 1.82, 0, 0, (i * Math.PI) / 3));
      // Gold bars stacked on the roof.
      for (let i = 0; i < 5; i++) {
        const row = i < 3 ? 0 : 1;
        const x = row === 0 ? (i - 1) * 0.75 : (i - 3.5) * 0.75;
        root.add(at(rbox(0.65, 0.32, 1.1, C.gold), x, 3.25 + row * 0.32, -0.4));
      }
      break;
    }
    case "timberShed": {
      for (const [x, z] of [
        [-2, -1.5],
        [2, -1.5],
        [-2, 1.5],
        [2, 1.5],
      ] as const)
        root.add(at(rbox(0.3, 3, 0.3, C.woodDark), x, 1.5, z));
      root.add(at(rbox(4.8, 0.22, 3.8, C.tin), 0, 3.1, 0, 0.14, 0, 0));
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 4 - row; i++) {
          root.add(
            at(barrel(0.36, 3.8, C.wood, 12), 0, 0.38 + row * 0.64, (i - (3 - row) / 2) * 0.74),
          );
        }
      }
      break;
    }
    case "stoneYard": {
      for (const [x, z, w, d] of [
        [0, -1.6, 4.4, 0.5],
        [-2, 0, 0.5, 3.2],
        [2, 0, 0.5, 3.2],
      ] as const)
        root.add(at(rbox(w, 0.9, d, C.stone), x, 0.45, z));
      const blocks = [
        [-0.8, 0, -0.3],
        [0.5, 0, -0.4],
        [-0.2, 0, 0.8],
        [0.9, 0, 0.7],
        [-0.2, 1, 0.1],
        [0.6, 1, 0.2],
      ] as const;
      for (const [x, layer, z] of blocks)
        root.add(at(rbox(1, 0.8, 1, C.stone), x, 0.4 + layer * 0.8, z, 0, x * 0.4, 0));
      root.add(at(cyl(0.16, 0.2, 3.6, C.woodDark, 8), -1.7, 1.8, 1.3));
      root.add(at(rbox(2.6, 0.2, 0.2, C.woodDark), -0.6, 3.5, 1.3, 0, 0, -0.1));
      root.add(at(cyl(0.03, 0.03, 1.4, C.metal, 6), 0.5, 2.8, 1.3));
      break;
    }
    case "scrapBin": {
      root.add(at(rbox(4, 1.6, 3, C.enemyRust), 0, 0.8, 0));
      root.add(at(rbox(3.5, 0.2, 2.5, C.darkMetal), 0, 1.55, 0));
      const junk = [
        [-0.9, 1.8, -0.4, 1, 0.7, 0.8, C.metal],
        [0.6, 1.9, 0.3, 1.2, 0.6, 0.9, C.tin],
        [0.1, 2.3, -0.2, 0.8, 0.6, 0.7, C.enemyDark],
        [-0.5, 2.1, 0.7, 0.7, 0.5, 0.6, C.metal],
      ] as const;
      junk.forEach(([x, y, z, w, h, d, color], i) => {
        root.add(at(rbox(w, h, d, color), x, y, z, 0.3 * i, 0.6 * i, 0.2 * i));
      });
      root.add(at(barrel(0.12, 2.4, C.metal, 8), 0.9, 2.6, -0.5, 0.4, 0.3, 0.9));
      root.add(at(barrel(0.42, 1.2, C.enemyDark, 12), 2.4, 0.6, 1, 0, 0, 0));
      break;
    }
    case "refinery": {
      for (const z of [-1, 1]) {
        root.add(at(cyl(1.1, 1.1, 3, C.enemyDark), -0.8, 1.5, z * 1.2));
        root.add(at(cyl(1.15, 1.15, 0.3, C.enemyRust), -0.8, 2.2, z * 1.2));
      }
      root.add(at(cyl(0.5, 0.65, 6.5, C.enemyDark, 12), 1.5, 3.25, 0));
      root.add(at(cyl(0.58, 0.58, 0.5, C.enemyRust, 12), 1.5, 6.3, 0));
      root.add(at(barrel(0.18, 2.4, C.metal, 8), -0.6, 2.8, 0, 0, Math.PI / 2, 0));
      break;
    }
  }
  if (head) head.name = "head";
  if (flame) flame.name = "flame";
  return { root, head, flame };
}

export function rubbleModel(radius: number): THREE.Group {
  const g = new THREE.Group();
  const pieces = Math.max(4, Math.round(radius * 2.2));
  for (let i = 0; i < pieces; i++) {
    const angle = (i / pieces) * Math.PI * 2 + i;
    const r = radius * (0.25 + ((i * 37) % 10) / 16);
    const size = 0.5 + ((i * 53) % 10) / 12;
    const color = i % 4 === 0 ? COLORS.enemyRust : i % 2 === 0 ? 0x4b4f57 : 0x5d6068;
    g.add(
      at(
        rbox(size * 1.4, size * 0.6, size, color),
        Math.cos(angle) * r,
        size * 0.25,
        Math.sin(angle) * r,
        i,
        i * 2,
        i * 0.5,
      ),
    );
  }
  flatten(g);
  return g;
}

// Heroes live in heroModels.ts.
export { type HeroModel, heroModel } from "./heroModels";

// ---------------------------------------------------------------------------------------------
// Gunboat, crew turret, mine

export function gunboatModel(): { root: THREE.Group; cannon: THREE.Object3D } {
  const shape = new THREE.Shape();
  shape.moveTo(-2.9, -1.25);
  shape.lineTo(1.7, -1.25);
  shape.quadraticCurveTo(3, -0.9, 3.4, 0);
  shape.quadraticCurveTo(3, 0.9, 1.7, 1.25);
  shape.lineTo(-2.9, 1.25);
  shape.lineTo(-2.9, -1.25);
  const hullGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1.1,
    bevelEnabled: true,
    bevelSize: 0.15,
    bevelThickness: 0.15,
    bevelSegments: 2,
  });
  hullGeometry.rotateX(-Math.PI / 2);
  const root = new THREE.Group();
  root.add(mesh(hullGeometry, C.wood));
  root.add(at(rbox(5.4, 0.12, 2.1, C.woodLight), 0.1, 1.15, 0));
  root.add(at(rbox(6.2, 0.2, 0.2, C.metal), 0.2, 1.25, 1.3));
  root.add(at(rbox(6.2, 0.2, 0.2, C.metal), 0.2, 1.25, -1.3));
  for (const x of [-1.5, 0.5]) {
    for (const z of [1.42, -1.42]) {
      root.add(
        at(
          new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 8, 16), material(0x2b2b2b)),
          x,
          0.8,
          z,
        ),
      );
    }
  }
  root.add(at(rbox(1.2, 0.6, 1.1, C.woodDark), -0.4, 1.5, 0));
  const cannon = at(new THREE.Group(), -0.4, 1.95, 0);
  cannon.add(at(barrel(0.32, 2.4, C.darkMetal, 16), -0.4, 0, 0));
  cannon.add(at(ball(0.42, C.darkMetal, 14), -0.4, 0, 0));
  root.add(cannon);
  flatten(root, cannon);
  flatten(cannon);
  return { root, cannon };
}

export function crewTurretModel(): { root: THREE.Group; head: THREE.Object3D } {
  const root = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    root.add(
      at(
        cyl(0.06, 0.06, 1, C.metal, 6),
        Math.cos(angle) * 0.35,
        0.45,
        Math.sin(angle) * 0.35,
        Math.sin(angle) * 0.45,
        0,
        -Math.cos(angle) * 0.45,
      ),
    );
  }
  const head = at(new THREE.Group(), 0, 1.05, 0);
  head.add(rbox(0.6, 0.45, 0.55, 0x587a99));
  head.add(at(barrel(0.07, 0.6, C.darkMetal, 8), 0.25, 0.02, 0.1));
  head.add(at(barrel(0.07, 0.6, C.darkMetal, 8), 0.25, 0.02, -0.1));
  root.add(head);
  return { root, head };
}

export function mineModel(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.45, 0.12, 14),
    new THREE.MeshLambertMaterial({
      color: 0x3a3a34,
      transparent: true,
      opacity: 0.35,
    }),
  );
  m.receiveShadow = true;
  return m;
}
