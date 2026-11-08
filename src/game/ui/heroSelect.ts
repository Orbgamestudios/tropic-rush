// The hero screen, reached by tapping a hero on the island: the roster on the left, the chosen
// hero turning on a pedestal in the middle, their stats and capstones on the right. Upgrades opens
// their tree, and new heroes join as the headquarters grows.
// Raid goes to the world map to pick an island, and attacking one comes back here to confirm who's
// going. Nobody brings AI allies: the only crewmates on a raid are other players, who team up from
// the map.

import { HERO_KINDS, HEROES, type HeroKind } from "../logic/heroes";
import {
  HERO_NAMES,
  HERO_UNLOCK_HQ,
  heroStats,
  statBars,
  treeProgress,
} from "../logic/heroProgress";
import { UPGRADES_PER_HERO } from "../logic/heroTrees";
import {
  addToLoadout,
  fitLoadout,
  LOADOUT_POWERS,
  LOADOUT_SLOTS,
  removeFromLoadout,
  TIME_POWER_SPECS,
} from "../logic/timeShards";
import type { Showcase } from "../render/showcase";
import { heroPortrait } from "../render/thumbnails";
import type { SaveData } from "../save";
import {
  backButton,
  button,
  CrystalWallet,
  CurrencyPill,
  el,
  formatNumber,
  levelBadge,
  panel,
  portraitTile,
  StatBar,
  setLabel,
} from "./kit/dom";
import { sfx } from "./kit/fx";
import { icon } from "./kit/icons";
import { timeGem } from "./kit/timeIcons";

export interface HeroSelectHost {
  save(): SaveData;
  /** The island's gold, shown the same everywhere. */
  gold(): number;
  update(changes: Partial<SaveData>): void;
  onBack(): void;
  /** Raid with this hero: on to the world map, or the island already picked. */
  onStart(hero: HeroKind): void;
  /** Opens this hero's upgrade tree. */
  onUpgrades(hero: HeroKind): void;
  onTrade(): void;
}

export class HeroSelect {
  readonly root = el("div", "screen screen-heroes");
  private readonly gold = new CurrencyPill("coin", "Gold");
  private readonly crystals = new CrystalWallet();
  private readonly grid = el("div", "heroes-grid");
  private readonly tiles = new Map<HeroKind, HTMLButtonElement>();
  private readonly name = el("div", "heroes-name");
  private readonly role = el("div", "heroes-role");
  private readonly cardName = el("div", "stats-name");
  private readonly cardBadges = el("div", "stats-badges");
  private readonly cardLevel = el("div", "stats-level");
  private readonly bars = {
    hp: new StatBar("heart", "HP", "orange"),
    dps: new StatBar("sword", "Attack", "green"),
    speed: new StatBar("speed", "Speed", "yellow"),
    range: new StatBar("range", "Range", "blue"),
  };
  private readonly upgrades: HTMLButtonElement;
  private readonly upgradeCount = el("span", "heroes-cost");
  private readonly start: HTMLButtonElement;
  /** The time crystals to take: three slots, filled by tapping the crystals they own below. */
  private readonly crystalSlots = el("div", "loadout-slots");
  private readonly crystalOwned = el("div", "loadout-owned");
  private readonly retryLine = el("div", "loadout-retries");
  private readonly hint = el("div", "heroes-spin-hint", "Drag to spin");
  private hero: HeroKind = "rifleman";
  /** An island's been picked, and this is the last look at who's going. */
  private attacking = false;

