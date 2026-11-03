import { describe, expect, it } from "vitest";
import { lotTide, TIDE_LOTS, tideTurn } from "./tides";

const HOUR = 3_600_000;
const START = 1_800_000_000_000;

describe("the tide", () => {
  it("takes each lot of finds every 12 hours", () => {
    for (let lot = 0; lot < TIDE_LOTS; lot++) {
      const first = lotTide(7, lot, START);
      expect(lotTide(7, lot, START + 13 * HOUR)).toBeGreaterThan(first);
      expect(lotTide(7, lot, START + 24 * HOUR)).toBe(first + 2);
    }
  });

  it("never swaps the whole beach at once", () => {
    for (let t = 0; t < 48; t++) {
      const at = START + t * HOUR;
      const changed = [0, 1, 2].filter((lot) => lotTide(7, lot, at + HOUR) !== lotTide(7, lot, at));
      expect(changed.length).toBeLessThanOrEqual(1);
    }
  });

  it("says when something's changed, a few times a day", () => {
    let turns = 0;
    for (let t = 0; t < 240; t++) {
      if (tideTurn(7, START + t * HOUR) !== tideTurn(7, START + (t + 1) * HOUR)) turns++;
    }
    expect(turns).toBe(60);
  });

  it("keeps different hours on different beaches", () => {
    const hours = new Set(
      [1, 50, 300, 700].map((seed) => {
        let t = 0;
        while (lotTide(seed, 0, START + t * HOUR) === lotTide(seed, 0, START)) t++;
        return t;
      }),
    );
    expect(hours.size).toBeGreaterThan(1);
  });
});
