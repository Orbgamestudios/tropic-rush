// Hero models for menus: the real GLB where one exists (the Rifleman so far), otherwise the
// primitive placeholder. All are scaled to stand about 1.8 m tall on y = 0, facing +x.

import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { HeroKind } from "../logic/heroes";
import { heroModel } from "./models";

/** Bounds of the visible meshes only (hidden effects like spray cones don't count). */
export function visibleBox(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverseVisible((o) => {
    if (o instanceof THREE.Mesh) box.expandByObject(o);
  });
  return box;
}

/** GLB files in public/models, by hero. */
const GLB: Partial<Record<HeroKind, string>> = {
  rifleman: "models/rifleman.glb",
};

const HERO_HEIGHT = 1.8;
const cache = new Map<string, Promise<THREE.Group | null>>();

function loadGlb(url: string): Promise<THREE.Group | null> {
  let pending = cache.get(url);
  if (!pending) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    pending = loader
      .loadAsync(`${import.meta.env.BASE_URL}${url}`)
      .then((gltf) => {
        const root = gltf.scene;
        // Stand it on the ground at hero height. TRELLIS models face +z; ours face +x.
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const scale = HERO_HEIGHT / size.y;
        root.scale.setScalar(scale);
        root.position.set(
          -((box.min.x + box.max.x) / 2) * scale,
          -box.min.y * scale,
          -((box.min.z + box.max.z) / 2) * scale,
        );
        const holder = new THREE.Group();
        const turn = new THREE.Group();
        turn.rotation.y = Math.PI / 2;
        turn.add(root);
        holder.add(turn);
        holder.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        return holder;
      })
      .catch(() => null);
    cache.set(url, pending);
  }
  return pending;
}

/** A fresh copy of a hero's best available model. */
export async function menuHeroModel(kind: HeroKind): Promise<THREE.Group> {
  const url = GLB[kind];
  if (url) {
    const loaded = await loadGlb(url);
    if (loaded) return loaded.clone(true);
  }
  const model = heroModel(kind).root;
  const box = visibleBox(model);
  const height = box.max.y - box.min.y;
  if (kind !== "tank" && height > 0) model.scale.setScalar(HERO_HEIGHT / height);
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  const holder = new THREE.Group();
  holder.add(model);
  return holder;
}

/** True when this hero has a real model rather than a placeholder. */
export function hasRealModel(kind: HeroKind): boolean {
  return GLB[kind] !== undefined;
}
