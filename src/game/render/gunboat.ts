// The crew's gunboat (docs/DESIGN.md), after the owner's concept views (2026-11-21, kept out of
// the repo): a sleek walkaround dayboat in charcoal and white, big enough for the whole crew at the
// size they are in a raid, so the boat they're chosen on is the boat they land from and the boat
// that fires for them.
//
// Designed a part at a time and then assembled. Her surfaces are painted in boatParts.ts and her
// fittings modelled in boatFittings.ts. Here are her hull, deck and superstructure, and where
// everything goes:
//
//  - The hull, lofted along four lines (sheer, knuckle, chine, keel), so the stem is near plumb
//    above the knuckle and rakes back below it into the forefoot. The topsides are tall and flat,
//    with a channel sculpted into each: it steps up aft, has three dark hull windows set in it,
//    and a short echo of it sits near the bow. A crisp chine flat, a deep V below, charcoal under
//    clearcoat, and black antifouling below the waterline.
//  - A teak cap rail with a rounded edge and a stainless rubbing strip under it; white bulwarks
//    inside, coved down into teak decks.
//  - The cuddy forward: white, its top edge rounded over, slanted dark windows down each side
//    and one in its nose, the six-panel tan sunpad on top between grab rails.
//  - A dark wraparound windscreen raked over the helm.
//  - The hardtop: a thick white slab with a visor, on slim forward pillars and broad aft ones.
//    Four skylights are let into it, with the radar arch and the weapon station on top and
//    downlights under it.
//  - The helm: a dash with its screens and wheel, and the crystal console to port. Two helm seats
//    on a plinth.
//  - Aft: the tan U-settee, a teak swim platform over twin sterndrives, and the boarding ladder.
//
// The parts sharing a surface are baked together, and she's built once and copied after that.
//
// In her own space: +x to the bow, +z to starboard, y up from the waterline.

import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import {
  anchor,
  box,
  cleat,
  downlight,
  glowing,
  grabRail,
  helmSeat,
  ladder,
  lightBuild,
  MAT,
  navLight,
  put,
  radarArch,
  rod,
  rounded,
  segs,
  sterndrive,
  tube,
  v3,
  weaponStation,
} from "./boatFittings";
import { bakeByMaterial, chartScreen, decal, hullV, planUV } from "./boatParts";
import { AT_EASE, type HeroMove } from "./heroAnimator";

type V3 = THREE.Vector3;

/** Height of the cockpit sole above the water. */
export const DECK = 1.05;
/** How tall the crew stand in a raid, which the boat is built round. */
export const CREW_HEIGHT = 2.4;

const STERN = -7;
const STEM = 8.4;
const HALF = 2.55;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** The deck's height along her length: the cockpit level, lifting into the bow. */
export function deckY(x: number): number {
  const s = clamp((x - 1) / 7.4);
  return DECK + 0.6 * s * s;
}

/** How steeply the deck rises at `x`. */
const deckSlope = (x: number) => (1.2 * clamp((x - 1) / 7.4)) / 7.4;

/** The sheer: the top of her side, rising toward the bow. */
function sheerY(x: number): number {
  const q = clamp((x + 1) / 9.4);
  return 2.05 + 0.65 * q * q;
}

/** How full she is at `t` along her (0 the transom, 1 the stem), as a share of her half beam. */
function plan(t: number): number {
  const aft = 0.955 + 0.045 * smooth(0, 0.2, t);
  const u = Math.max(0, (t - 0.42) / 0.58);
  return aft * Math.max(0, 1 - u ** 2.1) ** 0.6;
}

/** How she rides at `time` seconds, run up on the beach: the boat scene and the raid both use it. */
export const boatRise = (time: number) => 0.1 + Math.sin(time * 1.6) * 0.05;
export const boatRoll = (time: number) => Math.sin(time * 1.1) * 0.018;

/** Sat on the deck, back against the settee. */
export const SITTING: HeroMove = {
  ...AT_EASE,
  act: { talking: false, mood: null, lookYaw: 0, lookPitch: 0, posture: "sit" },
};

// -------------------------------------------------------------------------------------------------
// Building blocks.

/**
 * A surface over a grid of points, `cols` by `rows`, smooth across itself; its winding chosen so it
 * faces `facing` (roughly, at its middle). Quads `split` picks go in a second geometry sharing the
 * same points, for a second surface (the hull's windows).
 */
function sheet(
  cols: number,
  rows: number,
  point: (i: number, j: number) => V3,
  uvOf: (p: V3) => [number, number],
  facing: V3,
  split?: (i: number, j: number) => boolean,
): [THREE.BufferGeometry, THREE.BufferGeometry | null] {
  const pos = new Float32Array(cols * rows * 3);
  const uv = new Float32Array(cols * rows * 2);
  const at3 = (k: number) =>
    v3(pos[k * 3] as number, pos[k * 3 + 1] as number, pos[k * 3 + 2] as number);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const k = i * rows + j;
      const p = point(i, j);
      pos.set([p.x, p.y, p.z], k * 3);
      uv.set(uvOf(p), k * 2);
    }
  }
  const id = (i: number, j: number) => i * rows + j;
  const mi = Math.floor((cols - 1) / 2);
  const mj = Math.floor((rows - 1) / 2);
  const a = at3(id(mi, mj));
  const n = at3(id(mi + 1, mj))
    .sub(a)
    .cross(at3(id(mi, mj + 1)).sub(a));
  const flip = n.dot(facing) < 0;
  const all: number[] = [];
  const first: number[] = [];
  const second: number[] = [];
  for (let i = 0; i < cols - 1; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const q = flip
        ? [id(i, j), id(i, j + 1), id(i + 1, j), id(i + 1, j), id(i, j + 1), id(i + 1, j + 1)]
        : [id(i, j), id(i + 1, j), id(i, j + 1), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)];
      all.push(...q);
      (split?.(i, j) ? second : first).push(...q);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(all);
  g.computeVertexNormals();
  g.setIndex(first);
  if (!split || second.length === 0) return [g, null];
  const other = new THREE.BufferGeometry();
  for (const name of ["position", "uv", "normal"]) other.setAttribute(name, g.getAttribute(name));
  other.setIndex(second);
  return [g, other];
}

/** A shape through `corners`, each rounded off by its radius in `radii` (or `radii` for all). */
function roundedShape(
  corners: readonly (readonly [number, number])[],
  radii: number | readonly number[],
): THREE.Shape {
  const shape = new THREE.Shape();
  const n = corners.length;
  const p = (i: number) => {
    const c = corners[(i + n) % n] as readonly [number, number];
    return new THREE.Vector2(c[0], c[1]);
  };
  for (let i = 0; i < n; i++) {
    const cur = p(i);
    const before = p(i - 1).sub(cur);
    const after = p(i + 1).sub(cur);
    const r = Math.min(
      typeof radii === "number" ? radii : (radii[i] ?? 0),
      before.length() * 0.48,
      after.length() * 0.48,
    );
    const from = cur.clone().addScaledVector(before.normalize(), r);
    const to = cur.clone().addScaledVector(after.normalize(), r);
    if (i === 0) shape.moveTo(from.x, from.y);
    else shape.lineTo(from.x, from.y);
    shape.quadraticCurveTo(cur.x, cur.y, to.x, to.y);
  }
  shape.closePath();
  return shape;
}

/**
 * Smooths a modelled part's shading across its rounded edges (the extruder leaves every face flat),
 * and lays its surface's picture on it from whichever side each point faces, `size` metres to a
 * repeat.
 */
