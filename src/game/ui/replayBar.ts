// The night raid replay's overlay: a moonlit tint over the island, what's happening, the playback
// speed, and a way to skip to the report.

import { destructionPercent, type RaidState } from "../logic/raid";
import { button, el } from "./kit/dom";
import { sfx } from "./kit/fx";

export interface ReplayHandlers {
  onSpeed(speed: number): void;
  onSkip(): void;
}

const SPEEDS = [1, 2, 4] as const;

export class ReplayBar {
  readonly root = el("div", "replay");
  private readonly clock = el("span", "replay-stat");
  private readonly raiders = el("span", "replay-stat");
  private readonly damage = el("span", "replay-stat");
  private readonly speeds = new Map<number, HTMLButtonElement>();

  constructor(parent: HTMLElement, handlers: ReplayHandlers) {
    const bar = el("div", "replay-bar");
    const stats = el("div", "replay-stats");
    stats.append(this.clock, this.raiders, this.damage);
    bar.append(el("div", "replay-title", "Night raid replay"), stats);
    const controls = el("div", "replay-controls");
    for (const speed of SPEEDS) {
      const b = button({
        label: `${speed}x`,
        variant: "steel",
        size: "sm",
        onClick: () => {
          sfx.tick();
          this.select(speed);
          handlers.onSpeed(speed);
        },
      });
      this.speeds.set(speed, b);
      controls.append(b);
    }
    controls.append(
      button({ label: "Skip", variant: "gold", size: "sm", onClick: () => handlers.onSkip() }),
    );
    bar.append(controls);
    this.root.append(el("div", "replay-tint"), bar);
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(on: boolean): void {
    this.root.style.display = on ? "block" : "none";
    if (on) this.select(1);
  }

  private select(speed: number): void {
    for (const [s, b] of this.speeds) b.classList.toggle("selected", s === speed);
  }

  update(state: RaidState): void {
    const total = Math.floor(state.time);
    this.clock.textContent = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    const left = state.heroes.filter((h) => h.alive).length;
    this.raiders.textContent = `${left} raider${left === 1 ? "" : "s"} left`;
    this.damage.textContent = `${destructionPercent(state)}% destroyed`;
  }
}
