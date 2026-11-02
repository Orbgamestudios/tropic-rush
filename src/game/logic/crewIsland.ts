// The crew's home island. It's the same island as every raid island (island.ts): one coast, one
// landing beach, one set of hills. All the grass can be built on, right down to the top of the
// beach. A new island is overgrown: only a clearing round the headquarters and the trail from
// the beach are open, and the rest is thickets, palm groves, rocks, dense jungle and boulders that
// the crew clears to make room. Clearing is meant to take months: each patch needs a tool of a
// high enough level, work takes real time, and only so many workers can be busy at once.
// Buildings snap to 2 m tiles.
// Plain rules with no engine imports, shared by the phone and the crew server, which checks
// every change with the same functions before accepting it.

import type { BuildingType } from "./buildings";
import {
  allowedCount,
  buildTime,
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
  headquarters: { w: 5, h: 5 },
  gunTurret: { w: 3, h: 3 },
  mortar: { w: 3, h: 3 },
  harpoon: { w: 3, h: 3 },
  flamethrower: { w: 3, h: 3 },
  watchtower: { w: 3, h: 3 },
  landmine: { w: 1, h: 1 },
  goldMine: { w: 4, h: 4 },
  lumberCamp: { w: 4, h: 4 },
  quarry: { w: 4, h: 4 },
  scrapYard: { w: 4, h: 4 },
  storehouse: { w: 3, h: 3 },
  goldVault: { w: 3, h: 3 },
  timberShed: { w: 3, h: 3 },
  stoneYard: { w: 3, h: 3 },
  scrapBin: { w: 3, h: 3 },
  refinery: { w: 4, h: 4 },
};

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  /** Tile column and row of the building's north-west corner. */
  x: number;
  y: number;
  /** Turned 90 degrees, swapping width and depth. */
  rotated: boolean;
  /**
   * 0 while it's first going up, then 1; raised by upgrades when their work is done, up to what
   * the headquarters' level allows.
   */
  level: number;
}

export interface CrewLayout {
  buildings: PlacedBuilding[];
  /** Ids of the obstacles (see OBSTACLES) the crew has cleared. */
  cleared: string[];
  /** Each tool's level; 0 until it's bought. */
  tools: Record<Tool, number>;
  /** Clearing under way: each finishes by itself at `doneAt` (server time, milliseconds). */
  jobs: ClearJob[];
  /** Building and upgrading under way, which finish the same way. */
  builds: BuildJob[];
  /** The crew's shared stock, as of `stamp`. */
  resources: Purse;
  /** When `resources` was last brought up to date (server time, milliseconds). */
  stamp: number;
}

export interface ClearJob {
  id: string;
  doneAt: number;
}

export interface BuildJob {
  /** The building being worked on, or the tool being improved. */
  target: { building: string } | { tool: Tool };
  doneAt: number;
}

export type LayoutOp =
  | { kind: "place"; building: PlacedBuilding }
  | { kind: "move"; id: string; x: number; y: number; rotated: boolean }
  | { kind: "remove"; id: string }
  | { kind: "upgrade"; id: string }
  | { kind: "clear"; id: string }
  | { kind: "toolUp"; tool: Tool }
  /** Materials brought home from a raid. */
  | { kind: "loot"; purse: Partial<Purse> };

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

/** A tool's best level. Every patch needs a tool at its tier or better. */
export const MAX_TOOL_LEVEL = 5;

/**
 * Tools, in the order they come. `hq` is the headquarters level for level 1, `step` how many
 * more each further level needs, and `cost` the price of level 1.
 */
export const TOOLS: Record<
  Tool,
  { label: string; hq: number; step: number; cost: Partial<Purse> }
