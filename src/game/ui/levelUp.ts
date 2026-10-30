// The level-up reveal: a burst of rays behind the hero's portrait, the new level, and on the
// milestone levels the perk they've just earned. Tap to carry on.

import { isSignature, type Perk } from "../logic/heroProgress";
import { button, el } from "./kit/dom";
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

  show(name: string, level: number, portrait: Promise<string>, perk: Perk | undefined): void {
    void portrait.then((url) => {
      this.portrait.src = url;
    });
    this.title.textContent = `Level ${level}!`;
    this.name.textContent = name;
    this.perk.replaceChildren();
    if (perk) {
      const signature = isSignature(perk);
      const card = el("div", `levelup-card${signature ? " signature" : ""}`);
      card.append(
        icon("star", "levelup-card-icon"),
        el("div", "levelup-card-tag", signature ? "Signature move" : "New perk"),
        el("div", "levelup-card-name", perk.name),
        el("div", "levelup-card-text", perk.text),
      );
      this.perk.append(card);
    } else {
      this.perk.append(el("div", "levelup-plain", "8% more health and damage"));
    }
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}
