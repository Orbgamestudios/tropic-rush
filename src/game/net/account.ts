// Talking to the account server. Everything here comes back as a result, never an exception: no
// connection just means the game carries on with what's on this phone.

interface AccountReply {
  token: string;
  username: string;
  save: string | null;
  savedAt: number;
}

export type AccountResponse = ({ ok: true } & AccountReply) | { ok: false; error: string };

export type SyncResponse = { ok: true; save: string | null; savedAt: number } | { ok: false };

async function post<T>(path: string, body: unknown, fallback: T): Promise<T> {
  try {
    const response = await fetch(`/api/account/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

const NO_SERVER = { ok: false, error: "Couldn't reach the server" } as const;

export function signUp(username: string, password: string, save: string): Promise<AccountResponse> {
  return post("signup", { username, password, save }, NO_SERVER);
}

export function logIn(username: string, password: string): Promise<AccountResponse> {
  return post("login", { username, password }, NO_SERVER);
}

export function pullSave(token: string): Promise<SyncResponse> {
  return post("pull", { token }, { ok: false });
}

export function pushSave(token: string, save: string): Promise<SyncResponse> {
  return post("push", { token, save }, { ok: false });
}

export function logOut(token: string): Promise<unknown> {
  return post("logout", { token }, null);
}
