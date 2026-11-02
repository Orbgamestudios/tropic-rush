// Runs the app. It opens straight onto the crew island (home), which leads to hero select (the
// hero on a pedestal) and the raid itself (HUD, pause, results), and back home again. Each frame
// it reads the controls, advances the rules in fixed steps, and draws the result.

import { setHaptics } from "./audio/haptics";
import { music, type Track } from "./audio/music";
import { playRaidEvents } from "./audio/raidSounds";
import { loadSamples } from "./audio/samples";
import { COMBAT_ZOOM_DISTANCE, MAX_FRAME_SECONDS, RESULTS_DELAY, SIM_STEP } from "./config";
import { type ControlMode, Controls } from "./controls";
import { CrewMode, newId } from "./crew/crewMode";
import { passwordProblem, usernameProblem } from "./logic/account";
import { BUILDINGS } from "./logic/buildings";
import { createCoopRaid, MAX_SEATS, type Seat } from "./logic/coop";
import { hqLevel } from "./logic/crewIsland";
import { emptyPurse, type Purse, RESOURCES } from "./logic/economy";
import { generateIsland, scoutReport } from "./logic/enemyBase";
import type { HeroKind } from "./logic/heroes";
import { heroPower, perkMods, raidReward } from "./logic/heroProgress";
import { BASE_CENTER } from "./logic/island";
import { type NightRaid, nightIsland, startNightRaid, stepNightRaid } from "./logic/nightRaid";
import {
  canBoard,
  createRaid,
  destructionPercent,
  type HeroInput,
  IDLE_INPUT,
  type RaidBuilding,
  type RaidHero,
  type RaidState,
  stepRaid,
} from "./logic/raid";
import { distance, lerp, vec } from "./logic/vec";
import { type MapIsland, REGION, takeIsland, worldIslands } from "./logic/worldMap";
import { logIn, logOut, pullSave, pushSave, signUp } from "./net/account";
import { CoopSession, HOST_TIMEOUT } from "./net/coopSession";
import { CrewClient } from "./net/crewClient";
import type { Member, RaidMessage } from "./net/protocol";
import { CameraRig } from "./render/cameraRig";
import { updateWind } from "./render/props";
import { RaidView } from "./render/raidView";
import { RangeRings } from "./render/rangeRings";
import { Showcase } from "./render/showcase";
import { Stage } from "./render/stage";
import { heroPortrait } from "./render/thumbnails";
import { WorldMapView } from "./render/worldMap";
import {
  type AccountSession,
  loadAccount,
  loadSave,
  restoreBundle,
  type SaveData,
  type Settings,
  saveBundle,
  writeAccount,
  writeSave,
} from "./save";
import { ControlsEditor } from "./ui/controlsEditor";
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
import { WorldMapScreen } from "./ui/worldMapScreen";

type Phase = "heroes" | "map" | "scout" | "raid" | "ended" | "crew" | "replay";

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

