// The crew's home island. It's the same island as every raid island (island.ts): one coast, one
// landing beach, one set of hills. All the grass can be built on, right down to the top of the
// beach. A new island is overgrown: only a clearing round the headquarters and the trail from
// the beach are open, and the rest is thickets, palm groves, rocks, dense jungle and boulders that
// the crew clears to make room. Clearing is meant to take months: each patch needs a tool of a
// high enough level, work takes real time, and only so many workers can be busy at once.
// Buildings snap to 2 m tiles.
// Plain rules with no engine imports, shared by the phone and the crew server, which checks
// every change with the same functions before accepting it.

import { BUILDINGS, type BuildingType } from "./buildings";
import { CRYSTAL_KINDS, CRYSTAL_SWAP, type CrystalKind } from "./crystals";
import {
  allowedCount,
  buildTime,
  canAfford,
  costFor,
  hqCapacity,
  levelCap,
  MAX_HQ_LEVEL,
  PRODUCERS,
  PROGRESSION,
  type Purse,
  productionPerHour,
  RESOURCES,
  START_RESOURCES,
  STORAGES,
  spend,
  storageCapacity,
} from "./economy";
import {
  ABILITY_ORDER,
  type Ability,
  type Arsenal,
  MAX_WEAPON_LEVEL,
  STARTING_WEAPONS,
  WEAPON_LEVEL_HQ,
  weaponUpGold,
} from "./gunboat";
import { HERO_KINDS, type HeroKind } from "./heroes";
import { heroTree, lockedBy, noUpgrades, trimUpgrades } from "./heroTrees";
import { isOnGrass, landingPoints, trailPoints } from "./island";
import { createRng } from "./rng";
import { BLUEPRINT_TYPES, type Blueprint, isWeapon, needsBlueprint } from "./spoils";
import {
  newStatues,
  readStatues,
  STATUE_CRYSTALS,
  STATUE_MS,
  STATUE_STONE,
  type Statues,
  statueBefore,
  statueBuffs,
  statueSpots,
} from "./statues";
import type { Vec2 } from "./vec";

/** One tile is 2 m square. */
export const TILE = 2;
/** World position (meters; x east, y south) of tile (0, 0)'s north-west corner. */
export const GRID_ORIGIN: Vec2 = { x: -80, y: -64 };
/** Where a new crew's headquarters goes, and the middle of its first clearing. */
export const HOME_START: Vec2 = { x: -12, y: 16 };

/** How far the grid reaches from the middle of the island, in meters. */
const GRID_REACH = { x: 104, y: 88 };

/** Every tile whose four corners are good ground, as "column,row", on the same grid as home. */
export function gridTiles(
  good: (x: number, y: number) => boolean,
  reachX: number = GRID_REACH.x,
  reachY: number = reachX,
): Set<string> {
  const set = new Set<string>();
  const x0 = Math.floor((-reachX - GRID_ORIGIN.x) / TILE);
  const x1 = Math.ceil((reachX - GRID_ORIGIN.x) / TILE);
  const y0 = Math.floor((-reachY - GRID_ORIGIN.y) / TILE);
  const y1 = Math.ceil((reachY - GRID_ORIGIN.y) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const x = GRID_ORIGIN.x + tx * TILE;
      const y = GRID_ORIGIN.y + ty * TILE;
      if (good(x, y) && good(x + TILE, y) && good(x, y + TILE) && good(x + TILE, y + TILE)) {
        set.add(`${tx},${ty}`);
      }
    }
  }
  return set;
}

let tileSet: Set<string> | null = null;
let tileList: { x: number; y: number }[] = [];

function buildTiles(): Set<string> {
  const set = gridTiles((x, y) => isOnGrass(x, y), GRID_REACH.x, GRID_REACH.y);
  tileList = [...set].map((key) => {
    const [x = 0, y = 0] = key.split(",").map(Number);
    return { x, y };
  });
  return set;
}

/** True if a tile is on the island's grass. */
function isGrassTile(tx: number, ty: number): boolean {
  tileSet ??= buildTiles();
  return tileSet.has(`${tx},${ty}`);
}

