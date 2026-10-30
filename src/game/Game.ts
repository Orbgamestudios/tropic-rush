// Runs the app. It opens straight onto the crew island (home), which leads to hero select (the
// hero on a pedestal) and the raid itself (HUD, pause, results), and back home again. Each frame
// it reads the controls, advances the rules in fixed steps, and draws the result.

import { COMBAT_ZOOM_DISTANCE, MAX_FRAME_SECONDS, RESULTS_DELAY, SIM_STEP } from "./config";
import { type ControlMode, Controls } from "./controls";
import { CrewMode } from "./crew/crewMode";
import { BUILDINGS } from "./logic/buildings";
import type { HeroKind } from "./logic/heroes";
import { heroPower, raidReward } from "./logic/heroProgress";
import { BASE_CENTER, generateIsland, randomSeed } from "./logic/island";
import {
  canBoard,
  createRaid,
  destructionPercent,
  type HeroInput,
  IDLE_INPUT,
  type RaidHero,
  type RaidState,
  stepRaid,
} from "./logic/raid";
import { squadInput } from "./logic/squad";
import { distance, lerp, vec } from "./logic/vec";
import { CameraRig } from "./render/cameraRig";
import { RaidView } from "./render/raidView";
import { Showcase } from "./render/showcase";
import { Stage } from "./render/stage";
import { heroPortrait } from "./render/thumbnails";
import { loadSave, type SaveData, type Settings, writeSave } from "./save";
import { ControlsEditor } from "./ui/controlsEditor";
import { HeroSelect } from "./ui/heroSelect";
import { Hud } from "./ui/hud";
import { sfx } from "./ui/kit/fx";
import { WorldLabels } from "./ui/labels";
import { PauseMenu } from "./ui/pause";
import { ResultsScreen } from "./ui/results";

