// The hero-select stage, in the navy theme: the chosen hero on a navy steel pedestal with a
// grated top and a brass rim, under a spotlight, in front of riveted navy plating with a radar
// sweeping behind them. The hero breathes, turns slowly, and can be spun with a drag. Swapping
// heroes plays a quick drop-in.

import * as THREE from "three";
import type { HeroKind } from "../logic/heroes";
import { menuHeroModel } from "./heroAssets";
import type { Stage } from "./stage";

function backdropTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("No 2D canvas");
  const sky = g.createRadialGradient(512, 230, 30, 512, 260, 620);
  sky.addColorStop(0, "#22406c");
  sky.addColorStop(0.5, "#15284a");
  sky.addColorStop(1, "#08111f");
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  // Riveted plates: faint seams with a row of rivets along each.
  g.strokeStyle = "rgba(0, 0, 0, 0.35)";
  g.lineWidth = 3;
  for (const x of [170, 420, 610, 860]) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 512);
    g.stroke();
  }
  for (const y of [150, 380]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1024, y);
    g.stroke();
  }
  g.fillStyle = "rgba(160, 185, 220, 0.18)";
  for (const x of [170, 420, 610, 860])
    for (let y = 14; y < 512; y += 34) {
      g.beginPath();
      g.arc(x + 9, y, 2.2, 0, Math.PI * 2);
      g.fill();
    }
  // Brushed-metal hatching.
  g.globalAlpha = 0.035;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 1;
  for (let i = -1024; i < 1024; i += 8) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 512, 512);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A radar screen behind the hero: rings, cross hairs and a sweeping beam with a fading trail. */
function radar(): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float r = length(vUv);
        if (r > 1.0) discard;
        float a = atan(vUv.y, vUv.x);
        float rings = smoothstep(0.012, 0.0, abs(fract(r * 4.0) - 0.5) - 0.48);
        float cross = smoothstep(0.006, 0.0, min(abs(vUv.x), abs(vUv.y))) * step(0.08, r);
        float sweep = mod(uTime * 0.9 - a, 6.2831853);
        float beam = exp(-sweep * 2.2) * smoothstep(1.0, 0.2, r);
        float edge = smoothstep(0.985, 0.96, r) * smoothstep(0.93, 0.96, r);
        float glow = rings * 0.22 + cross * 0.18 + beam * 0.35 + edge * 0.4;
        vec3 color = mix(vec3(0.35, 0.6, 0.95), vec3(0.55, 0.9, 1.0), beam);
        gl_FragColor = vec4(color, glow * smoothstep(1.0, 0.75, r) + edge * 0.3);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), material);
  mesh.position.set(0, 1.9, -2.6);
  return { mesh, material };
}

/** A steel grating texture for the pedestal's top. */
function gratingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("No 2D canvas");
  g.fillStyle = "#8f9db2";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#2c3546";
  for (let y = 0; y < 256; y += 16)
    for (let x = (y / 16) % 2 ? 8 : 0; x < 256; x += 16) {
      g.beginPath();
      g.ellipse(x + 4, y + 8, 3, 5, 0, 0, Math.PI * 2);
      g.fill();
    }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  return texture;
}

function stoneMaterial(shade: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: shade,
    roughness: 0.55,
    metalness: 0.45,
    flatShading: true,
  });
}

