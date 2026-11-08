// The world: one endless sea of islands, the same for every crew, laid out in regions from a seed.
// Each region holds a loose scatter of enemy islands. Their headquarters follow the crew's, from
// easy to impossible, and the further from home the likelier a hard one, up to headquarters 50. Cloud covers all of it but a splotch of clear sky round home: every few
// islands won clears another, small one, over the nearest hidden island on whichever side has seen
// the least, so the crew's world grows outward evenly and more slowly than they conquer it. Plenty
// of the sea stays empty, so the map never crowds. Islands a crew has taken stay theirs until
// raiders retake one in the night, which brings it back stronger. No engine imports.

import { BUILDINGS, type BuildingType } from "./buildings";
import type { PlacedBuilding } from "./crewIsland";
import { type CrystalKind, islandCrystal } from "./crystals";
import { type Difficulty, difficultyOf, hqInBand, rollBand } from "./difficulty";
import { allowedCount, MAX_HQ_LEVEL, type Purse } from "./economy";
import { type RaidReward, raidReward } from "./heroProgress";
import { ARCHETYPES, type Archetype, archetypeFor } from "./islandShapes";
import { type Puzzle, puzzleDefenses, puzzleFor } from "./puzzles";
import { createRng } from "./rng";

/** Another crew's base, standing on a player island of the map. */
export interface Rival {
  /** Their crew code, or empty for a stand-in while nobody's there to fill the spot. */
  code: string;
  name: string;
  hq: number;
  /** Their island as it stood; empty for a stand-in, whose base grows from the island's seed. */
  buildings: PlacedBuilding[];
  /** What their statues add to their buildings. */
  buffs?: { health: number; damage: number };
}

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
  /** What kind of island it is. Player islands are all on the crew island's own coast. */
  archetype: Archetype | "player";
  /** The puzzle its defenses are laid out as, if they are. */
  puzzle: Puzzle | null;
  /** The crystal its headquarters holds. */
  crystal: CrystalKind;
  /** A player island: the crew living there, whoever they are right now. */
  rival: Rival | null;
  /** What it pays each day while the crew holds it. */
  tribute: number;
  /** A raider ship's own base, struck back at: what its raid took, won back along with it. */
  revenge?: Partial<Purse>;
}

/** What a crew has done to the map. */
export interface WorldProgress {
  /** Islands the crew holds, each with a little clear sky of its own. */
  taken: string[];
  /** Islands raiders have taken back, and the headquarters level they rebuilt to. */
  retaken: Record<string, number>;
  /** The islands a splotch of cloud has lifted over, by id. Older saves list regions instead. */
  opened: string[];
  /** Islands won towards lifting the next cloud. */
  progress: number;
  /** Which crew is on each player island, by island id. */
  rivals: Record<string, Rival>;
  /** Crews this one has beaten lately, so a spot comes back with someone new. */
  beaten: string[];
}

export const NEW_WORLD: WorldProgress = {
  taken: [],
  retaken: {},
  opened: [],
  progress: 0,
  rivals: {},
  beaten: [],
};

/** Each region keeps this many of its islands for other crews to live on. */
const PLAYER_ISLANDS_PER_REGION = 2;
/** A conquered player island pays a little gold each day: a base, and more for a stronger crew. */
const TRIBUTE_GOLD = 60;
const TRIBUTE_PER_HQ = 20;
/** Crews remembered as beaten. */
const MOST_BEATEN = 12;

export function tributeFor(hq: number): number {
  return TRIBUTE_GOLD + TRIBUTE_PER_HQ * hq;
}

/** A region's size in map units. Wider than tall, like the screen. */
export const REGION = { w: 112, h: 66 } as const;

const HOME_REGION = "0,0";
/** Islands to win for each splotch of cloud that lifts. */
const ISLANDS_PER_CLOUD = 3;
/** How far each splotch of clear sky reaches. */
const HOME_REACH = 42;
const SPLOTCH_REACH = 24;
/** How much clear sky an island a crew holds or has lost keeps round it, past its shore. */
const OWN_CLEARING = 7;
/** How hard a splotch is pushed away from whichever side has already seen the most. */
const EVEN_OUT = 0.9;
/** The share of charted islands left out of the world, so it's mostly open sea. */
const EMPTY_SEA = 0.5;
/** A crew never has fewer islands than this to raid: more cloud lifts first. */
const FEWEST_OPEN = 2;
const ISLANDS_PER_REGION = [6, 8] as const;
/** Kept clear round the crew's own island and the gunboat beside it. */
const HOME_CLEAR = 14;
/** How far from home (map units) one more headquarters level is. */
const UNITS_PER_LEVEL = 34;

