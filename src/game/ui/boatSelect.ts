// Choosing who goes, aboard the boat (docs/DESIGN.md, Added 2026-11-16), and then at the console in
// her cabin, which time crystals they take. The boat and the sea are the screen: everything here
// sits at its edges.
//
// Choosing: an arrow either side to swing round to the next hero, their name, and Ready. With a
// crew, who's ready so far.
// At the console: its three holders and the crystals owned to fill them from (a tap puts one in, a
// tap on a holder takes it out), and Set off.

import { HEROES, type HeroKind } from "../logic/heroes";
import { HERO_NAMES } from "../logic/heroProgress";
import {
  addToLoadout,
  fitLoadout,
  LOADOUT_POWERS,
  LOADOUT_SLOTS,
  removeFromLoadout,
  type Shards,
  TIME_POWER_SPECS,
  type TimePower,
} from "../logic/timeShards";
import { button, el } from "./kit/dom";
import { sfx } from "./kit/fx";
import { timeGem } from "./kit/timeIcons";

export interface BoatSelectHost {
  /** The next hero round the boat, or the one before; returns who's chosen now. */
  step(by: number): HeroKind | null;
  ready(hero: HeroKind): void;
  /** What a hero's called aboard, where it isn't their usual name. */
  nameOf(hero: HeroKind): string | null;
  /** The crystals owned, and the ones chosen to take. */
  crystals(): { owned: Shards; loadout: readonly TimePower[] | null };
  setLoadout(loadout: TimePower[]): void;
  setOff(): void;
  /** Skips to the end of the walk to the console, or of the run in and the landing. */
  skip(): void;
}

export class BoatSelect {
  readonly root = el("div", "screen screen-boat");
  private readonly name = el("div", "boat-name");
  private readonly role = el("div", "boat-role");
  private readonly crew = el("div", "boat-crew");
  private readonly choosing = el("div", "boat-choosing");
  private readonly console = el("div", "boat-console");
  private readonly slots = el("div", "loadout-slots");
  private readonly owned = el("div", "loadout-owned");
  private readonly readyButton: HTMLButtonElement;
  private readonly setOffButton: HTMLButtonElement;
  /** Shown over the walk to the console, and the run in and the landing. */
  readonly skipButton: HTMLButtonElement;
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
    this.choosing.append(left, right, card, this.crew, this.readyButton);

    this.setOffButton = button({
      label: "Set off",
      variant: "green",
      size: "lg",
      className: "boat-setoff",
      onClick: () => {
        this.setOffButton.disabled = true;
        sfx.whoosh();
        this.host.setOff();
      },
    });
    const panel = el("div", "boat-console-panel");
    panel.append(
      el("div", "loadout-title", "Time crystals"),
      el("div", "loadout-hint", "Set three in the holders: any mix of the ones you own"),
      this.slots,
      this.owned,
    );
    this.console.append(panel, this.setOffButton);

    this.skipButton = button({
      label: "Skip",
      variant: "steel",
      className: "boat-skip",
      onClick: () => this.host.skip(),
    });
    this.skipButton.style.display = "none";

    this.root.append(this.choosing, this.console);
    this.root.style.display = "none";
    parent.append(this.root, this.skipButton);
  }

  /** Shows Skip while there's something to skip. */
  showSkip(on: boolean): void {
    const want = on ? "block" : "none";
    if (this.skipButton.style.display !== want) this.skipButton.style.display = want;
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
    this.choosing.style.display = "block";
    this.console.style.display = "none";
    this.root.style.display = "block";
  }

  /** At the console: the holders and the crystals to fill them from. */
  showConsole(): void {
    this.setOffButton.disabled = false;
    this.choosing.style.display = "none";
    this.console.style.display = "block";
    this.root.style.display = "block";
    this.refreshCrystals();
  }

  hide(): void {
    this.root.style.display = "none";
  }

  /** The crystals going, and what's owned to choose from. */
  private refreshCrystals(): void {
    const { owned, loadout } = this.host.crystals();
    const taking = fitLoadout(owned, loadout);
    const change = (next: TimePower[]) => {
      sfx.press();
      this.host.setLoadout(next);
      this.refreshCrystals();
    };
    this.slots.replaceChildren(
      ...Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
        const power = taking[i];
        const slot = el("button", `loadout-slot${power ? " filled" : ""}`);
        if (!power) {
          slot.disabled = true;
          slot.setAttribute("aria-label", "Empty holder");
          return slot;
        }
        slot.setAttribute("aria-label", `Take out ${TIME_POWER_SPECS[power].name}`);
        slot.title = TIME_POWER_SPECS[power].text;
        slot.append(timeGem(power));
        slot.addEventListener("click", () => change(removeFromLoadout(owned, taking, i)));
        return slot;
      }),
    );
    const full = taking.length >= LOADOUT_SLOTS;
    this.owned.replaceChildren(
      ...LOADOUT_POWERS.flatMap((power) => {
        const count = owned[power] ?? 0;
        if (count <= 0) return [];
        const spare = count - taking.filter((p) => p === power).length;
        const b = el("button", "loadout-crystal");
        b.setAttribute("aria-label", `Take ${TIME_POWER_SPECS[power].name}`);
        b.title = `${TIME_POWER_SPECS[power].name}: ${TIME_POWER_SPECS[power].text}`;
        b.disabled = full || spare <= 0;
        b.append(timeGem(power), el("span", "loadout-count", String(count)));
        b.addEventListener("click", () => change(addToLoadout(owned, taking, power)));
        return [b];
      }),
    );
  }
}
