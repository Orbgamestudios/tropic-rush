// Puzzle islands: about one island in five has its defenses laid out by hand rather than in rings,
// each layout asking for its own trick: a checkerboard of mortars to weave through, a horseshoe of
// sniper towers to flank, a gauntlet of flamethrowers to outrange. Which islands, and which puzzle,
// come from the island's seed, so every phone sees the same. A puzzle has as much firepower as an
// ordinary base of its headquarters level, give or take what its trick takes away. No engine
// imports.

import { BUILDINGS, type BuildingType } from "./buildings";
import { allowedCount, buildingPower, levelCap } from "./economy";
import { type Archetype, archetypeFor } from "./islandShapes";
import { createRng } from "./rng";

export type Puzzle =
  | "checkerboard"
  | "horseshoe"
  | "gauntlet"
  | "harpoonRing"
  | "picket"
  | "crossfire"
  | "honeyPot";

interface PuzzleInfo {
  label: string;
  /** How to go about it, for the island's card and the scout. */
  tip: string;
  /** The lowest headquarters level it turns up at. */
  from: number;
  /** The kinds of island it fits on: a long gauntlet needs a long island, a wall a wide one. */
  suits: readonly Archetype[];
}

export const PUZZLES: Record<Puzzle, PuzzleInfo> = {
  checkerboard: {
    label: "Mortar checkerboard",
    tip: "Mortars on every other square. Shells take two seconds to land: keep moving, and clear it corner by corner.",
    from: 3,
    suits: ["cove", "hook", "key", "twin", "volcano", "atoll", "chain"],
  },
  picket: {
    label: "Picket wall",
    tip: "A wall of guns across the way in, with one gap and fire waiting behind it. Break through a storage instead.",
    from: 6,
    suits: ["atoll", "ridge"],
  },
  horseshoe: {
    label: "Sniper horseshoe",
    tip: "Every tower sees into the U. Go round the outside of one arm, where the far towers can't reach.",
    from: 4,
    suits: ["cove", "twin", "volcano", "atoll", "chain"],
  },
  harpoonRing: {
    label: "Harpoon ring",
    tip: "Harpoons all round the headquarters, and they hit Heavy and Tank far harder. Send someone light.",
    from: 4,
    suits: ["cove", "hook", "key", "twin", "volcano", "atoll", "chain"],
  },
  honeyPot: {
    label: "Honey pot",
    tip: "The storages sit in the open, ringed by mortars. Grab the loot fast, or leave it and go for the headquarters.",
    from: 4,
    suits: ["cove", "key", "volcano"],
  },
  gauntlet: {
    label: "Flame gauntlet",
    tip: "Two rows of flamethrowers line the way in, but they only reach 11 m. Stay outside and pick them off, and keep moving: mortars cover the lanes.",
    from: 5,
    suits: ["key", "volcano", "ridge"],
  },
  crossfire: {
    label: "Crossfire",
    tip: "Two batteries cross their fire over the headquarters. Take one from the outside, where the other can't reach.",
    from: 5,
    suits: ["cove", "volcano", "atoll"],
  },
};

const ORDER = Object.keys(PUZZLES) as Puzzle[];

/** No puzzles on the first islands: they're for learning the ropes. */
const FIRST_PUZZLE_HQ = 3;
/** The share of islands that are puzzles. */
const PUZZLE_SHARE = 0.2;

/** Which puzzle an island is, if it's one at all. */
export function puzzleFor(seed: number, hq: number): Puzzle | null {
  if (hq < FIRST_PUZZLE_HQ) return null;
  const rng = createRng(seed ^ 0x9a221e);
  if (rng() >= PUZZLE_SHARE) return null;
  const kind = archetypeFor(seed, hq);
  const fits = ORDER.filter((p) => hq >= PUZZLES[p].from && PUZZLES[p].suits.includes(kind));
  return fits[Math.floor(rng() * fits.length)] ?? null;
}

/**
 * Roughly how much each defense is worth to a base, against a gun turret's 1. Mortars can be
 * dodged, flamethrowers outranged, and a sniper's shot hurts but comes slowly.
 */
const WORTH: Partial<Record<BuildingType, number>> = {
  gunTurret: 1,
  mortar: 0.9,
  harpoon: 0.9,
  flamethrower: 0.8,
  watchtower: 1.1,
};

const DEFENSES = Object.keys(WORTH) as BuildingType[];

/**
 * What one defense is worth at a headquarters level: harpoons, flamethrowers and towers come later
 * than guns and mortars, so they stand at lower levels and each is worth less.
 */
function worth(type: BuildingType, hq: number): number {
  return (WORTH[type] ?? 0) * buildingPower(Math.max(1, levelCap(type, hq)));
}

