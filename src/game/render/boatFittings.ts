// What the gunboat (gunboat.ts) is fitted out with, each piece modelled on its own the way the real
// thing is put together: stainless cleats and grab rails on their bases, the anchor in its roller,
// the helm seats with their bolsters and armrests, the radar arch with its dome, open array, GPS and
// antennas, the weapon station on the hardtop, sterndrive legs and their propellers, the boarding
// ladder, downlights, navigation lights. And the surfaces they're made of (MAT; painted in
// boatParts.ts).
//
// Every piece comes back as plain meshes sharing those few surfaces; the boat bakes them together
// once she's assembled, so the screws cost one draw call between them.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  cushionMaps,
  gelcoatMaps,
  glassMaps,
  hullMaps,
  reflections,
  type SurfaceMaps,
  surface,
  teakMaps,
} from "./boatParts";

type V3 = THREE.Vector3;
export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// -------------------------------------------------------------------------------------------------
// Her surfaces. Only the big ones cast shadows (the hull, and the white mouldings: hardtop, cuddy,
// pillars, dash): the rails, fittings, seats and glass add a third to the cost of every shadow
// drawn for nothing anyone would see.

/** Marks a surface as one whose shadow isn't drawn. */
function shadowless<T extends THREE.Material>(m: T): T {
  m.userData.noShadow = true;
  return m;
}

const lit = (name: string, o: THREE.MeshStandardMaterialParameters, detail = false) =>
  surface(name, () => {
    const m = shadowless(new THREE.MeshStandardMaterial({ envMap: reflections(), ...o }));
    m.userData.detail = detail;
    return m;
  });

const mapped = (
  name: string,
  maps: () => SurfaceMaps,
  o: THREE.MeshStandardMaterialParameters = {},
) =>
  surface(name, () => {
    const s = maps();
    return new THREE.MeshStandardMaterial({
      map: s.map,
      roughnessMap: s.finish,
      metalnessMap: s.finish,
      ...(s.bump ? { bumpMap: s.bump } : {}),
      roughness: 1,
      metalness: 1,
      envMap: reflections(),
      ...o,
    });
  });

export const MAT = {
  /** Charcoal metallic under a clearcoat, which stops at the waterline (the finish's red). */
  hull: () =>
    surface("b-hull", () => {
      const s = hullMaps();
      return new THREE.MeshPhysicalMaterial({
        map: s.map,
        roughnessMap: s.finish,
        metalnessMap: s.finish,
        clearcoatMap: s.finish,
        roughness: 1,
        metalness: 1,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMap: reflections(),
        envMapIntensity: 1.1,
      });
    }),
  gelcoat: () => mapped("b-gelcoat", gelcoatMaps, { envMapIntensity: 0.75 }),
  teak: () => shadowless(mapped("b-teak", teakMaps, { envMapIntensity: 0.4, bumpScale: 1.2 })),
  cushion: () => shadowless(mapped("b-cushion", cushionMaps, { envMapIntensity: 0.35 })),
  glass: () =>
    surface("b-glass", () => {
      const s = glassMaps();
      return shadowless(
        new THREE.MeshPhysicalMaterial({
          map: s.map,
          roughnessMap: s.finish,
          metalnessMap: s.finish,
          roughness: 1,
          metalness: 1,
          clearcoat: 1,
          clearcoatRoughness: 0.02,
          envMap: reflections(),
          envMapIntensity: 1.6,
        }),
      );
    }),
  steel: () =>
    lit("b-steel", { color: 0xd8dbde, roughness: 0.14, metalness: 1, envMapIntensity: 1.3 }),
  satin: () => lit("b-satin", { color: 0x9da3a9, roughness: 0.34, metalness: 1 }),
  dark: () => lit("b-dark", { color: 0x2a2e33, roughness: 0.38, metalness: 0.4 }),
  seat: () => lit("b-seat", { color: 0x2e3237, roughness: 0.55, envMapIntensity: 0.5 }),
  rubber: () => lit("b-rubber", { color: 0x141619, roughness: 0.86, envMapIntensity: 0.3 }),
  white: () => lit("b-white", { color: 0xf1f2f0, roughness: 0.3, envMapIntensity: 0.7 }),
  screw: () => lit("b-screw", { color: 0xc3c7cb, roughness: 0.25, metalness: 1 }, true),
};

