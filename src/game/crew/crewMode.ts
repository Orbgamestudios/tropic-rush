// The crew island screen: touch and mouse handling, placing and moving buildings, and keeping
// this phone's layout in step with the crew server.
// Drag empty ground to pan, pinch or scroll to zoom, tap a building to select it, then drag it.
// Tap a thicket, rock or boulder to see what clearing it takes.

import type { BuildingType } from "../logic/buildings";
import { BUILDINGS } from "../logic/buildings";
import {
  applyOp,
  buildBlocker,
  builderCount,
  buildingAtTile,
  buildJobOn,
  type CrewLayout,
  capacity,
  clearBlocker,
  clearCost,
  clearGives,
  clearTime,
  cornerFor,
  firstHqAllowing,
  fits,
  gunboatWeapons,
  hqLevel,
  hqNeeds,
  type LayoutOp,
  MAX_TOOL_LEVEL,
  OBSTACLE_KINDS,
  obstacleAtTile,
  obstacleById,
  type PlacedBuilding,
  production,
  researchBlocker,
  researchCost,
  restoreBlocker,
  sanitizeLayout,
  settle,
  statueAtTile,
  TOOL_ORDER,
  TOOLS,
  type Tool,
  tileAt,
  toolBlocker,
  toolCost,
  toolJob,
  toolTime,
  tryOp,
  upgradeBlocker,
  weaponUpBlocker,
  workerCount,
} from "../logic/crewIsland";
import { CRYSTAL_KINDS, type CrystalKind } from "../logic/crystals";
import {
  allowedCount,
  buildTime,
  costFor,
  costText,
  formatAmount,
  formatDuration,
  levelCap,
  nextLevelGain,
  PROGRESSION,
  type Purse,
  RESOURCES,
} from "../logic/economy";
import {
  ABILITIES,
  ABILITY_ORDER,
  type Ability,
  MAX_WEAPON_LEVEL,
  WEAPON_GAIN,
  weaponUpGold,
} from "../logic/gunboat";
import type { HeroKind } from "../logic/heroes";
import { HERO_NAMES, heroesAt, heroesJoining } from "../logic/heroProgress";
import { randomSeed } from "../logic/island";
import { type NightRaid, nextRaidTime, nightNumber, runNightRaid } from "../logic/nightRaid";
import {
  type Blueprint,
  blueprintName,
  DEFENSE_BLUEPRINTS,
  isWeapon,
  needsBlueprint,
} from "../logic/spoils";
import { STATUE_CRYSTALS, STATUE_STONE, STATUES, statueBefore } from "../logic/statues";
import { distance, vec } from "../logic/vec";
import { dailyTribute, retakeIslands } from "../logic/worldMap";
import { type ConnectionStatus, CrewClient, requestCrewCode } from "../net/crewClient";
import {
  CREW_CODE_PATTERN,
  cleanName,
  type Hold,
  type Member,
  normalizeCrewCode,
} from "../net/protocol";
import { CrewIslandView } from "../render/crewIslandView";
import type { Stage } from "../render/stage";
import { loadLocalLayout, type SaveData, writeLocalLayout } from "../save";
import { CrewUi, type ResearchRow } from "../ui/crewUi";
import { sfx } from "../ui/kit/fx";

interface Drag {
  kind: "place" | "move";
  building: PlacedBuilding;
  pointerId: number;
  valid: boolean;
  overIsland: boolean;
  /** Tile offset from the building's corner to where it was grabbed. */
  grab: { x: number; y: number };
}

type Gesture =
  | {
      kind: "pending";
      startX: number;
      startY: number;
      hitId: string | null;
      obstacleId: string | null;
      hero: HeroKind | null;
      statue: boolean;
    }
  | { kind: "pan" }
  | { kind: "pinch"; distance: number; midX: number; midY: number };

const TAP_DISTANCE = 10;
/** The most nights of retaking caught up on at once, for a phone that's been away a while. */
const MOST_NIGHTS = 7;

export function newId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export interface CrewModeHost {
  save(): SaveData;
  updateSave(changes: Partial<SaveData>): void;
  onMenu(): void;
  onProfile(): void;
  onMap(): void;
  /** A hero was tapped: open them up. */
  onHero(kind: HeroKind): void;
  /** A hero's upgrade tree was asked for, at the laboratory. */
  onTree(kind: HeroKind): void;
  /** Sends a change to the crew's server, while the island isn't open to do it. */
  sendOp(op: LayoutOp): void;
  onReplay(raid: NightRaid): void;
}

export class CrewMode {
  private view: CrewIslandView | null = null;
  private layout: CrewLayout = sanitizeLayout(null);
  private client: CrewClient | null = null;
  private status: ConnectionStatus | "solo" = "solo";
  private members: Member[] = [];
  private holds: Hold[] = [];
  private selectedId: string | null = null;
  /** The obstacle whose clearing panel is open. */
  private clearingId: string | null = null;
  private drag: Drag | null = null;
  private gesture: Gesture | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private readonly ui: CrewUi;
  /** Server clock minus this phone's clock (milliseconds), from the last state message. */
  private clockOffset = 0;
  /** Seconds until the resource readouts refresh. */
  private refreshIn = 0;
  /** A night's raid is waiting to run, as soon as the crew's real island is here. */
  private nightDue = false;

