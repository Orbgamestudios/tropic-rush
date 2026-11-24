// Every plant on an island as a card standing on its root and turned about the upright to face the
// camera, all of them one instanced mesh: one draw call for the lot, one more for the shadows of the
// tall ones. The owner's call (2026-11-23): the camera looks down from well above, where a picture
// of a plant reads as the plant, and the solid jungle was most of what a frame drew. The Ultra
// setting keeps the solid plants (props.ts).
//
// Each kind is drawn once into one shared picture: from the home island's camera height, and the
// tall and middling ones from a raid's as well, the tall ones from low down too for cutscenes; the
// card shows the view nearest how high the camera is over it. A card stands upright at the front
// of its plant, stretched up by as much as the camera's looking down, so it covers what the plant
// would on screen while anyone walking behind it is hidden and anyone in front isn't. Cut out with
// an alpha test rather than blended, so nothing needs sorting. The wind sways their tops.

import * as THREE from "three";
import { meadowTint } from "./meadow";
import { laidOnGround, ON_GROUND_ORDER } from "./shapes";
import { SKY } from "./sky";

/** The wind's clock, shared by every swaying plant. */
export const WIND = { value: 0 };
/** The hero the camera follows; tall plants between them and the camera dissolve. */
export const FOCUS = { value: new THREE.Vector3(0, -100, 0) };

export type PlantKind =
  | "palm"
  | "tree"
  | "pine"
  | "ear"
  | "bush"
  | "snowyBush"
  | "fern"
  | "tuft"
  | "red"
  | "yellow"
  | "white";

const KINDS: readonly PlantKind[] = [
  "palm",
  "tree",
  "pine",
  "ear",
  "bush",
  "snowyBush",
  "fern",
  "tuft",
  "red",
  "yellow",
  "white",
];
/** Tall enough to need a sharp picture, a shadow, three views, and to dissolve. */
const TALL = new Set<PlantKind>(["palm", "tree", "pine"]);
/** Big enough for a second view, from the height of a raid's camera and below. */
const MIDDLING = new Set<PlantKind>(["ear", "bush", "snowyBush"]);
/** Left out once the camera's pulled well back (see PlantBatch.build). */
const SMALL = new Set<PlantKind>(["fern", "tuft", "red", "yellow", "white"]);

/**
 * How far down each view looks, in radians: the home island's and the scout's camera; a raid's
 * (cameraRig.ts FOLLOW_PITCH); and low down, for cutscenes. Each of the game's usual cameras gets
 * one picture of its own rather than a blend of two (blended, a raid's palms came out thin).
 */
const PITCHES = { tall: [0.95, 0.6, 0.25], middling: [0.95, 0.55], small: [0.95] } as const;
/** The steepest a card is ever stretched for, so it can't grow without end under a camera. */
const STEEPEST = 1.15;
/** A tall plant's picture in texels a side, and everything else's. */
const TALL_TEXELS = 512;
const CELL = 256;
const ATLAS_WIDTH = 2048;
const ATLAS_HEIGHT = 1536;

export type PlantShapes = Record<PlantKind, () => THREE.BufferGeometry>;

interface Frame {
  /** Where its views are in the atlas, high to low, as uv rectangles (from x, y, to x, y). */
  views: THREE.Vector4[];
  /** The card's edges in meters from the root, as seen on screen: left, right, bottom, top. */
  box: THREE.Vector4;
  /**
   * How far below its root each view reaches on screen, in meters (high, middle, low), which is
   * how far in front of the root the card has to stand (see CARD_VERTEX); and how many views it
   * has, plus 8 if it's tall.
   */
  info: THREE.Vector4;
}

interface Atlas {
  texture: THREE.DataTexture;
  frames: Map<PlantKind, Frame>;
}

let atlas: Atlas | null = null;

/** Where the plant's corners are on screen, looking down at `pitch`, in meters from its root. */
function seen(geometry: THREE.BufferGeometry, pitch: number, out: THREE.Box2): THREE.Box2 {
  const pos = geometry.getAttribute("position");
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Seen from in front and above: up is up the plant and back from the camera.
    out.expandByPoint(new THREE.Vector2(x, y * c - z * s));
  }
  return out;
}

