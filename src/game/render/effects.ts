// Short-lived visual effects: fireballs, drifting smoke, sparks, debris, shockwaves and scorch
// marks. Everything but the debris is a textured quad from one atlas, drawn in two instanced
// layers (glowing and solid), so a busy fight costs a few draw calls and makes no garbage.

import * as THREE from "three";

const GRID = 4;

/** Atlas cells. */
const SMOKE = [0, 1, 2] as const;
const GLOW = 3;
const FLAME = [4, 5] as const;
const STAR = 6;
const STREAK = 7;
const RING = 8;
const SCORCH = 9;
const PLUS = 10;
const DUST = 11;

let atlas: THREE.CanvasTexture | null = null;

/** Soft blobs clumped inside a circle: the basis of smoke, flame and dust. */
function blobs(g: CanvasRenderingContext2D, x: number, y: number, size: number, count: number) {
  const c = size / 2;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() ** 0.7 * size * 0.28;
    const r = size * (0.09 + Math.random() * 0.15);
    const bx = x + c + Math.cos(a) * d;
    const by = y + c + Math.sin(a) * d;
    const grad = g.createRadialGradient(bx, by, 0, bx, by, r);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.5)");
    grad.addColorStop(0.6, "rgba(255, 255, 255, 0.22)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = grad;
    g.fillRect(bx - r, by - r, r * 2, r * 2);
  }
}

function drawAtlas(): THREE.CanvasTexture {
  const cell = 128;
  const canvas = document.createElement("canvas");
  canvas.width = cell * GRID;
  canvas.height = cell * GRID;
  const g = canvas.getContext("2d");
  if (g) {
    const place = (index: number) => [(index % GRID) * cell, Math.floor(index / GRID) * cell];
    for (const i of SMOKE) {
      const [x = 0, y = 0] = place(i);
      blobs(g, x, y, cell, 26);
    }
    for (const i of FLAME) {
      const [x = 0, y = 0] = place(i);
      blobs(g, x, y, cell, 18);
    }
    const [dx = 0, dy = 0] = place(DUST);
    blobs(g, dx, dy, cell, 12);

    const c = cell / 2;
    const at = (index: number, draw: (cx: number, cy: number) => void) => {
      const [x = 0, y = 0] = place(index);
      g.save();
      g.beginPath();
      g.rect(x, y, cell, cell);
      g.clip();
      draw(x + c, y + c);
      g.restore();
    };
    at(GLOW, (x, y) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, c);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(0.3, "rgba(255, 255, 255, 0.45)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      g.fillStyle = grad;
      g.fillRect(x - c, y - c, cell, cell);
    });
    at(STAR, (x, y) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, c * 0.45);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      g.fillStyle = grad;
      g.fillRect(x - c, y - c, cell, cell);
      g.fillStyle = "#fff";
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + Math.random() * 0.3;
        const r = c * (i % 2 ? 0.62 : 0.96);
        g.beginPath();
        g.moveTo(x + Math.cos(a - 0.2) * 8, y + Math.sin(a - 0.2) * 8);
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        g.lineTo(x + Math.cos(a + 0.2) * 8, y + Math.sin(a + 0.2) * 8);
        g.fill();
      }
    });
    at(STREAK, (x, y) => {
      g.translate(x, y);
      g.scale(1, 0.09);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, c);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(0.5, "rgba(255, 255, 255, 0.6)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      g.fillStyle = grad;
      g.fillRect(-c, -c, cell, cell);
    });
    at(RING, (x, y) => {
      const grad = g.createRadialGradient(x, y, c * 0.55, x, y, c);
      grad.addColorStop(0, "rgba(255, 255, 255, 0)");
      grad.addColorStop(0.72, "rgba(255, 255, 255, 0.55)");
      grad.addColorStop(0.86, "rgba(255, 255, 255, 1)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      g.fillStyle = grad;
      g.fillRect(x - c, y - c, cell, cell);
    });
    at(SCORCH, (x, y) => {
      const grad = g.createRadialGradient(x, y, c * 0.1, x, y, c * 0.92);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      grad.addColorStop(0.6, "rgba(255, 255, 255, 0.7)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      g.fillStyle = grad;
      g.fillRect(x - c, y - c, cell, cell);
      // Blast streaks scorched outwards.
      g.strokeStyle = "rgba(255, 255, 255, 0.5)";
      g.lineCap = "round";
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2;
        g.lineWidth = 2 + Math.random() * 5;
        g.beginPath();
        g.moveTo(x + Math.cos(a) * c * 0.4, y + Math.sin(a) * c * 0.4);
        g.lineTo(x + Math.cos(a) * c * 0.98, y + Math.sin(a) * c * 0.98);
        g.stroke();
      }
    });
    at(PLUS, (x, y) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, c);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.5)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      g.fillStyle = grad;
      g.fillRect(x - c, y - c, cell, cell);
      g.fillStyle = "#fff";
      g.fillRect(x - c * 0.15, y - c * 0.55, c * 0.3, c * 1.1);
      g.fillRect(x - c * 0.55, y - c * 0.15, c * 1.1, c * 0.3);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/** Three colours a particle passes through as it ages; above 1 glows through the bloom. */
