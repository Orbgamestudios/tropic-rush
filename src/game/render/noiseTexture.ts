// Soft random noise baked into a small tiling texture, for shaders. A texture lookup is one
// instruction where working the same noise out in the shader is dozens for every pixel, which is
// what the sea covers most of the screen with.

import * as THREE from "three";
import { createRng } from "../logic/rng";

/** Noise cells across the texture, which repeats at this many world units. */
export const NOISE_CELLS = 64;
const TEXELS_PER_CELL = 4;

let texture: THREE.DataTexture | null = null;

/** Shared by every shader that wants noise, and never disposed. */
export function noiseTexture(): THREE.DataTexture {
  if (texture) return texture;
  const rng = createRng(0x5ea);
  const cells = Array.from({ length: NOISE_CELLS * NOISE_CELLS }, () => rng());
  const cell = (x: number, y: number) =>
    cells[((y + NOISE_CELLS) % NOISE_CELLS) * NOISE_CELLS + ((x + NOISE_CELLS) % NOISE_CELLS)] ?? 0;
  const size = NOISE_CELLS * TEXELS_PER_CELL;
  const data = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const fx = i / TEXELS_PER_CELL;
      const fy = j / TEXELS_PER_CELL;
      const x = Math.floor(fx);
      const y = Math.floor(fy);
      const ux = (fx - x) ** 2 * (3 - 2 * (fx - x));
      const uy = (fy - y) ** 2 * (3 - 2 * (fy - y));
      const top = cell(x, y) + (cell(x + 1, y) - cell(x, y)) * ux;
      const bottom = cell(x, y + 1) + (cell(x + 1, y + 1) - cell(x, y + 1)) * ux;
      data[j * size + i] = Math.round((top + (bottom - top) * uy) * 255);
    }
  }
  texture = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
