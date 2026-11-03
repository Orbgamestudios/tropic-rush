// Puzzle islands: about one island in five has its defenses laid out by design rather than in
// rings, each layout asking for its own way in: a checkerboard of mortars to weave through, a
// horseshoe of sniper towers to flank, a gauntlet of flamethrowers to outrange. They look like any
// other island on the map; the layout is the surprise. There are about thirty, made from a handful
// of shapes, each filled with different buildings. Which islands, and which layout, come from the
// island's seed, so every phone sees the same. A layout has about the firepower of an ordinary
// base of its headquarters level. No engine imports.

import { BUILDINGS, type BuildingType } from "./buildings";
import { allowedCount, buildingPower, levelCap } from "./economy";
import { type Archetype, archetypeFor } from "./islandShapes";
import { createRng } from "./rng";

/** No puzzles on the first islands: they're for learning the ropes. */
const FIRST_PUZZLE_HQ = 3;
/** The share of islands that are puzzles. */
const PUZZLE_SHARE = 0.2;

/**
 * Roughly how much each defense is worth to a base. Gun turrets fire fastest, mortars can be
 * dodged, flamethrowers outranged, and a sniper's shot hurts but comes slowly.
 */
const WORTH: Partial<Record<BuildingType, number>> = {
  gunTurret: 1.3,
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
  return (WORTH[type] ?? 0) * buildingPower(Math.max(1, levelCap(type, hq)), type);
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
 * Something a layout puts down: a building, or one of the base's own storages, at so many meters
 * from the middle of the headquarters, forward towards the beach and across to the right of that.
 */
export interface Spot {
  type: BuildingType | "storage";
  forward: number;
  across: number;
}

/** A spot in a shape, before it's given a building: `role` says which part of the shape it's in. */
interface Place {
  forward: number;
  across: number;
  role: number;
}

const around = (radius: number, angle: number) => ({
  forward: radius * Math.cos(angle),
  across: radius * Math.sin(angle),
});

/** Shares `n` out between rings that hold so many each, inmost first. */
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

// ---------------------------------------------------------------------------------------------
// Shapes: where `n` buildings go, each with the part of the shape it's in.

/** Squares of a board, nearest the middle first, each ring of them filled evenly. */
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

const SHAPES = {
  /** Every other square of a board round the headquarters. */
  board: (n: number): Place[] =>
    BOARD.slice(0, n).map(([f, a], i) => ({
      forward: f * 10,
      across: a * 10,
      role: i < 4 ? 0 : i < 12 ? 1 : 2,
    })),
  /** A U round the headquarters, open towards the beach, and a wider one outside it. */
  horseshoe: (n: number): Place[] => {
    const open = (Math.PI * 2) / 3;
    return rings(n, [7, 5]).flatMap((count, ring) =>
      Array.from({ length: count }, (_, i) => {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const radius = ring === 0 ? 16 + count : 33;
        return { ...around(radius, open / 2 + (Math.PI * 2 - open) * t), role: ring };
      }),
    );
  },
  /** Two rows lining the way in, and two more outside them. */
  rows: (n: number): Place[] =>
    rings(Math.ceil(n / 2), [5, 5])
      .flatMap((count, row) =>
        Array.from({ length: count }, (_, i) =>
          [-1, 1].map((side) => ({
            forward: 11 + i * 9 + row * 4.5,
            across: side * (row === 0 ? 7 : 17),
            role: row,
          })),
        ).flat(),
      )
      .slice(0, n),
  /** All the way round the headquarters, and a second ring outside. */
  ring: (n: number): Place[] =>
    rings(n, [9, 11]).flatMap((count, ring) =>
      Array.from({ length: count }, (_, i) => ({
        ...around(
          ring === 0 ? 11 + count * 0.5 : 22,
          (Math.PI * 2 * (i + 0.5 * (ring + 1))) / count,
        ),
        role: ring,
      })),
    ),
  /** Winding out from the headquarters, a little further with every one. */
  spiral: (n: number): Place[] =>
    Array.from({ length: n }, (_, k) => ({
      ...around(10 + 2.4 * k, 0.6 + k * 0.78),
      role: k < 4 ? 0 : k < 9 ? 1 : 2,
    })),
  /** Four arms out from the headquarters: to the beach, away from it, and to either side. */
  cross: (n: number): Place[] =>
    Array.from({ length: n }, (_, k) => {
      const reach = 12 + Math.floor(k / 4) * 9;
      return { ...around(reach, (Math.PI / 2) * (k % 4)), role: Math.floor(k / 4) };
    }),
  /** Five spokes out from the headquarters, one pointing at the beach. */
  spokes: (n: number): Place[] =>
    Array.from({ length: n }, (_, k) => ({
      ...around(13 + Math.floor(k / 5) * 9, ((Math.PI * 2) / 5) * (k % 5)),
      role: k % 5,
    })),
  /** A V pointing at the beach, its arms running back past the headquarters. */
  chevron: (n: number): Place[] =>
    Array.from({ length: n }, (_, k) => {
      if (k === 0) return { forward: 27, across: 0, role: 0 };
      const step = Math.ceil(k / 2);
      return { forward: 27 - step * 7, across: (k % 2 === 0 ? 1 : -1) * step * 8, role: 1 };
    }),
  /** A diamond round the headquarters: its points, then its sides, then a ring inside. */
  diamond: (n: number): Place[] => {
    const points = [0, 1, 2, 3].map((i) => ({ ...around(18, (Math.PI / 2) * i), role: 0 }));
    const sides = [0, 1, 2, 3].map((i) => ({
      ...around(18 * Math.SQRT1_2, (Math.PI / 2) * (i + 0.5)),
      role: 1,
    }));
    const inside = [0, 1, 2, 3, 4, 5].map((i) => ({ ...around(28, (Math.PI / 3) * i), role: 2 }));
    return [...points, ...sides, ...inside].slice(0, n);
  },
  /** Three little forts out round the headquarters: two forward, one behind. */
  satellites: (n: number): Place[] => {
    const forts = [Math.PI / 3, -Math.PI / 3, Math.PI].map((a) => around(25, a));
    return Array.from({ length: n }, (_, k) => {
      const fort = k % 3;
      const seat = Math.floor(k / 3);
      const middle = forts[fort] ?? { forward: 0, across: 0 };
      const off = seat === 0 ? { forward: 0, across: 0 } : around(7.5, (Math.PI * 2 * seat) / 4);
      return {
        forward: middle.forward + off.forward,
        across: middle.across + off.across,
        role: fort,
      };
    });
  },
  /** Rings within rings round the headquarters, each its own kind of defense. */
  onion: (n: number): Place[] =>
    rings(n, [6, 10, 14]).flatMap((count, ring) =>
      Array.from({ length: count }, (_, i) => ({
        ...around(11 + ring * 9, (Math.PI * 2 * (i + 0.5 * ring)) / count),
        role: ring,
      })),
    ),
  /** Two triangles meeting at the headquarters, one towards the beach and one behind. */
  bowtie: (n: number): Place[] => {
    const rows = [[0], [-4.5, 4.5], [-9, 0, 9]];
    const half = (side: number) =>
      rows.flatMap((row, r) =>
        row.map((across) => ({ forward: side * (12 + r * 9), across, role: side > 0 ? 0 : 1 })),
      );
    const front = half(1);
    const back = half(-1);
    return front.flatMap((f, i) => [f, back[i] ?? f]).slice(0, n);
  },
  /** The four walls of a square round the headquarters: corners, then midpoints, then between. */
  box: (n: number): Place[] => {
    const corners = [
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ].map(([f = 0, a = 0]) => ({ forward: f * 17, across: a * 17, role: 0 }));
    const mids = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].map(([f = 0, a = 0]) => ({ forward: f * 17, across: a * 17, role: 1 }));
    const between = [
      [1, 0.5],
      [1, -0.5],
      [-1, 0.5],
      [-1, -0.5],
      [0.5, 1],
      [-0.5, 1],
      [0.5, -1],
      [-0.5, -1],
    ].map(([f = 0, a = 0]) => ({ forward: f * 17, across: a * 17, role: 2 }));
    return [...corners, ...mids, ...between].slice(0, n);
  },
} as const;

