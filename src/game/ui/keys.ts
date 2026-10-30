// Raised, glossy game buttons ("keys"): a beveled face with an inset panel on a thick base that
// sinks in when pressed. Each shows an icon with its word on top.

export type KeyVariant = "blue" | "gold" | "red";

export interface KeyOptions {
  variant?: KeyVariant;
  /** A round button instead of a rounded rectangle. */
  round?: boolean;
  /** Smaller, with the icon beside the word (for tabs and compact rows). */
  inline?: boolean;
  className?: string;
}

/** A key button; `label` is its visible word and its accessible name. */
export function key(label: string, icon: string, options: KeyOptions = {}): HTMLButtonElement {
  const button = document.createElement("button");
  const classes = ["key", `key-${options.variant ?? "blue"}`];
  if (options.round) classes.push("key-round");
  if (options.inline) classes.push("key-inline");
  if (options.className) classes.push(options.className);
  button.className = classes.join(" ");
  button.setAttribute("aria-label", label);
  const iconSpan = document.createElement("span");
  iconSpan.className = "key-icon";
  iconSpan.textContent = icon;
  iconSpan.setAttribute("aria-hidden", "true");
  const word = document.createElement("span");
  word.className = "key-label";
  word.textContent = label;
  button.append(iconSpan, word);
  return button;
}

/** Changes a key's word (and accessible name) after it's made. */
export function setKeyLabel(button: HTMLButtonElement, label: string, icon?: string): void {
  button.setAttribute("aria-label", label);
  const word = button.querySelector(".key-label");
  if (word) word.textContent = label;
  const iconSpan = button.querySelector(".key-icon");
  if (icon !== undefined && iconSpan) iconSpan.textContent = icon;
}
