// How the heroes move, worked out fresh each frame from what they're doing rather than played back
// from clips: a stride whose legs turn towards the way they're going while the chest stays on the
// aim, the weapon moving between poses, and the arms following it by inverse kinematics. It drives
// the block figures and the skinned models alike. Everything here is looks; the rules never hear
// about it.

import * as THREE from "three";
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
  down: boolean;
  cheering: boolean;
}

export const AT_EASE: HeroMove = {
  moving: false,
  speed: 0,
  heading: 0,
  aiming: false,
  reload: 0,
  down: false,
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

/** A pistol grip, in the right hand: thumb up, palm against its side. */
const PISTOL_GRIP = (at: readonly number[]) => grip(at, [0.8, 0.45, -0.4], [0, -0.1, -1]);
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
  dropped: WeaponPose;
  /** How each hand holds it. Null leaves the left hand free, swinging at the hero's side. */
  rightHand: Grip;
  leftHand: Grip | null;
  bolt: THREE.Vector3;
  /** Overhead, for a hero who throws it rather than fires it. */
  thrown: WeaponPose | null;
}

const DROPPED: WeaponPose = [0.1, 0.75, 0.45, 1.2, 0.4, -1.3];
const NO_BOLT = new THREE.Vector3();

export const RIFLE_POSES: HeroPoses = {
  low: [0.42, 1.02, 0.2, 0.15, 0.8, -0.2],
  running: [0.38, 1.18, 0.22, 0.35, 0.85, 0.42],
  aimed: [0.3, 1.29, 0.2, 0, 0.1, 0],
  working: [0.3, 1.12, 0.16, 0.3, 0.2, 0.45],
  cheering: [0.04, 1.98, 0.78, 0.5, 0.1, 1.25],
  dropped: DROPPED,
  rightHand: PISTOL_GRIP([0.1, -0.13, 0.02]),
  leftHand: UNDERHAND([0.5, -0.06, 0]),
  bolt: new THREE.Vector3(-0.02, 0.12, 0.08),
  thrown: null,
};

export const MINIGUN_POSES: HeroPoses = {
  low: [0.44, 0.92, 0.04, 0, 0, -0.14],
  running: [0.38, 1.0, 0.1, 0, 0.14, 0.14],
  aimed: [0.5, 0.98, 0.02, 0, 0, 0.03],
  working: [0.5, 0.98, 0.02, 0, 0, 0.03],
  cheering: [0.16, 2.0, 0.72, 0.35, 0, 1.15],
  dropped: [0.3, 0.5, 0.4, 1.2, 0.4, -1.2],
  rightHand: PISTOL_GRIP([-0.2, -0.2, 0]),
  leftHand: grip([-0.02, 0.26, 0], [0.25, 0.1, 0.96], [0, -1, 0]),
  bolt: NO_BOLT,
  thrown: null,
};

export const BOTTLE_POSES: HeroPoses = {
  low: [0.26, 1.0, 0.42, 0, 0, 0],
  running: [0.3, 1.14, 0.28, 0, 0, 0.15],
  aimed: [0.4, 1.2, 0.3, 0, 0, 0.1],
  working: [0.4, 1.2, 0.3, 0, 0, 0.1],
  cheering: [0.1, 1.95, 0.78, 0.2, 0, -0.1],
  dropped: DROPPED,
  rightHand: grip([0, 0, 0], [0.85, 0.15, -0.5], [-0.5, 0, -0.85]),
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
  dropped: [0.1, 0.5, 0.45, 1.2, 0.4, -1.2],
  rightHand: PISTOL_GRIP([0.05, -0.2, 0]),
  leftHand: PISTOL_GRIP([0.42, -0.2, 0]),
  bolt: NO_BOLT,
  thrown: null,
};

export const GRENADE_POSES: HeroPoses = {
  low: [0.26, 0.98, 0.44, 0, 0, 0],
  running: [0.3, 1.14, 0.24, 0, 0, 0],
  aimed: [0.2, 1.46, 0.3, 0, 0, 0],
  working: [0.2, 1.46, 0.3, 0, 0, 0],
  cheering: [0.1, 1.98, 0.8, 0, 0, 0],
  dropped: DROPPED,
  rightHand: grip([0, -0.06, 0], [0.8, 0.15, -0.55], [0, 1, 0]),
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
  dropped: DROPPED,
  rightHand: grip([-0.1, 0, 0], [0, -1, -0.2], [0, 0, -1]),
  leftHand: null,
  bolt: NO_BOLT,
  thrown: null,
};

