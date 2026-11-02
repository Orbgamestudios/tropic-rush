// Ground and sea, shared by raid islands and the crew's home island. The ground is one
// vertex-colored mesh: wet sand at the
// water's edge, the beach, grass in two shades that drift in soft patches, a darker jungle floor,
// bare rock on steep slopes and a dirt trail from the landing beach up to the headquarters. The
// sea is a shader: see-through turquoise shallows over the sand, deeper blue further out, drifting
// ripples with sun glints, and foam that hugs the shore and rolls in as waves.

import * as THREE from "three";
import { HOME_SHAPE, type IslandShape, lavaWidth, shoreRadius } from "../logic/island";
import { smoothstep, type Vec2 } from "../logic/vec";
import { bladeTexture, swathes } from "./meadow";
import { NOISE_CELLS, noiseTexture } from "./noiseTexture";
import { COLORS } from "./palette";
import type { SceneryMap } from "./scenery";
import { SKY } from "./sky";

const RINGS = 84;
const SEGMENTS = 200;
const SEA_MARGIN = 26;
/** How many meters one tile of the blade texture covers on the lawn. */
const BLADE_METERS = 7;
/** Enemy islands can be any shape, so their ground is a square grid this fine, in meters. */
const GRID_STEP = 2;
/** The shore-distance texture covers this square around the middle (meters each way). */
const MAP_HALF = 150;
const MAP_SIZE = 256;
/** The shade texture (see TerrainOptions) covers this square around the middle, in meters. */
export const SHADE_HALF = 128;

export interface TerrainOptions {
  /** The land itself; the crew's own island if missing. */
  shape?: IslandShape;
  /** Ground height in meters, if it isn't the shape's own. */
  height?: (x: number, y: number) => number;
  /**
   * Optional soft overlay on the grass: red darkens it to jungle floor, green turns it to stony
   * ground. The home island draws what's uncleared into it, so clearing lifts the shade.
   */
  shade?: THREE.Texture;
}

const SAND = new THREE.Color(COLORS.sand);
const WET_SAND = new THREE.Color(COLORS.wetSand);
const SEABED = new THREE.Color(COLORS.seabed);
const DEEP_SEABED = new THREE.Color(COLORS.deepSeabed);
const GRASS = new THREE.Color(COLORS.grass);
const GRASS_LUSH = new THREE.Color(0x5fb247);
const GRASS_SUN = new THREE.Color(0x9bd660);
const GRASS_DEEP = new THREE.Color(0x3f9440);
const JUNGLE_FLOOR = new THREE.Color(0x3f8a3a);
const DIRT = new THREE.Color(0xc79a62);
const DIRT_DARK = new THREE.Color(0xa77a4a);
const ROCK = new THREE.Color(0x9c9584);
const BLACK_SAND = new THREE.Color(0x6a6468);
const BLACK_WET_SAND = new THREE.Color(0x4b4650);
const BURNT_GROUND = new THREE.Color(0x3b2a26);

function noise(x: number, y: number): number {
  return (
    Math.sin(x * 0.11 + 0.4) * Math.cos(y * 0.13 - 1.1) * 0.5 +
    Math.sin(x * 0.29 - y * 0.23 + 2.1) * 0.3 +
    Math.sin(x * 0.71 + y * 0.67) * 0.2
  );
}

