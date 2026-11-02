// Enemy island buildings. Sizes are in meters; a hero is about 1.8 m tall, and the design doc's
// ratios (turret 2.5x, mortar/harpoon 2x, watchtower 5x, HQ about 4x) set the heights.

export type BuildingType =
  | "headquarters"
  | "gunTurret"
  | "mortar"
  | "harpoon"
  | "flamethrower"
  | "watchtower"
  | "landmine"
  | "goldMine"
  | "lumberCamp"
  | "quarry"
  | "scrapYard"
  | "storehouse"
  | "goldVault"
  | "timberShed"
  | "stoneYard"
  | "scrapBin"
  | "refinery";

export type DefenseAttack =
  | { kind: "bullet"; range: number; damage: number; reload: number; speed: number }
  | {
      kind: "harpoon";
      range: number;
      damage: number;
      reload: number;
      speed: number;
      /** Damage multiplier against heavy heroes (Heavy, Tank). */
      heavyBonus: number;
    }
  | {
      kind: "mortar";
      range: number;
      /** The mortar can't hit anything closer than this: its blind spot. */
      minRange: number;
      damage: number;
      reload: number;
      flightTime: number;
      splash: number;
    }
  | { kind: "flame"; range: number; damage: number; reload: number; coneHalfAngle: number };

export interface BuildingSpec {
  label: string;
  /** Collision and hit radius on the ground. */
  radius: number;
  /** Visual height, for health bars and placeholder models. */
  height: number;
  hp: number;
  /** Gunboat energy the crew earns for destroying it. */
  energy: number;
  attack?: DefenseAttack;
}

export const BUILDINGS: Record<BuildingType, BuildingSpec> = {
  headquarters: { label: "Headquarters", radius: 5, height: 6.5, hp: 5000, energy: 0 },
  gunTurret: {
    label: "Gun turret",
    radius: 2.4,
    height: 5.6,
    hp: 1100,
    energy: 4,
    attack: { kind: "bullet", range: 21, damage: 50, reload: 0.42, speed: 30 },
  },
  mortar: {
    label: "Mortar",
    radius: 2.6,
    height: 4.5,
    hp: 1000,
    energy: 5,
    attack: {
      kind: "mortar",
      range: 34,
      minRange: 6,
      damage: 220,
      reload: 3.6,
      flightTime: 1.8,
      splash: 5.5,
    },
  },
  harpoon: {
    label: "Harpoon launcher",
    radius: 2.4,
    height: 4.5,
    hp: 1200,
    energy: 5,
    attack: { kind: "harpoon", range: 25, damage: 230, reload: 2.6, speed: 36, heavyBonus: 1.6 },
  },
  flamethrower: {
    label: "Flamethrower",
    radius: 2.1,
    height: 5,
    hp: 1000,
    energy: 4,
    attack: { kind: "flame", range: 9.5, damage: 28, reload: 0.13, coneHalfAngle: 0.45 },
  },
  watchtower: { label: "Watchtower", radius: 2.3, height: 9, hp: 700, energy: 3 },
  // Not a building in a raid: it goes down as a hidden mine, which nothing can target.
  landmine: { label: "Land mine", radius: 0.5, height: 0.3, hp: 1, energy: 0 },
  goldMine: { label: "Gold mine", radius: 3.7, height: 3.9, hp: 900, energy: 3 },
  lumberCamp: { label: "Lumber mill", radius: 3.7, height: 3.6, hp: 900, energy: 3 },
  quarry: { label: "Stone quarry", radius: 3.7, height: 3.3, hp: 900, energy: 3 },
  scrapYard: { label: "Scrap yard", radius: 3.7, height: 3.3, hp: 800, energy: 3 },
  storehouse: { label: "Storehouse", radius: 2.9, height: 3.6, hp: 1200, energy: 3 },
  goldVault: { label: "Gold vault", radius: 2.9, height: 3.2, hp: 1200, energy: 3 },
  timberShed: { label: "Timber shed", radius: 2.9, height: 3.4, hp: 1100, energy: 3 },
  stoneYard: { label: "Stone yard", radius: 2.9, height: 2.6, hp: 1300, energy: 3 },
  scrapBin: { label: "Scrap bin", radius: 2.9, height: 3, hp: 1100, energy: 3 },
  refinery: { label: "Refinery", radius: 3.7, height: 6.5, hp: 1300, energy: 4 },
};

export type BuildingCounts = Partial<Record<BuildingType, number>>;

export interface LevelContents {
  buildings: BuildingCounts;
  mines: number;
}

/**
 * What an island has at each HQ level. Every island at the same level has exactly these
 * buildings; only the layout and coastline differ (a Decided rule in docs/DESIGN.md).
 * Draft numbers, not balanced yet.
 */
export const HQ_LEVELS: Record<number, LevelContents> = {
  1: {
    buildings: {
      headquarters: 1,
      gunTurret: 1,
      mortar: 1,
      watchtower: 1,
      goldMine: 1,
      lumberCamp: 1,
      storehouse: 1,
    },
    mines: 1,
  },
  2: {
    buildings: {
      headquarters: 1,
      gunTurret: 2,
      mortar: 1,
      harpoon: 1,
      watchtower: 1,
      goldMine: 1,
      lumberCamp: 1,
      quarry: 1,
      storehouse: 1,
      refinery: 1,
    },
    mines: 2,
  },
  3: {
    buildings: {
      headquarters: 1,
      gunTurret: 3,
      mortar: 2,
      harpoon: 1,
      flamethrower: 1,
      watchtower: 2,
      goldMine: 1,
      lumberCamp: 1,
      quarry: 1,
      scrapYard: 1,
      storehouse: 2,
      refinery: 1,
    },
    mines: 3,
  },
};

export const MAX_HQ_LEVEL = 3;

export function levelContents(level: number): LevelContents {
  const clamped = Math.min(MAX_HQ_LEVEL, Math.max(1, Math.round(level)));
  const contents = HQ_LEVELS[clamped];
  if (!contents) throw new Error(`No contents for HQ level ${clamped}`);
  return contents;
}
