// The gunboat's surfaces (gunboat.ts), each painted once on a canvas and shared, after the owner's
// concept views (2026-11-21, kept out of the repo): charcoal topsides under a deep clearcoat,
// black below the waterline with a faint line of dried salt along it; teak decks, light and
// close-grained, with black caulking between the planks; white gelcoat; tan upholstery; dark tinted
// glass. Each comes as a colour and, beside it, its finish: how glossy, how rough and how metallic
// every part of it is, so the clearcoat stops at the waterline and the caulking is duller than the
// wood.
//
// And her marks (her name), on one sheet; and what's built from them: geometry given UVs at a set
// size in metres, the parts that share a surface baked into one mesh each.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Ctx = CanvasRenderingContext2D;

/** A seeded random, so every boat is painted the same. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, Ctx | null] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext("2d")];
}

function textureOf(canvas: HTMLCanvasElement, color: boolean): THREE.Texture {
  const t = new THREE.CanvasTexture(canvas);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** A surface's colour, and its finish: clearcoat in red, roughness in green, metalness in blue. */
export interface SurfaceMaps {
  map: THREE.Texture;
  finish: THREE.Texture;
  bump?: THREE.Texture;
}

interface Layers {
  c: Ctx;
  f: Ctx;
  b: Ctx | null;
  w: number;
  h: number;
}

const painted = new Map<string, SurfaceMaps>();

function paint(
  name: string,
  w: number,
  h: number,
  draw: (l: Layers) => void,
  bumped = false,
): SurfaceMaps {
  const cached = painted.get(name);
  if (cached) return cached;
  const [cc, c] = canvasOf(w, h);
  const [fc, f] = canvasOf(w, h);
  const [bc, b] = bumped ? canvasOf(w, h) : [null, null];
  if (c && f) draw({ c, f, b, w, h });
  const maps: SurfaceMaps = { map: textureOf(cc, true), finish: textureOf(fc, false) };
  if (bc) maps.bump = textureOf(bc, false);
  painted.set(name, maps);
  return maps;
}

const rgba = (r: number, g: number, b: number, a = 1) =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
/** A finish, as the colour that carries it. */
const finish = (coat: number, rough: number, metal = 0, a = 1) =>
  rgba(coat * 255, rough * 255, metal * 255, a);

function ellipse(g: Ctx, x: number, y: number, rx: number, ry: number, turn: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, turn, 0, Math.PI * 2);
  g.fill();
}

/** Speckle: a fine scatter of lighter and darker dots, for the flake in paint or a fabric's tooth. */
function speckle(
  g: Ctx,
  w: number,
  h: number,
  rand: () => number,
  n: number,
  light: string,
  dark: string,
) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rand() < 0.5 ? light : dark;
    g.fillRect(rand() * w, rand() * h, 1, 1);
  }
}

/**
 * The hull: the picture's height is her height, `HULL_LOW` (bottom of the picture) to `HULL_HIGH`
 * (top), the waterline at 0. Charcoal metallic paint under clearcoat above it, a faint haze of
 * dried salt and water spots just above it, black antifouling below it with no coat.
 */
export const HULL_LOW = -1;
export const HULL_HIGH = 2.9;
export const hullV = (y: number) => (y - HULL_LOW) / (HULL_HIGH - HULL_LOW);