function groundColor(
  map: SceneryMap,
  shape: IslandShape,
  height: (x: number, y: number) => number,
  x: number,
  y: number,
  out: THREE.Color,
): THREE.Color {
  const sd = shape.shoreDistance(x, y);
  const sand = shape.blackSand ? BLACK_SAND : SAND;
  if (sd < 0) {
    return out
      .copy(sand)
      .lerp(SEABED, smoothstep(0, 4, -sd))
      .lerp(DEEP_SEABED, smoothstep(6, 22, -sd));
  }
  out.copy(shape.blackSand ? BLACK_WET_SAND : WET_SAND).lerp(sand, smoothstep(0, 2.2, sd));
  const grass = map.grass(x, y);
  if (grass <= 0) return out;

  // Big swathes of sunlit and deep grass, smaller lush patches within them, darkening into the
  // jungle.
  const n = noise(x, y);
  const { sun, deep } = swathes(x, y);
  const lawn = GRASS.clone()
    .lerp(GRASS_LUSH, smoothstep(-0.1, 0.6, n) * 0.6)
    .lerp(GRASS_SUN, sun * 0.75)
    .lerp(GRASS_DEEP, deep * 0.8);
  lawn.lerp(JUNGLE_FLOOR, map.jungle(x, y) * 0.85);

  // Bare rock where the hills get steep.
  const e = 0.8;
  const slope =
    Math.hypot(height(x + e, y) - height(x - e, y), height(x, y + e) - height(x, y - e)) / (2 * e);
  lawn.lerp(ROCK, smoothstep(0.42, 0.75, slope) * 0.85);

  // The trail, worn darker down the middle.
  const t = map.trail(x, y);
  const dirt = DIRT.clone().lerp(DIRT_DARK, smoothstep(1.4, 0, t) * 0.5);
  lawn.lerp(dirt, smoothstep(2.6, 1.4, t + noise(x * 3, y * 3) * 0.4));
  // Scorched ground along the lava, and up the mountain.
  const { volcano } = shape;
  if (volcano) {
    const rise = Math.hypot(x - volcano.pos.x, y - volcano.pos.y) / volcano.radius;
    lawn.lerp(BURNT_GROUND, smoothstep(1.05, 0.6, rise) * 0.9);
    lawn.lerp(BURNT_GROUND, Math.max(shape.lava(x, y), shape.lava(x + 2, y), shape.lava(x, y + 2)));
  }
  return out.lerp(lawn, grass);
}

interface GroundPoints {
  xs: number[];
  ys: number[];
  indices: number[];
}

