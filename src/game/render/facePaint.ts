// A generated character's eyes and mouth, painted (docs/CHARACTERS.md).
//
// A generated model's face is one skin with its eyes and mouth painted on, and it's left that way:
// nothing is cut into it. Its eyes and mouth are painted over instead, on two small patches that
// lie on the face, and repainted as the character blinks, looks about and speaks: the way a toy
// figure's printed face is swapped for another. They change in steps, not smoothly. An eye is open,
// looking one of a few ways, or shut; a mouth is shut, or open one of three sizes; the mood sets
// the curve of the mouth and the slant of the lids.
//
// scripts/blender/join_head.py notes where the eyes and the mouth are and the colours of the skin
// there, and scripts/rig-hero.mjs cuts the patches to lie on the face
// (public/models/<who>-face.json).

import * as THREE from "three";

type Point = [number, number, number];

export interface FacePatch {
  columns: number;
  rows: number;
  /** The patch's middle in the model's own space, and how far it reaches each way. */
  middle: Point;
  halfWide: number;
  halfTall: number;
  /** Its points, row by row from the bottom, each row from his right to his left. */
  points: number[];
}

export interface FaceNotes {
  /** His left eye, then his right: their middles, on the skin. */
  eyes: [Point, Point];
  eyeHalf: number;
  mouth: Point;
  mouthHalf: number;
  /** The skin's colour beside the eyes, and round the mouth, as drawn on screen. */
  skin: Point;
  roundMouth: Point;
  patches: { eyes: FacePatch; mouth: FacePatch };
}

const EYES = "paintEyes";
const MOUTH = "paintMouth";
/** How many points of the picture go to a meter of face. */
const FINE = 1500;

