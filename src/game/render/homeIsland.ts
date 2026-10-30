// The crew's home island (and, later, every enemy island's starting shape): a wide, rounded
// diamond of land with a flat grass plateau for buildings in the middle, organic grass hills
// around it rising towards the north and east, sandy cliffs dropping into the sea, and one long
// sandy beach on the south-west side that shallows out into the water. Grass fades softly into
// sand. Trees, rocks and real models come later.

import * as THREE from "three";
import {
  GRID_ORIGIN,
  PLATEAU_HEIGHT,
  plateauInside,
  TILE,
  ZONES,
  type Zone,
  zoneTiles,
} from "../logic/crewIsland";
import { clamp, lerp, smoothstep } from "../logic/vec";

/** The island's middle, for cameras that circle it. */
export const HOME_CENTER = { x: 0, y: 0 };
/** Island outline: a rounded diamond, wider than deep, with gentle lumps. */
const ISLAND = { rx: 128, ry: 102, power: 2.4, lumps: [0.035, 0.7, 0.025, 2.9] } as const;
/** Rough distance (meters) from the island's middle to its shore, for turning radius into meters. */
const SHORE_SCALE = 95;
/** The beach faces this way (south-west, as a unit vector in x east, y south). */
const BEACH_DIR = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };

/** Height of the flat build plateau. */
export const PLATEAU = PLATEAU_HEIGHT;

/** 0 at the island's middle, 1 on its shoreline, more than 1 out at sea. */
export function islandRadius(x: number, y: number): number {
  const sx = (x - HOME_CENTER.x) / ISLAND.rx;
  const sy = (y - HOME_CENTER.y) / ISLAND.ry;
  // Turned 45 degrees, a rounded square becomes a rounded diamond.
  const u = Math.abs(sx + sy) * Math.SQRT1_2;
  const v = Math.abs(sx - sy) * Math.SQRT1_2;
  const angle = Math.atan2(sy, sx);
  const edge =
    1 +
    ISLAND.lumps[0] * Math.sin(3 * angle + ISLAND.lumps[1]) +
    ISLAND.lumps[2] * Math.sin(5 * angle + ISLAND.lumps[3]);
  return ((u ** ISLAND.power + v ** ISLAND.power) ** (1 / ISLAND.power) * 1.25) / edge;
}

/** 1 along the beach side of the island, 0 elsewhere, blending over a wide arc. */
function beachSide(x: number, y: number): number {
  const dx = x - HOME_CENTER.x;
  const dy = y - HOME_CENTER.y;
  const length = Math.hypot(dx, dy) || 1;
  return smoothstep(0.5, 0.92, (dx * BEACH_DIR.x + dy * BEACH_DIR.y) / length);
}

/** Smooth bumps built from sines (about 0 to 1): soft, organic variation. */
function lumps(x: number, y: number): number {
  return (
    0.5 +
    0.25 * Math.sin(x * 0.071 + y * 0.043) * Math.sin(y * 0.083 - x * 0.021) +
    0.15 * Math.sin(x * 0.157 - y * 0.113 + 1.3) +
    0.1 * Math.sin(x * 0.29 + y * 0.31)
  );
}

export function homeHeight(x: number, y: number): number {
  const r = islandRadius(x, y);
  const beach = beachSide(x, y);
  const shore = (1 - r) * SHORE_SCALE; // meters inland from the shoreline
  if (r >= 1) {
    // Seabed: a long shallow shelf off the beach, dropping away faster below the cliffs.
    return Math.max(-7, -0.35 + shore * lerp(0.3, 0.06, beach));
  }
  const plateau = plateauInside(x, y);
  // Hills ring the plateau: tall in the north and east, low and rolling towards the beach.
  const north = smoothstep(0, -80, y - HOME_CENTER.y);
  const hillHeight = lerp(7 + 6 * north, 1.2, beach);
  const hill = smoothstep(1, 26, -plateau) * hillHeight * (0.45 + 0.85 * lumps(x, y));
  const land = PLATEAU_HEIGHT + hill;
  // Down to the sea: sandy cliffs most of the way round, a long gentle beach to the south-west.
  const cliff = smoothstep(0, 8 + 4 * lumps(y, x), shore);
  const sand = smoothstep(0, 38, shore) ** 1.3;
  const coast = lerp(cliff, sand, beach);
  const around = lerp(-0.35, land, coast);
  // Flat on the plateau, easing into the land around it.
  return lerp(around, PLATEAU_HEIGHT, smoothstep(-6, 0.5, plateau));
}

