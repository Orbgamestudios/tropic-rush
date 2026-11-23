// The rigged people in the game's world (docs/CHARACTERS.md, The way now): the game's own animator
// goes on moving a hero's block figure as it always has, hidden, and one of the people rigged as the
// Captain is (the Captain, the Rifleman, the Shaman, Professor Terror) follows it, frame by frame.
// Their hips, chest and head turn as the figure's do; their hands reach for where its hands are, so
// they close on the same weapon; and their feet go where its feet go, flat on the ground. No stock
// clips in a fight: the moves are the game's own, worn by a better body.

import * as THREE from "three";
import type { HeroKind } from "../logic/heroes";
import { type Captain, loadPerson, type Person } from "./captain";
import { namesUnder, UPPER_BODY_ROOT } from "./clipLibrary";
import type { HeroModel, HeroRig } from "./heroModels";

const q = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const v = new THREE.Vector3();
const v2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
/** How far the fingers curl on an empty hand. */
const RELAXED = 0.2;

/** A bone turned the way another is turned, from how each stood at the start. */
interface Copied {
  from: THREE.Object3D;
  to: THREE.Object3D;
  /** Each's turn at the start, against its own frame (the figure's root; the person's facing). */
  fromRest: THREE.Quaternion;
  toRest: THREE.Quaternion;
}

/** Two bones and the joint between, reaching for a point (an arm for a hand, a leg for a foot). */
interface Limb {
  root: THREE.Object3D;
  mid: THREE.Object3D;
  end: THREE.Object3D;
  /** Where the end goes, and which way the middle joint bends: the figure's. */
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

/** Who wears a hero's moves, for the heroes who are one of the rigged people; null for the rest. */
export function personFor(kind: HeroKind): Person | null {
  return kind === "captain" || kind === "rifleman" ? kind : null;
}

export class PersonInRaid {
  /** Placed where the figure is, facing its way; the person stands in it. */
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
  /** What the figure holds, in the person's hands while they fight. */
  private readonly rifle: THREE.Object3D;
  /** The same rifle slung across their back, while they aren't fighting (pistols are put away). */
  private readonly slung: THREE.Object3D | null;
  /** Every bone, and where the stock clips put each this frame, to blend towards. */
  private readonly bones: THREE.Object3D[] = [];
  private readonly upper: boolean[] = [];
  private readonly clipPose: THREE.Quaternion[] = [];
  private readonly clipHip = new THREE.Vector3();
  /** Which way is forward for his hips, in their own space (from how he stands at rest). */
  private readonly hipFront = new THREE.Vector3();
  /**
   * How much of them is on the stock clips rather than the figure's moves, eased so a change never
   * pops: all of him, standing about on deck; his upper body, walking on deck (arms swinging, not
   * holding a rifle that isn't there).
   */
  private whole = 0;
  private upperBody = 0;

  private constructor(
    private readonly captain: Captain,
    model: HeroModel,
    rig: HeroRig,
    /** Whether they carry what the figure does: a story figure walking about doesn't. */
    private readonly armed: boolean,
    /** The figure's parts that were showing before it went out of sight. */
    hidden: readonly THREE.Mesh[],
  ) {
    this.lead = model.root;
    this.rifle = rig.rifle;
    const body = captain.model;
    const above = namesUnder(body, UPPER_BODY_ROOT);
    body.traverse((o) => {
      if (o instanceof THREE.Bone) {
        this.bones.push(o);
        this.upper.push(above.has(o.name));
        this.clipPose.push(new THREE.Quaternion());
      }
    });
    this.frame.add(body);
    this.root.add(this.frame);
    // Their own facing turned to the figure's (+x), and their height made the figure's.
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
    if (this.hip) {
      this.hipFront
        .set(1, 0, 0)
        .applyQuaternion(this.root.getWorldQuaternion(q))
        .applyQuaternion(this.hip.getWorldQuaternion(q2).invert());
    }
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
    // A copy of the rifle slung across their back, barrel up over the left shoulder. Anything
    // shorter than a rifle (the Captain's pistols) is simply put away.
    const spine = bone("CC_Base_Spine02");
    this.slung = null;
    rig.rifle.updateMatrixWorld(true);
    const carried = new THREE.Box3().setFromObject(rig.rifle).getSize(new THREE.Vector3());
    if (spine && armed && Math.max(carried.x, carried.y, carried.z) > 0.5) {
      const slung = rig.rifle.clone(true);
      slung.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true;
      });
      // The rifle's model isn't centred on its own origin, nor long along a known axis: measured,
      // so its middle sits against his back and its length runs across it.
      slung.position.set(0, 0, 0);
      slung.quaternion.identity();
      slung.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(slung);
      const size = box.getSize(new THREE.Vector3());
      const mid = box.getCenter(new THREE.Vector3());
      const long =
        size.x >= size.y && size.x >= size.z
          ? new THREE.Vector3(1, 0, 0)
          : size.y >= size.z
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(0, 0, 1);
      slung.quaternion.setFromUnitVectors(long, new THREE.Vector3(-0.08, 0.8, -0.6).normalize());
      const back = spine.getWorldPosition(new THREE.Vector3());
      back.x -= tall * 0.085;
      slung.position.copy(back).sub(mid.applyQuaternion(slung.quaternion));
      slung.updateMatrixWorld(true);
      this.root.add(slung);
      spine.attach(slung);
      slung.visible = false;
      this.slung = slung;
    }
    lead.rotation.y = leadTurn;
    lead.position.copy(leadAt);
    lead.updateMatrixWorld(true);

