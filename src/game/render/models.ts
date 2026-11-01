// Models built from primitives at the design doc's real sizes, detailed to follow the mockups:
// concrete and rust, wood, tin and brass, with bands, bolts, crates and pipes. Each one is a
// stand-in for a GLB model from the art pipeline. Every part is baked into one mesh per model, so
// the detail costs triangles but not draw calls.
// Models face +x (east); the view rotates them to the logic's facing angle.

import * as THREE from "three";
import type { BuildingType } from "../logic/buildings";
import { COLORS, material } from "./palette";
import { at, bake, ball, barrel, cone, cyl, plain, rbox, sandbagRing } from "./shapes";

export interface BuildingModel {
  root: THREE.Group;
  /** Turns to face the defense's target. */
  head: THREE.Object3D | null;
  /** Shown while a flamethrower is firing. */
  flame: THREE.Object3D | null;
}

const C = COLORS;

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

type Parent = THREE.Object3D;

/** A flat steel band round a cylinder. */
function band(p: Parent, radius: number, x: number, y: number, z: number, color: number): void {
  p.add(at(cyl(radius, radius, 0.16, color, 12), x, y, z));
}

/** A row of little bolt heads from one point to another. */
function bolts(
  p: Parent,
  [x0, y0, z0]: readonly [number, number, number],
  [x1, y1, z1]: readonly [number, number, number],
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    p.add(
      at(
        plain(0.1, 0.1, 0.1, C.darkMetal),
        x0 + (x1 - x0) * t,
        y0 + (y1 - y0) * t,
        z0 + (z1 - z0) * t,
      ),
    );
  }
}

function crate(p: Parent, x: number, y: number, z: number, s: number, turn = 0): void {
  p.add(at(plain(s, s, s, C.woodLight), x, y + s / 2, z, 0, turn, 0));
  p.add(at(plain(s + 0.04, s * 0.1, s + 0.04, C.wood), x, y + s * 0.8, z, 0, turn, 0));
  p.add(at(plain(s + 0.04, s * 0.1, s + 0.04, C.wood), x, y + s * 0.2, z, 0, turn, 0));
}

/** A plank wall facing +z: boards side by side with dark gaps. */
function planks(p: Parent, x: number, y: number, z: number, w: number, h: number): void {
  const boards = Math.round(w / 0.45);
  for (let i = 0; i < boards; i++) {
    const shade = i % 3 === 0 ? C.wood : i % 3 === 1 ? C.woodLight : 0x9a6d49;
    p.add(
      at(plain(w / boards - 0.04, h, 0.1, shade), x + (i - (boards - 1) / 2) * (w / boards), y, z),
    );
  }
}

/** A corrugated tin roof: ridges side by side. */
function tinRoof(
  p: Parent,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  tilt: number,
): void {
  const roof = at(new THREE.Group(), x, y, z, tilt, 0, 0);
  roof.add(plain(w, 0.1, d, C.tin));
  const ribs = Math.round(w / 0.5);
  for (let i = 0; i < ribs; i++)
    roof.add(at(plain(0.14, 0.12, d, 0x8d969c), (i - (ribs - 1) / 2) * (w / ribs), 0.08, 0));
  p.add(roof);
}

