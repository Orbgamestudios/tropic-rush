// The crew's home island: a long sand island with four terraces climbing it in a zigzag (one per
// build zone, each higher than the last), sand-colored cliffs between them, a tall cliff across
// the back, and animated water. Sand only for now; trees, rocks and real models come later.

import * as THREE from "three";
import { TILE, ZONES, zoneBounds } from "../logic/crewIsland";
import { clamp, smoothstep } from "../logic/vec";

// Island outline: a rounded rectangle (superellipse), long north-south to hold the terraces.
const CENTER = { x: 0, y: -35 };
const HALF_X = 62;
const HALF_Y = 78;
const POWER = 4;

/** Height of zone 1, the landing area. */
export const PLATEAU = ZONES[0]?.height ?? 2.2;
const BEACH_START = 0.88; // superellipse radius where the ground starts sloping to the beach

export function islandRadius(x: number, y: number): number {
  const dx = Math.abs((x - CENTER.x) / HALF_X);
  const dy = Math.abs((y - CENTER.y) / HALF_Y);
  return (dx ** POWER + dy ** POWER) ** (1 / POWER);
}

/** Raised blocks of land (meters): the zigzag terraces and the back cliff. Each zone's build
 * area sits inside its block with a few meters to spare, so the cliffs never cut into it. */
interface Block {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  height: number;
}

const zoneHeight = (id: number) => ZONES[id - 1]?.height ?? PLATEAU;
const BLOCKS: readonly Block[] = [
  { x0: -90, x1: -1, y0: -46, y1: -15, height: zoneHeight(2) }, // west terrace
  { x0: -1, x1: 90, y0: -72, y1: -15, height: zoneHeight(3) }, // east terrace
  { x0: -90, x1: 7, y0: -104, y1: -46, height: zoneHeight(4) }, // summit
  { x0: 7, x1: 90, y0: -104, y1: -72, height: 24 }, // back cliff, east
  { x0: -90, x1: 90, y0: -160, y1: -104, height: 24 }, // back cliff
];

/** 1 inside a block, falling to 0 over a few meters outside it: a steep sand cliff. */
function blockMask(b: Block, x: number, y: number): number {
  const wobble = 0.7 * Math.sin(x * 0.23 + y * 0.11) + 0.5 * Math.sin(y * 0.31 - x * 0.07);
  const outside = Math.max(b.x0 - x, x - b.x1, b.y0 - y, y - b.y1) + wobble;
  return 1 - smoothstep(0, 3, outside);
}

export function homeHeight(x: number, y: number): number {
  const r = islandRadius(x, y);
  if (r >= 1) return -0.15 - Math.min(5, (r - 1) * HALF_X * 0.25);
  // Beach: an even slope from the landing area's height down to the waterline.
  const beach = smoothstep(1, BEACH_START, r);
  let h = PLATEAU * (0.08 + 0.92 * beach) - 0.15 * (1 - beach);
  // Terraces and cliffs, falling away into the sea at the island's rim.
  const rim = smoothstep(1, 0.93, r);
  for (const b of BLOCKS) {
    const m = blockMask(b, x, y);
    if (m > 0) h = Math.max(h, PLATEAU + (b.height - PLATEAU) * m * rim);
  }
  return h;
}

/** Soft, tileable wind ripples for the sand's bump map. */
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
      const value = 128 + 70 * ripple + 30 * grain;
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
const CLIFF_SAND = new THREE.Color(0xe6c88f);
const SEABED = new THREE.Color(0xbfe0c8);

