import { HERO_KINDS, type HeroKind } from "./logic/heroes";

// Bump the version suffix if the shape of SaveData changes incompatibly.
const KEY = "tropic-rush:save:v1";

export interface SaveData {
  hero: HeroKind;
  /** HQ level of the island picked last (1 to 3). */
  level: number;
  wins: number;
  bestDestruction: number;
  /** Name shown to crewmates; empty until chosen. */
  nickname: string;
  /** Invite code of the crew this phone belongs to; empty if none yet. */
  crewCode: string;
  /** Random id that tells the crew server this phone is the same player next time. */
  memberId: string;
}

const DEFAULT_SAVE: SaveData = {
  hero: "rifleman",
  level: 1,
  wins: 0,
  bestDestruction: 0,
  nickname: "",
  crewCode: "",
  memberId: "",
};

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

function count(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(0, Math.floor(value)))
    : 0;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export function loadSave(storage: Storage = localStorage): SaveData {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed: Partial<Record<keyof SaveData, unknown>> = JSON.parse(raw);
    const hero = HERO_KINDS.find((k) => k === parsed.hero) ?? DEFAULT_SAVE.hero;
    const level = count(parsed.level, 3);
    return {
      hero,
      level: level >= 1 ? level : DEFAULT_SAVE.level,
      wins: count(parsed.wins),
      bestDestruction: count(parsed.bestDestruction, 100),
      nickname: text(parsed.nickname, 16),
      crewCode: text(parsed.crewCode, 6),
      memberId: text(parsed.memberId, 64),
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

/** Returns false if storage is unavailable (e.g. full or blocked); the game keeps running. */
export function writeSave(data: SaveData, storage: Storage = localStorage): boolean {
  try {
    storage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

const LAYOUT_KEY = "tropic-rush:crew-layout:v1";

/** This phone's copy of the crew island, used while offline. */
export function loadLocalLayout(storage: Storage = localStorage): unknown {
  try {
    const raw = storage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocalLayout(layout: unknown, storage: Storage = localStorage): void {
  try {
    storage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Storage full or blocked: the island still works, it just won't be kept offline.
  }
}
