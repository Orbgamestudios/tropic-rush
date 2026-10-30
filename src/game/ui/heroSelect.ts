// Hero select: the roster on the left, the chosen hero turning on a pedestal in the middle, their
// stats and super on the right, and the island to raid. Gold levels heroes up; medals unlock new
// ones.

import { enemyHqLevel } from "../logic/enemyBase";
import { HERO_KINDS, HEROES, type HeroKind, type SuperKind } from "../logic/heroes";
import {
  HERO_NAMES,
  heroStats,
  levelUpCost,
  MAX_HERO_LEVEL,
  statBars,
  UNLOCK_MEDALS,
} from "../logic/heroProgress";
import type { Showcase } from "../render/showcase";
import { heroPortrait } from "../render/thumbnails";
import { MAX_SQUAD, type SaveData } from "../save";
import {
  backButton,
  button,
  CurrencyPill,
  el,
  formatNumber,
  levelBadge,
  panel,
  portraitTile,
  StatBar,
  setLabel,
} from "./kit/dom";
import { sfx, sparkleAt } from "./kit/fx";
import { type IconName, icon } from "./kit/icons";

export interface HeroSelectHost {
  save(): SaveData;
  update(changes: Partial<SaveData>): void;
  onBack(): void;
  onStart(hero: HeroKind, islandLevel: number, squad: HeroKind[]): void;
}

const SUPER_ICONS: Record<SuperKind, IconName> = {
  sprint: "speed",
  sandbags: "sandbags",
  ram: "ram",
  volley: "rocket",
  smoke: "smoke",
  healZone: "heal",
  turret: "turret",
};

const SUPER_TEXT: Record<SuperKind, string> = {
  sprint: "Dash forward fast, taking less damage for a few seconds.",
  sandbags: "Drop a curved sandbag wall that soaks up enemy fire.",
  ram: "Charge ahead, crushing defenses in the way.",
  volley: "Fire three rockets in a wide spread.",
  smoke: "A smoke cloud: defenses can't target anyone inside it.",
  healZone: "A field medkit that heals the whole crew around it.",
  turret: "Build an auto-turret that fires at nearby defenses.",
};

const ISLANDS = [
  { level: 1, name: "Outpost" },
  { level: 2, name: "Fort" },
  { level: 3, name: "Stronghold" },
] as const;

export class HeroSelect {
  readonly root = el("div", "screen screen-heroes");
  private readonly fx = el("div", "fx-layer");
  private readonly gold = new CurrencyPill("coin", "Gold");
  private readonly medals = new CurrencyPill("medal", "Medals");
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
  private readonly superIcon = el("div", "stats-super-icon");
  private readonly superName = el("div", "stats-super-name");
  private readonly superText = el("div", "stats-super-text");
  private readonly islandButtons = new Map<number, HTMLButtonElement>();
  private readonly levelUp: HTMLButtonElement;
  private readonly levelCost = el("span", "heroes-cost");
  private readonly start: HTMLButtonElement;
  private readonly squadSlots = el("div", "squad-slots");
  private readonly picker = el("div", "squad-picker");
  private hero: HeroKind = "rifleman";
  private island = 1;