type ShapeName = keyof typeof SHAPES;

/** The most each shape holds. */
const ROOM: Record<ShapeName, number> = {
  board: BOARD.length,
  horseshoe: 12,
  rows: 20,
  ring: 20,
  spiral: 14,
  cross: 12,
  spokes: 15,
  chevron: 9,
  diamond: 14,
  satellites: 12,
  onion: 30,
  bowtie: 12,
  box: 16,
};

/**
 * Fills a shape with as many defenses as it takes to match an ordinary base's firepower times
 * `share`, each picked by `mix` from where it is in the shape.
 */
function fill(
  hq: number,
  shape: ShapeName,
  mix: (role: number, index: number) => BuildingType,
  share = 1.1,
): Spot[] {
  const target = baseWorth(hq) * share;
  let best: Spot[] = [];
  let miss = Number.POSITIVE_INFINITY;
  for (let n = 1; n <= ROOM[shape]; n++) {
    const spots: Spot[] = SHAPES[shape](n).map((p, i) => ({
      type: mix(p.role, i),
      forward: p.forward,
      across: p.across,
    }));
    const types = spots.map((s) => s.type).filter((t): t is BuildingType => t !== "storage");
    const got = worthOf(types, hq);
    // Whichever count comes nearest, over or under: one building more can be a lot on a small base.
    if (Math.abs(got - target) < miss) {
      best = spots;
      miss = Math.abs(got - target);
    }
    if (got >= target) break;
  }
  return best;
}

