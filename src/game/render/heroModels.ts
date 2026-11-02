// The heroes, built from rounded primitives in a chunky, big-headed toy style: faces with eyes,
// brows and ears, jointed arms that hold each hero's weapon, boots, belts, webbing and backpacks,
// and each hero's own hair, headgear and kit. Models face +x and stand on y = 0. They stay
// stand-ins until GLB models arrive from the art pipeline (see heroAssets.ts).

import * as THREE from "three";
import type { HeroKind } from "../logic/heroes";
import { COLORS as C, material } from "./palette";
import { AT_EASE, RiflemanAnimator } from "./riflemanAnimator";
import { at, ball, barrel, capsule, cone, cyl, mesh, rbox } from "./shapes";

type Pair = [THREE.Object3D, THREE.Object3D];

/** One of the Rifleman's arms: the shoulder is fixed, the rest is laid out by inverse kinematics. */
export interface RifleArm {
  shoulder: THREE.Vector3;
  upper: THREE.Object3D;
  fore: THREE.Object3D;
  hand: THREE.Object3D;
  upperLength: number;
  foreLength: number;
  /** Where the hand ends up when he's down. */
  rest: THREE.Vector3;
}

/** The joints riflemanAnimator.ts moves. */
export interface RifleRig {
  outer: THREE.Group;
  /** Hips and legs, which turn towards the way he's going. */
  lower: THREE.Group;
  /** Chest, head and arms, which stay on his aim. */
  upper: THREE.Group;
  /** How high the waist is. */
  spine: number;
  head: THREE.Group;
  legs: Pair;
  knees: Pair;
  feet: Pair;
  rifle: THREE.Group;
  /** The end of the barrel. */
  muzzle: THREE.Object3D;
  right: RifleArm;
  left: RifleArm;
}

export interface HeroModel {
  root: THREE.Group;
  /** Bobs and leans while moving. */
  body: THREE.Group;
  legs: Pair | null;
  /** Only the Rifleman has a full rig so far. */
  rig: RifleRig | null;
  /** Height of the top of the model, for health bars. */
  height: number;
}

type Human = Exclude<HeroKind, "tank">;

interface Look {
  shirt: number;
  pants: number;
  skin: number;
  /** Width multiplier: the Heavy is broad, the Medic slight. */
  bulk: number;
  /** Bare arms (rolled sleeves or a tank top). */
  bareArms: boolean;
  boots: number;
}

const LOOKS: Record<Human, Look> = {
  rifleman: {
    shirt: C.crewBlue,
    pants: 0x3f6fa8,
    skin: C.skin,
    bulk: 1,
    bareArms: false,
    boots: 0x4a3324,
  },
  medic: {
    shirt: 0x5f95d0,
    pants: 0x3f6fa8,
    skin: 0xf6cfb0,
    bulk: 0.9,
    bareArms: false,
    boots: 0x5a3d2a,
  },
  heavy: {
    shirt: C.crewBlue,
    pants: 0x6a5038,
    skin: C.skinDark,
    bulk: 1.38,
    bareArms: true,
    boots: 0x2e2620,
  },
  bazooka: {
    shirt: C.crewBlue,
    pants: C.khaki,
    skin: 0xd9a27c,
    bulk: 0.95,
    bareArms: true,
    boots: 0x3a2c22,
  },
  grenadier: {
    shirt: C.cream,
    pants: C.olive,
    skin: C.skin,
    bulk: 1.05,
    bareArms: false,
    boots: 0x6a4329,
  },
  engineer: {
    shirt: C.teal,
    pants: C.denim,
    skin: 0xe9b48e,
    bulk: 1.12,
    bareArms: false,
    boots: 0x3d2a1e,
  },
};

const INK = 0x1f2430;
const WHITE = 0xffffff;