/** The great boulders on the far side of the island, at the back right of the view. Nothing moves them. */
export const HOME_CLIFFS: readonly { x: number; y: number; r: number }[] = [
  { x: 58, y: -29, r: 4.5 },
  { x: 64, y: -22, r: 6 },
  { x: 67, y: -12, r: 5 },
  { x: 62, y: -5, r: 7 },
  { x: 67, y: 4, r: 5.5 },
  { x: 60, y: 11, r: 6.5 },
  { x: 54, y: 19, r: 5 },
  { x: 54, y: -14, r: 4 },
];

/** True if a spot on the crew's island lies under the great boulders. */
export function onHomeCliff(x: number, y: number): boolean {
  return HOME_CLIFFS.some((c) => Math.hypot(x - c.x, y - c.y) < c.r + 0.6);
}

function isCliffTile(tx: number, ty: number): boolean {
  return onHomeCliff(GRID_ORIGIN.x + (tx + 0.5) * TILE, GRID_ORIGIN.y + (ty + 0.5) * TILE);
}

/** True if a tile can be built on: it's on the island's grass, clear of the great boulders. */
export function isBuildableTile(tx: number, ty: number): boolean {
  return isGrassTile(tx, ty) && !isCliffTile(tx, ty);
}

/** Every buildable tile, row by row from the north. */
export function buildableTiles(): readonly { x: number; y: number }[] {
  tileSet ??= buildTiles();
  return tileList.filter((t) => !isCliffTile(t.x, t.y));
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
  laboratory: { w: 3, h: 3 },
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
  /** Blueprints won on raids. */
  blueprints: Blueprint[];
  /** Blueprints the laboratory has turned into something the crew can use. */
  researched: Blueprint[];
  /** Gunboat weapons upgraded past their first level. */
  weaponLevels: Arsenal;
  /** Every hero's upgrades, which the whole crew shares: one person buys, everyone has it. */
  upgrades: Record<HeroKind, string[]>;
  /** The island's ancient statues. */
  statues: Statues;
  /** Decides which patches hide the statues, so every crew's island hides them differently. */
  relicSeed: number;
  /** The last night's raid taken off the books, so several phones can't count it twice. */
  lastNight: number;
  /** Rival crews' raids on this island, newest first. */
  raidLog: RivalRaid[];
  /** Which of the island's one-off changes have been made to it; see LAYOUT_VERSION. */
  version: number;
  /** Gold given back for hero upgrades, paid into the stock as there's room for it. */
  owed: number;
}

/**
 * Bumped for each change an old island needs made to it, once. 1: gun turrets went from 10
 * levels to 30, so each old level moved up to where it now sits, and the hero trees were rebuilt,
 * so every upgrade from the old ones was given back.
 */
export const LAYOUT_VERSION = 1;