function patchMesh(name: string, patch: FacePatch, at: THREE.Vector3): THREE.Mesh {
  const { columns, rows, points } = patch;
  const positions = new Float32Array(points.length);
  const uvs = new Float32Array(columns * rows * 2);
  for (let i = 0; i < columns * rows; i++) {
    positions[i * 3] = (points[i * 3] ?? 0) - at.x;
    positions[i * 3 + 1] = (points[i * 3 + 1] ?? 0) - at.y;
    positions[i * 3 + 2] = (points[i * 3 + 2] ?? 0) - at.z;
    uvs[i * 2] = (i % columns) / (columns - 1);
    uvs[i * 2 + 1] = Math.floor(i / columns) / (rows - 1);
  }
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < columns - 1; c++) {
      const a = r * columns + c;
      index.push(a, a + columns + 1, a + columns, a, a + 1, a + columns + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
  mesh.name = name;
  mesh.castShadow = false;
  mesh.renderOrder = 2;
  return mesh;
}

/** Fixes the two patches to a model's head, unpainted: each copy of the model paints its own. */
export function addFacePatches(scene: THREE.Object3D, notes: FaceNotes): void {
  const head = scene.getObjectByName("head");
  if (!head) return;
  scene.updateMatrixWorld(true);
  const at = head.getWorldPosition(new THREE.Vector3());
  head.add(patchMesh(EYES, notes.patches.eyes, at), patchMesh(MOUTH, notes.patches.mouth, at));
}

const css = (c: Point) =>
  `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
const clear = (c: Point) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},0)`;

interface Sheet {
  canvas: HTMLCanvasElement;
  pen: CanvasRenderingContext2D;
  picture: THREE.CanvasTexture;
  patch: FacePatch;
  drawn: string;
}

function sheet(mesh: THREE.Mesh, patch: FacePatch): Sheet | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(patch.halfWide * 2 * FINE);
  canvas.height = Math.round(patch.halfTall * 2 * FINE);
  const pen = canvas.getContext("2d");
  if (!pen) return null;
  const picture = new THREE.CanvasTexture(canvas);
  picture.colorSpace = THREE.SRGBColorSpace;
  mesh.material = new THREE.MeshStandardMaterial({
    map: picture,
    transparent: true,
    depthWrite: false,
    roughness: 0.75,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  return { canvas, pen, picture, patch, drawn: "" };
}

/** Where a point of the face is on a patch's picture. */
function on(patch: FacePatch, p: Point): [number, number] {
  return [
    (patch.middle[2] + patch.halfWide - p[2]) * FINE,
    (patch.middle[1] + patch.halfTall - p[1]) * FINE,
  ];
}

/** Skin over what the model has painted there, fading out at its edge so no patch shows. */
function cover(
  pen: CanvasRenderingContext2D,
  x: number,
  y: number,
  wide: number,
  tall: number,
  c: Point,
) {
  pen.save();
  pen.translate(x, y);
  pen.scale(1, tall / wide);
  const fade = pen.createRadialGradient(0, 0, wide * 0.72, 0, 0, wide);
  fade.addColorStop(0, css(c));
  fade.addColorStop(1, clear(c));
  pen.fillStyle = fade;
  pen.beginPath();
  pen.arc(0, 0, wide, 0, Math.PI * 2);
  pen.fill();
  pen.restore();
}

const DARK = "#3a2114";
const IRIS = "#6b4423";

export class FacePaint {
  /** The painted face of one copy of a model, if it has the patches. */
  static on(scene: THREE.Object3D, notes: FaceNotes): FacePaint | null {
    const eyes = scene.getObjectByName(EYES);
    const mouth = scene.getObjectByName(MOUTH);
    if (!(eyes instanceof THREE.Mesh) || !(mouth instanceof THREE.Mesh)) return null;
    const a = sheet(eyes, notes.patches.eyes);
    const b = sheet(mouth, notes.patches.mouth);
    if (!a || !b) return null;
    const paint = new FacePaint(notes, a, b);
    paint.eyes(0, 0, 0, null);
    paint.mouth(0, null);
    return paint;
  }

  private constructor(
    private readonly notes: FaceNotes,
    private readonly eyeSheet: Sheet,
    private readonly mouthSheet: Sheet,
  ) {}

  /** The eyes: how far shut, which way they look (in radians, as the animator has it), the mood. */
  eyes(shut: number, yaw: number, pitch: number, mood: string | null): void {
    const closed = shut > 0.5;
    // A few ways to look, no more: the picture's only repainted when one of them changes.
    const across = Math.max(-2, Math.min(2, Math.round(yaw / 0.2)));
    const up = Math.max(-1, Math.min(1, Math.round(pitch / 0.18)));
    const look =
      mood === "angry" || mood === "shout"
        ? "angry"
        : mood === "sad"
          ? "sad"
          : mood === "surprised" || mood === "scared"
            ? "wide"
            : "plain";
    const key = closed ? "shut" : `${across},${up},${look}`;
    const s = this.eyeSheet;
    if (s.drawn === key) return;
    s.drawn = key;
    const { pen, canvas } = s;
    pen.clearRect(0, 0, canvas.width, canvas.height);
    const r = this.notes.eyeHalf * FINE;
    this.notes.eyes.forEach((eye, i) => {
      const [x, y] = on(s.patch, eye);
      // His left eye is on the right of the picture: the nose is towards the picture's middle.
      const nose = i === 0 ? -1 : 1;
      cover(pen, x, y, r * 1.85, r * 1.5, this.notes.skin);
      pen.lineCap = "round";
      if (closed) {
        pen.strokeStyle = DARK;
        pen.lineWidth = r * 0.2;
        pen.beginPath();
        pen.moveTo(x - r * 0.9, y - r * 0.05);
        pen.quadraticCurveTo(x, y + r * 0.5, x + r * 0.9, y - r * 0.05);
        pen.stroke();
        return;
      }
      const tall = look === "wide" ? 0.95 : 0.8;
      pen.save();
      pen.beginPath();
      pen.ellipse(x, y, r, r * tall, 0, 0, Math.PI * 2);
      pen.fillStyle = "#f4f1ea";
      pen.fill();
      pen.clip();
      const ix = x - across * r * 0.2;
      const iy = y - up * r * 0.2;
      pen.fillStyle = IRIS;
      pen.beginPath();
      pen.arc(ix, iy, r * 0.6, 0, Math.PI * 2);
      pen.fill();
      pen.fillStyle = "#120c08";
      pen.beginPath();
      pen.arc(ix, iy, r * 0.33, 0, Math.PI * 2);
      pen.fill();
      pen.fillStyle = "#ffffff";
      pen.beginPath();
      pen.arc(ix + r * 0.2, iy - r * 0.22, r * 0.12, 0, Math.PI * 2);
      pen.fill();
      // The lid: level, or slanted down towards the nose in anger, away from it in sorrow.
      const slant = look === "angry" ? 0.5 : look === "sad" ? -0.4 : 0;
      const drop = look === "wide" ? -0.2 : 0.18;
      pen.fillStyle = css(this.notes.skin);
      pen.beginPath();
      pen.moveTo(x - r * 1.2, y - r * 1.2);
      pen.lineTo(x + r * 1.2, y - r * 1.2);
      pen.lineTo(x + r * 1.2, y - r * (tall - drop) + nose * slant * r * 0.5);
      pen.lineTo(x - r * 1.2, y - r * (tall - drop) - nose * slant * r * 0.5);
      pen.closePath();
      pen.fill();
      pen.strokeStyle = DARK;
      pen.lineWidth = r * 0.16;
      pen.beginPath();
      pen.moveTo(x - r * 1.2, y - r * (tall - drop) - nose * slant * r * 0.5);
      pen.lineTo(x + r * 1.2, y - r * (tall - drop) + nose * slant * r * 0.5);
      pen.stroke();
      pen.restore();
      pen.strokeStyle = DARK;
      pen.lineWidth = r * 0.07;
      pen.beginPath();
      pen.ellipse(x, y, r, r * tall, 0, 0, Math.PI * 2);
      pen.stroke();
    });
    s.picture.needsUpdate = true;
  }

  /** The mouth: how far open (0 to 1), and the mood, which curves it. */
  mouth(open: number, mood: string | null): void {
    const size = open < 0.1 ? 0 : open < 0.38 ? 1 : open < 0.68 ? 2 : 3;
    const curve =
      mood === "happy" || mood === "laugh"
        ? 1
        : mood === "sad"
          ? -1
          : mood === "angry" || mood === "shout"
            ? -0.6
            : 0.25;
    const key = `${size},${curve}`;
    const s = this.mouthSheet;
    if (s.drawn === key) return;
    s.drawn = key;
    const { pen, canvas } = s;
    pen.clearRect(0, 0, canvas.width, canvas.height);
    const [x, y] = on(s.patch, this.notes.mouth);
    const m = this.notes.mouthHalf * FINE;
    cover(pen, x, y, m * 1.3, m * 0.72, this.notes.roundMouth);
    pen.lineCap = "round";
    if (size === 0) {
      pen.strokeStyle = "#6a2f22";
      pen.lineWidth = m * 0.075;
      pen.beginPath();
      pen.moveTo(x - m * 0.78, y - curve * m * 0.1);
      pen.quadraticCurveTo(x, y + curve * m * 0.3, x + m * 0.78, y - curve * m * 0.1);
      pen.stroke();
      s.picture.needsUpdate = true;
      return;
    }
    const wide = m * (0.4 + size * 0.07) * (curve > 0.5 ? 1.2 : 1);
    const tall = m * (0.08 + size * 0.11);
    pen.save();
    pen.beginPath();
    pen.ellipse(x, y + tall * 0.2, wide, tall, 0, 0, Math.PI * 2);
    pen.fillStyle = "#4a1418";
    pen.fill();
    pen.clip();
    if (size >= 2) {
      pen.fillStyle = "#f3efe4";
      pen.fillRect(x - wide, y + tall * 0.2 - tall, wide * 2, tall * 0.5);
      pen.fillStyle = "#c8525a";
      pen.beginPath();
      pen.ellipse(x, y + tall * 1.25, wide * 0.7, tall * 0.7, 0, 0, Math.PI * 2);
      pen.fill();
    }
    pen.restore();
    pen.strokeStyle = "#8a4636";
    pen.lineWidth = m * 0.06;
    pen.beginPath();
    pen.ellipse(x, y + tall * 0.2, wide, tall, 0, 0, Math.PI * 2);
    pen.stroke();
    s.picture.needsUpdate = true;
  }
}
