// Where an island's scenery goes, shared by the ground colors (terrain.ts) and the plants
// (props.ts): the dirt trail from the landing beach up to the headquarters, the clearing around
// the base, and the jungle that crowds in everywhere else, thicker on stronger islands. Raid
// islands use this; at home the jungle is the overgrowth instead. Render only; the rules ignore it.

import { BUILDINGS } from "../logic/buildings";
import {
  gapToPath,
  HOME_SHAPE,
  type IslandLayout,
  type IslandShape,
  landingPoints,
  trailPoints,
} from "../logic/island";
import { smoothstep, type Vec2 } from "../logic/vec";

export interface SceneryMap {
  /** Distance in meters to the middle of the dirt trail. */
  trail(x: number, y: number): number;
  /** 0 in the base's clearing and on the trail, rising to 1 in the deep jungle. */
  jungle(x: number, y: number): number;
  /** Free ground in meters before the nearest building, rock or palm (0 when on one). */
  room(x: number, y: number): number;
  /** 0 on sand, 1 on grass. */
  grass(x: number, y: number): number;
}

/** Meters to the middle of a gently winding trail through `points`. */
function trailDistance(points: readonly Vec2[], x: number, y: number): number {
  // A little wobble so the edges aren't ruler-straight.
  return gapToPath(points, x, y) + Math.sin(x * 0.31 + y * 0.17) * 0.5;
}

function grassAmount(shape: IslandShape, x: number, y: number): number {
  const wobble = Math.sin(x * 0.45 + y * 0.12) * 1.1 + Math.sin(y * 0.6 - x * 0.2) * 0.8;
  return smoothstep(-2.2, 2.2, shape.shoreDistance(x, y) - shape.beachWidth(x, y) + wobble);
}

/** The crew's home island: just the trail up from the beach; the overgrowth is drawn on top. */
export function homeScenery(hq: Vec2): SceneryMap {
  const points = trailPoints(landingPoints().spawn, hq);
  return {
    trail: (x, y) => trailDistance(points, x, y),
    jungle: () => 0,
    room: () => Infinity,
    grass: (x, y) => grassAmount(HOME_SHAPE, x, y),
  };
}

export function sceneryMap(layout: IslandLayout): SceneryMap {
  const shape = layout.shape ?? HOME_SHAPE;
  const cover = layout.cover ?? 0.75;
  const center = layout.buildings.find((b) => b.type === "headquarters")?.pos ?? shape.base;
  const points = shape.trail.length > 1 ? shape.trail : trailPoints(layout.spawn, center);
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
          Math.hypot(b.pos.x - center.x, b.pos.y - center.y) + BUILDINGS[b.type].radius,
        ),
      18,
    ) + 7;

  const trail = (x: number, y: number) => trailDistance(points, x, y);
  const grass = (x: number, y: number) => grassAmount(shape, x, y) * (1 - shape.lava(x, y));

  const room = (x: number, y: number) => {
    let best = Infinity;
    for (const t of things) best = Math.min(best, Math.hypot(x - t.pos.x, y - t.pos.y) - t.radius);
    return Math.max(0, best);
  };

  const jungle = (x: number, y: number) => {
    const fromBase = Math.hypot(x - center.x, y - center.y);
    const ragged = Math.sin(Math.atan2(y - center.y, x - center.x) * 5 + 1.3) * 4;
    const outside = smoothstep(reach + ragged, reach + 16 + ragged, fromBase);
    const offTrail = smoothstep(7, 14, trail(x, y));
    // Open ground behind the landing beach, so the crew can see where it's going.
    const fromLanding = Math.hypot(x - layout.spawn.x, y - layout.spawn.y);
    const offLanding = smoothstep(24, 40, fromLanding);
    return outside * offTrail * offLanding * grass(x, y) * cover;
  };

  return { trail, jungle, room, grass };
}
