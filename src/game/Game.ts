// Runs the app. It opens straight onto the crew island (home), which leads to hero select (the
// hero on a pedestal) and the raid itself (HUD, pause, results), and back home again. Each frame
// it reads the controls, advances the rules in fixed steps, and draws the result.

import * as THREE from "three";
import { haptic, setHaptics } from "./audio/haptics";
import { music, type Track } from "./audio/music";
import { playRaidEvents } from "./audio/raidSounds";
import { loadSamples } from "./audio/samples";
import { COMBAT_ZOOM_DISTANCE, MAX_FRAME_SECONDS, RESULTS_DELAY, SIM_STEP } from "./config";
import { type ControlMode, Controls } from "./controls";
import { CrewMode, newId } from "./crew/crewMode";
import { guessedPlace, locate, skyText } from "./location";
import { passwordProblem, usernameProblem } from "./logic/account";
import { BUILDINGS, type BuildingType } from "./logic/buildings";
import { createCoopRaid, MAX_SEATS, type Seat } from "./logic/coop";
import { gunboatWeapons, hqLevel, type LayoutOp } from "./logic/crewIsland";
import { addCrystals, type CrystalKind, payCrystals, swapCrystals } from "./logic/crystals";
import { RAIDERS } from "./logic/difficulty";
import { allowedCount, emptyPurse, PROGRESSION, type Purse, RESOURCES } from "./logic/economy";
import { enemyBase, generateIsland, rivalIsland, scoutReport } from "./logic/enemyBase";
import { HERO_KINDS, type HeroKind } from "./logic/heroes";
import { raidReward } from "./logic/heroProgress";
import { heroMods, noUpgrades, readOwned, type TreeUpgrade, trimUpgrades } from "./logic/heroTrees";
import { BASE_CENTER, HOME_SHAPE, type IslandLayout } from "./logic/island";
import { archetypeFor } from "./logic/islandShapes";
import { type NightRaid, nightIsland, startNightRaid, stepNightRaid } from "./logic/nightRaid";
import { puzzleFor } from "./logic/puzzles";
import {
  canBoard,
  createRaid,
  destructionPercent,
  type HeroInput,
  IDLE_INPUT,
  type RaidBuilding,
  type RaidEvent,
  type RaidHero,
  type RaidState,
  stepRaid,
} from "./logic/raid";
import { shipAtSea } from "./logic/raiderShip";
import {
  type Blueprint,
  blueprintName,
  DEFENSE_BLUEPRINTS,
  nextWeapon,
  rollSpoils,
  type Spoils,
} from "./logic/spoils";
import { statueBuffs } from "./logic/statues";
import type { Place } from "./logic/sun";
import { packShards, readShards, type Shards, type TimePower } from "./logic/timeShards";
import { angleOf, distance, lerp, vec } from "./logic/vec";
import {
  beatRival,
  islandSpot,
  type MapIsland,
  raiderHome,
  settleRivals,
  shipSpot,
  takeIsland,
  worldIslands,
} from "./logic/worldMap";
import { logIn, logOut, pullSave, pushSave, signUp, verifyPassword } from "./net/account";
import { CoopSession, HOST_TIMEOUT } from "./net/coopSession";
import { CrewClient } from "./net/crewClient";
import type { Member, RaidMessage } from "./net/protocol";
import { fetchRivals, reportRaid } from "./net/world";
import { loadBuildingKit, STAGES } from "./render/buildingKit";
import { CameraRig } from "./render/cameraRig";
import { DangerMap } from "./render/dangerMap";
import { AT_EASE, type HeroMove } from "./render/heroAnimator";
import { heroModel } from "./render/models";
import { setSolidPlants, updateWind } from "./render/props";
import { RaidView } from "./render/raidView";
import { loadRigs } from "./render/riggedHeroes";
import { Showcase } from "./render/showcase";
import { Stage } from "./render/stage";
import { buildingIcon, heroPortrait } from "./render/thumbnails";
import { WorldMapView } from "./render/worldMap";
import {
  type AccountSession,
  clearPhone,
  loadAccount,
  loadOtherAccounts,
  loadPlace,
  loadSave,
  resetGame,
  restoreBundle,
  type SaveData,
  type Settings,
  saveBundle,
  writeAccount,
  writeOtherAccounts,
  writePlace,
  writeSave,
} from "./save";
import { ControlsEditor } from "./ui/controlsEditor";
import { CrystalSwap } from "./ui/crystalSwap";
import { HeroSelect } from "./ui/heroSelect";
import { Hud } from "./ui/hud";
import { audioContext, sfx } from "./ui/kit/fx";
import { WorldLabels } from "./ui/labels";
import { PauseMenu } from "./ui/pause";
import { ProfileScreen } from "./ui/profileScreen";
import { RaidLobby } from "./ui/raidLobby";
import { ReplayBar } from "./ui/replayBar";
import { ResultsScreen } from "./ui/results";
import { ScoutScreen } from "./ui/scoutScreen";
import { SkyCard } from "./ui/skyCard";
import { TimeTint } from "./ui/timeTint";
import { UpgradeTree } from "./ui/upgradeTree";
import { type CrewRaid, WorldMapScreen } from "./ui/worldMapScreen";

type Phase = "heroes" | "tree" | "map" | "scout" | "raid" | "ended" | "crew" | "replay";

/** A crewmate's raid, as this phone last heard about it. */
interface HeardRaid {
  raidId: string;
  name: string;
  island: MapIsland | null;
  raiding: boolean;
  /** Seconds since the last word of it. */
  age: number;
}

/** How long a crewmate's raid stays on the map after the last word of it, in seconds. */
const RAID_HEARD_SECONDS = 8;
/** How often a phone heading out says so to its crew, in seconds. */
const RALLY_EVERY = 3;

/**
 * Trims a frame that's a whisker off a whole number of rule steps. Timers wobble by a millisecond
 * or so, and on a steady screen that would otherwise run no step one frame and two the next, which
 * looks like a stutter however fast the phone is.
 */
function steadied(seconds: number): number {
  const steps = Math.round(seconds / SIM_STEP);
  return steps > 0 && Math.abs(seconds - steps * SIM_STEP) < FRAME_WOBBLE
    ? steps * SIM_STEP
    : seconds;
}

/** Who's on a raid together, and which of them this phone is. */
interface Team {
  raidId: string;
  seats: Seat[];
  seat: number;
}

/** How far off a frame can be, in seconds, and still count as a whole number of steps. */
const FRAME_WOBBLE = 0.002;

/** How often a signed-in phone checks whether the save has changed. */
const SYNC_SECONDS = 20;
/** How long the crew island gets before the game asks about the phone's location. */
const SKY_CARD_MS = 12_000;

/** Players stop being told how to stop firing after this many wins. */
const HINT_WINS = 3;

/** The slowest the picture needs to run in a fight, and on a screen nobody's touching. */
const CALM_FRAME_MS = 1000 / 30;
const FRAME_SLACK_MS = 2;
/** Screens with so little on them that they can be sharper for less than a fight costs. */
const LIGHT_PHASES: readonly string[] = ["heroes", "tree", "map"];
/** How long after the last touch a screen counts as sitting still. */
const CALM_AFTER_MS = 1500;

/** Set while a phone restarts to add an account, so it opens on the sign-in screen. */
const OPEN_PROFILE_KEY = "tropic-rush:open-profile";

/** The HUD updates once in this many frames. */
const HUD_EVERY = 3;

function layer(parent: HTMLElement, className: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = className;
  parent.append(div);
  return div;
}

