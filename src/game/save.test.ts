import { describe, expect, it } from "vitest";
import { noCrystals } from "./logic/crystals";
import { noUpgrades } from "./logic/heroTrees";
import { STARTER_SHARDS } from "./logic/timeShards";
import { NEW_WORLD } from "./logic/worldMap";
import {
  clearPhone,
  DEFAULT_CONTROLS,
  DEFAULT_SETTINGS,
  loadAccount,
  loadOtherAccounts,
  loadPlace,
  loadSave,
  resetGame,
  restoreBundle,
  type SaveData,
  saveBundle,
  writeAccount,
  writeOtherAccounts,
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

const DEFAULTS: SaveData = {
  hero: "rifleman",
  level: 1,
  wins: 0,
  bestDestruction: 0,
  nickname: "",
  avatar: "rifleman-1",
  crewCode: "",
  memberId: "",
  gold: 0,
  crystals: noCrystals(),
  shards: STARTER_SHARDS,
  shardPicks: [],
  upgrades: noUpgrades(),
  blueprints: [],
  blueprintDrought: 0,
  unlocked: ["rifleman"],
  settings: DEFAULT_SETTINGS,
  nightChecked: 0,
  cargo: {},
  cargoDay: 0,
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

  it("leaves nothing of the last account on a phone", () => {
    const phone = memoryStorage();
    writeSave({ ...loadSave(phone), gold: 777 }, phone);
    phone.items.set("tropic-rush:crew-layout:v1", '{"buildings":[]}');
    const newcomer = memoryStorage();
    writeSave({ ...loadSave(newcomer), gold: 5 }, newcomer);
    expect(restoreBundle(saveBundle(newcomer), phone)).toBe(true);
    expect(loadSave(phone).gold).toBe(5);
    expect(phone.items.has("tropic-rush:crew-layout:v1")).toBe(false);
  });

  it("keeps the other accounts on a phone apart from any save", () => {
    const phone = memoryStorage();
    expect(loadOtherAccounts(phone)).toEqual([]);
    const ann = { token: "ann.abc", username: "Ann", syncedAt: 5 };
    const bob = { token: "bob.def", username: "Bob", syncedAt: 6 };
    writeOtherAccounts([ann, bob], phone);
    expect(loadOtherAccounts(phone)).toEqual([ann, bob]);
    expect(saveBundle(phone)).not.toContain("ann.abc");
    clearPhone(loadSave(phone).settings, phone);
    expect(loadOtherAccounts(phone)).toEqual([ann, bob]);
    phone.items.set("tropic-rush:other-accounts:v1", "not json");
    expect(loadOtherAccounts(phone)).toEqual([]);
    phone.items.set("tropic-rush:other-accounts:v1", '[{"token":1},{"token":"a","username":"A"}]');
    expect(loadOtherAccounts(phone)).toEqual([{ token: "a", username: "A", syncedAt: 0 }]);
  });

  it("gives one account's heroes nothing to pass on to the next", () => {
    const phone = memoryStorage();
    writeSave(
      {
        ...loadSave(phone),
        upgrades: { ...noUpgrades(), rifleman: ["rifleman-basic-training"] },
        unlocked: ["rifleman", "heavy"],
        hero: "heavy",
        crystals: { nature: 3, fire: 0, ice: 0, dark: 0 },
        blueprints: ["mortar"],
      },
      phone,
    );
    clearPhone(loadSave(phone).settings, phone);
    const after = loadSave(phone);
    expect(after.upgrades).toEqual(noUpgrades());
    expect(after.unlocked).toEqual(["rifleman"]);
    expect(after.hero).toBe("rifleman");
    expect(after.crystals).toEqual(noCrystals());
    expect(after.blueprints).toEqual([]);
  });

  it("clears everything but the phone's settings when someone logs out", () => {
    const phone = memoryStorage();
    const settings = { ...DEFAULT_SETTINGS, zoom: 0.9 };
    writeSave(
      {
        ...loadSave(phone),
        nickname: "Ann",
        memberId: "m-1",
        crewCode: "ABC234",
        gold: 9999,
        world: { ...NEW_WORLD, taken: ["0,0:1"], opened: ["1,0:2"], progress: 1 },
        settings,
      },
      phone,
    );
    phone.items.set("tropic-rush:crew-layout:v1", '{"buildings":[]}');
    clearPhone(loadSave(phone).settings, phone);
    const after = loadSave(phone);
    expect(after.world).toEqual(NEW_WORLD);
    expect(after.gold).toBe(0);
    expect(after.nickname).toBe("");
    expect(after.memberId).toBe("");
    expect(after.crewCode).toBe("");
    expect(after.settings.zoom).toBe(0.9);
    expect(phone.items.has("tropic-rush:crew-layout:v1")).toBe(false);
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
        world: { ...NEW_WORLD, taken: ["0,0:1"], opened: ["1,0:2"], progress: 1 },
        crystals: { nature: 4, fire: 3, ice: 2, dark: 1 },
        settings,
      },
      storage,
    );
    storage.items.set("tropic-rush:crew-layout:v1", '{"buildings":[]}');
    const before = loadSave(storage);
    resetGame(before, storage);
    const after = loadSave(storage);
    expect(after.gold).toBe(0);
    expect(after.wins).toBe(0);
    expect(after.crystals).toEqual(noCrystals());
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
      crystals: { nature: 1, fire: 2, ice: 3, dark: 4 },
      shards: { slow: 2, retry: 1 },
      shardPicks: ["slow", "rewind"],
      upgrades: { ...noUpgrades(), grenadier: ["grenadier/bigger-charge"] },
      blueprints: ["mortar"],
      blueprintDrought: 2,
      unlocked: ["rifleman", "medic", "heavy", "grenadier"],
      settings: {
        tilt: -0.2,
        zoom: 0.9,
        uiScale: 1.1,
        camera: "behind",
        muted: true,
        musicMuted: true,
        musicVolume: 0.4,
        soundVolume: 0.7,
        haptics: false,
        controls: {
          move: { x: 0.2, y: 0.8, size: 1.3 },
          aim: { x: 0.85, y: 0.7, size: 0.9 },
        },
        graphics: "low",
        frameRate: 30,
        rev: DEFAULT_SETTINGS.rev,
      },
      nightChecked: 20_000,
      cargo: { gold: 300, stone: 40 },
      cargoDay: 20_001,
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
          stolen: { gold: 40 },
          reward: { gold: 160, timber: 90 },
          crystals: { ice: 2 },
        },
      },
      world: {
        ...NEW_WORLD,
        taken: ["0,0:2"],
        retaken: { "0,0:3": 6 },
        opened: ["1,0:2"],
        progress: 2,
      },
      loot: { timber: 250 },
      lostIslands: ["Skull Rock"],
    };
    expect(writeSave(data, storage)).toBe(true);
    expect(loadSave(storage)).toEqual(data);
  });

  it("reads a night raid from before the ships, which paid gold alone", () => {
    const storage = memoryStorage();
    const report = { survived: true, destroyedPercent: 0, destroyed: 0, total: 3, seconds: 60 };
    storage.items.set(
      "tropic-rush:save:v1",
      JSON.stringify({
        nightRaid: {
          night: 9,
          seed: 1,
          buildings: [],
          cleared: [],
          report: { ...report, reward: 160 },
        },
      }),
    );
    const raid = loadSave(storage).nightRaid;
    expect(raid?.report.reward).toEqual({ gold: 160 });
    expect(raid?.report.crystals).toEqual({});
  });

  it("hands back the crystals an upgrade from the old trees took, once", () => {
    const storage = memoryStorage();
    storage.items.set(
      "tropic-rush:save:v1",
      JSON.stringify({
        upgrades: { grenadier: ["grenadier-strong-arm"] },
        crystals: { nature: 0, ice: 0, fire: 2, dark: 0 },
      }),
    );
    const loaded = loadSave(storage);
    expect(loaded.upgrades.grenadier).toEqual([]);
    expect(loaded.crystals.fire).toBe(3);
    writeSave(loaded, storage);
    expect(loadSave(storage).crystals.fire).toBe(3);
  });

  it("hands back what an old save spent on hero levels, once", () => {
    const storage = memoryStorage();
    storage.items.set(
      "tropic-rush:save:v1",
      JSON.stringify({ gold: 100, heroLevels: { rifleman: 3, heavy: 2 } }),
    );
    const loaded = loadSave(storage);
    expect(loaded.gold).toBe(100 + 120 + 190 + 120);
    expect(loaded.upgrades.rifleman).toEqual([]);
    writeSave(loaded, storage);
    expect(loadSave(storage).gold).toBe(loaded.gold);
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
        upgrades: { rifleman: ["made-up"], medic: "nope" },
        crystals: { fire: -3, dark: "lots" },
        blueprints: ["mortar", "goldMine", 7],
        unlocked: ["dragon", "tank"],
      }),
    );
    expect(loadSave(storage)).toEqual({
      ...DEFAULTS,
      level: 3,
      bestDestruction: 100,
      blueprints: ["mortar"],
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
