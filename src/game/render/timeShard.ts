// A time crystal, after the owner's concept (2026-11-16) and their note on it: each one a shard
// broken off a bigger crystal, its own shape, with a few big flat faces running to small sharp
// points, and real glass, bending what's behind it and reflecting the sky. Each power its own
// colour: rewind purple, fast forward orange, pause blue, record green, slow amber, retry red; and
// the power's sign glowing in its heart.
//
// The glass is three.js's physical transmission: the scene behind is drawn once for all the
// crystals in view and each samples it bent through its facets, with dispersion splitting the
// colours a little at the edges. Inside each is a lit core, which the glass bends like everything
// else, so the glow shifts and breaks up across the facets as the crystal or the camera moves.
//
// Every shard is grown from its power's seed: how many sides, how wide each face, how it leans, where
// its point is, how its broken end snapped, and whether a smaller crystal grew off its side.

import * as THREE from "three";
import type { TimePower } from "../logic/timeShards";
import { reflections } from "./boatParts";

/** Each power's crystal colour, as the concept paints them. */
export const CRYSTAL_COLORS: Record<TimePower, string> = {
  rewind: "#9a5cff",
  fastForward: "#ff7a1f",
  pause: "#3d8bff",
  record: "#2f9e3a",
  slow: "#ffb52e",
  retry: "#e0302a",
};

const SEEDS: Record<TimePower, number> = {
  rewind: 11,
  fastForward: 23,
  pause: 37,
  record: 41,
  slow: 59,
  retry: 71,
};

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * One crystal, 1 tall, standing on its broken end at y = 0: a prism of `sides` faces of uneven
 * widths, tapering a little, its termination a few big faces meeting at a point off its axis, and
 * its foot snapped into a short jagged point. Flat faces throughout (each triangle its own normal).
 */
function shard(rand: () => number, sides: number, width: number): number[] {
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  // Uneven faces: the corners at uneven angles, at uneven distances from the axis.
  const angles: number[] = [];
  let sum = 0;
  for (let i = 0; i < sides; i++) {
    const step = 0.6 + rand() * 0.8;
    angles.push(sum);
    sum += step;
  }
  const turn = rand() * Math.PI * 2;
  const radii = angles.map(() => width * (0.75 + rand() * 0.4));
  const corner = (i: number, y: number, k: number) => {
    const a = ((angles[i] as number) / sum) * Math.PI * 2 + turn;
    const r = (radii[i] as number) * k;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  };
  // Where the faces of the point start, a little uneven; and the point itself, off the axis.
  const shoulder = 0.5 + rand() * 0.12;
  const tip = new THREE.Vector3((rand() - 0.5) * width * 0.6, 1, (rand() - 0.5) * width * 0.6);
  // The broken foot: the break's corners at uneven heights, down to a short point off the axis.
  const foot = 0.15 + rand() * 0.08;
  const toe = new THREE.Vector3((rand() - 0.5) * width * 0.7, 0, (rand() - 0.5) * width * 0.7);
  const lo = angles.map((_, i) => corner(i, foot + (rand() - 0.5) * 0.08, 0.92));
  const hi = angles.map((_, i) => corner(i, shoulder + (rand() - 0.5) * 0.05, 0.84));
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    const [l0, l1, h0, h1] = [lo[i], lo[j], hi[i], hi[j]] as THREE.Vector3[];
    tri(l0 as THREE.Vector3, h0 as THREE.Vector3, l1 as THREE.Vector3);
    tri(l1 as THREE.Vector3, h0 as THREE.Vector3, h1 as THREE.Vector3);
    tri(h0 as THREE.Vector3, tip, h1 as THREE.Vector3);
    tri(l1 as THREE.Vector3, toe, l0 as THREE.Vector3);
  }
  return pos;
}

/** `pos` (a crystal 1 tall) scaled to `height`, tipped by `lean` and turned by `spin`, at `at`. */
function placed(
  pos: number[],
  height: number,
  lean: number,
  spin: number,
  at: THREE.Vector3,
): number[] {
  const m = new THREE.Matrix4()
    .makeTranslation(at.x, at.y, at.z)
    .multiply(new THREE.Matrix4().makeRotationY(spin))
    .multiply(new THREE.Matrix4().makeRotationZ(lean))
    .multiply(new THREE.Matrix4().makeScale(height, height, height));
  const v = new THREE.Vector3();
  const out: number[] = [];
  for (let i = 0; i < pos.length; i += 3) {
    v.set(pos[i] as number, pos[i + 1] as number, pos[i + 2] as number).applyMatrix4(m);
    out.push(v.x, v.y, v.z);
  }
  return out;
}