/**
 * How snowy the sea is at a spot, 0 to 1: none round home, then colder the further north, snow
 * on the islands and icebergs in the water from about a region and a half up.
 */
export function snowAt(y: number): number {
  const t = Math.min(1, Math.max(0, (-y - SNOW_FROM) / (SNOW_FULL - SNOW_FROM)));
  return t * t * (3 - 2 * t);
}

const SNOW_FROM = 60;
const SNOW_FULL = 120;

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

interface Charted {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  size: number;
  seed: number;
  /** How far out it is, in headquarters levels: further out, a hard base is likelier. */
  hq: number;
  /** Kept for another crew to live on. */
  player: boolean;
  /** Left out of the world, unless a save from before says the crew has been there. */
  empty: boolean;
}

const CREW_START = [
  "Salty",
  "Rum",
  "Sunset",
  "Stormy",
  "Lucky",
  "Crooked",
  "Golden",
  "Tide",
  "Wild",
  "Old",
] as const;
const CREW_END = [
  "Dogs",
  "Runners",
  "Corsairs",
  "Wreckers",
  "Gulls",
  "Sharks",
  "Rovers",
  "Marauders",
] as const;

/** Stands in for a real crew until one comes along, so no player island is ever empty. */
function standIn(island: Charted, yourHq: number): Rival {
  const rng = createRng(island.seed ^ 0xc4e3);
  const start = CREW_START[Math.floor(rng() * CREW_START.length)];
  const end = CREW_END[Math.floor(rng() * CREW_END.length)];
  const hq = Math.max(1, yourHq - 1 + Math.floor(rng() * 3));
  return { code: "", name: `The ${start} ${end}`, hq, buildings: [] };
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
    player: false,
    empty: false,
  }));
  // Picked after everything else is settled, so these islands keep their seeds and ids.
  const nearest = [...islands].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  for (const island of nearest.slice(0, PLAYER_ISLANDS_PER_REGION)) island.player = true;
  // Worked out on the side, so nothing about the islands that stay has changed.
  for (const island of islands) {
    island.empty = !island.player && createRng(island.seed ^ 0xe5a)() < EMPTY_SEA;
  }
  charted.set(region, islands);
  return islands;
}

/**
 * A raider base's headquarters before it's been retaken, by the crew's and its own luck, and the
 * band it was rolled in: a base can't go below headquarters 1, so an easy one is easy by its roll.
 */
function raiderBase(island: Charted, yourHq: number): { hq: number; band: Difficulty } {
  const rng = createRng(island.seed ^ 0xd1ff);
  const band = rollBand(rng(), (island.hq - 3) * 0.05);
  return { hq: hqInBand(band, yourHq, rng()), band };
}

function dress(island: Charted, world: WorldProgress, yourHq: number): MapIsland {
  const rival = island.player ? (world.rivals[island.id] ?? standIn(island, yourHq)) : null;
  const raised = rival ? undefined : world.retaken[island.id];
  const fresh = rival || raised !== undefined ? null : raiderBase(island, yourHq);
  const hq = rival?.hq ?? raised ?? fresh?.hq ?? 1;
  const tier = islandTier(hq);
  const rated = Math.min(hq, MAX_HQ_LEVEL);
  // A rebuilt base is a new layout, not the old one with its levels raised.
  const seed = raised ? island.seed + raised : island.seed;
  const puzzle = rival ? null : puzzleFor(seed, hq);
  return {
    ...island,
    hq,
    seed,
    tier,
    difficulty: fresh?.band ?? difficultyOf(hq, yourHq),
    defenses: puzzle
      ? puzzleDefenses(puzzle, rated)
      : DEFENSES.reduce((sum, t) => sum + allowedCount(t, rated), 0),
    reward: raidReward(true, 100, tier),
    taken: world.taken.includes(island.id),
    retaken: raised !== undefined,
    archetype: rival ? "player" : archetypeFor(seed, hq),
    puzzle,
    crystal: islandCrystal(seed),
    rival,
    tribute: rival ? tributeFor(hq) : 0,
  };
}

/**
 * The base a raider ship sailed from, for striking back after its raid got through. It isn't on
 * the map and can't be held: winning there wins back what the raid took.
 */
