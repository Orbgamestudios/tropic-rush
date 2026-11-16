// Hair that swings: each chain of bones down a lock of hair (rig-extras.mjs makes them) is a few
// weights on stiff springs. Every frame each bone's end is carried on by how it was moving, pulled
// back towards how it rests, dragged down a little and pushed by the wind, then held at its length
// and kept out of the head. It's the way VRM characters' hair and ribbons work: a few dozen
// points a character, far cheaper than cloth, and enough that hair lags a turn of the head,
// bounces on a run and lifts in a gust (docs/CHARACTERS.md, Hair).

import * as THREE from "three";

/** How a chain behaves. Stiffer springs hold their shape; more drag settles them sooner. */
export interface SpringFeel {
  /** How hard each bone pulls back to the way it rests, per second. */
  stiffness: number;
  /** How much of its swing a bone loses each frame, 0 to 1. */
  drag: number;
  /** Meters a second each second pulling the ends down. */
  gravity: number;
  /** How much the wind pushes it. */
  wind: number;
}

export const HAIR: SpringFeel = { stiffness: 2.2, drag: 0.16, gravity: 0.35, wind: 0.5 };
/** Short hair with some hold in it: it stirs in a breeze and shakes on a run, and keeps its shape. */
export const SHORT_HAIR: SpringFeel = { stiffness: 10, drag: 0.3, gravity: 0.04, wind: 0.2 };
/** Long loose hair: it hangs, lags a turn of the head and lifts in a gust. */
export const LONG_HAIR: SpringFeel = { stiffness: 5, drag: 0.22, gravity: 0.12, wind: 0.34 };

interface Joint {
  bone: THREE.Object3D;
  /** Which way the bone points at rest, in its own space, and how long it is there. */
  axis: THREE.Vector3;
  length: number;
  rest: THREE.Quaternion;
  tail: THREE.Vector3;
  last: THREE.Vector3;
  /** How much this bone gives: the ends of a lock swing more than its root. */
  give: number;
}

const head = new THREE.Vector3();
const next = new THREE.Vector3();
const pull = new THREE.Vector3();
const toward = new THREE.Vector3();
const parentTurn = new THREE.Quaternion();
const undo = new THREE.Quaternion();
const restAxis = new THREE.Vector3();
const centre = new THREE.Vector3();
const scaled = new THREE.Vector3();
const wind = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
/** The wind's way across the islands, matching the plants' sway. */
const WIND_WAY = new THREE.Vector3(0.8, 0, 0.6).normalize();

export class SpringChains {
  private readonly chains: Joint[][] = [];
  /** How this hair behaves. */
  feel: SpringFeel = HAIR;
  private started = false;
  private time = Math.random() * 10;

  /** The chains found under a model, or null if it has none. */
  static from(root: THREE.Object3D, skull: THREE.Object3D | null): SpringChains | null {
    const found = new Map<number, THREE.Object3D[]>();
    root.traverse((o) => {
      const m = /^hair(\d+)_(\d+)$/.exec(o.name);
      if (!m) return;
      const list = found.get(Number(m[1])) ?? [];
      list[Number(m[2]) - 1] = o;
      found.set(Number(m[1]), list);
    });
    if (found.size === 0) return null;
    const springs = new SpringChains(root, skull);
    for (const bones of found.values()) {
      const chain: Joint[] = [];
      bones.forEach((bone, i) => {
        // A bone's end is where the next one starts; the last's is the chain's tip.
        const child = bones[i + 1];
        if (!child || !bone) return;
        const axis = child.position.clone();
        chain.push({
          bone,
          axis: axis.clone().normalize(),
          length: axis.length(),
          rest: bone.quaternion.clone(),
          tail: new THREE.Vector3(),
          last: new THREE.Vector3(),
          give: (i + 1) / bones.length,
        });
      });
      if (chain.length > 0) springs.chains.push(chain);
    }
    return springs;
  }

  private constructor(
    private readonly root: THREE.Object3D,
    /** The head, which the hair can't swing into. */
    private readonly skull: THREE.Object3D | null,
  ) {}

  /** Moves the hair on, once the body under it has been posed for this frame. */
  update(dt: number, feel: SpringFeel = this.feel): void {
    if (dt <= 0) return;
    const step = Math.min(dt, 1 / 30);
    this.time += step;
    this.root.updateWorldMatrix(true, true);
    const size = this.root.getWorldScale(scaled).x;
    // Gusts come and go, never quite still.
    const gust = 0.55 + 0.3 * Math.sin(this.time * 0.9) + 0.15 * Math.sin(this.time * 2.7 + 1);
    wind.copy(WIND_WAY).multiplyScalar(gust * feel.wind * size);
    let skullRadius = 0;
    if (this.skull) {
      this.skull.getWorldPosition(centre);
      // The head bone sits at the neck: the skull's a little above it.
      skullRadius = 0.13 * size;
      centre.y += skullRadius * 1.1;
    }
    for (const chain of this.chains) {
      for (const joint of chain) {
        const { bone } = joint;
        const parent = bone.parent;
        if (!parent) continue;
        bone.getWorldPosition(head);
        parent.getWorldQuaternion(parentTurn);
        const length = joint.length * size;
        restAxis.copy(joint.axis).applyQuaternion(joint.rest);
        if (!this.started) {
          joint.tail.copy(restAxis).applyQuaternion(parentTurn).multiplyScalar(length).add(head);
          joint.last.copy(joint.tail);
        }
        // Carried on, pulled back to rest, pulled down, blown.
        pull
          .copy(restAxis)
          .applyQuaternion(parentTurn)
          .multiplyScalar(length)
          .add(head)
          .sub(joint.tail);
        next
          .copy(joint.tail)
          .addScaledVector(toward.copy(joint.tail).sub(joint.last), 1 - feel.drag)
          .addScaledVector(pull, Math.min(1, feel.stiffness * step * (1.2 - joint.give * 0.5)))
          .addScaledVector(DOWN, feel.gravity * size * step * step * 60)
          .addScaledVector(wind, step * step * 60 * joint.give);
        // Held to its length, and kept out of the head.
        next.sub(head).setLength(length).add(head);
        if (this.skull) {
          const away = toward.copy(next).sub(centre);
          const room = skullRadius + 0.02 * size;
          if (away.length() < room) next.copy(centre).add(away.setLength(room));
        }
        joint.last.copy(joint.tail);
        joint.tail.copy(next);
        // Turn the bone to point at its new end.
        toward.copy(next).sub(head).applyQuaternion(undo.copy(parentTurn).invert()).normalize();
        bone.quaternion.setFromUnitVectors(restAxis, toward).multiply(joint.rest);
        bone.updateMatrixWorld(true);
      }
    }
    this.started = true;
  }

  /** Forgets how the hair was moving: for after a jump, so it doesn't whip across. */
  reset(): void {
    this.started = false;
  }
}
