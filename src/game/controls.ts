// Turns touches, mouse and keyboard into HeroInput for the rules.
// Phone: left thumb moves, right thumb aims. Dragging the aim stick shows the aim cone without
// firing (and slows the hero); letting go locks onto the building in the cone and the hero keeps
// firing at it until it's gone or out of range. A quick tap locks onto the nearest tower. Both
// sticks rest in their corners and jump to wherever the thumb lands on that half of the screen,
// then spring back home. In the gunboat: drag to look
// around, tap the island to fire the selected ability.
// Computer: WASD/arrows move, drag the mouse from the hero to aim and release to lock on (click
// to lock onto the nearest tower), Space super, E gunboat, 1-3 abilities.

import type { Ability } from "./logic/gunboat";
import { ABILITY_ORDER } from "./logic/gunboat";
import type { HeroInput } from "./logic/raid";
import { clampLength, length, normalize, sub, type Vec2, vec } from "./logic/vec";
import type { CameraRig } from "./render/cameraRig";
import { type ControlLayout, DEFAULT_CONTROLS } from "./save";
import { iconSvg } from "./ui/kit/icons";

export type ControlMode = "off" | "hero" | "boat";

const BASE_STICK_RADIUS = 58;
const TAP_MS = 230;
const TAP_DISTANCE = 14;
const AIM_DEADZONE = 10;

interface Stick {
  pointerId: number;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  startTime: number;
  base: HTMLElement;
  knob: HTMLElement;
}

interface Pan {
  pointerId: number;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  startTime: number;
}

function stickElements(
  surface: HTMLElement,
  kind: string,
): { base: HTMLElement; knob: HTMLElement } {
  const base = document.createElement("div");
  base.className = `stick stick-${kind} home`;
  const knob = document.createElement("div");
  knob.className = "stick-knob";
  if (kind === "move") {
    // Four little arrows round the ring.
    for (const dir of ["up", "right", "down", "left"]) {
      const arrow = document.createElement("span");
      arrow.className = `stick-arrow stick-arrow-${dir}`;
      base.append(arrow);
    }
    knob.innerHTML = iconSvg("anchorGold");
  } else {
    knob.innerHTML = iconSvg("bullet");
    const label = document.createElement("div");
    label.className = "stick-label stick-label-aim";
    label.textContent = "FIRE";
    base.append(label);
  }
  base.append(knob);
  surface.append(base);
  return { base, knob };
}

