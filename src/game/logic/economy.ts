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