/** What an ordinary base's defenses are worth at a headquarters level. */
export function baseWorth(hq: number): number {
  return DEFENSES.reduce((sum, t) => sum + allowedCount(t, hq) * worth(t, hq), 0);
}

/** What a list of defenses is worth at a headquarters level. */
export function worthOf(types: readonly BuildingType[], hq: number): number {
  return types.reduce((sum, t) => sum + worth(t, hq), 0);
}

/**
 * Something a puzzle puts down: a building, or one of the base's own storages, at so many meters
 * from the middle of the headquarters, forward towards the beach and across to the right of that.
 */
export interface Spot {
  type: BuildingType | "storage";
  forward: number;
  across: number;
}

/** How many of a defense buy this share of an ordinary base's worth, kept between two bounds. */
function enough(hq: number, type: BuildingType, share: number, least: number, most: number) {
  const n = Math.round((baseWorth(hq) * share) / worth(type, hq));
  return Math.max(least, Math.min(most, n));
}

const around = (radius: number, angle: number) => ({
  forward: radius * Math.cos(angle),
  across: radius * Math.sin(angle),
});

/** Squares of the board, nearest the middle first, each ring of them filled evenly. */
const BOARD: readonly [number, number][] = [
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
  [2, 2],
  [-2, -2],
  [2, -2],
  [-2, 2],
  [3, 1],
  [-3, -1],
  [1, -3],
  [-1, 3],
  [3, -1],
  [-3, 1],
  [1, 3],
  [-1, -3],
];
const SQUARE = 10;

function checkerboard(hq: number): Spot[] {
  const n = enough(hq, "mortar", 1.3, 5, BOARD.length);
  return BOARD.slice(0, n).map(([f, a]) => ({
    type: "mortar",
    forward: f * SQUARE,
    across: a * SQUARE,
  }));
}

/** Shares `n` out between rings that hold `first`, then `next`, and so on outward. */
function rings(n: number, sizes: readonly number[]): number[] {
  const out: number[] = [];
  let left = n;
  for (const size of sizes) {
    if (left <= 0) break;
    out.push(Math.min(size, left));
    left -= size;
  }
  return out;
}

/** Towers round a U whose open end faces the beach, and a storage in its mouth as bait. */
function horseshoe(hq: number): Spot[] {
  const want = enough(hq, "watchtower", 1, 3, 40);
  const n = Math.min(12, want);
  // Past a dozen towers a strong base keeps fire close round the headquarters instead.
  const flames = Math.min(
    6,
    Math.round(((want - n) * worth("watchtower", hq)) / worth("flamethrower", hq)),
  );
  const open = (Math.PI * 2) / 3;
  const spots: Spot[] = [];
  rings(n, [7, 5]).forEach((count, ring) => {
    const radius = ring === 0 ? 16 + count : 33;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      spots.push({ type: "watchtower", ...around(radius, open / 2 + (Math.PI * 2 - open) * t) });
    }
  });
  for (let i = 0; i < flames; i++) {
    spots.push({ type: "flamethrower", ...around(9, (Math.PI * 2 * (i + 0.5)) / flames) });
  }
  return [...spots, { type: "storage", forward: 11, across: 0 }];
}

/**
 * Two rows of flamethrowers lining the way in, and two more outside those on a strong base. Mortars
 * behind the headquarters lob into the lanes outside the rows, and guns beside it cover their top
 * end, so picking the flames off from out there still takes moving and care.
 */
function gauntlet(hq: number): Spot[] {
  const pairs = Math.ceil(enough(hq, "flamethrower", 0.6, 4, 20) / 2);
  const mortars = enough(hq, "mortar", 0.35, 1, 6);
  const guns = enough(hq, "gunTurret", 0.35, 1, 6);
  const rows = rings(pairs, [5, 5]).flatMap((count, row) =>
    Array.from({ length: count }, (_, i) =>
      [-1, 1].map((side) => ({
        type: "flamethrower" as const,
        forward: 11 + i * 9 + row * 4.5,
        across: side * (row === 0 ? 7 : 17),
      })),
    ).flat(),
  );
  const behind = Array.from({ length: mortars }, (_, i) => ({
    type: "mortar" as const,
    forward: -9 - Math.floor(i / 2) * 9,
    across: (i % 2 === 0 ? -1 : 1) * (11 + Math.floor(i / 2) * 4),
  }));
  const flanks = Array.from({ length: guns }, (_, i) => ({
    type: "gunTurret" as const,
    forward: 2 + Math.floor(i / 2) * 9,
    across: (i % 2 === 0 ? -1 : 1) * 26,
  }));
  return [...rows, ...behind, ...flanks];
}

