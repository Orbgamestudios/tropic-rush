// The Cloudflare Worker: serves the game's files and runs one CrewIsland Durable Object per crew,
// which keeps that crew's island and relays changes between crewmates in real time.
//
//   POST /api/crew/new            -> { code } a fresh invite code
//   GET  /api/crew/<code>/socket  -> WebSocket to that crew's island
//   anything else                 -> the game (static assets)

import { DurableObject } from "cloudflare:workers";
import {
  type CrewLayout,
  sanitizeLayout,
  starterLayout,
  tryOp,
} from "../src/game/logic/crewIsland";
import {
  type ClientMessage,
  CREW_CODE_PATTERN,
  cleanName,
  type Hold,
  MAX_CREW,
  type Member,
  newCrewCode,
  type ServerMessage,
} from "../src/game/net/protocol";

interface Env {
  ASSETS: Fetcher;
  CREW_ISLAND: DurableObjectNamespace<CrewIsland>;
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
    if (url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

interface RosterEntry {
  id: string;
  name: string;
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

  private async load(): Promise<{ layout: CrewLayout; roster: RosterEntry[] }> {
    this.layout ??= sanitizeLayout(
      (await this.ctx.storage.get("layout")) ?? starterLayout(Date.now()),
      Date.now(),
    );
    this.roster ??= (await this.ctx.storage.get<RosterEntry[]>("roster")) ?? [];
    return { layout: this.layout, roster: this.roster };
  }

  async fetch(): Promise<Response> {
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
      if (!memberId) return;
      const known = roster.find((m) => m.id === memberId);
      if (!known && roster.length >= MAX_CREW) {
        send(ws, { t: "full" });
        ws.close(4001, "Crew is full");
        return;
      }
      if (known) known.name = name;
      else roster.push({ id: memberId, name });
      await this.ctx.storage.put("roster", roster);
      ws.serializeAttachment({ memberId, name, hold: null } satisfies Attachment);
      this.broadcast(null);
      return;
    }
    if (!me) return; // must say hello first

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
          : op.kind === "clear" || op.kind === "toolUp"
            ? undefined
            : op.id;
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