export class Game {
  private readonly stage: Stage;
  private readonly tint: TimeTint;
  private readonly rig: CameraRig;
  private readonly labels: WorldLabels;
  private readonly controls: Controls;
  private readonly controlsEditor: ControlsEditor;
  private readonly mapView: WorldMapView;
  private readonly mapScreen: WorldMapScreen;
  private readonly scout: ScoutScreen;
  private dangerMap: DangerMap | null = null;
  private mapHero: HeroKind = "rifleman";
  private treeHero: HeroKind = "rifleman";
  private raidTarget: MapIsland | null = null;
  /** The upgrade tree was opened at the laboratory, so that's where it goes back to. */
  private treeFromLab = false;
  /** The island picked to attack, while the hero screen asks who's going. */
  private attacking: MapIsland | null = null;
  /** Regions the last win opened: their cloud lifts next time the map is shown. */
  private reveal: string | null = null;
  /** Which of the raid's heroes is this phone's player. */
  private seat = 0;
  /** The line to the crew's server for teaming up, kept open on every screen. */
  private link: CrewClient | null = null;
  private linkFor = "";
  private crewMembers: Member[] = [];
  private readonly lobbyView: RaidLobby;
  /** The raid being got together, before it starts. No island until the host has picked one. */
  private lobby: {
    raidId: string;
    island: MapIsland | null;
    seats: Seat[];
    /** Who's scouted the island and readied up. */
    ready: string[];
    host: string;
  } | null = null;
  /** The raid this phone is heading out on, which the crew hears about from the first moment. */
  private rallyId = "";
  /** The island being looked over, while scouting. */
  private scouting: MapIsland | null = null;
  /** Crewmates' raids this phone has heard about, by who's leading them. */
  private readonly crewRaids = new Map<string, HeardRaid>();
  /** The crewmate whose raid the banner is offering. */
  private invite: string | null = null;
  /** Raids the player has already said no to. */
  private readonly passedOn = new Set<string>();
  private rallyIn = 0;
  private coop: CoopSession | null = null;
  private spoils: Spoils | null = null;
  /** What the raid brought back, statues included. */
  private carried: Purse = emptyPurse();
  private readonly profile: ProfileScreen;
  private account: AccountSession | null = loadAccount();
  /** What the account last stored, to send only what's new. */
  private syncedBundle = saveBundle();
  private syncIn = SYNC_SECONDS;
  private treeIn = 0;
  private syncing = false;
  /** What the crew's server last said its heroes have, while there's a crew. */
  private crewUpgrades: Record<HeroKind, string[]> | null = null;
  /** This phone's game is being swapped for another. */
  private leaving = false;
  /** When the screen was last touched. */
  private touched = 0;
  private hudFrames = 0;
  private stopHinted = false;
  private baseTaken = false;
  /** What the player's hero was locked onto last frame, to feel a new lock land. */
  private lockedOn: number | null = null;
  private hudTime = 0;
  private readonly replay: ReplayBar;
  private replaySpeed = 1;
  private readonly hud: Hud;
  private readonly heroes: HeroSelect;
  private readonly tree: UpgradeTree;
  private readonly crystalSwap: CrystalSwap;
  private readonly results: ResultsScreen;
  private readonly pause: PauseMenu;
  private readonly skyCard: SkyCard;
  private readonly showcase: Showcase;
  private readonly crew: CrewMode;
  private readonly wipe: HTMLDivElement;
  private save: SaveData = loadSave();
  private phase: Phase = "crew";
  private paused = false;
  private state: RaidState | null = null;
  private playerDown = false;
  private view: RaidView | null = null;
  private islandLevel = 1;
  private controlMode: ControlMode = "off";
  private accumulator = 0;
  private last = performance.now();
  private time = 0;
  /** When to show the results screen (performance.now() milliseconds). */
  private resultsAt = 0;
  private resultShown = false;
  private retreated = false;