/** Harpoons all round the headquarters, in a second ring further out on a strong base. */
function harpoonRing(hq: number): Spot[] {
  const n = enough(hq, "harpoon", 1.05, 4, 18);
  return rings(n, [9, 9]).flatMap((count, ring) =>
    Array.from({ length: count }, (_, i) => ({
      type: "harpoon" as const,
      ...around(ring === 0 ? 11 + count * 0.5 : 21, (Math.PI * 2 * (i + 0.5 * (ring + 1))) / count),
    })),
  );
}

/**
 * Guns and storages shoulder to shoulder across the way in, one gap, and fire behind it. A strong
 * base has sniper towers behind the wall too, shooting over it at whoever's working on it.
 */
function picket(hq: number): Spot[] {
  const size = enough(hq, "gunTurret", 1.1, 3, 14);
  const guns = Math.min(7, size);
  const towers = Math.min(
    8,
    Math.round(((size - guns) * worth("gunTurret", hq)) / worth("watchtower", hq)),
  );
  const line = 17;
  const spots: Spot[] = [];
  for (const across of guns > 5 ? [-4, 4] : [0]) {
    spots.push({ type: "flamethrower", forward: line - 7, across });
  }
  for (const side of [-1, 1]) {
    const here = side < 0 ? Math.ceil(guns / 2) : Math.floor(guns / 2);
    for (let i = 0; i < here; i++) {
      spots.push({ type: "gunTurret", forward: line, across: side * (7 + i * 16) });
      spots.push({ type: "storage", forward: line, across: side * (15 + i * 16) });
    }
  }
  for (let i = 0; i < towers; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    spots.push({ type: "watchtower", forward: 6, across: side * (14 + Math.floor(i / 2) * 9) });
  }
  return spots;
}

/** An ordinary base's defenses, split into two batteries either side of an open headquarters. */
function crossfire(hq: number): Spot[] {
  const types = DEFENSES.flatMap((t) => Array<BuildingType>(allowedCount(t, hq)).fill(t));
  const spots: Spot[] = [];
  const halves = [types.filter((_, i) => i % 2 === 0), types.filter((_, i) => i % 2 === 1)];
  halves.forEach((half, side) => {
    const across = (side === 0 ? -1 : 1) * (19 + types.length * 0.4);
    let next = 0;
    rings(half.length, [1, 6, 99]).forEach((count, ring) => {
      for (let i = 0; i < count; i++) {
        const type = half[next++] ?? "gunTurret";
        const at =
          ring === 0 ? { forward: 0, across: 0 } : around(ring * 8, (Math.PI * 2 * i) / count);
        spots.push({ type, forward: 2 + at.forward, across: across + at.across });
      }
    });
  });
  return spots;
}

/** Storages in an open yard on the beach side, ringed by mortars; guns behind the headquarters. */
function honeyPot(hq: number): Spot[] {
  const yard = 18;
  const mortars = enough(hq, "mortar", 0.75, 3, 12);
  const guns = enough(hq, "gunTurret", 0.5, 1, 8);
  const spots: Spot[] = [
    { type: "storage", forward: yard + 4, across: -4 },
    { type: "storage", forward: yard + 4, across: 4 },
    { type: "storage", forward: yard - 4, across: -4 },
    { type: "storage", forward: yard - 4, across: 4 },
  ];
  const ring = 13 + Math.max(0, mortars - 8);
  for (let i = 0; i < mortars; i++) {
    const at = around(ring, (Math.PI * 2 * (i + 0.5)) / mortars);
    spots.push({ type: "mortar", forward: yard + at.forward, across: at.across });
  }
  rings(guns, [5, 3]).forEach((count, row) => {
    for (let i = 0; i < count; i++) {
      const behind = Math.PI * (0.6 + (0.8 * (i + 0.5)) / count);
      spots.push({ type: "gunTurret", ...around(row === 0 ? 10 : 19, behind) });
    }
  });
  return spots;
}

const PLANS: Record<Puzzle, (hq: number) => Spot[]> = {
  checkerboard,
  horseshoe,
  gauntlet,
  harpoonRing,
  picket,
  crossfire,
  honeyPot,
};

/** Where a puzzle puts things at a headquarters level. */
export function puzzlePlan(puzzle: Puzzle, hq: number): Spot[] {
  return PLANS[puzzle](hq);
}

/** The defenses a puzzle island has, for its card. */
export function puzzleDefenses(puzzle: Puzzle, hq: number): number {
  return puzzlePlan(puzzle, hq).filter((s) => s.type !== "storage" && BUILDINGS[s.type].attack)
    .length;
}
