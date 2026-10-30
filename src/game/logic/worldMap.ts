// The world map: the islands near the crew's own, the same for a whole day and then fresh ones
// the next. Their difficulty follows the crew's headquarters: a few easier than you, a few much
// harder. No engine imports.

import { BUILDINGS, type BuildingType } from "./buildings";
import { allowedCount } from "./economy";
import { type RaidReward, raidReward } from "./heroProgress";
import { createRng } from "./rng";

export type Difficulty = "Easy" | "Fair" | "Hard" | "Deadly";

export interface MapIsland {
  id: number;
  name: string;
  /** Position on the map, in map units, and how big it's drawn. */
  x: number;
  y: number;
  size: number;
  seed: number;
  /** The enemy base's headquarters level. */
  hq: number;
  /** Reward tier (see raidReward). */
  tier: number;
  difficulty: Difficulty;
  defenses: number;
  reward: RaidReward;
}

/** How far above the crew's HQ each island is; the nearest ones get the lowest of these. */
const OFFSETS = [-1, 0, 0, 1, 1, 2, 2, 3, 4, 5] as const;

/** The stretch of sea islands fall in, in map units (the home island is at 0, 0). */
const SEA = { west: -56, east: 56, north: -25, south: 29 } as const;

/** Kept clear round the crew's own island and the gunboat beside it. */
const HOME_CLEAR = 14;

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

/**
 * Scatters the islands the way real ones lie: mostly in loose chains and clumps round a few
 * shoals, with open water between, some big and many small. Nothing sits at a regular angle or
 * distance from home.
 */
function scatter(rng: () => number): Spot[] {
  const clumps = Array.from({ length: 4 }, () => ({
    x: SEA.west + rng() * (SEA.east - SEA.west),
    y: SEA.north + rng() * (SEA.south - SEA.north),
    // Each clump leans its own way, so they read as chains and not as round blobs, and mostly
    // along the wide map so they don't stack up into columns.
    lean: (rng() - 0.5) * 1.5,
  }));
  const spots: Spot[] = [];
  for (let tries = 0; spots.length < OFFSETS.length; tries++) {
    const size = 0.55 + rng() ** 2 * 1.1;
    const clump = clumps[Math.floor(rng() * clumps.length)];
    let x = SEA.west + rng() * (SEA.east - SEA.west);
    let y = SEA.north + rng() * (SEA.south - SEA.north);
    // Most land near a shoal; once the shoals are full, the open sea takes the rest.
    if (clump && tries < 300 && rng() < 0.65) {
      const along = (rng() + rng() - 1) * 36;
      const across = (rng() + rng() - 1) * 11;
      x = clump.x + Math.cos(clump.lean) * along - Math.sin(clump.lean) * across;
      y = clump.y + Math.sin(clump.lean) * along + Math.cos(clump.lean) * across;
    }
    if (x < SEA.west || x > SEA.east || y < SEA.north || y > SEA.south) continue;
    const spot = { x, y, size };
    if (Math.hypot(x, y) < HOME_CLEAR + islandRadius(size)) continue;
    if (spots.every((s) => apart(s, spot))) spots.push(spot);
  }
  return spots;
}

const NAMES = [
  "Skull Rock",
  "Rusty Atoll",
  "Coconut Key",
  "Blackwater Cay",
  "Gull Point",
  "Iron Lagoon",
  "Smuggler's Reef",
  "Fort Barnacle",
  "Crab Island",
  "Lonely Palm",
  "Cutlass Bay",
  "Dead Man's Shoal",
  "Pelican Spit",
  "Mangrove Hold",
] as const;

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

/** The islands in reach today of a crew with this headquarters level. */
export function worldIslands(yourHq: number, day: number): MapIsland[] {
  const names = [...NAMES];
  const rng = createRng(day * 7919 + 13);
  // Danger grows with distance, roughly: a little luck keeps it from reading as rings.
  const spots = scatter(rng)
    .map((spot) => ({ spot, reach: Math.hypot(spot.x, spot.y) * (0.75 + rng() * 0.5) }))
    .sort((a, b) => a.reach - b.reach);
  return spots.map(({ spot }, id) => {
    const hq = Math.max(1, Math.min(20, yourHq + (OFFSETS[id] ?? 0)));
    const tier = islandTier(hq);
    const name = names.splice(Math.floor(rng() * names.length), 1)[0] ?? "Unknown isle";
    return {
      id,
      name,
      x: spot.x,
      y: spot.y,
      size: spot.size,
      seed: Math.floor(rng() * 2 ** 31),
      hq,
      tier,
      difficulty: difficultyOf(hq, yourHq),
      defenses: DEFENSES.reduce((sum, t) => sum + allowedCount(t, hq), 0),
      reward: raidReward(true, 100, tier),
    };
  });
}
