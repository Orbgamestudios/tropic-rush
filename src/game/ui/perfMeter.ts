// A small readout at the top right of the screen (the owner's ask, 2026-11-21): frames a second,
// memory in use, and the battery and how fast it's going down.
//
// What a browser will tell a page varies. Frames are counted everywhere. Memory is the page's own
// JavaScript heap where the browser reports it (Chrome); where it doesn't (Safari, so every
// iPhone) it's what the game has handed the graphics chip, worked out from its meshes and
// pictures, marked "≈". The battery is read where the browser allows it (Chrome on Android, say);
// Safari never does, and then it says so with a dash. Its rate is worked out from the level
// falling over time, so it takes a few minutes to show.

import type * as THREE from "three";

interface Battery extends EventTarget {
  level: number;
  charging: boolean;
}

/** The graphics memory a scene's meshes and pictures take, roughly, in bytes. */
function gpuBytes(scene: THREE.Object3D): number {
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.geometry) return;
    geometries.add(mesh.geometry);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of materials) {
      if (!m) continue;
      for (const value of Object.values(m)) {
        if (value && (value as THREE.Texture).isTexture) textures.add(value as THREE.Texture);
      }
    }
  });
  let bytes = 0;
  for (const g of geometries) {
    for (const a of Object.values(g.attributes))
      bytes += (a as THREE.BufferAttribute).array?.byteLength ?? 0;
    bytes += g.index?.array.byteLength ?? 0;
  }
  for (const t of textures) {
    const image = t.image as { width?: number; height?: number } | undefined;
    const w = image?.width ?? 0;
    const h = image?.height ?? 0;
    // Four bytes a pixel, and a third again for the smaller copies it's filtered through.
    bytes += w * h * 4 * (t.generateMipmaps ? 4 / 3 : 1);
  }
  return bytes;
}

export class PerfMeter {
  private readonly el = document.createElement("div");
  private readonly fps = document.createElement("span");
  private readonly memory = document.createElement("span");
  private readonly battery = document.createElement("span");
  private frames = 0;
  private since = performance.now();
  private gpuAt = 0;
  private gpu = 0;
  private cell: Battery | null = null;
  /** The battery's level and the time when it was first seen this low, to work out its rate. */
  private firstLevel: { level: number; at: number } | null = null;

  constructor(private readonly scene: () => THREE.Object3D | null) {
    this.el.className = "perf-meter";
    this.el.setAttribute("aria-hidden", "true");
    this.el.append(this.fps, this.memory, this.battery);
    document.body.append(this.el);
    const ask = (navigator as Navigator & { getBattery?: () => Promise<Battery> }).getBattery;
    if (ask) {
      void ask
        .call(navigator)
        .then((b) => {
          this.cell = b;
          b.addEventListener("chargingchange", () => {
            this.firstLevel = null;
          });
        })
        .catch(() => undefined);
    }
    this.battery.textContent = "BAT —";
    const tick = () => {
      this.frames++;
      const now = performance.now();
      if (now - this.since >= 500) this.show(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private show(now: number): void {
    const fps = (this.frames * 1000) / (now - this.since);
    this.frames = 0;
    this.since = now;
    this.fps.textContent = `${Math.round(fps)} FPS`;
    this.fps.dataset.state = fps >= 50 ? "good" : fps >= 30 ? "fair" : "poor";

    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    if (heap) {
      this.memory.textContent = `${Math.round(heap.usedJSHeapSize / 1048576)} MB`;
    } else {
      if (now - this.gpuAt > 3000) {
        const scene = this.scene();
        if (scene) this.gpu = gpuBytes(scene);
        this.gpuAt = now;
      }
      this.memory.textContent = `≈${Math.round(this.gpu / 1048576)} MB`;
    }

    const cell = this.cell;
    if (!cell) return;
    const level = Math.round(cell.level * 100);
    if (cell.charging) {
      this.battery.textContent = `BAT ${level}% ⚡`;
      return;
    }
    if (!this.firstLevel) this.firstLevel = { level: cell.level, at: now };
    const hours = (now - this.firstLevel.at) / 3600000;
    const drop = (this.firstLevel.level - cell.level) * 100;
    const rate = drop >= 1 && hours > 0 ? ` −${(drop / hours).toFixed(0)}%/h` : "";
    this.battery.textContent = `BAT ${level}%${rate}`;
  }
}