function buildGround(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(150, 196, 250, 326);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getZ(i) + CENTER.y;
    pos.setXYZ(i, x, homeHeight(x, y), y);
    uv.setXY(i, x / 7, y / 7); // ripples repeat every 7 m
  }
  geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i);
    const steep = 1 - normal.getY(i);
    if (h < -0.15) c.copy(WET_SAND).lerp(SEABED, smoothstep(-0.15, -3, h));
    else c.copy(WET_SAND).lerp(DRY_SAND, smoothstep(0, 0.55, h));
    // Steep cliff faces a shade warmer and darker, so the cliff reads against the sky.
    c.lerp(CLIFF_SAND, clamp(steep * 2.4, 0, 1) * smoothstep(PLATEAU, PLATEAU + 1.5, h));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    bumpMap: rippleTexture(),
    bumpScale: 0.22,
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
    vec2 d = abs((p - vec2(${CENTER.x.toFixed(1)}, ${CENTER.y.toFixed(1)})) / vec2(${HALF_X.toFixed(1)}, ${HALF_Y.toFixed(1)}));
    return pow(pow(d.x, ${POWER.toFixed(1)}) + pow(d.y, ${POWER.toFixed(1)}), ${(1 / POWER).toFixed(4)});
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
    float dist = (islandRadius(p) - 1.0) * ${Math.min(HALF_X, HALF_Y).toFixed(1)};

    // Lighter in the shallows, deeper turquoise further out.
    vec3 color = mix(uShallow, uDeep, smoothstep(0.0, 22.0, dist));

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

    // Foam: a band hugging the shore plus waves that roll in and fade.
    float wobble = noise(p * 0.35 + t * 0.1) * 1.4;
    float shoreFoam = 1.0 - smoothstep(0.1, 0.9 + wobble * 0.4, dist);
    float wave = sin(dist * 1.1 - t * 1.6 + wobble * 2.0) * 0.5 + 0.5;
    float waves = smoothstep(0.82, 0.97, wave) * (1.0 - smoothstep(0.5, 5.0, dist)) * noise(p * 0.8 + t * 0.3);
    float foam = clamp(shoreFoam + waves * 1.4, 0.0, 1.0);
    color = mix(color, vec3(1.0), foam * 0.85);

    // See-through near the beach so the wet sand shows, more solid further out.
    float alpha = mix(0.5, 0.94, smoothstep(0.0, 9.0, dist));
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
  dispose(): void;
}

function buildGrid(
  width: number,
  depth: number,
): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const geometry = new THREE.PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uStrength: { value: 0.18 },
      uTile: { value: TILE },
      uSize: { value: new THREE.Vector2(width, depth) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      uniform vec2 uSize;
      void main() {
        vLocal = position.xz + uSize * 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vLocal;
      uniform float uStrength;
      uniform float uTile;
      uniform vec2 uSize;
      void main() {
        vec2 cell = vLocal / uTile;
        vec2 grid = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
        float line = 1.0 - min(min(grid.x, grid.y), 1.0);
        // Fade the outer edge so the grid sits softly in the sand.
        vec2 edge = min(vLocal, uSize - vLocal);
        float border = smoothstep(0.0, 1.5, min(edge.x, edge.y));
        gl_FragColor = vec4(1.0, 1.0, 1.0, line * uStrength * border);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  return { mesh, material };
}

/** A soft haze with diagonal stripes over a locked zone. */
function lockedHaze(width: number, depth: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uSize: { value: new THREE.Vector2(width, depth) } },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      uniform vec2 uSize;
      void main() {
        vLocal = position.xz + uSize * 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vLocal;
      uniform vec2 uSize;
      void main() {
        float stripe = step(0.5, fract((vLocal.x + vLocal.y) / 4.0));
        vec2 edge = min(vLocal, uSize - vLocal);
        float border = smoothstep(0.0, 2.0, min(edge.x, edge.y));
        gl_FragColor = vec4(0.42, 0.33, 0.2, (0.1 + 0.06 * stripe) * border);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  return mesh;
}

export function buildHomeIsland(): HomeIslandView {
  const root = new THREE.Group();
  const ground = buildGround();
  root.add(ground);

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
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  root.add(water);

  const zones = ZONES.map((zone) => {
    const bounds = zoneBounds(zone);
    const grid = buildGrid(bounds.w, bounds.h);
    const haze = lockedHaze(bounds.w, bounds.h);
    for (const [mesh, lift] of [
      [grid.mesh, 0.03],
      [haze, 0.05],
    ] as const) {
      mesh.position.set(bounds.x + bounds.w / 2, zone.height + lift, bounds.y + bounds.h / 2);
      root.add(mesh);
    }
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
        (z.grid.material.uniforms.uStrength as THREE.IUniform<number>).value = on ? 0.45 : 0.18;
    },
    setUnlocked(count) {
      for (const z of zones) {
        z.grid.mesh.visible = z.zone.id <= count;
        z.haze.visible = z.zone.id > count;
      }
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
