// The crew's home island. It's the same island as every raid island (island.ts): one coast, one
// landing beach, one set of hills. All the grass can be built on, right down to the top of the
// beach. A new island is overgrown: only a clearing round the headquarters and the trail from
// the beach are open, and the rest is thickets, palm groves, rocks, dense jungle and boulders that
// the crew clears to make room. Each needs a tool, and better tools come with headquarters levels.
// Buildings snap to 2 m tiles.
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
import { isOnGrass, landingPoints, trailPoints } from "./island";
import { createRng } from "./rng";
import type { Vec2 } from "./vec";

/** One tile is 2 m square. */
export const TILE = 2;
/** World position (meters; x east, y south) of tile (0, 0)'s north-west corner. */
export const GRID_ORIGIN: Vec2 = { x: -80, y: -64 };
/** Where a new crew's headquarters goes, and the middle of its first clearing. */
export const HOME_START: Vec2 = { x: -12, y: 16 };

/** How far the grid reaches from the middle of the island, in meters. */
const GRID_REACH = { x: 104, y: 88 };

let tileSet: Set<string> | null = null;
let tileList: { x: number; y: number }[] = [];

function buildTiles(): Set<string> {
  const set = new Set<string>();
  tileList = [];
  const x0 = Math.floor((-GRID_REACH.x - GRID_ORIGIN.x) / TILE);
  const x1 = Math.ceil((GRID_REACH.x - GRID_ORIGIN.x) / TILE);
  const y0 = Math.floor((-GRID_REACH.y - GRID_ORIGIN.y) / TILE);
  const y1 = Math.ceil((GRID_REACH.y - GRID_ORIGIN.y) / TILE);
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
      if (!corners.every(([cx, cy]) => isOnGrass(cx, cy))) continue;
      set.add(`${tx},${ty}`);
      tileList.push({ x: tx, y: ty });
    }
  }
  return set;
}

/** True if a tile can be built on: it's on the island's grass. */
export function isBuildableTile(tx: number, ty: number): boolean {
  tileSet ??= buildTiles();
  return tileSet.has(`${tx},${ty}`);
}

/** Every buildable tile, row by row from the north. */
export function buildableTiles(): readonly { x: number; y: number }[] {
  tileSet ??= buildTiles();
  return tileList;
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
  /** Ids of the obstacles (see OBSTACLES) the crew has cleared. */
  cleared: string[];
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
  | { kind: "clear"; id: string };

export function footprint(type: BuildingType, rotated: boolean): { w: number; h: number } {
  const f = FOOTPRINTS[type];
  return rotated ? { w: f.h, h: f.w } : f;
}

/** True if every tile of a rectangle can be built on. */
function onGrass(x: number, y: number, w: number, h: number): boolean {
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) if (!isBuildableTile(tx, ty)) return false;
  }
  return true;
}

/**
 * True if a building sits wholly on the grass, on cleared ground, without overlapping other
 * buildings.
 */
