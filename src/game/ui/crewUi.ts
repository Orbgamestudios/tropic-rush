// HTML for the crew island: the top bar (back, crew card with avatars and share, island
// progress), the build drawer with category tabs, the selected-building panel, labels over each
// zone (with the Unlock button), and the first-visit join panel.

import { BUILDINGS, type BuildingType } from "../logic/buildings";
import { FOOTPRINTS, ZONES } from "../logic/crewIsland";
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
  onUnlock(zone: number): void;
  onZoneFocus(zone: number): void;
}

type Category = "defenses" | "resources";

const CATEGORIES: Record<Category, { label: string; types: BuildingType[] }> = {
  defenses: {
    label: "Defenses",
    types: ["gunTurret", "mortar", "harpoon", "flamethrower", "watchtower"],
  },
  resources: {
    label: "Resources",
    types: ["goldMine", "lumberCamp", "quarry", "scrapYard", "storehouse", "refinery"],
  },
};

/** Placeholder icons until the buildings have real art. */
export const BUILDING_ICONS: Record<BuildingType, string> = {
  headquarters: "🏰",
  gunTurret: "🎯",
  mortar: "💣",
  harpoon: "🔱",
  flamethrower: "🔥",
  watchtower: "🗼",
  goldMine: "🪙",
  lumberCamp: "🪵",
  quarry: "🪨",
  scrapYard: "🔩",
  storehouse: "📦",
  refinery: "🏭",
};

const STATUS_TEXT: Record<ConnectionStatus | "solo", string> = {
  connecting: "Connecting…",
  online: "Live",
  offline: "Offline",
  full: "Crew full",
  solo: "Offline island",
};

const AVATAR_COLORS = ["#4f86c6", "#f08a3c", "#2f9e9a", "#c4582c", "#8a63c9", "#d9a521"];

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

function avatarColor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? "#4f86c6";
}

export class CrewUi {
  readonly root = el("div", "crew-ui");
  private readonly drawer = el("div", "crew-drawer");
  private readonly cards = el("div", "crew-cards");
  private readonly tabs = new Map<Category, HTMLButtonElement>();
  private readonly drawerToggle = el("button", "crew-drawer-toggle", "Hide");
  private readonly code = el("button", "crew-code");
  private readonly avatars = el("div", "crew-avatars");
  private readonly status = el("span", "crew-status");
  private readonly progress = el("div", "crew-progress");
  private readonly progressLabel = el("span", "crew-progress-label");
  private readonly progressSegments: HTMLButtonElement[] = [];
  private readonly selection = el("div", "crew-selection");
  private readonly selectionIcon = el("span", "crew-selection-icon");
  private readonly selectionLabel = el("div", "crew-selection-label");
  private readonly selectionDetail = el("div", "crew-selection-detail");
  private readonly removeButton = el("button", "crew-round crew-round-danger", "🗑");
  private readonly zoneLabels = new Map<
    number,
    { root: HTMLDivElement; button: HTMLButtonElement; name: HTMLSpanElement }
  >();
  private readonly toast = el("div", "crew-toast");
  private readonly join = el("div", "crew-join");
  private readonly nameInput = el("input", "crew-input");
  private readonly codeInput = el("input", "crew-input crew-code-input");
  private readonly joinError = el("div", "crew-join-error");
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private crewCode = "";
  private drawerOpen = true;
  private selecting = false;