  constructor(
    private readonly stage: Stage,
    private readonly surface: HTMLElement,
    private readonly labelLayer: HTMLElement,
    uiLayer: HTMLElement,
    private readonly host: CrewModeHost,
  ) {
    this.ui = new CrewUi(uiLayer, {
      onMenu: () => host.onMenu(),
      onProfile: () => host.onProfile(),
      onMap: () => host.onMap(),
      onHeroes: () => {
        const { hero, unlocked } = host.save();
        host.onHero(unlocked.includes(hero) ? hero : "rifleman");
      },
      onCreate: (name) => void this.createCrew(name),
      onJoin: (name, code) => this.joinCrew(name, code),
      onOffline: (name) => this.goOffline(name),
      onChipDown: (type, event) => this.startPlacing(type, event),
      onRotate: () => this.rotateSelected(),
      onRemove: () => this.removeSelected(),
      onUpgrade: () => this.upgradeSelected(),
      onDone: () => this.select(null),
      onClear: () => this.clearSelected(),
      onClearCancel: () => this.showClearing(null),
      onToolsPanel: () => this.showToolsPanel(),
      onToolUp: (tool) => this.upgradeTool(tool),
      onNightPanel: () => this.showNightPanel(),
      onNightRaidNow: () => this.raidNow(),
      onNightReplay: () => {
        const raid = this.host.save().nightRaid;
        if (raid) host.onReplay(raid);
      },
      onStatuesPanel: () => this.showStatues(),
      onStatueGive: (kind) => this.giveCrystals(kind),
      onStatueRestore: (kind) => this.restoreStatue(kind),
      onLabPanel: () => this.showLabPanel(),
      onResearch: (type) => this.research(type),
      onWeaponUp: (weapon) => this.weaponUp(weapon),
      onLabTree: (kind) => {
        this.ui.hideLab();
        host.onTree(kind);
      },
    });
    surface.addEventListener("pointerdown", (e) => this.onDown(e));
    surface.addEventListener("pointermove", (e) => this.onMove(e));
    surface.addEventListener("pointerup", (e) => this.onUp(e));
    surface.addEventListener("pointercancel", (e) => this.onUp(e));
    surface.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.view?.camera.zoom(e.deltaY > 0 ? 1.12 : 0.89);
    });
    window.addEventListener("pointermove", (e) => {
      if (this.drag?.kind === "place" && e.pointerId === this.drag.pointerId)
        this.updateDrag(e.clientX, e.clientY);
    });
    window.addEventListener("pointerup", (e) => {
      if (this.drag?.kind === "place" && e.pointerId === this.drag.pointerId) this.finishDrag();
    });
    window.addEventListener("pointercancel", (e) => {
      // The browser took the touch over (e.g. to scroll the build bar): drop the placement.
      if (this.drag?.kind === "place" && e.pointerId === this.drag.pointerId) {
        this.drag = null;
        this.view?.showPreview(null);
      }
    });
  }

  /** Read-only view of the island for automated tests (`?testhooks`). */
  snapshot(): { layout: CrewLayout; members: Member[]; status: string; code: string } {
    return {
      layout: this.layout,
      members: this.members,
      status: this.status,
      code: this.host.save().crewCode,
    };
  }

  /** Makes a change to the island from a test, straight through the usual rules. */
  applyForTest(op: LayoutOp): boolean {
    return this.commit(op);
  }

  /** Brings a statue to light from a test, and looks at it. */
  findForTest(kind: CrystalKind): void {
    const { statues } = this.layout;
    this.layout = {
      ...this.layout,
      statues: { ...statues, [kind]: { ...statues[kind], found: true } },
    };
    this.view?.lookAtStatue(this.layout, kind);
    if (this.view) this.view.camera.distance = 34;
  }

  /** Moves the island's camera from a test. */
  lookForTest(x: number, y: number, distance: number): void {
    this.view?.camera.lookAt(x, y);
    if (this.view) this.view.camera.distance = distance;
  }

  /** Runs the island's clock on from a test, so what would take days happens now. */
  skipForTest(ms: number): void {
    this.clockOffset += ms;
    this.refreshEconomy();
  }

  get active(): boolean {
    return this.view !== null;
  }

  enter(): void {
    this.view = new CrewIslandView(this.stage, this.labelLayer);
    this.stage.scene.add(this.view.root);
    this.surface.style.display = "block";
    this.ui.show(true);
    this.layout = sanitizeLayout(loadLocalLayout());
    this.select(null);
    const save = this.host.save();
    // Home is always open: with a crew it syncs, otherwise it's this phone's own island until
    // the player starts or joins a crew from the crew button.
    if (save.crewCode && save.nickname) this.connect();
    else this.status = "solo";
    this.refreshTop();
    this.nightDue = true;
    if (this.status === "solo") {
      this.bankLoot();
      this.runDueRaid();
    }
    if (save.wins === 0) this.ui.flash("Tap a hero to upgrade them and go raiding");
  }

  /**
   * If a raid night has passed since this phone last looked, that raid happens now. With a crew it
   * waits for the crew's island to arrive, since that's what the raiders land on, and whichever
   * crewmate's phone gets there first is the one whose report counts.
   */
  private runDueRaid(): void {
    if (!this.nightDue) return;
    this.nightDue = false;
    const save = this.host.save();
    const night = nightNumber(Date.now());
    if (save.nightChecked === night) return;
    // A brand new phone starts counting tonight rather than being raided on arrival.
    if (save.nightChecked === 0) {
      this.host.updateSave({ nightChecked: night });
      return;
    }
    const nightRaid = runNightRaid(settle(this.layout, this.now()), night, night * 31 + 7);
    this.host.updateSave({ nightChecked: night, nightRaid });
    const { stolen, reward } = nightRaid.report;
    this.commit({ kind: "night", night, stolen, reward });
    this.showNightPanel();
    this.payTribute(save.nightChecked, night);
    this.loseIslands(save.nightChecked, night);
  }

  /** The player islands the crew holds pay a little gold for each day that's passed. */
  private payTribute(from: number, to: number): void {
    const days = Math.min(MOST_NIGHTS, to - from);
    const gold = dailyTribute(this.host.save().world) * days;
    if (gold <= 0) return;
    const { loot } = this.host.save();
    this.host.updateSave({ loot: { ...loot, gold: (loot.gold ?? 0) + gold } });
    this.bankLoot();
  }

  /**
   * Who's available goes by the crew's headquarters and nothing else: new heroes join as soon as
   * it reaches their level, and a hero it hasn't reached yet isn't kept, whatever a save says.
   */
  private welcomeHeroes(save: SaveData): void {
    const hq = hqLevel(this.layout);
    const available = heroesAt(hq);
    if (available.length === save.unlocked.length && heroesJoining(save.unlocked, hq).length === 0)
      return;
    const joining = heroesJoining(save.unlocked, hq);
    const hero = available.includes(save.hero) ? save.hero : "rifleman";
    this.host.updateSave({ unlocked: available, hero });
    if (joining.length === 0) return;
    this.ui.flash(`${joining.map((k) => HERO_NAMES[k]).join(" and ")} joined the crew!`);
    sfx.levelUp();
  }

  /**
   * Gold from when every player had their own moves onto the island, as much as there's room for
   * each time, so none of it's lost to a small store.
   */
  private bankOldGold(): void {
    const { gold } = this.host.save();
    if (gold <= 0) return;
    const stock = settle(this.layout, this.now()).resources.gold;
    const room = Math.floor(capacity(this.layout).gold - stock);
    const moved = Math.min(gold, room);
    if (moved <= 0 || !this.commit({ kind: "loot", purse: { gold: moved } })) return;
    this.host.updateSave({ gold: gold - moved });
  }

  /** The island's gold, which is everyone's. */
  gold(): number {
    return Math.floor(settle(this.layout, this.now()).resources.gold);
  }

  /** Pays for a crystal trade with the island's gold. */
  payForSwap(): boolean {
    return this.commit({ kind: "crystalSwap" });
  }

  /** Buys a hero upgrade with the island's gold, for the whole crew. */
  payForUpgrade(hero: HeroKind, id: string): boolean {
    return this.commit({ kind: "heroUpgrade", hero, id, pay: true });
  }

  /** The crew's island as the server last said, for while the island itself isn't on screen. */
  heard(layout: CrewLayout, serverNow: number): void {
    if (this.client) return;
    this.clockOffset = serverNow - Date.now();
    this.layout = sanitizeLayout(layout, this.now());
    writeLocalLayout(this.layout);
  }

  /** Each night since the last look, raiders may have retaken some of the crew's islands. */
  private loseIslands(from: number, to: number): void {
    let { world } = this.host.save();
    const lost: string[] = [];
    const hq = hqLevel(this.layout);
    for (let night = Math.max(from + 1, to - MOST_NIGHTS + 1); night <= to; night++) {
      const result = retakeIslands(world, night, hq);
      world = result.world;
      lost.push(...result.lost);
    }
    if (lost.length === 0) return;
    this.host.updateSave({ world, lostIslands: lost });
    this.ui.flash(`Raiders retook ${lost.join(" and ")}!`);
  }

  /**
   * Hands what's been brought back from raids over to the crew: materials into their stock, as much
   * as it'll hold, and blueprints into what the whole crew knows.
   */
  bankLoot(): void {
    this.bankOldGold();
    const { loot, blueprints } = this.host.save();
    for (const type of blueprints) this.commit({ kind: "blueprint", type });
    if (blueprints.length > 0) this.host.updateSave({ blueprints: [] });
    if (Object.keys(loot).length === 0) return;
    const before = settle(this.layout, this.now()).resources;
    if (!this.commit({ kind: "loot", purse: loot })) return;
    this.host.updateSave({ loot: {} });
    const after = this.layout.resources;
    const left: Partial<Purse> = {};
    for (const r of RESOURCES) {
      const lost = Math.floor(before[r] + (loot[r] ?? 0) - after[r]);
      if ((loot[r] ?? 0) > 0 && lost > 0) left[r] = lost;
    }
    this.ui.flash(
      Object.keys(left).length > 0
        ? `Storage full: ${costText(left)} left behind`
        : `Brought home ${costText(loot)}`,
    );
  }

  private showNightPanel(): void {
    const { raidLog } = this.layout;
    this.ui.showNight(this.host.save().nightRaid, nextRaidTime(Date.now()), raidLog);
  }

  /** Opens the statues panel, or brings it up to date. */
  private showStatues(current = settle(this.layout, this.now())): void {
    const { crystals } = this.host.save();
    this.ui.showStatues(
      CRYSTAL_KINDS.map((kind) => {
        const s = current.statues[kind];
        const info = STATUES[kind];
        const before = statueBefore(kind);
        const hunting = before === null || current.statues[before].found;
        const working = s.doneAt !== null && !s.restored;
        const blocker = restoreBlocker(current, kind);
        const room = STATUE_CRYSTALS - s.crystals;
        return {
          kind,
          name: info.name,
          found: s.found,
          restored: s.restored,
          text: s.found
            ? info.boon
            : hunting
              ? `Old carvings tell of it ${info.clue}.`
              : "Find the statue before it first.",
          status: !s.found
            ? ""
            : s.restored
              ? "Restored"
              : working
                ? `Being restored: ${formatDuration((s.doneAt ?? 0) - this.now())} left`
                : `${s.crystals} of ${STATUE_CRYSTALS} crystals · ${formatAmount(STATUE_STONE)} stone · 2 days`,
          crystals: s.crystals,
          need: STATUE_CRYSTALS,
          have: crystals[kind],
          canGive: !working && !s.restored && s.found && room > 0 && crystals[kind] > 0,
          canRestore: !working && blocker === null,
          blocker:
            !s.found || working || s.restored || s.crystals < STATUE_CRYSTALS ? null : blocker,
        };
      }),
    );
  }

  /** Gives a statue as many of the player's crystals as it still needs. */
  private giveCrystals(kind: CrystalKind): void {
    const save = this.host.save();
    const room = STATUE_CRYSTALS - this.layout.statues[kind].crystals;
    const crystals = Math.min(room, save.crystals[kind]);
    if (crystals <= 0 || !this.commit({ kind: "offer", statue: kind, crystals })) return;
    this.host.updateSave({
      crystals: { ...save.crystals, [kind]: save.crystals[kind] - crystals },
    });
    sfx.coin();
    this.showStatues();
  }

  private restoreStatue(kind: CrystalKind): void {
    const result = tryOp(this.layout, { kind: "restore", statue: kind }, this.now());
    if ("error" in result) {
      this.ui.flash(result.error);
      return;
    }
    this.commit({ kind: "restore", statue: kind });
    this.ui.flash(`${STATUES[kind].name}: the work has begun`);
    this.ui.celebrate();
    this.showStatues();
  }

  /** Runs a raid on the island as it stands, and goes straight to watching it. */
  private raidNow(): void {
    const nightRaid = runNightRaid(
      settle(this.layout, this.now()),
      nightNumber(Date.now()),
      randomSeed(),
    );
    this.host.updateSave({ nightRaid });
    this.ui.hideNight();
    this.host.onReplay(nightRaid);
  }

  /** Back from a replay: shows how it went. */
  showNightResult(): void {
    this.showNightPanel();
  }

  exit(): void {
    this.client?.close();
    this.client = null;
    if (this.view) {
      this.stage.scene.remove(this.view.root);
      this.view.dispose();
      this.view = null;
    }
    this.drag = null;
    this.gesture = null;
    this.pointers.clear();
    this.surface.style.display = "none";
    this.ui.show(false);
    this.ui.hideJoin();
    this.ui.hideNight();
    this.ui.hideStatues();
  }

  frame(dt: number, time: number): void {
    if (!this.view) return;
    const save = this.host.save();
    const others = this.holds.filter((h) => h.memberId !== save.memberId);
    const hidden = this.drag?.kind === "move" ? this.drag.building.id : null;
    this.view.sync(this.layout, hidden, others);
    this.welcomeHeroes(save);
    this.view.syncHeroes(this.host.save().unlocked, this.layout);
    const selected = this.selected();
    this.view.showSelection(this.drag ? null : (selected ?? null));
    this.view.update(dt, time);
    this.ui.placeJobPins(this.view.jobPins(this.layout, this.now()));
    this.refreshIn -= dt;
    if (this.refreshIn <= 0) {
      this.refreshIn = 0.25;
      this.refreshEconomy();
    }
  }

  /** The server's clock right now, as best this phone knows it (milliseconds). */
  private now(): number {
    return Date.now() + this.clockOffset;
  }

  /** Updates the resource bar, the build buttons' costs and limits, and the upgrade button. */
  private refreshEconomy(): void {
    const current = settle(this.layout, this.now());
    if (current.builds.length !== this.layout.builds.length) this.finishedBuilding(current);
    this.noticeStatues(current);
    // Finished clearing: the patch comes away with a burst of leaves or chips.
    if (current.jobs.length !== this.layout.jobs.length) {
      for (const job of this.layout.jobs) {
        if (current.jobs.some((j) => j.id === job.id)) continue;
        const o = obstacleById(job.id);
        if (o) this.view?.burst(o);
        if (o) this.ui.flash(`${OBSTACLE_KINDS[o.kind].label} cleared!`);
      }
      this.layout = current;
      writeLocalLayout(current);
    }
    if (this.ui.toolsOpen) this.showToolsPanel(current);
    if (this.ui.labOpen) this.showLabPanel(current);
    if (this.ui.statuesOpen) this.showStatues(current);
    this.ui.setResources(current.resources, capacity(current), production(current));
    const hq = hqLevel(current);
    this.ui.setChips((type) => {
      const have = current.buildings.filter((b) => b.type === type).length;
      const allowed = allowedCount(type, hq);
      const unlockAt = firstHqAllowing(type);
      const noPlans = needsBlueprint(type) && !current.researched.includes(type);
      const found = current.blueprints.includes(type);
      return {
        have,
        allowed,
        cost: costText(costFor(type, 1)),
        locked: noPlans
          ? found
            ? "Research"
            : "Blueprint"
          : allowed === 0
            ? `HQ ${unlockAt ?? "–"}`
            : null,
        blocked: buildBlocker(current, type) !== null,
      };
    });
    this.refreshSelection(current);
    this.refreshClearing(current);
    this.view?.showUpgradable(
      current,
      new Set(
        current.buildings.filter((b) => upgradeBlocker(current, b) === null).map((b) => b.id),
      ),
    );
  }

  /** The big moments: a statue comes to light, or finishes being restored. */
  private noticeStatues(current: CrewLayout): void {
    for (const kind of CRYSTAL_KINDS) {
      const was = this.layout.statues[kind];
      const now = current.statues[kind];
      if (now.found && !was.found) {
        this.view?.lookAtStatue(current, kind);
        this.ui.flash(`You found the ${STATUES[kind].name}!`);
        this.ui.celebrate();
        this.layout = current;
        writeLocalLayout(current);
        this.showStatues(current);
      } else if (now.restored && !was.restored) {
        this.view?.lookAtStatue(current, kind);
        this.ui.flash(`The ${STATUES[kind].name} is restored! ${STATUES[kind].boon}`);
        this.ui.celebrate();
        this.layout = current;
        writeLocalLayout(current);
      }
    }
  }

  /** Says what's just been finished, and takes the finished layout on. */
  private finishedBuilding(current: CrewLayout): void {
    const done: string[] = [];
    for (const job of this.layout.builds) {
      if (job.doneAt > this.now()) continue;
      if ("tool" in job.target) {
        const { tool } = job.target;
        done.push(`${TOOLS[tool].label} improved to level ${current.tools[tool]}!`);
      } else {
        const { building } = job.target;
        const b = current.buildings.find((x) => x.id === building);
        if (b) done.push(`${BUILDINGS[b.type].label} is ready: level ${b.level}`);
      }
    }
    // Back after a while, several may have finished at once: one message, not a blur of them.
    if (done.length > 0) {
      this.ui.flash(done.length === 1 ? (done[0] ?? "") : `${done.length} jobs finished`);
      this.ui.celebrate();
    }
    this.layout = current;
    writeLocalLayout(current);
  }

  // -------------------------------------------------------------------------------------------
  // Crew membership

  private ensureMember(name: string): string | null {
    const clean = cleanName(name);
    if (!clean) {
      this.ui.showJoin(name, "Pick a nickname first");
      return null;
    }
    const save = this.host.save();
    this.host.updateSave({ nickname: clean, memberId: save.memberId || newId() });
    return clean;
  }

  private async createCrew(name: string): Promise<void> {
    if (!this.ensureMember(name)) return;
    const code = await requestCrewCode();
    if (!code) {
      this.ui.showJoin(
        name,
        "Couldn't reach the crew server. Try again, or build offline for now.",
      );
      return;
    }
    this.host.updateSave({ crewCode: code });
    this.ui.hideJoin();
    this.connect();
    this.ui.flash(`Crew ${code} created: tap the code to share it`);
  }

  private joinCrew(name: string, rawCode: string): void {
    if (!this.ensureMember(name)) return;
    const code = normalizeCrewCode(rawCode);
    if (!CREW_CODE_PATTERN.test(code)) {
      this.ui.showJoin(name, "Crew codes are 6 letters and numbers");
      return;
    }
    this.host.updateSave({ crewCode: code });
    this.ui.hideJoin();
    this.connect();
  }

  private goOffline(name: string): void {
    if (!this.ensureMember(name)) return;
    this.host.updateSave({ crewCode: "" });
    writeLocalLayout(this.layout);
    this.ui.hideJoin();
    this.status = "solo";
    this.refreshTop();
  }

  private connect(): void {
    const save = this.host.save();
    this.client?.close();
    this.status = "connecting";
    this.client = new CrewClient(save.crewCode, save.memberId, save.nickname, save.avatar, {
      onState: (layout, members, holds, by, serverNow) => {
        this.clockOffset = serverNow - Date.now();
        this.layout = sanitizeLayout(layout, this.now());
        writeLocalLayout(this.layout);
        this.members = members;
        this.holds = holds;
        if (this.selectedId && !this.layout.buildings.some((b) => b.id === this.selectedId))
          this.select(null);
        if (by && by !== this.host.save().nickname) this.refreshSelection();
        this.refreshTop();
        this.bankLoot();
        this.runDueRaid();
      },
      onReject: (reason) => {
        if (reason !== "Already counted") this.ui.flash(reason);
      },
      onStatus: (status) => {
        this.status = status;
        if (status === "full") {
          this.host.updateSave({ crewCode: "" });
          this.ui.showJoin(this.host.save().nickname, "That crew already has 5 members.");
        }
        // No server to wait for: the raiders land on the island as this phone has it.
        if (status === "offline") this.runDueRaid();
        this.refreshTop();
      },
    });
    this.refreshTop();
  }

  private refreshTop(): void {
    const save = this.host.save();
    const connected = this.status === "online";
    // Without a line to the crew there's nobody to say who's online, this player included.
    const members = (
      this.members.length > 0
        ? this.members
        : [{ id: save.memberId, name: save.nickname, avatar: save.avatar, online: connected }]
    ).map((m) => ({
      ...m,
      avatar: m.id === save.memberId ? save.avatar : m.avatar,
      online: connected && m.online,
    }));
    this.ui.setCrew(save.crewCode, members);
  }

  /** The player's picture or name has changed: tells the crew, and redraws the bar. */
  profileChanged(): void {
    const save = this.host.save();
    if (this.view && save.crewCode && save.nickname) this.connect();
    this.refreshTop();
  }

  /** Shares the crew's invite code. */
  shareCode(): void {
    this.ui.shareCode();
  }

  /** Opens the panel for starting or joining a crew. */
  showJoin(): void {
    this.ui.showJoin(this.host.save().nickname);
  }

  // -------------------------------------------------------------------------------------------
  // Changes

  private commit(op: LayoutOp): boolean {
    const next = applyOp(this.layout, op, this.now());
    if (!next) return false;
    this.layout = next;
    writeLocalLayout(next);
    if (this.client) this.client.sendOp(op);
    else this.host.sendOp(op);
    return true;
  }

  private heldByOther(id: string): Hold | undefined {
    const me = this.host.save().memberId;
    return this.holds.find((h) => h.buildingId === id && h.memberId !== me);
  }

  private selected(): PlacedBuilding | undefined {
    return this.layout.buildings.find((b) => b.id === this.selectedId);
  }

  private select(id: string | null): void {
    if (id) this.showClearing(null);
    this.selectedId = id;
    this.refreshSelection();
  }

  private showClearing(id: string | null): void {
    if (id) this.select(null);
    this.clearingId = id;
    this.view?.highlightObstacle(id);
    this.refreshClearing();
  }

  private refreshClearing(current = settle(this.layout, this.now())): void {
    const o = this.clearingId ? obstacleById(this.clearingId) : undefined;
    if (!o || current.cleared.includes(o.id)) {
      if (this.clearingId) {
        this.clearingId = null;
        this.view?.highlightObstacle(null);
      }
      this.ui.setClearing(null);
      return;
    }
    const spec = OBSTACLE_KINDS[o.kind];
    const tool = current.tools[spec.tool];
    const job = current.jobs.find((j) => j.id === o.id);
    this.ui.setClearing({
      label: spec.label,
      tier: o.tier,
      tool: `${TOOLS[spec.tool].label} ${o.tier}`,
      time: formatDuration(job ? job.doneAt - this.now() : clearTime(o, tool)),
      running: job !== undefined,
      workers: `${current.jobs.length}/${workerCount(current)}`,
      cost: costText(clearCost(o)),
      gives: costText(clearGives(o)),
      blocker: clearBlocker(current, o),
    });
  }

  private showToolsPanel(current = settle(this.layout, this.now())): void {
    this.ui.showTools(
      TOOL_ORDER.map((tool) => {
        const job = toolJob(current, tool);
        const blocker = toolBlocker(current, tool);
        return {
          tool,
          label: TOOLS[tool].label,
          level: current.tools[tool],
          max: MAX_TOOL_LEVEL,
          cost: costText(toolCost(tool, current.tools[tool])),
          blocker: job ? `Improving: ${formatDuration(job.doneAt - this.now())}` : blocker,
          time: formatDuration(toolTime(current.tools[tool])),
        };
      }),
      `Workers: ${current.jobs.length} of ${workerCount(current)} busy. Builders: ${current.builds.length} of ${builderCount(current)} busy`,
    );
  }

  private showLabPanel(current = settle(this.layout, this.now())): void {
    const arsenal = gunboatWeapons(current);
    const rows: ResearchRow[] = [...ABILITY_ORDER, ...DEFENSE_BLUEPRINTS].map((type) => {
      const level = isWeapon(type) ? arsenal[type] : undefined;
      if (isWeapon(type) && level) {
        const blocker = weaponUpBlocker(current, type);
        const top = level >= MAX_WEAPON_LEVEL;
        return {
          type,
          name: `${ABILITIES[type].name} ${level}`,
          note: top ? "Highest level" : (blocker ?? WEAPON_GAIN[type]),
          cost: top ? "" : costText({ gold: weaponUpGold(level) }),
          done: top,
          blocker,
          action: "Upgrade",
        };
      }
      const done = current.researched.includes(type);
      const blocker = researchBlocker(current, type);
      const found = current.blueprints.includes(type);
      const what = isWeapon(type) ? ABILITIES[type].text : "Lets the crew build it.";
      return {
        type,
        name: blueprintName(type),
        note: done ? "Researched" : found ? (blocker ?? what) : "Find its blueprint on a raid",
        cost: found && !done ? costText(researchCost(type)) : "",
        done,
        blocker,
        action: "Research",
      };
    });
    this.ui.showLab(rows, this.host.save().unlocked);
  }

  private weaponUp(weapon: Ability): void {
    const result = tryOp(this.layout, { kind: "weaponUp", weapon }, this.now());
    if ("error" in result) {
      this.ui.flash(result.error);
      return;
    }
    this.commit({ kind: "weaponUp", weapon });
    const level = gunboatWeapons(this.layout)[weapon];
    this.ui.flash(`${ABILITIES[weapon].name} is now level ${level}!`);
    this.ui.celebrate();
    this.refreshEconomy();
    this.showLabPanel();
  }

  private research(type: Blueprint): void {
    const result = tryOp(this.layout, { kind: "research", type }, this.now());
    if ("error" in result) {
      this.ui.flash(result.error);
      return;
    }
    this.commit({ kind: "research", type });
    this.ui.flash(`${blueprintName(type)} researched!`);
    this.ui.celebrate();
    this.refreshEconomy();
    this.showLabPanel();
  }

  private upgradeTool(tool: Tool): void {
    if (this.commit({ kind: "toolUp", tool })) {
      this.ui.flash(`${TOOLS[tool].label}: work started`);
      this.refreshEconomy();
      this.showToolsPanel();
    }
  }

  private clearSelected(): void {
    const o = this.clearingId ? obstacleById(this.clearingId) : undefined;
    if (!o) return;
    const result = tryOp(this.layout, { kind: "clear", id: o.id }, this.now());
    if ("error" in result) {
      this.ui.flash(result.error);
      return;
    }
    this.commit({ kind: "clear", id: o.id });
    this.ui.flash(`${OBSTACLE_KINDS[o.kind].label}: work started`);
    this.showClearing(null);
    this.refreshEconomy();
  }

  private refreshSelection(current = settle(this.layout, this.now())): void {
    const b = current.buildings.find((o) => o.id === this.selectedId);
    if (!b) {
      this.ui.setSelection(null, false);
      return;
    }
    const holder = this.heldByOther(b.id);
    const cap = levelCap(b.type, hqLevel(current));
    const max = PROGRESSION[b.type].maxLevel;
    const blocker = upgradeBlocker(current, b);
    const job = buildJobOn(current, b.id);
    const left = job ? formatDuration(job.doneAt - this.now()) : "";
    const detail = holder
      ? `${holder.name} is moving it`
      : job
        ? b.level === 0
          ? `Going up: ${left} left`
          : `Upgrading to level ${b.level + 1}: ${left} left`
        : b.level >= max
          ? `Level ${b.level}, the highest`
          : `Level ${b.level} of ${b.type === "headquarters" ? max : cap}. Next: ${nextLevelGain(b.type, b.level)}, ${formatDuration(buildTime(b.type, b.level + 1))}`;
    const upgrade = job
      ? left
      : b.level >= max
        ? "Fully upgraded"
        : blocker === "Upgrade the headquarters first"
          ? "Upgrade the HQ first"
          : `Next: ${costText(costFor(b.type, b.level + 1))}`;
    const needs =
      b.type === "headquarters" && !job && b.level < max
        ? hqNeeds(current, b.level + 1).filter((n) => n.have < n.need)
        : [];
    this.ui.setSelection(
      {
        type: b.type,
        label: `${BUILDINGS[b.type].label}`,
        level: b.level,
        detail,
        upgrade,
        canUpgrade: blocker === null,
        needs: needs.map((n) => n.text),
      },
      b.type !== "headquarters",
    );
  }

  private upgradeSelected(): void {
    const b = this.selected();
    if (!b) return;
    const result = tryOp(this.layout, { kind: "upgrade", id: b.id }, this.now());
    if ("error" in result) {
      this.ui.flash(result.error);
      return;
    }
    this.commit({ kind: "upgrade", id: b.id });
    this.ui.flash(
      `${BUILDINGS[b.type].label}: ${formatDuration(buildTime(b.type, b.level + 1))} to level ${b.level + 1}`,
    );
    this.refreshEconomy();
  }

  private rotateSelected(): void {
    const b = this.selected();
    if (!b) return;
    if (this.heldByOther(b.id)) {
      this.ui.flash("A crewmate is moving that");
      return;
    }
    if (!this.commit({ kind: "move", id: b.id, x: b.x, y: b.y, rotated: !b.rotated })) {
      this.ui.flash("No room to turn it here");
    }
  }

  private removeSelected(): void {
    const b = this.selected();
    if (!b || b.type === "headquarters") return;
    if (this.heldByOther(b.id)) {
      this.ui.flash("A crewmate is moving that");
      return;
    }
    if (this.commit({ kind: "remove", id: b.id })) this.select(null);
  }

  // -------------------------------------------------------------------------------------------
  // Placing and moving

  private startPlacing(type: BuildingType, event: PointerEvent): void {
    if (!this.view) return;
    this.select(null);
    const blocker = buildBlocker(settle(this.layout, this.now()), type);
    if (blocker) {
      this.ui.flash(blocker);
      return;
    }
    this.drag = {
      kind: "place",
      building: { id: newId(), type, x: 0, y: 0, rotated: false, level: 0 },
      pointerId: event.pointerId,
      valid: false,
      overIsland: false,
      grab: { x: 0, y: 0 },
    };
  }

  private updateDrag(clientX: number, clientY: number): void {
    const drag = this.drag;
    if (!drag || !this.view) return;
    const ground = this.view.camera.groundPoint(
      clientX,
      clientY,
      this.stage.renderer.domElement.getBoundingClientRect(),
    );
    drag.overIsland = ground !== null && !this.ui.overBar(clientY);
    if (!ground || !drag.overIsland) {
      this.view.showPreview(null);
      return;
    }
    const corner = cornerFor(drag.building.type, drag.building.rotated, ground);
    if (drag.kind === "move") {
      const tile = tileAt(ground);
      corner.x = tile.x - drag.grab.x;
      corner.y = tile.y - drag.grab.y;
    }
    drag.building = { ...drag.building, x: corner.x, y: corner.y };
    drag.valid =
      drag.kind === "place"
        ? applyOp(this.layout, { kind: "place", building: drag.building }, this.now()) !== null
        : fits(this.layout, drag.building);
    this.view.showPreview({ building: drag.building, valid: drag.valid });
  }

  private finishDrag(): void {
    const drag = this.drag;
    this.drag = null;
    this.view?.showPreview(null);
    if (!drag) return;
    if (drag.kind === "move") {
      this.client?.hold(null);
      const original = this.layout.buildings.find((b) => b.id === drag.building.id);
      const moved = original && (original.x !== drag.building.x || original.y !== drag.building.y);
      if (drag.overIsland && drag.valid && moved) {
        this.commit({
          kind: "move",
          id: drag.building.id,
          x: drag.building.x,
          y: drag.building.y,
          rotated: drag.building.rotated,
        });
      } else if (drag.overIsland && !drag.valid) {
        this.ui.flash("That doesn't fit there");
      }
      return;
    }
    if (!drag.overIsland) {
      // A tap on the build bar (or dropping back onto it): place it at the nearest free spot.
      this.placeNearCenter(drag.building);
      return;
    }
    if (drag.valid && this.commit({ kind: "place", building: drag.building }))
      this.select(drag.building.id);
    else this.ui.flash("That doesn't fit there");
  }

  private placeNearCenter(building: PlacedBuilding): void {
    if (!this.view) return;
    const focus = this.view.camera.focus;
    const start = cornerFor(building.type, false, vec(focus.x, focus.z));
    for (let radius = 0; radius < 50; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const candidate = { ...building, x: start.x + dx, y: start.y + dy };
          if (fits(this.layout, candidate) && this.commit({ kind: "place", building: candidate })) {
            this.select(candidate.id);
            return;
          }
        }
      }
    }
    this.ui.flash("No free space left for that");
  }

  private onDown(e: PointerEvent): void {
    if (!this.view || this.drag) return;
    this.surface.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      if (a && b) {
        this.gesture = {
          kind: "pinch",
          distance: distance(a, b),
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2,
        };
      }
      return;
    }
    const ground = this.view.camera.groundPoint(
      e.clientX,
      e.clientY,
      this.stage.renderer.domElement.getBoundingClientRect(),
    );
    const hit = ground ? buildingAtTile(this.layout, tileAt(ground)) : undefined;
    if (ground && hit && hit.id === this.selectedId && !this.heldByOther(hit.id)) {
      const tile = tileAt(ground);
      this.drag = {
        kind: "move",
        building: { ...hit },
        pointerId: e.pointerId,
        valid: true,
        overIsland: true,
        grab: { x: tile.x - hit.x, y: tile.y - hit.y },
      };
      this.client?.hold(hit.id);
      this.view.showPreview({ building: hit, valid: true });
      return;
    }
    const obstacle = ground && !hit ? obstacleAtTile(this.layout, tileAt(ground)) : undefined;
    const statue = ground && !hit && !obstacle ? statueAtTile(this.layout, tileAt(ground)) : null;
    const rect = this.stage.renderer.domElement.getBoundingClientRect();
    this.gesture = {
      kind: "pending",
      startX: e.clientX,
      startY: e.clientY,
      hitId: hit?.id ?? null,
      obstacleId: obstacle?.id ?? null,
      hero: this.view.heroAt(e.clientX - rect.left, e.clientY - rect.top),
      statue: Boolean(statue && this.layout.statues[statue].found),
    };
  }

  private onMove(e: PointerEvent): void {
    const last = this.pointers.get(e.pointerId);
    if (!last || !this.view) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.drag?.kind === "move" && e.pointerId === this.drag.pointerId) {
      this.updateDrag(e.clientX, e.clientY);
      return;
    }
    const gesture = this.gesture;
    if (gesture?.kind === "pinch" && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const d = distance(a, b);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      if (d > 0) this.view.camera.zoom(gesture.distance / d);
      this.view.camera.pan(midX - gesture.midX, midY - gesture.midY);
      this.gesture = { kind: "pinch", distance: d, midX, midY };
      return;
    }
    if (gesture?.kind === "pending") {
      if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) < TAP_DISTANCE) return;
      this.gesture = { kind: "pan" };
    }
    if (this.gesture?.kind === "pan") this.view.camera.pan(dx, dy);
  }

  private onUp(e: PointerEvent): void {
    if (this.drag?.kind === "move" && e.pointerId === this.drag.pointerId) {
      this.pointers.delete(e.pointerId);
      this.finishDrag();
      return;
    }
    const gesture = this.gesture;
    if (gesture?.kind === "pending" && this.pointers.size === 1 && e.type === "pointerup") {
      if (gesture.hero) this.host.onHero(gesture.hero);
      else if (gesture.statue) this.showStatues();
      else if (gesture.obstacleId) this.showClearing(gesture.obstacleId);
      else {
        this.showClearing(null);
        this.select(gesture.hitId);
      }
    }
    this.pointers.delete(e.pointerId);
    this.gesture =
      this.pointers.size === 1 ? { kind: "pan" } : this.pointers.size === 0 ? null : this.gesture;
  }
}
