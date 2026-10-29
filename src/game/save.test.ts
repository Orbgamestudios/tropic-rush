import { describe, expect, it } from "vitest";
import { loadSave, type SaveData, writeSave } from "./save";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  };
}

const DEFAULTS: SaveData = { hero: "rifleman", level: 1, wins: 0, bestDestruction: 0 };

describe("save", () => {
  it("round-trips save data", () => {
    const storage = memoryStorage();
    const data: SaveData = { hero: "grenadier", level: 3, wins: 4, bestDestruction: 87 };
    expect(writeSave(data, storage)).toBe(true);
    expect(loadSave(storage)).toEqual(data);
  });

  it("falls back to defaults for missing or corrupt data", () => {
    const storage = memoryStorage();
    expect(loadSave(storage)).toEqual(DEFAULTS);
    storage.items.set("tropic-rush:save:v1", "{not json");
    expect(loadSave(storage)).toEqual(DEFAULTS);
  });

  it("repairs unknown heroes and out-of-range numbers", () => {
    const storage = memoryStorage();
    storage.items.set(
      "tropic-rush:save:v1",
      JSON.stringify({ hero: "wizard", level: 9, wins: -2, bestDestruction: 400 }),
    );
    expect(loadSave(storage)).toEqual({
      hero: "rifleman",
      level: 3,
      wins: 0,
      bestDestruction: 100,
    });
  });

  it("reports failure instead of throwing when storage is full", () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(writeSave(DEFAULTS, full)).toBe(false);
  });
});
