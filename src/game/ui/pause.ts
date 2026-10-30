// The pause menu: resume, settings, and (in a raid) retreat. Settings has sliders for the raid
// camera's tilt and zoom and the size of the whole UI, sound, and the controls editor; changes
// apply as you drag.

import { DEFAULT_SETTINGS, type Settings, TILT_RANGE, UI_SCALE_RANGE } from "../save";
import { spotText } from "./controlsEditor";
import { button, el, panel, setLabel } from "./kit/dom";
import { sfx } from "./kit/fx";
import { type IconName, icon } from "./kit/icons";

export interface PauseHandlers {
  onResume(): void;
  onRetreat(): void;
  settings(): Settings;
  onSettings(settings: Settings): void;
  onEditControls(): void;
}

interface Slider {
  input: HTMLInputElement;
  value: HTMLElement;
}

export class PauseMenu {
  readonly root = el("div", "screen screen-pause");
  private readonly main: HTMLElement;
  private readonly options: HTMLElement;
  private readonly retreat: HTMLButtonElement;
  private readonly title: HTMLElement;
  private readonly sound: HTMLButtonElement;
  /** Every value in one place, easy to read off and pass on. */
  private readonly summary = el("div", "pause-summary");
  private inRaid = true;
  private readonly sliders: Record<"tilt" | "zoom" | "uiScale", Slider>;

  constructor(
    parent: HTMLElement,
    private readonly handlers: PauseHandlers,
  ) {
    const box = panel("Paused", "pause-panel");
    this.title = box.root.querySelector(".ui-plate-text") ?? el("span");

    // Main page.
    this.main = el("div", "pause-page");
    this.retreat = button({
      label: "Retreat",
      icon: "close",
      variant: "red",
      size: "md",
      onClick: () => handlers.onRetreat(),
    });
    this.main.append(
      button({
        label: "Resume",
        icon: "play",
        variant: "blue",
        size: "lg",
        onClick: () => handlers.onResume(),
      }),
      button({
        label: "Settings",
        icon: "gear",
        variant: "steel",
        size: "md",
        onClick: () => this.page("options"),
      }),
      this.retreat,
    );

    // Settings page.
    this.options = el("div", "pause-page pause-options");
    this.sliders = {
      // Exact values, so the player can read them off and pass them on as new defaults.
      tilt: this.slider("Camera tilt", "map", TILT_RANGE[0], TILT_RANGE[1], (v) => v.toFixed(2)),
      zoom: this.slider("Camera zoom", "crosshair", 0, 1, (v) => v.toFixed(2)),
      uiScale: this.slider("UI size", "star", UI_SCALE_RANGE[0], UI_SCALE_RANGE[1], (v) =>
        v.toFixed(2),
      ),
    };
    this.sound = button({ label: "Sound on", icon: "gear", variant: "steel", size: "sm" });
    this.sound.addEventListener("click", () => {
      const next = { ...handlers.settings(), muted: !handlers.settings().muted };
      handlers.onSettings(next);
      this.refresh();
    });
    const row = el("div", "pause-row");
    row.append(
      this.sound,
      button({
        label: "Reset",
        icon: "rotate",
        variant: "steel",
        size: "sm",
        onClick: () => {
          const { muted, controls } = handlers.settings();
          handlers.onSettings({ ...DEFAULT_SETTINGS, muted, controls });
          this.refresh();
        },
      }),
      button({
        label: "Controls",
        icon: "crosshair",
        variant: "blue",
        size: "sm",
        onClick: () => handlers.onEditControls(),
      }),
      button({
        label: "Done",
        icon: "check",
        variant: "green",
        size: "sm",
        onClick: () => this.page("main"),
      }),
    );
    this.options.append(
      this.sliders.tilt.input.closest(".pause-slider") ?? el("div"),
      this.sliders.zoom.input.closest(".pause-slider") ?? el("div"),
      this.sliders.uiScale.input.closest(".pause-slider") ?? el("div"),
      this.summary,
      row,
    );

    box.body.append(this.main, this.options);
    this.root.append(box.root);
    this.root.style.display = "none";
    parent.append(this.root);
  }

  /** Opens or closes the menu. Outside a raid there's nothing to retreat from. */
  show(on: boolean, inRaid = true): void {
    this.root.style.display = on ? "flex" : "none";
    this.inRaid = inRaid;
    this.retreat.style.display = inRaid ? "" : "none";
    if (on) {
      this.page("main");
      this.refresh();
    }
  }

  /** Reopens straight on the settings page, coming back from the controls editor. */
  showSettings(): void {
    this.show(true, this.inRaid);
    this.page("options");
  }

  private page(which: "main" | "options"): void {
    this.main.style.display = which === "main" ? "" : "none";
    this.options.style.display = which === "options" ? "" : "none";
    this.title.textContent = which === "main" ? "Paused" : "Settings";
  }

  private refresh(): void {
    const s = this.handlers.settings();
    for (const key of ["tilt", "zoom", "uiScale"] as const) {
      const slider = this.sliders[key];
      slider.input.value = String(s[key]);
      slider.input.dispatchEvent(new Event("refresh"));
    }
    setLabel(this.sound, s.muted ? "Sound off" : "Sound on");
    this.paintSummary();
  }

  private paintSummary(): void {
    const s = this.handlers.settings();
    this.summary.replaceChildren(
      el(
        "div",
        "",
        `tilt ${s.tilt.toFixed(2)} · zoom ${s.zoom.toFixed(2)} · ui ${s.uiScale.toFixed(2)}`,
      ),
      el("div", "", spotText("Move", s.controls.move)),
      el("div", "", spotText("Fire", s.controls.aim)),
      el("div", "", spotText("Super", s.controls.super)),
    );
  }

  private slider(
    label: string,
    iconName: IconName,
    min: number,
    max: number,
    format: (v: number) => string,
  ): Slider {
    const wrap = el("label", "pause-slider");
    const head = el("div", "pause-slider-head");
    const value = el("span", "pause-slider-value");
    head.append(
      icon(iconName, "pause-slider-icon"),
      el("span", "pause-slider-label", label),
      value,
    );
    const input = el("input", "pause-slider-input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "0.01";
    input.setAttribute("aria-label", label);
    const paint = () => {
      const v = Number(input.value);
      value.textContent = format(v);
      input.style.setProperty("--fill", `${((v - min) / (max - min)) * 100}%`);
    };
    input.addEventListener("refresh", paint);
    input.addEventListener("input", () => {
      paint();
      const key = label === "Camera tilt" ? "tilt" : label === "Camera zoom" ? "zoom" : "uiScale";
      this.handlers.onSettings({ ...this.handlers.settings(), [key]: Number(input.value) });
      this.paintSummary();
    });
    input.addEventListener("change", () => sfx.tick());
    wrap.append(head, input);
    return { input, value };
  }
}
