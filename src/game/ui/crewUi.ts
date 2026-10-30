// HTML for the crew island, in the game's steel-and-glass style:
// - top bar: back tab, crew card (avatars, share code, status), resources and island progress
// - build drawer: category plates and building cards (3D icons, cost, count, locks)
// - selected building: an info panel with its level and the Level up button
// - plates over each zone with the Unlock button, toasts, and the first-visit join panel

import { BUILDINGS, type BuildingType } from "../logic/buildings";
import { ZONES } from "../logic/crewIsland";
import { formatAmount, type Purse, RESOURCES, type Resource } from "../logic/economy";
import type { ConnectionStatus } from "../net/crewClient";
import type { Member } from "../net/protocol";
import { buildingIcon } from "../render/thumbnails";
import { backButton, button, el, levelBadge, panel, setLabel } from "./kit/dom";
import { sfx, sparkleAt } from "./kit/fx";
import { type IconName, icon } from "./kit/icons";

export interface CrewUiHandlers {
  onBack(): void;
  onCreate(name: string): void;
  onJoin(name: string, code: string): void;
  onOffline(name: string): void;
  onChipDown(type: BuildingType, event: PointerEvent): void;
  onRotate(): void;
  onRemove(): void;
  onUpgrade(): void;
  onDone(): void;
  onUnlock(zone: number): void;
  onZoneFocus(zone: number): void;
}

type Category = "defenses" | "resources" | "storage";

/** What a build card shows: how many there are of how many allowed, the cost, and whether it's
 * locked behind a headquarters level or can't be built right now. */
export interface ChipState {
  have: number;
  allowed: number;
  cost: string;
  /** e.g. "HQ 3" while the headquarters is too low to build any. */
  locked: string | null;
  blocked: boolean;
}

const CATEGORIES: Record<Category, { label: string; icon: IconName; types: BuildingType[] }> = {
  defenses: {
    label: "Defenses",
    icon: "shield",
    types: ["gunTurret", "mortar", "harpoon", "flamethrower", "watchtower"],
  },
  resources: {
    label: "Resources",
    icon: "coin",
    types: ["goldMine", "lumberCamp", "quarry", "scrapYard", "refinery"],
  },
  storage: {
    label: "Storage",
    icon: "timber",
    types: ["goldVault", "timberShed", "stoneYard", "scrapBin"],
  },
};

export const RESOURCE_ICON: Record<Resource, IconName> = {
  gold: "coin",
  timber: "timber",
  stone: "stone",
  scrap: "scrap",
};

const STATUS_TEXT: Record<ConnectionStatus | "solo", string> = {
  connecting: "Connecting…",
  online: "Live",
  offline: "Offline",
  full: "Crew full",
  solo: "Offline island",
};

const AVATAR_COLORS = ["#4f86c6", "#f08a3c", "#2f9e9a", "#c4582c", "#8a63c9", "#d9a521"];

function avatarColor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? "#4f86c6";
}

