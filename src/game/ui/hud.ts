// The in-raid HUD, in HTML over the 3D view:
// - top-left: the hero's portrait card with level badge, health and super bars, and under it
//   the squad's portraits with their health
// - top-middle: time left and how much of the island is destroyed
// - top-right: pause, a live minimap, gunboat energy and the loot so far
// - bottom-middle, only on the gunboat: its abilities; bottom-right: the gunboat button, and the
//   Super button wherever the settings put it (the move stick and fire pad belong to Controls)
// - an arrow at the screen edge pointing back to the gunboat when it's out of view

import { ABILITIES, ABILITY_ORDER, type Ability } from "../logic/gunboat";
import { HEROES, type HeroKind, type SuperKind } from "../logic/heroes";
import { HERO_NAMES, raidReward } from "../logic/heroProgress";
import { shoreRadius } from "../logic/island";
import { destructionPercent, nextAbilityCost, type RaidHero, type RaidState } from "../logic/raid";
import type { ControlSpot } from "../save";
import { CurrencyPill, el, formatNumber, levelBadge } from "./kit/dom";
import { sfx } from "./kit/fx";
import { type IconName, icon } from "./kit/icons";

export interface HudHandlers {
  onSuper(): void;
  onBoat(): void;
  onAbility(ability: Ability): void;
  onPause(): void;
}

