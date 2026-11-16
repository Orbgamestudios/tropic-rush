// The gunboat's surfaces (gunboat.ts), each painted once on a canvas and shared: deck planks with
// their grain, seams and nails; the hull's paint, chipped and rust-streaked, with its waterline;
// the cabin's red board siding; painted steel with seams and rivets; crate wood; rope. Drawn in the
// game's hand-painted style rather than photographed, so they sit with everything else.
//
// And what the gunboat's built from: geometry given UVs at a set size in metres, so every surface's
// pattern is the same scale whatever it's on, and the parts that share a surface baked into one
// mesh each (a few draw calls for the whole boat).

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Painter = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/** A seeded random, so every boat is painted the same. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const painted = new Map<string, THREE.Texture>();

function texture(name: string, w: number, h: number, paint: Painter): THREE.Texture {
  const cached = painted.get(name);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (g) paint(g, w, h);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  painted.set(name, t);
  return t;
}

const hex = (r: number, g: number, b: number, a = 1) =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

/** Wood grain: long wavering lines along a board. */
function grain(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rand: () => number,
  dark: string,
): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = dark;
  for (let i = 0; i < h / 3; i++) {
    const yy = y + rand() * h;
    const amp = 0.6 + rand() * 1.6;
    const freq = 0.01 + rand() * 0.03;
    g.lineWidth = 0.6 + rand() * 1.1;
    g.globalAlpha = 0.18 + rand() * 0.25;
    g.beginPath();
    for (let xx = x; xx <= x + w; xx += 6) {
      const py = yy + Math.sin(xx * freq + i) * amp;
      if (xx === x) g.moveTo(xx, py);
      else g.lineTo(xx, py);
    }
    g.stroke();
  }
  // A knot or two.
  if (rand() < 0.6) {
    const kx = x + rand() * w;
    const ky = y + h * (0.3 + rand() * 0.4);
    g.globalAlpha = 0.35;
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(kx, ky, 3 + rand() * 4, 1.5 + rand() * 2, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Deck planks: warm teak, each board its own shade, dark caulked seams, nail heads at the joins. */
export function deckWood(): THREE.Texture {
  return texture("deck", 512, 512, (g, w, h) => {
    const rand = seeded(7);
    const rows = 8;
    const ph = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rand() * 200;
      while (x < w) {
        const len = 180 + rand() * 220;
        const shade = 0.85 + rand() * 0.3;
        g.fillStyle = hex(176 * shade, 122 * shade, 72 * shade);
        g.fillRect(x, r * ph, len, ph);
        grain(g, x, r * ph, len, ph, rand, "#5a3a1e");
        // Worn lighter down the middle where feet go.
        const wear = g.createLinearGradient(0, r * ph, 0, (r + 1) * ph);
        wear.addColorStop(0, "rgba(255,230,190,0)");
        wear.addColorStop(0.5, "rgba(255,230,190,0.08)");
        wear.addColorStop(1, "rgba(255,230,190,0)");
        g.fillStyle = wear;
        g.fillRect(x, r * ph, len, ph);
        // The butt joint and its nails.
        g.fillStyle = "#2a1a0e";
        g.fillRect(x + len - 1, r * ph, 2, ph);
        g.fillStyle = "#3a3a3a";
        for (const f of [0.3, 0.7]) {
          g.beginPath();
          g.arc(x + len - 6, r * ph + ph * f, 1.6, 0, Math.PI * 2);
          g.fill();
        }
        x += len;
      }
      // Caulked seam between rows.
      g.fillStyle = "#1e130a";
      g.fillRect(0, r * ph, w, 2.2);
    }
  });
}

/**
 * The hull's paint from the keel (bottom of the picture) to the rail (top): red antifouling below
 * the waterline, a cream boot-top stripe, navy topsides, chipped and rust-streaked.
 */
export function hullPaint(): THREE.Texture {
  return texture("hull", 512, 512, (g, w, h) => {
    const rand = seeded(11);
    const band = (from: number, to: number, color: string) => {
      g.fillStyle = color;
      g.fillRect(0, h * (1 - to), w, h * (to - from));
    };
    band(0, 0.4, "#9c3a2c");
    band(0.4, 0.47, "#e9e2cf");
    band(0.47, 1, "#22406b");
    // A darker sheer line under the rail.
    band(0.94, 1, "#18294a");
    // Mottling in the paint.
    for (let i = 0; i < 1400; i++) {
      const x = rand() * w;
      const y = rand() * h;
      g.fillStyle = rand() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
      g.fillRect(x, y, 2 + rand() * 6, 1 + rand() * 3);
    }
    // Rust streaks running down from the rail and from the fender lines.
    for (let i = 0; i < 26; i++) {
      const x = rand() * w;
      const top = h * (0.02 + rand() * 0.35);
      const len = 20 + rand() * 90;
      const grad = g.createLinearGradient(0, top, 0, top + len);
      grad.addColorStop(0, "rgba(140,70,30,0.55)");
      grad.addColorStop(1, "rgba(140,70,30,0)");
      g.fillStyle = grad;
      g.fillRect(x, top, 2 + rand() * 4, len);
    }
    // A few chips through to the grey undercoat, with a dark edge, mostly low where fenders rub.
    for (let i = 0; i < 22; i++) {
      const x = rand() * w;
      const y = h * (0.25 + rand() * 0.28);
      const r = 2 + rand() * 4;
      g.fillStyle = "rgba(20,20,25,0.4)";
      g.beginPath();
      g.ellipse(x, y, r + 1, r * 0.6 + 1, rand(), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#5e6670";
      g.beginPath();
      g.ellipse(x, y, r, r * 0.6, rand(), 0, Math.PI * 2);
      g.fill();
    }
    // Weed and grime just above the waterline.
    const grime = g.createLinearGradient(0, h * 0.55, 0, h * 0.62);
    grime.addColorStop(0, "rgba(40,60,30,0)");
    grime.addColorStop(1, "rgba(40,60,30,0.35)");
    g.fillStyle = grime;
    g.fillRect(0, h * 0.55, w, h * 0.07);
  });
}

/** The cabin's siding: overlapping boards painted red, chipped to grey wood at the edges. */
export function cabinBoards(): THREE.Texture {
  return texture("cabin", 512, 512, (g, w, h) => {
    const rand = seeded(23);
    // Long boards running the length of the wall, each lapping over the one below.
    const rows = 6;
    const bh = h / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * bh;
      const shade = 0.94 + rand() * 0.1;
      const board = g.createLinearGradient(0, y, 0, y + bh);
      board.addColorStop(0, hex(200 * shade, 82 * shade, 60 * shade));
      board.addColorStop(0.7, hex(184 * shade, 72 * shade, 52 * shade));
      board.addColorStop(1, hex(128 * shade, 44 * shade, 32 * shade));
      g.fillStyle = board;
      g.fillRect(0, y, w, bh);
      grain(g, 0, y, w, bh, rand, "#7a2a1c");
      // The shadow line where the board above laps over this one, and its lit edge.
      g.fillStyle = "rgba(40,10,5,0.6)";
      g.fillRect(0, y, w, 3);
      g.fillStyle = "rgba(255,200,170,0.25)";
      g.fillRect(0, y + 3, w, 1.5);
      // Now and then, paint worn through along the board's lower edge.
      if (rand() < 0.55) {
        const x = rand() * w;
        const len = 20 + rand() * 60;
        g.fillStyle = "rgba(185,171,149,0.85)";
        g.beginPath();
        g.ellipse(x, y + bh * 0.88, len / 2, 2 + rand() * 2.5, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
}

/** Painted steel: blue-grey, with panel seams, rows of rivets and a little rust at the edges. */
export function paintedSteel(): THREE.Texture {
  return texture("steel", 256, 256, (g, w, h) => {
    const rand = seeded(31);
    g.fillStyle = "#5b6a80";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rand() < 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
      g.fillRect(rand() * w, rand() * h, 3 + rand() * 10, 2 + rand() * 4);
    }
    g.strokeStyle = "rgba(20,25,35,0.7)";
    g.lineWidth = 2;
    for (const p of [0, 128]) {
      g.beginPath();
      g.moveTo(0, p + 1);
      g.lineTo(w, p + 1);
      g.moveTo(p + 1, 0);
      g.lineTo(p + 1, h);
      g.stroke();
    }
    for (const p of [8, 120, 136, 248]) {
      for (let q = 8; q < w; q += 16) {
        for (const [x, y] of [
          [q, p],
          [p, q],
        ] as const) {
          g.fillStyle = "rgba(0,0,0,0.4)";
          g.beginPath();
          g.arc(x + 0.8, y + 0.8, 2.2, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#8a98ac";
          g.beginPath();
          g.arc(x, y, 1.8, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    for (let i = 0; i < 12; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const grad = g.createRadialGradient(x, y, 0, x, y, 6 + rand() * 10);
      grad.addColorStop(0, "rgba(130,60,25,0.55)");
      grad.addColorStop(1, "rgba(130,60,25,0)");
      g.fillStyle = grad;
      g.fillRect(x - 16, y - 16, 32, 32);
    }
  });
}

/** Crate and bench wood: rough pale boards. */
export function crateWood(): THREE.Texture {
  return texture("crate", 256, 256, (g, w, h) => {
    const rand = seeded(43);
    const rows = 4;
    const bh = h / rows;
    for (let r = 0; r < rows; r++) {
      const shade = 0.85 + rand() * 0.25;
      g.fillStyle = hex(166 * shade, 118 * shade, 70 * shade);
      g.fillRect(0, r * bh, w, bh);
      grain(g, 0, r * bh, w, bh, rand, "#4e331c");
      g.fillStyle = "#2a1a0e";
      g.fillRect(0, r * bh, w, 2);
    }
  });
}

/** Rope: twisted strands. */
export function ropeTwist(): THREE.Texture {
  return texture("rope", 128, 32, (g, w, h) => {
    g.fillStyle = "#c9a86b";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,60,25,0.55)";
    g.lineWidth = 3;
    for (let x = -h; x < w + h; x += 10) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + h, h);
      g.stroke();
    }
  });
}

/** Brass: warm, a little tarnished. */
export function brass(): THREE.Texture {
  return texture("brass", 128, 128, (g, w, h) => {
    const rand = seeded(53);
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#d8b45a");
    grad.addColorStop(0.5, "#b48a36");
    grad.addColorStop(1, "#e2c271");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) {
      g.fillStyle = `rgba(60,70,40,${0.05 + rand() * 0.08})`;
      g.fillRect(rand() * w, rand() * h, 2 + rand() * 6, 2 + rand() * 6);
    }
  });
}

/** The console's chart: sea blue, a grid, a coastline, a dotted course. */
export function chartScreen(): THREE.Texture {
  return texture("chart", 256, 128, (g, w, h) => {
    g.fillStyle = "#0d3a44";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(120,240,220,0.25)";
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
    g.fillStyle = "rgba(240,210,120,0.75)";
    g.beginPath();
    g.ellipse(190, 70, 38, 26, 0.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.setLineDash([4, 5]);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(30, 100);
    g.quadraticCurveTo(90, 40, 160, 66);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#ff6a4a";
    g.beginPath();
    g.arc(30, 100, 4, 0, Math.PI * 2);
    g.fill();
  });
}

/** Non-slip deck: dark grey, a fine raised diamond pattern, a little scuffed. */
export function nonSlip(): THREE.Texture {
  return texture("nonslip", 256, 256, (g, w, h) => {
    const rand = seeded(61);
    g.fillStyle = "#565c63";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      for (let x = (y / 8) % 2 === 0 ? 0 : 4; x < w; x += 8) {
        g.fillStyle = "rgba(255,255,255,0.08)";
        g.fillRect(x, y, 3, 3);
        g.fillStyle = "rgba(0,0,0,0.12)";
        g.fillRect(x + 2, y + 2, 2, 2);
      }
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.08})`;
      g.beginPath();
      g.ellipse(
        rand() * w,
        rand() * h,
        6 + rand() * 18,
        3 + rand() * 8,
        rand() * 3,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  });
}

/**
 * What the boat's shiny surfaces reflect: a sky going pale to the horizon, a band of light there,
 * and the sea below; painted as a panorama, so the glass, the paint and the aluminium shine without
 * the cost of reflecting the real scene.
 */
export function reflections(): THREE.Texture {
  const t = texture("reflect", 512, 256, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h / 2);
    sky.addColorStop(0, "#3f7fc8");
    sky.addColorStop(0.7, "#9ccaf0");
    sky.addColorStop(1, "#f4ead2");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h / 2);
    const sea = g.createLinearGradient(0, h / 2, 0, h);
    sea.addColorStop(0, "#5fa9c4");
    sea.addColorStop(1, "#173a52");
    g.fillStyle = sea;
    g.fillRect(0, h / 2, w, h / 2);
    // Clouds, and the sun's glow.
    const rand = seeded(71);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = "rgba(255,255,255,0.5)";
      g.beginPath();
      g.ellipse(
        rand() * w,
        h * (0.15 + rand() * 0.25),
        20 + rand() * 40,
        5 + rand() * 9,
        0,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
    const sun = g.createRadialGradient(w * 0.3, h * 0.28, 0, w * 0.3, h * 0.28, 60);
    sun.addColorStop(0, "rgba(255,250,230,1)");
    sun.addColorStop(1, "rgba(255,250,230,0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
  });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

/** A name painted on the collar, white on transparent. */
export function nameDecal(name: string): THREE.Texture {
  return texture(`name:${name}`, 1024, 160, (g, w, h) => {
    g.font = "900 104px 'Randoshape', 'Arial Black', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.fillText(name, w / 2 + 4, h / 2 + 5);
    g.fillStyle = "#ffffff";
    g.fillText(name, w / 2, h / 2);
  });
}

/** A life ring's red and white quarters. */
export function lifeRing(): THREE.Texture {
  return texture("ring", 64, 16, (g, w, h) => {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 === 0 ? "#e8522f" : "#f3eee4";
      g.fillRect((i * w) / 4, 0, w / 4, h);
    }
  });
}

/**
 * Gives a geometry UVs from where its points are, `size` metres to one repeat of the picture,
 * from whichever side each face mostly looks (so a box, a wedge or a hull side all get even,
 * unstretched patterns).
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

/** A surface: one shared material per name. */
const surfaces = new Map<string, THREE.MeshStandardMaterial>();
export function surface(
  name: string,
  make: () => THREE.MeshStandardMaterial,
): THREE.MeshStandardMaterial {
  let m = surfaces.get(name);
  if (!m) {
    m = make();
    surfaces.set(name, m);
  }
  return m;
}

/**
 * Bakes every mesh under `root` that shares a material into one mesh per material (moving parts,
 * in `keep`, stay their own), so the boat's a handful of draw calls however many parts it has.
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
  for (const m of baked) {
    m.removeFromParent();
  }
  for (const [material, parts] of groups) {
    const merged = mergeGeometries(parts, false);
    if (!merged) continue;
    const whole = new THREE.Mesh(merged, material);
    whole.castShadow = true;
    whole.receiveShadow = true;
    root.add(whole);
  }
}
