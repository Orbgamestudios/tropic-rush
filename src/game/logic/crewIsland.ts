// The crew's home island: one big flat grass plateau where buildings go, with organic hills and
// slopes around it and a single sandy beach on the south-west side. The plateau is split into
// four sections ("zones") that open one at a time as the crew grows: zone 1 by the beach, then
// west, east and north. Buildings snap to 2 m tiles, and only tiles well inside the plateau's
// flowing outline can be built on. Enemy islands will start from this same design.
// Plain rules with no engine imports, shared by the phone and the crew server, which checks
// every change with the same functions before accepting it.

import type { BuildingType } from "./buildings";
import {
  allowedCount,
  canAfford,
  costFor,
  hqCapacity,
  levelCap,
  MAX_HQ_LEVEL,
  PRODUCERS,
  type Purse,
  productionPerHour,
  RESOURCES,
  START_RESOURCES,
  STORAGES,
  spend,
  storageCapacity,
} from "./economy";
import type { Vec2 } from "./vec";

/** One tile is 2 m square. */
export const TILE = 2;
/** World position (meters; x east, y south) of tile (0, 0)'s north-west corner. */
export const GRID_ORIGIN: Vec2 = { x: -80, y: -64 };
/** Height of the flat build plateau, in meters. */
export const PLATEAU_HEIGHT = 2.4;

/** The plateau's outline: a rough oval with lumps ([amount, phase] for 3, 5 and 7 bumps). */
export const PLATEAU = {
  cx: -4,
  cy: 2,
  rx: 60,
  ry: 44,
  lumps: [0.07, 0.6, 0.05, 2.4, 0.03, 4.1],
} as const;

/** How far inside the plateau's organic outline a point is, in meters (negative outside). */
export function plateauInside(x: number, y: number): number {
  const dx = (x - PLATEAU.cx) / PLATEAU.rx;
  const dy = (y - PLATEAU.cy) / PLATEAU.ry;
  const angle = Math.atan2(dy, dx);
  const [a3, p3, a5, p5, a7, p7] = PLATEAU.lumps;
  const edge =
    1 +
    a3 * Math.sin(3 * angle + p3) +
    a5 * Math.sin(5 * angle + p5) +
    a7 * Math.sin(7 * angle + p7);
  return (edge - Math.hypot(dx, dy)) * Math.min(PLATEAU.rx, PLATEAU.ry);
}

export interface Zone {
  /** 1 to 4, in unlock order. */
  id: number;
  name: string;
  /** The zone's heart: each plateau tile belongs to the zone whose heart is nearest. */
  cx: number;
  cy: number;
  /** Ground height in meters (the same for every zone: the plateau is flat). */
  height: number;
}

export const ZONES: readonly Zone[] = [
  { id: 1, name: "Landing", cx: -14, cy: 20, height: PLATEAU_HEIGHT },
  { id: 2, name: "West field", cx: -46, cy: -6, height: PLATEAU_HEIGHT },
  { id: 3, name: "East field", cx: 32, cy: 12, height: PLATEAU_HEIGHT },
  { id: 4, name: "North field", cx: 0, cy: -28, height: PLATEAU_HEIGHT },
];

/** A gentle wobble added to distances, so the borders between zones curve instead of running straight. */
function borderWobble(x: number, y: number): number {
  return 3 * Math.sin(x * 0.13 + y * 0.07) + 2 * Math.sin(y * 0.17 - x * 0.05);
}

/** The zone a world point belongs to, if it's on the plateau. */
export function zoneAt(x: number, y: number): Zone | undefined {
  if (plateauInside(x, y) < 0) return undefined;
  let best: Zone | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const z of ZONES) {
    const d = Math.hypot(x - z.cx, y - z.cy) + borderWobble(x, y) * (z.id % 2 ? 1 : -1);
    if (d < bestDistance) {
      best = z;
      bestDistance = d;
    }
  }
  return best;
}

/** A tile is buildable when all its corners sit at least this far inside the plateau. */
const EDGE_MARGIN = 1;