/** Soft, tileable wind ripples and grain for the ground's bump map. */
function rippleTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas");
  const image = ctx.createImageData(size, size);
  const tau = Math.PI * 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const v = py / size;
      // Whole numbers of waves across the tile keep it seamless.
      const warp = 0.08 * Math.sin(tau * (2 * u + v)) + 0.05 * Math.sin(tau * (3 * v - u));
      const ripple = Math.sin(tau * (6 * v + 1 * u + warp * 3));
      const grain = Math.sin(tau * (17 * u + 5 * v)) * Math.sin(tau * (13 * v - 7 * u)) * 0.25;
      const value = 128 + 50 * ripple + 45 * grain;
      const i = (py * size + px) * 4;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const DRY_SAND = new THREE.Color(0xf2dba3);
const WET_SAND = new THREE.Color(0xd6b97f);
const CLIFF_SAND = new THREE.Color(0xd8b07a);
const SEABED = new THREE.Color(0xbfe0c8);
const GRASS = new THREE.Color(0x76bd45);
const GRASS_DEEP = new THREE.Color(0x58a23a);
const GRASS_DRY = new THREE.Color(0xa9c862);

function buildGround(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(280, 230, 373, 306);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + HOME_CENTER.x;
    const y = pos.getZ(i) + HOME_CENTER.y;
    pos.setXYZ(i, x, homeHeight(x, y), y);
    uv.setXY(i, x / 7, y / 7); // ripples repeat every 7 m
  }
  geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const grass = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getZ(i);
    const h = pos.getY(i);
    const steep = clamp((1 - normal.getY(i)) * 3.2, 0, 1);
    if (h < -0.15) c.copy(WET_SAND).lerp(SEABED, smoothstep(-0.15, -3, h));
    else c.copy(WET_SAND).lerp(DRY_SAND, smoothstep(0, 0.55, h));
    c.lerp(CLIFF_SAND, steep * smoothstep(0.6, 1.6, h));
    // Steep slopes show bare sand; the rest is grass, fading softly through dry grass into the
    // beach along a wavy line.
    const edge = 1.25 + (lumps(x * 2.3, y * 2.3) - 0.5) * 1.1;
    const grassy = smoothstep(edge - 0.35, edge + 0.55, h) * (1 - smoothstep(0.35, 0.75, steep));
    grass.copy(GRASS).lerp(GRASS_DEEP, 0.45 * smoothstep(0.3, 0.8, lumps(x * 1.7 + 40, y * 1.7)));
    grass.lerp(GRASS_DRY, 1 - smoothstep(0.4, 1, grassy));
    c.lerp(grass, grassy);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    bumpMap: rippleTexture(),
    bumpScale: 0.16,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