function soften(geometry: THREE.BufferGeometry, size = 1): THREE.BufferGeometry {
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("normal");
  const g = mergeVertices(geometry, 1e-4);
  g.computeVertexNormals();
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    const [u, w] =
      ay >= ax && ay >= az
        ? [p.getX(i), p.getZ(i)]
        : ax >= az
          ? [p.getZ(i), p.getY(i)]
          : [p.getX(i), p.getY(i)];
    uv[i * 2] = u / size;
    uv[i * 2 + 1] = w / size;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** An extruded part: `shape` drawn in the x-y plane, `depth` thick in z (centred), edges rounded. */
function slab(
  shape: THREE.Shape,
  depth: number,
  round: number,
  segments = 3,
  size = 1,
): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - round * 2),
    bevelEnabled: true,
    bevelThickness: round,
    bevelSize: round,
    bevelOffset: -round,
    bevelSegments: lightBuild.on ? 1 : segments,
    curveSegments: segs(6, 3),
  });
  g.translate(0, 0, -(depth - round * 2) / 2);
  return soften(g, size);
}

/** A flat part lying on a level surface: `shape` drawn in (x, -z), `depth` thick upward from y = 0. */
function lying(
  shape: THREE.Shape,
  depth: number,
  round: number,
  segments = 3,
  size = 1,
): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - round * 2),
    bevelEnabled: true,
    bevelThickness: round,
    bevelSize: round,
    bevelOffset: -round,
    bevelSegments: lightBuild.on ? 1 : segments,
    curveSegments: segs(6, 3),
  });
  g.translate(0, 0, round);
  g.rotateX(-Math.PI / 2);
  return soften(g, size);
}

/** The same geometry mirrored to port: z turned over, and its faces turned to keep facing out. */
function toPort(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = g.clone();
  m.scale(1, 1, -1);
  const index = m.getIndex();
  if (index) {
    const a = index.array;
    const flipped: number[] = [];
    for (let i = 0; i < a.length; i += 3)
      flipped.push(a[i] as number, a[i + 2] as number, a[i + 1] as number);
    m.setIndex(flipped);
  } else {
    const p = m.getAttribute("position");
    for (const name of Object.keys(m.attributes)) {
      const attr = m.getAttribute(name) as THREE.BufferAttribute;
      const size = attr.itemSize;
      for (let i = 0; i < p.count; i += 3) {
        for (let c = 0; c < size; c++) {
          const one = attr.array[(i + 1) * size + c] as number;
          attr.array[(i + 1) * size + c] = attr.array[(i + 2) * size + c] as number;
          attr.array[(i + 2) * size + c] = one;
        }
      }
    }
  }
  m.computeVertexNormals();
  return m;
}

/** Both sides of something modelled to starboard. */
function bothSides(root: THREE.Object3D, g: THREE.BufferGeometry, material: THREE.Material): void {
  root.add(new THREE.Mesh(g, material));
  root.add(new THREE.Mesh(toPort(g), material));
}

// -------------------------------------------------------------------------------------------------
// The hull.

/** Her four lines, to starboard, `t` from the transom (0) to the stem (1). */
const LINES = {
  sheer: (t: number) => {
    const x = lerp(STERN, STEM, t);
    return v3(x, sheerY(x), HALF * plan(t));
  },
  knuckle: (t: number) =>
    v3(
      lerp(STERN, STEM - 0.16, t),
      0.42 + 0.58 * smooth(0.45, 1, t) ** 1.5,
      HALF * plan(t) * 0.972,
    ),
  chine: (t: number) =>
    v3(lerp(STERN, STEM - 0.8, t), -0.05 + 0.65 * smooth(0.4, 1, t) ** 1.3, HALF * plan(t) * 0.9),
  keel: (t: number) =>
    v3(lerp(STERN, 6.45, t), -0.64 - 0.2 * smooth(0, 0.4, t) + 0.7 * smooth(0.62, 1, t) ** 1.5, 0),
};

/** Outboard, level, at `t` along the sheer (to starboard). */
function outward(t: number): V3 {
  const a = LINES.sheer(Math.max(0, t - 0.002));
  const b = LINES.sheer(Math.min(1, t + 0.002));
  return v3(-(b.z - a.z), 0, b.x - a.x).normalize();
}

/** Along the sheer at `t`, level, to starboard. */
function along(t: number): V3 {
  const a = LINES.sheer(Math.max(0, t - 0.002));
  const b = LINES.sheer(Math.min(1, t + 0.002));
  return v3(b.x - a.x, 0, b.z - a.z).normalize();
}

/**
 * Where her hull's sections are cut: closer together toward the stem, where she turns most. Fewer
 * of them for the light copy (see `crewBoatModel`).
 */
const sections = (count: number) =>
  Array.from({ length: count + 1 }, (_, i) => 1 - (1 - i / count) ** 1.3);
let STATIONS = sections(132);

type Poly = readonly (readonly [number, number])[];
/** The channels sculpted into her topsides, in (x along her, depth below the sheer). */
const CHANNEL_FWD: Poly = [
  [-3.3, 0.55],
  [3.5, 0.55],
  [2.9, 1.1],
  [-2.7, 1.1],
];
const CHANNEL_AFT: Poly = [
  [-6.65, 0.55],
  [-2.95, 0.55],
  [-2.95, 0.82],
  [-6.3, 0.82],
];
const CHANNEL_BOW: Poly = [
  [5.55, 0.78],
  [6.75, 0.78],
  [7.1, 1.05],
  [5.9, 1.05],
];
const CHANNEL_DEPTH = 0.085;
const BEVEL = 0.018;
/** The hull windows in the channel: where each pane runs, along her. */
const WINDOWS = [
  [-2.45, -0.78],
  [-0.64, 1.02],
  [1.16, 2.62],
] as const;

/** How far inside a convex shape a point is (negative inside), near enough for a bevel. */
function inside(poly: Poly, x: number, d: number): number {
  let cx = 0;
  let cd = 0;
  for (const [px, pd] of poly) {
    cx += px / poly.length;
    cd += pd / poly.length;
  }
  let most = -Infinity;
  poly.forEach(([ax, ad], i) => {
    const [bx, bd] = poly[(i + 1) % poly.length] as readonly [number, number];
    let nx = bd - ad;
    let nd = -(bx - ax);
    const len = Math.hypot(nx, nd);
    nx /= len;
    nd /= len;
    if (nx * (cx - ax) + nd * (cd - ad) > 0) {
      nx = -nx;
      nd = -nd;
    }
    most = Math.max(most, nx * (x - ax) + nd * (d - ad));
  });
  return most;
}

const sunk = (dist: number) => 1 - smooth(-BEVEL, BEVEL, dist);
function channel(x: number, d: number): number {
  return Math.max(
    sunk(inside(CHANNEL_FWD, x, d)),
    sunk(inside(CHANNEL_AFT, x, d)),
    sunk(inside(CHANNEL_BOW, x, d)),
  );
}
function glazed(x: number, d: number): boolean {
  return inside(CHANNEL_FWD, x, d) < -BEVEL * 1.3 && WINDOWS.some(([a, b]) => x > a && x < b);
}

