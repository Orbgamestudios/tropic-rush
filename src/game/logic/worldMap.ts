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

/** Where islands sit round the crew's own, and how far above the crew's HQ each one is. */
const SPOTS = [
  { x: -34, y: -22, size: 1.15, offset: 0 },
  { x: -48, y: 2, size: 0.8, offset: -1 },
  { x: -36, y: 24, size: 1.05, offset: 1 },
  { x: -14, y: -30, size: 0.9, offset: 2 },
  { x: -12, y: 31, size: 1.3, offset: 0 },
  { x: 14, y: -31, size: 1.2, offset: 3 },
  { x: 16, y: 30, size: 0.85, offset: 1 },
  { x: 36, y: -21, size: 1.35, offset: 5 },
  { x: 46, y: 0, size: 1, offset: 2 },
  { x: 37, y: 22, size: 1.25, offset: 4 },
] as const;

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
  return SPOTS.map((spot, id) => {
    const hq = Math.max(1, Math.min(20, yourHq + spot.offset));
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
