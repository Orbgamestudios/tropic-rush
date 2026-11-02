// The world: one endless sea of islands, the same for every crew, laid out in regions from a seed.
// Each region holds a loose scatter of enemy islands, and the further from home the harder they
// are, with no end to it. Only the home region starts in the clear: every few islands won blows
// the cloud off one more region. Islands a crew has taken stay theirs until
// raiders retake one in the night, which brings it back stronger. No engine imports.

import { BUILDINGS, type BuildingType } from "./buildings";
import { allowedCount, MAX_HQ_LEVEL } from "./economy";
import { type RaidReward, raidReward } from "./heroProgress";
import { createRng } from "./rng";

export type Difficulty = "Easy" | "Fair" | "Hard" | "Deadly";

export interface MapIsland {
  /** Stable forever: "region column,region row:index". */
  id: string;
  name: string;
  /** Position on the map, in map units, and how big it's drawn. */
  x: number;
  y: number;
  size: number;
  /** The region it's in. */
  region: string;
  seed: number;
  /** The enemy base's headquarters level. */
  hq: number;
  /** Reward tier (see raidReward). */
  tier: number;
  difficulty: Difficulty;
  defenses: number;
  reward: RaidReward;
  /** Taken by the crew. */
  taken: boolean;
  /** Retaken by raiders: every building they're allowed, all at full level. */
  retaken: boolean;
}

/** What a crew has done to the map. */
export interface WorldProgress {
  /** Islands the crew holds. */
  taken: string[];
  /** Islands raiders have taken back, and the headquarters level they rebuilt to. */
  retaken: Record<string, number>;
  /** Regions out of the cloud, as "column,row". The home region is always open. */
  opened: string[];
  /** Islands won towards lifting the next cloud. */
  progress: number;
}

export const NEW_WORLD: WorldProgress = { taken: [], retaken: {}, opened: [], progress: 0 };

/** A region's size in map units. Wider than tall, like the screen. */
export const REGION = { w: 112, h: 66 } as const;

const HOME_REGION = "0,0";
/** Islands to win for each bank of cloud that lifts. */
const ISLANDS_PER_CLOUD = 3;
const ISLANDS_PER_REGION = [6, 8] as const;
/** Kept clear round the crew's own island and the gunboat beside it. */
const HOME_CLEAR = 14;
/** How far from home (map units) one more headquarters level is. */
const UNITS_PER_LEVEL = 34;

export function regionKey(column: number, row: number): string {
  return `${column},${row}`;
}

/** Which region a map spot is in. */
export function regionAt(x: number, y: number): { column: number; row: number } {
  return {
    column: Math.floor(x / REGION.w + 0.5),
    row: Math.floor(y / REGION.h + 0.5),
  };
}

function parseRegion(key: string): { column: number; row: number } {
  const [column, row] = key.split(",").map(Number);
  return { column: column ?? 0, row: row ?? 0 };
}

/** An island's drawn radius in map units. */
export function islandRadius(size: number): number {
  return 3 + size * 3;
}

interface Spot {
  x: number;
  y: number;
  size: number;
}

/** Far enough apart that neither the islands nor their plates touch. */
function apart(a: Spot, b: Spot): boolean {
  const ra = islandRadius(a.size);
  const rb = islandRadius(b.size);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < ra + rb + 4) return false;
  return Math.abs(dx) >= 15 || Math.abs(dy) >= 9;
}

/** Mixes a region's position into a seed. */
function regionSeed(column: number, row: number): number {
  return (Math.imul(column, 73856093) ^ Math.imul(row, 19349663) ^ 0x51ab1e) >>> 0;
}

/**
 * Scatters a region's islands the way real ones lie: mostly in a loose chain or two with open
 * water between, some big and many small, and clear of the region's edges so neighboring regions
 * can't collide.
 */