let tileZones: Map<string, number> | null = null;
const tileLists = new Map<number, { x: number; y: number }[]>();

function buildTileMap(): Map<string, number> {
  const map = new Map<string, number>();
  for (const z of ZONES) tileLists.set(z.id, []);
  const x0 = Math.floor((PLATEAU.cx - PLATEAU.rx * 1.2 - GRID_ORIGIN.x) / TILE);
  const x1 = Math.ceil((PLATEAU.cx + PLATEAU.rx * 1.2 - GRID_ORIGIN.x) / TILE);
  const y0 = Math.floor((PLATEAU.cy - PLATEAU.ry * 1.2 - GRID_ORIGIN.y) / TILE);
  const y1 = Math.ceil((PLATEAU.cy + PLATEAU.ry * 1.2 - GRID_ORIGIN.y) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const x = GRID_ORIGIN.x + tx * TILE;
      const y = GRID_ORIGIN.y + ty * TILE;
      const corners = [
        [x, y],
        [x + TILE, y],
        [x, y + TILE],
        [x + TILE, y + TILE],
      ] as const;
      if (!corners.every(([cx, cy]) => plateauInside(cx, cy) >= EDGE_MARGIN)) continue;
      const zone = zoneAt(x + TILE / 2, y + TILE / 2);
      if (!zone) continue;
      map.set(`${tx},${ty}`, zone.id);
      tileLists.get(zone.id)?.push({ x: tx, y: ty });
    }
  }
  return map;
}

/** The zone a tile belongs to, if it's buildable. */
export function zoneIdOfTile(tx: number, ty: number): number | undefined {
  tileZones ??= buildTileMap();
  return tileZones.get(`${tx},${ty}`);
}

/** Every buildable tile in a zone. */
export function zoneTiles(zoneId: number): readonly { x: number; y: number }[] {
  tileZones ??= buildTileMap();
  return tileLists.get(zoneId) ?? [];
}

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
  goldVault: { w: 3, h: 2 },
  timberShed: { w: 3, h: 2 },
  stoneYard: { w: 3, h: 2 },
  scrapBin: { w: 3, h: 2 },
  refinery: { w: 3, h: 3 },
};

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  /** Tile column and row of the building's north-west corner. */
  x: number;
  y: number;
  /** Turned 90 degrees, swapping width and depth. */
  rotated: boolean;
  /** 1 when built; raised by upgrades, up to what the headquarters' level allows. */
  level: number;
}

export interface CrewLayout {
  buildings: PlacedBuilding[];
  /** How many zones are open (1 to 4). */
  unlocked: number;
  /** The crew's shared stock, as of `stamp`. */
  resources: Purse;
  /** When `resources` was last brought up to date (server time, milliseconds). */
  stamp: number;
}

export type LayoutOp =
  | { kind: "place"; building: PlacedBuilding }
  | { kind: "move"; id: string; x: number; y: number; rotated: boolean }
  | { kind: "remove"; id: string }
  | { kind: "upgrade"; id: string }
  | { kind: "unlock"; zone: number };

export function footprint(type: BuildingType, rotated: boolean): { w: number; h: number } {
  const f = FOOTPRINTS[type];
  return rotated ? { w: f.h, h: f.w } : f;
}

/** The zone that holds every tile of a rectangle, if one does. */
export function zoneForRect(x: number, y: number, w: number, h: number): Zone | undefined {
  const id = zoneIdOfTile(x, y);
  if (id === undefined) return undefined;
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) if (zoneIdOfTile(tx, ty) !== id) return undefined;
  }
  return ZONES[id - 1];
}

export function zoneOf(b: Pick<PlacedBuilding, "type" | "x" | "y" | "rotated">): Zone | undefined {
  const { w, h } = footprint(b.type, b.rotated);
  return zoneForRect(b.x, b.y, w, h);
}

