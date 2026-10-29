import { describe, expect, it } from "vitest";
import { loadSave, writeSave } from "./save";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  };
}

describe("save", () => {
  it("round-trips save data", () => {
    const storage = memoryStorage();
    expect(writeSave({ bestScore: 42 }, storage)).toBe(true);
    expect(loadSave(storage)).toEqual({ bestScore: 42 });
  });

  it("falls back to defaults for missing or corrupt data", () => {
    const storage = memoryStorage();
    expect(loadSave(storage)).toEqual({ bestScore: 0 });
    storage.items.set("my-pwa-game:save:v1", "{not json");
    expect(loadSave(storage)).toEqual({ bestScore: 0 });
  });

  it("reports failure instead of throwing when storage is full", () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(writeSave({ bestScore: 1 }, full)).toBe(false);
  });
});
