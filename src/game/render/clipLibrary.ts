// Animation clips for characters on the Character Creator skeleton (the Captain): the stock
// ActorCore animations, turned into clips for his skeleton by scripts/blender/convert_clips.py and
// listed in public/models/anims/clips.json. What each one is, and how they were measured, is in
// docs/ANIMATION.md.
//
// A ClipPlayer plays them on a loaded model through one THREE.AnimationMixer, and does what good
// games do between them: a blend whose length suits the change (a quick one into a walk, a slow
// settle out of a gesture, an instant one into a hit), walks and runs swapped at the same point of
// the stride so the feet never skip, gestures laid over the upper body while the legs keep going,
// and the hip's travel taken out for the game to move the character by instead.
//
// Every clip is split in two at load, by bones: the lower body (hip, pelvis, legs, waist) and the
// upper (from the spine up). Each half is its own action, kept in step, so a gesture can take over
// the upper half alone. The choices (which blend, how long, where in the stride) are plain
// functions below the player, tested in clipLibrary.test.ts.

import * as THREE from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** What a clip is, from clips.json. Lengths are in the model's own units, before any scaling. */
export interface ClipInfo {
  name: string;
  file: string;
  kind: ClipKind;
  seconds: number;
  loops: boolean;
  /** Whether it carries him somewhere (or turns him round) that the game should take over. */
  rootMotion: boolean;
  /** Where the hip ends up from where it started, across (x) and ahead (z). */
  travel: [number, number];
  turnDegrees: number;
  /** The furthest the hip strays from where it started, even in a clip that comes back. */
  reach: number;
  /** How far one loop of a walk or run carries him, and how fast that is. */
  distancePerCycle?: number;
  speed?: number;
  /** When each foot lands, in seconds from the start. */
  footfalls?: { left: number[]; right: number[] };
  about: string;
}

export type ClipKind =
  | "idle"
  | "sit"
  | "wander"
  | "walk"
  | "run"
  | "start"
  | "stop"
  | "action"
  | "turn"
  | "reaction";

export interface ClipManifest {
  /** The Captain's height in his model's units. */
  height: number;
  fps: number;
  clips: ClipInfo[];
}

/** The bone the upper body hangs from: it and everything under it are "upper". */
export const UPPER_BODY_ROOT = "CC_Base_Spine01";
/** The bone whose position carries the clip's travel. */
export const HIP = "CC_Base_Hip";

// -- The choices, as plain functions. -------------------------------------------------------

/** Kinds that cycle on the spot as he travels. */
const CYCLES: ReadonlySet<ClipKind> = new Set(["walk", "run"]);
/** Kinds where he's going somewhere. */
const MOVING: ReadonlySet<ClipKind> = new Set(["walk", "run", "wander", "start"]);
/** Kinds where he's doing something with his hands or body, that should end in a settle. */
const BUSY: ReadonlySet<ClipKind> = new Set(["action", "turn", "reaction", "stop"]);

export type Ease = "linear" | "smooth" | "out";

export interface Transition {
  /** How long the blend takes, seconds. */
  seconds: number;
  /** How the weight moves over it: steadily, slow at both ends, or quick then slow. */
  ease: Ease;
  /** Start the new clip at the point in its stride the old one was at, and keep the two in step
   * while they blend, so the feet stay where they are. */
  syncFeet: boolean;
  /** For the docs and debugging: why this blend. */
  reason: string;
}