/** Draws every kind into one picture, once. */
function buildAtlas(shapes: PlantShapes): Atlas {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  // A card faces up, so the scene lights it as it would a treetop: what's drawn on it carries how
  // much darker each side of the plant is than its top, by the game's own sky and sun (sky.ts), the
  // sun up and over the camera's shoulder. Lit evenly, the jungle came out pale and flat.
  const sky = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.48 * Math.PI);
  sky.groundColor.setRGB(0.75, 0.75, 0.75);
  scene.add(sky);
  const key = new THREE.DirectionalLight(0xffffff, 0.68 * Math.PI);
  key.position.set(0.35, 1, 0.75);
  scene.add(key);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -60, 60);
  const data = new Uint8Array(ATLAS_WIDTH * ATLAS_HEIGHT * 4);
  const columns = ATLAS_WIDTH / CELL;
  const used = new Uint8Array(columns * (ATLAS_HEIGHT / CELL));
  // A free square of `span` cells, scanning row by row.
  const place = (span: number): [number, number] => {
    for (let y = 0; y + span <= ATLAS_HEIGHT / CELL; y += span) {
      for (let x = 0; x + span <= columns; x += span) {
        let free = true;
        for (let dy = 0; dy < span && free; dy++)
          for (let dx = 0; dx < span; dx++) if (used[(y + dy) * columns + x + dx]) free = false;
        if (!free) continue;
        for (let dy = 0; dy < span; dy++)
          for (let dx = 0; dx < span; dx++) used[(y + dy) * columns + x + dx] = 1;
        return [x * CELL, y * CELL];
      }
    }
    throw new Error("Plant atlas is full");
  };
  const draw = (
    plant: THREE.Mesh,
    pitch: number,
    box: THREE.Box2,
    texels: number,
  ): THREE.Vector4 => {
    camera.position.set(0, Math.sin(pitch), Math.cos(pitch));
    camera.lookAt(0, 0, 0);
    camera.left = box.min.x;
    camera.right = box.max.x;
    camera.bottom = box.min.y;
    camera.top = box.max.y;
    camera.updateProjectionMatrix();
    const target = new THREE.WebGLRenderTarget(texels, texels);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene.add(plant), camera);
    scene.remove(plant);
    const pixels = new Uint8Array(texels * texels * 4);
    renderer.readRenderTargetPixels(target, 0, 0, texels, texels, pixels);
    renderer.setRenderTarget(null);
    target.dispose();
    // The clear pixels take the plant's own average color, so the smaller copies of the picture
    // the card is drawn from far away don't fringe its edges with black.
    const mean = [0, 0, 0];
    let solid = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if ((pixels[i + 3] ?? 0) < 128) continue;
      for (let c = 0; c < 3; c++) mean[c] = (mean[c] ?? 0) + (pixels[i + c] ?? 0);
      solid++;
    }
    const [x0, y0] = place(texels / CELL);
    for (let row = 0; row < texels; row++) {
      for (let col = 0; col < texels; col++) {
        const from = (row * texels + col) * 4;
        const to = ((y0 + row) * ATLAS_WIDTH + x0 + col) * 4;
        const clear = (pixels[from + 3] ?? 0) === 0;
        for (let c = 0; c < 3; c++)
          data[to + c] = clear
            ? Math.round((mean[c] ?? 0) / Math.max(1, solid))
            : (pixels[from + c] ?? 0);
        data[to + 3] = pixels[from + 3] ?? 0;
      }
    }
    return new THREE.Vector4(
      x0 / ATLAS_WIDTH,
      y0 / ATLAS_HEIGHT,
      (x0 + texels) / ATLAS_WIDTH,
      (y0 + texels) / ATLAS_HEIGHT,
    );
  };

  const frames = new Map<PlantKind, Frame>();
  // The big pictures first, so the small ones fill in round them.
  const order = [...KINDS].sort((a, b) => Number(TALL.has(b)) - Number(TALL.has(a)));
  for (const kind of order) {
    const geometry = shapes[kind]();
    const plant = new THREE.Mesh(geometry, material);
    const pitches = TALL.has(kind)
      ? PITCHES.tall
      : MIDDLING.has(kind)
        ? PITCHES.middling
        : PITCHES.small;
    // One card for every view, so it can blend between them: big enough for all of them.
    const box = new THREE.Box2();
    const below = pitches.map((p) => Math.max(0, -seen(geometry, p, new THREE.Box2()).min.y));
    for (const p of pitches) seen(geometry, p, box);
    // A little room round the edges, so no leaf touches the next picture.
    box.expandByVector(box.getSize(new THREE.Vector2()).multiplyScalar(0.03));
    const texels = TALL.has(kind) ? TALL_TEXELS : CELL;
    const views = pitches.map((p) => draw(plant, p, box, texels));
    const last = below.length - 1;
    frames.set(kind, {
      views,
      box: new THREE.Vector4(box.min.x, box.max.x, box.min.y, box.max.y),
      info: new THREE.Vector4(
        below[0] ?? 0,
        below[Math.min(1, last)] ?? 0,
        below[last] ?? 0,
        pitches.length + (TALL.has(kind) ? 8 : 0),
      ),
    });
  }
  material.dispose();
  renderer.dispose();
  renderer.forceContextLoss();

  const texture = new THREE.DataTexture(data, ATLAS_WIDTH, ATLAS_HEIGHT);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, frames };
}

