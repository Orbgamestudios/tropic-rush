// The world map's overlay: drag to look around and pinch to zoom, a plate on every island with its
// difficulty, a line saying what it'll take to lift the next bank of cloud, a card when an
// island is tapped (what's there, what it pays, Scout, Team up and Attack), and one way out:
// Return to island.

import type { Crystals } from "../logic/crystals";
import {
  archetypeLabel,
  archetypeTip,
  islandRadius,
  islandsToNextCloud,
  type MapIsland,
  type WorldProgress,
} from "../logic/worldMap";
import { button, CLOSE_MS, CrystalWallet, el, layerPlacer } from "./kit/dom";
import { sfx } from "./kit/fx";
import { icon } from "./kit/icons";

/** A crewmate out raiding or about to, shown on the map. */
export interface CrewRaid {
  id: string;
  name: string;
  /** The island they're at, once they've picked one. */
  islandId: string | null;
  islandName: string | null;
  /** They're getting ready, so there's still time to join them. */
  joinable: boolean;
}

export interface WorldMapHandlers {
  onAttack(island: MapIsland): void;
  onScout(island: MapIsland): void;
  onTeamUp(island: MapIsland): void;
  onReturn(): void;
  /** Joins a crewmate who's getting ready to raid. */
  onJoinCrew(id: string): void;
  /** Brings the view back over the crew's own island. */
  onHome(): void;
  onPan(dx: number, dy: number): void;
  onZoom(factor: number): void;
  /** Where a map spot is on screen, as fractions of its width and height. */
  screen(x: number, y: number): { x: number; y: number };
  /** How often the view has moved, to skip moving plates that haven't. */
  moves(): number;
  /** Why this hero can't go alone, if they can't. */
  soloBlocker(): string | null;
  /** How many crewmates could team up right now. */
  crewOnline(): number;
  /** Blueprints still to find on this base, by name. */
  blueprintsOn(island: MapIsland): string[];
}

interface Pin {
  x: number;
  y: number;
  node: HTMLElement;
}

/** Plates more than this far off screen (a share of it) stop being drawn. */
const OFF_SCREEN = 0.2;
const DRAG_DISTANCE = 8;

/** How big the crew's own island is drawn. */
const HOME_SIZE = 1;

