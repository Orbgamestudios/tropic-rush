// How the heroes move, worked out fresh each frame from what they're doing rather than played back
// from clips: a stride whose legs turn towards the way they're going while the chest stays on the
// aim, the weapon moving between poses, and the arms following it by inverse kinematics. It drives
// the block figures and the skinned models alike. Everything here is looks; the rules never hear
// about it.

import * as THREE from "three";
import type { Mood } from "../logic/story/script";
import { angleDiff, clamp, lerp } from "../logic/vec";
import type { HeroArm, HeroRig } from "./heroModels";

export interface HeroMove {
  moving: boolean;
  /** Meters per second. */
  speed: number;
  /** The way he's travelling, relative to the way he faces (radians). */
  heading: number;
  aiming: boolean;
  /** Share of the reload still to go: 1 just after a burst, 0 when ready. */
  reload: number;
  cheering: boolean;
  /** How fast they're turning, in radians a second, so they can lean into it. */
  turn?: number;
  /** Waving with the free hand, up beside the head. */
  waving?: boolean;
  /** Acting in a cutscene: what they carry hangs at their side and the body does the talking. */
  act?: Acting;
}

/** What an actor's doing in a cutscene, beyond standing there. */
export interface Acting {
  /** Speaking just now. */
  talking: boolean;
  /** How the line's said, which is how they hold themselves while they say it. */
  mood: Mood | null;
  /** Where they're looking, as an angle round from the way they face, and up from level. */
  lookYaw: number;
  lookPitch: number;
  /** How wide the mouth is just now, 0 shut to 1: whoever's staging them works it out from the line. */
  mouth?: number;
  /** How they're down, if they're not on their feet. */
  posture?: Posture;
  /** Something done with a hand or the head, for as long as it's set. */
  gesture?: Gesture | null;
}

/** On one knee, on both with hands together, or sat on the ground. */
export type Posture = "stand" | "kneel" | "pray" | "sit";
export type Gesture = "point" | "nod" | "shake" | "salute";

/**
 * How the legs fold for each way of being down: each leg's hip, knee and ankle, right then left, and
 * how far the hips come down, as shares of the thigh and of the shin.
 */
const POSTURES: Record<
  Exclude<Posture, "stand">,
  { hip: [number, number]; knee: [number, number]; foot: [number, number]; drop: [number, number] }
> = {
  // The right foot planted in front, the left knee on the ground under the hips.
  kneel: { hip: [1.42, 0.02], knee: [-1.46, -1.55], foot: [0.04, -0.85], drop: [0.97, 0] },
  // Both knees down, sat back a little on the heels.
  pray: { hip: [0.3, 0.3], knee: [-1.95, -1.95], foot: [-0.85, -0.85], drop: [0.06, 0.94] },
  // On the ground with the legs out in front, one knee up a little.
  sit: { hip: [1.38, 1.5], knee: [-0.55, -0.12], foot: [0.3, 0.2], drop: [0.9, 0.86] },
};

/** How a mood sits in the body: all in radians but `energy`, which scales the hands. */
interface Bearing {
  /** The chest tipped forward (or, negative, back). */
  lean: number;
  /** The head dropped (or, negative, lifted). */
  bow: number;
  /** How big the hands' part in it is. */
  energy: number;
  /** A shake through the shoulders: laughter, or fright. */
  shake: number;
}

const PLAIN_BEARING: Bearing = { lean: 0, bow: 0, energy: 0.6, shake: 0 };
const BEARINGS: Record<Mood, Bearing> = {
  happy: { lean: -0.03, bow: -0.07, energy: 0.9, shake: 0 },
  laugh: { lean: -0.06, bow: -0.14, energy: 0.7, shake: 1 },
  sad: { lean: 0.11, bow: 0.3, energy: 0.2, shake: 0 },
  angry: { lean: 0.13, bow: 0.07, energy: 1.25, shake: 0 },
  scared: { lean: -0.11, bow: 0.04, energy: 0.5, shake: 0.6 },
  surprised: { lean: -0.09, bow: -0.1, energy: 0.35, shake: 0 },
  shout: { lean: 0.15, bow: -0.14, energy: 1.35, shake: 0 },
  whisper: { lean: 0.11, bow: 0.1, energy: 0.18, shake: 0 },
  radio: PLAIN_BEARING,
};

export const AT_EASE: HeroMove = {
  moving: false,
  speed: 0,
  heading: 0,
  aiming: false,
  reload: 0,
  cheering: false,
};

/** Where a weapon sits on the body: position, then rotation. */
type WeaponPose = readonly [number, number, number, number, number, number];

/** How a hand takes hold of something, in the held thing's own axes. */
export interface Grip {
  /** The point the palm closes on. */
  at: THREE.Vector3;
  /** The way the hand reaches it, from wrist to knuckles. */
  along: THREE.Vector3;
  /** The way the palm faces. */
  palm: THREE.Vector3;
}

const grip = (at: readonly number[], along: readonly number[], palm: readonly number[]): Grip => ({
  at: new THREE.Vector3(at[0], at[1], at[2]),
  along: new THREE.Vector3(along[0], along[1], along[2]).normalize(),
  palm: new THREE.Vector3(palm[0], palm[1], palm[2]).normalize(),
});

// Grips put the palm on the surface of what's held, so the fingers close round the outside.
/** A pistol grip, in the right hand: thumb up, palm against its side. */
const PISTOL_GRIP = (at: readonly number[]) => grip(at, [0.8, 0.45, -0.4], [0, -0.1, -1]);
/** A front grip, the same in the left hand from the other side. */
const FRONT_GRIP = (at: readonly number[]) => grip(at, [0.8, 0.45, 0.4], [0, -0.1, 1]);
/** A hand under a barrel, reaching across from the left: palm up, thumb forward. */
const UNDERHAND = (at: readonly number[]) => grip(at, [0.3, 0.15, 0.94], [0, 1, 0]);

/** How a hero carries what they carry. */
export interface HeroPoses {
  low: WeaponPose;
  running: WeaponPose;
  aimed: WeaponPose;
  /** Reloading, for a weapon that needs working by hand. */
  working: WeaponPose;
  cheering: WeaponPose;
  /** How each hand holds it. Null leaves the left hand free, swinging at the hero's side. */
  rightHand: Grip;
  leftHand: Grip | null;
  bolt: THREE.Vector3;
  /** Overhead, for a hero who throws it rather than fires it. */
  thrown: WeaponPose | null;
  /** Hanging from one hand at their side, while they've no use for it. Low will do if not given. */
  slung?: WeaponPose;
  /** Nothing's held at all: the right hand is as free to talk as the left. */
  empty?: boolean;
}

const NO_BOLT = new THREE.Vector3();

