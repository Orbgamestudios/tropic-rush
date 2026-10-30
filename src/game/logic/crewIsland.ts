// The crew's home island: four building areas ("zones") climbing the island in a zigzag, each
// higher than the last. Zone 1 is open from the start; the crew unlocks the others in order.
// Plain rules with no engine imports, shared by the phone and the crew server, which checks
// every change with the same functions before accepting it.

import type { BuildingType } from "./buildings";
import type { Vec2 } from "./vec";

/** One tile is 2 m square. */
export const TILE = 2;
/** World position (meters; x east, y south) of tile (0, 0)'s north-west corner. */
export const GRID_ORIGIN: Vec2 = { x: -26, y: -12 };

export interface Zone {
  /** 1 to 4, in unlock order. */
  id: number;
  name: string;
  /** Tile rectangle: north-west corner and size. Tile y is negative north of zone 1. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ground height in meters. */
  height: number;
}

/** Front beach, then back-left, back-right and far back-left: a zigzag climbing the island. */
export const ZONES: readonly Zone[] = [
  { id: 1, name: "Landing", x: 0, y: 0, w: 26, h: 16, height: 2.2 },
  { id: 2, name: "West terrace", x: -9, y: -15, w: 19, h: 11, height: 6.2 },
  { id: 3, name: "East terrace", x: 15, y: -27, w: 20, h: 11, height: 10.2 },
  { id: 4, name: "Summit", x: -9, y: -43, w: 23, h: 13, height: 14.2 },
];

/** Footprint in tiles (width east-west, depth north-south) before rotating. */
export const FOOTPRINTS: Record<BuildingType, { w: number; h: number }> = {
  headquarters: { w: 6, h: 6 },
  gunTurret: { w: 2, h: 2 },
  mortar: { w: 2, h: 2 },
  harpoon: { w: 2, h: 2 },
  flamethrower: { w: 2, h: 2 },
  watchtower: { w: 2, h: 2 },
  goldMine: { w: 3, h: 3 },
  lumberCamp: { w: 3, h: 3 },
  quarry: { w: 3, h: 3 },
  scrapYard: { w: 3, h: 3 },
  storehouse: { w: 3, h: 2 },
  refinery: { w: 3, h: 3 },
};

/** How many of each building a crew may have. The headquarters is unique and can't be removed. */
export const LIMITS: Partial<Record<BuildingType, number>> = { headquarters: 1 };

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  /** Tile column and row of the building's north-west corner. */
  x: number;
  y: number;
  /** Turned 90 degrees, swapping width and depth. */
  rotated: boolean;
}

export interface CrewLayout {
  buildings: PlacedBuilding[];
  /** How many zones are open (1 to 4). */
  unlocked: number;
}

export type LayoutOp =
  | { kind: "place"; building: PlacedBuilding }
  | { kind: "move"; id: string; x: number; y: number; rotated: boolean }
  | { kind: "remove"; id: string }
  | { kind: "unlock"; zone: number };

export function footprint(type: BuildingType, rotated: boolean): { w: number; h: number } {
  const f = FOOTPRINTS[type];
  return rotated ? { w: f.h, h: f.w } : f;
}

/** The zone that wholly contains a tile rectangle, if any. */
export function zoneForRect(x: number, y: number, w: number, h: number): Zone | undefined {
  return ZONES.find((z) => x >= z.x && y >= z.y && x + w <= z.x + z.w && y + h <= z.y + z.h);
}

export function zoneOf(b: Pick<PlacedBuilding, "type" | "x" | "y" | "rotated">): Zone | undefined {
  const { w, h } = footprint(b.type, b.rotated);
  return zoneForRect(b.x, b.y, w, h);
}

/** True if a building sits wholly inside an unlocked zone without overlapping others. */
export function fits(
  layout: CrewLayout,
  candidate: PlacedBuilding,
  ignoreId = candidate.id,
): boolean {
  const { w, h } = footprint(candidate.type, candidate.rotated);
  const zone = zoneForRect(candidate.x, candidate.y, w, h);
  if (!zone || zone.id > layout.unlocked) return false;
  return layout.buildings.every((b) => {
    if (b.id === ignoreId) return true;
    const o = footprint(b.type, b.rotated);
    return (
      candidate.x + w <= b.x ||
      b.x + o.w <= candidate.x ||
      candidate.y + h <= b.y ||
      b.y + o.h <= candidate.y
    );
  });
}

