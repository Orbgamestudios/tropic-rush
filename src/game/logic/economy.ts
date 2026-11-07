// Crew island progression: the four resources, what each building costs, how many of each the
// headquarters' level allows, how far each can be upgraded, and how resources build up over time.
// The headquarters goes to level 50. Every building gets its first levels at the pace it always
// did up to headquarters 20 (EARLY_TOP), and the rest spread thinly over the climb to 50, a level
// every few headquarters levels, so each tops out exactly at headquarters 50. Past a building's
// first levels, each one costs, takes and gives a little less more than the one before.
// A new island starts with just its headquarters and a little of each resource. Producers (one of
// each) fill the crew's shared stock passively, up to what the headquarters and storages can hold.
// Draft numbers, not balanced yet. Plain rules with no engine imports, shared with the server.

import type { BuildingType } from "./buildings";

export type Resource = "gold" | "timber" | "stone" | "scrap";
export const RESOURCES: readonly Resource[] = ["gold", "timber", "stone", "scrap"];
export type Purse = Record<Resource, number>;

export const RESOURCE_LABELS: Record<Resource, string> = {
  gold: "Gold",
  timber: "Timber",
  stone: "Stone",
  scrap: "Scrap",
};

export const MAX_HQ_LEVEL = 50;
/** Where everything used to stop: up to here, each building's levels come at their old pace. */
export const EARLY_TOP = 20;

/** What a brand-new island starts with. */
export const START_RESOURCES: Purse = { gold: 600, timber: 600, stone: 300, scrap: 100 };

/** Resource buildings that produce, and the resource each makes. */
export const PRODUCERS: Partial<Record<BuildingType, Resource>> = {
  goldMine: "gold",
  lumberCamp: "timber",
  quarry: "stone",
  scrapYard: "scrap",
};

/** Storages, and the resource each holds. */
export const STORAGES: Partial<Record<BuildingType, Resource>> = {
  goldVault: "gold",
  timberShed: "timber",
  stoneYard: "stone",
  scrapBin: "scrap",
};

interface Progression {
  /** The headquarters level that first allows this building. */
  unlockHq: number;
  /** Its highest level, reached at headquarters 50. */
  maxLevel: number;
  /** Its first levels, which come at the old pace: one a headquarters level unless stretched. */
  early: number;
  /**
   * Levels for each one of an ordinary building's, for a building that grows in more, smaller
   * steps: it reaches its last level only at the top headquarters level, and each level costs
   * and takes that much less more than the last.
   */
  stretch?: number;
  /** How much stronger each level makes it, if not the usual 12%. */
  powerPerLevel?: number;
  /** [HQ level, how many allowed from that level on], in rising order. */
  counts: readonly (readonly [number, number])[];
  /** Cost to build it (level 1). Upgrades cost more each level. */
  cost: Partial<Purse>;
}

const storage = (cost: Partial<Purse>): Progression => ({
  unlockHq: 3,
  maxLevel: 20,
  early: 8,
  // One of each storage at HQ 3, two at HQ 7, three at HQ 20, four at HQ 35.
  counts: [
    [3, 1],
    [7, 2],
    [20, 3],
    [35, 4],
  ],
  cost,
});