/** Players stop being told how to stop firing after this many wins. */
const HINT_WINS = 3;

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
  private readonly rig: CameraRig;
  private readonly labels: WorldLabels;
  private readonly controls: Controls;
  private readonly controlsEditor: ControlsEditor;
  private readonly mapView: WorldMapView;
  private readonly mapScreen: WorldMapScreen;
  private readonly scout: ScoutScreen;
  private rangeRings: RangeRings | null = null;
  private mapHero: HeroKind = "rifleman";
  private raidTarget: MapIsland | null = null;
  /** Regions the last win opened: their cloud lifts next time the map is shown. */
  private reveal: string[] = [];
  /** Which of the raid's heroes is this phone's player. */
  private seat = 0;
  /** The line to the crew's server for teaming up, kept open on every screen. */
  private link: CrewClient | null = null;
  private linkFor = "";
  private crewMembers: Member[] = [];
  private readonly lobbyView: RaidLobby;
  /** The raid being got together, before it starts. */
  private lobby: { raidId: string; island: MapIsland; seats: Seat[]; host: string } | null = null;
  /** A crewmate's raid on offer. */
  private invite: { raidId: string; island: MapIsland; from: string } | null = null;
  private inviteAgainIn = 0;
  private coop: CoopSession | null = null;
  private readonly profile: ProfileScreen;
  private account: AccountSession | null = loadAccount();
  /** What the account last stored, to send only what's new. */
  private syncedBundle = saveBundle();
  private syncIn = SYNC_SECONDS;
  private syncing = false;
  private hudFrames = 0;
  private stopHinted = false;
  private hudTime = 0;
  private readonly replay: ReplayBar;
  private replaySpeed = 1;
  private readonly hud: Hud;
  private readonly heroes: HeroSelect;
  private readonly results: ResultsScreen;
  private readonly pause: PauseMenu;
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
    });
    const screens = layer(container, "screens");
    this.showcase = new Showcase(this.stage);
    this.heroes = new HeroSelect(screens, this.showcase, {
      save: () => this.save,
      update: (changes) => this.updateSave(changes),
      onBack: () => this.go(() => this.goHome()),
      onStart: (hero) => this.go(() => this.showMap(hero)),
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
      onEditControls: () => {
        this.pause.show(false, this.phase !== "crew");
        this.controlsEditor.show(true);
      },
    });
    this.controlsEditor = new ControlsEditor(container, {
      settings: () => this.save.settings,
      onSettings: (settings) => this.setSettings(settings),
      onClose: () => this.pause.showSettings(),
    });
    this.mapView = new WorldMapView(this.stage);
    this.mapScreen = new WorldMapScreen(screens, {
      onAttack: (island) => this.go(() => this.startRaid(this.mapHero, island)),
      onScout: (island) => this.go(() => this.startScout(island)),
      onTeamUp: (island) => this.openLobby(island),
      onReturn: () => this.go(() => this.goHome()),
      onHome: () => this.mapView.lookAt(0, 0),
      onPan: (dx, dy) => this.mapView.pan(dx, dy),
      onZoom: (factor) => this.mapView.zoom(factor),
      screen: (x, y) => this.mapView.screen(x, y),
      moves: () => this.mapView.moves,
      soloBlocker: () => this.soloBlocker(),
      crewOnline: () => this.crewOnline(),
    });
    this.lobbyView = new RaidLobby(screens, {
      onJoin: () => this.joinInvite(),
      onDismiss: () => {
        this.invite = null;
        this.lobbyView.invite(null);
      },
      onAttack: () => this.startLobby(),
      onLeave: () => this.leaveLobby(),
    });
    this.scout = new ScoutScreen(screens, {
      onAttack: (island) => this.go(() => this.startRaid(this.mapHero, island)),
      onBack: () => this.go(() => this.showMap(this.mapHero)),
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
        onReplay: (raid) => this.go(() => this.startReplay(raid)),
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
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void this.pushAccount();
    });
    this.enterCrew();
    const params = new URLSearchParams(location.search);
    if (params.has("testhooks")) this.installTestHooks();
    this.stage.holdQuality = params.has("fullquality");
    requestAnimationFrame(this.frame);
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
    setHaptics(s.haptics);
  }

  /** The track for wherever the player is now. */
  private trackForPhase(): Track | null {
    switch (this.phase) {
      case "crew":
        return "home";
      case "heroes":
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

  private updateSave(changes: Partial<SaveData>): void {
    this.save = { ...this.save, ...changes };
    writeSave(this.save);
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
    // The account's progress takes over this phone, so start again from it.
    if (result.save && restoreBundle(result.save)) location.reload();
    return null;
  }

  private signOut(): void {
    const { account } = this;
    if (!account) return;
    void this.pushAccount().then(() => logOut(account.token));
    this.setAccount(null);
  }

  /** Takes on the account's progress if another phone has moved it on since this one last synced. */
  private async pullAccount(): Promise<void> {
    const { account } = this;
    if (!account) return;
    const result = await pullSave(account.token);
    if (!result.ok || !result.save || result.savedAt <= account.syncedAt) return;
    this.setAccount({ ...account, syncedAt: result.savedAt });
    if (restoreBundle(result.save)) location.reload();
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
      onState: (_layout, members) => {
        this.crewMembers = members;
      },
      onReject: () => {},
      onStatus: () => {},
      onRelay: (from, data) => this.onRelay(from, data),
    });
  }

  private crewOnline(): number {
    const me = this.save.memberId;
    return this.crewMembers.filter((m) => m.online && m.id !== me).length;
  }

  private mySeat(hero: HeroKind): Seat {
    const { memberId, nickname, heroLevels } = this.save;
    return { member: memberId, name: nickname, hero, level: heroLevels[hero] };
  }

  private lobbyBlocker(seats: readonly Seat[]): string | null {
    return seats.every((s) => s.hero === "medic")
      ? "Somebody here has to bring a hero who can hurt buildings."
      : null;
  }

  private drawLobby(): void {
    const { lobby } = this;
    if (!lobby) {
      this.lobbyView.hide();
      return;
    }
    const host = lobby.host === this.save.memberId;
    const blocker = host ? this.lobbyBlocker(lobby.seats) : null;
    this.lobbyView.show(lobby.island.name, lobby.seats, host, blocker);
  }

  private openLobby(island: MapIsland): void {
    const raidId = `${this.save.memberId}-${Date.now().toString(36)}`;
    this.lobby = {
      raidId,
      island,
      seats: [this.mySeat(this.mapHero)],
      host: this.save.memberId,
    };
    this.inviteAgainIn = 0;
    this.drawLobby();
  }

  /** Reminds crewmates of the raid, so anyone who's just come online sees it too. */
  private tickLobby(dt: number): void {
    const { lobby } = this;
    if (!lobby || lobby.host !== this.save.memberId) return;
    this.inviteAgainIn -= dt;
    if (this.inviteAgainIn > 0) return;
    this.inviteAgainIn = 3;
    const { raidId, island } = lobby;
    this.link?.relay({ k: "invite", raidId, host: this.save.nickname, island });
  }

  private joinInvite(): void {
    const { invite } = this;
    if (!invite) return;
    this.invite = null;
    this.lobbyView.invite(null);
    const hero = this.save.unlocked.includes(this.save.hero) ? this.save.hero : "rifleman";
    this.mapHero = hero;
    const seat = this.mySeat(hero);
    this.lobby = { ...invite, seats: [seat], host: invite.from };
    this.drawLobby();
    this.link?.relay(
      {
        k: "join",
        raidId: invite.raidId,
        name: seat.name,
        hero,
        level: seat.level,
      },
      invite.from,
    );
  }

  private leaveLobby(): void {
    const { lobby } = this;
    this.lobby = null;
    this.drawLobby();
    if (!lobby) return;
    const host = lobby.host === this.save.memberId;
    if (host) this.link?.relay({ k: "cancel", raidId: lobby.raidId });
    else this.link?.relay({ k: "leave", raidId: lobby.raidId }, lobby.host);
  }

  private startLobby(): void {
    const { lobby } = this;
    if (!lobby || this.lobbyBlocker(lobby.seats)) return;
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
        // Not in the middle of a fight, or of getting one together.
        if (lobby || coop || this.phase === "raid" || this.phase === "replay") return;
        this.invite = { raidId: data.raidId, island: data.island, from };
        this.lobbyView.invite(`${data.host} is raiding ${data.island.name}`);
        return;
      case "cancel":
        if (this.invite?.raidId === data.raidId) {
          this.invite = null;
          this.lobbyView.invite(null);
        }
        if (lobby?.raidId === data.raidId) {
          this.lobby = null;
          this.drawLobby();
        }
        return;
      case "join":
        if (lobby?.raidId !== data.raidId || lobby.host !== this.save.memberId) return;
        if (lobby.seats.length >= MAX_SEATS || lobby.seats.some((s) => s.member === from)) return;
        lobby.seats.push({ member: from, name: data.name, hero: data.hero, level: data.level });
        this.link?.relay({
          k: "seats",
          raidId: data.raidId,
          seats: lobby.seats,
          island: lobby.island,
        });
        this.drawLobby();
        return;
      case "seats":
        if (lobby?.raidId !== data.raidId) return;
        lobby.seats = data.seats;
        this.drawLobby();
        return;
      case "leave":
        if (lobby?.raidId === data.raidId) {
          lobby.seats = lobby.seats.filter((s) => s.member !== from);
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
    this.mapScreen.hide();
    this.scout.hide();
    this.mapView.show(false);
    this.results.hide();
    this.pause.show(false);
  }

  /** A medic can't hurt a building, so she can't take an island without a crewmate. */
  private soloBlocker(): string | null {
    return this.mapHero === "medic"
      ? "Doc Penny can't hurt buildings: team up, or pick another hero."
      : null;
  }

  /** The world map, to pick an island to raid with this hero. */
  private showMap(hero: HeroKind): void {
    this.endRaidWorld();
    this.hideScreens();
    this.phase = "map";
    this.mapHero = hero;
    const { world, lostIslands } = this.save;
    const islands = worldIslands(world, hqLevel(this.crew.snapshot().layout));
    this.mapView.setWorld(islands, world, this.reveal);
    this.mapView.show(true);
    this.mapScreen.show(islands, world);
    const [opened] = this.reveal;
    if (opened) {
      // Over to the water that's just opened up.
      const [column = 0, row = 0] = opened.split(",").map(Number);
      this.mapView.lookAt(column * REGION.w, row * REGION.h);
      this.mapScreen.announce("The cloud has lifted: new islands ahead!");
    } else if (lostIslands.length > 0) {
      this.mapScreen.announce(`Raiders retook ${lostIslands.join(" and ")}!`);
      this.updateSave({ lostIslands: [] });
    }
    this.reveal = [];
    this.stage.ignoreSlowFrames();
  }

  /** Back to the crew island, from hero select or the end of a raid. */
  private goHome(): void {
    this.endRaidWorld();
    this.enterCrew();
  }

  private showHeroes(kind?: HeroKind): void {
    if (this.crew.active) this.crew.exit();
    this.endRaidWorld();
    this.hideScreens();
    this.phase = "heroes";
    this.heroes.show(kind);
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
    this.rangeRings?.dispose();
    this.rangeRings = null;
    this.labels.clear();
    this.state = null;
  }

  /** Sets a target island up, the same whether the crew is scouting it or landing. */
  private loadRaid(hero: HeroKind, target: MapIsland, team?: Team) {
    const layout = generateIsland(target.seed, target.hq, { maxed: target.retaken });
    const level = this.save.heroLevels[hero];
    const state = team
      ? createCoopRaid(layout, team.seats)
      : createRaid(layout, [hero], [heroPower(level)], [perkMods(hero, level)]);
    this.seat = team?.seat ?? 0;
    this.state = state;
    this.view = new RaidView(layout, state, this.labels, undefined, this.seat);
    this.stage.scene.add(this.view.root);
    this.stage.ignoreSlowFrames();
    return { layout, state };
  }

  /** A look over an enemy base from above before committing: the raid hasn't started. */
  private startScout(target: MapIsland): void {
    this.endRaidWorld();
    this.hideScreens();
    const { layout, state } = this.loadRaid(this.mapHero, target);
    this.rangeRings = new RangeRings(state);
    if (this.view) {
      this.view.root.add(this.rangeRings.root);
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
    this.scout.show(target, scoutReport(layout.buildings), this.soloBlocker() === null);
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
    this.rangeRings?.select(found ? found.id : null);
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
    this.hud.setHero(heroPortrait(hero), this.save.heroLevels[hero]);
    this.hud.setSquad(
      (team?.seats ?? []).flatMap((s, i) =>
        i === team?.seat
          ? []
          : [{ seat: i, kind: s.hero, level: s.level, portrait: heroPortrait(s.hero) }],
      ),
    );
    this.playerDown = false;
    this.stopHinted = false;
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
    this.state = state;
    this.view = new RaidView(layout, state, this.labels, raid);
    this.stage.scene.add(this.view.root);
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
    this.applySettings();
    this.goHome();
    this.crew.showNightResult();
  }

  private replayFrame(dt: number, now: number): void {
    const { state, view } = this;
    if (!state || !view) return;
    this.accumulator += dt * this.replaySpeed;
    while (this.accumulator >= SIM_STEP && state.status === "playing") {
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
    const watched = state.heroes.find((h) => h.alive) ?? state.heroes[0];
    if (watched) this.rig.update(dt, watched.pos, vec(0, -3));
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

  private readonly frame = (now: number): void => {
    const frameTime = (now - this.last) / 1000;
    const dt = steadied(Math.min(MAX_FRAME_SECONDS, frameTime));
    this.last = now;
    this.time += dt;
    // The real frame time, so a device that's struggling badly drops quality straight away.
    this.stage.adaptQuality(frameTime);
    music.play(this.trackForPhase());
    this.tickLobby(dt);
    this.syncIn -= dt;
    if (this.syncIn <= 0) {
      this.syncIn = SYNC_SECONDS;
      void this.pushAccount();
    }
    if (this.phase === "crew") this.crew.frame(dt, this.time);
    else if (this.phase === "heroes") this.showcase.update(dt, this.time);
    else if (this.phase === "replay") this.replayFrame(dt, now);
    else if (this.phase === "map") {
      this.mapView.update(this.time, dt);
      this.mapScreen.update();
      updateWind(this.time, null);
    } else if (this.phase === "scout") this.scoutFrame(dt);
    else this.raidFrame(dt, now);
    this.stage.render();
    requestAnimationFrame(this.frame);
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
        stepRaid(state, this.inputs(input), SIM_STEP);
        view.handleEvents(state.events, state);
        playRaidEvents(state.events, state, this.player());
        coop?.collect(state.events);
        this.accumulator -= SIM_STEP;
      }
      coop?.hostFrame(state, dt);
    }
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
    this.rig.zoomOut = lerp(this.rig.zoomOut, fighting ? 1 : 0, Math.min(1, dt * 1.5));
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
    const heading = watched.moving || watched.firing ? watched.facing : null;
    this.rig.kick(view.takeTremor());
    this.rig.update(dt, watched.pos, vec(0, -3), heading, watched.firing);
    view.aim = this.phase === "raid" && !this.paused ? this.controls.aimPreview() : null;
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
    const before = this.save.world;
    const world = won && this.raidTarget ? takeIsland(before, this.raidTarget.id) : before;
    this.reveal = world.opened.filter((key) => !before.opened.includes(key));
    const loot: Partial<Purse> = { ...this.save.loot };
    for (const r of RESOURCES) {
      if (state.loot[r] > 0) loot[r] = (loot[r] ?? 0) + state.loot[r];
    }
    this.updateSave({
      world,
      loot,
      wins: this.save.wins + (won ? 1 : 0),
      bestDestruction: Math.max(this.save.bestDestruction, percent),
      gold: this.save.gold + reward.gold,
      medals: this.save.medals + reward.medals,
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
      materials: { ...emptyPurse(), ...state.loot },
    });
  }
}
