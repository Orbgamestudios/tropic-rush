// Short-lived visual effects: explosions, smoke, sparks, muzzle flashes and healing sparkles.
// Particles are pooled and reused so a busy fight doesn't create garbage every frame.

import * as THREE from "three";

type ParticleKind = "flash" | "smoke" | "spark" | "sparkle";

interface Particle {
  kind: ParticleKind;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
  vel: THREE.Vector3;
  gravity: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  startOpacity: number;
}

interface Emitter {
  pos: THREE.Vector3;
  time: number;
  timer: number;
}

const sphere = new THREE.SphereGeometry(1, 12, 9);
const cube = new THREE.BoxGeometry(1, 1, 1);

export class Effects {
  readonly root = new THREE.Group();
  private active: Particle[] = [];
  private free: Particle[] = [];
  private emitters: Emitter[] = [];

  private spawn(
    kind: ParticleKind,
    pos: THREE.Vector3,
    color: number,
    life: number,
    startScale: number,
    endScale: number,
    opacity: number,
    vel = new THREE.Vector3(),
    gravity = 0,
  ): void {
    const index = this.free.findIndex((p) => p.kind === kind);
    let particle: Particle;
    if (index >= 0) {
      particle = this.free.splice(index, 1)[0] as Particle;
    } else {
      const material =
        kind === "smoke"
          ? new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, depthWrite: false })
          : new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(kind === "spark" ? cube : sphere, material);
      particle = {
        kind,
        mesh,
        material,
        vel: new THREE.Vector3(),
        gravity: 0,
        life: 0,
        maxLife: 1,
        startScale: 1,
        endScale: 1,
        startOpacity: 1,
      };
    }
    particle.material.color.set(color);
    // Flashes and sparks burn brighter than white, so the bloom catches them.
    if (kind === "flash" || kind === "spark") particle.material.color.multiplyScalar(2.6);
    particle.material.opacity = opacity;
    particle.mesh.position.copy(pos);
    particle.mesh.scale.setScalar(startScale);
    particle.mesh.visible = true;
    particle.vel.copy(vel);
    particle.gravity = gravity;
    particle.life = 0;
    particle.maxLife = life;
    particle.startScale = startScale;
    particle.endScale = endScale;
    particle.startOpacity = opacity;
    this.root.add(particle.mesh);
    this.active.push(particle);
  }

  explosion(pos: THREE.Vector3, radius: number): void {
    const r = Math.max(0.8, radius);
    this.spawn("flash", pos, 0xffd27a, 0.22, r * 0.3, r * 1.05, 0.95);
    this.spawn("flash", pos, 0xff8a3a, 0.32, r * 0.25, r * 0.8, 0.8);
    const puffs = Math.round(3 + r * 1.5);
    for (let i = 0; i < puffs; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * r * 0.6;
      const p = pos
        .clone()
        .add(new THREE.Vector3(Math.cos(angle) * spread, 0.2, Math.sin(angle) * spread));
      const vel = new THREE.Vector3(
        Math.cos(angle) * 0.8,
        1.2 + Math.random() * 1.5,
        Math.sin(angle) * 0.8,
      );
      const shade = 0x8a8a86 + (Math.random() < 0.5 ? 0x101010 : 0);
      this.spawn("smoke", p, shade, 0.9 + Math.random() * 0.6, r * 0.35, r * 0.75, 0.75, vel);
    }
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vel = new THREE.Vector3(
        Math.cos(angle) * 5,
        4 + Math.random() * 4,
        Math.sin(angle) * 5,
      );
      this.spawn("spark", pos, 0xffc451, 0.5, 0.14, 0.08, 1, vel, 18);
    }
  }

  muzzle(pos: THREE.Vector3, color = 0xffe08a, size = 0.28): void {
    this.spawn("flash", pos, color, 0.07, size, size * 1.6, 0.95);
  }

  hit(pos: THREE.Vector3): void {
    for (let i = 0; i < 3; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        2 + Math.random() * 3,
        (Math.random() - 0.5) * 6,
      );
      this.spawn("spark", pos, 0xfff1b8, 0.22, 0.09, 0.04, 1, vel, 14);
    }
  }

  heal(pos: THREE.Vector3): void {
    for (let i = 0; i < 2; i++) {
      const p = pos
        .clone()
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.8,
            0.4 + Math.random(),
            (Math.random() - 0.5) * 0.8,
          ),
        );
      this.spawn("sparkle", p, 0x7dff9a, 0.7, 0.12, 0.05, 0.9, new THREE.Vector3(0, 1.4, 0));
    }
  }

  /** Smoke rising from a destroyed building for a few seconds. */
  smokeColumn(pos: THREE.Vector3, seconds: number): void {
    this.emitters.push({ pos: pos.clone(), time: seconds, timer: 0 });
  }

  update(dt: number): void {
    for (const e of this.emitters) {
      e.time -= dt;
      e.timer -= dt;
      if (e.timer > 0) continue;
      e.timer = 0.18;
      const p = e.pos
        .clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.5, (Math.random() - 0.5) * 1.5));
      this.spawn("smoke", p, 0x5f5f5c, 2.2, 0.6, 1.8, 0.55, new THREE.Vector3(0.4, 2.2, 0.2));
    }
    this.emitters = this.emitters.filter((e) => e.time > 0);

    const still: Particle[] = [];
    for (const p of this.active) {
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.mesh.visible = false;
        this.root.remove(p.mesh);
        this.free.push(p);
        continue;
      }
      const t = p.life / p.maxLife;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(p.startScale + (p.endScale - p.startScale) * t);
      p.material.opacity = p.startOpacity * (1 - t * t);
      still.push(p);
    }
    this.active = still;
  }

  dispose(): void {
    for (const p of [...this.active, ...this.free]) p.material.dispose();
    this.active = [];
    this.free = [];
    this.emitters = [];
  }
}
