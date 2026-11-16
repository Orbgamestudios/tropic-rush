// The crew's gunboat (docs/DESIGN.md, Added 2026-11-16): big enough for the whole crew at the size
// they are in a raid, so the boat they're chosen on is the boat they land from and the boat that
// fires for them. A cabin you can see into (the helm, a bench, and the console where the time
// crystals are set before a raid), benches and crates to sit on outside, a turret on the bow.
//
// In its own space: +x to the bow, +z to starboard, y up from the waterline. Everything that
// doesn't move is baked into one mesh (flatten); the turret, the console's screen and the crystal
// holders stay their own.

import * as THREE from "three";
import { AT_EASE, type HeroMove } from "./heroAnimator";
import { material } from "./palette";
import { at, ball, barrel, cyl, flatten, mesh, rbox } from "./shapes";

/** How she rides at `time` seconds, run up on the beach: the boat scene and the raid both use it. */
export const boatRise = (time: number) => 0.12 + Math.sin(time * 1.6) * 0.06;
export const boatRoll = (time: number) => Math.sin(time * 1.1) * 0.02;

/** Sat on the deck, back against a bench. */
export const SITTING: HeroMove = {
  ...AT_EASE,
  act: { talking: false, mood: null, lookYaw: 0, lookPitch: 0, posture: "sit" },
};

/** A kit bag, thrown ashore at a landing. */
export function gearBag(): THREE.Group {
  const bag = new THREE.Group();
  const body = cyl(0.32, 0.32, 1.1, 0x5c6b3c, 12);
  body.rotation.z = Math.PI / 2;
  bag.add(at(body, 0, 0.32, 0, 0, 0, Math.PI / 2));
  bag.add(at(rbox(0.1, 0.12, 0.7, 0x3a2a1a), 0, 0.62, 0));
  bag.add(at(cyl(0.33, 0.33, 0.06, 0x3a2a1a, 12), 0.4, 0.32, 0, 0, 0, Math.PI / 2));
  bag.add(at(cyl(0.33, 0.33, 0.06, 0x3a2a1a, 12), -0.4, 0.32, 0, 0, 0, Math.PI / 2));
  flatten(bag);
  bag.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return bag;
}

/** Height of the deck above the water. */
export const DECK = 1.6;
/** How tall the crew stand in a raid, which the boat is built round. */
export const CREW_HEIGHT = 2.4;

const HULL = 0x24406b;
const HULL_DARK = 0x18294a;
const STRIPE = 0xe9e2cf;
const BOTTOM = 0x9e3a2e;
const DECK_WOOD = 0xb07a48;
const DECK_LINE = 0x7a5232;
const CABIN = 0xb94b3a;
const CABIN_TRIM = 0x2f8f8a;
const ROOF = 0x3a3f48;
const METAL = 0x6b737e;
const DARK = 0x2b2f36;
const ROPE = 0xc9a86b;
const CRATE = 0x9a6a3a;

/** Somewhere aboard for one of the crew: where, which way they face, and whether they sit. */
export interface Station {
  x: number;
  z: number;
  /** Radians, 0 towards the bow, as `atan2(z, x)` goes. */
  facing: number;
  sit: boolean;
  /** Height of what they stand (or sit) on. */
  y: number;
}

export interface CrewBoat {
  root: THREE.Group;
  /** Turns to face where the gunboat's firing. */
  cannon: THREE.Object3D;
  /** Kicks back when it fires. */
  guns: THREE.Object3D;
  muzzle: THREE.Object3D;
  /** Where the crew stand and sit, the best places first. */
  stations: readonly Station[];
  /** The console in the cabin: where to stand to work it, its screen, and its three holders. */
  console: { stand: Station; screen: THREE.Mesh; holders: readonly THREE.Object3D[] };
  /** Either side of the turret in the bow, which runs up onto the beach: where the crew go over. */
  over: { x: number; z: number }[];
  /** Bow to stern, and across. */
  length: number;
  beam: number;
}

/** The hull's outline from above: a square stern, sides that run straight, a rounded bow. */
function outline(inset: number): THREE.Shape {
  const s = new THREE.Shape();
  const half = 3 - inset;
  s.moveTo(-7 + inset, -half);
  s.lineTo(3.2, -half);
  s.quadraticCurveTo(7.4 - inset, -half * 0.75, 8.2 - inset * 1.6, 0);
  s.quadraticCurveTo(7.4 - inset, half * 0.75, 3.2, half);
  s.lineTo(-7 + inset, half);
  s.lineTo(-7 + inset, -half);
  return s;
}