/** Rings round the middle, for the crew's island: it's the only one that's round enough. */
function polarGround(): GroundPoints {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let ring = 0; ring <= RINGS; ring++) {
    // Rings bunch up towards the shore, where the detail is.
    const t = Math.sqrt(ring / RINGS);
    for (let seg = 0; seg <= SEGMENTS; seg++) {
      const angle = (seg / SEGMENTS) * Math.PI * 2;
      const r = t * (shoreRadius(angle) + SEA_MARGIN);
      xs.push(Math.cos(angle) * r);
      ys.push(Math.sin(angle) * r);
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
  return { xs, ys, indices };
}

/** A square grid, for coasts with bays and lagoons, kept to the land and the water round it. */
function gridGround(shape: IslandShape, height: (x: number, y: number) => number): GroundPoints {
  const near = (x: number, y: number) => shape.shoreDistance(x, y) > -SEA_MARGIN;
  const edge = shape.reach;
  const count = Math.ceil((edge * 2) / GRID_STEP) + 1;
  const xs: number[] = [];
  const ys: number[] = [];
  const index = new Int32Array(count * count).fill(-1);
  const put = (i: number, j: number) => {
    const k = j * count + i;
    if (index[k] === -1) {
      index[k] = xs.length;
      xs.push(-edge + i * GRID_STEP);
      ys.push(-edge + j * GRID_STEP);
    }
    return index[k] ?? 0;
  };
  const indices: number[] = [];
  for (let j = 0; j + 1 < count; j++) {
    for (let i = 0; i + 1 < count; i++) {
      if (!near(-edge + i * GRID_STEP, -edge + j * GRID_STEP)) continue;
      const a = put(i, j);
      const b = put(i + 1, j);
      const c = put(i, j + 1);
      const d = put(i + 1, j + 1);
      // Each cell splits along whichever diagonal stays level, so a coast doesn't turn sawtooth.
      const at = (ci: number, cj: number) => height(-edge + ci * GRID_STEP, -edge + cj * GRID_STEP);
      const down = Math.abs(at(i, j) - at(i + 1, j + 1));
      const across = Math.abs(at(i + 1, j) - at(i, j + 1));
      if (down < across) indices.push(a, c, d, a, d, b);
      else indices.push(a, c, b, b, c, d);
    }
  }
  return { xs, ys, indices };
}

const LAVA_VERTEX = /* glsl */ `
  attribute float aFlow;
  attribute float aSide;
  varying float vFlow;
  varying float vSide;
  void main() {
    vFlow = aFlow;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LAVA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uNoise;
  varying float vFlow;
  varying float vSide;
  float noise(vec2 p) { return texture2D(uNoise, p / ${NOISE_CELLS.toFixed(1)}).r; }
  void main() {
    // Bright rock pouring downhill under a dark crust, which breaks up and closes over again.
    float edge = abs(vSide);
    vec2 p = vec2(vFlow * 0.42 - uTime * 0.55, vSide * 1.5);
    float veins = noise(p * 1.6);
    float crust = smoothstep(0.44, 0.56, noise(p * 0.7 + 4.0) + edge * 0.3 - 0.06);
    vec3 hot = mix(vec3(0.95, 0.12, 0.01), vec3(1.0, 0.42, 0.04), smoothstep(0.4, 0.62, veins));
    vec3 color = mix(hot, vec3(0.07, 0.03, 0.03), crust * 0.92);
    gl_FragColor = vec4(color, smoothstep(1.0, 0.78, edge));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Lengths of ribbon a river is cut into, and points across it, for it to lie on the ground. */
const LAVA_STEP = 1.5;
const LAVA_ACROSS = 4;
const CRATER_RINGS = 3;
const CRATER_SEGMENTS = 20;

interface LavaMesh {
  positions: number[];
  flows: number[];
  sides: number[];
  indices: number[];
}

/** Lays one river on the ground as a ribbon, with its flow running down its length. */
function layRiver(
  river: readonly Vec2[],
  height: (x: number, y: number) => number,
  out: LavaMesh,
): void {
  const legs = river.length - 1;
  const row = LAVA_ACROSS + 1;
  let walked = 0;
  let rows = 0;
  river.forEach((a, leg) => {
    const b = river[leg + 1];
    if (!b) return;
    const gap = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(gap / LAVA_STEP));
    const nx = -(b.y - a.y) / (gap || 1);
    const ny = (b.x - a.x) / (gap || 1);
    for (let s = leg === 0 ? 0 : 1; s <= steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const width = lavaWidth((leg + t) / legs, x, y) + 0.6;
      for (let i = 0; i <= LAVA_ACROSS; i++) {
        const side = (i / LAVA_ACROSS) * 2 - 1;
        const px = x + nx * side * width;
        const py = y + ny * side * width;
        out.positions.push(px, Math.max(0.02, height(px, py)) + 0.12, py);
        out.flows.push(walked + (gap * s) / steps);
        out.sides.push(side);
      }
      rows++;
    }
    walked += gap;
  });
  const first = out.positions.length / 3 - rows * row;
  for (let r = 0; r + 1 < rows; r++) {
    for (let i = 0; i < LAVA_ACROSS; i++) {
      const v = first + r * row + i;
      out.indices.push(v, v + row, v + 1, v + 1, v + row, v + row + 1);
    }
  }
}

/** The crater's pool, a disc lying in the top of the mountain. */
function layCrater(
  volcano: NonNullable<IslandShape["volcano"]>,
  height: (x: number, y: number) => number,
  out: LavaMesh,
): void {
  const reach = volcano.radius * 0.17;
  const first = out.positions.length / 3;
  const { x, y } = volcano.pos;
  const top = height(x, y) + 0.3;
  for (let ring = 0; ring <= CRATER_RINGS; ring++) {
    const r = (ring / CRATER_RINGS) * reach;
    for (let seg = 0; seg < CRATER_SEGMENTS; seg++) {
      const a = (seg / CRATER_SEGMENTS) * Math.PI * 2;
      out.positions.push(x + Math.cos(a) * r, top, y + Math.sin(a) * r);
      out.flows.push(seg * 2.2);
      out.sides.push(ring / CRATER_RINGS);
    }
  }
  for (let ring = 0; ring < CRATER_RINGS; ring++) {
    for (let seg = 0; seg < CRATER_SEGMENTS; seg++) {
      const next = (seg + 1) % CRATER_SEGMENTS;
      const a = first + ring * CRATER_SEGMENTS + seg;
      const b = first + ring * CRATER_SEGMENTS + next;
      const c = a + CRATER_SEGMENTS;
      const d = b + CRATER_SEGMENTS;
      out.indices.push(a, c, b, b, c, d);
    }
  }
}

/** The running lava and the crater's glow, as one mesh laid on the ground. */
function buildLava(
  shape: IslandShape,
  height: (x: number, y: number) => number,
): { mesh: THREE.Mesh; time: THREE.IUniform<number> } | null {
  const { volcano } = shape;
  if (!volcano) return null;
  const lava: LavaMesh = { positions: [], flows: [], sides: [], indices: [] };
  for (const river of shape.rivers) layRiver(river, height, lava);
  layCrater(volcano, height, lava);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(lava.positions, 3));
  geometry.setAttribute("aFlow", new THREE.Float32BufferAttribute(lava.flows, 1));
  geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(lava.sides, 1));
  geometry.setIndex(lava.indices);
  const time = { value: 0 };
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: time, uNoise: { value: noiseTexture() } },
    vertexShader: LAVA_VERTEX,
    fragmentShader: LAVA_FRAGMENT,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  return { mesh, time };
}

/** One texture for every island, made the first time it's needed. */
let blades: THREE.Texture | null = null;

function buildGround(map: SceneryMap, options: TerrainOptions): THREE.Mesh {
  const shape = options.shape ?? HOME_SHAPE;
  const height = options.height ?? shape.height;
  const { xs, ys, indices } = shape === HOME_SHAPE ? polarGround() : gridGround(shape, height);
  const positions: number[] = [];
  const colors: number[] = [];
  const lawns: number[] = [];
  const color = new THREE.Color();
  xs.forEach((x, i) => {
    const y = ys[i] ?? 0;
    positions.push(x, height(x, y), y);
    groundColor(map, shape, height, x, y, color);
    colors.push(color.r, color.g, color.b);
    lawns.push(Math.max(0, map.grass(x, y)) * smoothstep(1.4, 2.8, map.trail(x, y)));
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aLawn", new THREE.Float32BufferAttribute(lawns, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const { shade } = options;
  blades ??= bladeTexture();
  const bladeMap = blades;
  material.onBeforeCompile = (program) => {
    program.uniforms.uBlades = { value: bladeMap };
    if (shade) program.uniforms.uShade = { value: shade };
    program.vertexShader = program.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aLawn;
        varying float vLawn;
        varying vec2 vGroundUv;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vLawn = aLawn;
        vGroundUv = position.xz;`,
      );
    program.fragmentShader = program.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D uBlades;
        ${shade ? "uniform sampler2D uShade;" : ""}
        varying float vLawn;
        varying vec2 vGroundUv;`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float blade = texture2D(uBlades, vGroundUv / ${BLADE_METERS.toFixed(1)}).r;
        diffuseColor.rgb *= 1.0 + (blade - 0.5) * 0.7 * vLawn;
        ${
          shade
            ? /* glsl */ `vec4 shade = texture2D(uShade, vGroundUv / ${(SHADE_HALF * 2).toFixed(1)} + 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.25, 0.04), shade.r * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.3, 0.23), shade.g * 0.7);`
            : ""
        }`,
      );
  };
  material.customProgramCacheKey = () => `tropic-ground-${shade ? "shaded" : "plain"}`;
  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  return ground;
}