> = {
  axe: { label: "Axe", hq: 1, step: 3, cost: { gold: 200, timber: 100 } },
  pickaxe: { label: "Pickaxe", hq: 2, step: 3, cost: { gold: 300, timber: 200 } },
  chainsaw: { label: "Chainsaw", hq: 3, step: 4, cost: { gold: 600, stone: 300 } },
  dynamite: { label: "Dynamite", hq: 5, step: 4, cost: { gold: 1000, scrap: 200 } },
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

/** Hours of work for each kind of patch at tier 1. */
const CLEAR_HOURS: Record<ObstacleKind, number> = {
  brush: 0.1,
  thicket: 0.25,
  grove: 0.75,
  rocks: 2,
  jungle: 10,
  boulder: 18,
};

/** How much longer each tier takes: the far side of the island is the work of months. */
const TIER_TIME = [1, 2.5, 6, 12, 20] as const;

export interface Obstacle {
  /** Stable across versions: the crew server stores which ones are cleared by id. */
  id: string;
  kind: ObstacleKind;
  /** 1 to 5: the tool level it needs, rising with distance from the start. */
  tier: number;
  /** Tile column and row of the north-west corner. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The open clearing round the headquarters on a new island, in meters. */
const START_CLEARING = 18;
/** How far out past that clearing the first tier of patches reaches, in meters. */
const NEAR_BASE_REACH = 12;
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
      const tier = d < 30 ? 1 : d < 44 ? 2 : d < 58 ? 3 : d < 72 ? 4 : 5;
      list.push({ id: "", kind, tier, x: t.x, y: t.y, w, h });
      break;
    }
  }
  // Ids by position, so they stay the same as long as the island does.
  for (const o of list) o.id = `${o.x}.${o.y}`;
  obstacleList = list;
  return list;
}

let obstacleIndex: Map<string, Obstacle> | null = null;

/** One obstacle by its id, without searching the whole island. */
export function obstacleById(id: string): Obstacle | undefined {
  obstacleIndex ??= new Map(obstacles().map((o) => [o.id, o]));
  return obstacleIndex.get(id);
}

/** The uncleared obstacle covering a tile, if any. */
export function obstacleAtTile(
  layout: Pick<CrewLayout, "cleared">,
  tile: { x: number; y: number },
): Obstacle | undefined {
  const cleared = new Set(layout.cleared);
  return obstacles().find((o) => !cleared.has(o.id) && overlaps(tile.x, tile.y, 1, 1, o));
}

/** How many buildings and tools can be worked on at once. */
export function builderCount(layout: Pick<CrewLayout, "buildings">): number {
  return Math.min(5, 2 + Math.floor(hqLevel(layout) / 5));
}

/** The work going on at a building, if any. */
export function buildJobOn(layout: Pick<CrewLayout, "builds">, id: string): BuildJob | undefined {
  return layout.builds.find((j) => "building" in j.target && j.target.building === id);
}

/** The work going on at a tool, if any. */
export function toolJob(layout: Pick<CrewLayout, "builds">, tool: Tool): BuildJob | undefined {
  return layout.builds.find((j) => "tool" in j.target && j.target.tool === tool);
}

/** Minutes to bring a tool to each level. */
const TOOL_MINUTES = [2, 10, 60, 480, 1440] as const;

/** Milliseconds of work on a tool's next level. */
export function toolTime(level: number): number {
  return (TOOL_MINUTES[Math.min(level, TOOL_MINUTES.length - 1)] ?? 0) * 60_000;
}

/** How many patches can be worked on at once. */
export function workerCount(layout: Pick<CrewLayout, "buildings">): number {
  return Math.min(4, 1 + Math.floor(hqLevel(layout) / 4));
}

const tierScale = (o: Obstacle) => 1 + 0.7 * (o.tier - 1);

function scaled(purse: Partial<Purse>, factor: number): Partial<Purse> {
  const out: Partial<Purse> = {};
  for (const r of RESOURCES) {
    const v = purse[r];
    if (v) out[r] = Math.round((v * factor) / 5) * 5;
  }
  return out;
}

export function clearCost(o: Obstacle): Partial<Purse> {
  return scaled(OBSTACLE_KINDS[o.kind].cost, tierScale(o));
}

export function clearGives(o: Obstacle): Partial<Purse> {
  return scaled(OBSTACLE_KINDS[o.kind].gives, tierScale(o));
}

/** Round the base, patches take this many minutes, from the nearest to the furthest of them. */
const NEAR_BASE_MINUTES = [1, 5] as const;

