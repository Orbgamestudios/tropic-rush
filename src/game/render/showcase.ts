// The hero-select stage: the chosen hero on a stone-and-steel pedestal under a spotlight, with a
// glowing rim, drifting dust motes and a dark backdrop. The hero breathes, turns slowly, and can
// be spun with a drag. Swapping heroes plays a quick drop-in.

import * as THREE from "three";
import type { HeroKind } from "../logic/heroes";
import { menuHeroModel } from "./heroAssets";
import type { Stage } from "./stage";

function backdropTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("No 2D canvas");
  const sky = g.createRadialGradient(256, 210, 20, 256, 260, 380);
  sky.addColorStop(0, "#4a5d7c");
  sky.addColorStop(0.45, "#2b3850");
  sky.addColorStop(1, "#141b28");
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 512);
  // Faint diagonal hatching, like the brushed-metal walls in the mockups.
  g.globalAlpha = 0.05;
  g.strokeStyle = "#ffffff";
  for (let i = -512; i < 512; i += 9) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 512, 512);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function stoneMaterial(shade: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: shade, roughness: 0.92, flatShading: true });
}

/** A ring of chunky, slightly uneven stone blocks topped with a steel disc and a glowing rim. */
function pedestal(): { root: THREE.Group; glow: THREE.Mesh; ring: THREE.Mesh } {
  const root = new THREE.Group();
  const blocks = 18;
  for (let i = 0; i < blocks; i++) {
    const a = (i / blocks) * Math.PI * 2;
    const h = 0.42 + ((i * 37) % 7) * 0.012;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, h, 0.42, 1, 1, 1),
      stoneMaterial(i % 3 === 0 ? 0x8d8579 : i % 3 === 1 ? 0x9c9488 : 0x7f786d),
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
    stoneMaterial(0x6f695f),
  );
  core.position.y = 0.2;
  root.add(core);
  const steel = new THREE.Mesh(
    new THREE.CylinderGeometry(1.32, 1.36, 0.12, 64),
    new THREE.MeshStandardMaterial({ color: 0x9fb0c4, metalness: 0.85, roughness: 0.28 }),
  );
  steel.position.y = 0.48;
  steel.receiveShadow = true;
  root.add(steel);
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.13, 64),
    new THREE.MeshStandardMaterial({ color: 0x5f7187, metalness: 0.8, roughness: 0.35 }),
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
  private savedBackground: THREE.Scene["background"] = null;
  private savedFog: THREE.Scene["fog"] = null;
  private readonly background = backdropTexture();
  private token = 0;

  constructor(private readonly stage: Stage) {
    const p = pedestal();
    this.glow = p.glow;
    this.ring = p.ring;
    this.root.add(p.root, this.turntable);
    this.turntable.position.y = 0.55;
    this.dust = motes();
    this.root.add(this.dust);
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshStandardMaterial({ color: 0x232c3b, roughness: 0.9 }),
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
      this.hero.position.y = fall + bounce;
      const breathe = 1 + Math.sin(time * 2.2) * 0.012;
      this.hero.scale.y = this.hero.scale.x * breathe;
    }
    const pulse = 0.65 + Math.sin(time * 2.4) * 0.25;
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
