import { describe, expect, it } from "vitest";
import { hit, isHit, miss, newRound, pointsFor, tick } from "./round";

describe("round", () => {
  it("ends when the timer runs out", () => {
    let state = newRound(1000);
    state = tick(state, 600);
    expect(state.over).toBe(false);
    state = tick(state, 600);
    expect(state).toMatchObject({ timeLeftMs: 0, over: true });
  });

  it("rewards streaks and resets them on a miss", () => {
    let state = newRound();
    for (let i = 0; i < 6; i++) state = hit(state);
    // Hits 1-5 are worth 1 point, hit 6 is worth 2.
    expect(state).toMatchObject({ score: 7, streak: 6 });
    state = miss(state);
    expect(state).toMatchObject({ score: 7, streak: 0 });
  });

  it("ignores input after the round is over", () => {
    const over = tick(newRound(10), 10);
    expect(hit(over)).toBe(over);
    expect(miss(over)).toBe(over);
  });

  it("scales points with the streak", () => {
    expect([0, 4, 5, 9, 10].map(pointsFor)).toEqual([1, 1, 2, 2, 3]);
  });
});

describe("isHit", () => {
  it("accepts taps slightly outside the target", () => {
    expect(isHit(100, 100, 100, 100, 50)).toBe(true);
    expect(isHit(160, 100, 100, 100, 50)).toBe(true);
    expect(isHit(170, 100, 100, 100, 50)).toBe(false);
  });
});
