// The building grid, draped over the ground across every buildable tile. It only shows while a
// building is being placed or moved, so the island looks like an island the rest of the time.

import * as THREE from "three";
import { buildableTiles, GRID_ORIGIN, TILE } from "../logic/crewIsland";
import { homeHeight } from "../logic/island";

export function buildTileGrid(): THREE.Mesh {
  const tiles = buildableTiles();
  const positions = new Float32Array(tiles.length * 12);
  const index: number[] = [];
  tiles.forEach((t, i) => {
    const x0 = GRID_ORIGIN.x + t.x * TILE;
    const y0 = GRID_ORIGIN.y + t.y * TILE;
    const corners = [
      [x0, y0],
      [x0 + TILE, y0],
      [x0, y0 + TILE],
      [x0 + TILE, y0 + TILE],
    ] as const;
    corners.forEach(([x, y], k) => {
      positions.set([x, homeHeight(x, y) + 0.1, y], (i * 4 + k) * 3);
    });
    const v = i * 4;
    index.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(index);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTile: { value: TILE },
      uOrigin: { value: new THREE.Vector2(GRID_ORIGIN.x, GRID_ORIGIN.y) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vWorld;
      void main() {
        vWorld = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vWorld;
      uniform float uTile;
      uniform vec2 uOrigin;
      void main() {
        vec2 cell = (vWorld - uOrigin) / uTile;
        vec2 grid = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
        float line = 1.0 - min(min(grid.x, grid.y), 1.0);
        gl_FragColor = vec4(1.0, 1.0, 0.92, line * 0.45);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  mesh.visible = false;
  return mesh;
}
