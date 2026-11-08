// Time crystals as the UI draws them: a faceted gem in the power's color with its sign on it,
// drawn rather than typed, so it looks the same on every phone.

import { TIME_POWER_SPECS, type TimePower } from "../../logic/timeShards";
import { el } from "./dom";

const SIGNS: Record<TimePower, string> = {
  slow: '<path d="M5 5 L14 12 L5 19 Z"/><rect x="16" y="5" width="3.4" height="14" rx="1"/>',
  pause:
    '<rect x="5.5" y="5" width="4.6" height="14" rx="1.2"/><rect x="13.9" y="5" width="4.6" height="14" rx="1.2"/>',
  fastForward: '<path d="M2.5 6 L11.5 12 L2.5 18 Z"/><path d="M12 6 L21 12 L12 18 Z"/>',
  record: '<circle cx="12" cy="12" r="6.5"/>',
  rewind: '<path d="M21.5 6 L12.5 12 L21.5 18 Z"/><path d="M12 6 L3 12 L12 18 Z"/>',
  retry: '<path d="M12 20.5 L4.6 13.2 A4.6 4.6 0 0 1 12 7.4 A4.6 4.6 0 0 1 19.4 13.2 Z"/>',
};

/** A power's sign, in white. */
export function timeSign(power: TimePower, className = ""): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", `time-sign ${className}`.trim());
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = SIGNS[power];
  return svg;
}

/** A time crystal: a gem in the power's color with its sign on it. */
export function timeGem(power: TimePower, className = ""): HTMLElement {
  const gem = el("span", `time-gem ${className}`.trim());
  gem.style.setProperty("--tint", TIME_POWER_SPECS[power].color);
  gem.append(timeSign(power));
  return gem;
}
