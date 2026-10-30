// The world map: the crew's home in the middle of a deep blue sea, the islands in reach round it
// (little 3D islands with palms and, on enemy ones, a base), drifting smoke from the fights, and a
// bank of cloud closing in round the edges.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRng } from "../logic/rng";
import { islandRadius, type MapIsland } from "../logic/worldMap";
import { cloudTexture } from "./clouds";
import { buildingModel, gunboatModel, paintCrew } from "./models";
import { COLORS } from "./palette";
import {
  bushGeometry,
  instanced,
  jungleTreeGeometry,
  lump,
  type PropInstance,
  palmGeometry,
  swaying,
} from "./props";
import { vertexColored } from "./shapes";
import type { Stage } from "./stage";

const PITCH = 1.12;
/** The closest the camera gets, and the point of the sea it looks at. */
const MIN_DISTANCE = 104;
const LOOK_Z = 2;
const CLOUD_PUFFS = 150;

const OCEAN_FRAGMENT = /* glsl */ `
  uniform float uTime;
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
    // Open water darkens outwards, along a coast of noise and not a clean circle.
    float wander = noise(p * 0.03 + 7.0) * 40.0;
    float r = length(p * vec2(0.75, 1.3)) + wander;
    vec3 color = mix(vec3(0.012, 0.14, 0.4), vec3(0.004, 0.05, 0.19), smoothstep(30.0, 115.0, r));
    // Slow patches of lighter and darker water, then a few thin wave crests.
    color *= 0.82 + noise(p * 0.06 + uTime * 0.012) * 0.4;
    float a = noise(p * 0.22 + vec2(uTime * 0.08, 0.0));
    float b = noise(p * 0.55 - vec2(0.0, uTime * 0.06));
    color += vec3(0.5, 0.75, 0.95) * smoothstep(0.66, 0.74, a * 0.55 + b * 0.45) * 0.035;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function shallowsTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const c = size / 2;
    const grad = g.createRadialGradient(c, c, c * 0.45, c, c, c);
    grad.addColorStop(0, "rgba(150, 240, 225, 0.95)");
    grad.addColorStop(0.6, "rgba(90, 215, 215, 0.5)");
    grad.addColorStop(1, "rgba(60, 190, 210, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A little island: shallows, a coast of a few overlapping blobs, grass and trees, with room for a base. */
function miniIsland(seed: number, radius: number, shallows: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const rng = createRng(seed);
  // The land turns as one, so no two coasts face the same way; a base on it stays square on.
  const ground = new THREE.Group();
  ground.rotation.y = rng() * Math.PI * 2;
  g.add(ground);
  const plane = new THREE.PlaneGeometry(radius * 4.4, radius * 3.4);
  plane.rotateX(-Math.PI / 2);
  const glow = new THREE.Mesh(plane, shallows);
  glow.position.y = 0.05;
  ground.add(glow);
  const parts: THREE.BufferGeometry[] = [];
  const blob = (x: number, z: number, size: number, stretch: number) => {
    const sand = lump(radius * size * 1.2, 2, seed % 100, COLORS.sand);
    sand.scale(1, 0.14, stretch);
    sand.translate(x, 0, z);
    const grass = lump(radius * size, 2, (seed % 100) + 3, 0x6fbf4c);
    grass.scale(0.95, 0.2, stretch * 0.87);
    grass.translate(x, 0.25, z - radius * 0.04);
    parts.push(sand.toNonIndexed(), grass.toNonIndexed());
  };
  blob(0, 0, 1, 0.7 + rng() * 0.3);
  // One or two headlands off the main body, for a coastline with some shape.
  const headlands = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < headlands; i++) {
    const a = rng() * Math.PI * 2;
    blob(Math.cos(a) * radius * 0.75, Math.sin(a) * radius * 0.5, 0.42 + rng() * 0.2, 0.8);
  }
  const land = new THREE.Mesh(mergeGeometries(parts), vertexColored());
  land.receiveShadow = true;
  ground.add(land);
  const palms: PropInstance[] = [];
  const trees: PropInstance[] = [];
  const bushes: PropInstance[] = [];
  const count = Math.round(8 + radius * 4);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = radius * (0.5 + rng() * 0.42);
    const item: PropInstance = {
      x: Math.cos(a) * r,
      y: Math.sin(a) * r * 0.72,
      rotation: rng() * 6.28,
      scale: new THREE.Vector3().setScalar(0.28 + rng() * 0.14),
    };
    const roll = rng();
    (roll < 0.4 ? palms : roll < 0.7 ? trees : bushes).push(item);
  }
  const sway = swaying();
  const lifted = () => 0.4;
  ground.add(
    instanced(sharedShapes().palm, palms, true, sway, lifted),
    instanced(sharedShapes().tree, trees, true, sway, lifted),
    instanced(sharedShapes().bush, bushes, false, sway, lifted),
  );
  return g;
}

let shapes: {
  palm: THREE.BufferGeometry;
  tree: THREE.BufferGeometry;
  bush: THREE.BufferGeometry;
} | null = null;

function sharedShapes(): NonNullable<typeof shapes> {
  shapes ??= { palm: palmGeometry(), tree: jungleTreeGeometry(), bush: bushGeometry() };
  return shapes;
}

interface Smoke {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  phase: number;
}

export class WorldMapView {
  readonly root = new THREE.Group();
  private readonly ocean: THREE.ShaderMaterial;
  private readonly islands = new THREE.Group();
  private readonly clouds: THREE.Mesh;
  private readonly smoke: Smoke[] = [];
  private readonly smokeMaterial = new THREE.MeshBasicMaterial({
    color: 0x9aa0a8,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  private readonly shallows = new THREE.MeshBasicMaterial({
    map: shallowsTexture(),
    transparent: true,
    depthWrite: false,
  });
  private readonly boat = gunboatModel();
  private cloudAspect = 0;
  private savedBackground: THREE.Scene["background"] = null;
  private savedFog: THREE.Scene["fog"] = null;

  constructor(private readonly stage: Stage) {
    this.ocean = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: OCEAN_FRAGMENT,
    });
    const sea = new THREE.PlaneGeometry(400, 300);
    sea.rotateX(-Math.PI / 2);
    this.root.add(new THREE.Mesh(sea, this.ocean), this.islands);

    // Home in the middle, and the gunboat at anchor beside it.
    const home = miniIsland(5, 6.5, this.shallows);
    const hq = buildingModel("headquarters");
    paintCrew(hq.root);
    hq.root.scale.setScalar(0.32);
    hq.root.position.y = 0.45;
    home.add(hq.root);
    this.root.add(home);
    this.boat.root.scale.setScalar(0.5);
    this.root.add(this.boat.root);

    this.clouds = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        map: cloudTexture(),
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    this.clouds.renderOrder = 5;
    this.root.add(this.clouds);
    this.root.visible = false;
    stage.scene.add(this.root);
  }

  /** Lays out today's islands. */
  setIslands(islands: readonly MapIsland[]): void {
    this.islands.clear();
    this.smoke.length = 0;
    for (const island of islands) {
      const radius = islandRadius(island.size);
      const g = miniIsland(island.seed, radius, this.shallows);
      g.position.set(island.x, 0, island.y);
      // A taste of the base: a headquarters, and towers the harder it gets.
      const base = buildingModel("headquarters").root;
      base.scale.setScalar(0.16 + island.size * 0.05);
      base.position.set(0, 0.42, 0);
      g.add(base);
      const towers = Math.min(3, 1 + Math.floor(island.hq / 5));
      for (let i = 0; i < towers; i++) {
        const tower = buildingModel("watchtower").root;
        const a = i * 2.2 + 0.6;
        tower.scale.setScalar(0.18);
        tower.position.set(Math.cos(a) * radius * 0.5, 0.4, Math.sin(a) * radius * 0.36);
        g.add(tower);
      }
      this.islands.add(g);
      if (island.difficulty === "Hard" || island.difficulty === "Deadly") {
        for (let i = 0; i < 5; i++) {
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), this.smokeMaterial);
          g.add(mesh);
          this.smoke.push({ mesh, x: 0.5, z: -0.4, phase: i / 5 });
        }
      }
    }
  }

  show(on: boolean): void {
    if (on === this.root.visible) return;
    this.root.visible = on;
    const { scene } = this.stage;
    if (on) {
      this.savedBackground = scene.background;
      this.savedFog = scene.fog;
      scene.background = new THREE.Color(0x0a2f5a);
      scene.fog = null;
    } else {
      scene.background = this.savedBackground;
      scene.fog = this.savedFog;
    }
  }

  update(time: number): void {
    (this.ocean.uniforms.uTime as THREE.IUniform<number>).value = time;
    this.clouds.position.x = Math.sin(time * 0.05) * 3;
    this.clouds.position.z = Math.cos(time * 0.04) * 2;
    this.boat.root.position.set(Math.sin(time * 0.1) * 1.5 + 9, 0.1, 6.5);
    this.boat.root.rotation.y = 0.5;
    for (const s of this.smoke) {
      const t = (time * 0.18 + s.phase) % 1;
      s.mesh.position.set(s.x + t * 2, 1 + t * 6, s.z);
      s.mesh.scale.setScalar(0.5 + t * 1.8);
    }
    const cam = this.stage.camera;
    // Pull back far enough that the whole map fits, however wide the screen.
    const aspect = this.stage.width / this.stage.height;
    const distance = Math.max(MIN_DISTANCE, 240 / aspect);
    cam.position.set(0, Math.sin(PITCH) * distance, LOOK_Z + Math.cos(PITCH) * distance);
    cam.lookAt(0, 0, LOOK_Z);
    cam.updateMatrixWorld();
    if (aspect !== this.cloudAspect) this.frameClouds(aspect);
    this.stage.focusShadows(new THREE.Vector3(0, 0, 0), 70);
  }

  /**
   * Banks cloud up round the edges of the screen, thickest in the corners, whatever its shape:
   * each puff is placed on screen and then walked back down the camera's ray to cloud height.
   */
  private frameClouds(aspect: number): void {
    this.cloudAspect = aspect;
    const cam = this.stage.camera;
    const rng = createRng(21);
    const quads: THREE.BufferGeometry[] = [];
    const ray = new THREE.Vector3();
    for (let i = 0; i < CLOUD_PUFFS; i++) {
      // Along one edge, bunched towards its ends, and mostly past the edge with a few reaching in.
      const along = Math.sign(rng() - 0.5) * rng() ** 0.6;
      const sideways = rng() < 0.35;
      const into = (sideways ? 1.1 : 1.14) - rng() ** 2 * 0.24;
      const flip = rng() < 0.5 ? 1 : -1;
      const nx = sideways ? flip * into : along * 1.1;
      const ny = sideways ? along * 1.1 : flip * into;
      ray.set(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
      const height = 6 + rng() * 7;
      const reach = (height - cam.position.y) / ray.y;
      const size = (sideways ? 26 : 18) + rng() * 20;
      const quad = new THREE.PlaneGeometry(size, size * 0.66);
      quad.rotateX(-PITCH);
      quad.translate(cam.position.x + ray.x * reach, height, cam.position.z + ray.z * reach);
      quads.push(quad);
    }
    const merged = mergeGeometries(quads, false) ?? new THREE.BufferGeometry();
    for (const q of quads) q.dispose();
    this.clouds.geometry.dispose();
    this.clouds.geometry = merged;
  }

  /** Where a map spot appears, as a fraction of the screen's width and height. */
  screen(x: number, y: number): { x: number; y: number } {
    const p = new THREE.Vector3(x, 2, y).project(this.stage.camera);
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
  }
}
