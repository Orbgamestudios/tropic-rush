// The in-raid HUD, in HTML over the 3D view:
// - top-left: the hero's portrait card with level badge, health bar, and under it
//   the portraits of the crewmates raiding with you
// - top-middle: time left and how much of the island is destroyed
// - top-right: pause, a live minimap, gunboat energy and the loot so far
// - bottom-middle, only on the gunboat: its abilities; bottom-right: the gunboat button (the move
//   stick and fire pad belong to Controls)

import { hapticOnTap } from "../audio/haptics";
import { costText, RESOURCES } from "../logic/economy";
import { ABILITIES, ABILITY_ORDER, type Ability } from "../logic/gunboat";
import type { HeroKind } from "../logic/heroes";
import { HERO_NAMES, raidReward } from "../logic/heroProgress";
import {
  canUseShard,
  destructionPercent,
  nextAbilityCost,
  type RaidHero,
  type RaidState,
} from "../logic/raid";
import { TIME_POWER_SPECS, TIME_POWERS, type TimePower } from "../logic/timeShards";
import { CurrencyPill, costChips, el, formatNumber, levelBadge } from "./kit/dom";
import { sfx } from "./kit/fx";
import { type IconName, icon } from "./kit/icons";
import { timeGem } from "./kit/timeIcons";

export interface HudHandlers {
  onBoat(): void;
  onAbility(ability: Ability): void;
  onPause(): void;
  onShard(power: TimePower): void;
}

export const ABILITY_ICONS: Record<Ability, IconName> = {
  artillery: "artillery",
  heal: "medkit",
  shock: "shock",
  barrage: "barrage",
  smoke: "smoke",
};

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function stop(node: HTMLElement): void {
  // Taps on HUD elements must not also start a joystick underneath.
  node.addEventListener("pointerdown", (e) => e.stopPropagation());
}

export class Hud {
  readonly root = el("div", "hud");
  private readonly portrait = el("img", "hud-portrait-img");
  private readonly level = el("div", "hud-level");
  private readonly name = el("div", "hud-name");
  private readonly hpFill = el("div", "hud-bar-fill");
  private readonly hpLag = el("div", "hud-bar-lag");
  /** Fast forward's barrier, over the end of the health bar. */
  private readonly hpBarrier = el("div", "hud-bar-barrier");
  private readonly hpText = el("span", "hud-bar-text");
  private readonly timer = el("span", "hud-objective-time");
  private readonly destroyed = el("span", "hud-objective-pct");
  private readonly objectiveFill = el("div", "hud-objective-fill");
  private readonly energy = new CurrencyPill("energy", "Gunboat energy");
  private readonly loot = new CurrencyPill("coin", "Loot");
  private readonly map = el("canvas", "hud-minimap-canvas");
  private readonly mapNorth = el("div", "hud-minimap-north");
  private readonly boatButton = el("button", "hud-round hud-boat");
  private readonly boatLabel = el("span", "hud-round-label", "Gunboat");
  private readonly materials = el("div", "hud-materials");
  private shownMaterials = "";
  private mapBase: HTMLCanvasElement | null = null;
  private readonly card = el("div", "hud-card");
  private readonly tray = el("div", "hud-tray");
  private readonly trayBox = el("div", "hud-tray-box");
  private readonly trayHint = el("div", "hud-tray-hint");
  private readonly abilityButtons = new Map<
    Ability,
    { button: HTMLButtonElement; cost: HTMLElement }
  >();
  private readonly shardBox = el("div", "hud-shards");
  private readonly shardButtons = new Map<
    TimePower,
    { button: HTMLButtonElement; count: HTMLElement }
  >();
  /** The crew's retry crystals, one for each retry left, under the hero's health. */
  private readonly retryRow = el("div", "hud-retries");
  private shownRetries = -1;
  /** The time power running, named small under the timer. */
  private readonly timeLabel = el("div", "hud-time-label");
  private shownTime = "";
  private retriesSeen = -1;
  private retryShown = 0;
  private readonly flashText = el("div", "hud-flash");
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHp = -1;
  private lagHp = 0;
  private mapTimer = 0;
  /** The hero's health when the gunboat's view opened, to warn if they're being hit. */
  private startOfView = 0;
  private readonly squadBox = el("div", "hud-squad");
  private squad: {
    root: HTMLElement;
    fill: HTMLElement;
    lag: HTMLElement;
    lagHp: number;
    alive: boolean;
    kind: HeroKind;
    seat: number;
  }[] = [];

