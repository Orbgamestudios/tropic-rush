// Soft banks of mist drifting low over the sea around the island, so the edges of the view fade
// into white puffs the way the beach mockup does. They stay off the landing beach's side so they
// never hide the gunboat. Every puff is a quad tilted towards the camera, all merged into one
// mesh: one draw call for the lot.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { VIEW_YAW } from "../config";
import { beachSide, shoreRadius } from "../logic/island";
import { createRng } from "../logic/rng";
import { SKY } from "./sky";

const PUFFS = 260;

export function cloudTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    // A puffy cluster of soft white blobs.
    const puffs: [number, number, number][] = [
      [0.5, 0.55, 0.3],
      [0.32, 0.6, 0.22],
      [0.68, 0.6, 0.22],
      [0.42, 0.42, 0.2],
      [0.6, 0.42, 0.18],
      [0.2, 0.66, 0.14],
      [0.8, 0.66, 0.14],
    ];
    for (const [x, y, r] of puffs) {
      const grad = g.createRadialGradient(x * size, y * size, 0, x * size, y * size, r * size);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      grad.addColorStop(0.55, "rgba(246, 250, 255, 0.65)");
      grad.addColorStop(1, "rgba(225, 236, 248, 0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x * size, y * size, r * size, 0, Math.PI * 2);
      g.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface CloudView {
  root: THREE.Group;
  update(time: number): void;
  dispose(): void;
}

export function buildClouds(seed: number): CloudView {
  const root = new THREE.Group();
  const texture = cloudTexture();
  const rng = createRng(seed + 404);
  const quads: THREE.BufferGeometry[] = [];
  for (let i = 0; i < PUFFS * 3 && quads.length < PUFFS; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = shoreRadius(angle) + 3 + rng() * 30;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (beachSide(x, y) > 0.12) continue;
    const size = 11 + rng() * 15;
    const quad = new THREE.PlaneGeometry(size, size * 0.62);
    // Lean back and turn to face the camera, about 40 degrees up at the diamond angle.
    quad.rotateX(-0.75);
    quad.rotateY(VIEW_YAW);
    quad.translate(x, 2 + rng() * 2.5, y);
    quads.push(quad);
  }
  const geometry = mergeGeometries(quads, false);
  for (const q of quads) q.dispose();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    fog: false,
    opacity: 0.9,
  });
  material.color = SKY.unlit.value;
  const mesh = new THREE.Mesh(geometry ?? new THREE.BufferGeometry(), material);
  mesh.renderOrder = 5;
  root.add(mesh);
  return {
    root,
    update(time) {
      // The banks drift slowly back and forth along the coast and rise and fall a little.
      root.rotation.y = Math.sin(time * 0.02) * 0.03;
      root.position.y = Math.sin(time * 0.3) * 0.2;
    },
    dispose() {
      geometry?.dispose();
      texture.dispose();
      material.dispose();
    },
  };
}