/** A capsule stretched between two points: arms, straps, barrels at an angle. */
function limb(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number): THREE.Mesh {
  const length = a.distanceTo(b);
  const m = mesh(new THREE.CapsuleGeometry(radius, Math.max(0.001, length), 4, 10), color);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function glossy(color: number): THREE.MeshLambertMaterial {
  return material(color);
}

/** Eyes, brows, nose, mouth and ears on a head centered at (0, y, 0) facing +x. */
function face(
  head: THREE.Group,
  r: number,
  skin: number,
  options: {
    brow?: number;
    brows?: "stern" | "kind" | "bushy";
    mouth?: "grin" | "line" | "smile";
  } = {},
): void {
  const brow = options.brow ?? 0x3a2a1e;
  for (const side of [1, -1]) {
    const z = side * r * 0.36;
    const white = new THREE.Mesh(new THREE.SphereGeometry(r * 0.21, 14, 10), glossy(WHITE));
    white.scale.set(0.55, 1.12, 0.9);
    head.add(at(white, r * 0.86, r * 0.1, z));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 12, 8), glossy(INK));
    pupil.scale.set(0.5, 1.1, 0.9);
    head.add(at(pupil, r * 0.96, r * 0.07, z * 0.96));
    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.04, 8, 6),
      material(WHITE, { emissive: 0x666666 }),
    );
    head.add(at(shine, r * 1.01, r * 0.14, z * 0.9 + side * r * 0.03));
    // Brows: stern ones slope down to the nose.
    const style = options.brows ?? "kind";
    const browMesh = mesh(
      new THREE.CapsuleGeometry(style === "bushy" ? r * 0.07 : r * 0.045, r * 0.26, 3, 8),
      brow,
    );
    const tilt = style === "stern" ? side * 0.35 : style === "kind" ? -side * 0.15 : 0;
    head.add(at(browMesh, r * 0.88, r * 0.38, z, Math.PI / 2 + tilt, 0, 0));
    // Ears.
    const ear = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 10, 8), material(skin));
    ear.scale.set(0.7, 1, 0.45);
    head.add(at(ear, -r * 0.05, r * 0.02, side * r * 0.98));
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 10, 8), material(skin));
  nose.scale.set(1, 0.9, 1.1);
  head.add(at(nose, r * 1.0, -r * 0.1, 0));
  const mouthStyle = options.mouth ?? "smile";
  if (mouthStyle === "line") {
    head.add(at(rbox(r * 0.06, r * 0.05, r * 0.36, 0x7a3a2e), r * 0.93, -r * 0.38, 0));
  } else {
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(r * (mouthStyle === "grin" ? 0.22 : 0.16), r * 0.035, 6, 14, Math.PI),
      material(0x7a3a2e),
    );
    head.add(at(smile, r * 0.9, -r * 0.2, 0, 0, Math.PI / 2, Math.PI));
    if (mouthStyle === "grin") {
      const teeth = rbox(r * 0.05, r * 0.08, r * 0.3, WHITE);
      head.add(at(teeth, r * 0.92, -r * 0.42, 0));
    }
  }
}

/** A soldier's helmet: dome, brim and chin strap. */
function helmet(r: number, color: number, trim: number): THREE.Group {
  const g = new THREE.Group();
  const dome = ball(r * 1.12, color, 20);
  dome.scale.set(1.04, 0.78, 1.04);
  g.add(at(dome, -r * 0.04, r * 0.55, 0));
  g.add(at(cyl(r * 1.24, r * 1.28, r * 0.1, trim, 22), -r * 0.04, r * 0.44, 0));
  const strap = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.95, r * 0.04, 5, 20, Math.PI),
    material(0x5a4030),
  );
  // Down the cheeks and under the chin.
  g.add(at(strap, -r * 0.1, r * 0.42, 0, 0, Math.PI / 2, Math.PI));
  return g;
}

interface Built {
  outer: THREE.Group;
  lower: THREE.Group;
  upper: THREE.Group;
  spine: number;
  /** Inside the upper body, in feet-up coordinates: where gear goes. */
  body: THREE.Group;
  legs: Pair;
  knees: Pair;
  feet: Pair;
  head: THREE.Group;
  /** Where the hands hold the weapon (center between both hands). */
  grip: THREE.Vector3;
  headRadius: number;
  look: Look;
  /** Right, then left: only when the arms are left loose for animation. */
  arms: RifleArm[];
}

