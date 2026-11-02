// HTML for the crew island, in the game's steel-and-glass style:
// - top bar: menu button, crew card (everyone's picture, glowing green when they're online, which
//   opens the profile), resources and island progress
// - a round Build button that opens the build drawer (category plates and building cards with
//   3D icons, cost, count, locks)
// - selected building: an info panel with its level and the Level up button
// - the clearing panel for a tapped thicket, rock or boulder (tool, cost, what it gives), toasts,
//   and the crew join panel

import { avatarUrl } from "../logic/avatars";
import { BUILDINGS, type BuildingType } from "../logic/buildings";
import type { Tool } from "../logic/crewIsland";
import { formatAmount, type Purse, RESOURCES, type Resource } from "../logic/economy";
import type { NightRaid } from "../logic/nightRaid";
import type { Member } from "../net/protocol";
import { buildingIcon } from "../render/thumbnails";
import {
  button,
  closeOnBackdrop,
  confirmTap,
  costChips,
  el,
  layerPlacer,
  levelBadge,
  panel,
  setLabel,
} from "./kit/dom";
import { sfx, sparkleAt } from "./kit/fx";
import { type IconName, icon } from "./kit/icons";

export interface CrewUiHandlers {
  /** The pause menu (settings). */
  onMenu(): void;
  onProfile(): void;
  /** Straight to the world map. */
  onMap(): void;
  onCreate(name: string): void;
  onJoin(name: string, code: string): void;
  onOffline(name: string): void;
  onChipDown(type: BuildingType, event: PointerEvent): void;
  onRotate(): void;
  onRemove(): void;
  onUpgrade(): void;
  onDone(): void;
  onClear(): void;
  onClearCancel(): void;
  onToolsPanel(): void;
  onToolUp(tool: Tool): void;
  onNightPanel(): void;
  onNightRaidNow(): void;
  onNightReplay(): void;
}

/** What the clearing panel shows for a tapped obstacle. */
export interface ClearInfo {
  label: string;
  tier: number;
  tool: string;
  /** How long it takes, or how long is left once it's under way. */
  time: string;
  running: boolean;
  workers: string;
  cost: string;
  gives: string;
  /** Why it can't be cleared yet (wrong tool, not enough resources), or null. */
  blocker: string | null;
}

/** A row of the tools panel. */
export interface ToolInfo {
  tool: Tool;
  label: string;
  level: number;
  max: number;
  cost: string;
  blocker: string | null;
  /** How long its next level takes, or how long is left. */
  time: string;
}

/** A countdown over a patch being cleared. */
export interface JobPin {
  id: string;
  x: number;
  y: number;
  time: string;
  visible: boolean;
  /** Building work rather than clearing. */
  building: boolean;
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

export class CrewUi {
  readonly root = el("div", "crew-ui");
  private readonly fx = el("div", "fx-layer");
  private readonly drawer = el("div", "crew-drawer");
  private readonly cards = el("div", "crew-cards");
  private readonly tabs = new Map<Category, HTMLButtonElement>();
  private readonly buildButton: HTMLButtonElement;
  private readonly mapButton: HTMLButtonElement;
  private readonly buildLabel = el("span", "crew-build-label", "Build");
  private readonly avatars = el("div", "crew-avatars");
  private readonly progressLabel = el("span", "crew-progress-label");
  private readonly progressFill = el("span", "crew-progress-fill");
  private readonly buildersLabel = el("span", "crew-progress-label");
  private readonly clearing = el("div", "crew-clearing");
  private readonly clearTitle = el("div", "crew-clearing-title");
  private readonly clearTool = el("div", "crew-clearing-tool");
  private readonly clearCost = el("div", "crew-clearing-cost");
  private readonly clearGives = el("div", "crew-clearing-gives");
  private readonly clearTime = el("div", "crew-clearing-time");
  private readonly toolsPanel = el("div", "crew-join crew-tools");
  private readonly toolRows = el("div", "crew-tool-rows");
  private readonly toolWorkers = el("div", "crew-night-stats crew-tools-note");
  private readonly pinLayer = el("div", "crew-pin-layer");
  private readonly pins = new Map<string, HTMLElement>();
  private readonly clearButton: HTMLButtonElement;
  private readonly night = el("div", "crew-join crew-night");
  private readonly nightNext = el("p", "crew-join-text");
  private readonly nightResult = el("div", "crew-night-result");
  private readonly nightStats = el("div", "crew-night-stats");
  private readonly nightReplay: HTMLButtonElement;
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
  private lastToolsKey = "";
  private selectionKey = "";
  private shownUpgrade = "";
  private selectedType: BuildingType | null = null;
  private selectedLevel = 0;
  private readonly toast = el("div", "crew-toast");
  private readonly join = el("div", "crew-join");
  private readonly nameInput = el("input", "crew-input");
  private readonly codeInput = el("input", "crew-input crew-code-input");
  private readonly joinError = el("div", "crew-join-error");
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private crewCode = "";
  private lastCrewKey = "";
  private drawerOpen = false;
  private selecting = false;
  private category: Category = "defenses";

