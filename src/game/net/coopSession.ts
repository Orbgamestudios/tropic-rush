// One raid's worth of teaming up: passes controls and snapshots between phones at a steady rate
// (see logic/coop.ts for what's in them). The host calls `hostInputs` for every step and
// `hostFrame` every frame; a guest calls `guestFrame` every frame and hands snapshots to `receive`.

import {
  afterStep,
  applySnapshot,
  type HeroTargets,
  holdInput,
  predict,
  type RaidSnapshot,
  type Seat,
  takeSnapshot,
} from "../logic/coop";
import { type HeroInput, IDLE_INPUT, type RaidEvent, type RaidState } from "../logic/raid";
import type { RaidMessage } from "./protocol";

const SNAPS_PER_SECOND = 12;
const INPUTS_PER_SECOND = 20;
/** The most effects a single snapshot carries, so a huge blast can't swamp a slow connection. */
const MOST_EVENTS = 60;
/** A guest gives up on a host who's said nothing for this long, in seconds. */
export const HOST_TIMEOUT = 8;

export class CoopSession {
  private readonly held: HeroInput[];
  private readonly events: RaidEvent[] = [];
  private readonly seen = new Map<number, number>();
  private readonly targets: HeroTargets = [];
  private snapIn = 0;
  private inputIn = 0;
  private outgoing: HeroInput = IDLE_INPUT;
  /** Seconds since the host was last heard from. */
  silence = 0;

  constructor(
    readonly raidId: string,
    readonly seats: readonly Seat[],
    /** Which seat this phone is; seat 0 is the host. */
    readonly seat: number,
    private readonly send: (message: RaidMessage, to?: string) => void,
  ) {
    this.held = seats.map(() => IDLE_INPUT);
  }

  get isHost(): boolean {
    return this.seat === 0;
  }

  /** Everyone's input for this step, taking each guest's one-off presses as they're used. */
  hostInputs(player: HeroInput): HeroInput[] {
    return this.held.map((input, i) => {
      if (i === 0) return player;
      this.held[i] = afterStep(input);
      return input;
    });
  }

  /** A guest's controls have arrived. */
  receiveInput(seat: number, input: HeroInput): void {
    const held = this.held[seat];
    if (held) this.held[seat] = holdInput(held, input);
  }

  /** Someone's phone has gone: their hero stops where they are. */
  dropSeat(seat: number): void {
    if (this.held[seat]) this.held[seat] = IDLE_INPUT;
  }

  /** Remembers a step's events for the next snapshot. */
  collect(events: readonly RaidEvent[]): void {
    if (this.events.length < MOST_EVENTS) this.events.push(...events);
  }

  hostFrame(state: RaidState, dt: number): void {
    this.snapIn -= dt;
    if (this.snapIn > 0) return;
    this.snapIn = 1 / SNAPS_PER_SECOND;
    const snap = takeSnapshot(state, this.events, this.seen);
    this.events.length = 0;
    this.send({ k: "snap", raidId: this.raidId, snap });
  }

  /** Moves things along on a guest's phone, and sends the controls off to the host. */
  guestFrame(state: RaidState, input: HeroInput, dt: number): void {
    this.silence += dt;
    predict(state, this.seat, input, this.targets, dt);
    this.outgoing = holdInput(this.outgoing, input);
    this.inputIn -= dt;
    if (this.inputIn > 0) return;
    this.inputIn = 1 / INPUTS_PER_SECOND;
    const host = this.seats[0]?.member;
    this.send({ k: "input", raidId: this.raidId, seat: this.seat, input: this.outgoing }, host);
    this.outgoing = afterStep(this.outgoing);
  }

  /** A snapshot has arrived; returns the effects to show. */
  receive(state: RaidState, snap: RaidSnapshot): readonly RaidEvent[] {
    this.silence = 0;
    applySnapshot(state, snap, this.seat, this.targets);
    return snap.events;
  }
}
