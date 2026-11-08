// The end-of-raid screen: a VICTORY or DEFEAT banner on sun rays, three stars that stamp in one
// by one, the raid's numbers, and the loot counting up into the wallet.

import { CRYSTAL_KINDS } from "../logic/crystals";
import { costText, type Purse, RESOURCES } from "../logic/economy";
import type { RaidReward } from "../logic/heroProgress";
import { blueprintName, isWeapon, type Spoils } from "../logic/spoils";
import { showBuildingIcon } from "../render/thumbnails";
import { ABILITY_ICONS } from "./hud";
import { button, costChips, crystalChip, el, formatNumber, plate } from "./kit/dom";
import { sfx, sparkleAt } from "./kit/fx";
import { type IconName, icon } from "./kit/icons";

export interface RaidResult {
  won: boolean;
  reason: "crew" | "time" | "retreat" | null;
  destroyedPercent: number;
  destroyedCount: number;
  totalCount: number;
  seconds: number;
  reward: RaidReward;
  /** Materials carried off from mills and storages, for the crew's stock. */
  materials: Purse;
  /** What a win turned up besides. */
  spoils: Spoils | null;
  /** What a conquered player island will pay each day, if this was one. */
  tribute: number;
}

export interface ResultsHandlers {
  onAgain(): void;
  onHeroes(): void;
  onHome(): void;
}

export class ResultsScreen {
  readonly root = el("div", "screen screen-results");
  private readonly fx = el("div", "fx-layer");
  private readonly banner = el("div", "results-banner");
  private readonly reason = el("div", "results-reason");
  private readonly stars = el("div", "results-stars");
  private readonly stats = el("div", "results-stats");
  private readonly loot = el("div", "results-loot");
  private readonly found = el("div", "results-found");
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(parent: HTMLElement, handlers: ResultsHandlers) {
    const card = el("div", "results-card");
    const actions = el("div", "results-actions");
    actions.append(
      button({
        label: "Home",
        icon: "island",
        variant: "steel",
        size: "md",
        onClick: () => handlers.onHome(),
      }),
      button({
        label: "Heroes",
        icon: "crew",
        variant: "steel",
        size: "md",
        onClick: () => handlers.onHeroes(),
      }),
      button({
        label: "Raid again",
        icon: "sword2",
        variant: "blue",
        size: "lg",
        onClick: () => handlers.onAgain(),
      }),
    );
    card.append(
      this.stars,
      this.reason,
      this.stats,
      plate("Loot", "results-loot-plate"),
      this.loot,
      this.found,
      actions,
    );
    this.root.append(el("div", "results-rays"), this.banner, card, this.fx);
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(result: RaidResult): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.root.style.display = "flex";
    this.root.classList.toggle("won", result.won);
    this.root.classList.toggle("lost", !result.won);
    this.banner.replaceChildren(
      el("span", "results-banner-text", result.won ? "Victory!" : "Defeat"),
    );
    this.reason.textContent = result.won
      ? "The headquarters has fallen. The island is yours!"
      : result.reason === "time"
        ? "Time ran out before the headquarters fell."
        : result.reason === "retreat"
          ? "You sounded the retreat."
          : "Your crew fell. No respawns on a raid.";

    this.stars.replaceChildren();
    const starNodes: HTMLElement[] = [];
    for (let i = 0; i < 3; i++) {
      const s = el("span", `results-star results-star-${i}`);
      s.append(icon("star"));
      this.stars.append(s);
      starNodes.push(s);
    }
    starNodes.forEach((s, i) => {
      if (i >= result.reward.stars) return;
      this.timers.push(
        setTimeout(
          () => {
            s.classList.add("earned");
            sfx.coin();
            sparkleAt(this.fx, s, { count: 14, spread: 70 });
          },
          500 + i * 420,
        ),
      );
    });

    const seconds = Math.round(result.seconds);
    const stat = (iconName: IconName, value: string, label: string) => {
      const row = el("div", "results-stat");
      row.append(
        icon(iconName, "results-stat-icon"),
        el("span", "results-stat-value", value),
        el("span", "results-stat-label", label),
      );
      return row;
    };
    this.stats.replaceChildren(
      stat("skull", `${result.destroyedPercent}%`, "destroyed"),
      stat("hammer", `${result.destroyedCount}/${result.totalCount}`, "buildings"),
      stat(
        "clock",
        `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
        "raid time",
      ),
    );

    this.loot.replaceChildren();
    const lootItem = (iconName: IconName, amount: number, label: string) => {
      const item = el("div", "results-loot-item");
      const value = el("span", "results-loot-value", "+0");
      item.append(icon(iconName, "results-loot-icon"), value);
      item.setAttribute("aria-label", `${label} +${amount}`);
      this.loot.append(item);
      const start = performance.now() + 1500;
      const tick = (now: number) => {
        const t = Math.max(0, Math.min(1, (now - start) / 900));
        value.textContent = `+${formatNumber(Math.round(amount * (1 - (1 - t) ** 3)))}`;
        if (t < 1 && this.root.style.display !== "none") requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    lootItem("coin", result.reward.gold, "Gold");
    if (RESOURCES.some((r) => result.materials[r] > 0))
      this.loot.append(costChips(costText(result.materials)));
    this.showFound(result);
    if (!result.won) this.timers.push(setTimeout(() => sfx.defeat(), 150));
  }

  /** The crystals, blueprint and treasure a win turned up, popping in after the gold. */
  private showFound(result: RaidResult): void {
    this.found.replaceChildren();
    const { spoils, tribute } = result;
    const items: HTMLElement[] = [];
    for (const k of CRYSTAL_KINDS) {
      const amount = spoils?.crystals[k];
      if (amount) items.push(crystalChip(k, amount, "results-crystal"));
    }
    if (spoils?.blueprint) {
      const print = el("div", "results-blueprint");
      const { blueprint } = spoils;
      let picture: Element;
      if (isWeapon(blueprint)) picture = icon(ABILITY_ICONS[blueprint], "results-blueprint-img");
      else {
        const image = el("img", "results-blueprint-img");
        showBuildingIcon(image, blueprint);
        image.alt = "";
        picture = image;
      }
      print.append(
        picture,
        el("span", "results-blueprint-tag", "New blueprint"),
        el("span", "results-blueprint-name", blueprintName(blueprint)),
      );
      items.push(print);
    }
    if (spoils?.chest) {
      const chest = el("div", "results-chest");
      chest.append(icon("coin"), el("span", "", `Treasure chest! +${formatNumber(spoils.chest)}`));
      items.push(chest);
    }
    if (tribute > 0) {
      items.push(el("div", "results-tribute", `Pays you ${tribute} gold every day you hold it`));
    }
    items.forEach((item, i) => {
      item.classList.add("results-pop");
      this.timers.push(
        setTimeout(
          () => {
            this.found.append(item);
            sfx.coin();
            sparkleAt(this.fx, item, { count: 18, spread: 80 });
          },
          2200 + i * 420,
        ),
      );
    });
  }

  hide(): void {
    this.root.style.display = "none";
  }
}