/** The blend for a change from one clip to another (from null: the first clip, no blend). */
export function transitionFor(from: ClipInfo | null, to: ClipInfo): Transition {
  if (!from) return { seconds: 0, ease: "linear", syncFeet: false, reason: "first" };
  if (from.name === to.name) return { seconds: 0, ease: "linear", syncFeet: false, reason: "same" };
  // A hit lands at once: a long blend would look like he saw it coming.
  if (to.kind === "reaction") return { seconds: 0.08, ease: "out", syncFeet: false, reason: "hit" };
  // Walk to run and back: the two strides are the same motion at different speeds, so they blend
  // well, but only foot for foot. Half a step long is enough to hide the change of pace.
  if (CYCLES.has(from.kind) && CYCLES.has(to.kind)) {
    const step = Math.min(from.seconds, to.seconds) / 2;
    return { seconds: clamp(step, 0.2, 0.4), ease: "linear", syncFeet: true, reason: "gait" };
  }
  // Into a stop that starts mid-stride: picked up at the same footfall, so it reads as one run
  // slowing down rather than a new start.
  if (CYCLES.has(from.kind) && to.kind === "stop") {
    return { seconds: 0.2, ease: "linear", syncFeet: true, reason: "pull up" };
  }
  // Setting off: quick, so the controls feel answered; legs blending slowly from standing look
  // like skating.
  if (MOVING.has(to.kind) && !MOVING.has(from.kind)) {
    return {
      seconds: to.kind === "start" ? 0.15 : 0.2,
      ease: "out",
      syncFeet: false,
      reason: "set off",
    };
  }
  // Getting up or sitting down changes the whole body: blend slowly or the hips swim.
  if ((from.kind === "sit") !== (to.kind === "sit")) {
    return { seconds: 0.6, ease: "smooth", syncFeet: false, reason: "sit or stand" };
  }
  // Pulling up out of a walk or run: a little longer than setting off, as weight takes time to stop.
  if (MOVING.has(from.kind) && !MOVING.has(to.kind)) {
    return { seconds: 0.3, ease: "smooth", syncFeet: false, reason: "stop" };
  }
  // Out of a gesture, turn or stop into standing: a settle, eased both ends so the arms drift
  // home rather than snap.
  if (BUSY.has(from.kind) && to.kind === "idle") {
    return { seconds: 0.5, ease: "smooth", syncFeet: false, reason: "settle" };
  }
  // Into a gesture from standing: brisk, so it reads as meant.
  if (BUSY.has(to.kind)) return { seconds: 0.25, ease: "smooth", syncFeet: false, reason: "act" };
  return { seconds: 0.4, ease: "smooth", syncFeet: false, reason: "default" };
}

/** How a blend's weight moves, for `ease` and how far through (0 to 1) it is. */
export function eased(ease: Ease, u: number): number {
  const t = clamp(u, 0, 1);
  if (ease === "smooth") return t * t * (3 - 2 * t);
  if (ease === "out") return 1 - (1 - t) * (1 - t);
  return t;
}

/** A landing, and where in the stride it is: 0 for the left foot, 0.5 for the right. */
interface Mark {
  time: number;
  phase: number;
}

/**
 * Every landing of either foot in time order. A loop's are repeated a cycle either side, so a time
 * near its start or end still falls between two of them.
 */
function marks(info: ClipInfo): Mark[] {
  const falls = info.footfalls;
  if (!falls || falls.left.length === 0 || falls.right.length === 0) return [];
  const once = [
    ...falls.left.map((time) => ({ time, phase: 0 })),
    ...falls.right.map((time) => ({ time, phase: 0.5 })),
  ];
  const all = info.loops
    ? [-1, 0, 1].flatMap((k) => once.map((m) => ({ ...m, time: m.time + k * info.seconds })))
    : once;
  return all.sort((a, b) => a.time - b.time);
}

/** How much of the stride lies between two landings: half from one foot to the other. */
function span(a: Mark, b: Mark): number {
  return a.phase === b.phase ? 1 : 0.5;
}

/**
 * Where in the stride a time is, 0 to 1: 0 as the left foot lands, 0.5 as the right does, evenly
 * between. Before a one-off clip's first landing or after its last, the nearest step carries on.
 * A clip without both feet's landings has no stride, and gives null.
 */
export function stridePhase(info: ClipInfo, time: number): number | null {
  const all = marks(info);
  if (all.length < 2) return null;
  const t = info.loops ? mod(time, info.seconds) : time;
  let k = all.findIndex((m) => m.time > t) - 1;
  if (k < 0) k = t < (all[0]?.time ?? 0) ? 0 : all.length - 2;
  const a = all[k] as Mark;
  const b = all[k + 1] as Mark;
  return mod(a.phase + ((t - a.time) / (b.time - a.time)) * span(a, b), 1);
}

