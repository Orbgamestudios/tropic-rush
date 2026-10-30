// The title screen, over the slowly orbiting home island: the logo on a burst of sun rays, the
// player's wallet, and the two ways to play.

import { button, CurrencyPill, el } from "./kit/dom";
import { icon } from "./kit/icons";

export interface TitleHandlers {
  onRaid(): void;
  onCrew(): void;
}

export class TitleScreen {
  readonly root = el("div", "screen screen-title");
  private readonly gold = new CurrencyPill("coin", "Gold");
  private readonly medals = new CurrencyPill("medal", "Medals");

  constructor(parent: HTMLElement, handlers: TitleHandlers) {
    const rays = el("div", "title-rays");
    const logo = el("div", "title-logo");
    logo.append(el("span", "title-logo-top", "TROPIC"), el("span", "title-logo-bottom", "RUSH"));
    const ribbon = el("div", "title-ribbon", "Co-op island raids");
    const hero = el("div", "title-hero");
    hero.append(rays, logo, ribbon);

    const raid = button({
      label: "Raid",
      icon: "sword2",
      variant: "blue",
      size: "xl",
      className: "title-raid",
      onClick: () => handlers.onRaid(),
    });
    const crew = button({
      label: "Crew island",
      icon: "island",
      variant: "gold",
      size: "lg",
      className: "title-crew",
      onClick: () => handlers.onCrew(),
    });
    const actions = el("div", "title-actions");
    actions.append(raid, crew);

    const wallet = el("div", "screen-wallet");
    wallet.append(this.gold.root, this.medals.root);
    const tag = el("div", "title-tag");
    tag.append(icon("gear", "title-tag-icon"), el("span", "", "Draft build · placeholder art"));

    this.root.append(el("div", "title-vignette"), wallet, hero, actions, tag);
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(gold: number, medals: number): void {
    this.gold.set(gold, false);
    this.medals.set(medals, false);
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}
