import { describe, expect, it } from "vitest";
import {
  applyOp,
  type CrewLayout,
  hourglassSite,
  obstacles,
  sanitizeLayout,
  settle,
  starterLayout,
  statueSites,
  tryOp,
} from "./crewIsland";
import { noCrystals } from "./crystals";
import { breakBlocker, breakCrystal, HOURGLASS_COST, HOURGLASS_MS } from "./hourglass";
import { createRng } from "./rng";

const NOW = 1_700_000_000_000;

function rich(layout: CrewLayout): CrewLayout {
  return { ...layout, resources: { gold: 1e6, timber: 1e6, stone: 1e6, scrap: 1e6 } };
}

/** The Hourglass's jungle, cleared: it's found. */
function found(): CrewLayout {
  const start = rich(starterLayout(NOW));
  const site = hourglassSite(start.relicSeed);
  if (!site) throw new Error("no Hourglass on this island");
  // Settling caps the stock at what the starter storages hold, so it's topped up after.
  return rich(settle({ ...start, jobs: [{ id: site.id, doneAt: NOW + 10 }] }, NOW + 20));
}

describe("the Hourglass", () => {
  it("hides in deep jungle, never under a statue, the same on every phone", () => {
    for (const seed of [1, 99, 123456, 2 ** 30]) {
      const site = hourglassSite(seed);
      expect(site).not.toBeNull();
      expect(site?.tier).toBe(3);
      expect(statueSites(seed).map((s) => s.patch.id)).not.toContain(site?.id);
      expect(hourglassSite(seed)).toBe(site);
    }
    expect(obstacles().some((o) => o.kind === "jungle" && o.tier === 3)).toBe(true);
  });

  it("is found by clearing the jungle hiding it, and can't be mended before", () => {
    const start = rich(starterLayout(NOW));
    expect(start.hourglass.found).toBe(false);
    expect(tryOp(start, { kind: "mendHourglass" }, NOW)).toEqual({ error: "Not found yet" });
    expect(found().hourglass.found).toBe(true);
  });

  it("takes stone, gold and a day to mend, and stays mended", () => {
    const layout = found();
    const before = layout.resources;
    const mending = applyOp(layout, { kind: "mendHourglass" }, NOW + 30);
    if (!mending) throw new Error("couldn't mend");
    expect(mending.resources.stone).toBe(before.stone - (HOURGLASS_COST.stone ?? 0));
    expect(mending.resources.gold).toBe(before.gold - (HOURGLASS_COST.gold ?? 0));
    expect(tryOp(mending, { kind: "mendHourglass" }, NOW + 40)).toEqual({ error: "Being mended" });
    expect(settle(mending, NOW + HOURGLASS_MS).hourglass.mended).toBe(false);
    const whole = settle(mending, NOW + 30 + HOURGLASS_MS + 1);
    expect(whole.hourglass.mended).toBe(true);
    expect(sanitizeLayout(JSON.parse(JSON.stringify(whole))).hourglass).toEqual(whole.hourglass);
  });

  it("breaks a player's crystal into shards of the power they chose, once it's mended", () => {
    const crystals = { ...noCrystals(), fire: 2 };
    const broken = { found: true, doneAt: null, mended: false };
    const whole = { found: true, doneAt: 0, mended: true };
    expect(breakBlocker(broken, crystals, "fire")).toBe("Mend the Hourglass first");
    expect(breakBlocker(whole, crystals, "ice")).toBe("No crystals of that kind");
    expect(breakBlocker(whole, crystals, "fire")).toBeNull();
    const out = breakCrystal(crystals, { slow: 1 }, "fire", "slow", createRng(3));
    expect(out.crystals.fire).toBe(1);
    expect(out.made).toBeGreaterThanOrEqual(1);
    expect(out.made).toBeLessThanOrEqual(5);
    expect(out.shards.slow).toBe(1 + out.made);
  });
});