  constructor(
    parent: HTMLElement,
    private readonly showcase: Showcase,
    private readonly host: HeroSelectHost,
  ) {
    // Top bar.
    const top = el("div", "screen-top");
    const wallet = el("div", "screen-wallet");
    wallet.append(this.gold.root, this.medals.root);
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
    // The squad: AI heroes who fill the other crew seats.
    const squad = el("div", "squad");
    squad.append(el("div", "squad-label", "Squad"), this.squadSlots, this.picker);
    for (const stop of ["pointerdown", "pointermove", "pointerup"] as const)
      squad.addEventListener(stop, (e) => e.stopPropagation());
    stageArea.append(squad, el("div", "heroes-spin-hint", "Drag to spin"), nameplate);

    // Stats & info.
    const info = panel("Technical specs", "heroes-info");
    const card = el("div", "stats-card");
    const head = el("div", "stats-head");
    head.append(this.cardLevel, this.cardName, this.cardBadges);
    const barsBox = el("div", "stats-bars");
    barsBox.append(...Object.values(this.bars).map((b) => b.root));
    const superCard = el("div", "stats-super");
    const superWords = el("div", "stats-super-words");
    superWords.append(el("div", "stats-super-tag", "Super"), this.superName, this.superText);
    superCard.append(this.superIcon, superWords);
    card.append(head, barsBox, superCard);
    const islands = el("div", "heroes-islands");
    islands.append(el("div", "heroes-islands-label", "Target"));
    const islandRow = el("div", "heroes-island-row");
    for (const island of ISLANDS) {
      const b = el("button", "heroes-island");
      b.setAttribute("aria-label", island.name);
      const stars = el("span", "heroes-island-stars");
      for (let i = 0; i < 3; i++) stars.append(icon("star", i < island.level ? "on" : "off"));
      stars.append(el("span", "heroes-island-hq", `HQ ${enemyHqLevel(island.level)}`));
      b.append(stars, el("span", "heroes-island-name", island.name));
      b.addEventListener("click", () => {
        sfx.tick();
        this.setIsland(island.level);
      });
      islandRow.append(b);
      this.islandButtons.set(island.level, b);
    }
    islands.append(islandRow);
    info.body.append(card);
    top.append(back, islands, wallet);

    // Actions.
    this.levelUp = button({
      label: "Level up",
      variant: "steel",
      size: "md",
      className: "heroes-levelup",
      onClick: () => this.upgrade(),
    });
    this.levelUp.querySelector(".ui-btn-face")?.append(this.levelCost);
    this.start = button({
      label: "Select",
      variant: "blue",
      size: "xl",
      className: "heroes-start",
      onClick: () => this.go(),
    });
    const actions = el("div", "heroes-actions");
    actions.append(this.levelUp, this.start);

    this.root.append(top, roster.root, stageArea, info.root, actions, this.fx);
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(): void {
    const save = this.host.save();
    this.gold.set(save.gold, false);
    this.medals.set(save.medals, false);
    this.root.style.display = "grid";
    this.showcase.show(true);
    this.setIsland(save.level);
    this.choose(save.unlocked.includes(save.hero) ? save.hero : "rifleman", true);
  }

  hide(): void {
    this.root.style.display = "none";
    this.showcase.show(false);
  }

  private setIsland(level: number): void {
    this.island = level;
    for (const [l, b] of this.islandButtons) b.classList.toggle("selected", l === level);
  }

  private choose(kind: HeroKind, quiet = false): void {
    if (!quiet && kind !== this.hero) sfx.whoosh();
    // Picking a squadmate as leader swaps them with the old leader.
    const save = this.host.save();
    if (save.squad.includes(kind) && save.unlocked.includes(this.hero) && kind !== this.hero) {
      const squad = save.squad.map((k) => (k === kind ? this.hero : k));
      this.host.update({ squad: squad.filter((k, i) => squad.indexOf(k) === i) });
    }
    this.hero = kind;
    void this.showcase.setHero(kind);
    this.refresh();
  }

  private refresh(): void {
    const save = this.host.save();
    const kind = this.hero;
    const spec = HEROES[kind];
    const level = save.heroLevels[kind];
    const unlocked = save.unlocked.includes(kind);
    for (const [k, tile] of this.tiles) {
      tile.classList.toggle("selected", k === kind);
      const isLocked = !save.unlocked.includes(k);
      tile.classList.toggle("locked", isLocked);
      tile.querySelector(".ui-level")?.remove();
      tile.querySelector(".ui-tile-lock")?.remove();
      if (isLocked) {
        const lock = el("span", "ui-tile-lock");
        lock.append(icon("lock"), el("span", "ui-tile-lock-text", String(UNLOCK_MEDALS[k])));
        lock.querySelector(".ui-tile-lock-text")?.before(icon("medal", "ui-tile-lock-medal"));
        tile.append(lock);
      } else {
        tile.append(levelBadge(save.heroLevels[k]));
      }
    }
    this.name.textContent = HERO_NAMES[kind];
    this.role.textContent = `${spec.name} · ${spec.role}`;
    this.cardName.textContent = spec.name;
    this.cardBadges.replaceChildren(
      icon(spec.heavy ? "shield" : "speed", "stats-badge"),
      icon(spec.attack.kind === "spray" ? "heal" : "crosshair", "stats-badge"),
    );
    this.cardLevel.replaceChildren(levelBadge(level, "stats-level-badge"));
    this.cardLevel.title =
      level >= MAX_HERO_LEVEL ? "Max level" : `Level ${level} of ${MAX_HERO_LEVEL}`;
    const now = heroStats(kind, level);
    const bars = statBars(kind, level);
    const nextBars = statBars(kind, Math.min(MAX_HERO_LEVEL, level + 1));
    this.bars.hp.set(bars.hp, formatNumber(now.hp), nextBars.hp);
    this.bars.dps.set(bars.dps, `${formatNumber(now.dps)}/s`, nextBars.dps);
    this.bars.speed.set(bars.speed, now.speed.toFixed(1));
    this.bars.range.set(bars.range, `${now.range} m`);
    this.superIcon.replaceChildren(icon(SUPER_ICONS[spec.super]));
    this.superName.textContent = spec.superName;
    this.superText.textContent = SUPER_TEXT[spec.super];

    // Level up, or unlock with medals.
    if (!unlocked) {
      setLabel(this.levelUp, "Unlock");
      this.levelCost.replaceChildren(icon("medal"), el("span", "", String(UNLOCK_MEDALS[kind])));
      this.levelUp.disabled = save.medals < UNLOCK_MEDALS[kind];
      this.levelUp.classList.replace("ui-btn-steel", "ui-btn-gold");
    } else if (level >= MAX_HERO_LEVEL) {
      setLabel(this.levelUp, "Max level");
      this.levelCost.replaceChildren();
      this.levelUp.disabled = true;
      this.levelUp.classList.replace("ui-btn-gold", "ui-btn-steel");
    } else {
      setLabel(this.levelUp, "Level up");
      this.levelCost.replaceChildren(
        icon("coin"),
        el("span", "", formatNumber(levelUpCost(level))),
      );
      this.levelUp.disabled = save.gold < levelUpCost(level);
      this.levelUp.classList.replace("ui-btn-gold", "ui-btn-steel");
    }
    this.start.disabled = !unlocked;
    this.refreshSquad();
    this.gold.set(save.gold);
    this.medals.set(save.medals);
  }

  /** The squad without the current leader, as the raid will use it. */
  private squad(): HeroKind[] {
    const save = this.host.save();
    return save.squad.filter((k) => k !== this.hero && save.unlocked.includes(k));
  }

  private refreshSquad(): void {
    const save = this.host.save();
    const squad = this.squad();
    const slots: HTMLElement[] = [];
    for (let i = 0; i < MAX_SQUAD; i++) {
      const kind = squad[i];
      if (kind) {
        const tile = portraitTile(`Remove ${HEROES[kind].name} from the squad`, null, {
          level: save.heroLevels[kind],
        });
        tile.classList.add("squad-slot");
        void heroPortrait(kind).then((url) => {
          const img = tile.querySelector("img");
          if (img) img.src = url;
        });
        tile.addEventListener("click", () => {
          sfx.press();
          this.host.update({ squad: this.host.save().squad.filter((k) => k !== kind) });
          this.closePicker();
          this.refreshSquad();
        });
        slots.push(tile);
      } else {
        const add = el("button", "squad-slot squad-add");
        add.setAttribute("aria-label", "Add a squadmate");
        add.append(el("span", "squad-plus", "+"));
        const free = this.candidates().length > 0;
        add.disabled = !free;
        add.addEventListener("click", () => this.togglePicker());
        slots.push(add);
      }
    }
    this.squadSlots.replaceChildren(...slots);
  }

  /** Unlocked heroes who could join: not the leader and not already in. */
  private candidates(): HeroKind[] {
    const save = this.host.save();
    const squad = this.squad();
    return save.unlocked.filter((k) => k !== this.hero && !squad.includes(k));
  }

  private togglePicker(): void {
    if (this.picker.classList.contains("open")) {
      this.closePicker();
      return;
    }
    sfx.press();
    const save = this.host.save();
    const tiles = this.candidates().map((kind) => {
      const tile = portraitTile(`Add ${HEROES[kind].name}`, null, {
        level: save.heroLevels[kind],
      });
      tile.classList.add("squad-option");
      tile.append(el("span", "squad-option-name", HEROES[kind].name));
      void heroPortrait(kind).then((url) => {
        const img = tile.querySelector("img");
        if (img) img.src = url;
      });
      tile.addEventListener("click", () => {
        const current = this.squad();
        if (current.length >= MAX_SQUAD) return;
        sfx.levelUp();
        this.host.update({ squad: [...current, kind] });
        sparkleAt(this.fx, tile, { count: 10, spread: 40 });
        this.closePicker();
        this.refreshSquad();
      });
      return tile;
    });
    this.picker.replaceChildren(...tiles);
    this.picker.classList.add("open");
  }

  private closePicker(): void {
    this.picker.classList.remove("open");
  }

  private upgrade(): void {
    const save = this.host.save();
    const kind = this.hero;
    if (!save.unlocked.includes(kind)) {
      const price = UNLOCK_MEDALS[kind];
      if (save.medals < price) {
        sfx.error();
        return;
      }
      this.host.update({ medals: save.medals - price, unlocked: [...save.unlocked, kind] });
      sfx.levelUp();
      this.celebrate();
      this.refresh();
      return;
    }
    const level = save.heroLevels[kind];
    const price = levelUpCost(level);
    if (level >= MAX_HERO_LEVEL || save.gold < price) {
      sfx.error();
      return;
    }
    this.host.update({
      gold: save.gold - price,
      heroLevels: { ...save.heroLevels, [kind]: level + 1 },
    });
    sfx.levelUp();
    this.celebrate();
    this.refresh();
  }

  private celebrate(): void {
    const tile = this.tiles.get(this.hero);
    if (tile) sparkleAt(this.fx, tile, { count: 16, spread: 60 });
    sparkleAt(this.fx, this.name, { count: 30, spread: 140 });
    this.name.classList.remove("pop");
    void this.name.offsetWidth;
    this.name.classList.add("pop");
  }

  private go(): void {
    const save = this.host.save();
    if (!save.unlocked.includes(this.hero)) {
      sfx.error();
      return;
    }
    this.closePicker();
    this.host.update({ hero: this.hero, level: this.island });
    this.host.onStart(this.hero, this.island, this.squad());
  }
}
