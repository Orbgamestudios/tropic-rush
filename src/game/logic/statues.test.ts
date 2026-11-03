import { describe, expect, it } from "vitest";
import {
  applyOp,
  applyRivalRaid,
  buildBlocker,
  type CrewLayout,
  clearBlocker,
  fits,
  gunboatWeapons,
  HOME_CLIFFS,
  isBuildableTile,
  obstacles,
  production,
  researchBlocker,
  researchCost,
  restoreBlocker,
  sanitizeLayout,
  settle,
  starterLayout,
  statueSites,
  tileAt,
  weaponUpBlocker,
} from "./crewIsland";
import { CRYSTAL_KINDS, type CrystalKind } from "./crystals";
import { MAX_WEAPON_LEVEL, WEAPON_LEVEL_HQ, weaponUpGold } from "./gunboat";
import { STATUE_CRYSTALS, STATUE_MS, STATUE_STONE, statueBuffs } from "./statues";

const NOW = 1_000_000_000_000;

function island(changes: Partial<CrewLayout> = {}): CrewLayout {
  return { ...starterLayout(NOW), ...changes };
}

/** An island with every tool at its best and plenty of everything. */
function equipped(): CrewLayout {
  const start = starterLayout(NOW);
  const hidden = statueSites(start.relicSeed).map((s) => s.patch.id);
  return island({
    tools: { axe: 5, pickaxe: 5, chainsaw: 5, dynamite: 5 },
    resources: { gold: 20_000, timber: 20_000, stone: 20_000, scrap: 20_000 },
    buildings: start.buildings.map((b) => ({ ...b, level: 20 })),
    cleared: obstacles()
      .map((o) => o.id)
      .filter((id) => !hidden.includes(id)),
  });
}

function site(layout: CrewLayout, kind: CrystalKind) {
  const found = statueSites(layout.relicSeed).find((s) => s.statue === kind);
  if (!found) throw new Error(`no ${kind} statue`);
  return found.patch;
}

function found(layout: CrewLayout, kinds: readonly CrystalKind[]): CrewLayout {
  const statues = { ...layout.statues };
  for (const k of kinds) statues[k] = { ...statues[k], found: true };
  return { ...layout, statues };
}

const FORTNIGHT = 3600 * 1000 * 24 * 14;

/** Clears a statue's patch, start to finish, a good while after the island was last looked at. */
function dig(layout: CrewLayout, kind: CrystalKind): CrewLayout {
  const patch = site(layout, kind);
  const now = layout.stamp + 1;
  const job = applyOp(layout, { kind: "clear", id: patch.id }, now);
  if (!job) throw new Error(`can't clear ${kind}: ${clearBlocker(layout, patch)}`);
  return settle(job, now + FORTNIGHT);
}

