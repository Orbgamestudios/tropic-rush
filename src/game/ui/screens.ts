// Title, hero select and results screens, shown over the slowly orbiting island.

import { HERO_KINDS, HEROES, type HeroKind } from "../logic/heroes";
import { COLORS } from "../render/palette";

export interface ScreenHandlers {
  onPlay(): void;
  onStart(hero: HeroKind, level: number): void;
  onAgain(): void;
  onChangeHero(): void;
}

export interface RaidResult {
  won: boolean;
  reason: "crew" | "time" | "retreat" | null;
  destroyedPercent: number;
  destroyedCount: number;
  totalCount: number;
  seconds: number;
}

const ISLANDS = [
  { level: 1, name: "Outpost", crew: 1 },
  { level: 2, name: "Fort", crew: 2 },
  { level: 3, name: "Stronghold", crew: 3 },
] as const;

const HERO_ACCENTS: Record<HeroKind, number> = {
  rifleman: COLORS.crewBlue,
  medic: COLORS.hairBlonde,
  tank: COLORS.tankSand,
  heavy: COLORS.skinDark,
  bazooka: COLORS.hairBlack,
  grenadier: COLORS.orange,
  engineer: COLORS.teal,
};

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

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export class Screens {
  private readonly title = el("div", "screen screen-title");
  private readonly select = el("div", "screen screen-select");
  private readonly results = el("div", "screen screen-results");
  private hero: HeroKind = "rifleman";
  private level = 1;
  private readonly heroCards = new Map<HeroKind, HTMLButtonElement>();
  private readonly islandButtons = new Map<number, HTMLButtonElement>();
  private readonly resultTitle = el("h2", "results-title");
  private readonly resultReason = el("p", "results-reason");
  private readonly resultStats = el("div", "results-stats");

  constructor(parent: HTMLElement, handlers: ScreenHandlers) {
    // Title
    const logo = el("h1", "logo", "TROPIC RUSH");
    const tagline = el("p", "tagline", "Draft build: placeholder art, solo raids");
    const play = el("button", "btn btn-primary", "Play");
    play.addEventListener("click", () => handlers.onPlay());
    this.title.append(logo, tagline, play);

    // Hero select
    const heading = el("h2", "select-heading", "Choose your hero");
    const grid = el("div", "hero-grid");
    for (const kind of HERO_KINDS) {
      const spec = HEROES[kind];
      const card = el("button", "hero-card");
      card.style.setProperty("--accent", hex(HERO_ACCENTS[kind]));
      card.append(
        el("span", "hero-chip"),
        el("span", "hero-name", spec.name),
        el("span", "hero-role", spec.role),
        el("span", "hero-stats", `${spec.hp} HP · Super: ${spec.superName}`),
      );
      card.addEventListener("click", () => this.pickHero(kind));
      grid.append(card);
      this.heroCards.set(kind, card);
    }
    const islandRow = el("div", "island-row");
    for (const island of ISLANDS) {
      const button = el("button", "island-btn");
      button.append(
        el("span", "island-name", island.name),
        el("span", "island-crew", "●".repeat(island.crew)),
      );
      button.title = `HQ level ${island.level}`;
      button.addEventListener("click", () => this.pickLevel(island.level));
      islandRow.append(button);
      this.islandButtons.set(island.level, button);
    }
    const start = el("button", "btn btn-primary", "Start raid");
    start.addEventListener("click", () => handlers.onStart(this.hero, this.level));
    const footer = el("div", "select-footer");
    footer.append(islandRow, start);
    this.select.append(heading, grid, footer);

    // Results
    const again = el("button", "btn btn-primary", "Raid again");
    again.addEventListener("click", () => handlers.onAgain());
    const change = el("button", "btn", "Change hero");
    change.addEventListener("click", () => handlers.onChangeHero());
    const buttons = el("div", "results-buttons");
    buttons.append(again, change);
    this.results.append(this.resultTitle, this.resultReason, this.resultStats, buttons);

    for (const screen of [this.title, this.select, this.results]) {
      screen.addEventListener("pointerdown", (e) => e.stopPropagation());
      parent.append(screen);
    }
    this.hideAll();
  }

  private pickHero(kind: HeroKind): void {
    this.hero = kind;
    for (const [k, card] of this.heroCards) card.classList.toggle("selected", k === kind);
  }

  private pickLevel(level: number): void {
    this.level = level;
    for (const [l, button] of this.islandButtons) button.classList.toggle("selected", l === level);
  }

  hideAll(): void {
    for (const screen of [this.title, this.select, this.results]) screen.style.display = "none";
  }

  showTitle(): void {
    this.hideAll();
    this.title.style.display = "flex";
  }

  showSelect(hero: HeroKind, level: number): void {
    this.hideAll();
    this.pickHero(hero);
    this.pickLevel(level);
    this.select.style.display = "flex";
  }

  showResults(result: RaidResult): void {
    this.hideAll();
    this.resultTitle.textContent = result.won ? "Island taken!" : "Raid failed";
    this.resultReason.textContent = result.won
      ? "The enemy headquarters is down."
      : result.reason === "time"
        ? "Time ran out."
        : result.reason === "retreat"
          ? "Your crew retreated."
          : "Your crew fell. No respawns on a raid.";
    const seconds = Math.round(result.seconds);
    this.resultStats.replaceChildren(
      el("div", "stat", `${result.destroyedPercent}% destroyed`),
      el("div", "stat", `${result.destroyedCount} of ${result.totalCount} buildings`),
      el(
        "div",
        "stat",
        `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} raid time`,
      ),
    );
    this.results.classList.toggle("won", result.won);
    this.results.style.display = "flex";
  }
}