/** How many of a defense buy this share of an ordinary base's worth, kept between two bounds. */
function enough(hq: number, type: BuildingType, share: number, least: number, most: number) {
  const n = Math.round((baseWorth(hq) * share) / worth(type, hq));
  return Math.max(least, Math.min(most, n));
}

/** Picks one of these by where a building is in its shape. */
const by =
  (...types: BuildingType[]) =>
  (role: number) =>
    types[Math.min(role, types.length - 1)] ?? "gunTurret";
/** Takes it in turns: the first, the second, and round again. */
const turns =
  (...types: BuildingType[]) =>
  (_role: number, index: number) =>
    types[index % types.length] ?? "gunTurret";

// ---------------------------------------------------------------------------------------------
// Layouts with more to them than a shape filled in.

/** Sniper towers round a U, and fire round the headquarters on a strong base. */
function sniperShoe(hq: number): Spot[] {
  const want = enough(hq, "watchtower", 1, 3, 40);
  const n = Math.min(12, want);
  // Past a dozen towers a strong base keeps fire close round the headquarters instead.
  const flames = Math.min(
    8,
    Math.round(((want - n) * worth("watchtower", hq)) / worth("flamethrower", hq)),
  );
  const towers = SHAPES.horseshoe(n).map((p) => ({ ...p, type: "watchtower" as const }));
  const fire = Array.from({ length: flames }, (_, i) => ({
    type: "flamethrower" as const,
    ...around(9, (Math.PI * 2 * (i + 0.5)) / flames),
  }));
  return [...towers, ...fire, { type: "storage", forward: 11, across: 0 }];
}

/**
 * Flamethrowers lining the way in. Mortars behind the headquarters lob into the lanes outside the
 * rows, and guns beside it cover their top end, so picking the flames off from out there still
 * takes moving and care.
 */