const WATER_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mv = viewMatrix * world;
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const f = (n: number) => n.toFixed(4);

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSunDir;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorld;
  varying float vFogDepth;

  float islandRadius(vec2 p) {
    vec2 s = (p - vec2(${f(HOME_CENTER.x)}, ${f(HOME_CENTER.y)})) / vec2(${f(ISLAND.rx)}, ${f(ISLAND.ry)});
    float u = abs(s.x + s.y) * ${f(Math.SQRT1_2)};
    float v = abs(s.x - s.y) * ${f(Math.SQRT1_2)};
    float a = atan(s.y, s.x);
    float edge = 1.0 + ${f(ISLAND.lumps[0])} * sin(3.0 * a + ${f(ISLAND.lumps[1])})
      + ${f(ISLAND.lumps[2])} * sin(5.0 * a + ${f(ISLAND.lumps[3])});
    return pow(pow(u, ${f(ISLAND.power)}) + pow(v, ${f(ISLAND.power)}), ${f(1 / ISLAND.power)}) * 1.25 / edge;
  }

  float beachSide(vec2 p) {
    vec2 d = normalize(p - vec2(${f(HOME_CENTER.x)}, ${f(HOME_CENTER.y)}) + 1e-4);
    return smoothstep(0.5, 0.92, dot(d, vec2(${f(BEACH_DIR.x)}, ${f(BEACH_DIR.y)})));
  }

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    vec2 p = vWorld.xz;
    float dist = (islandRadius(p) - 1.0) * ${f(SHORE_SCALE)};
    float beach = beachSide(p);

    // Lighter in the shallows (a much wider band off the beach), deeper turquoise further out.
    vec3 color = mix(uShallow, uDeep, smoothstep(0.0, mix(16.0, 55.0, beach), dist));

    // Small moving ripples: a normal built from two drifting noise layers.
    float t = uTime;
    float n1 = noise(p * 0.55 + vec2(t * 0.35, t * 0.2));
    float n2 = noise(p * 1.3 - vec2(t * 0.25, -t * 0.4));
    vec3 normal = normalize(vec3((n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.2, 1.0, (n2 - 0.5) * 0.35 - (n1 - 0.5) * 0.2));
    vec3 view = normalize(cameraPosition - vWorld);
    vec3 halfDir = normalize(uSunDir + view);
    float sparkle = pow(max(dot(normal, halfDir), 0.0), 140.0);
    color += vec3(1.0, 0.97, 0.9) * sparkle * 0.9;
    color += (n1 - 0.5) * 0.04;

    // Foam: a band hugging the shore plus waves that roll in and fade (further off the beach).
    float wobble = noise(p * 0.35 + t * 0.1) * 1.4;
    float shoreFoam = 1.0 - smoothstep(0.1, 0.9 + wobble * 0.4, dist);
    float wave = sin(dist * mix(1.1, 0.6, beach) - t * 1.6 + wobble * 2.0) * 0.5 + 0.5;
    float reach = mix(5.0, 12.0, beach);
    float waves = smoothstep(0.82, 0.97, wave) * (1.0 - smoothstep(0.5, reach, dist)) * noise(p * 0.8 + t * 0.3);
    float foam = clamp(shoreFoam + waves * 1.4, 0.0, 1.0);
    color = mix(color, vec3(1.0), foam * 0.85);

    // See-through in the shallows so the sand shows, more solid further out.
    float alpha = mix(0.45, 0.94, smoothstep(0.0, mix(9.0, 30.0, beach), dist));
    alpha = max(alpha, foam * 0.9);

    float fog = smoothstep(uFogNear, uFogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, uFogColor, fog), alpha);
    #include <colorspace_fragment>
  }