type Ramp = readonly number[];

/** Solid, so it stays orange against bright ground: burns down to charcoal. */
const FIRE: Ramp = [2.6, 1.7, 0.55, 1.5, 0.42, 0.06, 0.1, 0.05, 0.04];
/** Added on top of what's there, so it wants far less. */
const HEAT: Ramp = [1.3, 0.8, 0.28, 0.8, 0.26, 0.04, 0.2, 0.04, 0.01];
const SOOT: Ramp = [0.05, 0.05, 0.05, 0.13, 0.12, 0.12, 0.3, 0.29, 0.28];
const BILLOW: Ramp = [0.16, 0.15, 0.15, 0.36, 0.35, 0.33, 0.62, 0.61, 0.58];
const WISP: Ramp = [0.7, 0.7, 0.68, 0.72, 0.72, 0.7, 0.8, 0.8, 0.78];
const SAND: Ramp = [0.62, 0.5, 0.33, 0.66, 0.56, 0.4, 0.72, 0.64, 0.5];
const SPARK: Ramp = [4, 2.8, 1, 3, 1.2, 0.2, 1.2, 0.2, 0.05];
const FLASH: Ramp = [1.8, 1.5, 0.9, 1.3, 0.65, 0.18, 0.4, 0.1, 0.02];
const BLAST: Ramp = [1, 0.85, 0.55, 0.6, 0.4, 0.18, 0.2, 0.1, 0.03];
const BLACK: Ramp = [0.02, 0.018, 0.016, 0.02, 0.018, 0.016, 0.02, 0.018, 0.016];
const HEALING: Ramp = [0.25, 1.5, 0.5, 0.15, 1.1, 0.35, 0.05, 0.5, 0.15];

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  /** How quickly it loses speed. */
  drag: number;
  /** Below 0 it's still waiting to start. */
  age: number;
  life: number;
  from: number;
  to: number;
  /** Height over width. */
  aspect: number;
  rotation: number;
  spin: number;
  cell: number;
  /** Above 0 stretches along its travel; below 0 lies flat on the ground. */
  stretch: number;
  ramp: Ramp;
  opacity: number;
  /** Share of its life spent fading in. */
  rise: number;
}

interface Options {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  gravity?: number;
  drag?: number;
  delay?: number;
  life: number;
  from: number;
  to: number;
  aspect?: number;
  rotation?: number;
  spin?: number;
  cell: number;
  stretch?: number;
  ramp: Ramp;
  opacity?: number;
  rise?: number;
}