/** Minutes to clear a patch just outside the start clearing, more the further in it lies. */
function nearBaseMinutes(o: Obstacle): number {
  const x = GRID_ORIGIN.x + (o.x + o.w / 2) * TILE;
  const y = GRID_ORIGIN.y + (o.y + o.h / 2) * TILE;
  const out = (Math.hypot(x - HOME_START.x, y - HOME_START.y) - START_CLEARING) / NEAR_BASE_REACH;
  const [first, last] = NEAR_BASE_MINUTES;
  return Math.ceil(first + (last - first) * Math.max(0, Math.min(1, out)));
}

/** Milliseconds to clear a patch; a tool better than the patch needs goes quicker. */
export function clearTime(o: Obstacle, toolLevel = o.tier): number {
  const speed = 1 + 0.25 * Math.max(0, toolLevel - o.tier);
  if (o.tier === 1) return Math.round((nearBaseMinutes(o) * 60_000) / speed);
  const hours = (CLEAR_HOURS[o.kind] * (TIER_TIME[o.tier - 1] ?? 1)) / speed;
  return Math.round(hours * 3_600_000);
}

/** Why an obstacle can't be cleared right now, or null if it can. */
export function clearBlocker(layout: CrewLayout, o: Obstacle): string | null {
  const spec = OBSTACLE_KINDS[o.kind];
  const tool = TOOLS[spec.tool];
  if (layout.jobs.some((j) => j.id === o.id)) return "Already being cleared";
  if (layout.tools[spec.tool] < o.tier) return `Needs a level ${o.tier} ${tool.label}`;
  if (layout.jobs.length >= workerCount(layout)) return "All your workers are busy";
  if (!canAfford(layout.resources, clearCost(o))) return "Not enough resources";
  return null;
}

/** The price of a tool's next level. */
export function toolCost(tool: Tool, level: number): Partial<Purse> {
  return scaled(TOOLS[tool].cost, 2.1 ** level);
}

/** The headquarters level a tool's next level needs. */
export function toolHq(tool: Tool, level: number): number {
  return TOOLS[tool].hq + level * TOOLS[tool].step;
}

/** Why a tool can't be upgraded right now, or null if it can. */
export function toolBlocker(layout: CrewLayout, tool: Tool): string | null {
  const level = layout.tools[tool];
  if (toolJob(layout, tool)) return "Being improved";
  if (level >= MAX_TOOL_LEVEL) return "Already at its best";
  if (layout.builds.length >= builderCount(layout)) return "All your builders are busy";
  const hq = toolHq(tool, level);
  if (hqLevel(layout) < hq) return `Needs HQ ${hq}`;
  if (!canAfford(layout.resources, toolCost(tool, level))) return "Not enough resources";
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
    if (r && b.level > 0) cap[r] += storageCapacity(b.level);
  }
  return cap;
}

/** Production per hour of each resource. */
export function production(layout: Pick<CrewLayout, "buildings">): Purse {
  const rate: Purse = { gold: 0, timber: 0, stone: 0, scrap: 0 };
  for (const b of layout.buildings) {
    const r = PRODUCERS[b.type];
    if (r && b.level > 0) rate[r] += productionPerHour(b.level);
  }
  return rate;
}

/** Resources build up for at most this long between visits. */
const MAX_IDLE_MS = 7 * 24 * 3600 * 1000;

/** Finished building work: new buildings open, upgrades take effect, tools improve. */
function finishBuilds(layout: CrewLayout, now: number): CrewLayout {
  const finished = layout.builds.filter((j) => j.doneAt <= now);
  if (finished.length === 0) return layout;
  const levels = new Map<string, number>();
  const tools = { ...layout.tools };
  for (const { target } of finished) {
    if ("tool" in target) tools[target.tool] = Math.min(MAX_TOOL_LEVEL, tools[target.tool] + 1);
    else levels.set(target.building, 1);
  }
  return {
    ...layout,
    tools,
    builds: layout.builds.filter((j) => j.doneAt > now),
    buildings: layout.buildings.map((b) => (levels.has(b.id) ? { ...b, level: b.level + 1 } : b)),
  };
}