export interface BoatMarker {
  /** Screen direction from the hero to the gunboat, in radians (0 = right, PI/2 = down). */
  angle: number;
  onScreen: boolean;
  /** How far the view is turned from north, so the minimap can turn with it. */
  turn: number;
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

const ABILITY_ICONS: Record<Ability, IconName> = {
  artillery: "artillery",
  barrage: "barrage",
  heal: "heal",
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
  private readonly hpText = el("span", "hud-bar-text");
  private readonly superFill = el("div", "hud-bar-fill");
  private readonly superText = el("span", "hud-bar-text");
  private readonly timer = el("span", "hud-objective-time");
  private readonly destroyed = el("span", "hud-objective-pct");
  private readonly objectiveFill = el("div", "hud-objective-fill");
  private readonly energy = new CurrencyPill("energy", "Gunboat energy");
  private readonly loot = new CurrencyPill("coin", "Loot");
  private readonly map = el("canvas", "hud-minimap-canvas");
  private readonly mapNorth = el("div", "hud-minimap-north");
  private readonly superButton = el("button", "hud-round hud-super");
  private readonly superRing = el("div", "hud-super-ring");
  private readonly superIcon = el("div", "hud-super-icon");
  private readonly boatButton = el("button", "hud-round hud-boat");
  private readonly boatLabel = el("span", "hud-round-label", "Board");
  private readonly tray = el("div", "hud-tray");
  private readonly trayBox = el("div", "hud-tray-box");
  private readonly trayHint = el("div", "hud-tray-hint");
  private readonly abilityButtons = new Map<
    Ability,
    { button: HTMLButtonElement; cost: HTMLElement }
  >();
  private readonly arrow = el("div", "hud-boat-arrow");
  private readonly flashText = el("div", "hud-flash");
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHp = -1;
  private lagHp = 0;
  private superReady = false;
  private mapTimer = 0;
  private superKind: SuperKind | null = null;
  private onFoot = true;
  private readonly squadBox = el("div", "hud-squad");
  private squad: {
    root: HTMLElement;
    fill: HTMLElement;
    lag: HTMLElement;
    lagHp: number;
    alive: boolean;
    kind: HeroKind;
  }[] = [];

  constructor(parent: HTMLElement, handlers: HudHandlers) {
    // Hero card.
    const card = el("div", "hud-card");
    const frame = el("div", "hud-portrait");
    this.portrait.alt = "";
    frame.append(this.portrait, this.level);
    const bars = el("div", "hud-bars");
    const hp = el("div", "hud-bar hud-bar-hp");
    hp.append(this.hpLag, this.hpFill, this.hpText);
    const sup = el("div", "hud-bar hud-bar-super");
    sup.append(this.superFill, this.superText);
    const hpRow = el("div", "hud-bar-row");
    hpRow.append(icon("heart", "hud-bar-icon"), hp);
    const supRow = el("div", "hud-bar-row");
    supRow.append(icon("energy", "hud-bar-icon"), sup);
    bars.append(this.name, hpRow, supRow);
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
    objective.append(objRow, objTrack);

    // Top-right: pause, minimap, pills.
    const right = el("div", "hud-right");
    const pause = el("button", "hud-pause");
    pause.setAttribute("aria-label", "Pause");
    pause.append(icon("pause", "hud-pause-icon"), el("span", "hud-pause-label", "Pause"));
    pause.addEventListener("click", () => {
      sfx.press();
      handlers.onPause();
    });
    const minimap = el("div", "hud-minimap");
    this.map.width = 128;
    this.map.height = 128;
    minimap.append(this.map, this.mapNorth);
    const mapRow = el("div", "hud-map-row");
    mapRow.append(pause, minimap);
    const pills = el("div", "hud-pills");
    pills.append(this.energy.root, this.loot.root);
    right.append(mapRow, pills);

    // Super and gunboat buttons.
    this.superButton.setAttribute("aria-label", "Super");
    this.superButton.append(this.superRing, this.superIcon, el("span", "hud-round-label", "Super"));
    this.superButton.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (this.superReady) sfx.press();
      handlers.onSuper();
    });
    this.boatButton.setAttribute("aria-label", "Board gunboat");
    this.boatButton.append(icon("anchorGold", "hud-boat-icon"), this.boatLabel);
    this.boatButton.addEventListener("click", () => {
      sfx.press();
      handlers.onBoat();
    });

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
      this.tray.append(b);
      this.abilityButtons.set(ability, { button: b, cost });
    }
    this.trayBox.append(this.trayHint, this.tray);

    this.arrow.append(icon("anchorGold", "hud-boat-arrow-icon"), el("span", "hud-boat-arrow-tip"));

    this.root.append(
      card,
      this.squadBox,
      objective,
      right,
      this.trayBox,
      this.superButton,
      this.boatButton,
      this.arrow,
      this.flashText,
    );
    for (const node of [card, objective, right, this.trayBox, this.boatButton]) stop(node);
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
  }

  /** Moves and sizes the Super button from the settings. */
  setSuperSpot(spot: ControlSpot): void {
    this.superButton.style.left = `${spot.x * 100}%`;
    this.superButton.style.top = `${spot.y * 100}%`;
    this.superButton.style.setProperty("--size", String(spot.size));
  }

  /** Sets the hero card's picture and level at the start of a raid. */
  setHero(portraitUrl: Promise<string>, level: number): void {
    this.portrait.removeAttribute("src");
    void portraitUrl.then((url) => {
      this.portrait.src = url;
    });
    this.level.replaceChildren(levelBadge(level));
    this.lastHp = -1;
    this.superKind = null;
  }

  /** The AI squadmates' portraits, in the same order as state.heroes[1..]. */
  setSquad(mates: readonly { kind: HeroKind; level: number; portrait: Promise<string> }[]): void {
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
      root.append(frame, levelBadge(mate.level, "hud-mate-level"), bar);
      root.title = HERO_NAMES[mate.kind];
      return { root, fill, lag, lagHp: 1, alive: true, kind: mate.kind };
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
    boat: BoatMarker,
    islandLevel: number,
    dt: number,
  ): void {
    const spec = HEROES[hero.kind];
    this.name.textContent = HERO_NAMES[hero.kind];
    if (this.superKind !== spec.super) {
      this.superKind = spec.super;
      this.superIcon.replaceChildren(icon(SUPER_ICONS[spec.super]));
    }

    // Health, with a trailing "damage taken" bar.
    const hpFraction = Math.max(0, hero.hp / hero.maxHp);
    if (this.lastHp < 0) this.lagHp = hpFraction;
    if (hero.hp < this.lastHp) this.root.querySelector(".hud-card")?.classList.add("hurt");
    else this.root.querySelector(".hud-card")?.classList.remove("hurt");
    this.lastHp = hero.hp;
    this.lagHp = Math.max(hpFraction, this.lagHp - dt * 0.35);
    this.hpFill.style.width = `${hpFraction * 100}%`;
    this.hpLag.style.width = `${this.lagHp * 100}%`;
    this.hpText.textContent = `${formatNumber(Math.ceil(hero.hp))} / ${formatNumber(hero.maxHp)}`;
    this.hpFill.classList.toggle("low", hpFraction < 0.3);

    const charge = Math.min(1, hero.superCharge);
    this.superFill.style.width = `${charge * 100}%`;
    this.superText.textContent =
      charge >= 1 ? `${spec.superName} ready!` : `Super ${Math.round(charge * 100)}%`;
    const ready = charge >= 1;
    if (ready && !this.superReady) sfx.coin();
    this.superReady = ready;
    this.superButton.classList.toggle("ready", ready);
    this.superButton.style.setProperty("--charge", `${charge * 360}deg`);

    const percent = destructionPercent(state);
    this.timer.textContent = formatTime(state.timeLimit - state.time);
    this.timer.classList.toggle("urgent", state.timeLimit - state.time < 30);
    this.destroyed.textContent = `${percent}%`;
    this.objectiveFill.style.width = `${percent}%`;
    this.energy.set(state.energy);
    this.loot.set(raidReward(false, percent, islandLevel).gold);

    this.onFoot = hero.alive && !hero.inBoat;
    this.superButton.style.display = this.onFoot ? "flex" : "none";
    this.boatButton.style.display = (this.onFoot && canBoard) || hero.inBoat ? "flex" : "none";
    this.boatButton.setAttribute("aria-label", hero.inBoat ? "Back to the beach" : "Board gunboat");
    this.boatLabel.textContent = hero.inBoat ? "Land" : "Board";
    this.boatButton.classList.toggle("glow", this.onFoot && canBoard);
    this.trayHint.textContent = "Tap the island to fire";
    this.trayBox.style.display = hero.inBoat ? "flex" : "none";
    this.tray.classList.toggle("active", hero.inBoat);
    for (const [ability, { button, cost }] of this.abilityButtons) {
      const price = nextAbilityCost(state, ability);
      cost.textContent = String(price);
      button.classList.toggle("selected", hero.inBoat && ability === selected);
      button.classList.toggle("unaffordable", price > state.energy);
    }

    // Point at the gunboat when it's off screen.
    const showArrow = this.onFoot && !boat.onScreen;
    this.arrow.style.display = showArrow ? "flex" : "none";
    if (showArrow) {
      const w = this.root.clientWidth;
      const h = this.root.clientHeight;
      const angle = boat.angle;
      const margin = 46;
      const scale = Math.min(
        (w / 2 - margin) / Math.max(1e-6, Math.abs(Math.cos(angle))),
        (h / 2 - margin) / Math.max(1e-6, Math.abs(Math.sin(angle))),
      );
      // Keep clear of the hero card, the minimap column and the bottom controls.
      const x = Math.max(60, Math.min(w - 150, w / 2 + Math.cos(angle) * scale));
      const y = Math.max(96, Math.min(h - 140, h / 2 + Math.sin(angle) * scale));
      this.arrow.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      this.arrow.style.setProperty("--angle", `${angle}rad`);
    }

    // Squad portraits.
    this.squad.forEach((mate, i) => {
      const h = state.heroes[i + 1];
      if (!h) return;
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
    });

    this.map.style.transform = `rotate(${boat.turn}rad)`;
    this.mapNorth.style.transform = `rotate(${boat.turn}rad)`;
    this.mapTimer -= dt;
    if (this.mapTimer <= 0) {
      this.mapTimer = 0.1;
      this.drawMap(state, hero);
    }
  }

  /** The minimap: island, buildings, the gunboat and the crew, north up. */
  private drawMap(state: RaidState, hero: RaidHero): void {
    const g = this.map.getContext("2d");
    if (!g) return;
    const size = this.map.width;
    const scale = size / 190;
    const cx = size / 2;
    const cy = size / 2;
    const px = (x: number) => cx + x * scale;
    const py = (y: number) => cy + y * scale;
    g.clearRect(0, 0, size, size);
    const sea = g.createRadialGradient(cx, cy, 10, cx, cy, size * 0.7);
    sea.addColorStop(0, "#56c7d8");
    sea.addColorStop(1, "#1a7fa6");
    g.fillStyle = sea;
    g.fillRect(0, 0, size, size);
    const shore = (inset: number) => {
      g.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const r = shoreRadius(a) - inset;
        const x = px(Math.cos(a) * r);
        const y = py(Math.sin(a) * r);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
    };
    shore(-2);
    g.fillStyle = "#f2d79b";
    g.fill();
    shore(9);
    g.fillStyle = "#5fae46";
    g.fill();
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
