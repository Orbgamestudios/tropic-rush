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
import type { RivalRaid, Tool } from "../logic/crewIsland";
import { CRYSTAL_KINDS, type CrystalKind } from "../logic/crystals";
import { costText, formatAmount, type Purse, RESOURCES, type Resource } from "../logic/economy";
import type { Ability } from "../logic/gunboat";
import type { HeroKind } from "../logic/heroes";
import { HERO_NAMES } from "../logic/heroProgress";
import type { NightRaid } from "../logic/nightRaid";
import type { RaiderShip } from "../logic/raiderShip";
import { type Blueprint, isWeapon } from "../logic/spoils";
import type { Member } from "../net/protocol";
import { heroPortrait, showBuildingIcon } from "../render/thumbnails";
import { ABILITY_ICONS } from "./hud";
import {
  button,
  CLOSE_MS,
  closeOnBackdrop,
  closeSoftly,
  confirmTap,
  costChips,
  crystalChip,
  crystalIcon,
  el,
  isOpen,
  layerPlacer,
  levelBadge,
  openSoftly,
  panel,
  setLabel,
} from "./kit/dom";
import { sfx, sparkleAt } from "./kit/fx";
import { type IconName, icon } from "./kit/icons";
import { armyText, shipDetails } from "./raiderShipCard";

export interface CrewUiHandlers {
  /** The pause menu (settings). */
  onMenu(): void;
  onProfile(): void;
  /** Straight to the world map. */
  onMap(): void;
  /** Straight to the hero screen. */
  onHeroes(): void;
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
  onNightReplay(): void;
  onStrikeBack(): void;
  /** A producer's tab was tapped: what it's made goes into the stock. */
  onCollect(id: string): void;
  /** The supply ship's tab was tapped: its cargo comes ashore. */
  onUnload(): void;
  onStatuesPanel(): void;
  onHourglassPanel(): void;
  /** Gives a statue all the crystals of its kind the player can spare. */
  onStatueGive(kind: CrystalKind): void;
  onStatueRestore(kind: CrystalKind): void;
  onLabPanel(): void;
  onResearch(type: Blueprint): void;
  onWeaponUp(weapon: Ability): void;
  /** Opens a hero's upgrade tree, from the laboratory. */
  onLabTree(kind: HeroKind): void;
}

/** A row of the laboratory. */
export interface ResearchRow {
  type: Blueprint;
  name: string;
  /** What it does, or what it's still waiting for. */
  note: string;
  cost: string;
  done: boolean;
  /** Why it can't be done yet, or null. */
  blocker: string | null;
  action: "Research" | "Upgrade";
}