/** The topside's rows, as depths below the sheer: close together at the channels' edges. */
const ROW_DEPTHS = (() => {
  const d = [0, 0.012, 0.04, 0.1, 0.2, 0.3, 0.4, 0.48];
  for (const edge of [0.55, 0.78, 0.82, 1.05, 1.1]) {
    for (const off of [-0.018, 0, 0.018]) d.push(edge + off);
  }
  for (const extra of [0.66, 0.95, 1.22]) d.push(extra);
  return [...new Set(d.map((x) => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
})();
const LOW_ROWS = 4;

function topsidePoint(t: number, j: number): { p: V3; d: number } {
  const s = LINES.sheer(t);
  const k = LINES.knuckle(t);
  const h = s.y - k.y;
  const last = ROW_DEPTHS[ROW_DEPTHS.length - 1] as number;
  const d =
    j < ROW_DEPTHS.length
      ? (ROW_DEPTHS[j] as number)
      : last + ((h - last) * (j - ROW_DEPTHS.length + 1)) / LOW_ROWS;
  const p = s.clone().lerp(k, Math.min(1, d / h));
  p.addScaledVector(outward(t), -CHANNEL_DEPTH * channel(p.x, d));
  return { p, d };
}

const hullUV = (p: V3): [number, number] => [p.x / 6, hullV(p.y)];

function hull(root: THREE.Object3D): void {
  const cols = STATIONS.length;
  const at = (i: number) => STATIONS[i] as number;
  const material = MAT.hull();
  const rows = ROW_DEPTHS.length + LOW_ROWS;
  const bulge = (i: number, r: number, amount: number) =>
    outward(at(i)).multiplyScalar(amount * Math.sin(Math.PI * r) * plan(at(i)));
  // The topsides, with the channels and the windows in them.
  const [topside, windows] = sheet(
    cols,
    rows,
    (i, j) => topsidePoint(at(i), j).p,
    hullUV,
    v3(0, 0, 1),
    (i, j) => {
      const corners = [
        topsidePoint(at(i), j),
        topsidePoint(at(i + 1), j),
        topsidePoint(at(i), j + 1),
        topsidePoint(at(i + 1), j + 1),
      ];
      return corners.every(({ p, d }) => glazed(p.x, d));
    },
  );
  bothSides(root, topside, material);
  if (windows) bothSides(root, windows, MAT.glass());
  // Below the knuckle, rounding in a little to the chine; the chine's flat; the deep V of her bottom.
  const [bilge] = sheet(
    cols,
    9,
    (i, j) => {
      const r = j / 8;
      return LINES.knuckle(at(i))
        .lerp(LINES.chine(at(i)), r)
        .add(bulge(i, r, 0.045));
    },
    hullUV,
    v3(0, -0.3, 1),
  );
  bothSides(root, bilge, material);
  const chineIn = (t: number) => {
    const c = LINES.chine(t);
    return v3(c.x, c.y + 0.025, Math.max(0, c.z - 0.075 * plan(t)));
  };
  const [flat] = sheet(
    cols,
    2,
    (i, j) => (j === 0 ? LINES.chine(at(i)) : chineIn(at(i))),
    hullUV,
    v3(0, -1, 0.2),
  );
  bothSides(root, flat, material);
  const [bottom] = sheet(
    cols,
    11,
    (i, j) => {
      const r = j / 10;
      return chineIn(at(i))
        .lerp(LINES.keel(at(i)), r)
        .add(bulge(i, r, 0.04))
        .add(v3(0, -0.05 * Math.sin(Math.PI * r) * plan(at(i)), 0));
    },
    hullUV,
    v3(0, -1, 0.4),
  );
  bothSides(root, bottom, material);
  // The transom: closing her off aft, from the sheer down round to the keel and back up.
  const edge: V3[] = [];
  for (let j = 0; j < rows; j++) edge.push(topsidePoint(0, j).p);
  for (let j = 1; j <= 8; j++) edge.push(LINES.knuckle(0).lerp(LINES.chine(0), j / 8));
  edge.push(chineIn(0));
  for (let j = 1; j <= 10; j++) edge.push(chineIn(0).lerp(LINES.keel(0), j / 10));
  const ring = [
    ...edge,
    ...edge
      .slice(0, -1)
      .reverse()
      .map((p) => v3(p.x, p.y, -p.z)),
  ];
  const centre = v3(STERN, sheerY(STERN), 0);
  const pos: number[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    for (const p of [centre, ring[i + 1] as V3, ring[i] as V3]) pos.push(p.x, p.y, p.z);
  }
  const transom = new THREE.BufferGeometry();
  transom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  transom.computeVertexNormals();
  const n = transom.getAttribute("normal");
  if (n.getX(0) > 0) {
    const flipped: number[] = [];
    for (let i = 0; i < pos.length; i += 9)
      flipped.push(...pos.slice(i, i + 3), ...pos.slice(i + 6, i + 9), ...pos.slice(i + 3, i + 6));
    transom.setAttribute("position", new THREE.Float32BufferAttribute(flipped, 3));
    transom.computeVertexNormals();
  }
  const tp = transom.getAttribute("position");
  const tuv = new Float32Array(tp.count * 2);
  for (let i = 0; i < tp.count; i++) {
    tuv[i * 2] = tp.getZ(i) / 6;
    tuv[i * 2 + 1] = hullV(tp.getY(i));
  }
  transom.setAttribute("uv", new THREE.BufferAttribute(tuv, 2));
  root.add(new THREE.Mesh(transom, material));
  // The stainless rubbing strip along her, just under the cap.
  const strip = (side: number) =>
    new THREE.CatmullRomCurve3(
      STATIONS.filter((_, i) => i % 3 === 0 && i < cols - 2).map((t) => {
        const s = LINES.sheer(t).addScaledVector(outward(t), 0.012);
        return v3(s.x, s.y - 0.05, s.z * side);
      }),
    );
  for (const side of [1, -1])
    root.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(strip(side), segs(140), 0.014, segs(6, 4), false),
        MAT.steel(),
      ),
    );
}

// -------------------------------------------------------------------------------------------------
// The cap rail, the bulwarks inside, and the decks.

/** How wide the cap rail is at `t`: narrower toward the bow. */
const capWidth = (t: number) => 0.11 + 0.05 * plan(t);
/** The cap rail's section, as (outboard, up) from the sheer: an overhanging lip, rounded over. */
const CAP: readonly (readonly [number, number])[] = [
  [0.022, -0.04],
  [0.028, -0.006],
  [0.018, 0.028],
  [-0.008, 0.04],
];
/** How far in from the sheer the deck runs out to, at the foot of the bulwark. */
const deckIn = (t: number) => capWidth(t) + 0.085;

/** A point `out` outboard of the sheer at `t` (negative: inboard), `y` high, never past the middle. */
function fromSheer(t: number, out: number, y: number): V3 {
  const p = LINES.sheer(t).addScaledVector(outward(t), out);
  return v3(p.x, y, Math.max(0.001, p.z));
}

function rails(root: THREE.Object3D): void {
  const cols = STATIONS.length;
  const at = (i: number) => STATIONS[i] as number;
  // The cap: its outer lip and rounded top, then its inner edge.
  const capRows = (t: number): [number, number][] => [
    ...(CAP as [number, number][]),
    [-capWidth(t) + 0.016, 0.04],
    [-capWidth(t), 0.024],
    [-capWidth(t), -0.025],
  ];
  const [cap] = sheet(
    cols,
    7,
    (i, j) => {
      const t = at(i);
      const [out, up] = capRows(t)[j] as [number, number];
      return fromSheer(t, out, sheerY(LINES.sheer(t).x) + up);
    },
    // Along one plank, so the grain runs unbroken round her.
    (p) => [p.x / 2.4, 0.55 / 24],
    v3(0, 1, 0.2),
  );
  bothSides(root, cap, MAT.teak());
  // The bulwark inside it, white, coved into the deck at its foot.
  const [wall] = sheet(
    cols,
    4,
    (i, j) => {
      const t = at(i);
      const x = LINES.sheer(t).x;
      const deck = deckY(x);
      const top = sheerY(x) - 0.025;
      const w = capWidth(t);
      const rowsAt: [number, number][] = [
        [-w, top],
        [-w - 0.012, deck + 0.09],
        [-w - 0.06, deck + 0.012],
        [-deckIn(t), deck],
      ];
      const [out, y] = rowsAt[j] as [number, number];
      return fromSheer(t, out, y);
    },
    (p) => [p.x / 2, p.y / 2],
    v3(0, 0.2, -1),
  );
  bothSides(root, wall, MAT.gelcoat());
  // The deck, from the transom's inside face to the bow.
  const aft = STERN + 0.16;
  const [deck] = sheet(
    cols,
    2,
    (i, j) => {
      const t = at(i);
      const p = fromSheer(t, -deckIn(t), 0);
      const x = Math.max(aft, p.x);
      return v3(x, deckY(x), j === 0 ? p.z : -p.z);
    },
    (p) => [p.x / 2.4, p.z / 2.4],
    v3(0, 1, 0),
  );
  root.add(new THREE.Mesh(deck, MAT.teak()));
  // Across the transom: its inside face, and the cap over it.
  const inner = fromSheer(0, -deckIn(0), 0).z;
  const transomWall = new THREE.PlaneGeometry(inner * 2, sheerY(STERN) - DECK);
  transomWall.rotateY(Math.PI / 2);
  root.add(
    put(new THREE.Mesh(planUV(transomWall, 2), MAT.gelcoat()), aft, (DECK + sheerY(STERN)) / 2, 0),
  );
  const transomCap = new THREE.BufferGeometry().copy(
    lying(
      roundedShape(
        [
          [STERN - 0.028, -HALF * plan(0) - 0.022],
          [aft, -HALF * plan(0) - 0.022],
          [aft, HALF * plan(0) + 0.022],
          [STERN - 0.028, HALF * plan(0) + 0.022],
        ],
        0.02,
      ),
      0.065,
      0.018,
      2,
      2.4,
    ),
  );
  const cp = transomCap.getAttribute("position");
  const cuv = transomCap.getAttribute("uv");
  for (let i = 0; i < cp.count; i++) cuv.setXY(i, cp.getZ(i) / 2.4, cp.getX(i) / 2.4);
  root.add(put(new THREE.Mesh(transomCap, MAT.teak()), 0, sheerY(STERN) - 0.025, 0));
}

// -------------------------------------------------------------------------------------------------
// The cuddy.

const CUDDY = { aft: 0.72, shoulder: 4.3, nose: 5.6, halfAft: 1.37, halfFwd: 1.18, corner: 0.14 };
const cuddyTop = (x: number) => 2.64 + 0.06 * clamp((x - CUDDY.aft) / 4.9);
/** The nose's curve (a superellipse): its half width at `x`. */
function noseHalf(x: number): number {
  const u = clamp((x - CUDDY.shoulder) / (CUDDY.nose - CUDDY.shoulder));
  return CUDDY.halfFwd * Math.max(0, 1 - u ** 2.6) ** (1 / 2.6);
}
/** Its side's half width at `x`, on the straight. */
const sideHalf = (x: number) =>
  lerp(
    CUDDY.halfAft,
    CUDDY.halfFwd,
    clamp((x - CUDDY.aft - CUDDY.corner) / (CUDDY.shoulder - CUDDY.aft - CUDDY.corner)),
  );
/** Its half width at `x`, at the foot of its walls. */
const cuddyHalf = (x: number) => (x <= CUDDY.shoulder ? sideHalf(x) : noseHalf(x));

/** Its outline at deck level, all the way round: aft edge, starboard side, nose, port side. */
function cuddyOutline(): THREE.Vector2[] {
  const half: THREE.Vector2[] = [];
  const { aft, corner, halfAft } = CUDDY;
  for (const z of [0, 0.3, 0.6, 0.9, halfAft - corner - 0.12]) half.push(new THREE.Vector2(aft, z));
  for (let i = 0; i <= 5; i++) {
    const a = Math.PI - (i / 5) * (Math.PI / 2);
    half.push(
      new THREE.Vector2(
        aft + corner + Math.cos(a) * corner,
        halfAft - corner + Math.sin(a) * corner,
      ),
    );
  }
  for (let i = 1; i <= 14; i++) {
    const x = lerp(aft + corner, CUDDY.shoulder, i / 14);
    half.push(new THREE.Vector2(x, sideHalf(x)));
  }
  for (let i = 1; i <= 20; i++) {
    const a = (Math.PI / 2) * (1 - i / 20);
    const c = Math.cos(a);
    const s = Math.sin(a);
    half.push(
      new THREE.Vector2(
        CUDDY.shoulder + (CUDDY.nose - CUDDY.shoulder) * c ** (2 / 2.6),
        CUDDY.halfFwd * s ** (2 / 2.6),
      ),
    );
  }
  const port = half
    .slice(1, -1)
    .reverse()
    .map((p) => new THREE.Vector2(p.x, -p.y));
  return [...half, ...port];
}

/** The outline drawn in by `by`, each point along the inward bisector of its two edges. */
function drawnIn(outline: readonly THREE.Vector2[], by: number): THREE.Vector2[] {
  const n = outline.length;
  return outline.map((p, i) => {
    const a = (outline[(i - 1 + n) % n] as THREE.Vector2).clone().sub(p).normalize();
    const b = (outline[(i + 1) % n] as THREE.Vector2).clone().sub(p).normalize();
    // The outline runs anticlockwise seen from above (x up, z right): inward is to the left.
    const na = new THREE.Vector2(-a.y, a.x);
    const nb = new THREE.Vector2(b.y, -b.x);
    const inward = na.add(nb).normalize();
    return p.clone().addScaledVector(inward, -by);
  });
}

/** The cuddy's walls' levels: how far in, and how high (from its foot to the top of its rounded edge). */
const CUDDY_RINGS: readonly (readonly [number, (x: number) => number])[] = [
  [0, (x) => deckY(x) - 0.04],
  [0.012, (x) => lerp(deckY(x), cuddyTop(x), 0.35)],
  [0.03, (x) => lerp(deckY(x), cuddyTop(x), 0.75)],
  [0.042, (x) => cuddyTop(x) - 0.14],
  [0.058, (x) => cuddyTop(x) - 0.075],
  [0.085, (x) => cuddyTop(x) - 0.03],
  [0.12, (x) => cuddyTop(x) - 0.006],
  [0.15, (x) => cuddyTop(x)],
];

/** Where its wall is, to starboard, `y` high at `x` along the straight: for the windows. */
function cuddyWall(x: number, y: number): number {
  const foot = deckY(x);
  const shoulder = cuddyTop(x) - 0.14;
  return sideHalf(x) - 0.042 * clamp((y - foot) / (shoulder - foot));
}

function cuddy(root: THREE.Object3D): void {
  const outline = cuddyOutline();
  const rings = CUDDY_RINGS.map(([by]) => drawnIn(outline, by));
  const loop = outline.length + 1;
  const [walls] = sheet(
    loop,
    rings.length,
    (i, j) => {
      const p = (rings[j] as THREE.Vector2[])[i % outline.length] as THREE.Vector2;
      return v3(p.x, (CUDDY_RINGS[j] as readonly [number, (x: number) => number])[1](p.x), p.y);
    },
    (p) => [p.x / 2, p.y / 2],
    v3(0, 0, 1),
  );
  // The last column closes the loop: give it the first column's normals, so there's no seam.
  const normal = walls.getAttribute("normal");
  for (let j = 0; j < rings.length; j++) {
    const a = j;
    const b = (loop - 1) * rings.length + j;
    normal.setXYZ(b, normal.getX(a), normal.getY(a), normal.getZ(a));
  }
  root.add(new THREE.Mesh(walls, MAT.gelcoat()));
  // Its top, inside the rounded edge.
  const top = rings[rings.length - 1] as THREE.Vector2[];
  const faces = THREE.ShapeUtils.triangulateShape(top, []);
  const pos: number[] = [];
  for (const p of top) pos.push(p.x, cuddyTop(p.x), p.y);
  const lid = new THREE.BufferGeometry();
  lid.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  lid.setIndex(faces.flatMap(([a, b, c]) => [a, c, b] as number[]));
  lid.computeVertexNormals();
  if (lid.getAttribute("normal").getY(0) < 0)
    lid.setIndex(faces.flatMap(([a, b, c]) => [a, b, c] as number[]));
  lid.computeVertexNormals();
  root.add(new THREE.Mesh(planUV(lid, 2), MAT.gelcoat()));

  // Its windows: two down each side, slanted at their forward ends, and one in its nose.
  for (const corners of [
    [
      [1.1, 2.08],
      [2.95, 2.08],
      [3.22, 2.38],
      [1.1, 2.38],
    ],
    [
      [3.32, 2.08],
      [3.95, 2.08],
      [4.24, 2.38],
      [3.55, 2.38],
    ],
  ] as const) {
    const shape = roundedShape(corners, 0.035);
    const g = new THREE.ShapeGeometry(shape, 6);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      p.setXYZ(i, x, y, cuddyWall(x, y) + 0.004);
    }
    g.computeVertexNormals();
    bothSides(root, g, MAT.glass());
  }
  const [nose] = sheet(
    17,
    2,
    (i, j) => {
      const a = (i / 16 - 0.5) * 0.9;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const y = j === 0 ? 2.2 : 2.44;
      const by =
        0.042 * clamp((y - deckY(CUDDY.nose)) / (cuddyTop(CUDDY.nose) - 0.14 - deckY(CUDDY.nose))) -
        0.004;
      const r = CUDDY.nose - CUDDY.shoulder - by;
      return v3(
        CUDDY.shoulder + r * Math.abs(c) ** (2 / 2.6),
        y,
        Math.sign(s) * (CUDDY.halfFwd - by) * Math.abs(s) ** (2 / 2.6),
      );
    },
    (p) => [p.z, p.y],
    v3(1, 0, 0),
  );
  root.add(new THREE.Mesh(nose, MAT.glass()));

  // The sunpad: six cushions, two abreast, their outer edges following the cuddy's.
  const edge = (x: number) => cuddyHalf(x) - 0.15 - 0.065;
  for (const [x0, x1] of [
    [1.35, 2.5],
    [2.56, 3.72],
    [3.78, 4.92],
  ] as const) {
    const outer: [number, number][] = [];
    for (let k = 0; k <= 4; k++) {
      const x = lerp(x1, x0, k / 4);
      outer.push([x, edge(x)]);
    }
    const corners = ([[x0, 0.032], [x1, 0.032], ...outer] as [number, number][]).map(
      ([x, z]): [number, number] => [x, -z],
    );
    const pad = lying(roundedShape(corners, 0.05), 0.13, 0.045, 2, 1);
    const y = cuddyTop((x0 + x1) / 2) - 0.004;
    bothSides(root, pad.translate(0, y, 0), MAT.cushion());
  }
  // A rolled bolster across its aft end, against the windscreen.
  const bolster = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 2.1, 6, 18), MAT.cushion());
  bolster.rotation.x = Math.PI / 2;
  root.add(put(bolster, 1.22, cuddyTop(1.22) + 0.07, 0));
  // Grab rails along its top edges.
  for (const side of [1, -1]) {
    const z = (x: number) => side * (cuddyHalf(x) - 0.15 - 0.018);
    root.add(
      grabRail([
        v3(1.45, cuddyTop(1.45), z(1.45)),
        v3(1.52, cuddyTop(1.52) + 0.12, z(1.52)),
        v3(4.15, cuddyTop(4.15) + 0.12, z(4.15)),
        v3(4.22, cuddyTop(4.22), z(4.22)),
      ]),
    );
  }
}