/** Brings the stock up to date: producers fill it until it reaches what storage can hold. */
export function settle(current: CrewLayout, now: number): CrewLayout {
  if (now <= current.stamp) return current;
  const layout = finishBuilds(current, now);
  const hours = Math.min(MAX_IDLE_MS, now - layout.stamp) / 3_600_000;
  const rate = production(layout);
  const cap = capacity(layout);
  const resources = { ...layout.resources };
  for (const r of RESOURCES) {
    if (resources[r] < cap[r]) resources[r] = Math.min(cap[r], resources[r] + rate[r] * hours);
  }
  // Finished clearing: the patch is gone and pays out, and loose brush touching it comes away
  // too, so nobody has to tap every tile.
  const finished = layout.jobs.filter((j) => j.doneAt <= now);
  if (finished.length === 0) return { ...layout, resources, stamp: now };
  const cleared = [...layout.cleared];
  const done = new Set(cleared);
  for (const job of finished) {
    const o = obstacleById(job.id);
    if (!o || done.has(o.id)) continue;
    cleared.push(o.id);
    done.add(o.id);
    const gives = clearGives(o);
    for (const r of RESOURCES) resources[r] = Math.min(cap[r], resources[r] + (gives[r] ?? 0));
    for (const b of obstacles()) {
      if (b.kind !== "brush" || done.has(b.id)) continue;
      if (!overlaps(b.x, b.y, b.w, b.h, { x: o.x - 1, y: o.y - 1, w: o.w + 2, h: o.h + 2 }))
        continue;
      cleared.push(b.id);
      done.add(b.id);
    }
  }
  const jobs = layout.jobs.filter((j) => j.doneAt > now);
  return { ...layout, resources, cleared, jobs, stamp: now };
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
  if (layout.builds.length >= builderCount(layout)) return "All your builders are busy";
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
  if (buildJobOn(layout, b.id)) return b.level === 0 ? "Still being built" : "Already upgrading";
  const cap = levelCap(b.type, hqLevel(layout));
  if (b.level >= cap) {
    return b.type === "headquarters" || cap >= levelCap(b.type, MAX_HQ_LEVEL)
      ? "Already at its highest level"
      : "Upgrade the headquarters first";
  }
  if (layout.builds.length >= builderCount(layout)) return "All your builders are busy";
  if (!canAfford(layout.resources, costFor(b.type, b.level + 1))) return "Not enough resources";
  return null;
}

