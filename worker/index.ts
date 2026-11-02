// The Cloudflare Worker: serves the game's files and runs one CrewIsland Durable Object per crew,
// which keeps that crew's island and relays changes between crewmates in real time.
//
//   POST /api/crew/new            -> { code } a fresh invite code
//   GET  /api/crew/<code>/socket  -> WebSocket to that crew's island
//   POST /api/account/<action>    -> sign up, log in, log out, check a password, and fetch or
//                                    store a saved game
//   POST /api/world/rivals        -> other crews near this one's strength, to raid
//   POST /api/world/raid          -> tells a rival crew what just happened on their island
//   anything else                 -> the game (static assets)

import { DurableObject } from "cloudflare:workers";
import {
  accountKey,
  MAX_SAVE_CHARS,
  passwordProblem,
  tokenAccount,
  usernameProblem,
} from "../src/game/logic/account";
import { type Avatar, DEFAULT_AVATAR, readAvatar } from "../src/game/logic/avatars";
import {
  applyRivalRaid,
  type CrewLayout,
  hqLevel,
  sanitizeLayout,
  starterLayout,
  tryOp,
} from "../src/game/logic/crewIsland";
import { type Purse, RESOURCES } from "../src/game/logic/economy";
import { statueBuffs } from "../src/game/logic/statues";
import {
  type ClientMessage,
  CREW_CODE_PATTERN,
  type CrewEntry,
  cleanName,
  type Hold,
  MAX_CREW,
  MAX_RELAY,
  type Member,
  newCrewCode,
  type RaidReport,
  type ServerMessage,
} from "../src/game/net/protocol";
import { PlayerAccount } from "./account";
import { WorldDirectory } from "./world";

interface Env {
  ASSETS: Fetcher;
  CREW_ISLAND: DurableObjectNamespace<CrewIsland>;
  ACCOUNT: DurableObjectNamespace<PlayerAccount>;
  WORLD: DurableObjectNamespace<WorldDirectory>;
}

export { PlayerAccount, WorldDirectory };

/** Crews offered to raid at once, and how often a crew's entry in the directory is refreshed. */
const RIVALS_OFFERED = 6;
const PUBLISH_EVERY_MS = 60_000;
const MOST_STOLEN = 50_000;

function directory(env: Env): DurableObjectStub<WorldDirectory> {
  return env.WORLD.get(env.WORLD.idFromName("world"));
}

/** Only numbers we expect, from a report that came off somebody's phone. */
function readLoot(value: unknown): Partial<Purse> {
  const raw = (value ?? {}) as Partial<Record<keyof Purse, unknown>>;
  const loot: Partial<Purse> = {};
  for (const r of RESOURCES) {
    const v = raw[r];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) loot[r] = Math.min(v, MOST_STOLEN);
  }
  return loot;
}

