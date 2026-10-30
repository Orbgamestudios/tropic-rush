import { HERO_KINDS, type HeroKind, STARTER_HEROES } from "./logic/heroes";
import { MAX_HERO_LEVEL } from "./logic/heroProgress";
import type { NightRaid } from "./logic/nightRaid";

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
  /** Personal gold, won on raids and spent levelling heroes. */
  gold: number;
  /** Personal medals, won with victories and spent unlocking heroes. */
  medals: number;
  /** Each hero's level (1 to 10). */
  heroLevels: Record<HeroKind, number>;
  /** Heroes this player can pick. */
  unlocked: HeroKind[];
  /** AI squadmates brought along on raids (unlocked heroes, at most MAX_SQUAD). */
  squad: HeroKind[];
  settings: Settings;
  /** The last night the raid was run for; 0 until this phone has seen its first night. */
  nightChecked: number;
  /** The latest night raid, for its report and replay. */
  nightRaid: NightRaid | null;
  /** Islands beaten on the world map, and which day that map was for. */
  beaten: { day: number; ids: number[] };
}

/** Where a control rests: its middle as a share of the screen (0 to 1), and its size. */
export interface ControlSpot {
  x: number;
  y: number;
  size: number;
}

export type ControlName = "move" | "aim" | "super";
export type ControlLayout = Record<ControlName, ControlSpot>;

export type CameraMode = "top" | "behind";

/** Player settings from the pause menu. */
export interface Settings {
  /** Raid camera tilt: 0 is the default, lower looks out further, higher looks down. */
  tilt: number;
  /** Raid camera distance: 0 close to the hero, 1 far back. */
  zoom: number;
  /** Size of every menu, button and the HUD. */
  uiScale: number;
  /** Raid camera: the angled view from above, or following close behind the hero. */
  camera: CameraMode;
  muted: boolean;
  /** Where the sticks and the Super button sit, and how big they are. */
  controls: ControlLayout;
  /** Bumped when the defaults change, so older saves pick up the new tilt and UI size. */
  rev: number;
}

const SETTINGS_REV = 2;
export const TILT_RANGE = [-0.6, 1] as const;
export const UI_SCALE_RANGE = [0.4, 1.25] as const;
export const CONTROL_SIZE_RANGE = [0.5, 2] as const;

export const DEFAULT_CONTROLS: ControlLayout = {
  move: { x: 0.12, y: 0.76, size: 1 },
  aim: { x: 0.9, y: 0.76, size: 1 },
  super: { x: 0.74, y: 0.66, size: 1 },
};

export const DEFAULT_SETTINGS: Settings = {
  tilt: 0,
  zoom: 0.37,
  uiScale: 0.7,
  camera: "top",
  muted: false,
  controls: DEFAULT_CONTROLS,
  rev: SETTINGS_REV,
};

function ranged(x: unknown, min: number, max: number, fallback: number): number {
  return typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback;
}

function readControls(value: unknown): ControlLayout {
  const raw = (value ?? {}) as Partial<Record<ControlName, Partial<ControlSpot>>>;
  const spot = (name: ControlName): ControlSpot => {
    const d = DEFAULT_CONTROLS[name];
    return {
      x: ranged(raw[name]?.x, 0, 1, d.x),
      y: ranged(raw[name]?.y, 0, 1, d.y),
      size: ranged(raw[name]?.size, CONTROL_SIZE_RANGE[0], CONTROL_SIZE_RANGE[1], d.size),
    };
  };
  return { move: spot("move"), aim: spot("aim"), super: spot("super") };
}

function readSettings(value: unknown): Settings {
  const v = (value ?? {}) as Partial<Record<keyof Settings, unknown>>;
  const current = v.rev === SETTINGS_REV;
  return {
    tilt: current ? ranged(v.tilt, TILT_RANGE[0], TILT_RANGE[1], DEFAULT_SETTINGS.tilt) : 0,
    zoom: ranged(v.zoom, 0, 1, DEFAULT_SETTINGS.zoom),
    uiScale: current
      ? ranged(v.uiScale, UI_SCALE_RANGE[0], UI_SCALE_RANGE[1], DEFAULT_SETTINGS.uiScale)
      : DEFAULT_SETTINGS.uiScale,
    camera: v.camera === "behind" ? "behind" : "top",
    muted: v.muted === true,
    controls: readControls(v.controls),
    rev: SETTINGS_REV,
  };
}