    // The figure's body stays out of sight (see follow); what it holds comes back, for the person's
    // hands to hold.
    for (const mesh of hidden) if (armed && isUnder(mesh, rig.rifle)) mesh.visible = true;
    const grip = armed ? 0.8 : RELAXED;
    captain.hands.clasp("L", grip);
    captain.hands.clasp("R", grip);
  }

  /**
   * Loads one of the people to follow a hero's figure, or null if they can't be had (offline): the
   * light copy, or with `full`, the full one too for close-ups. `armed` false for someone who
   * carries nothing (the Shaman, Terror).
   */
  static async follow(
    model: HeroModel,
    who: Person,
    options: { full?: boolean; armed?: boolean } = {},
  ): Promise<PersonInRaid | null> {
    const rig = model.rig;
    if (!rig) return null;
    // Nothing stands in for them while they're fetched (the owner's call, 2026-11-23): the figure
    // goes out of sight now, and comes back only if they can't be had at all, so a hero is never
    // missing from a fight.
    const hidden: THREE.Mesh[] = [];
    model.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.visible) hidden.push(o);
    });
    for (const mesh of hidden) mesh.visible = false;
    const person = await loadPerson(who, { raid: !options.full }).catch(() => null);
    if (!person) {
      for (const mesh of hidden) mesh.visible = true;
      return null;
    }
    return new PersonInRaid(person, model, rig, options.armed ?? true, hidden);
  }

  /** The person themself: their face, their hands, and how much of them is drawn. */
  get self(): Captain {
    return this.captain;
  }

  /**
   * Call after the figure's been moved this frame. `fight`: the figure's moves, weapon in hand.
   * Aboard, nothing to fight: `deck-still` he stands about on the stock clips, `deck-walk` his legs
   * walk as the figure's do while their arms swing loose, the rifle slung on their back either way.
   */
  update(dt: number, mode: "fight" | "deck-still" | "deck-walk" = "fight"): void {
    const { lead, root } = this;
    root.visible = lead.visible;
    if (!lead.visible) return;
    root.position.copy(lead.position);
    root.quaternion.copy(lead.quaternion);
    lead.updateMatrixWorld(true);
    root.updateMatrixWorld(true);
    const clips = this.captain.player !== null;
    const ease = 1 - Math.exp(-dt * 5);
    this.whole += ((mode === "deck-still" && clips ? 1 : 0) - this.whole) * ease;
    this.upperBody += ((mode !== "fight" && clips ? 1 : 0) - this.upperBody) * ease;
    const away = Math.max(this.whole, this.upperBody);
    // The rifle goes from their back to their hands halfway through their arms coming round to it.
    const holding = (away < 0.5 || !clips) && this.armed;
    this.rifle.visible = holding;
    if (this.slung) this.slung.visible = !holding && this.armed;
    const grip = this.armed ? 0.8 - 0.55 * away : RELAXED;
    this.captain.hands.clasp("L", grip);
    this.captain.hands.clasp("R", grip);
    const blending = away > 0.001 && clips;
    this.captain.update(dt, () => {
      if (blending) {
        this.captain.clipStep(dt, mode === "deck-walk" ? "stroll" : "stand");
        this.bones.forEach((b, i) => {
          this.clipPose[i]?.copy(b.quaternion);
        });
        if (this.hip) this.clipHip.copy(this.hip.position);
      }
      this.pose();
      if (!blending) return;
      this.bones.forEach((b, i) => {
        const to = this.clipPose[i];
        if (to) b.quaternion.slerp(to, this.upper[i] ? away : this.whole);
      });
      this.hip?.position.lerp(this.clipHip, this.whole);
      this.faceFront(this.whole);
    });
  }

  /**
   * Turns him back to face the way he's been put, by `amount` (0 to 1): the stock take he stands
   * about on is a man pacing, and it turned him round, so at the console he stood with his back to it.
   */
  private faceFront(amount: number): void {
    const hip = this.hip;
    if (!hip || amount <= 0.001) return;
    this.root.updateMatrixWorld(true);
    const turn = hip.getWorldQuaternion(new THREE.Quaternion());
    const now = v.copy(this.hipFront).applyQuaternion(turn);
    const want = v2.set(1, 0, 0).applyQuaternion(this.root.getWorldQuaternion(q));
    if (now.x * now.x + now.z * now.z < 1e-6 || want.x * want.x + want.z * want.z < 1e-6) return;
    let yaw = Math.atan2(now.z, now.x) - Math.atan2(want.z, want.x);
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    setWorld(hip, q.setFromAxisAngle(UP, yaw * amount).multiply(turn));
  }

  private pose(): void {
    const { lead, root } = this;
    const leadTurn = lead.getWorldQuaternion(new THREE.Quaternion());
    const ownTurn = root.getWorldQuaternion(new THREE.Quaternion());
    // The hips go up and down with the figure's.
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
    // Arms and legs reach for the figure's hands and feet, bending the way its do.
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