export function raiderHome(
  ship: { hq: number; difficulty: Difficulty; crew: string; homeSeed: number },
  day: number,
  stolen: Partial<Purse>,
): MapIsland {
  const { hq, homeSeed: seed } = ship;
  const tier = islandTier(hq);
  const rated = Math.min(hq, MAX_HQ_LEVEL);
  return {
    id: `raiders:${day}`,
    name: `${ship.crew}' hideout`,
    x: 0,
    y: 0,
    size: 1,
    region: "",
    seed,
    hq,
    tier,
    difficulty: ship.difficulty,
    defenses: DEFENSES.reduce((sum, t) => sum + allowedCount(t, rated), 0),
    reward: raidReward(true, 100, tier),
    taken: false,
    retaken: false,
    archetype: archetypeFor(seed, hq),
    puzzle: null,
    crystal: islandCrystal(seed),
    rival: null,
    tribute: 0,
    revenge: stolen,
  };
}

/** The short name of an island's kind, for its card. */
export function archetypeLabel(island: MapIsland): string {
  return island.archetype === "player" ? "Player island" : ARCHETYPES[island.archetype].label;
}

/** How to go about taking an island, for its card. */
export function archetypeTip(island: MapIsland): string {
  return island.archetype === "player" ? "" : ARCHETYPES[island.archetype].tip;
}

/** The player islands in a region list with nobody real on them yet. */
export function openSpots(islands: readonly MapIsland[]): MapIsland[] {
  return islands.filter((i) => i.rival && !i.rival.code && !i.taken);
}

/** Moves real crews onto open player islands, leaving out anyone just beaten. */
export function settleRivals(
  world: WorldProgress,
  islands: readonly MapIsland[],
  crews: readonly Rival[],
): WorldProgress {
  const placed = new Set(Object.values(world.rivals).map((r) => r.code));
  const fresh = crews.filter((c) => !placed.has(c.code) && !world.beaten.includes(c.code));
  const rivals = { ...world.rivals };
  for (const spot of openSpots(islands)) {
    const crew = fresh.shift();
    if (!crew) break;
    rivals[spot.id] = crew;
  }
  return { ...world, rivals };
}

/** A player island's crew has been beaten: they won't turn up again for a while. */
export function beatRival(world: WorldProgress, rival: Rival): WorldProgress {
  if (!rival.code) return world;
  return { ...world, beaten: [rival.code, ...world.beaten].slice(0, MOST_BEATEN) };
}

/** What a raider island the crew holds turns out each day, by its headquarters level. */
const CARGO_BASE = 40;
const CARGO_PER_HQ = 15;

/**
 * A day's cargo from the islands the crew holds, which the supply ship brings each morning: gold
 * from the crews on player islands, and materials from the raider islands.
 */
export function dailyCargo(world: WorldProgress, yourHq: number): Partial<Purse> {
  const cargo = { gold: 0, timber: 0, stone: 0, scrap: 0 };
  for (const id of world.taken) {
    const island = chartedIsland(id);
    if (!island) continue;
    if (island.player) {
      cargo.gold += tributeFor(world.rivals[id]?.hq ?? island.hq);
      continue;
    }
    const base = CARGO_BASE + CARGO_PER_HQ * raiderBase(island, yourHq).hq;
    cargo.gold += base;
    cargo.timber += base;
    cargo.stone += Math.round(base * 0.6);
    cargo.scrap += Math.round(base * 0.3);
  }
  const out: Partial<Purse> = {};
  for (const [r, n] of Object.entries(cargo) as [keyof Purse, number][]) if (n > 0) out[r] = n;
  return out;
}

/** Where an island lies, from its id. */
export function islandSpot(id: string): { x: number; y: number } | null {
  return chartedIsland(id) ?? null;
}

/** One island, from its id. */
function chartedIsland(id: string): Charted | undefined {
  const [region = HOME_REGION] = id.split(":");
  const { column, row } = parseRegion(region);
  return chartRegion(column, row).find((i) => i.id === id);
}

/** One circle of clear sky. A splotch is a few of them, so its edge wanders. */
export interface SkyHole {
  x: number;
  y: number;
  radius: number;
}

/** A splotch: a big circle, with smaller ones bulging out of it wherever the seed says. */
function splotch(x: number, y: number, reach: number, seed: number): SkyHole[] {
  const rng = createRng(seed ^ 0x51e7);
  const holes: SkyHole[] = [{ x, y, radius: reach * 0.8 }];
  const lobes = 4 + Math.floor(rng() * 3);
  const turn = rng() * Math.PI * 2;
  for (let i = 0; i < lobes; i++) {
    const angle = turn + ((i + rng() * 0.7) / lobes) * Math.PI * 2;
    const out = reach * (0.55 + rng() * 0.45);
    holes.push({
      // Wider than tall, like the screen.
      x: x + Math.cos(angle) * out * 1.25,
      y: y + Math.sin(angle) * out * 0.8,
      radius: reach * (0.35 + rng() * 0.3),
    });
  }
  return holes;
}

