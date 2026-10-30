import { describe, expect, it } from "vitest";
import {
  applyOp,
  buildingAtTile,
  buildingCenter,
  type CrewLayout,
  cornerFor,
  fits,
  type PlacedBuilding,
  sanitizeLayout,
  starterLayout,
  tileAt,
  ZONES,
  zoneOf,
} from "./crewIsland";

const turret = (id: string, x: number, y: number, rotated = false): PlacedBuilding => ({
  id,
  type: "gunTurret",
  x,
  y,
  rotated,
});

const empty = (unlocked = 1): CrewLayout => ({ buildings: [], unlocked });

function place(layout: CrewLayout, b: PlacedBuilding): CrewLayout {
  const next = applyOp(layout, { kind: "place", building: b });
  if (!next) throw new Error(`could not place ${b.id}`);
  return next;
}

const zone = (id: number) => {
  const z = ZONES[id - 1];
  if (!z) throw new Error(`no zone ${id}`);
  return z;
};

describe("crew island zones", () => {
  it("climbs in a zigzag: each zone higher and further back, alternating sides", () => {
    for (let i = 1; i < ZONES.length; i++) {
      const prev = zone(i);
      const next = zone(i + 1);
      expect(next.height).toBeGreaterThan(prev.height);
      expect(next.y).toBeLessThan(prev.y);
    }
    const centerX = (id: number) => zone(id).x + zone(id).w / 2;
    expect(centerX(2)).toBeLessThan(centerX(3));
    expect(centerX(4)).toBeLessThan(centerX(3));
  });

  it("starts with zone 1 open and its headquarters inside it", () => {
    const layout = starterLayout();
    expect(layout.unlocked).toBe(1);
    expect(layout.buildings).toHaveLength(1);
    expect(zoneOf(layout.buildings[0] as PlacedBuilding)?.id).toBe(1);
  });

  it("only allows building in unlocked zones, unlocked one at a time", () => {
    const inZone2 = turret("t", zone(2).x, zone(2).y);
    expect(applyOp(empty(), { kind: "place", building: inZone2 })).toBeNull();
    expect(applyOp(empty(), { kind: "unlock", zone: 3 })).toBeNull();
    const opened = applyOp(empty(), { kind: "unlock", zone: 2 });
    expect(opened?.unlocked).toBe(2);
    expect(opened && applyOp(opened, { kind: "place", building: inZone2 })).not.toBeNull();
    expect(
      applyOp({ ...empty(), unlocked: ZONES.length }, { kind: "unlock", zone: ZONES.length + 1 }),
    ).toBeNull();
  });

  it("refuses buildings that straddle a zone edge or sit outside every zone", () => {
    const open = { ...empty(), unlocked: ZONES.length };
    expect(applyOp(open, { kind: "place", building: turret("a", zone(1).w - 1, 0) })).toBeNull();
    expect(applyOp(open, { kind: "place", building: turret("a", 0, zone(1).h - 1) })).toBeNull();
    expect(applyOp(open, { kind: "place", building: turret("a", -1, 4) })).toBeNull();
  });
});

describe("crew island layout", () => {
  it("places buildings on free tiles and refuses overlaps", () => {
    let layout = place(empty(), turret("a", 0, 0));
    expect(applyOp(layout, { kind: "place", building: turret("b", 1, 1) })).toBeNull();
    layout = place(layout, turret("b", 2, 0));
    expect(layout.buildings).toHaveLength(2);
  });

  it("refuses duplicate ids and a second headquarters", () => {
    const layout = starterLayout();
    expect(applyOp(layout, { kind: "place", building: { ...turret("hq", 0, 0) } })).toBeNull();
    expect(
      applyOp(layout, {
        kind: "place",
        building: { id: "hq2", type: "headquarters", x: 0, y: 0, rotated: false },
      }),
    ).toBeNull();
  });

  it("moves and rotates a building if the new spot is free", () => {
    let layout = place(empty(), { id: "s", type: "storehouse", x: 0, y: 0, rotated: false });
    layout = place(layout, turret("t", 4, 0));
    // Rotating swaps the storehouse's 3x2 footprint to 2x3.
    const rotated = applyOp(layout, { kind: "move", id: "s", x: 0, y: 0, rotated: true });
    expect(rotated?.buildings.find((b) => b.id === "s")?.rotated).toBe(true);
    expect(applyOp(layout, { kind: "move", id: "s", x: 3, y: 0, rotated: false })).toBeNull();
    expect(applyOp(layout, { kind: "move", id: "s", x: 0, y: 3, rotated: false })).not.toBeNull();
    expect(applyOp(layout, { kind: "move", id: "missing", x: 0, y: 3, rotated: false })).toBeNull();
  });

  it("removes buildings but never the headquarters", () => {
    let layout = place(starterLayout(), turret("t", 0, 0));
    layout = applyOp(layout, { kind: "remove", id: "t" }) ?? layout;
    expect(layout.buildings.map((b) => b.id)).toEqual(["hq"]);
    expect(applyOp(layout, { kind: "remove", id: "hq" })).toBeNull();
  });

  it("converts between tiles and world positions", () => {
    const b = turret("t", 5, 3);
    const center = buildingCenter(b);
    expect(tileAt(center)).toEqual({ x: 6, y: 4 });
    expect(cornerFor("gunTurret", false, center)).toEqual({ x: 5, y: 3 });
    const layout = place(empty(), b);
    expect(buildingAtTile(layout, { x: 6, y: 4 })?.id).toBe("t");
    expect(buildingAtTile(layout, { x: 7, y: 4 })).toBeUndefined();
    expect(fits(layout, turret("u", 7, 3))).toBe(true);
  });

  it("cleans up untrusted layout data, keeping unlocked zones", () => {
    expect(sanitizeLayout(null)).toEqual(starterLayout());
    const messy = {
      unlocked: 2,
      buildings: [
        ...starterLayout().buildings,
        turret("ok", 0, 0),
        turret("west", zone(2).x, zone(2).y),
        turret("overlap", 1, 1),
        { id: "bad", type: "spaceship", x: 0, y: 8 },
        { id: "half", type: "gunTurret", x: 1.5, y: 8 },
      ],
    };
    const clean = sanitizeLayout(messy);
    expect(clean.unlocked).toBe(2);
    expect(clean.buildings.map((b) => b.id)).toEqual(["hq", "ok", "west"]);
    expect(sanitizeLayout({ unlocked: 99, buildings: [] }).unlocked).toBe(ZONES.length);
  });
});