`;

export interface HomeIslandView {
  root: THREE.Group;
  update(time: number, fog: THREE.Fog, sunDirection: THREE.Vector3): void;
  /** Brightens the grid lines while a building is being placed or moved. */
  setGridEmphasis(on: boolean): void;
  /** Shows grids on open zones and a haze over locked ones. */
  setUnlocked(count: number): void;
  /** Shows or hides every grid and haze (hidden on the title screen). */
  showOverlays(on: boolean): void;
  dispose(): void;
}

/** One flat quad per buildable tile in a zone, with each corner's distance inside the plateau. */
function zoneTileGeometry(zone: Zone, lift: number): THREE.BufferGeometry {
  const tiles = zoneTiles(zone.id);
  const positions = new Float32Array(tiles.length * 12);
  const edges = new Float32Array(tiles.length * 4);
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
      positions.set([x, zone.height + lift, y], (i * 4 + k) * 3);
      edges[i * 4 + k] = plateauInside(x, y);
    });
    const v = i * 4;
    index.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aEdge", new THREE.BufferAttribute(edges, 1));
  geometry.setIndex(index);
  return geometry;
}

const OVERLAY_VERTEX = /* glsl */ `
  attribute float aEdge;
  varying vec2 vWorld;
  varying float vEdge;
  void main() {
    vWorld = position.xz;
    vEdge = aEdge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Grid lines over a zone's buildable tiles, fading out towards the plateau's edge. */
function buildGrid(zone: Zone): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uStrength: { value: 0.22 },
      uTile: { value: TILE },
      uOrigin: { value: new THREE.Vector2(GRID_ORIGIN.x, GRID_ORIGIN.y) },
    },
    vertexShader: OVERLAY_VERTEX,
    fragmentShader: /* glsl */ `
      varying vec2 vWorld;
      varying float vEdge;
      uniform float uStrength;
      uniform float uTile;
      uniform vec2 uOrigin;
      void main() {
        vec2 cell = (vWorld - uOrigin) / uTile;
        vec2 grid = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
        float line = 1.0 - min(min(grid.x, grid.y), 1.0);
        float fade = mix(0.35, 1.0, smoothstep(1.0, 5.0, vEdge));
        gl_FragColor = vec4(1.0, 1.0, 0.92, line * uStrength * fade);
      }
    `,
  });
  const mesh = new THREE.Mesh(zoneTileGeometry(zone, 0.04), material);
  mesh.renderOrder = 1;
  return { mesh, material };
}

/** A soft striped haze over a locked zone. */
function lockedHaze(zone: Zone): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: OVERLAY_VERTEX,
    fragmentShader: /* glsl */ `
      varying vec2 vWorld;
      varying float vEdge;
      void main() {
        float stripe = step(0.5, fract((vWorld.x + vWorld.y) / 4.0));
        float border = smoothstep(0.5, 3.0, vEdge);
        gl_FragColor = vec4(0.16, 0.22, 0.1, (0.13 + 0.07 * stripe) * border);
      }
    `,
  });
  const mesh = new THREE.Mesh(zoneTileGeometry(zone, 0.06), material);
  mesh.renderOrder = 1;
  return mesh;
}

export function buildHomeIsland(): HomeIslandView {
  const root = new THREE.Group();
  root.add(buildGround());

  const waterMaterial = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(0x7fe3d8) },
      uDeep: { value: new THREE.Color(0x15a3c4) },
      uSunDir: { value: new THREE.Vector3(-0.4, 0.7, 0.5).normalize() },
      uFogColor: { value: new THREE.Color(0xbfe6f2) },
      uFogNear: { value: 80 },
      uFogFar: { value: 260 },
    },
    vertexShader: WATER_VERTEX,
    fragmentShader: WATER_FRAGMENT,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(HOME_CENTER.x, 0, HOME_CENTER.y);
  root.add(water);

  const overlays = new THREE.Group();
  root.add(overlays);
  const zones = ZONES.map((zone) => {
    const grid = buildGrid(zone);
    const haze = lockedHaze(zone);
    overlays.add(grid.mesh, haze);
    return { zone, grid, haze };
  });

  return {
    root,
    update(time, fog, sunDirection) {
      const u = waterMaterial.uniforms;
      (u.uTime as THREE.IUniform<number>).value = time;
      (u.uFogColor as THREE.IUniform<THREE.Color>).value.copy(fog.color);
      (u.uFogNear as THREE.IUniform<number>).value = fog.near;
      (u.uFogFar as THREE.IUniform<number>).value = fog.far;
      (u.uSunDir as THREE.IUniform<THREE.Vector3>).value.copy(sunDirection);
    },
    setGridEmphasis(on) {
      for (const z of zones)
        (z.grid.material.uniforms.uStrength as THREE.IUniform<number>).value = on ? 0.5 : 0.22;
    },
    setUnlocked(count) {
      for (const z of zones) {
        z.grid.mesh.visible = z.zone.id <= count;
        z.haze.visible = z.zone.id > count;
      }
    },
    showOverlays(on) {
      overlays.visible = on;
    },
    dispose() {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material & { bumpMap?: THREE.Texture | null };
          m.bumpMap?.dispose();
          m.dispose();
        }
      });
    },
  };
}