// -------------------------------------------------------------------------------------------------
// The windscreen.

const screenBase = (s: number) => {
  const x = 0.75 + 0.5 * Math.max(0, 1 - s * s) ** 0.8;
  return v3(x, cuddyTop(x) + 0.004, 1.3 * s);
};
const screenTop = (s: number) =>
  v3(0.3 + 0.38 * Math.max(0, 1 - s * s) ** 0.8, 3.32 - 0.06 * s * s, 1.22 * s);

function windscreen(root: THREE.Object3D): void {
  const [glass] = sheet(
    49,
    9,
    (i, j) => {
      const s = i / 24 - 1;
      const r = j / 8;
      return screenBase(s)
        .lerp(screenTop(s), r)
        .add(v3(0.035 * Math.sin(Math.PI * r) * Math.sqrt(Math.max(0, 1 - s * s)), 0, 0));
    },
    (p) => [p.z / 2, p.y / 2],
    v3(1, 0.5, 0),
  );
  root.add(new THREE.Mesh(glass, MAT.glass()));
  // Its frame: a white rail along its top and down each end, a black seal at its foot.
  const along = (f: (s: number) => V3) =>
    new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => f(i / 12 - 1)));
  root.add(
    new THREE.Mesh(new THREE.TubeGeometry(along(screenTop), 64, 0.042, 10, false), MAT.white()),
  );
  root.add(
    new THREE.Mesh(new THREE.TubeGeometry(along(screenBase), 48, 0.02, 6, false), MAT.rubber()),
  );
  for (const s of [-1, 1]) {
    root.add(rod(screenBase(s), screenTop(s), 0.046, MAT.white(), 14));
    root.add(
      put(
        new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 8), MAT.white()),
        screenTop(s).x,
        screenTop(s).y,
        screenTop(s).z,
      ),
    );
  }
}

