// The pause menu during a raid: resume, toggle sound, or retreat.

import { button, el, panel, setLabel } from "./kit/dom";
import { sfx } from "./kit/fx";

export interface PauseHandlers {
  onResume(): void;
  onRetreat(): void;
}

export class PauseMenu {
  readonly root = el("div", "screen screen-pause");
  private muted = false;

  constructor(parent: HTMLElement, handlers: PauseHandlers) {
    const box = panel("Paused", "pause-panel");
    const sound = button({ label: "Sound on", icon: "gear", variant: "steel", size: "md" });
    sound.addEventListener("click", () => {
      this.muted = !this.muted;
      sfx.setMuted(this.muted);
      setLabel(sound, this.muted ? "Sound off" : "Sound on");
    });
    box.body.append(
      button({
        label: "Resume",
        icon: "play",
        variant: "blue",
        size: "lg",
        onClick: () => handlers.onResume(),
      }),
      sound,
      button({
        label: "Retreat",
        icon: "close",
        variant: "red",
        size: "md",
        onClick: () => handlers.onRetreat(),
      }),
    );
    this.root.append(box.root);
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(on: boolean): void {
    this.root.style.display = on ? "flex" : "none";
  }
}