function gauntlet(hq: number): Spot[] {
  const flames = Math.ceil(enough(hq, "flamethrower", 0.6, 4, 20) / 2) * 2;
  const mortars = enough(hq, "mortar", 0.35, 1, 6);
  const guns = enough(hq, "gunTurret", 0.3, 1, 6);
  const rows = SHAPES.rows(flames).map((p) => ({ ...p, type: "flamethrower" as const }));
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

// ---------------------------------------------------------------------------------------------
// The layouts.

interface Layout {
  /** The lowest headquarters level it turns up at. */
  from: number;
  /** The highest, for a shape that runs out of room on a strong base. */
  to?: number;
  /** Its shape, for which kinds of island it fits on. */
  shape: ShapeName;
  plan: (hq: number) => Spot[];
}

const LAYOUTS = {
  /** Mortars on every other square. */
  mortarBoard: { from: 3, shape: "board", plan: (hq) => fill(hq, "board", () => "mortar", 1.25) },
  /** Guns and flamethrowers taking turns across the board: no square is safe close up or far. */
  hotBoard: {
    from: 5,
    shape: "board",
    plan: (hq) => fill(hq, "board", turns("gunTurret", "flamethrower")),
  },
  /** Harpoons on the inner squares, mortars on the outer ones. */
  harpoonBoard: {
    from: 4,
    shape: "board",
    plan: (hq) => fill(hq, "board", by("harpoon", "mortar")),
  },
  /** Sniper towers round a U open to the beach. */
  sniperShoe: { from: 4, to: 16, shape: "horseshoe", plan: sniperShoe },
  /** Guns round the U, and mortars round the outer one. */
  gunShoe: {
    from: 3,
    to: 14,
    shape: "horseshoe",
    plan: (hq) => fill(hq, "horseshoe", by("gunTurret", "mortar")),
  },
  /** Harpoons round the U: bad news for anything heavy walking into it. */
  harpoonShoe: {
    from: 4,
    to: 11,
    shape: "horseshoe",
    plan: (hq) => fill(hq, "horseshoe", by("harpoon", "watchtower")),
  },
  /** Flamethrowers lining the way in, with mortars and guns behind. */
  gauntlet: { from: 6, shape: "rows", plan: gauntlet },
  /** Guns lining the way in, and mortars outside them. */
  firingLine: { from: 3, shape: "rows", plan: (hq) => fill(hq, "rows", by("gunTurret", "mortar")) },
  /** Harpoons and towers taking turns along the way in. */
  harpoonAlley: {
    from: 4,
    to: 17,
    shape: "rows",
    plan: (hq) => fill(hq, "rows", turns("harpoon", "watchtower")),
  },
  /** Harpoons all round the headquarters. */
  harpoonRing: { from: 4, shape: "ring", plan: (hq) => fill(hq, "ring", () => "harpoon", 1.05) },
  /** Flamethrowers hugging the headquarters, guns round them. */
  flameRing: {
    from: 5,
    shape: "ring",
    plan: (hq) => fill(hq, "ring", by("flamethrower", "gunTurret")),
  },
  /** Guns and mortars taking turns all round. */
  mixedRing: {
    from: 3,
    shape: "ring",
    plan: (hq) => fill(hq, "ring", turns("gunTurret", "mortar")),
  },
  /** A wall of guns and storages across the way in. */
  picket: { from: 6, shape: "picket", plan: picket },
  /** Two batteries crossing their fire over an open headquarters. */
  crossfire: { from: 5, shape: "batteries", plan: crossfire },
  /** The storages out in the open, ringed by mortars. */
  honeyPot: { from: 4, shape: "yard", plan: honeyPot },
  /** A spiral that gets harder towards the middle: mortars out, guns, then fire at the heart. */
  spiral: {
    from: 5,
    to: 15,
    shape: "spiral",
    plan: (hq) => fill(hq, "spiral", by("flamethrower", "gunTurret", "mortar")),
  },
  /** A spiral of guns and harpoons. */
  gunSpiral: {
    from: 4,
    shape: "spiral",
    plan: (hq) => fill(hq, "spiral", turns("gunTurret", "harpoon")),
  },
  /** Guns down four arms, mortars at the tips. */
  mortarCross: {
    from: 3,
    to: 14,
    shape: "cross",
    plan: (hq) => fill(hq, "cross", by("gunTurret", "mortar")),
  },
  /** Fire close in on the arms, harpoons at the tips. */
  flameCross: {
    from: 5,
    to: 9,
    shape: "cross",
    plan: (hq) => fill(hq, "cross", by("flamethrower", "harpoon")),
  },
  /** Five spokes, each its own kind of defense. */
  spokes: {
    from: 5,
    to: 15,
    shape: "spokes",
    plan: (hq) =>
      fill(hq, "spokes", by("gunTurret", "mortar", "harpoon", "flamethrower", "watchtower")),
  },
  /** A V of guns pointing at the beach, mortars at its point. */
  gunChevron: {
    from: 3,
    to: 11,
    shape: "chevron",
    plan: (hq) => fill(hq, "chevron", by("mortar", "gunTurret")),
  },
  /** A V of sniper towers, with a flamethrower at its point. */
  sniperChevron: {
    from: 5,
    to: 8,
    shape: "chevron",
    plan: (hq) => fill(hq, "chevron", by("flamethrower", "watchtower")),
  },
  /** Towers on a diamond's points, harpoons along its sides. */
  harpoonDiamond: {
    from: 5,
    to: 13,
    shape: "diamond",
    plan: (hq) => fill(hq, "diamond", by("watchtower", "harpoon", "mortar")),
  },
  /** Mortars on the diamond, guns round the outside. */
  mortarDiamond: {
    from: 5,
    to: 17,
    shape: "diamond",
    plan: (hq) => fill(hq, "diamond", by("mortar", "mortar", "gunTurret")),
  },
  /** Three little forts: guns, mortars and harpoons, one kind each. */
  forts: {
    from: 5,
    to: 14,
    shape: "satellites",
    plan: (hq) => fill(hq, "satellites", by("gunTurret", "mortar", "harpoon")),
  },
  /** Three forts of towers and flamethrowers. */
  towerForts: {
    from: 5,
    to: 9,
    shape: "satellites",
    plan: (hq) => fill(hq, "satellites", turns("watchtower", "flamethrower")),
  },
  /** Fire at the heart, guns round it, mortars outside. */
  onion: {
    from: 5,
    shape: "onion",
    plan: (hq) => fill(hq, "onion", by("flamethrower", "gunTurret", "mortar")),
  },
  /** Guns at the heart, sniper towers round the outside. */
  sniperOnion: {
    from: 4,
    shape: "onion",
    plan: (hq) => fill(hq, "onion", by("gunTurret", "watchtower", "watchtower")),
  },
  /** Mortars in front, guns behind. */
  bowtie: {
    from: 3,
    to: 14,
    shape: "bowtie",
    plan: (hq) => fill(hq, "bowtie", by("mortar", "gunTurret")),
  },
  /** Sniper towers on the corners of a square, guns along its walls. */
  boxFort: {
    from: 4,
    shape: "box",
    plan: (hq) => fill(hq, "box", by("watchtower", "gunTurret", "gunTurret")),
  },
  /** Mortars on the corners, flamethrowers along the walls. */
  flameBox: {
    from: 5,
    to: 14,
    shape: "box",
    plan: (hq) => fill(hq, "box", by("mortar", "flamethrower", "flamethrower")),
  },
} satisfies Record<string, Layout | (Omit<Layout, "shape"> & { shape: string })>;

export type Puzzle = keyof typeof LAYOUTS;

export const PUZZLES = LAYOUTS as Record<Puzzle, Omit<Layout, "shape"> & { shape: string }>;

const ORDER = Object.keys(LAYOUTS) as Puzzle[];

/**
 * The kinds of island each shape fits on, from measuring how much of each held its shape on each:
 * a long gauntlet needs a long island, a wall a wide one, and almost nothing fits the cliff fort.
 */
const SUITS: Record<string, readonly Archetype[]> = {
  board: ["cove", "twin", "volcano", "atoll", "chain"],
  horseshoe: ["cove", "twin", "volcano", "atoll", "chain"],
  rows: ["cove", "key", "volcano", "ridge"],
  ring: ["cove", "hook", "key", "twin", "volcano", "atoll", "chain"],
  picket: ["atoll", "ridge"],
  batteries: ["cove", "volcano", "atoll"],
  yard: ["cove", "volcano"],
  spiral: ["cove", "volcano", "atoll", "chain"],
  cross: ["cove", "twin", "volcano", "atoll", "chain"],
  spokes: ["cove", "twin", "volcano", "atoll", "chain"],
  chevron: ["cove", "volcano", "atoll", "ridge", "chain"],
  diamond: ["cove", "hook", "key", "twin", "volcano", "atoll", "chain"],
  satellites: ["volcano", "atoll", "chain"],
  onion: ["cove", "hook", "key", "twin", "volcano", "atoll", "chain"],
  bowtie: ["cove", "key", "volcano"],
  box: ["cove", "twin", "volcano", "atoll", "chain"],
};

/** Which kinds of island a layout fits on. */
export function suitsOf(puzzle: Puzzle): readonly Archetype[] {
  return SUITS[PUZZLES[puzzle].shape] ?? [];
}

/** Whether a layout turns up at a headquarters level at all. */
export function inRange(puzzle: Puzzle, hq: number): boolean {
  const { from, to = Number.POSITIVE_INFINITY } = PUZZLES[puzzle];
  return hq >= from && hq <= to;
}

/** Which puzzle an island is, if it's one at all. */
export function puzzleFor(seed: number, hq: number): Puzzle | null {
  if (hq < FIRST_PUZZLE_HQ) return null;
  const rng = createRng(seed ^ 0x9a221e);
  if (rng() >= PUZZLE_SHARE) return null;
  const kind = archetypeFor(seed, hq);
  const fits = ORDER.filter((p) => inRange(p, hq) && suitsOf(p).includes(kind));
  return fits[Math.floor(rng() * fits.length)] ?? null;
}

/** Where a puzzle puts things at a headquarters level. */
export function puzzlePlan(puzzle: Puzzle, hq: number): Spot[] {
  return PUZZLES[puzzle].plan(hq);
}

/** The defenses a puzzle island has, for its card. */
export function puzzleDefenses(puzzle: Puzzle, hq: number): number {
  return puzzlePlan(puzzle, hq).filter((s) => s.type !== "storage" && BUILDINGS[s.type].attack)
    .length;
}
