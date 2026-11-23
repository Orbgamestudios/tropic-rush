// A blank-faced character's face, brought to life (docs/CHARACTERS.md, Faces).
//
// FaceMap is what scripts/blender/face_map.py found on the model: where the eye sockets, the brow
// ridge and the mouth pocket are, and a patch lying on the skin over each. addFace hangs the
// patches on the head bone and paints into them (faceShader.ts). FaceRig moves it all: expressions
// eased in on springs, blinks (and a double blink when the face changes), small darting eye
// movements between things looked at, a mouth that says a scripted line or follows a playing
// recording, and the head nodding along with the open sounds and tilting with the mood.

import * as THREE from "three";
import {
  type Expression,
  FACE_PARTS,
  FACES,
  type FacePart,
  faceTargets,
} from "../../logic/face/expressions";
import { type Cue, type Look, type ScriptedLine, scriptLine } from "../../logic/face/faceScript";
import { SpringSet } from "../../logic/face/springs";
import { MOUTH, type MouthShape, mouthAt } from "../../logic/face/visemes";
import {
  BROW_FROM,
  type EyeUniforms,
  eyeUniforms,
  type FacePalette,
  facePatchMaterial,
  type MouthUniforms,
  mouthUniforms,
} from "./faceShader";

interface Patch {
  columns: number;
  rows: number;
  /** Its square-on middle in the model's space (x across, then height). */
  middle: [number, number, number];
  halfWide: number;
  halfTall: number;
  /** Points, and the skin's direction at each. */
  points: number[];
  normals: number[];
  /** Which piece of the face's picture is this patch's. */
  tile: number;
}

export interface FaceMap {
  /** How tall the head is, chin to crown. */
  head: number;
  /** His left eye, then his right: across and height, in the model's space. */
  eyes: [[number, number], [number, number]];
  browZ: number;
  /**
   * How far from the nose's middle the brows start, in the model's units: where its bridge leaves
   * off, on a face with a wide one (the Rifleman's). Without it they start in over the nose's root.
   */
  browStart?: number;
  eyeHalf: number;
  mouth: [number, number];
  mouthHalf: number;
  mouthTall: number;
  patches: { eyeL: Patch; eyeR: Patch; mouth: Patch };
  /** The skin under the patches, side by side in one picture, and how many there are. */
  picture: string;
  tiles: number;
}

export const CAPTAIN_PALETTE: FacePalette = {
  iris: new THREE.Color().setRGB(0.3, 0.21, 0.14, THREE.SRGBColorSpace),
  hair: new THREE.Color().setRGB(0.8, 0.57, 0.3, THREE.SRGBColorSpace),
  hairShade: new THREE.Color().setRGB(0.5, 0.32, 0.15, THREE.SRGBColorSpace),
  lash: new THREE.Color().setRGB(0.16, 0.09, 0.06, THREE.SRGBColorSpace),
  lip: new THREE.Color().setRGB(0.96, 0.7, 0.68, THREE.SRGBColorSpace),
};

