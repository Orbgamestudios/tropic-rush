// The crew's gunboat (docs/DESIGN.md, Added 2026-11-16), after the owner's reference: a coastguard
// RIB, big enough for the whole crew at the size they are in a raid, so the boat they're chosen on
// is the boat they land from and the boat that fires for them.
//
// Built part by part, each with its own surface (boatParts.ts), the shiny ones reflecting a painted
// sky and sea: a grey deep-V hull; the big glossy orange collar round her sides and bow, with dark
// rubbing pads along it and her name; a grey non-slip deck; an aluminium wheelhouse with dark,
// reflecting windows in black frames, a raked windscreen and a door aft, and inside it the helm,
// two seats and the crystal console under the windscreen; a rail round the roof, a radar dome,
// antennas, a blue light bar and a searchlight; twin outboard motors on the transom under a frame;
// a gun on a pedestal in the bow. The parts sharing a surface are baked together: a few draw calls.
//
// In her own space: +x to the bow, +z to starboard, y up from the waterline.

import * as THREE from "three";
import {
  bakeByMaterial,
  brass,
  chartScreen,
  crateWood,
  metreUV,
  nameDecal,
  nonSlip,
  reflections,
  surface,
} from "./boatParts";
import { AT_EASE, type HeroMove } from "./heroAnimator";
import { at, cyl, flatten, rbox } from "./shapes";

/** Height of the deck above the water. */
export const DECK = 1.05;
/** How tall the crew stand in a raid, which the boat is built round. */
export const CREW_HEIGHT = 2.4;

const STERN = -7;
const STEM = 8.4;
/** The collar: its tube's radius, and the height of its middle. */
const TUBE = 0.6;
const TUBE_Y = 1.15;

/** The deck's height along her length: level, lifting a touch in the bow. */
export function deckY(x: number): number {
  const t = Math.min(1, Math.max(0, (x - 3) / 5));
  return DECK + 0.25 * t * t;
}

/** Half her beam along her length, to the collar's middle: full aft, rounding in to the bow. */
function halfBeam(x: number): number {
  if (x <= 2.0) return 3.0;
  const t = Math.min(1, (x - 2.0) / (STEM - 2.0));
  return 3.0 * Math.sqrt(Math.max(0, 1 - t * t));
}

/** How deep her keel is along her length: a deep V, sweeping up to the bow. */
function keelY(x: number): number {
  const t = Math.min(1, Math.max(0, (x - 3.5) / 4.9));
  return -0.85 + 0.9 * t * t;
}

/** How she rides at `time` seconds, run up on the beach: the boat scene and the raid both use it. */
export const boatRise = (time: number) => 0.1 + Math.sin(time * 1.6) * 0.05;
export const boatRoll = (time: number) => Math.sin(time * 1.1) * 0.018;

/** Sat on the deck, back against a bench. */
export const SITTING: HeroMove = {
  ...AT_EASE,
  act: { talking: false, mood: null, lookYaw: 0, lookPitch: 0, posture: "sit" },
};

// Her surfaces, shared by every gunboat; the shiny ones reflect the painted sky and sea.
const shiny = (
  name: string,
  color: number,
  roughness: number,
  metalness: number,
  envMapIntensity = 1,
) =>
  surface(
    name,
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        envMap: reflections(),
        envMapIntensity,
      }),
  );
const HULL = () => shiny("rib-hull", 0x4e555e, 0.4, 0.2, 0.8);
const COLLAR = () => shiny("rib-collar", 0xff4a1c, 0.32, 0, 0.7);
const ALUMINIUM = () => shiny("rib-aluminium", 0xa7adb4, 0.32, 0.65, 1);
const GLASS = () =>
  surface(
    "rib-glass",
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x1b2430,
        roughness: 0.05,
        metalness: 0.4,
        envMap: reflections(),
        envMapIntensity: 1.4,
      }),
  );
const RUBBER = () => shiny("rib-rubber", 0x1d2024, 0.7, 0, 0.3);
const MOTOR = () => shiny("rib-motor", 0x6d737a, 0.25, 0.3, 1.1);
const DARK = () => shiny("rib-dark", 0x2a2e33, 0.4, 0.5, 0.8);
const WHITE = () => shiny("rib-white", 0xf2f4f5, 0.3, 0, 0.8);
const DECKING = () =>
  surface("rib-deck", () => new THREE.MeshStandardMaterial({ map: nonSlip(), roughness: 0.9 }));
