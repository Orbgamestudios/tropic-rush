// The world map's overlay: a plate on every island with its difficulty, a card when one is
// tapped (what's there, what it pays, Scout and Attack), and one way out: Return to island.

import { islandRadius, type MapIsland } from "../logic/worldMap";
import { button, el } from "./kit/dom";
import { sfx } from "./kit/fx";
import { icon } from "./kit/icons";

export interface WorldMapHandlers {
  onAttack(island: MapIsland): void;
  onScout(island: MapIsland): void;
  onReturn(): void;
  /** Where a map spot is on screen, as fractions of its width and height. */
  screen(x: number, y: number): { x: number; y: number };
}

export class WorldMapScreen {
  readonly root = el("div", "map-screen");
  private readonly pins = el("div", "map-pins");
  private readonly card = el("div", "map-card");
  private readonly cardName = el("div", "map-card-name");
  private readonly cardRating = el("div", "map-card-rating");
  private readonly cardFacts = el("div", "map-card-facts");
  private readonly attack: HTMLButtonElement;
  private islands: { island: MapIsland; pin: HTMLElement }[] = [];
  private selected: MapIsland | null = null;

  constructor(
    parent: HTMLElement,
    private readonly handlers: WorldMapHandlers,
  ) {
    this.attack = button({
      label: "Attack",
      icon: "sword2",
      variant: "red",
      size: "md",
      onClick: () => {
        if (this.selected) handlers.onAttack(this.selected);
      },
    });
    const scout = button({
      label: "Scout",
      icon: "crosshair",
      variant: "steel",
      size: "md",
      onClick: () => {
        if (this.selected) handlers.onScout(this.selected);
      },
    });
    const actions = el("div", "map-card-actions");
    actions.append(scout, this.attack);
    this.card.append(this.cardName, this.cardRating, this.cardFacts, actions);
    this.card.addEventListener("pointerdown", (e) => e.stopPropagation());
    const back = button({
      icon: "island",
      aria: "Return to island",
      round: true,
      variant: "blue",
      size: "lg",
      className: "map-return",
      onClick: () => handlers.onReturn(),
    });
    back.append(el("span", "map-return-label", "Return to island"));
    this.root.append(this.pins, this.card, back);
    this.root.addEventListener("pointerdown", () => this.select(null));
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(islands: readonly MapIsland[], beaten: readonly number[]): void {
    this.root.style.display = "block";
    this.select(null);
    this.islands = islands.map((island) => {
      const done = beaten.includes(island.id);
      const pin = el("button", `map-pin map-${island.difficulty.toLowerCase()}`);
      pin.setAttribute("aria-label", island.name);
      pin.classList.toggle("done", done);
      pin.append(
        el("span", "map-pin-title", done ? "Beaten" : "Raid"),
        el("span", "map-pin-rating", `HQ ${island.hq} · ${island.difficulty}`),
      );
      pin.disabled = done;
      pin.addEventListener("pointerdown", (e) => e.stopPropagation());
      pin.addEventListener("click", () => {
        sfx.tick();
        this.select(island);
      });
      return { island, pin };
    });
    this.pins.replaceChildren(...this.islands.map((i) => i.pin));
  }

  hide(): void {
    this.root.style.display = "none";
  }

  private select(island: MapIsland | null): void {
    this.selected = island;
    this.card.classList.toggle("open", island !== null);
    // Opposite the island, so the card never covers the place it's about.
    this.card.classList.toggle("left", island !== null && island.x > 0);
    for (const { island: i, pin } of this.islands) pin.classList.toggle("selected", i === island);
    if (!island) return;
    this.cardName.textContent = island.name;
    this.cardRating.className = `map-card-rating map-${island.difficulty.toLowerCase()}`;
    this.cardRating.textContent = `${island.difficulty} · Headquarters ${island.hq}`;
    const loot = el("span", "map-fact");
    loot.append(
      icon("coin", "map-fact-icon"),
      el("span", "", String(island.reward.gold)),
      icon("medal", "map-fact-icon"),
      el("span", "", String(island.reward.medals)),
    );
    const guns = el("span", "map-fact");
    guns.append(icon("shield", "map-fact-icon"), el("span", "", `${island.defenses} defenses`));
    this.cardFacts.replaceChildren(guns, loot);
  }

  /** Keeps the plates on their islands; call every frame. */
  update(): void {
    // Measured in this layer's own pixels, which the UI size setting scales.
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    for (const { island, pin } of this.islands) {
      const p = this.handlers.screen(island.x, island.y - islandRadius(island.size) * 0.7);
      pin.style.transform = `translate(${(p.x * width).toFixed(1)}px, ${(p.y * height).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
}