/** One patch as a mesh in the head bone's space, each point knowing where it is on the feature. */
function patchMesh(
  patch: Patch,
  tiles: number,
  toBone: THREE.Matrix4,
  centre: [number, number],
  size: number,
  mirror: boolean,
  material: THREE.Material,
): THREE.Mesh {
  const { columns, rows } = patch;
  const count = columns * rows;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const face = new Float32Array(count * 2);
  const turn = new THREE.Matrix3().getNormalMatrix(toBone);
  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    p.fromArray(patch.points, i * 3)
      .applyMatrix4(toBone)
      .toArray(positions, i * 3);
    p.fromArray(patch.normals, i * 3)
      .applyMatrix3(turn)
      .normalize()
      .toArray(normals, i * 3);
    // Square-on, where this point is on the feature, in the feature's own sizes.
    const col = i % columns;
    const row = Math.floor(i / columns);
    uvs[i * 2] = (patch.tile + col / (columns - 1)) / tiles;
    uvs[i * 2 + 1] = row / (rows - 1);
    const across = patch.middle[0] + patch.halfWide * ((2 * col) / (columns - 1) - 1) - centre[0];
    const up = patch.middle[1] + patch.halfTall * ((2 * row) / (rows - 1) - 1) - centre[1];
    face[i * 2] = ((mirror ? -1 : 1) * across) / size;
    face[i * 2 + 1] = up / size;
  }
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < columns - 1; c++) {
      const a = r * columns + c;
      index.push(a, a + 1, a + columns + 1, a, a + columns + 1, a + columns);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("aFace", new THREE.BufferAttribute(face, 2));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

export interface FaceParts {
  eyes: [EyeUniforms, EyeUniforms];
  mouth: MouthUniforms;
  head: THREE.Bone;
  map: FaceMap;
  /** The eye and mouth patches, in the head bone's space. */
  patches: THREE.Mesh[];
}

/**
 * Beyond this many meters from the camera the painted face isn't drawn: a face there is ten pixels
 * tall at most and its eyes one or two, three draw calls and thousands of triangles for nothing
 * (the owner's budget for what's seen from above, 2026-11-23).
 */
const FACE_FAR = 24;

/**
 * Hangs the painted face on a model just loaded, before anything has moved it: the patches are in
 * the model's space as it rests, and they're put into the head bone's own space from there.
 */
export function addFace(
  model: THREE.Object3D,
  map: FaceMap,
  /** The skin under the patches: the picture beside the face map, loaded. */
  skin: THREE.Texture,
  palette: FacePalette = CAPTAIN_PALETTE,
  headName = "CC_Base_Head",
): FaceParts | null {
  const head = model.getObjectByName(headName);
  if (!(head instanceof THREE.Bone)) return null;
  skin.colorSpace = THREE.SRGBColorSpace;
  skin.anisotropy = 4;
  // The face round the patches is lit as skin of this roughness.
  const roughness = 0.68;
  model.updateMatrixWorld(true);
  const toBone = new THREE.Matrix4().copy(head.matrixWorld).invert().multiply(model.matrixWorld);
  const eyes: [EyeUniforms, EyeUniforms] = [eyeUniforms(), eyeUniforms()];
  const mouth = mouthUniforms();
  const browUp = (map.browZ - map.eyes[0][1]) / map.eyeHalf;
  const apart = (map.eyes[0][0] - map.eyes[1][0]) / 2;
  const browFrom =
    map.browStart === undefined
      ? BROW_FROM
      : Math.max(BROW_FROM, (map.browStart - apart) / map.eyeHalf);
  for (const e of eyes) {
    e.brow.value.w = browUp;
    e.browFrom.value = browFrom;
  }
  // The mouth's line at rest reaches most of the way across its pocket.
  mouth.mood.value.w = 0.78;
  const patches: THREE.Mesh[] = [];
  const add = (
    patch: Patch,
    centre: [number, number],
    size: number,
    mirror: boolean,
    material: THREE.Material,
  ) => patches.push(patchMesh(patch, map.tiles, toBone, centre, size, mirror, material));
  add(
    map.patches.eyeL,
    map.eyes[0],
    map.eyeHalf,
    false,
    facePatchMaterial({ kind: "eye", skin, roughness, palette, eye: eyes[0] }),
  );
  add(
    map.patches.eyeR,
    map.eyes[1],
    map.eyeHalf,
    true,
    facePatchMaterial({ kind: "eye", skin, roughness, palette, eye: eyes[1] }),
  );
  add(
    map.patches.mouth,
    map.mouth,
    map.mouthHalf,
    false,
    facePatchMaterial({ kind: "mouth", skin, roughness, palette, mouth }),
  );
  const drawn = new THREE.LOD();
  drawn.addLevel(new THREE.Group().add(...patches), 0);
  drawn.addLevel(new THREE.Object3D(), FACE_FAR);
  head.add(drawn);
  return { eyes, mouth, head, map, patches };
}

type MouthKey = keyof MouthShape;
const MOUTH_KEYS = Object.keys(MOUTH.sil) as MouthKey[];
const GAZE = ["gazeX", "gazeY"] as const;
type GazeKey = (typeof GAZE)[number];

/** How long a blink takes: closing is quicker than opening. */
const BLINK_CLOSE = 0.07;
const BLINK_OPEN = 0.13;
/** Seconds between blinks, at least and at most. */
const BLINK_EVERY: [number, number] = [2.2, 5.5];
/** How far the eyes go for each way of looking, and how far a dart goes. */
const LOOKS: Record<Look, [number, number]> = {
  left: [0.75, 0],
  right: [-0.75, 0],
  up: [0, 0.7],
  down: [0, -0.6],
  ahead: [0, 0],
};
const DART = 0.12;

export class FaceRig {
  private readonly face = new SpringSet<FacePart>(
    FACE_PARTS,
    (part) => faceTargets("neutral")[part],
  );
  private readonly mouth = new SpringSet<MouthKey>(MOUTH_KEYS, (key) => MOUTH.sil[key]);
  private readonly eyes = new SpringSet<GazeKey>(GAZE);
  private expression: Expression = "neutral";
  private settle = FACES.neutral.settle;
  private time = 0;
  private blinkAt = 1 + Math.random() * 2;
  private blinkStart = -1;
  private secondBlink = -1;
  private look: [number, number] = [0, 0];
  private dart: [number, number] = [0, 0];
  private dartAt = 0.5;
  private nodding = -1;
  private shaking = -1;
  private line: ScriptedLine | null = null;
  private lineStart = 0;
  private cueIndex = 0;
  private listening: AnalyserNode | null = null;
  private heard: MouthShape = { ...MOUTH.sil };
  private samples: Float32Array<ArrayBuffer> | null = null;
  private readonly offset = new THREE.Quaternion();
  private readonly applied = new THREE.Quaternion();
  private readonly turn = new THREE.Euler();
  /** Whether something else (an animation) sets the head's pose each frame before this does. */
  animated = false;

  constructor(private readonly parts: FaceParts) {}

  /** Changes the face, eased in over the expression's own time (or `seconds`). */
  express(expression: Expression, seconds?: number): void {
    if (expression !== this.expression && Math.random() < 0.6) {
      // A change of mind shows as a blink, often two.
      this.blink();
      if (Math.random() < 0.5) this.secondBlink = this.time + BLINK_CLOSE + BLINK_OPEN + 0.06;
    }
    this.expression = expression;
    this.settle = seconds ?? FACES[expression].settle;
  }

  get current(): Expression {
    return this.expression;
  }

  blink(): void {
    this.blinkStart = this.time;
  }

  lookAt(look: Look): void {
    this.look = LOOKS[look];
  }

  nod(): void {
    this.nodding = this.time;
  }

  shake(): void {
    this.shaking = this.time;
  }

  /** Says a scripted line (tags and all; see faceScript.ts). Returns how long it takes. */
  say(line: string, pace = 1): number {
    this.line = scriptLine(line, pace);
    this.lineStart = this.time;
    this.cueIndex = 0;
    return this.line.seconds;
  }

  /** Whether a line is still being said. */
  get speaking(): boolean {
    return this.line !== null || this.listening !== null;
  }

  /**
   * Follows a recording as it plays: louder opens the mouth, a bright hiss spreads it, a dull boom
   * rounds it. `analyser` is the recording's Web Audio analyser; null stops listening.
   */
  listen(analyser: AnalyserNode | null): void {
    this.listening = analyser;
    if (analyser) {
      analyser.fftSize = 1024;
      this.samples = new Float32Array(analyser.fftSize);
    }
  }

  private run(cue: Cue): void {
    if (cue.kind === "face") this.express(cue.expression);
    else if (cue.kind === "blink") this.blink();
    else if (cue.kind === "nod") this.nod();
    else if (cue.kind === "shake") this.shake();
    else this.lookAt(cue.look);
  }

  private spoken(): MouthShape {
    if (this.listening && this.samples) return this.fromRecording(this.listening, this.samples);
    const line = this.line;
    if (!line) return MOUTH.sil;
    const t = this.time - this.lineStart;
    while (this.cueIndex < line.cues.length && (line.cues[this.cueIndex]?.at ?? 0) <= t) {
      const cue = line.cues[this.cueIndex];
      if (cue) this.run(cue.cue);
      this.cueIndex++;
    }
    if (t > line.seconds) {
      this.line = null;
      return MOUTH.sil;
    }
    return mouthAt(line.visemes, t);
  }

  private fromRecording(analyser: AnalyserNode, samples: Float32Array<ArrayBuffer>): MouthShape {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    let crossings = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i] ?? 0;
      sum += s * s;
      if (i > 0 && (samples[i - 1] ?? 0) < 0 !== s < 0) crossings++;
    }
    const loud = Math.min(1, Math.sqrt(sum / samples.length) * 6);
    // How often the wave crosses zero says how bright the sound is: hisses cross often, vowels
    // like OO and OH seldom.
    const bright = Math.min(1, crossings / samples.length / 0.12);
    const open = loud < 0.06 ? 0 : loud;
    const shape: MouthShape = {
      ...MOUTH.sil,
      open: open * 0.9,
      wide: 0.8 + bright * 0.5,
      round: Math.max(0, 0.7 - bright * 1.2) * Math.min(1, open * 2),
      teethUp: open * (0.3 + bright * 0.6),
      teethDown: open * bright * 0.5,
      tongue: open * 0.3,
    };
    // A little smoothing, as a jaw can't follow every wobble of a wave.
    for (const key of MOUTH_KEYS) this.heard[key] += (shape[key] - this.heard[key]) * 0.5;
    return this.heard;
  }

  /** Moves the face on. Call once a frame, after any animation has posed the body. */
  update(dt: number): void {
    this.time += dt;
    const { time } = this;
    const targets = faceTargets(this.expression);
    this.face.step(targets, this.settle, dt);
    const spoken = this.spoken();
    this.mouth.step(spoken, 0.09, dt);

    // Blinks: now and then, more often when tense.
    const tense =
      this.expression === "furious" ||
      this.expression === "scared" ||
      this.expression === "shocked";
    if (time >= this.blinkAt) {
      this.blink();
      const [soon, late] = BLINK_EVERY;
      this.blinkAt = time + (soon + Math.random() * (late - soon)) * (tense ? 0.6 : 1);
    }
    if (this.secondBlink > 0 && time >= this.secondBlink) {
      this.secondBlink = -1;
      this.blink();
    }
    let shut = 0;
    if (this.blinkStart >= 0) {
      const t = time - this.blinkStart;
      shut = t < BLINK_CLOSE ? t / BLINK_CLOSE : Math.max(0, 1 - (t - BLINK_CLOSE) / BLINK_OPEN);
      if (t > BLINK_CLOSE + BLINK_OPEN) this.blinkStart = -1;
    }

    // The eyes dart between nearby points, quick jumps rather than glides.
    if (time >= this.dartAt) {
      this.dartAt = time + 0.35 + Math.random() * 1.8;
      this.dart = [(Math.random() - 0.5) * 2 * DART, (Math.random() - 0.5) * DART];
    }
    this.eyes.step(
      { gazeX: this.look[0] + this.dart[0], gazeY: this.look[1] + this.dart[1] },
      0.06,
      dt,
    );

    const f = (part: FacePart) => this.face.get(part);
    const m = (key: MouthKey) => this.mouth.get(key);
    const { eyes, mouth } = this.parts;
    const sides = [
      {
        lid: f("lidL"),
        lower: f("lowerL"),
        inner: f("browInnerL"),
        mid: f("browMidL"),
        outer: f("browOuterL"),
      },
      {
        lid: f("lidR"),
        lower: f("lowerR"),
        inner: f("browInnerR"),
        mid: f("browMidR"),
        outer: f("browOuterR"),
      },
    ];
    sides.forEach((side, i) => {
      const eye = eyes[i] as EyeUniforms;
      // A smile and a squint push the lower lid up; a frown of the brow presses the upper lid down.
      const pressed = Math.min(0, side.inner) * 0.25;
      eye.lids.value.set(
        Math.max(0, side.lid + pressed) * (1 - shut),
        side.lower + Math.max(0, f("smile")) * 0.25,
        0,
        0,
      );
      // Looking down drops the lids with the eyes.
      eye.lids.value.x *= 1 + Math.min(0, this.eyes.get("gazeY")) * 0.35;
      eye.gaze.value.set(
        this.eyes.get("gazeX") * (i === 0 ? 1 : -1),
        this.eyes.get("gazeY"),
        f("pupil"),
      );
      eye.brow.value.x = side.inner;
      eye.brow.value.y = side.mid;
      eye.brow.value.z = side.outer;
    });
    mouth.shapeA.value.set(m("open"), m("wide"), m("round"), m("teethUp"));
    mouth.shapeB.value.set(
      m("teethDown"),
      m("tongue"),
      Math.max(m("press"), f("mouthTense") * 0.6),
      m("bite"),
    );
    mouth.mood.value.x = f("smile");
    mouth.mood.value.y = f("lopsided");
    mouth.mood.value.z = f("mouthTense");
    this.moveHead(m("open"));
  }

  /** The head: the mood's tilt, nods and shakes, and a small dip with each open sound. */
  private moveHead(open: number): void {
    const { head } = this.parts;
    const t = this.time;
    const nodT = this.nodding >= 0 ? t - this.nodding : -1;
    const nod =
      nodT >= 0 && nodT < 0.6 ? Math.sin((nodT / 0.6) * Math.PI * 2) * 0.12 * (1 - nodT / 0.6) : 0;
    const shakeT = this.shaking >= 0 ? t - this.shaking : -1;
    const shake =
      shakeT >= 0 && shakeT < 0.8
        ? Math.sin((shakeT / 0.8) * Math.PI * 3) * 0.14 * (1 - shakeT / 0.8)
        : 0;
    // A head breathes: a slow sway even when still.
    const sway = Math.sin(t * 0.7) * 0.012;
    this.turn.set(
      this.face.get("nod") + nod + open * 0.05 + sway,
      this.face.get("turn") + shake + Math.sin(t * 0.43) * 0.01,
      this.face.get("lean"),
    );
    // Bone axes of a Character Creator head: x pitches, y turns, z leans.
    this.offset.setFromEuler(this.turn);
    if (!this.animated) head.quaternion.multiply(this.applied.invert());
    head.quaternion.multiply(this.offset);
    this.applied.copy(this.offset);
  }
}
