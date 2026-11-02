import { describe, expect, it } from "vitest";
import { noCrystals, swapCrystals } from "./crystals";

describe("trading crystals", () => {
  const wallet = { ...noCrystals(), fire: 4, ice: 2 };

  it("takes three of one kind for one of another", () => {
    expect(swapCrystals(wallet, "fire", "dark")).toEqual({ ...wallet, fire: 1, dark: 1 });
  });

  it("won't trade what isn't there, or a crystal for its own kind", () => {
    expect(swapCrystals(wallet, "ice", "dark")).toBeNull();
    expect(swapCrystals(wallet, "fire", "fire")).toBeNull();
  });
});