export function fits(
  layout: Pick<CrewLayout, "buildings" | "cleared">,
  candidate: Pick<PlacedBuilding, "id" | "type" | "x" | "y" | "rotated">,
  ignoreId = candidate.id,
): boolean {
  const { w, h } = footprint(candidate.type, candidate.rotated);
  if (!onGrass(candidate.x, candidate.y, w, h)) return false;
  const cleared = new Set(layout.cleared);
  for (const o of obstacles()) {
    if (cleared.has(o.id)) continue;
    if (overlaps(candidate.x, candidate.y, w, h, o)) return false;
  }
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

function overlaps(
  x: number,
  y: number,
  w: number,
  h: number,
  o: { x: number; y: number; w: number; h: number },
): boolean {
  return x < o.x + o.w && o.x < x + w && y < o.y + o.h && o.y < y + h;
}

// ---------------------------------------------------------------------------------------------
// Clearing the island

export type Tool = "axe" | "pickaxe" | "chainsaw" | "dynamite";

/** Tools, in the order the headquarters' level hands them out. */
export const TOOLS: Record<Tool, { label: string; hq: number }> = {
  axe: { label: "Axe", hq: 1 },
  pickaxe: { label: "Pickaxe", hq: 2 },
  chainsaw: { label: "Chainsaw", hq: 3 },
  dynamite: { label: "Dynamite", hq: 5 },
};
export const TOOL_ORDER: readonly Tool[] = ["axe", "pickaxe", "chainsaw", "dynamite"];

export type ObstacleKind = "brush" | "thicket" | "grove" | "rocks" | "jungle" | "boulder";

export const OBSTACLE_KINDS: Record<
  ObstacleKind,
  { label: string; tool: Tool; w: number; h: number; cost: Partial<Purse>; gives: Partial<Purse> }
> = {
  brush: { label: "Brush", tool: "axe", w: 1, h: 1, cost: { gold: 15 }, gives: { timber: 10 } },
  thicket: { label: "Thicket", tool: "axe", w: 2, h: 2, cost: { gold: 40 }, gives: { timber: 40 } },
  grove: {
    label: "Palm grove",
    tool: "axe",
    w: 3,
    h: 3,
    cost: { gold: 90 },
    gives: { timber: 100 },
  },
  rocks: {
    label: "Rocks",
    tool: "pickaxe",
    w: 2,
    h: 2,
    cost: { gold: 150 },
    gives: { stone: 120 },
  },
  jungle: {
    label: "Dense jungle",
    tool: "chainsaw",
    w: 4,
    h: 4,
    cost: { gold: 400, stone: 100 },
    gives: { timber: 380 },
  },
  boulder: {
    label: "Boulder",
    tool: "dynamite",
    w: 3,
    h: 3,
    cost: { gold: 700, scrap: 60 },
    gives: { stone: 450 },
  },
};

export interface Obstacle {
  /** Stable across versions: the crew server stores which ones are cleared by id. */
  id: string;
  kind: ObstacleKind;
  /** Tile column and row of the north-west corner. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The open clearing round the headquarters on a new island, in meters. */
const START_CLEARING = 18;
/** The trail from the landing beach stays open this far either side of its middle. */
const TRAIL_CLEARING = 3.4;

function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const k = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1);
  const t = Math.max(0, Math.min(1, k));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

let obstacleList: Obstacle[] | null = null;

/**
 * Every obstacle on the island: together they cover all the grass out to the shore, apart from
 * the start clearing and the trail. The same on every island and every phone (fixed seed), so the
 * server only needs to store which are cleared. Easy ones grow near the start, harder ones
 * further out.
 */
export function obstacles(): readonly Obstacle[] {
  if (obstacleList) return obstacleList;
  const list: Obstacle[] = [];
  const rng = createRng(0x7a11e);
  const trail = trailPoints(landingPoints().spawn, HOME_START);
  const taken = new Set<string>();
  const center = (t: { x: number; y: number }): Vec2 => ({
    x: GRID_ORIGIN.x + (t.x + 0.5) * TILE,
    y: GRID_ORIGIN.y + (t.y + 0.5) * TILE,
  });
  const fromStart = (t: { x: number; y: number }) => {
    const c = center(t);
    return Math.hypot(c.x - HOME_START.x, c.y - HOME_START.y);
  };
  const open = (t: { x: number; y: number }) => {
    if (fromStart(t) < START_CLEARING) return true;
    const c = center(t);
    for (let i = 0; i + 1 < trail.length; i++) {
      const a = trail[i];
      const b = trail[i + 1];
      if (a && b && segmentDistance(c, a, b) < TRAIL_CLEARING) return true;
    }
    return false;
  };
  const free = (x: number, y: number, w: number, h: number) => {
    if (!onGrass(x, y, w, h)) return false;
    for (let ty = y; ty < y + h; ty++)
      for (let tx = x; tx < x + w; tx++) {
        if (taken.has(`${tx},${ty}`) || open({ x: tx, y: ty })) return false;
      }
    return true;
  };
  // Row by row, so the patches pack tightly and every tile outside the clearing is covered.
  for (const t of buildableTiles()) {
    if (taken.has(`${t.x},${t.y}`) || open(t)) continue;
    const d = fromStart(t);
    const roll = rng();
    // Easy growth near the start, mostly jungle further out, boulders towards the far shores.
    const wanted: ObstacleKind =
      d < 30
        ? roll < 0.5
          ? "thicket"
          : "grove"
        : d < 46
          ? roll < 0.3
            ? "rocks"
            : roll < 0.65
              ? "grove"
              : "jungle"
          : d < 70
            ? roll < 0.65
              ? "jungle"
              : roll < 0.85
                ? "grove"
                : "rocks"
            : roll < 0.2
              ? "boulder"
              : roll < 0.8
                ? "jungle"
                : "rocks";
    // Fall back to smaller patches where the wanted one doesn't fit.
    const tries: ObstacleKind[] = [wanted, "grove", "thicket", "brush"];
    for (const kind of tries) {
      const { w, h } = OBSTACLE_KINDS[kind];
      if (!free(t.x, t.y, w, h)) continue;
      for (let ty = t.y; ty < t.y + h; ty++)
        for (let tx = t.x; tx < t.x + w; tx++) taken.add(`${tx},${ty}`);
      list.push({ id: "", kind, x: t.x, y: t.y, w, h });
      break;
    }
  }
  // Ids by position, so they stay the same as long as the island does.
  for (const o of list) o.id = `${o.x}.${o.y}`;
  obstacleList = list;
  return list;
}

/** The uncleared obstacle covering a tile, if any. */
export function obstacleAtTile(
  layout: Pick<CrewLayout, "cleared">,
  tile: { x: number; y: number },
): Obstacle | undefined {
  const cleared = new Set(layout.cleared);
  return obstacles().find((o) => !cleared.has(o.id) && overlaps(tile.x, tile.y, 1, 1, o));
}

/** Why an obstacle can't be cleared right now, or null if it can. */
export function clearBlocker(layout: CrewLayout, o: Obstacle): string | null {
  const spec = OBSTACLE_KINDS[o.kind];
  const tool = TOOLS[spec.tool];
  if (hqLevel(layout) < tool.hq) return `Needs the ${tool.label} (HQ ${tool.hq})`;
  if (!canAfford(layout.resources, spec.cost)) return "Not enough resources";
  return null;
}

/** How much of the island's overgrowth is cleared, 0 to 1. */
export function clearedShare(layout: Pick<CrewLayout, "cleared">): number {
  const all = obstacles();
  return all.length ? Math.min(1, layout.cleared.length / all.length) : 1;
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
    case "clear": {
      const o = obstacles().find((x) => x.id === op.id);
      if (!o || layout.cleared.includes(o.id)) return { error: "Already cleared" };
      const blocker = clearBlocker(layout, o);
      if (blocker) return { error: blocker };
      const spec = OBSTACLE_KINDS[o.kind];
      const cap = capacity(layout);
      const resources = spend(layout.resources, spec.cost);
      for (const r of RESOURCES)
        resources[r] = Math.min(cap[r], resources[r] + (spec.gives[r] ?? 0));
      // Loose brush touching the patch comes away with it, so nobody has to tap every tile.
      const done = new Set(layout.cleared);
      const brush = obstacles().filter(
        (b) =>
          b.kind === "brush" &&
          !done.has(b.id) &&
          overlaps(b.x, b.y, b.w, b.h, { x: o.x - 1, y: o.y - 1, w: o.w + 2, h: o.h + 2 }),
      );
      return {
        layout: {
          ...layout,
          resources,
          cleared: [...layout.cleared, o.id, ...brush.map((b) => b.id)],
        },
      };
    }
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
  layout: Pick<CrewLayout, "buildings" | "cleared">,
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

/** A new crew starts with a clearing in the overgrowth, just its headquarters in the middle of
 * it, and a little of each resource. */
export function starterLayout(now = Date.now()): CrewLayout {
  const hq: PlacedBuilding = {
    id: "hq",
    type: "headquarters",
    x: 0,
    y: 0,
    rotated: false,
    level: 1,
  };
  const start = cornerFor("headquarters", false, HOME_START);
  const spot = nearestFit({ buildings: [], cleared: [] }, hq, start) ?? { ...hq, ...start };
  return { cleared: [], buildings: [spot], resources: { ...START_RESOURCES }, stamp: now };
}

/** World position (meters) of a building's center. */
export function buildingCenter(b: Pick<PlacedBuilding, "type" | "x" | "y" | "rotated">): Vec2 {
  const { w, h } = footprint(b.type, b.rotated);
  return { x: GRID_ORIGIN.x + (b.x + w / 2) * TILE, y: GRID_ORIGIN.y + (b.y + h / 2) * TILE };
}

/** The tile under a world point (may be off the grass). */
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
    cleared?: unknown;
    resources?: unknown;
    stamp?: unknown;
  } | null;
  const raw = data?.buildings;
  if (!Array.isArray(raw)) return starterLayout(now);
  const allIds = obstacles().map((o) => o.id);
  const known = new Set(allIds);
  const rawCleared = Array.isArray(data?.cleared) ? data.cleared : [];
  const cleared = [
    ...new Set(rawCleared.filter((id): id is string => typeof id === "string" && known.has(id))),
  ];
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
    // Older islands: a building that's off the grass moves to the nearest spot, and the ground
    // under existing buildings counts as cleared.
    const { w, h } = footprint(building.type, building.rotated);
    const open = { buildings, cleared: allIds };
    const spot = onGrass(building.x, building.y, w, h)
      ? building
      : nearestFit(open, building, { x: building.x, y: building.y }, 16);
    if (!spot || !fits(open, spot)) continue;
    for (const o of obstacles())
      if (!cleared.includes(o.id) && overlaps(spot.x, spot.y, w, h, o)) cleared.push(o.id);
    buildings.push(spot);
    ids.add(b.id);
  }
  if (!buildings.some((b) => b.type === "headquarters")) {
    // The HQ can't go missing: put it back on the nearest free spot.
    const fresh = starterLayout(now).buildings[0] as PlacedBuilding;
    const spot = nearestFit({ buildings, cleared }, fresh, { x: fresh.x, y: fresh.y });
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
  return { buildings, cleared, resources, stamp };
}
