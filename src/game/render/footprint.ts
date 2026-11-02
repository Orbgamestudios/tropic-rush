// Stands a building's model on its tiles: square on, facing the beach, and scaled to fit its
// footprint. The crew's island and enemy bases share this, so every base sits on the same grid.

import * as THREE from "three";
import type { BuildingType } from "../logic/buildings";
import { footprint, TILE } from "../logic/crewIsland";
import { visibleBox } from "./heroAssets";

const FIT_MARGIN = 0.7;

/** How a building is turned on its tiles: models face +x, and the beach is +z from the camera. */
export function tileRotation(rotated: boolean): number {
  return -Math.PI / 2 + (rotated ? Math.PI / 2 : 0);
}

const fits = new Map<string, number>();

/** How much to shrink a model so it stays inside its footprint. */
export function tileFit(type: BuildingType, rotated: boolean, model: THREE.Object3D): number {
  const key = `${type}|${rotated}`;
  let fit = fits.get(key);
  if (fit === undefined) {
    const { w, h } = footprint(type, rotated);
    const before = model.rotation.y;
    const scale = model.scale.x;
    model.rotation.y = tileRotation(rotated);
    model.scale.setScalar(1);
    const size = visibleBox(model).getSize(new THREE.Vector3());
    model.rotation.y = before;
    model.scale.setScalar(scale);
    fit = Math.min(
      1,
      (w * TILE - FIT_MARGIN) / Math.max(0.1, size.x),
      (h * TILE - FIT_MARGIN) / Math.max(0.1, size.z),
    );
    fits.set(key, fit);
  }
  return fit;
}
