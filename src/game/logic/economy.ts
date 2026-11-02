// Crew island progression: the four resources, what each building costs, how many of each the
// headquarters' level allows, how far each can be upgraded, and how resources build up over time.
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

export const MAX_HQ_LEVEL = 20;

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
  /** Its highest level. */
  maxLevel: number;
  /** [HQ level, how many allowed from that level on], in rising order. */
  counts: readonly (readonly [number, number])[];
  /** Cost to build it (level 1). Upgrades cost more each level. */
  cost: Partial<Purse>;
}

const storage = (cost: Partial<Purse>): Progression => ({
  unlockHq: 3,
  maxLevel: 8,
  // One of each storage at HQ 3, two at HQ 7, three at HQ 20.
  counts: [
    [3, 1],
    [7, 2],
    [20, 3],
  ],
  cost,
});

export const PROGRESSION: Record<BuildingType, Progression> = {
  headquarters: { unlockHq: 1, maxLevel: MAX_HQ_LEVEL, counts: [[1, 1]], cost: {} },
  goldMine: { unlockHq: 1, maxLevel: 10, counts: [[1, 1]], cost: { timber: 150, stone: 50 } },
  lumberCamp: { unlockHq: 1, maxLevel: 10, counts: [[1, 1]], cost: { gold: 150, stone: 50 } },
  quarry: { unlockHq: 1, maxLevel: 10, counts: [[1, 1]], cost: { gold: 150, timber: 100 } },
  scrapYard: {
    unlockHq: 2,
    maxLevel: 10,
    counts: [[2, 1]],
    cost: { gold: 250, timber: 150, stone: 100 },
  },
  gunTurret: {
    unlockHq: 1,
    maxLevel: 10,
    counts: [
      [1, 1],
      [3, 2],
      [5, 3],
      [8, 4],
      [12, 5],
      [16, 6],
    ],
    cost: { gold: 250, stone: 100 },
  },
  mortar: {
    unlockHq: 1,
    maxLevel: 10,
    counts: [
      [1, 1],
      [6, 2],
      [12, 3],
      [18, 4],
    ],
    cost: { gold: 350, timber: 100, stone: 150 },
  },
  harpoon: {
    unlockHq: 4,
    maxLevel: 10,
    counts: [
      [4, 1],
      [9, 2],
      [15, 3],
    ],
    cost: { gold: 600, timber: 300, scrap: 150 },
  },
  flamethrower: {
    unlockHq: 5,
    maxLevel: 10,
    counts: [
      [5, 1],
      [10, 2],
      [16, 3],
    ],
    cost: { gold: 800, scrap: 300 },
  },
  watchtower: {
    unlockHq: 3,
    maxLevel: 5,
    counts: [
      [3, 1],
      [11, 2],
    ],
    cost: { timber: 400, stone: 200 },
  },
  goldVault: storage({ timber: 300, stone: 300 }),
  timberShed: storage({ gold: 300, stone: 200 }),
  stoneYard: storage({ gold: 300, timber: 300 }),
  scrapBin: storage({ gold: 400, stone: 200 }),
  refinery: {
    unlockHq: 8,
    maxLevel: 5,
    counts: [[8, 1]],
    cost: { gold: 2000, timber: 1500, stone: 1500 },
  },
  // The raid's old shared storehouse: not built on crew islands.
  storehouse: { unlockHq: MAX_HQ_LEVEL + 1, maxLevel: 1, counts: [], cost: {} },
};

/** How many of a building the headquarters' level allows. */
export function allowedCount(type: BuildingType, hqLevel: number): number {
  let count = 0;
  for (const [level, n] of PROGRESSION[type].counts) if (hqLevel >= level) count = n;
  return count;
}

/** How much a building's health and damage are multiplied by at a level, in a raid. */
export function buildingPower(level: number): number {
  return 1 + 0.12 * (Math.max(1, level) - 1);
}

/** The highest level a building can reach at this headquarters level. */
export function levelCap(type: BuildingType, hqLevel: number): number {
  const p = PROGRESSION[type];
  if (type === "headquarters") return p.maxLevel;
  return Math.max(0, Math.min(p.maxLevel, hqLevel - p.unlockHq + 1));
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
  return `+${Math.round((buildingPower(level + 1) / buildingPower(level) - 1) * 100)}% strength`;
}

/** Cost to bring a building to `level` (level 1 is building it). */
export function costFor(type: BuildingType, level: number): Partial<Purse> {
  if (type === "headquarters") {
    if (level <= 1) return {};
    const cost = scale({ gold: 400, timber: 400, stone: 250 }, 1.32 ** (level - 2));
    // Scrap joins the bill from HQ 3, once the scrap yard (HQ 2) has had time to produce.
    if (level >= 3) cost.scrap = Math.round((120 * 1.32 ** (level - 3)) / 10) * 10;
    return cost;
  }
  return scale(PROGRESSION[type].cost, 1.45 ** (level - 1));
}

/** Minutes of work to bring a building to a level, from 1 upward; level 1 is building it. */
const BUILD_MINUTES = [1, 1, 5, 10, 30, 60, 120, 240, 480, 720] as const;
/** The same for the headquarters, which starts in the hours from its first upgrade. */
const HQ_MINUTES = [
  0, 30, 60, 120, 180, 240, 360, 480, 600, 720, 960, 1200, 1440, 1800, 2160, 2520, 2880, 3240, 3600,
  4320,
] as const;

const MINUTE_MS = 60_000;

/** Milliseconds of work to bring a building to `level`. */
export function buildTime(type: BuildingType, level: number): number {
  const table = type === "headquarters" ? HQ_MINUTES : BUILD_MINUTES;
  const minutes = table[Math.max(0, Math.min(table.length, level) - 1)] ?? 0;
  return minutes * MINUTE_MS;
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
  const amount = LOOT_PER_MILL * 1.3 ** (Math.max(1, level) - 1) * (store ? STORAGE_LOOT : 1);
  return { [resource]: Math.round(amount / 5) * 5 };
}

/** What the headquarters itself can hold of each resource. */
export function hqCapacity(hqLevel: number): number {
  return 1000 + 400 * (hqLevel - 1);
}

/** What one storage holds at a level. */
export function storageCapacity(level: number): number {
  return Math.round(2500 * 1.5 ** (level - 1));
}

/** How much a producer makes per hour at a level. */
export function productionPerHour(level: number): number {
  return Math.round(900 * 1.3 ** (level - 1));
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