/** The power's crystal, 1 tall: the main shard, and for most a smaller one grown off its side. */
function crystalShape(power: TimePower): {
  body: THREE.BufferGeometry;
  core: THREE.BufferGeometry;
} {
  const rand = seeded(SEEDS[power]);
  const sides = 5 + Math.floor(rand() * 3);
  const width = 0.15 + rand() * 0.06;
  const lean = (rand() - 0.5) * 0.25;
  const main = shard(rand, sides, width);
  const all = placed(main, 1, lean, 0, new THREE.Vector3());
  const sprouts = Math.floor(rand() * 2.6);
  for (let k = 0; k < sprouts; k++) {
    const spin = rand() * Math.PI * 2;
    const height = 0.3 + rand() * 0.2;
    const base = new THREE.Vector3(
      Math.cos(spin) * width * 0.4,
      0.12 + rand() * 0.2,
      -Math.sin(spin) * width * 0.4,
    );
    all.push(
      ...placed(
        shard(rand, 5 + Math.floor(rand() * 2), width * 0.7),
        height,
        -(0.55 + rand() * 0.35),
        spin,
        base,
      ),
    );
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute("position", new THREE.Float32BufferAttribute(all, 3));
  body.computeVertexNormals();
  // The core: the main shard drawn in, glowing.
  const core = new THREE.BufferGeometry();
  const inner = placed(main, 1, lean, 0, new THREE.Vector3()).map((v, i) =>
    i % 3 === 1 ? 0.1 + v * 0.78 : v * 0.6,
  );
  core.setAttribute("position", new THREE.Float32BufferAttribute(inner, 3));
  core.computeVertexNormals();
  return { body, core };
}

/** The shared clock for every crystal's shimmer. */
export const crystalTime = { value: 0 };

/** The glass: see the top of this file. */
function glass(color: THREE.Color): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: color.clone().lerp(new THREE.Color(1, 1, 1), 0.3),
    metalness: 0,
    roughness: 0.02,
    transmission: 1,
    thickness: 0.5,
    ior: 1.8,
    dispersion: 5,
    attenuationColor: color.clone().lerp(new THREE.Color(1, 1, 1), 0.35),
    attenuationDistance: 0.35,
    specularIntensity: 1,
    envMap: reflections(),
    envMapIntensity: 2.2,
    emissive: color,
    emissiveIntensity: 0.32,
    flatShading: true,
  });
}

/** The lit core: the power's colour, brightest in the middle, a slow band of light rising through. */
function coreMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uTime: crystalTime },
    vertexShader: `
      varying float vY;
      void main() {
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying float vY;
      void main() {
        float heart = 1.0 - clamp(abs(vY - 0.5) * 1.8, 0.0, 1.0);
        float band = 0.5 + 0.5 * sin(vY * 16.0 - uTime * 2.2);
        vec3 c = uColor * (0.9 + 0.8 * heart + 0.35 * band) + vec3(0.25) * heart * heart;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** The power's sign, drawn once each: what glows in the crystal's heart. */
const signs = new Map<TimePower, THREE.Texture>();
function sign(power: TimePower): THREE.Texture {
  const done = signs.get(power);
  if (done) return done;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    g.translate(size / 2, size / 2);
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineJoin = "round";
    const tri = (x: number, dir: number) => {
      g.beginPath();
      g.moveTo(x - 14 * dir, -18);
      g.lineTo(x + 14 * dir, 0);
      g.lineTo(x - 14 * dir, 18);
      g.closePath();
      g.fill();
    };
    switch (power) {
      case "rewind":
        tri(-12, -1);
        tri(14, -1);
        break;
      case "fastForward":
        tri(-14, 1);
        tri(12, 1);
        break;
      case "pause":
        g.fillRect(-16, -22, 11, 44);
        g.fillRect(5, -22, 11, 44);
        break;
      case "record":
        g.beginPath();
        g.arc(0, 0, 20, 0, Math.PI * 2);
        g.fill();
        break;
      case "slow":
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(-22, 0);
        g.lineTo(8, 0);
        g.stroke();
        g.beginPath();
        g.moveTo(-4, -12);
        g.lineTo(10, 0);
        g.lineTo(-4, 12);
        g.stroke();
        g.fillRect(16, -18, 7, 36);
        break;
      case "retry":
        g.beginPath();
        g.moveTo(0, 20);
        g.bezierCurveTo(-30, -2, -18, -26, 0, -10);
        g.bezierCurveTo(18, -26, 30, -2, 0, 20);
        g.fill();
        break;
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  signs.set(power, t);
  return t;
}

const shapes = new Map<TimePower, { body: THREE.BufferGeometry; core: THREE.BufferGeometry }>();
const looks = new Map<
  TimePower,
  { glass: THREE.MeshPhysicalMaterial; core: THREE.ShaderMaterial }
>();

/** A time crystal `size` tall, its power's shape, colour and sign. Stands on its broken end at y = 0. */
export function timeCrystal(power: TimePower, size = 0.34): THREE.Group {
  let shape = shapes.get(power);
  if (!shape) {
    shape = crystalShape(power);
    shapes.set(power, shape);
  }
  const color = new THREE.Color(CRYSTAL_COLORS[power]);
  let look = looks.get(power);
  if (!look) {
    look = { glass: glass(color), core: coreMaterial(color) };
    looks.set(power, look);
  }
  const group = new THREE.Group();
  const scaled = new THREE.Group();
  scaled.scale.setScalar(size);
  group.add(scaled);
  scaled.add(new THREE.Mesh(shape.core, look.core));
  const body = new THREE.Mesh(shape.body, look.glass);
  body.castShadow = true;
  scaled.add(body);
  // The sign, in its heart, always turned to whoever's looking.
  const mark = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sign(power),
      color: color.clone().lerp(new THREE.Color(1, 1, 1), 0.7),
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );
  mark.scale.setScalar(size * 0.3);
  mark.position.y = size * 0.5;
  mark.renderOrder = 3;
  group.add(mark);
  return group;
}
