import { describe, expect, it } from "vitest";
import { mouthAt } from "./lipSync";

describe("lip sync from the words", () => {
  it("is shut before the line, after it, and on its stops", () => {
    expect(mouthAt("Hello there.", -0.1, 2).open).toBe(0);
    expect(mouthAt("Hello there.", 2, 2).open).toBe(0);
    expect(mouthAt("Ah. Ah.", 1, 2).open).toBeLessThan(0.2);
  });

  it("opens wide for an ah, rounds for an oo, and shuts for an m", () => {
    expect(mouthAt("aaaa", 0.5, 1).open).toBeGreaterThan(0.9);
    expect(mouthAt("oooo", 0.5, 1).round).toBeGreaterThan(0.8);
    expect(mouthAt("mmmm", 0.5, 1).open).toBe(0);
  });

  it("keeps moving through a line rather than holding one shape", () => {
    const line = "We build. Shelter first, then walls, then a headquarters we can hold.";
    const shapes = Array.from({ length: 40 }, (_, i) => mouthAt(line, (i / 40) * 5, 5).open);
    expect(Math.max(...shapes) - Math.min(...shapes)).toBeGreaterThan(0.7);
    expect(new Set(shapes.map((s) => s.toFixed(2))).size).toBeGreaterThan(8);
  });
});