  constructor(
    parent: HTMLElement,
    private readonly showcase: Showcase,
    private readonly host: HeroSelectHost,
  ) {
    // Top bar.
    const top = el("div", "screen-top");
    const wallet = el("div", "screen-wallet");
    const trade = button({
      label: "Trade",
      variant: "steel",
      size: "sm",
      aria: "Trade crystals",
      onClick: () => host.onTrade(),
    });
    wallet.append(trade, this.crystals.root, this.gold.root);
    const back = backButton(() => host.onBack());

    // Roster.
    const roster = panel("Personnel", "heroes-roster");
    roster.body.append(this.grid);
    for (const kind of HERO_KINDS) {
      const tile = portraitTile(HEROES[kind].name, null);
      tile.addEventListener("click", () => this.choose(kind));
      this.grid.append(tile);
      this.tiles.set(kind, tile);
      void heroPortrait(kind).then((url) => {
        const img = tile.querySelector("img");
        if (img) img.src = url;
      });
    }

    // Stage area: drag to spin the hero; the name plate sits under the pedestal.
    const stageArea = el("div", "heroes-stage");
    let lastX: number | null = null;
    stageArea.addEventListener("pointerdown", (e) => {
      lastX = e.clientX;
      stageArea.setPointerCapture(e.pointerId);
    });
    stageArea.addEventListener("pointermove", (e) => {
      if (lastX === null) return;
      showcase.drag(e.clientX - lastX);
      lastX = e.clientX;
    });
    const stop = () => {
      lastX = null;
      showcase.release();
    };
    stageArea.addEventListener("pointerup", stop);
    stageArea.addEventListener("pointercancel", stop);
    const nameplate = el("div", "heroes-nameplate");
    const nameRow = el("div", "heroes-name-row");
    nameRow.append(
      icon("rank", "heroes-name-badge"),
      this.name,
      icon("anchorGold", "heroes-name-badge"),
    );
    nameplate.append(nameRow, this.role);
    stageArea.append(this.hint, nameplate);

    // Stats & info.
    const info = panel("Technical specs", "heroes-info");
    const card = el("div", "stats-card");
    const head = el("div", "stats-head");
    head.append(this.cardLevel, this.cardName, this.cardBadges);
    const barsBox = el("div", "stats-bars");
    barsBox.append(...Object.values(this.bars).map((b) => b.root));
    const loadout = el("div", "loadout");
    loadout.append(
      el("div", "loadout-title", "Time crystals"),
      el("div", "loadout-hint", "Take three: any mix of the ones you own"),
      this.crystalSlots,
      this.crystalOwned,
      this.retryLine,
    );
    card.append(head, barsBox, loadout);
    info.body.append(card);
    top.append(back, wallet);

    // Actions.
    this.upgrades = button({
      label: "Upgrades",
      variant: "gold",
      size: "md",
      className: "heroes-levelup",
      onClick: () => host.onUpgrades(this.hero),
    });
    this.upgrades.querySelector(".ui-btn-face")?.append(this.upgradeCount);
    this.start = button({
      label: "Raid",
      variant: "blue",
      size: "xl",
      className: "heroes-start",
      onClick: () => this.go(),
    });
    const actions = el("div", "heroes-actions");
    actions.append(this.upgrades, this.start);

    this.root.append(top, roster.root, stageArea, info.root, actions);
    this.root.style.display = "none";
    parent.append(this.root);
  }

  /** Opens on a hero: the one tapped on the island, or the last one used. */
  show(kind?: HeroKind, attacking = false): void {
    const save = this.host.save();
    this.attacking = attacking;
    this.hint.textContent = attacking ? "Who's going?" : "Drag to spin";
    this.gold.set(this.host.gold(), false);
    this.root.style.display = "grid";
    this.showcase.show(true);
    this.choose(kind ?? (save.unlocked.includes(save.hero) ? save.hero : "rifleman"), true);
  }

  hide(): void {
    this.root.style.display = "none";
    this.showcase.show(false);
  }

  private choose(kind: HeroKind, quiet = false): void {
    if (!quiet && kind !== this.hero) sfx.whoosh();
    this.hero = kind;
    void this.showcase.setHero(kind);
    this.refresh();
  }

