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

/** How a hero carries what they carry. */
export interface HeroPoses {
  low: WeaponPose;
  running: WeaponPose;
  aimed: WeaponPose;
  /** Reloading, for a weapon that needs working by hand. */
  working: WeaponPose;
  cheering: WeaponPose;
  dropped: WeaponPose;
  /** Where each hand holds it. Null leaves the left hand free, swinging at the hero's side. */
  rightHand: THREE.Vector3;
  leftHand: THREE.Vector3 | null;
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
  cheering: [0.04, 1.98, 0.22, 0.5, 0.1, 1.25],
  dropped: DROPPED,
  rightHand: new THREE.Vector3(0.1, -0.2, 0.02),
  leftHand: new THREE.Vector3(0.42, -0.08, -0.03),
  bolt: new THREE.Vector3(-0.02, 0.12, 0.08),
  thrown: null,
};

export const MINIGUN_POSES: HeroPoses = {
  low: [0.44, 0.92, 0.04, 0, 0, -0.14],
  running: [0.38, 1.0, 0.1, 0, 0.14, 0.14],
  aimed: [0.5, 0.98, 0.02, 0, 0, 0.03],
  working: [0.5, 0.98, 0.02, 0, 0, 0.03],
  cheering: [0.12, 1.86, 0.1, 0.3, 0, 1.2],
  dropped: [0.3, 0.5, 0.4, 1.2, 0.4, -1.2],
  rightHand: new THREE.Vector3(-0.24, -0.06, 0.13),
  leftHand: new THREE.Vector3(-0.05, 0.24, -0.02),
  bolt: NO_BOLT,
  thrown: null,
};

export const BOTTLE_POSES: HeroPoses = {
  low: [0.38, 1.0, 0.16, 0, 0, -0.25],
  running: [0.3, 1.14, 0.24, 0, 0, 0.6],
  aimed: [0.4, 1.2, 0.26, 0, 0, 0.2],
  working: [0.4, 1.2, 0.26, 0, 0, 0.2],
  cheering: [0.1, 1.95, 0.24, 0, 0, 1.3],
  dropped: DROPPED,
  rightHand: new THREE.Vector3(-0.04, -0.12, 0),
  leftHand: null,
  bolt: NO_BOLT,
  thrown: [-0.12, 1.86, 0.26, 0, 0, 1.7],
};

export const TUBE_POSES: HeroPoses = {
  low: [0.04, 1.5, 0.3, 0, 0, 0],
  running: [0.02, 1.48, 0.3, 0, 0, 0.12],
  aimed: [0.1, 1.53, 0.3, 0, 0, 0.03],
  working: [0.02, 1.47, 0.3, 0, 0, -0.1],
  cheering: [0.02, 1.7, 0.28, 0, 0, 0.9],
  dropped: [0.1, 0.5, 0.45, 1.2, 0.4, -1.2],
  rightHand: new THREE.Vector3(0.05, -0.2, 0),
  leftHand: new THREE.Vector3(0.28, -0.16, -0.1),
  bolt: NO_BOLT,
  thrown: null,
};

export const GRENADE_POSES: HeroPoses = {
  low: [0.34, 1.0, 0.2, 0, 0, 0],
  running: [0.3, 1.14, 0.24, 0, 0, 0],
  aimed: [0.2, 1.46, 0.3, 0, 0, 0],
  working: [0.2, 1.46, 0.3, 0, 0, 0],
  cheering: [0.1, 1.98, 0.24, 0, 0, 0],
  dropped: DROPPED,
  rightHand: new THREE.Vector3(-0.04, -0.08, 0),
  leftHand: null,
  bolt: NO_BOLT,
  thrown: [-0.14, 1.9, 0.26, 0, 0, 0.8],
};

export const WRENCH_POSES: HeroPoses = {
  low: [0.34, 0.98, 0.22, 0, 0, -0.5],
  running: [0.28, 1.14, 0.26, 0, 0, 0.7],
  aimed: [0.44, 1.2, 0.26, 0, 0, 0.1],
  working: [0.44, 1.2, 0.26, 0, 0, 0.1],
  cheering: [0.1, 1.95, 0.24, 0, 0, 1.3],
  dropped: DROPPED,
  rightHand: new THREE.Vector3(-0.1, 0, 0),
  leftHand: null,
  bolt: NO_BOLT,
  thrown: null,
};

const FIST_UP = new THREE.Vector3(0.1, 1.95, -0.4);
/** How high the poses expect a hero's shoulders to be. */
export const POSED_SHOULDER = 1.38;
/** How far the fingers curl, holding something and with nothing to hold. */
const GRIP = 1.5;
const RELAXED = 0.55;
/** A free hand, swinging at the hero's side. */
const LOOSE_HAND = new THREE.Vector3(0.02, 1.0, -0.46);

/** Which way each elbow points. */
const RIGHT_ELBOW = new THREE.Vector3(-0.4, -0.8, 0.5);
const LEFT_ELBOW = new THREE.Vector3(0.1, -0.8, -0.6);

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const hand = new THREE.Vector3();
const elbow = new THREE.Vector3();
const along = new THREE.Vector3();
const side = new THREE.Vector3();
const turn = new THREE.Quaternion();

/** Exponential smoothing that doesn't depend on the frame rate. */
const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

function blend(a: WeaponPose, b: WeaponPose, t: number, out: number[]): void {
  for (let i = 0; i < 6; i++) out[i] = lerp(a[i] ?? 0, b[i] ?? 0, t);
}

