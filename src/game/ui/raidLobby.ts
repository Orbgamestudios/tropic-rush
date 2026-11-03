// Teaming up: a banner when a crewmate is heading out to raid, and the lobby where everyone going
// gets together. Nobody charges in: each player scouts the island and readies up, and the raid
// starts once the whole team has. The only allies on a raid are the people in this list.

import type { Seat } from "../logic/coop";
import { HEROES, type HeroKind } from "../logic/heroes";
import { button, closeSoftly, el, openSoftly, panel } from "./kit/dom";
import { sfx } from "./kit/fx";
import { icon } from "./kit/icons";

export interface RaidLobbyHandlers {
  onJoin(): void;
  onDismiss(): void;
  onScout(): void;
  onLeave(): void;
  /** A crewmate waiting in the lobby picks a different hero. */
  onHero(hero: HeroKind): void;
}

export interface LobbyStatus {
  /** Null while the host is still choosing. */
  island: string | null;
  seats: readonly Seat[];
  /** Who's scouted the island and readied up. */
  ready: readonly string[];
  /** How many could come: everyone here, and the rest of the crew who are online. */
  team: number;
  message: string;
  /** The ones a waiting crewmate can switch to, with `mine` the one they've got. */
  heroes: readonly HeroKind[];
  mine: HeroKind | null;
}

export class RaidLobby {
  private readonly banner = el("div", "lobby-banner");
  private readonly bannerText = el("div", "lobby-banner-text");
  private readonly joinButton: HTMLButtonElement;
  private readonly root = el("div", "screen screen-lobby");
  private readonly title = el("div", "lobby-title");
  private readonly count = el("span", "lobby-count-text");
  private readonly seats = el("div", "lobby-seats");
  private readonly heroes = el("div", "lobby-heroes");
  private readonly status = el("div", "lobby-status");
  private readonly partyNote = el("div", "lobby-party");
  private readonly scout: HTMLButtonElement;

  constructor(
    parent: HTMLElement,
    private readonly handlers: RaidLobbyHandlers,
  ) {
    this.joinButton = button({
      label: "Join",
      icon: "sword2",
      variant: "green",
      size: "sm",
      onClick: () => handlers.onJoin(),
    });
    this.banner.append(
      this.bannerText,
      this.joinButton,
      button({
        icon: "close",
        aria: "Not now",
        variant: "steel",
        size: "sm",
        onClick: () => handlers.onDismiss(),
      }),
    );
    this.banner.style.display = "none";
    this.scout = button({
      label: "Scout",
      icon: "crosshair",
      variant: "green",
      size: "md",
      onClick: () => handlers.onScout(),
    });
    const leave = button({
      label: "Leave",
      icon: "close",
      variant: "steel",
      size: "md",
      onClick: () => handlers.onLeave(),
    });
    const actions = el("div", "lobby-actions");
    actions.append(leave, this.scout);
    const head = el("div", "lobby-head");
    const count = el("div", "lobby-count");
    count.append(icon("crew", "lobby-count-icon"), this.count);
    head.append(this.title, count);
    const box = panel("Team up", "lobby-panel");
    box.body.append(head, this.seats, this.heroes, this.status, actions);
    this.root.append(box.root);
    this.root.style.display = "none";
    this.partyNote.style.display = "none";
    parent.append(this.root, this.banner, this.partyNote);
  }

  /** Who's waiting on the player, while they pick a hero and an island. */
  party(names: string | null): void {
    this.partyNote.style.display = names ? "block" : "none";
    if (names) this.partyNote.textContent = `With you: ${names}`;
  }

  /** Says who's heading out, or takes the banner away with null. */
  invite(message: string | null): void {
    if (message && this.banner.style.display === "none") sfx.coin();
    if (message) openSoftly(this.banner);
    else closeSoftly(this.banner);
    if (message) this.bannerText.textContent = message;
  }

  show(lobby: LobbyStatus): void {
    const { island, seats, ready, team, message, heroes, mine } = lobby;
    openSoftly(this.root);
    this.title.textContent = island ?? "Choosing an island";
    this.count.textContent = `${seats.length}/${team}`;
    this.seats.replaceChildren(
      ...seats.map((seat) => {
        const row = el("div", "lobby-seat");
        const words = el("div", "lobby-seat-words");
        words.append(
          el("span", "lobby-seat-name", seat.name),
          el(
            "span",
            "lobby-seat-hero",
            `${HEROES[seat.hero].name} · ${seat.upgrades.length} upgrades`,
          ),
        );
        const going = ready.includes(seat.member);
        const state = el("span", `lobby-seat-state${going ? " ready" : ""}`);
        if (going) state.append(icon("check", "lobby-seat-tick"));
        state.append(el("span", "", going ? "Ready" : "Not ready"));
        row.append(words, state);
        return row;
      }),
    );
    this.heroes.replaceChildren(
      ...heroes.map((kind) => {
        const pick = el(
          "button",
          `lobby-hero${kind === mine ? " selected" : ""}`,
          HEROES[kind].name,
        );
        pick.addEventListener("click", () => {
          sfx.tick();
          this.handlers.onHero(kind);
        });
        return pick;
      }),
    );
    this.heroes.style.display = heroes.length > 1 ? "" : "none";
    this.status.textContent = message;
    this.scout.disabled = island === null;
  }

  hide(): void {
    closeSoftly(this.root);
  }
}
