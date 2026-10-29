// Ground, sea and surf. Colors follow the art direction: smooth single-color grass and sand with
// a soft, uneven transition between them (not a hard line), and lighter water in the shallows.

import * as THREE from "three";
import { beachWidth, shoreDistance, shoreRadius, terrainHeight } from "../logic/island";
import { smoothstep } from "../logic/vec";
import { COLORS } from "./palette";

const RINGS = 72;
const SEGMENTS = 192;
const SEA_MARGIN = 24;

function groundColor(x: number, y: number, out: THREE.Color): THREE.Color {
  const sd = shoreDistance(x, y);
  const sand = new THREE.Color(COLORS.sand);
  if (sd < 0) {
    return out
      .copy(sand)
      .lerp(new THREE.Color(COLORS.seabed), smoothstep(0, 4, -sd))
      .lerp(new THREE.Color(COLORS.deepSeabed), smoothstep(6, 20, -sd));
  }
  out.copy(new THREE.Color(COLORS.wetSand)).lerp(sand, smoothstep(0, 2, sd));
  // A wobbly edge so the grass thins out into the sand instead of stopping on a line.
  const wobble = Math.sin(x * 0.45 + y * 0.12) * 1.1 + Math.sin(y * 0.6 - x * 0.2) * 0.8;
  const grassAmount = smoothstep(-2.2, 2.2, sd - beachWidth(x, y) + wobble);
  return out.lerp(new THREE.Color(COLORS.grass), grassAmount);
}

function buildGround(): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let ring = 0; ring <= RINGS; ring++) {
    const t = ring / RINGS;
    for (let seg = 0; seg <= SEGMENTS; seg++) {
      const angle = (seg / SEGMENTS) * Math.PI * 2;
      const r = t * (shoreRadius(angle) + SEA_MARGIN);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      positions.push(x, terrainHeight(x, y), y);
      groundColor(x, y, color);
      colors.push(color.r, color.g, color.b);
    }
  }
  const indices: number[] = [];
  const row = SEGMENTS + 1;
  for (let ring = 0; ring < RINGS; ring++) {
    for (let seg = 0; seg < SEGMENTS; seg++) {
      const a = ring * row + seg;
      const b = a + row;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
  ground.receiveShadow = true;
  return ground;
}

function buildFoam(offset: number, width: number): THREE.Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let seg = 0; seg <= SEGMENTS; seg++) {
    const angle = (seg / SEGMENTS) * Math.PI * 2;
    const r = shoreRadius(angle);
    for (const extra of [offset, offset + width]) {
      positions.push(Math.cos(angle) * (r + extra), 0.06, Math.sin(angle) * (r + extra));
    }
    if (seg < SEGMENTS) {
      const a = seg * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: COLORS.foam,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  );
}

export interface TerrainView {
  root: THREE.Group;
  update(time: number): void;
  dispose(): void;
}

export function buildTerrain(): TerrainView {
  const root = new THREE.Group();
  root.add(buildGround());

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({
      color: COLORS.water,
      roughness: 0.25,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  root.add(water);

  const foams = [buildFoam(0.1, 1.3), buildFoam(1.8, 0.7)];
  for (const f of foams) root.add(f);

  return {
    root,
    update(time) {
      foams.forEach((foam, i) => {
        const wave = Math.sin(time * 1.3 + i * 2.1);
        (foam.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.3 * (0.5 + 0.5 * wave);
        foam.scale.setScalar(1 + 0.006 * wave);
      });
    },
    dispose() {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    },
  };
}