/** Islands that are the crew's business, whoever holds them right now. */
function owned(world: WorldProgress): string[] {
  return [...world.taken, ...Object.keys(world.retaken)];
}

/** Every splotch of clear sky on a crew's map. */
export function clearSky(world: WorldProgress): SkyHole[] {
  const holes = splotch(0, 0, HOME_REACH, 1);
  for (const key of world.opened) {
    const island = chartedIsland(key);
    if (island) holes.push(...splotch(island.x, island.y, SPLOTCH_REACH, island.seed));
  }
  for (const key of owned(world)) {
    const island = chartedIsland(key);
    if (!island) continue;
    holes.push({ x: island.x, y: island.y, radius: islandRadius(island.size) + OWN_CLEARING });
  }
  return holes;
}

function underClearSky(island: Spot, sky: readonly SkyHole[]): boolean {
  return sky.some((h) => Math.hypot(island.x - h.x, island.y - h.y) < h.radius);
}

/** Every charted island within a region or so of the clear sky. */
function chartedNear(sky: readonly SkyHole[], margin: number): Charted[] {
  const edges = (pick: (h: SkyHole) => number, size: number) => {
    const spots = sky.map(pick);
    return {
      low: Math.floor(Math.min(...spots) / size + 0.5) - margin,
      high: Math.floor(Math.max(...spots) / size + 0.5) + margin,
    };
  };
  const west = edges((h) => h.x - h.radius, REGION.w);
  const east = edges((h) => h.x + h.radius, REGION.w);
  const north = edges((h) => h.y - h.radius, REGION.h);
  const south = edges((h) => h.y + h.radius, REGION.h);
  const islands: Charted[] = [];
  for (let column = west.low; column <= east.high; column++) {
    for (let row = north.low; row <= south.high; row++) {
      islands.push(...chartRegion(column, row));
    }
  }
  return islands;
}

/** Every island out from under the cloud. */
export function worldIslands(world: WorldProgress, yourHq: number): MapIsland[] {
  const sky = clearSky(world);
  const ours = new Set(owned(world));
  return chartedNear(sky, 0)
    .filter((island) => underClearSky(island, sky) && (!island.empty || ours.has(island.id)))
    .map((island) => dress(island, world, yourHq));
}

/** Kept clear round an island, or home, by the raider ship lying at anchor, in map units. */
const SHIP_CLEAR = 6;

/**
 * Where a raider ship lies on the map: somewhere in open water the crew can see, clear of the
 * islands, picked by its seed so every phone puts it in the same place.
 */
export function shipSpot(
  world: WorldProgress,
  islands: readonly MapIsland[],
  seed: number,
): { x: number; y: number } {
  const rng = createRng(seed);
  const sky = clearSky(world);
  const clear = (x: number, y: number) =>
    Math.hypot(x, y) > HOME_CLEAR + SHIP_CLEAR &&
    islands.every((i) => Math.hypot(i.x - x, i.y - y) > islandRadius(i.size) + SHIP_CLEAR) &&
    sky.some((h) => Math.hypot(h.x - x, h.y - y) < h.radius - SHIP_CLEAR);
  for (let tries = 0; tries < 200; tries++) {
    const hole = sky[Math.floor(rng() * sky.length)];
    if (!hole) break;
    const angle = rng() * Math.PI * 2;
    const reach = Math.sqrt(rng()) * hole.radius;
    const x = hole.x + Math.cos(angle) * reach;
    const y = hole.y + Math.sin(angle) * reach;
    if (clear(x, y)) return { x, y };
  }
  return { x: HOME_CLEAR + SHIP_CLEAR, y: -HOME_CLEAR };
}

/** How many more islands to win before the next splotch of cloud lifts. */
export function islandsToNextCloud(world: WorldProgress): number {
  return ISLANDS_PER_CLOUD - world.progress;
}

/**
 * Which hidden island the next splotch clears: the nearest to home, favoring whichever side has
 * seen the least, so the map never reaches far out one way and stays short the other.
 */