/**
 * The first time in a clip at a point in its stride (the inverse of `stridePhase`), or null if it
 * has no stride.
 */
export function timeAtPhase(info: ClipInfo, phase: number): number | null {
  const all = marks(info);
  const p = mod(phase, 1);
  for (let k = 0; k + 1 < all.length; k++) {
    const a = all[k] as Mark;
    const b = all[k + 1] as Mark;
    if (info.loops && (a.time < 0 || a.time >= info.seconds)) continue;
    const into = mod(p - a.phase, 1);
    if (into < span(a, b)) {
      const t = a.time + (into / span(a, b)) * (b.time - a.time);
      return info.loops ? mod(t, info.seconds) : t;
    }
  }
  return null;
}

/** Where to start `to` so its feet carry on from where `from`'s are at `fromTime`. */
export function matchedStart(from: ClipInfo, fromTime: number, to: ClipInfo): number {
  const phase = stridePhase(from, fromTime);
  if (phase === null) return 0;
  return timeAtPhase(to, phase) ?? 0;
}

/**
 * How fast each of two strides should play while they blend, so they stay in step: both move
 * through the stride at one rate, which slides from the old clip's to the new one's.
 */
export function syncedTimeScales(
  fromSeconds: number,
  toSeconds: number,
  newWeight: number,
): { from: number; to: number } {
  const w = clamp(newWeight, 0, 1);
  const cyclesPerSecond = (1 - w) / fromSeconds + w / toSeconds;
  return { from: cyclesPerSecond * fromSeconds, to: cyclesPerSecond * toSeconds };
}

/** A clip's tracks split by the bones they move: those in `bones`, and the rest. */
export function splitTracks(
  clip: THREE.AnimationClip,
  bones: ReadonlySet<string>,
): { inside: THREE.AnimationClip; outside: THREE.AnimationClip } {
  const inside: THREE.KeyframeTrack[] = [];
  const outside: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    const bone = track.name.slice(0, track.name.lastIndexOf("."));
    (bones.has(bone) ? inside : outside).push(track);
  }
  return {
    inside: new THREE.AnimationClip(`${clip.name}:upper`, clip.duration, inside),
    outside: new THREE.AnimationClip(`${clip.name}:lower`, clip.duration, outside),
  };
}

/** The names of a bone and every bone under it. */
export function namesUnder(root: THREE.Object3D, name: string): Set<string> {
  const names = new Set<string>();
  root.getObjectByName(name)?.traverse((o) => {
    names.add(o.name);
  });
  return names;
}

/**
 * The hip's travel along the ground, taken out of its keys. `values` are the hip's positions (x, y,
 * z per key) in its parent's space, and `up` is which way is up there. A loop keeps its sway: only
 * its steady travel is taken out (the line from its first key to its last), so the hip still
 * rolls side to side and surges a little on each step. A clip that doesn't loop has all its
 * travel taken out, and the hip stays over the spot the game moves him to.
 *
 * Returns the hip's new keys, and the travel left over for the game: where the clip would have
 * the character at each key, measured from where it starts.
 */
export function extractTravel(
  times: ArrayLike<number>,
  values: ArrayLike<number>,
  up: THREE.Vector3,
  loops: boolean,
): { values: Float32Array; travel: Float32Array } {
  const n = times.length;
  const out = new Float32Array(values.length);
  const travel = new Float32Array(values.length);
  const first = new THREE.Vector3(values[0], values[1], values[2]);
  const last = new THREE.Vector3(values[3 * n - 3], values[3 * n - 2], values[3 * n - 1]);
  const steady = last.sub(first).projectOnPlane(up);
  const start = times[0] ?? 0;
  const length = (times[n - 1] ?? 0) - start;
  const p = new THREE.Vector3();
  const off = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    p.set(values[3 * k] ?? 0, values[3 * k + 1] ?? 0, values[3 * k + 2] ?? 0);
    if (loops) {
      const u = length > 0 ? ((times[k] ?? 0) - start) / length : 0;
      off.copy(steady).multiplyScalar(u);
    } else {
      off.copy(p).sub(first).projectOnPlane(up);
    }
    p.sub(off);
    p.toArray(out, 3 * k);
    off.toArray(travel, 3 * k);
  }
  return { values: out, travel };
}

