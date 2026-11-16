// The Captain in a raid (docs/CHARACTERS.md, The way now): the game's own animator goes on moving
// the Rifleman as it always has, hidden, and the Captain follows him, frame by frame. His hips, chest
// and head turn as the Rifleman's do; his hands reach for where the Rifleman's are, so they close on
// the same rifle; and his feet go where the Rifleman's go, flat on the ground. No stock clips: the
// moves are the game's own, worn by a better body.

import * as THREE from "three";
import { type Captain, loadCaptain } from "./captain";
import type { HeroModel, HeroRig } from "./heroModels";

const q = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const v = new THREE.Vector3();
const v2 = new THREE.Vector3();

/** A bone turned the way another is turned, from how each stood at the start. */
interface Copied {
  from: THREE.Object3D;
  to: THREE.Object3D;
  /** Each's turn at the start, against its own frame (the Rifleman's root; the Captain's facing). */
  fromRest: THREE.Quaternion;
  toRest: THREE.Quaternion;
}

/** Two bones and the joint between, reaching for a point (an arm for a hand, a leg for a foot). */
interface Limb {
  root: THREE.Object3D;
  mid: THREE.Object3D;
  end: THREE.Object3D;
  /** Where the end goes, and which way the middle joint bends: the Rifleman's. */
  target: THREE.Object3D;
  pole: THREE.Object3D;
  a: number;
  b: number;
}

/** Turns a bone (in the world) so the way to `child` points at `to`, the least turn that does. */
function aim(bone: THREE.Object3D, child: THREE.Object3D, to: THREE.Vector3): void {
  const from = child.getWorldPosition(v).sub(bone.getWorldPosition(v2)).normalize();
  const want = to.clone().sub(v2).normalize();
  const turn = q.setFromUnitVectors(from, want);
  const parent = bone.parent?.getWorldQuaternion(q2) ?? q2.identity();
  const own = bone.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parent.invert().multiply(turn).multiply(own));
  bone.updateMatrixWorld(true);
}

/** Sets a bone's turn in the world. */
function setWorld(bone: THREE.Object3D, world: THREE.Quaternion): void {
  const parent = bone.parent?.getWorldQuaternion(q2) ?? q2.identity();
  bone.quaternion.copy(parent.invert().multiply(world));
  bone.updateMatrixWorld(true);
}

export class CaptainInRaid {
  /** Placed where the Rifleman is, facing his way; the Captain stands in it. */
  readonly root = new THREE.Group();
  private readonly frame = new THREE.Group();
  private readonly copied: Copied[] = [];
  private readonly limbs: Limb[] = [];
  private readonly hands: {
    hand: THREE.Object3D;
    knuckle: THREE.Object3D;
    from: THREE.Object3D;
    tips: THREE.Object3D;
  }[] = [];
  private readonly feet: { foot: THREE.Object3D; rest: THREE.Quaternion }[] = [];
  private readonly hip: THREE.Object3D | null;
  private readonly hipRest = new THREE.Vector3();
  private readonly leadHipRest = new THREE.Vector3();
  private readonly lead: THREE.Object3D;

  private constructor(
    private readonly captain: Captain,
    model: HeroModel,
    rig: HeroRig,
  ) {
    this.lead = model.root;
    const body = captain.model;
    this.frame.add(body);
    this.root.add(this.frame);
    // His own facing turned to the Rifleman's (+x), and his height made the Rifleman's.
    this.frame.rotation.y = Math.atan2(captain.forward.z, captain.forward.x);
    const lead = model.root;
    const leadTurn = lead.rotation.y;
    const leadAt = lead.position.clone();
    lead.rotation.y = 0;
    lead.position.set(0, 0, 0);
    lead.updateMatrixWorld(true);
    const tall = new THREE.Box3().setFromObject(lead).getSize(v).y;
    this.frame.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body);
    const scale = tall / Math.max(0.1, box.max.y - box.min.y);
    this.frame.scale.setScalar(scale);
    this.frame.position.y = -box.min.y * scale;
    this.root.updateMatrixWorld(true);

    const bone = (name: string) => body.getObjectByName(name) ?? null;
    const restIn = (b: THREE.Object3D, frame: THREE.Object3D) =>
      frame
        .getWorldQuaternion(new THREE.Quaternion())
        .invert()
        .multiply(b.getWorldQuaternion(new THREE.Quaternion()));
    const copy = (from: THREE.Object3D, name: string) => {
      const to = bone(name);
      if (to)
        this.copied.push({ from, to, fromRest: restIn(from, lead), toRest: restIn(to, this.root) });
    };
    copy(rig.lower, "CC_Base_Hip");
    copy(rig.upper, "CC_Base_Spine02");
    copy(rig.head, "CC_Base_Head");

    this.hip = bone("CC_Base_Hip");
    this.hip?.getWorldPosition(this.hipRest);
    this.root.worldToLocal(this.hipRest);
    rig.lower.getWorldPosition(this.leadHipRest);
    lead.worldToLocal(this.leadHipRest);