export const RIFLE_POSES: HeroPoses = {
  low: [0.42, 1.02, 0.2, 0.15, 0.8, -0.2],
  running: [0.38, 1.18, 0.22, 0.35, 0.85, 0.42],
  aimed: [0.3, 1.29, 0.2, 0, 0.1, 0],
  working: [0.3, 1.12, 0.16, 0.3, 0.2, 0.45],
  cheering: [0.04, 1.98, 0.78, 0.5, 0.1, 1.25],
  rightHand: PISTOL_GRIP([0.09, -0.13, 0.045]),
  leftHand: UNDERHAND([0.5, -0.075, -0.03]),
  bolt: new THREE.Vector3(-0.02, 0.12, 0.08),
  thrown: null,
  slung: [0.1, 0.88, 0.36, 0.1, 0.12, -1.2],
};

/** The Captain's pistols, one in each hand, held out together. */
export const PISTOL_POSES: HeroPoses = {
  low: [0.34, 1.0, 0, 0.15, 0.55, -0.25],
  running: [0.3, 1.12, 0, 0.3, 0.6, 0.35],
  aimed: [0.4, 1.3, 0, 0, 0, 0],
  working: [0.3, 1.14, 0, 0.3, 0.2, 0.45],
  cheering: [0.04, 1.98, 0.6, 0.5, 0.1, 1.25],
  rightHand: PISTOL_GRIP([0, -0.07, 0.17]),
  leftHand: FRONT_GRIP([0, -0.07, -0.17]),
  bolt: NO_BOLT,
  thrown: null,
  slung: [0.1, 0.9, 0.3, 0.1, 0.12, -1.2],
};

export const MINIGUN_POSES: HeroPoses = {
  low: [0.44, 0.92, 0.04, 0, 0, -0.14],
  running: [0.38, 1.0, 0.1, 0, 0.14, 0.14],
  aimed: [0.5, 0.98, 0.02, 0, 0, 0.03],
  working: [0.5, 0.98, 0.02, 0, 0, 0.03],
  cheering: [0.16, 2.0, 0.72, 0.35, 0, 1.15],
  rightHand: PISTOL_GRIP([-0.21, -0.22, 0.05]),
  leftHand: grip([-0.03, 0.29, 0], [0.25, 0.1, 0.96], [0, -1, 0]),
  bolt: NO_BOLT,
  thrown: null,
  slung: [0.22, 0.84, 0.36, 0, 0.1, -0.85],
};

export const BOTTLE_POSES: HeroPoses = {
  low: [0.26, 1.0, 0.42, 0, 0, 0],
  running: [0.3, 1.14, 0.28, 0, 0, 0.15],
  aimed: [0.4, 1.2, 0.3, 0, 0, 0.1],
  working: [0.4, 1.2, 0.3, 0, 0, 0.1],
  cheering: [0.1, 1.95, 0.78, 0.2, 0, -0.1],
  rightHand: grip([0, -0.03, 0.1], [1, 0.15, 0], [0, 0, -1]),
  leftHand: null,
  bolt: NO_BOLT,
  thrown: [-0.12, 1.86, 0.26, 0, 0, 0.5],
};

export const TUBE_POSES: HeroPoses = {
  low: [0.04, 1.5, 0.3, 0, 0, 0],
  running: [0.02, 1.48, 0.3, 0, 0, 0.12],
  aimed: [0.1, 1.53, 0.3, 0, 0, 0.03],
  working: [0.02, 1.47, 0.3, 0, 0, -0.1],
  cheering: [0.06, 1.76, 0.72, 0.3, 0, 0.95],
  rightHand: PISTOL_GRIP([0.03, -0.2, 0.04]),
  leftHand: FRONT_GRIP([0.4, -0.2, -0.04]),
  bolt: NO_BOLT,
  thrown: null,
};

export const GRENADE_POSES: HeroPoses = {
  low: [0.26, 0.98, 0.44, 0, 0, 0],
  running: [0.3, 1.14, 0.24, 0, 0, 0],
  aimed: [0.2, 1.46, 0.3, 0, 0, 0],
  working: [0.2, 1.46, 0.3, 0, 0, 0],
  cheering: [0.1, 1.98, 0.8, 0, 0, 0],
  rightHand: grip([0, -0.12, 0], [0.8, 0.15, -0.55], [0, 1, 0]),
  leftHand: null,
  bolt: NO_BOLT,
  thrown: [-0.14, 1.9, 0.26, 0, 0, 0.8],
};

export const WRENCH_POSES: HeroPoses = {
  low: [0.26, 0.96, 0.44, 0, 0, 1.15],
  running: [0.28, 1.14, 0.3, 0, 0, 1.3],
  aimed: [0.44, 1.2, 0.3, 0, 0, 0.75],
  working: [0.44, 1.2, 0.3, 0, 0, 0.75],
  cheering: [0.1, 1.95, 0.78, 0.25, 0, 1.3],
  rightHand: grip([-0.1, 0, 0.035], [0, -1, -0.15], [0, 0, -1]),
  leftHand: null,
  bolt: NO_BOLT,
  thrown: null,
};

/** Nothing in their hands: the story's people, who walk about and talk. */
export const EMPTY_POSES: HeroPoses = {
  low: [0.04, 0.74, 0.4, 0, 0, 0],
  running: [0.1, 0.9, 0.38, 0, 0, 0],
  aimed: [0.6, 1.3, 0.3, 0, 0, 0],
  working: [0.04, 0.74, 0.4, 0, 0, 0],
  cheering: [0.1, 1.98, 0.8, 0, 0, 0],
  rightHand: grip([0, 0, 0], [0.1, -1, 0], [0, 0, -1]),
  leftHand: null,
  bolt: NO_BOLT,
  thrown: null,
  empty: true,
};

const FIST_UP = new THREE.Vector3(0.1, 1.95, -0.8);
/** The way a free left palm faces: in towards the leg. */
const PALM_IN = new THREE.Vector3(0, 0, 1);
/** How high the poses expect a hero's shoulders to be. */
export const POSED_SHOULDER = 1.38;
/** How far the fingers curl, holding something and with nothing to hold. */
const GRIP = 1.5;
const RELAXED = 0.55;
/** How far along an arm's length a free hand hangs below the shoulder, at rest and running. */
const LOOSE_DROP = 0.97;
const RUNNING_DROP = 0.6;
/** How far a free arm swings on the run, as a share of its length. */
const ARM_SWING = 0.5;
/** How a lean settles: quick, and a little past where it's going before it comes back. */
const LEAN_SPRING = 90;
const LEAN_DAMPING = 11;

/** The share of a stride a foot is on the ground, at a walk and at a full run. */
const PLANTED_WALKING = 0.62;
const PLANTED_RUNNING = 0.33;
/** How far either way a leg swings from the hip, at a slow walk and at a full run. */
const SWING_WALKING = 0.32;
const SWING_RUNNING = 0.78;
/** Legs can only go so fast, however quick the hero's going. */
const MOST_STRIDE_RATE = 24;

