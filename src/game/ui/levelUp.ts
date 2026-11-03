// The reveal for a hero's capstone: a burst of rays behind their portrait and the new ability it
// brings. Tap to carry on.

import type { TreeUpgrade } from "../logic/heroTrees";
import { button, closeSoftly, el, openSoftly } from "./kit/dom";
import { icon } from "./kit/icons";

export class LevelUpReveal {
  readonly root = el("div", "levelup");
  private readonly portrait = el("img", "levelup-portrait");
  private readonly title = el("div", "levelup-title");
  private readonly name = el("div", "levelup-name");
  private readonly perk = el("div", "levelup-perk");

  constructor(parent: HTMLElement) {
    this.portrait.alt = "";
    const frame = el("div", "levelup-frame");
    frame.append(this.portrait);
    this.root.append(
      el("div", "levelup-rays"),
      this.title,
      frame,
      this.name,
      this.perk,
      button({
        label: "Carry on",
        variant: "blue",
        size: "md",
        onClick: () => this.hide(),
      }),
    );
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(name: string, portrait: Promise<string>, upgrade: TreeUpgrade): void {
    void portrait.then((url) => {
      this.portrait.src = url;
    });
    this.title.textContent = "New ability!";
    this.name.textContent = name;
    const card = el("div", "levelup-card signature");
    card.append(
      icon("star", "levelup-card-icon"),
      el("div", "levelup-card-tag", "Capstone"),
      el("div", "levelup-card-name", upgrade.name),
      el("div", "levelup-card-text", upgrade.text),
    );
    this.perk.replaceChildren(card);
    openSoftly(this.root);
  }

  hide(): void {
    closeSoftly(this.root);
  }
}
