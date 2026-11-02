// The ancient statues and the crystals, in the game's own 3D. A statue stands robed on a stepped
// plinth, holding its crystal up in both hands, and each has its own crown. Lost in the overgrowth
// it's worn and mossy, and restored it's clean pale stone with the crystal burning overhead.

import * as THREE from "three";
import type { CrystalKind } from "../logic/crystals";
import { COLORS } from "./palette";
import { at, ball, cone, cyl, flatten, rbox } from "./shapes";

/** Each crystal's color, on screen and in the night's lamps. */
export const CRYSTAL_COLORS: Record<CrystalKind, number> = {
  nature: 0x46d652,
  fire: 0xff7a22,
  ice: 0x7fdcff,
  dark: 0x8a4ee0,
};

const WORN = 0x8d897a;
const WORN_DARK = 0x6f6c60;
const MOSS = 0x5f9a44;
const CLEAN = 0xe2dccb;
const CLEAN_DARK = 0xc4bda8;

/** One many-sided shard, standing on its point: the shape of every crystal in the art. */
function shard(radius: number, tall: number): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(radius, 0);
  g.scale(0.72, tall / (radius * 2), 0.72);
  return g;
}

/** A crystal cluster, about a meter tall: a big shard with smaller ones leaning off it. */
export function crystalGem(kind: CrystalKind, glow = true): THREE.Group {
  const color = CRYSTAL_COLORS[kind];
  const m = new THREE.MeshLambertMaterial({
    color,
    emissive: color,
    emissiveIntensity: glow ? 0.75 : 0.05,
    flatShading: true,
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(shard(0.42, 1.15), m));
  g.add(at(new THREE.Mesh(shard(0.24, 0.72), m), 0.32, -0.16, 0.08, 0.1, 0.4, -0.5));
  g.add(at(new THREE.Mesh(shard(0.22, 0.66), m), -0.3, -0.18, -0.06, -0.1, 1.2, 0.46));
  g.add(at(new THREE.Mesh(shard(0.17, 0.5), m), 0.04, -0.22, 0.3, 0.5, 2, 0.05));
  return g;
}

/** What sits on a statue's head, so each can be told apart even overgrown. */
function crown(kind: CrystalKind, stone: number): THREE.Group {
  const g = new THREE.Group();
  const spikes = (count: number, radius: number, tall: number, lean: number, y: number) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      g.add(
        at(
          cone(radius, tall, stone, 7),
          Math.cos(a) * 0.3,
          y,
          Math.sin(a) * 0.3,
          Math.sin(a) * lean,
          0,
          -Math.cos(a) * lean,
        ),
      );
    }
  };
  switch (kind) {
    case "nature":
      // A wreath of broad leaves.
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const leaf = ball(0.17, stone, 8);
        leaf.scale.set(1.5, 0.45, 0.8);
        g.add(at(leaf, Math.cos(a) * 0.36, 0.12, Math.sin(a) * 0.36, 0, -a, 0.45));
      }
      break;
    case "ice":
      spikes(6, 0.1, 0.62, 0.14, 0.34);
      break;
    case "fire":
      // Flames licking up from the brow.
      spikes(5, 0.14, 0.46, 0.34, 0.28);
      g.add(at(cone(0.14, 0.7, stone, 7), 0, 0.46, 0));
      break;
    case "dark":
      // A deep hood, pulled forward.
      g.add(at(ball(0.42, stone, 12), 0, -0.02, -0.06));
      g.add(at(cone(0.3, 0.4, stone, 8), 0, 0.42, -0.14, -0.4, 0, 0));
      break;
  }
  return g;
}

export interface StatueModel {
  root: THREE.Group;
  /** The crystal overhead, which turns slowly once the statue's restored. */
  gem: THREE.Group;
}

const templates = new Map<string, THREE.Group>();

function statueBody(kind: CrystalKind, restored: boolean): THREE.Group {
  const key = `${kind}|${restored}`;
  let template = templates.get(key);
  if (!template) {
    const stone = restored ? CLEAN : WORN;
    const dark = restored ? CLEAN_DARK : WORN_DARK;
    const g = new THREE.Group();
    // The plinth, in three steps.
    g.add(at(rbox(3.6, 0.5, 3.6, dark), 0, 0.25, 0));
    g.add(at(rbox(2.9, 0.45, 2.9, stone), 0, 0.72, 0));
    g.add(at(rbox(2.2, 0.4, 2.2, dark), 0, 1.14, 0));
    // A robed figure, wider towards the hem.
    g.add(at(cyl(0.52, 0.86, 2.5, stone, 12), 0, 2.55, 0));
    g.add(at(cyl(0.62, 0.52, 0.5, dark, 12), 0, 3.9, 0));
    g.add(at(ball(0.46, stone, 14), 0, 4.5, 0));
    // Both arms held up to the crystal.
    for (const side of [-1, 1]) {
      g.add(at(cyl(0.16, 0.2, 1.5, stone, 8), side * 0.62, 4.5, 0, 0, 0, side * 0.42));
      g.add(at(ball(0.2, dark, 8), side * 0.36, 5.2, 0));
    }
    const top = crown(kind, restored ? COLORS.gold : dark);
    top.position.set(0, 4.72, 0);
    g.add(top);
    // Carved bands on the robe.
    g.add(at(cyl(0.72, 0.74, 0.14, restored ? COLORS.gold : dark, 12), 0, 1.72, 0));
    g.add(at(cyl(0.58, 0.6, 0.12, restored ? COLORS.gold : dark, 12), 0, 3.15, 0));
    if (!restored) {
      // Moss across the steps and up the shoulders, a corner broken away, a fallen piece.
      for (const [x, y, z, r] of [
        [1.2, 0.52, 0.9, 0.5],
        [-1.1, 0.52, 1.2, 0.6],
        [0.8, 0.98, -0.9, 0.44],
        [-0.9, 1.36, -0.5, 0.36],
        [0.46, 4.0, 0.2, 0.28],
        [-0.42, 3.4, 0.36, 0.24],
      ] as const) {
        const patch = ball(r, MOSS, 8);
        patch.scale.y = 0.3;
        g.add(at(patch, x, y, z));
      }
      g.add(at(rbox(0.8, 0.5, 0.6, stone), 1.9, 0.25, 0.6, 0, 0.5, 0.3));
    }
    flatten(g);
    templates.set(key, g);
    template = g;
  }
  return template.clone(true);
}

/** A statue, about 7 m tall at scale 1 with its crystal, standing on y = 0. */
export function statueModel(kind: CrystalKind, restored: boolean): StatueModel {
  const root = statueBody(kind, restored);
  const gem = crystalGem(kind, restored);
  gem.position.set(0, 6, 0);
  root.add(gem);
  return { root, gem };
}

/** A little star that glints in the overgrowth, the one sign of a statue nobody's found. */
export function glintSprite(kind: CrystalKind): THREE.Sprite {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const c = size / 2;
    const glow = g.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, "rgba(255, 255, 255, 1)");
    glow.addColorStop(0.12, "rgba(255, 255, 255, 0.5)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, size, size);
    g.strokeStyle = "rgba(255, 255, 255, 0.9)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(c, 2);
    g.lineTo(c, size - 2);
    g.moveTo(2, c);
    g.lineTo(size - 2, c);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color: new THREE.Color(CRYSTAL_COLORS[kind]).multiplyScalar(1.6),
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );
  return sprite;
}

/** Frees a glint's canvas and material. */
export function disposeGlint(sprite: THREE.Sprite): void {
  sprite.material.map?.dispose();
  sprite.material.dispose();
}
