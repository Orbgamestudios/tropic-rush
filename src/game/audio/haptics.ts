// The phone's vibration motor. Android has a Vibration API. iPhones have none: the one way in is
// Safari's native switch control, which gives a little tap when it flips. Clicking one from code
// works up to iOS 26.4, so game events like blasts use that; from iOS 26.5 only a real finger on
// it counts, so every button also carries a see-through label that passes the tap on to a hidden
// switch. On those iPhones buttons still buzz, and blasts simply don't.

export type Strength = "light" | "medium" | "heavy";

const SWITCH_ID = "haptic-switch";
/** How many taps in a row make each strength on an iPhone, which has only the one. */
const TAPS: Record<Strength, number> = { light: 1, medium: 2, heavy: 3 };
const VIBRATE_MS: Record<Strength, number> = { light: 8, medium: 18, heavy: 40 };
const TAP_GAP_MS = 45;
/** Haptics no sooner than this after the last, or they blur into a buzz and drain the battery. */
const MIN_GAP_MS = 90;

const onIPhone =
  typeof navigator !== "undefined" &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

let enabled = true;
let last = 0;
let label: HTMLLabelElement | null = null;

/** The hidden switch everything taps through. */
function hiddenSwitch(): HTMLLabelElement {
  if (label) return label;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = SWITCH_ID;
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.className = "haptic-switch";
  label = document.createElement("label");
  label.htmlFor = SWITCH_ID;
  label.className = "haptic-switch";
  document.body.append(input, label);
  return label;
}

export function setHaptics(on: boolean): void {
  enabled = on;
}

/** A tap of the motor, where the phone lets a game do that without a finger on the switch. */
export function haptic(strength: Strength): void {
  if (!enabled) return;
  const now = performance.now();
  if (now - last < MIN_GAP_MS) return;
  last = now;
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(VIBRATE_MS[strength]);
    return;
  }
  if (!onIPhone) return;
  const target = hiddenSwitch();
  for (let i = 0; i < TAPS[strength]; i++) setTimeout(() => target.click(), i * TAP_GAP_MS);
}

/** Makes a real tap on this control buzz, on any iPhone new enough to have the switch. */
export function hapticOnTap(control: HTMLElement): void {
  if (!onIPhone) return;
  hiddenSwitch();
  const cover = document.createElement("label");
  cover.htmlFor = SWITCH_ID;
  cover.className = "haptic-cover";
  // Taken off while they're switched off, so nothing is left in the way of the control.
  cover.addEventListener("click", (e) => {
    if (!enabled) e.preventDefault();
  });
  control.append(cover);
}
