import { describe, expect, it } from "vitest";
import { DEFAULT_CONTROLS, DEFAULT_SETTINGS, loadSave, type SaveData, writeSave } from "./save";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  };
}

const LEVELS = {
  rifleman: 1,
  medic: 1,
  tank: 1,
  heavy: 1,
  bazooka: 1,
  grenadier: 1,
  engineer: 1,
};

const DEFAULTS: SaveData = {
  hero: "rifleman",
  level: 1,
  wins: 0,
  bestDestruction: 0,
  nickname: "",
  crewCode: "",
  memberId: "",
  gold: 300,
  medals: 0,
  heroLevels: LEVELS,
  unlocked: ["rifleman", "medic", "heavy"],
  squad: ["medic", "heavy"],
  settings: DEFAULT_SETTINGS,
};

describe("save", () => {
  it("round-trips save data", () => {
    const storage = memoryStorage();
    const data: SaveData = {
      hero: "grenadier",
      level: 3,
      wins: 4,
      bestDestruction: 87,
      nickname: "Ada",
      crewCode: "ABC234",
      memberId: "m-1",
      gold: 1234,
      medals: 5,
      heroLevels: { ...LEVELS, grenadier: 4 },
      unlocked: ["rifleman", "medic", "heavy", "grenadier"],
      squad: ["medic", "grenadier"],
      settings: {
        tilt: -0.2,
        zoom: 0.9,
        uiScale: 1.1,
        muted: true,
        controls: {
          move: { x: 0.2, y: 0.8, size: 1.3 },
          aim: { x: 0.85, y: 0.7, size: 0.9 },
          super: { x: 0.6, y: 0.5, size: 1.5 },
        },
        rev: DEFAULT_SETTINGS.rev,
      },
    };
    expect(writeSave(data, storage)).toBe(true);
    expect(loadSave(storage)).toEqual(data);
  });

  it("falls back to defaults for missing or corrupt data", () => {
    const storage = memoryStorage();
    expect(loadSave(storage)).toEqual(DEFAULTS);
    storage.items.set("tropic-rush:save:v1", "{not json");
    expect(loadSave(storage)).toEqual(DEFAULTS);
  });

  it("clamps settings into range", () => {
    const storage = memoryStorage();
    storage.items.set(
      "tropic-rush:save:v1",
      JSON.stringify({
        settings: {
          tilt: 4,
          zoom: -1,
          uiScale: 9,
          muted: "yes",
          rev: DEFAULT_SETTINGS.rev,
          controls: { super: { x: 5, y: -2, size: 30 } },
        },
      }),
    );
    expect(loadSave(storage).settings).toEqual({
      ...DEFAULT_SETTINGS,
      tilt: 1,
      zoom: 0,
      uiScale: 1.25,
      controls: { ...DEFAULT_CONTROLS, super: { x: 1, y: 0, size: 2 } },
    });
  });

  it("moves older saves onto the new default tilt and UI size", () => {
    const storage = memoryStorage();
    storage.items.set(
      "tropic-rush:save:v1",
      JSON.stringify({ settings: { tilt: 0.5, zoom: 0.8, uiScale: 1, muted: true } }),
    );
    expect(loadSave(storage).settings).toEqual({ ...DEFAULT_SETTINGS, zoom: 0.8, muted: true });
  });

  it("keeps only unlocked heroes in the squad", () => {
    const storage = memoryStorage();
    storage.items.set(
      "tropic-rush:save:v1",
      JSON.stringify({ squad: ["tank", "medic", "wizard", "heavy"] }),
    );
    expect(loadSave(storage).squad).toEqual(["medic", "heavy"]);
  });

  it("repairs unknown heroes and out-of-range numbers", () => {
    const storage = memoryStorage();
    storage.items.set(
      "tropic-rush:save:v1",
      JSON.stringify({
        hero: "wizard",
        level: 9,
        wins: -2,
        bestDestruction: 400,
        heroLevels: { rifleman: 50, medic: -1 },
        unlocked: ["dragon", "tank"],
      }),
    );
    expect(loadSave(storage)).toEqual({
      ...DEFAULTS,
      level: 3,
      bestDestruction: 100,
      heroLevels: { ...LEVELS, rifleman: 10 },
      unlocked: ["rifleman", "medic", "tank", "heavy"],
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
