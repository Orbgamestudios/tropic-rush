// The game's UI building blocks: chunky beveled buttons, steel panels with header plates,
// currency pills, stat bars and portrait tiles. Styles live in src/styles/kit.css (".ui-*").

import { hapticOnTap } from "../../audio/haptics";
import { sfx } from "./fx";
import { type IconName, icon } from "./icons";

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export type ButtonVariant = "blue" | "steel" | "gold" | "green" | "red";

export interface ButtonOptions {
  label?: string;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg" | "xl";
  /** A round button: the icon fills it and the label sits underneath. */
  round?: boolean;
  /** Accessible name when it differs from the label (or there is none). */
  aria?: string;
  className?: string;
  onClick?: () => void;
}

/** A raised, glossy button that sinks when pressed and plays a click. */
export function button(options: ButtonOptions): HTMLButtonElement {
  const b = el(
    "button",
    [
      "ui-btn",
      `ui-btn-${options.variant ?? "blue"}`,
      `ui-btn-${options.size ?? "md"}`,
      options.round ? "ui-btn-round" : "",
      options.className ?? "",
    ]
      .filter(Boolean)
      .join(" "),
  );
  const face = el("span", "ui-btn-face");
  if (options.icon) face.append(icon(options.icon, "ui-btn-icon"));
  if (options.label) face.append(el("span", "ui-btn-label", options.label));
  b.append(face);
  b.setAttribute("aria-label", options.aria ?? options.label ?? options.icon ?? "");
  hapticOnTap(b);
  b.addEventListener("pointerdown", () => {
    if (!b.disabled) sfx.press();
  });
  if (options.onClick) {
    const handler = options.onClick;
    b.addEventListener("click", () => handler());
  }
  return b;
}

/**
 * A way to turn fractions of the whole screen into a layer's own pixels. The UI layers sit inside
 * the safe area and are scaled by the UI size setting, so neither matches the 3D view's pixels.
 * Measures the page, so make one per update rather than one per item.
 */
export function layerPlacer(
  layer: HTMLElement,
): (x: number, y: number) => { x: number; y: number } {
  const box = layer.getBoundingClientRect();
  const page = layer.closest("#game")?.getBoundingClientRect() ?? box;
  const scale = box.width / (layer.clientWidth || 1) || 1;
  return (x, y) => ({
    x: (page.left + x * page.width - box.left) / scale,
    y: (page.top + y * page.height - box.top) / scale,
  });
}

/** Calls `close` when a press lands on the overlay's dimmed background, not on what's on it. */
export function closeOnBackdrop(overlay: HTMLElement, close: () => void): void {
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) close();
  });
}

const CONFIRM_MS = 3000;

/** Makes a button ask again before doing something that can't be undone. */
export function confirmTap(b: HTMLButtonElement, question: string, action: () => void): void {
  const name = b.getAttribute("aria-label") ?? "";
  const hint = el("span", "ui-confirm", question);
  let waiting: ReturnType<typeof setTimeout> | null = null;
  const settle = () => {
    if (waiting) clearTimeout(waiting);
    waiting = null;
    hint.remove();
    b.setAttribute("aria-label", name);
  };
  b.addEventListener("click", () => {
    if (waiting) {
      settle();
      action();
      return;
    }
    b.append(hint);
    b.setAttribute("aria-label", question);
    waiting = setTimeout(settle, CONFIRM_MS);
  });
}

/** Changes a button's label (and accessible name). */
export function setLabel(b: HTMLButtonElement, label: string): void {
  const node = b.querySelector(".ui-btn-label");
  if (node) node.textContent = label;
  b.setAttribute("aria-label", label);
}

/** A steel-framed panel with an optional title plate across its top edge. */
export function panel(
  title?: string,
  className = "",
): { root: HTMLDivElement; body: HTMLDivElement } {
  const root = el("div", `ui-panel ${className}`.trim());
  if (title) root.append(plate(title));
  const body = el("div", "ui-panel-body");
  root.append(body);
  return { root, body };
}

/** A beveled steel name plate with outlined lettering. */
export function plate(text: string, className = ""): HTMLDivElement {
  const p = el("div", `ui-plate ${className}`.trim());
  p.append(el("span", "ui-plate-text", text));
  return p;
}

/** The angled "‹ BACK" tab used at the top-left of every screen. */
export function backButton(onClick: () => void, label = "Back"): HTMLButtonElement {
  const b = el("button", "ui-back");
  b.append(icon("back", "ui-back-icon"), el("span", "ui-back-label", label));
  b.setAttribute("aria-label", label);
  b.addEventListener("pointerdown", () => sfx.press());
  b.addEventListener("click", onClick);
  return b;
}