async function handleWorld(action: string, request: Request, env: Env): Promise<Response> {
  let body: Partial<RaidReport> & { code?: unknown; hq?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  if (action === "rivals") {
    const code = typeof body.code === "string" ? body.code : "";
    const hq = typeof body.hq === "number" && Number.isFinite(body.hq) ? body.hq : 1;
    const crews = await directory(env).rivals(code, hq, RIVALS_OFFERED);
    return Response.json({ crews });
  }
  if (action === "raid") {
    const target = typeof body.target === "string" ? body.target : "";
    if (!CREW_CODE_PATTERN.test(target)) return Response.json({ ok: false }, { status: 400 });
    const by = cleanName(typeof body.by === "string" ? body.by : "") || "A rival crew";
    const percent = typeof body.destroyedPercent === "number" ? body.destroyedPercent : 0;
    await env.CREW_ISLAND.get(env.CREW_ISLAND.idFromName(target)).rivalRaid({
      by,
      won: body.won === true,
      destroyedPercent: percent,
      loot: readLoot(body.loot),
    });
    return Response.json({ ok: true });
  }
  return new Response("Not found", { status: 404 });
}

/** Accounts: checks what can be checked here, then hands over to that player's own object. */
async function handleAccount(action: string, request: Request, env: Env): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_SAVE_CHARS + 1000) return Response.json({ ok: false, error: "Too big" });
  let body: { username?: unknown; password?: unknown; save?: unknown; token?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, error: "Bad request" });
  }
  const account = (name: string) => env.ACCOUNT.get(env.ACCOUNT.idFromName(accountKey(name)));
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const save = typeof body.save === "string" ? body.save : "";
  const token = typeof body.token === "string" ? body.token : "";
  if (action === "signup" || action === "login") {
    const problem = usernameProblem(username) ?? passwordProblem(password);
    if (action === "login" && problem) {
      return Response.json({ ok: false, error: "Wrong name or password" });
    }
    if (problem) return Response.json({ ok: false, error: problem });
    const stub = account(username);
    const result =
      action === "signup" ? stub.signUp(username, password, save) : stub.logIn(password);
    return Response.json(await result);
  }
  const owner = tokenAccount(token);
  if (!owner) return Response.json({ ok: false });
  const stub = account(owner);
  if (action === "pull") return Response.json(await stub.pull(token));
  if (action === "push") return Response.json(await stub.push(token, save));
  if (action === "verify") return Response.json(await stub.verify(token, password));
  if (action === "logout") {
    await stub.logOut(token);
    return Response.json({ ok: true });
  }
  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/crew/new" && request.method === "POST") {
      const random = () => (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) / 2 ** 32;
      return Response.json({ code: newCrewCode(random) });
    }
    const socket = url.pathname.match(/^\/api\/crew\/([A-Z0-9]+)\/socket$/);
    if (socket) {
      const code = socket[1] ?? "";
      if (!CREW_CODE_PATTERN.test(code)) return new Response("Unknown crew code", { status: 404 });
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected a WebSocket", { status: 426 });
      }
      return env.CREW_ISLAND.get(env.CREW_ISLAND.idFromName(code)).fetch(request);
    }
    const accountAction = url.pathname.match(/^\/api\/account\/([a-z]+)$/);
    if (accountAction && request.method === "POST") {
      return handleAccount(accountAction[1] ?? "", request, env);
    }
    const worldAction = url.pathname.match(/^\/api\/world\/([a-z]+)$/);
    if (worldAction && request.method === "POST") {
      return handleWorld(worldAction[1] ?? "", request, env);
    }
    if (url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

interface RosterEntry {
  id: string;
  name: string;
  avatar?: Avatar;
}

interface Attachment {
  memberId: string;
  name: string;
  hold: string | null;
}

export class CrewIsland extends DurableObject<Env> {
  // Cached between messages; reloaded from storage after the object hibernates.
  private layout: CrewLayout | null = null;
  private roster: RosterEntry[] | null = null;
  private publishedAt = 0;

  /** Keeps this crew's island in the world's directory, a minute out of date at most. */
  private async publish(): Promise<void> {
    const now = Date.now();
    const { layout, roster } = this;
    if (!layout || !roster || now - this.publishedAt < PUBLISH_EVERY_MS) return;
    const code = await this.ctx.storage.get<string>("code");
    if (!code) return;
    this.publishedAt = now;
    const { health, damage } = statueBuffs(layout.statues);
    const entry: CrewEntry = {
      code,
      name: roster[0] ? `${roster[0].name}'s crew` : "A crew",
      hq: hqLevel(layout),
      buildings: layout.buildings.filter((b) => b.level > 0),
      buffs: { health, damage },
    };
    await directory(this.env).publish(entry);
  }

  /** A rival crew's raid, told to us by the Worker. */
  async rivalRaid(raid: Parameters<typeof applyRivalRaid>[1]): Promise<void> {
    const { layout } = await this.load();
    this.layout = applyRivalRaid(layout, raid, Date.now());
    await this.ctx.storage.put("layout", this.layout);
    this.broadcast(null);
  }

  private async load(): Promise<{ layout: CrewLayout; roster: RosterEntry[] }> {
    this.layout ??= sanitizeLayout(
      (await this.ctx.storage.get("layout")) ?? starterLayout(Date.now()),
      Date.now(),
    );
    this.roster ??= (await this.ctx.storage.get<RosterEntry[]>("roster")) ?? [];
    return { layout: this.layout, roster: this.roster };
  }

  async fetch(request: Request): Promise<Response> {
    const code = new URL(request.url).pathname.match(/\/api\/crew\/([A-Z0-9]+)\/socket/)?.[1];
    if (code) await this.ctx.storage.put("code", code);
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // Hibernatable: the object can sleep between messages without dropping the connection.
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    let message: ClientMessage;
    try {
      message = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data));
    } catch {
      return;
    }
    const { layout, roster } = await this.load();
    const me = ws.deserializeAttachment() as Attachment | null;

    if (message.t === "hello") {
      const memberId = typeof message.memberId === "string" ? message.memberId.slice(0, 64) : "";
      const name = cleanName(typeof message.name === "string" ? message.name : "") || "Crewmate";
      const avatar = readAvatar(message.avatar);
      if (!memberId) return;
      const known = roster.find((m) => m.id === memberId);
      if (!known && roster.length >= MAX_CREW) {
        send(ws, { t: "full" });
        ws.close(4001, "Crew is full");
        return;
      }
      if (known) {
        known.name = name;
        known.avatar = avatar;
      } else roster.push({ id: memberId, name, avatar });
      await this.ctx.storage.put("roster", roster);
      ws.serializeAttachment({ memberId, name, hold: null } satisfies Attachment);
      this.broadcast(null);
      await this.publish();
      return;
    }
    if (!me) return; // must say hello first

    // Raiding together: passed along as it is, and never stored.
    if (message.t === "relay") {
      if (typeof data === "string" && data.length > MAX_RELAY) return;
      for (const other of this.ctx.getWebSockets()) {
        if (other === ws) continue;
        const a = other.deserializeAttachment() as Attachment | null;
        if (!a || a.memberId === me.memberId) continue;
        if (message.to && a.memberId !== message.to) continue;
        send(other, { t: "relay", from: me.memberId, data: message.data });
      }
      return;
    }

    if (message.t === "hold") {
      const id = typeof message.buildingId === "string" ? message.buildingId : null;
      if (id && this.holderOf(id, me.memberId)) return; // someone else has it
      ws.serializeAttachment({ ...me, hold: id } satisfies Attachment);
      this.broadcast(null);
      return;
    }

    if (message.t === "op") {
      const op = message.op;
      const target =
        op.kind === "place"
          ? op.building?.id
          : op.kind === "move" || op.kind === "remove" || op.kind === "upgrade"
            ? op.id
            : undefined;
      if (target && this.holderOf(target, me.memberId)) {
        send(ws, { t: "reject", opId: message.opId, reason: "A crewmate is moving that" });
        this.sendState(ws, null);
        return;
      }
      const result = tryOp(layout, op, Date.now());
      if ("error" in result) {
        send(ws, { t: "reject", opId: message.opId, reason: result.error });
        this.sendState(ws, null);
        return;
      }
      const next = result.layout;
      this.layout = next;
      await this.ctx.storage.put("layout", next);
      this.broadcast(me.name);
      await this.publish();
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    ws.serializeAttachment(null);
    await this.load();
    this.broadcast(null, ws);
  }

  private holderOf(buildingId: string, exceptMemberId: string): Attachment | null {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a && a.hold === buildingId && a.memberId !== exceptMemberId) return a;
    }
    return null;
  }

  private snapshot(excluding?: WebSocket): { members: Member[]; holds: Hold[] } {
    const online = new Map<string, Attachment>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === excluding) continue;
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a) online.set(a.memberId, a);
    }
    const members = (this.roster ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar ?? DEFAULT_AVATAR,
      online: online.has(m.id),
    }));
    const holds: Hold[] = [];
    for (const a of online.values()) {
      if (a.hold) holds.push({ buildingId: a.hold, memberId: a.memberId, name: a.name });
    }
    return { members, holds };
  }

  private sendState(ws: WebSocket, by: string | null): void {
    const { members, holds } = this.snapshot();
    send(ws, {
      t: "state",
      layout: this.layout ?? starterLayout(),
      members,
      holds,
      by,
      now: Date.now(),
    });
  }

  private broadcast(by: string | null, excluding?: WebSocket): void {
    const { members, holds } = this.snapshot(excluding);
    const message: ServerMessage = {
      t: "state",
      layout: this.layout ?? starterLayout(),
      members,
      holds,
      by,
      now: Date.now(),
    };
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== excluding && ws.deserializeAttachment()) send(ws, message);
    }
  }
}

function send(ws: WebSocket, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // The socket is closing; the next broadcast will skip it.
  }
}