/** The outline extruded upwards from `bottom` to `top`. */
function slab(inset: number, bottom: number, top: number, color: number): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(outline(inset), {
    depth: top - bottom,
    bevelEnabled: true,
    bevelSize: 0.12,
    bevelThickness: 0.12,
    bevelSegments: 2,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bottom, 0);
  return mesh(g, color);
}

/** A wall from (x0, z0) to (x1, z1), standing on the deck, with an opening cut in it if asked. */
function wall(
  root: THREE.Object3D,
  from: [number, number],
  to: [number, number],
  height: number,
  hole: { start: number; end: number; low: number; high: number } | null,
): void {
  const [x0, z0] = from;
  const [x1, z1] = to;
  const length = Math.hypot(x1 - x0, z1 - z0);
  const turn = -Math.atan2(z1 - z0, x1 - x0);
  const piece = (a: number, b: number, low: number, high: number, color = CABIN) => {
    if (b - a < 0.01 || high - low < 0.01) return;
    const mid = (a + b) / 2;
    const p = rbox(b - a, high - low, 0.16, color);
    p.position.set(
      x0 + ((x1 - x0) * mid) / length,
      DECK + (low + high) / 2,
      z0 + ((z1 - z0) * mid) / length,
    );
    p.rotation.y = turn;
    root.add(p);
  };
  if (!hole) {
    piece(0, length, 0, height);
    return;
  }
  piece(0, hole.start, 0, height);
  piece(hole.end, length, 0, height);
  piece(hole.start, hole.end, 0, hole.low);
  piece(hole.start, hole.end, hole.high, height);
  // The frame round the opening, in the trim colour.
  const frame = (a: number, b: number, low: number, high: number) =>
    piece(a, b, low, high, CABIN_TRIM);
  frame(hole.start - 0.08, hole.start, hole.low, hole.high);
  frame(hole.end, hole.end + 0.08, hole.low, hole.high);
  if (hole.low > 0.05) frame(hole.start - 0.08, hole.end + 0.08, hole.low - 0.08, hole.low);
  frame(hole.start - 0.08, hole.end + 0.08, hole.high, hole.high + 0.08);
}