const CARD_VERTEX_PARS = /* glsl */ `
  attribute vec3 aPlant;
  uniform vec4 uView0[${KINDS.length}];
  uniform vec4 uView1[${KINDS.length}];
  uniform vec4 uView2[${KINDS.length}];
  uniform vec4 uBox[${KINDS.length}];
  uniform vec4 uInfo[${KINDS.length}];
  uniform float uWind;
  varying vec2 vUvA;
  varying vec2 vUvB;
  varying float vToB;
  varying float vTall;
  varying vec3 vCardWorld;
`;

// aPlant: which kind, its width (negative when the picture's mirrored), its height.
const CARD_VERTEX = /* glsl */ `
  int kind = int(aPlant.x + 0.5);
  vec4 box = uBox[kind];
  vec4 info = uInfo[kind];
  vec3 rootWorld = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  #ifdef CARD_SHADOW
    // Facing the sun itself, not wherever its view is centred: that follows the camera about, and
    // the shadows turned with it.
    vec3 toCamera = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]) * 100.0;
  #else
    vec3 toCamera = cameraPosition - rootWorld;
  #endif
  float across = max(length(toCamera.xz), 1e-3);
  vec3 front = vec3(toCamera.x, 0.0, toCamera.z) / across;
  vec3 side = vec3(front.z, 0.0, -front.x);
  float pitch = clamp(atan(toCamera.y, across), 0.05, ${STEEPEST.toFixed(3)});
  float views = mod(info.w, 8.0);
  // The view drawn nearest this height, handing over to the next across a short band.
  vec4 rectA = uView0[kind];
  vec4 rectB = rectA;
  float belowA = info.x;
  float belowB = info.x;
  float toB = 0.0;
  if (views > 2.5 && pitch < 0.7) {
    rectA = uView1[kind];
    rectB = uView2[kind];
    belowA = info.y;
    belowB = info.z;
    toB = smoothstep(0.45, 0.32, pitch);
  } else if (views > 1.5) {
    rectB = uView1[kind];
    belowB = info.y;
    toB = smoothstep(0.85, 0.7, pitch);
  }
  float width = abs(aPlant.y);
  float u = aPlant.y < 0.0 ? 1.0 - position.x : position.x;
  float x = mix(box.x, box.y, position.x) * width;
  float s = mix(box.z, box.w, position.y) * aPlant.z;
  // Standing this far in front of the root, the lowest of the picture is on the ground there.
  float below = mix(belowA, belowB, toB) * width;
  float stand = below / sin(pitch);
  float phase = uWind * 1.4 + rootWorld.x * 0.21 + rootWorld.z * 0.17;
  float gust = 0.6 + 0.4 * sin(uWind * 0.37 + rootWorld.x * 0.03);
  float lift = max(s, 0.0);
  float bend = (lift * lift * 0.012 + lift * 0.02) * gust;
  vec3 transformed = side * (x + sin(phase) * bend) + front * stand
    + vec3(0.0, (s + below) / cos(pitch), 0.0);
  vUvA = mix(rectA.xy, rectA.zw, vec2(u, position.y));
  vUvB = mix(rectB.xy, rectB.zw, vec2(u, position.y));
  vToB = toB;
  vTall = step(7.5, info.w);
  vCardWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
`;

const CARD_FRAGMENT_PARS = /* glsl */ `
  uniform vec3 uFocus;
  varying vec2 vUvA;
  varying vec2 vUvB;
  varying float vToB;
  varying float vTall;
  varying vec3 vCardWorld;
`;