const glows = new Map<number, THREE.MeshBasicMaterial>();
/** Something lit from inside: a lamp's lens, a screen. Drawn as it is, never baked or shadowed. */
export function glowing(geometry: THREE.BufferGeometry, color: number): THREE.Mesh {
  let m = glows.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    glows.set(color, m);
  }
  const mesh = new THREE.Mesh(geometry, m);
  mesh.userData.own = true;
  return mesh;
}

// -------------------------------------------------------------------------------------------------
// Shapes.

/** Set while the light copy is built (gunboat.ts): every round part gets half its segments. */
export const lightBuild = { on: false };
/** `n` segments, or half as many (never fewer than `least`) for the light copy. */
export const segs = (n: number, least = 4) =>
  lightBuild.on ? Math.max(least, Math.round(n / 2)) : n;

type Mat = THREE.Material;

export function put<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

export function box(w: number, h: number, d: number, material: Mat): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

export function rounded(
  w: number,
  h: number,
  d: number,
  material: Mat,
  r?: number,
  segments = 2,
): THREE.Mesh {
  return new THREE.Mesh(
    new RoundedBoxGeometry(w, h, d, lightBuild.on ? 1 : segments, r ?? Math.min(w, h, d) * 0.22),
    material,
  );
}

/** A cylinder standing on the y axis. */
export function tube(r0: number, r1: number, h: number, material: Mat, segments = 16): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, segs(segments, 5)), material);
}

export function ball(r: number, material: Mat, segments = 12): THREE.Mesh {
  const around = segs(segments, 5);
  return new THREE.Mesh(new THREE.SphereGeometry(r, around, Math.max(4, around - 4)), material);
}

/** A rod from `a` to `b`, `r` thick. */
export function rod(a: V3, b: V3, r: number, material: Mat, segments = 8): THREE.Mesh {
  const m = tube(r, r, a.distanceTo(b), material, segments);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(v3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/** Tubing bent through `points`, its bends rounded: a rail, a frame, a hose. */
export function bent(points: readonly V3[], r: number, material: Mat, bend = 0.12): THREE.Mesh {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const at: V3[] = [points[0] as V3];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i] as V3;
    const before = (points[i - 1] as V3).clone().sub(p);
    const after = (points[i + 1] as V3).clone().sub(p);
    const inn = p
      .clone()
      .addScaledVector(before.normalize(), Math.min(bend, before.length() * 0.45));
    const out = p.clone().addScaledVector(after.normalize(), Math.min(bend, after.length() * 0.45));
    path.add(new THREE.LineCurve3((at[at.length - 1] as V3).clone(), inn));
    path.add(new THREE.QuadraticBezierCurve3(inn, p.clone(), out));
    at.push(out);
  }
  path.add(
    new THREE.LineCurve3(
      (at[at.length - 1] as V3).clone(),
      (points[points.length - 1] as V3).clone(),
    ),
  );
  const length = path.getLength();
  return new THREE.Mesh(
    new THREE.TubeGeometry(path, segs(Math.max(6, Math.round(length * 14))), r, segs(7, 4), false),
    material,
  );
}

/** A screw head, on a face that looks along +y. */
export function screw(size = 0.012): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(size, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2),
    MAT.screw(),
  );
  m.scale.y = 0.45;
  return m;
}

/** A round base, screwed down, for a rail or a post to stand on. Its top at y = 0.012. */
export function base(r = 0.045, screws = 3): THREE.Group {
  const g = new THREE.Group();
  g.add(put(tube(r * 0.72, r, 0.016, MAT.steel(), 20), 0, 0.008, 0));
  for (let i = 0; i < screws; i++) {
    const a = (i / screws) * Math.PI * 2 + 0.4;
    g.add(put(screw(r * 0.14), Math.cos(a) * r * 0.82, 0.012, Math.sin(a) * r * 0.82));
  }
  return g;
}