/** A dark pill showing an amount with its icon, which counts up or down smoothly. */
export class CurrencyPill {
  readonly root = el("div", "ui-pill");
  private readonly amount = el("span", "ui-pill-amount", "0");
  private shown = 0;
  private target = 0;
  private raf = 0;

  constructor(iconName: IconName, label: string) {
    this.root.append(this.amount, icon(iconName, "ui-pill-icon"));
    this.root.setAttribute("role", "status");
    this.root.setAttribute("aria-label", label);
  }

  set(value: number, animate = true): void {
    const next = Math.floor(value);
    if (next === this.target) return;
    const gained = next > this.target;
    this.target = next;
    if (!animate) {
      this.shown = next;
      this.render();
      return;
    }
    if (gained) {
      this.root.classList.remove("ui-pill-bump");
      void this.root.offsetWidth;
      this.root.classList.add("ui-pill-bump");
    }
    cancelAnimationFrame(this.raf);
    const from = this.shown;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      this.shown = Math.round(from + (this.target - from) * (1 - (1 - t) ** 3));
      this.render();
      if (t < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private render(): void {
    this.amount.textContent = formatNumber(this.shown);
  }
}

/** 10 000 style grouping, like the mockups. */
export function formatNumber(n: number): string {
  return Math.floor(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** An icon, a label and a glossy fill bar. */
export class StatBar {
  readonly root = el("div", "ui-stat");
  private readonly fill = el("div", "ui-stat-fill");
  private readonly ghost = el("div", "ui-stat-ghost");
  private readonly value = el("span", "ui-stat-value");
  private readonly label = el("span", "ui-stat-label");

  constructor(
    iconName: IconName,
    label: string,
    color: "green" | "orange" | "yellow" | "blue" | "red",
  ) {
    const head = el("div", "ui-stat-head");
    this.label.textContent = label;
    head.append(this.label, this.value);
    const track = el("div", `ui-stat-track ui-stat-${color}`);
    track.append(this.ghost, this.fill);
    const text = el("div", "ui-stat-text");
    text.append(head, track);
    this.root.append(icon(iconName, "ui-stat-icon"), text);
  }

  setLabel(text: string): void {
    if (this.label.textContent !== text) this.label.textContent = text;
  }

  /** `preview` shows a lighter bar for what the next level would bring. */
  set(fraction: number, value: string, preview = fraction): void {
    this.fill.style.width = `${(Math.max(0, Math.min(1, fraction)) * 100).toFixed(1)}%`;
    this.ghost.style.width = `${(Math.max(0, Math.min(1, preview)) * 100).toFixed(1)}%`;
    this.value.textContent = value;
  }
}

/** A square beveled portrait tile with an image, an optional level badge and a lock. */
export function portraitTile(
  label: string,
  imageUrl: string | null,
  options: { level?: number; locked?: string | null; selected?: boolean } = {},
): HTMLButtonElement {
  const b = el("button", "ui-tile");
  b.setAttribute("aria-label", label);
  const frame = el("span", "ui-tile-frame");
  const img = el("img", "ui-tile-img");
  img.alt = "";
  img.draggable = false;
  if (imageUrl) img.src = imageUrl;
  frame.append(img);
  b.append(frame);
  if (options.level) b.append(levelBadge(options.level));
  if (options.locked) {
    const lock = el("span", "ui-tile-lock");
    lock.append(icon("lock"), el("span", "ui-tile-lock-text", options.locked));
    b.append(lock);
    b.classList.add("locked");
  }
  b.classList.toggle("selected", !!options.selected);
  b.addEventListener("pointerdown", () => sfx.tick());
  return b;
}

/** A small gear-edged badge with a number, like the mockup's level badge. */
export function levelBadge(level: number, className = ""): HTMLSpanElement {
  const badge = el("span", `ui-level ${className}`.trim());
  badge.append(el("span", "ui-level-num", String(level)));
  return badge;
}

/** Turns "🪙 300  🪵 200"-style cost text into icon chips. */
export function costChips(text: string): HTMLElement {
  const row = el("span", "cost-row");
  const glyphs: Record<string, IconName> = {
    "🪙": "coin",
    "🪵": "timber",
    "🪨": "stone",
    "🔩": "scrap",
  };
  const parts = text.split(/\s{2,}/);
  for (const part of parts) {
    const [glyph, amount] = part.split(" ");
    const name = glyph ? glyphs[glyph] : undefined;
    if (name && amount) {
      const chip = el("span", "cost-chip");
      chip.append(icon(name, "cost-icon"), el("span", "cost-amount", amount));
      row.append(chip);
    } else {
      row.append(el("span", "cost-text", part));
    }
  }
  return row;
}
