import { describe, expect, it } from "vitest";
import {
  applyOp,
  buildingAtTile,
  buildingCenter,
  type CrewLayout,
  cornerFor,
  fits,
  GRID_COLUMNS,
  GRID_ROWS,
  type PlacedBuilding,
  sanitizeLayout,
  starterLayout,
  tileAt,
} from "./crewIsland";

const turret = (id: string, x: number, y: number, rotated = false): PlacedBuilding => ({
  id,
  type: "gunTurret",
  x,
  y,
  rotated,
});

function place(layout: CrewLayout, b: PlacedBuilding): CrewLayout {
  const next = applyOp(layout, { kind: "place", building: b });
  if (!next) throw new Error(`could not place ${b.id}`);
  return next;
}

describe("crew island layout", () => {
  it("starts with only the headquarters, inside the grid", () => {
    const layout = starterLayout();
    expect(layout.buildings).toHaveLength(1);
    expect(layout.buildings[0]?.type).toBe("headquarters");
    expect(fits({ buildings: [] }, layout.buildings[0] as PlacedBuilding)).toBe(true);
  });

  it("places buildings on free tiles and refuses overlaps and the grid edge", () => {
    let layout = place({ buildings: [] }, turret("a", 0, 0));
    expect(applyOp(layout, { kind: "place", building: turret("b", 1, 1) })).toBeNull();
    layout = place(layout, turret("b", 2, 0));
    expect(
      applyOp(layout, { kind: "place", building: turret("c", GRID_COLUMNS - 1, 0) }),
    ).toBeNull();
    expect(applyOp(layout, { kind: "place", building: turret("c", 0, GRID_ROWS - 1) })).toBeNull();
    expect(applyOp(layout, { kind: "place", building: turret("c", -1, 4) })).toBeNull();
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
    let layout = place(
      { buildings: [] },
      { id: "s", type: "storehouse", x: 0, y: 0, rotated: false },
    );
    layout = place(layout, turret("t", 4, 0));
    // Rotating swaps the storehouse's 3x2 footprint to 2x3.
    const rotated = applyOp(layout, { kind: "move", id: "s", x: 0, y: 0, rotated: true });
    expect(rotated?.buildings.find((b) => b.id === "s")?.rotated).toBe(true);
    // Moving onto the turret is refused; moving next to it is fine.
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
    const layout = place({ buildings: [] }, b);
    expect(buildingAtTile(layout, { x: 6, y: 4 })?.id).toBe("t");
    expect(buildingAtTile(layout, { x: 7, y: 4 })).toBeUndefined();
  });

  it("cleans up untrusted layout data", () => {
    expect(sanitizeLayout(null)).toEqual(starterLayout());
    const messy = {
      buildings: [
        ...starterLayout().buildings,
        turret("ok", 0, 0),
        turret("overlap", 1, 1),
        { id: "bad", type: "spaceship", x: 0, y: 8 },
        { id: "half", type: "gunTurret", x: 1.5, y: 8 },
      ],
    };
    expect(sanitizeLayout(messy).buildings.map((b) => b.id)).toEqual(["hq", "ok"]);
  });
});