/** A grab rail through `points`, standing on a base at each end. */
export function grabRail(points: readonly V3[], r = 0.018): THREE.Group {
  const g = new THREE.Group();
  g.add(bent(points, r, MAT.steel(), 0.08));
  for (const end of [points[0], points[points.length - 1]]) {
    if (end) g.add(put(base(r * 2.4), end.x, end.y - 0.012, end.z));
  }
  return g;
}

/** A low-profile cleat, lying along x, on a deck at y = 0. */
export function cleat(length = 0.3): THREE.Group {
  const g = new THREE.Group();
  const horn = new THREE.Shape();
  const half = length / 2;
  horn.moveTo(-half, 0);
  horn.quadraticCurveTo(-half, 0.05, -half * 0.55, 0.055);
  horn.lineTo(half * 0.55, 0.055);
  horn.quadraticCurveTo(half, 0.05, half, 0);
  horn.lineTo(half * 0.45, 0.02);
  horn.quadraticCurveTo(half * 0.3, 0.035, half * 0.25, 0.0);
  horn.lineTo(-half * 0.25, 0.0);
  horn.quadraticCurveTo(-half * 0.3, 0.035, -half * 0.45, 0.02);
  horn.closePath();
  const body = new THREE.ExtrudeGeometry(horn, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: lightBuild.on ? 1 : 2,
    curveSegments: segs(6, 3),
  });
  body.translate(0, 0, -0.015);
  g.add(new THREE.Mesh(body, MAT.steel()));
  g.add(
    put(
      new THREE.Mesh(new RoundedBoxGeometry(length * 0.55, 0.01, 0.06, 2, 0.004), MAT.steel()),
      0,
      0.005,
      0,
    ),
  );
  for (const s of [-1, 1]) g.add(put(screw(0.008), s * length * 0.2, 0.01, 0));
  return g;
}

/** A stainless anchor stowed in its bow roller: its shank along x, its crown forward. */
export function anchor(): THREE.Group {
  const g = new THREE.Group();
  // The roller's cheek plates, and the roller.
  for (const z of [-0.075, 0.075]) {
    const cheek = new THREE.Shape();
    cheek.moveTo(-0.3, 0);
    cheek.lineTo(0.32, 0);
    cheek.quadraticCurveTo(0.42, 0.02, 0.4, 0.12);
    cheek.lineTo(-0.3, 0.09);
    cheek.closePath();
    const plate = new THREE.ExtrudeGeometry(cheek, {
      depth: 0.014,
      bevelEnabled: false,
      curveSegments: segs(6, 3),
    });
    plate.translate(0, 0, z - 0.007);
    g.add(new THREE.Mesh(plate, MAT.steel()));
  }
  const roller = tube(0.045, 0.045, 0.14, MAT.rubber(), 14);
  roller.rotation.x = Math.PI / 2;
  g.add(put(roller, 0.32, 0.06, 0));
  // The shank, and the plough: two flukes swept back from the crown.
  const shank = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.05, 0.028, 2, 0.01), MAT.steel());
  g.add(put(shank, 0.05, 0.13, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 8, 16), MAT.steel());
  g.add(put(ring, -0.32, 0.13, 0));
  for (const s of [-1, 1]) {
    const fluke = new THREE.Shape();
    fluke.moveTo(0, 0);
    fluke.quadraticCurveTo(0.08, 0.15, 0.04, 0.24);
    fluke.lineTo(-0.16, 0.06);
    fluke.closePath();
    const blade = new THREE.ExtrudeGeometry(fluke, {
      depth: 0.012,
      bevelEnabled: true,
      bevelSize: 0.006,
      bevelThickness: 0.004,
      bevelSegments: lightBuild.on ? 1 : 2,
      curveSegments: segs(8, 3),
    });
    const m = new THREE.Mesh(blade, MAT.steel());
    m.rotation.set(Math.PI / 2, 0, 0);
    m.rotateY(s * 0.4);
    m.scale.z = s;
    g.add(put(m, 0.42, 0.11, 0));
  }
  return g;
}