export function hullMaps(): SurfaceMaps {
  return paint("hull", 1024, 512, ({ c, f, w, h }) => {
    const rand = seeded(11);
    const line = h * (1 - hullV(0.04));
    c.fillStyle = "#464c54";
    c.fillRect(0, 0, w, line);
    f.fillStyle = finish(1, 0.3, 0.55);
    f.fillRect(0, 0, w, line);
    // The flake in the paint, and long soft variations where it was sprayed.
    speckle(c, w, line, rand, 26000, "rgba(255,255,255,0.05)", "rgba(0,0,0,0.06)");
    for (let i = 0; i < 40; i++) {
      const y = rand() * line;
      const grad = c.createLinearGradient(0, y - 30, 0, y + 30);
      grad.addColorStop(0, "rgba(120,130,140,0)");
      grad.addColorStop(0.5, `rgba(120,130,140,${0.02 + rand() * 0.03})`);
      grad.addColorStop(1, "rgba(120,130,140,0)");
      c.fillStyle = grad;
      c.fillRect(0, y - 30, w, 60);
    }
    // Salt: a haze along the waterline, thinning upward, and the rings of dried drops in it.
    const haze = c.createLinearGradient(0, line - 70, 0, line);
    haze.addColorStop(0, "rgba(220,224,226,0)");
    haze.addColorStop(1, "rgba(220,224,226,0.22)");
    c.fillStyle = haze;
    c.fillRect(0, line - 70, w, 70);
    const dull = f.createLinearGradient(0, line - 60, 0, line);
    dull.addColorStop(0, finish(1, 0.3, 0.55, 0));
    dull.addColorStop(1, finish(0.55, 0.62, 0.2, 1));
    f.fillStyle = dull;
    f.fillRect(0, line - 60, w, 60);
    for (let i = 0; i < 420; i++) {
      const up = rand() ** 2.2 * 140;
      const x = rand() * w;
      const r = 1.2 + rand() * 3.5;
      c.strokeStyle = `rgba(226,230,232,${0.06 + rand() * 0.16})`;
      c.lineWidth = 0.8;
      c.beginPath();
      c.arc(x, line - up, r, 0, Math.PI * 2);
      c.stroke();
    }
    // Runs from the scuppers and the rail, faint.
    for (let i = 0; i < 26; i++) {
      const x = rand() * w;
      const top = rand() * line * 0.6;
      const long = 40 + rand() * 120;
      const grad = c.createLinearGradient(0, top, 0, top + long);
      grad.addColorStop(0, "rgba(200,206,210,0.08)");
      grad.addColorStop(1, "rgba(200,206,210,0)");
      c.fillStyle = grad;
      c.fillRect(x, top, 2 + rand() * 3, long);
    }
    // Antifouling below.
    c.fillStyle = "#121416";
    c.fillRect(0, line, w, h - line);
    speckle(c, w, h - line, rand, 9000, "rgba(255,255,255,0.03)", "rgba(0,0,0,0.1)");
    f.fillStyle = finish(0, 0.78, 0);
    f.fillRect(0, line, w, h - line);
    c.fillStyle = "rgba(230,232,232,0.35)";
    c.fillRect(0, line - 2, w, 2);
  });
}

/**
 * Teak, planks running along the picture's width: light honey, each plank its own shade, its grain
 * close and wavering, black caulking between, the caulking dull and sunk a little.
 */
