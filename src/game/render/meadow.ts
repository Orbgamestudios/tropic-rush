// The big soft swathes that sweep across the grass. Ground and plants read the same pattern, so a
// fern on a pale swathe is pale too and the 3D plants melt into the ground. It's all worked out as
// an island is built and stored in vertex and instance colors, so it costs nothing per frame.

import * as THREE from "three";
import { smoothstep } from "../logic/vec";

/** -1 in the deep swathes to 1 in the sunlit ones. */
export function meadow(x: number, y: number): number {
  const wx = x + 15 * Math.sin(y * 0.041 + 1.3) + 6 * Math.sin(y * 0.13 + x * 0.05);
  const wy = y + 15 * Math.sin(x * 0.037 + 0.4) + 6 * Math.sin(x * 0.11 - y * 0.07);
  return Math.sin(wx * 0.16 + wy * 0.11) * 0.6 + Math.sin(wy * 0.17 - wx * 0.09 + 1.7) * 0.4;
}

/** How much of the sunlit and of the deep color a spot takes: a soft edge, not a slow fade. */
export function swathes(x: number, y: number): { sun: number; deep: number } {
  const m = meadow(x, y);
  return { sun: smoothstep(0.02, 0.3, m), deep: smoothstep(-0.02, -0.3, m) };
}

const SUN_TINT = new THREE.Color(1.2, 1.12, 0.82);
const DEEP_TINT = new THREE.Color(0.72, 0.9, 0.7);
const PLAIN = new THREE.Color(1, 1, 1);

/** What to multiply a plant's color by, so it matches the ground it stands on. */
export function meadowTint(x: number, y: number, out: THREE.Color): THREE.Color {
  const { sun, deep } = swathes(x, y);
  return out
    .copy(PLAIN)
    .lerp(SUN_TINT, sun * 0.8)
    .lerp(DEEP_TINT, deep * 0.8);
}

const BLADE_TILE = 256;
const BLADES = 3400;

/** Grey blades of grass on mid-grey, tiling in both directions: it lightens and darkens the lawn. */
export function bladeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = BLADE_TILE;
  canvas.height = BLADE_TILE;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("No 2D canvas");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, BLADE_TILE, BLADE_TILE);
  // Seeded by hand so every island gets the same grass, and tests see the same picture.
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.lineCap = "round";
  for (let i = 0; i < BLADES; i++) {
    const x = next() * BLADE_TILE;
    const y = next() * BLADE_TILE;
    const lean = (next() - 0.5) * 1.2;
    const length = 5 + next() * 9;
    const light = next() > 0.5;
    const shade = light ? 175 + next() * 70 : 45 + next() * 60;
    g.strokeStyle = `rgba(${shade},${shade},${shade},0.5)`;
    g.lineWidth = 1 + next() * 1.4;
    // Drawn again one tile over in each direction, so the edges meet.
    for (const dx of [-BLADE_TILE, 0, BLADE_TILE]) {
      for (const dy of [-BLADE_TILE, 0, BLADE_TILE]) {
        g.beginPath();
        g.moveTo(x + dx, y + dy);
        g.lineTo(x + dx + Math.sin(lean) * length, y + dy - Math.cos(lean) * length);
        g.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}