const SEAT = () => shiny("rib-seat", 0x30353b, 0.6, 0, 0.4);
const BRASS = () =>
  surface(
    "brass",
    () =>
      new THREE.MeshStandardMaterial({
        map: brass(),
        roughness: 0.3,
        metalness: 0.75,
        envMap: reflections(),
      }),
  );
const WOOD = () =>
  surface("crate", () => new THREE.MeshStandardMaterial({ map: crateWood(), roughness: 0.85 }));

function block(w: number, h: number, d: number, material: THREE.Material, size = 1): THREE.Mesh {
  return new THREE.Mesh(metreUV(new THREE.BoxGeometry(w, h, d), size), material);
}

function rounded(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  const m = rbox(w, h, d, 0xffffff);
  m.material = material;
  return m;
}

function tube(
  r0: number,
  r1: number,
  h: number,
  material: THREE.Material,
  segments = 16,
): THREE.Mesh {
  return new THREE.Mesh(metreUV(new THREE.CylinderGeometry(r0, r1, h, segments), 1), material);
}

/** A rod from `a` to `b`, `r` thick. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material): THREE.Mesh {
  const length = a.distanceTo(b);
  const m = tube(r, r, length, material, 8);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/** The hull below the collar: cross-sections from transom to bow, a deep V with hard chines. */
function hullGeometry(): THREE.BufferGeometry {
  const rings = 40;
  const pos: number[] = [];
  const idx: number[] = [];
  // Each section: from the deck edge on one side, down the topside to the chine, to the keel, and up
  // the other side.
  const section = (x: number) => {
    const hw = Math.max(0.03, halfBeam(x) - TUBE * 0.35);
    const keel = keelY(x);
    const top = TUBE_Y - TUBE * 0.2;
    const chine = Math.max(keel + 0.05, -0.05 + 0.6 * Math.max(0, (x - 3.5) / 4.9));
    return [
      [hw, top],
      [hw * 0.92, chine],
      [hw * 0.45, (chine + keel) / 2 - 0.08],
      [0, keel],
      [-hw * 0.45, (chine + keel) / 2 - 0.08],
      [-hw * 0.92, chine],
      [-hw, top],
    ] as const;
  };
  const around = 7;
  for (let i = 0; i <= rings; i++) {
    const x = STERN + ((STEM - 0.25 - STERN) * i) / rings;
    for (const [z, y] of section(x)) pos.push(x, y, z);
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < around - 1; j++) {
      const a = i * around + j;
      const b = a + around;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // The transom.
  for (let j = 1; j < around - 2; j++) idx.push(0, j + 1, j);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return metreUV(flat, 2);
}

/** The collar's path: from the transom on one side, round the bow, to the transom on the other. */
function collarPath(): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = [];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const x = STERN + 0.3 + ((STEM - 0.4 - STERN - 0.3) * i) / steps;
    points.push(new THREE.Vector3(x, TUBE_Y + 0.12 * Math.max(0, (x - 3) / 5), -halfBeam(x)));
  }
  points.push(new THREE.Vector3(STEM - 0.05, TUBE_Y + 0.14, 0));
  for (let i = steps; i >= 0; i--) {
    const x = STERN + 0.3 + ((STEM - 0.4 - STERN - 0.3) * i) / steps;
    points.push(new THREE.Vector3(x, TUBE_Y + 0.12 * Math.max(0, (x - 3) / 5), halfBeam(x)));
  }
  return new THREE.CatmullRomCurve3(points, false, "centripetal");
}