/** The most a single raid can bring home, so a bad message can't fill the island. */
const MOST_LOOT = 200_000;

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
        level: 0,
      };
      if (!fits(layout, building)) return { error: "That doesn't fit there" };
      const job: BuildJob = {
        target: { building: b.id },
        doneAt: now + buildTime(b.type, 1),
      };
      return {
        layout: {
          ...layout,
          resources: spend(layout.resources, costFor(b.type, 1)),
          buildings: [...layout.buildings, building],
          builds: [...layout.builds, job],
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
      return {
        layout: {
          ...layout,
          buildings: layout.buildings.filter((b) => b.id !== op.id),
          builds: layout.builds.filter((j) => j !== buildJobOn(layout, op.id)),
        },
      };
    }
    case "upgrade": {
      const existing = layout.buildings.find((b) => b.id === op.id);
      if (!existing) return { error: "That building is gone" };
      const blocker = upgradeBlocker(layout, existing);
      if (blocker) return { error: blocker };
      const level = existing.level + 1;
      const job: BuildJob = {
        target: { building: op.id },
        doneAt: now + buildTime(existing.type, level),
      };
      return {
        layout: {
          ...layout,
          resources: spend(layout.resources, costFor(existing.type, level)),
          builds: [...layout.builds, job],
        },
      };
    }
    case "clear": {
      const o = obstacleById(op.id);
      if (!o || layout.cleared.includes(o.id)) return { error: "Already cleared" };
      const blocker = clearBlocker(layout, o);
      if (blocker) return { error: blocker };
      const tool = layout.tools[OBSTACLE_KINDS[o.kind].tool];
      return {
        layout: {
          ...layout,
          resources: spend(layout.resources, clearCost(o)),
          jobs: [...layout.jobs, { id: o.id, doneAt: now + clearTime(o, tool) }],
        },
      };
    }
    case "toolUp": {
      if (!(op.tool in TOOLS)) return { error: "Unknown tool" };
      const blocker = toolBlocker(layout, op.tool);
      if (blocker) return { error: blocker };
      const level = layout.tools[op.tool];
      const job: BuildJob = { target: { tool: op.tool }, doneAt: now + toolTime(level) };
      return {
        layout: {
          ...layout,
          resources: spend(layout.resources, toolCost(op.tool, level)),
          builds: [...layout.builds, job],
        },
      };
    }
    case "loot": {
      const cap = capacity(layout);
      const resources = { ...layout.resources };
      for (const r of RESOURCES) {
        const amount = op.purse?.[r];
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) continue;
        resources[r] = Math.min(cap[r], resources[r] + Math.min(amount, MOST_LOOT));
      }
      return { layout: { ...layout, resources } };
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

const START_TOOLS: Record<Tool, number> = { axe: 1, pickaxe: 0, chainsaw: 0, dynamite: 0 };

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
  return {
    cleared: [],
    tools: { ...START_TOOLS },
    jobs: [],
    builds: [],
    buildings: [spot],
    resources: { ...START_RESOURCES },
    stamp: now,
  };
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
    tools?: unknown;
    jobs?: unknown;
    builds?: unknown;
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
    const level = Number.isInteger(b.level) ? Math.max(0, b.level as number) : 1;
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
    // Level 0 stands only while work on it is under way; building one needs a job, added below.
    const building = { ...b, level: Math.min(b.level, Math.max(1, levelCap(b.type, hq))) };
    // Older islands: a building that's off the grass moves to the nearest spot, and the ground
    // under existing buildings counts as cleared.
    // So does one that's come to overlap another: buildings have changed size before, and nobody
    // should lose one to that.
    const { w, h } = footprint(building.type, building.rotated);
    const open = { buildings, cleared: allIds };
    const spot = fits(open, building)
      ? building
      : nearestFit(open, building, { x: building.x, y: building.y }, 24);
    if (!spot) continue;
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
  const rawTools = (data?.tools ?? {}) as Partial<Record<Tool, unknown>>;
  const tools = { ...START_TOOLS };
  for (const t of TOOL_ORDER) {
    const v = rawTools[t];
    if (Number.isInteger(v)) tools[t] = Math.max(0, Math.min(MAX_TOOL_LEVEL, v as number));
  }
  const isCleared = new Set(cleared);
  const jobs = (Array.isArray(data?.jobs) ? (data.jobs as Partial<ClearJob>[]) : [])
    .filter(
      (j): j is ClearJob =>
        typeof j?.id === "string" &&
        known.has(j.id) &&
        !isCleared.has(j.id) &&
        typeof j.doneAt === "number" &&
        Number.isFinite(j.doneAt),
    )
    .slice(0, 4)
    .map((j) => ({ id: j.id, doneAt: j.doneAt }));
  const builds = readBuilds(data?.builds, buildings);
  // A building with no work going on can't still be going up: it's finished.
  const standing = buildings.map((b) =>
    b.level === 0 && !buildJobOn({ builds }, b.id) ? { ...b, level: 1 } : b,
  );
  return { buildings: standing, cleared, tools, jobs, builds, resources, stamp };
}

function readBuilds(value: unknown, buildings: readonly PlacedBuilding[]): BuildJob[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set(buildings.map((b) => b.id));
  const out: BuildJob[] = [];
  const busy = new Set<string>();
  for (const item of value as Partial<BuildJob>[]) {
    const { target, doneAt } = item ?? {};
    if (typeof doneAt !== "number" || !Number.isFinite(doneAt)) continue;
    if (!target || typeof target !== "object") continue;
    const key = "building" in target ? target.building : target.tool;
    if (busy.has(key)) continue;
    const known = "building" in target ? ids.has(target.building) : target.tool in TOOLS;
    if (!known) continue;
    busy.add(key);
    out.push("building" in target ? { target: { building: key }, doneAt } : { target, doneAt });
  }
  return out;
}