export function buildingModel(
  type: BuildingType,
  paint?: ReadonlyMap<number, number>,
): BuildingModel {
  const root = new THREE.Group();
  let head: THREE.Object3D | null = null;
  let flame: THREE.Object3D | null = null;
  switch (type) {
    case "headquarters": {
      // A concrete bunker with a rust trim, a lookout storey, a railed roof, radar and a mast.
      root.add(at(rbox(11, 0.7, 11, 0x4b5361), 0, 0.35, 0));
      root.add(at(rbox(10.2, 4.8, 10.2, C.enemyDark), 0, 2.9, 0));
      root.add(at(plain(10.6, 0.5, 10.6, C.enemyRust), 0, 5.4, 0));
      for (const [x, z] of [
        [5, 5],
        [-5, 5],
        [5, -5],
        [-5, -5],
      ] as const) {
        root.add(at(rbox(1.5, 6, 1.5, 0x4b5361), x, 3, z));
        root.add(at(plain(1.7, 0.4, 1.7, C.enemyRust), x, 6.1, z));
      }
      root.add(at(rbox(7.4, 3.6, 7.4, C.enemyDark), 0, 7.4, 0));
      root.add(at(plain(8, 0.5, 8, C.enemyRust), 0, 9.4, 0));
      // Dark window slits on every side of the upper storey.
      for (const side of [1, -1]) {
        for (const off of [-2.2, 0, 2.2]) {
          root.add(at(plain(1.5, 0.7, 0.1, 0x1c2430), off, 7.7, side * 3.72));
          root.add(at(plain(0.1, 0.7, 1.5, 0x1c2430), side * 3.72, 7.7, off));
        }
        bolts(root, [-4.4, 3.9, side * 5.14], [4.4, 3.9, side * 5.14], 7);
      }
      // A steel door in a rust frame, with steps and a lamp.
      root.add(at(plain(3.8, 4, 0.3, C.enemyRust), 0, 2, 5.15));
      root.add(at(plain(3.1, 3.5, 0.3, C.darkMetal), 0, 1.75, 5.3));
      root.add(at(plain(0.08, 3.5, 0.32, 0x2b303a), 0, 1.75, 5.32));
      for (let i = 0; i < 2; i++)
        root.add(at(plain(4.4 - i * 0.5, 0.24, 1, 0x4b5361), 0, 0.12 + i * 0.24, 6 - i * 0.4));
      // A railing round the roof deck.
      for (let i = -2; i <= 2; i++) {
        for (const side of [-1, 1]) {
          root.add(at(cyl(0.05, 0.05, 0.9, C.metal, 5), i * 1.8, 10.1, side * 3.8));
          root.add(at(cyl(0.05, 0.05, 0.9, C.metal, 5), side * 3.8, 10.1, i * 1.8));
        }
      }
      for (const side of [-1, 1]) {
        root.add(at(plain(7.7, 0.08, 0.08, C.metal), 0, 10.55, side * 3.8));
        root.add(at(plain(0.08, 0.08, 7.7, C.metal), side * 3.8, 10.55, 0));
      }
      // The radar dish tipped to the sky.
      root.add(at(cyl(0.5, 0.7, 0.6, C.darkMetal, 10), -1.2, 10, -1, 0, 0, 0));
      root.add(at(cyl(0.16, 0.2, 1.8, C.metal, 8), -1.2, 11, -1));
      const dish = at(new THREE.Group(), -1.2, 12.2, -1, 0.75, 0.5, 0);
      dish.add(cyl(1.8, 0.3, 0.55, 0xd3d8dc, 18));
      dish.add(at(cyl(0.04, 0.04, 1.3, C.darkMetal, 5), 0, 0.8, 0));
      dish.add(at(ball(0.13, C.enemyRust, 8), 0, 1.45, 0));
      root.add(dish);
      // A lattice mast with a little rust flag.
      for (const [x, z] of [
        [0.3, 0.3],
        [-0.3, 0.3],
        [0.3, -0.3],
        [-0.3, -0.3],
      ] as const)
        root.add(at(cyl(0.04, 0.05, 5, C.metal, 5), 2 + x, 12, 1.8 + z));
      for (let y = 10.3; y < 14; y += 0.9) root.add(at(plain(0.7, 0.05, 0.7, C.metal), 2, y, 1.8));
      root.add(at(plain(1.5, 0.9, 0.06, C.enemyRust), 2.8, 14, 1.8));
      // Supplies by the door.
      crate(root, 3.6, 0, 6.1, 1);
      crate(root, 3.7, 1, 6.1, 0.7, 0.4);
      root.add(at(cyl(0.42, 0.42, 1.1, C.enemyRust, 12), -3.2, 0.55, 6.1));
      band(root, 0.44, -3.2, 0.8, 6.1, C.darkMetal);
      break;
    }
    case "gunTurret": {
      root.add(sandbagRing(1.95, 3, C.sandbag));
      root.add(at(cyl(1.05, 1.35, 2.6, C.enemyDark, 12), 0, 1.3, 0));
      band(root, 1.24, 0, 0.7, 0, C.darkMetal);
      band(root, 1.12, 0, 2, 0, C.enemyRust);
      head = at(new THREE.Group(), 0, 3.15, 0);
      head.add(cyl(1, 1.1, 0.3, C.darkMetal, 14));
      head.add(at(rbox(1.9, 1, 1.7, C.enemyRust), 0, 0.5, 0));
      head.add(at(plain(1.2, 0.5, 1.2, C.enemyDark), -0.2, 1.15, 0));
      head.add(at(plain(0.1, 0.2, 1.1, 0x1c2430), 0.42, 1.2, 0));
      head.add(at(rbox(0.5, 0.7, 1.3, C.darkMetal), 0.95, 0.5, 0));
      for (const z of [0.3, -0.3]) {
        head.add(at(barrel(0.11, 2, C.darkMetal, 10), 1, 0.5, z));
        head.add(at(barrel(0.16, 0.4, 0x2b303a, 10), 2.75, 0.5, z));
      }
      head.add(at(cyl(0.04, 0.04, 1.1, C.metal, 5), -0.7, 1.7, 0.5));
      head.add(at(plain(0.5, 0.45, 0.6, C.olive), -0.7, 0.8, -0.95));
      bolts(head, [-0.8, 0.15, 0.87], [0.8, 0.15, 0.87], 5);
      bolts(head, [-0.8, 0.15, -0.87], [0.8, 0.15, -0.87], 5);
      root.add(head);
      break;
    }
    case "mortar": {
      root.add(sandbagRing(2.05, 3, C.sandbag));
      root.add(at(cyl(1.7, 1.7, 0.12, C.woodDark, 18), 0, 0.06, 0));
      head = at(new THREE.Group(), 0, 0.5, 0);
      head.add(cyl(0.75, 0.9, 0.3, C.darkMetal, 14));
      const tube = at(new THREE.Group(), 0, 0.2, 0, 0, 0, 0.95);
      tube.add(barrel(0.36, 3, C.enemyDark, 14));
      for (const x of [0.5, 1.5, 2.6]) tube.add(at(barrel(0.41, 0.16, C.darkMetal, 14), x, 0, 0));
      tube.add(at(barrel(0.46, 0.3, C.enemyRust, 14), 2.8, 0, 0));
      head.add(tube);
      // Bipod legs and the elevating screw.
      for (const z of [0.7, -0.7]) {
        const foot = new THREE.Vector3(1.5, -0.42, z);
        const top = new THREE.Vector3(1.05, 1.2, 0);
        const leg = cyl(0.06, 0.06, foot.distanceTo(top), C.darkMetal, 6);
        leg.position.copy(foot).add(top).multiplyScalar(0.5);
        leg.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          top.clone().sub(foot).normalize(),
        );
        head.add(leg);
      }
      root.add(head);
      crate(root, -1.05, 0.12, 0.75, 0.6, 0.3);
      for (const [x, z] of [
        [0.9, 1],
        [1.15, 0.8],
        [0.75, 0.72],
      ] as const) {
        root.add(at(cyl(0.11, 0.13, 0.55, C.olive, 8), x, 0.4, z));
        root.add(at(cone(0.11, 0.2, C.enemyRust, 8), x, 0.77, z));
      }
      break;
    }
    case "harpoon": {
      // A stepped concrete plinth carrying a great crossbow.
      root.add(at(rbox(3.2, 0.5, 3.2, 0x4b5361), 0, 0.25, 0));
      root.add(at(rbox(2.6, 0.9, 2.6, C.enemyDark), 0, 0.95, 0));
      bolts(root, [-1.1, 1.3, 1.32], [1.1, 1.3, 1.32], 5);
      root.add(at(plain(2.7, 0.14, 2.7, C.enemyRust), 0, 1.45, 0));
      root.add(at(cyl(0.42, 0.55, 1, C.darkMetal, 10), 0, 1.95, 0));
      head = at(new THREE.Group(), 0, 2.6, 0);
      head.add(at(rbox(3.2, 0.32, 0.5, C.enemyRust), 0.2, 0, 0));
      head.add(at(plain(1, 0.5, 0.9, C.enemyDark), -0.7, 0.05, 0));
      // Bow arms sweeping back, with the string to the rear.
      for (const side of [1, -1]) {
        head.add(
          at(plain(0.34, 0.26, 1.7, C.woodDark), 1.45, 0.08, side * 0.95, 0, side * 0.32, 0),
        );
        head.add(at(plain(0.2, 0.2, 0.6, C.metal), 1.15, 0.08, side * 1.9, 0, side * 0.32, 0));
        const string = cyl(0.02, 0.02, 2.6, 0xd8d0b8, 4);
        head.add(at(string, 0, 0.1, side * 0.95, 0, side * 0.72, Math.PI / 2));
      }
      head.add(at(barrel(0.07, 3.3, C.darkMetal, 8), -0.7, 0.26, 0));
      head.add(at(cone(0.2, 0.6, C.metal, 8), 2.85, 0.26, 0, 0, 0, -Math.PI / 2));
      for (const side of [1, -1])
        head.add(at(plain(0.34, 0.06, 0.1, C.metal), 2.55, 0.26, side * 0.2, 0, side * 0.7, 0));
      root.add(head);
      // A rack of spare harpoons at the back.
      for (let i = 0; i < 3; i++)
        root.add(at(barrel(0.05, 2, C.darkMetal, 6), -1, 1.6, -1 + i * 0.25));
      break;
    }
    case "flamethrower": {
      // A fuel tank on legs behind a nozzle, with pipes and a hazard band.
      root.add(at(cyl(1.25, 1.45, 0.5, 0x4b5361, 14), 0, 0.25, 0));
      root.add(at(cyl(1, 1.15, 2.4, C.enemyDark, 14), 0, 1.7, 0));
      band(root, 1.1, 0, 1.1, 0, C.darkMetal);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const stripe = plain(0.5, 0.34, 0.1, i % 2 ? 0xf2c23a : 0x1c2430);
        root.add(at(stripe, Math.cos(a) * 1.08, 2.3, Math.sin(a) * 1.08, 0, -a + Math.PI / 2, 0));
      }
      root.add(at(cyl(1.02, 1.02, 0.2, C.enemyRust, 14), 0, 3, 0));
      const dome = ball(1, C.enemyRust, 14);
      dome.scale.set(1, 0.6, 1);
      root.add(at(dome, 0, 3.05, 0));
      root.add(at(cyl(0.12, 0.12, 0.5, C.darkMetal, 8), 0.3, 3.7, 0));
      head = at(new THREE.Group(), 0, 3.05, 0);
      head.add(cyl(0.5, 0.55, 0.6, C.darkMetal, 10));
      head.add(at(barrel(0.2, 1.3, C.darkMetal, 10), 0.3, 0, 0));
      head.add(at(barrel(0.3, 0.5, 0x2b303a, 10), 1.5, 0, 0));
      for (const z of [0.3, -0.3]) head.add(at(barrel(0.05, 1.1, C.metal, 6), 0.5, 0.3, z));
      flame = at(flameCone(7), 2, 0, 0);
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
      // A rocky hill with a timbered mine entrance, a rail line and a cart of gold.
      for (const [x, y, z, r] of [
        [0, 0.9, -0.7, 2.5],
        [-1.6, 0.6, 0, 1.6],
        [1.6, 0.6, -0.1, 1.7],
        [0.2, 1.8, -1.2, 1.6],
      ] as const) {
        const rock = at(ball(r, C.stone, 10), x, y, z);
        rock.scale.set(1, 0.8, 0.9);
        root.add(rock);
      }
      root.add(at(plain(1.5, 1.8, 0.3, 0x201b18), 0, 0.9, 1.3));
      for (const x of [0.85, -0.85]) root.add(at(rbox(0.32, 2.3, 0.32, C.woodDark), x, 1.15, 1.45));
      root.add(at(rbox(2.2, 0.34, 0.4, C.woodDark), 0, 2.4, 1.45));
      root.add(at(plain(1.4, 0.3, 0.06, C.enemyRust), 0, 2.85, 1.5));
      // Rails running out of the mine.
      for (const x of [0.38, -0.38]) root.add(at(plain(0.08, 0.08, 2.6, C.metal), x, 0.1, 2.6));
      for (let i = 0; i < 6; i++)
        root.add(at(plain(1.1, 0.06, 0.2, C.woodDark), 0, 0.05, 1.5 + i * 0.45));
      root.add(at(rbox(1.1, 0.6, 1, C.darkMetal), 0, 0.6, 3));
      for (const x of [0.5, -0.5])
        for (const z of [2.7, 3.3])
          root.add(at(cyl(0.16, 0.16, 0.1, C.metal, 8), x, 0.2, z, 0, 0, Math.PI / 2));
      for (let i = 0; i < 6; i++) {
        root.add(
          at(
            ball(0.26, C.gold, 8),
            -0.3 + (i % 3) * 0.3,
            0.92 + Math.floor(i / 3) * 0.14,
            2.8 + (i % 2) * 0.32,
          ),
        );
      }
      root.add(at(plain(0.5, 0.05, 0.5, C.gold), 1.6, 0.45, 1.8, 0.4, 0.3, 0));
      break;
    }
    case "lumberCamp": {
      // A plank mill with a tin roof, a big saw blade and stacked logs.
      root.add(at(plain(3.6, 2.4, 2.8, C.woodDark), -0.5, 1.2, -0.8));
      planks(root, -0.5, 1.2, 0.66, 3.6, 2.4);
      tinRoof(root, -0.5, 2.75, -0.8, 4.2, 3.6, 0.14);
      root.add(at(plain(1, 1.2, 0.1, 0x201b18), -0.5, 0.9, 0.74));
      const saw = at(cyl(0.9, 0.9, 0.06, 0xc4ccd2, 16), 1.65, 1.35, -0.2, Math.PI / 2, 0, 0);
      root.add(saw);
      root.add(at(cyl(0.16, 0.16, 0.3, C.darkMetal, 8), 1.65, 1.35, -0.2, Math.PI / 2, 0, 0));
      root.add(at(rbox(1.9, 0.5, 1.2, C.enemyDark), 1.65, 0.25, -0.2));
      root.add(at(barrel(0.3, 2.6, C.wood, 10), 0.5, 0.75, -0.2));
      for (let i = 0; i < 6; i++) {
        const row = i < 3 ? 0 : i < 5 ? 1 : 2;
        const col = row === 0 ? i : row === 1 ? i - 3 : 0;
        const z = 1.1 + col * 0.66 + row * 0.33;
        root.add(at(barrel(0.33, 3.2, C.wood, 10), -1.8, 0.33 + row * 0.56, z));
        root.add(
          at(cyl(0.34, 0.34, 0.03, 0xe6c79a, 10), 1.41, 0.33 + row * 0.56, z, 0, 0, Math.PI / 2),
        );
      }
      break;
    }
    case "quarry": {
      // Cut stone stacked by a timber crane with a rope and a hook.
      const spots = [
        [-1.2, 0, 0.8],
        [0.1, 0, 1.2],
        [1.3, 0, 0.6],
        [-0.5, 1, 0.9],
        [0.8, 1, 0.9],
        [-0.8, 0, -0.6],
      ] as const;
      for (const [x, layer, z] of spots) {
        root.add(at(plain(1.2, 1, 1.2, C.stone), x, 0.5 + layer, z, 0, x * 0.3, 0));
        root.add(at(plain(1.22, 0.04, 1.22, 0x8f8a7e), x, 0.7 + layer, z, 0, x * 0.3, 0));
      }
      root.add(at(rbox(1.2, 0.3, 1.2, C.woodDark), 1.6, 0.15, -1.4));
      root.add(at(cyl(0.16, 0.2, 3.4, C.woodDark, 8), 1.6, 1.8, -1.4));
      root.add(at(plain(3.4, 0.2, 0.2, C.wood), 0.4, 3.3, -1.4, 0, 0, -0.15));
      root.add(at(cyl(0.03, 0.03, 1.5, 0xd8d0b8, 5), -0.8, 2.75, -1.4));
      root.add(at(plain(1, 0.7, 1, C.stone), -0.8, 1.7, -1.4));
      crate(root, 1.8, 0, 1.6, 0.7, 0.3);
      break;
    }
    case "scrapYard": {
      // Heaps of scrap inside a low fence, with a crane magnet.
      const junk = [
        [0, 0.5, 0, 1.6, 1, 1.2, C.enemyRust],
        [1.2, 0.4, 0.9, 1, 0.8, 1, C.metal],
        [-1.1, 0.45, 0.8, 1.2, 0.9, 0.9, C.enemyDark],
        [-0.6, 1.1, -0.3, 0.9, 0.7, 0.9, C.metal],
        [0.9, 0.35, -1, 1.4, 0.7, 0.8, C.enemyDark],
      ] as const;
      junk.forEach(([x, y, z, w, h, d, color], i) => {
        root.add(at(plain(w, h, d, color), x, y, z, 0.2 * i, 0.5 * i, 0.15 * i));
      });
      root.add(at(barrel(0.45, 1.3, C.enemyRust, 10), -1.8, 0.45, -1, 0, 0.6, 0));
      for (let i = 0; i < 3; i++) {
        const tire = cyl(0.56, 0.56, 0.26, 0x22262c, 12);
        root.add(at(tire, 2.1, 0.14 + i * 0.28, 0.6));
      }
      root.add(at(cyl(0.14, 0.18, 3.6, C.enemyDark, 8), -2.1, 1.8, 1.7));
      root.add(at(plain(2.6, 0.18, 0.18, C.enemyRust), -1, 3.5, 1.7, 0, 0, -0.1));
      root.add(at(cyl(0.03, 0.03, 1.2, C.metal, 5), 0.1, 2.85, 1.7));
      root.add(at(cyl(0.5, 0.5, 0.22, C.darkMetal, 12), 0.1, 2.2, 1.7));
      break;
    }
    case "storehouse": {
      // A ribbed steel shed with a roller door, a tin roof and crates out front.
      root.add(at(rbox(4.4, 3, 3.6, C.enemyDark), 0, 1.5, 0));
      for (let i = 0; i < 9; i++)
        root.add(at(plain(0.12, 3, 3.7, 0x4b5361), (i - 4) * 0.52, 1.5, 0));
      tinRoof(root, 0, 3.2, 0, 4.8, 4, 0.1);
      root.add(at(plain(2, 2.4, 0.14, C.enemyRust), 0, 1.2, 1.82));
      for (let i = 0; i < 6; i++)
        root.add(at(plain(1.96, 0.05, 0.05, 0x8e3f1f), 0, 0.3 + i * 0.4, 1.91));
      crate(root, 1.7, 0, 2.3, 0.8, 0.2);
      crate(root, -1.8, 0, 2.2, 0.7, -0.3);
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
      // Fuel tanks joined by pipes, a banded chimney, a ladder and a catwalk.
      root.add(at(rbox(4.6, 0.3, 4.6, 0x4b5361), 0, 0.15, 0));
      for (const z of [-1, 1]) {
        root.add(at(cyl(1.1, 1.1, 3, C.enemyDark, 16), -0.8, 1.8, z * 1.2));
        const cap = ball(1.1, C.enemyDark, 12);
        cap.scale.y = 0.35;
        root.add(at(cap, -0.8, 3.3, z * 1.2));
        band(root, 1.14, -0.8, 1, z * 1.2, C.darkMetal);
        band(root, 1.14, -0.8, 2.6, z * 1.2, C.enemyRust);
      }
      root.add(at(cyl(0.5, 0.65, 6.5, C.enemyDark, 12), 1.5, 3.4, 0));
      for (const y of [2, 3.6, 5.2]) band(root, 0.6, 1.5, y, 0, C.darkMetal);
      root.add(at(cyl(0.6, 0.6, 0.5, C.enemyRust, 12), 1.5, 6.5, 0));
      root.add(at(barrel(0.16, 2.4, C.metal, 8), -0.8, 3, 0, 0, Math.PI / 2, 0));
      root.add(at(barrel(0.16, 1.7, C.metal, 8), -0.4, 2.6, 0));
      root.add(at(plain(1.4, 0.1, 3.2, C.darkMetal), 0.3, 3.5, 0));
      for (const z of [0.25, -0.25])
        root.add(at(plain(0.06, 3.3, 0.06, C.metal), 0.9, 1.85, 1.6 + z));
      for (let y = 0.5; y < 3.4; y += 0.45)
        root.add(at(plain(0.05, 0.05, 0.55, C.metal), 0.9, y, 1.6));
      break;
    }
  }
  // One mesh per model; heads turn on their own and flames stay see-through.
  const keep = [head, flame].filter((o): o is THREE.Object3D => o !== null);
  if (flame) (head as THREE.Object3D | null)?.remove(flame);
  if (head) bake(head, [], paint);
  if (flame) (head as THREE.Object3D | null)?.add(flame);
  bake(root, keep, paint);
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
    new THREE.MeshStandardMaterial({
      color: 0x3a3a34,
      roughness: 0.7,
      transparent: true,
      opacity: 0.35,
    }),
  );
  m.receiveShadow = true;
  return m;
}