export class Controls {
  selectedAbility: Ability = "artillery";
  /** The UI size setting; sticks are drawn this much bigger or smaller. */
  uiScale = 1;
  private layout: ControlLayout = DEFAULT_CONTROLS;
  private mode: ControlMode = "off";
  private left: Stick | null = null;
  private right: Stick | null = null;
  private pan: Pan | null = null;
  private readonly keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false, startX: 0, startY: 0, startTime: 0 };
  private pendingAutoAim = false;
  private pendingLock: Vec2 | null = null;
  private lastHero: Vec2 | null = null;
  private pendingSuper = false;
  private pendingBoat = false;
  private pendingAbility: { ability: Ability; target: Vec2 } | null = null;
  private readonly leftVisual: { base: HTMLElement; knob: HTMLElement };
  private readonly rightVisual: { base: HTMLElement; knob: HTMLElement };

  constructor(
    private readonly surface: HTMLElement,
    private readonly rig: CameraRig,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.leftVisual = stickElements(surface, "move");
    this.rightVisual = stickElements(surface, "aim");
    surface.addEventListener("pointerdown", (e) => this.onDown(e));
    surface.addEventListener("pointermove", (e) => this.onMove(e));
    surface.addEventListener("pointerup", (e) => this.onUp(e));
    surface.addEventListener("pointercancel", (e) => this.onUp(e, true));
    surface.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
    window.addEventListener("blur", () => this.reset());
  }

  setMode(mode: ControlMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.reset();
    this.surface.dataset.mode = mode;
    const visible = mode === "hero" ? "block" : "none";
    this.leftVisual.base.style.display = visible;
    this.rightVisual.base.style.display = visible;
  }

  /** Moves and sizes the sticks from the settings. */
  setLayout(layout: ControlLayout): void {
    this.layout = layout;
    const place = (visual: { base: HTMLElement }, spot: ControlLayout["move"]) => {
      visual.base.style.setProperty("--home-x", `${spot.x * 100}%`);
      visual.base.style.setProperty("--home-y", `${spot.y * 100}%`);
      visual.base.style.setProperty("--size", String(spot.size));
    };
    place(this.leftVisual, layout.move);
    place(this.rightVisual, layout.aim);
  }

  pressSuper(): void {
    this.pendingSuper = true;
  }

  pressBoat(): void {
    this.pendingBoat = true;
  }

  selectAbility(ability: Ability): void {
    this.selectedAbility = ability;
  }

  /** Where the player is aiming right now (dragging), as a stick vector; null if not. */
  aimPreview(): Vec2 | null {
    if (this.mode !== "hero") return null;
    const radius = this.stickRadius(this.layout.aim.size);
    if (this.right && Math.hypot(this.right.dx, this.right.dy) > AIM_DEADZONE)
      return clampLength(vec(this.right.dx / radius, this.right.dy / radius), 1);
    if (this.mouse.down && this.lastHero) return this.mouseAim(this.lastHero);
    return null;
  }

  private mouseAim(heroPos: Vec2): Vec2 | null {
    if (
      Math.hypot(this.mouse.x - this.mouse.startX, this.mouse.y - this.mouse.startY) < TAP_DISTANCE
    )
      return null;
    const target = this.rig.groundPoint(
      this.mouse.x,
      this.mouse.y,
      this.canvas.getBoundingClientRect(),
    );
    if (!target) return null;
    const d = sub(target, heroPos);
    return length(d) > 0.01 ? normalize(d) : null;
  }

  /** Builds this frame's input for the hero, then clears one-shot presses. */
  read(heroPos: Vec2 | null): HeroInput {
    this.lastHero = heroPos;
    let move = vec(0, 0);
    const radius = this.stickRadius(this.layout.move.size);
    if (this.left) move = clampLength(vec(this.left.dx / radius, this.left.dy / radius), 1);
    else move = this.keyboardMove();

    const input: HeroInput = {
      move,
      aim: null,
      aimPreview: this.aimPreview(),
      lockAt: this.pendingLock,
      autoAim: this.pendingAutoAim,
      useSuper: this.pendingSuper,
      toggleBoat: this.pendingBoat,
      boatAbility: this.pendingAbility,
    };
    this.pendingAutoAim = false;
    this.pendingLock = null;
    this.pendingSuper = false;
    this.pendingBoat = false;
    this.pendingAbility = null;
    return input;
  }

  /** How far the thumb travels for a full push, in screen pixels. */
  private stickRadius(size: number): number {
    return BASE_STICK_RADIUS * this.uiScale * size;
  }

  private keyboardMove(): Vec2 {
    const k = this.keys;
    const x =
      (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    const y = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
    const v = vec(x, y);
    return length(v) > 0 ? normalize(v) : v;
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const key = e.key.toLowerCase();
    if (down) {
      if (this.keys.has(key)) return;
      this.keys.add(key);
      if (this.mode === "off") return;
      if (key === " ") this.pendingSuper = true;
      if (key === "e") this.pendingBoat = true;
      if (key === "q" || key === "f") this.pendingAutoAim = true;
      const index = ["1", "2", "3"].indexOf(key);
      const ability = ABILITY_ORDER[index];
      if (ability) this.selectedAbility = ability;
    } else {
      this.keys.delete(key);
    }
  }

  private onDown(e: PointerEvent): void {
    if (this.mode === "off") return;
    this.surface.setPointerCapture(e.pointerId);
    if (this.mode === "boat") {
      this.pan ??= {
        pointerId: e.pointerId,
        lastX: e.clientX,
        lastY: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        startTime: performance.now(),
      };
      return;
    }
    if (e.pointerType === "mouse") {
      this.mouse = {
        x: e.clientX,
        y: e.clientY,
        down: true,
        startX: e.clientX,
        startY: e.clientY,
        startTime: performance.now(),
      };
      return;
    }
    // Each thumb takes the stick whose resting spot is nearer, wherever they've been moved to.
    const rect = this.surface.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const toMove = Math.abs(x - this.layout.move.x) <= Math.abs(x - this.layout.aim.x);
    if (toMove && !this.left) this.left = this.startStick(e, this.leftVisual);
    else if (!toMove && !this.right) this.right = this.startStick(e, this.rightVisual);
  }

  private startStick(e: PointerEvent, visual: { base: HTMLElement; knob: HTMLElement }): Stick {
    const rect = this.surface.getBoundingClientRect();
    visual.base.classList.remove("home");
    visual.base.classList.add("active");
    visual.base.style.left = `${e.clientX - rect.left}px`;
    visual.base.style.top = `${e.clientY - rect.top}px`;
    visual.knob.style.transform = "translate(-50%, -50%)";
    return {
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      dx: 0,
      dy: 0,
      startTime: performance.now(),
      ...visual,
    };
  }

  private onMove(e: PointerEvent): void {
    if (this.pan && e.pointerId === this.pan.pointerId) {
      this.rig.pan(e.clientX - this.pan.lastX, e.clientY - this.pan.lastY);
      this.pan.lastX = e.clientX;
      this.pan.lastY = e.clientY;
      return;
    }
    if (e.pointerType === "mouse") {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      return;
    }
    for (const stick of [this.left, this.right]) {
      if (!stick || stick.pointerId !== e.pointerId) continue;
      const size = stick === this.left ? this.layout.move.size : this.layout.aim.size;
      const d = clampLength(
        vec(e.clientX - stick.originX, e.clientY - stick.originY),
        this.stickRadius(size),
      );
      stick.dx = d.x;
      stick.dy = d.y;
      // The knob moves inside the scaled stick, so undo the scale for its offset.
      const k = 1 / (this.uiScale * size);
      stick.knob.style.transform = `translate(calc(-50% + ${d.x * k}px), calc(-50% + ${d.y * k}px))`;
    }
  }

  private onUp(e: PointerEvent, cancelled = false): void {
    if (this.pan && e.pointerId === this.pan.pointerId) {
      const quick = performance.now() - this.pan.startTime < TAP_MS * 1.5;
      const still =
        Math.hypot(e.clientX - this.pan.startX, e.clientY - this.pan.startY) < TAP_DISTANCE;
      if (!cancelled && quick && still) {
        const target = this.rig.groundPoint(
          e.clientX,
          e.clientY,
          this.canvas.getBoundingClientRect(),
        );
        if (target) this.pendingAbility = { ability: this.selectedAbility, target };
      }
      this.pan = null;
      return;
    }
    if (e.pointerType === "mouse") {
      if (this.mouse.down && !cancelled) {
        const aim = this.lastHero ? this.mouseAim(this.lastHero) : null;
        if (aim) this.pendingLock = aim;
        else if (performance.now() - this.mouse.startTime < TAP_MS * 2) this.pendingAutoAim = true;
      }
      this.mouse.down = false;
      return;
    }
    if (this.left?.pointerId === e.pointerId) {
      this.goHome(this.left);
      this.left = null;
    }
    if (this.right?.pointerId === e.pointerId) {
      const quick = performance.now() - this.right.startTime < TAP_MS;
      const dragged = Math.hypot(this.right.dx, this.right.dy);
      const radius = this.stickRadius(this.layout.aim.size);
      if (!cancelled && dragged > AIM_DEADZONE)
        this.pendingLock = clampLength(vec(this.right.dx / radius, this.right.dy / radius), 1);
      else if (!cancelled && quick && dragged < TAP_DISTANCE) this.pendingAutoAim = true;
      this.goHome(this.right);
      this.right = null;
    }
  }

  /** Sends a stick back to its resting spot in the corner. */
  private goHome(visual: { base: HTMLElement; knob: HTMLElement }): void {
    visual.base.classList.add("home");
    visual.base.classList.remove("active");
    visual.base.style.left = "";
    visual.base.style.top = "";
    visual.knob.style.transform = "translate(-50%, -50%)";
  }

  private reset(): void {
    this.left = null;
    this.right = null;
    this.pan = null;
    this.mouse.down = false;
    this.goHome(this.leftVisual);
    this.goHome(this.rightVisual);
  }
}
