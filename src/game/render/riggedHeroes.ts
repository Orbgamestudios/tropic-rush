// The heroes' real models (scripts/rig-hero.mjs makes them), with a skeleton for everyone on foot,
// each in two copies: a light one, fetched as the game starts, and a detailed one fetched for the
// hero screen. Until a model arrives the block figure stands in, so nothing ever waits on them.
// Each hero on screen is a clone sharing the same mesh and texture.

import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { HeroKind } from "../logic/heroes";

const MODELED: readonly HeroKind[] = [
  "rifleman",
  "heavy",
  "medic",
  "grenadier",
  "bazooka",
  "engineer",
  "tank",
];

/** Everywhere a hero's body can get to, from the ground between their feet. */
const REACH = new THREE.Sphere(new THREE.Vector3(0, 1.1, 0), 2.4);

const raidBodies = new Map<HeroKind, THREE.Object3D>();
const menuBodies = new Map<HeroKind, THREE.Object3D>();

function fetchBody(kind: HeroKind, copy: "rig" | "hi"): Promise<THREE.Object3D | null> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader
    .loadAsync(`${import.meta.env.BASE_URL}models/${kind}-${copy}.glb`)
    .then((gltf) => gltf.scene as THREE.Object3D)
    .catch(() => null);
}

function dress(scene: THREE.Object3D, detailed: boolean): void {
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const { map, normalMap } = o.material as THREE.MeshStandardMaterial;
    // Seen from a raid's high camera, a texture blurs along the ground without this.
    if (map) map.anisotropy = 4;
    // Lambert in a raid: it's all the phone can spare. The hero screen has only the hero to draw.
    o.material = detailed
      ? new THREE.MeshStandardMaterial({ map, roughness: 0.72, metalness: 0 })
      : new THREE.MeshLambertMaterial({ map, normalMap });
    o.castShadow = true;
    // The art has its own shading, and a skinned body shadowing itself only ever makes blotches.
    o.receiveShadow = false;
    // The skeleton swings the mesh about, away from where its bounds were worked out, so it gets
    // a sphere big enough for any pose. A hero off the screen then costs nothing to draw.
    if (o instanceof THREE.SkinnedMesh) o.boundingSphere = REACH.clone();
  });
}

let loading: Promise<unknown> | null = null;

/** Fetches the raid models, the first time it's asked. */
export function loadRigs(): Promise<unknown> {
  loading ??= Promise.all(
    MODELED.map(async (kind) => {
      const scene = await fetchBody(kind, "rig");
      if (!scene) return;
      dress(scene, false);
      raidBodies.set(kind, scene);
    }),
  );
  return loading;
}

const menuLoads = new Map<HeroKind, Promise<void>>();

/** Fetches a hero's detailed model for the hero screen, the first time it's asked. */
export function loadMenuBody(kind: HeroKind): Promise<void> {
  let load = menuLoads.get(kind);
  if (!load) {
    load = MODELED.includes(kind)
      ? fetchBody(kind, "hi").then((scene) => {
          if (!scene) return;
          dress(scene, true);
          menuBodies.set(kind, scene);
        })
      : Promise.resolve();
    menuLoads.set(kind, load);
  }
  return load;
}

export interface RiggedBody {
  scene: THREE.Object3D;
  bone(name: string): THREE.Object3D;
}

/** Whether this copy of a hero's body has arrived. */
export function hasBody(kind: HeroKind, detailed: boolean): boolean {
  return (detailed ? menuBodies : raidBodies).has(kind);
}

/** A fresh copy of a hero's body, if theirs has arrived. */
export function riggedBody(kind: HeroKind, detailed: boolean): RiggedBody | null {
  const template = (detailed ? menuBodies.get(kind) : undefined) ?? raidBodies.get(kind);
  if (!template) return null;
  const scene = clone(template);
  return {
    scene,
    bone(name) {
      const found = scene.getObjectByName(name);
      if (!found) throw new Error(`No bone called ${name}`);
      return found;
    },
  };
}
