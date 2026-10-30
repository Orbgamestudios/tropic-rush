// The crew's home island: a tile grid where crewmates place and move buildings together.
// Plain rules with no engine imports, shared by the phone and the crew server, which checks
// every change with the same functions before accepting it.

import type { BuildingType } from "./buildings";
import type { Vec2 } from "./vec";

/** One tile is 2 m square. */
export const TILE = 2;
export const GRID_COLUMNS = 26;
export const GRID_ROWS = 16;
/** World position (meters; x east, y south) of the grid's north-west corner. */
export const GRID_ORIGIN: Vec2 = { x: -(GRID_COLUMNS * TILE) / 2, y: -12 };

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
}

export type LayoutOp =
  | { kind: "place"; building: PlacedBuilding }
  | { kind: "move"; id: string; x: number; y: number; rotated: boolean }
  | { kind: "remove"; id: string };

export function footprint(type: BuildingType, rotated: boolean): { w: number; h: number } {
  const f = FOOTPRINTS[type];
  return rotated ? { w: f.h, h: f.w } : f;
}

/** True if a building fits inside the grid without overlapping others (ignoring `ignoreId`). */
export function fits(
  layout: CrewLayout,
  candidate: PlacedBuilding,
  ignoreId = candidate.id,
): boolean {
  const { w, h } = footprint(candidate.type, candidate.rotated);
  if (candidate.x < 0 || candidate.y < 0) return false;
  if (candidate.x + w > GRID_COLUMNS || candidate.y + h > GRID_ROWS) return false;
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
      if (!b.id || layout.buildings.some((o) => o.id === b.id)) return null;
      const limit = LIMITS[b.type];
      if (limit !== undefined && layout.buildings.filter((o) => o.type === b.type).length >= limit)
        return null;
      if (!fits(layout, b)) return null;
      return { buildings: [...layout.buildings, { ...b }] };
    }
    case "move": {
      const existing = layout.buildings.find((b) => b.id === op.id);
      if (!existing) return null;
      const moved = { ...existing, x: op.x, y: op.y, rotated: op.rotated };
      if (!fits(layout, moved)) return null;
      return { buildings: layout.buildings.map((b) => (b.id === op.id ? moved : b)) };
    }
    case "remove": {
      const existing = layout.buildings.find((b) => b.id === op.id);
      if (!existing || existing.type === "headquarters") return null;
      return { buildings: layout.buildings.filter((b) => b.id !== op.id) };
    }
  }
}

/** A new crew starts with just its headquarters in the middle of the grid. */
export function starterLayout(): CrewLayout {
  const { w, h } = FOOTPRINTS.headquarters;
  return {
    buildings: [
      {
        id: "hq",
        type: "headquarters",
        x: Math.floor((GRID_COLUMNS - w) / 2),
        y: Math.floor((GRID_ROWS - h) / 2),
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

/** The tile under a world point (may be outside the grid). */
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
  const raw = (value as { buildings?: unknown } | null)?.buildings;
  if (!Array.isArray(raw)) return starterLayout();
  let layout: CrewLayout = { buildings: [] };
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
  if (!layout.buildings.some((b) => b.type === "headquarters")) return starterLayout();
  return layout;
}
