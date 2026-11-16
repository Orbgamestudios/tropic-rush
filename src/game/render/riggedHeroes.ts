// The heroes' real models (scripts/rig-hero.mjs makes them), with a skeleton for everyone on foot,
// each in two copies: a light one, fetched as the game starts, and a detailed one fetched for the
// hero screen. Until a model arrives the block figure stands in, so nothing ever waits on them.
// Each hero on screen is a clone sharing the same mesh and texture.

import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { HeroKind } from "../logic/heroes";
import { addFacePatches, type FaceNotes } from "./facePaint";

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

/** The bones a limb's roll is spread along, and the bone each ends at. */
const TWISTED = [
  ["armR", "foreR"],
  ["armL", "foreL"],
  ["foreR", "handR"],
  ["foreL", "handL"],
] as const;

/** How many steps a limb's roll is spread over. Skin between two bones a long way apart in their
 * roll caves in towards the middle of the limb, so each step is kept small. */
export const TWIST_STEPS = 3;

/**
 * An arm rolls along its length: the skin by the shoulder stays put while the elbow turns, and a
 * forearm turns the wrist over without the elbow moving at all. One bone for each can only turn
 * as a whole, which wrings the joint above it like a cloth. So each gets more bones in the same
 * place, each for a share of the roll, and its skin goes over to them step by step towards the far
 * end.
 */
function addTwistBones(scene: THREE.Object3D): void {
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const bones = [...o.skeleton.bones];
    const inverses = o.skeleton.boneInverses.map((m) => m.clone());
    const spread: { from: number; to: number[]; inverse: THREE.Matrix4; end: THREE.Vector3 }[] = [];
    for (const [name, next] of TWISTED) {
      const from = bones.findIndex((b) => b.name === name);
      const child = bones.find((b) => b.name === next);
      const inverse = inverses[from];
      const bone = bones[from];
      if (!bone || !child || !inverse) continue;
      const to = [from];
      for (let step = 1; step <= TWIST_STEPS; step++) {
        // A body in several pieces shares its bones: the first piece makes the twist, the rest use it.
        const called = `${name}Twist${step}`;
        let twist = bone.children.find((c) => c.name === called);
        if (!twist) {
          twist = new THREE.Bone();
          twist.name = called;
          bone.add(twist);
        }
        bones.push(twist as THREE.Bone);
        inverses.push(inverse.clone());
        to.push(bones.length - 1);
      }
      spread.push({ from, to, inverse, end: child.position.clone() });
    }
    const geometry = o.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute("position");
    const index = geometry.getAttribute("skinIndex");
    const weight = geometry.getAttribute("skinWeight");
    const joints = new Uint16Array(position.count * 4);
    const weights = new Float32Array(position.count * 4);
    const p = new THREE.Vector3();
    const share = new Map<number, number>();
    for (let v = 0; v < position.count; v++) {
      share.clear();
      for (let k = 0; k < 4; k++) {
        const w = weight.getComponent(v, k);
        const bone = index.getComponent(v, k);
        if (w > 0) share.set(bone, (share.get(bone) ?? 0) + w);
      }
      for (const { from, to, inverse, end } of spread) {
        const w = share.get(from);
        if (!w) continue;
        p.fromBufferAttribute(position, v).applyMatrix4(o.bindMatrix).applyMatrix4(inverse);
        const along = THREE.MathUtils.clamp(p.dot(end) / end.lengthSq(), 0, 1) * TWIST_STEPS;
        const step = Math.min(TWIST_STEPS - 1, Math.floor(along));
        const over = along - step;
        share.delete(from);
        for (const [bone, part] of [
          [to[step], w * (1 - over)],
          [to[step + 1], w * over],
        ] as const) {
          if (bone !== undefined && part > 0) share.set(bone, (share.get(bone) ?? 0) + part);
        }
      }
      const top = [...share].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = top.reduce((total, [, w]) => total + w, 0) || 1;
      top.forEach(([bone, w], k) => {
        joints[v * 4 + k] = bone;
        weights[v * 4 + k] = w / sum;
      });
    }
    geometry.setAttribute("skinIndex", new THREE.BufferAttribute(joints, 4));
    geometry.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
    o.bind(new THREE.Skeleton(bones, inverses), o.bindMatrix);
  });
}

