// Helpers for building placeholder models out of smooth, rounded primitives.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { type MaterialOptions, material } from "./palette";

export function mesh(
  geometry: THREE.BufferGeometry,
  color: number,
  options?: MaterialOptions,
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material(color, options));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function at<T extends THREE.Object3D>(
  object: T,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): T {
  object.position.set(x, y, z);
  object.rotation.set(rx, ry, rz);
  return object;
}

/** A box with softly rounded edges. */
export function rbox(
  w: number,
  h: number,
  d: number,
  color: number,
  options?: MaterialOptions,
): THREE.Mesh {
  const radius = Math.min(w, h, d) * 0.18;
  return mesh(new RoundedBoxGeometry(w, h, d, 2, radius), color, options);
}

export function cyl(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  color: number,
  segments = 16,
  options?: MaterialOptions,
): THREE.Mesh {
  return mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    color,
    options,
  );
}

/** A cylinder lying along +x (for barrels and logs). */
export function barrel(radius: number, len: number, color: number, segments = 14): THREE.Mesh {
  const m = cyl(radius, radius, len, color, segments);
  m.geometry.rotateZ(-Math.PI / 2);
  m.geometry.translate(len / 2, 0, 0);
  return m;
}

export function ball(
  radius: number,
  color: number,
  segments = 16,
  options?: MaterialOptions,
): THREE.Mesh {
  return mesh(
    new THREE.SphereGeometry(radius, segments, Math.max(8, Math.round(segments * 0.75))),
    color,
    options,
  );
}

export function cone(radius: number, height: number, color: number, segments = 16): THREE.Mesh {
  return mesh(new THREE.ConeGeometry(radius, height, segments), color);
}

export function capsule(radius: number, len: number, color: number): THREE.Mesh {
  return mesh(new THREE.CapsuleGeometry(radius, len, 6, 12), color);
}

export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const child of children) g.add(child);
  return g;
}

/** Paints every vertex of a geometry one color (for merged, single-material props). */
export function painted(geometry: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Merges painted geometries into one, so a whole prop draws in a single call. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = parts.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute("uv");
    return ng;
  });
  const merged = mergeGeometries(prepared, false);
  if (!merged) throw new Error("Could not merge prop geometry");
  return merged;
}

/** A sharp-edged box: 12 triangles, for small details that don't need rounded corners. */
export function plain(
  w: number,
  h: number,
  d: number,
  color: number,
  options?: MaterialOptions,
): THREE.Mesh {
  return mesh(new THREE.BoxGeometry(w, h, d), color, options);
}

/**
 * Merges every solid mesh under `root` into one vertex-colored mesh, so a detailed model is a
 * single draw call. Objects in `keep` (turning heads, flames) and their children stay separate.
 * `paint` swaps colors as they're baked, for repainting a model.
 */
export function bake(
  root: THREE.Object3D,
  keep: readonly THREE.Object3D[] = [],
  paint?: ReadonlyMap<number, number>,
): void {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const parts: THREE.BufferGeometry[] = [];
  const baked: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (keep.includes(o)) return;
    const m = o as THREE.Mesh;
    const stuff = m.material as THREE.MeshStandardMaterial | undefined;
    if (m.isMesh && stuff && !stuff.transparent) {
      const hex = stuff.color.getHex();
      const g = m.geometry.clone().applyMatrix4(toRoot.clone().multiply(m.matrixWorld));
      parts.push(painted(g, paint?.get(hex) ?? hex));
      baked.push(m);
    }
    for (const child of o.children) visit(child);
  };
  for (const child of root.children) visit(child);
  if (parts.length === 0) return;
  for (const m of baked) {
    m.removeFromParent();
    m.geometry.dispose();
  }
  const merged = new THREE.Mesh(merge(parts), vertexColored());
  merged.castShadow = true;
  merged.receiveShadow = true;
  root.add(merged);
}

/** A ring of sandbags around a building, as one mesh. */
export function sandbagRing(radius: number, layers: number, color: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  for (let layer = 0; layer < layers; layer++) {
    const count = Math.max(6, Math.round((Math.PI * 2 * radius) / 0.85));
    for (let i = 0; i < count; i++) {
      const angle = ((i + layer * 0.5) / count) * Math.PI * 2;
      const bag = new RoundedBoxGeometry(0.9, 0.42, 0.55, 2, 0.17);
      bag.rotateY(-angle + Math.PI / 2);
      bag.translate(Math.cos(angle) * radius, 0.21 + layer * 0.38, Math.sin(angle) * radius);
      parts.push(painted(bag, color));
    }
  }
  const m = new THREE.Mesh(merge(parts), vertexColored());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

let vertexColorMaterial: THREE.MeshStandardMaterial | null = null;

/** The one material shared by every merged, vertex-colored prop. */
export function vertexColored(): THREE.MeshStandardMaterial {
  vertexColorMaterial ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  return vertexColorMaterial;
}

/** Frees the geometries under an object (materials are shared and kept). */
export function disposeGeometries(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) o.geometry.dispose();
  });
}