// What a body allows, in radians. The poses ask for whatever they like; the joints give this much.
/** An elbow folds until the forearm meets the upper arm. */
const MOST_ELBOW = 2.6;
/** A forearm rolls about a quarter turn either way from palms-down. */
const MOST_FOREARM_ROLL = 1.75;
/** A wrist bends, and doesn't roll at all. */
const MOST_WRIST = 1.15;
/** An ankle: toes up towards the shin, and pointed away from it. */
const ANKLE_UP = 0.4;
const ANKLE_DOWN = -0.87;
/** The hips turn this far against the chest; past it the legs step sideways instead. */
const MOST_HIPS = 0.45;
/** How much of a sideways stride the legs take, since they can't cross far. */
const SIDESTEP = 0.6;
/** A runner's thigh comes further forward than it goes back. */
const KNEE_LIFT = 0.12;

/** Which way each elbow points. */
const RIGHT_ELBOW = new THREE.Vector3(-0.4, -0.8, 0.5);
const LEFT_ELBOW = new THREE.Vector3(0.1, -0.8, -0.6);
/** On the run a free arm pumps with its elbow going back, close to the ribs. */
const RIGHT_ELBOW_RUNNING = new THREE.Vector3(-1, -0.35, 0.14);
const LEFT_ELBOW_RUNNING = new THREE.Vector3(-1, -0.35, -0.14);
/** A throwing arm comes over the top with its elbow out to the side, leading the hand. */
const RIGHT_ELBOW_THROWING = new THREE.Vector3(-0.15, -0.45, 1);

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const hand = new THREE.Vector3();
const fist = new THREE.Vector3();
const pole = new THREE.Vector3();
const elbow = new THREE.Vector3();
const bone = new THREE.Vector3();
const side = new THREE.Vector3();
const wrist = new THREE.Vector3();
const toKnuckles = new THREE.Vector3();
const palmFaces = new THREE.Vector3();
const thumbSide = new THREE.Vector3();
const restSide = new THREE.Vector3();
const restPalm = new THREE.Vector3();
const basis = new THREE.Matrix4();
const upperTurn = new THREE.Quaternion();
const foreTurn = new THREE.Quaternion();
const handTurn = new THREE.Quaternion();
const restTurn = new THREE.Quaternion();
const twist = new THREE.Quaternion();
const undo = new THREE.Quaternion();
const swung = new THREE.Quaternion();
const NO_TURN = new THREE.Quaternion();
const upperDir = new THREE.Vector3();
const foreDir = new THREE.Vector3();
const hinge = new THREE.Vector3();
const carried = new THREE.Vector3();
const crossed = new THREE.Vector3();

/** Spreads a limb's roll along it: each bone down its length turns a share more than the last. */
function rollAlong(bones: readonly THREE.Object3D[], axis: THREE.Vector3, roll: number): void {
  for (let i = 0; i < bones.length; i++) {
    bones[i]?.quaternion.setFromAxisAngle(axis, (roll * (i + 1)) / bones.length);
  }
}

/** The angle from one direction round to another about an axis both are square to. */
function angleAbout(from: THREE.Vector3, to: THREE.Vector3, axis: THREE.Vector3): number {
  return Math.atan2(crossed.crossVectors(from, to).dot(axis), from.dot(to));
}
const hands = {
  right: { along: new THREE.Vector3(), palm: new THREE.Vector3() },
  left: { along: new THREE.Vector3(), palm: new THREE.Vector3() },
};
/** Exponential smoothing that doesn't depend on the frame rate. */
const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

function blend(a: WeaponPose, b: WeaponPose, t: number, out: number[]): void {
  for (let i = 0; i < 6; i++) out[i] = lerp(a[i] ?? 0, b[i] ?? 0, t);
}

/** Where a leg is in a stride. */
const stride = { hip: 0, knee: 0, foot: 0 };

/**
 * One leg through one stride: `at` runs from 0, the foot coming down in front, round to the same
 * again. On the ground it sweeps back evenly so the foot stays put; off it, the heel kicks up and
 * the leg swings through to reach for the next step.
 */
function strideAt(at: number, planted: number, bend: number): void {
  if (at < planted) {
    const t = at / planted;
    stride.hip = 1 - 2 * t;
    stride.knee = 0.16 + Math.sin(Math.PI * t) * 0.3;
    stride.foot = lerp(0.3, -0.85, t * t);
    return;
  }
  const t = (at - planted) / (1 - planted);
  stride.hip = -Math.cos(Math.PI * t);
  stride.knee = 0.16 + Math.sin(Math.PI * t ** 0.7) * bend;
  stride.foot = lerp(-0.85, 0.3, t);
}

/** Two-bone IK: bends the arm from its shoulder so the hand lands on a point, or as near as it reaches. */
function reach(
  arm: HeroArm,
  target: THREE.Vector3,
  pole: THREE.Vector3,
  along: THREE.Vector3 | null,
  palm: THREE.Vector3,
): void {
  const { shoulder, upperLength, foreLength, bones } = arm;
  // The target is where the palm goes, so the wrist stops short of it on the way the hand comes in.
  wrist.copy(target);
  if (along) wrist.addScaledVector(along, -arm.palm);
  bone.copy(wrist).sub(shoulder);
  // No nearer than a folded elbow lets the wrist come to the shoulder.
  const nearest = Math.sqrt(
    upperLength ** 2 + foreLength ** 2 + 2 * upperLength * foreLength * Math.cos(MOST_ELBOW),
  );
  const gap = clamp(
    bone.length() - (along ? 0 : arm.palm),
    nearest,
    upperLength + foreLength - 0.002,
  );
  bone.normalize();
  const a = (upperLength ** 2 - foreLength ** 2 + gap ** 2) / (2 * gap);
  const h = Math.sqrt(Math.max(0, upperLength ** 2 - a ** 2));
  side.copy(pole).addScaledVector(bone, -pole.dot(bone)).normalize();
  elbow.copy(shoulder).addScaledVector(bone, a).addScaledVector(side, h);
  hand.copy(shoulder).addScaledVector(bone, gap);

  if (bones) {
    // An elbow is a hinge. The upper arm swings to point at it, then rolls in the shoulder until
    // the hinge lies square to the way the arm's bent, and the forearm only folds about it.
    hinge.crossVectors(side, bone).normalize();
    upperDir.copy(elbow).sub(shoulder).normalize();
    foreDir.copy(hand).sub(elbow).normalize();
    upperTurn.setFromUnitVectors(bones.upperRest, upperDir);
    carried.copy(bones.hingeRest).applyQuaternion(upperTurn);
    rollAlong(bones.upperTwist, bones.upperRest, angleAbout(carried, hinge, upperDir));
    restSide
      .copy(bones.hingeRest)
      .addScaledVector(bones.foreRest, -bones.hingeRest.dot(bones.foreRest))
      .normalize();
    thumbSide.crossVectors(bones.foreRest, restSide);
    basis.makeBasis(bones.foreRest, restSide, thumbSide);
    restTurn.setFromRotationMatrix(basis).invert();
    thumbSide.crossVectors(foreDir, hinge);
    basis.makeBasis(foreDir, hinge, thumbSide);
    foreTurn.setFromRotationMatrix(basis).multiply(restTurn);
    turnHand(arm, bones, along ?? foreDir, palm);
    return;
  }

  arm.upper.position.copy(shoulder).add(elbow).multiplyScalar(0.5);
  bone.copy(elbow).sub(shoulder).normalize();
  arm.upper.quaternion.setFromUnitVectors(Y_AXIS, bone);
  arm.fore.position.copy(elbow).add(hand).multiplyScalar(0.5);
  bone.copy(hand).sub(elbow).normalize();
  arm.fore.quaternion.setFromUnitVectors(Y_AXIS, bone);
  arm.hand.position.copy(hand);
}