/** The deck: grey non-slip, inside the collar. */
function deckGeometry(): THREE.BufferGeometry {
  const steps = 40;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const end = STEM - 1.0;
  for (let i = 0; i <= steps; i++) {
    const x = STERN + 0.1 + ((end - STERN - 0.1) * i) / steps;
    const hw = Math.max(0.01, halfBeam(x) - TUBE * 0.7);
    const y = deckY(x);
    pos.push(x, y, -hw, x, y, hw);
    uv.push(x / 2, -hw / 2, x / 2, hw / 2);
    if (i < steps) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

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
  /** The console in the wheelhouse: where to stand to work it, its screen, and its three cradles. */
  console: { stand: Station; screen: THREE.Mesh; holders: readonly THREE.Object3D[] };
  /** The wheelhouse: its walls (aft, forward and to either side) and its door, aft. */
  cabin: { back: number; front: number; side: number; door: { x: number; z: number } };
  /** How far out from the middle the side decks run, past the wheelhouse. */
  sideDeck: number;
  /** In the bow, where the crew go over the collar onto the beach. */
  over: { x: number; z: number }[];
  /** Bow to stern, and across. */
  length: number;
  beam: number;
}

/** The wheelhouse, with its windows, roof gear, and inside it the helm, seats and console. */
function wheelhouse(
  root: THREE.Object3D,
  back: number,
  front: number,
  side: number,
): { screen: THREE.Mesh; holders: THREE.Object3D[] } {
  const floor = deckY(back);
  const height = 2.9;
  const top = floor + height;
  const length = front - back;
  const wall = (w: number, h: number, d: number, x: number, y: number, z: number) =>
    root.add(at(block(w, h, d, ALUMINIUM(), 1.5), x, y, z));
  // The aft wall, with its door (an opening the crew walk through) and a window either side of it.
  const door = 1.2;
  const sideOfDoor = side - door / 2;
  for (const s of [-1, 1]) {
    wall(0.12, height, sideOfDoor, back, floor + height / 2, s * (door / 2 + sideOfDoor / 2));
    const glass = block(0.04, height - 1.7, sideOfDoor - 0.3, GLASS());
    glass.position.set(
      back - 0.07,
      floor + 1.3 + (height - 1.7) / 2,
      s * (door / 2 + sideOfDoor / 2),
    );
    root.add(glass);
  }
  wall(0.12, 0.25, door, back, top - 0.125, 0);
  // The side walls: low below the windows, posts between them, a band above.
  for (const s of [-1, 1]) {
    wall(length, 1.2, 0.12, back + length / 2, floor + 0.6, s * side);
    wall(length, 0.35, 0.12, back + length / 2, top - 0.175, s * side);
    for (const f of [0, 0.5, 1])
      wall(0.16, height, 0.14, back + length * f, floor + height / 2, s * side);
    // The windows themselves: dark reflecting glass in black rubber frames.
    for (const [a, b] of [
      [0.06, 0.47],
      [0.53, 0.94],
    ] as const) {
      const glass = block(length * (b - a), height - 1.6, 0.04, GLASS());
      glass.position.set(
        back + length * ((a + b) / 2),
        floor + 1.2 + (height - 1.55) / 2,
        s * (side + 0.02),
      );
      root.add(glass);
      const frame = block(length * (b - a) + 0.08, 0.06, 0.08, RUBBER());
      frame.position.set(back + length * ((a + b) / 2), floor + 1.2, s * (side + 0.04));
      root.add(frame);
    }
  }
  // The windscreen: raked back, in three panes, above a low front wall.
  wall(0.12, 1.15, side * 2, front, floor + 0.575, 0);
  const screenGlass = block(0.05, 1.5, side * 2 - 0.2, GLASS());
  screenGlass.position.set(front - 0.25, floor + 1.95, 0);
  screenGlass.rotation.z = 0.32;
  root.add(screenGlass);
  for (const z of [-side + 0.05, -0.65, 0.65, side - 0.05]) {
    const post = block(0.12, 1.6, 0.12, RUBBER());
    post.position.set(front - 0.25, floor + 1.95, z);
    post.rotation.z = 0.32;
    root.add(post);
  }
  // The roof, its overhang and rail, and what's on it.
  root.add(
    at(
      rounded(length + 0.7, 0.18, side * 2 + 0.5, ALUMINIUM()),
      back + length / 2 - 0.15,
      top + 0.09,
      0,
    ),
  );
  const railY = top + 0.55;
  const corners = [
    new THREE.Vector3(back - 0.1, railY, -side - 0.1),
    new THREE.Vector3(front - 0.4, railY, -side - 0.1),
    new THREE.Vector3(front - 0.4, railY, side + 0.1),
    new THREE.Vector3(back - 0.1, railY, side + 0.1),
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i] as THREE.Vector3;
    const b = corners[(i + 1) % 4] as THREE.Vector3;
    root.add(rod(a, b, 0.04, ALUMINIUM()));
    root.add(rod(a, a.clone().setY(top + 0.18), 0.04, ALUMINIUM()));
  }
  const pod = new THREE.Group();
  pod.position.set(back + length * 0.35, top + 0.18, 0);
  root.add(pod);
  pod.add(at(tube(0.25, 0.3, 0.6, ALUMINIUM()), 0, 0.3, 0));
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    WHITE(),
  );
  dome.position.y = 0.6;
  pod.add(dome);
  pod.add(at(block(0.6, 0.12, 0.6, WHITE()), 0, 0.6, 0));
  for (const [dx, dz, h] of [
    [-0.4, -1.2, 2.4],
    [0.3, -1.4, 1.6],
    [-0.6, 1.3, 3.0],
  ] as const) {
    root.add(at(tube(0.025, 0.04, h, WHITE(), 6), pod.position.x + dx, top + 0.18 + h / 2, dz));
  }
  // The blue light bar, lit.
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.16, 1.4),
    new THREE.MeshBasicMaterial({ color: 0x2f6bff }),
  );
  bar.userData.own = true;
  bar.position.set(front - 0.5, top + 0.27, 0);
  root.add(bar);
  // The searchlight.
  const lamp = new THREE.Group();
  lamp.position.set(front - 0.55, top + 0.35, -side + 0.4);
  lamp.add(tube(0.18, 0.2, 0.32, DARK(), 14).rotateZ(Math.PI / 2));
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff3c8 }),
  );
  lens.userData.own = true;
  lens.rotation.y = Math.PI / 2;
  lens.position.x = 0.17;
  lamp.add(lens);
  root.add(lamp);

  // Inside: two seats, the helm on the starboard side, the console to port under the windscreen.
  for (const z of [-0.95, 0.95]) {
    root.add(at(block(0.6, 0.55, 0.6, SEAT()), back + length * 0.55, floor + 0.55, z));
    root.add(at(block(0.12, 0.8, 0.6, SEAT()), back + length * 0.55 - 0.3, floor + 1.1, z));
    root.add(at(tube(0.06, 0.06, 0.4, DARK(), 8), back + length * 0.55, floor + 0.2, z));
  }
  const helm = new THREE.Group();
  helm.position.set(front - 0.55, floor, 0.95);
  helm.add(at(block(0.6, 1.0, 1.0, DARK()), 0, 0.5, 0));
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 22), DARK());
  wheel.position.set(-0.35, 1.2, 0);
  wheel.rotation.y = Math.PI / 2;
  wheel.rotation.x = 0.4;
  helm.add(wheel);
  root.add(helm);
  // The console: a dark desk with brass trim, a sloping panel with the chart and two dials, and
  // three brass cradles with claws along its front edge for the crystals.
  const desk = new THREE.Group();
  desk.position.set(front - 0.55, floor, -0.95);
  root.add(desk);
  desk.add(at(block(0.75, 1.0, 1.25, DARK()), 0, 0.5, 0));
  desk.add(at(block(0.85, 0.06, 1.35, WOOD(), 0.8), -0.03, 1.03, 0));
  const panel = new THREE.Group();
  panel.position.set(0.18, 1.3, 0);
  panel.rotation.z = 0.55;
  desk.add(panel);
  panel.add(block(0.08, 0.55, 1.2, DARK()));
  panel.add(at(block(0.1, 0.03, 1.22, BRASS()), 0, 0.28, 0));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.36),
    new THREE.MeshBasicMaterial({ map: chartScreen(), toneMapped: false }),
  );
  screen.userData.own = true;
  screen.rotation.y = -Math.PI / 2;
  screen.position.set(-0.05, 0.02, 0.18);
  panel.add(screen);
  const holders: THREE.Object3D[] = [];
  for (const dz of [-0.4, 0, 0.4]) {
    const cradle = new THREE.Group();
    cradle.position.set(-0.2, 1.07, dz);
    desk.add(cradle);
    cradle.add(tube(0.11, 0.14, 0.08, BRASS()));
    cradle.add(at(tube(0.07, 0.07, 0.02, DARK()), 0, 0.05, 0));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const claw = block(0.03, 0.2, 0.05, BRASS());
      claw.position.set(Math.cos(a) * 0.11, 0.12, Math.sin(a) * 0.11);
      claw.rotation.set(Math.sin(a) * 0.35, -a, -Math.cos(a) * 0.35);
      cradle.add(claw);
    }
    const seat = new THREE.Object3D();
    seat.position.y = 0.08;
    cradle.add(seat);
    holders.push(seat);
  }
  return { screen, holders };
}