// -------------------------------------------------------------------------------------------------
// The hardtop, its pillars, and what's on it.

const ROOF = { aft: -4.05, front: 0.95, halfAft: 2.12, halfFwd: 1.86, bottom: 4.1, thick: 0.24 };
/** How far the hardtop's front dips, like a visor, at `x`. */
const visor = (x: number) => 0.1 * smooth(-0.6, 1.1, x);
const roofTop = (x: number) => ROOF.bottom + ROOF.thick - visor(x);
const roofUnder = (x: number) => ROOF.bottom - visor(x);

function hardtop(root: THREE.Object3D): void {
  const { aft, front, halfAft, halfFwd } = ROOF;
  const plan2 = roundedShape(
    [
      [aft, -halfAft],
      [front, -halfFwd],
      [front + 0.18, 0],
      [front, halfFwd],
      [aft, halfAft],
    ],
    [0.34, 0.82, 1.6, 0.82, 0.34],
  );
  const g = lying(plan2, ROOF.thick, 0.07, 4, 2);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + ROOF.bottom - visor(p.getX(i)));
  g.computeVertexNormals();
  root.add(new THREE.Mesh(g, MAT.gelcoat()));
  // The skylights, flush in its top, each in a thin satin frame.
  for (const [x0, x1, z0, z1] of [
    [-0.6, 0.55, 0.16, 1.42],
    [-0.6, 0.55, -1.42, -0.16],
    [-2.85, -1.55, 0.62, 1.62],
    [-2.85, -1.55, -1.62, -0.62],
  ] as const) {
    for (const [grow, material, lift] of [
      [0.03, MAT.satin(), 0.003],
      [0, MAT.glass(), 0.005],
    ] as const) {
      const pane = new THREE.ShapeGeometry(
        roundedShape(
          [
            [x0 - grow, -z0 + grow],
            [x1 + grow, -z0 + grow],
            [x1 + grow, -z1 - grow],
            [x0 - grow, -z1 - grow],
          ],
          0.06,
        ),
        4,
      );
      pane.rotateX(-Math.PI / 2);
      const pp = pane.getAttribute("position");
      for (let i = 0; i < pp.count; i++) pp.setY(i, roofTop(pp.getX(i)) + lift);
      pane.computeVertexNormals();
      root.add(new THREE.Mesh(planUV(pane, 2), material));
    }
  }
  // Downlights in its lining.
  for (const x of [-3.2, -1.9, -0.6]) {
    for (const z of [-1.3, 1.3]) root.add(put(downlight(), x, roofUnder(x), z));
  }
  // The forward pillars: slim, rising from the windscreen's ends.
  for (const s of [-1, 1]) {
    const from = screenTop(s);
    const to = v3(0.1, roofUnder(0.1) + 0.02, s * 1.48);
    const pillar = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, from.distanceTo(to), 6, 14),
      MAT.white(),
    );
    pillar.scale.set(1, 1, 1.4);
    pillar.position.copy(from).add(to).multiplyScalar(0.5);
    pillar.quaternion.setFromUnitVectors(v3(0, 1, 0), to.clone().sub(from).normalize());
    root.add(pillar);
  }
  // The aft pillars: broad, flaring into the roof, her name on their outer faces.
  const profile = roundedShape(
    [
      [-4.02, DECK - 0.02],
      [-3.58, DECK - 0.02],
      [-3.52, 3.55],
      [-3.36, ROOF.bottom + 0.05],
      [-4.16, ROOF.bottom + 0.05],
      [-4.08, 3.55],
    ],
    [0.04, 0.04, 0.45, 0.05, 0.05, 0.45],
  );
  const pillar = slab(profile, 0.16, 0.04, 3, 2);
  for (const s of [-1, 1]) {
    root.add(put(new THREE.Mesh(pillar, MAT.gelcoat()), 0, 0, s * 2.04));
    const name = decal("nameDark", 0.62, 0.078);
    if (s < 0) name.rotation.y = Math.PI;
    root.add(put(name, -3.8, 3.86, s * (2.04 + 0.081)));
  }
  // On top: the radar arch, and the weapon station forward.
  const arch = radarArch();
  root.add(put(arch.group, -2.2, roofTop(-2.2), 0));
}