  constructor(private readonly container: HTMLElement) {
    this.stage = new Stage(container);
    this.tint = new TimeTint(container);
    this.rig = new CameraRig(this.stage);
    this.labels = new WorldLabels(layer(container, "labels"));
    this.controls = new Controls(
      layer(container, "controls"),
      this.rig,
      this.stage.renderer.domElement,
    );
    this.hud = new Hud(container, {
      onBoat: () => this.controls.pressBoat(),
      onAbility: (ability) => this.controls.selectAbility(ability),
      onPause: () => this.setPaused(true),
      onShard: (power) => this.controls.pressTimePower(power),
    });
    const screens = layer(container, "screens");
    this.showcase = new Showcase(this.stage);
    this.heroes = new HeroSelect(screens, this.showcase, {
      save: () => this.save,
      gold: () => this.crew.gold(),
      update: (changes) => this.updateSave(changes),
      onBack: () => this.go(() => (this.attacking ? this.showMap(this.mapHero) : this.goHome())),
      onStart: (hero) => this.go(() => this.setOff(hero)),
      onUpgrades: (hero) => this.go(() => this.showTree(hero)),
      onTrade: () => this.crystalSwap.show(true),
    });
    this.tree = new UpgradeTree(screens, {
      onTrade: () => this.crystalSwap.show(true),
      save: () => this.save,
      gold: () => this.crew.gold(),
      hq: () => hqLevel(this.crew.snapshot().layout),
      buy: (kind, upgrade) => this.buyUpgrade(kind, upgrade),
      onBack: () =>
        this.go(() =>
          this.treeFromLab ? this.goHome() : this.showHeroes(this.treeHero, this.attacking),
        ),
    });
    this.crystalSwap = new CrystalSwap(screens, {
      save: () => this.save,
      gold: () => this.crew.gold(),
      swap: (from, to) => this.swapCrystals(from, to),
      onTraded: () => (this.phase === "tree" ? this.tree.refresh() : this.heroes.refresh()),
    });
    this.results = new ResultsScreen(screens, {
      onAgain: () => this.go(() => this.showMap(this.save.hero)),
      onHeroes: () => this.go(() => this.showHeroes()),
      onHome: () => this.go(() => this.goHome()),
    });
    this.pause = new PauseMenu(screens, {
      onResume: () => (this.phase === "crew" ? this.pause.show(false) : this.setPaused(false)),
      onRetreat: () => {
        this.setPaused(false);
        this.retreat();
      },
      settings: () => this.save.settings,
      onSettings: (settings) => this.setSettings(settings),
      sky: () => ({
        times: skyText(this.stage.sky.now(), this.skyPlace()),
        here: Boolean(loadPlace()),
      }),
      onSkyLocation: () => this.toggleSkyLocation(),
      onEditControls: () => {
        this.pause.show(false, this.phase !== "crew");
        this.controlsEditor.show(true);
      },
      username: () => this.account?.username ?? null,
      checkPassword: (password) => this.checkPassword(password),
      onResetGame: () => void this.startOver(),
    });
    this.controlsEditor = new ControlsEditor(container, {
      settings: () => this.save.settings,
      onSettings: (settings) => this.setSettings(settings),
      onClose: () => this.pause.showSettings(),
    });
    this.mapView = new WorldMapView(this.stage);
    this.mapScreen = new WorldMapScreen(screens, {
      onAttack: (island) => this.attack(island),
      onScout: (island) => this.go(() => this.startScout(island)),
      onTeamUp: (island) => this.openLobby(island),
      onReturn: () => this.go(() => this.goHome()),
      onJoinCrew: (id) => this.joinRaid(id),
      blueprintsOn: (island) => this.blueprintsOn(island),
      onHome: () => this.mapView.lookAt(0, 0),
      onPan: (dx, dy) => this.mapView.pan(dx, dy),
      onZoom: (factor) => this.mapView.zoom(factor),
      screen: (x, y) => this.mapView.screen(x, y),
      moves: () => this.mapView.moves,
      crewOnline: () => this.crewOnline(),
    });
    this.lobbyView = new RaidLobby(screens, {
      onJoin: () => {
        if (this.invite) this.joinRaid(this.invite);
      },
      onDismiss: () => {
        const raid = this.invite ? this.crewRaids.get(this.invite) : undefined;
        if (raid) this.passedOn.add(raid.raidId);
        this.invite = null;
        this.lobbyView.invite(null);
      },
      onScout: () => this.scoutLobby(),
      onLeave: () => this.leaveLobby(),
      onHero: (hero) => this.changeLobbyHero(hero),
    });
    this.scout = new ScoutScreen(screens, {
      onAttack: (island) => this.attack(island),
      onReady: (ready) => this.setReady(ready),
      onBack: () =>
        this.go(() => {
          this.showMap(this.mapHero);
          this.drawLobby();
        }),
      onPan: (dx, dy) => this.rig.pan(dx, dy),
      onZoom: (factor) => this.rig.scoutZoom(factor),
      onTap: (x, y) => this.scoutTap(x, y),
    });
    this.profile = new ProfileScreen(screens, {
      save: () => this.save,
      username: () => this.account?.username ?? null,
      onChange: (changes) => {
        this.updateSave(changes);
        this.crew.profileChanged();
      },
      onSignUp: (username, password) => this.createAccount(username, password),
      onLogIn: (username, password) => this.signIn(username, password),
      onLogOut: () => this.signOut(),
      otherAccounts: () => loadOtherAccounts().map((s) => s.username),
      onSwitch: (username) => this.switchAccount(username),
      onAddAccount: () => this.addAccount(),
      onShare: () => this.crew.shareCode(),
      onCrew: () => {
        this.profile.show(false);
        this.crew.showJoin();
      },
      onClose: () => this.profile.show(false),
    });
    this.replay = new ReplayBar(screens, {
      onSpeed: (speed) => {
        this.replaySpeed = speed;
      },
      onSkip: () => this.go(() => this.endReplay()),
    });
    const rotate = layer(container, "rotate");
    rotate.textContent = "Turn your phone sideways to play";
    this.crew = new CrewMode(
      this.stage,
      layer(container, "crew-surface"),
      layer(container, "labels"),
      layer(container, "crew-layer"),
      {
        save: () => this.save,
        updateSave: (changes) => this.updateSave(changes),
        onMenu: () => this.pause.show(true, false),
        onProfile: () => this.profile.show(true),
        onMap: () =>
          this.go(() => {
            if (this.crew.active) this.crew.exit();
            const { hero, unlocked } = this.save;
            this.showMap(unlocked.includes(hero) ? hero : "rifleman");
          }),
        onHero: (kind) => this.go(() => this.showHeroes(kind)),
        onTree: (kind) =>
          this.go(() => {
            if (this.crew.active) this.crew.exit();
            this.showTree(kind);
            this.treeFromLab = true;
          }),
        sendOp: (op) => this.link?.sendOp(op),
        onReplay: (raid) => this.go(() => this.startReplay(raid)),
        onStrikeBack: (raid) => {
          if (!raid.ship) return;
          const home = raiderHome(raid.ship, raid.night, raid.report.stolen);
          if (this.crew.active) this.crew.exit();
          this.mapHero = this.save.unlocked.includes(this.save.hero) ? this.save.hero : "rifleman";
          this.attack(home);
        },
      },
    );
    this.wipe = layer(container, "wipe");

    this.applySettings();
    // iPhones only allow sound once the player has touched the screen.
    const startAudio = () => {
      audioContext();
      loadSamples();
      music.unlock();
    };
    window.addEventListener("pointerdown", startAudio);
    this.syncLink();
    void this.pullAccount();
    if (sessionStorage.getItem(OPEN_PROFILE_KEY)) {
      sessionStorage.removeItem(OPEN_PROFILE_KEY);
      this.profile.show(true);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void this.pushAccount();
    });
    this.enterCrew();
    if (!this.save.crewCode) this.trimHeroes();
    const params = new URLSearchParams(location.search);
    this.stage.sky.setPlace(this.skyPlace());
    this.skyCard = new SkyCard(screens, (share) => void this.answerSkyCard(share));
    if (loadPlace() === undefined && !params.has("testhooks")) this.offerSkyCard();
    if (params.has("testhooks")) this.installTestHooks();
    this.stage.holdQuality = params.has("fullquality");
    void loadRigs();
    void loadBuildingKit();
    for (const type of ["pointerdown", "pointermove", "wheel"]) {
      window.addEventListener(type, () => (this.touched = performance.now()), {
        capture: true,
        passive: true,
      });
    }
    requestAnimationFrame(this.frame);
  }

  /** Where the sky is for: the phone's real place if it's shared one, or else its time zone's. */
  private skyPlace(): Place {
    return loadPlace() ?? guessedPlace();
  }

  /** Waits for a quiet moment on the crew island to ask about the phone's location. */
  private offerSkyCard(): void {
    const offer = () => {
      if (this.phase === "crew") this.skyCard.show();
      else setTimeout(offer, SKY_CARD_MS);
    };
    setTimeout(offer, SKY_CARD_MS);
  }

  private async answerSkyCard(share: boolean): Promise<void> {
    writePlace(share ? await locate() : null);
    this.stage.sky.setPlace(this.skyPlace());
  }

  private async toggleSkyLocation(): Promise<void> {
    this.skyCard.hide();
    writePlace(loadPlace() ? null : await locate());
    this.stage.sky.setPlace(this.skyPlace());
  }

  /**
   * For automated tests only (`?testhooks` in the URL): read the state, place the hero and
   * fast-forward the rules, since a software-rendered test browser is too slow to play.
   */
  private installTestHooks(): void {
    const hooks = {
      state: () => this.state,
      crew: () => this.crew.snapshot(),
      openHeroes: () => this.showHeroes(),
      save: () => this.save,
      /** Shows this hour of a day (today unless told), or the real time again for null. */
      sky: (hour: number | null, place?: Place, date?: string) => {
        if (place) this.stage.sky.setPlace(place);
        const moment = date ? new Date(`${date}T00:00:00`) : new Date();
        moment.setHours(Math.floor(hour ?? 0), ((hour ?? 0) % 1) * 60, 0, 0);
        this.stage.sky.holdClock(hour === null ? null : moment.getTime());
      },
      /** What one frame costs the graphics chip, across every pass. */
      drawn: () => this.stage.frameCost(),
      /** Joins a crew without the sign-up panel. */
      joinCrew: (crewCode: string, nickname: string, memberId: string) => {
        this.updateSave({ crewCode, nickname, memberId });
        this.crew.profileChanged();
      },
      /** Changes the save, and stores it on the account straight away. */
      syncNow: (changes: Partial<SaveData>) => {
        this.updateSave(changes);
        return this.pushAccount();
      },
      online: () => this.crewOnline(),
      seat: () => this.seat,
      /** Makes a change to the crew's island, the way a real one would arrive. */
      crewOp: (op: LayoutOp) => this.crew.applyForTest(op),
      /** Skips the island's clock on, finishing whatever would be done by then. */
      crewAhead: (ms: number) => this.crew.skipForTest(ms),
      /** Brings a statue to light, without months of clearing first. */
      findStatue: (kind: CrystalKind) => this.crew.findForTest(kind),
      findHourglass: (mended = false) => this.crew.findHourglassForTest(mended),
      /** Points the home island's camera at a spot. */
      crewLook: (x: number, y: number, distance: number) => this.crew.lookForTest(x, y, distance),
      /** Scouts any island there is, for looking at how it comes out. */
      visit: (seed: number, hq: number, standIn = false) => {
        const hero = this.save.hero;
        this.mapHero = hero;
        const [any] = worldIslands(this.save.world, hq).filter((i) => !i.rival === !standIn);
        if (!any) return;
        const rival = any.rival && { ...any.rival, hq };
        const rated = {
          ...any,
          seed,
          hq,
          rival,
          archetype: archetypeFor(seed, hq),
          puzzle: rival ? null : puzzleFor(seed, hq),
        };
        if (this.crew.active) this.crew.exit();
        this.startScout(rated);
      },
      /** Has the hero on the pedestal run, aim or fall, for looking at how they move. */
      heroPose: (move: Partial<HeroMove>, closeUp = true) => {
        this.showcase.move = { ...AT_EASE, ...move };
        this.showcase.closeUp = closeUp;
      },
      /** Puts the raid copy of each hero on the pedestal, not the detailed one. */
      heroRaidCopy: (on: boolean) => {
        this.showcase.raidCopy = on;
      },
      /** Brings the camera right up to the hero on the pedestal: how far off, and how high. */
      heroLook: (distance: number, height: number) => {
        this.showcase.look = { distance, height };
      },
      /** What a hero takes to draw in a raid, before shadows double it. */
      heroCost: (kind: HeroKind) => {
        let calls = 0;
        let triangles = 0;
        heroModel(kind).root.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const { index, attributes } = o.geometry as THREE.BufferGeometry;
          calls++;
          triangles += (index?.count ?? attributes.position?.count ?? 0) / 3;
        });
        return { calls, triangles };
      },
      /** The picture on screen right now, drawn afresh, as an image. */
      snapshot: () => {
        this.stage.render();
        return this.stage.renderer.domElement.toDataURL("image/jpeg", 0.92);
      },
      /** Starts a raid with any hero, even one who can't go alone, for looking at them in one. */
      raidAs: (kind: HeroKind) => {
        const [island] = worldIslands(this.save.world, 1).filter((i) => !i.taken && !i.rival);
        if (!island) return;
        if (this.crew.active) this.crew.exit();
        this.startRaid(kind, island);
      },
      /** Has the hero on the pedestal fire or throw once. */
      heroShot: () => this.showcase.shot(),
      /** Wins the raid at once, for looking at what a win gives. */
      win: () => {
        const hq = this.state?.buildings.find((b) => b.type === "headquarters");
        if (hq && this.state) {
          hq.hp = 0;
          hq.destroyed = true;
          this.state.status = "won";
        }
      },
      /** Holds this phone's move stick over, for testing a raid from outside it. */
      holdMove: (x: number, y: number) => this.controls.holdMove(x, y),
      /** Sets off a blast by the player, for looking at effects. */
      boom: (x: number, y: number, radius: number) => {
        const { state, view } = this;
        if (!state || !view) return;
        const hero = this.player();
        const pos = vec((hero?.pos.x ?? 0) + x, (hero?.pos.y ?? 0) + y);
        view.handleEvents([{ type: "explosion", pos, radius }], state);
      },
      /** Pictures of every stage of a modeled building, first to last, once the models are in. */
      stagePictures: async (type: BuildingType) => {
        await loadBuildingKit();
        const most = PROGRESSION[type].maxLevel;
        return Array.from({ length: STAGES }, (_, i) =>
          buildingIcon(type, Math.ceil(((i + 1) * most) / STAGES)),
        );
      },
      teleport: (x: number, y: number) => {
        const hero = this.player();
        if (hero) hero.pos = vec(x, y);
      },
      advance: (seconds: number, input: Partial<HeroInput> = {}) => {
        for (let t = 0; t < seconds && this.phase === "raid" && this.state; t += SIM_STEP) {
          stepRaid(this.state, this.inputs({ ...IDLE_INPUT, ...input }), SIM_STEP);
          this.view?.handleEvents(this.state.events, this.state);
          playRaidEvents(this.state.events, this.state, this.player());
        }
      },
    };
    Object.assign(window, { tropicRush: hooks });
  }

  /** Camera tilt and zoom, UI size and sound, from the save. */
  private applySettings(): void {
    const s = this.save.settings;
    this.rig.tilt = s.tilt;
    this.rig.zoom = s.zoom;
    this.rig.behind = s.camera === "behind";
    this.container.style.setProperty("--ui-scale", String(s.uiScale));
    this.controls.uiScale = s.uiScale;
    this.controls.setLayout(s.controls);
    sfx.setMuted(s.muted);
    music.setMuted(s.musicMuted);
    sfx.setVolume(s.soundVolume);
    music.setVolume(s.musicVolume);
    setHaptics(s.haptics);
    this.stage.setGraphics(s.graphics);
    setSolidPlants(s.graphics === "ultra");
  }

  /** The track for wherever the player is now. */
  private trackForPhase(): Track | null {
    switch (this.phase) {
      case "crew":
      case "heroes":
      case "tree":
        return "heroes";
      case "map":
        return "map";
      case "scout":
        return "scout";
      case "raid":
        return "raid";
      case "replay":
        return "night";
      case "ended":
        return this.state?.status === "won" ? "win" : null;
    }
  }

  private setSettings(settings: Settings): void {
    this.updateSave({ settings });
    this.applySettings();
  }

  /** Takes the time shards this player used, and their retries the crew used, off their stash. */
  private spendShards(events: readonly RaidEvent[]): void {
    const me = this.player()?.id;
    if (me === undefined || this.phase !== "raid") return;
    let shards: Shards | null = null;
    const spend = (power: TimePower) => {
      shards ??= { ...this.save.shards };
      shards[power] = Math.max(0, (shards[power] ?? 0) - 1);
    };
    for (const e of events) {
      if (e.type === "timePower" && e.heroId === me) spend(e.power);
      if (e.type === "retried" && e.spentFrom === me) spend("retry");
    }
    if (shards) this.updateSave({ shards });
  }

  private updateSave(changes: Partial<SaveData>): void {
    this.save = { ...this.save, ...changes };
    if (!this.leaving) writeSave(this.save);
    this.syncLink();
  }

  // -------------------------------------------------------------------------------------------
  // Accounts

  private setAccount(session: AccountSession | null): void {
    this.account = session;
    writeAccount(session);
  }

  private async createAccount(username: string, password: string): Promise<string | null> {
    const problem = usernameProblem(username) ?? passwordProblem(password);
    if (problem) return problem;
    // The name they signed up with is a good name for the crew to see, if they've not picked one.
    const { nickname, memberId } = this.save;
    this.updateSave({ nickname: nickname || username, memberId: memberId || newId() });
    const result = await signUp(username, password, saveBundle());
    if (!result.ok) return result.error;
    this.setAccount({ token: result.token, username: result.username, syncedAt: result.savedAt });
    this.syncedBundle = saveBundle();
    this.crew.profileChanged();
    return null;
  }

  private async signIn(username: string, password: string): Promise<string | null> {
    if (!username || !password) return "Enter your name and password";
    const result = await logIn(username, password);
    if (!result.ok) return result.error;
    this.setAccount({ token: result.token, username: result.username, syncedAt: result.savedAt });
    writeOtherAccounts(loadOtherAccounts().filter((s) => s.username !== result.username));
    // The account's progress takes over this phone, so start again from it.
    this.stopWriting();
    if (!result.save || !restoreBundle(result.save)) clearPhone(this.save.settings);
    location.reload();
    return null;
  }

  /** Before this phone's game is swapped: nothing left running to write the old one back. */
  private stopWriting(): void {
    if (this.crew.active) this.crew.exit();
    this.leaving = true;
  }

  private async checkPassword(password: string): Promise<string | null> {
    const { account } = this;
    if (!account) return null;
    if (!password) return "Enter your password";
    const result = await verifyPassword(account.token, password);
    return result.ok ? null : result.error;
  }

  /** Wipes the game, on the account too, and starts again from nothing. */
  private async startOver(): Promise<void> {
    this.stopWriting();
    this.save = resetGame(this.save);
    const { account } = this;
    if (account) {
      const result = await pushSave(account.token, saveBundle());
      if (result.ok) this.setAccount({ ...account, syncedAt: result.savedAt });
    }
    location.reload();
  }

  /** Puts the game away on its account before it leaves this phone. Without a connection it can't. */
  private async storeGame(): Promise<string | null> {
    const { account } = this;
    if (!account) return null;
    const result = await pushSave(account.token, saveBundle());
    return result.ok ? null : "Can't save your game right now. Try again when you're online.";
  }

  /** Clears the game off this phone, so whoever plays here next starts fresh. */
  private async signOut(): Promise<string | null> {
    const { account } = this;
    if (!account) return null;
    const problem = await this.storeGame();
    if (problem) return problem;
    void logOut(account.token);
    this.setAccount(null);
    this.stopWriting();
    clearPhone(this.save.settings);
    location.reload();
    return null;
  }

  /** Sets this account aside, still signed in, and leaves the phone ready for another. */
  private async addAccount(): Promise<string | null> {
    const { account } = this;
    if (!account) return null;
    const problem = await this.storeGame();
    if (problem) return problem;
    writeOtherAccounts([...loadOtherAccounts(), account]);
    this.setAccount(null);
    this.stopWriting();
    clearPhone(this.save.settings);
    sessionStorage.setItem(OPEN_PROFILE_KEY, "1");
    location.reload();
    return null;
  }

  /** Stores this account's game and takes up another's, with no password. */
  private async switchAccount(username: string): Promise<string | null> {
    const others = loadOtherAccounts();
    const target = others.find((s) => s.username === username);
    if (!target) return null;
    const rest = others.filter((s) => s !== target);
    const problem = await this.storeGame();
    if (problem) return problem;
    const result = await pullSave(target.token);
    if (!result.ok) {
      if (result.offline) return "Can't reach the server right now.";
      writeOtherAccounts(rest);
      return `Log in to ${username} again: it's been a while.`;
    }
    const { account } = this;
    writeOtherAccounts(account ? [...rest, account] : rest);
    this.setAccount({ ...target, syncedAt: result.savedAt });
    this.stopWriting();
    if (!result.save || !restoreBundle(result.save)) clearPhone(this.save.settings);
    location.reload();
    return null;
  }

  /** Takes on the account's progress if another phone has moved it on since this one last synced. */
  private async pullAccount(): Promise<void> {
    const { account } = this;
    if (!account) return;
    const result = await pullSave(account.token);
    if (!result.ok || !result.save || result.savedAt <= account.syncedAt) return;
    this.setAccount({ ...account, syncedAt: result.savedAt });
    this.stopWriting();
    restoreBundle(result.save);
    location.reload();
  }

  /** Stores the save on the account, if there's anything new to store. */
  private async pushAccount(): Promise<void> {
    const { account } = this;
    if (!account || this.syncing) return;
    const bundle = saveBundle();
    if (bundle === this.syncedBundle) return;
    this.syncing = true;
    const result = await pushSave(account.token, bundle);
    this.syncing = false;
    if (!result.ok || this.account?.token !== account.token) return;
    this.syncedBundle = bundle;
    this.setAccount({ ...account, syncedAt: result.savedAt });
  }

  // -------------------------------------------------------------------------------------------
  // Teaming up

  /** Keeps a line to the crew's server, so invites reach the player wherever they are. */
  private syncLink(): void {
    const { crewCode, memberId, nickname } = this.save;
    const { avatar } = this.save;
    const wanted = crewCode && nickname ? `${crewCode}|${memberId}|${nickname}|${avatar}` : "";
    if (wanted === this.linkFor) return;
    this.linkFor = wanted;
    this.link?.close();
    this.link = null;
    this.crewMembers = [];
    if (!wanted) return;
    this.link = new CrewClient(crewCode, memberId, nickname, avatar, {
      onState: (layout, members, _holds, _by, serverNow) => {
        this.crewMembers = members;
        this.crewUpgrades = layout.upgrades;
        this.crew.heard(layout, serverNow);
        this.trimHeroes();
        this.shareUpgrades();
      },
      onReject: () => {},
      onStatus: () => {},
      onRelay: (from, data) => this.onRelay(from, data),
    });
  }

  /**
   * A crew's heroes are everyone's: this phone takes on what the others have bought, and the crew
   * gets anything it's bought itself, or brought along from before joining.
   */
  private shareUpgrades(): void {
    const crew = this.crewUpgrades;
    if (!crew) return;
    const { upgrades } = this.save;
    const hq = hqLevel(this.crew.snapshot().layout);
    const shared = noUpgrades();
    for (const kind of HERO_KINDS) {
      shared[kind] = readOwned(kind, [...crew[kind], ...upgrades[kind]], hq);
      for (const id of shared[kind]) {
        if (!crew[kind].includes(id)) this.link?.sendOp({ kind: "heroUpgrade", hero: kind, id });
      }
    }
    if (HERO_KINDS.some((k) => shared[k].length !== upgrades[k].length)) {
      this.updateSave({ upgrades: shared });
    }
  }

  /**
   * Keeps each hero's upgrades to what the headquarters allows, giving back the crystals for the
   * rest; the island gives back the gold. A crew's phone only does this with the island fresh from
   * the crew's server: a stale one could have too low a headquarters.
   */
  private trimHeroes(): void {
    const hq = hqLevel(this.crew.snapshot().layout);
    const { upgrades } = this.save;
    let { crystals } = this.save;
    const kept = noUpgrades();
    for (const kind of HERO_KINDS) {
      const { owned, refund } = trimUpgrades(kind, upgrades[kind], hq);
      kept[kind] = owned;
      crystals = addCrystals(crystals, refund.crystals);
    }
    if (HERO_KINDS.some((k) => kept[k].length !== upgrades[k].length)) {
      this.updateSave({ upgrades: kept, crystals });
    }
  }

  /** Three crystals and the island's gold for one of another kind. */
  private swapCrystals(from: CrystalKind, to: CrystalKind): boolean {
    const crystals = swapCrystals(this.save.crystals, from, to);
    if (!crystals || !this.crew.payForSwap()) return false;
    this.updateSave({ crystals });
    return true;
  }

  /** The island pays, for the crew's hero; crystals come from whoever's buying. */
  private buyUpgrade(kind: HeroKind, upgrade: TreeUpgrade): boolean {
    if (!this.crew.payForUpgrade(kind, upgrade.id)) return false;
    const { upgrades, crystals } = this.save;
    this.updateSave({
      crystals: payCrystals(crystals, upgrade.crystals),
      upgrades: { ...upgrades, [kind]: [...upgrades[kind], upgrade.id] },
    });
    return true;
  }

  private crewOnline(): number {
    const me = this.save.memberId;
    return this.crewMembers.filter((m) => m.online && m.id !== me).length;
  }

  private mySeat(hero: HeroKind): Seat {
    const { memberId, nickname, upgrades, shards, shardLoadout } = this.save;
    return {
      member: memberId,
      name: nickname,
      hero,
      upgrades: upgrades[hero],
      shards: packShards(shards, shardLoadout),
    };
  }

  private lobbyBlocker(seats: readonly Seat[]): string | null {
    return seats.every((s) => s.hero === "medic")
      ? "Somebody here has to bring a hero who can hurt buildings."
      : null;
  }

  private isHost(): boolean {
    return this.lobby?.host === this.save.memberId;
  }

  /** How many could come: everyone here, and the rest of the crew who are online. */
  private teamSize(seats: readonly Seat[]): number {
    return Math.min(MAX_SEATS, Math.max(seats.length, this.crewOnline() + 1));
  }

  /** What's holding the team up from getting ready, if anything. */
  private lobbyHold(seats: readonly Seat[]): string | null {
    if (seats.length < 2) return "Waiting for your crew to join.";
    return this.lobbyBlocker(seats);
  }

  private drawLobby(): void {
    const { lobby } = this;
    if (!lobby || this.phase === "scout") {
      this.lobbyView.hide();
      this.lobbyView.party(null);
      this.scout.setTeam(
        lobby?.island
          ? {
              have: lobby.seats.length,
              of: this.teamSize(lobby.seats),
              ready: lobby.ready.length,
              mine: lobby.ready.includes(this.save.memberId),
              waiting: this.lobbyHold(lobby.seats),
            }
          : null,
      );
      return;
    }
    const host = this.isHost();
    // The host is still choosing: the crew shows as a note over the map, not in the way of it.
    if (host && !lobby.island) {
      this.lobbyView.hide();
      const others = lobby.seats.filter((s) => s.member !== this.save.memberId);
      this.lobbyView.party(others.length > 0 ? others.map((s) => s.name).join(", ") : null);
      return;
    }
    this.lobbyView.party(null);
    this.lobbyView.show({
      island: lobby.island?.name ?? null,
      seats: lobby.seats,
      ready: lobby.ready,
      team: this.teamSize(lobby.seats),
      message: !lobby.island
        ? "Your crewmate is choosing an island."
        : (this.lobbyHold(lobby.seats) ?? "Scout the island, then ready up."),
      heroes: host ? [] : this.save.unlocked,
      mine: this.mapHero,
    });
  }

  /** Who's leading this raid, once a crew is getting together: the player, from here on. */
  private ownLobby(island: MapIsland | null): void {
    const { lobby } = this;
    const me = this.mySeat(this.mapHero);
    if (lobby && this.isHost()) {
      if (lobby.island?.id !== island?.id) lobby.ready = [];
      lobby.island = island;
      lobby.seats = [me, ...lobby.seats.slice(1)];
      return;
    }
    this.rallyId ||= `${this.save.memberId}-${Date.now().toString(36)}`;
    const host = this.save.memberId;
    this.lobby = { raidId: this.rallyId, island, seats: [me], ready: [], host };
  }

  private openLobby(island: MapIsland): void {
    this.ownLobby(island);
    this.rallyIn = 0;
    this.tellSeats();
    this.drawLobby();
  }

  private tellSeats(): void {
    const { lobby } = this;
    if (!lobby) return;
    const { raidId, seats, ready, island } = lobby;
    this.link?.relay({ k: "seats", raidId, seats, ready, island });
  }

  private withParty(): boolean {
    return Boolean(this.lobby && this.isHost() && this.lobby.seats.length > 1);
  }

  /** Attack from the map or a scout: a last look at who's going, or a team scouts and readies up. */
  private attack(island: MapIsland): void {
    if (this.withParty()) this.openLobby(island);
    else this.go(() => this.showHeroes(this.mapHero, island));
  }

  /** The hero screen's big button: on to the island if one's been picked, or else to the map. */
  private setOff(hero: HeroKind): void {
    const island = this.attacking;
    this.mapHero = hero;
    if (!island) this.showMap(hero);
    else if (this.withParty()) {
      this.showMap(hero);
      this.openLobby(island);
    } else this.startRaid(hero, island);
  }

  /** From the lobby to a look at the island, for anyone on the team. */
  private scoutLobby(): void {
    const island = this.lobby?.island;
    if (!island) return;
    this.go(() => {
      if (this.crew.active) this.crew.exit();
      this.startScout(island);
    });
  }

  /** This player's good to go, or isn't after all. The host starts it once everyone is. */
  private setReady(ready: boolean): void {
    const { lobby } = this;
    if (!lobby) return;
    this.markReady(this.save.memberId, ready);
    if (this.isHost()) this.teamChanged();
    else this.link?.relay({ k: "ready", raidId: lobby.raidId, ready }, lobby.host);
    this.drawLobby();
  }

  private markReady(member: string, ready: boolean): void {
    const { lobby } = this;
    if (!lobby) return;
    lobby.ready = lobby.ready.filter((m) => m !== member);
    if (ready) lobby.ready.push(member);
  }

  /** Tells the team how things stand, and sets off if that's everyone ready. */
  private teamChanged(): void {
    const { lobby } = this;
    if (!lobby) return;
    this.tellSeats();
    const set = lobby.seats.every((s) => lobby.ready.includes(s.member));
    if (set && !this.lobbyHold(lobby.seats)) this.startLobby();
  }

  private headingOut(): boolean {
    return this.phase === "heroes" || this.phase === "tree" || this.phase === "map";
  }

  /**
   * Tells the crew this phone's heading out, from the moment it opens its heroes, and keeps telling
   * them, so anyone who's just come online sees it too. A guest is along for someone else's raid.
   */
  private tickRally(dt: number): void {
    for (const [from, raid] of this.crewRaids) {
      raid.age += dt;
      if (raid.age <= RAID_HEARD_SECONDS) continue;
      this.crewRaids.delete(from);
      if (this.invite === from) {
        this.invite = null;
        this.lobbyView.invite(null);
      }
    }
    if (this.phase === "map") this.mapScreen.setCrewRaids(this.crewRaidList());
    const guest = (this.lobby && !this.isHost()) || (this.coop && !this.coop.isHost);
    const scouting = this.phase === "scout";
    const raiding = this.phase === "raid";
    if (guest || !(this.headingOut() || scouting || raiding)) return;
    this.rallyId ||= `${this.save.memberId}-${Date.now().toString(36)}`;
    this.rallyIn -= dt;
    if (this.rallyIn > 0) return;
    this.rallyIn = RALLY_EVERY;
    const island = raiding ? this.raidTarget : (this.lobby?.island ?? null);
    this.link?.relay({
      k: "invite",
      raidId: this.rallyId,
      host: this.save.nickname,
      island,
      raiding,
    });
  }

  /** Stands down: nobody's heading out any more. */
  private endRally(): void {
    if (!this.rallyId) return;
    this.link?.relay({ k: "cancel", raidId: this.rallyId });
    this.rallyId = "";
  }

  private crewRaidList(): CrewRaid[] {
    return [...this.crewRaids].map(([id, raid]) => ({
      id,
      name: raid.name,
      islandId: raid.island?.id ?? null,
      islandName: raid.island?.name ?? null,
      joinable: !raid.raiding,
    }));
  }

  /** Falls in with a crewmate who's heading out. */
  private joinRaid(from: string): void {
    const raid = this.crewRaids.get(from);
    if (!raid || raid.raiding) return;
    this.endRally();
    this.invite = null;
    this.lobbyView.invite(null);
    const hero = this.save.unlocked.includes(this.save.hero) ? this.save.hero : "rifleman";
    this.mapHero = hero;
    const seat = this.mySeat(hero);
    const { raidId, island } = raid;
    this.lobby = { raidId, island, seats: [seat], ready: [], host: from };
    this.drawLobby();
    this.sayJoin(seat);
  }

  private sayJoin(seat: Seat): void {
    const { lobby } = this;
    if (!lobby) return;
    const { name, hero, upgrades, shards } = seat;
    this.link?.relay({ k: "join", raidId: lobby.raidId, name, hero, upgrades, shards }, lobby.host);
  }

  /** A crewmate waiting in the lobby swaps heroes. */
  private changeLobbyHero(hero: HeroKind): void {
    const { lobby } = this;
    if (!lobby) return;
    this.mapHero = hero;
    this.updateSave({ hero });
    const seat = this.mySeat(hero);
    const mine = lobby.seats.findIndex((s) => s.member === seat.member);
    if (mine >= 0) lobby.seats[mine] = seat;
    this.markReady(seat.member, false);
    this.drawLobby();
    this.sayJoin(seat);
  }

  private leaveLobby(): void {
    const { lobby } = this;
    this.lobby = null;
    this.drawLobby();
    if (!lobby) return;
    if (lobby.host === this.save.memberId) this.link?.relay({ k: "cancel", raidId: lobby.raidId });
    else this.link?.relay({ k: "leave", raidId: lobby.raidId }, lobby.host);
  }

  private startLobby(): void {
    const { lobby } = this;
    if (!lobby?.island || this.lobbyBlocker(lobby.seats)) return;
    this.link?.relay({
      k: "start",
      raidId: lobby.raidId,
      seats: lobby.seats,
      island: lobby.island,
    });
    this.beginCoop(lobby.raidId, lobby.seats, lobby.island);
  }

  private beginCoop(raidId: string, seats: Seat[], island: MapIsland): void {
    const seat = seats.findIndex((s) => s.member === this.save.memberId);
    this.lobby = null;
    this.drawLobby();
    if (seat < 0) return;
    this.go(() => {
      if (this.crew.active) this.crew.exit();
      this.startRaid(seats[seat]?.hero ?? "rifleman", island, { raidId, seats, seat });
    });
  }

  private onRelay(from: string, data: RaidMessage): void {
    const { lobby, coop } = this;
    switch (data.k) {
      case "invite":
        this.crewRaids.set(from, {
          raidId: data.raidId,
          name: data.host,
          island: data.island,
          raiding: data.raiding,
          age: 0,
        });
        // Not in the middle of a fight, or of getting one together, and only the once.
        if (lobby || coop || this.phase === "raid" || this.phase === "replay") return;
        if (data.raiding || this.passedOn.has(data.raidId)) return;
        this.invite = from;
        this.lobbyView.invite(
          data.island
            ? `${data.host} is raiding ${data.island.name}`
            : `${data.host} is picking a hero. Raid together?`,
        );
        return;
      case "cancel":
        if (this.crewRaids.get(from)?.raidId === data.raidId) this.crewRaids.delete(from);
        if (this.invite === from) {
          this.invite = null;
          this.lobbyView.invite(null);
        }
        if (lobby?.raidId === data.raidId) {
          this.lobby = null;
          this.drawLobby();
        }
        return;
      case "join": {
        if (data.raidId !== this.rallyId) return;
        if (!lobby) this.ownLobby(this.phase === "scout" ? this.scouting : null);
        const party = this.lobby;
        if (!party) return;
        const seat = {
          member: from,
          name: data.name,
          hero: data.hero,
          upgrades: data.upgrades,
          shards: readShards(data.shards),
        };
        const known = party.seats.findIndex((s) => s.member === from);
        if (known >= 0) party.seats[known] = seat;
        else if (party.seats.length < MAX_SEATS) party.seats.push(seat);
        else return;
        // New, or back in the lobby to change hero: either way, they've still to ready up.
        this.markReady(from, false);
        this.tellSeats();
        this.drawLobby();
        sfx.coin();
        return;
      }
      case "seats":
        if (lobby?.raidId !== data.raidId) return;
        lobby.seats = data.seats;
        lobby.ready = data.ready;
        lobby.island = data.island;
        this.drawLobby();
        return;
      case "ready":
        if (lobby?.raidId !== data.raidId || !this.isHost()) return;
        this.markReady(from, data.ready);
        this.teamChanged();
        this.drawLobby();
        return;
      case "leave":
        if (lobby?.raidId === data.raidId) {
          lobby.seats = lobby.seats.filter((s) => s.member !== from);
          this.markReady(from, false);
          if (this.isHost()) this.teamChanged();
          this.drawLobby();
        }
        if (coop?.raidId === data.raidId && coop.isHost) this.seatLeft(from);
        return;
      case "start":
        if (lobby?.raidId === data.raidId) this.beginCoop(data.raidId, data.seats, data.island);
        return;
      case "input":
        if (coop?.raidId === data.raidId && coop.isHost) coop.receiveInput(data.seat, data.input);
        return;
      case "snap": {
        if (coop?.raidId !== data.raidId || coop.isHost) return;
        const { state, view } = this;
        if (!state || !view) return;
        const events = coop.receive(state, data.snap);
        view.handleEvents(events, state);
        playRaidEvents(events, state, this.player());
        this.spendShards(events);
        return;
      }
    }
  }

  /** A crewmate has left mid-raid: their hero falls where they stand. */
  private seatLeft(member: string): void {
    const { coop, state } = this;
    if (!coop || !state) return;
    const seat = coop.seats.findIndex((s) => s.member === member);
    const hero = state.heroes[seat];
    coop.dropSeat(seat);
    if (hero?.alive) {
      hero.hp = 0;
      hero.alive = false;
      if (hero.inBoat) state.boat.occupant = null;
      hero.inBoat = false;
      this.hud.flash(`${coop.seats[seat]?.name ?? "A crewmate"} has left the raid`);
    }
  }

  /** Runs a screen change behind a quick wipe. */
  private go(change: () => void): void {
    sfx.whoosh();
    this.wipe.classList.remove("run");
    void this.wipe.offsetWidth;
    this.wipe.classList.add("run");
    setTimeout(change, 180);
  }

  private hideScreens(): void {
    this.heroes.hide();
    this.tree.hide();
    this.mapScreen.hide();
    this.scout.hide();
    this.mapView.show(false);
    this.results.hide();
    this.pause.show(false);
  }

  /** The world map, to pick an island to raid with this hero. */
  private showMap(hero: HeroKind): void {
    this.endRaidWorld();
    this.hideScreens();
    this.phase = "map";
    this.skyCard.hide();
    this.mapHero = hero;
    const { lostIslands } = this.save;
    this.drawMap();
    this.mapView.show(true);
    void this.findRivals();
    const opened = this.reveal && islandSpot(this.reveal);
    if (opened) {
      // Over to the water that's just opened up.
      this.mapView.lookAt(opened.x, opened.y);
      this.mapScreen.announce("The cloud has lifted: new islands ahead!");
    } else if (lostIslands.length > 0) {
      this.mapScreen.announce(`${lostIslands.join(" and ")} taken back overnight!`);
      this.updateSave({ lostIslands: [] });
    }
    this.reveal = null;
    this.stage.ignoreSlowFrames();
  }

  /** Lays the world out as it stands, with the day's raider ship if it's still out there. */
  private drawMap(): void {
    const { world, crystals } = this.save;
    const hq = hqLevel(this.crew.snapshot().layout);
    const islands = worldIslands(world, hq);
    const ship = shipAtSea(Date.now(), hq);
    const raiders = ship ? { ship, ...shipSpot(world, islands, ship.spotSeed) } : null;
    this.mapView.setWorld(islands, world, this.reveal !== null);
    this.mapView.setRaiders(raiders);
    this.mapScreen.show(islands, world, crystals, raiders);
  }

  /** Moves real crews onto any player islands that are open, if the server knows of any. */
  private async findRivals(): Promise<void> {
    const hq = hqLevel(this.crew.snapshot().layout);
    const crews = await fetchRivals(this.save.crewCode, hq);
    if (crews.length === 0 || this.phase !== "map") return;
    const before = this.save.world;
    const world = settleRivals(before, worldIslands(before, hq), crews);
    if (Object.keys(world.rivals).length === Object.keys(before.rivals).length) return;
    this.updateSave({ world });
    this.drawMap();
  }

  /** The blueprints a raider base could turn up, that the crew hasn't got yet. */
  private blueprintsOn(island: MapIsland): string[] {
    if (island.rival) return [];
    const known = this.knownBlueprints();
    const unknown: Blueprint[] = DEFENSE_BLUEPRINTS.filter(
      (t) => allowedCount(t, island.hq) > 0 && !known.includes(t),
    );
    const weapon = nextWeapon(known);
    if (weapon) unknown.push(weapon);
    return unknown.map(blueprintName);
  }

  private knownBlueprints(): Blueprint[] {
    return [...this.crew.snapshot().layout.blueprints, ...this.save.blueprints];
  }

  /** Back to the crew island, from hero select or the end of a raid. */
  private goHome(): void {
    this.endRaidWorld();
    this.endRally();
    if (this.lobby) this.leaveLobby();
    this.enterCrew();
  }

  private showHeroes(kind?: HeroKind, attacking: MapIsland | null = null): void {
    if (this.crew.active) this.crew.exit();
    this.endRaidWorld();
    this.hideScreens();
    this.phase = "heroes";
    this.attacking = attacking;
    this.skyCard.hide();
    this.rallyIn = 0;
    this.heroes.show(kind, attacking !== null);
  }

  private showTree(kind: HeroKind): void {
    this.hideScreens();
    this.phase = "tree";
    this.treeHero = kind;
    this.treeFromLab = false;
    this.tree.show(kind);
  }

  private enterCrew(): void {
    this.hideScreens();
    this.phase = "crew";
    if (!this.crew.active) this.crew.enter();
  }

  private endRaidWorld(): void {
    this.coop = null;
    this.hud.show(false);
    this.setControlMode("off");
    this.paused = false;
    if (this.view) {
      this.stage.scene.remove(this.view.root);
      this.view.dispose();
      this.view = null;
    }
    this.dangerMap?.dispose();
    this.dangerMap = null;
    this.labels.clear();
    this.state = null;
    this.rig.shape = HOME_SHAPE;
  }

  /** The island a map spot holds: a raider base, or a rival crew's own. */
  private islandFor(target: MapIsland): IslandLayout {
    // Landing on the island just scouted needn't lay it all out again.
    if (this.laidOut?.target === target) return this.laidOut.layout;
    const { rival } = target;
    const buildings =
      rival && (rival.buildings.length > 0 ? rival.buildings : enemyBase(target.seed, rival.hq));
    const layout =
      rival && buildings
        ? { ...rivalIsland(target.seed, buildings), buffs: rival.buffs }
        : generateIsland(target.seed, target.hq, { maxed: target.retaken });
    this.laidOut = { target, layout };
    return layout;
  }

  private laidOut: { target: MapIsland; layout: IslandLayout } | null = null;

  /** Sets a target island up, the same whether the crew is scouting it or landing. */
  private loadRaid(hero: HeroKind, target: MapIsland, team?: Team) {
    const layout = this.islandFor(target);
    const weapons = gunboatWeapons(this.crew.snapshot().layout);
    const state = team
      ? createCoopRaid(layout, team.seats, weapons, RAIDERS[target.difficulty])
      : createRaid(
          layout,
          [hero],
          [],
          [heroMods(hero, this.save.upgrades[hero])],
          weapons,
          [packShards(this.save.shards, this.save.shardLoadout)],
          RAIDERS[target.difficulty],
        );
    this.controls.selectAbility("artillery");
    this.seat = team?.seat ?? 0;
    this.state = state;
    this.rig.shape = state.shape;
    this.view = new RaidView(layout, state, this.labels, undefined, this.seat);
    this.view.names = team?.seats.map((s) => s.name) ?? [];
    this.stage.scene.add(this.view.root);
    this.stage.prepare();
    this.stage.ignoreSlowFrames();
    return { layout, state };
  }

  /** A look over an enemy base from above before committing: the raid hasn't started. */
  private startScout(target: MapIsland): void {
    if (this.withParty() && this.lobby?.island?.id !== target.id) {
      this.ownLobby(target);
      this.tellSeats();
    }
    this.scouting = target;
    this.endRaidWorld();
    this.hideScreens();
    const { layout, state } = this.loadRaid(this.mapHero, target);
    this.dangerMap = new DangerMap(state);
    if (this.view) {
      this.view.root.add(this.dangerMap.root);
      this.view.showBars = false;
    }
    // Start over the middle of the base, so its whole spread is in view.
    const { length } = state.buildings;
    this.rig.scoutOver(
      vec(
        state.buildings.reduce((sum, b) => sum + b.pos.x, 0) / length,
        state.buildings.reduce((sum, b) => sum + b.pos.y, 0) / length,
      ),
    );
    this.phase = "scout";
    this.scout.show(target, scoutReport(layout.buildings));
    this.drawLobby();
  }

  /** Tapping a defense while scouting: lights up its reach and says what it does. */
  private scoutTap(x: number, y: number): RaidBuilding | null {
    const point = this.rig.groundPoint(
      x,
      y,
      this.stage.renderer.domElement.getBoundingClientRect(),
    );
    const found =
      point &&
      this.state?.buildings.find((b) => distance(b.pos, point) < BUILDINGS[b.type].radius + 1.5);
    this.dangerMap?.select(found ? found.id : null);
    return found || null;
  }

  private scoutFrame(dt: number): void {
    if (!this.state || !this.view) return;
    this.rig.update(dt, null);
    const { camera, width, height } = this.stage;
    this.view.update(this.state, dt, this.time, camera, width, height);
  }

  private startRaid(hero: HeroKind, target: MapIsland, team?: Team): void {
    this.updateSave({ hero });
    this.endRaidWorld();
    this.hideScreens();
    this.islandLevel = target.tier;
    this.raidTarget = target;
    const { layout } = this.loadRaid(hero, target, team);
    if (team) {
      this.coop = new CoopSession(team.raidId, team.seats, team.seat, (message, to) =>
        this.link?.relay(message, to),
      );
    }
    this.accumulator = 0;
    this.phase = "raid";
    this.resultsAt = 0;
    this.resultShown = false;
    this.retreated = false;
    this.rig.mode = "follow";
    this.rig.zoomOut = 0;
    this.rig.snap(layout.spawn);
    this.setControlMode("hero");
    this.hud.setHero(heroPortrait(hero), this.save.upgrades[hero].length);
    this.hud.setSquad(
      (team?.seats ?? []).flatMap((s, i) =>
        i === team?.seat
          ? []
          : [
              {
                seat: i,
                kind: s.hero,
                upgrades: s.upgrades.length,
                portrait: heroPortrait(s.hero),
              },
            ],
      ),
    );
    this.playerDown = false;
    this.stopHinted = false;
    this.baseTaken = false;
    this.lockedOn = null;
    this.hud.show(true);
    this.hud.flash("Destroy the headquarters!");
  }

  /** Watches a night raid play out on the island as it stood that night. */
  private startReplay(raid: NightRaid): void {
    if (this.crew.active) this.crew.exit();
    this.endRaidWorld();
    this.hideScreens();
    const state = startNightRaid(raid, raid.seed);
    const layout = nightIsland(raid, raid.seed);
    // The sky as it was when the raiders came.
    this.stage.sky.holdClock(raid.ship?.at ?? null);
    this.state = state;
    this.view = new RaidView(layout, state, this.labels, raid);
    this.stage.scene.add(this.view.root);
    this.stage.prepare();
    this.accumulator = 0;
    this.phase = "replay";
    this.replaySpeed = 1;
    this.resultsAt = 0;
    this.setControlMode("off");
    this.rig.mode = "follow";
    this.rig.behind = false;
    this.rig.zoomOut = 1;
    this.rig.snap(layout.spawn);
    this.replay.show(true);
  }

  private endReplay(): void {
    if (this.phase !== "replay") return;
    this.replay.show(false);
    this.stage.sky.holdClock(null);
    this.applySettings();
    this.goHome();
    this.crew.showNightResult();
  }

  private replayFrame(dt: number, now: number): void {
    const { state, view } = this;
    if (!state || !view) return;
    this.accumulator += dt * this.replaySpeed;
    while (this.accumulator >= SIM_STEP && state.status === "playing") {
      view.remember(state);
      stepNightRaid(state, SIM_STEP);
      view.handleEvents(state.events, state);
      playRaidEvents(state.events, state, undefined);
      this.accumulator -= SIM_STEP;
    }
    if (state.status !== "playing") {
      this.resultsAt ||= now + RESULTS_DELAY * 1000;
      if (now >= this.resultsAt) {
        this.resultsAt = Number.POSITIVE_INFINITY;
        this.go(() => this.endReplay());
      }
    }
    view.between = state.status === "playing" ? this.accumulator / SIM_STEP : 1;
    const watched = state.heroes.find((h) => h.alive) ?? state.heroes[0];
    if (watched) this.rig.update(dt, view.drawnAt(watched), vec(0, -3));
    view.update(state, dt, this.time, this.stage.camera, this.stage.width, this.stage.height);
    this.replay.update(state);
  }

  private setPaused(on: boolean): void {
    if (this.phase !== "raid") return;
    this.paused = on;
    this.pause.show(on);
    this.setControlMode(on ? "off" : "hero");
  }

  private retreat(): void {
    if (this.phase !== "raid" || !this.state) return;
    const { coop } = this;
    if (coop && !coop.isHost)
      this.link?.relay({ k: "leave", raidId: coop.raidId }, coop.seats[0]?.member);
    this.retreated = true;
    this.state.status = "lost";
    this.state.lostReason = null;
  }

  private setControlMode(mode: ControlMode): void {
    if (mode === this.controlMode) return;
    if (mode === "boat") {
      // The gunboat's view opens over wherever the hero is.
      const hero = this.player();
      this.rig.boatFocus.set(hero?.pos.x ?? BASE_CENTER.x, 0, hero?.pos.y ?? BASE_CENTER.y);
    }
    this.controlMode = mode;
    this.controls.setMode(mode);
    if (this.phase === "raid" || this.phase === "ended")
      this.rig.mode = mode === "boat" ? "boat" : "follow";
  }

  private player(): RaidHero | undefined {
    return this.state?.heroes[this.seat];
  }

  /** Every hero's input this step: this phone's player, and anyone playing from their own. */
  private inputs(player: HeroInput): HeroInput[] {
    return this.coop?.hostInputs(player) ?? [player];
  }

  /** Outside a fight, a screen nobody's touching runs at half speed: it looks the same at rest. */
  private calmNow(now: number): boolean {
    const fighting = this.phase === "raid" || this.phase === "replay" || this.phase === "ended";
    return !fighting && now - this.touched > CALM_AFTER_MS;
  }

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const calm = this.calmNow(now);
    // A little under the gap, or a 60 Hz screen would miss every other frame by a whisker.
    const fullFrame = 1000 / this.save.settings.frameRate;
    if (now - this.last < Math.max(fullFrame, calm ? CALM_FRAME_MS : 0) - FRAME_SLACK_MS) return;
    const frameTime = (now - this.last) / 1000;
    const dt = steadied(Math.min(MAX_FRAME_SECONDS, frameTime));
    this.last = now;
    this.time += dt;
    this.stage.calm = calm;
    this.stage.setLight(LIGHT_PHASES.includes(this.phase));
    // The real frame time, so a device that's struggling badly drops quality straight away.
    if (!calm) this.stage.adaptQuality(frameTime);
    music.play(this.trackForPhase());
    this.tickRally(dt);
    this.syncIn -= dt;
    if (this.syncIn <= 0) {
      this.syncIn = SYNC_SECONDS;
      void this.pushAccount();
    }
    if (this.phase === "crew") this.crew.frame(dt, this.time);
    else if (this.phase === "heroes") this.showcase.update(dt, this.time);
    else if (this.phase === "tree") {
      // Nothing moves behind the tree's own full-screen backdrop, so nothing needs drawing. Gold
      // can still come in while it's open, and what can be bought has to keep up with that.
      this.treeIn -= dt;
      if (this.treeIn <= 0) {
        this.treeIn = 1;
        this.tree.refresh();
      }
      return;
    } else if (this.phase === "replay") this.replayFrame(dt, now);
    else if (this.phase === "map") {
      this.mapView.update(this.time, dt);
      this.mapScreen.update();
      updateWind(this.time, null);
    } else if (this.phase === "scout") this.scoutFrame(dt);
    else this.raidFrame(dt, now);
    this.tint.update(this.phase === "raid" ? this.state : null);
    this.stage.render();
  };

  private raidFrame(dt: number, now: number): void {
    const state = this.state;
    const view = this.view;
    const hero = this.player();
    if (!state || !view || !hero) return;
    const { coop } = this;
    if (coop && !coop.isHost) {
      // A guest's phone follows the host: the raid doesn't stop for anyone's pause menu.
      const live = this.phase === "raid" && !this.paused;
      coop.guestFrame(state, live ? this.controls.read(hero.pos) : IDLE_INPUT, dt);
      if (coop.silence > HOST_TIMEOUT && state.status === "playing") {
        state.status = "lost";
        state.lostReason = null;
        this.retreated = true;
        this.hud.flash("Lost touch with the host");
      }
    } else if (!this.paused || coop) {
      this.accumulator += dt;
      while (this.accumulator >= SIM_STEP) {
        const live = this.phase === "raid" && !this.paused;
        const input = live ? this.controls.read(hero.pos) : IDLE_INPUT;
        view.remember(state);
        stepRaid(state, this.inputs(input), SIM_STEP);
        view.handleEvents(state.events, state);
        playRaidEvents(state.events, state, this.player());
        this.spendShards(state.events);
        coop?.collect(state.events);
        this.accumulator -= SIM_STEP;
      }
      coop?.hostFrame(state, dt);
    }
    // A guest's phone draws what the host last sent, as it is.
    view.between = coop && !coop.isHost ? 1 : this.accumulator / SIM_STEP;
    if (!this.paused) {
      this.setControlMode(
        this.phase !== "raid" ? "off" : hero.inBoat ? "boat" : hero.alive ? "hero" : "off",
      );
    }
    const fighting = state.buildings.some(
      (b) =>
        !b.destroyed &&
        BUILDINGS[b.type].attack &&
        distance(b.pos, hero.pos) < COMBAT_ZOOM_DISTANCE,
    );
    const wide = fighting || state.conquest !== null;
    this.rig.zoomOut = lerp(this.rig.zoomOut, wide ? 1 : 0, Math.min(1, dt * 1.5));
    if (state.conquest !== null && !this.baseTaken) {
      this.baseTaken = true;
      this.hud.flash("Base taken! It's all yours");
    }
    if (hero.targetId !== this.lockedOn) {
      this.lockedOn = hero.targetId;
      if (hero.targetId !== null) {
        sfx.tick();
        haptic("light");
      }
    }
    if (this.phase === "raid" && state.status !== "playing") this.endRaid();
    if (this.phase === "ended" && !this.resultShown && now >= this.resultsAt) this.showResults();

    // Firing all but stops a hero, so new players need to know how to get moving again.
    if (!this.stopHinted && hero.targetId !== null && this.save.wins < HINT_WINS) {
      this.stopHinted = true;
      this.hud.flash("Tap FIRE again to stop shooting and run");
    }
    if (!hero.alive && !this.playerDown && this.phase === "raid") {
      this.playerDown = true;
      if (state.heroes.some((h) => h.alive)) this.hud.flash("You're down! Your crew fights on");
    }
    // Once the player is down, watch whoever is still fighting.
    const watched = hero.alive ? hero : (state.heroes.find((h) => h.alive) ?? hero);
    // The behind camera looks where the aim stick does, or else the way the hero's going.
    const aim = this.phase === "raid" && !this.paused ? this.controls.aimPreview() : null;
    const heading = aim ? angleOf(aim) : watched.moving || watched.firing ? watched.facing : null;
    this.rig.kick(view.takeTremor());
    // A falling base takes the camera with it, ending back at the headquarters' wreck.
    const hq = state.buildings.find((b) => b.type === "headquarters");
    const sweep = state.status === "won" ? hq?.pos : state.conquest !== null && view.lastBlast;
    this.rig.update(dt, sweep || view.drawnAt(watched), vec(0, -3), heading, watched.firing);
    view.aim = aim;
    view.update(
      state,
      this.paused ? 0 : dt,
      this.time,
      this.stage.camera,
      this.stage.width,
      this.stage.height,
    );
    // The HUD doesn't need every frame, and every write to it makes the phone lay it out again.
    this.hudTime += dt;
    if (++this.hudFrames < HUD_EVERY) return;
    this.hudFrames = 0;
    this.hud.update(
      state,
      hero,
      canBoard(state, hero),
      this.controls.selectedAbility,
      this.rig.turn,
      this.islandLevel,
      this.hudTime,
    );
    this.hudTime = 0;
  }

  private endRaid(): void {
    const state = this.state;
    if (!state) return;
    this.phase = "ended";
    this.resultsAt = performance.now() + RESULTS_DELAY * 1000;
    this.setControlMode("off");
    const won = state.status === "won";
    const percent = destructionPercent(state);
    const reward = raidReward(won, percent, this.islandLevel);
    const target = this.raidTarget;
    const before = this.save.world;
    const { rival } = target ?? { rival: null };
    // A raider ship's own base can't be held: winning there wins back what its raid took.
    const revenge = won ? target?.revenge : undefined;
    let world = won && target && !target.revenge ? takeIsland(before, target.id) : before;
    if (won && target && rival) {
      // Keep a note of who was beaten here: what the island pays goes by their strength.
      world = beatRival({ ...world, rivals: { ...world.rivals, [target.id]: rival } }, rival);
    }
    this.reveal = world.opened.find((key) => !before.opened.includes(key)) ?? null;
    const { plunder, luck } = statueBuffs(this.crew.snapshot().layout.statues);
    const carried = emptyPurse();
    const loot: Partial<Purse> = { ...this.save.loot };
    for (const r of RESOURCES) {
      carried[r] = Math.round(state.loot[r] * plunder);
      if (carried[r] > 0) loot[r] = (loot[r] ?? 0) + carried[r];
    }
    this.carried = carried;
    const spoils = won && target ? this.rollWin(target, state, luck) : null;
    this.spoils = spoils;
    // Everything a raid pays goes to the island, the only gold there is.
    loot.gold = (loot.gold ?? 0) + reward.gold + (spoils?.chest ?? 0);
    for (const r of RESOURCES) {
      const back = revenge?.[r] ?? 0;
      if (back > 0) loot[r] = (loot[r] ?? 0) + back;
    }
    const night = this.save.nightRaid;
    if (revenge && night) this.updateSave({ nightRaid: { ...night, avenged: true } });
    const prints = spoils?.blueprint ? [...this.save.blueprints, spoils.blueprint] : null;
    this.updateSave({
      world,
      loot,
      wins: this.save.wins + (won ? 1 : 0),
      bestDestruction: Math.max(this.save.bestDestruction, percent),
      crystals: spoils ? addCrystals(this.save.crystals, spoils.crystals) : this.save.crystals,
      blueprints: prints ?? this.save.blueprints,
      blueprintDrought: won
        ? prints
          ? 0
          : this.save.blueprintDrought + 1
        : this.save.blueprintDrought,
    });
    // A real crew hears about it, from whoever led the raid.
    if (rival?.code && this.seat === 0) {
      void reportRaid({
        target: rival.code,
        by: `${this.save.nickname || "A rival"}'s crew`,
        won,
        destroyedPercent: percent,
        loot: carried,
      });
    }
    this.view?.dropCrystal(state, spoils);
  }

  private rollWin(target: MapIsland, state: RaidState, luck: number): Spoils {
    // Only a raider base has plans lying about, and only for what's standing on it.
    const raiders = target.rival === null;
    const types = new Set(state.buildings.map((b) => b.type));
    if (state.mines.length > 0) types.add("landmine");
    return rollSpoils({
      seed: target.seed ^ Math.imul(this.save.wins + 1, 7919),
      difficulty: target.difficulty,
      crystal: target.crystal,
      defenses: raiders ? [...types] : [],
      known: this.knownBlueprints(),
      drought: this.save.blueprintDrought,
      firstWin: this.save.wins === 0,
      luck,
      tier: target.tier,
    });
  }

  private showResults(): void {
    const state = this.state;
    if (!state || !this.view) return;
    this.resultShown = true;
    this.hud.show(false);
    this.view.showBars = false;
    const won = state.status === "won";
    const percent = destructionPercent(state);
    this.results.show({
      won,
      reason: this.retreated ? "retreat" : state.lostReason,
      destroyedPercent: percent,
      destroyedCount: state.buildings.filter((b) => b.destroyed).length,
      totalCount: state.buildings.length,
      seconds: state.time,
      reward: raidReward(won, percent, this.islandLevel),
      materials: this.carried,
      spoils: this.spoils,
      tribute: won ? (this.raidTarget?.tribute ?? 0) : 0,
    });
  }
}