const VERTEX = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iColor;
  attribute vec4 iShape;
  attribute vec4 iMotion;
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vHeight;
  void main() {
    vec2 corner = position.xy;
    float cell = iShape.w;
    vUv = (uv + vec2(mod(cell, ${GRID}.0), ${GRID - 1}.0 - floor(cell / ${GRID}.0))) / ${GRID}.0;
    vColor = iColor;
    vHeight = corner.y + 0.5;
    vec2 size = iShape.xy;
    float stretch = iMotion.w;
    float c = cos(iShape.z);
    float s = sin(iShape.z);
    if (stretch < 0.0) {
      vec2 p = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y) * size;
      gl_Position = projectionMatrix * viewMatrix * vec4(iPos + vec3(p.x, 0.0, p.y), 1.0);
      return;
    }
    vec4 view = viewMatrix * vec4(iPos, 1.0);
    vec2 axis = vec2(c, s);
    if (stretch > 0.0) {
      vec2 travel = (viewMatrix * vec4(iMotion.xyz, 0.0)).xy;
      float speed = length(travel);
      if (speed > 0.001) axis = travel / speed;
      size.x *= 1.0 + stretch * speed;
    }
    view.xy += axis * corner.x * size.x + vec2(-axis.y, axis.x) * corner.y * size.y;
    // Pulled towards the camera so a big puff isn't sliced off where it meets the ground.
    view.z += size.y * 0.6;
    gl_Position = projectionMatrix * view;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uShade;
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vHeight;
  void main() {
    float a = texture2D(uAtlas, vUv).a * vColor.a;
    if (a < 0.004) discard;
    // Smoke is lit from above; glowing particles light themselves.
    gl_FragColor = vec4(vColor.rgb * mix(1.0, 0.68 + 0.5 * vHeight, uShade), a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

class Layer {
  readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly live: Particle[] = [];
  private readonly spare: Particle[] = [];
  private readonly pos: THREE.InstancedBufferAttribute;
  private readonly color: THREE.InstancedBufferAttribute;
  private readonly shape: THREE.InstancedBufferAttribute;
  private readonly motion: THREE.InstancedBufferAttribute;

  constructor(
    private readonly capacity: number,
    blending: THREE.Blending,
    shade: number,
    order: number,
  ) {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute("position", quad.getAttribute("position"));
    this.geometry.setAttribute("uv", quad.getAttribute("uv"));
    const attribute = (name: string, size: number) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size);
      a.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(name, a);
      return a;
    };
    this.pos = attribute("iPos", 3);
    this.color = attribute("iColor", 4);
    this.shape = attribute("iShape", 4);
    this.motion = attribute("iMotion", 4);
    this.geometry.instanceCount = 0;
    atlas ??= drawAtlas();
    this.material = new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: atlas }, uShade: { value: shade } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      // Scorch marks and shockwaves lie flat, facing away from the quad's front.
      side: THREE.DoubleSide,
      blending,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = order;
  }

  add(o: Options): void {
    if (this.live.length >= this.capacity) return;
    const p = this.spare.pop() ?? ({} as Particle);
    p.x = o.x;
    p.y = o.y;
    p.z = o.z;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.vz = o.vz ?? 0;
    p.gravity = o.gravity ?? 0;
    p.drag = o.drag ?? 0;
    p.age = -(o.delay ?? 0);
    p.life = o.life;
    p.from = o.from;
    p.to = o.to;
    p.aspect = o.aspect ?? 1;
    p.rotation = o.rotation ?? Math.random() * Math.PI * 2;
    p.spin = o.spin ?? 0;
    p.cell = o.cell;
    p.stretch = o.stretch ?? 0;
    p.ramp = o.ramp;
    p.opacity = o.opacity ?? 1;
    p.rise = o.rise ?? 0.04;
    this.live.push(p);
  }

  update(dt: number): void {
    // Nothing alive and nothing drawn last frame: no work, and no draw call.
    if (this.live.length === 0 && this.geometry.instanceCount === 0) {
      this.mesh.visible = false;
      return;
    }
    const pos = this.pos.array as Float32Array;
    const color = this.color.array as Float32Array;
    const shape = this.shape.array as Float32Array;
    const motion = this.motion.array as Float32Array;
    let drawn = 0;
    let kept = 0;
    for (const p of this.live) {
      p.age += dt;
      if (p.age >= p.life) {
        this.spare.push(p);
        continue;
      }
      this.live[kept++] = p;
      if (p.age < 0) continue;
      const slow = Math.exp(-p.drag * dt);
      p.vx *= slow;
      p.vz *= slow;
      p.vy = p.vy * slow - p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rotation += p.spin * dt;

      const t = p.age / p.life;
      const size = p.from + (p.to - p.from) * (1 - (1 - t) ** 2);
      const stage = t * 2;
      const leg = stage < 1 ? 0 : 3;
      const mix = stage < 1 ? stage : stage - 1;
      const { ramp } = p;
      const channel = (i: number) => {
        const a = ramp[leg + i] ?? 0;
        return a + ((ramp[leg + 3 + i] ?? 0) - a) * mix;
      };
      const fade = t < p.rise ? t / p.rise : 1 - ((t - p.rise) / (1 - p.rise)) ** 2;

      const i3 = drawn * 3;
      const i4 = drawn * 4;
      pos[i3] = p.x;
      pos[i3 + 1] = p.y;
      pos[i3 + 2] = p.z;
      color[i4] = channel(0);
      color[i4 + 1] = channel(1);
      color[i4 + 2] = channel(2);
      color[i4 + 3] = fade * p.opacity;
      shape[i4] = size;
      shape[i4 + 1] = size * p.aspect;
      shape[i4 + 2] = p.rotation;
      shape[i4 + 3] = p.cell;
      motion[i4] = p.vx;
      motion[i4 + 1] = p.vy;
      motion[i4 + 2] = p.vz;
      motion[i4 + 3] = p.stretch;
      drawn++;
    }
    this.live.length = kept;
    this.geometry.instanceCount = drawn;
    this.mesh.visible = drawn > 0;
    // Only what's in use goes up to the graphics chip, not the whole pool.
    for (const attribute of [this.pos, this.color, this.shape, this.motion]) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, drawn * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

interface Chunk {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  turn: THREE.Euler;
  scale: THREE.Vector3;
  life: number;
  floor: number;
}

/** Bits of building and spent cases: real little blocks that tumble and bounce. */
class Debris {
  readonly mesh: THREE.InstancedMesh;
  private readonly chunks: Chunk[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly turn = new THREE.Quaternion();
  private readonly size = new THREE.Vector3();
  private readonly tint = new THREE.Color();

  constructor(private readonly capacity: number) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial(),
      capacity,
    );
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.setColorAt(0, this.tint);
    this.mesh.count = 0;
  }

  add(pos: THREE.Vector3, vel: THREE.Vector3, scale: THREE.Vector3, color: number, life: number) {
    if (this.chunks.length >= this.capacity) return;
    const spin = () => (Math.random() - 0.5) * 22;
    this.chunks.push({
      pos: pos.clone(),
      vel: vel.clone(),
      spin: new THREE.Vector3(spin(), spin(), spin()),
      turn: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
      scale: scale.clone(),
      life,
      floor: pos.y - 0.6,
    });
    this.tint.set(color);
    this.mesh.setColorAt(this.chunks.length - 1, this.tint);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    if (this.chunks.length === 0 && this.mesh.count === 0) {
      this.mesh.visible = false;
      return;
    }
    let n = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i] as Chunk;
      c.life -= dt;
      if (c.life <= 0) continue;
      c.vel.y -= 20 * dt;
      c.pos.addScaledVector(c.vel, dt);
      if (c.pos.y < c.floor) {
        c.pos.y = c.floor;
        c.vel.multiply(this.size.set(0.55, -0.34, 0.55));
        c.spin.multiplyScalar(0.5);
      }
      c.turn.x += c.spin.x * dt;
      c.turn.y += c.spin.y * dt;
      c.turn.z += c.spin.z * dt;
      this.turn.setFromEuler(c.turn);
      this.size.copy(c.scale).multiplyScalar(Math.min(1, c.life * 3));
      this.matrix.compose(c.pos, this.turn, this.size);
      if (n !== i) {
        this.chunks[n] = c;
        this.mesh.getColorAt(i, this.tint);
        this.mesh.setColorAt(n, this.tint);
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      }
      this.mesh.setMatrixAt(n, this.matrix);
      n++;
    }
    this.chunks.length = n;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.addUpdateRange(0, n * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

interface Emitter {
  pos: THREE.Vector3;
  time: number;
  timer: number;
  fire: boolean;
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;
const between = (a: number, b: number) => a + Math.random() * (b - a);
const velocity = new THREE.Vector3();
const scale = new THREE.Vector3();
const spot = new THREE.Vector3();
const glowRamps = new Map<number, Ramp>();

/** A muzzle-flash ramp in the shooter's own colour. */
function glowOf(color: number): Ramp {
  let ramp = glowRamps.get(color);
  if (!ramp) {
    const c = new THREE.Color(color);
    ramp = [2.4, 2.1, 1.5, c.r * 1.8, c.g * 1.5, c.b, c.r * 0.5, c.g * 0.3, c.b * 0.15];
    glowRamps.set(color, ramp);
  }
  return ramp;
}

export class Effects {
  readonly root = new THREE.Group();
  /** Where the land is, so blasts can leave their mark on it. */
  private readonly groundAt: (x: number, z: number) => number;
  private readonly solid = new Layer(340, THREE.NormalBlending, 1, 5);
  private readonly glow = new Layer(460, THREE.AdditiveBlending, 0, 6);
  private readonly marks = new Layer(36, THREE.NormalBlending, 0, 1);
  private readonly debris = new Debris(90);
  private emitters: Emitter[] = [];

  constructor(groundAt: (x: number, z: number) => number = () => 0) {
    this.groundAt = groundAt;
    this.root.add(this.marks.mesh, this.debris.mesh, this.solid.mesh, this.glow.mesh);
  }

  /** A fireball that rolls up into smoke, with a shockwave, sparks, debris and a scorch mark. */
  explosion(pos: THREE.Vector3, radius: number): void {
    const r = Math.max(0.8, radius);
    const { x, y, z } = pos;
    this.glow.add({ x, y, z, life: 0.12, from: r * 1.8, to: r * 2.6, cell: STAR, ramp: FLASH });
    this.glow.add({ x, y, z, life: 0.3, from: r * 1.6, to: r * 2.6, cell: GLOW, ramp: HEAT });

    const flames = Math.round(9 + r * 3);
    for (let i = 0; i < flames; i++) {
      const a = Math.random() * Math.PI * 2;
      const push = between(1.5, 5.5) * Math.sqrt(r);
      this.solid.add({
        x: x + Math.cos(a) * r * 0.18,
        y: y + Math.random() * r * 0.3,
        z: z + Math.sin(a) * r * 0.18,
        vx: Math.cos(a) * push,
        vy: between(1, 6) * Math.sqrt(r),
        vz: Math.sin(a) * push,
        drag: 3.2,
        gravity: -2,
        life: between(0.35, 0.7),
        from: r * 0.55,
        to: r * 1.2,
        spin: between(-3, 3),
        cell: pick(FLAME),
        ramp: FIRE,
        opacity: 0.92,
      });
    }

    const puffs = Math.round(6 + r * 2);
    for (let i = 0; i < puffs; i++) {
      const a = Math.random() * Math.PI * 2;
      const push = between(0.6, 2.4) * Math.sqrt(r);
      this.solid.add({
        x: x + Math.cos(a) * r * 0.3,
        y: y + Math.random() * r * 0.4,
        z: z + Math.sin(a) * r * 0.3,
        vx: Math.cos(a) * push + 0.4,
        vy: between(1.2, 3.4),
        vz: Math.sin(a) * push,
        drag: 1.1,
        delay: between(0.05, 0.28),
        life: between(1, 1.9),
        from: r * 0.7,
        to: r * 1.9,
        spin: between(-0.6, 0.6),
        cell: pick(SMOKE),
        ramp: i % 3 === 0 ? BILLOW : SOOT,
        opacity: 0.86,
        rise: 0.1,
      });
    }

    const sparks = Math.round(8 + r * 4);
    for (let i = 0; i < sparks; i++) {
      const a = Math.random() * Math.PI * 2;
      const push = between(4, 13);
      this.glow.add({
        x,
        y,
        z,
        vx: Math.cos(a) * push,
        vy: between(3, 12),
        vz: Math.sin(a) * push,
        gravity: 20,
        drag: 0.8,
        life: between(0.3, 0.8),
        from: 0.22,
        to: 0.12,
        aspect: 0.5,
        stretch: 0.09,
        cell: STREAK,
        ramp: SPARK,
      });
    }

    const chunks = Math.round(3 + r * 1.5);
    for (let i = 0; i < chunks; i++) {
      const a = Math.random() * Math.PI * 2;
      const push = between(2, 8);
      velocity.set(Math.cos(a) * push, between(5, 11), Math.sin(a) * push);
      const s = between(0.08, 0.24);
      scale.set(s, s * between(0.5, 1), s * between(0.6, 1.4));
      this.debris.add(pos, velocity, scale, pick([0x3a342c, 0x5a4a38, 0x6a6a64]), between(1, 1.7));
    }

    const ground = this.groundAt(x, z);
    if (ground > 0.02) this.groundBlast(x, ground + 0.08, z, r);
  }

  /** A blast's mark on the land: the ring of air, thrown-up dust and a scorch that stays a while. */
  private groundBlast(x: number, y: number, z: number, r: number): void {
    this.glow.add({
      x,
      y,
      z,
      life: 0.34,
      from: r * 0.6,
      to: r * 4.2,
      stretch: -1,
      rotation: 0,
      cell: RING,
      ramp: BLAST,
      opacity: 0.45,
    });
    this.marks.add({
      x,
      y,
      z,
      life: 14,
      from: r * 2.4,
      to: r * 2.5,
      stretch: -1,
      cell: SCORCH,
      ramp: BLACK,
      opacity: 0.62,
      rise: 0.005,
    });
    const dust = Math.round(6 + r * 2);
    for (let i = 0; i < dust; i++) {
      const a = (i / dust) * Math.PI * 2 + Math.random() * 0.4;
      const push = between(3, 7) * Math.sqrt(r);
      this.solid.add({
        x: x + Math.cos(a) * r * 0.5,
        y: y + 0.3,
        z: z + Math.sin(a) * r * 0.5,
        vx: Math.cos(a) * push,
        vy: between(0.2, 1),
        vz: Math.sin(a) * push,
        drag: 3.4,
        life: between(0.6, 1.1),
        from: r * 0.4,
        to: r * 1,
        cell: DUST,
        ramp: SAND,
        opacity: 0.5,
        rise: 0.08,
      });
    }
  }

  /** A jagged star of flame at the barrel, and a wisp of gun smoke after it. */
  muzzle(pos: THREE.Vector3, color = 0xffe08a, size = 0.28): void {
    const ramp = glowOf(color);
    const { x, y, z } = pos;
    this.glow.add({ x, y, z, life: 0.075, from: size * 3.4, to: size * 4.2, cell: STAR, ramp });
    this.glow.add({ x, y, z, life: 0.12, from: size * 3.6, to: size * 4.6, cell: GLOW, ramp });
    this.solid.add({
      x,
      y,
      z,
      vx: between(-0.3, 0.3),
      vy: between(0.5, 1.2),
      vz: between(-0.3, 0.3),
      drag: 1.5,
      life: 0.5,
      from: size * 0.8,
      to: size * 3,
      cell: pick(SMOKE),
      ramp: WISP,
      opacity: 0.3,
      rise: 0.08,
    });
  }

  /** A spent case kicked out of the rifle. */
  casing(pos: THREE.Vector3, right: THREE.Vector3): void {
    velocity.copy(right).multiplyScalar(between(2.4, 3.6));
    velocity.y = between(2.5, 4);
    this.debris.add(pos, velocity, scale.set(0.09, 0.04, 0.04), 0xd9a441, 0.8);
  }

  /** Sparks and a puff of dust where a shot lands. */
  hit(pos: THREE.Vector3): void {
    const { x, y, z } = pos;
    this.glow.add({ x, y, z, life: 0.09, from: 0.5, to: 0.9, cell: STAR, ramp: FLASH });
    for (let i = 0; i < 4; i++) {
      this.glow.add({
        x,
        y,
        z,
        vx: between(-6, 6),
        vy: between(1, 7),
        vz: between(-6, 6),
        gravity: 20,
        life: between(0.16, 0.34),
        from: 0.13,
        to: 0.07,
        aspect: 0.5,
        stretch: 0.07,
        cell: STREAK,
        ramp: SPARK,
      });
    }
    this.solid.add({
      x,
      y,
      z,
      vy: 0.7,
      drag: 1,
      life: 0.5,
      from: 0.3,
      to: 0.9,
      cell: DUST,
      ramp: SAND,
      opacity: 0.45,
      rise: 0.1,
    });
  }

  /** Green crosses rising off someone being healed. */
  heal(pos: THREE.Vector3): void {
    for (let i = 0; i < 2; i++) {
      this.glow.add({
        x: pos.x + between(-0.4, 0.4),
        y: pos.y + between(0.4, 1.4),
        z: pos.z + between(-0.4, 0.4),
        vy: 1.5,
        life: 0.8,
        from: 0.34,
        to: 0.2,
        rotation: 0,
        cell: PLUS,
        ramp: HEALING,
        rise: 0.2,
      });
    }
  }

  /** A healing bottle bursting: a spray of green crosses over everyone it reaches. */
  healBurst(pos: THREE.Vector3, radius: number): void {
    for (let i = 0; i < 14; i++) {
      const a = between(0, Math.PI * 2);
      const r = radius * Math.sqrt(between(0, 1));
      this.heal(new THREE.Vector3(pos.x + Math.cos(a) * r, pos.y, pos.z + Math.sin(a) * r));
    }
  }

  /** A kick of dust from a boot. */
  footstep(pos: THREE.Vector3): void {
    this.solid.add({
      x: pos.x + between(-0.1, 0.1),
      y: pos.y + 0.12,
      z: pos.z + between(-0.1, 0.1),
      vy: 0.5,
      drag: 2,
      life: 0.45,
      from: 0.22,
      to: 0.62,
      cell: DUST,
      ramp: SAND,
      opacity: 0.26,
      rise: 0.12,
    });
  }

  /** What a rocket or shell leaves behind it in the air. */
  trail(pos: THREE.Vector3, fiery: boolean): void {
    const { x, y, z } = pos;
    if (fiery) this.glow.add({ x, y, z, life: 0.2, from: 0.8, to: 0.3, cell: GLOW, ramp: HEAT });
    this.solid.add({
      x,
      y,
      z,
      vy: 0.4,
      drag: 1,
      life: fiery ? 0.7 : 0.45,
      from: 0.26,
      to: fiery ? 0.95 : 0.6,
      cell: pick(SMOKE),
      ramp: WISP,
      opacity: fiery ? 0.5 : 0.28,
      rise: 0.06,
    });
  }

  /** A lick of flame and smoke from a building that's badly hurt. */
  burn(pos: THREE.Vector3, spread: number): void {
    spot.set(pos.x + between(-spread, spread), pos.y, pos.z + between(-spread, spread));
    const { x, y, z } = spot;
    this.glow.add({
      x,
      y,
      z,
      vy: 2.4,
      drag: 1,
      life: 0.5,
      from: 0.9,
      to: 0.3,
      cell: pick(FLAME),
      ramp: HEAT,
      opacity: 0.9,
    });
    this.rise(spot, SOOT, 0.7, 1.7, 0.5);
  }

  private rise(pos: THREE.Vector3, ramp: Ramp, from: number, to: number, opacity: number): void {
    this.solid.add({
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vx: between(0.2, 0.8),
      vy: between(1.8, 2.8),
      vz: between(-0.2, 0.4),
      drag: 0.25,
      life: between(1.7, 2.5),
      from,
      to,
      spin: between(-0.4, 0.4),
      cell: pick(SMOKE),
      ramp,
      opacity,
      rise: 0.12,
    });
  }

  /** Smoke rising from a destroyed building for a few seconds, burning at first. */
  smokeColumn(pos: THREE.Vector3, seconds: number): void {
    this.emitters.push({ pos: pos.clone(), time: seconds, timer: 0, fire: true });
  }

  update(dt: number): void {
    for (const e of this.emitters) {
      e.time -= dt;
      e.timer -= dt;
      if (e.timer > 0) continue;
      e.timer = 0.16;
      spot.set(e.pos.x + between(-0.8, 0.8), e.pos.y + 0.5, e.pos.z + between(-0.8, 0.8));
      this.rise(spot, e.time > 2 ? SOOT : BILLOW, 0.9, 2.6, 0.62);
      if (e.fire && e.time > 1.5) this.burn(e.pos, 1);
    }
    this.emitters = this.emitters.filter((e) => e.time > 0);
    this.marks.update(dt);
    this.solid.update(dt);
    this.glow.update(dt);
    this.debris.update(dt);
  }

  dispose(): void {
    this.marks.dispose();
    this.solid.dispose();
    this.glow.dispose();
    this.debris.dispose();
    this.emitters = [];
  }
}