/** The shared body: boots, legs, belt, torso, neck, head with a face, arms reaching the grip. */
function person(
  kind: Human,
  grip: THREE.Vector3,
  faceOptions: Parameters<typeof face>[3],
  loose = false,
): Built {
  const look = LOOKS[kind];
  const k = look.bulk;
  const outer = new THREE.Group();
  const lower = new THREE.Group();
  outer.add(lower);

  const hip = 0.74;
  // The upper body turns about the waist. `body` inside it keeps the feet-up coordinates, so gear
  // can be placed as if nothing were jointed.
  const spine = hip + 0.2;
  const upper = at(new THREE.Group(), 0, spine, 0);
  const body = at(new THREE.Group(), 0, -spine, 0);
  upper.add(body);
  outer.add(upper);

  const makeLeg = (z: number) => {
    const pivot = at(new THREE.Group(), 0, hip, z);
    pivot.add(at(capsule(0.14 * Math.sqrt(k), 0.16, look.pants), 0, -0.16, 0));
    const knee = at(new THREE.Group(), 0, -0.36, 0);
    knee.add(at(capsule(0.135 * Math.sqrt(k), 0.14, look.pants), 0, -0.13, 0));
    // Boot with a darker sole and the toe forward.
    const foot = at(new THREE.Group(), 0, -0.27, 0);
    foot.add(at(rbox(0.36, 0.2, 0.25, look.boots), 0.06, 0, 0));
    foot.add(at(rbox(0.38, 0.06, 0.27, 0x231a14), 0.06, -0.09, 0));
    knee.add(foot);
    pivot.add(knee);
    lower.add(pivot);
    return { pivot, knee, foot };
  };
  const right = makeLeg(0.15 * k);
  const left = makeLeg(-0.15 * k);
  const legs: Pair = [right.pivot, left.pivot];

  // Hips and belt with a buckle and pouches.
  lower.add(at(rbox(0.46 * Math.sqrt(k), 0.24, 0.56 * k, look.pants), 0, hip + 0.06, 0));
  lower.add(at(rbox(0.5 * Math.sqrt(k), 0.1, 0.6 * k, 0x5a3d26), 0, hip + 0.17, 0));
  lower.add(at(rbox(0.06, 0.1, 0.12, C.gold), 0.25 * Math.sqrt(k), hip + 0.17, 0));
  for (const z of [0.2, -0.2])
    lower.add(at(rbox(0.14, 0.15, 0.13, C.khaki), 0.2 * Math.sqrt(k), hip + 0.12, z * k));

  // Torso: a rounded block, wider at the shoulders.
  const torso = rbox(0.44 * Math.sqrt(k), 0.5, 0.6 * k, look.shirt);
  body.add(at(torso, 0, hip + 0.47, 0));
  const chest = rbox(0.4 * Math.sqrt(k), 0.18, 0.68 * k, look.shirt);
  body.add(at(chest, 0, hip + 0.62, 0));
  // Collar.
  body.add(at(rbox(0.3, 0.07, 0.36, look.shirt), 0.04, hip + 0.74, 0));
  // Neck and head.
  const r = 0.33;
  body.add(at(cyl(0.12, 0.13, 0.14, look.skin, 10), 0, hip + 0.8, 0));
  const head = at(new THREE.Group(), 0.02, hip + 0.8 + r * 0.95, 0);
  const skull = ball(r, look.skin, 22);
  skull.scale.set(0.98, 0.96, 1);
  head.add(skull);
  face(head, r, look.skin, faceOptions);
  body.add(head);

  // Arms from the shoulders to the hands on the weapon.
  const sleeve = look.bareArms ? look.skin : look.shirt;
  const arms: RifleArm[] = [];
  for (const side of [1, -1]) {
    const shoulder = v(0, hip + 0.64, side * 0.36 * k);
    const hand = v(grip.x + (side > 0 ? 0.12 : -0.12), grip.y, grip.z + side * 0.08);
    const elbow = v(0.06, hip + 0.32, side * 0.4 * k);
    body.add(at(ball(0.13 * Math.sqrt(k), look.shirt, 12), shoulder.x, shoulder.y, shoulder.z));
    if (loose) {
      // Upright capsules the animator lays along each arm bone, and a hand it moves.
      const upperLength = 0.34;
      const foreLength = 0.36;
      const upperArm = capsule(0.09 * Math.sqrt(k), upperLength, sleeve);
      const fore = capsule(0.085 * Math.sqrt(k), foreLength, sleeve);
      fore.add(at(capsule(0.1, 0.05, look.shirt), 0, -foreLength * 0.26, 0));
      const palm = ball(0.1, 0x4a3a2c, 10);
      body.add(upperArm, fore, palm);
      const rest = v(0.02, hip - 0.02, side * 0.46 * k);
      arms.push({ shoulder, upper: upperArm, fore, hand: palm, upperLength, foreLength, rest });
      continue;
    }
    body.add(limb(shoulder, elbow, 0.09 * Math.sqrt(k), sleeve));
    body.add(limb(elbow, hand, 0.085 * Math.sqrt(k), look.bareArms ? look.skin : sleeve));
    if (!look.bareArms) {
      // A rolled cuff at the wrist.
      const cuff = limb(
        hand.clone().lerp(elbow, 0.32),
        hand.clone().lerp(elbow, 0.2),
        0.1,
        look.shirt,
      );
      body.add(cuff);
    }
    body.add(at(ball(0.1, 0x4a3a2c, 10), hand.x, hand.y, hand.z));
  }
  const knees: Pair = [right.knee, left.knee];
  const feet: Pair = [right.foot, left.foot];
  return {
    outer,
    lower,
    upper,
    spine,
    body,
    legs,
    knees,
    feet,
    head,
    grip,
    headRadius: r,
    look,
    arms,
  };
}