/** Applies a change if it's allowed, returning the new layout, or null if it isn't. */
export function applyOp(layout: CrewLayout, op: LayoutOp): CrewLayout | null {
  switch (op.kind) {
    case "place": {
      const b = op.building;
      if (!b?.id || layout.buildings.some((o) => o.id === b.id)) return null;
      const limit = LIMITS[b.type];
      if (limit !== undefined && layout.buildings.filter((o) => o.type === b.type).length >= limit)
        return null;
      if (!fits(layout, b)) return null;
      return { ...layout, buildings: [...layout.buildings, { ...b }] };
    }
    case "move": {
      const existing = layout.buildings.find((b) => b.id === op.id);
      if (!existing) return null;
      const moved = { ...existing, x: op.x, y: op.y, rotated: op.rotated };
      if (!fits(layout, moved)) return null;
      return { ...layout, buildings: layout.buildings.map((b) => (b.id === op.id ? moved : b)) };
    }
    case "remove": {
      const existing = layout.buildings.find((b) => b.id === op.id);
      if (!existing || existing.type === "headquarters") return null;
      return { ...layout, buildings: layout.buildings.filter((b) => b.id !== op.id) };
    }
    case "unlock":
      // Zones open one at a time, in order. (Free for now; a later step ties this to progress.)
      if (op.zone !== layout.unlocked + 1 || op.zone > ZONES.length) return null;
      return { ...layout, unlocked: op.zone };
  }
}

/** A new crew starts with zone 1 open and just its headquarters in the middle of it. */
export function starterLayout(): CrewLayout {
  const { w, h } = FOOTPRINTS.headquarters;
  const first = ZONES[0] as Zone;
  return {
    unlocked: 1,
    buildings: [
      {
        id: "hq",
        type: "headquarters",
        x: first.x + Math.floor((first.w - w) / 2),
        y: first.y + Math.floor((first.h - h) / 2),
        rotated: false,
      },
    ],
  };
}

/** World position (meters) of a building's center. */
export function buildingCenter(b: Pick<PlacedBuilding, "type" | "x" | "y" | "rotated">): Vec2 {
  const { w, h } = footprint(b.type, b.rotated);
  return { x: GRID_ORIGIN.x + (b.x + w / 2) * TILE, y: GRID_ORIGIN.y + (b.y + h / 2) * TILE };
}

/** World rectangle (meters) of a zone: west, north, width, depth. */
export function zoneBounds(z: Zone): { x: number; y: number; w: number; h: number } {
  return {
    x: GRID_ORIGIN.x + z.x * TILE,
    y: GRID_ORIGIN.y + z.y * TILE,
    w: z.w * TILE,
    h: z.h * TILE,
  };
}

/** The tile under a world point (may be outside every zone). */
export function tileAt(p: Vec2): { x: number; y: number } {
  return {
    x: Math.floor((p.x - GRID_ORIGIN.x) / TILE),
    y: Math.floor((p.y - GRID_ORIGIN.y) / TILE),
  };
}

/** Top-left tile that centers a building's footprint on a world point. */
export function cornerFor(type: BuildingType, rotated: boolean, p: Vec2): { x: number; y: number } {
  const { w, h } = footprint(type, rotated);
  return {
    x: Math.round((p.x - GRID_ORIGIN.x) / TILE - w / 2),
    y: Math.round((p.y - GRID_ORIGIN.y) / TILE - h / 2),
  };
}

export function buildingAtTile(
  layout: CrewLayout,
  tile: { x: number; y: number },
): PlacedBuilding | undefined {
  return layout.buildings.find((b) => {
    const { w, h } = footprint(b.type, b.rotated);
    return tile.x >= b.x && tile.x < b.x + w && tile.y >= b.y && tile.y < b.y + h;
  });
}

/** Checks untrusted layout data (from storage or the network) and drops anything invalid. */
export function sanitizeLayout(value: unknown): CrewLayout {
  const data = value as { buildings?: unknown; unlocked?: unknown } | null;
  const raw = data?.buildings;
  if (!Array.isArray(raw)) return starterLayout();
  const unlocked = Number.isInteger(data?.unlocked)
    ? Math.min(ZONES.length, Math.max(1, data?.unlocked as number))
    : 1;
  let layout: CrewLayout = { buildings: [], unlocked };
  for (const item of raw) {
    const b = item as Partial<PlacedBuilding>;
    if (typeof b.id !== "string" || typeof b.type !== "string" || !(b.type in FOOTPRINTS)) continue;
    if (!Number.isInteger(b.x) || !Number.isInteger(b.y)) continue;
    const next = applyOp(layout, {
      kind: "place",
      building: {
        id: b.id,
        type: b.type as BuildingType,
        x: b.x as number,
        y: b.y as number,
        rotated: !!b.rotated,
      },
    });
    if (next) layout = next;
  }
  if (!layout.buildings.some((b) => b.type === "headquarters"))
    return { ...starterLayout(), unlocked };
  return layout;
}
