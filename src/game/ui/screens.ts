// The title screen, shown over the slowly orbiting island.

import { key } from "./keys";

export interface ScreenHandlers {
  onCrew(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

export class Screens {
  private readonly title = el("div", "screen screen-title");

  constructor(parent: HTMLElement, handlers: ScreenHandlers) {
    const logo = el("h1", "logo", "TROPIC RUSH");
    const tagline = el("p", "tagline", "Draft build: placeholder art");
    const crew = key("Crew island", "🏝️", { variant: "gold", className: "key-big" });
    crew.addEventListener("click", () => handlers.onCrew());
    const titleButtons = el("div", "results-buttons");
    titleButtons.append(crew);
    this.title.append(logo, tagline, titleButtons);
    parent.append(this.title);
  }

  showTitle(): void {
    this.title.style.display = "flex";
  }

  hideAll(): void {
    this.title.style.display = "none";
  }
}