  constructor(
    parent: HTMLElement,
    private readonly handlers: CrewUiHandlers,
  ) {
    // Top bar: back, crew card, resources and island progress.
    const top = el("div", "crew-top");
    const card = el("button", "crew-card");
    card.setAttribute("aria-label", "Profile and crew");
    card.addEventListener("click", () => {
      sfx.press();
      handlers.onProfile();
    });
    card.append(this.avatars);

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
    const track = el("div", "crew-progress-track");
    track.append(this.progressFill);
    progress.append(
      icon("map", "crew-progress-icon"),
      this.progressLabel,
      track,
      icon("hammer", "crew-progress-icon"),
      this.buildersLabel,
    );
    const toolsButton = button({
      label: "Tools",
      icon: "hammer",
      variant: "steel",
      size: "sm",
      onClick: () => handlers.onToolsPanel(),
    });
    const night = button({
      label: "Night raid",
      icon: "skull",
      variant: "steel",
      size: "sm",
      className: "crew-night-button",
      onClick: () => handlers.onNightPanel(),
    });
    const right = el("div", "crew-top-right");
    const topButtons = el("div", "crew-top-buttons");
    topButtons.append(toolsButton, night);
    right.append(resources, progress, topButtons);
    const menu = button({
      icon: "pause",
      aria: "Menu",
      round: true,
      variant: "blue",
      size: "md",
      className: "crew-menu",
      onClick: () => handlers.onMenu(),
    });
    top.append(menu, card, right);

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
    this.drawer.append(tabRow, this.cards);
    // One round button opens and closes the drawer.
    this.buildButton = button({
      icon: "hammer",
      aria: "Build",
      round: true,
      variant: "gold",
      size: "lg",
      className: "crew-build",
      onClick: () => {
        sfx.press();
        this.setDrawer(!this.drawerOpen);
      },
    });
    this.buildButton.append(this.buildLabel);
    this.showCategory("defenses");
    this.mapButton = button({
      icon: "map",
      aria: "World map",
      round: true,
      variant: "blue",
      size: "lg",
      className: "crew-map",
      onClick: () => handlers.onMap(),
    });
    this.mapButton.append(el("span", "crew-build-label", "Map"));
    // Anything pressed outside the build menu closes it.
    window.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.drawerOpen) return;
        const target = e.target as Node;
        if (!this.drawer.contains(target) && !this.buildButton.contains(target)) {
          this.setDrawer(false);
        }
      },
      true,
    );

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
    });
    confirmTap(this.removeButton, "Tap again to remove", () => handlers.onRemove());
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

    // Clearing: what a tapped thicket, rock or boulder needs and gives.
    this.clearButton = button({
      label: "Clear",
      icon: "hammer",
      variant: "green",
      size: "md",
      className: "crew-clearing-go",
      onClick: () => handlers.onClear(),
    });
    const clearClose = button({
      icon: "close",
      aria: "Close",
      round: true,
      variant: "steel",
      size: "sm",
      onClick: () => handlers.onClearCancel(),
    });
    const clearCard = panel(undefined, "crew-clearing-panel");
    const clearWords = el("div", "crew-clearing-words");
    const trade = el("div", "crew-clearing-trade");
    trade.append(this.clearCost, icon("play", "crew-clearing-arrow"), this.clearGives);
    clearWords.append(this.clearTitle, this.clearTool, this.clearTime, trade);
    clearCard.body.append(clearWords, this.clearButton, clearClose);
    this.clearing.append(clearCard.root);
    this.clearing.style.display = "none";

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

    // Tools: what each is up to, and the next level.
    const toolCard = panel("Tools", "crew-night-card");
    toolCard.body.append(this.toolWorkers, this.toolRows);
    toolCard.root.append(
      button({
        icon: "close",
        aria: "Close tools",
        round: true,
        variant: "red",
        size: "sm",
        className: "crew-join-close",
        onClick: () => this.hideTools(),
      }),
    );
    this.toolsPanel.append(toolCard.root);

    // The nightly raid: when the next one lands, how the last went, and its replay.
    const nightCard = panel("Night raid", "crew-night-card");
    this.nightReplay = button({
      label: "Watch replay",
      icon: "play",
      variant: "blue",
      size: "md",
      onClick: () => handlers.onNightReplay(),
    });
    const nightButtons = el("div", "crew-night-row");
    nightButtons.append(
      button({
        label: "Raid now",
        icon: "skull",
        variant: "red",
        size: "md",
        onClick: () => handlers.onNightRaidNow(),
      }),
      this.nightReplay,
    );
    nightCard.body.append(this.nightNext, this.nightResult, this.nightStats, nightButtons);
    nightCard.root.append(
      button({
        icon: "close",
        aria: "Close night raid",
        round: true,
        variant: "red",
        size: "sm",
        className: "crew-join-close",
        onClick: () => this.hideNight(),
      }),
    );
    this.night.append(nightCard.root);

    const closeJoin = button({
      icon: "close",
      aria: "Close",
      round: true,
      variant: "red",
      size: "sm",
      className: "crew-join-close",
      onClick: () => this.hideJoin(),
    });
    joinCard.root.append(closeJoin);

    this.root.append(
      this.pinLayer,
      top,
      this.drawer,
      this.buildButton,
      this.mapButton,
      this.selection,
      this.clearing,
      this.toast,
      this.join,
      this.toolsPanel,
      this.night,
      this.fx,
    );
    this.setDrawer(false);
    closeOnBackdrop(this.join, () => this.hideJoin());
    closeOnBackdrop(this.toolsPanel, () => this.hideTools());
    closeOnBackdrop(this.night, () => this.hideNight());
    for (const node of [
      top,
      this.drawer,
      this.buildButton,
      this.mapButton,
      this.selection,
      this.clearing,
      this.join,
      this.toolsPanel,
      this.night,
    ]) {
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
    this.refreshChips();
  }

  private setDrawer(open: boolean): void {
    this.drawerOpen = open;
    this.drawer.classList.toggle("closed", !open);
    this.buildButton.classList.toggle("open", open);
    this.buildLabel.textContent = open ? "Close" : "Build";
    this.buildButton.setAttribute("aria-label", open ? "Close build menu" : "Build");
    this.fitMapButton();
  }

  /** The Map button makes way for the build menu, when that's what's showing. */
  private fitMapButton(): void {
    const showing = this.drawerOpen && this.drawer.style.display !== "none";
    this.mapButton.style.display = showing ? "none" : "";
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

  /** Everyone's picture, with a green glow round whoever's online. */
  setCrew(code: string, members: readonly Member[]): void {
    this.crewCode = code;
    const key = JSON.stringify(members);
    if (key === this.lastCrewKey) return;
    this.lastCrewKey = key;
    this.avatars.replaceChildren(
      ...members.map((m) => {
        const avatar = el("span", `crew-avatar${m.online ? " online" : ""}`);
        const picture = el("img", "crew-avatar-img");
        picture.alt = m.name;
        picture.src = avatarUrl(m.avatar);
        avatar.append(picture);
        avatar.title = `${m.name}${m.online ? " (online)" : ""}`;
        return avatar;
      }),
    );
  }

  /** Opens the night raid panel: when the next raid lands, and how the last one went. */
  showNight(last: NightRaid | null, nextAt: number): void {
    const hours = Math.max(0, nextAt - Date.now()) / 3_600_000;
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    this.nightNext.textContent = `Raiders land every night. Next raid in ${h}h ${m}m.`;
    this.nightReplay.disabled = last === null;
    const r = last?.report;
    this.nightResult.textContent = r ? (r.survived ? "Island held!" : "Island overrun!") : "";
    this.nightResult.classList.toggle("lost", r?.survived === false);
    this.nightStats.textContent = r
      ? `${r.destroyedPercent}% destroyed · ${r.raidersDown} of ${r.raiders} raiders down`
      : "No raids yet. Tap Raid now to test your defenses.";
    this.night.style.display = "flex";
  }

  hideNight(): void {
    this.night.style.display = "none";
  }

  /** True while the tools panel is open. */
  get toolsOpen(): boolean {
    return this.toolsPanel.style.display === "flex";
  }

  /** Sparkles and a chime over the middle of the screen. */
  celebrate(): void {
    sfx.levelUp();
    sparkleAt(this.fx, this.clearing.style.display === "none" ? this.root : this.clearing, {
      count: 28,
      spread: 140,
    });
  }

  /** How much of the island's overgrowth is cleared, 0 to 1. */
  setProgress(share: number): void {
    this.progressLabel.textContent = `Cleared ${Math.floor(share * 100)}%`;
    this.progressFill.style.width = `${share * 100}%`;
  }

  /** How many builders are busy, so nobody has to open a panel to find out. */
  setBuilders(busy: number, total: number): void {
    this.buildersLabel.textContent = `${busy}/${total}`;
  }

  /** Shows the clearing panel for a tapped obstacle, or hides it. */
  setClearing(info: ClearInfo | null): void {
    this.clearing.style.display = info ? "flex" : "none";
    const busy = info !== null || this.selecting;
    this.drawer.style.display = busy ? "none" : "";
    this.buildButton.style.display = busy ? "none" : "";
    this.fitMapButton();
    if (!info) return;
    this.clearTitle.textContent = info.label;
    this.clearTool.replaceChildren(
      icon("hammer", "crew-clearing-tool-icon"),
      el("span", "", `Tier ${info.tier} · needs ${info.tool} · workers ${info.workers}`),
    );
    this.clearTime.textContent = info.running ? `${info.time} left` : `Takes ${info.time}`;
    this.clearCost.replaceChildren(costChips(info.cost));
    this.clearGives.replaceChildren(costChips(info.gives));
    this.clearButton.disabled = info.blocker !== null;
    setLabel(this.clearButton, info.running ? "Clearing" : (info.blocker ?? "Clear"));
  }

  /** Opens the tools panel, or refreshes it while it's open. */
  showTools(tools: readonly ToolInfo[], workers: string): void {
    // Rebuilt only when something's changed: a button replaced under a finger loses its tap.
    const key = workers + JSON.stringify(tools);
    this.toolsPanel.style.display = "flex";
    if (key === this.lastToolsKey) return;
    this.lastToolsKey = key;
    this.toolWorkers.textContent = `${workers}. Better tools reach further out and work faster.`;
    this.toolRows.replaceChildren(
      ...tools.map((t) => {
        const row = el("div", "crew-tool-row");
        const words = el("div", "crew-tool-words");
        words.append(
          el("div", "crew-tool-name", t.level > 0 ? `${t.label} ${t.level}` : t.label),
          el(
            "div",
            "crew-tool-level",
            t.level >= t.max ? "Best level" : (t.blocker ?? `Takes ${t.time}`),
          ),
        );
        const up = button({
          label: t.level === 0 ? "Buy" : "Upgrade",
          variant: "green",
          size: "sm",
          onClick: () => this.handlers.onToolUp(t.tool),
        });
        up.disabled = t.blocker !== null;
        row.append(words);
        if (t.level < t.max) row.append(costChips(t.cost), up);
        return row;
      }),
    );
  }

  hideTools(): void {
    this.toolsPanel.style.display = "none";
  }

  /** Places the countdowns over the patches being cleared; call every frame. */
  placeJobPins(pins: readonly JobPin[]): void {
    const live = new Set<string>();
    const place = pins.length > 0 ? layerPlacer(this.pinLayer) : null;
    for (const pin of pins) {
      live.add(pin.id);
      let node = this.pins.get(pin.id);
      if (!node) {
        node = el("div", `crew-pin${pin.building ? " crew-pin-build" : ""}`);
        this.pinLayer.append(node);
        this.pins.set(pin.id, node);
      }
      node.style.display = pin.visible ? "block" : "none";
      if (node.textContent !== pin.time) node.textContent = pin.time;
      const spot = place?.(pin.x, pin.y) ?? pin;
      node.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (const [id, node] of this.pins) {
      if (live.has(id)) continue;
      node.remove();
      this.pins.delete(id);
    }
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
    this.drawer.style.display = info ? "none" : "";
    this.buildButton.style.display = info ? "none" : "";
    this.fitMapButton();
    if (info) {
      if (info.type !== this.selectedType) this.selectionImg.src = buildingIcon(info.type);
      if (info.type === this.selectedType && info.level > this.selectedLevel) {
        sfx.levelUp();
        sparkleAt(this.fx, this.selectionImg, { count: 26, spread: 110 });
      }
      this.selectedType = info.type;
      const key = `${info.type}|${info.level}`;
      if (key !== this.selectionKey) {
        this.selectionKey = key;
        this.selectionLevel.replaceChildren(levelBadge(info.level));
      }
      this.selectedLevel = info.level;
      this.selectionLabel.textContent = info.label;
      this.selectionDetail.textContent = info.detail;
      if (info.upgrade !== this.shownUpgrade) {
        this.shownUpgrade = info.upgrade;
        const costText = info.upgrade.startsWith("Next: ") ? info.upgrade.slice(6) : null;
        this.upgradeCost.replaceChildren(
          costText ? costChips(costText) : el("span", "cost-text", info.upgrade),
        );
      }
      this.upgradeButton.disabled = !info.canUpgrade;
    } else {
      this.selectedType = null;
    }
    this.removeButton.disabled = !canRemove;
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
      this.drawer.style.display !== "none" &&
      this.drawerOpen &&
      clientY >= this.drawer.getBoundingClientRect().top
    );
  }

  shareCode(): void {
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