export const PROGRESSION: Record<BuildingType, Progression> = {
  headquarters: {
    unlockHq: 1,
    maxLevel: MAX_HQ_LEVEL,
    early: EARLY_TOP,
    counts: [[1, 1]],
    cost: {},
  },
  goldMine: {
    unlockHq: 1,
    maxLevel: 25,
    early: 10,
    counts: [[1, 1]],
    cost: { timber: 150, stone: 50 },
  },
  lumberCamp: {
    unlockHq: 1,
    maxLevel: 25,
    early: 10,
    counts: [[1, 1]],
    cost: { gold: 150, stone: 50 },
  },
  quarry: {
    unlockHq: 1,
    maxLevel: 25,
    early: 10,
    counts: [[1, 1]],
    cost: { gold: 150, timber: 100 },
  },
  scrapYard: {
    unlockHq: 2,
    maxLevel: 25,
    early: 10,
    counts: [[2, 1]],
    cost: { gold: 250, timber: 150, stone: 100 },
  },
  gunTurret: {
    unlockHq: 1,
    maxLevel: 50,
    early: 30,
    stretch: 3,
    // Half the usual step: by level 15, where a headquarters 10 has it, it's about where a
    // level 10 turret was, and the levels after keep it growing.
    powerPerLevel: 0.06,
    counts: [
      [1, 1],
      [3, 2],
      [5, 3],
      [8, 4],
      [12, 5],
      [16, 6],
      [26, 7],
      [38, 8],
    ],
    cost: { gold: 250, stone: 100 },
  },
  mortar: {
    unlockHq: 1,
    maxLevel: 25,
    early: 10,
    counts: [
      [1, 1],
      [6, 2],
      [12, 3],
      [18, 4],
      [30, 5],
      [44, 6],
    ],
    cost: { gold: 350, timber: 100, stone: 150 },
  },
  harpoon: {
    unlockHq: 4,
    maxLevel: 25,
    early: 10,
    counts: [
      [4, 1],
      [9, 2],
      [15, 3],
      [28, 4],
      [42, 5],
    ],
    cost: { gold: 600, timber: 300, scrap: 150 },
  },
  flamethrower: {
    unlockHq: 5,
    maxLevel: 25,
    early: 10,
    counts: [
      [5, 1],
      [10, 2],
      [16, 3],
      [30, 4],
      [45, 5],
    ],
    cost: { gold: 800, scrap: 300 },
  },
  watchtower: {
    unlockHq: 3,
    maxLevel: 15,
    early: 5,
    counts: [
      [3, 1],
      [11, 2],
      [24, 3],
      [40, 4],
    ],
    cost: { timber: 400, stone: 200 },
  },
  landmine: {
    unlockHq: 2,
    maxLevel: 1,
    early: 1,
    counts: [
      [2, 2],
      [4, 4],
      [7, 6],
      [10, 8],
      [14, 10],
      [18, 12],
      [26, 14],
      [34, 16],
      [44, 18],
    ],
    cost: { gold: 80, stone: 30 },
  },
  goldVault: storage({ timber: 300, stone: 300 }),
  timberShed: storage({ gold: 300, stone: 200 }),
  stoneYard: storage({ gold: 300, timber: 300 }),
  scrapBin: storage({ gold: 400, stone: 200 }),
  refinery: {
    unlockHq: 8,
    maxLevel: 15,
    early: 5,
    counts: [
      [8, 1],
      [32, 2],
    ],
    cost: { gold: 2000, timber: 1500, stone: 1500 },
  },
  laboratory: {
    unlockHq: 1,
    maxLevel: 1,
    early: 1,
    counts: [[1, 1]],
    cost: { gold: 300, timber: 200, stone: 100 },
  },
  // The raid's old shared storehouse: not built on crew islands.
  storehouse: { unlockHq: MAX_HQ_LEVEL + 1, maxLevel: 1, early: 1, counts: [], cost: {} },
};

/** How many of a building the headquarters' level allows. */
export function allowedCount(type: BuildingType, hqLevel: number): number {
  let count = 0;
  for (const [level, n] of PROGRESSION[type].counts) if (hqLevel >= level) count = n;
  return count;
}

const stretchOf = (type: BuildingType) => PROGRESSION[type].stretch ?? 1;

/** How much a building's health and damage are multiplied by at a level, in a raid. */
export function buildingPower(level: number, type?: BuildingType): number {
  const step = (type && PROGRESSION[type].powerPerLevel) ?? 0.12;
  return 1 + step * (Math.max(1, level) - 1);
}

/** The headquarters level a building has all its early levels by. */
function earlyDone(p: Progression): number {
  return p.stretch ? EARLY_TOP : Math.min(EARLY_TOP, p.unlockHq + p.early - 1);
}

/**
 * The highest level a building can reach at this headquarters level: its early levels at their old
 * pace (one a headquarters level, or spread over the first twenty if stretched), then the rest
 * spread evenly over the climb to headquarters 50, so not every level of the headquarters adds one.
 */
