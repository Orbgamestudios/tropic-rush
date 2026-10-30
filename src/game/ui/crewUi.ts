// HTML for the crew island: top bar (back, crew code, crewmates, status), the build bar,
// the selected-building panel, and the first-visit join panel.

import { BUILDINGS, type BuildingType } from "../logic/buildings";
import { FOOTPRINTS } from "../logic/crewIsland";
import type { ConnectionStatus } from "../net/crewClient";
import type { Member } from "../net/protocol";

export interface CrewUiHandlers {
  onBack(): void;
  onCreate(name: string): void;
  onJoin(name: string, code: string): void;
  onOffline(name: string): void;
  onChipDown(type: BuildingType, event: PointerEvent): void;
  onRotate(): void;
  onRemove(): void;
  onDone(): void;
}

/** Buildings offered in the build bar (the headquarters comes with every island). */
export const BUILD_MENU: readonly BuildingType[] = [
  "gunTurret",
  "mortar",
  "harpoon",
  "flamethrower",
  "watchtower",
  "goldMine",
  "lumberCamp",
  "quarry",
  "scrapYard",
  "storehouse",
  "refinery",
];

const STATUS_TEXT: Record<ConnectionStatus | "solo", string> = {
  connecting: "Connecting…",
  online: "Live with your crew",
  offline: "Offline: changes stay on this phone",
  full: "That crew is full (5 of 5)",
  solo: "Offline island (no crew server)",
};

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

export class CrewUi {
  readonly root = el("div", "crew-ui");
  readonly bar = el("div", "crew-build-bar");
  private readonly code = el("button", "crew-code");
  private readonly members = el("div", "crew-members");
  private readonly status = el("div", "crew-status");
  private readonly selection = el("div", "crew-selection");
  private readonly selectionLabel = el("div", "crew-selection-label");
  private readonly removeButton = el("button", "btn crew-small", "Remove");
  private readonly hint = el(
    "div",
    "crew-hint",
    "Drag a building onto the sand, or tap one to drop it nearby",
  );
  private readonly toast = el("div", "crew-toast");
  private readonly join = el("div", "crew-join");
  private readonly nameInput = el("input", "crew-input");
  private readonly codeInput = el("input", "crew-input crew-code-input");
  private readonly joinError = el("div", "crew-join-error");
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private crewCode = "";

  constructor(parent: HTMLElement, handlers: CrewUiHandlers) {
    const top = el("div", "crew-top");
    const back = el("button", "btn crew-small", "‹ Back");
    back.addEventListener("click", () => handlers.onBack());
    this.code.addEventListener("click", () => this.copyCode());
    const crewBox = el("div", "crew-box");
    crewBox.append(this.code, this.members);
    top.append(back, crewBox, this.status);

    for (const type of BUILD_MENU) {
      const chip = el("button", "crew-chip");
      const { w, h } = FOOTPRINTS[type];
      chip.append(
        el("span", "crew-chip-name", BUILDINGS[type].label),
        el("span", "crew-chip-size", `${w}×${h}`),
      );
      chip.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handlers.onChipDown(type, event);
      });
      this.bar.append(chip);
    }

    const rotate = el("button", "btn crew-small", "Rotate");
    rotate.addEventListener("click", () => handlers.onRotate());
    this.removeButton.addEventListener("click", () => handlers.onRemove());
    const done = el("button", "btn btn-primary crew-small", "Done");
    done.addEventListener("click", () => handlers.onDone());
    const actions = el("div", "crew-actions");
    actions.append(rotate, this.removeButton, done);
    this.selection.append(this.selectionLabel, actions);

    // First visit: pick a nickname, then start or join a crew.
    this.nameInput.placeholder = "Your nickname";
    this.nameInput.maxLength = 16;
    this.codeInput.placeholder = "Crew code";
    this.codeInput.maxLength = 6;
    this.codeInput.autocapitalize = "characters";
    const create = el("button", "btn btn-primary", "Start a new crew");
    create.addEventListener("click", () => handlers.onCreate(this.nameInput.value));
    const joinButton = el("button", "btn", "Join");
    joinButton.addEventListener("click", () =>
      handlers.onJoin(this.nameInput.value, this.codeInput.value),
    );
    const offline = el("button", "crew-link", "Build offline for now");
    offline.addEventListener("click", () => handlers.onOffline(this.nameInput.value));
    const joinRow = el("div", "crew-join-row");
    joinRow.append(this.codeInput, joinButton);
    const card = el("div", "crew-join-card");
    card.append(
      el("h2", "crew-join-title", "Your crew island"),
      el("p", "crew-join-text", "Build an island together with up to 5 friends."),
      this.nameInput,
      create,
      el("div", "crew-join-or", "or join a friend's crew"),
      joinRow,
      this.joinError,
      offline,
    );
    this.join.append(card);

    this.root.append(top, this.bar, this.hint, this.selection, this.toast, this.join);
    for (const node of [top, this.bar, this.selection, this.join]) {
      node.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
    this.show(false);
    parent.append(this.root);
  }

  show(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
  }

  showJoin(nickname: string, error = ""): void {
    this.nameInput.value = nickname;
    this.joinError.textContent = error;
    this.join.style.display = "flex";
  }

  hideJoin(): void {
    this.join.style.display = "none";
  }

  setCrew(code: string, members: readonly Member[], status: ConnectionStatus | "solo"): void {
    this.crewCode = code;
    this.code.textContent = code ? `Crew ${code}` : "No crew";
    this.code.disabled = !code;
    this.members.replaceChildren(
      ...members.map((m) => {
        const chip = el("span", `crew-member${m.online ? " online" : ""}`, m.name);
        return chip;
      }),
    );
    this.status.textContent = STATUS_TEXT[status];
    this.status.dataset.status = status;
  }

  setSelection(label: string | null, canRemove: boolean): void {
    this.selection.style.display = label ? "flex" : "none";
    this.hint.style.display = label ? "none" : "block";
    this.bar.style.display = label ? "none" : "flex";
    if (label) this.selectionLabel.textContent = label;
    this.removeButton.disabled = !canRemove;
  }

  flash(message: string): void {
    this.toast.textContent = message;
    this.toast.style.opacity = "1";
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.style.opacity = "0";
    }, 1800);
  }

  /** True if a screen point is over the build bar (dropping there cancels a placement). */
  overBar(clientY: number): boolean {
    return this.bar.style.display !== "none" && clientY >= this.bar.getBoundingClientRect().top;
  }

  private copyCode(): void {
    if (!this.crewCode) return;
    navigator.clipboard?.writeText(this.crewCode).then(
      () => this.flash(`Code ${this.crewCode} copied: send it to a friend`),
      () => this.flash(`Your crew code is ${this.crewCode}`),
    );
  }
}