/** Brings what's held nearer, if a hand can't reach its grip from where it is. */
function pullIn(rig: HeroRig, arm: HeroArm, at: THREE.Vector3, along: THREE.Vector3): void {
  wrist.copy(at).applyMatrix4(rig.rifle.matrix).addScaledVector(along, -arm.palm);
  const over = wrist.distanceTo(arm.shoulder) - (arm.upperLength + arm.foreLength - 0.01);
  if (over <= 0) return;
  bone.copy(arm.shoulder).sub(wrist).normalize();
  rig.rifle.position.addScaledVector(bone, over);
  rig.rifle.updateMatrix();
}

/**
 * Lines a hand up: its knuckles the way it's reaching and its palm the way it should face, as far
 * as a real arm lets it. Whatever of that is a roll about the forearm, the forearm does, up to the
 * quarter turn it has either way, spread from nothing at the elbow to all of it at the wrist. The
 * wrist only bends, and only so far. A grip that asks for more is left a little short.
 */
function turnHand(
  arm: HeroArm,
  bones: NonNullable<HeroArm["bones"]>,
  along: THREE.Vector3,
  palm: THREE.Vector3,
): void {
  toKnuckles.copy(along).normalize();
  palmFaces.copy(palm).addScaledVector(toKnuckles, -palm.dot(toKnuckles)).normalize();
  thumbSide.crossVectors(toKnuckles, palmFaces);
  basis.makeBasis(toKnuckles, palmFaces, thumbSide);
  handTurn.setFromRotationMatrix(basis);
  // In the T-pose the models were made in, palms face the ground.
  restPalm.set(0, -1, 0).addScaledVector(bones.handRest, bones.handRest.y).normalize();
  restSide.crossVectors(bones.handRest, restPalm);
  basis.makeBasis(bones.handRest, restPalm, restSide);
  restTurn.setFromRotationMatrix(basis).invert();
  handTurn.multiply(restTurn);
  undo.copy(foreTurn).invert().multiply(handTurn);
  const axis = bones.foreRest;
  const about = undo.x * axis.x + undo.y * axis.y + undo.z * axis.z;
  let roll = 2 * Math.atan2(about, undo.w);
  if (roll > Math.PI) roll -= Math.PI * 2;
  else if (roll < -Math.PI) roll += Math.PI * 2;
  // What's left once the roll's taken out is the bend at the wrist.
  twist.setFromAxisAngle(axis, roll).invert();
  swung.copy(twist).multiply(undo);
  const bend = 2 * Math.acos(Math.min(1, Math.abs(swung.w)));
  if (bend > MOST_WRIST) swung.copy(NO_TURN).slerp(undo.copy(swung), MOST_WRIST / bend);
  twist.setFromAxisAngle(axis, clamp(roll, -MOST_FOREARM_ROLL, MOST_FOREARM_ROLL));
  rollAlong(bones.foreTwist, axis, clamp(roll, -MOST_FOREARM_ROLL, MOST_FOREARM_ROLL));
  arm.upper.quaternion.copy(upperTurn);
  arm.fore.quaternion.copy(upperTurn).invert().multiply(foreTurn);
  arm.hand.quaternion.copy(twist).multiply(swung);
}

/**
 * Closes a hand by `amount` (radians, in all, from the knuckle to the tip). On a hand with every
 * finger rigged, it's shared out along each finger the way a hand closes, the thumb folds across,
 * and `point` straightens the index finger out of the fist. Otherwise the knuckles fold together.
 */
function curl(arm: HeroArm, amount: number, point: number): void {
  const { fingers, digits, side } = arm;
  if (!fingers) return;
  if (!digits) {
    fingers.rotation.x = amount * (1 - point * 0.6) * side;
    return;
  }
  fingers.rotation.x = amount * 0.45 * side;
  for (const digit of ["index", "middle", "ring", "pinky"] as const) {
    const [root, mid, end] = digits[digit];
    // The little finger curls a touch further than the index: a hand closes from that side.
    const more = digit === "pinky" ? 1.12 : digit === "ring" ? 1.06 : 1;
    const straight = digit === "index" ? point : 0;
    const bend = amount * more * (1 - straight);
    if (root) root.rotation.x = (digit === "index" ? -amount * 0.45 * straight : 0) * side;
    if (mid) mid.rotation.x = bend * 0.55 * side;
    if (end) end.rotation.x = bend * 0.42 * side;
  }
  // The thumb folds in over the fingers as they close.
  const [base, mid, tip] = digits.thumb;
  const fold = Math.min(1, amount / GRIP);
  if (base) base.rotation.set(fold * 0.2 * side, fold * 0.35 * side, 0);
  if (mid) mid.rotation.y = fold * 0.4 * side;
  if (tip) tip.rotation.y = fold * 0.35 * side;
}

/** How far brows lift at most, in the model's own units (a person is about 2.25 of them tall). */
const BROW_LIFT = 0.035;

/** How long a blink takes, closing and opening, and how often they come: more when nervous. */
const BLINK_SECONDS = 0.16;
const BLINK_EVERY = [2.2, 5.5] as const;

export class HeroAnimator {
  private phase = Math.random() * 6;
  private time = Math.random() * 20;
  private run = 0;
  private gait = 0;
  private aim = 0;
  private cheer = 0;
  private wave = 0;
  private recoil = 0;
  private flinching = 0;
  private hips = 0;
  private sidle = 0;
  private lean = 0;
  /** How hard they're speeding up (or, negative, pulling up), which the body leans into. */
  private surge = 0;
  private lastSpeed = 0;
  /** How far down into each posture they are. */
  private readonly down = { kneel: 0, pray: 0, sit: 0 };
  private mouthOpen = 0;
  /** Seconds to the next blink, and how far through one they are (0 not blinking, up to 1). */
  private blinkIn = 1 + Math.random() * 3;
  private browRaise = 0;
  private browTilt = 0;
  private eyeWide = 0;
  private eyeNarrow = 0;
  private smile = 0;
  private frown = 0;
  private blinking = 0;
  /** Where the eyes are just now, darting a little on their own between looks. */
  private eyeYaw = 0;
  private eyePitch = 0;
  private dartIn = 0.5;
  private dart = { yaw: 0, pitch: 0 };
  private pointing = 0;
  private saluting = 0;
  private nodding = 0;
  private shaking = 0;
  private leanSpeed = 0;
  private bank = 0;
  private bolt = 0;
  private throwing = 0;
  /** Acting: how far into it they are, how much they're speaking, and the bearing they've taken. */
  private easy = 0;
  private talk = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private readonly bearing: Bearing = { ...PLAIN_BEARING };
  private readonly gesture = new THREE.Vector3();
  private readonly rifle: number[] = [0, 0, 0, 0, 0, 0];
  private readonly mix: number[] = [0, 0, 0, 0, 0, 0];
  private readonly rightHand = new THREE.Vector3();
  private readonly leftHand = new THREE.Vector3();
  /** How long their legs are, which sets how far a stride takes them. */
  private readonly hipHeight: number;

