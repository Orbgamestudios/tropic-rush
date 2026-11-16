// The two short films either side of a raid (docs/DESIGN.md, Added 2026-11-16).
//
// The landing: the gunboat's in the shallows, the crew jumps down and wades up the beach to where
// the fight starts, and the camera starts low by the boat and rises to sit over the player's hero,
// where it stays for the raid.
//
// The way home, after a win: the crew walks back down to the boat carrying what they took, throws
// it aboard, climbs in, and she pulls away as the light goes; three shots, cut together: close on a
// hero with a crate, from the water as the loot comes over the side, and wide as she leaves.
//
// Both only say where the crew is and where the camera is at each moment; the raid's own view draws
// them. Nothing here changes how a raid plays.

import * as THREE from "three";
import type { Vec2 } from "../logic/vec";
import { rbox } from "./shapes";

const ease = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

export interface Shot {
  camera: THREE.Vector3;
  look: THREE.Vector3;
  /** 0 to keep to the raid's own camera, 1 to use this one; in between, partly each. */
  weight: number;
}

/** Where each of the crew is during a film, and whether they're walking. */
export interface CrewPlace {
  pos: Vec2;
  facing: number;
  moving: boolean;
  /** Hidden: aboard the boat, below the gunwale. */
  aboard: boolean;
}

export const LANDING_SECONDS = 3.4;

/** The landing: who's where, and the camera, `t` seconds in. */
export function landing(
  t: number,
  boat: Vec2,
  spawn: Vec2,
  crew: number,
): { places: CrewPlace[]; shot: Shot } {
  const way = Math.atan2(spawn.y - boat.y, spawn.x - boat.x);
  const places: CrewPlace[] = [];
  for (let i = 0; i < crew; i++) {
    // One after another over the side, a moment apart, and spread across the beach.
    const start = 0.35 + i * 0.3;
    const along = ease((t - start) / (LANDING_SECONDS - 0.8 - start));
    const spread = (i - (crew - 1) / 2) * 1.6;
    const to = { x: spawn.x - Math.sin(way) * spread, y: spawn.y + Math.cos(way) * spread };
    places.push({
      pos: { x: boat.x + (to.x - boat.x) * along, y: boat.y + (to.y - boat.y) * along },
      facing: way,
      moving: along > 0 && along < 1,
      aboard: t < start,
    });
  }
  // Low over the water beside the boat, looking up the beach; then rising and handing over.
  const side = way + Math.PI * 0.55;
  const camera = new THREE.Vector3(
    boat.x + Math.cos(side) * 9 - Math.cos(way) * 4,
    2.2,
    boat.y + Math.sin(side) * 9 - Math.sin(way) * 4,
  );
  const look = new THREE.Vector3((boat.x + spawn.x) / 2, 1.2, (boat.y + spawn.y) / 2);
  const weight = 1 - ease((t - 1.4) / (LANDING_SECONDS - 1.4));
  return { places, shot: { camera, look, weight } };
}

export const DEPARTURE_SECONDS = 8.5;
/** How high a crate's carried, above the sand. */
export const CARRIED = 1.15;

/** Where a crate is; `held` while it's still in someone's arms, for the view to keep it there. */
export interface Crate {
  at: THREE.Vector3;
  held: boolean;
}
/** When each shot of the way home starts. */
const SHOTS = [0, 2.8, 5.6] as const;

/** A crate of loot, carried and thrown aboard. */
export function lootCrate(): THREE.Object3D {
  const crate = new THREE.Group();
  crate.add(rbox(0.7, 0.55, 0.55, 0x9a6a3a));
  const band = rbox(0.74, 0.08, 0.58, 0x4a3420);
  band.position.y = 0.12;
  crate.add(band);
  const gold = rbox(0.5, 0.12, 0.38, 0xffcf4a);
  gold.position.y = 0.32;
  crate.add(gold);
  crate.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return crate;
}