/**
 * A helm seat on its own, facing +x with its seat at y = 0: a moulded shell, a bolstered cushion
 * and back in dark vinyl with welted seams, a headrest, armrests, a flip-up bolster.
 */
export function helmSeat(): THREE.Group {
  const g = new THREE.Group();
  const seat = MAT.seat();
  g.add(put(rounded(0.56, 0.1, 0.56, seat, 0.045), 0, 0.05, 0));
  for (const s of [-1, 1]) g.add(put(rounded(0.5, 0.11, 0.09, seat, 0.04), 0.0, 0.1, s * 0.25));
  g.add(put(rounded(0.36, 0.08, 0.46, seat, 0.035), 0.24, 0.02, 0));
  const back = rounded(0.12, 0.62, 0.56, seat, 0.05);
  back.rotation.z = 0.1;
  g.add(put(back, -0.27, 0.4, 0));
  for (const s of [-1, 1]) {
    const wing = rounded(0.14, 0.5, 0.08, seat, 0.035);
    wing.rotation.z = 0.1;
    g.add(put(wing, -0.24, 0.38, s * 0.27));
  }
  const head = rounded(0.12, 0.2, 0.4, seat, 0.05);
  head.rotation.z = 0.1;
  g.add(put(head, -0.33, 0.83, 0));
  // Welts: thin lighter lines where the panels are sewn.
  for (const y of [0.22, 0.52]) {
    const welt = rounded(0.006, 0.012, 0.5, MAT.satin(), 0.003, 1);
    welt.rotation.z = 0.1;
    g.add(put(welt, -0.205 - y * 0.1, y, 0));
  }
  // The shell under the cushion, and armrests on struts.
  g.add(put(rounded(0.6, 0.06, 0.6, MAT.white(), 0.025), -0.02, -0.03, 0));
  for (const s of [-1, 1]) {
    g.add(put(rounded(0.34, 0.06, 0.08, seat, 0.025), 0.04, 0.3, s * 0.33));
    g.add(rod(v3(-0.1, -0.02, s * 0.33), v3(-0.08, 0.27, s * 0.33), 0.012, MAT.steel(), 8));
  }
  return g;
}

/**
 * The radar arch: a stainless frame on the hardtop, carrying the open-array scanner on its pod,
 * a radome, a GPS dome, VHF whips, a horn and an all-round light. Stands on y = 0, +x forward.
 * `scanner` is the array, to turn.
 */
export function radarArch(): { group: THREE.Group; scanner: THREE.Mesh } {
  const g = new THREE.Group();
  const steel = MAT.steel();
  const white = MAT.white();
  const legs = [-0.48, 0.48];
  for (const z of legs) {
    g.add(
      bent(
        [v3(-0.32, 0, z), v3(-0.26, 0.46, z), v3(0.26, 0.46, z), v3(0.32, 0, z)],
        0.024,
        steel,
        0.1,
      ),
    );
    for (const x of [-0.32, 0.32]) g.add(put(base(0.05), x, -0.012, z));
  }
  g.add(rod(v3(0, 0.46, -0.48), v3(0, 0.46, 0.48), 0.024, steel));
  g.add(rod(v3(-0.18, 0.46, -0.48), v3(-0.18, 0.46, 0.48), 0.018, steel));
  // The plate across the top, and the radome on it.
  g.add(put(rounded(0.5, 0.03, 0.96, MAT.satin(), 0.012), 0, 0.485, 0));
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    white,
  );
  g.add(put(tube(0.27, 0.27, 0.16, white, 28), 0.04, 0.58, 0));
  g.add(put(dome, 0.04, 0.66, 0));
  // The open array, on its pedestal above the dome.
  g.add(put(tube(0.06, 0.08, 0.38, white, 16), 0.04, 1.08, 0));
  g.add(put(rounded(0.3, 0.14, 0.24, white, 0.05), 0.04, 1.32, 0));
  const scanner = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.1, 1.45, 3, 0.04), white);
  scanner.userData.own = true;
  scanner.castShadow = true;
  scanner.name = "radar";
  g.add(put(scanner, 0.04, 1.45, 0));
  // GPS, whips, horn, light.
  for (const z of [-0.36, 0.36]) {
    g.add(put(tube(0.012, 0.012, 0.1, steel, 8), -0.18, 0.54, z));
    g.add(put(tube(0.06, 0.055, 0.04, white, 18), -0.18, 0.6, z));
    g.add(
      put(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          white,
        ),
        -0.18,
        0.62,
        z,
      ),
    );
  }
  for (const [z, h] of [
    [-0.46, 1.6],
    [0.46, 2.1],
  ] as const) {
    g.add(put(tube(0.02, 0.024, 0.08, MAT.dark(), 10), 0.2, 0.52, z));
    g.add(put(tube(0.005, 0.012, h, white, 6), 0.2, 0.56 + h / 2, z));
  }
  const horn = tube(0.075, 0.018, 0.22, white, 18);
  horn.rotation.z = -Math.PI / 2;
  g.add(put(horn, 0.22, 0.55, -0.2));
  g.add(put(tube(0.03, 0.03, 0.08, steel, 10), -0.08, 0.53, 0.25));
  g.add(
    put(glowing(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 12), 0xfff8e6), -0.08, 0.595, 0.25),
  );
  return { group: g, scanner };
}