/** A row of the statues panel. */
export interface StatueRow {
  kind: CrystalKind;
  name: string;
  found: boolean;
  restored: boolean;
  /** What it does, or the clue to where it lies. */
  text: string;
  /** Where it stands: crystals so far, time left. */
  status: string;
  crystals: number;
  need: number;
  /** How many of this crystal the player has to give. */
  have: number;
  canGive: boolean;
  canRestore: boolean;
  /** Why it can't be restored yet, once it has its crystals. */
  blocker: string | null;
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

/** A tab over a producer holding enough to collect. */
export interface CollectPin {
  id: string;
  x: number;
  y: number;
  visible: boolean;
  resource: Resource;
  /** It holds all it can, and has stopped. */
  full: boolean;
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

type Category = "defenses" | "resources" | "storage" | "research";

/** How many of the headquarters' wants fit on the selection card. */
const MOST_NEEDS = 3;

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
    types: ["gunTurret", "mortar", "harpoon", "flamethrower", "watchtower", "landmine"],
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
  research: {
    label: "Research",
    icon: "flask",
    types: ["laboratory"],
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
  private readonly heroButton: HTMLButtonElement;
  private readonly buildLabel = el("span", "crew-build-label", "Build");
  private readonly avatars = el("div", "crew-avatars");
  private readonly clearing = el("div", "crew-clearing");
  private readonly clearTitle = el("div", "crew-clearing-title");
  private readonly clearTool = el("div", "crew-clearing-tool");
  private readonly clearCost = el("div", "crew-clearing-cost");
  private readonly clearGives = el("div", "crew-clearing-gives");
  private readonly clearTime = el("div", "crew-clearing-time");
  private readonly labPanel = el("div", "crew-join crew-lab");
  private readonly labRows = el("div", "crew-lab-rows");
  private readonly labHeroes = el("div", "crew-lab-heroes");
  private readonly labButton: HTMLButtonElement;
  private lastLabKey = "";
  private readonly toolsPanel = el("div", "crew-join crew-tools");
  private readonly toolRows = el("div", "crew-tool-rows");
  private readonly toolWorkers = el("div", "crew-night-stats crew-tools-note");
  private readonly pinLayer = el("div", "crew-pin-layer");
  private readonly collectTabs = new Map<string, HTMLButtonElement>();
  private readonly supplyTab = el("button", "crew-collect crew-supply");
  private supplyKey = "";
  private readonly pins = new Map<string, HTMLElement>();
  private readonly clearButton: HTMLButtonElement;
  private readonly night = el("div", "crew-join crew-night");
  private readonly nightShip = el("div", "crew-night-ship");
  private readonly nightResult = el("div", "crew-night-result");
  private readonly nightStats = el("div", "crew-night-stats");
  private readonly nightLoot = el("div", "crew-night-loot");
  private readonly nightLog = el("div", "crew-night-log");
  private readonly nightReplay: HTMLButtonElement;
  private readonly strikeBack: HTMLButtonElement;
  private readonly statuesPanel = el("div", "crew-join crew-statues");
  private readonly statueRows = el("div", "crew-statue-rows");
  private lastStatuesKey = "";
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
  private readonly selectionNeeds = el("div", "crew-selection-needs");
  private shownNeeds = "";
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
  private drawerShutting: ReturnType<typeof setTimeout> | null = null;
  private selecting = false;
  private category: Category = "defenses";

  constructor(
    parent: HTMLElement,
    private readonly handlers: CrewUiHandlers,
  ) {
    this.supplyTab.setAttribute("aria-label", "Unload the supply ship");
    this.supplyTab.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.supplyTab.addEventListener("click", () => handlers.onUnload());
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
    const right = el("div", "crew-top-right");
    right.append(resources);
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
    // These open a panel of their own rather than a row of cards.
    const panels = el("div", "crew-tab-panels");
    for (const [label, tabIcon, open] of [
      ["Tools", "gear", handlers.onToolsPanel],
      ["Statues", "star", handlers.onStatuesPanel],
      ["Hourglass", "clock", handlers.onHourglassPanel],
    ] as const) {
      const tab = el("button", "crew-tab");
      tab.setAttribute("aria-label", label);
      tab.append(icon(tabIcon, "crew-tab-icon"), el("span", "crew-tab-label", label));
      tab.addEventListener("click", () => {
        sfx.press();
        this.setDrawer(false);
        open();
      });
      panels.append(tab);
    }
    tabRow.append(panels);
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
    this.heroButton = button({
      icon: "rank",
      aria: "Heroes",
      round: true,
      variant: "blue",
      size: "lg",
      className: "crew-heroes",
      onClick: () => handlers.onHeroes(),
    });
    this.heroButton.append(el("span", "crew-build-label", "Heroes"));
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
    this.labButton = button({
      label: "Research",
      icon: "flask",
      variant: "gold",
      size: "md",
      className: "crew-upgrade",
      onClick: () => handlers.onLabPanel(),
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
    words.append(this.selectionLabel, this.selectionDetail, this.selectionNeeds, this.upgradeCost);
    const tools = el("div", "crew-selection-tools");
    tools.append(rotate, this.removeButton, done);
    info.body.append(pic, words, this.upgradeButton, this.labButton, tools);
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

    // The laboratory: blueprints into the real thing, and every hero's upgrades.
    const labCard = panel("Laboratory", "crew-night-card crew-lab-card");
    labCard.body.append(this.labRows, this.labHeroes);
    labCard.root.append(
      button({
        icon: "close",
        aria: "Close laboratory",
        round: true,
        variant: "red",
        size: "sm",
        className: "crew-join-close",
        onClick: () => this.hideLab(),
      }),
    );
    this.labPanel.append(labCard.root);

    // The nightly raid: how the last went, its replay and a way to strike back, and the next ship.
    const nightCard = panel("Night raid", "crew-night-card");
    this.nightReplay = button({
      label: "Watch replay",
      icon: "play",
      variant: "blue",
      size: "md",
      onClick: () => handlers.onNightReplay(),
    });
    this.strikeBack = button({
      label: "Strike back",
      icon: "sword2",
      variant: "red",
      size: "md",
      onClick: () => handlers.onStrikeBack(),
    });
    const nightButtons = el("div", "crew-night-row");
    nightButtons.append(this.nightReplay, this.strikeBack);
    nightCard.body.append(
      this.nightResult,
      this.nightStats,
      this.nightLoot,
      nightButtons,
      this.nightShip,
      this.nightLog,
    );
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

    // The ancient statues: which are found, and what each still needs.
    const statueCard = panel("Ancient statues", "crew-night-card");
    statueCard.body.append(this.statueRows);
    statueCard.root.append(
      button({
        icon: "close",
        aria: "Close statues",
        round: true,
        variant: "red",
        size: "sm",
        className: "crew-join-close",
        onClick: () => this.hideStatues(),
      }),
    );
    this.statuesPanel.append(statueCard.root);

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
      this.heroButton,
      this.selection,
      this.clearing,
      this.toast,
      this.join,
      this.toolsPanel,
      this.labPanel,
      this.night,
      this.statuesPanel,
      this.fx,
    );
    this.drawer.classList.add("closed");
    this.setDrawer(false);
    closeOnBackdrop(this.join, () => this.hideJoin());
    closeOnBackdrop(this.toolsPanel, () => this.hideTools());
    closeOnBackdrop(this.labPanel, () => this.hideLab());
    closeOnBackdrop(this.night, () => this.hideNight());
    closeOnBackdrop(this.statuesPanel, () => this.hideStatues());
    for (const node of [
      top,
      this.drawer,
      this.buildButton,
      this.mapButton,
      this.heroButton,
      this.selection,
      this.clearing,
      this.join,
      this.toolsPanel,
      this.labPanel,
      this.night,
      this.statuesPanel,
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
        showBuildingIcon(img, type);
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
    if (this.drawerShutting) clearTimeout(this.drawerShutting);
    this.drawerShutting = null;
    if (open) this.drawer.classList.remove("closed", "ui-closing");
    else if (!this.drawer.classList.contains("closed")) {
      this.drawer.classList.add("ui-closing");
      this.drawerShutting = setTimeout(() => {
        this.drawer.classList.add("closed");
        this.drawer.classList.remove("ui-closing");
      }, CLOSE_MS);
    }
    this.buildButton.classList.toggle("open", open);
    this.buildLabel.textContent = open ? "Close" : "Build";
    this.buildButton.setAttribute("aria-label", open ? "Close build menu" : "Build");
    this.fitMapButton();
  }

  /** The Map button makes way for the build menu, and the Hero button for any panel down there. */
  private fitMapButton(): void {
    const showing = this.drawerOpen && this.drawer.style.display !== "none";
    this.mapButton.style.display = showing ? "none" : "";
    const panelUp = this.buildButton.style.display === "none";
    this.heroButton.style.display = showing || panelUp ? "none" : "";
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
    openSoftly(this.join);
    if (error) sfx.error();
  }

  hideJoin(): void {
    closeSoftly(this.join);
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

  /**
   * Opens the night raid panel: how the last raid went, what it cost or paid, its replay and a way
   * to strike back if it got through, the next ship coming, and any rival crews who've tried their
   * luck.
   */
  showNight(last: NightRaid | null, next: RaiderShip, log: readonly RivalRaid[] = []): void {
    const r = last?.report;
    const ship = last?.ship;
    this.nightReplay.style.display = last ? "" : "none";
    this.strikeBack.style.display = r && !r.survived && ship && !last.avenged ? "" : "none";
    this.nightResult.textContent = r ? (r.survived ? "Island held!" : "Island overrun!") : "";
    this.nightResult.classList.toggle("lost", r?.survived === false);
    this.nightStats.textContent = r
      ? [
          ship ? `${ship.crew} (${ship.difficulty}): ${armyText(ship.kinds)}` : "",
          `${r.destroyedPercent}% destroyed · ${r.raidersDown} of ${r.raiders} raiders down`,
        ]
          .filter(Boolean)
          .join("\n")
      : "No raids yet: a raider ship turns up every morning.";
    this.nightLoot.replaceChildren();
    if (r) {
      const stolen = Object.keys(r.stolen).length > 0;
      const paid = Object.keys(r.reward).length > 0;
      if (stolen) {
        this.nightLoot.append(
          el("span", "crew-night-lost", "Raiders took"),
          costChips(costText(r.stolen)),
        );
      }
      if (paid) {
        this.nightLoot.append(
          el("span", "crew-night-won", "For holding the island"),
          ...CRYSTAL_KINDS.flatMap((k) => {
            const n = r.crystals[k];
            return n ? [crystalChip(k, n)] : [];
          }),
          costChips(costText(r.reward)),
        );
      }
      if (!stolen && !paid) this.nightLoot.append(el("span", "", "Nothing was taken."));
    }
    this.nightShip.replaceChildren(
      el("div", "crew-night-ship-title", `Next: ${next.crew}`),
      shipDetails(next),
    );
    this.nightLog.replaceChildren(
      ...log.slice(0, 3).map((raid) => {
        const row = el("div", "crew-night-rival");
        const said = raid.won ? `${raid.by} took the island` : `${raid.by} attacked and failed`;
        row.append(el("span", "", said));
        const gone = Object.keys(raid.stolen).length > 0;
        if (gone) row.append(costChips(costText(raid.stolen)));
        else if (raid.reward > 0) row.append(costChips(costText({ gold: raid.reward })));
        return row;
      }),
    );
    openSoftly(this.night);
  }

  hideNight(): void {
    closeSoftly(this.night);
  }

  get statuesOpen(): boolean {
    return isOpen(this.statuesPanel);
  }

  /** Opens the statues panel, or brings it up to date while it's open. */
  showStatues(rows: readonly StatueRow[]): void {
    const key = JSON.stringify(rows);
    openSoftly(this.statuesPanel);
    if (key === this.lastStatuesKey) return;
    this.lastStatuesKey = key;
    this.statueRows.replaceChildren(...rows.map((row) => this.statueRow(row)));
  }

  private statueRow(row: StatueRow): HTMLElement {
    const node = el(
      "div",
      `crew-statue${row.found ? "" : " lost"}${row.restored ? " restored" : ""}`,
    );
    const words = el("div", "crew-statue-words");
    words.append(
      el("div", "crew-statue-name", row.found ? row.name : "Undiscovered"),
      el("div", "crew-statue-text", row.text),
      el("div", "crew-statue-status", row.status),
    );
    const picture = el("div", "crew-statue-gem");
    picture.append(crystalIcon(row.kind));
    node.append(picture, words);
    if (!row.found || row.restored) return node;
    const actions = el("div", "crew-statue-actions");
    if (row.canGive) {
      const give = button({
        label: "Give",
        variant: "blue",
        size: "sm",
        onClick: () => this.handlers.onStatueGive(row.kind),
      });
      give.querySelector(".ui-btn-face")?.append(crystalChip(row.kind, row.have));
      actions.append(give);
    }
    if (row.crystals >= row.need && row.status !== "") {
      const restore = button({
        label: "Restore",
        icon: "hammer",
        variant: "green",
        size: "sm",
        onClick: () => this.handlers.onStatueRestore(row.kind),
      });
      restore.disabled = !row.canRestore;
      actions.append(restore);
    }
    if (row.blocker) actions.append(el("div", "crew-statue-blocker", row.blocker));
    node.append(actions);
    return node;
  }

  hideStatues(): void {
    closeSoftly(this.statuesPanel);
  }

  /** True while the tools panel is open. */
  get labOpen(): boolean {
    return isOpen(this.labPanel);
  }

  /** Opens the laboratory, or refreshes it while it's open. */
  showLab(rows: readonly ResearchRow[], heroes: readonly HeroKind[]): void {
    // Rebuilt only when something's changed: a button replaced under a finger loses its tap.
    const key = JSON.stringify([rows, heroes]);
    openSoftly(this.labPanel);
    if (key === this.lastLabKey) return;
    this.lastLabKey = key;
    const column = (title: string, list: readonly ResearchRow[]) => {
      const box = el("div", "crew-lab-column");
      box.append(el("div", "crew-lab-title", title), ...list.map((r) => this.researchRow(r)));
      return box;
    };
    this.labRows.replaceChildren(
      column(
        "Gunboat weapons",
        rows.filter((r) => isWeapon(r.type)),
      ),
      column(
        "Defenses",
        rows.filter((r) => !isWeapon(r.type)),
      ),
    );
    this.labHeroes.replaceChildren(
      el("div", "crew-lab-title", "Hero upgrades"),
      ...heroes.map((kind) => {
        const tile = el("button", "crew-lab-hero");
        tile.setAttribute("aria-label", `${HERO_NAMES[kind]} upgrades`);
        const face = el("img");
        face.alt = "";
        void heroPortrait(kind).then((url) => {
          face.src = url;
        });
        tile.append(face);
        tile.addEventListener("click", () => this.handlers.onLabTree(kind));
        return tile;
      }),
    );
  }

  private researchRow(r: ResearchRow): HTMLElement {
    const row = el("div", `crew-tool-row crew-lab-row${r.done ? " done" : ""}`);
    let picture: Element;
    if (isWeapon(r.type)) picture = icon(ABILITY_ICONS[r.type], "crew-lab-icon");
    else {
      const image = el("img", "crew-lab-icon");
      showBuildingIcon(image, r.type);
      image.alt = "";
      picture = image;
    }
    const words = el("div", "crew-tool-words");
    words.append(el("div", "crew-tool-name", r.name), el("div", "crew-tool-level", r.note));
    row.append(picture, words);
    if (!r.done && r.cost) {
      const { type } = r;
      const go = button({
        label: r.action,
        variant: "green",
        size: "sm",
        aria: `${r.action} ${r.name}`,
        onClick: () =>
          r.action === "Upgrade" && isWeapon(type)
            ? this.handlers.onWeaponUp(type)
            : this.handlers.onResearch(type),
      });
      go.disabled = r.blocker !== null;
      row.append(costChips(r.cost), go);
    }
    return row;
  }

  hideLab(): void {
    closeSoftly(this.labPanel);
  }

  get toolsOpen(): boolean {
    return isOpen(this.toolsPanel);
  }

  /** Sparkles and a chime over the middle of the screen. */
  celebrate(): void {
    sfx.levelUp();
    sparkleAt(this.fx, this.clearing.style.display === "none" ? this.root : this.clearing, {
      count: 28,
      spread: 140,
    });
  }

  /** Shows the clearing panel for a tapped obstacle, or hides it. */
  setClearing(info: ClearInfo | null): void {
    if (info) openSoftly(this.clearing);
    else closeSoftly(this.clearing);
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
    openSoftly(this.toolsPanel);
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
    closeSoftly(this.toolsPanel);
  }

  /** Places the tabs over the producers worth collecting from; call every frame. */
  placeCollectPins(pins: readonly CollectPin[]): void {
    const live = new Set<string>();
    const place = pins.length > 0 ? layerPlacer(this.pinLayer) : null;
    for (const pin of pins) {
      live.add(pin.id);
      let tab = this.collectTabs.get(pin.id);
      if (!tab) {
        tab = el("button", "crew-collect");
        tab.setAttribute("aria-label", `Collect ${pin.resource}`);
        tab.append(icon(RESOURCE_ICON[pin.resource], "crew-collect-icon"));
        tab.addEventListener("pointerdown", (e) => e.stopPropagation());
        tab.addEventListener("click", () => this.handlers.onCollect(pin.id));
        this.pinLayer.append(tab);
        this.collectTabs.set(pin.id, tab);
      }
      tab.classList.toggle("full", pin.full);
      tab.style.display = pin.visible ? "flex" : "none";
      const spot = place?.(pin.x, pin.y) ?? pin;
      tab.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (const [id, tab] of this.collectTabs) {
      if (live.has(id)) continue;
      tab.remove();
      this.collectTabs.delete(id);
    }
  }

  /** Puts the supply ship's tab over it while it has cargo aboard, or takes it away. */
  placeSupply(
    spot: { x: number; y: number; visible: boolean } | null,
    cargo: Partial<Purse>,
  ): void {
    if (!spot) {
      this.supplyTab.remove();
      this.supplyKey = "";
      return;
    }
    const key = JSON.stringify(cargo);
    if (key !== this.supplyKey) {
      this.supplyKey = key;
      this.supplyTab.replaceChildren(
        el("span", "crew-supply-title", "Supplies"),
        ...RESOURCES.filter((r) => (cargo[r] ?? 0) > 0).map((r) =>
          icon(RESOURCE_ICON[r], "crew-collect-icon"),
        ),
      );
    }
    if (!this.supplyTab.isConnected) this.pinLayer.append(this.supplyTab);
    // Off screen, it waits at the nearest edge, so cargo never goes unnoticed.
    const x = Math.min(0.94, Math.max(0.06, spot.x));
    const y = Math.min(0.92, Math.max(0.2, spot.y));
    this.supplyTab.classList.toggle("edge", !spot.visible);
    const at = layerPlacer(this.pinLayer)(x, y);
    this.supplyTab.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  /**
   * Resources flying from a producer's tab, or the supply ship's, up into their pills in the top
   * bar, a few icons for each, and the pill giving a little bump as they land.
   */
  flowResources(from: string, gains: Partial<Purse>): void {
    const source = from === "supply" ? this.supplyTab : this.collectTabs.get(from);
    const start = source?.getBoundingClientRect();
    if (!start) return;
    let delay = 0;
    for (const r of RESOURCES) {
      const amount = gains[r] ?? 0;
      const target = this.resourceItems.get(r)?.root;
      if (amount < 1 || !target) continue;
      const end = target.querySelector(".crew-resource-icon")?.getBoundingClientRect();
      if (!end) continue;
      const count = Math.min(8, 3 + Math.floor(Math.log10(amount)));
      for (let i = 0; i < count; i++) {
        const coin = icon(RESOURCE_ICON[r], "crew-flow-icon");
        document.body.append(coin);
        const x0 = start.left + start.width / 2 + (Math.random() - 0.5) * 30;
        const y0 = start.top + start.height / 2 + (Math.random() - 0.5) * 20;
        const x1 = end.left + end.width / 2;
        const y1 = end.top + end.height / 2;
        const flight = coin.animate(
          [
            { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
            { transform: `translate(${x0}px, ${y0 - 30}px) scale(1.1)`, opacity: 1, offset: 0.25 },
            { transform: `translate(${x1}px, ${y1}px) scale(0.7)`, opacity: 1 },
          ],
          {
            duration: 750,
            delay: delay + i * 70,
            easing: "cubic-bezier(0.55, 0, 0.75, 0.3)",
            fill: "both",
          },
        );
        flight.onfinish = () => {
          coin.remove();
          target.classList.remove("bump");
          void target.offsetWidth;
          target.classList.add("bump");
        };
      }
      delay += 120;
    }
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
      /** What's still wanted before it can be upgraded. */
      needs: readonly string[];
    } | null,
    canRemove: boolean,
  ): void {
    this.selecting = info !== null;
    if (info) openSoftly(this.selection);
    else closeSoftly(this.selection);
    this.drawer.style.display = info ? "none" : "";
    this.buildButton.style.display = info ? "none" : "";
    this.fitMapButton();
    if (info) {
      if (info.type !== this.selectedType) showBuildingIcon(this.selectionImg, info.type);
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
      const needs = info.needs.join("|");
      if (needs !== this.shownNeeds) {
        this.shownNeeds = needs;
        const shown = info.needs.slice(0, MOST_NEEDS).map((n) => el("span", "crew-need", n));
        const more = info.needs.length - MOST_NEEDS;
        if (more > 0) shown.push(el("span", "crew-need", `${more} more`));
        this.selectionNeeds.replaceChildren(...shown);
      }
      if (info.upgrade !== this.shownUpgrade) {
        this.shownUpgrade = info.upgrade;
        const costText = info.upgrade.startsWith("Next: ") ? info.upgrade.slice(6) : null;
        this.upgradeCost.replaceChildren(
          costText ? costChips(costText) : el("span", "cost-text", info.upgrade),
        );
      }
      this.upgradeButton.disabled = !info.canUpgrade;
      const lab = info.type === "laboratory";
      this.labButton.style.display = lab ? "" : "none";
      this.upgradeButton.style.display = lab ? "none" : "";
      this.labButton.disabled = info.level === 0;
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