const FIST_UP = new THREE.Vector3(0.1, 1.95, -0.8);
/** The way a free palm faces: in towards the leg, and the same at rest in either hand. */
const PALM_IN = [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1)] as const;
/** How high the poses expect a hero's shoulders to be. */
export const POSED_SHOULDER = 1.38;
/** How far the fingers curl, holding something and with nothing to hold. */
const GRIP = 1.5;
const RELAXED = 0.55;
/** How far along an arm's length a free hand hangs below the shoulder, at rest and running. */
const LOOSE_DROP = 0.97;
const RUNNING_DROP = 0.62;
/** How far a free arm swings on the run, as a share of its length. */
const ARM_SWING = 0.5;

/** The share of a stride a foot is on the ground, at a walk and at a full run. */
const PLANTED_WALKING = 0.62;
const PLANTED_RUNNING = 0.33;
/** How far either way a leg swings from the hip, at a slow walk and at a full run. */
const SWING_WALKING = 0.32;
const SWING_RUNNING = 0.78;
/** Legs can only go so fast, however quick the hero's going. */
const MOST_STRIDE_RATE = 24;

/** Which way each elbow points. */
const RIGHT_ELBOW = new THREE.Vector3(-0.4, -0.8, 0.5);
const LEFT_ELBOW = new THREE.Vector3(0.1, -0.8, -0.6);

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const hand = new THREE.Vector3();
const fist = new THREE.Vector3();
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
const hands = {
  right: { along: new THREE.Vector3(), palm: new THREE.Vector3() },
  left: { along: new THREE.Vector3(), palm: new THREE.Vector3() },
};
/** How much of a hand's turn the forearm takes, which spares the wrist from wringing. */
const FOREARM_TWIST = 0.55;

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
  const gap = clamp(bone.length() - (along ? 0 : arm.palm), 0.08, upperLength + foreLength - 0.002);
  bone.normalize();
  const a = (upperLength ** 2 - foreLength ** 2 + gap ** 2) / (2 * gap);
  const h = Math.sqrt(Math.max(0, upperLength ** 2 - a ** 2));
  side.copy(pole).addScaledVector(bone, -pole.dot(bone)).normalize();
  elbow.copy(shoulder).addScaledVector(bone, a).addScaledVector(side, h);
  hand.copy(shoulder).addScaledVector(bone, gap);

  if (bones) {
    bone.copy(elbow).sub(shoulder).normalize();
    upperTurn.setFromUnitVectors(bones.upperRest, bone);
    bone.copy(hand).sub(elbow).normalize();
    foreTurn.setFromUnitVectors(bones.foreRest, bone);
    turnHand(arm, bones, along ?? bone, palm);
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
 * Lines a hand up: its knuckles the way it's reaching and its palm the way it should face. A hand
 * can only roll so far before the wrist wrings like a cloth, so the forearm takes a share of it.
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
  // Whatever of that is a roll about the forearm itself, the forearm shares.
  undo.copy(foreTurn).invert().multiply(handTurn);
  const axis = bones.foreRest;
  const roll = undo.x * axis.x + undo.y * axis.y + undo.z * axis.z;
  twist.set(axis.x * roll, axis.y * roll, axis.z * roll, undo.w).normalize();
  twist.slerp(undo.identity(), 1 - FOREARM_TWIST);
  foreTurn.multiply(twist);
  arm.upper.quaternion.copy(upperTurn);
  arm.fore.quaternion.copy(upperTurn).invert().multiply(foreTurn);
  arm.hand.quaternion.copy(foreTurn).invert().multiply(handTurn);
}