/** Turns "🪙 300  🪵 200"-style cost text into icon chips. */
function costChips(text: string): HTMLElement {
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

export class CrewUi {
  readonly root = el("div", "crew-ui");
  private readonly fx = el("div", "fx-layer");
  private readonly drawer = el("div", "crew-drawer");
  private readonly cards = el("div", "crew-cards");
  private readonly tabs = new Map<Category, HTMLButtonElement>();
  private readonly drawerToggle: HTMLButtonElement;
  private readonly code: HTMLButtonElement;
  private readonly avatars = el("div", "crew-avatars");
  private readonly status = el("span", "crew-status");
  private readonly progressLabel = el("span", "crew-progress-label");
  private readonly progressSegments: HTMLButtonElement[] = [];
  private readonly resourceItems = new Map<
    Resource,
    { amount: HTMLSpanElement; fill: HTMLSpanElement; root: HTMLDivElement; rate: HTMLSpanElement }
  >();
  private readonly chips = new Map<
    BuildingType,
    {
      chip: HTMLButtonElement;
      count: HTMLSpanElement;
      cost: HTMLSpanElement;
      lock: HTMLSpanElement;
    }
  >();
  private chipState: ((type: BuildingType) => ChipState) | null = null;
  private readonly selection = el("div", "crew-selection");
  private readonly selectionImg = el("img", "crew-selection-img");
  private readonly selectionLevel = el("div", "crew-selection-level");
  private readonly selectionLabel = el("div", "crew-selection-label");
  private readonly selectionDetail = el("div", "crew-selection-detail");
  private readonly upgradeCost = el("div", "crew-selection-cost");
  private readonly upgradeButton: HTMLButtonElement;
  private readonly removeButton: HTMLButtonElement;
  private selectedType: BuildingType | null = null;
  private selectedLevel = 0;
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
  private category: Category = "defenses";

  constructor(
    parent: HTMLElement,
    private readonly handlers: CrewUiHandlers,
  ) {
    // Top bar: back, crew card, resources and island progress.
    const top = el("div", "crew-top");
    const card = el("div", "crew-card");
    this.code = button({
      label: "No crew",
      icon: "share",
      variant: "blue",
      size: "sm",
      className: "crew-code",
    });
    this.code.addEventListener("click", () => this.shareCode());
    const who = el("div", "crew-card-text");
    who.append(this.status);
    card.append(icon("crew", "crew-card-icon"), this.avatars, this.code, who);

    const resources = el("div", "crew-resources");
    for (const r of RESOURCES) {
      const item = el("div", "crew-resource");
      const amount = el("span", "crew-resource-amount", "0");
      const rate = el("span", "crew-resource-rate");
      const bar = el("span", "crew-resource-bar");
      const fill = el("span", "crew-resource-fill");
      bar.append(fill);
      const text = el("span", "crew-resource-text");
      text.append(amount, bar);
      item.append(text, icon(RESOURCE_ICON[r], "crew-resource-icon"), rate);
      item.setAttribute("role", "status");
      resources.append(item);
      this.resourceItems.set(r, { amount, fill, root: item, rate });
    }
    const progress = el("div", "crew-progress");
    for (const zone of ZONES) {
      const segment = el("button", "crew-progress-segment");
      segment.title = zone.name;
      segment.setAttribute("aria-label", `Show ${zone.name}`);
      segment.addEventListener("click", () => {
        sfx.tick();
        handlers.onZoneFocus(zone.id);
      });
      this.progressSegments.push(segment);
    }
    const segments = el("div", "crew-progress-segments");
    segments.append(...this.progressSegments);
    progress.append(icon("map", "crew-progress-icon"), this.progressLabel, segments);
    const right = el("div", "crew-top-right");
    right.append(resources, progress);
    top.append(
      backButton(() => handlers.onBack()),
      card,
      right,
    );

    // Build drawer with category plates.
    const tabRow = el("div", "crew-tabs");
    tabRow.append(icon("hammer", "crew-tabs-icon"));
    for (const [name, category] of Object.entries(CATEGORIES) as [
      Category,
      (typeof CATEGORIES)[Category],
    ][]) {
      const tab = el("button", "crew-tab");
      tab.setAttribute("aria-label", category.label);
      tab.append(
        icon(category.icon, "crew-tab-icon"),
        el("span", "crew-tab-label", category.label),
      );
      tab.addEventListener("click", () => {
        sfx.tick();
        this.showCategory(name);
      });
      this.tabs.set(name, tab);
      tabRow.append(tab);
    }
    this.drawerToggle = button({
      label: "Hide",
      variant: "steel",
      size: "sm",
      className: "crew-drawer-toggle",
    });
    this.drawerToggle.addEventListener("click", () => this.setDrawer(!this.drawerOpen));
    tabRow.append(this.drawerToggle);
    this.drawer.append(tabRow, this.cards);
    this.showCategory("defenses");

    // Selected building: an info panel.
    this.upgradeButton = button({
      label: "Level up",
      icon: "up",
      variant: "green",
      size: "md",
      className: "crew-upgrade",
      onClick: () => handlers.onUpgrade(),
    });
    const rotate = button({
      icon: "rotate",
      aria: "Rotate",
      round: true,
      variant: "steel",
      size: "sm",
      onClick: () => handlers.onRotate(),
    });
    this.removeButton = button({
      icon: "trash",
      aria: "Remove",
      round: true,
      variant: "red",
      size: "sm",
      onClick: () => handlers.onRemove(),
    });
    const done = button({
      icon: "check",
      aria: "Done",
      round: true,
      variant: "blue",
      size: "sm",
      onClick: () => handlers.onDone(),
    });
    const info = panel(undefined, "crew-selection-panel");
    const pic = el("div", "crew-selection-pic");
    this.selectionImg.alt = "";
    pic.append(this.selectionImg, this.selectionLevel);
    const words = el("div", "crew-selection-words");
    words.append(this.selectionLabel, this.selectionDetail, this.upgradeCost);
    const tools = el("div", "crew-selection-tools");
    tools.append(rotate, this.removeButton, done);
    info.body.append(pic, words, this.upgradeButton, tools);
    this.selection.append(info.root);

    // Plates over each zone; the next locked one carries the Unlock button.
    const labelLayer = el("div", "crew-zone-layer");
    for (const zone of ZONES) {
      const root = el("div", "crew-zone-label");
      const name = el("span", "crew-zone-name", zone.name);
      const unlock = button({
        label: `Unlock ${zone.name}`,
        icon: "lock",
        variant: "gold",
        size: "sm",
        className: "crew-unlock",
        onClick: () => handlers.onUnlock(zone.id),
      });
      unlock.addEventListener("pointerdown", (e) => e.stopPropagation());
      root.append(name, unlock);
      labelLayer.append(root);
      this.zoneLabels.set(zone.id, { root, button: unlock, name });
    }

    // First visit: pick a nickname, then start or join a crew.
    this.nameInput.placeholder = "Your nickname";
    this.nameInput.maxLength = 16;
    this.codeInput.placeholder = "Crew code";
    this.codeInput.maxLength = 6;
    this.codeInput.autocapitalize = "characters";
    const create = button({
      label: "Start a new crew",
      icon: "island",
      variant: "gold",
      size: "lg",
      onClick: () => handlers.onCreate(this.nameInput.value),
    });
    const joinButton = button({
      label: "Join",
      icon: "crew",
      variant: "blue",
      size: "md",
      onClick: () => handlers.onJoin(this.nameInput.value, this.codeInput.value),
    });
    const offline = el("button", "crew-link", "Build offline for now");
    offline.addEventListener("click", () => handlers.onOffline(this.nameInput.value));
    const joinRow = el("div", "crew-join-row");
    joinRow.append(this.codeInput, joinButton);
    const joinCard = panel("Your crew island", "crew-join-card");
    joinCard.body.append(
      el("p", "crew-join-text", "Build an island together with up to 5 friends, in real time."),
      this.nameInput,
      create,
      el("div", "crew-join-or", "or join a friend's crew"),
      joinRow,
      this.joinError,
      offline,
    );
    this.join.append(joinCard.root);

    this.root.append(labelLayer, top, this.drawer, this.selection, this.toast, this.join, this.fx);
    for (const node of [top, this.drawer, this.selection, this.join]) {
      node.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
    this.show(false);
    parent.append(this.root);
  }

  private showCategory(category: Category): void {
    this.category = category;
    for (const [name, tab] of this.tabs) tab.classList.toggle("active", name === category);
    this.chips.clear();
    this.cards.replaceChildren(
      ...CATEGORIES[category].types.map((type) => {
        const chip = el("button", "crew-chip");
        chip.setAttribute("aria-label", BUILDINGS[type].label);
        const img = el("img", "crew-chip-img");
        img.alt = "";
        img.draggable = false;
        img.src = buildingIcon(type);
        const count = el("span", "crew-chip-count");
        const cost = el("span", "crew-chip-cost");
        const lock = el("span", "crew-chip-lock");
        chip.append(img, el("span", "crew-chip-name", BUILDINGS[type].label), cost, count, lock);
        chip.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          sfx.tick();
          this.handlers.onChipDown(type, event);
        });
        this.chips.set(type, { chip, count, cost, lock });
        return chip;
      }),
    );
    if (!this.drawerOpen) this.setDrawer(true);
    this.refreshChips();
  }

  private setDrawer(open: boolean): void {
    this.drawerOpen = open;
    this.drawer.classList.toggle("closed", !open);
    setLabel(this.drawerToggle, open ? "Hide" : "Build");
  }

  /** Sets how each build card looks (count, cost, locked); called every few frames. */
  setChips(state: (type: BuildingType) => ChipState): void {
    this.chipState = state;
    this.refreshChips();
  }

  private lastChipKey = "";

  private refreshChips(): void {
    const state = this.chipState;
    if (!state) return;
    const states = [...this.chips.keys()].map((type) => [type, state(type)] as const);
    const key = this.category + JSON.stringify(states);
    if (key === this.lastChipKey) return;
    this.lastChipKey = key;
    for (const [type, s] of states) {
      const chip = this.chips.get(type);
      if (!chip) continue;
      chip.count.textContent = s.locked ? "" : `${s.have}/${s.allowed}`;
      chip.cost.replaceChildren(
        s.locked
          ? el("span", "")
          : s.have >= s.allowed
            ? el("span", "cost-text", "Max built")
            : costChips(s.cost),
      );
      chip.lock.replaceChildren(...(s.locked ? [icon("lock"), el("span", "", s.locked)] : []));
      chip.chip.classList.toggle("locked", s.locked !== null);
      chip.chip.classList.toggle("blocked", s.blocked);
    }
  }

  /** The resource pills: each resource's amount, how full its storage is, and output per hour. */
  setResources(amounts: Purse, capacity: Purse, perHour: Purse): void {
    for (const r of RESOURCES) {
      const item = this.resourceItems.get(r);
      if (!item) continue;
      item.amount.textContent = formatAmount(amounts[r]);
      item.fill.style.width = `${Math.min(100, (amounts[r] / capacity[r]) * 100).toFixed(1)}%`;
      item.root.classList.toggle("full", amounts[r] >= capacity[r] - 0.5);
      item.rate.textContent = perHour[r] > 0 ? `+${formatAmount(perHour[r])}/h` : "";
      item.root.setAttribute(
        "aria-label",
        `${r}: ${formatAmount(amounts[r])} of ${formatAmount(capacity[r])}`,
      );
    }
  }

  show(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
  }

  showJoin(nickname: string, error = ""): void {
    this.nameInput.value = nickname;
    this.joinError.textContent = error;
    this.join.style.display = "flex";
    if (error) sfx.error();
  }

  hideJoin(): void {
    this.join.style.display = "none";
  }

  setCrew(code: string, members: readonly Member[], status: ConnectionStatus | "solo"): void {
    this.crewCode = code;
    setLabel(this.code, code || "No crew");
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
    info: {
      type: BuildingType;
      label: string;
      level: number;
      detail: string;
      upgrade: string;
      canUpgrade: boolean;
    } | null,
    canRemove: boolean,
  ): void {
    this.selecting = info !== null;
    this.selection.style.display = info ? "flex" : "none";
    this.drawer.style.display = info ? "none" : "flex";
    if (info) {
      if (info.type !== this.selectedType) this.selectionImg.src = buildingIcon(info.type);
      if (info.type === this.selectedType && info.level > this.selectedLevel) {
        sfx.levelUp();
        sparkleAt(this.fx, this.selectionImg, { count: 26, spread: 110 });
      }
      this.selectedType = info.type;
      this.selectedLevel = info.level;
      this.selectionLevel.replaceChildren(levelBadge(info.level));
      this.selectionLabel.textContent = info.label;
      this.selectionDetail.textContent = info.detail;
      const costText = info.upgrade.startsWith("Next: ") ? info.upgrade.slice(6) : null;
      this.upgradeCost.replaceChildren(
        costText ? costChips(costText) : el("span", "cost-text", info.upgrade),
      );
      this.upgradeButton.disabled = !info.canUpgrade;
    } else {
      this.selectedType = null;
    }
    this.removeButton.disabled = !canRemove;
  }

  /** Positions the zone plates over the island; call every frame. */
  placeZoneLabels(
    positions: { id: number; x: number; y: number; visible: boolean }[],
    unlocked: number,
  ): void {
    // Keep labels clear of the top bar and the drawer.
    const top = 96;
    const bottom =
      this.drawer.style.display === "none"
        ? this.root.clientHeight - 90
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
      label.name.textContent = ZONES[p.id - 1]?.name ?? "";
      label.button.style.display = next && !this.selecting ? "flex" : "none";
    }
  }

  flash(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add("on");
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove("on"), 1900);
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
