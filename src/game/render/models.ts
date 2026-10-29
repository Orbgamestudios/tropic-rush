// Placeholder models built from rounded primitives at the design doc's real sizes. Each one is
// a stand-in for a GLB model from the art pipeline; swap them one at a time as models arrive.
// Models face +x (east); the view rotates them to the logic's facing angle.

import * as THREE from "three";
import type { BuildingType } from "../logic/buildings";
import type { HeroKind } from "../logic/heroes";
import { COLORS, material } from "./palette";
import { at, ball, barrel, capsule, cone, cyl, mesh, rbox, sandbagRing } from "./shapes";

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

export function buildingModel(type: BuildingType): BuildingModel {
  const root = new THREE.Group();
  let head: THREE.Object3D | null = null;
  let flame: THREE.Object3D | null = null;
  switch (type) {
    case "headquarters": {
      root.add(at(rbox(9, 7.5, 9, C.enemyDark), 0, 3.75, 0));
      root.add(at(rbox(9.4, 0.8, 9.4, C.enemyRust), 0, 5.6, 0));
      root.add(at(rbox(6, 3.2, 6, C.enemyDark), 0, 9.1, 0));
      root.add(at(rbox(6.3, 0.6, 6.3, C.enemyRust), 0, 10.4, 0));
      for (const [x, z] of [
        [4.3, 4.3],
        [-4.3, 4.3],
        [4.3, -4.3],
        [-4.3, -4.3],
      ] as const) {
        root.add(at(cyl(1.4, 1.6, 10, C.enemyDark, 14), x, 5, z));
        root.add(at(cone(1.85, 1.8, C.enemyRust, 14), x, 10.9, z));
      }
      root.add(at(rbox(3, 3.6, 0.6, C.woodDark), 0, 1.8, 4.55));
      root.add(at(cyl(0.08, 0.08, 4, C.metal, 8), 0, 12.6, 0));
      root.add(at(rbox(2, 1.2, 0.08, C.enemyRust), 1.05, 13.9, 0));
      break;
    }
    case "gunTurret": {
      root.add(sandbagRing(1.95, 2, C.sandbag));
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
      root.add(sandbagRing(2.05, 2, C.sandbag));
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
      flame = at(flameCone(7), 2.1, 0, 0);
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
            ball(0.32, C.gold, 10, { roughness: 0.4, metalness: 0.3 }),
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

// ---------------------------------------------------------------------------------------------
// Heroes

export interface HeroModel {
  root: THREE.Group;
  /** Bobs and leans while moving. */
  body: THREE.Group;
  legs: [THREE.Object3D, THREE.Object3D] | null;
  /** The Medic's healing spray, shown while she fires. */
  spray: THREE.Object3D | null;
  /** Height of the top of the model, for health bars. */
  height: number;
}

interface HumanStyle {
  shirt: number;
  pants: number;
  skin: number;
  bulk: number;
}

const STYLES: Record<Exclude<HeroKind, "tank">, HumanStyle> = {
  rifleman: { shirt: C.crewBlue, pants: C.crewBlue, skin: C.skin, bulk: 1 },
  medic: { shirt: C.crewBlue, pants: C.crewBlue, skin: C.skin, bulk: 0.9 },
  heavy: { shirt: C.crewBlue, pants: C.brown, skin: C.skinDark, bulk: 1.35 },
  bazooka: { shirt: C.crewBlue, pants: C.khaki, skin: C.skin, bulk: 0.9 },
  grenadier: { shirt: C.cream, pants: C.olive, skin: C.skin, bulk: 1 },
  engineer: { shirt: C.teal, pants: C.denim, skin: C.skin, bulk: 1.1 },
};

function sprayCone(): THREE.Mesh {
  const geometry = new THREE.ConeGeometry(2.6, 7, 18, 1, true);
  geometry.rotateZ(Math.PI / 2);
  geometry.translate(3.5, 0, 0);
  const m = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0x7dff9a,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  m.visible = false;
  return m;
}

export function heroModel(kind: HeroKind): HeroModel {
  if (kind === "tank") return tankModel();
  const s = STYLES[kind];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hip = 0.85;
  const makeLeg = (z: number) => {
    const pivot = at(new THREE.Group(), 0, hip, z);
    pivot.add(at(capsule(0.12 * s.bulk, 0.48, s.pants), 0, -0.36, 0));
    pivot.add(at(rbox(0.32, 0.16, 0.22, C.woodDark), 0.06, -0.8, 0));
    body.add(pivot);
    return pivot;
  };
  const legs: [THREE.Object3D, THREE.Object3D] = [makeLeg(0.13 * s.bulk), makeLeg(-0.13 * s.bulk)];

  const torso = at(capsule(0.28 * s.bulk, 0.42, s.shirt), 0, 1.2, 0);
  torso.scale.set(0.85, 1, 1);
  body.add(torso);
  body.add(at(rbox(0.5 * s.bulk, 0.1, 0.62 * s.bulk, C.woodDark), 0, 0.98, 0));
  const head = at(ball(0.27, s.skin, 18), 0, 1.72, 0);
  body.add(head);
  for (const z of [0.36, -0.36]) {
    body.add(
      at(
        capsule(0.085 * s.bulk, 0.4, kind === "heavy" || kind === "bazooka" ? s.skin : s.shirt),
        0.22,
        1.2,
        z * s.bulk,
        0,
        0,
        -1.1,
      ),
    );
  }

  let spray: THREE.Object3D | null = null;
  const hand = 1.08;
  switch (kind) {
    case "rifleman": {
      body.add(at(cyl(0.3, 0.32, 0.18, C.crewBlue, 18), 0, 1.92, 0));
      const dome = at(ball(0.29, C.crewBlue, 16), 0, 1.95, 0);
      dome.scale.set(1, 0.8, 1);
      body.add(dome);
      body.add(at(cyl(0.44, 0.44, 0.04, C.crewBlueDark, 20), 0, 1.86, 0));
      body.add(at(rbox(0.9, 0.12, 0.1, C.wood), 0.35, hand, 0));
      body.add(at(barrel(0.035, 0.7, C.metal, 6), 0.7, hand + 0.05, 0));
      break;
    }
    case "medic": {
      const hair = at(ball(0.29, C.hairBlonde, 14), -0.04, 1.8, 0);
      hair.scale.set(1, 0.85, 1);
      body.add(hair);
      body.add(at(ball(0.13, C.hairBlonde, 10), -0.18, 2.05, 0));
      body.add(at(capsule(0.08, 0.32, C.hairBlonde), -0.3, 1.86, 0, 0, 0, 0.4));
      for (const z of [0.1, -0.1]) {
        const lens = new THREE.Mesh(
          new THREE.TorusGeometry(0.075, 0.018, 6, 14),
          material(C.darkMetal),
        );
        body.add(at(lens, 0.26, 1.74, z, 0, Math.PI / 2, 0));
      }
      body.add(at(rbox(0.32, 0.55, 0.5, C.medicGreen), -0.32, 1.25, 0));
      body.add(at(rbox(0.04, 0.22, 0.07, C.white), -0.49, 1.3, 0));
      body.add(at(rbox(0.04, 0.07, 0.22, C.white), -0.49, 1.3, 0));
      body.add(at(barrel(0.05, 0.45, C.metal, 8), 0.3, hand, 0));
      spray = sprayCone();
      body.add(at(spray, 0.75, hand, 0));
      break;
    }
    case "heavy": {
      body.add(at(ball(0.275, C.hairBlack, 14), -0.02, 1.76, 0));
      body.add(at(rbox(0.22, 0.2, 0.38, C.hairBlack), 0.12, 1.58, 0));
      body.add(at(rbox(0.12, 0.62, 0.12, 0xc28a2c), 0.05, 1.3, 0.05, 0.8, 0, 0));
      body.add(at(barrel(0.11, 0.9, C.darkMetal, 10), 0.35, hand, 0.08));
      body.add(at(barrel(0.11, 0.9, C.darkMetal, 10), 0.35, hand, -0.08));
      body.add(at(cyl(0.22, 0.22, 0.32, C.metal, 14), 0.2, hand - 0.12, 0, Math.PI / 2, 0, 0));
      break;
    }
    case "bazooka": {
      const hair = at(ball(0.3, C.hairBlack, 14), -0.03, 1.72, 0);
      hair.scale.set(1, 1, 1.05);
      body.add(hair);
      const cap = at(ball(0.28, C.hairBlack, 14), 0, 1.86, 0);
      cap.scale.set(1, 0.65, 1);
      body.add(cap);
      body.add(at(rbox(0.3, 0.05, 0.3, C.hairBlack), -0.3, 1.84, 0));
      body.add(at(rbox(0.06, 0.08, 0.36, 0x1b1b1b), 0.25, 1.74, 0));
      body.add(at(barrel(0.16, 1.7, C.olive, 14), -0.55, 1.5, 0.18));
      break;
    }
    case "grenadier": {
      body.add(at(cyl(0.46, 0.46, 0.04, 0xe3d3a3, 22), 0, 1.92, 0));
      body.add(at(cyl(0.24, 0.27, 0.24, 0xe3d3a3, 18), 0, 2.04, 0));
      body.add(at(cyl(0.275, 0.275, 0.06, C.brown, 18), 0, 1.97, 0));
      body.add(at(rbox(0.2, 0.14, 0.34, C.hairBrown), 0.12, 1.58, 0));
      body.add(at(cone(0.16, 0.22, C.orange, 10), 0.18, 1.45, 0, 0, 0, Math.PI));
      for (const z of [-0.22, -0.08, 0.08, 0.22])
        body.add(at(ball(0.09, C.olive, 8), 0.24, 0.98, z));
      body.add(at(ball(0.12, C.olive, 10), 0.42, hand + 0.1, 0.3));
      break;
    }
    case "engineer": {
      body.add(at(ball(0.275, C.hairBrown, 14), -0.03, 1.77, 0));
      for (const z of [0.1, -0.1])
        body.add(at(cyl(0.07, 0.07, 0.08, C.crewBlueDark, 10), 0.18, 1.94, z, 0, 0, Math.PI / 2));
      body.add(at(rbox(0.1, 0.08, 0.4, C.hairBrown), 0.27, 1.64, 0));
      body.add(at(rbox(0.45, 0.6, 0.55, C.woodLight), -0.36, 1.25, 0));
      body.add(at(rbox(0.3, 0.22, 0.3, 0x587a99), -0.36, 1.67, 0));
      body.add(at(barrel(0.04, 0.3, C.darkMetal, 6), -0.3, 1.7, 0.06));
      body.add(at(barrel(0.04, 0.3, C.darkMetal, 6), -0.3, 1.7, -0.06));
      body.add(at(rbox(0.5, 0.18, 0.14, C.darkMetal), 0.38, hand, 0));
      break;
    }
  }
  return { root, body, legs, spray, height: 2.3 };
}

function tankModel(): HeroModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(at(rbox(2.6, 0.9, 1.8, C.tankSand), 0, 0.85, 0));
  for (const z of [0.98, -0.98]) {
    body.add(at(rbox(2.9, 0.72, 0.48, 0x45474c), 0, 0.42, z));
    body.add(at(rbox(2.95, 0.14, 0.56, C.crewBlue), 0, 0.82, z));
    for (const x of [-1, -0.33, 0.33, 1])
      body.add(at(cyl(0.26, 0.26, 0.5, C.tankSand, 12), x, 0.38, z, Math.PI / 2, 0, 0));
  }
  const turret = at(new THREE.Group(), 0, 1.45, 0);
  turret.add(rbox(1.5, 0.75, 1.3, C.tankSand));
  turret.add(at(rbox(0.5, 0.6, 1.36, C.crewBlue), 0.65, 0, 0));
  turret.add(at(barrel(0.2, 1.8, C.tankSand, 14), 0.85, 0.05, 0));
  turret.add(at(cyl(0.27, 0.27, 0.35, C.tankSand, 14), 2.5, 0.05, 0, 0, 0, Math.PI / 2));
  turret.add(at(cyl(0.38, 0.38, 0.12, C.tankSand, 16), -0.2, 0.42, 0));
  // The driver popping out of the hatch, in her blue sailor hat.
  turret.add(at(capsule(0.2, 0.18, C.crewBlue), -0.2, 0.62, 0));
  turret.add(at(ball(0.21, C.skin, 14), -0.2, 0.98, 0));
  turret.add(at(ball(0.22, C.hairBrown, 12), -0.27, 0.98, 0));
  turret.add(at(cyl(0.2, 0.17, 0.14, C.crewBlue, 14), -0.2, 1.17, 0));
  turret.add(at(cyl(0.23, 0.23, 0.04, C.white, 14), -0.2, 1.11, 0));
  body.add(turret);
  return { root, body, legs: null, spray: null, height: 2.8 };
}

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
