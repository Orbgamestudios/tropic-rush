// Bump the version suffix if the shape of SaveData changes incompatibly.
const KEY = "my-pwa-game:save:v1";

export interface SaveData {
  bestScore: number;
}

const DEFAULT_SAVE: SaveData = { bestScore: 0 };

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

export function loadSave(storage: Storage = localStorage): SaveData {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed: Partial<SaveData> = JSON.parse(raw);
    return {
      bestScore: Number.isFinite(parsed.bestScore) ? Number(parsed.bestScore) : 0,
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