export function levelCap(type: BuildingType, hqLevel: number): number {
  const p = PROGRESSION[type];
  if (type === "headquarters") return p.maxLevel;
  const reached = hqLevel - p.unlockHq + 1;
  if (reached <= 0) return 0;
  const done = earlyDone(p);
  if (hqLevel < done) {
    const early = p.stretch
      ? Math.floor((reached * p.early) / (EARLY_TOP - p.unlockHq + 1))
      : reached;
    return Math.min(p.early, Math.max(1, early));
  }
  const late = Math.floor(((hqLevel - done) * (p.maxLevel - p.early)) / (MAX_HQ_LEVEL - done));
  return Math.min(p.maxLevel, p.early + late);
}

/** Levels past a building's early ones cost this much more each than the last... */
const LATE_COST = 1.08;
/** ...and take an hour longer. */
const LATE_MINUTES = 60;
/** Past headquarters 20, each headquarters level costs this much more than the last. */
const LATE_HQ_COST = 1.07;

/** How far up its early levels a level is, in ordinary levels: a stretched building's count less. */
function rung(type: BuildingType, level: number): number {
  const p = PROGRESSION[type];
  return 1 + (Math.min(level, p.early) - 1) / stretchOf(type);
}

const scale = (cost: Partial<Purse>, factor: number): Partial<Purse> => {
  const out: Partial<Purse> = {};
  for (const r of RESOURCES) {
    const amount = cost[r];
    if (amount) out[r] = Math.round((amount * factor) / 10) * 10;
  }
  return out;
};

/** What the next level of a building adds, in a few words. */
export function nextLevelGain(type: BuildingType, level: number): string {
  if (type === "headquarters") return "more of everything";
  if (PRODUCERS[type]) {
    const gain = productionPerHour(level + 1) - productionPerHour(level);
    return `+${formatAmount(gain)} an hour`;
  }
  if (STORAGES[type]) {
    return `+${formatAmount(storageCapacity(level + 1) - storageCapacity(level))} storage`;
  }
  const gain = buildingPower(level + 1, type) / buildingPower(level, type) - 1;
  return `+${Math.round(gain * 100)}% strength`;
}

/** Cost to bring a building to `level` (level 1 is building it). */
export function costFor(type: BuildingType, level: number): Partial<Purse> {
  if (type === "headquarters") {
    if (level <= 1) return {};
    // Past headquarters 20 each level costs only a little more than the one before.
    const late = LATE_HQ_COST ** Math.max(0, level - EARLY_TOP);
    const early = Math.min(level, EARLY_TOP);
    const cost = scale({ gold: 400, timber: 400, stone: 250 }, 1.32 ** (early - 2) * late);
    // Scrap joins the bill from HQ 3, once the scrap yard (HQ 2) has had time to produce.
    if (level >= 3) cost.scrap = Math.round((120 * 1.32 ** (early - 3) * late) / 10) * 10;
    return cost;
  }
  const late = LATE_COST ** Math.max(0, level - PROGRESSION[type].early);
  return scale(PROGRESSION[type].cost, 1.45 ** (rung(type, level) - 1) * late);
}

/** Minutes of work to bring a building to a level, from 1 upward; level 1 is building it. */
const BUILD_MINUTES = [0.5, 1, 2, 3, 5, 15, 60, 240, 480, 720] as const;
/** The same for the headquarters: minutes at first, hours from level 7, days by level 20... */
const HQ_MINUTES = [
  0, 2, 5, 10, 20, 30, 60, 120, 240, 480, 720, 1200, 1440, 1800, 2160, 2520, 2880, 3240, 3600, 4320,
] as const;
/** ...and from there a few hours more each level, to a week at level 50. */
const LATE_HQ_MINUTES = 192;

const MINUTE_MS = 60_000;

