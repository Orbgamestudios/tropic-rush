// Choosing who goes, aboard the boat (docs/DESIGN.md, Added 2026-11-16): an arrow either side to
// swing round to the next hero, their name, and Ready. With a crew, who's ready so far. Nothing
// else: the boat and the sea are the screen.

import { HEROES, type HeroKind } from "../logic/heroes";
import { HERO_NAMES } from "../logic/heroProgress";
import { button, el } from "./kit/dom";
import { sfx } from "./kit/fx";

export interface BoatSelectHost {
  /** The next hero round the boat, or the one before; returns who's chosen now. */
  step(by: number): HeroKind | null;
  ready(hero: HeroKind): void;
  /** What a hero's called aboard, where it isn't their usual name. */
  nameOf(hero: HeroKind): string | null;
}

export class BoatSelect {
  readonly root = el("div", "screen screen-boat");
  private readonly name = el("div", "boat-name");
  private readonly role = el("div", "boat-role");
  private readonly crew = el("div", "boat-crew");
  private readonly readyButton: HTMLButtonElement;
  private hero: HeroKind | null = null;

  constructor(
    parent: HTMLElement,
    private readonly host: BoatSelectHost,
  ) {
    const left = button({
      icon: "back",
      round: true,
      variant: "steel",
      aria: "Previous hero",
      className: "boat-arrow boat-left",
    });
    const right = button({
      icon: "back",
      round: true,
      variant: "steel",
      aria: "Next hero",
      className: "boat-arrow boat-right",
    });
    left.addEventListener("click", () => this.move(-1));
    right.addEventListener("click", () => this.move(1));
    this.readyButton = button({
      label: "Ready",
      variant: "green",
      size: "lg",
      className: "boat-ready",
      onClick: () => {
        if (!this.hero) return;
        this.readyButton.disabled = true;
        this.host.ready(this.hero);
      },
    });
    const card = el("div", "boat-card");
    card.append(this.name, this.role);
    this.root.append(left, right, card, this.crew, this.readyButton);
    this.root.style.display = "none";
    parent.append(this.root);
  }

  private move(by: number): void {
    sfx.whoosh();
    this.set(this.host.step(by));
  }

  set(hero: HeroKind | null): void {
    this.hero = hero;
    this.name.textContent = hero ? (this.host.nameOf(hero) ?? HERO_NAMES[hero]) : "";
    this.role.textContent = hero ? HEROES[hero].role : "";
  }

  /** Who of the crew is ready, by name, with a crew; empty alone. */
  setCrew(names: readonly { name: string; ready: boolean }[]): void {
    this.crew.replaceChildren(
      ...names.map((n) => el("span", n.ready ? "boat-mate ready" : "boat-mate", n.name)),
    );
  }

  show(hero: HeroKind | null): void {
    this.readyButton.disabled = false;
    this.set(hero);
    this.root.style.display = "block";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}