const CARD_MAP = /* glsl */ `
  vec4 card = texture2D(map, vUvA);
  if (vToB > 0.001) card = mix(card, texture2D(map, vUvB), vToB);
  // Leaves thin out in the smaller copies of the picture a far card is drawn from; holding their
  // coverage up keeps a far palm's fronds from wearing away to its trunk.
  vec2 texels = vUvA * vec2(${ATLAS_WIDTH}.0, ${ATLAS_HEIGHT}.0);
  vec2 dx = dFdx(texels);
  vec2 dy = dFdy(texels);
  float level = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
  card.a *= 1.0 + level * 0.25;
  diffuseColor *= card;
`;

// The tall ones between the camera and the hero dissolve, in a soft dithered tube, as the solid
// plants do (props.ts swaying).
const CARD_DISSOLVE = /* glsl */ `
  if (vTall > 0.5 && uFocus.y > -50.0) {
    vec3 toHero = uFocus - cameraPosition;
    float along = clamp(dot(vCardWorld - cameraPosition, toHero) / dot(toHero, toHero), 0.0, 1.0);
    float gap = length(vCardWorld - (cameraPosition + toHero * along));
    float cut = smoothstep(5.5, 2.5, gap) * smoothstep(0.98, 0.9, along);
    float noiseCut = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
    if (noiseCut < cut * 0.85) discard;
  }
`;

/** A kind's view, or its last if it has fewer. */
const view = (f: Frame, i: number) =>
  f.views[Math.min(i, f.views.length - 1)] ?? new THREE.Vector4();

function cardUniforms(frames: Map<PlantKind, Frame>) {
  const each = (pick: (f: Frame) => THREE.Vector4) =>
    KINDS.map((k) => {
      const f = frames.get(k);
      return f ? pick(f) : new THREE.Vector4();
    });
  return {
    uView0: { value: each((f) => view(f, 0)) },
    uView1: { value: each((f) => view(f, 1)) },
    uView2: { value: each((f) => view(f, 2)) },
    uBox: { value: each((f) => f.box) },
    uInfo: { value: each((f) => f.info) },
    uWind: WIND,
    uFocus: FOCUS,
  };
}

let materials: { card: THREE.MeshLambertMaterial; depth: THREE.MeshDepthMaterial } | null = null;

