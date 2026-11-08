// Snow falling over a northern island: a few hundred flakes in a box that follows the camera's
// target, drifting down and swaying, all one draw.

import * as THREE from "three";

const FLAKES = 420;
/** The box of falling snow round the camera's target, in meters. */
const SPREAD = 46;
const HEIGHT = 22;

function flakeTexture(): THREE.Texture {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const glow = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    glow.addColorStop(0, "rgba(255, 255, 255, 1)");
    glow.addColorStop(0.45, "rgba(255, 255, 255, 0.75)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Snowfall {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private readonly phases: Float32Array;
  private readonly center = new THREE.Vector3();

  /** `amount` is how snowy the island is, 0 to 1: fewer flakes in lighter snow. */
  constructor(amount: number) {
    const count = Math.round(FLAKES * Math.min(1, Math.max(0.2, amount)));
    this.positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    this.phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * SPREAD;
      this.positions[i * 3 + 1] = Math.random() * HEIGHT;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
      this.speeds[i] = 1.2 + Math.random() * 1.4;
      this.phases[i] = Math.random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.32,
      map: flakeTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
      color: 0xffffff,
    });
    this.points = new THREE.Points(geometry, material);
    // The flakes move about the camera's target, so the box is always in view.
    this.points.frustumCulled = false;
  }

  /** Lets the snow fall, round where the camera is looking. */
  update(dt: number, time: number, target: THREE.Vector3): void {
    this.center.lerp(target, Math.min(1, dt * 4));
    this.points.position.set(this.center.x, 0, this.center.z);
    const p = this.positions;
    const half = SPREAD / 2;
    for (let i = 0; i < this.speeds.length; i++) {
      const phase = this.phases[i] ?? 0;
      p[i * 3 + 1] = (p[i * 3 + 1] ?? 0) - (this.speeds[i] ?? 1) * dt;
      p[i * 3] = (p[i * 3] ?? 0) + Math.sin(time * 0.9 + phase) * 0.35 * dt;
      p[i * 3 + 2] = (p[i * 3 + 2] ?? 0) + Math.cos(time * 0.7 + phase) * 0.25 * dt;
      if ((p[i * 3 + 1] ?? 0) < 0) {
        p[i * 3 + 1] = HEIGHT;
        p[i * 3] = (Math.random() - 0.5) * SPREAD;
        p[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
      }
      if (Math.abs(p[i * 3] ?? 0) > half) p[i * 3] = -(p[i * 3] ?? 0) * 0.98;
      if (Math.abs(p[i * 3 + 2] ?? 0) > half) p[i * 3 + 2] = -(p[i * 3 + 2] ?? 0) * 0.98;
    }
    const attr = this.points.geometry.getAttribute("position");
    attr.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    const material = this.points.material as THREE.PointsMaterial;
    material.map?.dispose();
    material.dispose();
  }
}
