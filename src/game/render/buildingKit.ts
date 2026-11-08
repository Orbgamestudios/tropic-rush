// Buildings modeled in Blender by scripts/blender/make_buildings.py: ten stages each, from scrap wood
// to polished steel, packed by scripts/pack-buildings.mjs. The gunboat and what it fires
// come from there too. Every one is drawn from one shared texture, with the light baked into its
// corners, so a stage costs a draw call for each part that moves on its own. Until a file arrives, or
// for buildings not modeled yet, models.ts builds the old one from primitives.

import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BUILDINGS, type BuildingType } from "../logic/buildings";
import { PROGRESSION } from "../logic/economy";
import { SKY } from "./sky";

export const STAGES = 10;

/** The buildings modeled so far: all but the land mine, a disc too small to be worth it. */
const MODELED: readonly BuildingType[] = [
  "headquarters",
  "gunTurret",
  "mortar",
  "harpoon",
  "flamethrower",
  "watchtower",
  "goldMine",
  "lumberCamp",
  "quarry",
  "scrapYard",
  "goldVault",
  "timberShed",
  "stoneYard",
  "scrapBin",
  "refinery",
  "laboratory",
];

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

/** Smallest a building stands at its first level, against its full size at its top one. */
const FIRST_SIZE = 0.9;

/**
 * How big a building stands at a level, as a share of its full fitted size: a little bigger with
 * every level, so it keeps growing between one look and the next. Defenses stand full size from
 * their first level.
 */
export function levelSize(type: BuildingType, level: number): number {
  const most = PROGRESSION[type].maxLevel;
  if (most <= 1 || BUILDINGS[type].attack) return 1;
  const along = Math.min(1, Math.max(0, (level - 1) / (most - 1)));
  return FIRST_SIZE + (1 - FIRST_SIZE) * along;
}

/** Goes up whenever more models arrive, so whatever was drawn without them can be drawn again. */
export function kitVersion(): number {
  return version;
}

/**
 * The texture's squares, as scripts/blender/kit.py lays them out: a GRID by GRID of materials, in
 * its MATERIALS order. Lamps and glass are the 19th and 20th.
 */
const GRID = 6;
const LAMP_SQUARE = { col: 0, row: 3 };
const GLASS_SQUARE = { col: 1, row: 3 };
/** What lamps and windows give off after dark: a warm bulb, and a room lit behind the glass. */
const LAMP_GLOW = [255, 205, 150] as const;
const WINDOW_GLOW = [110, 72, 36] as const;
/** How bright a lamp shows at full dark, against its own color. */
const GLOW_POWER = 3.2;

let glowMap: THREE.DataTexture | null = null;

/** One texel a square: lamps glow, windows glow a little, nothing else does. */
function glowSquares(): THREE.DataTexture {
  if (glowMap) return glowMap;
  const data = new Uint8Array(GRID * GRID * 4);
  for (const [square, rgb] of [
    [LAMP_SQUARE, LAMP_GLOW],
    [GLASS_SQUARE, WINDOW_GLOW],
  ] as const) {
    data.set([...rgb, 255], (square.row * GRID + square.col) * 4);
  }
  glowMap = new THREE.DataTexture(data, GRID, GRID);
  glowMap.colorSpace = THREE.SRGBColorSpace;
  glowMap.magFilter = THREE.NearestFilter;
  glowMap.minFilter = THREE.NearestFilter;
  glowMap.needsUpdate = true;
  return glowMap;
}

async function atlas(side: Side): Promise<void> {
  const map = await new THREE.TextureLoader().loadAsync(
    `${import.meta.env.BASE_URL}textures/building-kit-${side}.webp`,
  );
  map.colorSpace = THREE.SRGBColorSpace;
  // The models' texture coordinates come from glTF, which counts from the top.
  map.flipY = false;
  map.anisotropy = 4;
  const look = new THREE.MeshLambertMaterial({
    map,
    vertexColors: true,
    emissive: 0xffffff,
    emissiveMap: glowSquares(),
  });
  // Lamps and windows light up as the sky darkens, with nothing to update each frame.
  look.onBeforeCompile = (shader) => {
    shader.uniforms.uDark = SKY.dark;
    shader.fragmentShader = `uniform float uDark;\n${shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= min(1.0, uDark) * ${GLOW_POWER.toFixed(1)};`,
    )}`;
  };
  looks[side] = look;
}

const LAMP_MARK = "kitLamp";

/** How close together the corners of one lamp lie, in meters, against the next lamp along. */
const LAMP_SIZE = 0.5;

/**
 * Finds a stage's lamps by what they're painted with, and marks each one with an empty that goes
 * wherever the model does, so a lamp's light can come from the lamp.
 */
function markLamps(stage: THREE.Object3D): void {
  stage.updateMatrixWorld(true);
  const toStage = stage.matrixWorld.clone().invert();
  const lamps: { sum: THREE.Vector3; count: number }[] = [];
  const corner = new THREE.Vector3();
  const middle = new THREE.Vector3();
  const [u0, u1] = [LAMP_SQUARE.col / GRID, (LAMP_SQUARE.col + 1) / GRID];
  const [v0, v1] = [LAMP_SQUARE.row / GRID, (LAMP_SQUARE.row + 1) / GRID];
  stage.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const uv = o.geometry.getAttribute("uv");
    const position = o.geometry.getAttribute("position");
    if (!uv || !position) return;
    const toLocal = toStage.clone().multiply(o.matrixWorld);
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      if (u < u0 || u > u1 || v < v0 || v > v1) continue;
      corner.fromBufferAttribute(position, i).applyMatrix4(toLocal);
      const lamp = lamps.find(
        (l) => middle.copy(l.sum).divideScalar(l.count).distanceTo(corner) < LAMP_SIZE,
      );
      if (lamp) {
        lamp.sum.add(corner);
        lamp.count++;
      } else lamps.push({ sum: corner.clone(), count: 1 });
    }
  });
  for (const lamp of lamps) {
    const mark = new THREE.Object3D();
    mark.name = LAMP_MARK;
    mark.position.copy(lamp.sum).divideScalar(lamp.count);
    stage.add(mark);
  }
}

/** Where a placed building's lamps are, in the world: none for one without any. */
export function lampSpots(root: THREE.Object3D): THREE.Vector3[] {
  root.updateWorldMatrix(true, true);
  const spots: THREE.Vector3[] = [];
  root.traverse((o) => {
    if (o.name === LAMP_MARK) spots.push(o.getWorldPosition(new THREE.Vector3()));
  });
  return spots;
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
          markLamps(stage);
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

/** A copy of one of the models that aren't buildings, or null until it's arrived. */
export function kitPiece(name: Piece, crew = true): THREE.Object3D | null {
  const piece = pieces.get(name);
  const look = looks[crew ? "crew" : "enemy"];
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
