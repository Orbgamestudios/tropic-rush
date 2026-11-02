import { describe, expect, it } from "vitest";
import { NEW_WORLD } from "./logic/worldMap";
import {
  DEFAULT_CONTROLS,
  DEFAULT_SETTINGS,
  loadAccount,
  loadPlace,
  loadSave,
  resetGame,
  restoreBundle,
  type SaveData,
  saveBundle,
  writeAccount,
  writePlace,
  writeSave,
} from "./save";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
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
  avatar: "rifleman-1",
  crewCode: "",
  memberId: "",
  gold: 300,
  heroLevels: LEVELS,
  unlocked: ["rifleman"],
  settings: DEFAULT_SETTINGS,
  nightChecked: 0,
  nightRaid: null,
  world: NEW_WORLD,
  loot: {},
  lostIslands: [],
};

describe("the player's place, for the sky", () => {
  it("tells asking from a no from a yes, and keeps it out of the save", () => {
    const storage = memoryStorage();
    expect(loadPlace(storage)).toBeUndefined();
    writePlace(null, storage);
    expect(loadPlace(storage)).toBeNull();
    writePlace({ lat: 40.7, lon: -74 }, storage);
    expect(loadPlace(storage)).toEqual({ lat: 40.7, lon: -74 });
    expect(JSON.stringify(saveBundle(storage))).not.toContain("40.7");
  });

  it("ignores anything that isn't a place on Earth", () => {
    const storage = memoryStorage();
    storage.items.set("tropic-rush:place:v1", '{"lat":400,"lon":0}');
    expect(loadPlace(storage)).toBeUndefined();
    storage.items.set("tropic-rush:place:v1", "not json");
    expect(loadPlace(storage)).toBeUndefined();
  });
});

describe("accounts on this phone", () => {
  it("remembers who's signed in, apart from the save", () => {
    const storage = memoryStorage();
    expect(loadAccount(storage)).toBeNull();
    const session = { token: "ann.abc", username: "Ann", syncedAt: 5 };
    writeAccount(session, storage);
    expect(loadAccount(storage)).toEqual(session);
    expect(saveBundle(storage)).not.toContain("ann.abc");
    writeAccount(null, storage);
    expect(loadAccount(storage)).toBeNull();
  });

  it("moves a save and island from one phone to another", () => {
    const first = memoryStorage();
    writeSave({ ...loadSave(first), nickname: "Ann", gold: 777 }, first);
    first.items.set("tropic-rush:crew-layout:v1", '{"buildings":[]}');
    const second = memoryStorage();
    expect(restoreBundle(saveBundle(first), second)).toBe(true);
    expect(loadSave(second).nickname).toBe("Ann");
    expect(loadSave(second).gold).toBe(777);
    expect(second.items.get("tropic-rush:crew-layout:v1")).toBe('{"buildings":[]}');
    expect(restoreBundle("not json", second)).toBe(false);
  });
});

describe("resetting the game", () => {
  it("wipes progress and the island, but keeps who you are and your settings", () => {
    const storage = memoryStorage();
    const settings = { ...DEFAULT_SETTINGS, zoom: 0.9 };
    writeSave(
      {
        ...loadSave(storage),
        nickname: "Ann",
        avatar: "medic-2",
        memberId: "m-1",
        crewCode: "ABC234",
        gold: 9999,
        wins: 12,
        unlocked: ["rifleman", "medic", "heavy", "tank"],
        world: { taken: ["0,0:1"], retaken: {}, opened: ["1,0"], progress: 1 },
        settings,
      },
      storage,
    );
    storage.items.set("tropic-rush:crew-layout:v1", '{"buildings":[]}');
    const before = loadSave(storage);
    resetGame(before, storage);
    const after = loadSave(storage);
    expect(after.gold).toBe(300);
    expect(after.wins).toBe(0);
    expect(after.unlocked).not.toContain("tank");
    expect(after.world).toEqual(NEW_WORLD);
    expect(after.crewCode).toBe("");
    expect(after.nickname).toBe("Ann");
    expect(after.avatar).toBe("medic-2");
    expect(after.memberId).toBe("m-1");
    expect(after.settings.zoom).toBe(0.9);
    expect(storage.items.has("tropic-rush:crew-layout:v1")).toBe(false);
  });
});

describe("save", () => {
  it("round-trips save data", () => {
    const storage = memoryStorage();
    const data: SaveData = {
      hero: "grenadier",
      level: 3,
      wins: 4,
      bestDestruction: 87,
      nickname: "Ada",
      avatar: "medic-2",
      crewCode: "ABC234",
      memberId: "m-1",
      gold: 1234,
      heroLevels: { ...LEVELS, grenadier: 4 },
      unlocked: ["rifleman", "medic", "heavy", "grenadier"],
      settings: {
        tilt: -0.2,
        zoom: 0.9,
        uiScale: 1.1,
        camera: "behind",
        muted: true,
        musicMuted: true,
        haptics: false,
        controls: {
          move: { x: 0.2, y: 0.8, size: 1.3 },
          aim: { x: 0.85, y: 0.7, size: 0.9 },
        },
        rev: DEFAULT_SETTINGS.rev,
      },
      nightChecked: 20_000,
      nightRaid: {
        night: 20_000,
        seed: 5,
        buildings: [],
        cleared: ["1.2"],
        report: {
          survived: true,
          destroyedPercent: 20,
          destroyed: 1,
          total: 5,
          seconds: 90,
          raiders: 2,
          raidersDown: 2,
        },
      },
      world: { taken: ["0,0:2"], retaken: { "0,0:3": 6 }, opened: ["1,0"], progress: 2 },
      loot: { timber: 250 },
      lostIslands: ["Skull Rock"],
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
          controls: { aim: { x: 5, y: -2, size: 30 } },
        },
      }),
    );
    expect(loadSave(storage).settings).toEqual({
      ...DEFAULT_SETTINGS,
      tilt: 1,
      zoom: 0,
      uiScale: 1.25,
      controls: { ...DEFAULT_CONTROLS, aim: { x: 1, y: 0, size: 2 } },
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

  it("forgets the AI squad of an older save, and reads back the world and loot", () => {
    const storage = memoryStorage();
    storage.items.set(
      "tropic-rush:save:v1",
      JSON.stringify({
        squad: ["tank", "medic"],
        beaten: { day: 3, ids: [1] },
        world: { taken: ["0,0:1"], retaken: {}, opened: [] },
        loot: { timber: 40, gold: -3 },
      }),
    );
    const save = loadSave(storage);
    expect(save).not.toHaveProperty("squad");
    expect(save).not.toHaveProperty("beaten");
    expect(save.world.taken).toEqual(["0,0:1"]);
    expect(save.loot).toEqual({ timber: 40 });
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
      unlocked: ["rifleman", "tank"],
    });
  });

  it("reports failure instead of throwing when storage is full", () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(writeSave(DEFAULTS, full)).toBe(false);
  });
});