export function teakMaps(): SurfaceMaps {
  return paint(
    "teak",
    1024,
    1024,
    ({ c, f, b, w, h }) => {
      const rand = seeded(7);
      const bump = b as Ctx;
      const rows = 24;
      const ph = h / rows;
      bump.fillStyle = "#909090";
      bump.fillRect(0, 0, w, h);
      f.fillStyle = finish(0, 0.62, 0);
      f.fillRect(0, 0, w, h);
      for (let r = 0; r < rows; r++) {
        const y = r * ph;
        let x = -rand() * 400;
        while (x < w) {
          const long = 300 + rand() * 500;
          const shade = 0.88 + rand() * 0.2;
          const warm = rand() * 14;
          c.fillStyle = rgba(196 * shade + warm, 152 * shade + warm * 0.5, 104 * shade);
          c.fillRect(x, y, long, ph);
          // Grain: fine wavering lines along the plank.
          c.save();
          c.beginPath();
          c.rect(x, y, long, ph);
          c.clip();
          for (let i = 0; i < 9; i++) {
            const yy = y + rand() * ph;
            const amp = 0.4 + rand() * 1.2;
            const freq = 0.006 + rand() * 0.02;
            c.strokeStyle = `rgba(110,72,38,${0.12 + rand() * 0.2})`;
            c.lineWidth = 0.6 + rand() * 0.9;
            c.beginPath();
            for (let xx = x; xx <= x + long; xx += 8) {
              const py = yy + Math.sin(xx * freq + i * 3) * amp;
              if (xx === x) c.moveTo(xx, py);
              else c.lineTo(xx, py);
            }
            c.stroke();
          }
          // Lighter where the sun's bleached it, and here and there a darker streak.
          c.fillStyle = `rgba(255,240,210,${rand() * 0.08})`;
          c.fillRect(x, y, long, ph);
          if (rand() < 0.3) {
            c.fillStyle = "rgba(90,55,25,0.12)";
            c.fillRect(x + rand() * long * 0.6, y + ph * 0.3, 40 + rand() * 120, ph * 0.3);
          }
          c.restore();
          // The butt joint, caulked.
          c.fillStyle = "#16120e";
          c.fillRect(x + long - 2, y, 3, ph);
          f.fillStyle = finish(0, 0.9, 0);
          f.fillRect(x + long - 2, y, 3, ph);
          bump.fillStyle = "#303030";
          bump.fillRect(x + long - 2, y, 3, ph);
          x += long;
        }
        // The caulked seam along the plank.
        c.fillStyle = "#17130f";
        c.fillRect(0, y, w, 4);
        f.fillStyle = finish(0, 0.92, 0);
        f.fillRect(0, y, w, 4);
        bump.fillStyle = "#202020";
        bump.fillRect(0, y, w, 4);
        // The plank's edges, a touch rounded.
        bump.fillStyle = "#7a7a7a";
        bump.fillRect(0, y + 4, w, 2);
        bump.fillRect(0, y + ph - 2, w, 2);
      }
      // Water marks: darker where it's lain and dried.
      for (let i = 0; i < 10; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = 30 + rand() * 80;
        const grad = c.createRadialGradient(x, y, r * 0.6, x, y, r);
        grad.addColorStop(0, "rgba(120,86,50,0.05)");
        grad.addColorStop(0.9, "rgba(120,86,50,0.12)");
        grad.addColorStop(1, "rgba(120,86,50,0)");
        c.fillStyle = grad;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
    true,
  );
}

/** White gelcoat: glossy, faintly uneven, with a little grime settled low and in corners. */
export function gelcoatMaps(): SurfaceMaps {
  return paint("gelcoat", 512, 512, ({ c, f, w, h }) => {
    const rand = seeded(19);
    c.fillStyle = "#eff1ef";
    c.fillRect(0, 0, w, h);
    f.fillStyle = finish(0, 0.16, 0);
    f.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const r = 20 + rand() * 70;
      ellipse(
        c,
        rand() * w,
        rand() * h,
        r,
        r * 0.6,
        rand() * 3,
        `rgba(${rand() < 0.5 ? "255,255,255" : "190,196,200"},${0.03 + rand() * 0.04})`,
      );
    }
    speckle(c, w, h, rand, 4000, "rgba(255,255,255,0.05)", "rgba(120,126,130,0.05)");
    for (let i = 0; i < 24; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const long = 30 + rand() * 90;
      const grad = c.createLinearGradient(0, y, 0, y + long);
      grad.addColorStop(0, "rgba(150,150,140,0.1)");
      grad.addColorStop(1, "rgba(150,150,140,0)");
      c.fillStyle = grad;
      c.fillRect(x, y, 2 + rand() * 4, long);
    }
  });
}

/** Tan marine vinyl: a fine speckled grain, a soft sheen. */
export function cushionMaps(): SurfaceMaps {
  return paint("cushion", 256, 256, ({ c, f, w, h }) => {
    const rand = seeded(29);
    c.fillStyle = "#b89f86";
    c.fillRect(0, 0, w, h);
    f.fillStyle = finish(0, 0.7, 0);
    f.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const r = 0.8 + rand() * 1.6;
      const tone = rand() < 0.5 ? "255,240,220" : "90,70,50";
      ellipse(c, rand() * w, rand() * h, r, r, 0, `rgba(${tone},0.06)`);
    }
  });
}

/** Tinted glass: almost black, with the rings of a few dried drops on it. */
export function glassMaps(): SurfaceMaps {
  return paint("glass", 256, 256, ({ c, f, w, h }) => {
    const rand = seeded(83);
    c.fillStyle = "#0c1015";
    c.fillRect(0, 0, w, h);
    f.fillStyle = finish(1, 0.04, 0.1);
    f.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 1 + rand() * 3;
      c.strokeStyle = `rgba(200,206,210,${0.05 + rand() * 0.08})`;
      c.lineWidth = 0.8;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.stroke();
      ellipse(f, x, y, r, r, 0, finish(1, 0.3, 0.1, 0.6));
    }
  });
}

