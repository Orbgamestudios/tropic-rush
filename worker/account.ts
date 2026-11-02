// One PlayerAccount Durable Object per username: the password's salted hash, signed-in sessions
// and the player's saved game. Passwords are never stored, and session tokens only as hashes, so
// reading this storage gives away neither.

import { DurableObject } from "cloudflare:workers";
import { accountKey, MAX_SAVE_CHARS } from "../src/game/logic/account";

/** As many as Cloudflare Workers allow for PBKDF2. */
const HASH_ROUNDS = 100_000;
const SESSION_MS = 365 * 24 * 3_600_000;
const MOST_SESSIONS = 10;
/** Wrong passwords before the account stops listening for a while. */
const MOST_FAILS = 8;
const LOCK_MS = 5 * 60_000;

interface Session {
  hash: string;
  expires: number;
}

interface Record {
  username: string;
  salt: string;
  hash: string;
  sessions: Session[];
  fails: number;
  lockedUntil: number;
}

export type AccountResult =
  | { ok: true; token: string; username: string; save: string | null; savedAt: number }
  | { ok: false; error: string };

export type SyncResult = { ok: true; save: string | null; savedAt: number } | { ok: false };

const hex = (bytes: ArrayBuffer | Uint8Array): string =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

function randomHex(bytes: number): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: HASH_ROUNDS,
    },
    key,
    256,
  );
  return hex(bits);
}

async function hashToken(token: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

/** Compares without stopping at the first difference, so timing gives nothing away. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export class PlayerAccount extends DurableObject {
  private read(): Promise<Record | undefined> {
    return this.ctx.storage.get<Record>("account");
  }

  private async savedGame(): Promise<{ save: string | null; savedAt: number }> {
    const save = (await this.ctx.storage.get<string>("save")) ?? null;
    const savedAt = (await this.ctx.storage.get<number>("savedAt")) ?? 0;
    return { save, savedAt };
  }

  private async startSession(record: Record): Promise<string> {
    const token = `${accountKey(record.username)}.${randomHex(32)}`;
    const now = Date.now();
    const live = record.sessions.filter((s) => s.expires > now).slice(-(MOST_SESSIONS - 1));
    live.push({ hash: await hashToken(token), expires: now + SESSION_MS });
    await this.ctx.storage.put("account", { ...record, sessions: live });
    return token;
  }

  async signUp(username: string, password: string, save: string): Promise<AccountResult> {
    if (await this.read()) return { ok: false, error: "That name is taken" };
    const salt = randomHex(16);
    const record: Record = {
      username,
      salt,
      hash: await hashPassword(password, salt),
      sessions: [],
      fails: 0,
      lockedUntil: 0,
    };
    const savedAt = Date.now();
    await this.ctx.storage.put({ save: save.slice(0, MAX_SAVE_CHARS), savedAt });
    return { ok: true, token: await this.startSession(record), username, save: null, savedAt };
  }

  async logIn(password: string): Promise<AccountResult> {
    const record = await this.read();
    const refused = "Wrong name or password";
    if (!record) return { ok: false, error: refused };
    if (Date.now() < record.lockedUntil) {
      return { ok: false, error: "Too many tries: wait a few minutes" };
    }
    if (!same(await hashPassword(password, record.salt), record.hash)) {
      const fails = record.fails + 1;
      const locked = fails >= MOST_FAILS;
      await this.ctx.storage.put("account", {
        ...record,
        fails: locked ? 0 : fails,
        lockedUntil: locked ? Date.now() + LOCK_MS : 0,
      });
      return { ok: false, error: refused };
    }
    const token = await this.startSession({ ...record, fails: 0, lockedUntil: 0 });
    return { ok: true, token, username: record.username, ...(await this.savedGame()) };
  }

  private async sessionOk(token: string): Promise<boolean> {
    const record = await this.read();
    if (!record) return false;
    const hash = await hashToken(token);
    return record.sessions.some((s) => s.expires > Date.now() && same(s.hash, hash));
  }

  /** The saved game, for a phone checking whether it's behind. */
  async pull(token: string): Promise<SyncResult> {
    if (!(await this.sessionOk(token))) return { ok: false };
    return { ok: true, ...(await this.savedGame()) };
  }

  async push(token: string, save: string): Promise<SyncResult> {
    if (!(await this.sessionOk(token)) || save.length > MAX_SAVE_CHARS) return { ok: false };
    const savedAt = Date.now();
    await this.ctx.storage.put({ save, savedAt });
    return { ok: true, save: null, savedAt };
  }

  async logOut(token: string): Promise<void> {
    const record = await this.read();
    if (!record) return;
    const hash = await hashToken(token);
    const sessions = record.sessions.filter((s) => !same(s.hash, hash));
    await this.ctx.storage.put("account", { ...record, sessions });
  }
}
