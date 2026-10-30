// Renders small pictures of 3D models for the UI: hero portraits (head and shoulders, three-
// quarter view) and building icons. A little offscreen renderer draws each one once and keeps
// the image, so menus show the game's real models without shipping image files.

import * as THREE from "three";
import type { BuildingType } from "../logic/buildings";
import type { HeroKind } from "../logic/heroes";
import { menuHeroModel, visibleBox } from "./heroAssets";
import { buildingModel } from "./models";

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
const icons = new Map<BuildingType, string>();

/** A head-and-shoulders portrait of a hero (a PNG data URL). */
export function heroPortrait(kind: HeroKind): Promise<string> {
  let pending = portraits.get(kind);
  if (!pending) {
    pending = menuHeroModel(kind).then((model) => {
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

/** A three-quarter picture of a building (a PNG data URL). */
export function buildingIcon(type: BuildingType): string {
  let url = icons.get(type);
  if (!url) {
    const model = buildingModel(type).root;
    model.rotation.y = -Math.PI / 4;
    const box = visibleBox(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.62;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(15));
    camera.position.set(center.x, center.y + distance * 0.55, center.z + distance * 0.84);
    camera.lookAt(center);
    url = snapshot(model, camera);
    icons.set(type, url);
  }
  return url;
}