/**
 * The weapon station on the hardtop: a low armoured turret ring, the cradle on it, the machine gun
 * with its shroud, brake and feed cover, the ammunition can, and the sight's box with its glass.
 * `cannon` turns to where she's firing, `guns` kicks back, `muzzle` is where the shot leaves.
 */
export function weaponStation(): {
  group: THREE.Group;
  cannon: THREE.Group;
  guns: THREE.Group;
  muzzle: THREE.Object3D;
} {
  const group = new THREE.Group();
  const dark = MAT.dark();
  group.add(put(tube(0.36, 0.4, 0.08, dark, 32), 0, 0.04, 0));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    group.add(put(screw(0.014), Math.cos(a) * 0.37, 0.081, Math.sin(a) * 0.37));
  }
  const cannon = new THREE.Group();
  cannon.name = "cannon";
  cannon.position.y = 0.08;
  // The turret: a faceted housing, lower at the front.
  const shell = new THREE.Shape();
  shell.moveTo(-0.34, 0);
  shell.lineTo(0.3, 0);
  shell.lineTo(0.38, 0.12);
  shell.lineTo(0.22, 0.3);
  shell.lineTo(-0.3, 0.32);
  shell.lineTo(-0.38, 0.16);
  shell.closePath();
  const housing = new THREE.ExtrudeGeometry(shell, {
    depth: 0.5,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: lightBuild.on ? 1 : 2,
  });
  housing.translate(0, 0, -0.25);
  cannon.add(new THREE.Mesh(housing, dark));
  for (const z of [-0.2, 0.2]) cannon.add(put(box(0.5, 0.012, 0.012, MAT.satin()), 0, 0.31, z));
  // The sight: a box with a dark window and a lit lens.
  cannon.add(put(rounded(0.2, 0.14, 0.16, dark, 0.02), 0.04, 0.4, -0.18));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), MAT.glass());
  glass.rotation.y = Math.PI / 2;
  cannon.add(put(glass, 0.142, 0.4, -0.18));
  const guns = new THREE.Group();
  guns.name = "guns";
  guns.position.y = 0.2;
  guns.add(put(rounded(0.62, 0.13, 0.11, dark, 0.02), 0.12, 0.04, 0.08));
  guns.add(put(rounded(0.28, 0.04, 0.12, MAT.satin(), 0.01), 0.1, 0.12, 0.08));
  const shroud = tube(0.045, 0.045, 0.5, dark, 16);
  shroud.rotation.z = -Math.PI / 2;
  guns.add(put(shroud, 0.65, 0.04, 0.08));
  for (let i = 0; i < 6; i++) {
    const hole = tube(0.047, 0.047, 0.02, MAT.rubber(), 16);
    hole.rotation.z = -Math.PI / 2;
    guns.add(put(hole, 0.48 + i * 0.07, 0.04, 0.08));
  }
  const barrel = tube(0.022, 0.026, 0.62, dark, 12);
  barrel.rotation.z = -Math.PI / 2;
  guns.add(put(barrel, 1.1, 0.04, 0.08));
  const brake = tube(0.036, 0.032, 0.1, dark, 12);
  brake.rotation.z = -Math.PI / 2;
  guns.add(put(brake, 1.44, 0.04, 0.08));
  guns.add(put(rounded(0.24, 0.17, 0.12, MAT.seat(), 0.02), 0.06, -0.02, 0.24));
  const muzzle = new THREE.Object3D();
  muzzle.name = "muzzle";
  muzzle.position.set(1.5, 0.04, 0.08);
  guns.add(muzzle);
  cannon.add(guns);
  group.add(cannon);
  return { group, cannon, guns, muzzle };
}