/** A ring of navy steel blocks topped with a grated steel disc and a brass rim. */
function pedestal(): { root: THREE.Group; glow: THREE.Mesh; ring: THREE.Mesh } {
  const root = new THREE.Group();
  const blocks = 18;
  for (let i = 0; i < blocks; i++) {
    const a = (i / blocks) * Math.PI * 2;
    const h = 0.42 + ((i * 37) % 7) * 0.012;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, h, 0.42, 1, 1, 1),
      stoneMaterial(i % 3 === 0 ? 0x2c4167 : i % 3 === 1 ? 0x34507c : 0x263a5c),
    );
    block.position.set(Math.cos(a) * 1.5, h / 2, Math.sin(a) * 1.5);
    block.rotation.y = -a + Math.PI / 2;
    block.rotation.z = (((i * 13) % 5) - 2) * 0.012;
    block.castShadow = true;
    block.receiveShadow = true;
    root.add(block);
  }
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(1.36, 1.42, 0.4, 40),
    stoneMaterial(0x1d2c47),
  );
  core.position.y = 0.2;
  root.add(core);
  const steel = new THREE.Mesh(
    new THREE.CylinderGeometry(1.32, 1.36, 0.12, 64),
    new THREE.MeshStandardMaterial({ color: 0xdcae5a, metalness: 0.9, roughness: 0.3 }),
  );
  steel.position.y = 0.48;
  steel.receiveShadow = true;
  root.add(steel);
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.13, 64),
    new THREE.MeshStandardMaterial({
      color: 0xb8c4d6,
      map: gratingTexture(),
      metalness: 0.75,
      roughness: 0.4,
    }),
  );
  inner.position.y = 0.49;
  inner.receiveShadow = true;
  root.add(inner);
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.035, 12, 96),
    new THREE.MeshBasicMaterial({ color: 0x7cc8ff, transparent: true, opacity: 0.9 }),
  );
  glow.rotation.x = Math.PI / 2;
  glow.position.y = 0.56;
  root.add(glow);
  // A soft halo on the floor around the pedestal.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 3.4, 64),
    new THREE.MeshBasicMaterial({
      color: 0x6fb8ff,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  root.add(ring);
  return { root, glow, ring };
}

function motes(): THREE.Points {
  const count = 90;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.6 + Math.random() * 2.8;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.random() * 3.6;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xbfe2ff,
      size: 0.045,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

export class Showcase {
  readonly root = new THREE.Group();
  private readonly turntable = new THREE.Group();
  private readonly glow: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly dust: THREE.Points;
  private readonly spot: THREE.SpotLight;
  private readonly floor: THREE.Mesh;
  private hero: THREE.Object3D | null = null;
  private kind: HeroKind | null = null;
  private spin = 0;
  private spinVelocity = 0;
  private dragging = false;
  private drop = 1;
  private leap = 0;
  private savedBackground: THREE.Scene["background"] = null;
  private savedFog: THREE.Scene["fog"] = null;
  private readonly background = backdropTexture();
  private readonly radar = radar();
  private token = 0;

  constructor(private readonly stage: Stage) {
    const p = pedestal();
    this.glow = p.glow;
    this.ring = p.ring;
    this.root.add(p.root, this.turntable, this.radar.mesh);
    this.turntable.position.y = 0.55;
    this.dust = motes();
    this.root.add(this.dust);
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshStandardMaterial({ color: 0x14223a, roughness: 0.85 }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.root.add(this.floor);
    this.spot = new THREE.SpotLight(0xfff2dc, 60, 14, 0.42, 0.55, 1.4);
    this.spot.position.set(0.8, 7, 2.6);
    this.spot.target.position.set(0, 1, 0);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    const rim = new THREE.PointLight(0x7cc8ff, 8, 7, 1.6);
    rim.position.set(-2, 2.4, -2);
    this.root.add(this.spot, this.spot.target, rim);
    this.root.visible = false;
    stage.scene.add(this.root);
  }

  show(on: boolean): void {
    if (on === this.root.visible) return;
    this.root.visible = on;
    if (on) {
      this.stage.refreshShadows();
      this.savedBackground = this.stage.scene.background;
      this.savedFog = this.stage.scene.fog;
      this.stage.scene.background = this.background;
      this.stage.scene.fog = null;
    } else {
      this.stage.scene.background = this.savedBackground;
      this.stage.scene.fog = this.savedFog;
    }
  }

  /** Puts a hero on the pedestal (it drops in with a little bounce). */
  async setHero(kind: HeroKind): Promise<void> {
    if (kind === this.kind) return;
    this.kind = kind;
    const token = ++this.token;
    const model = await menuHeroModel(kind);
    if (token !== this.token) return;
    if (this.hero) this.turntable.remove(this.hero);
    // Face the camera (models face +x; the camera looks along -z).
    model.rotation.y = -Math.PI / 2;
    if (kind === "tank") model.scale.multiplyScalar(0.55);
    this.hero = model;
    this.turntable.add(model);
    this.drop = 0;
  }

  /** A level-up: the hero leaps and spins, and the rim flares. */
  celebrate(): void {
    this.leap = 1;
    this.spinVelocity = 0.32;
  }

  /** Drag to spin the hero; it keeps turning with momentum, then eases back to its idle turn. */
  drag(dx: number): void {
    this.dragging = true;
    this.spinVelocity = dx * 0.012;
    this.spin += dx * 0.012;
  }

  release(): void {
    this.dragging = false;
  }

  update(dt: number, time: number): void {
    if (!this.root.visible) return;
    if (!this.dragging) {
      this.spin += this.spinVelocity;
      this.spinVelocity *= Math.exp(-dt * 3);
      // Drift back towards a gentle sway facing the camera.
      const idle = Math.sin(time * 0.6) * 0.35;
      const nearest = Math.round((this.spin - idle) / (Math.PI * 2)) * Math.PI * 2 + idle;
      if (Math.abs(this.spinVelocity) < 0.002)
        this.spin += (nearest - this.spin) * (1 - Math.exp(-dt * 1.8));
    }
    this.turntable.rotation.y = this.spin;
    if (this.hero) {
      this.drop = Math.min(1, this.drop + dt * 2.6);
      const t = this.drop;
      // Fall from above, then a small squash-and-settle.
      const fall = (1 - t) ** 3 * 2.2;
      const bounce = Math.sin(t * Math.PI * 2.2) * (1 - t) * 0.08;
      this.leap = Math.max(0, this.leap - dt * 1.4);
      this.hero.position.y = fall + bounce + Math.sin(this.leap * Math.PI) * 0.9;
      const breathe = 1 + Math.sin(time * 2.2) * 0.012;
      this.hero.scale.y = this.hero.scale.x * breathe;
    }
    (this.radar.material.uniforms.uTime as THREE.IUniform<number>).value = time;
    const pulse = 0.65 + Math.sin(time * 2.4) * 0.25 + this.leap;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = pulse;
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.1 + pulse * 0.1;
    const pos = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * (0.12 + (i % 5) * 0.03);
      if (y > 3.8) y = 0.3;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    this.dust.rotation.y += dt * 0.05;

    // Camera: a little below eye level, hero framed a touch high so the name plate fits below.
    const cam = this.stage.camera;
    const aspect = this.stage.width / this.stage.height;
    const distance = aspect > 1.6 ? 5.3 : 6.4;
    cam.position.set(0, 1.75, distance);
    cam.lookAt(0, 1.38, 0);
    this.stage.focusShadows(new THREE.Vector3(0, 0, 0), 6);
  }
}
