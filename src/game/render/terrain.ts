// Ground and sea for the raid island. The ground is one vertex-colored mesh: wet sand at the
// water's edge, the beach, grass in two shades that drift in soft patches, a darker jungle floor,
// bare rock on steep slopes and a dirt trail from the landing beach up to the headquarters. The
// sea is a shader: see-through turquoise shallows over the sand, deeper blue further out, drifting
// ripples with sun glints, and foam that hugs the shore and rolls in as waves.

import * as THREE from "three";
import { shoreDistance, shoreRadius, terrainHeight } from "../logic/island";
import { smoothstep } from "../logic/vec";
import { COLORS } from "./palette";
import type { SceneryMap } from "./scenery";

const RINGS = 120;
const SEGMENTS = 288;
const SEA_MARGIN = 26;
/** The shore-distance texture covers this square around the middle (meters each way). */
const MAP_HALF = 150;
const MAP_SIZE = 256;

const SAND = new THREE.Color(COLORS.sand);
const WET_SAND = new THREE.Color(COLORS.wetSand);
const SEABED = new THREE.Color(COLORS.seabed);
const DEEP_SEABED = new THREE.Color(COLORS.deepSeabed);
const GRASS = new THREE.Color(COLORS.grass);
const GRASS_LUSH = new THREE.Color(0x5fb247);
const GRASS_SUN = new THREE.Color(0x9bd660);
const JUNGLE_FLOOR = new THREE.Color(0x3f8a3a);
const DIRT = new THREE.Color(0xc79a62);
const DIRT_DARK = new THREE.Color(0xa77a4a);
const ROCK = new THREE.Color(0x9c9584);

function noise(x: number, y: number): number {
  return (
    Math.sin(x * 0.11 + 0.4) * Math.cos(y * 0.13 - 1.1) * 0.5 +
    Math.sin(x * 0.29 - y * 0.23 + 2.1) * 0.3 +
    Math.sin(x * 0.71 + y * 0.67) * 0.2
  );
}

function groundColor(map: SceneryMap, x: number, y: number, out: THREE.Color): THREE.Color {
  const sd = shoreDistance(x, y);
  if (sd < 0) {
    return out
      .copy(SAND)
      .lerp(SEABED, smoothstep(0, 4, -sd))
      .lerp(DEEP_SEABED, smoothstep(6, 22, -sd));
  }
  out.copy(WET_SAND).lerp(SAND, smoothstep(0, 2.2, sd));
  const grass = map.grass(x, y);
  if (grass <= 0) return out;

  // Grass drifting between sunlit and lush patches, darkening into the jungle.
  const n = noise(x, y);
  const lawn = GRASS.clone()
    .lerp(GRASS_LUSH, smoothstep(-0.1, 0.6, n))
    .lerp(GRASS_SUN, smoothstep(0.1, 0.7, -n) * 0.6);
  lawn.lerp(JUNGLE_FLOOR, map.jungle(x, y) * 0.85);

  // Bare rock where the hills get steep.
  const e = 0.8;
  const slope =
    Math.hypot(
      terrainHeight(x + e, y) - terrainHeight(x - e, y),
      terrainHeight(x, y + e) - terrainHeight(x, y - e),
    ) /
    (2 * e);
  lawn.lerp(ROCK, smoothstep(0.42, 0.75, slope) * 0.85);

  // The trail, worn darker down the middle.
  const t = map.trail(x, y);
  const dirt = DIRT.clone().lerp(DIRT_DARK, smoothstep(1.4, 0, t) * 0.5);
  lawn.lerp(dirt, smoothstep(2.6, 1.4, t + noise(x * 3, y * 3) * 0.4));
  return out.lerp(lawn, grass);
}

function buildGround(map: SceneryMap): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let ring = 0; ring <= RINGS; ring++) {
    // Rings bunch up towards the shore, where the detail is.
    const t = Math.sqrt(ring / RINGS);
    for (let seg = 0; seg <= SEGMENTS; seg++) {
      const angle = (seg / SEGMENTS) * Math.PI * 2;
      const r = t * (shoreRadius(angle) + SEA_MARGIN);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      positions.push(x, terrainHeight(x, y), y);
      groundColor(map, x, y, color);
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

/** How far each point is from the shore, baked into a small texture for the water shader. */
function shoreTexture(): THREE.DataTexture {
  const data = new Uint8Array(MAP_SIZE * MAP_SIZE * 4);
  for (let j = 0; j < MAP_SIZE; j++) {
    for (let i = 0; i < MAP_SIZE; i++) {
      const x = ((i + 0.5) / MAP_SIZE) * 2 * MAP_HALF - MAP_HALF;
      const y = ((j + 0.5) / MAP_SIZE) * 2 * MAP_HALF - MAP_HALF;
      // -64 m (open sea) .. +8 m (inland) stored in 0..255.
      const d = Math.max(-64, Math.min(8, shoreDistance(x, y)));
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
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

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
    float glint = pow(max(dot(normal, halfDir), 0.0), 160.0);
    color += vec3(1.0, 0.97, 0.88) * glint * 1.1;
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

export function buildTerrain(map: SceneryMap): TerrainView {
  const root = new THREE.Group();
  root.add(buildGround(map));

  const shore = shoreTexture();
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
        uSunDir: { value: new THREE.Vector3(-28, 48, 34).normalize() },
      },
    ]),
    vertexShader: WATER_VERTEX,
    fragmentShader: WATER_FRAGMENT,
  });
  (material.uniforms.uShore as THREE.IUniform<THREE.Texture>).value = shore;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), material);
  water.rotation.x = -Math.PI / 2;
  water.renderOrder = 1;
  root.add(water);

  return {
    root,
    update(time) {
      (material.uniforms.uTime as THREE.IUniform<number>).value = time;
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