/**
 * Where each hero's mouth is: how far up the head it sits, from the neck (0) to the crown (1), and
 * how far forward of the neck the face begins, as a share of the head's depth. Looked up by eye on
 * each model, since no two heads are built alike. `JAW` can be changed while looking, by a test.
 */
export const JAW: Record<string, { mouth: number; front: number }> = {
  rifleman: { mouth: 0.33, front: 0.2 },
  heavy: { mouth: 0.33, front: 0.2 },
  medic: { mouth: 0.3, front: 0.2 },
  grenadier: { mouth: 0.33, front: 0.2 },
  bazooka: { mouth: 0.33, front: 0.2 },
  engineer: { mouth: 0.33, front: 0.2 },
};

const smooth = (from: number, to: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * A head is one stiff piece, which is right for a helmet and wrong for a mouth. So the front of
 * the face below the mouth gets a bone of its own, hinged back by the ears: turn it and the jaw
 * drops, the chin with it, and the skin at the mouth's line opens. The models have no inside to
 * their mouths, so it's a mouth seen moving, not seen into.
 */
function addJaw(scene: THREE.Object3D, kind: string): void {
  const where = JAW[kind];
  // A character built in pieces comes with a real jaw, its mouth already cut.
  if (!where || scene.getObjectByName("jaw")) return;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const bones = [...o.skeleton.bones];
    const inverses = o.skeleton.boneInverses.map((m) => m.clone());
    const head = bones.findIndex((b) => b.name === "head");
    const inverse = inverses[head];
    const headBone = bones[head];
    if (!headBone || !inverse || bones.some((b) => b.name === "jaw")) return;
    const geometry = o.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute("position");
    const index = geometry.getAttribute("skinIndex") as THREE.BufferAttribute;
    const weight = geometry.getAttribute("skinWeight") as THREE.BufferAttribute;
    // How tall the head is and how far its face reaches forward, from the vertices it owns.
    const p = new THREE.Vector3();
    const local = (v: number) =>
      p.fromBufferAttribute(position, v).applyMatrix4(o.bindMatrix).applyMatrix4(inverse);
    const headShare = (v: number) => {
      let share = 0;
      for (let k = 0; k < 4; k++)
        if (index.getComponent(v, k) === head) share += weight.getComponent(v, k);
      return share;
    };
    let tall = 0;
    let deep = 0;
    for (let v = 0; v < position.count; v++) {
      if (headShare(v) < 0.5) continue;
      local(v);
      tall = Math.max(tall, p.y);
      // The face, not a hat's brim: only what's below the brow counts.
      if (p.y < tall * 0.6) deep = Math.max(deep, p.x);
    }
    if (tall <= 0 || deep <= 0) return;
    const line = where.mouth * tall;
    const band = tall * 0.035;
    const jaw = new THREE.Bone();
    jaw.name = "jaw";
    // Hinged just in front of the ear, a little above the mouth.
    jaw.position.set(deep * 0.12, line + tall * 0.1, 0);
    headBone.add(jaw);
    bones.push(jaw);
    const pivot = new THREE.Matrix4().makeTranslation(-jaw.position.x, -jaw.position.y, 0);
    inverses.push(pivot.multiply(inverse));
    const jawIndex = bones.length - 1;
    for (let v = 0; v < position.count; v++) {
      const share = headShare(v);
      if (share <= 0) continue;
      local(v);
      // Below the mouth's line, forward of the neck, and not the neck itself.
      const below = smooth(line + band, line - band, p.y);
      const forward = smooth(deep * where.front, deep * (where.front + 0.25), p.x);
      const moved = share * below * forward;
      if (moved <= 0.001) continue;
      // Into the vertex's emptiest place, out of the head's own.
      let free = 0;
      for (let k = 1; k < 4; k++) {
        if (weight.getComponent(v, k) < weight.getComponent(v, free)) free = k;
      }
      for (let k = 0; k < 4; k++) {
        if (index.getComponent(v, k) !== head) continue;
        weight.setComponent(v, k, weight.getComponent(v, k) * (1 - below * forward));
      }
      if (index.getComponent(v, free) === head) continue;
      index.setComponent(v, free, jawIndex);
      weight.setComponent(v, free, moved);
    }
    index.needsUpdate = true;
    weight.needsUpdate = true;
    o.bind(new THREE.Skeleton(bones, inverses), o.bindMatrix);
  });
}

