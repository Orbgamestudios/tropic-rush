// The phone's connection to its crew island server. Reconnects on its own; while there's no
// connection the island keeps working on this phone, and the server's copy wins on reconnect.

import type { Avatar } from "../logic/avatars";
import type { CrewLayout, LayoutOp } from "../logic/crewIsland";
import type { ClientMessage, Hold, Member, RaidMessage, ServerMessage } from "./protocol";

export type ConnectionStatus = "connecting" | "online" | "offline" | "full";

export interface CrewClientEvents {
  onState(
    layout: CrewLayout,
    members: Member[],
    holds: Hold[],
    by: string | null,
    serverNow: number,
  ): void;
  onReject(reason: string): void;
  onStatus(status: ConnectionStatus): void;
  /** Something a crewmate's phone sent this one, for raiding together. */
  onRelay?(from: string, data: RaidMessage): void;
}

/** Keeps raid snapshots small: nothing on screen needs more than two decimal places. */
function shorten(_key: string, value: unknown): unknown {
  return typeof value === "number" && !Number.isInteger(value)
    ? Math.round(value * 100) / 100
    : value;
}

/** Asks the server for a new crew code; null when there's no server (offline or dev). */
export async function requestCrewCode(): Promise<string | null> {
  try {
    const response = await fetch("/api/crew/new", { method: "POST" });
    if (!response.ok) return null;
    const body = (await response.json()) as { code?: unknown };
    return typeof body.code === "string" ? body.code : null;
  } catch {
    return null;
  }
}

export class CrewClient {
  private socket: WebSocket | null = null;
  private nextOpId = 1;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  status: ConnectionStatus = "connecting";

  constructor(
    private readonly code: string,
    private readonly memberId: string,
    private readonly name: string,
    private readonly avatar: Avatar,
    private readonly events: CrewClientEvents,
  ) {
    this.connect();
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.events.onStatus(status);
  }

  private connect(): void {
    if (this.closed) return;
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    let socket: WebSocket;
    try {
      socket = new WebSocket(`${scheme}://${location.host}/api/crew/${this.code}/socket`);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.retry = 0;
      this.send({ t: "hello", memberId: this.memberId, name: this.name, avatar: this.avatar });
    });
    socket.addEventListener("message", (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.t === "state") {
        if (this.status !== "online") this.setStatus("online");
        this.events.onState(
          message.layout,
          message.members,
          message.holds,
          message.by,
          typeof message.now === "number" ? message.now : Date.now(),
        );
      } else if (message.t === "reject") {
        this.events.onReject(message.reason);
      } else if (message.t === "relay") {
        this.events.onRelay?.(message.from, message.data);
      } else if (message.t === "full") {
        this.closed = true;
        this.setStatus("full");
      }
    });
    socket.addEventListener("close", () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.closed) return;
      this.setStatus("offline");
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.closed || this.timer) return;
    const delay = Math.min(10_000, 1000 * 2 ** this.retry);
    this.retry++;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }

  private send(message: ClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message, message.t === "relay" ? shorten : undefined));
    return true;
  }

  relay(data: RaidMessage, to?: string): void {
    this.send({ t: "relay", data, to });
  }

  sendOp(op: LayoutOp): boolean {
    return this.send({ t: "op", op, opId: this.nextOpId++ });
  }

  hold(buildingId: string | null): void {
    this.send({ t: "hold", buildingId });
  }

  close(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.socket?.close();
    this.socket = null;
  }
}