/** True if a building sits wholly inside an unlocked zone without overlapping others. */
export function fits(
  layout: Pick<CrewLayout, "buildings" | "unlocked">,
  candidate: Pick<PlacedBuilding, "id" | "type" | "x" | "y" | "rotated">,
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

// ---------------------------------------------------------------------------------------------
// Progression

/** The headquarters' level (1 if it's somehow missing). */
export function hqLevel(layout: Pick<CrewLayout, "buildings">): number {
  return layout.buildings.find((b) => b.type === "headquarters")?.level ?? 1;
}

/** How much of each resource the island can hold: the headquarters plus its storages. */
export function capacity(layout: Pick<CrewLayout, "buildings">): Purse {
  const base = hqCapacity(hqLevel(layout));
  const cap: Purse = { gold: base, timber: base, stone: base, scrap: base };
  for (const b of layout.buildings) {
    const r = STORAGES[b.type];
    if (r) cap[r] += storageCapacity(b.level);
  }
  return cap;
}

/** Production per hour of each resource. */
export function production(layout: Pick<CrewLayout, "buildings">): Purse {
  const rate: Purse = { gold: 0, timber: 0, stone: 0, scrap: 0 };
  for (const b of layout.buildings) {
    const r = PRODUCERS[b.type];
    if (r) rate[r] += productionPerHour(b.level);
  }
  return rate;
}

/** Resources build up for at most this long between visits. */
const MAX_IDLE_MS = 7 * 24 * 3600 * 1000;

/** Brings the stock up to date: producers fill it until it reaches what storage can hold. */
export function settle(layout: CrewLayout, now: number): CrewLayout {
  if (now <= layout.stamp) return layout;
  const hours = Math.min(MAX_IDLE_MS, now - layout.stamp) / 3_600_000;
  const rate = production(layout);
  const cap = capacity(layout);
  const resources = { ...layout.resources };
  for (const r of RESOURCES) {
    if (resources[r] < cap[r]) resources[r] = Math.min(cap[r], resources[r] + rate[r] * hours);
  }
  return { ...layout, resources, stamp: now };
}

/** Why a building can't be built right now, or null if it can (ignoring where it goes). */
export function buildBlocker(layout: CrewLayout, type: BuildingType): string | null {
  const hq = hqLevel(layout);
  const allowed = allowedCount(type, hq);
  const have = layout.buildings.filter((b) => b.type === type).length;
  if (allowed === 0) return `Needs headquarters level ${firstHqAllowing(type)}`;
  if (have >= allowed) {
    const next = firstHqAllowing(type, have + 1);
    return next ? `Upgrade headquarters to ${next} for another` : "You have the most allowed";
  }
  if (!canAfford(layout.resources, costFor(type, 1))) return "Not enough resources";
  return null;
}

/** The lowest headquarters level that allows `count` of a building, or null if none does. */
export function firstHqAllowing(type: BuildingType, count = 1): number | null {
  for (let hq = 1; hq <= MAX_HQ_LEVEL; hq++) if (allowedCount(type, hq) >= count) return hq;
  return null;
}

/** Why a building can't be upgraded right now, or null if it can. */
export function upgradeBlocker(layout: CrewLayout, b: PlacedBuilding): string | null {
  const cap = levelCap(b.type, hqLevel(layout));
  if (b.level >= cap) {
    return b.type === "headquarters" || cap >= levelCap(b.type, MAX_HQ_LEVEL)
      ? "Already at its highest level"
      : "Upgrade the headquarters first";
  }
  if (!canAfford(layout.resources, costFor(b.type, b.level + 1))) return "Not enough resources";
  return null;
}

/**
 * Applies a change if it's allowed, returning the new layout, or why not. `now` is the server's
 * clock (milliseconds), used to bring the stock up to date before paying for anything.
 */
export function tryOp(
  current: CrewLayout,
  op: LayoutOp,
  now: number,
): { layout: CrewLayout } | { error: string } {
  const layout = settle(current, now);
  switch (op.kind) {
    case "place": {
      const b = op.building;
      if (!b?.id || typeof b.type !== "string" || !(b.type in FOOTPRINTS))
        return { error: "Unknown building" };
      if (layout.buildings.some((o) => o.id === b.id)) return { error: "Already built" };
      const blocker = buildBlocker(layout, b.type);
      if (blocker) return { error: blocker };
      const building: PlacedBuilding = {
        id: b.id,
        type: b.type,
        x: b.x,
        y: b.y,
        rotated: !!b.rotated,
        level: 1,
      };
      if (!fits(layout, building)) return { error: "That doesn't fit there" };
      return {
        layout: {
          ...layout,
          resources: spend(layout.resources, costFor(b.type, 1)),
          buildings: [...layout.buildings, building],
        },
      };
    }
    case "move": {
      const existing = layout.buildings.find((b) => b.id === op.id);
      if (!existing) return { error: "That building is gone" };
      const moved = { ...existing, x: op.x, y: op.y, rotated: !!op.rotated };
      if (!fits(layout, moved)) return { error: "That doesn't fit there" };
      return {
        layout: { ...layout, buildings: layout.buildings.map((b) => (b.id === op.id ? moved : b)) },
      };
    }
    case "remove": {
      const existing = layout.buildings.find((b) => b.id === op.id);
      if (!existing) return { error: "That building is gone" };
      if (existing.type === "headquarters") return { error: "The headquarters stays" };
      return { layout: { ...layout, buildings: layout.buildings.filter((b) => b.id !== op.id) } };
    }
    case "upgrade": {
      const existing = layout.buildings.find((b) => b.id === op.id);
      if (!existing) return { error: "That building is gone" };
      const blocker = upgradeBlocker(layout, existing);
      if (blocker) return { error: blocker };
      const upgraded = { ...existing, level: existing.level + 1 };
      return {
        layout: {
          ...layout,
          resources: spend(layout.resources, costFor(existing.type, upgraded.level)),
          buildings: layout.buildings.map((b) => (b.id === op.id ? upgraded : b)),
        },
      };
    }
    case "unlock":
      // Zones open one at a time, in order. (Free for now; a later step ties this to progress.)
      if (op.zone !== layout.unlocked + 1 || op.zone > ZONES.length)
        return { error: "Unlock the zones in order" };
      return { layout: { ...layout, unlocked: op.zone } };
  }
  return { error: "Unknown change" };
}

/** Like `tryOp`, returning just the new layout, or null if the change isn't allowed. */
export function applyOp(layout: CrewLayout, op: LayoutOp, now: number): CrewLayout | null {
  const result = tryOp(layout, op, now);
  return "layout" in result ? result.layout : null;
}

/** The free spot for a footprint nearest a tile, searching outward in rings. */
export function nearestFit(
  layout: Pick<CrewLayout, "buildings" | "unlocked">,
  building: PlacedBuilding,
  start: { x: number; y: number },
  maxRadius = 50,
): PlacedBuilding | null {
  for (let radius = 0; radius < maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const candidate = { ...building, x: start.x + dx, y: start.y + dy };
        if (fits(layout, candidate)) return candidate;
      }
    }
  }
  return null;
}

