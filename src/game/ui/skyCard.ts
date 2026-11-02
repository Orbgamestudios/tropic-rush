// The one time the game asks for the phone's location: a small card, so the system's own question
// arrives with a reason, and the player can say no and still get a sky from their time zone.

import { button, el } from "./kit/dom";

export class SkyCard {
  private readonly root = el("div", "sky-card");

  constructor(parent: HTMLElement, onAnswer: (share: boolean) => void) {
    const text = el("div", "sky-card-text");
    text.append(
      el("span", "sky-card-title", "Match your real sunrise and sunset?"),
      el("span", "sky-card-note", "Your location stays on this phone."),
    );
    const answer = (share: boolean) => {
      this.root.style.display = "none";
      onAnswer(share);
    };
    this.root.append(
      text,
      button({
        label: "Not now",
        variant: "steel",
        size: "sm",
        onClick: () => answer(false),
      }),
      button({
        label: "Use my location",
        icon: "map",
        variant: "green",
        size: "sm",
        onClick: () => answer(true),
      }),
    );
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(): void {
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}