    const limb = (
      root: string,
      mid: string,
      end: string,
      target: THREE.Object3D,
      pole: THREE.Object3D,
    ) => {
      const r = bone(root);
      const m = bone(mid);
      const e = bone(end);
      if (!r || !m || !e) return;
      const a = r.getWorldPosition(new THREE.Vector3()).distanceTo(m.getWorldPosition(v));
      const b = m.getWorldPosition(new THREE.Vector3()).distanceTo(e.getWorldPosition(v));
      this.limbs.push({ root: r, mid: m, end: e, target, pole, a, b });
    };
    for (const [side, arm] of [
      ["R", rig.right],
      ["L", rig.left],
    ] as const) {
      limb(
        `CC_Base_${side}_Upperarm`,
        `CC_Base_${side}_Forearm`,
        `CC_Base_${side}_Hand`,
        arm.hand,
        arm.fore,
      );
      const hand = bone(`CC_Base_${side}_Hand`);
      const knuckle = bone(`CC_Base_${side}_Mid1`);
      if (hand && knuckle && arm.fingers) {
        this.hands.push({ hand, knuckle, from: arm.hand, tips: arm.fingers });
      }
    }
    rig.legs.forEach((_hip, i) => {
      const side = i === 0 ? "R" : "L";
      const knee = rig.knees[i];
      const foot = rig.feet[i];
      if (!knee || !foot) return;
      limb(`CC_Base_${side}_Thigh`, `CC_Base_${side}_Calf`, `CC_Base_${side}_Foot`, foot, knee);
      const f = bone(`CC_Base_${side}_Foot`);
      if (f) this.feet.push({ foot: f, rest: restIn(f, this.root) });
    });
    lead.rotation.y = leadTurn;
    lead.position.copy(leadAt);
    lead.updateMatrixWorld(true);

    // The Rifleman's body goes out of sight; what he holds stays, for the Captain's hands to hold.
    lead.traverse((o) => {
      if (o instanceof THREE.Mesh && !isUnder(o, rig.rifle)) o.visible = false;
    });
    captain.hands.clasp("L", 0.8);
    captain.hands.clasp("R", 0.8);
  }

  /**
   * Loads the Captain to follow a Rifleman, or null if he can't be had: his raid copy, or with
   * `full`, every triangle (for close-ups: aboard the boat).
   */
  static async follow(model: HeroModel, full = false): Promise<CaptainInRaid | null> {
    const rig = model.rig;
    if (!rig) return null;
    const captain = await loadCaptain({ raid: !full }).catch(() => null);
    return captain && new CaptainInRaid(captain, model, rig);
  }

  /** The Captain himself: his face, his hands, and how much of him is drawn. */
  get self(): Captain {
    return this.captain;
  }

  /** Call after the Rifleman's been moved this frame. */
  update(dt: number): void {
    const { lead, root } = this;
    root.visible = lead.visible;
    if (!lead.visible) return;
    root.position.copy(lead.position);
    root.quaternion.copy(lead.quaternion);
    lead.updateMatrixWorld(true);
    root.updateMatrixWorld(true);
    this.captain.update(dt, () => this.pose());
  }

  private pose(): void {
    const { lead, root } = this;
    const leadTurn = lead.getWorldQuaternion(new THREE.Quaternion());
    const ownTurn = root.getWorldQuaternion(new THREE.Quaternion());
    // The hips go up and down with the Rifleman's.
    if (this.hip) {
      const now = this.copied[0]?.from.getWorldPosition(new THREE.Vector3());
      if (now) {
        lead.worldToLocal(now).sub(this.leadHipRest);
        const at = root.localToWorld(this.hipRest.clone().add(now));
        this.hip.parent?.worldToLocal(at);
        this.hip.position.copy(at);
      }
    }
    // Hips, chest and head: turned from rest as his are.
    for (const c of this.copied) {
      const turned = leadTurn
        .clone()
        .invert()
        .multiply(c.from.getWorldQuaternion(new THREE.Quaternion()));
      const change = turned.multiply(c.fromRest.clone().invert());
      setWorld(c.to, ownTurn.clone().multiply(change).multiply(c.toRest));
    }
    // Arms and legs reach for the Rifleman's hands and feet, bending the way his do.
    for (const l of this.limbs) {
      const start = l.root.getWorldPosition(new THREE.Vector3());
      const target = l.target.getWorldPosition(new THREE.Vector3());
      const toward = target.clone().sub(start);
      const reach = Math.min(toward.length(), (l.a + l.b) * 0.999);
      const along = toward.normalize();
      const bend = l.pole.getWorldPosition(new THREE.Vector3()).sub(start);
      bend.addScaledVector(along, -bend.dot(along));
      if (bend.lengthSq() < 1e-8) bend.set(0, 0, 1).applyQuaternion(ownTurn);
      bend.normalize();
      const cos = Math.min(
        1,
        Math.max(-1, (l.a * l.a + reach * reach - l.b * l.b) / (2 * l.a * reach)),
      );
      const elbow = start
        .clone()
        .addScaledVector(along, l.a * cos)
        .addScaledVector(bend, l.a * Math.sqrt(1 - cos * cos));
      aim(l.root, l.mid, elbow);
      aim(l.mid, l.end, start.clone().addScaledVector(along, reach));
    }
    // Hands pointing where his do; feet flat, the way he faces.
    for (const h of this.hands) {
      const from = h.from.getWorldPosition(new THREE.Vector3());
      const to = h.tips.getWorldPosition(new THREE.Vector3()).sub(from);
      aim(h.hand, h.knuckle, h.hand.getWorldPosition(new THREE.Vector3()).add(to));
    }
    for (const f of this.feet) setWorld(f.foot, ownTurn.clone().multiply(f.rest));
  }
}

function isUnder(o: THREE.Object3D, parent: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === parent) return true;
  return false;
}
