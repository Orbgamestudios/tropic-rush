// The Hourglass panel, on the crew's island: where it's hidden, what mending it takes, and once it's
// whole, breaking the player's own crystals into the time shards they choose.

import { CRYSTAL_KINDS, type CrystalKind, type Crystals } from "../logic/crystals";
import { costText } from "../logic/economy";
import { HOURGLASS_COST, type HourglassState } from "../logic/hourglass";
import { type Shards, TIME_POWER_SPECS, TIME_POWERS, type TimePower } from "../logic/timeShards";
import {
  button,
  closeOnBackdrop,
  closeSoftly,
  costChips,
  crystalChip,
  el,
  isOpen,
  openSoftly,
  panel,
} from "./kit/dom";
import { sfx } from "./kit/fx";

export interface HourglassView {
  hourglass: HourglassState;
  now: number;
  /** Why it can't be mended right now, or null. */
  blocker: string | null;
  crystals: Crystals;
  shards: Shards;
}

export interface HourglassHandlers {
  onMend(): void;
  onBreak(kind: CrystalKind, power: TimePower): void;
}

export class HourglassPanel {
  private readonly root = el("div", "crew-join crew-hourglass");
  private readonly body: HTMLElement;
  private power: TimePower = "slow";
  private last: HourglassView | null = null;
  private result = "";

  constructor(
    parent: HTMLElement,
    private readonly handlers: HourglassHandlers,
  ) {
    const card = panel("The Hourglass", "crew-night-card");
    this.body = card.body;
    this.body.classList.add("crew-hourglass-body");
    card.root.append(
      button({
        icon: "close",
        aria: "Close the Hourglass",
        round: true,
        variant: "red",
        size: "sm",
        className: "crew-join-close",
        onClick: () => this.hide(),
      }),
    );
    this.root.append(card.root);
    this.root.style.display = "none";
    closeOnBackdrop(this.root, () => this.hide());
    parent.append(this.root);
  }

  get open(): boolean {
    return isOpen(this.root);
  }

  show(view: HourglassView): void {
    this.last = view;
    openSoftly(this.root);
    this.draw();
  }

  hide(): void {
    closeSoftly(this.root);
  }

  /** Says what the last crystal broke into. */
  broke(kind: CrystalKind, power: TimePower, made: number): void {
    const name = TIME_POWER_SPECS[power].name;
    this.result = `A ${kind} crystal broke into ${made} ${name} shard${made === 1 ? "" : "s"}.`;
    this.draw();
  }

  private draw(): void {
    const view = this.last;
    if (!view) return;
    const { hourglass: h } = view;
    const lines: HTMLElement[] = [];
    const say = (text: string) => lines.push(el("div", "crew-hourglass-text", text));
    if (!h.found) {
      say("A ruin lies deep in the jungle, where a chainsaw has to go.");
      say("Clear the forest to find it. The old wise ones broke crystals into time there.");
    } else if (!h.mended && h.doneAt === null) {
      say("Cracked and overgrown. Mend it, and it will break crystals into time shards again.");
      const cost = el("div", "crew-hourglass-cost");
      cost.append(costChips(costText(HOURGLASS_COST)), el("span", "", "· a day's work"));
      const mend = button({
        label: "Mend",
        icon: "hammer",
        variant: "green",
        size: "sm",
        onClick: () => this.handlers.onMend(),
      });
      mend.disabled = view.blocker !== null;
      lines.push(cost, mend);
      if (view.blocker) lines.push(el("div", "crew-statue-blocker", view.blocker));
    } else if (!h.mended) {
      const left = Math.max(0, (h.doneAt ?? view.now) - view.now);
      const hours = Math.floor(left / 3_600_000);
      const minutes = Math.ceil((left % 3_600_000) / 60_000);
      say(`Being mended: whole again in ${hours > 0 ? `${hours}h ` : ""}${minutes}m.`);
    } else {
      say("Choose a power, then tap a crystal to break it into shards of it: usually 2 to 4.");
      const powers = el("div", "crew-hourglass-row");
      for (const power of TIME_POWERS) {
        const spec = TIME_POWER_SPECS[power];
        const b = el("button", `heroes-shard${power === this.power ? " taking" : ""}`);
        b.style.setProperty("--tint", spec.color);
        b.title = `${spec.name}: ${spec.text}`;
        b.setAttribute("aria-label", spec.name);
        b.append(
          el("span", "heroes-shard-glyph", spec.glyph),
          el("span", "heroes-shard-count", String(view.shards[power] ?? 0)),
        );
        b.addEventListener("click", () => {
          sfx.press();
          this.power = power;
          this.draw();
        });
        powers.append(b);
      }
      lines.push(el("div", "crew-hourglass-label", TIME_POWER_SPECS[this.power].name), powers);
      const crystals = el("div", "crew-hourglass-row");
      for (const kind of CRYSTAL_KINDS) {
        const b = button({
          label: "Break",
          variant: "blue",
          size: "sm",
          onClick: () => this.handlers.onBreak(kind, this.power),
        });
        b.querySelector(".ui-btn-face")?.append(crystalChip(kind, view.crystals[kind]));
        b.disabled = view.crystals[kind] <= 0;
        crystals.append(b);
      }
      lines.push(crystals);
      if (this.result) lines.push(el("div", "crew-hourglass-result", this.result));
    }
    this.body.replaceChildren(...lines);
  }
}
