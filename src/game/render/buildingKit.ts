// Buildings modeled in Blender by scripts/blender/make_buildings.py: ten stages each, from scrap wood
// to polished steel, packed by scripts/pack-buildings.mjs. The gunboat and what it fires
// come from there too. Every one is drawn from one shared texture, with the light baked into its
// corners, so a stage costs a draw call for each part that moves on its own. Until a file arrives, or
// for buildings not modeled yet, models.ts builds the old one from primitives.

import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { BuildingType } from "../logic/buildings";
import { PROGRESSION } from "../logic/economy";

export const STAGES = 10;

/** The buildings modeled so far. */
const MODELED: readonly BuildingType[] = ["gunTurret", "mortar", "harpoon", "headquarters"];

type Side = "enemy" | "crew";

/** Each building's stages, first to last. */
const stages = new Map<BuildingType, THREE.Object3D[]>();

/** Models that aren't buildings, and the parts each file holds. */
const PIECES = { gunboat: ["boat", "shell", "canisterShock", "canisterSmoke"] } as const;
export type Piece = (typeof PIECES)[keyof typeof PIECES][number];
const pieces = new Map<Piece, THREE.Object3D>();
const looks: Partial<Record<Side, THREE.MeshLambertMaterial>> = {};
let loading: Promise<void> | null = null;
let version = 0;

/** Which of a building's ten looks a level shows, so a 50-level headquarters changes every fifth. */
export function stageFor(type: BuildingType, level: number): number {
  const most = Math.max(1, PROGRESSION[type].maxLevel);
  return Math.min(STAGES, Math.max(1, Math.ceil((level / most) * STAGES)));
}

/** Goes up whenever more models arrive, so whatever was drawn without them can be drawn again. */
export function kitVersion(): number {
  return version;
}

async function atlas(side: Side): Promise<void> {
  const map = await new THREE.TextureLoader().loadAsync(
    `${import.meta.env.BASE_URL}textures/building-kit-${side}.webp`,
  );
  map.colorSpace = THREE.SRGBColorSpace;
  // The models' texture coordinates come from glTF, which counts from the top.
  map.flipY = false;
  map.anisotropy = 4;
  looks[side] = new THREE.MeshLambertMaterial({ map, vertexColors: true });
}

/** Fetches the modeled buildings and their texture, the first time it's asked. */
export function loadBuildingKit(): Promise<void> {
  loading ??= (async () => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const painted = await Promise.all([atlas("enemy"), atlas("crew")]).then(
      () => true,
      () => false,
    );
    if (!painted) return;
    await Promise.all([
      ...MODELED.map(async (type) => {
        const gltf = await loader
          .loadAsync(`${import.meta.env.BASE_URL}models/kit/${type}.glb`)
          .catch(() => null);
        if (!gltf) return;
        const list: THREE.Object3D[] = [];
        for (let s = 1; s <= STAGES; s++) {
          const stage = gltf.scene.getObjectByName(`s${s}`);
          if (!stage) return;
          stage.position.set(0, 0, 0);
          list.push(stage);
        }
        stages.set(type, list);
      }),
      ...Object.entries(PIECES).map(async ([file, names]) => {
        const gltf = await loader
          .loadAsync(`${import.meta.env.BASE_URL}models/kit/${file}.glb`)
          .catch(() => null);
        for (const name of names) {
          const piece = gltf?.scene.getObjectByName(name);
          if (!piece) continue;
          piece.position.set(0, 0, 0);
          pieces.set(name, piece);
        }
      }),
    ]);
    if (stages.size > 0 || pieces.size > 0) version++;
  })();
  return loading;
}

export interface KitBuilding {
  root: THREE.Group;
  head: THREE.Object3D | null;
  guns: THREE.Object3D | null;
  muzzles: THREE.Object3D[];
  spinner: THREE.Object3D | null;
  /** What a launcher throws, sitting ready: it goes with the shot and comes back to reload. */
  bolt: THREE.Object3D | null;
}

/** A modeled building at this level, or null if it hasn't been modeled or hasn't arrived. */
export function kitBuilding(type: BuildingType, level: number, crew: boolean): KitBuilding | null {
  const list = stages.get(type);
  const stage = list?.[stageFor(type, level) - 1];
  if (!stage) return null;
  const look = looks[crew ? "crew" : "enemy"];
  if (!look) return null;
  const root = new THREE.Group();
  const copy = stage.clone(true);
  const part = (name: string) => copy.getObjectByName(`${copy.name}_${name}`) ?? null;
  const muzzles: THREE.Object3D[] = [];
  copy.traverse((o) => {
    if (o.name.includes("_muzzle")) muzzles.push(o);
    if (!(o instanceof THREE.Mesh)) return;
    o.material = look;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  root.add(copy);
  // Fitted to its tiles once for every stage, so an upgrade never changes its size.
  root.userData.fit = "kit";
  return {
    root,
    head: part("head"),
    guns: part("guns"),
    muzzles,
    spinner: part("radar"),
    bolt: part("bolt"),
  };
}

/** A copy of one of the models that aren't buildings, in crew paint, or null until it's arrived. */
export function kitPiece(name: Piece): THREE.Object3D | null {
  const piece = pieces.get(name);
  const look = looks.crew;
  if (!piece || !look) return null;
  const copy = piece.clone(true);
  copy.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.material = look;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return copy;
}