// -------------------------------------------------------------------------------------------------
// The helm.

function helm(root: THREE.Object3D): { screen: THREE.Mesh; holders: THREE.Object3D[] } {
  // The dash, against the cuddy's aft wall: a white moulding, its top sloping down toward the helm.
  const dash = slab(
    roundedShape(
      [
        [0.1, DECK - 0.02],
        [0.74, DECK - 0.02],
        [0.74, 2.44],
        [0.48, 2.42],
        [0.1, 2.22],
      ],
      [0.02, 0.02, 0.03, 0.08, 0.05],
    ),
    2.5,
    0.04,
    3,
    2,
  );
  root.add(new THREE.Mesh(dash, MAT.gelcoat()));
  const slope = Math.atan2(0.2, 0.38);
  const onSlope = (o: THREE.Object3D, x: number, z: number, lift = 0) => {
    o.rotation.z = slope;
    const y = lerp(2.22, 2.42, (x - 0.1) / 0.38);
    o.position.set(x - Math.sin(slope) * lift, y + Math.cos(slope) * lift, z);
    root.add(o);
    return o;
  };
  // Starboard: the instrument panel, two screens, the wheel and the throttles.
  onSlope(rounded(0.42, 0.03, 1.12, MAT.dark(), 0.012), 0.3, 0.64, 0.012);
  // Each screen lies on the slope, its top toward the bow, read from the helm.
  const lie = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(v3(0, 0, 1), v3(1, 0, 0), v3(0, 1, 0)),
  );
  for (const z of [0.38, 0.9]) {
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.3),
      new THREE.MeshBasicMaterial({ map: chartScreen(), toneMapped: false }),
    );
    face.userData.own = true;
    face.quaternion.copy(lie);
    const holder = new THREE.Group();
    holder.add(face);
    onSlope(holder, 0.3, z, 0.03);
  }
  const hub = v3(-0.06, 2.34, 0.62);
  const column = v3(0.12, 2.24, 0.62);
  root.add(rod(column, hub, 0.03, MAT.dark(), 12));
  const wheel = new THREE.Group();
  wheel.position.copy(hub);
  wheel.rotation.set(0, Math.PI / 2, 0);
  wheel.rotateX(-0.42);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 10, 36), MAT.rubber()));
  wheel.add(put(tube(0.045, 0.05, 0.05, MAT.steel(), 18), 0, 0, 0).rotateX(Math.PI / 2));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    wheel.add(
      rod(v3(0, 0, 0), v3(Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0), 0.011, MAT.steel(), 8),
    );
  }
  root.add(wheel);
  const binnacle = rounded(0.16, 0.12, 0.18, MAT.dark(), 0.03);
  onSlope(binnacle, 0.22, 1.12, 0.07);
  for (const z of [1.08, 1.16]) {
    root.add(rod(v3(0.2, 2.42, z), v3(0.08, 2.58, z), 0.011, MAT.steel(), 8));
    root.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), MAT.dark()), 0.08, 2.6, z));
  }
  // Port: the crystal console. A titanium ledge with three cradles, a glowing ring in each, and the
  // chart standing behind them.
  root.add(put(rounded(0.36, 0.05, 0.98, MAT.satin(), 0.015), 0.32, 2.37, -0.7));
  const holders: THREE.Object3D[] = [];
  for (let k = 0; k < 3; k++) {
    const cradle = new THREE.Group();
    cradle.position.set(0.32, 2.395, -0.98 + k * 0.28);
    root.add(cradle);
    cradle.add(put(tube(0.085, 0.1, 0.05, MAT.dark(), 24), 0, 0.025, 0));
    const ringGlow = glowing(new THREE.TorusGeometry(0.068, 0.008, 8, 32), 0x7ff3ff);
    ringGlow.rotation.x = Math.PI / 2;
    cradle.add(put(ringGlow, 0, 0.052, 0));
    for (let c = 0; c < 3; c++) {
      const a = (c / 3) * Math.PI * 2 + 0.5;
      const claw = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.13, 4, 8), MAT.satin());
      claw.position.set(Math.cos(a) * 0.08, 0.12, Math.sin(a) * 0.08);
      claw.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
      cradle.add(claw);
    }
    const seat = new THREE.Object3D();
    seat.name = `holder${k}`;
    seat.position.y = 0.055;
    cradle.add(seat);
    holders.push(seat);
  }
  const bezel = rounded(0.04, 0.38, 0.66, MAT.dark(), 0.015);
  bezel.rotation.z = 0.25;
  root.add(put(bezel, 0.64, 2.64, -0.7));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.34),
    new THREE.MeshBasicMaterial({ map: chartScreen(), toneMapped: false }),
  );
  screen.userData.own = true;
  screen.name = "screen";
  screen.rotation.set(0, -Math.PI / 2, 0);
  screen.rotateX(-0.25);
  root.add(put(screen, 0.615, 2.64, -0.7));
  // The helm seats on their plinth, a footrest in front.
  root.add(put(rounded(0.62, 0.56, 1.4, MAT.gelcoat(), 0.05), -0.76, DECK + 0.28, 0.81));
  root.add(rod(v3(-0.36, DECK + 0.22, 0.14), v3(-0.36, DECK + 0.22, 1.48), 0.018, MAT.steel(), 10));
  for (const z of [0.14, 1.48])
    root.add(rod(v3(-0.36, DECK + 0.22, z), v3(-0.45, DECK + 0.22, z), 0.018, MAT.steel(), 10));
  for (const z of [0.46, 1.16]) root.add(put(helmSeat(), -0.76, DECK + 0.6, z));
  return { screen, holders };
}