/**
 * The way home: who's where, where each crate is (null once it's aboard, out of sight), the
 * boat's pull away from the beach, and the camera, `t` seconds in. `from` is where each of the crew
 * stood when the raid was won.
 */
export function departure(
  t: number,
  boat: Vec2,
  shore: Vec2,
  from: readonly Vec2[],
): { places: CrewPlace[]; crates: (Crate | null)[]; boatOut: number; shot: Shot } {
  const places: CrewPlace[] = [];
  const crates: (Crate | null)[] = [];
  // Up the beach from the boat (u), and along it (v).
  const inland = Math.atan2(shore.y - boat.y, shore.x - boat.x);
  const u = { x: Math.cos(inland), y: Math.sin(inland) };
  const v = { x: -u.y, y: u.x };
  const at = (up: number, along: number) => ({
    x: boat.x + u.x * up + v.x * along,
    y: boat.y + u.y * up + v.y * along,
  });
  from.forEach((start, i) => {
    // Everyone walks down to the water's edge by the boat in the first two shots.
    const to = at(3, (i - (from.length - 1) / 2) * 1.4);
    const walk = ease(t / (SHOTS[2] - 0.6 - i * 0.2));
    const pos = { x: start.x + (to.x - start.x) * walk, y: start.y + (to.y - start.y) * walk };
    const facing = Math.atan2(to.y - start.y, to.x - start.x);
    // Carried out in front, chest high; over the side at the start of the second shot, one after
    // another; then they climb in.
    const throwAt = SHOTS[1] + 0.4 + i * 0.35;
    const flight = (t - throwAt) / 0.7;
    const held = { x: pos.x + Math.cos(facing) * 0.55, y: pos.y + Math.sin(facing) * 0.55 };
    if (flight < 0) crates.push({ at: new THREE.Vector3(held.x, CARRIED, held.y), held: true });
    else if (flight < 1) {
      const x = held.x + (boat.x - held.x) * flight;
      const y = held.y + (boat.y - held.y) * flight;
      const up = CARRIED + Math.sin(flight * Math.PI) * 2.6;
      crates.push({ at: new THREE.Vector3(x, up, y), held: false });
    } else crates.push(null);
    const aboard = t > throwAt + 1.1;
    places.push({ pos: aboard ? boat : pos, facing, moving: walk > 0 && walk < 1, aboard });
  });
  const boatOut = ease((t - SHOTS[2] - 0.3) / (DEPARTURE_SECONDS - SHOTS[2] - 0.3)) * 22;
  const lead = places[0]?.pos ?? boat;
  let shot: Shot;
  if (t < SHOTS[1]) {
    // Close on the first of the crew, walking with the crate, from a little ahead and below.
    const ahead = Math.atan2(boat.y - lead.y, boat.x - lead.x);
    shot = {
      camera: new THREE.Vector3(
        lead.x + Math.cos(ahead + 0.5) * 5,
        1.6,
        lead.y + Math.sin(ahead + 0.5) * 5,
      ),
      look: new THREE.Vector3(lead.x, 1.4, lead.y),
      weight: 1,
    };
  } else if (t < SHOTS[2]) {
    // From the water off the boat's quarter, looking in past her at the loot coming over the side.
    const cam = at(-9, -4);
    const look = at(2, 0);
    shot = {
      camera: new THREE.Vector3(cam.x, 1.4, cam.y),
      look: new THREE.Vector3(look.x, 1.6, look.y),
      weight: 1,
    };
  } else {
    // Wide and high from the beach as she pulls away into the dark.
    const out = (t - SHOTS[2]) / (DEPARTURE_SECONDS - SHOTS[2]);
    const cam = at(10 + out * 3, 12);
    const look = at(-boatOut, 0);
    shot = {
      camera: new THREE.Vector3(cam.x, 8 + out * 3, cam.y),
      look: new THREE.Vector3(look.x, 0.5, look.y),
      weight: 1,
    };
  }
  return { places, crates, boatOut, shot };
}
