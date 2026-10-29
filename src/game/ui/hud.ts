// The in-raid HUD, drawn in HTML over the 3D view.

import { ABILITIES, ABILITY_ORDER, type Ability } from "../logic/gunboat";
import { HEROES } from "../logic/heroes";
import { destructionPercent, nextAbilityCost, type RaidHero, type RaidState } from "../logic/raid";

export interface HudHandlers {
  onSuper(): void;
  onBoat(): void;
  onAbility(ability: Ability): void;
  onRetreat(): void;
}

export interface BoatMarker {
  /** Screen direction from the hero to the gunboat, in radians (0 = right, PI/2 = down). */
  angle: number;
  onScreen: boolean;
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

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export class Hud {
  readonly root = el("div", "hud");
  private readonly heroName = el("div", "hud-hero-name");
  private readonly hpFill = el("div", "hud-meter-fill hud-hp-fill");
  private readonly timer = el("div", "hud-timer");
  private readonly destroyed = el("div", "hud-destroyed");
  private readonly energy = el("div", "hud-energy");
  private readonly superButton = el("button", "hud-super");
  private readonly superLabel = el("span", "hud-super-label", "SUPER");
  private readonly boardButton = el("button", "hud-board", "Board gunboat");
  private readonly boatPanel = el("div", "hud-boat");
  private readonly abilityButtons = new Map<
    Ability,
    { button: HTMLButtonElement; cost: HTMLElement }
  >();
  private readonly arrow = el("div", "hud-boat-arrow", "⚓");

  constructor(parent: HTMLElement, handlers: HudHandlers) {
    const top = el("div", "hud-top");
    const heroPanel = el("div", "hud-panel hud-hero");
    const hpMeter = el("div", "hud-meter");
    hpMeter.append(this.hpFill);
    heroPanel.append(this.heroName, hpMeter);
    const raidPanel = el("div", "hud-panel hud-raid");
    raidPanel.append(this.timer, this.destroyed);
    const right = el("div", "hud-right");
    const retreat = el("button", "hud-retreat", "Retreat");
    retreat.addEventListener("click", () => handlers.onRetreat());
    right.append(this.energy, retreat);
    top.append(heroPanel, raidPanel, right);

    this.superButton.append(this.superLabel);
    this.superButton.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      handlers.onSuper();
    });
    this.boardButton.addEventListener("click", () => handlers.onBoat());

    const hint = el("div", "hud-boat-hint", "Gunboat: drag to look around, tap the island to fire");
    const abilities = el("div", "hud-abilities");
    for (const ability of ABILITY_ORDER) {
      const button = el("button", "hud-ability");
      const label = el("span", "hud-ability-label", ABILITIES[ability].label);
      const cost = el("span", "hud-ability-cost");
      button.append(label, cost);
      button.addEventListener("click", () => handlers.onAbility(ability));
      abilities.append(button);
      this.abilityButtons.set(ability, { button, cost });
    }
    const leave = el("button", "hud-leave", "Back to the beach");
    leave.addEventListener("click", () => handlers.onBoat());
    this.boatPanel.append(hint, abilities, leave);
    this.arrow.append(el("span", "hud-boat-arrow-tip"));

    this.root.append(top, this.superButton, this.boardButton, this.boatPanel, this.arrow);
    // Taps on HUD elements must not also start a joystick underneath.
    for (const node of [top, this.boardButton, this.boatPanel]) {
      node.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
  }

  update(
    state: RaidState,
    hero: RaidHero,
    canBoard: boolean,
    selected: Ability,
    boat: BoatMarker,
  ): void {
    const spec = HEROES[hero.kind];
    this.heroName.textContent = spec.name;
    this.hpFill.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
    this.timer.textContent = formatTime(state.timeLimit - state.time);
    this.destroyed.textContent = `${destructionPercent(state)}% destroyed`;
    this.energy.textContent = `⚡ ${state.energy}`;

    const onFoot = hero.alive && !hero.inBoat;
    this.superButton.style.display = onFoot ? "flex" : "none";
    const charge = Math.round(hero.superCharge * 100);
    this.superButton.style.setProperty("--charge", `${charge}%`);
    this.superButton.classList.toggle("ready", hero.superCharge >= 1);
    this.superLabel.textContent = hero.superCharge >= 1 ? spec.superName : `${charge}%`;

    this.boardButton.style.display = onFoot && canBoard ? "block" : "none";
    this.boatPanel.style.display = hero.inBoat ? "flex" : "none";
    if (hero.inBoat) {
      for (const [ability, { button, cost }] of this.abilityButtons) {
        const price = nextAbilityCost(state, ability);
        cost.textContent = `⚡ ${price}`;
        button.classList.toggle("selected", ability === selected);
        button.classList.toggle("unaffordable", price > state.energy);
      }
    }

    // Point at the gunboat when it's off screen.
    const showArrow = onFoot && !boat.onScreen;
    this.arrow.style.display = showArrow ? "flex" : "none";
    if (showArrow) {
      const w = this.root.clientWidth;
      const h = this.root.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const angle = boat.angle;
      const margin = 34;
      const scale = Math.min(
        (w / 2 - margin) / Math.max(1e-6, Math.abs(Math.cos(angle))),
        (h / 2 - margin) / Math.max(1e-6, Math.abs(Math.sin(angle))),
      );
      const x = cx + Math.cos(angle) * scale;
      const y = cy + Math.sin(angle) * scale;
      this.arrow.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      this.arrow.style.setProperty("--angle", `${angle}rad`);
    }
  }
}
