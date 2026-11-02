import { type Avatar, DEFAULT_AVATAR, readAvatar } from "./logic/avatars";
import { type Purse, RESOURCES } from "./logic/economy";
import { HERO_KINDS, type HeroKind, STARTER_HEROES } from "./logic/heroes";
import { MAX_HERO_LEVEL } from "./logic/heroProgress";
import type { NightRaid } from "./logic/nightRaid";
import { NEW_WORLD, sanitizeWorld, type WorldProgress } from "./logic/worldMap";

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
  /** The player icon on their profile. */
  avatar: Avatar;
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
  settings: Settings;
  /** The last night the raid was run for; 0 until this phone has seen its first night. */
  nightChecked: number;
  /** The latest night raid, for its report and replay. */
  nightRaid: NightRaid | null;
  /** Which islands of the world are taken, retaken or out of the cloud. */
  world: WorldProgress;
  /** Materials from raids that haven't reached the crew's stock yet. */
  loot: Partial<Purse>;
  /** The latest islands raiders took back, to say so when the player next looks at the map. */
  lostIslands: string[];
}

/** Where a control rests: its middle as a share of the screen (0 to 1), and its size. */
export interface ControlSpot {
  x: number;
  y: number;
  size: number;
}

export type ControlName = "move" | "aim";
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
  /** Music, separately from the sound effects. */
  musicMuted: boolean;
  /** Little taps of the phone's vibration motor on hits and buttons. */
  haptics: boolean;
  /** Where the sticks sit, and how big they are. */
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
};

export const DEFAULT_SETTINGS: Settings = {
  tilt: 0,
  zoom: 0.37,
  uiScale: 0.7,
  camera: "top",
  muted: false,
  musicMuted: false,
  haptics: true,
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
  return { move: spot("move"), aim: spot("aim") };
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
    musicMuted: v.musicMuted === true,
    haptics: v.haptics !== false,
    controls: readControls(v.controls),
    rev: SETTINGS_REV,
  };
}

const starters = (): HeroKind[] => HERO_KINDS.filter((k) => STARTER_HEROES.includes(k));

const startLevels = (): Record<HeroKind, number> =>
  Object.fromEntries(HERO_KINDS.map((k) => [k, 1])) as Record<HeroKind, number>;

const DEFAULT_SAVE: SaveData = {
  hero: "rifleman",
  level: 1,
  wins: 0,
  bestDestruction: 0,
  nickname: "",
  avatar: DEFAULT_AVATAR,
  crewCode: "",
  memberId: "",
  gold: 300,
  medals: 0,
  heroLevels: startLevels(),
  unlocked: starters(),
  settings: DEFAULT_SETTINGS,
  nightChecked: 0,
  nightRaid: null,
  world: NEW_WORLD,
  loot: {},
  lostIslands: [],
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

function readLoot(value: unknown): Partial<Purse> {
  const v = (value ?? {}) as Partial<Record<keyof Purse, unknown>>;
  const out: Partial<Purse> = {};
  for (const r of RESOURCES) {
    const amount = count(v[r]);
    if (amount > 0) out[r] = amount;
  }
  return out;
}

const fresh = (): SaveData => ({
  ...DEFAULT_SAVE,
  heroLevels: startLevels(),
  unlocked: starters(),
  settings: { ...DEFAULT_SETTINGS, controls: readControls(null) },
});

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

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
      avatar: readAvatar(parsed.avatar),
      crewCode: text(parsed.crewCode, 6),
      memberId: text(parsed.memberId, 64),
      gold: parsed.gold === undefined ? DEFAULT_SAVE.gold : count(parsed.gold),
      medals: count(parsed.medals),
      heroLevels,
      unlocked,
      settings: readSettings(parsed.settings),
      nightChecked: count(parsed.nightChecked),
      nightRaid: readNightRaid(parsed.nightRaid),
      world: sanitizeWorld(parsed.world),
      loot: readLoot(parsed.loot),
      lostIslands: Array.isArray(parsed.lostIslands)
        ? parsed.lostIslands.filter((n): n is string => typeof n === "string").slice(0, 8)
        : [],
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

/**
 * Starts the game over, wiping progress and this phone's island. Who the player is and how they
 * like things set up stay. It leaves their crew, whose island is shared and isn't theirs to wipe.
 */
export function resetGame(
  keep: Pick<SaveData, "nickname" | "avatar" | "memberId" | "settings">,
  storage: Storage = localStorage,
): SaveData {
  const { nickname, avatar, memberId, settings } = keep;
  const save = { ...fresh(), nickname, avatar, memberId, settings };
  writeSave(save, storage);
  storage.removeItem(LAYOUT_KEY);
  return save;
}

const LAYOUT_KEY = "tropic-rush:crew-layout:v1";
const ACCOUNT_KEY = "tropic-rush:account:v1";

/** Who's signed in on this phone. Kept apart from the save, so it never leaves the phone with it. */
export interface AccountSession {
  token: string;
  username: string;
  /** When this phone last matched the server, by the server's clock. */
  syncedAt: number;
}

export function loadAccount(storage: Storage = localStorage): AccountSession | null {
  try {
    const value = JSON.parse(storage.getItem(ACCOUNT_KEY) ?? "null");
    const ok = typeof value?.token === "string" && typeof value.username === "string";
    return ok ? { ...value, syncedAt: count(value.syncedAt) } : null;
  } catch {
    return null;
  }
}

export function writeAccount(
  session: AccountSession | null,
  storage: Storage = localStorage,
): void {
  try {
    if (session) storage.setItem(ACCOUNT_KEY, JSON.stringify(session));
    else storage.removeItem(ACCOUNT_KEY);
  } catch {
    // Storage full or blocked: they'll just need to log in again next time.
  }
}

/** Everything an account keeps, as one string: the save and this phone's island. */
export function saveBundle(storage: Storage = localStorage): string {
  return JSON.stringify({ save: storage.getItem(KEY), layout: storage.getItem(LAYOUT_KEY) });
}

/** Takes on a bundle from the account, replacing what's on this phone. */
export function restoreBundle(bundle: string, storage: Storage = localStorage): boolean {
  try {
    const { save, layout } = JSON.parse(bundle) as { save?: unknown; layout?: unknown };
    if (typeof save !== "string") return false;
    storage.setItem(KEY, save);
    if (typeof layout === "string") storage.setItem(LAYOUT_KEY, layout);
    return true;
  } catch {
    return false;
  }
}

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