  constructor(private readonly rig: HeroRig) {
    for (const brow of rig.brows ?? []) brow.userData.restY ??= brow.position.y;
    this.hipHeight = Math.max(0.5, rig.legs[0].position.y);
  }

  /**
   * The eyes: they lead every look (the head only follows part of the way, so the eyes make up the
   * rest), they dart about a little between looks, and the lids blink every few seconds, more often
   * when someone's scared or angry, a quick close and a slower open. A sad or whispered line sits
   * with the lids a little lowered.
   */
  private eyesAndLids(dt: number, act: Acting | undefined): void {
    const { rig } = this;
    if (!rig.lids && !rig.eyes && !rig.brows && !rig.face && !rig.paint) return;
    const tense = act?.mood === "scared" || act?.mood === "angry" || act?.mood === "shout";
    this.blinkIn -= dt;
    if (this.blinkIn <= 0 && this.blinking === 0) {
      this.blinking = 0.001;
      const [soon, late] = BLINK_EVERY;
      this.blinkIn = (soon + Math.random() * (late - soon)) * (tense ? 0.45 : 1);
    }
    let closed = 0;
    if (this.blinking > 0) {
      this.blinking += dt / BLINK_SECONDS;
      // Down fast, up slower.
      closed =
        this.blinking < 0.35
          ? this.blinking / 0.35
          : Math.max(0, 1 - (this.blinking - 0.35) / 0.65);
      if (this.blinking >= 1) this.blinking = 0;
    }
    const heavy =
      act?.mood === "sad" || act?.mood === "whisper" ? 0.3 : act?.mood === "surprised" ? -0.15 : 0;
    const shut = Math.max(closed, heavy);
    if (rig.lids) for (const lid of rig.lids) lid.rotation.z = -(rig.blink ?? 1.2) * shut;
    if (rig.lowLids)
      for (const lid of rig.lowLids) lid.rotation.z = (rig.lowBlink ?? 0.35) * closed;
    if (rig.face) {
      const mood = act?.mood ?? null;
      const wide = mood === "surprised" ? 1 : mood === "scared" ? 0.8 : 0;
      const narrow = mood === "angry" ? 0.5 : mood === "happy" || mood === "laugh" ? 0.4 : 0;
      this.eyeWide += (wide - this.eyeWide) * ease(dt, 9);
      this.eyeNarrow += (narrow - this.eyeNarrow) * ease(dt, 9);
      rig.face.both("eyeBlink", Math.max(closed, Math.max(0, heavy)));
      rig.face.both("eyeWide", this.eyeWide * (1 - closed));
      rig.face.both("eyeSquint", this.eyeNarrow * (1 - closed));
    }
    this.browsFor(dt, act);
    if (!rig.eyes && !rig.paint) return;
    this.dartIn -= dt;
    if (this.dartIn <= 0) {
      this.dartIn = 0.4 + Math.random() * 1.6;
      this.dart = { yaw: (Math.random() - 0.5) * 0.16, pitch: (Math.random() - 0.5) * 0.08 };
    }
    // What the head hasn't turned, the eyes do, as far as eyes go.
    const wantYaw = clamp((act?.lookYaw ?? 0) * 0.3 + this.dart.yaw, -0.55, 0.55);
    const wantPitch = clamp((act?.lookPitch ?? 0) * 0.4 + this.dart.pitch, -0.35, 0.35);
    // Eyes jump to where they're going: they don't glide.
    this.eyeYaw += (wantYaw - this.eyeYaw) * ease(dt, 28);
    this.eyePitch += (wantPitch - this.eyePitch) * ease(dt, 28);
    if (rig.eyes) for (const eye of rig.eyes) eye.rotation.set(0, -this.eyeYaw, this.eyePitch);
    rig.paint?.eyes(shut, this.eyeYaw, this.eyePitch, act?.mood ?? null);
  }

  /**
   * The brows say more than anything else on a face: up for surprise and fear, drawn down and in
   * for anger, the inner ends lifted for sadness, and a little lift on the words someone leans on.
   */
  private browsFor(dt: number, act: Acting | undefined): void {
    const { brows, face } = this.rig;
    if (!brows && !face) return;
    const mood = act?.mood ?? null;
    const raise =
      mood === "surprised"
        ? 1
        : mood === "scared"
          ? 0.8
          : mood === "happy" || mood === "laugh"
            ? 0.3
            : mood === "angry"
              ? -0.6
              : mood === "sad"
                ? 0.15
                : 0;
    // Positive tips the inner end up (sad, worried); negative down (angry).
    const tilt =
      mood === "sad" || mood === "scared" ? 1 : mood === "angry" || mood === "shout" ? -1 : 0;
    const speaking = act?.talking ? Math.max(0, Math.sin(this.time * 4.3)) * 0.25 : 0;
    const settle = ease(dt, 9);
    this.browRaise += (raise + speaking - this.browRaise) * settle;
    this.browTilt += (tilt - this.browTilt) * settle;
    brows?.forEach((brow, i) => {
      const side = i === 0 ? 1 : -1;
      brow.position.y = brow.userData.restY + this.browRaise * BROW_LIFT;
      brow.rotation.x = this.browTilt * 0.22 * side;
    });
    if (face) {
      const up = Math.max(0, this.browRaise);
      const down = Math.max(0, -this.browRaise);
      face.set("browInnerUp", clamp(up * 0.6 + Math.max(0, this.browTilt) * 0.8, 0, 1));
      face.both("browOuterUp", clamp(up, 0, 1));
      face.both("browDown", clamp(down + Math.max(0, -this.browTilt) * 0.7, 0, 1));
    }
  }