/** Milliseconds of work to bring a building to `level`. */
export function buildTime(type: BuildingType, level: number): number {
  if (type === "headquarters") {
    const last = HQ_MINUTES[HQ_MINUTES.length - 1] ?? 0;
    const minutes =
      level <= HQ_MINUTES.length
        ? (HQ_MINUTES[Math.max(0, level - 1)] ?? 0)
        : last + LATE_HQ_MINUTES * (level - HQ_MINUTES.length);
    return minutes * MINUTE_MS;
  }
  // A stretched building's levels take as long as the ordinary level they're a share of, and the
  // levels past its early ones an hour more each.
  const step = Math.ceil(Math.min(level, PROGRESSION[type].early) / stretchOf(type));
  const early = BUILD_MINUTES[Math.max(0, Math.min(BUILD_MINUTES.length, step) - 1)] ?? 0;
  const past = Math.max(0, level - PROGRESSION[type].early);
  return (early + LATE_MINUTES * past) * MINUTE_MS;
}

/** What breaking a mill pays, and how many times that a full storage pays. */
const LOOT_PER_MILL = 120;
const STORAGE_LOOT = 2.5;

/** What's left to carry off when a mill or a storage is destroyed in a raid. */
export function lootFor(type: BuildingType, level: number): Partial<Purse> {
  const mill = PRODUCERS[type];
  const store = STORAGES[type];
  const resource = mill ?? store;
  if (!resource) return {};
  const grown = productionPerHour(Math.max(1, level)) / productionPerHour(1);
  const amount = LOOT_PER_MILL * grown * (store ? STORAGE_LOOT : 1);
  return { [resource]: Math.round(amount / 5) * 5 };
}

/**
 * What the headquarters itself can hold of each resource: only a little, so a new island's first
 * raids soon outgrow it, and storages are what let a crew keep more.
 */
export function hqCapacity(hqLevel: number): number {
  return 700 + 200 * (hqLevel - 1);
}

/** What one storage holds at a level: half again each of its first eight, then 10% more each. */
export function storageCapacity(level: number): number {
  const early = Math.min(level, 8);
  return Math.round(2500 * 1.5 ** (early - 1) * 1.1 ** Math.max(0, level - 8));
}

/** How much a producer makes per hour at a level: 30% more each of its first ten, then 8% more. */
export function productionPerHour(level: number): number {
  const early = Math.min(level, 10);
  return Math.round(150 * 1.3 ** (early - 1) * 1.08 ** Math.max(0, level - 10));
}

/** Hours of work a producer holds until it's collected: a day at level 1, three days by level 10. */
export function holdHours(level: number): number {
  return 24 + ((Math.max(1, level) - 1) * 16) / 3;
}

/** The most a producer holds at a level, until it's collected. */
export function producerHold(level: number): number {
  return Math.round(productionPerHour(level) * holdHours(level));
}

export function canAfford(purse: Purse, cost: Partial<Purse>): boolean {
  return RESOURCES.every((r) => purse[r] >= (cost[r] ?? 0));
}

export function spend(purse: Purse, cost: Partial<Purse>): Purse {
  const out = { ...purse };
  for (const r of RESOURCES) out[r] -= cost[r] ?? 0;
  return out;
}

/** A purse with nothing in it. */
export function emptyPurse(): Purse {
  return { gold: 0, timber: 0, stone: 0, scrap: 0 };
}

/** Short text for a cost, e.g. "🪙 300  🪵 200". */
export const RESOURCE_ICONS: Record<Resource, string> = {
  gold: "🪙",
  timber: "🪵",
  stone: "🪨",
  scrap: "🔩",
};

export function costText(cost: Partial<Purse>): string {
  const parts = RESOURCES.filter((r) => (cost[r] ?? 0) > 0).map(
    (r) => `${RESOURCE_ICONS[r]} ${formatAmount(cost[r] ?? 0)}`,
  );
  return parts.length > 0 ? parts.join("  ") : "Free";
}

/** 950, 1.2k, 34k, 1.5M. */
export function formatAmount(n: number): string {
  const v = Math.floor(n);
  if (v < 1000) return String(v);
  if (v < 10_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (v < 1_000_000) return `${Math.floor(v / 1000)}k`;
  return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/** A span of time for the screen: "2d 4h", "3h 20m", "5m" or "40s". */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