function scatter(rng: () => number, column: number, row: number): Spot[] {
  const left = (column - 0.5) * REGION.w + 8;
  const top = (row - 0.5) * REGION.h + 6;
  const width = REGION.w - 16;
  const height = REGION.h - 12;
  const [fewest, most] = ISLANDS_PER_REGION;
  const count = fewest + Math.floor(rng() * (most - fewest + 1));
  const chains = Array.from({ length: 2 }, () => ({
    x: left + rng() * width,
    y: top + rng() * height,
    lean: (rng() - 0.5) * 1.5,
  }));
  const spots: Spot[] = [];
  for (let tries = 0; spots.length < count && tries < 600; tries++) {
    const size = 0.55 + rng() ** 2 * 1.1;
    const chain = chains[Math.floor(rng() * chains.length)];
    let x = left + rng() * width;
    let y = top + rng() * height;
    if (chain && rng() < 0.6) {
      const along = (rng() + rng() - 1) * 34;
      const across = (rng() + rng() - 1) * 10;
      x = chain.x + Math.cos(chain.lean) * along - Math.sin(chain.lean) * across;
      y = chain.y + Math.sin(chain.lean) * along + Math.cos(chain.lean) * across;
    }
    if (x < left || x > left + width || y < top || y > top + height) continue;
    const spot = { x, y, size };
    if (Math.hypot(x, y) < HOME_CLEAR + islandRadius(size)) continue;
    if (spots.every((s) => apart(s, spot))) spots.push(spot);
  }
  return spots;
}

const NAME_START = [
  "Skull",
  "Rusty",
  "Coconut",
  "Blackwater",
  "Gull",
  "Iron",
  "Smuggler's",
  "Barnacle",
  "Crab",
  "Lonely",
  "Cutlass",
  "Dead Man's",
  "Pelican",
  "Mangrove",
  "Shark",
  "Thunder",
  "Parrot",
  "Sunken",
  "Powder",
  "Coral",
] as const;

const NAME_END = [
  "Rock",
  "Atoll",
  "Key",
  "Cay",
  "Point",
  "Lagoon",
  "Reef",
  "Island",
  "Bay",
  "Shoal",
  "Spit",
  "Hold",
  "Sands",
  "Fort",
] as const;

function islandName(rng: () => number): string {
  const start = NAME_START[Math.floor(rng() * NAME_START.length)];
  const end = NAME_END[Math.floor(rng() * NAME_END.length)];
  return `${start} ${end}`;
}

const DEFENSES: readonly BuildingType[] = (Object.keys(BUILDINGS) as BuildingType[]).filter(
  (t) => BUILDINGS[t].attack,
);

/** The reward tier for a base: rewards step up every few headquarters levels. */
export function islandTier(hq: number): number {
  return 1 + Math.floor(hq / 4);
}

function difficultyOf(hq: number, yourHq: number): Difficulty {
  const gap = hq - yourHq;
  if (gap <= 0) return "Easy";
  if (gap === 1) return "Fair";
  return gap <= 3 ? "Hard" : "Deadly";
}

interface Charted {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  size: number;
  seed: number;
  /** Its headquarters level before anyone has touched it. */
  hq: number;
}

const charted = new Map<string, Charted[]>();

/** Every island in a region, the same on every phone. */
function chartRegion(column: number, row: number): Charted[] {
  const region = regionKey(column, row);
  const made = charted.get(region);
  if (made) return made;
  const rng = createRng(regionSeed(column, row));
  const islands = scatter(rng, column, row).map((spot, i) => ({
    ...spot,
    id: `${region}:${i}`,
    name: islandName(rng),
    region,
    seed: Math.floor(rng() * 2 ** 31),
    // Danger grows with distance, roughly: a little luck keeps it from reading as rings.
    hq: Math.max(1, Math.floor(Math.hypot(spot.x, spot.y * 1.5) / UNITS_PER_LEVEL + rng() * 1.5)),
  }));
  charted.set(region, islands);
  return islands;
}

function dress(island: Charted, world: WorldProgress, yourHq: number): MapIsland {
  const raised = world.retaken[island.id];
  const hq = raised ?? island.hq;
  const tier = islandTier(hq);
  const rated = Math.min(hq, MAX_HQ_LEVEL);
  return {
    ...island,
    hq,
    // A rebuilt base is a new layout, not the old one with its levels raised.
    seed: raised ? island.seed + raised : island.seed,
    tier,
    difficulty: difficultyOf(hq, yourHq),
    defenses: DEFENSES.reduce((sum, t) => sum + allowedCount(t, rated), 0),
    reward: raidReward(true, 100, tier),
    taken: world.taken.includes(island.id),
    retaken: raised !== undefined,
  };
}