  /**
   * The mouth of a face that changes shape: the jaw drops with the words, the lips round and
   * spread as it goes so it isn't one flap, and the mood sits at its corners.
   */
  private mouthFor(dt: number, act: Acting | undefined): void {
    const { face } = this.rig;
    if (!face) return;
    const mood = act?.mood ?? null;
    const smile = mood === "happy" ? 0.75 : mood === "laugh" ? 1 : 0;
    const frown = mood === "sad" ? 0.6 : mood === "angry" || mood === "shout" ? 0.45 : 0;
    this.smile += (smile - this.smile) * ease(dt, 6);
    this.frown += (frown - this.frown) * ease(dt, 6);
    const open = this.mouthOpen;
    const loud = mood === "shout" || mood === "laugh" ? 1.25 : mood === "whisper" ? 0.6 : 1;
    face.set("jawOpen", clamp(open * 0.62 * loud, 0, 1));
    face.set("mouthFunnel", open * Math.max(0, Math.sin(this.time * 7.3)) * 0.55);
    face.both("mouthStretch", open * Math.max(0, Math.sin(this.time * 5.1 + 1)) * 0.45);
    face.both("mouthSmile", this.smile * (1 - open * 0.4));
    face.both("cheekSquint", this.smile * 0.5);
    face.both("mouthFrown", this.frown);
  }

  /** A shot left the barrel: the weapon kicks and the shoulder takes it, or the arm comes over. */
  shot(): void {
    this.recoil = 1;
    this.throwing = 1;
  }

  /** Whether they throw what they carry, rather than firing it. */
  get throws(): boolean {
    return Boolean(this.rig.poses.thrown);
  }

  /** He took a hit. */
  flinch(): void {
    this.flinching = 1;
  }

  /** Where the end of the barrel is in the world right now. */
  muzzle(out: THREE.Vector3): THREE.Vector3 {
    return this.rig.muzzle.getWorldPosition(out);
  }