function cardMaterials(shapes: PlantShapes) {
  if (materials) return materials;
  atlas ??= buildAtlas(shapes);
  const uniforms = cardUniforms(atlas.frames);
  const card = new THREE.MeshLambertMaterial({ map: atlas.texture, alphaTest: 0.5 });
  // The forest's shade (sky.ts) falls on the cards as it did on the solid plants.
  card.color = SKY.forest.value;
  // The tall ones cast their shadow facing the sun: both sides, or the shadow map would skip them.
  card.shadowSide = THREE.DoubleSide;
  card.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${CARD_VERTEX_PARS}`)
      .replace("#include <begin_vertex>", CARD_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${CARD_FRAGMENT_PARS}`)
      .replace("#include <map_fragment>", CARD_MAP)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>\n${CARD_DISSOLVE}`,
      );
  };
  card.customProgramCacheKey = () => "tropic-plant-cards";
  const depth = new THREE.MeshDepthMaterial({ map: atlas.texture, alphaTest: 0.5 });
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#define CARD_SHADOW\n#include <common>\n${CARD_VERTEX_PARS}`)
      .replace("#include <begin_vertex>", CARD_VERTEX)
      // Only the tall ones cast a shadow: the rest are put out of the light's sight.
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nif (info.w < 7.5) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${CARD_FRAGMENT_PARS}`)
      .replace("#include <map_fragment>", CARD_MAP);
  };
  depth.customProgramCacheKey = () => "tropic-plant-cards-depth";
  materials = { card, depth };
  return materials;
}

export interface Plant {
  x: number;
  y: number;
  rotation: number;
  scale: THREE.Vector3;
  sink?: number;
}

/** The plants of one island, gathered by kind and then drawn as one mesh of cards. */
export class PlantBatch {
  private readonly lists: { kind: PlantKind; items: readonly Plant[]; tint: boolean }[] = [];

  /** `tint`: each takes on the color of the swathe of grass it stands in. */
  add(kind: PlantKind, items: readonly Plant[], tint = false): this {
    if (items.length > 0) this.lists.push({ kind, items, tint });
    return this;
  }

  /**
   * One mesh of every plant added. The small ones go last, so `mesh.count = big` leaves them out
   * when the camera's too far back to make them out; the rest are drawn nearest the usual camera
   * first, so the ones behind are mostly hidden before they're shaded.
   */
  build(
    shapes: PlantShapes,
    ground: (x: number, y: number) => number,
    towards: THREE.Vector2,
  ): { mesh: THREE.InstancedMesh; big: number } {
    const { card, depth } = cardMaterials(shapes);
    const all = this.lists.flatMap(({ kind, items, tint }) =>
      items.map((item) => ({ kind, item, tint, small: SMALL.has(kind) })),
    );
    const near = (p: Plant) => p.x * towards.x + p.y * towards.y;
    all.sort((a, b) => Number(a.small) - Number(b.small) || near(b.item) - near(a.item));
    const geometry = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.translate(0.5, 0.5, 0);
    // Lit as the ground is, from above, whichever way the card turns.
    const normals = quad.getAttribute("normal");
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);
    geometry.index = quad.index;
    for (const name of ["position", "normal", "uv"]) {
      const attribute = quad.getAttribute(name);
      if (attribute) geometry.setAttribute(name, attribute);
    }
    const plant = new Float32Array(all.length * 3);
    const mesh = new THREE.InstancedMesh(geometry, card, Math.max(1, all.length));
    mesh.count = all.length;
    const matrix = new THREE.Matrix4();
    const tint = new THREE.Color();
    const white = new THREE.Color(1, 1, 1);
    let big = 0;
    all.forEach(({ kind, item, tint: tinted, small }, i) => {
      matrix.makeTranslation(
        item.x,
        Math.max(-0.4, ground(item.x, item.y)) + (item.sink ?? 0),
        item.y,
      );
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, tinted ? meadowTint(item.x, item.y, tint) : white);
      // Some mirrored, so they don't all lean the same way.
      const mirror = Math.sin(item.rotation * 3.7) < 0 ? -1 : 1;
      plant[i * 3] = KINDS.indexOf(kind);
      plant[i * 3 + 1] = item.scale.x * mirror;
      plant[i * 3 + 2] = item.scale.y;
      if (!small) big = i + 1;
    });
    geometry.setAttribute("aPlant", new THREE.InstancedBufferAttribute(plant, 3));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.customDepthMaterial = depth;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Spread over the whole island: there's nothing to gain from asking whether it's in view.
    mesh.frustumCulled = false;
    return { mesh, big };
  }
}

const BLOB_VERTEX = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vAt;
  void main() {
    vAt = position.xz * 2.0;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const BLOB_FRAGMENT = /* glsl */ `
  #include <fog_pars_fragment>
  varying vec2 vAt;
  void main() {
    float d = dot(vAt, vAt);
    float shade = 0.42 * (1.0 - smoothstep(0.15, 1.0, d));
    #ifdef USE_FOG
      float fogDepth = vFogDepth;
      shade *= 1.0 - smoothstep(fogNear, fogFar, fogDepth);
    #endif
    gl_FragColor = vec4(vec3(1.0 - shade), 1.0);
  }
`;

let blobMaterial: THREE.ShaderMaterial | null = null;

/**
 * A soft round shadow on the ground under each of these, for the low plants that no longer cast
 * one: all one mesh, darkening whatever ground is under it, drawn before anyone standing there.
 */
export function blobShadows(
  items: readonly Plant[],
  ground: (x: number, y: number) => number,
  radius: number,
): THREE.InstancedMesh {
  blobMaterial ??= laidOnGround(
    new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      vertexShader: BLOB_VERTEX,
      fragmentShader: BLOB_FRAGMENT,
      fog: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.SrcColorFactor,
    }),
  );
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(quad, blobMaterial, Math.max(1, items.length));
  mesh.count = items.length;
  const matrix = new THREE.Matrix4();
  items.forEach((item, i) => {
    const size = radius * 2 * item.scale.x;
    matrix.makeScale(size, 1, size);
    matrix.setPosition(item.x, Math.max(-0.4, ground(item.x, item.y)), item.y);
    mesh.setMatrixAt(i, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.renderOrder = ON_GROUND_ORDER;
  mesh.frustumCulled = false;
  return mesh;
}