/** A rival crew's raid on this island, for the crew to read about later. */
export interface RivalRaid {
  by: string;
  won: boolean;
  destroyedPercent: number;
  /** What they carried off, or on a failed attack what the crew got for holding. */
  stolen: Partial<Purse>;
  reward: number;
  at: number;
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
  | { kind: "loot"; purse: Partial<Purse> }
  /** A blueprint won on a raid, ready for the laboratory. */
  | { kind: "blueprint"; type: Blueprint }
  /** The laboratory works a blueprint up into the real thing. */
  | { kind: "research"; type: Blueprint }
  /** The laboratory takes a gunboat weapon up a level. */
  | { kind: "weaponUp"; weapon: Ability }
  /** A hero upgrade for the whole crew. `pay` takes its gold from the island; without it, it's one
   * a crewmate brought along from before they joined. */
  | { kind: "heroUpgrade"; hero: HeroKind; id: string; pay?: boolean }
  /** Crystals given to a statue by whoever's holding them. */
  | { kind: "offer"; statue: CrystalKind; crystals: number }
  /** Starts a statue's restoration, once it has its crystals. */
  | { kind: "restore"; statue: CrystalKind }
  /** The island's gold for a crystal trade; the crystals are whoever's trading's own. */
  | { kind: "crystalSwap" }
  /** Last night's raid: what the raiders took, and the gold for holding them off. */
  | { kind: "night"; night: number; stolen: Partial<Purse>; reward: number };

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
 * buildings or a statue.
 */
export function fits(
  layout: Pick<CrewLayout, "buildings" | "cleared"> & Partial<Pick<CrewLayout, "relicSeed">>,
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
  if (layout.relicSeed !== undefined) {
    for (const { patch } of statueSites(layout.relicSeed)) {
      if (overlaps(candidate.x, candidate.y, w, h, patch)) return false;
    }
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
    for (let ty = y; ty < y + h; ty++)
      for (let tx = x; tx < x + w; tx++) {
        if (!isGrassTile(tx, ty)) return false;
        if (taken.has(`${tx},${ty}`) || open({ x: tx, y: ty })) return false;
      }
    return true;
  };
  // Row by row, so the patches pack tightly and every tile outside the clearing is covered.
  tileSet ??= buildTiles();
  for (const t of tileList) {
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
  // Nothing grows out of the great boulders, though the forest comes right up to them.
  const standing = list.filter(
    (o) =>
      !onHomeCliff(GRID_ORIGIN.x + (o.x + o.w / 2) * TILE, GRID_ORIGIN.y + (o.y + o.h / 2) * TILE),
  );
  obstacleList = standing;
  return standing;
}

let obstacleIndex: Map<string, Obstacle> | null = null;

/** One obstacle by its id, without searching the whole island. */
export function obstacleById(id: string): Obstacle | undefined {
  obstacleIndex ??= new Map(obstacles().map((o) => [o.id, o]));
  return obstacleIndex.get(id);
}

interface StatueSite {
  statue: CrystalKind;
  patch: Obstacle;
}

const siteCache = new Map<number, StatueSite[]>();

/** Which patch of overgrowth hides each statue on an island. */
export function statueSites(relicSeed: number): readonly StatueSite[] {
  let sites = siteCache.get(relicSeed);
  if (!sites) {
    const spots = statueSpots(relicSeed, obstacles());
    sites = CRYSTAL_KINDS.flatMap((statue) => {
      const patch = obstacleById(spots[statue] ?? "");
      return patch ? [{ statue, patch }] : [];
    });
    siteCache.set(relicSeed, sites);
  }
  return sites;
}

/** The statue on a tile, if there is one. */
export function statueAtTile(
  layout: Pick<CrewLayout, "relicSeed">,
  tile: { x: number; y: number },
): CrystalKind | undefined {
  return statueSites(layout.relicSeed).find(({ patch }) => overlaps(tile.x, tile.y, 1, 1, patch))
    ?.statue;
}

/** Why a statue can't start being restored, or null if it can. */
export function restoreBlocker(
  layout: Pick<CrewLayout, "statues" | "resources">,
  kind: CrystalKind,
): string | null {
  const s = layout.statues[kind];
  if (!s.found) return "Not found yet";
  if (s.restored) return "Already restored";
  if (s.doneAt !== null) return "Being restored";
  if (s.crystals < STATUE_CRYSTALS) return `Needs ${STATUE_CRYSTALS} crystals`;
  if (layout.resources.stone < STATUE_STONE) return "Not enough stone";
  return null;
}

let tileOwners: Map<string, Obstacle> | null = null;

/** The obstacle growing on a tile, cleared or not. */
function tileOwner(x: number, y: number): Obstacle | undefined {
  if (!tileOwners) {
    tileOwners = new Map();
    for (const o of obstacles()) {
      for (let ty = o.y; ty < o.y + o.h; ty++) {
        for (let tx = o.x; tx < o.x + o.w; tx++) tileOwners.set(`${tx},${ty}`, o);
      }
    }
  }
  return tileOwners.get(`${x},${y}`);
}

/**
 * True if a patch touches open ground: the first clearing, the trail, or something already cleared.
 * Clearing spreads out from there, so nothing further in can be got at first. The shore doesn't
 * count, or a crew could work its way round the outside.
 */
export function touchesOpenGround(layout: Pick<CrewLayout, "cleared">, o: Obstacle): boolean {
  const cleared = new Set(layout.cleared);
  const open = (x: number, y: number) => {
    if (!isGrassTile(x, y)) return false;
    const owner = tileOwner(x, y);
    return !owner || cleared.has(owner.id);
  };
  for (let i = 0; i < o.w; i++) if (open(o.x + i, o.y - 1) || open(o.x + i, o.y + o.h)) return true;
  for (let i = 0; i < o.h; i++) if (open(o.x - 1, o.y + i) || open(o.x + o.w, o.y + i)) return true;
  return false;
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
  if (!touchesOpenGround(layout, o)) return "Clear next to it first";
  if (layout.tools[spec.tool] < o.tier) return `Needs a level ${o.tier} ${tool.label}`;
  // The statues come to light in their order: a later one stays buried till the one before is found.
  const site = statueSites(layout.relicSeed).find((s) => s.patch.id === o.id);
  const before = site ? statueBefore(site.statue) : null;
  if (before && !layout.statues[before].found) return "Old carved stones won't budge yet";
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
export function production(
  layout: Pick<CrewLayout, "buildings"> & Partial<Pick<CrewLayout, "statues">>,
): Purse {
  const rate: Purse = { gold: 0, timber: 0, stone: 0, scrap: 0 };
  const boost = statueBuffs(layout.statues).production;
  for (const b of layout.buildings) {
    const r = PRODUCERS[b.type];
    if (r && b.level > 0) rate[r] += productionPerHour(b.level) * boost;
  }
  return rate;
}

/** Resources build up for at most this long between visits. */
const MAX_IDLE_MS = 7 * 24 * 3600 * 1000;

/** Statues whose two days are up are whole again. */
function finishStatues(layout: CrewLayout, now: number): CrewLayout {
  const due = CRYSTAL_KINDS.filter((k) => {
    const { doneAt, restored } = layout.statues[k];
    return !restored && doneAt !== null && doneAt <= now;
  });
  if (due.length === 0) return layout;
  const statues = { ...layout.statues };
  for (const k of due) statues[k] = { ...statues[k], restored: true };
  return { ...layout, statues };
}

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
  const layout = finishStatues(finishBuilds(current, now), now);
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
  if (finished.length === 0) {
    return { ...layout, ...payOwed(resources, layout.owed, cap), stamp: now };
  }
  const cleared = [...layout.cleared];
  const done = new Set(cleared);
  let { statues } = layout;
  for (const job of finished) {
    const o = obstacleById(job.id);
    if (!o || done.has(o.id)) continue;
    cleared.push(o.id);
    done.add(o.id);
    const site = statueSites(layout.relicSeed).find((s) => s.patch.id === o.id);
    if (site) statues = { ...statues, [site.statue]: { ...statues[site.statue], found: true } };
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
  return { ...layout, ...payOwed(resources, layout.owed, cap), cleared, jobs, statues, stamp: now };
}

/** Why a building can't be built right now, or null if it can (ignoring where it goes). */
export function buildBlocker(layout: CrewLayout, type: BuildingType): string | null {
  const hq = hqLevel(layout);
  const allowed = allowedCount(type, hq);
  const have = layout.buildings.filter((b) => b.type === type).length;
  if (needsBlueprint(type) && !layout.researched.includes(type)) {
    return layout.blueprints.includes(type)
      ? "Research it at the laboratory"
      : "Find its blueprint on a raid";
  }
  if (allowed === 0) return `Needs headquarters level ${firstHqAllowing(type)}`;
  if (have >= allowed) {
    const next = firstHqAllowing(type, have + 1);
    return next ? `Upgrade headquarters to ${next} for another` : "You have the most allowed";
  }
  if (layout.builds.length >= builderCount(layout)) return "All your builders are busy";
  if (!canAfford(layout.resources, costFor(type, 1))) return "Not enough resources";
  return null;
}

/** Gold to work a blueprint up into the real thing, rising through the gunboat's weapons. */
const RESEARCH_GOLD: Partial<Record<Blueprint, number>> = {
  mortar: 200,
  landmine: 150,
  watchtower: 300,
  harpoon: 400,
  flamethrower: 500,
  shock: 200,
  barrage: 350,
  smoke: 500,
};

export function researchCost(type: Blueprint): Partial<Purse> {
  return { gold: RESEARCH_GOLD[type] ?? 0 };
}

/** Why a blueprint can't be researched right now, or null if it can. */
export function researchBlocker(
  layout: Pick<CrewLayout, "buildings" | "blueprints" | "researched" | "resources">,
  type: Blueprint,
): string | null {
  if (layout.researched.includes(type)) return "Already researched";
  if (!layout.blueprints.includes(type)) return "Find its blueprint on a raid";
  if (!layout.buildings.some((b) => b.type === "laboratory" && b.level > 0)) {
    return "Build a laboratory";
  }
  if (!canAfford(layout.resources, researchCost(type))) return "Not enough gold";
  return null;
}

/** The gunboat weapons a crew can use, what it starts with and what it's researched, by level. */
export function gunboatWeapons(layout: Pick<CrewLayout, "researched" | "weaponLevels">): Arsenal {
  const arsenal: Arsenal = {};
  for (const a of ABILITY_ORDER) {
    if (STARTING_WEAPONS.includes(a) || layout.researched.includes(a)) {
      arsenal[a] = layout.weaponLevels[a] ?? 1;
    }
  }
  return arsenal;
}

/** Why a gunboat weapon can't go up a level right now, or null if it can. */
export function weaponUpBlocker(
  layout: Pick<CrewLayout, "buildings" | "researched" | "resources" | "weaponLevels">,
  weapon: Ability,
): string | null {
  const level = gunboatWeapons(layout)[weapon];
  if (!level) return "Research it first";
  if (level >= MAX_WEAPON_LEVEL) return "Highest level";
  if (!layout.buildings.some((b) => b.type === "laboratory" && b.level > 0)) {
    return "Build a laboratory";
  }
  const needs = WEAPON_LEVEL_HQ[level] ?? 1;
  if (hqLevel(layout) < needs) return `Needs headquarters ${needs}`;
  if (!canAfford(layout.resources, { gold: weaponUpGold(level) })) return "Not enough gold";
  return null;
}

/** The lowest headquarters level that allows `count` of a building, or null if none does. */
export function firstHqAllowing(type: BuildingType, count = 1): number | null {
  for (let hq = 1; hq <= MAX_HQ_LEVEL; hq++) if (allowedCount(type, hq) >= count) return hq;
  return null;
}

/**
 * What the headquarters wants standing before it reaches a level: from level `from`, a building
 * `behind` levels below the one it's going to. Nothing here needs a blueprint, and `behind` is
 * never less than the level the building unlocks at, so a crew can always get there.
 */
const HQ_NEEDS: readonly { type: BuildingType; from: number; behind: number }[] = [
  { type: "goldMine", from: 2, behind: 2 },
  { type: "lumberCamp", from: 2, behind: 2 },
  { type: "quarry", from: 2, behind: 2 },
  { type: "gunTurret", from: 2, behind: 2 },
  { type: "scrapYard", from: 3, behind: 3 },
  { type: "goldVault", from: 6, behind: 5 },
  { type: "timberShed", from: 7, behind: 5 },
  { type: "stoneYard", from: 8, behind: 5 },
];
/** Hero upgrades the crew needs for each headquarters level past the second. */
const HERO_UPGRADES_PER_HQ = 2;

export interface HqNeed {
  /** e.g. "Gold Mine level 3". */
  text: string;
  have: number;
  need: number;
}

/** Everything a headquarters level asks for, met or not. */
export function hqNeeds(
  layout: Pick<CrewLayout, "buildings" | "upgrades">,
  level: number,
): HqNeed[] {
  const needs = HQ_NEEDS.filter((n) => level >= n.from).map(({ type, behind }) => {
    // A building with more, smaller levels is asked for whatever it could reach back then.
    const need = PROGRESSION[type].stretch
      ? Math.max(1, levelCap(type, level - behind))
      : Math.max(1, Math.min(PROGRESSION[type].maxLevel, level - behind));
    const levels = layout.buildings.filter((b) => b.type === type).map((b) => b.level);
    return { text: `${BUILDINGS[type].label} level ${need}`, have: Math.max(0, ...levels), need };
  });
  const upgrades = (level - 2) * HERO_UPGRADES_PER_HQ;
  if (upgrades > 0) {
    const have = Object.values(layout.upgrades).reduce((sum, owned) => sum + owned.length, 0);
    needs.push({ text: `${upgrades} hero upgrades`, have, need: upgrades });
  }
  return needs;
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
  if (b.type === "headquarters") {
    const short = hqNeeds(layout, b.level + 1).find((n) => n.have < n.need);
    if (short) return `Needs ${short.text}`;
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
    case "blueprint": {
      if (!BLUEPRINT_TYPES.includes(op.type)) return { error: "Unknown blueprint" };
      if (layout.blueprints.includes(op.type)) return { layout };
      return { layout: { ...layout, blueprints: [...layout.blueprints, op.type] } };
    }
    case "weaponUp": {
      const blocker = weaponUpBlocker(layout, op.weapon);
      if (blocker) return { error: blocker };
      const level = gunboatWeapons(layout)[op.weapon] ?? 1;
      return {
        layout: {
          ...layout,
          resources: spend(layout.resources, { gold: weaponUpGold(level) }),
          weaponLevels: { ...layout.weaponLevels, [op.weapon]: level + 1 },
        },
      };
    }
    case "research": {
      if (!BLUEPRINT_TYPES.includes(op.type)) return { error: "Unknown blueprint" };
      const blocker = researchBlocker(layout, op.type);
      if (blocker) return { error: blocker };
      return {
        layout: {
          ...layout,
          resources: spend(layout.resources, researchCost(op.type)),
          researched: [...layout.researched, op.type],
        },
      };
    }
    case "heroUpgrade": {
      const upgrade = heroTree(op.hero).find((u) => u.id === op.id);
      if (!upgrade) return { error: "Unknown upgrade" };
      const owned = layout.upgrades[op.hero];
      if (owned.includes(op.id)) return { layout };
      if (lockedBy(op.hero, upgrade, owned)) return { error: "Buy what comes before it first" };
      if (upgrade.hq > hqLevel(layout)) return { error: `Needs headquarters ${upgrade.hq}` };
      const upgrades = { ...layout.upgrades, [op.hero]: [...owned, op.id] };
      if (!op.pay) return { layout: { ...layout, upgrades } };
      if (layout.resources.gold < upgrade.gold) return { error: "Not enough gold" };
      const resources = { ...layout.resources, gold: layout.resources.gold - upgrade.gold };
      return { layout: { ...layout, upgrades, resources } };
    }
    case "offer": {
      if (!CRYSTAL_KINDS.includes(op.statue)) return { error: "Unknown statue" };
      const statue = layout.statues[op.statue];
      if (!statue.found) return { error: "Not found yet" };
      if (statue.restored || statue.doneAt !== null) return { error: "Doesn't need any more" };
      if (!Number.isInteger(op.crystals) || op.crystals <= 0) return { error: "Nothing to give" };
      const crystals = Math.min(STATUE_CRYSTALS, statue.crystals + op.crystals);
      const statues = { ...layout.statues, [op.statue]: { ...statue, crystals } };
      return { layout: { ...layout, statues } };
    }
    case "restore": {
      if (!CRYSTAL_KINDS.includes(op.statue)) return { error: "Unknown statue" };
      const blocker = restoreBlocker(layout, op.statue);
      if (blocker) return { error: blocker };
      const statue = { ...layout.statues[op.statue], doneAt: now + STATUE_MS };
      return {
        layout: {
          ...layout,
          resources: spend(layout.resources, { stone: STATUE_STONE }),
          statues: { ...layout.statues, [op.statue]: statue },
        },
      };
    }
    case "crystalSwap": {
      if (layout.resources.gold < CRYSTAL_SWAP.gold) return { error: "Not enough gold" };
      return {
        layout: { ...layout, resources: spend(layout.resources, { gold: CRYSTAL_SWAP.gold }) },
      };
    }
    case "night": {
      // Every phone in the crew plays the same night: the first to report it is the one that counts.
      if (!Number.isInteger(op.night) || op.night <= layout.lastNight) {
        return { error: "Already counted" };
      }
      const cap = capacity(layout);
      const resources = { ...layout.resources };
      for (const r of RESOURCES) {
        const taken = op.stolen?.[r];
        if (typeof taken !== "number" || !Number.isFinite(taken) || taken <= 0) continue;
        resources[r] = Math.max(0, resources[r] - taken);
      }
      const reward = Number.isFinite(op.reward) ? Math.max(0, Math.min(op.reward, MOST_LOOT)) : 0;
      resources.gold = Math.min(cap.gold, resources.gold + reward);
      return { layout: { ...layout, resources, lastNight: op.night } };
    }
  }
  return { error: "Unknown change" };
}

/** Holds on to this many rival raids for the crew to read. */
const RAID_LOG = 8;
/** A rival can carry off this share of each resource at most. */
const MOST_STOLEN = 0.1;
/** Holding off a rival crew pays this much gold. */
const REPELLED_GOLD = 60;
/** An island that's just been plundered can't be robbed again for this long. */
const PLUNDER_SHIELD_MS = 12 * 3600 * 1000;

/**
 * A rival crew's raid on this island, as told to the crew server. It never touches a building: all
 * it can do is carry off a little of the stock, or pay the crew for holding out. Runs on the server.
 */
export function applyRivalRaid(
  current: CrewLayout,
  raid: { by: string; won: boolean; destroyedPercent: number; loot: Partial<Purse> },
  now: number,
): CrewLayout {
  const layout = settle(current, now);
  const resources = { ...layout.resources };
  const stolen: Partial<Purse> = {};
  let reward = 0;
  const shielded = layout.raidLog.some(
    (r) => r.won && Object.keys(r.stolen).length > 0 && now - r.at < PLUNDER_SHIELD_MS,
  );
  if (raid.won && !shielded) {
    for (const r of RESOURCES) {
      const wanted = raid.loot[r];
      if (typeof wanted !== "number" || !Number.isFinite(wanted) || wanted <= 0) continue;
      const taken = Math.floor(Math.min(wanted, resources[r] * MOST_STOLEN));
      if (taken <= 0) continue;
      resources[r] -= taken;
      stolen[r] = taken;
    }
  } else if (!raid.won) {
    reward = REPELLED_GOLD * hqLevel(layout);
    resources.gold = Math.min(capacity(layout).gold, resources.gold + reward);
  }
  const entry: RivalRaid = {
    by: raid.by,
    won: raid.won,
    destroyedPercent: Math.max(0, Math.min(100, Math.round(raid.destroyedPercent))),
    stolen,
    reward,
    at: now,
  };
  return { ...layout, resources, raidLog: [entry, ...layout.raidLog].slice(0, RAID_LOG) };
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
    blueprints: [],
    researched: [],
    weaponLevels: {},
    upgrades: noUpgrades(),
    statues: newStatues(),
    relicSeed: Math.floor(now / 1000) % 2 ** 31,
    lastNight: 0,
    raidLog: [],
    version: LAYOUT_VERSION,
    owed: 0,
  };
}

/** Islands from before the statues all hide them the same way: nothing was ever found on them. */
const OLD_RELIC_SEED = 0x5eed;

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
 * The heroes' upgrades from untrusted data, kept to what the headquarters allows, and the gold
 * the rest cost, to give back: upgrades from the old trees, and any above the headquarters' cap.
 */
function readUpgrades(value: Partial<Record<HeroKind, unknown>> | undefined, hq: number) {
  const upgrades = noUpgrades();
  let refund = 0;
  for (const kind of HERO_KINDS) {
    const { owned, refund: back } = trimUpgrades(kind, value?.[kind], hq);
    upgrades[kind] = owned;
    refund += back.gold;
  }
  return { upgrades, refund };
}

/** Pays what's owed into the stock, as far as there's room for it. */
function payOwed(resources: Purse, owed: number, cap: Purse): { resources: Purse; owed: number } {
  const paid = Math.max(0, Math.min(owed, cap.gold - resources.gold));
  return { resources: { ...resources, gold: resources.gold + paid }, owed: owed - paid };
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
    blueprints?: unknown;
    researched?: unknown;
    weaponLevels?: Partial<Record<Ability, unknown>>;
    upgrades?: Partial<Record<HeroKind, unknown>>;
    statues?: unknown;
    relicSeed?: unknown;
    lastNight?: unknown;
    raidLog?: unknown;
    version?: unknown;
    owed?: unknown;
  } | null;
  const raw = data?.buildings;
  if (!Array.isArray(raw)) return starterLayout(now);
  const version = Number.isInteger(data?.version) ? (data?.version as number) : 0;
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
    const saved = Number.isInteger(b.level) ? Math.max(0, b.level as number) : 1;
    // A turret from when they had 10 levels goes to where that level sits among 30.
    const level = version < 1 && b.type === "gunTurret" && saved > 0 ? 1 + (saved - 1) * 3 : saved;
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
  // A crew that already has a defense knows how to build another.
  const rawPrints = Array.isArray(data?.blueprints) ? data.blueprints : [];
  const blueprints = BLUEPRINT_TYPES.filter(
    (t) => rawPrints.includes(t) || standing.some((b) => b.type === t),
  );
  // Whatever a crew knew before there was a laboratory, it still knows.
  const rawResearch = Array.isArray(data?.researched) ? data.researched : rawPrints;
  const researched = BLUEPRINT_TYPES.filter(
    (t) => rawResearch.includes(t) || (!isWeapon(t) && standing.some((b) => b.type === t)),
  );
  const weaponLevels: Arsenal = {};
  for (const a of ABILITY_ORDER) {
    const v = data?.weaponLevels?.[a];
    if (Number.isInteger(v) && (v as number) > 1) {
      weaponLevels[a] = Math.min(MAX_WEAPON_LEVEL, v as number);
    }
  }
  const relicSeed = Number.isInteger(data?.relicSeed)
    ? (data?.relicSeed as number)
    : OLD_RELIC_SEED;
  const lastNight = Number.isInteger(data?.lastNight) ? (data?.lastNight as number) : 0;
  const heroes = readUpgrades(data?.upgrades, hq);
  const saved = typeof data?.owed === "number" && Number.isFinite(data.owed) ? data.owed : 0;
  const paying = payOwed(resources, Math.max(0, saved) + heroes.refund, cap);
  return {
    buildings: standing,
    cleared,
    tools,
    jobs,
    builds,
    resources: paying.resources,
    stamp,
    blueprints,
    researched,
    weaponLevels,
    upgrades: heroes.upgrades,
    statues: readStatues(data?.statues),
    relicSeed,
    lastNight,
    raidLog: readRaidLog(data?.raidLog),
    version: LAYOUT_VERSION,
    owed: paying.owed,
  };
}

function readRaidLog(value: unknown): RivalRaid[] {
  if (!Array.isArray(value)) return [];
  return (value as Partial<RivalRaid>[])
    .filter((r) => typeof r?.by === "string" && typeof r.at === "number")
    .slice(0, RAID_LOG)
    .map((r) => ({
      by: String(r.by).slice(0, 32),
      won: r.won === true,
      destroyedPercent: Number(r.destroyedPercent) || 0,
      stolen: r.stolen && typeof r.stolen === "object" ? r.stolen : {},
      reward: Number(r.reward) || 0,
      at: r.at as number,
    }));
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