function nextSplotch(world: WorldProgress): Charted | undefined {
  const sky = clearSky(world);
  const lean = {
    x: sky.reduce((sum, h) => sum + h.x, 0) / sky.length,
    y: sky.reduce((sum, h) => sum + h.y, 0) / sky.length,
  };
  let best: Charted | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const island of chartedNear(sky, 1)) {
    if (island.empty || underClearSky(island, sky)) continue;
    const away = Math.hypot(island.x, island.y * 1.4);
    const score = away + ((island.x * lean.x + island.y * lean.y) / (away || 1)) * EVEN_OUT;
    if (score < bestScore) {
      best = island;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The crew wins an island: it's theirs, and every few wins lifts one splotch of cloud. Won islands
 * open the way for good: losing one later won't bring the cloud back.
 */
export function takeIsland(world: WorldProgress, id: string): WorldProgress {
  if (world.taken.includes(id)) return world;
  const retaken = { ...world.retaken };
  delete retaken[id];
  const next: WorldProgress = { ...world, taken: [...world.taken, id], retaken };
  const lifted = next.progress + 1 >= ISLANDS_PER_CLOUD;
  return topUp({
    ...liftCloud(next, lifted ? 1 : 0),
    progress: lifted ? 0 : next.progress + 1,
  });
}

/** Clears this many more splotches. */
function liftCloud(world: WorldProgress, splotches: number): WorldProgress {
  let out = world;
  for (let i = 0; i < splotches; i++) {
    const cleared = nextSplotch(out);
    if (cleared) out = { ...out, opened: [...out.opened, cleared.id] };
  }
  return out;
}

function islandsOpen(world: WorldProgress): number {
  return worldIslands(world, 1).filter((island) => !island.taken).length;
}

/** Lifts more cloud rather than leave a crew with nothing to raid. */
function topUp(world: WorldProgress): WorldProgress {
  let out = world;
  for (let tries = 0; tries < 6 && islandsOpen(out) < FEWEST_OPEN; tries++) {
    out = liftCloud(out, 1);
  }
  return out;
}

/** Saves from before splotches list whole regions: each becomes a splotch, as if newly lifted. */
function regionsToSplotches(world: WorldProgress): WorldProgress {
  const opened = world.opened.filter((key) => key.includes(":"));
  const regions = world.opened.length - opened.length;
  return regions > 0 ? liftCloud({ ...world, opened }, regions) : world;
}

/** The share of a crew's islands taken back each night. */
const RETAKEN_SHARE = 0.2;

/**
 * The night's move: raiders and rival crews take back a fifth of the crew's islands, a part of an
 * island being a chance of a whole one. Each comes back with a stronger headquarters, built
 * up to everything that level allows.
 */
export function retakeIslands(
  world: WorldProgress,
  night: number,
  yourHq: number,
): { world: WorldProgress; lost: string[] } {
  const rng = createRng(Math.imul(night, 6151) + 97);
  const share = RETAKEN_SHARE * world.taken.length;
  const count = Math.floor(share) + (rng() < share % 1 ? 1 : 0);
  const taken = [...world.taken];
  const retaken = { ...world.retaken };
  const rivals = { ...world.rivals };
  const lost: string[] = [];
  for (let i = 0; i < count && taken.length > 0; i++) {
    const [id] = taken.splice(Math.floor(rng() * taken.length), 1);
    const island = id ? chartedIsland(id) : undefined;
    if (!id || !island) continue;
    lost.push(island.name);
    // A player island doesn't go back to raiders: another crew moves in.
    if (island.player) {
      delete rivals[id];
      continue;
    }
    const before = world.retaken[id] ?? raiderBase(island, yourHq).hq;
    retaken[id] = Math.max(before + 1, yourHq) + Math.floor(rng() * 2);
  }
  return { world: { ...world, taken, retaken, rivals }, lost };
}

function readRival(value: unknown): Rival | null {
  const v = value as Partial<Rival> | null;
  if (typeof v?.name !== "string" || !Number.isInteger(v.hq)) return null;
  return {
    code: typeof v.code === "string" ? v.code : "",
    name: v.name.slice(0, 32),
    hq: Math.max(1, v.hq as number),
    buildings: Array.isArray(v.buildings) ? v.buildings : [],
    buffs: v.buffs,
  };
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
  const rivals: Record<string, Rival> = {};
  if (v?.rivals && typeof v.rivals === "object") {
    for (const [id, value] of Object.entries(v.rivals)) {
      const rival = readRival(value);
      if (rival) rivals[id] = rival;
    }
  }
  return regionsToSplotches({
    taken: ids(v?.taken),
    retaken,
    opened: ids(v?.opened),
    progress,
    rivals,
    beaten: ids(v?.beaten).slice(0, MOST_BEATEN),
  });
}
