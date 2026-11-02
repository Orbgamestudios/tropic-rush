// Hero models for menus: the same bodies as in a raid, with a real skinned model where one exists,
// and the animator that keeps them breathing on the pedestal. All are scaled to stand about 1.8 m
// tall on y = 0, facing +x.

import * as THREE from "three";
import type { HeroKind } from "../logic/heroes";
import { HeroAnimator } from "./heroAnimator";
import { heroModel } from "./models";
import { loadMenuBody, loadRigs } from "./riggedHeroes";

/** Bounds of the visible meshes only (hidden effects like spray cones don't count). */
export function visibleBox(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverseVisible((o) => {
    if (o instanceof THREE.Mesh) box.expandByObject(o);
  });
  return box;
}

const HERO_HEIGHT = 1.8;

/** A hero for a menu, and what moves them, for those who move. */
export interface MenuHero {
  holder: THREE.Group;
  animator: HeroAnimator | null;
}

/** A fresh copy of a hero's model, the detailed one if the hero's going to be seen up close. */
export async function menuHero(kind: HeroKind, detailed = false): Promise<MenuHero> {
  await loadRigs();
  if (detailed) await loadMenuBody(kind);
  const { root, rig } = heroModel(kind, detailed);
  const box = visibleBox(root);
  const height = box.max.y - box.min.y;
  if (kind !== "tank" && height > 0) root.scale.setScalar(HERO_HEIGHT / height);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  const holder = new THREE.Group();
  holder.add(root);
  return { holder, animator: rig && new HeroAnimator(rig) };
}