/** How far each point is from the shore, baked into a small texture for the water shader. */
function shoreTexture(shape: IslandShape): THREE.DataTexture {
  const data = new Uint8Array(MAP_SIZE * MAP_SIZE * 4);
  for (let j = 0; j < MAP_SIZE; j++) {
    for (let i = 0; i < MAP_SIZE; i++) {
      const x = ((i + 0.5) / MAP_SIZE) * 2 * MAP_HALF - MAP_HALF;
      const y = ((j + 0.5) / MAP_SIZE) * 2 * MAP_HALF - MAP_HALF;
      // -64 m (open sea) .. +8 m (inland) stored in 0..255.
      const d = Math.max(-64, Math.min(8, shape.shoreDistance(x, y)));
      const k = (j * MAP_SIZE + i) * 4;
      data[k] = Math.round(((d + 64) / 72) * 255);
      data[k + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, MAP_SIZE, MAP_SIZE, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

const WATER_VERTEX = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform sampler2D uShore;
  uniform vec3 uShallow;
  uniform vec3 uMid;
  uniform vec3 uDeep;
  uniform vec3 uSunDir;
  uniform vec3 uUnlit;
  uniform vec3 uGlint;
  uniform vec3 uHorizon;
  varying vec3 vWorld;

  uniform sampler2D uNoise;
  float noise(vec2 p) { return texture2D(uNoise, p / ${NOISE_CELLS.toFixed(1)}).r; }

  void main() {
    vec2 p = vWorld.xz;
    vec2 uv = (p + ${MAP_HALF.toFixed(1)}) / ${(2 * MAP_HALF).toFixed(1)};
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    // Distance out to sea in meters (0 at the shore).
    float dist = mix(64.0, -(texture2D(uShore, uv).r * 72.0 - 64.0), inside);

    float t = uTime;
    vec3 color = mix(uShallow, uMid, smoothstep(0.0, 14.0, dist));
    color = mix(color, uDeep, smoothstep(12.0, 48.0, dist));

    // Ripples: a normal from two drifting noise layers, with glints where it catches the sun.
    float n1 = noise(p * 0.5 + vec2(t * 0.32, t * 0.18));
    float n2 = noise(p * 1.25 - vec2(t * 0.22, -t * 0.37));
    vec3 normal = normalize(vec3((n1 - 0.5) * 0.4 + (n2 - 0.5) * 0.22, 1.0,
                                 (n2 - 0.5) * 0.4 - (n1 - 0.5) * 0.22));
    vec3 view = normalize(cameraPosition - vWorld);
    vec3 halfDir = normalize(uSunDir + view);
    vec3 glint = uGlint * pow(max(dot(normal, halfDir), 0.0), 160.0) * 1.1;
    // Caustic shimmer over the sand in the shallows.
    float caustic = pow(1.0 - abs(noise(p * 0.9 + t * 0.4) - noise(p * 0.9 - t * 0.3 + 7.0)), 6.0);
    color += vec3(0.85, 1.0, 0.95) * caustic * 0.22 * (1.0 - smoothstep(0.0, 10.0, dist));
    color += (n1 - 0.5) * 0.035;

    // Foam: a lacy band on the shore plus waves rolling in.
    float lace = noise(p * 1.6 + t * 0.2);
    float shoreFoam = 1.0 - smoothstep(0.05, 0.7 + lace * 0.9, dist);
    float wobble = noise(p * 0.3 + t * 0.08) * 2.0;
    float wave = sin(dist * 0.85 - t * 1.5 + wobble) * 0.5 + 0.5;
    float waves = smoothstep(0.86, 0.98, wave) * (1.0 - smoothstep(0.5, 7.0, dist))
                * smoothstep(0.35, 0.7, noise(p * 0.7 + t * 0.25));
    float foam = clamp(shoreFoam * (0.6 + 0.4 * lace) + waves, 0.0, 1.0);
    color = mix(color, vec3(1.0), foam * 0.9);
    // Lit by the hour, reflecting more of the sky the flatter you look across it.
    float edgeOn = 1.0 - max(view.y, 0.0);
    color = mix(color * uUnlit, uHorizon, edgeOn * edgeOn * edgeOn * 0.5) + glint;

    // Clear over the sand, more solid in deep water.
    float alpha = mix(0.38, 0.95, smoothstep(0.0, 18.0, dist));
    alpha = max(alpha, foam * 0.92);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export interface TerrainView {
  root: THREE.Group;
  update(time: number): void;
  dispose(): void;
}

export function buildTerrain(map: SceneryMap, options: TerrainOptions = {}): TerrainView {
  const root = new THREE.Group();
  root.add(buildGround(map, options));
  const shape = options.shape ?? HOME_SHAPE;
  const lava = buildLava(shape, options.height ?? shape.height);
  if (lava) root.add(lava.mesh);

  const shore = shoreTexture(shape);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uShore: { value: null },
        uShallow: { value: new THREE.Color(0x8eeadb) },
        uMid: { value: new THREE.Color(0x3cc6d2) },
        uDeep: { value: new THREE.Color(0x1689b8) },
      },
    ]),
    vertexShader: WATER_VERTEX,
    fragmentShader: WATER_FRAGMENT,
  });
  (material.uniforms.uShore as THREE.IUniform<THREE.Texture>).value = shore;
  material.uniforms.uNoise = { value: noiseTexture() };
  material.uniforms.uSunDir = SKY.direction;
  material.uniforms.uUnlit = SKY.unlit;
  material.uniforms.uGlint = SKY.glint;
  material.uniforms.uHorizon = SKY.horizon;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), material);
  water.rotation.x = -Math.PI / 2;
  water.renderOrder = 1;
  root.add(water);

  return {
    root,
    update(time) {
      (material.uniforms.uTime as THREE.IUniform<number>).value = time;
      if (lava) lava.time.value = time;
    },
    dispose() {
      shore.dispose();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    },
  };
}
