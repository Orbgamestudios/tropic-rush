// Where an island's scenery goes, shared by the ground colors (terrain.ts) and the plants
// (props.ts): the dirt trail from the landing beach up to the headquarters, the clearing around
// the base, and the jungle that crowds in everywhere else. Raid islands and the crew's home island
// are the same island, so both use this; at home the jungle is the overgrowth instead. Render
// only; the rules ignore it.

import { BUILDINGS } from "../logic/buildings";
import {
  BASE_CENTER,
  beachWidth,
  type IslandLayout,
  landingPoints,
  shoreDistance,
  trailPoints,
} from "../logic/island";
import { clamp, smoothstep, type Vec2, vec } from "../logic/vec";

export interface SceneryMap {
  /** Distance in meters to the middle of the dirt trail. */
  trail(x: number, y: number): number;
  /** 0 in the base's clearing and on the trail, rising to 1 in the deep jungle. */
  jungle(x: number, y: number): number;
  /** Free ground in meters before the nearest building, rock or palm (0 when on one). */
  room(x: number, y: number): number;
  /** 0 on sand, 1 on grass. */
  grass(x: number, y: number): number;
  /** 1 on the packed dirt under and around a building, 0 away from it. */
  pad(x: number, y: number): number;
}

function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Meters to the middle of a gently winding trail through `points`. */
function trailDistance(points: readonly Vec2[], x: number, y: number): number {
  const p = vec(x, y);
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b) best = Math.min(best, segmentDistance(p, a, b));
  }
  // A little wobble so the edges aren't ruler-straight.
  return best + Math.sin(x * 0.31 + y * 0.17) * 0.5;
}

function grassAmount(x: number, y: number): number {
  const wobble = Math.sin(x * 0.45 + y * 0.12) * 1.1 + Math.sin(y * 0.6 - x * 0.2) * 0.8;
  return smoothstep(-2.2, 2.2, shoreDistance(x, y) - beachWidth(x, y) + wobble);
}

/** The crew's home island: just the trail up from the beach; the overgrowth is drawn on top. */
export function homeScenery(hq: Vec2): SceneryMap {
  const points = trailPoints(landingPoints().spawn, hq);
  return {
    trail: (x, y) => trailDistance(points, x, y),
    jungle: () => 0,
    room: () => Infinity,
    grass: grassAmount,
    pad: () => 0,
  };
}

export function sceneryMap(layout: IslandLayout): SceneryMap {
  const hq = layout.buildings.find((b) => b.type === "headquarters")?.pos ?? BASE_CENTER;
  const points = trailPoints(layout.spawn, hq);
  const things = [
    ...layout.buildings.map((b) => ({ pos: b.pos, radius: BUILDINGS[b.type].radius })),
    ...layout.obstacles.map((o) => ({ pos: o.pos, radius: o.radius })),
  ];
  // The clearing reaches a little past the outermost building.
  const reach =
    layout.buildings.reduce(
      (most, b) =>
        Math.max(
          most,
          Math.hypot(b.pos.x - BASE_CENTER.x, b.pos.y - BASE_CENTER.y) + BUILDINGS[b.type].radius,
        ),
      24,
    ) + 7;

  const trail = (x: number, y: number) => trailDistance(points, x, y);
  const grass = grassAmount;

  const room = (x: number, y: number) => {
    let best = Infinity;
    for (const t of things) best = Math.min(best, Math.hypot(x - t.pos.x, y - t.pos.y) - t.radius);
    return Math.max(0, best);
  };

  const jungle = (x: number, y: number) => {
    const fromBase = Math.hypot(x - BASE_CENTER.x, y - BASE_CENTER.y);
    const ragged = Math.sin(Math.atan2(y - BASE_CENTER.y, x - BASE_CENTER.x) * 5 + 1.3) * 4;
    const outside = smoothstep(reach + ragged, reach + 16 + ragged, fromBase);
    const offTrail = smoothstep(7, 14, trail(x, y));
    // Open ground behind the landing beach, so the crew can see where it's going.
    const fromLanding = Math.hypot(x - layout.spawn.x, y - layout.spawn.y);
    const offLanding = smoothstep(24, 40, fromLanding);
    return outside * offTrail * offLanding * grass(x, y);
  };

  const pads = layout.buildings.map((b) => ({ pos: b.pos, radius: BUILDINGS[b.type].radius }));
  const pad = (x: number, y: number) => {
    let most = 0;
    for (const b of pads) {
      const d = Math.hypot(x - b.pos.x, y - b.pos.y) + Math.sin(x * 1.3 + y * 0.9) * 0.4;
      most = Math.max(most, smoothstep(b.radius + 2.4, b.radius + 0.9, d));
    }
    return most;
  };

  return { trail, jungle, room, grass, pad };
}
