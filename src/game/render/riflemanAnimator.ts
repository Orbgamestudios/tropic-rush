// The Rifleman's animation, worked out fresh each frame from what the hero is doing rather than
// played back from clips: a stride whose legs turn towards the way he's going while his chest
// stays on his aim, the rifle moving between poses, and his arms following it by inverse
// kinematics. Everything here is looks; the rules never hear about it.

import * as THREE from "three";
import { angleDiff, clamp, lerp } from "../logic/vec";
import type { RifleArm, RifleRig } from "./heroModels";

export interface RiflemanMove {
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

export const AT_EASE: RiflemanMove = {
  moving: false,
  speed: 0,
  heading: 0,
  aiming: false,
  reload: 0,
  down: false,
  cheering: false,
};

/** Where the rifle sits on his body: position, then rotation. */
type RiflePose = readonly [number, number, number, number, number, number];

const LOW_READY: RiflePose = [0.34, 1.03, 0.14, 0.1, 0.28, -0.38];
const ACROSS_CHEST: RiflePose = [0.22, 1.16, 0.02, 0.55, 0.42, 0.78];
const SHOULDERED: RiflePose = [0.3, 1.29, 0.2, 0, 0.1, 0];
const WORKING_BOLT: RiflePose = [0.3, 1.12, 0.16, 0.3, 0.2, 0.45];
const HELD_HIGH: RiflePose = [0.04, 1.98, 0.22, 0.5, 0.1, 1.25];
const DROPPED: RiflePose = [0.1, 0.75, 0.45, 1.2, 0.4, -1.3];

const RIGHT_HAND = new THREE.Vector3(0.1, -0.2, 0.02);
const LEFT_HAND = new THREE.Vector3(0.42, -0.08, -0.03);
const BOLT = new THREE.Vector3(-0.02, 0.12, 0.08);
const FIST_UP = new THREE.Vector3(0.1, 1.95, -0.4);

/** Which way each elbow points. */
const RIGHT_ELBOW = new THREE.Vector3(-0.4, -0.8, 0.5);
const LEFT_ELBOW = new THREE.Vector3(0.1, -0.8, -0.6);

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const hand = new THREE.Vector3();
const elbow = new THREE.Vector3();
const along = new THREE.Vector3();
const side = new THREE.Vector3();

/** Exponential smoothing that doesn't depend on the frame rate. */
const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

function blend(a: RiflePose, b: RiflePose, t: number, out: number[]): void {
  for (let i = 0; i < 6; i++) out[i] = lerp(a[i] ?? 0, b[i] ?? 0, t);
}

/** Two-bone IK: bends the arm from its shoulder so the hand lands on a point, or as near as it reaches. */
function reach(arm: RifleArm, target: THREE.Vector3, pole: THREE.Vector3): void {
  const { shoulder, upperLength, foreLength } = arm;
  along.copy(target).sub(shoulder);
  const gap = clamp(along.length(), 0.08, upperLength + foreLength - 0.002);
  along.normalize();
  const a = (upperLength ** 2 - foreLength ** 2 + gap ** 2) / (2 * gap);
  const h = Math.sqrt(Math.max(0, upperLength ** 2 - a ** 2));
  side.copy(pole).addScaledVector(along, -pole.dot(along)).normalize();
  elbow.copy(shoulder).addScaledVector(along, a).addScaledVector(side, h);
  hand.copy(shoulder).addScaledVector(along, gap);

  arm.upper.position.copy(shoulder).add(elbow).multiplyScalar(0.5);
  along.copy(elbow).sub(shoulder).normalize();
  arm.upper.quaternion.setFromUnitVectors(Y_AXIS, along);
  arm.fore.position.copy(elbow).add(hand).multiplyScalar(0.5);
  along.copy(hand).sub(elbow).normalize();
  arm.fore.quaternion.setFromUnitVectors(Y_AXIS, along);
  arm.hand.position.copy(hand);
}

export class RiflemanAnimator {
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
  private readonly rifle: number[] = [0, 0, 0, 0, 0, 0];
  private readonly mix: number[] = [0, 0, 0, 0, 0, 0];
  private readonly rightHand = new THREE.Vector3();
  private readonly leftHand = new THREE.Vector3();

  constructor(private readonly rig: RifleRig) {}

  /** A shot left the barrel: the rifle kicks and his shoulder takes it. */
  shot(): void {
    this.recoil = 1;
  }

  /** He took a hit. */
  flinch(): void {
    this.flinching = 1;
  }

  /** Where the end of the barrel is in the world right now. */
  muzzle(out: THREE.Vector3): THREE.Vector3 {
    return this.rig.muzzle.getWorldPosition(out);
  }

  update(dt: number, move: RiflemanMove): void {
    const { rig } = this;
    this.time += dt;
    const { time } = this;
    this.recoil *= Math.exp(-dt * 15);
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
    blend(LOW_READY, ACROSS_CHEST, run, mix);
    blend(mix as unknown as RiflePose, SHOULDERED, aim, mix);
    const inBolt = move.reload > 0 ? Math.sin(Math.PI * (1 - move.reload)) : 0;
    this.bolt += (inBolt - this.bolt) * ease(dt, 18);
    blend(mix as unknown as RiflePose, WORKING_BOLT, this.bolt * 0.8, mix);
    blend(mix as unknown as RiflePose, HELD_HIGH, cheer, mix);
    blend(mix as unknown as RiflePose, DROPPED, fall, rifle);
    rig.rifle.position.set(
      (rifle[0] ?? 0) - recoil * 0.1,
      (rifle[1] ?? 0) + Math.sin(this.phase * 2) * 0.022 * run,
      rifle[2] ?? 0,
    );
    rig.rifle.rotation.set(
      rifle[3] ?? 0,
      (rifle[4] ?? 0) + swing * 0.09 * run * free,
      (rifle[5] ?? 0) + recoil * 0.13,
    );
    rig.rifle.updateMatrix();

    // The arms follow it.
    this.rightHand.copy(RIGHT_HAND).applyMatrix4(rig.rifle.matrix);
    this.leftHand.copy(LEFT_HAND).lerp(BOLT, this.bolt).applyMatrix4(rig.rifle.matrix);
    this.leftHand.lerp(FIST_UP, cheer * (0.9 + Math.sin(time * 6.5) * 0.1));
    this.leftHand.lerp(rig.left.rest, fall);
    this.rightHand.lerp(rig.right.rest, fall);
    reach(rig.right, this.rightHand, RIGHT_ELBOW);
    reach(rig.left, this.leftHand, LEFT_ELBOW);
  }
}
