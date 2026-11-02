// Teaming up: a banner when a crewmate is heading out to raid, and the lobby where everyone going
// waits for the host to attack. The only allies on a raid are the people in this list.

import type { Seat } from "../logic/coop";
import { HEROES } from "../logic/heroes";
import { button, el, panel } from "./kit/dom";
import { sfx } from "./kit/fx";

export interface RaidLobbyHandlers {
  onJoin(): void;
  onDismiss(): void;
  onAttack(): void;
  onLeave(): void;
}

export class RaidLobby {
  private readonly banner = el("div", "lobby-banner");
  private readonly bannerText = el("div", "lobby-banner-text");
  private readonly root = el("div", "screen screen-lobby");
  private readonly title = el("div", "lobby-title");
  private readonly seats = el("div", "lobby-seats");
  private readonly status = el("div", "lobby-status");
  private readonly attack: HTMLButtonElement;

  constructor(parent: HTMLElement, handlers: RaidLobbyHandlers) {
    this.banner.append(
      this.bannerText,
      button({
        label: "Join",
        icon: "sword2",
        variant: "green",
        size: "sm",
        onClick: () => handlers.onJoin(),
      }),
      button({
        icon: "close",
        aria: "Not now",
        variant: "steel",
        size: "sm",
        onClick: () => handlers.onDismiss(),
      }),
    );
    this.banner.style.display = "none";
    this.attack = button({
      label: "Attack",
      icon: "sword2",
      variant: "red",
      size: "md",
      onClick: () => handlers.onAttack(),
    });
    const leave = button({
      label: "Leave",
      icon: "close",
      variant: "steel",
      size: "md",
      onClick: () => handlers.onLeave(),
    });
    const actions = el("div", "lobby-actions");
    actions.append(leave, this.attack);
    const box = panel("Team up", "lobby-panel");
    box.body.append(this.title, this.seats, this.status, actions);
    this.root.append(box.root);
    this.root.style.display = "none";
    parent.append(this.root, this.banner);
  }

  /** Says who's heading out, or takes the banner away with null. */
  invite(message: string | null): void {
    if (message && this.banner.style.display === "none") sfx.coin();
    this.banner.style.display = message ? "flex" : "none";
    if (message) this.bannerText.textContent = message;
  }

  show(island: string, seats: readonly Seat[], host: boolean, blocker: string | null): void {
    this.root.style.display = "flex";
    this.title.textContent = island;
    this.seats.replaceChildren(
      ...seats.map((seat) => {
        const row = el("div", "lobby-seat");
        row.append(
          el("span", "lobby-seat-name", seat.name),
          el("span", "lobby-seat-hero", `${HEROES[seat.hero].name} · level ${seat.level}`),
        );
        return row;
      }),
    );
    this.status.textContent =
      blocker ?? (host ? "Attack when your crew is ready." : "Waiting for the host to attack.");
    this.attack.style.display = host ? "" : "none";
    this.attack.disabled = blocker !== null;
  }

  hide(): void {
    this.root.style.display = "none";
  }
}