/** Where along a travel curve (keys as `extractTravel` gives) the clip has him at a time. */
export function travelAt(
  times: ArrayLike<number>,
  travel: ArrayLike<number>,
  time: number,
  into: THREE.Vector3,
): THREE.Vector3 {
  const n = times.length;
  if (n === 0) return into.set(0, 0, 0);
  if (time <= (times[0] ?? 0)) return into.set(travel[0] ?? 0, travel[1] ?? 0, travel[2] ?? 0);
  for (let k = 1; k < n; k++) {
    const t1 = times[k] ?? 0;
    if (time <= t1) {
      const t0 = times[k - 1] ?? 0;
      const u = t1 > t0 ? (time - t0) / (t1 - t0) : 1;
      return into.set(
        lerp(travel[3 * k - 3] ?? 0, travel[3 * k] ?? 0, u),
        lerp(travel[3 * k - 2] ?? 0, travel[3 * k + 1] ?? 0, u),
        lerp(travel[3 * k - 1] ?? 0, travel[3 * k + 2] ?? 0, u),
      );
    }
  }
  return into.set(travel[3 * n - 3] ?? 0, travel[3 * n - 2] ?? 0, travel[3 * n - 1] ?? 0);
}

/**
 * How far a clip's travel carries him between two of its times, in the hip's parent's space. A
 * loop that went round its end in between adds a whole cycle's travel for each time round.
 */