type Phase = "heroes" | "raid" | "ended" | "crew";

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
      onSuper: () => this.controls.pressSuper(),
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
      onStart: (hero, level, squad) => this.go(() => this.startRaid(hero, level, squad)),
    });
    this.results = new ResultsScreen(screens, {
      onAgain: () =>
        this.go(() =>
          this.startRaid(
            this.save.hero,
            this.save.level,
            this.save.squad.filter((k) => k !== this.save.hero),
          ),
        ),
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
        onRaid: () => this.go(() => this.showHeroes()),
      },
    );
    this.wipe = layer(container, "wipe");

    this.applySettings();
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
      save: () => this.save,
      teleport: (x: number, y: number) => {
        const hero = this.player();
        if (hero) hero.pos = vec(x, y);
      },
      advance: (seconds: number, input: Partial<HeroInput> = {}) => {
        for (let t = 0; t < seconds && this.phase === "raid" && this.state; t += SIM_STEP) {
          stepRaid(this.state, this.inputs({ ...IDLE_INPUT, ...input }), SIM_STEP);
          this.view?.handleEvents(this.state.events, this.state);
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
    this.hud.setSuperSpot(s.controls.super);
    sfx.setMuted(s.muted);
  }

  private setSettings(settings: Settings): void {
    this.updateSave({ settings });
    this.applySettings();
  }

  private updateSave(changes: Partial<SaveData>): void {
    this.save = { ...this.save, ...changes };
    writeSave(this.save);
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
    this.results.hide();
    this.pause.show(false);
  }

  /** Back to the crew island, from hero select or the end of a raid. */
  private goHome(): void {
    this.endRaidWorld();
    this.enterCrew();
  }

  private showHeroes(): void {
    if (this.crew.active) this.crew.exit();
    this.endRaidWorld();
    this.hideScreens();
    this.phase = "heroes";
    this.heroes.show();
  }

  private enterCrew(): void {
    this.hideScreens();
    this.phase = "crew";
    if (!this.crew.active) this.crew.enter();
  }

  private endRaidWorld(): void {
    this.hud.show(false);
    this.setControlMode("off");
    this.paused = false;
    if (this.view) {
      this.stage.scene.remove(this.view.root);
      this.view.dispose();
      this.view = null;
    }
    this.labels.clear();
    this.state = null;
  }

  private startRaid(hero: HeroKind, level: number, squad: readonly HeroKind[] = []): void {
    this.updateSave({ hero, level });
    this.endRaidWorld();
    this.hideScreens();
    this.islandLevel = level;
    const layout = generateIsland(randomSeed(), level);
    const kinds = [hero, ...squad.filter((k) => k !== hero && this.save.unlocked.includes(k))];
    const state = createRaid(
      layout,
      kinds,
      kinds.map((k) => heroPower(this.save.heroLevels[k])),
    );
    this.state = state;
    this.view = new RaidView(layout, state, this.labels);
    this.stage.scene.add(this.view.root);
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
      kinds
        .slice(1)
        .map((k) => ({ kind: k, level: this.save.heroLevels[k], portrait: heroPortrait(k) })),
    );
    this.playerDown = false;
    this.hud.show(true);
    this.hud.flash("Destroy the headquarters!");
  }

  private setPaused(on: boolean): void {
    if (this.phase !== "raid") return;
    this.paused = on;
    this.pause.show(on);
    this.setControlMode(on ? "off" : "hero");
  }

  private retreat(): void {
    if (this.phase !== "raid" || !this.state) return;
    this.retreated = true;
    this.state.status = "lost";
    this.state.lostReason = null;
  }

  private setControlMode(mode: ControlMode): void {
    if (mode === this.controlMode) return;
    if (mode === "boat") {
      // Start the gunboat's view over the middle of the base.
      this.rig.boatFocus.set(BASE_CENTER.x, 0, BASE_CENTER.y + 6);
    }
    this.controlMode = mode;
    this.controls.setMode(mode);
    if (this.phase === "raid" || this.phase === "ended")
      this.rig.mode = mode === "boat" ? "boat" : "follow";
  }

  private player(): RaidHero | undefined {
    return this.state?.heroes[0];
  }

  /** The player's input plus the AI squadmates'. */
  private inputs(player: HeroInput): HeroInput[] {
    const state = this.state;
    if (!state) return [player];
    return state.heroes.map((_, i) => (i === 0 ? player : squadInput(state, i)));
  }

  private readonly frame = (now: number): void => {
    const frameTime = (now - this.last) / 1000;
    const dt = Math.min(MAX_FRAME_SECONDS, frameTime);
    this.last = now;
    this.time += dt;
    // The real frame time, so a device that's struggling badly drops quality straight away.
    this.stage.adaptQuality(frameTime);
    if (this.phase === "crew") this.crew.frame(dt, this.time);
    else if (this.phase === "heroes") this.showcase.update(dt, this.time);
    else this.raidFrame(dt, now);
    this.stage.render();
    requestAnimationFrame(this.frame);
  };

  private raidFrame(dt: number, now: number): void {
    const state = this.state;
    const view = this.view;
    const hero = this.player();
    if (!state || !view || !hero) return;
    if (!this.paused) {
      this.accumulator += dt;
      while (this.accumulator >= SIM_STEP) {
        const input = this.phase === "raid" ? this.controls.read(hero.pos) : IDLE_INPUT;
        stepRaid(state, this.inputs(input), SIM_STEP);
        view.handleEvents(state.events, state);
        this.accumulator -= SIM_STEP;
      }
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

    if (!hero.alive && !this.playerDown && this.phase === "raid") {
      this.playerDown = true;
      if (state.heroes.some((h) => h.alive)) this.hud.flash("You're down! Your squad fights on");
    }
    // Once the player is down, watch whoever is still fighting.
    const watched = hero.alive ? hero : (state.heroes.find((h) => h.alive) ?? hero);
    const heading = watched.moving || watched.firing ? watched.facing : null;
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
    const boat = view.screenPosition(
      state.boat.pos,
      1,
      this.stage.camera,
      this.stage.width,
      this.stage.height,
    );
    const onScreen =
      boat.inFront &&
      boat.x > 0 &&
      boat.x < this.stage.width &&
      boat.y > 0 &&
      boat.y < this.stage.height;
    // Map directions plus the camera's turn give screen directions (south is down at no turn).
    // Projecting the boat itself would flip it once it's behind the camera.
    const angle =
      Math.atan2(state.boat.pos.y - hero.pos.y, state.boat.pos.x - hero.pos.x) + this.rig.turn;
    this.hud.update(
      state,
      hero,
      canBoard(state, hero),
      this.controls.selectedAbility,
      { angle, onScreen },
      this.islandLevel,
      dt,
    );
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
    this.updateSave({
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
    });
  }
}