  update(dt: number, move: HeroMove): void {
    const { rig } = this;
    this.time += dt;
    const { time } = this;
    this.recoil *= Math.exp(-dt * 15);
    this.throwing = Math.max(0, this.throwing - dt * 3.2);
    this.flinching = Math.max(0, this.flinching - dt * 5);
    this.run += ((move.moving ? 1 : 0) - this.run) * ease(dt, 10);
    this.aim += ((move.aiming ? 1 : 0) - this.aim) * ease(dt, 14);
    this.cheer += ((move.cheering ? 1 : 0) - this.cheer) * ease(dt, 6);
    this.wave += ((move.waving ? 1 : 0) - this.wave) * ease(dt, 8);
    // Acting comes over them gradually: nobody snaps into a mood, or out of a look.
    const { act } = move;
    const want = (act?.mood && BEARINGS[act.mood]) || PLAIN_BEARING;
    const { bearing } = this;
    const settle = ease(dt, 3.5);
    this.easy += ((act ? 1 : 0) - this.easy) * ease(dt, 5);
    this.talk += ((act?.talking ? 1 : 0) - this.talk) * ease(dt, 7);
    bearing.lean += (want.lean - bearing.lean) * settle;
    bearing.bow += (want.bow - bearing.bow) * settle;
    bearing.energy += (want.energy - bearing.energy) * settle;
    bearing.shake += (want.shake - bearing.shake) * settle;
    // The eyes get there first and the head follows: it's quicker than a mood.
    this.lookYaw += (clamp(act?.lookYaw ?? 0, -1.15, 1.15) - this.lookYaw) * ease(dt, 6);
    this.lookPitch += (clamp(act?.lookPitch ?? 0, -0.5, 0.5) - this.lookPitch) * ease(dt, 6);
    const { easy, talk } = this;
    // A mouth moves fast: quicker than anything else about a face.
    this.mouthOpen += ((act?.mouth ?? 0) - this.mouthOpen) * ease(dt, 30);
    if (rig.jaw) rig.jaw.rotation.z = -this.mouthOpen * 0.36;
    this.mouthFor(dt, act);
    rig.paint?.mouth(this.mouthOpen, act?.mood ?? null);
    if (rig.mouth)
      rig.mouth.scale.set(0.35, 0.02 + this.mouthOpen * 0.95, 1.15 - this.mouthOpen * 0.35);
    this.eyesAndLids(dt, act);
    const posture = act?.posture ?? "stand";
    for (const name of ["kneel", "pray", "sit"] as const) {
      this.down[name] += ((posture === name ? 1 : 0) - this.down[name]) * ease(dt, 3.2);
    }
    const doing = act?.gesture ?? null;
    this.pointing += ((doing === "point" ? 1 : 0) - this.pointing) * ease(dt, 7);
    this.saluting += ((doing === "salute" ? 1 : 0) - this.saluting) * ease(dt, 9);
    this.nodding += ((doing === "nod" ? 1 : 0) - this.nodding) * ease(dt, 8);
    this.shaking += ((doing === "shake" ? 1 : 0) - this.shaking) * ease(dt, 8);
    // Speech has a beat: the head and the hands land on it, a little differently for everyone.
    const beat = Math.sin(time * 6.1) * 0.6 + Math.sin(time * 9.7 + 1.3) * 0.4;
    const phrase = 0.5 + 0.5 * Math.sin(time * 1.9 + this.hipHeight * 40);
    const shake = Math.sin(time * 15) * bearing.shake * easy;
    this.gait += (clamp(move.speed / 5, 0, 1.5) - this.gait) * ease(dt, 8);
    const { run, aim, cheer, gait, recoil, flinching } = this;
    // A runner throws their weight forward to set off and rocks back as they pull up.
    // A runner's nearly upright once they're going: the lean is in the setting off, when the
    // weight's thrown forward, and in the pulling up, when it rocks back.
    const gaining = dt > 0 ? (move.speed - this.lastSpeed) / dt : 0;
    this.lastSpeed = move.speed;
    this.surge += (clamp(gaining * 0.011, -0.16, 0.2) - this.surge) * ease(dt, 9);
    const leanAccel = (run * 0.035 * Math.min(1, gait) + this.surge - this.lean) * LEAN_SPRING;
    this.leanSpeed += (leanAccel - this.leanSpeed * LEAN_DAMPING) * Math.min(dt, 0.03);
    this.lean += this.leanSpeed * Math.min(dt, 0.03);
    const { lean } = this;
    // And into a turn they lean over like a bike.
    this.bank += (clamp((move.turn ?? 0) * 0.09, -0.2, 0.2) * run - this.bank) * ease(dt, 8);

    // Backing away runs the stride in reverse, rather than twisting him right round.
    const backing = Math.abs(move.heading) > Math.PI * 0.6;
    const legsTurn = backing ? angleDiff(move.heading, Math.PI) : move.heading;
    const legSwing = lerp(SWING_WALKING, SWING_RUNNING, gait);
    const planted = lerp(PLANTED_WALKING, PLANTED_RUNNING, Math.min(1, gait));
    // The legs go as fast as it takes for a planted foot to keep up with the ground going by.
    const perStride = (2 * this.hipHeight * Math.sin(Math.min(legSwing, 1.1))) / planted;
    const strideRate = (move.speed / perStride) * Math.PI * 2;
    this.phase +=
      dt *
      (Math.min(strideRate, MOST_STRIDE_RATE) + 2 * (1 - run)) *
      (backing ? -1 : 1) *
      (1 + Math.sin(time * 0.73) * 0.025);
    // The hips turn towards the way they're going as far as a waist twists, and past that the
    // legs step out to the side.
    const hipsTurn = move.moving ? clamp(legsTurn, -MOST_HIPS, MOST_HIPS) : 0;
    this.hips += (hipsTurn - this.hips) * ease(dt, 12);
    this.sidle += ((move.moving ? legsTurn - hipsTurn : 0) - this.sidle) * ease(dt, 12);
    const { sidle } = this;

    const sway = Math.sin(this.phase);
    const swing = Math.cos(this.phase);
    // Their weight goes over whichever foot is down, a moment after it lands.
    const weight = Math.sin(this.phase - planted * Math.PI);
    // The pelvis turns with the leading leg, against the chest, and drops on the swinging side.
    rig.lower.rotation.y = -this.hips + sway * 0.18 * run;
    rig.lower.rotation.x = -weight * 0.07 * run;
    const bend = lerp(0.65, 1.5, Math.min(1, gait));
    const stance = aim * (1 - run);

    // Each leg is half a stride behind the other, with the right one forward as `sway` peaks.
    const along = this.phase / (Math.PI * 2) - 0.25;
    const leg = (i: 0 | 1, sign: number, ready: number, ready2: number) => {
      strideAt(along + i * 0.5 - Math.floor(along + i * 0.5), planted, bend);
      const swing = stride.hip * legSwing * run;
      const hip =
        swing * Math.cos(sidle) +
        KNEE_LIFT * run * Math.min(1, gait) +
        ready * stance +
        0.04 * sign * (1 - run);
      const knee = -stride.knee * run - ready2 * stance;
      // Flat to the ground while it can be: kicked up behind, it hangs from the ankle.
      const ankle = clamp(-(hip + knee) + stride.foot * run, ANKLE_DOWN, ANKLE_UP);
      // Down on a knee, or sat: the legs fold to it, as far down as they've got.
      let folded = 0;
      let hipDown = 0;
      let kneeDown = 0;
      let ankleDown = 0;
      for (const name of ["kneel", "pray", "sit"] as const) {
        const w = this.down[name];
        if (w <= 0.001) continue;
        const fold = POSTURES[name];
        folded += w;
        hipDown += fold.hip[i] * w;
        kneeDown += fold.knee[i] * w;
        ankleDown += fold.foot[i] * w;
      }
      const up = 1 - Math.min(1, folded);
      const thigh = rig.legs[i];
      thigh.rotation.z = hip * up + hipDown;
      thigh.rotation.x = -swing * Math.sin(sidle) * SIDESTEP * up;
      const shin = rig.knees[i];
      shin.rotation.z = knee * up + kneeDown;
      const foot = rig.feet[i];
      foot.rotation.z = ankle * up + ankleDown;
    };
    leg(0, 1, -0.16, 0.14);
    leg(1, -1, 0.22, 0.24);

    const hop = Math.abs(Math.sin(time * 6.5)) * 0.14 * cheer;
    // Lowest with a foot under them, highest in the air between steps.
    const flight = 0.5 - 0.5 * Math.cos((along - planted / 2) * Math.PI * 4);
    // Down on the ground, the hips come down by as much of each leg as is folded under them.
    const thighLength = rig.knees[0].position.length();
    const shinLength = rig.feet[0].position.length();
    let sunk = 0;
    for (const name of ["kneel", "pray", "sit"] as const) {
      const [ofThigh, ofShin] = POSTURES[name].drop;
      sunk += (ofThigh * thighLength + ofShin * shinLength) * this.down[name];
    }
    rig.outer.position.y =
      run * (flight * 0.11 * (0.5 + Math.min(1, gait)) - 0.05) - 0.03 * stance + hop - sunk;
    rig.outer.position.z = weight * 0.045 * run;
    // Standing, they sway a little too, from one foot to the other.
    const settling = Math.sin(time * 0.61) * 0.012 * (1 - run);
    rig.outer.rotation.x = run * weight * 0.05 + this.bank + settling;
    rig.outer.rotation.z = -lean;

    // The chest leans into the run and twists against the legs, unless it's holding an aim.
    const free = 1 - aim;
    rig.upper.rotation.z =
      -0.06 * run * (0.4 + gait) * (1 - 0.6 * aim) +
      recoil * 0.08 +
      flinching * 0.2 -
      (bearing.lean + talk * beat * 0.012 * bearing.energy) * easy;
    // ... and when it isn't, it goes a little of the way round with the hips. An actor's chest
    // turns part of the way to whoever they're looking at.
    rig.upper.rotation.y =
      -sway * 0.24 * run * free + aim * 0.14 - this.hips * 0.3 * free - this.lookYaw * 0.3 * easy;
    // The shoulders tilt against the hips, and the spine gives a little as each foot lands.
    const give = Math.sin(this.phase * 2 - 0.9);
    rig.upper.rotation.x = flinching * 0.12 + weight * 0.06 * run;
    rig.upper.position.y =
      rig.spine + Math.sin(time * 1.7) * 0.006 * (1 - run) + give * 0.012 * run + shake * 0.012;

    // He looks about while nothing's happening, and cheeks the stock to aim.
    const idle = (1 - run) * free * (1 - cheer) * (1 - easy);
    // ... and on the run keeps their eyes ahead while the chest twists under them.
    rig.head.rotation.y =
      (Math.sin(time * 0.37) + Math.sin(time * 0.91) * 0.4) * 0.34 * idle +
      sway * 0.2 * run * free -
      this.lookYaw * 0.7 * easy +
      Math.sin(time * 8.5) * 0.26 * this.shaking;
    // However far the body leans, the head stays up, looking where they're going. An actor's
    // head does what the mood says, looks where they look, and nods along with what they say.
    rig.head.rotation.z =
      -(rig.upper.rotation.z - lean) * 0.9 -
      0.05 * aim +
      0.25 * cheer +
      give * 0.03 * run +
      (this.lookPitch - bearing.bow + talk * beat * 0.045) * easy +
      Math.sin(time * 7) * 0.13 * this.nodding -
      0.22 * this.down.pray;
    rig.head.rotation.x = 0.13 * aim - weight * 0.05 * run;

    // The rifle.
    const { mix, rifle } = this;
    const { poses } = rig;
    const held = mix as unknown as WeaponPose;
    blend(poses.low, poses.running, run, mix);
    blend(held, poses.aimed, aim, mix);
    const inBolt = move.reload > 0 ? Math.sin(Math.PI * (1 - move.reload)) : 0;
    this.bolt += (inBolt - this.bolt) * ease(dt, 18);
    blend(held, poses.working, this.bolt * 0.8, mix);
    if (poses.thrown) blend(held, poses.thrown, Math.sin(Math.PI * this.throwing), mix);
    blend(held, poses.cheering, cheer, mix);
    // An actor has no use for what they carry: it hangs from the one hand at their side.
    blend(held, poses.slung ?? poses.low, easy * (1 - cheer), mix);
    if (poses.empty) {
      // With nothing in it, the right hand comes up to talk too, a beat behind the left.
      const lifted = easy * talk * bearing.energy * (0.35 + 0.65 * (1 - phrase));
      mix[0] = lerp(mix[0] ?? 0, 0.34 + Math.sin(time * 2.7) * 0.05, lifted);
      mix[1] = lerp(mix[1] ?? 0, 1.08 + beat * 0.035 * bearing.energy, lifted);
      mix[2] = lerp(mix[2] ?? 0, 0.24, lifted);
      // Praying, the right hand meets the left.
      mix[0] = lerp(mix[0] ?? 0, 0.26, this.down.pray);
      mix[1] = lerp(mix[1] ?? 0, 1.0, this.down.pray);
      mix[2] = lerp(mix[2] ?? 0, 0.03, this.down.pray);
    }
    for (let i = 0; i < 6; i++) rifle[i] = mix[i] ?? 0;
    // A thrower's arm does the work, so there's nothing to kick back.
    const kick = poses.thrown ? 0 : recoil;
    // Poses are for block-figure arms: other bodies hold things as far out, for their own reach.
    const shoulder = POSED_SHOULDER + rig.lift;
    // What they carry bounces and swings with the stride. A one-handed load swings like an arm,
    // opposite the right leg, and something held in both hands rolls with the shoulders.
    const carry = run * free * (1 - cheer);
    const swungAlong = poses.leftHand ? sway * 0.04 : -sway * 0.2;
    rig.rifle.position.set(
      (rifle[0] ?? 0) * rig.stretch - kick * 0.1 + swungAlong * rig.stretch * carry,
      shoulder +
        ((rifle[1] ?? 0) - POSED_SHOULDER) * rig.stretch +
        Math.sin(this.phase * 2 - 0.6) * 0.035 * run,
      (rifle[2] ?? 0) * rig.stretch + swing * 0.03 * carry,
    );
    rig.rifle.rotation.set(
      (rifle[3] ?? 0) + sway * 0.1 * carry,
      (rifle[4] ?? 0) + swing * 0.16 * carry,
      (rifle[5] ?? 0) + kick * 0.13 + Math.sin(this.phase * 2 - 1.2) * 0.05 * carry,
    );
    rig.rifle.updateMatrix();

    // A free hand simply carries on from the forearm.
    const leftHold = poses.leftHand !== null && cheer < 0.5 && this.wave < 0.5 && easy < 0.5;
    const { quaternion } = rig.rifle;
    hands.right.along.copy(poses.rightHand.along).applyQuaternion(quaternion);
    hands.right.palm.copy(poses.rightHand.palm).applyQuaternion(quaternion);
    if (poses.leftHand) {
      hands.left.along.copy(poses.leftHand.along).applyQuaternion(quaternion);
      hands.left.palm.copy(poses.leftHand.palm).applyQuaternion(quaternion);
    }
    // Heroes' arms are short and all different: what's held out too far comes back to the hands.
    if (poses.leftHand && leftHold) pullIn(rig, rig.left, poses.leftHand.at, hands.left.along);
    pullIn(rig, rig.right, poses.rightHand.at, hands.right.along);

    // The arms follow it, and the hands close on it.
    this.rightHand.copy(poses.rightHand.at).applyMatrix4(rig.rifle.matrix);
    {
      const { shoulder, upperLength, foreLength, palm } = rig.left;
      const arm = upperLength + foreLength;
      // A free hand: forward and up, across towards the ribs; back and down past the hip.
      this.gesture.set(
        shoulder.x + 0.03 + (sway * ARM_SWING + 0.12) * arm * run,
        shoulder.y - palm - arm * lerp(LOOSE_DROP, RUNNING_DROP - sway * 0.16, run),
        shoulder.z - 0.05 * (1 - run) + run * (0.03 + 0.05 * Math.max(0, sway)),
      );
      if (poses.leftHand) {
        this.leftHand
          .copy(poses.leftHand.at)
          .lerp(poses.bolt, this.bolt)
          .applyMatrix4(rig.rifle.matrix)
          .lerp(this.gesture, easy);
      } else this.leftHand.copy(this.gesture);
      // Talking, it comes up in front of the chest for a phrase at a time and moves on the beat.
      this.gesture.set(
        shoulder.x + arm * (0.5 + Math.sin(time * 2.3) * 0.07),
        shoulder.y - arm * (0.4 - beat * 0.05 * bearing.energy),
        shoulder.z * 0.55 + Math.sin(time * 1.7) * 0.05,
      );
      this.leftHand.lerp(this.gesture, easy * talk * Math.min(1, bearing.energy) * phrase * 0.9);
      // Pointing: the arm out straight at whatever they're looking at.
      const aimed = -this.lookYaw;
      this.gesture.set(
        shoulder.x + Math.cos(aimed) * arm * 0.96,
        shoulder.y + arm * 0.06,
        shoulder.z - Math.sin(aimed) * arm * 0.96,
      );
      this.leftHand.lerp(this.gesture, this.pointing);
      // A salute: fingertips to the brow.
      this.gesture.set(shoulder.x + 0.17, shoulder.y + arm * 0.42, shoulder.z * 0.5);
      this.leftHand.lerp(this.gesture, this.saluting);
      // Praying, or kneeling with nothing to hold: the hands come together at the chest.
      this.gesture.set(shoulder.x + arm * 0.34, shoulder.y - arm * 0.3, 0.03 * rig.left.side);
      this.leftHand.lerp(this.gesture, this.down.pray);
    }
    fist.set(
      FIST_UP.x,
      shoulder + (FIST_UP.y - POSED_SHOULDER) * rig.stretch,
      FIST_UP.z * rig.stretch,
    );
    this.leftHand.lerp(fist, cheer * (0.9 + Math.sin(time * 6.5) * 0.1));
    // A wave: the hand up where a cheer's fist goes, a little out to the side, swinging to and fro.
    fist.z += (0.12 + Math.sin(time * 9) * 0.16) * rig.stretch * rig.left.side;
    this.leftHand.lerp(fist, this.wave);
    pole.copy(RIGHT_ELBOW);
    if (!poses.leftHand) pole.lerp(RIGHT_ELBOW_RUNNING, carry);
    if (poses.thrown) pole.lerp(RIGHT_ELBOW_THROWING, Math.sin(Math.PI * this.throwing));
    reach(rig.right, this.rightHand, pole, hands.right.along, hands.right.palm);
    pole.copy(LEFT_ELBOW);
    if (!poses.leftHand || easy > 0.5) pole.lerp(LEFT_ELBOW_RUNNING, run);
    reach(
      rig.left,
      this.leftHand,
      pole,
      leftHold ? hands.left.along : null,
      leftHold ? hands.left.palm : PALM_IN,
    );
    curl(rig.right, GRIP, 0);
    {
      const holding = lerp(poses.leftHand ? GRIP : RELAXED, RELAXED, easy);
      const open = Math.max(this.wave, this.saluting, this.down.pray);
      curl(rig.left, lerp(lerp(holding, GRIP, cheer), 0, open), this.pointing);
    }
  }
}
