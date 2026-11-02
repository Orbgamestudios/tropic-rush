// The pale water round the world map's islands, as one shape painted into the sea rather than a
// disc under each island. Every island adds to a soft mask, so where two lie close their shallows
// add up past the shelf's edge and run together into one sandbank, the way real reefs do.

import * as THREE from "three";

const MASK_WIDTH = 1024;
const MASK_HEIGHT = 768;
/** Open sea kept round the outermost island, so the mask's edge is always empty. */
const MARGIN = 40;
/** How far the shallows reach, as a share of an island's radius. */
const REACH = 2.7;
/** The solid middle of an island's shallows, as a share of its radius. */
const SOLID = 1.1;

export interface Shoal {
  x: number;
  y: number;
  radius: number;
}

export class MapShallows {
  readonly box = new THREE.Vector4(0, 0, 1, 1);
  private readonly canvas = document.createElement("canvas");
  readonly texture = new THREE.CanvasTexture(this.canvas);

  constructor() {
    this.canvas.width = MASK_WIDTH;
    this.canvas.height = MASK_HEIGHT;
    this.texture.flipY = false;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
  }

  paint(shoals: readonly Shoal[]): void {
    const g = this.canvas.getContext("2d");
    if (!g) return;
    const west = Math.min(...shoals.map((s) => s.x - s.radius * REACH)) - MARGIN;
    const east = Math.max(...shoals.map((s) => s.x + s.radius * REACH)) + MARGIN;
    const north = Math.min(...shoals.map((s) => s.y - s.radius * REACH)) - MARGIN;
    const south = Math.max(...shoals.map((s) => s.y + s.radius * REACH)) + MARGIN;
    this.box.set(west, north, east - west, south - north);
    const sx = MASK_WIDTH / (east - west);
    const sy = MASK_HEIGHT / (south - north);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#000";
    g.fillRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
    // Added up, so neighbors' faint outskirts come to more than either alone.
    g.globalCompositeOperation = "lighter";
    for (const { x, y, radius } of shoals) {
      const outer = radius * REACH;
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, outer);
      glow.addColorStop(0, "#d8d8d8");
      glow.addColorStop(SOLID / REACH, "#d8d8d8");
      glow.addColorStop(1, "#000");
      g.save();
      g.translate((x - west) * sx, (y - north) * sy);
      g.scale(sx, sy);
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, 0, outer, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    this.texture.needsUpdate = true;
  }
}
