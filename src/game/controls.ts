// Turns touches, mouse and keyboard into HeroInput for the rules.
// Phone: left thumb moves, right thumb aims and fires (hold to keep firing, quick tap to
// auto-aim at the nearest building). Both sticks rest in their corners and jump to wherever the
// thumb lands on that half of the screen, then spring back home. In the gunboat: drag to look
// around, tap the island to fire the selected ability.
// Computer: WASD/arrows move, hold the mouse to aim and fire, Space super, E gunboat, 1-3 abilities.

import type { Ability } from "./logic/gunboat";
import { ABILITY_ORDER } from "./logic/gunboat";
import type { HeroInput } from "./logic/raid";
import { clampLength, length, normalize, scale, sub, type Vec2, vec } from "./logic/vec";
import type { CameraRig } from "./render/cameraRig";
import { iconSvg } from "./ui/kit/icons";

export type ControlMode = "off" | "hero" | "boat";

const STICK_RADIUS = 58;
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
    // Four little arrows round the ring, a "MOVE" label and a curved hint arrow.
    for (const dir of ["up", "right", "down", "left"]) {
      const arrow = document.createElement("span");
      arrow.className = `stick-arrow stick-arrow-${dir}`;
      base.append(arrow);
    }
    const label = document.createElement("div");
    label.className = "stick-label";
    label.innerHTML = `<span>MOVE</span><svg viewBox="0 0 60 40" aria-hidden="true"><path d="M4 8c22-6 42 2 50 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M46 30l9 4 2-10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    base.append(label);
  } else {
    knob.innerHTML = iconSvg("crosshair");
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
  private mode: ControlMode = "off";
  private left: Stick | null = null;
  private right: Stick | null = null;
  private pan: Pan | null = null;
  private readonly keys = new Set<string>();
  private mouse: { x: number; y: number; down: boolean } = { x: 0, y: 0, down: false };
  private pendingAutoAim = false;
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

  pressSuper(): void {
    this.pendingSuper = true;
  }

  pressBoat(): void {
    this.pendingBoat = true;
  }

  selectAbility(ability: Ability): void {
    this.selectedAbility = ability;
  }

  /** Builds this frame's input for the hero, then clears one-shot presses. */
  read(heroPos: Vec2 | null, range: number): HeroInput {
    let move = vec(0, 0);
    if (this.left)
      move = clampLength(vec(this.left.dx / STICK_RADIUS, this.left.dy / STICK_RADIUS), 1);
    else move = this.keyboardMove();

    let aim: Vec2 | null = null;
    if (this.right && Math.hypot(this.right.dx, this.right.dy) > AIM_DEADZONE) {
      aim = clampLength(vec(this.right.dx / STICK_RADIUS, this.right.dy / STICK_RADIUS), 1);
    } else if (this.mouse.down && heroPos && this.mode === "hero") {
      const target = this.rig.groundPoint(
        this.mouse.x,
        this.mouse.y,
        this.canvas.getBoundingClientRect(),
      );
      if (target) aim = clampLength(scale(sub(target, heroPos), 1 / range), 1);
    }

    const input: HeroInput = {
      move,
      aim,
      autoAim: this.pendingAutoAim,
      useSuper: this.pendingSuper,
      toggleBoat: this.pendingBoat,
      boatAbility: this.pendingAbility,
    };
    this.pendingAutoAim = false;
    this.pendingSuper = false;
    this.pendingBoat = false;
    this.pendingAbility = null;
    return input;
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
      this.mouse = { x: e.clientX, y: e.clientY, down: true };
      return;
    }
    const leftSide = e.clientX < window.innerWidth * 0.5;
    if (leftSide && !this.left) this.left = this.startStick(e, this.leftVisual);
    else if (!leftSide && !this.right) this.right = this.startStick(e, this.rightVisual);
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
      const d = clampLength(
        vec(e.clientX - stick.originX, e.clientY - stick.originY),
        STICK_RADIUS,
      );
      stick.dx = d.x;
      stick.dy = d.y;
      stick.knob.style.transform = `translate(calc(-50% + ${d.x}px), calc(-50% + ${d.y}px))`;
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
      this.mouse.down = false;
      return;
    }
    if (this.left?.pointerId === e.pointerId) {
      this.goHome(this.left);
      this.left = null;
    }
    if (this.right?.pointerId === e.pointerId) {
      const quick = performance.now() - this.right.startTime < TAP_MS;
      if (!cancelled && quick && Math.hypot(this.right.dx, this.right.dy) < TAP_DISTANCE)
        this.pendingAutoAim = true;
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
