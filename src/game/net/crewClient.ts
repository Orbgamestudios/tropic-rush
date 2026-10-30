// The phone's connection to its crew island server. Reconnects on its own; while there's no
// connection the island keeps working on this phone, and the server's copy wins on reconnect.

import type { CrewLayout, LayoutOp } from "../logic/crewIsland";
import type { ClientMessage, Hold, Member, ServerMessage } from "./protocol";

export type ConnectionStatus = "connecting" | "online" | "offline" | "full";

export interface CrewClientEvents {
  onState(layout: CrewLayout, members: Member[], holds: Hold[], by: string | null): void;
  onReject(reason: string): void;
  onStatus(status: ConnectionStatus): void;
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
      this.send({ t: "hello", memberId: this.memberId, name: this.name });
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
        this.events.onState(message.layout, message.members, message.holds, message.by);
      } else if (message.t === "reject") {
        this.events.onReject(message.reason);
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
    this.socket.send(JSON.stringify(message));
    return true;
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
