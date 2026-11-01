// The controls editor, opened from Settings: the sticks shown as rings on
// the screen. Drag one to move it, pick one and use the slider to resize it. A readout shows each
// control's x, y and size, so the player can pass the numbers on to become the defaults.

import { CONTROL_SIZE_RANGE, type ControlName, DEFAULT_CONTROLS, type Settings } from "../save";
import { button, el, panel } from "./kit/dom";
import { sfx } from "./kit/fx";

export interface ControlsEditorHost {
  settings(): Settings;
  onSettings(settings: Settings): void;
  onClose(): void;
}

const NAMES: readonly ControlName[] = ["move", "aim"];

const LABELS: Record<ControlName, string> = { move: "Move", aim: "Fire" };

/** Diameters at size 1 and UI size 1, matching the real controls. */
const DIAMETER: Record<ControlName, number> = { move: 132, aim: 132 };

const round = (v: number) => Math.round(v * 1000) / 1000;

export class ControlsEditor {
  readonly root = el("div", "controls-editor");
  private readonly handles = new Map<ControlName, HTMLElement>();
  private readonly size = el("input", "pause-slider-input");
  private readonly sizeLabel = el("span", "pause-slider-label");
  private readonly sizeValue = el("span", "pause-slider-value");
  private readonly readout = el("div", "controls-readout");
  private selected: ControlName = "move";
  private dragging: { name: ControlName; pointerId: number } | null = null;

  constructor(
    parent: HTMLElement,
    private readonly host: ControlsEditorHost,
  ) {
    for (const name of NAMES) {
      const handle = el("div", "controls-handle");
      handle.setAttribute("aria-label", LABELS[name]);
      handle.append(el("span", "controls-handle-label", LABELS[name]));
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        this.dragging = { name, pointerId: e.pointerId };
        this.select(name);
        sfx.tick();
      });
      handle.addEventListener("pointermove", (e) => this.onDrag(e));
      const stop = () => {
        this.dragging = null;
      };
      handle.addEventListener("pointerup", stop);
      handle.addEventListener("pointercancel", stop);
      this.root.append(handle);
      this.handles.set(name, handle);
    }

    this.size.type = "range";
    this.size.min = String(CONTROL_SIZE_RANGE[0]);
    this.size.max = String(CONTROL_SIZE_RANGE[1]);
    this.size.step = "0.01";
    this.size.setAttribute("aria-label", "Control size");
    this.size.addEventListener("input", () => {
      this.change(this.selected, { size: Number(this.size.value) });
    });
    const sizeHead = el("div", "pause-slider-head");
    sizeHead.append(this.sizeLabel, this.sizeValue);
    const slider = el("label", "pause-slider");
    slider.append(sizeHead, this.size);

    const box = panel("Move controls", "controls-panel");
    const buttons = el("div", "pause-row");
    buttons.append(
      button({
        label: "Reset",
        icon: "rotate",
        variant: "steel",
        size: "sm",
        onClick: () => this.write(structuredClone(DEFAULT_CONTROLS)),
      }),
      button({
        label: "Done",
        icon: "check",
        variant: "green",
        size: "sm",
        onClick: () => {
          this.show(false);
          host.onClose();
        },
      }),
    );
    box.body.append(slider, this.readout, buttons);
    box.root.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.root.append(box.root);
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(on: boolean): void {
    this.root.style.display = on ? "block" : "none";
    if (on) this.select(this.selected);
  }

  private select(name: ControlName): void {
    this.selected = name;
    for (const [n, handle] of this.handles) handle.classList.toggle("selected", n === name);
    this.paint();
  }

  private onDrag(e: PointerEvent): void {
    if (e.pointerId !== this.dragging?.pointerId) return;
    const rect = this.root.getBoundingClientRect();
    this.change(this.dragging.name, {
      x: round(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))),
      y: round(Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))),
    });
  }

  private change(name: ControlName, changes: Partial<Settings["controls"]["move"]>): void {
    const { controls } = this.host.settings();
    this.write({ ...controls, [name]: { ...controls[name], ...changes } });
  }

  private write(controls: Settings["controls"]): void {
    this.host.onSettings({ ...this.host.settings(), controls });
    this.paint();
  }

  private paint(): void {
    const { controls, uiScale } = this.host.settings();
    for (const [name, handle] of this.handles) {
      const spot = controls[name];
      const diameter = DIAMETER[name] * uiScale * spot.size;
      handle.style.left = `${spot.x * 100}%`;
      handle.style.top = `${spot.y * 100}%`;
      handle.style.width = `${diameter}px`;
      handle.style.height = `${diameter}px`;
    }
    const spot = controls[this.selected];
    this.size.value = String(spot.size);
    const range = CONTROL_SIZE_RANGE[1] - CONTROL_SIZE_RANGE[0];
    this.size.style.setProperty(
      "--fill",
      `${((spot.size - CONTROL_SIZE_RANGE[0]) / range) * 100}%`,
    );
    this.sizeLabel.textContent = `${LABELS[this.selected]} size`;
    this.sizeValue.textContent = spot.size.toFixed(2);
    this.readout.replaceChildren(
      ...NAMES.map((name) => el("div", "", spotText(LABELS[name], controls[name]))),
    );
  }
}

/** One control's numbers, the way the player reads them back. */
export function spotText(label: string, spot: { x: number; y: number; size: number }): string {
  return `${label.toLowerCase()}: x ${spot.x.toFixed(3)}  y ${spot.y.toFixed(3)}  size ${spot.size.toFixed(2)}`;
}