export function crewBoatModel(): CrewBoat {
  const root = new THREE.Group();

  // The hull: navy above a cream stripe and red below the waterline, the deck planked on top.
  root.add(slab(0, -0.9, -0.05, BOTTOM));
  root.add(slab(0, -0.05, DECK - 0.15, HULL));
  root.add(slab(-0.02, 0.35, 0.55, STRIPE));
  root.add(slab(0.14, DECK - 0.17, DECK - 0.02, DECK_WOOD));
  for (let z = -2.5; z <= 2.5; z += 0.5) {
    root.add(at(rbox(10.6, 0.02, 0.03, DECK_LINE), -1.5, DECK - 0.01, z));
  }
  // A raised gunwale all round, and a rail on posts above it.
  const rim = outline(0.05).getPoints(24);
  for (let i = 0; i < rim.length - 1; i++) {
    const a = rim[i] as THREE.Vector2;
    const b = rim[i + 1] as THREE.Vector2;
    const len = a.distanceTo(b);
    if (len < 0.05) continue;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const turn = -Math.atan2(-(b.y - a.y), b.x - a.x);
    // Shape y is the boat's -z (see slab).
    const gunwale = rbox(len + 0.06, 0.3, 0.22, HULL_DARK);
    gunwale.position.set(mid.x, DECK + 0.12, -mid.y);
    gunwale.rotation.y = turn;
    root.add(gunwale);
    const rail = cyl(0.05, 0.05, len + 0.04, METAL, 6);
    rail.geometry.rotateZ(Math.PI / 2);
    rail.position.set(mid.x, DECK + 1.05, -mid.y);
    rail.rotation.y = turn;
    root.add(rail);
    if (i % 2 === 0) root.add(at(cyl(0.05, 0.05, 0.9, METAL, 6), a.x, DECK + 0.6, -a.y));
  }
  // Tyres hung over the side as fenders.
  for (const x of [-5, -2, 1, 3.5]) {
    for (const z of [-3.12, 3.12]) {
      const tyre = mesh(new THREE.TorusGeometry(0.34, 0.13, 8, 16), DARK);
      tyre.rotation.y = Math.PI / 2;
      root.add(at(tyre, x, 0.8, z));
    }
  }

  // The cabin: walls with windows and a door to the bow, a roof that overhangs.
  const back = -3.6;
  const front = 0.4;
  const side = 2.1;
  const height = 3.0;
  wall(root, [back, -side], [back, side], height, { start: 1.4, end: 2.8, low: 1.3, high: 2.2 });
  wall(root, [back, side], [front, side], height, { start: 0.8, end: 3.0, low: 1.25, high: 2.3 });
  wall(root, [front, -side], [back, -side], height, { start: 1.0, end: 3.2, low: 1.25, high: 2.3 });
  wall(root, [front, -side], [front, side], height, { start: 1.55, end: 2.65, low: 0, high: 2.7 });
  root.add(
    at(
      rbox(front - back + 0.9, 0.22, side * 2 + 0.9, ROOF),
      (back + front) / 2,
      DECK + height + 0.1,
      0,
    ),
  );
  // Inside: a bench along the back wall, the helm, a chart on the wall.
  root.add(at(rbox(0.6, 0.5, 3.2, CRATE), back + 0.45, DECK + 0.25, 0));
  root.add(at(rbox(0.5, 0.08, 3.2, DECK_WOOD), back + 0.45, DECK + 0.52, 0));
  root.add(at(cyl(0.12, 0.16, 1.1, METAL, 10), front - 0.6, DECK + 0.55, 1.2));
  const wheel = mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 18), CRATE);
  wheel.rotation.y = Math.PI / 2;
  root.add(at(wheel, front - 0.45, DECK + 1.25, 1.2));
  for (let i = 0; i < 4; i++) {
    const spoke = rbox(0.05, 0.95, 0.05, CRATE);
    spoke.rotation.x = (i / 4) * Math.PI;
    root.add(at(spoke, front - 0.45, DECK + 1.25, 1.2, (i / 4) * Math.PI));
  }
  root.add(at(rbox(0.04, 0.8, 1.1, 0xe8dcc0), back + 0.1, DECK + 1.9, -1.2));

  // The console: a desk under the port window, a sloped screen, three holders for crystals.
  const desk = new THREE.Group();
  desk.position.set(front - 0.55, DECK, -1.25);
  desk.add(at(rbox(0.8, 1.0, 1.5, METAL), 0, 0.5, 0));
  desk.add(at(rbox(0.9, 0.08, 1.6, DARK), -0.02, 1.02, 0));
  const panel = rbox(0.12, 0.6, 1.3, DARK);
  panel.rotation.z = 0.5;
  desk.add(at(panel, 0.18, 1.3, 0, 0, 0, 0.5));
  root.add(desk);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.45),
    material(0x1a5a5a, { emissive: 0x1f8f86 }),
  );
  screen.position.set(front - 0.55 + 0.11, DECK + 1.32, -1.25);
  screen.rotation.set(0, -Math.PI / 2, 0);
  screen.rotateX(-0.5);
  root.add(screen);
  const holders: THREE.Object3D[] = [];
  for (const dz of [-0.45, 0, 0.45]) {
    const holder = new THREE.Group();
    holder.position.set(front - 0.55 - 0.22, DECK + 1.06, -1.25 + dz);
    holder.add(cyl(0.13, 0.15, 0.1, METAL, 14));
    holder.add(at(cyl(0.09, 0.09, 0.02, 0x0c1418, 14), 0, 0.055, 0));
    root.add(holder);
    holders.push(holder);
  }

  // On the roof: a mast with a crosstree, a lamp and the crew's flag.
  root.add(at(cyl(0.08, 0.1, 4.2, METAL, 8), -1.6, DECK + height + 2.2, 0));
  root.add(at(rbox(0.1, 0.1, 1.8, METAL), -1.6, DECK + height + 3.2, 0));
  root.add(at(ball(0.16, 0xffe2a0, 10, { emissive: 0xffc860 }), -1.6, DECK + height + 4.35, 0));
  root.add(at(rbox(1.2, 0.7, 0.04, 0x2f6fd6), -1.0, DECK + height + 3.8, 0));
  root.add(at(rbox(0.6, 0.35, 0.05, 0xf2c94c), -0.9, DECK + height + 3.8, 0));

  // Aft: benches along both sides to sit on, crates, a barrel, rope, life rings, the motor.
  for (const z of [-2.35, 2.35]) {
    root.add(at(rbox(2.6, 0.5, 0.55, CRATE), -5.4, DECK + 0.25, z));
    root.add(at(rbox(2.7, 0.08, 0.65, DECK_WOOD), -5.4, DECK + 0.53, z));
  }
  root.add(at(rbox(0.9, 0.8, 0.9, CRATE), -6.3, DECK + 0.4, 0.4));
  root.add(at(rbox(0.7, 0.6, 0.7, 0x86592f), -6.3, DECK + 1.1, 0.35));
  root.add(at(cyl(0.38, 0.38, 0.95, 0x5d7f3e, 14), -6.3, DECK + 0.47, -0.8));
  root.add(at(rbox(0.9, 1.1, 1.0, DARK), -7.35, DECK - 0.2, 0));
  root.add(at(cyl(0.08, 0.08, 1.4, METAL, 6), -7.6, DECK - 1.0, 0));
  for (const z of [-side - 0.09, side + 0.09]) {
    const ring = mesh(new THREE.TorusGeometry(0.36, 0.1, 8, 18), 0xf06a3a);
    root.add(at(ring, -1.6, DECK + 1.7, z));
  }
  // Forward of the cabin: coiled rope and ammunition crates, both good to sit on.
  const coil = mesh(new THREE.TorusGeometry(0.42, 0.14, 8, 18), ROPE);
  coil.rotation.x = Math.PI / 2;
  root.add(at(coil, 1.6, DECK + 0.14, 2.1));
  root.add(at(rbox(0.8, 0.55, 0.6, 0x5a6b3a), 1.5, DECK + 0.28, -2.15));
  root.add(at(rbox(0.8, 0.55, 0.6, 0x5a6b3a), 2.4, DECK + 0.28, -2.2));

  // The turret on the bow: a round base, and the gun on it, which turns and kicks back.
  root.add(at(cyl(1.15, 1.25, 0.45, METAL, 20), 5.3, DECK + 0.22, 0));
  const cannon = new THREE.Group();
  cannon.position.set(5.3, DECK + 0.45, 0);
  cannon.add(at(cyl(0.9, 1.0, 0.7, 0x55657e, 18), 0, 0.35, 0));
  cannon.add(at(rbox(0.3, 1.1, 1.8, 0x55657e), 0.75, 0.85, 0));
  const guns = new THREE.Group();
  guns.position.set(0.3, 0.75, 0);
  guns.add(at(barrel(0.17, 2.4, DARK, 12), 0, 0, 0.3));
  guns.add(at(barrel(0.17, 2.4, DARK, 12), 0, 0, -0.3));
  guns.add(at(rbox(0.6, 0.45, 0.9, METAL), 0.1, 0, 0));
  const muzzle = new THREE.Object3D();
  muzzle.position.set(2.45, 0, 0);
  guns.add(muzzle);
  cannon.add(guns);
  root.add(cannon);

  flatten(root, cannon);
  flatten(cannon, guns);
  flatten(guns);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const deck = DECK;
  const stations: Station[] = [
    // The best places first, which the camera finds best: by the bow, then along each side.
    { x: 2.9, z: 1.75, facing: 0.6, sit: false, y: deck },
    { x: 2.9, z: -1.25, facing: -0.6, sit: false, y: deck },
    // Sat on the deck with their backs to the benches aft.
    { x: -5.0, z: 1.75, facing: -Math.PI / 2, sit: true, y: deck },
    { x: -5.7, z: -1.75, facing: Math.PI / 2, sit: true, y: deck },
    { x: 1.3, z: 0.0, facing: 0, sit: false, y: deck },
    { x: -6.0, z: 1.6, facing: Math.PI * 0.85, sit: false, y: deck },
    { x: 4.0, z: 2.1, facing: 0.3, sit: false, y: deck },
    { x: -4.6, z: -0.6, facing: Math.PI, sit: false, y: deck },
  ];
  return {
    root,
    cannon,
    guns,
    muzzle,
    stations,
    console: {
      stand: { x: front - 1.45, z: -1.25, facing: 0, sit: false, y: deck },
      screen,
      holders,
    },
    over: [
      { x: 6.6, z: 1.3 },
      { x: 6.6, z: -1.3 },
      { x: 7.3, z: 0.75 },
      { x: 7.3, z: -0.75 },
    ],
    length: 15.2,
    beam: 6,
  };
}