export function crewBoatModel(): CrewBoat {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(hullGeometry(), HULL()));
  // The collar, its seam, and the rubbing pads along it.
  const path = collarPath();
  root.add(new THREE.Mesh(new THREE.TubeGeometry(path, 120, TUBE, 18, false), COLLAR()));
  // Its ends: cones past the transom.
  for (const t of [0, 1]) {
    const end = path.getPoint(t);
    const cone = new THREE.Mesh(
      metreUV(new THREE.SphereGeometry(TUBE, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), 1),
      COLLAR(),
    );
    cone.scale.set(1, 1.6, 1);
    cone.rotation.z = Math.PI / 2;
    cone.position.copy(end);
    root.add(cone);
  }
  for (let i = 3; i < 54; i += 2) {
    const t = i / 56;
    const p = path.getPoint(t);
    const tangent = path.getTangent(t);
    const out = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const fromMiddle = p.clone().sub(new THREE.Vector3(Math.min(p.x, 4), p.y, 0));
    if (out.dot(fromMiddle) < 0) out.negate();
    // A rubbing pad low on the tube, tilted to its curve.
    const pad = rounded(0.5, 0.14, 0.14, RUBBER());
    pad.position
      .copy(p)
      .addScaledVector(out, TUBE * 0.87)
      .setY(p.y - TUBE * 0.5);
    pad.rotation.set(0, -Math.atan2(tangent.z, tangent.x), 0);
    pad.rotateX(Math.sign(out.z || 1) * -0.5);
    root.add(pad);
  }
  // Her name on the collar, both sides, on a strip bent to the tube.
  const strip = new THREE.PlaneGeometry(5.2, 0.5, 1, 8);
  const sp = strip.getAttribute("position");
  for (let i = 0; i < sp.count; i++) {
    const h = sp.getY(i) + 0.12;
    sp.setZ(i, Math.sqrt(TUBE * TUBE - h * h) * 1.01 - TUBE);
  }
  strip.computeVertexNormals();
  for (const s of [-1, 1]) {
    const name = new THREE.Mesh(
      strip,
      surface(
        "rib-name",
        () =>
          new THREE.MeshStandardMaterial({
            map: nameDecal("TROPIC RUSH"),
            transparent: true,
            roughness: 0.4,
            depthWrite: false,
          }),
      ),
    );
    name.userData.own = true;
    name.position.set(-1.6, TUBE_Y + 0.12, s * (3.0 + TUBE));
    if (s < 0) name.rotation.y = Math.PI;
    root.add(name);
  }
  root.add(new THREE.Mesh(deckGeometry(), DECKING()));

  // The wheelhouse.
  const back = -2.6;
  const front = 1.6;
  const side = 1.6;
  const { screen, holders } = wheelhouse(root, back, front, side);

  // Aft: a bench across to sit on, the transom, twin outboard motors under a frame.
  root.add(at(block(0.6, 0.5, 4.0, SEAT()), -5.9, deckY(-5.9) + 0.25, 0));
  root.add(at(block(0.7, 0.12, 4.1, SEAT()), -5.9, deckY(-5.9) + 0.56, 0));
  root.add(at(block(0.3, 0.8, 4.6, HULL()), STERN + 0.15, DECK + 0.3, 0));
  for (const z of [-1.0, 1.0]) {
    const motor = new THREE.Group();
    motor.position.set(STERN - 0.45, DECK - 0.1, z);
    motor.add(at(rounded(0.95, 1.2, 0.8, MOTOR()), 0, 0.7, 0));
    motor.add(at(rounded(0.98, 0.1, 0.82, DARK()), 0, 0.35, 0));
    motor.add(at(block(0.3, 1.4, 0.22, DARK()), 0.05, -0.55, 0));
    motor.add(at(block(0.5, 0.08, 0.34, DARK()), 0, -1.2, 0));
    root.add(motor);
  }
  const frameA = new THREE.Vector3(STERN + 0.2, DECK + 0.3, -2.3);
  const frameB = new THREE.Vector3(STERN + 0.2, DECK + 0.3, 2.3);
  const topA = new THREE.Vector3(STERN + 0.6, DECK + 2.5, -1.6);
  const topB = new THREE.Vector3(STERN + 0.6, DECK + 2.5, 1.6);
  root.add(rod(frameA, topA, 0.06, ALUMINIUM()));
  root.add(rod(frameB, topB, 0.06, ALUMINIUM()));
  root.add(rod(topA, topB, 0.06, ALUMINIUM()));
  // Forward: cleats, and coiled line.
  for (const z of [-1.2, 1.2])
    root.add(at(block(0.35, 0.1, 0.1, ALUMINIUM()), 5.4, deckY(5.4) + 0.08, z));

  // The gun on its pedestal in the bow: it turns and kicks back.
  const gunX = 4.6;
  root.add(at(tube(0.12, 0.2, 1.0, DARK()), gunX, deckY(gunX) + 0.5, 0));
  const cannon = new THREE.Group();
  cannon.position.set(gunX, deckY(gunX) + 1.05, 0);
  cannon.add(tube(0.18, 0.18, 0.2, DARK()));
  const guns = new THREE.Group();
  guns.position.set(0, 0.25, 0);
  guns.add(at(block(0.9, 0.3, 0.26, DARK()), 0.1, 0, 0));
  const barrel = tube(0.07, 0.08, 1.6, DARK(), 10);
  barrel.geometry.rotateZ(-Math.PI / 2);
  barrel.position.set(1.3, 0.03, 0);
  guns.add(barrel);
  guns.add(
    at(block(0.3, 0.32, 0.22, shiny("rib-ammo", 0x5a6b3a, 0.6, 0.1, 0.4)), 0.05, -0.05, 0.27),
  );
  guns.add(at(block(0.12, 0.25, 0.08, DARK()), -0.45, -0.15, 0));
  const muzzle = new THREE.Object3D();
  muzzle.position.set(2.1, 0.03, 0);
  guns.add(muzzle);
  cannon.add(guns);
  root.add(cannon);

  bakeByMaterial(root, [cannon]);
  bakeByMaterial(cannon, [guns]);
  bakeByMaterial(guns);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.own) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const stations: Station[] = [
    // The best places first, which the camera finds best: in the bow, then aft.
    { x: 3.0, z: 1.25, facing: 0.5, sit: false, y: deckY(3.0) },
    { x: 3.0, z: -1.25, facing: -0.5, sit: false, y: deckY(3.0) },
    { x: -5.2, z: 1.2, facing: 0, sit: true, y: deckY(-5.2) },
    { x: -5.2, z: -1.2, facing: 0, sit: true, y: deckY(-5.2) },
    { x: -0.6, z: -2.15, facing: -Math.PI / 2, sit: false, y: deckY(-0.6) },
    { x: 5.2, z: 0.9, facing: 0.2, sit: false, y: deckY(5.2) },
    { x: -4.4, z: -1.9, facing: -2.2, sit: false, y: deckY(-4.4) },
    { x: -4.4, z: 1.9, facing: 2.2, sit: false, y: deckY(-4.4) },
  ];
  return {
    root,
    cannon,
    guns,
    muzzle,
    stations,
    console: {
      stand: { x: front - 1.35, z: -0.95, facing: 0, sit: false, y: deckY(front - 1.35) },
      screen,
      holders,
    },
    cabin: { back, front, side, door: { x: back, z: 0 } },
    sideDeck: side + 0.55,
    over: [
      { x: 6.4, z: 0.6 },
      { x: 6.4, z: -0.6 },
    ],
    length: STEM - STERN,
    beam: 6 + TUBE * 2,
  };
}

/** A kit bag, thrown ashore at a landing. */
export function gearBag(): THREE.Group {
  const bag = new THREE.Group();
  const body = cyl(0.32, 0.32, 1.1, 0x5c6b3c, 12);
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
