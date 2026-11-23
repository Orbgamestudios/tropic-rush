// Keeps the camera out of solid things. The surfaces of a model are marked once in a grid (in the
// model's own space), grown by the room the camera's near plane needs. Each frame, a camera that's
// come into a marked cell (inside something, or close enough to cut into it) is moved to the nearest
// open point; one out in the open stays where it is, whatever's between it and what it looks at (a
// wide shot of the boat sees her from outside). It costs a few look-ups a frame, where a ray against
// the boat's own triangles would cost thousands.

import * as THREE from "three";

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const p = new THREE.Vector3();
const ab = new THREE.Vector3();
const ac = new THREE.Vector3();
const way = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
/** How far a camera is looked for a way out of something, in metres. */
const WAY_OUT = 3;

export class CameraGuard {
  private readonly blocked: Uint8Array;
  /** The surfaces themselves, before they're grown: for whether a line passes through one. */
  private readonly solid: Uint8Array;
  private readonly min = new THREE.Vector3();
  private readonly nx: number;
  private readonly ny: number;
  private readonly nz: number;

  /**
   * `root`'s meshes, in `frame`'s space (the space the camera's points will be given in). `cell` is
   * the grid's size in metres; `room` how far from any surface the camera is kept.
   */
  constructor(root: THREE.Object3D, frame: THREE.Object3D, cell = 0.1, room = 0.35) {
    this.cell = cell;
    frame.updateMatrixWorld(true);
    const into = frame.matrixWorld.clone().invert();
    const meshes: { mesh: THREE.Mesh; matrix: THREE.Matrix4 }[] = [];
    const bounds = new THREE.Box3();
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || !o.visible) return;
      const position = o.geometry.getAttribute("position");
      if (!position) return;
      const matrix = into.clone().multiply(o.matrixWorld);
      o.geometry.computeBoundingBox();
      if (o.geometry.boundingBox) bounds.union(o.geometry.boundingBox.clone().applyMatrix4(matrix));
      meshes.push({ mesh: o, matrix });
    });
    const pad = room + cell * 2;
    bounds.expandByScalar(pad);
    this.min.copy(bounds.min);
    const size = bounds.getSize(new THREE.Vector3());
    this.nx = Math.max(1, Math.ceil(size.x / cell));
    this.ny = Math.max(1, Math.ceil(size.y / cell));
    this.nz = Math.max(1, Math.ceil(size.z / cell));
    const solid = new Uint8Array(this.nx * this.ny * this.nz);
    this.solid = solid;
    // Every triangle, sampled about a cell apart, so a thin pane of glass marks its cells too (any
    // cell a sample misses is well inside the room grown round its neighbours).
    const step = cell * 0.9;
    for (const { mesh, matrix } of meshes) {
      const position = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const index = mesh.geometry.getIndex();
      const count = index ? index.count : position.count;
      for (let t = 0; t + 2 < count; t += 3) {
        const i0 = index ? index.getX(t) : t;
        const i1 = index ? index.getX(t + 1) : t + 1;
        const i2 = index ? index.getX(t + 2) : t + 2;
        a.fromBufferAttribute(position, i0).applyMatrix4(matrix);
        b.fromBufferAttribute(position, i1).applyMatrix4(matrix);
        c.fromBufferAttribute(position, i2).applyMatrix4(matrix);
        const n = Math.max(
          1,
          Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / step),
        );
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        for (let i = 0; i <= n; i++) {
          for (let j = 0; i + j <= n; j++) {
            p.copy(a)
              .addScaledVector(ab, i / n)
              .addScaledVector(ac, j / n);
            const k = this.index(p);
            if (k >= 0) solid[k] = 1;
          }
        }
      }
    }
    // Grown by `room` along each axis in turn (a box round every surface cell).
    const r = Math.ceil(room / cell);
    this.blocked = this.grow(this.grow(this.grow(solid, r, 0), r, 1), r, 2);
  }

  private readonly cell: number;

  /** The cell a point's in, or -1 outside the grid (where nothing is). */
  private index(at: THREE.Vector3): number {
    const x = Math.floor((at.x - this.min.x) / this.cell);
    const y = Math.floor((at.y - this.min.y) / this.cell);
    const z = Math.floor((at.z - this.min.z) / this.cell);
    if (x < 0 || y < 0 || z < 0 || x >= this.nx || y >= this.ny || z >= this.nz) return -1;
    return (z * this.ny + y) * this.nx + x;
  }

  /** Whether a camera here is clear of everything. */
  isOpen(at: THREE.Vector3): boolean {
    return !this.isBlocked(at);
  }

  private isBlocked(at: THREE.Vector3): boolean {
    const k = this.index(at);
    return k >= 0 && this.blocked[k] === 1;
  }

  /** Marks every cell within `r` cells of a marked one along one axis. */
  private grow(from: Uint8Array, r: number, axis: 0 | 1 | 2): Uint8Array {
    const out = new Uint8Array(from.length);
    const { nx, ny, nz } = this;
    const length = axis === 0 ? nx : axis === 1 ? ny : nz;
    const stride = axis === 0 ? 1 : axis === 1 ? nx : nx * ny;
    const lines = (nx * ny * nz) / length;
    for (let line = 0; line < lines; line++) {
      // The first cell of this line.
      let start: number;
      if (axis === 0) start = line * nx;
      else if (axis === 1) start = (line % nx) + Math.floor(line / nx) * nx * ny;
      else start = line;
      let last = -Infinity;
      for (let i = 0; i < length; i++) {
        if (from[start + i * stride]) last = i;
        if (i - last <= r) out[start + i * stride] = 1;
      }
      last = Infinity;
      for (let i = length - 1; i >= 0; i--) {
        if (from[start + i * stride]) last = i;
        if (last - i <= r) out[start + i * stride] = 1;
      }
    }
    return out;
  }

  /**
   * Where the camera can be: `eye` itself when it's in the open, otherwise the nearest open point
   * towards `look`, straight back from it, up or down. Written into `out`.
   */
  free(eye: THREE.Vector3, look: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    if (!this.isBlocked(eye)) return out.copy(eye);
    way.subVectors(look, eye);
    if (way.lengthSq() < 1e-8) way.set(0, 1, 0);
    way.normalize();
    const step = this.cell * 0.5;
    let best = Infinity;
    out.copy(eye);
    for (const [d, sign] of [
      [way, 1],
      [way, -1],
      [UP, 1],
      [DOWN, 1],
    ] as const) {
      for (let s = 1; s * step <= Math.min(best, WAY_OUT); s++) {
        p.copy(eye).addScaledVector(d, s * step * sign);
        if (this.isBlocked(p)) continue;
        best = s * step;
        out.copy(p);
        break;
      }
    }
    return out;
  }

  /** Whether the line from `a` to `b` passes through any of the surfaces (`a`'s own cell aside). */
  crosses(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const start = this.index(a);
    const steps = Math.ceil(a.distanceTo(b) / (this.cell * 0.5));
    for (let s = 1; s <= steps; s++) {
      const k = this.index(p.copy(a).lerp(b, s / steps));
      if (k >= 0 && k !== start && this.solid[k] === 1) return true;
    }
    return false;
  }

  /**
   * For planning a shot: how far along from `look` to `eye` (0 to 1) the camera can go: once it's out in the open from
   * where it looks, up to just short of the next thing in the way. All of it when nothing is.
   */
  reach(look: THREE.Vector3, eye: THREE.Vector3): number {
    const length = look.distanceTo(eye);
    if (length < 1e-4) return 1;
    const steps = Math.ceil(length / (this.cell * 0.5));
    let open = false;
    let lastOpen = 0;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      p.copy(look).lerp(eye, t);
      const shut = this.isBlocked(p);
      if (!shut) {
        open = true;
        lastOpen = t;
      } else if (open) {
        return lastOpen;
      }
    }
    return 1;
  }
}