  constructor(
    parent: HTMLElement,
    private readonly handlers: CrewUiHandlers,
  ) {
    // Top bar: back, crew card, island progress.
    const top = el("div", "crew-top");
    const back = el("button", "crew-round", "‹");
    back.setAttribute("aria-label", "Back");
    back.addEventListener("click", () => handlers.onBack());
    const card = el("div", "crew-card");
    this.code.addEventListener("click", () => this.shareCode());
    card.append(this.avatars, this.code, this.status);
    for (const zone of ZONES) {
      const segment = el("button", "crew-progress-segment");
      segment.title = zone.name;
      segment.setAttribute("aria-label", `Show ${zone.name}`);
      segment.addEventListener("click", () => handlers.onZoneFocus(zone.id));
      this.progressSegments.push(segment);
    }
    const segments = el("div", "crew-progress-segments");
    segments.append(...this.progressSegments);
    this.progress.append(this.progressLabel, segments);
    top.append(back, card, this.progress);

    // Build drawer with category tabs.
    const tabRow = el("div", "crew-tabs");
    for (const [key, category] of Object.entries(CATEGORIES) as [
      Category,
      (typeof CATEGORIES)[Category],
    ][]) {
      const tab = el("button", "crew-tab", category.label);
      tab.addEventListener("click", () => this.showCategory(key));
      this.tabs.set(key, tab);
      tabRow.append(tab);
    }
    this.drawerToggle.addEventListener("click", () => this.setDrawer(!this.drawerOpen));
    tabRow.append(this.drawerToggle);
    this.drawer.append(tabRow, this.cards);
    this.showCategory("defenses");

    // Selected building: icon, name, round action buttons.
    const rotate = el("button", "crew-round", "↻");
    rotate.setAttribute("aria-label", "Rotate");
    rotate.addEventListener("click", () => handlers.onRotate());
    this.removeButton.setAttribute("aria-label", "Remove");
    this.removeButton.addEventListener("click", () => handlers.onRemove());
    const done = el("button", "crew-round crew-round-primary", "✓");
    done.setAttribute("aria-label", "Done");
    done.addEventListener("click", () => handlers.onDone());
    const text = el("div", "crew-selection-text");
    text.append(this.selectionLabel, this.selectionDetail);
    this.selection.append(this.selectionIcon, text, rotate, this.removeButton, done);

    // Labels over each zone; the next locked one carries the Unlock button.
    const labelLayer = el("div", "crew-zone-layer");
    for (const zone of ZONES) {
      const root = el("div", "crew-zone-label");
      const name = el("span", "crew-zone-name", zone.name);
      const button = el("button", "crew-unlock", `Unlock ${zone.name}`);
      button.addEventListener("click", () => handlers.onUnlock(zone.id));
      button.addEventListener("pointerdown", (e) => e.stopPropagation());
      root.append(name, button);
      labelLayer.append(root);
      this.zoneLabels.set(zone.id, { root, button, name });
    }

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
    const joinCard = el("div", "crew-join-card");
    joinCard.append(
      el("div", "crew-join-badge", "🏝️"),
      el("h2", "crew-join-title", "Your crew island"),
      el("p", "crew-join-text", "Build an island together with up to 5 friends, in real time."),
      this.nameInput,
      create,
      el("div", "crew-join-or", "or join a friend's crew"),
      joinRow,
      this.joinError,
      offline,
    );
    this.join.append(joinCard);

    this.root.append(labelLayer, top, this.drawer, this.selection, this.toast, this.join);
    for (const node of [top, this.drawer, this.selection, this.join]) {
      node.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
    this.show(false);
    parent.append(this.root);
  }

  private showCategory(category: Category): void {
    for (const [key, tab] of this.tabs) tab.classList.toggle("active", key === category);
    this.cards.replaceChildren(
      ...CATEGORIES[category].types.map((type) => {
        const chip = el("button", "crew-chip");
        const { w, h } = FOOTPRINTS[type];
        chip.append(
          el("span", "crew-chip-icon", BUILDING_ICONS[type]),
          el("span", "crew-chip-name", BUILDINGS[type].label),
          el("span", "crew-chip-size", `${w}×${h}`),
        );
        chip.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          this.handlers.onChipDown(type, event);
        });
        return chip;
      }),
    );
    if (!this.drawerOpen) this.setDrawer(true);
  }

  private setDrawer(open: boolean): void {
    this.drawerOpen = open;
    this.drawer.classList.toggle("closed", !open);
    this.drawerToggle.textContent = open ? "Hide" : "Build";
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
    this.code.textContent = code ? `${code}  ⤴` : "No crew";
    this.code.disabled = !code;
    this.avatars.replaceChildren(
      ...members.map((m) => {
        const avatar = el(
          "span",
          `crew-avatar${m.online ? " online" : ""}`,
          (m.name[0] ?? "?").toUpperCase(),
        );
        avatar.style.background = avatarColor(m.id || m.name);
        avatar.title = `${m.name}${m.online ? " (online)" : ""}`;
        return avatar;
      }),
    );
    this.status.textContent = STATUS_TEXT[status];
    this.status.dataset.status = status;
  }

  setProgress(unlocked: number): void {
    this.progressLabel.textContent = `Island ${unlocked}/${ZONES.length}`;
    this.progressSegments.forEach((segment, i) => {
      segment.classList.toggle("open", i < unlocked);
    });
  }

  setSelection(
    info: { type: BuildingType; label: string; detail: string } | null,
    canRemove: boolean,
  ): void {
    this.selecting = info !== null;
    this.selection.style.display = info ? "flex" : "none";
    this.drawer.style.display = info ? "none" : "flex";
    if (info) {
      this.selectionIcon.textContent = BUILDING_ICONS[info.type];
      this.selectionLabel.textContent = info.label;
      this.selectionDetail.textContent = info.detail;
    }
    this.removeButton.disabled = !canRemove;
  }

  /** Positions the zone labels over the island; call every frame. */
  placeZoneLabels(
    positions: { id: number; x: number; y: number; visible: boolean }[],
    unlocked: number,
  ): void {
    // Keep labels clear of the top bar and the drawer.
    const top = 70;
    const bottom =
      this.drawer.style.display === "none"
        ? this.root.clientHeight - 70
        : this.drawer.getBoundingClientRect().top - 30;
    for (const p of positions) {
      const label = this.zoneLabels.get(p.id);
      if (!label) continue;
      const visible = p.visible && p.y > top && p.y < bottom;
      label.root.style.display = visible ? "flex" : "none";
      if (!visible) continue;
      label.root.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
      const open = p.id <= unlocked;
      const next = p.id === unlocked + 1;
      label.root.classList.toggle("open", open);
      label.root.classList.toggle("locked", !open);
      label.name.textContent = open
        ? (ZONES[p.id - 1]?.name ?? "")
        : `🔒 ${ZONES[p.id - 1]?.name ?? ""}`;
      label.button.style.display = next && !this.selecting ? "block" : "none";
    }
  }

  flash(message: string): void {
    this.toast.textContent = message;
    this.toast.style.opacity = "1";
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.style.opacity = "0";
    }, 1800);
  }

  /** True if a screen point is over the build drawer (dropping there cancels a placement). */
  overBar(clientY: number): boolean {
    return (
      this.drawer.style.display !== "none" && clientY >= this.drawer.getBoundingClientRect().top
    );
  }

  private shareCode(): void {
    if (!this.crewCode) return;
    const text = `Join my Tropic Rush crew! Code: ${this.crewCode}`;
    if (navigator.share) {
      navigator.share({ title: "Tropic Rush crew", text, url: location.origin }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(this.crewCode).then(
      () => this.flash(`Code ${this.crewCode} copied: send it to a friend`),
      () => this.flash(`Your crew code is ${this.crewCode}`),
    );
  }
}
