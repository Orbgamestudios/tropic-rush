import { describe, expect, it } from "vitest";
import {
  afterStep,
  applySnapshot,
  createCoopRaid,
  type HeroTargets,
  holdInput,
  predict,
  type Seat,
  takeSnapshot,
} from "./coop";
import { generateIsland } from "./enemyBase";
import { IDLE_INPUT, type RaidState, stepRaid } from "./raid";
import { vec } from "./vec";

const DT = 1 / 60;

const SEATS: Seat[] = [
  { member: "a", name: "Ann", hero: "rifleman", level: 1 },
  { member: "b", name: "Bob", hero: "heavy", level: 3 },
];

function pair(): { host: RaidState; guest: RaidState } {
  const layout = generateIsland(5, 2);
  return { host: createCoopRaid(layout, SEATS), guest: createCoopRaid(layout, SEATS) };
}

describe("raiding together", () => {
  it("gives every player their own hero, at their own level", () => {
    const { host } = pair();
    expect(host.heroes.map((h) => h.kind)).toEqual(["rifleman", "heavy"]);
    expect(host.heroes[1]?.power).toBeGreaterThan(1);
  });

  it("starts both phones on the same island, with the same ids", () => {
    const { host, guest } = pair();
    expect(guest.buildings.map((b) => b.id)).toEqual(host.buildings.map((b) => b.id));
    expect(guest.heroes.map((h) => h.id)).toEqual(host.heroes.map((h) => h.id));
  });

  it("never loses a press that lands between two steps", () => {
    const lock = { ...IDLE_INPUT, lockAt: vec(1, 0), toggleBoat: true };
    const held = holdInput(lock, { ...IDLE_INPUT, move: vec(0, 1) });
    expect(held.lockAt).toEqual(vec(1, 0));
    expect(held.toggleBoat).toBe(true);
    expect(held.move).toEqual(vec(0, 1));
    const after = afterStep(held);
    expect(after.lockAt).toBeNull();
    expect(after.toggleBoat).toBe(false);
    expect(after.move).toEqual(vec(0, 1));
  });

  it("brings a guest's copy in line with the host's, through the wire format", () => {
    const { host, guest } = pair();
    const [building] = host.buildings;
    if (!building) throw new Error("no building");
    building.hp = 0;
    building.destroyed = true;
    host.energy = 44;
    host.loot.timber = 300;
    const friend = host.heroes[0];
    if (!friend) throw new Error("no hero");
    friend.hp = 77;
    const seen = new Map<number, number>();
    const snap = takeSnapshot(host, [{ type: "hit", pos: vec(1, 2) }], seen);
    const wired = JSON.parse(JSON.stringify(snap));
    const targets: HeroTargets = [];
    applySnapshot(guest, wired, 1, targets);
    expect(guest.buildings[0]?.destroyed).toBe(true);
    expect(guest.energy).toBe(44);
    expect(guest.loot.timber).toBe(300);
    expect(guest.heroes[0]?.hp).toBe(77);
    expect(wired.events).toHaveLength(1);
  });

  it("only sends what's changed about buildings", () => {
    const { host } = pair();
    const seen = new Map<number, number>();
    expect(takeSnapshot(host, [], seen).buildings.length).toBe(host.buildings.length);
    expect(takeSnapshot(host, [], seen).buildings).toEqual([]);
    const [building] = host.buildings;
    if (building) building.hp -= 10;
    expect(takeSnapshot(host, [], seen).buildings).toHaveLength(1);
  });

  it("moves a guest's own hero at once, and slides crewmates towards their reported spot", () => {
    const { guest } = pair();
    const mine = guest.heroes[1];
    const friend = guest.heroes[0];
    if (!mine || !friend) throw new Error("no heroes");
    const start = { ...mine.pos };
    const targets: HeroTargets = [{ x: friend.pos.x + 5, y: friend.pos.y, facing: 1 }];
    const from = friend.pos.x;
    for (let t = 0; t < 0.5; t += DT) {
      predict(guest, 1, { ...IDLE_INPUT, move: vec(0, -1) }, targets, DT);
    }
    expect(mine.pos.y).toBeLessThan(start.y - 1);
    expect(friend.pos.x).toBeGreaterThan(from + 3);
    expect(friend.facing).toBe(1);
  });

  it("puts a guest back if they've drifted far from where the host has them", () => {
    const { guest, host } = pair();
    const mine = guest.heroes[1];
    if (!mine) throw new Error("no hero");
    mine.pos = vec(50, 50);
    applySnapshot(guest, takeSnapshot(host, [], new Map()), 1, []);
    expect(mine.pos).not.toEqual(vec(50, 50));
  });

  it("leaves a guest who's retreated out of the rest of the raid", () => {
    const { guest, host } = pair();
    guest.status = "lost";
    host.energy = 99;
    applySnapshot(guest, takeSnapshot(host, [], new Map()), 1, []);
    expect(guest.status).toBe("lost");
    expect(guest.energy).not.toBe(99);
  });

  it("lets the host's rules run both heroes", () => {
    const { host } = pair();
    const guestHero = host.heroes[1];
    if (!guestHero) throw new Error("no hero");
    const y = guestHero.pos.y;
    for (let t = 0; t < 1; t += DT) {
      stepRaid(host, [IDLE_INPUT, { ...IDLE_INPUT, move: vec(0, -1) }], DT);
    }
    expect(guestHero.pos.y).toBeLessThan(y);
  });
});