/** A sterndrive leg, hung under the swim platform: its top at the origin, the propellers below. */
export function sterndrive(): THREE.Group {
  const g = new THREE.Group();
  const dark = MAT.dark();
  const leg = new THREE.Shape();
  leg.moveTo(-0.16, 0);
  leg.lineTo(0.2, 0);
  leg.quadraticCurveTo(0.12, -0.5, 0.1, -0.78);
  leg.lineTo(-0.12, -0.8);
  leg.quadraticCurveTo(-0.2, -0.4, -0.16, 0);
  const blade = new THREE.ExtrudeGeometry(leg, {
    depth: 0.1,
    bevelEnabled: true,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    bevelSegments: lightBuild.on ? 1 : 3,
    curveSegments: segs(8, 3),
  });
  blade.translate(0, 0, -0.05);
  g.add(new THREE.Mesh(blade, dark));
  g.add(put(rounded(0.5, 0.03, 0.34, dark, 0.012), -0.05, -0.32, 0));
  const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 6, 16), dark);
  pod.rotation.z = Math.PI / 2;
  g.add(put(pod, 0.0, -0.86, 0));
  g.add(put(rounded(0.28, 0.16, 0.025, dark, 0.01), 0.04, -0.99, 0));
  // Two propellers, one behind the other, turning opposite ways.
  for (const [x, turn] of [
    [-0.3, 0],
    [-0.4, 0.5],
  ] as const) {
    const hub = tube(0.05, 0.065, 0.1, MAT.satin(), 14);
    hub.rotation.z = Math.PI / 2;
    g.add(put(hub, x, -0.86, 0));
    for (let i = 0; i < 3; i++) {
      const prop = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 6), MAT.satin());
      prop.scale.set(0.1, 1, 0.45);
      const arm = new THREE.Group();
      arm.position.set(x, -0.86, 0);
      arm.rotation.x = (i / 3) * Math.PI * 2 + turn;
      prop.position.y = 0.13;
      prop.rotation.y = 0.55;
      arm.add(prop);
      g.add(arm);
    }
  }
  return g;
}

/** The boarding ladder, folded up under the swim platform's edge: rungs between two rails. */
export function ladder(): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-0.18, 0.18])
    g.add(rod(v3(0, 0, z), v3(-0.05, -0.62, z), 0.014, MAT.steel(), 10));
  for (let i = 1; i <= 3; i++) {
    g.add(put(rounded(0.06, 0.02, 0.36, MAT.steel(), 0.008), -0.016 * i, -0.17 * i, 0));
  }
  return g;
}

/** A downlight in the hardtop's lining, facing down. */
export function downlight(): THREE.Group {
  const g = new THREE.Group();
  g.add(put(tube(0.05, 0.05, 0.012, MAT.steel(), 18), 0, -0.006, 0));
  const lens = glowing(new THREE.CircleGeometry(0.036, 16), 0xfff1d6);
  lens.rotation.x = Math.PI / 2;
  g.add(put(lens, 0, -0.013, 0));
  return g;
}

/** A navigation light: a lens of `color` in a stainless housing, facing +z. */
export function navLight(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(put(rounded(0.16, 0.07, 0.04, MAT.steel(), 0.012), 0, 0, 0.02));
  g.add(put(glowing(new RoundedBoxGeometry(0.12, 0.045, 0.02, 2, 0.008), color), 0, 0, 0.045));
  return g;
}