let loading: Promise<unknown> | null = null;

/** Fetches the raid models, the first time it's asked. */
export function loadRigs(): Promise<unknown> {
  loading ??= Promise.all(
    MODELED.map(async (kind) => {
      const scene = await fetchBody(kind, "rig");
      if (!scene) return;
      addTwistBones(scene);
      addJaw(scene, kind);
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
          addTwistBones(scene);
          addJaw(scene, kind);
          dress(scene, true);
          menuBodies.set(kind, scene);
        })
      : Promise.resolve();
    menuLoads.set(kind, load);
  }
  return load;
}

/** The story's people who are built in pieces (docs/CHARACTERS.md), and their bodies once here. */
export type StoryBody = "captain" | "shaman";
const storyBodies = new Map<StoryBody, THREE.Object3D>();
const storyLoads = new Map<StoryBody, Promise<void>>();
const storyFaces = new Map<StoryBody, FaceNotes>();

/** Where one of the story's people's eyes and mouth are painted, if theirs are. */
export function storyFace(who: StoryBody): FaceNotes | null {
  return storyFaces.get(who) ?? null;
}

/**
 * Fetches one of the story's people, built in pieces: a body, hair, eyes, lids, teeth and props on
 * one skeleton. Until it's here (or if it never comes) their block figure stands in.
 */
export function loadStoryBody(who: StoryBody): Promise<void> {
  let load = storyLoads.get(who);
  if (!load) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    // A generated model comes with notes on where its eyes and mouth are: the game paints those.
    const notes = fetch(`${import.meta.env.BASE_URL}models/${who}-face.json`)
      .then((r) => (r.ok ? (r.json() as Promise<FaceNotes>) : null))
      .catch(() => null);
    load = Promise.all([loader.loadAsync(`${import.meta.env.BASE_URL}models/${who}-hi.glb`), notes])
      .then(([gltf, face]) => {
        const scene = gltf.scene as THREE.Object3D;
        addTwistBones(scene);
        dressPieces(scene);
        if (face) {
          addFacePatches(scene, face);
          storyFaces.set(who, face);
        }
        storyBodies.set(who, scene);
      })
      .catch(() => undefined);
    storyLoads.set(who, load);
  }
  return load;
}

/** A fresh copy of one of the story's people, if theirs has arrived. */
export function storyBody(who: StoryBody): RiggedBody | null {
  const template = storyBodies.get(who);
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

/**
 * Each piece gets the material it's made of: eyes wet and glossy, hair with a soft sheen, skin and
 * cloth matte. Only ever drawn up close, so they can all afford the full lighting.
 */
function dressPieces(scene: THREE.Object3D): void {
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const { map, normalMap, color, vertexColors } = o.material as THREE.MeshStandardMaterial;
    const piece = o.name.toLowerCase();
    const wet = piece.startsWith("eye") || piece.startsWith("teeth");
    o.material = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      color: map ? 0xffffff : color,
      vertexColors,
      roughness: wet ? 0.18 : piece.startsWith("hair") ? 0.5 : 0.75,
      metalness: 0,
    });
    o.castShadow = !piece.startsWith("eye") && !piece.startsWith("mouth");
    o.receiveShadow = false;
    if (o instanceof THREE.SkinnedMesh) o.boundingSphere = REACH.clone();
  });
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