/** Two-bone IK: bends the arm from its shoulder so the hand lands on a point, or as near as it reaches. */
function reach(arm: HeroArm, target: THREE.Vector3, pole: THREE.Vector3): void {
  const { shoulder, upperLength, foreLength } = arm;
  along.copy(target).sub(shoulder);
  // The target is where the palm goes, a little past the wrist these bones end at.
  const gap = clamp(along.length() - arm.palm, 0.08, upperLength + foreLength - 0.002);
  along.normalize();
  const a = (upperLength ** 2 - foreLength ** 2 + gap ** 2) / (2 * gap);
  const h = Math.sqrt(Math.max(0, upperLength ** 2 - a ** 2));
  side.copy(pole).addScaledVector(along, -pole.dot(along)).normalize();
  elbow.copy(shoulder).addScaledVector(along, a).addScaledVector(side, h);
  hand.copy(shoulder).addScaledVector(along, gap);

  const { bones } = arm;
  if (bones) {
    along.copy(elbow).sub(shoulder).normalize();
    arm.upper.quaternion.setFromUnitVectors(bones.upperRest, along);
    along.copy(hand).sub(elbow).normalize();
    turn.setFromUnitVectors(bones.foreRest, along);
    arm.fore.quaternion.copy(arm.upper.quaternion).invert().multiply(turn);
    return;
  }

  arm.upper.position.copy(shoulder).add(elbow).multiplyScalar(0.5);
  along.copy(elbow).sub(shoulder).normalize();
  arm.upper.quaternion.setFromUnitVectors(Y_AXIS, along);
  arm.fore.position.copy(elbow).add(hand).multiplyScalar(0.5);
  along.copy(hand).sub(elbow).normalize();
  arm.fore.quaternion.setFromUnitVectors(Y_AXIS, along);
  arm.hand.position.copy(hand);
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

  constructor(private readonly rig: HeroRig) {}

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
    this.gait += (clamp(move.speed / 5, 0, 1) - this.gait) * ease(dt, 8);
    const { run, aim, cheer, gait, recoil, flinching } = this;

    // Backing away runs the stride in reverse, rather than twisting him right round.
    const backing = Math.abs(move.heading) > Math.PI * 0.6;
    const legsTurn = backing ? angleDiff(move.heading, Math.PI) : move.heading;
    this.phase += dt * (move.speed * 1.9 + 2) * (backing ? -1 : 1);
    this.hips += ((move.moving ? clamp(legsTurn, -1, 1) : 0) - this.hips) * ease(dt, 12);
    rig.lower.rotation.y = -this.hips;

    const sway = Math.sin(this.phase);
    const swing = Math.cos(this.phase);
    const stride = lerp(0.42, 0.85, gait);
    const bend = lerp(0.65, 1.35, gait);
    const stance = aim * (1 - run);
    const fall = this.fallen * this.fallen * (3 - 2 * this.fallen);
    const buckle = Math.min(1, this.fallen * 2.4) * (1 - fall);

    const leg = (i: 0 | 1, sign: number, planted: number, planted2: number) => {
      const hip = sign * sway * stride * run + planted * stance + 0.04 * sign * (1 - run);
      const knee =
        -(0.1 + bend * Math.max(0, sign * swing)) * run - planted2 * stance - 1.1 * buckle;
      const thigh = rig.legs[i];
      thigh.rotation.z = hip + 0.55 * buckle;
      const shin = rig.knees[i];
      shin.rotation.z = knee;
      const foot = rig.feet[i];
      foot.rotation.z = -(hip + knee) * 0.55;
    };
    leg(0, 1, -0.16, 0.14);
    leg(1, -1, 0.22, 0.24);

    const hop = Math.abs(Math.sin(time * 6.5)) * 0.14 * cheer;
    rig.outer.position.y =
      run * Math.abs(sway) * 0.07 * (0.5 + gait) - 0.03 * stance - 0.3 * buckle + hop + fall * 0.22;
    rig.outer.rotation.x = run * sway * 0.05;
    rig.outer.rotation.z = fall * 1.5;

    // The chest leans into the run and twists against the legs, unless it's holding an aim.
    const free = 1 - aim;
    rig.upper.rotation.z =
      -0.18 * run * (0.4 + gait) * (1 - 0.6 * aim) + recoil * 0.08 + flinching * 0.2;
    rig.upper.rotation.y = -sway * 0.24 * run * free + aim * 0.14 + this.hips * 0.3 * free;
    rig.upper.rotation.x = flinching * 0.12;
    rig.upper.position.y = rig.spine + Math.sin(time * 1.7) * 0.006 * (1 - run);

    // He looks about while nothing's happening, and cheeks the stock to aim.
    const idle = (1 - run) * free * (1 - cheer);
    rig.head.rotation.y = (Math.sin(time * 0.37) + Math.sin(time * 0.91) * 0.4) * 0.34 * idle;
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

    // The arms follow it.
    this.rightHand.copy(poses.rightHand).applyMatrix4(rig.rifle.matrix);
    if (poses.leftHand) {
      this.leftHand.copy(poses.leftHand).lerp(poses.bolt, this.bolt).applyMatrix4(rig.rifle.matrix);
    } else {
      this.leftHand.copy(LOOSE_HAND);
      this.leftHand.x += sway * 0.32 * run + 0.1 * run;
      this.leftHand.y += rig.lift + 0.12 * run;
    }
    this.leftHand.lerp(FIST_UP, cheer * (0.9 + Math.sin(time * 6.5) * 0.1));
    this.leftHand.lerp(rig.left.rest, fall);
    this.rightHand.lerp(rig.right.rest, fall);
    reach(rig.right, this.rightHand, RIGHT_ELBOW);
    reach(rig.left, this.leftHand, LEFT_ELBOW);
    if (rig.right.fingers) rig.right.fingers.rotation.x = GRIP * rig.right.side;
    if (rig.left.fingers) {
      rig.left.fingers.rotation.x = (poses.leftHand ? GRIP : RELAXED) * rig.left.side;
    }
  }
}