// -------------------------------------------------------------------------------------------------
// Aft: the settee, the swim platform, what's under it.

function aft(root: THREE.Object3D): void {
  const inner = fromSheer(0, -deckIn(0), 0).z - 0.02;
  const seatTop = DECK + 0.46;
  // The bench across the stern, and one down each side: white bases, tan cushions, tan backs.
  root.add(put(rounded(0.66, 0.44, inner * 2, MAT.gelcoat(), 0.04), -6.5, DECK + 0.21, 0));
  root.add(put(rounded(0.68, 0.13, inner * 2 - 0.04, MAT.cushion(), 0.05), -6.5, seatTop, 0));
  const back = rounded(0.14, 0.44, inner * 2 - 0.1, MAT.cushion(), 0.06);
  back.rotation.z = -0.16;
  root.add(put(back, -6.76, seatTop + 0.3, 0));
  for (const s of [-1, 1]) {
    const z = s * (inner - 0.27);
    root.add(put(rounded(1.3, 0.44, 0.54, MAT.gelcoat(), 0.04), -5.5, DECK + 0.21, z));
    root.add(put(rounded(1.26, 0.13, 0.56, MAT.cushion(), 0.05), -5.5, seatTop, z));
    const side = rounded(1.22, 0.42, 0.13, MAT.cushion(), 0.06);
    side.rotation.x = s * 0.16;
    root.add(put(side, -5.5, seatTop + 0.29, s * (inner - 0.05)));
  }
  // The engine hatch in the cockpit sole: its seam, and its flush handles.
  for (const [w, d, x, z] of [
    [2.0, 0.012, -3.4, 1.0],
    [2.0, 0.012, -3.4, -1.0],
    [0.012, 2.0, -4.4, 0],
    [0.012, 2.0, -2.4, 0],
  ] as const) {
    root.add(put(box(w, 0.004, d, MAT.rubber()), x, DECK + 0.002, z));
  }
  for (const z of [-0.5, 0.5])
    root.add(put(rounded(0.16, 0.008, 0.05, MAT.steel(), 0.004), -2.55, DECK + 0.004, z));

  // The swim platform: teak on a dark moulding, its aft corners rounded.
  const halfBeam = HALF * plan(0) - 0.05;
  const platform = roundedShape(
    [
      [STERN - 1.2, -halfBeam],
      [STERN + 0.05, -halfBeam],
      [STERN + 0.05, halfBeam],
      [STERN - 1.2, halfBeam],
    ],
    [0.4, 0.02, 0.02, 0.4],
  );
  root.add(put(new THREE.Mesh(lying(platform, 0.12, 0.03, 3, 2), MAT.dark()), 0, 0.37, 0));
  const deckTop = new THREE.ShapeGeometry(
    roundedShape(
      [
        [STERN - 1.16, -halfBeam + 0.04],
        [STERN + 0.02, -halfBeam + 0.04],
        [STERN + 0.02, halfBeam - 0.04],
        [STERN - 1.16, halfBeam - 0.04],
      ],
      [0.36, 0.02, 0.02, 0.36],
    ),
    8,
  );
  deckTop.rotateX(-Math.PI / 2);
  root.add(put(new THREE.Mesh(planUV(deckTop, 2.4), MAT.teak()), 0, 0.492, 0));
  // The sterndrives under it, and the ladder at its edge.
  for (const z of [-0.78, 0.78]) root.add(put(sterndrive(), STERN - 0.5, 0.37, z));
  root.add(put(ladder(), STERN - 1.17, 0.47, 1.25));
  // Cleats at the transom's corners.
  for (const s of [-1, 1]) {
    const c = cleat(0.26);
    c.rotation.y = Math.PI / 2;
    root.add(put(c, STERN + 0.06, sheerY(STERN) + 0.04, s * (halfBeam - 0.14)));
  }
  // Her name across the transom.
  const name = decal("nameLight", 1.7, 0.21);
  name.rotation.y = -Math.PI / 2;
  root.add(put(name, STERN - 0.006, 1.42, 0));
}

// -------------------------------------------------------------------------------------------------
// The bow, and the fittings along her.

function fittings(root: THREE.Object3D): void {
  // The anchor in its roller at the stem, and a stainless plate over the stem's top.
  const hook = anchor();
  root.add(put(hook, STEM - 0.36, sheerY(STEM) - 0.02, 0));
  root.add(
    put(rounded(0.42, 0.03, 0.16, MAT.steel(), 0.012), STEM - 0.26, sheerY(STEM) + 0.035, 0),
  );
  // The anchor locker's lid, flush in the foredeck, with its seam and handle.
  const lidAt = 6.62;
  const y = deckY(lidAt);
  const locker = new THREE.Group();
  locker.position.set(lidAt, y, 0);
  locker.rotation.z = Math.atan(deckSlope(lidAt));
  root.add(locker);
  locker.add(put(rounded(0.74, 0.01, 0.6, MAT.rubber(), 0.004), 0, 0.004, 0));
  const lid = new THREE.ShapeGeometry(
    roundedShape(
      [
        [-0.35, -0.28],
        [0.35, -0.28],
        [0.35, 0.28],
        [-0.35, 0.28],
      ],
      0.08,
    ),
    6,
  );
  lid.rotateX(-Math.PI / 2);
  locker.add(put(new THREE.Mesh(planUV(lid, 2.4), MAT.teak()), 0, 0.012, 0));
  locker.add(put(rounded(0.18, 0.012, 0.05, MAT.steel(), 0.005), 0.24, 0.018, 0));
  // Cleats on the cap rail, fore, amidships and aft.
  for (const t of [0.26, 0.55, 0.92]) {
    const s = LINES.sheer(t);
    const o = outward(t);
    const a = along(t);
    for (const side of [1, -1]) {
      const c = cleat(0.28);
      c.rotation.y = -side * Math.atan2(a.z, a.x);
      root.add(put(c, s.x - o.x * 0.07, sheerY(s.x) + 0.04, side * (s.z - o.z * 0.07)));
    }
  }
  // Navigation lights on her bows: red to port, green to starboard.
  for (const side of [1, -1]) {
    const t = 0.9;
    const s = LINES.sheer(t);
    const o = outward(t);
    const light = navLight(side > 0 ? 0x2bff6a : 0xff3326);
    light.position.set(s.x + o.x * 0.01, sheerY(s.x) - 0.12, side * (s.z + o.z * 0.01));
    light.rotation.y = side > 0 ? Math.atan2(o.x, o.z) : Math.PI - Math.atan2(o.x, o.z);
    root.add(light);
  }
  // Her name on her topsides, aft.
  for (const side of [1, -1]) {
    const x = -5.35;
    const t = (x - STERN) / (STEM - STERN);
    const name = decal("nameLight", 1.3, 0.16);
    const z = fromSheer(t, 0.004, 0).z - 0.012;
    if (side < 0) name.rotation.y = Math.PI;
    root.add(put(name, x, sheerY(x) - 0.3, side * z));
  }
  // The engines' air intakes, low on her sides aft: a row of slots.
  for (const side of [1, -1]) {
    for (let k = 0; k < 6; k++) {
      const x = -6.55 + k * 0.1;
      const t = (x - STERN) / (STEM - STERN);
      const s = LINES.sheer(t);
      const p = s.lerp(LINES.knuckle(t), 1.05 / (s.y - LINES.knuckle(t).y));
      root.add(put(rounded(0.045, 0.17, 0.02, MAT.rubber(), 0.008), x, p.y, side * (p.z + 0.004)));
    }
  }
}