export class WorldMapScreen {
  readonly root = el("div", "map-screen");
  private readonly pinLayer = el("div", "map-pins");
  private readonly homePin = el("div", "map-pin map-home-pin");
  private readonly card = el("div", "map-card");
  private cardShutting: ReturnType<typeof setTimeout> | null = null;
  private readonly cardName = el("div", "map-card-name");
  private readonly cardKind = el("div", "map-card-kind");
  private readonly cardRating = el("div", "map-card-rating");
  private readonly cardFacts = el("div", "map-card-facts");
  private readonly cardTip = el("div", "map-card-tip");
  private readonly cardNote = el("div", "map-card-note");
  private readonly wallet = new CrystalWallet();
  private readonly crewList = el("div", "map-crew-raids");
  private crewKey = "";
  private readonly attack: HTMLButtonElement;
  private readonly teamUp: HTMLButtonElement;
  private readonly banner = el("div", "map-banner");
  private readonly progress = el("div", "map-progress");
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;
  private pins: (Pin & { island: MapIsland })[] = [];
  private selected: MapIsland | null = null;
  private drawnMoves = -1;
  private readonly fingers = new Map<number, { x: number; y: number }>();
  private dragged = false;
  private pressAt: { x: number; y: number } | null = null;
  private pinch = 0;

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
    this.teamUp = button({
      label: "Team up",
      icon: "crew",
      variant: "blue",
      size: "md",
      onClick: () => {
        if (this.selected) handlers.onTeamUp(this.selected);
      },
    });
    const actions = el("div", "map-card-actions");
    actions.append(scout, this.teamUp, this.attack);
    this.card.append(
      this.cardName,
      this.cardKind,
      this.cardRating,
      this.cardFacts,
      this.cardTip,
      this.cardNote,
      actions,
    );
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
    back.addEventListener("pointerdown", (e) => e.stopPropagation());
    const home = button({
      icon: "anchorGold",
      aria: "Back over home",
      round: true,
      variant: "steel",
      size: "sm",
      className: "map-home",
      onClick: () => handlers.onHome(),
    });
    for (const node of [home, this.progress, this.crewList, this.wallet.root]) {
      node.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
    this.wallet.root.classList.add("map-wallet");
    this.root.append(
      this.pinLayer,
      this.banner,
      this.card,
      back,
      home,
      this.progress,
      this.wallet.root,
      this.crewList,
    );
    this.root.addEventListener("pointerdown", (e) => this.onDown(e));
    this.root.addEventListener("pointermove", (e) => this.onMove(e));
    this.root.addEventListener("pointerup", (e) => this.onUp(e));
    this.root.addEventListener("pointercancel", (e) => this.onUp(e));
    this.root.addEventListener("wheel", (e) => {
      e.preventDefault();
      handlers.onZoom(e.deltaY > 0 ? 1.1 : 0.9);
    });
    this.homePin.append(el("span", "map-pin-title", "Home"));
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(islands: readonly MapIsland[], world: WorldProgress, crystals: Crystals): void {
    this.root.style.display = "block";
    this.select(null);
    this.wallet.set(crystals);
    const pins = islands.map((island) => {
      const rating = island.difficulty.toLowerCase();
      const pin = el("button", `map-pin map-${island.taken ? "yours" : rating}`);
      pin.setAttribute("aria-label", island.name);
      pin.classList.toggle("done", island.taken);
      pin.classList.toggle("retaken", island.retaken);
      pin.classList.toggle("rival", island.rival !== null);
      const title = island.taken ? "Yours" : island.retaken ? "Retaken!" : "Raid";
      pin.append(
        el("span", "map-pin-title", title),
        el(
          "span",
          "map-pin-rating",
          island.taken
            ? island.tribute
              ? `+${island.tribute} gold a day`
              : island.name
            : `HQ ${island.hq} · ${island.difficulty}`,
        ),
      );
      pin.disabled = island.taken;
      pin.addEventListener("click", () => {
        if (this.dragged) return;
        sfx.tick();
        this.select(island);
      });
      return {
        island,
        node: pin,
        x: island.x,
        y: island.y - islandRadius(island.size) * 0.7,
      };
    });
    this.pins = pins;
    this.pinLayer.replaceChildren(this.homePin, ...pins.map((p) => p.node));
    const left = islandsToNextCloud(world);
    this.progress.textContent = `Take ${left} more ${left === 1 ? "island" : "islands"} to lift a cloud`;
    this.drawnMoves = -1;
  }

  hide(): void {
    this.root.style.display = "none";
  }

  /** A message across the top of the map for a few seconds. */
  announce(message: string): void {
    this.banner.textContent = message;
    this.banner.classList.add("on");
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.classList.remove("on"), 4500);
  }

  private select(island: MapIsland | null): void {
    this.selected = island;
    if (this.cardShutting) clearTimeout(this.cardShutting);
    this.cardShutting = null;
    if (island) {
      this.card.classList.remove("ui-closing");
      this.card.classList.add("open");
    } else if (this.card.classList.contains("open")) {
      this.card.classList.add("ui-closing");
      this.cardShutting = setTimeout(() => {
        this.card.classList.remove("open", "ui-closing");
      }, CLOSE_MS);
    }
    for (const { island: i, node } of this.pins) node.classList.toggle("selected", i === island);
    if (!island) return;
    // Opposite the island, so the card never covers the place it's about.
    this.card.classList.toggle("left", this.handlers.screen(island.x, island.y).x > 0.5);
    this.cardName.textContent = island.rival?.name ?? island.name;
    this.cardKind.textContent = island.rival
      ? `${island.name} · ${archetypeLabel(island)}`
      : archetypeLabel(island);
    this.cardRating.className = `map-card-rating map-${island.difficulty.toLowerCase()}`;
    this.cardRating.textContent = `${island.difficulty} · Headquarters ${island.hq}`;
    const loot = el("span", "map-fact");
    loot.append(icon("coin", "map-fact-icon"), el("span", "", String(island.reward.gold)));
    const guns = el("span", "map-fact");
    guns.append(icon("shield", "map-fact-icon"), el("span", "", `${island.defenses} defenses`));
    this.cardFacts.replaceChildren(guns, loot);
    this.cardTip.textContent = archetypeTip(island);
    const blocker = this.handlers.soloBlocker();
    const crew = this.handlers.crewOnline();
    const prints = this.handlers.blueprintsOn(island);
    this.cardNote.textContent = island.retaken
      ? "Raiders rebuilt it: every building, all at full level."
      : island.tribute
        ? `Hold it for ${island.tribute} gold a day.`
        : prints.length > 0
          ? `Blueprints to find here: ${prints.join(", ")}.`
          : "";
    if (blocker) this.cardNote.textContent = blocker;
    this.cardNote.style.display = this.cardNote.textContent ? "block" : "none";
    this.attack.disabled = blocker !== null;
    this.teamUp.style.display = crew > 0 ? "" : "none";
  }

