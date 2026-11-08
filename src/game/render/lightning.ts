// Lightning over a shock circle: bolts that crack across it in the air and up into the defenses
// it's caught, each there for a blink before the next. A bolt's path is its line split again and
// again with each middle nudged aside, bowed up off the ground, with now and then a fork off it.
// It's drawn as glowing strips crossed two ways, so it looks solid from wherever the camera is: a
// white-hot core in a blue haze. One mesh and one draw call a circle.

import * as THREE from "three";

/** Times each bolt's line is split in two: 2^4 = 16 pieces. */
const SPLITS = 4;
const PIECES = 2 ** SPLITS;
/** Bolts across the circle at once, and pieces of strip there's room for in all. */
const ARCS = 2;
const MOST_PIECES = 160;
/** Two crossed strips a piece, four corners a strip. */
const STRIPS = 2;
const WIDTH = 0.45;
const COLOR = 0x8fdcff;

interface Bolt {
  /** Across the circle, up into a defense, or a fork off one of those. */
  kind: "arc" | "strike" | "fork";
  points: THREE.Vector3[];
  age: number;
  life: number;
}

const VERTEX = /* glsl */ `
  attribute float aAcross;
  attribute float aFade;
  varying float vAcross;
  varying float vFade;
  void main() {
    vAcross = aAcross;
    vFade = aFade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAcross;
  varying float vFade;
  void main() {
    float v = abs(vAcross);
    float core = exp(-pow(v / 0.12, 2.0));
    float glow = exp(-pow(v / 0.6, 2.0)) * 0.7;
    // Over the ground rather than added to it, so it shows on bright sand by day as well.
    vec3 color = mix(uColor, vec3(1.0), core) * (1.0 + core);
    gl_FragColor = vec4(color, clamp(core + glow, 0.0, 1.0) * vFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const up = new THREE.Vector3(0, 1, 0);
const sideways = new THREE.Vector3(1, 0, 0);
const way = new THREE.Vector3();
const flat = new THREE.Vector3();
const tall = new THREE.Vector3();
const corner = new THREE.Vector3();

/** A jagged path from one point to another, bowed up by `arch` in the middle. */
function jagged(from: THREE.Vector3, to: THREE.Vector3, arch: number): THREE.Vector3[] {
  let points = [from.clone(), to.clone()];
  let rough = from.distanceTo(to) * 0.22;
  for (let level = 0; level < SPLITS; level++) {
    const next: THREE.Vector3[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i] as THREE.Vector3;
      const b = points[i + 1] as THREE.Vector3;
      const middle = a.clone().lerp(b, 0.5);
      middle.x += (Math.random() - 0.5) * rough;
      middle.y += (Math.random() - 0.5) * rough * 0.6;
      middle.z += (Math.random() - 0.5) * rough;
      next.push(a, middle);
    }
    next.push(points[points.length - 1] as THREE.Vector3);
    points = next;
    rough *= 0.55;
  }
  points.forEach((p, i) => {
    p.y += Math.sin((i / (points.length - 1)) * Math.PI) * arch;
  });
  return points;
}

export class Lightning {
  readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions = new Float32Array(MOST_PIECES * STRIPS * 4 * 3);
  private readonly across = new Float32Array(MOST_PIECES * STRIPS * 4);
  private readonly fades = new Float32Array(MOST_PIECES * STRIPS * 4);
  private bolts: Bolt[] = [];

  constructor(
    /** Somewhere on the ground in the circle, as a point in the world. */
    private readonly somewhere: () => THREE.Vector3,
    /** Light thrown on the ground where a bolt strikes. */
    private readonly strike: (at: THREE.Vector3) => void,
  ) {
    const index: number[] = [];
    for (let q = 0; q < MOST_PIECES * STRIPS; q++) {
      const v = q * 4;
      index.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    this.geometry.setIndex(index);
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setAttribute("aAcross", new THREE.BufferAttribute(this.across, 1));
    this.geometry.setAttribute(
      "aFade",
      new THREE.BufferAttribute(this.fades, 1).setUsage(THREE.DynamicDrawUsage),
    );
    for (let c = 0; c < this.across.length; c += 4) this.across.set([-1, 1, 1, -1], c);
    this.geometry.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(COLOR) } },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  /** Moves the bolts on, and strikes the defenses caught in the circle now and then. */
  update(dt: number, struck: readonly THREE.Vector3[]): void {
    for (const bolt of this.bolts) bolt.age += dt;
    this.bolts = this.bolts.filter((b) => b.age < b.life);
    const arcs = this.bolts.filter((b) => b.kind === "arc").length;
    for (let i = arcs; i < ARCS; i++) this.arc();
    for (const target of struck) {
      if (Math.random() < dt * 5) this.bolt("strike", this.somewhere(), target, 0.4);
    }
    this.draw();
  }

  /** A bolt across the circle, from one spot on it to another. */
  private arc(): void {
    const from = this.somewhere();
    let to = this.somewhere();
    for (let tries = 0; tries < 4 && to.distanceTo(from) < 2; tries++) to = this.somewhere();
    from.y += 0.3;
    to.y += 0.3;
    this.bolt("arc", from, to, 0.6 + Math.random() * 1.1);
  }

  private bolt(kind: Bolt["kind"], from: THREE.Vector3, to: THREE.Vector3, arch: number): void {
    const points = jagged(from, to, arch);
    const life = 0.07 + Math.random() * 0.1;
    this.bolts.push({ kind, points, age: 0, life });
    this.strike(to);
    // Now and then a fork off it, dying out partway down.
    if (Math.random() < 0.6) {
      const at = points[2 + Math.floor(Math.random() * (points.length - 4))] as THREE.Vector3;
      const end = at
        .clone()
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            -Math.random() * 0.8,
            (Math.random() - 0.5) * 3,
          ),
        );
      const fork = jagged(at, end, 0.2).slice(0, PIECES / 2 + 1);
      this.bolts.push({ kind: "fork", points: fork, age: 0, life });
    }
  }

  private draw(): void {
    let piece = 0;
    for (const bolt of this.bolts) {
      const fork = bolt.kind === "fork";
      const fade = (1 - bolt.age / bolt.life) * (fork ? 0.7 : 1);
      for (let i = 0; i < bolt.points.length - 1 && piece < MOST_PIECES; i++, piece++) {
        const a = bolt.points[i] as THREE.Vector3;
        const b = bolt.points[i + 1] as THREE.Vector3;
        way.subVectors(b, a).normalize();
        flat.crossVectors(way, up);
        if (flat.lengthSq() < 1e-4) flat.crossVectors(way, sideways);
        flat.normalize();
        tall.crossVectors(way, flat).normalize();
        const width = WIDTH * (fork ? 0.7 : 1);
        [flat, tall].forEach((side, s) => {
          const base = (piece * STRIPS + s) * 4;
          const corners = [
            [a, -1],
            [a, 1],
            [b, 1],
            [b, -1],
          ] as const;
          corners.forEach(([p, sign], c) => {
            corner.copy(p).addScaledVector(side, sign * width);
            this.positions.set([corner.x, corner.y, corner.z], (base + c) * 3);
            this.fades[base + c] = fade;
          });
        });
      }
    }
    this.geometry.setDrawRange(0, piece * STRIPS * 6);
    (this.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute("aFade") as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