// -------------------------------------------------------------------------------------------------

/** Somewhere aboard for one of the crew: where, which way they face, and whether they sit. */
export interface Station {
  x: number;
  z: number;
  /** Radians, 0 towards the bow, as `atan2(z, x)` goes. */
  facing: number;
  sit: boolean;
  /** Height of what they stand (or sit) on. */
  y: number;
}

export interface CrewBoat {
  root: THREE.Group;
  /** Turns to face where the gunboat's firing. */
  cannon: THREE.Object3D;
  /** Kicks back when it fires. */
  guns: THREE.Object3D;
  muzzle: THREE.Object3D;
  /** Where the crew stand and sit, the best places first. */
  stations: readonly Station[];
  /** The console at the helm: where to stand to work it, its screen, and its three cradles. */
  console: { stand: Station; screen: THREE.Mesh; holders: readonly THREE.Object3D[] };
  /** Under the hardtop: the space a camera can go in at the helm, and the roof's underside. */
  helm: { back: number; front: number; side: number; roof: number };
  /** The way forward along the starboard side deck, past the cuddy, to the foredeck; port's is its mirror. */
  sideDeck: readonly { x: number; z: number }[];
  /** Where the cockpit ends and the side decks begin. */
  foreOf: number;
  /** In the bow, where the crew go over onto the beach: the bulwark's top there, and how far ahead it is. */
  over: readonly { x: number; z: number; top: number; reach: number }[];
  /** Bow to stern, and across. */
  length: number;
  beam: number;
}

/** Drops what's left empty once the parts are baked together. */
function prune(o: THREE.Object3D): void {
  for (const c of [...o.children]) {
    prune(c);
    if (!(c instanceof THREE.Mesh) && c.children.length === 0 && !c.name) o.remove(c);
  }
}

const built = new Map<Detail, THREE.Group>();

/**
 * The light copy's surfaces: the same pictures without the clearcoat, which costs most where
 * she's small on the screen and shows least.
 */
const plainer = new Map<THREE.Material, THREE.Material>();
function plain(material: THREE.Material): THREE.Material {
  if (!(material instanceof THREE.MeshPhysicalMaterial)) return material;
  let simple = plainer.get(material);
  if (!simple) {
    const m = material;
    simple = new THREE.MeshStandardMaterial({
      name: `${m.name}-light`,
      map: m.map,
      roughnessMap: m.roughnessMap,
      metalnessMap: m.metalnessMap,
      roughness: m.roughness,
      metalness: m.metalness,
      color: m.color,
      envMap: m.envMap,
      envMapIntensity: m.envMapIntensity,
      side: m.side,
    });
    simple.userData = { ...m.userData };
    plainer.set(material, simple);
  }
  return simple;
}

/**
 * Builds her, once for each level of detail. The light copy (for raids and maps, where she's seen
 * from above and some way off) has a third of the hull's sections, no screws, and no clearcoat.
 */
function build(detail: Detail): THREE.Group {
  STATIONS = sections(detail === "full" ? 132 : 48);
  lightBuild.on = detail === "light";
  const root = new THREE.Group();
  hull(root);
  rails(root);
  cuddy(root);
  windscreen(root);
  hardtop(root);
  helm(root);
  aft(root);
  fittings(root);
  const gun = weaponStation();
  gun.group.position.set(0.25, roofTop(0.25) - 0.01, 0);
  root.add(gun.group);
  bakeByMaterial(root, [gun.cannon]);
  bakeByMaterial(gun.cannon, [gun.guns]);
  bakeByMaterial(gun.guns);
  prune(root);
  lightBuild.on = false;
  if (detail === "light") {
    for (const o of [...root.children]) {
      if (!(o instanceof THREE.Mesh)) continue;
      if ((o.material as THREE.Material).name === "b-screw") o.removeFromParent();
      else o.material = plain(o.material as THREE.Material);
    }
  }
  return root;
}

/** How much of her to draw: in full, or the light copy for where she's small on the screen. */
export type Detail = "full" | "light";

export function crewBoatModel(detail: Detail = "full"): CrewBoat {
  let template = built.get(detail);
  if (!template) {
    template = build(detail);
    built.set(detail, template);
  }
  const root = template.clone(true);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && (o.material as THREE.Material).userData.detail === true) {
      o.raycast = () => undefined;
    }
  });
  // The radar's array turns, whoever's drawing her.
  const radar = root.getObjectByName("radar");
  if (radar) radar.onBeforeRender = () => radar.rotation.set(0, performance.now() * 0.0021, 0);
  const find = (name: string) => root.getObjectByName(name) as THREE.Object3D;
  const standing = (x: number, z: number, facing: number): Station => ({
    x,
    z,
    facing,
    sit: false,
    y: deckY(x),
  });
  const stations: Station[] = [
    // The best places first, which the camera finds best: up the side decks, then aft.
    standing(2.4, 1.78, 0.35),
    standing(2.4, -1.78, -0.35),
    { x: -5.85, z: 1.1, facing: 0, sit: true, y: deckY(-5.85) },
    { x: -5.85, z: -1.1, facing: 0, sit: true, y: deckY(-5.85) },
    standing(-2.9, -1.55, -1.0),
    standing(6.35, 0.0, 0.0),
    standing(-3.4, 1.5, 2.0),
    standing(-1.9, -0.25, 3.0),
  ];
  return {
    root,
    cannon: find("cannon"),
    guns: find("guns"),
    muzzle: find("muzzle"),
    stations,
    console: {
      stand: standing(-0.42, -0.7, 0),
      screen: find("screen") as THREE.Mesh,
      holders: [find("holder0"), find("holder1"), find("holder2")],
    },
    helm: { back: ROOF.aft + 0.2, front: 0.05, side: 1.95, roof: ROOF.bottom },
    sideDeck: [
      { x: 0.35, z: 1.92 },
      { x: 1.4, z: 1.9 },
      { x: 2.8, z: 1.75 },
      { x: 4.3, z: 1.55 },
      { x: 5.3, z: 1.27 },
      { x: 6.1, z: 0.8 },
    ],
    foreOf: 0.8,
    over: [0.45, -0.45].map((z) => ({ x: 7.45, z, top: sheerY(8.1) + 0.04, reach: 0.65 })),
    length: STEM - STERN,
    beam: HALF * 2 + 0.06,
  };
}