/** AI squadmates fill the other crew seats: a crew is up to 5 heroes. */
export const MAX_SQUAD = 4;

const starters = (): HeroKind[] => HERO_KINDS.filter((k) => STARTER_HEROES.includes(k));

const startLevels = (): Record<HeroKind, number> =>
  Object.fromEntries(HERO_KINDS.map((k) => [k, 1])) as Record<HeroKind, number>;

const DEFAULT_SAVE: SaveData = {
  hero: "rifleman",
  level: 1,
  wins: 0,
  bestDestruction: 0,
  nickname: "",
  crewCode: "",
  memberId: "",
  gold: 300,
  medals: 0,
  heroLevels: startLevels(),
  unlocked: starters(),
  squad: starters().slice(1),
  settings: DEFAULT_SETTINGS,
  nightChecked: 0,
  nightRaid: null,
  beaten: { day: 0, ids: [] },
};

function readNightRaid(value: unknown): NightRaid | null {
  const v = value as Partial<NightRaid> | null | undefined;
  const ok =
    typeof v?.seed === "number" &&
    typeof v.night === "number" &&
    Array.isArray(v.buildings) &&
    Array.isArray(v.cleared) &&
    typeof v.report?.survived === "boolean";
  return ok ? (v as NightRaid) : null;
}

function readBeaten(value: unknown): SaveData["beaten"] {
  const v = value as Partial<SaveData["beaten"]> | null | undefined;
  return {
    day: count(v?.day),
    ids: Array.isArray(v?.ids) ? v.ids.filter((id) => Number.isInteger(id)) : [],
  };
}

const fresh = (): SaveData => ({
  ...DEFAULT_SAVE,
  heroLevels: startLevels(),
  unlocked: starters(),
  squad: [...DEFAULT_SAVE.squad],
  settings: { ...DEFAULT_SETTINGS, controls: readControls(null) },
});

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
    if (!raw) return fresh();
    const parsed: Partial<Record<keyof SaveData, unknown>> = JSON.parse(raw);
    const hero = HERO_KINDS.find((k) => k === parsed.hero) ?? DEFAULT_SAVE.hero;
    const level = count(parsed.level, 3);
    const rawLevels = (parsed.heroLevels ?? {}) as Partial<Record<HeroKind, unknown>>;
    const heroLevels = startLevels();
    for (const k of HERO_KINDS) heroLevels[k] = Math.max(1, count(rawLevels[k], MAX_HERO_LEVEL));
    const rawUnlocked = Array.isArray(parsed.unlocked) ? parsed.unlocked : [];
    const unlocked = HERO_KINDS.filter(
      (k) => STARTER_HEROES.includes(k) || rawUnlocked.includes(k),
    );
    return {
      hero,
      level: level >= 1 ? level : DEFAULT_SAVE.level,
      wins: count(parsed.wins),
      bestDestruction: count(parsed.bestDestruction, 100),
      nickname: text(parsed.nickname, 16),
      crewCode: text(parsed.crewCode, 6),
      memberId: text(parsed.memberId, 64),
      gold: parsed.gold === undefined ? DEFAULT_SAVE.gold : count(parsed.gold),
      medals: count(parsed.medals),
      heroLevels,
      unlocked,
      squad: Array.isArray(parsed.squad)
        ? unlocked.filter((k) => (parsed.squad as unknown[]).includes(k)).slice(0, MAX_SQUAD)
        : DEFAULT_SAVE.squad,
      settings: readSettings(parsed.settings),
      nightChecked: count(parsed.nightChecked),
      nightRaid: readNightRaid(parsed.nightRaid),
      beaten: readBeaten(parsed.beaten),
    };
  } catch {
    return fresh();
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