export class HeroAnimator {
  private phase = Math.random() * 6;
  private time = Math.random() * 20;
  private run = 0;
  private gait = 0;
  private aim = 0;
  private cheer = 0;
  private recoil = 0;
  private flinching = 0;
  private fallen = 0;
  private hips = 0;
  private bolt = 0;
  private throwing = 0;
  private readonly rifle: number[] = [0, 0, 0, 0, 0, 0];
  private readonly mix: number[] = [0, 0, 0, 0, 0, 0];
  private readonly rightHand = new THREE.Vector3();
  private readonly leftHand = new THREE.Vector3();
  /** How long their legs are, which sets how far a stride takes them. */
  private readonly hipHeight: number;

  constructor(private readonly rig: HeroRig) {
    this.hipHeight = Math.max(0.5, rig.legs[0].position.y);
  }

  /** A shot left the barrel: the weapon kicks and the shoulder takes it, or the arm comes over. */
  shot(): void {
    this.recoil = 1;
    this.throwing = 1;
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
    this.run += ((move.moving && !move.down ? 1 : 0) - this.run) * ease(dt, 10);
    this.aim += ((move.aiming && !move.down ? 1 : 0) - this.aim) * ease(dt, 14);
    this.cheer += ((move.cheering && !move.down ? 1 : 0) - this.cheer) * ease(dt, 6);
    this.fallen = move.down ? Math.min(1, this.fallen + dt * 2.2) : 0;
    this.gait += (clamp(move.speed / 5, 0, 1.5) - this.gait) * ease(dt, 8);
    const { run, aim, cheer, gait, recoil, flinching } = this;

    // Backing away runs the stride in reverse, rather than twisting him right round.
    const backing = Math.abs(move.heading) > Math.PI * 0.6;
    const legsTurn = backing ? angleDiff(move.heading, Math.PI) : move.heading;
    const legSwing = lerp(SWING_WALKING, SWING_RUNNING, gait);
    const planted = lerp(PLANTED_WALKING, PLANTED_RUNNING, Math.min(1, gait));
    // The legs go as fast as it takes for a planted foot to keep up with the ground going by.
    const perStride = (2 * this.hipHeight * Math.sin(Math.min(legSwing, 1.1))) / planted;
    const strideRate = (move.speed / perStride) * Math.PI * 2;
    this.phase +=
      dt * (Math.min(strideRate, MOST_STRIDE_RATE) + 2 * (1 - run)) * (backing ? -1 : 1);
    this.hips += ((move.moving ? clamp(legsTurn, -1, 1) : 0) - this.hips) * ease(dt, 12);

    const sway = Math.sin(this.phase);
    const swing = Math.cos(this.phase);
    // The pelvis turns with the leading leg, against the chest.
    rig.lower.rotation.y = -this.hips + sway * 0.16 * run;
    const bend = lerp(0.65, 1.5, Math.min(1, gait));
    const stance = aim * (1 - run);
    const fall = this.fallen * this.fallen * (3 - 2 * this.fallen);
    const buckle = Math.min(1, this.fallen * 2.4) * (1 - fall);

    // Each leg is half a stride behind the other, with the right one forward as `sway` peaks.
    const along = this.phase / (Math.PI * 2) - 0.25;
    const leg = (i: 0 | 1, sign: number, ready: number, ready2: number) => {
      strideAt(along + i * 0.5 - Math.floor(along + i * 0.5), planted, bend);
      const hip = stride.hip * legSwing * run + ready * stance + 0.04 * sign * (1 - run);
      const knee = -stride.knee * run - ready2 * stance - 1.1 * buckle;
      const thigh = rig.legs[i];
      thigh.rotation.z = hip + 0.55 * buckle;
      const shin = rig.knees[i];
      shin.rotation.z = knee;
      const foot = rig.feet[i];
      foot.rotation.z = -(hip + knee) + stride.foot * run;
    };
    leg(0, 1, -0.16, 0.14);
    leg(1, -1, 0.22, 0.24);

    const hop = Math.abs(Math.sin(time * 6.5)) * 0.14 * cheer;
    // Lowest with a foot under them, highest in the air between steps.
    const flight = 0.5 - 0.5 * Math.cos((along - planted / 2) * Math.PI * 4);
    rig.outer.position.y =
      run * (flight * 0.11 * (0.5 + Math.min(1, gait)) - 0.05) -
      0.03 * stance -
      0.3 * buckle +
      hop +
      fall * 0.22;
    rig.outer.rotation.x = run * sway * 0.05;
    rig.outer.rotation.z = fall * 1.5 - run * 0.09 * Math.min(1, gait);

    // The chest leans into the run and twists against the legs, unless it's holding an aim.
    const free = 1 - aim;
    rig.upper.rotation.z =
      -0.18 * run * (0.4 + gait) * (1 - 0.6 * aim) + recoil * 0.08 + flinching * 0.2;
    rig.upper.rotation.y = -sway * 0.24 * run * free + aim * 0.14 + this.hips * 0.3 * free;
    rig.upper.rotation.x = flinching * 0.12;
    rig.upper.position.y = rig.spine + Math.sin(time * 1.7) * 0.006 * (1 - run);

    // He looks about while nothing's happening, and cheeks the stock to aim.
    const idle = (1 - run) * free * (1 - cheer);
    // ... and on the run keeps their eyes ahead while the chest twists under them.
    rig.head.rotation.y =
      (Math.sin(time * 0.37) + Math.sin(time * 0.91) * 0.4) * 0.34 * idle + sway * 0.2 * run * free;
    rig.head.rotation.z = -rig.upper.rotation.z * 0.6 - 0.05 * aim + 0.25 * cheer;
    rig.head.rotation.x = 0.13 * aim + sway * 0.03 * run;

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
    blend(held, poses.dropped, fall, rifle);
    // A thrower's arm does the work, so there's nothing to kick back.
    const kick = poses.thrown ? 0 : recoil;
    // Poses are for block-figure arms: other bodies hold things as far out, for their own reach.
    const shoulder = POSED_SHOULDER + rig.lift;
    rig.rifle.position.set(
      (rifle[0] ?? 0) * rig.stretch - kick * 0.1,
      shoulder +
        ((rifle[1] ?? 0) - POSED_SHOULDER) * rig.stretch +
        Math.sin(this.phase * 2) * 0.022 * run,
      (rifle[2] ?? 0) * rig.stretch,
    );
    rig.rifle.rotation.set(
      rifle[3] ?? 0,
      (rifle[4] ?? 0) + swing * 0.09 * run * free,
      (rifle[5] ?? 0) + kick * 0.13,
    );
    rig.rifle.updateMatrix();

    // Falling, they let go. A free hand simply carries on from the forearm.
    const gripping = fall < 0.5;
    const leftHold = poses.leftHand !== null && gripping && cheer < 0.5;
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
    if (poses.leftHand) {
      this.leftHand
        .copy(poses.leftHand.at)
        .lerp(poses.bolt, this.bolt)
        .applyMatrix4(rig.rifle.matrix);
    } else {
      const { shoulder, upperLength, foreLength, palm } = rig.left;
      const arm = upperLength + foreLength;
      this.leftHand.set(
        shoulder.x + 0.03 + (sway * ARM_SWING + 0.15) * arm * run,
        shoulder.y - arm * lerp(LOOSE_DROP, RUNNING_DROP, run) - palm,
        shoulder.z - 0.05,
      );
    }
    fist.set(
      FIST_UP.x,
      shoulder + (FIST_UP.y - POSED_SHOULDER) * rig.stretch,
      FIST_UP.z * rig.stretch,
    );
    this.leftHand.lerp(fist, cheer * (0.9 + Math.sin(time * 6.5) * 0.1));
    this.leftHand.lerp(rig.left.rest, fall);
    this.rightHand.lerp(rig.right.rest, fall);
    reach(
      rig.right,
      this.rightHand,
      RIGHT_ELBOW,
      gripping ? hands.right.along : null,
      gripping ? hands.right.palm : (PALM_IN[0] as THREE.Vector3),
    );
    reach(
      rig.left,
      this.leftHand,
      LEFT_ELBOW,
      leftHold ? hands.left.along : null,
      leftHold ? hands.left.palm : (PALM_IN[1] as THREE.Vector3),
    );
    if (rig.right.fingers) rig.right.fingers.rotation.x = GRIP * rig.right.side;
    if (rig.left.fingers) {
      const curl = lerp(poses.leftHand ? GRIP : RELAXED, GRIP, cheer);
      rig.left.fingers.rotation.x = curl * rig.left.side;
    }
  }
}