  private onDown(e: PointerEvent): void {
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.fingers.size === 1) {
      this.dragged = false;
      this.pressAt = { x: e.clientX, y: e.clientY };
    } else {
      this.pinch = this.spread();
    }
  }

  private spread(): number {
    const [a, b] = [...this.fingers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private onMove(e: PointerEvent): void {
    const last = this.fingers.get(e.pointerId);
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.fingers.size >= 2) {
      const next = this.spread();
      if (this.pinch > 0 && next > 0) this.handlers.onZoom(this.pinch / next);
      this.pinch = next;
      this.dragged = true;
      this.handlers.onPan(dx / 2, dy / 2);
      return;
    }
    const start = this.pressAt;
    if (!this.dragged && start) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_DISTANCE) return;
      this.dragged = true;
      this.select(null);
    }
    this.handlers.onPan(dx, dy);
  }

  private onUp(e: PointerEvent): void {
    this.fingers.delete(e.pointerId);
    // A press that began on the card or a button isn't a tap on the sea.
    if (this.fingers.size > 0 || !this.pressAt) return;
    // A tap on open water closes the card; a tap on a plate opens one.
    const tapped = !this.dragged && !(e.target as HTMLElement).closest?.(".map-pin");
    if (tapped && e.type === "pointerup") this.select(null);
    this.pressAt = null;
  }

  /** Keeps the plates on their islands; call every frame. */
  update(): void {
    const moves = this.handlers.moves();
    if (moves === this.drawnMoves) return;
    this.drawnMoves = moves;
    const place = layerPlacer(this.root);
    const home = { x: 0, y: -islandRadius(HOME_SIZE) * 0.7, node: this.homePin };
    for (const { x, y, node } of [home, ...this.pins]) {
      const p = this.handlers.screen(x, y);
      const off =
        p.x < -OFF_SCREEN || p.x > 1 + OFF_SCREEN || p.y < -OFF_SCREEN || p.y > 1 + OFF_SCREEN;
      node.style.display = off ? "none" : "";
      if (off) continue;
      const spot = place(p.x, p.y);
      node.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  /** Crewmates out raiding or about to: a row each, and a flag over any island they've picked. */
  setCrewRaids(raids: readonly CrewRaid[]): void {
    const key = JSON.stringify(raids);
    if (key === this.crewKey) return;
    this.crewKey = key;
    this.crewList.replaceChildren(
      ...raids.map((raid) => {
        const row = el("div", "map-crew-raid");
        const where = raid.islandName ? `at ${raid.islandName}` : "getting ready";
        row.append(
          icon("crew", "map-crew-icon"),
          el(
            "span",
            "map-crew-text",
            raid.joinable ? `${raid.name} is ${where}` : `${raid.name} is raiding ${where}`,
          ),
        );
        if (raid.joinable) {
          row.append(
            button({
              label: "Join",
              icon: "sword2",
              variant: "green",
              size: "sm",
              onClick: () => this.handlers.onJoinCrew(raid.id),
            }),
          );
        }
        return row;
      }),
    );
    for (const { island, node } of this.pins) {
      const raid = raids.find((r) => r.islandId === island.id);
      node.classList.toggle("crew-here", raid !== undefined);
      node.querySelector(".map-pin-crew")?.remove();
      if (raid) node.append(el("span", "map-pin-crew", raid.name));
    }
  }
}