/** One island, from its id. */
function chartedIsland(id: string): Charted | undefined {
  const [region = HOME_REGION] = id.split(":");
  const { column, row } = parseRegion(region);
  return chartRegion(column, row).find((i) => i.id === id);
}

export function isOpen(world: WorldProgress, region: string): boolean {
  return region === HOME_REGION || world.opened.includes(region);
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Every open region and the ones beside it, which show as banks of cloud. */
export function chartedRegions(world: WorldProgress): { open: string[]; cloud: string[] } {
  const open = [HOME_REGION, ...world.opened];
  const cloud = new Set<string>();
  for (const key of open) {
    const { column, row } = parseRegion(key);
    for (const [dx, dy] of NEIGHBORS) {
      const next = regionKey(column + dx, row + dy);
      if (!open.includes(next)) cloud.add(next);
    }
  }
  return { open, cloud: [...cloud] };
}

/** Every island in the open regions. */
export function worldIslands(world: WorldProgress, yourHq: number): MapIsland[] {
  return chartedRegions(world).open.flatMap((key) => {
    const { column, row } = parseRegion(key);
    return chartRegion(column, row).map((island) => dress(island, world, yourHq));
  });
}

/** How many more islands to win before the next bank of cloud lifts. */
export function islandsToNextCloud(world: WorldProgress): number {
  return ISLANDS_PER_CLOUD - world.progress;
}

/** The clouded region nearest an island, which is the one its capture opens up. */
function nearestCloud(world: WorldProgress, id: string): string | undefined {
  const island = chartedIsland(id);
  let best: string | undefined;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const key of chartedRegions(world).cloud) {
    const { column, row } = parseRegion(key);
    const gap = Math.hypot(column * REGION.w - (island?.x ?? 0), row * REGION.h - (island?.y ?? 0));
    if (gap < bestGap) {
      best = key;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * The crew wins an island: it's theirs, and every few wins lifts one bank of cloud, next to where
 * they're fighting. Won islands open the way for good: losing one later won't bring the cloud back.
 */
export function takeIsland(world: WorldProgress, id: string): WorldProgress {
  if (world.taken.includes(id)) return world;
  const retaken = { ...world.retaken };
  delete retaken[id];
  const next: WorldProgress = { ...world, taken: [...world.taken, id], retaken };
  if (world.progress + 1 < ISLANDS_PER_CLOUD) return { ...next, progress: world.progress + 1 };
  const cloud = nearestCloud(next, id);
  return { ...next, progress: 0, opened: cloud ? [...world.opened, cloud] : world.opened };
}

/**
 * The night's move: raiders retake none, one or two of the crew's islands. Each comes back with
 * a stronger headquarters, built up to everything that level allows.
 */
export function retakeIslands(
  world: WorldProgress,
  night: number,
  yourHq: number,
): { world: WorldProgress; lost: string[] } {
  const rng = createRng(Math.imul(night, 6151) + 97);
  const roll = rng();
  const count = roll < 0.3 ? 0 : roll < 0.75 ? 1 : 2;
  const taken = [...world.taken];
  const retaken = { ...world.retaken };
  const lost: string[] = [];
  for (let i = 0; i < count && taken.length > 0; i++) {
    const [id] = taken.splice(Math.floor(rng() * taken.length), 1);
    const island = id ? chartedIsland(id) : undefined;
    if (!id || !island) continue;
    const before = world.retaken[id] ?? island.hq;
    retaken[id] = Math.max(before + 1, yourHq) + Math.floor(rng() * 2);
    lost.push(island.name);
  }
  return { world: { ...world, taken, retaken }, lost };
}

/** Reads untrusted saved progress, keeping only what still makes sense. */
export function sanitizeWorld(value: unknown): WorldProgress {
  const v = value as Partial<WorldProgress> | null | undefined;
  const ids = (list: unknown): string[] =>
    Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : [];
  const retaken: Record<string, number> = {};
  const raw = v?.retaken;
  if (raw && typeof raw === "object") {
    for (const [id, hq] of Object.entries(raw)) {
      if (Number.isInteger(hq) && (hq as number) > 0) retaken[id] = hq as number;
    }
  }
  const won = Number.isInteger(v?.progress) ? (v?.progress as number) : 0;
  const progress = Math.max(0, Math.min(ISLANDS_PER_CLOUD - 1, won));
  return { taken: ids(v?.taken), retaken, opened: ids(v?.opened), progress };
}