/** A strap across the chest from one shoulder to the opposite hip. */
function bandolier(built: Built, color: number, studs: number | null): void {
  const k = built.look.bulk;
  const from = v(0.24 * Math.sqrt(k), 1.36, 0.3 * k);
  const to = v(0.24 * Math.sqrt(k), 0.9, -0.3 * k);
  built.body.add(limb(from, to, 0.05, color));
  if (studs !== null) {
    for (let i = 1; i < 6; i++) {
      const p = from.clone().lerp(to, i / 6);
      const bullet = cyl(0.03, 0.035, 0.12, studs, 8);
      bullet.position.copy(p).add(v(0.04, 0, 0));
      bullet.rotation.x = 0.85;
      built.body.add(bullet);
    }
  }
}

function backpack(built: Built, color: number, roll: number | null): THREE.Group {
  const k = built.look.bulk;
  const g = at(new THREE.Group(), -0.32 * Math.sqrt(k), 1.12, 0);
  g.add(rbox(0.26, 0.48, 0.48 * k, color));
  g.add(at(rbox(0.08, 0.2, 0.34 * k, color), -0.15, -0.06, 0));
  if (roll !== null) g.add(at(cyl(0.11, 0.11, 0.56 * k, roll, 12), 0, 0.31, 0, Math.PI / 2, 0, 0));
  built.body.add(g);
  return g;
}

function rifle(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(rbox(0.34, 0.12, 0.08, C.wood), -0.22, -0.03, 0));
  g.add(at(rbox(0.42, 0.11, 0.09, 0x2f3338), 0.12, 0.02, 0));
  g.add(at(barrel(0.026, 0.52, 0x24272b, 8), 0.32, 0.04, 0));
  g.add(at(rbox(0.18, 0.06, 0.08, C.wood), 0.42, -0.01, 0));
  g.add(at(rbox(0.07, 0.2, 0.06, 0x2f3338), 0.12, -0.12, 0, 0, 0, -0.2));
  g.add(at(cyl(0.035, 0.035, 0.2, 0x1b1d20, 10), 0.08, 0.12, 0, 0, 0, Math.PI / 2));
  g.add(at(rbox(0.04, 0.05, 0.03, 0x2f3338), 0.78, 0.06, 0));
  return g;
}

function minigun(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(rbox(0.5, 0.26, 0.26, 0x3a3e44), 0, 0, 0));
  g.add(at(cyl(0.2, 0.2, 0.18, 0x55595f, 14), -0.28, -0.1, 0.16, Math.PI / 2, 0, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(at(barrel(0.035, 0.85, 0x24272b, 8), 0.2, Math.cos(a) * 0.09, Math.sin(a) * 0.09));
  }
  g.add(at(cyl(0.14, 0.14, 0.05, 0x55595f, 14), 0.6, 0, 0, 0, 0, Math.PI / 2));
  g.add(at(cyl(0.14, 0.14, 0.05, 0x55595f, 14), 1.0, 0, 0, 0, 0, Math.PI / 2));
  g.add(at(rbox(0.1, 0.24, 0.06, 0x2a2d31), -0.05, 0.22, 0, 0, 0, 0.4));
  return g;
}

function bazookaTube(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(barrel(0.15, 1.6, 0x6f7a4a, 16), -0.7, 0, 0));
  g.add(at(cyl(0.2, 0.15, 0.22, 0x5d6640, 16), -0.78, 0, 0, 0, 0, Math.PI / 2));
  g.add(at(cyl(0.17, 0.17, 0.1, C.crewBlue, 16), 0.86, 0, 0, 0, 0, Math.PI / 2));
  g.add(at(cyl(0.17, 0.17, 0.08, C.crewBlue, 16), -0.2, 0, 0, 0, 0, Math.PI / 2));
  g.add(at(rbox(0.12, 0.16, 0.06, 0x2f3338), 0.25, 0.2, 0));
  g.add(at(rbox(0.06, 0.22, 0.06, 0x2f3338), 0.05, -0.2, 0));
  // A rocket peeking out of the front.
  g.add(at(cone(0.1, 0.24, 0xe5503a, 12), 0.98, 0, 0, 0, 0, -Math.PI / 2));
  return g;
}