/**
 * What the boat's shiny surfaces reflect: a sky going pale to the horizon, a band of light there,
 * and the sea below; painted as a panorama, so the glass, the paint and the steel shine without the
 * cost of reflecting the real scene.
 */
let reflected: THREE.Texture | null = null;
export function reflections(): THREE.Texture {
  if (reflected) return reflected;
  const [canvas, g] = canvasOf(1024, 512);
  if (g) {
    const w = 1024;
    const h = 512;
    const sky = g.createLinearGradient(0, 0, 0, h / 2);
    sky.addColorStop(0, "#3a78c2");
    sky.addColorStop(0.65, "#9cc8ee");
    sky.addColorStop(1, "#f6eedb");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h / 2);
    const sea = g.createLinearGradient(0, h / 2, 0, h);
    sea.addColorStop(0, "#6aaec6");
    sea.addColorStop(0.15, "#2f7894");
    sea.addColorStop(1, "#0f2c40");
    g.fillStyle = sea;
    g.fillRect(0, h / 2, w, h / 2);
    const rand = seeded(71);
    for (let i = 0; i < 26; i++) {
      ellipse(
        g,
        rand() * w,
        h * (0.12 + rand() * 0.3),
        30 + rand() * 70,
        6 + rand() * 14,
        0,
        "rgba(255,255,255,0.45)",
      );
    }
    // The shore on the horizon, a dark band; the sun.
    for (let x = 0; x < w; x += 4) {
      const hill = 4 + Math.max(0, Math.sin(x * 0.012) * 10 + Math.sin(x * 0.031) * 5);
      g.fillStyle = "rgba(40,70,50,0.55)";
      g.fillRect(x, h / 2 - hill, 4, hill);
    }
    const sun = g.createRadialGradient(w * 0.3, h * 0.26, 0, w * 0.3, h * 0.26, 90);
    sun.addColorStop(0, "rgba(255,252,236,1)");
    sun.addColorStop(0.25, "rgba(255,248,220,0.8)");
    sun.addColorStop(1, "rgba(255,248,220,0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
  }
  reflected = textureOf(canvas, true);
  reflected.mapping = THREE.EquirectangularReflectionMapping;
  return reflected;
}

/** The console's chart: sea blue, a grid, a coastline, a dotted course. */
let chart: THREE.Texture | null = null;
export function chartScreen(): THREE.Texture {
  if (chart) return chart;
  const [canvas, g] = canvasOf(256, 160);
  if (g) {
    const w = 256;
    const h = 160;
    g.fillStyle = "#0b2f3b";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(120,240,220,0.22)";
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 16) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = 0; y < h; y += 16) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.fillStyle = "rgba(240,210,120,0.8)";
    g.beginPath();
    g.ellipse(190, 76, 40, 28, 0.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.setLineDash([4, 5]);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(30, 120);
    g.quadraticCurveTo(90, 46, 160, 72);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#ff6a4a";
    g.beginPath();
    g.arc(30, 120, 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(0, 0, w, 16);
    g.fillStyle = "rgba(190,250,240,0.85)";
    g.font = "bold 10px sans-serif";
    g.fillText("12.4 kn   184°   ETA 00:42", 6, 12);
  }
  chart = textureOf(canvas, true);
  return chart;
}

// -------------------------------------------------------------------------------------------------
// Her name, on one sheet: light lettering (for her dark sides) and dark (for white).

const SHEET_W = 1024;
const SHEET_H = 256;
export const DECALS = {
  nameLight: [0, 0, 1024, 128],
  nameDark: [0, 128, 1024, 128],
} as const;
export type DecalName = keyof typeof DECALS;

let sheet: THREE.Texture | null = null;
function decalSheet(): THREE.Texture {
  if (sheet) return sheet;
  const [canvas, g] = canvasOf(SHEET_W, SHEET_H);
  if (g) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "italic 900 92px 'Arial Black', 'Arial', sans-serif";
    const word = (y: number, fill: string, shade: string) => {
      g.fillStyle = shade;
      g.fillText("TROPIC RUSH", SHEET_W / 2 + 3, y + 3, SHEET_W - 40);
      g.fillStyle = fill;
      g.fillText("TROPIC RUSH", SHEET_W / 2, y, SHEET_W - 40);
    };
    word(64, "#d9dde0", "rgba(0,0,0,0.35)");
    word(192, "#3b4047", "rgba(255,255,255,0.4)");
  }
  sheet = textureOf(canvas, true);
  sheet.wrapS = THREE.ClampToEdgeWrapping;
  sheet.wrapT = THREE.ClampToEdgeWrapping;
  return sheet;
}

