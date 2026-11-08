// The picture washed in a time power's color while it runs: yellow for slow, blue for pause, and
// so on, with a red flash when a retry brings someone back. Laid over the canvas, under the HUD,
// so the buttons keep their own colors; hidden when idle so it costs nothing. The HUD names it.

import type { RaidState } from "../logic/raid";
import { TIME_POWER_SPECS, type TimePower } from "../logic/timeShards";
import { el } from "./kit/dom";
import { sfx } from "./kit/fx";
import { timeSign } from "./kit/timeIcons";

export class TimeTint {
  private readonly wash = el("div", "time-tint");
  private readonly edge = el("div", "time-tint-edge");
  private readonly flash = el("div", "time-tint-flash");
  /** Streaks across the picture and a rewind sign, while time runs back. */
  private readonly rewind = el("div", "time-rewind");
  private replaying = false;
  private shown: TimePower | null = null;
  private state: RaidState | null = null;
  private retries = 0;

  /** Goes straight after the canvas, so it washes the picture and nothing laid over it. */
  constructor(container: HTMLElement) {
    this.rewind.append(timeSign("rewind", "time-rewind-sign"));
    container.append(this.wash, this.edge, this.flash, this.rewind);
  }

  /** Follows the raid's time power; null away from a raid. */
  update(state: RaidState | null): void {
    if (state !== this.state) {
      this.state = state;
      this.retries = state?.retries ?? 0;
    }
    const power = state?.timePower?.power ?? null;
    if (power !== this.shown) this.show(power);
    if (state && state.retries < this.retries) this.retried();
    this.retries = state?.retries ?? 0;
    // A record's first half is over: time runs back to where it began.
    const replaying = state?.timePower?.replaying === true;
    if (replaying && !this.replaying) this.runBack();
    this.replaying = replaying;
  }

  private show(power: TimePower | null): void {
    const was = this.shown;
    this.shown = power;
    for (const node of [this.wash, this.edge]) node.classList.toggle("on", power !== null);
    if (!power) {
      if (was) sfx.timeEnd();
      return;
    }
    const { color } = TIME_POWER_SPECS[power];
    for (const node of [this.wash, this.edge]) node.style.setProperty("--tint", color);
    sfx.timePower(power);
  }

  private retried(): void {
    this.flash.style.setProperty("--tint", TIME_POWER_SPECS.retry.color);
    replay(this.flash, "on");
    this.runBack();
  }

  private runBack(): void {
    replay(this.rewind, "on");
    sfx.rewindSweep();
  }
}

/** Starts a one-off CSS animation again from the top. */
function replay(node: HTMLElement, name: string): void {
  node.classList.remove(name);
  void node.offsetWidth;
  node.classList.add(name);
}