  refresh(): void {
    const save = this.host.save();
    const kind = this.hero;
    const spec = HEROES[kind];
    const owned = save.upgrades[kind];
    const unlocked = save.unlocked.includes(kind);
    for (const [k, tile] of this.tiles) {
      tile.classList.toggle("selected", k === kind);
      const isLocked = !save.unlocked.includes(k);
      tile.classList.toggle("locked", isLocked);
      tile.querySelector(".ui-level")?.remove();
      tile.querySelector(".ui-tile-lock")?.remove();
      if (isLocked) {
        const lock = el("span", "ui-tile-lock");
        lock.append(icon("lock"), el("span", "ui-tile-lock-text", `HQ ${HERO_UNLOCK_HQ[k]}`));
        tile.append(lock);
      } else if (save.upgrades[k].length > 0) {
        tile.append(levelBadge(save.upgrades[k].length));
      }
    }
    this.name.textContent = HERO_NAMES[kind];
    this.role.textContent = `${spec.name} · ${spec.role}`;
    this.cardName.textContent = spec.name;
    this.cardBadges.replaceChildren(
      icon(spec.heavy ? "shield" : "speed", "stats-badge"),
      icon(spec.attack.kind === "heal" ? "heal" : "crosshair", "stats-badge"),
    );
    this.cardLevel.replaceChildren(levelBadge(owned.length, "stats-level-badge"));
    this.cardLevel.title = `${owned.length} of ${UPGRADES_PER_HERO} upgrades`;
    const now = heroStats(kind, owned);
    const bars = statBars(kind, owned);
    this.bars.hp.set(bars.hp, formatNumber(now.hp));
    this.bars.dps.setLabel(spec.attack.kind === "heal" ? "Healing" : "Attack");
    this.bars.dps.set(bars.dps, `${formatNumber(now.dps)}/s`);
    this.bars.speed.set(bars.speed, now.speed.toFixed(1));
    this.bars.range.set(bars.range, `${now.range} m`);

    // What's in their tree, or which headquarters brings this hero in.
    this.upgrades.disabled = !unlocked;
    setLabel(this.upgrades, unlocked ? "Upgrades" : "Locked");
    this.upgradeCount.textContent = unlocked ? treeProgress(owned) : `HQ ${HERO_UNLOCK_HQ[kind]}`;
    this.start.disabled = !unlocked;
    setLabel(this.start, this.attacking ? "Attack" : "Raid");
    this.gold.set(this.host.gold());
    this.crystals.set(save.crystals);
    this.refreshShards();
  }

  /** The three crystals they're taking, what they own to choose from, and their retries. */
  private refreshShards(): void {
    const { shards, shardLoadout } = this.host.save();
    const taking = fitLoadout(shards, shardLoadout);
    const change = (next: ReturnType<typeof fitLoadout>) => {
      sfx.press();
      this.host.update({ shardLoadout: next });
      this.refreshShards();
    };
    this.crystalSlots.replaceChildren(
      ...Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
        const power = taking[i];
        const slot = el("button", `loadout-slot${power ? " filled" : ""}`);
        if (!power) {
          slot.disabled = true;
          slot.setAttribute("aria-label", "Empty slot");
          return slot;
        }
        slot.setAttribute("aria-label", `Take out ${TIME_POWER_SPECS[power].name}`);
        slot.title = TIME_POWER_SPECS[power].text;
        slot.append(timeGem(power));
        slot.addEventListener("click", () => change(removeFromLoadout(shards, taking, i)));
        return slot;
      }),
    );
    const full = taking.length >= LOADOUT_SLOTS;
    this.crystalOwned.replaceChildren(
      ...LOADOUT_POWERS.flatMap((power) => {
        const owned = shards[power] ?? 0;
        if (owned <= 0) return [];
        const spare = owned - taking.filter((p) => p === power).length;
        const b = el("button", "loadout-crystal");
        b.setAttribute("aria-label", `Take ${TIME_POWER_SPECS[power].name}`);
        b.title = `${TIME_POWER_SPECS[power].name}: ${TIME_POWER_SPECS[power].text}`;
        b.disabled = full || spare <= 0;
        b.append(timeGem(power), el("span", "loadout-count", String(owned)));
        b.addEventListener("click", () => change(addToLoadout(shards, taking, power)));
        return [b];
      }),
    );
    const retries = shards.retry ?? 0;
    this.retryLine.replaceChildren(
      timeGem("retry", "small"),
      el(
        "span",
        "",
        retries > 0
          ? `${retries} retry crystal${retries === 1 ? "" : "s"}: used on islands that call for more raiders than go`
          : "No retry crystals",
      ),
    );
  }

  private go(): void {
    const save = this.host.save();
    if (!save.unlocked.includes(this.hero)) {
      sfx.error();
      return;
    }
    this.host.update({ hero: this.hero });
    this.host.onStart(this.hero);
  }
}