function healingBottle(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(rbox(0.32, 0.14, 0.12, 0x3fa34d), 0, 0, 0));
  g.add(at(barrel(0.04, 0.36, 0x9aa3ad, 10), 0.14, 0.02, 0));
  g.add(
    at(
      cyl(0.07, 0.05, 0.08, 0x7dff9a, 12, { emissive: 0x2a8a45 }),
      0.52,
      0.02,
      0,
      0,
      0,
      Math.PI / 2,
    ),
  );
  g.add(at(rbox(0.06, 0.16, 0.08, 0xd8dde3), -0.04, -0.12, 0, 0, 0, -0.2));
  // A white plus on the side.
  g.add(at(rbox(0.12, 0.04, 0.01, WHITE), 0, 0, 0.065));
  g.add(at(rbox(0.04, 0.12, 0.01, WHITE), 0, 0, 0.065));
  return g;
}

function wrench(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(rbox(0.5, 0.07, 0.05, 0x9aa3ad), 0.1, 0, 0));
  const jaw = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.035, 6, 12, Math.PI * 1.4),
    material(0x9aa3ad),
  );
  g.add(at(jaw, 0.4, 0, 0, 0, 0, -0.7));
  g.add(at(rbox(0.2, 0.1, 0.07, 0xe5503a), -0.08, 0, 0));
  return g;
}

function grenade(color = 0x6d7a45): THREE.Group {
  const g = new THREE.Group();
  const body = ball(0.1, color, 12);
  body.scale.set(1, 1.15, 1);
  g.add(body);
  g.add(at(cyl(0.04, 0.05, 0.06, 0x9aa3ad, 8), 0, 0.12, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 5, 10), material(0xd8dde3));
  g.add(at(ring, 0.04, 0.16, 0, Math.PI / 2, 0, 0));
  return g;
}