describe("hiding the statues", () => {
  it("hides one of each, every crew in different places, the same on every phone", () => {
    const here = statueSites(12345);
    expect(here.map((s) => s.statue)).toEqual([...CRYSTAL_KINDS]);
    expect(statueSites(12345)).toEqual(here);
    const there = statueSites(54321).map((s) => s.patch.id);
    expect(there).not.toEqual(here.map((s) => s.patch.id));
  });

  it("buries them in rock and forest, each further out than the last", () => {
    const spots = statueSites(777);
    expect(spots.map((s) => s.patch.tier)).toEqual([2, 3, 4, 5]);
    for (const { patch } of spots) expect(["rocks", "jungle"]).toContain(patch.kind);
  });

  it("finds them in order, however the crew goes about it", () => {
    const start = equipped();
    expect(clearBlocker(start, site(start, "nature"))).toBeNull();
    expect(clearBlocker(start, site(start, "ice"))).toMatch(/won't budge/);
    expect(clearBlocker(start, site(start, "fire"))).toMatch(/won't budge/);
    expect(clearBlocker(start, site(start, "dark"))).toMatch(/won't budge/);
    let layout = dig(start, "nature");
    expect(layout.statues.nature.found).toBe(true);
    expect(clearBlocker(layout, site(layout, "ice"))).toBeNull();
    expect(clearBlocker(layout, site(layout, "fire"))).toMatch(/won't budge/);
    layout = dig(layout, "ice");
    layout = dig(layout, "fire");
    expect(clearBlocker(layout, site(layout, "dark"))).toBeNull();
    layout = dig(layout, "dark");
    for (const k of CRYSTAL_KINDS) expect(layout.statues[k].found).toBe(true);
  });

  it("keeps building off a statue, found or not", () => {
    const layout = dig(equipped(), "nature");
    const patch = site(layout, "nature");
    const candidate = {
      id: "t",
      type: "landmine" as const,
      x: patch.x,
      y: patch.y,
      rotated: false,
    };
    expect(fits(layout, candidate)).toBe(false);
  });
});

describe("restoring a statue", () => {
  const ready = () => found(equipped(), ["nature"]);

  it("takes 10 crystals, 5,000 stone and two days", () => {
    expect(STATUE_CRYSTALS).toBe(10);
    expect(STATUE_STONE).toBe(5000);
    expect(STATUE_MS).toBe(2 * 24 * 3600 * 1000);
  });

  it("can't start till it has its crystals and stone", () => {
    const start = ready();
    expect(restoreBlocker(start, "nature")).toMatch(/crystals/);
    const given = applyOp(start, { kind: "offer", statue: "nature", crystals: 10 }, NOW);
    if (!given) throw new Error("offer refused");
    expect(restoreBlocker(given, "nature")).toBeNull();
    const poor = { ...given, resources: { ...given.resources, stone: 4999 } };
    expect(restoreBlocker(poor, "nature")).toMatch(/stone/);
    expect(applyOp(poor, { kind: "restore", statue: "nature" }, NOW)).toBeNull();
  });

  it("takes offerings from anyone, a few at a time, and no more than it needs", () => {
    let layout = ready();
    layout = applyOp(layout, { kind: "offer", statue: "nature", crystals: 4 }, NOW) ?? layout;
    layout = applyOp(layout, { kind: "offer", statue: "nature", crystals: 9 }, NOW) ?? layout;
    expect(layout.statues.nature.crystals).toBe(10);
    expect(applyOp(layout, { kind: "offer", statue: "nature", crystals: 0 }, NOW)).toBeNull();
    expect(applyOp(island(), { kind: "offer", statue: "ice", crystals: 3 }, NOW)).toBeNull();
  });

  it("spends the stone, and blesses the island two days later", () => {
    let layout = ready();
    layout = applyOp(layout, { kind: "offer", statue: "nature", crystals: 10 }, NOW) ?? layout;
    const before = layout.resources.stone;
    layout = applyOp(layout, { kind: "restore", statue: "nature" }, NOW) ?? layout;
    expect(layout.statues.nature.doneAt).toBe(NOW + STATUE_MS);
    expect(layout.resources.stone).toBe(before - 5000);
    expect(settle(layout, NOW + STATUE_MS - 1000).statues.nature.restored).toBe(false);
    expect(settle(layout, NOW + STATUE_MS + 1000).statues.nature.restored).toBe(true);
  });

  it("gives each statue its own blessing", () => {
    const with_ = (kind: CrystalKind) =>
      statueBuffs({ ...island().statues, [kind]: { ...island().statues[kind], restored: true } });
    expect(statueBuffs(island().statues).health).toBe(1);
    expect(with_("nature").health).toBeGreaterThan(1);
    expect(with_("fire").damage).toBeGreaterThan(1);
    expect(with_("ice").production).toBeGreaterThan(1);
    expect(with_("ice").plunder).toBeGreaterThan(1);
    expect(with_("dark").luck).toBeGreaterThan(1);
    expect(with_("nature").damage).toBe(1);
  });

  it("speeds up the mills once the Statue of Ice is whole", () => {
    const mill = {
      id: "m",
      type: "goldMine" as const,
      x: 0,
      y: 0,
      rotated: false,
      level: 1,
    };
    const buildings = [...starterLayout(NOW).buildings, mill];
    const plain = production({ buildings, statues: island().statues });
    const statues = { ...island().statues, ice: { ...island().statues.ice, restored: true } };
    expect(production({ buildings, statues }).gold).toBeCloseTo(plain.gold * 1.2);
  });

  it("keeps statues through a trip to the server and back", () => {
    const given = applyOp(ready(), { kind: "offer", statue: "nature", crystals: 3 }, NOW);
    const back = sanitizeLayout(JSON.parse(JSON.stringify(given)), NOW);
    expect(back.statues.nature).toEqual({
      found: true,
      crystals: 3,
      doneAt: null,
      restored: false,
    });
    expect(back.relicSeed).toBe(given?.relicSeed);
  });
});

describe("blueprints", () => {
  it("lets a new crew build the gun turret, and nothing else that fights", () => {
    const layout = island({
      buildings: starterLayout(NOW).buildings.map((b) => ({ ...b, level: 12 })),
      resources: { gold: 9000, timber: 9000, stone: 9000, scrap: 9000 },
    });
    expect(buildBlocker(layout, "gunTurret")).toBeNull();
    expect(buildBlocker(layout, "mortar")).toMatch(/blueprint/);
    expect(buildBlocker(layout, "harpoon")).toMatch(/blueprint/);
    expect(buildBlocker(layout, "flamethrower")).toMatch(/blueprint/);
    expect(buildBlocker(layout, "landmine")).toMatch(/blueprint/);
    expect(buildBlocker(layout, "goldMine")).toBeNull();
  });

  it("reaches the whole crew once, and waits for the laboratory", () => {
    const start = island({
      resources: { gold: 9000, timber: 9000, stone: 9000, scrap: 9000 },
    });
    const learned = applyOp(start, { kind: "blueprint", type: "mortar" }, NOW);
    if (!learned) throw new Error("refused");
    expect(learned.blueprints).toEqual(["mortar"]);
    expect(buildBlocker(learned, "mortar")).toMatch(/laboratory/);
    const again = applyOp(learned, { kind: "blueprint", type: "mortar" }, NOW);
    expect(again?.blueprints).toEqual(["mortar"]);
    expect(applyOp(start, { kind: "blueprint", type: "goldMine" }, NOW)).toBeNull();
  });

  const lab = { id: "lab", type: "laboratory" as const, x: 0, y: 0, rotated: false, level: 1 };

  it("turns a blueprint and some gold into the real thing at the laboratory", () => {
    const start = island({
      resources: { gold: 9000, timber: 9000, stone: 9000, scrap: 9000 },
      blueprints: ["mortar"],
    });
    expect(researchBlocker(start, "mortar")).toMatch(/Build a laboratory/);
    const equippedLab = { ...start, buildings: [...start.buildings, lab] };
    expect(researchBlocker(equippedLab, "harpoon")).toMatch(/blueprint/);
    expect(researchBlocker(equippedLab, "mortar")).toBeNull();
    const done = applyOp(equippedLab, { kind: "research", type: "mortar" }, NOW);
    if (!done) throw new Error("refused");
    expect(done.researched).toEqual(["mortar"]);
    expect(done.resources.gold).toBe(9000 - (researchCost("mortar").gold ?? 0));
    expect(buildBlocker(done, "mortar")).toBeNull();
    expect(applyOp(done, { kind: "research", type: "mortar" }, NOW)).toBeNull();
  });

  it("won't research without the gold, or in a laboratory that's still going up", () => {
    const poor = island({
      resources: { gold: 10, timber: 0, stone: 0, scrap: 0 },
      blueprints: ["heal"],
      buildings: [...starterLayout(NOW).buildings, lab],
    });
    expect(researchBlocker(poor, "heal")).toMatch(/gold/);
    const rising = { ...poor, buildings: [...poor.buildings.slice(0, 1), { ...lab, level: 0 }] };
    expect(researchBlocker(rising, "heal")).toMatch(/Build a laboratory/);
  });

  it("starts the gunboat with artillery, and adds what's been researched, in order", () => {
    expect(gunboatWeapons(island())).toEqual({ artillery: 1 });
    expect(gunboatWeapons(island({ researched: ["smoke", "heal"] }))).toEqual({
      artillery: 1,
      heal: 1,
      smoke: 1,
    });
  });

  it("levels gunboat weapons up, 3 or 4 headquarters levels apart", () => {
    for (let i = 1; i < WEAPON_LEVEL_HQ.length; i++) {
      const step = (WEAPON_LEVEL_HQ[i] ?? 0) - (WEAPON_LEVEL_HQ[i - 1] ?? 0);
      expect([3, 4]).toContain(step);
    }
    const at = (hq: number, level = 1) => {
      const [first, ...rest] = starterLayout(NOW).buildings;
      return island({
        resources: { gold: 90_000, timber: 0, stone: 0, scrap: 0 },
        buildings: [{ ...first, level: hq } as (typeof rest)[number], lab, ...rest],
        weaponLevels: level > 1 ? { artillery: level } : {},
      });
    };
    expect(weaponUpBlocker(at(3), "artillery")).toMatch(/headquarters 4/);
    expect(weaponUpBlocker(at(4), "artillery")).toBeNull();
    expect(weaponUpBlocker(at(4), "shock")).toMatch(/Research/);
    expect(weaponUpBlocker(at(7, 2), "artillery")).toMatch(/headquarters 8/);
    expect(weaponUpBlocker(at(20, MAX_WEAPON_LEVEL), "artillery")).toMatch(/Highest/);
    const up = applyOp(at(4), { kind: "weaponUp", weapon: "artillery" }, NOW);
    if (!up) throw new Error("refused");
    expect(gunboatWeapons(up).artillery).toBe(2);
    expect(up.resources.gold).toBe(90_000 - weaponUpGold(1));
    expect(sanitizeLayout(up, NOW).weaponLevels).toEqual({ artillery: 2 });
  });

  it("keeps what an older crew knew, but not gunboat weapons it never researched", () => {
    const old = {
      ...starterLayout(NOW),
      researched: undefined,
      blueprints: ["mortar"],
    };
    const read = sanitizeLayout(old, NOW);
    expect(read.researched).toEqual(["mortar"]);
    expect(gunboatWeapons(read)).toEqual({ artillery: 1 });
  });

  it("counts what an older island already has as known", () => {
    const old = {
      ...starterLayout(NOW),
      blueprints: undefined,
      buildings: [
        ...starterLayout(NOW).buildings,
        { id: "m", type: "mortar", x: 40, y: 40, rotated: false, level: 1 },
      ],
    };
    const known = sanitizeLayout(JSON.parse(JSON.stringify(old)), NOW);
    if (known.buildings.some((b) => b.type === "mortar")) {
      expect(known.blueprints).toContain("mortar");
    }
  });
});

describe("the great boulders", () => {
  it("stands at the back right of the island, where nothing can be built", () => {
    for (const c of HOME_CLIFFS) {
      expect(c.x).toBeGreaterThan(40);
      const tile = tileAt({ x: c.x, y: c.y });
      expect(isBuildableTile(tile.x, tile.y)).toBe(false);
    }
  });

  it("leaves no overgrowth under them, and every patch id stable", () => {
    for (const o of obstacles()) expect(o.id).toBe(`${o.x}.${o.y}`);
    const c = HOME_CLIFFS[3];
    if (!c) throw new Error("no cliffs");
    const tile = tileAt({ x: c.x, y: c.y });
    const over = obstacles().filter(
      (o) => tile.x >= o.x && tile.x < o.x + o.w && tile.y >= o.y && tile.y < o.y + o.h,
    );
    expect(over).toEqual([]);
  });
});

describe("rival crews raiding an island", () => {
  const raid = (won: boolean, stone = 500) => ({
    by: "Ann's crew",
    won,
    destroyedPercent: 60,
    loot: { stone },
  });

  it("carries off a little, never a building", () => {
    const start = island();
    const after = applyRivalRaid(start, raid(true), NOW);
    expect(after.buildings).toEqual(start.buildings);
    expect(after.resources.stone).toBeLessThan(start.resources.stone);
    expect(after.resources.stone).toBeGreaterThanOrEqual(start.resources.stone * 0.9);
    expect(after.raidLog[0]).toMatchObject({ by: "Ann's crew", won: true });
  });

  it("won't let a crew be robbed twice in a row", () => {
    const once = applyRivalRaid(island(), raid(true), NOW);
    const twice = applyRivalRaid(once, raid(true), NOW + 1000);
    expect(twice.resources.stone).toBe(once.resources.stone);
    expect(twice.raidLog).toHaveLength(2);
    const later = applyRivalRaid(once, raid(true), NOW + 13 * 3600 * 1000);
    expect(later.resources.stone).toBeLessThan(once.resources.stone);
  });

  it("pays a crew whose defenses held", () => {
    const start = { ...island(), resources: { ...island().resources, gold: 10 } };
    const after = applyRivalRaid(start, raid(false), NOW);
    expect(after.resources.gold).toBeGreaterThan(10);
    expect(after.raidLog[0]?.reward).toBeGreaterThan(0);
  });

  it("keeps only the last few reports", () => {
    let layout = island();
    for (let i = 0; i < 12; i++) layout = applyRivalRaid(layout, raid(false), NOW + i);
    expect(layout.raidLog).toHaveLength(8);
  });
});
