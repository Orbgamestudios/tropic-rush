// The enemy camp's clutter, so the base looks lived in: steel tank traps on the landing beach,
// wooden barricades, crate stacks and oil drums beside the buildings, canvas tents in the
// clearing and enemy flags flying by the headquarters. Scenery only: heroes walk through it and
// it never blocks shots (the rules' own cover is the rocks in props.ts).

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BUILDINGS } from "../logic/buildings";
import { beachSide, beachWidth, type IslandLayout, shoreDistance } from "../logic/island";
import { createRng } from "../logic/rng";
import { COLORS } from "./palette";
import { instanced, type PropInstance, swaying } from "./props";
import type { SceneryMap } from "./scenery";
import { merge, painted } from "./shapes";

function beam(w: number, h: number, d: number, color: number): THREE.BufferGeometry {
  return painted(new THREE.BoxGeometry(w, h, d), color);
}

/** A Czech hedgehog: three steel beams welded crossways. */
function tankTrapGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const axes: [number, number, number][] = [
    [0.62, 0, 0],
    [0, 0, 0.62],
    [0, 0.62, 0],
  ];
  axes.forEach(([rx, ry, rz], i) => {
    const b = beam(1.7, 0.13, 0.13, i % 2 ? 0x4a4e55 : 0x5b5f66);
    b.rotateZ(Math.PI / 4 + rz);
    b.rotateX(rx);
    b.rotateY((i * Math.PI * 2) / 3 + ry);
    parts.push(b);
  });
  // Rust streaks where the beams meet.
  const knot = new THREE.SphereGeometry(0.14, 6, 4);
  parts.push(painted(knot, COLORS.enemyRust));
  const all = merge(parts);
  all.translate(0, 0.6, 0);
  return all;
}

function barricadeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-0.8, 0.8]) {
    for (const lean of [0.7, -0.7]) {
      const leg = beam(0.12, 1.3, 0.12, COLORS.woodDark);
      leg.rotateX(lean);
      leg.translate(side, 0.5, 0);
      parts.push(leg);
    }
  }
  for (const y of [0.45, 0.8]) parts.push(beam(2.2, 0.16, 0.08, COLORS.wood).translate(0, y, 0.02));
  // Barbed wire along the top.
  const wire = new THREE.TorusGeometry(0.12, 0.012, 3, 8);
  for (let i = 0; i < 7; i++) {
    const loop = wire.clone();
    loop.rotateY(Math.PI / 2);
    loop.translate(-0.9 + i * 0.3, 0.98, 0);
    parts.push(painted(loop, 0x8a8f96));
  }
  return merge(parts);
}

function crateGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const boxes: [number, number, number, number, number][] = [
    [0, 0.35, 0, 0.7, 0],
    [0.78, 0.3, 0.1, 0.6, 0.3],
    [0.3, 0.98, 0.05, 0.56, -0.2],
  ];
  for (const [x, y, z, s, turn] of boxes) {
    const box = new RoundedBoxGeometry(s, s, s, 1, 0.04);
    box.rotateY(turn);
    box.translate(x, y, z);
    parts.push(painted(box, COLORS.woodLight));
    // Darker slats across each face.
    for (const dy of [-0.3, 0.3]) {
      const slat = new THREE.BoxGeometry(s + 0.02, s * 0.1, s + 0.02);
      slat.rotateY(turn);
      slat.translate(x, y + dy * s, z);
      parts.push(painted(slat, COLORS.wood));
    }
  }
  return merge(parts);
}

function drumsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const drums: [number, number, number][] = [
    [0, 0, COLORS.enemyRust],
    [0.62, 0.2, COLORS.enemyDark],
    [0.25, -0.55, COLORS.enemyRust],
  ];
  for (const [x, z, color] of drums) {
    const drum = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12);
    drum.translate(x, 0.45, z);
    parts.push(painted(drum, color));
    for (const y of [0.25, 0.65]) {
      const band = new THREE.CylinderGeometry(0.315, 0.315, 0.05, 12);
      band.translate(x, y, z);
      parts.push(painted(band, 0x2c2f35));
    }
  }
  // One knocked over.
  const fallen = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12);
  fallen.rotateX(Math.PI / 2);
  fallen.translate(-0.7, 0.3, 0.3);
  parts.push(painted(fallen, COLORS.enemyDark));
  return merge(parts);
}

function tentGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // A ridge tent: a triangular prism lying along x.
  const body = new THREE.CylinderGeometry(1.25, 1.25, 3, 3, 1);
  body.rotateZ(Math.PI / 2);
  body.rotateX(Math.PI / 6 + Math.PI);
  body.translate(0, 0.62, 0);
  parts.push(painted(body, 0x7d7a52));
  // The dark doorway at the front.
  const door = new THREE.CylinderGeometry(0.62, 0.62, 0.05, 3, 1);
  door.rotateZ(Math.PI / 2);
  door.rotateX(Math.PI / 6 + Math.PI);
  door.translate(1.52, 0.31, 0);
  parts.push(painted(door, 0x2b2a22));
  for (const x of [-1.6, 1.6])
    parts.push(beam(0.07, 1.4, 0.07, COLORS.woodDark).translate(x, 0.7, 0));
  // Guy ropes pegged into the ground.
  for (const z of [-1.3, 1.3]) parts.push(beam(3.3, 0.03, 0.03, 0xcbbf9a).translate(0, 0.05, z));
  return merge(parts);
}

function flagGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const pole = new THREE.CylinderGeometry(0.05, 0.07, 5, 6);
  pole.translate(0, 2.5, 0);
  parts.push(painted(pole, 0x3a3e44));
  const knob = new THREE.SphereGeometry(0.1, 6, 4);
  knob.translate(0, 5.05, 0);
  parts.push(painted(knob, COLORS.gold));
  const cloth = new THREE.BoxGeometry(1.5, 0.95, 0.03, 6, 1, 1);
  cloth.translate(0.8, 4.4, 0);
  parts.push(painted(cloth, COLORS.enemyRust));
  const stripe = new THREE.BoxGeometry(1.5, 0.22, 0.04, 6, 1, 1);
  stripe.translate(0.8, 4.4, 0);
  parts.push(painted(stripe, COLORS.enemyDark));
  return merge(parts);
}

export function buildCamp(layout: IslandLayout, map: SceneryMap): THREE.Group {
  const rng = createRng(layout.seed + 911);
  const traps: PropInstance[] = [];
  const barricades: PropInstance[] = [];
  const crates: PropInstance[] = [];
  const drums: PropInstance[] = [];
  const tents: PropInstance[] = [];
  const flags: PropInstance[] = [];
  const one = new THREE.Vector3(1, 1, 1);
  const free = (x: number, y: number, room: number) =>
    map.room(x, y) > room && map.trail(x, y) > 2.6 && map.jungle(x, y) < 0.35;

  // Clutter beside the buildings, on the side facing away from the beach where it can.
  for (const b of layout.buildings) {
    const radius = BUILDINGS[b.type].radius;
    const tries = b.type === "headquarters" ? 4 : 2;
    for (let i = 0; i < tries; i++) {
      const angle = rng() * Math.PI * 2;
      const gap = radius + 1.6 + rng() * 2.2;
      const x = b.pos.x + Math.cos(angle) * gap;
      const y = b.pos.y + Math.sin(angle) * gap;
      if (!free(x, y, 1.1)) continue;
      const item = { x, y, rotation: rng() * Math.PI * 2, scale: one.clone() };
      const roll = rng();
      if (roll < 0.4) crates.push(item);
      else if (roll < 0.75) drums.push(item);
      else barricades.push({ ...item, rotation: -angle });
    }
  }

  // Flags by the headquarters, on the side facing the beach.
  const hq = layout.buildings.find((b) => b.type === "headquarters");
  if (hq) {
    const toBeach = Math.atan2(layout.spawn.y - hq.pos.y, layout.spawn.x - hq.pos.x);
    for (const side of [-0.55, 0.55]) {
      const gap = BUILDINGS.headquarters.radius + 2.2;
      const x = hq.pos.x + Math.cos(toBeach + side) * gap;
      const y = hq.pos.y + Math.sin(toBeach + side) * gap;
      flags.push({ x, y, rotation: rng() * Math.PI * 2, scale: one.clone() });
    }
  }

  // A few tents in the open parts of the clearing.
  for (let i = 0; i < 60 && tents.length < 3; i++) {
    const angle = rng() * Math.PI * 2;
    const r = 14 + rng() * 22;
    const x = (hq?.pos.x ?? 0) + Math.cos(angle) * r;
    const y = (hq?.pos.y ?? 0) + Math.sin(angle) * r;
    if (!free(x, y, 3.2) || map.grass(x, y) < 0.9) continue;
    if (tents.some((t) => Math.hypot(t.x - x, t.y - y) < 8)) continue;
    tents.push({ x, y, rotation: rng() * Math.PI * 2, scale: one.clone() });
  }

  // Tank traps scattered across the landing beach, clear of the boat and the trail.
  for (let i = 0; i < 400 && traps.length < 16; i++) {
    const x = layout.spawn.x + (rng() - 0.5) * 70;
    const y = layout.spawn.y + (rng() - 0.5) * 70;
    const sd = shoreDistance(x, y);
    if (beachSide(x, y) < 0.4 || sd < 2.5 || sd > beachWidth(x, y) - 1) continue;
    if (Math.hypot(x - layout.spawn.x, y - layout.spawn.y) < 9) continue;
    if (Math.hypot(x - layout.boat.x, y - layout.boat.y) < 8) continue;
    if (map.trail(x, y) < 3.5 || map.room(x, y) < 1.5) continue;
    if (traps.some((t) => Math.hypot(t.x - x, t.y - y) < 3.5)) continue;
    traps.push({
      x,
      y,
      rotation: rng() * Math.PI * 2,
      scale: new THREE.Vector3().setScalar(1.1 + rng() * 0.35),
    });
  }

  const root = new THREE.Group();
  root.add(
    instanced(tankTrapGeometry(), traps),
    instanced(barricadeGeometry(), barricades),
    instanced(crateGeometry(), crates),
    instanced(drumsGeometry(), drums),
    instanced(tentGeometry(), tents),
    instanced(flagGeometry(), flags, true, swaying(false)),
  );
  return root;
}
