// The sandy ground every building stands in: a patch with rounded corners that stops a little short
// of the edge of its tiles. Painted into a soft mask that the ground's own shader reads, so it lies
// on the ground wherever that rises or falls, and costs no draw call of its own.

import * as THREE from "three";
import type { BuildingType } from "../logic/buildings";
import { footprint, TILE } from "../logic/crewIsland";

/** The mask covers this square around the middle, in meters, at this many texels a side. */
export const SAND_HALF = 128;
const SAND_SIZE = 512;
/** How far a patch stops short of its tiles' edge, and how soft its edge is, in meters. */
const INSET = 0.35;
const SOFT = 0.35;
/** How round its corners are: this many meters, or most of the way round on a small patch. */
const CORNER = 1.6;
const MOST_ROUND = 0.85;

export interface SandSpot {
  type: BuildingType;
  /** The middle of the building, in meters. */
  x: number;
  z: number;
  rotated: boolean;
}

export class SandMask {
  readonly texture: THREE.DataTexture;
  private readonly data = new Uint8Array(SAND_SIZE * SAND_SIZE);

  constructor() {
    this.texture = new THREE.DataTexture(this.data, SAND_SIZE, SAND_SIZE, THREE.RedFormat);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
  }

  /** Paints a patch under each of these, and none anywhere else. Land mines stay hidden. */
  paint(spots: readonly SandSpot[]): void {
    this.data.fill(0);
    const meters = (SAND_HALF * 2) / SAND_SIZE;
    const texel = (m: number) => (m + SAND_HALF) / meters;
    for (const spot of spots) {
      if (spot.type === "landmine") continue;
      const { w, h } = footprint(spot.type, spot.rotated);
      const halfX = (w * TILE) / 2 - INSET;
      const halfZ = (h * TILE) / 2 - INSET;
      const corner = Math.min(CORNER, MOST_ROUND * Math.min(halfX, halfZ));
      const i0 = Math.max(0, Math.floor(texel(spot.x - halfX - SOFT)));
      const i1 = Math.min(SAND_SIZE - 1, Math.ceil(texel(spot.x + halfX + SOFT)));
      const j0 = Math.max(0, Math.floor(texel(spot.z - halfZ - SOFT)));
      const j1 = Math.min(SAND_SIZE - 1, Math.ceil(texel(spot.z + halfZ + SOFT)));
      for (let j = j0; j <= j1; j++) {
        const z = (j + 0.5) * meters - SAND_HALF;
        for (let i = i0; i <= i1; i++) {
          const x = (i + 0.5) * meters - SAND_HALF;
          // How far outside the rounded rectangle this point is (less than 0 inside), with the
          // edge wandering a little so it doesn't look ruled.
          const dx = Math.abs(x - spot.x) - (halfX - corner);
          const dz = Math.abs(z - spot.z) - (halfZ - corner);
          const wander = (Math.sin(x * 2.3 + z * 1.7) + Math.sin(z * 2.9 - x * 1.1)) * 0.06;
          const outside =
            Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - corner;
          const sand = Math.min(1, Math.max(0, 0.5 - (outside + wander) / SOFT));
          const k = j * SAND_SIZE + i;
          this.data[k] = Math.max(this.data[k] ?? 0, Math.round(sand * 255));
        }
      }
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