function human(kind: Human): HeroModel {
  let built: Built;
  let gun: THREE.Group | null = null;
  switch (kind) {
    case "rifleman": {
      built = person(kind, v(0.42, 1.0, 0.02), { brows: "stern", mouth: "line" }, true);
      const { head, headRadius: r, body } = built;
      head.add(at(helmet(r, C.crewBlue, C.crewBlueDark), 0, 0, 0));
      // A grey moustache and stubbly chin.
      const tache = capsule(r * 0.08, r * 0.38, 0x8a7a6a);
      head.add(at(tache, r * 0.98, -r * 0.24, 0, Math.PI / 2, 0, 0));
      bandolier(built, 0x5a4030, C.gold);
      backpack(built, 0x58704a, 0x8a7a5a);
      gun = rifle();
      body.add(gun);
      // Dog tags.
      body.add(at(rbox(0.02, 0.07, 0.05, 0xd8dde3), 0.24, 1.3, 0.05));
      break;
    }
    case "medic": {
      built = person(kind, v(0.38, 1.0, 0), { brows: "kind", mouth: "smile", brow: 0xc9a040 });
      const { head, headRadius: r, body } = built;
      const hair = ball(r * 1.06, C.hairBlonde, 18);
      hair.scale.set(1, 0.95, 1.04);
      head.add(at(hair, -r * 0.14, r * 0.12, 0));
      // Fringe over the forehead and a high ponytail.
      const fringe = ball(r * 0.6, C.hairBlonde, 12);
      fringe.scale.set(0.5, 0.5, 1.4);
      head.add(at(fringe, r * 0.62, r * 0.6, 0));
      head.add(at(ball(r * 0.3, C.hairBlonde, 12), -r * 0.7, r * 0.7, 0));
      head.add(at(capsule(r * 0.2, r * 0.7, C.hairBlonde), -r * 1.05, r * 0.2, 0, 0, 0, 0.5));
      head.add(at(cyl(r * 0.2, r * 0.2, r * 0.1, 0xe5503a, 10), -r * 0.82, r * 0.6, 0, 0, 0, 0.9));
      // Round glasses.
      for (const z of [0.12, -0.12]) {
        const lens = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 6, 16), material(INK));
        head.add(at(lens, r * 1.0, r * 0.08, z, 0, Math.PI / 2, 0));
      }
      head.add(at(rbox(0.02, 0.02, 0.08, INK), r * 1.02, r * 0.1, 0));
      // A white cap with a red cross.
      const cap = cyl(r * 0.9, r * 0.98, r * 0.4, WHITE, 18);
      head.add(at(cap, -r * 0.05, r * 0.82, 0, 0, 0, 0.12));
      head.add(at(rbox(0.02, 0.05, 0.16, 0xe5503a), r * 0.82, r * 0.86, 0));
      head.add(at(rbox(0.02, 0.16, 0.05, 0xe5503a), r * 0.82, r * 0.86, 0));
      // Armband and a medical tank on her back, with a bottle in her hand to throw.
      body.add(at(cyl(0.11, 0.11, 0.08, WHITE, 10), 0.03, 1.15, 0.37));
      const pack = backpack(built, 0xe9eef3, null);
      pack.add(at(rbox(0.02, 0.18, 0.06, 0xe5503a), -0.14, 0.02, 0));
      pack.add(at(rbox(0.02, 0.06, 0.18, 0xe5503a), -0.14, 0.02, 0));
      pack.add(at(cyl(0.1, 0.1, 0.5, 0x7dc98a, 12), -0.02, 0.05, 0.22));
      body.add(limb(v(-0.3, 1.0, 0.25), v(0.3, 0.95, 0.1), 0.025, 0x3a3e44));
      body.add(at(healingBottle(), built.grip.x, built.grip.y, built.grip.z));
      break;
    }
    case "heavy": {
      built = person(kind, v(0.42, 0.96, 0), { brows: "bushy", mouth: "grin", brow: 0x15161a });
      const { head, headRadius: r, body } = built;
      // Flat-top hair and a full beard.
      head.add(at(rbox(r * 1.5, r * 0.5, r * 1.6, C.hairBlack), -r * 0.1, r * 0.78, 0));
      const beard = ball(r * 0.85, C.hairBlack, 14);
      beard.scale.set(0.7, 0.75, 1.05);
      head.add(at(beard, r * 0.48, -r * 0.5, 0));
      // The beard leaves room for the grin.
      head.add(at(rbox(r * 0.1, r * 0.18, r * 0.5, 0x7a3a2e), r * 0.95, -r * 0.3, 0));
      head.add(at(rbox(r * 0.06, r * 0.08, r * 0.4, WHITE), r * 1.0, -r * 0.27, 0));
      // Headband.
      head.add(at(cyl(r * 1.0, r * 1.0, r * 0.18, 0xe5503a, 18), 0, r * 0.42, 0));
      bandolier(built, 0x3a2a1e, C.gold);
      // Ammo drum on his back feeding the minigun.
      const pack = backpack(built, 0x3a3e44, null);
      pack.add(at(cyl(0.24, 0.24, 0.3, 0x55595f, 16), -0.05, -0.1, 0, Math.PI / 2, 0, 0));
      body.add(limb(v(-0.3, 0.95, -0.2), v(0.3, 0.86, -0.12), 0.04, C.gold));
      body.add(at(minigun(), built.grip.x, built.grip.y, built.grip.z));
      break;
    }
    case "bazooka": {
      built = person(kind, v(0.2, 1.42, 0.24), { brows: "stern", mouth: "smile", brow: 0x1b1b1b });
      const { head, headRadius: r, body } = built;
      // Backwards cap over dark hair, and aviator shades.
      const hair = ball(r * 1.04, C.hairBlack, 16);
      hair.scale.set(1, 0.9, 1.04);
      head.add(at(hair, -r * 0.12, r * 0.16, 0));
      const cap = ball(r * 1.02, C.crewBlue, 18);
      cap.scale.set(1, 0.6, 1);
      head.add(at(cap, -r * 0.04, r * 0.48, 0));
      head.add(at(rbox(r * 0.8, r * 0.08, r * 0.9, C.crewBlueDark), -r * 1.05, r * 0.38, 0));
      for (const z of [0.12, -0.12]) {
        const lens = ball(0.085, 0x1b1d22, 12);
        lens.material = material(0x1b1d22);
        lens.scale.set(0.35, 0.8, 1);
        head.add(at(lens, r * 0.98, r * 0.1, z));
      }
      head.add(at(rbox(0.02, 0.02, 0.1, 0xc9a040), r * 1.01, r * 0.14, 0));
      // The tube rides on his right shoulder, aimed forward.
      body.add(at(bazookaTube(), 0.0, 1.5, 0.3));
      const pack = backpack(built, 0x6f7a4a, null);
      for (const z of [0.12, -0.12]) pack.add(at(cone(0.08, 0.3, 0xe5503a, 10), -0.02, 0.36, z));
      break;
    }
    case "grenadier": {
      built = person(kind, v(0.34, 1.02, -0.12), {
        brows: "bushy",
        mouth: "smile",
        brow: 0xb5652a,
      });
      const { head, headRadius: r, body } = built;
      // Safari helmet and a big ginger handlebar moustache.
      const pith = ball(r * 1.12, 0xe3d3a3, 18);
      pith.scale.set(1.08, 0.72, 1.04);
      head.add(at(pith, -r * 0.03, r * 0.62, 0));
      head.add(at(cyl(r * 1.45, r * 1.5, r * 0.08, 0xe3d3a3, 24), -r * 0.03, r * 0.46, 0));
      head.add(at(cyl(r * 1.13, r * 1.13, r * 0.14, C.brown, 20), -r * 0.03, r * 0.55, 0));
      for (const side of [1, -1]) {
        const tache = capsule(r * 0.09, r * 0.34, 0xc4682a);
        head.add(at(tache, r * 0.98, -r * 0.24, side * r * 0.22, Math.PI / 2 - side * 0.5, 0, 0));
        head.add(at(ball(r * 0.08, 0xc4682a, 8), r * 0.9, -r * 0.08, side * r * 0.42));
      }
      // A monocle.
      const mono = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16), material(C.gold));
      head.add(at(mono, r * 1.0, r * 0.08, r * 0.36, 0, Math.PI / 2, 0));
      // Grenades on the belt and one in hand.
      for (const z of [-0.26, -0.1, 0.1, 0.26]) body.add(at(grenade(), 0.28, 0.86, z));
      body.add(at(grenade(), built.grip.x + 0.1, built.grip.y + 0.06, built.grip.z - 0.1));
      backpack(built, 0x7a6a48, 0xb59f6a);
      break;
    }
    case "engineer": {
      built = person(kind, v(0.38, 1.0, 0.1), { brows: "kind", mouth: "grin", brow: 0x5a3820 });
      const { head, headRadius: r, body } = built;
      // Yellow hard hat with goggles on the brim, and a bushy brown beard.
      const hat = ball(r * 1.1, 0xf3c24c, 18);
      hat.scale.set(1.02, 0.7, 1.02);
      head.add(at(hat, -r * 0.03, r * 0.42, 0));
      head.add(at(cyl(r * 1.2, r * 1.25, r * 0.08, 0xe0aa2c, 22), r * 0.08, r * 0.3, 0));
      head.add(at(rbox(r * 1.0, r * 0.12, r * 0.12, 0xe0aa2c), 0, r * 0.82, 0));
      for (const z of [0.13, -0.13]) {
        const goggle = cyl(0.08, 0.08, 0.07, 0x4fb3ff, 12);
        goggle.material = material(0x8fd8ff, { emissive: 0x18405a });
        head.add(at(goggle, r * 0.95, r * 0.48, z, 0, 0, Math.PI / 2));
      }
      head.add(at(rbox(r * 0.2, r * 0.06, r * 1.9, 0x3a3e44), r * 0.7, r * 0.48, 0));
      const beard = ball(r * 0.8, C.hairBrown, 14);
      beard.scale.set(0.65, 0.7, 1.05);
      head.add(at(beard, r * 0.5, -r * 0.5, 0));
      head.add(at(rbox(r * 0.08, r * 0.08, r * 0.36, WHITE), r * 0.98, -r * 0.3, 0));
      // Overall straps, a toolbox backpack with an antenna, and a wrench.
      for (const z of [0.18, -0.18]) body.add(at(rbox(0.04, 0.5, 0.08, C.denim), 0.24, 1.2, z));
      const pack = backpack(built, 0x587a99, null);
      pack.add(at(rbox(0.3, 0.2, 0.5, 0xe5503a), -0.02, 0.32, 0));
      pack.add(at(cyl(0.012, 0.012, 0.8, 0x3a3e44, 5), 0, 0.7, 0.18));
      pack.add(at(ball(0.04, 0xe5503a, 8), 0, 1.1, 0.18));
      body.add(at(wrench(), built.grip.x, built.grip.y, built.grip.z, 0, 0, 0.5));
      break;
    }
  }
  const root = new THREE.Group();
  root.add(built.outer);
  const [right, left] = built.arms;
  const rig: RifleRig | null =
    gun && right && left
      ? {
          outer: built.outer,
          lower: built.lower,
          upper: built.upper,
          spine: built.spine,
          head: built.head,
          legs: built.legs,
          knees: built.knees,
          feet: built.feet,
          rifle: gun,
          muzzle: at(new THREE.Object3D(), 0.86, 0.04, 0),
          right,
          left,
        }
      : null;
  if (rig) {
    gun?.add(rig.muzzle);
    // Stand him at ease, for anything that never animates him (portraits, say).
    new RiflemanAnimator(rig).update(0, AT_EASE);
  }
  return { root, body: built.outer, legs: built.legs, rig, height: 2.35 };
}