/** The decals' own surface: lit as what they're on is, and never fighting it for depth. */
export function decalSurface(): THREE.MeshStandardMaterial {
  return surface("b-decal", () => {
    const m = new THREE.MeshStandardMaterial({
      map: decalSheet(),
      transparent: true,
      depthWrite: false,
      roughness: 0.3,
      metalness: 0.6,
      envMap: reflections(),
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    m.userData.detail = true;
    return m;
  });
}

/** Puts a mark's part of the sheet on a geometry whose own UVs run 0 to 1 across it. */
export function decalUV(geometry: THREE.BufferGeometry, name: DecalName): THREE.BufferGeometry {
  const [x, y, w, h] = DECALS[name];
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (x + uv.getX(i) * w) / SHEET_W, 1 - (y + (1 - uv.getY(i)) * h) / SHEET_H);
  }
  return geometry;
}

/** A mark, `w` by `h` metres, facing +z, its middle at the origin. */
export function decal(name: DecalName, w: number, h: number): THREE.Mesh {
  return new THREE.Mesh(decalUV(new THREE.PlaneGeometry(w, h), name), decalSurface());
}

// -------------------------------------------------------------------------------------------------

/**
 * Gives a geometry UVs `size` metres to a repeat, from whichever side each face mostly looks.
 * Faces come out flat: for boxy parts only (smooth ones get UVs of their own).
 */
export function metreUV(geometry: THREE.BufferGeometry, size: number): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeVertexNormals();
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = p.getX(i);
      v = p.getZ(i);
    } else if (ax >= az) {
      u = p.getZ(i);
      v = p.getY(i);
    } else {
      u = p.getX(i);
      v = p.getY(i);
    }
    uv[i * 2] = u / size;
    uv[i * 2 + 1] = v / size;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** UVs from where each point is, seen from above: `size` metres to a repeat. Keeps the normals. */
export function planUV(geometry: THREE.BufferGeometry, size: number): THREE.BufferGeometry {
  const p = geometry.getAttribute("position");
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / size;
    uv[i * 2 + 1] = p.getZ(i) / size;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** A surface: one shared material per name. */
const surfaces = new Map<string, THREE.MeshStandardMaterial>();
export function surface<T extends THREE.MeshStandardMaterial>(name: string, make: () => T): T {
  let m = surfaces.get(name);
  if (!m) {
    m = make();
    m.name = name;
    surfaces.set(name, m);
  }
  return m as T;
}

/**
 * Bakes every mesh under `root` that shares a material into one mesh per material (moving parts,
 * in `keep`, stay their own), so the boat's a handful of draw calls however many parts it has.
 * A surface marked `detail` (screws, marks) neither casts a shadow nor stops a ray.
 */
export function bakeByMaterial(root: THREE.Object3D, keep: readonly THREE.Object3D[] = []): void {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const baked: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (keep.includes(o)) return;
    if (o instanceof THREE.Mesh && !Array.isArray(o.material) && !o.userData.own) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, o.matrixWorld));
      for (const name of Object.keys(g.attributes)) {
        if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
      }
      if (!g.getAttribute("normal")) g.computeVertexNormals();
      if (!g.getAttribute("uv")) {
        const count = g.getAttribute("position").count;
        g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
      }
      g = g.index ? g.toNonIndexed() : g;
      const list = groups.get(o.material) ?? [];
      list.push(g);
      groups.set(o.material, list);
      baked.push(o);
    }
    for (const c of [...o.children]) visit(c);
  };
  visit(root);
  for (const m of baked) m.removeFromParent();
  for (const [material, parts] of groups) {
    const merged = mergeGeometries(parts, false);
    if (!merged) continue;
    const whole = new THREE.Mesh(merged, material);
    const detail = material.userData.detail === true;
    whole.castShadow = !detail && material.userData.noShadow !== true;
    whole.receiveShadow = !material.transparent;
    if (detail) whole.raycast = () => undefined;
    root.add(whole);
  }
}