/** World point of a zone's middle: the average of its tiles. */
export function zoneCenter(z: Zone): Vec2 {
  const tiles = zoneTiles(z.id);
  if (tiles.length === 0) return { x: z.cx, y: z.cy };
  let x = 0;
  let y = 0;
  for (const t of tiles) {
    x += t.x;
    y += t.y;
  }
  return {
    x: GRID_ORIGIN.x + (x / tiles.length + 0.5) * TILE,
    y: GRID_ORIGIN.y + (y / tiles.length + 0.5) * TILE,
  };
}

/** A new crew starts with zone 1 open, just its headquarters in the middle of it, and a little
 * of each resource. */
export function starterLayout(now = Date.now()): CrewLayout {
  const first = ZONES[0] as Zone;
  const hq: PlacedBuilding = {
    id: "hq",
    type: "headquarters",
    x: 0,
    y: 0,
    rotated: false,
    level: 1,
  };
  const start = cornerFor("headquarters", false, zoneCenter(first));
  const spot = nearestFit({ buildings: [], unlocked: 1 }, hq, start) ?? { ...hq, ...start };
  return { unlocked: 1, buildings: [spot], resources: { ...START_RESOURCES }, stamp: now };
}

/** World position (meters) of a building's center. */
export function buildingCenter(b: Pick<PlacedBuilding, "type" | "x" | "y" | "rotated">): Vec2 {
  const { w, h } = footprint(b.type, b.rotated);
  return { x: GRID_ORIGIN.x + (b.x + w / 2) * TILE, y: GRID_ORIGIN.y + (b.y + h / 2) * TILE };
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

/**
 * Checks untrusted layout data (from storage or the network) and drops anything invalid:
 * buildings that don't fit or that the headquarters' level doesn't allow, and levels above its
 * caps. It never charges for anything.
 */
export function sanitizeLayout(value: unknown, now = Date.now()): CrewLayout {
  const data = value as {
    buildings?: unknown;
    unlocked?: unknown;
    resources?: unknown;
    stamp?: unknown;
  } | null;
  const raw = data?.buildings;
  if (!Array.isArray(raw)) return starterLayout(now);
  const unlocked = Number.isInteger(data?.unlocked)
    ? Math.min(ZONES.length, Math.max(1, data?.unlocked as number))
    : 1;
  const parsed: PlacedBuilding[] = [];
  for (const item of raw) {
    const b = item as Partial<PlacedBuilding>;
    if (typeof b.id !== "string" || typeof b.type !== "string" || !(b.type in FOOTPRINTS)) continue;
    if (!Number.isInteger(b.x) || !Number.isInteger(b.y)) continue;
    const level = Number.isInteger(b.level) ? Math.max(1, b.level as number) : 1;
    parsed.push({
      id: b.id,
      type: b.type as BuildingType,
      x: b.x as number,
      y: b.y as number,
      rotated: !!b.rotated,
      level,
    });
  }
  // The headquarters first: its level sets what else is allowed.
  parsed.sort((a, b) => Number(b.type === "headquarters") - Number(a.type === "headquarters"));
  const hqData = parsed.find((b) => b.type === "headquarters");
  const hq = Math.min(MAX_HQ_LEVEL, hqData?.level ?? 1);
  const buildings: PlacedBuilding[] = [];
  const ids = new Set<string>();
  for (const b of parsed) {
    if (ids.has(b.id)) continue;
    const have = buildings.filter((o) => o.type === b.type).length;
    if (have >= allowedCount(b.type, hq)) continue;
    const building = { ...b, level: Math.min(b.level, Math.max(1, levelCap(b.type, hq))) };
    if (!fits({ buildings, unlocked }, building)) continue;
    buildings.push(building);
    ids.add(b.id);
  }
  if (!buildings.some((b) => b.type === "headquarters")) {
    // The HQ can't go missing: put it back on the nearest free spot.
    const fresh = starterLayout(now).buildings[0] as PlacedBuilding;
    const spot = nearestFit({ buildings, unlocked }, fresh, { x: fresh.x, y: fresh.y });
    if (spot) buildings.unshift({ ...spot, level: hq });
  }
  const cap = capacity({ buildings });
  const rawResources = data?.resources as Partial<Purse> | undefined;
  const resources = { ...START_RESOURCES };
  if (rawResources && typeof rawResources === "object") {
    for (const r of RESOURCES) {
      const v = rawResources[r];
      resources[r] = typeof v === "number" && Number.isFinite(v) ? v : 0;
    }
  }
  for (const r of RESOURCES) resources[r] = Math.max(0, Math.min(cap[r], resources[r]));
  const stamp =
    typeof data?.stamp === "number" && Number.isFinite(data.stamp) && data.stamp <= now
      ? data.stamp
      : now;
  return { buildings, unlocked, resources, stamp };
}
