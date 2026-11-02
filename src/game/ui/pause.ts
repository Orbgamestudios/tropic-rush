// The pause menu: resume, settings, and (in a raid) retreat. Settings has sliders for the raid
// camera's tilt and zoom and the size of the whole UI, sound, and the controls editor; changes
// apply as you drag.

import { DEFAULT_SETTINGS, type Settings, TILT_RANGE, UI_SCALE_RANGE } from "../save";
import { button, closeOnBackdrop, confirmTap, el, panel, setLabel } from "./kit/dom";
import { sfx } from "./kit/fx";
import { type IconName, icon } from "./kit/icons";

export interface PauseHandlers {
  onResume(): void;
  onRetreat(): void;
  settings(): Settings;
  onSettings(settings: Settings): void;
  /** Today's sunrise and sunset, and whether they're for where the phone really is. */
  sky(): { times: string; here: boolean };
  /** Starts or stops using the phone's location for the sky. */
  onSkyLocation(): Promise<void>;
  onEditControls(): void;
  /** The signed-in username, if any. */
  username(): string | null;
  /** Checks the account's password; says what's wrong, or null if it's right. */
  checkPassword(password: string): Promise<string | null>;
  /** Wipes the player's progress and starts again. */
  onResetGame(): void;
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
  private readonly resetGame: HTMLButtonElement;
  private readonly reset: HTMLElement;
  private readonly resetText = el("p", "pause-reset-text");
  private readonly resetPassword = el("input", "crew-input");
  private readonly resetError = el("div", "crew-join-error");
  private readonly resetGo: HTMLButtonElement;
  /** Until the password's been checked, there's nothing to confirm. */
  private resetStep: "password" | "confirm" = "confirm";
  private readonly title: HTMLElement;
  private readonly sound: HTMLButtonElement;
  private readonly musicButton: HTMLButtonElement;
  private readonly hapticsButton: HTMLButtonElement;
  private readonly cameraMode: HTMLButtonElement;
  private readonly skyTimes = el("span", "pause-sky-times");
  private readonly skyButton: HTMLButtonElement;
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
    this.retreat = button({ label: "Retreat", icon: "close", variant: "red", size: "md" });
    confirmTap(this.retreat, "Tap again to retreat", () => handlers.onRetreat());
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
    this.resetGame = button({
      label: "Reset game",
      icon: "trash",
      variant: "red",
      size: "sm",
      onClick: () => this.startReset(),
    });
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
    this.musicButton = button({ label: "Music on", icon: "gear", variant: "steel", size: "sm" });
    this.musicButton.addEventListener("click", () => {
      const s = handlers.settings();
      handlers.onSettings({ ...s, musicMuted: !s.musicMuted });
      this.refresh();
    });
    this.hapticsButton = button({
      label: "Vibration on",
      icon: "gear",
      variant: "steel",
      size: "sm",
    });
    this.hapticsButton.addEventListener("click", () => {
      const s = handlers.settings();
      handlers.onSettings({ ...s, haptics: !s.haptics });
      this.refresh();
    });
    this.cameraMode = button({ label: "Camera: top", icon: "map", variant: "steel", size: "sm" });
    this.cameraMode.addEventListener("click", () => {
      const s = handlers.settings();
      handlers.onSettings({ ...s, camera: s.camera === "top" ? "behind" : "top" });
      this.refresh();
    });
    const buttons = el("div", "pause-buttons");
    buttons.append(
      this.cameraMode,
      this.sound,
      this.musicButton,
      this.hapticsButton,
      button({
        label: "Defaults",
        icon: "rotate",
        variant: "steel",
        size: "sm",
        onClick: () => {
          const { muted, musicMuted, haptics, controls, camera } = handlers.settings();
          handlers.onSettings({
            ...DEFAULT_SETTINGS,
            muted,
            musicMuted,
            haptics,
            controls,
            camera,
          });
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
      this.resetGame,
      button({
        label: "Done",
        icon: "check",
        variant: "green",
        size: "sm",
        onClick: () => this.page("main"),
      }),
    );
    this.skyButton = button({
      label: "Use my location",
      icon: "map",
      variant: "steel",
      size: "sm",
    });
    this.skyButton.addEventListener("click", () => {
      void handlers.onSkyLocation().then(() => this.refresh());
    });
    const sky = el("div", "pause-sky");
    sky.append(this.skyTimes, this.skyButton);
    const sliders = el("div", "pause-sliders");
    sliders.append(
      this.sliders.tilt.input.closest(".pause-slider") ?? el("div"),
      this.sliders.zoom.input.closest(".pause-slider") ?? el("div"),
      this.sliders.uiScale.input.closest(".pause-slider") ?? el("div"),
      sky,
    );
    this.options.append(sliders, buttons);

    // Resetting: the account's password if there is one, then one last chance to back out.
    this.reset = el("div", "pause-page pause-reset");
    this.resetPassword.type = "password";
    this.resetPassword.placeholder = "Password";
    this.resetPassword.setAttribute("aria-label", "Password");
    this.resetPassword.autocomplete = "current-password";
    this.resetGo = button({
      label: "Continue",
      variant: "red",
      size: "md",
      onClick: () => void this.resetNext(),
    });
    this.reset.append(
      this.resetText,
      this.resetPassword,
      this.resetError,
      this.resetGo,
      button({
        label: "Cancel",
        variant: "steel",
        size: "md",
        onClick: () => this.page("options"),
      }),
    );

    box.body.append(this.main, this.options, this.reset);
    this.root.append(box.root);
    this.root.style.display = "none";
    closeOnBackdrop(this.root, () => handlers.onResume());
    parent.append(this.root);
  }

  /** Opens or closes the menu. Outside a raid there's nothing to retreat from. */
  show(on: boolean, inRaid = true): void {
    this.root.style.display = on ? "flex" : "none";
    this.inRaid = inRaid;
    this.retreat.style.display = inRaid ? "" : "none";
    this.resetGame.style.display = inRaid ? "none" : "";
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

  private page(which: "main" | "options" | "reset"): void {
    this.main.style.display = which === "main" ? "" : "none";
    this.options.style.display = which === "options" ? "" : "none";
    this.reset.style.display = which === "reset" ? "" : "none";
    this.title.textContent = {
      main: "Paused",
      options: "Settings",
      reset: this.resetName(),
    }[which];
  }

  private resetName(): string {
    return this.handlers.username() ? "Reset account" : "Reset game";
  }

  private startReset(): void {
    const name = this.handlers.username();
    this.resetStep = name ? "password" : "confirm";
    this.resetPassword.value = "";
    this.resetError.textContent = "";
    this.showResetStep(name);
    this.page("reset");
  }

  private showResetStep(name: string | null): void {
    const asking = this.resetStep === "password";
    this.resetPassword.style.display = asking ? "" : "none";
    this.resetText.textContent = asking
      ? `Enter the password for ${name} to reset your account.`
      : "This erases all your progress for good, and takes you out of your crew. Are you sure?";
    setLabel(this.resetGo, asking ? "Continue" : "Erase everything");
  }

  private async resetNext(): Promise<void> {
    if (this.resetStep === "confirm") {
      this.handlers.onResetGame();
      return;
    }
    const problem = await this.handlers.checkPassword(this.resetPassword.value);
    this.resetError.textContent = problem ?? "";
    if (problem) {
      sfx.error();
      return;
    }
    this.resetStep = "confirm";
    this.showResetStep(null);
  }

  private refresh(): void {
    const s = this.handlers.settings();
    for (const key of ["tilt", "zoom", "uiScale"] as const) {
      const slider = this.sliders[key];
      slider.input.value = String(s[key]);
      slider.input.dispatchEvent(new Event("refresh"));
    }
    setLabel(this.resetGame, this.resetName());
    setLabel(this.sound, s.muted ? "Sound off" : "Sound on");
    setLabel(this.musicButton, s.musicMuted ? "Music off" : "Music on");
    setLabel(this.hapticsButton, s.haptics ? "Vibration on" : "Vibration off");
    setLabel(this.cameraMode, s.camera === "top" ? "Camera: top" : "Camera: behind");
    const { times, here } = this.handlers.sky();
    this.skyTimes.textContent = times;
    setLabel(this.skyButton, here ? "Use time zone" : "Use my location");
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
    });
    input.addEventListener("change", () => sfx.tick());
    wrap.append(head, input);
    return { input, value };
  }
}
