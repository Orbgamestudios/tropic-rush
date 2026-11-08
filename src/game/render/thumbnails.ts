// Renders small pictures of 3D models for the UI: hero portraits (head and shoulders, three-
// quarter view) and building icons. A little offscreen renderer draws each one once and keeps
// the image, so menus show the game's real models without shipping image files.

import * as THREE from "three";
import type { BuildingType } from "../logic/buildings";
import type { HeroKind } from "../logic/heroes";
import { kitVersion, stageFor } from "./buildingKit";
import { menuHero, visibleBox } from "./heroAssets";
import { buildingModel } from "./models";
import { SKY } from "./sky";

const SIZE = 256;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function setup(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene } {
  if (idleTimer) clearTimeout(idleTimer);
  // Free the extra WebGL context once nothing has been drawn for a while.
  idleTimer = setTimeout(() => {
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer = null;
    scene = null;
  }, 4000);
  if (renderer && scene) return { renderer, scene };
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x5a4a3a, 1.6));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
  key.position.set(4, 6, 5);
  const rim = new THREE.DirectionalLight(0x9fd4ff, 2.2);
  rim.position.set(-5, 3, -4);
  scene.add(key, rim);
  return { renderer, scene };
}

function snapshot(object: THREE.Object3D, camera: THREE.PerspectiveCamera): string {
  const { renderer, scene } = setup();
  scene.add(object);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  scene.remove(object);
  return url;
}

const portraits = new Map<HeroKind, Promise<string>>();
const icons = new Map<string, string>();

/** A head-and-shoulders portrait of a hero (a PNG data URL). */
export function heroPortrait(kind: HeroKind): Promise<string> {
  let pending = portraits.get(kind);
  if (!pending) {
    pending = menuHero(kind).then(({ holder: model }) => {
      // Turn to a three-quarter view, facing the camera.
      model.rotation.y = -Math.PI / 2 + 0.45;
      const box = visibleBox(model);
      const height = box.max.y - box.min.y;
      const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
      // Head and shoulders: centered a fifth of the way down from the top of the head.
      const target = new THREE.Vector3(
        0,
        kind === "tank" ? box.min.y + height * 0.55 : box.max.y - 0.36,
        0,
      );
      const frame = kind === "tank" ? height * 1.05 : 0.78;
      const distance = frame / (2 * Math.tan(THREE.MathUtils.degToRad(14)));
      camera.position.set(target.x + 0.15, target.y + height * 0.06, target.z + distance);
      camera.lookAt(target);
      return snapshot(model, camera);
    });
    portraits.set(kind, pending);
  }
  return pending;
}

function iconKey(type: BuildingType, level: number): string {
  return `${type}|${stageFor(type, level)}|${kitVersion()}`;
}

/** Nothing to see, while an icon waits its turn. */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
/** Icons still to draw, a frame apart, and the icon each image wants now. */
const waiting: { img: HTMLImageElement; type: BuildingType; level: number }[] = [];
const wanted = new WeakMap<HTMLImageElement, string>();

/**
 * Puts a building's icon in an image: straight away if it's been drawn already, or else a frame or
 * so later, one icon a frame, so a screen full of new ones opens without stopping to draw them all.
 */
export function showBuildingIcon(img: HTMLImageElement, type: BuildingType, level = 1): void {
  const key = iconKey(type, level);
  wanted.set(img, key);
  const ready = icons.get(key);
  if (ready) {
    img.src = ready;
    return;
  }
  img.src = BLANK;
  if (waiting.length === 0) requestAnimationFrame(drawWaiting);
  waiting.push({ img, type, level });
}

function drawWaiting(): void {
  const next = waiting.shift();
  if (next && wanted.get(next.img) === iconKey(next.type, next.level)) {
    next.img.src = buildingIcon(next.type, next.level);
  }
  if (waiting.length > 0) requestAnimationFrame(drawWaiting);
}

/** A three-quarter picture of a building at a level (a PNG data URL). */
export function buildingIcon(type: BuildingType, level = 1): string {
  const key = iconKey(type, level);
  let url = icons.get(key);
  if (!url) {
    const model = buildingModel(type, false, level).root;
    model.rotation.y = -Math.PI / 4;
    const box = visibleBox(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.62;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(15));
    camera.position.set(center.x, center.y + distance * 0.55, center.z + distance * 0.84);
    camera.lookAt(center);
    // Drawn as by day, whatever the hour: the lamps on a model light up with the dark.
    const dark = SKY.dark.value;
    SKY.dark.value = 0;
    url = snapshot(model, camera);
    SKY.dark.value = dark;
    icons.set(key, url);
  }
  return url;
}