export function travelBetween(
  times: ArrayLike<number>,
  travel: ArrayLike<number>,
  before: number,
  after: number,
  wraps: number,
  into: THREE.Vector3,
): THREE.Vector3 {
  const a = travelAt(times, travel, before, new THREE.Vector3());
  travelAt(times, travel, after, into).sub(a);
  if (wraps !== 0) {
    const n = times.length;
    const whole = new THREE.Vector3(
      (travel[3 * n - 3] ?? 0) - (travel[0] ?? 0),
      (travel[3 * n - 2] ?? 0) - (travel[1] ?? 0),
      (travel[3 * n - 1] ?? 0) - (travel[2] ?? 0),
    );
    into.addScaledVector(whole, wraps);
  }
  return into;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function mod(x: number, m: number): number {
  return ((x % m) + m) % m;
}

// -- Loading. -------------------------------------------------------------------------------

interface LoadedClip {
  info: ClipInfo;
  clip: THREE.AnimationClip;
}

/** The clips, loaded once and shared by every character that plays them. */
export class ClipLibrary {
  private constructor(
    readonly manifest: ClipManifest,
    private readonly clips: Map<string, LoadedClip>,
  ) {}

  /** Loads the listing and the clips in it (all of them, or just those named). */
  static async load(base = "/models/anims/", names?: readonly string[]): Promise<ClipLibrary> {
    const response = await fetch(`${base}clips.json`);
    if (!response.ok) throw new Error(`No clip listing at ${base}clips.json`);
    const manifest = (await response.json()) as ClipManifest;
    const wanted = manifest.clips.filter((c) => !names || names.includes(c.name));
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const loaded = await Promise.all(
      wanted.map(async (info) => {
        const gltf = await loader.loadAsync(`${base}${info.file}`);
        const clip = gltf.animations[0];
        if (!clip) throw new Error(`${info.file} has no animation`);
        clip.name = info.name;
        return [info.name, { info, clip }] as const;
      }),
    );
    return new ClipLibrary(manifest, new Map(loaded));
  }

  get names(): string[] {
    return [...this.clips.keys()];
  }

  info(name: string): ClipInfo {
    return this.get(name).info;
  }

  clip(name: string): THREE.AnimationClip {
    return this.get(name).clip;
  }

  private get(name: string): LoadedClip {
    const found = this.clips.get(name);
    if (!found) throw new Error(`No clip called ${name}`);
    return found;
  }
}

// -- Playing. -------------------------------------------------------------------------------

/** A clip made ready for one model: split in halves, and its travel taken out if asked. */
interface Prepared {
  info: ClipInfo;
  upper: THREE.AnimationClip;
  lower: THREE.AnimationClip;
  /** The travel taken out of the hip, keyed like the hip's track; null if left in. */
  travel: { times: Float32Array; values: Float32Array } | null;
}

/** One clip playing on a layer, fading in or out. */
interface Playing {
  prepared: Prepared;
  upper: THREE.AnimationAction;
  lower: THREE.AnimationAction | null;
  weight: number;
  fadeFrom: number;
  fadeTo: number;
  fadeTime: number;
  fadeSeconds: number;
  ease: Ease;
  /** A gait change in progress: keep this in step with the other clip until the blend is done. */
  syncWith: Playing | null;
  /** For a whole-body clip that doesn't loop: what to go on to as it ends. */
  next: string | null;
  /** For a one-off gesture: how long its arms take to settle back as it ends. */
  settle: number | null;
}

export interface PlayOptions {
  /** Override the blend's length, seconds. */
  fade?: number;
  /** Take the hip's travel out (by default, for clips that travel) so the game moves him. */
  rootMotion?: boolean;
  /** Where to start, seconds (by default the start, or the matching footfall in a gait change). */
  at?: number;
  /** For a clip that doesn't loop: what to go on to as it ends (by default, it holds its end). */
  next?: string;
  /** Playback speed. */
  speed?: number;
}

export interface Motion {
  /** How far the clips carried him this update, in the model's parent's space: add it to the
   * model's position (or feed it to the game's own movement). */
  move: THREE.Vector3;
  /** Which clip leads, and the blend it came in with. */
  clip: string;
  transition: Transition;
}

/** Plays clips on one model. Call `update` every frame. */
export class ClipPlayer {
  readonly mixer: THREE.AnimationMixer;
  private readonly prepared = new Map<string, Prepared>();
  private readonly upperBones: Set<string>;
  private base: Playing[] = [];
  private gestures: Playing[] = [];
  private lastTransition: Transition = {
    seconds: 0,
    ease: "linear",
    syncFeet: false,
    reason: "first",
  };
  /** Turns the hip's parent's space into the model's. */
  private readonly hipParentToModel = new THREE.Quaternion();
  private readonly up = new THREE.Vector3();
  private readonly motion: Motion;

  constructor(
    readonly model: THREE.Object3D,
    readonly library: ClipLibrary,
  ) {
    this.mixer = new THREE.AnimationMixer(model);
    this.upperBones = namesUnder(model, UPPER_BODY_ROOT);
    const hip = model.getObjectByName(HIP);
    if (!hip?.parent) throw new Error("The model has no Character Creator hip");
    // The hip's parent (the skeleton's root) is turned from the model: AccuRig's skeletons are z-up.
    model.updateWorldMatrix(true, true);
    const parentTurn = hip.parent.getWorldQuaternion(new THREE.Quaternion());
    const modelTurn = model.getWorldQuaternion(new THREE.Quaternion());
    this.hipParentToModel.copy(modelTurn.invert().multiply(parentTurn));
    this.up.set(0, 1, 0).applyQuaternion(this.hipParentToModel.clone().invert());
    this.motion = { move: new THREE.Vector3(), clip: "", transition: this.lastTransition };
  }

  /** The clip leading the body now. */
  get current(): string | null {
    return this.base.at(-1)?.prepared.info.name ?? null;
  }

  /** How far into the leading clip it is, seconds. */
  get time(): number {
    return this.base.at(-1)?.upper.time ?? 0;
  }

  /** Switches the whole body to a clip, blending as suits the change. */
  play(name: string, options: PlayOptions = {}): Transition {
    const info = this.library.info(name);
    const leading = this.base.at(-1) ?? null;
    const plan = transitionFor(leading?.prepared.info ?? null, info);
    if (plan.reason === "same" && options.at === undefined) return plan;
    const seconds = options.fade ?? plan.seconds;
    const rootMotion = options.rootMotion ?? info.rootMotion;
    const prepared = this.prepare(name, rootMotion);
    let start = options.at ?? 0;
    if (options.at === undefined && plan.syncFeet && leading) {
      start = matchedStart(leading.prepared.info, leading.upper.time, info);
    }
    // A clip still fading out from before is picked up where it is rather than started twice.
    const old = this.base.findIndex((p) => p.prepared === prepared);
    const playing =
      old >= 0 ? (this.base.splice(old, 1)[0] as Playing) : this.start(prepared, true, start);
    if (old >= 0) setTime(playing, start);
    playing.next = options.next ?? null;
    const speed = options.speed ?? 1;
    playing.upper.timeScale = speed;
    if (playing.lower) playing.lower.timeScale = speed;
    fade(playing, 1, seconds, plan.ease);
    for (const p of this.base) fade(p, 0, seconds, plan.ease);
    // Two loops keep pace while they blend; a one-off picked up mid-stride just starts in step.
    playing.syncWith = plan.syncFeet && leading && info.loops ? leading : null;
    this.base.push(playing);
    this.lastTransition = { ...plan, seconds };
    return this.lastTransition;
  }

  /**
   * Plays a clip on the upper body only, over whatever the legs are doing, then lets the arms
   * settle back. A clip that loops plays until `stopGesture`.
   */
  gesture(name: string, options: { fade?: number; settle?: number; speed?: number } = {}): void {
    const info = this.library.info(name);
    const prepared = this.prepare(name, false);
    for (const g of this.gestures) fade(g, 0, options.fade ?? 0.25, "smooth");
    const playing = this.start(prepared, false, 0);
    playing.upper.timeScale = options.speed ?? 1;
    fade(playing, 1, options.fade ?? 0.25, "smooth");
    // When a one-off gesture nears its end, it hands back to the body below over a settle.
    playing.settle = info.loops ? null : (options.settle ?? 0.5);
    this.gestures.push(playing);
  }

  /** Lets a gesture go, its arms settling back over `seconds`. */
  stopGesture(seconds = 0.5): void {
    for (const g of this.gestures) fade(g, 0, seconds, "smooth");
  }

  /** Moves everything on by `dt` seconds. Returns how far the clips carried him. */
  update(dt: number): Motion {
    this.advanceFades(dt);
    this.followOn();
    const before = this.base.map((p) => p.lower?.time ?? p.upper.time);
    this.mixer.update(dt);
    const move = this.motion.move.set(0, 0, 0);
    const step = new THREE.Vector3();
    this.base.forEach((p, k) => {
      const travel = p.prepared.travel;
      const action = p.lower ?? p.upper;
      if (!travel || p.weight <= 0) return;
      const was = before[k] ?? 0;
      const now = action.time;
      // A loop that went round its end: its time came back past the start.
      const expected = was + dt * action.timeScale;
      const wraps = p.prepared.info.loops
        ? Math.round((expected - now) / action.getClip().duration)
        : 0;
      travelBetween(travel.times, travel.values, was, now, wraps, step);
      move.addScaledVector(step, p.weight);
    });
    // Each clip's travel counts by its weight; one standing still (no travel) slows the blend.
    const weight = this.base.reduce((sum, p) => sum + p.weight, 0);
    if (weight > 0) move.multiplyScalar(1 / weight);
    move.applyQuaternion(this.hipParentToModel);
    move.multiply(this.model.scale).applyQuaternion(this.model.quaternion);
    const leading = this.base.at(-1);
    this.motion.clip = leading?.prepared.info.name ?? "";
    this.motion.transition = this.lastTransition;
    return this.motion;
  }

  /** Stops everything and forgets the clips made ready for this model. */
  dispose(): void {
    this.mixer.stopAllAction();
    for (const p of this.prepared.values()) {
      this.mixer.uncacheClip(p.upper);
      this.mixer.uncacheClip(p.lower);
    }
    this.prepared.clear();
    this.base = [];
    this.gestures = [];
  }

  private prepare(name: string, rootMotion: boolean): Prepared {
    const key = `${name}:${rootMotion ? "in place" : "as made"}`;
    const ready = this.prepared.get(key);
    if (ready) return ready;
    const info = this.library.info(name);
    let clip = this.library.clip(name);
    let travel: Prepared["travel"] = null;
    if (rootMotion) {
      clip = clip.clone();
      const track = clip.tracks.find((t) => t.name === `${HIP}.position`);
      if (track) {
        const taken = extractTravel(track.times, track.values, this.up, info.loops);
        track.values = taken.values;
        travel = { times: Float32Array.from(track.times), values: taken.travel };
      }
    }
    const { inside, outside } = splitTracks(clip, this.upperBones);
    const prepared = { info, upper: inside, lower: outside, travel };
    this.prepared.set(key, prepared);
    return prepared;
  }

  private start(prepared: Prepared, wholeBody: boolean, at: number): Playing {
    const make = (clip: THREE.AnimationClip) => {
      const action = this.mixer.clipAction(clip);
      action.reset();
      action.setLoop(prepared.info.loops ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = true;
      action.setEffectiveWeight(0);
      action.time = at;
      action.play();
      return action;
    };
    const playing: Playing = {
      prepared,
      upper: make(prepared.upper),
      lower: wholeBody ? make(prepared.lower) : null,
      weight: 0,
      fadeFrom: 0,
      fadeTo: 0,
      fadeTime: 0,
      fadeSeconds: 0,
      ease: "linear",
      syncWith: null,
      next: null,
      settle: null,
    };
    return playing;
  }

  private advanceFades(dt: number): void {
    for (const p of [...this.base, ...this.gestures]) {
      p.fadeTime += dt;
      const u = p.fadeSeconds > 0 ? p.fadeTime / p.fadeSeconds : 1;
      p.weight = p.fadeFrom + (p.fadeTo - p.fadeFrom) * eased(p.ease, u);
    }
    // A gait change keeps both strides at one pace until it's done.
    for (const p of this.base) {
      const other = p.syncWith;
      if (!other) continue;
      if (p.weight >= 1 || !this.base.includes(other)) {
        p.syncWith = null;
        setScale(p, 1);
        continue;
      }
      const scales = syncedTimeScales(
        other.prepared.info.seconds,
        p.prepared.info.seconds,
        p.weight,
      );
      setScale(other, scales.from);
      setScale(p, scales.to);
    }
    const done = (p: Playing) => p.fadeTo === 0 && p.weight <= 0;
    for (const p of [...this.base, ...this.gestures].filter(done)) {
      p.upper.stop();
      p.lower?.stop();
    }
    this.base = this.base.filter((p) => !done(p));
    this.gestures = this.gestures.filter((p) => !done(p));
    const gestureWeight = Math.min(
      1,
      this.gestures.reduce((sum, g) => sum + g.weight, 0),
    );
    for (const p of this.base) {
      p.lower?.setEffectiveWeight(p.weight);
      p.upper.setEffectiveWeight(p.weight * (1 - gestureWeight));
    }
    for (const g of this.gestures) g.upper.setEffectiveWeight(g.weight);
  }

  /** One-off clips nearing their end hand over to what follows. */
  private followOn(): void {
    const leading = this.base.at(-1);
    if (leading?.next && leading.fadeTo === 1) {
      const next = leading.next;
      const left =
        (leading.prepared.info.seconds - leading.upper.time) / (leading.upper.timeScale || 1);
      const plan = transitionFor(leading.prepared.info, this.library.info(next));
      if (left <= plan.seconds) {
        leading.next = null;
        this.play(next);
      }
    }
    for (const g of this.gestures) {
      if (g.settle === null || g.fadeTo !== 1) continue;
      const left = (g.prepared.info.seconds - g.upper.time) / (g.upper.timeScale || 1);
      if (left <= g.settle) {
        fade(g, 0, g.settle, "smooth");
        g.settle = null;
      }
    }
  }
}

function fade(p: Playing, to: number, seconds: number, ease: Ease): void {
  p.fadeFrom = p.weight;
  p.fadeTo = to;
  p.fadeTime = 0;
  p.fadeSeconds = seconds;
  p.ease = ease;
  if (seconds <= 0) p.weight = to;
}

function setTime(p: Playing, time: number): void {
  p.upper.time = time;
  if (p.lower) p.lower.time = time;
}

function setScale(p: Playing, scale: number): void {
  p.upper.timeScale = scale;
  if (p.lower) p.lower.timeScale = scale;
}