function tank(): HeroModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // Hull with a sloped front and side skirts.
  body.add(at(rbox(2.6, 0.82, 1.7, C.tankSand), 0, 0.88, 0));
  body.add(at(rbox(0.7, 0.5, 1.6, C.tankSand), 1.25, 0.95, 0, 0, 0, -0.5));
  for (const z of [0.98, -0.98]) {
    // Tracks: a dark belt with treads, road wheels and the blue skirt over them.
    body.add(at(rbox(2.9, 0.72, 0.5, 0x3a3c40), 0, 0.4, z));
    for (let i = 0; i < 12; i++)
      body.add(at(rbox(0.1, 0.06, 0.52, 0x26282b), -1.38 + i * 0.25, 0.04, z));
    for (const x of [-1.05, -0.35, 0.35, 1.05])
      body.add(at(cyl(0.27, 0.27, 0.54, 0x8e8a7c, 14), x, 0.38, z, Math.PI / 2, 0, 0));
    body.add(at(rbox(3.0, 0.16, 0.58, C.crewBlue), 0, 0.82, z));
  }
  // Headlights, exhaust pipes, a crate and a white star.
  for (const z of [0.6, -0.6]) {
    const light = cyl(0.11, 0.11, 0.1, 0xfff2c4, 12);
    light.material = material(0xfff2c4, { emissive: 0x8a7a40 });
    body.add(at(light, 1.45, 1.05, z, 0, 0, Math.PI / 2));
    body.add(at(cyl(0.07, 0.07, 0.4, 0x3a3e44, 8), -1.35, 1.25, z * 0.7));
  }
  body.add(at(rbox(0.5, 0.36, 0.6, C.wood), -1.0, 1.45, 0.4));
  // Turret with the driver popping out of the hatch.
  const turret = at(new THREE.Group(), 0, 1.5, 0);
  turret.add(rbox(1.5, 0.72, 1.3, C.tankSand));
  turret.add(at(rbox(0.5, 0.6, 1.36, C.crewBlue), 0.62, 0, 0));
  turret.add(at(barrel(0.19, 1.8, C.tankSand, 14), 0.85, 0.05, 0));
  turret.add(at(cyl(0.27, 0.27, 0.38, 0x8e8a7c, 14), 2.5, 0.05, 0, 0, 0, Math.PI / 2));
  turret.add(at(cyl(0.38, 0.38, 0.12, C.tankSand, 16), -0.2, 0.42, 0));
  for (const z of [0.66, -0.66]) {
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.18, 5), material(WHITE));
    turret.add(at(star, -0.1, 0.02, z + Math.sign(z) * 0.01, 0, z > 0 ? 0 : Math.PI, Math.PI / 2));
  }
  // Antenna with a blue pennant.
  turret.add(at(cyl(0.015, 0.015, 1.4, 0x3a3e44, 5), -0.55, 1.0, -0.45));
  turret.add(at(rbox(0.32, 0.18, 0.02, C.crewBlue), -0.4, 1.58, -0.45));
  // The driver: sailor hat, goggles, big grin.
  const driver = at(new THREE.Group(), -0.2, 0.92, 0);
  driver.add(at(capsule(0.22, 0.16, C.crewBlue), 0, -0.3, 0));
  const r = 0.26;
  driver.add(ball(r, C.skin, 18));
  const dHead = new THREE.Group();
  driver.add(dHead);
  face(dHead, r, C.skin, { brows: "kind", mouth: "grin" });
  driver.add(at(ball(r * 1.02, C.hairBrown, 14), -r * 0.2, r * 0.1, 0));
  driver.add(at(cyl(r * 0.95, r * 0.85, r * 0.55, WHITE, 16), 0, r * 0.75, 0));
  driver.add(at(cyl(r * 1.0, r * 1.0, r * 0.14, C.crewBlue, 16), 0, r * 0.55, 0));
  driver.add(at(rbox(r * 0.12, r * 0.12, r * 2, 0x3a3e44), r * 0.4, r * 0.48, 0));
  turret.add(driver);
  body.add(turret);
  return { root, body, legs: null, rig: null, height: 2.9 };
}

export function heroModel(kind: HeroKind): HeroModel {
  return kind === "tank" ? tank() : human(kind);
}