  constructor(parent: HTMLElement, handlers: HudHandlers) {
    // Hero card.
    const { card } = this;
    const frame = el("div", "hud-portrait");
    this.portrait.alt = "";
    frame.append(this.portrait, this.level);
    const bars = el("div", "hud-bars");
    const hp = el("div", "hud-bar hud-bar-hp");
    hp.append(this.hpLag, this.hpFill, this.hpBarrier, this.hpText);
    const hpRow = el("div", "hud-bar-row");
    hpRow.append(icon("heart", "hud-bar-icon"), hp);
    this.retryRow.style.setProperty("--tint", TIME_POWER_SPECS.retry.color);
    this.retryRow.title = TIME_POWER_SPECS.retry.text;
    bars.append(this.name, hpRow, this.retryRow);
    card.append(frame, bars);

    // Objective.
    const objective = el("div", "hud-objective");
    const objRow = el("div", "hud-objective-row");
    objRow.append(
      icon("clock", "hud-objective-icon"),
      this.timer,
      icon("skull", "hud-objective-icon"),
      this.destroyed,
    );
    const objTrack = el("div", "hud-objective-track");
    objTrack.append(this.objectiveFill);
    objective.append(objRow, objTrack, this.timeLabel);

    // Top-right: pause, minimap, pills.
    const right = el("div", "hud-right");
    const pause = el("button", "hud-pause");
    pause.setAttribute("aria-label", "Pause");
    pause.append(icon("pause", "hud-pause-icon"), el("span", "hud-pause-label", "Pause"));
    pause.addEventListener("click", () => {
      sfx.press();
      handlers.onPause();
    });
    hapticOnTap(pause);
    const minimap = el("div", "hud-minimap");
    this.map.width = 128;
    this.map.height = 128;
    minimap.append(this.map, this.mapNorth);
    const mapRow = el("div", "hud-map-row");
    mapRow.append(pause, minimap);
    const pills = el("div", "hud-pills");
    pills.append(this.energy.root, this.loot.root);
    // Time shards: one button for each power the player brought, and the crew's retries.
    for (const power of TIME_POWERS) {
      if (power === "retry") continue;
      const spec = TIME_POWER_SPECS[power];
      const b = el("button", "hud-shard");
      b.setAttribute("aria-label", spec.name);
      b.title = spec.text;
      b.style.setProperty("--tint", spec.color);
      const count = el("span", "hud-shard-count");
      b.append(timeGem(power), count);
      // On the touch itself, not a click: a click never comes while another finger is on a stick.
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        sfx.press();
        handlers.onShard(power);
      });
      hapticOnTap(b);
      this.shardBox.append(b);
      this.shardButtons.set(power, { button: b, count });
    }
    right.append(mapRow, pills, this.materials, this.shardBox);

    // The gunboat button.
    this.boatButton.setAttribute("aria-label", "Gunboat");
    this.boatButton.append(icon("anchorGold", "hud-boat-icon"), this.boatLabel);
    this.boatButton.addEventListener("click", () => {
      sfx.press();
      handlers.onBoat();
    });
    hapticOnTap(this.boatButton);

    // Gunboat abilities.
    for (const ability of ABILITY_ORDER) {
      const b = el("button", "hud-slot");
      b.setAttribute("aria-label", ABILITIES[ability].label);
      const cost = el("span", "hud-slot-cost");
      b.append(
        icon(ABILITY_ICONS[ability], "hud-slot-icon"),
        el("span", "hud-slot-label", ABILITIES[ability].label),
        cost,
      );
      b.addEventListener("click", () => {
        sfx.press();
        handlers.onAbility(ability);
      });
      hapticOnTap(b);
      this.tray.append(b);
      this.abilityButtons.set(ability, { button: b, cost });
    }
    this.trayBox.append(this.trayHint, this.tray);

    this.root.append(
      card,
      this.squadBox,
      objective,
      right,
      this.trayBox,
      this.boatButton,
      this.flashText,
    );
    for (const node of [card, objective, right, this.trayBox, this.boatButton]) {
      stop(node);
    }
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
  }

  /** Sets the hero card's picture and upgrade count at the start of a raid. */
  setHero(portraitUrl: Promise<string>, upgrades: number): void {
    this.portrait.removeAttribute("src");
    void portraitUrl.then((url) => {
      this.portrait.src = url;
    });
    this.level.replaceChildren(levelBadge(upgrades));
    this.lastHp = -1;
    this.retriesSeen = -1;
    this.shownRetries = -1;
    // A new island, so a new map of it.
    this.mapBase = null;
  }

  /** The crewmates on this raid, by their place in state.heroes. */
  setSquad(
    mates: readonly { seat: number; kind: HeroKind; upgrades: number; portrait: Promise<string> }[],
  ): void {
    this.squad = mates.map((mate) => {
      const root = el("div", "hud-mate");
      const frame = el("div", "hud-mate-frame");
      const img = el("img", "hud-mate-img");
      img.alt = "";
      void mate.portrait.then((url) => {
        img.src = url;
      });
      frame.append(img, el("div", "hud-mate-ko", "KO"));
      const bar = el("div", "hud-mate-bar");
      const lag = el("div", "hud-mate-lag");
      const fill = el("div", "hud-mate-fill");
      bar.append(lag, fill);
      root.append(frame, levelBadge(mate.upgrades, "hud-mate-level"), bar);
      root.title = HERO_NAMES[mate.kind];
      return { root, fill, lag, lagHp: 1, alive: true, kind: mate.kind, seat: mate.seat };
    });
    this.squadBox.replaceChildren(...this.squad.map((m) => m.root));
  }

  flash(message: string): void {
    this.flashText.textContent = message;
    this.flashText.classList.add("on");
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.flashText.classList.remove("on"), 1600);
  }

  update(
    state: RaidState,
    hero: RaidHero,
    canBoard: boolean,
    selected: Ability,
    /** How far the view is turned from north, so the minimap can turn with it. */
    turn: number,
    islandLevel: number,
    dt: number,
  ): void {
    this.name.textContent = HERO_NAMES[hero.kind];

    // Health, with a trailing "damage taken" bar.
    const hpFraction = Math.max(0, hero.hp / hero.maxHp);
    if (this.lastHp < 0) this.lagHp = hpFraction;
    this.card.classList.toggle("hurt", hero.hp < this.lastHp);
    this.lastHp = hero.hp;
    this.lagHp = Math.max(hpFraction, this.lagHp - dt * 0.35);
    this.hpFill.style.width = `${hpFraction * 100}%`;
    this.hpLag.style.width = `${this.lagHp * 100}%`;
    this.hpText.textContent = `${formatNumber(Math.ceil(hero.hp))} / ${formatNumber(hero.maxHp)}`;
    this.hpFill.classList.toggle("low", hpFraction < 0.3);
    const barrier = Math.min(1, hero.barrier / hero.maxHp);
    this.hpBarrier.style.width = `${barrier * 100}%`;
    this.hpBarrier.style.left = `${Math.max(0, hpFraction - barrier) * 100}%`;

    const percent = destructionPercent(state);
    this.timer.textContent = formatTime(state.timeLimit - state.time);
    this.timer.classList.toggle("urgent", state.timeLimit - state.time < 30);
    this.destroyed.textContent = `${percent}%`;
    this.objectiveFill.style.width = `${percent}%`;
    this.energy.set(state.energy);
    this.loot.set(raidReward(false, percent, islandLevel).gold);
    if (RESOURCES.some((r) => state.loot[r] > 0)) {
      const carried = costText(state.loot);
      if (carried !== this.shownMaterials) {
        this.shownMaterials = carried;
        this.materials.replaceChildren(costChips(carried));
      }
    } else if (this.shownMaterials) {
      this.shownMaterials = "";
      this.materials.replaceChildren();
    }

    this.boatButton.style.display = canBoard || hero.inBoat ? "flex" : "none";
    this.boatButton.setAttribute("aria-label", hero.inBoat ? "Back to your hero" : "Gunboat");
    this.boatLabel.textContent = hero.inBoat ? "Back" : "Gunboat";
    this.trayHint.textContent =
      hero.hp < this.startOfView ? "You're under fire!" : "Tap the island to fire";
    if (!hero.inBoat) this.startOfView = hero.hp;
    this.trayBox.style.display = hero.inBoat ? "flex" : "none";
    this.tray.classList.toggle("active", hero.inBoat);
    for (const [ability, { button, cost }] of this.abilityButtons) {
      const price = nextAbilityCost(state, ability);
      button.style.display = state.gunboat[ability] ? "" : "none";
      cost.textContent = String(price);
      button.classList.toggle("selected", hero.inBoat && ability === selected);
      button.classList.toggle("unaffordable", price > state.energy);
    }

    // Time shards: dim while another power runs, with the running one counting down.
    const running = state.timePower;
    for (const [power, { button, count }] of this.shardButtons) {
      const left = hero.shards[power] ?? 0;
      const mine = running?.power === power;
      button.style.display = left > 0 || mine ? "" : "none";
      count.textContent = String(left);
      button.classList.toggle("running", mine);
      button.classList.toggle("unusable", !mine && !canUseShard(state, hero, power));
      const share = mine && running ? running.left / TIME_POWER_SPECS[power].seconds : 0;
      button.style.setProperty("--left", share.toFixed(3));
    }
    // Named under the timer while it runs, and a retry for a moment when one's used.
    if (this.retriesSeen >= 0 && state.retries < this.retriesSeen) this.retryShown = 1.6;
    this.retriesSeen = state.retries;
    this.retryShown = Math.max(0, this.retryShown - dt);
    const named: TimePower | null = running?.power ?? (this.retryShown > 0 ? "retry" : null);
    const label = named
      ? `${TIME_POWER_SPECS[named].name}${running ? ` ${Math.ceil(running.left)}` : ""}`
      : "";
    if (label !== this.shownTime) {
      this.shownTime = label;
      this.timeLabel.textContent = label;
      this.timeLabel.classList.toggle("on", named !== null);
      if (named) this.timeLabel.style.setProperty("--tint", TIME_POWER_SPECS[named].color);
    }
    if (state.retries !== this.shownRetries) {
      this.shownRetries = state.retries;
      const gems = Array.from({ length: Math.min(state.retries, 6) }, () =>
        el("span", "hud-retry-gem"),
      );
      if (state.retries > 6) gems.push(el("span", "hud-retry-more", `×${state.retries}`));
      this.retryRow.replaceChildren(...gems);
      this.root.classList.toggle("retrying", state.retries > 0);
    }

    // Crewmates' portraits.
    for (const mate of this.squad) {
      const h = state.heroes[mate.seat];
      if (!h) continue;
      const fraction = h.alive ? Math.max(0, h.hp / h.maxHp) : 0;
      mate.lagHp = Math.max(fraction, mate.lagHp - dt * 0.35);
      mate.fill.style.width = `${fraction * 100}%`;
      mate.lag.style.width = `${mate.lagHp * 100}%`;
      mate.fill.classList.toggle("low", fraction < 0.3);
      mate.root.classList.toggle("hit", h.alive && fraction < mate.lagHp - 0.01);
      if (mate.alive && !h.alive) {
        mate.alive = false;
        mate.root.classList.add("down");
        this.flash(`${HERO_NAMES[mate.kind]} is down!`);
      }
    }

    this.map.style.transform = `rotate(${turn}rad)`;
    this.mapNorth.style.transform = `rotate(${turn}rad)`;
    this.mapTimer -= dt;
    if (this.mapTimer <= 0) {
      this.mapTimer = 0.2;
      this.drawMap(state, hero);
    }
  }

  /** The sea and island, which never change: drawn once and copied onto the minimap. */
  private mapBackdrop(state: RaidState, size: number, scale: number) {
    if (this.mapBase) return this.mapBase;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    this.mapBase = canvas;
    const g = canvas.getContext("2d");
    if (!g) return canvas;
    const { shape } = state;
    const image = g.createImageData(size, size);
    const paint = (i: number, r: number, b: number, c: number) => {
      image.data[i] = r;
      image.data[i + 1] = b;
      image.data[i + 2] = c;
      image.data[i + 3] = 255;
    };
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const x = (i - size / 2) / scale;
        const y = (j - size / 2) / scale;
        const sd = shape.shoreDistance(x, y);
        const k = (j * size + i) * 4;
        if (shape.lava(x, y) > 0.3) paint(k, 255, 110, 36);
        else if (sd <= -2) paint(k, 38, 145, 186);
        else if (sd <= 0) paint(k, 110, 208, 216);
        else if (sd < shape.beachWidth(x, y)) {
          if (shape.blackSand) paint(k, 92, 86, 90);
          else paint(k, 242, 215, 155);
        } else paint(k, 95, 174, 70);
      }
    }
    g.putImageData(image, 0, 0);
    return canvas;
  }

  /** The minimap: island, buildings, the gunboat and the crew, north up. */
  private drawMap(state: RaidState, hero: RaidHero): void {
    const g = this.map.getContext("2d");
    if (!g) return;
    const size = this.map.width;
    const scale = size / (state.shape.reach * 2 * 0.85);
    const cx = size / 2;
    const cy = size / 2;
    const px = (x: number) => cx + x * scale;
    const py = (y: number) => cy + y * scale;
    g.drawImage(this.mapBackdrop(state, size, scale), 0, 0);
    for (const b of state.buildings) {
      if (b.destroyed) {
        g.fillStyle = "rgba(40, 30, 20, 0.5)";
        g.fillRect(px(b.pos.x) - 1.5, py(b.pos.y) - 1.5, 3, 3);
        continue;
      }
      const isHq = b.type === "headquarters";
      g.fillStyle = isHq ? "#ffd84a" : "#e5503a";
      g.strokeStyle = "#1a2232";
      g.lineWidth = 1;
      const r = isHq ? 4 : 2.4;
      g.beginPath();
      g.rect(px(b.pos.x) - r, py(b.pos.y) - r, r * 2, r * 2);
      g.fill();
      g.stroke();
    }
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(px(state.boat.pos.x), py(state.boat.pos.y), 3, 0, Math.PI * 2);
    g.fill();
    for (const h of state.heroes) {
      if (!h.alive) continue;
      const x = px(h.pos.x);
      const y = py(h.pos.y);
      g.save();
      g.translate(x, y);
      g.rotate(h.facing + Math.PI / 2);
      g.fillStyle = h.id === hero.id ? "#4fb3ff" : "#9fd4ff";
      g.strokeStyle = "#ffffff";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(4.5, 5);
      g.lineTo(-4.5, 5);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
  }
}
