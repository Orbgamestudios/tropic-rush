// Runs the app. Screens: the title over the slowly orbiting home island, hero select with the
// hero on a pedestal, the raid itself (HUD, pause, results), and the crew island. Each frame it
// reads the controls, advances the rules in fixed steps, and draws the result.

import * as THREE from "three";
import { COMBAT_ZOOM_DISTANCE, MAX_FRAME_SECONDS, RESULTS_DELAY, SIM_STEP } from "./config";
import { type ControlMode, Controls } from "./controls";
import { CrewMode } from "./crew/crewMode";
import { BUILDINGS } from "./logic/buildings";
import { HEROES, type HeroKind } from "./logic/heroes";
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
import { distance, lerp, vec } from "./logic/vec";
import { CameraRig } from "./render/cameraRig";
import { buildHomeIsland, HOME_CENTER, type HomeIslandView } from "./render/homeIsland";
import { RaidView } from "./render/raidView";
import { Showcase } from "./render/showcase";
import { Stage } from "./render/stage";
import { heroPortrait } from "./render/thumbnails";
import { loadSave, type SaveData, writeSave } from "./save";
import { HeroSelect } from "./ui/heroSelect";
import { Hud } from "./ui/hud";
import { sfx } from "./ui/kit/fx";
import { WorldLabels } from "./ui/labels";
import { PauseMenu } from "./ui/pause";
import { ResultsScreen } from "./ui/results";
import { TitleScreen } from "./ui/title";

type Phase = "title" | "heroes" | "raid" | "ended" | "crew";

function layer(parent: HTMLElement, className: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = className;
  parent.append(div);
  return div;
}

/** Seconds for one turn of the title screen's camera around the island. */
const ORBIT_SECONDS = 90;

export class Game {
  private readonly stage: Stage;
  private readonly rig: CameraRig;
  private readonly labels: WorldLabels;
  private readonly controls: Controls;
  private readonly hud: Hud;
  private readonly title: TitleScreen;
  private readonly heroes: HeroSelect;
  private readonly results: ResultsScreen;
  private readonly pause: PauseMenu;
  private readonly showcase: Showcase;
  private readonly crew: CrewMode;
  private readonly backdrop: HomeIslandView;
  private readonly wipe: HTMLDivElement;
  private save: SaveData = loadSave();
  private phase: Phase = "title";
  private paused = false;
  private state: RaidState | null = null;
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

  constructor(container: HTMLElement) {
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
    this.title = new TitleScreen(screens, {
      onRaid: () => this.go(() => this.showHeroes()),
      onCrew: () => this.go(() => this.enterCrew()),
    });
    this.heroes = new HeroSelect(screens, this.showcase, {
      save: () => this.save,
      update: (changes) => this.updateSave(changes),
      onBack: () => this.go(() => this.showTitle()),
      onStart: (hero, level) => this.go(() => this.startRaid(hero, level)),
    });
    this.results = new ResultsScreen(screens, {
      onAgain: () => this.go(() => this.startRaid(this.save.hero, this.save.level)),
      onHeroes: () => this.go(() => this.showHeroes()),
      onHome: () => this.go(() => this.showTitle()),
    });
    this.pause = new PauseMenu(screens, {
      onResume: () => this.setPaused(false),
      onRetreat: () => {
        this.setPaused(false);
        this.retreat();
      },
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
        onBack: () => this.go(() => this.leaveCrew()),
      },
    );
    this.wipe = layer(container, "wipe");

    this.backdrop = buildHomeIsland();
    this.backdrop.showOverlays(false);
    this.stage.scene.add(this.backdrop.root);
    this.showTitle();
    if (new URLSearchParams(location.search).has("testhooks")) this.installTestHooks();
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
          stepRaid(this.state, [{ ...IDLE_INPUT, ...input }], SIM_STEP);
          this.view?.handleEvents(this.state.events, this.state);
        }
      },
    };
    Object.assign(window, { tropicRush: hooks });
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
    this.title.hide();
    this.heroes.hide();
    this.results.hide();
    this.pause.show(false);
  }

  private showTitle(): void {
    this.endRaidWorld();
    this.hideScreens();
    this.phase = "title";
    this.backdrop.root.visible = true;
    this.title.show(this.save.gold, this.save.medals);
  }

  private showHeroes(): void {
    this.endRaidWorld();
    this.hideScreens();
    this.phase = "heroes";
    this.backdrop.root.visible = false;
    this.heroes.show();
  }

  private enterCrew(): void {
    this.hideScreens();
    this.phase = "crew";
    this.backdrop.root.visible = false;
    this.crew.enter();
  }

  private leaveCrew(): void {
    this.crew.exit();
    this.showTitle();
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

  private startRaid(hero: HeroKind, level: number): void {
    this.updateSave({ hero, level });
    this.endRaidWorld();
    this.hideScreens();
    this.backdrop.root.visible = false;
    this.islandLevel = level;
    const layout = generateIsland(randomSeed(), level);
    const state = createRaid(layout, [hero], [heroPower(this.save.heroLevels[hero])]);
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

  /** The title screen's camera: a slow circle high above the home island. */
  private orbit(): void {
    const angle = (this.time / ORBIT_SECONDS) * Math.PI * 2;
    const cam = this.stage.camera;
    cam.position.set(
      HOME_CENTER.x + Math.sin(angle) * 150,
      95,
      HOME_CENTER.y + Math.cos(angle) * 150,
    );
    cam.lookAt(HOME_CENTER.x, 0, HOME_CENTER.y);
    this.stage.focusShadows(new THREE.Vector3(HOME_CENTER.x, 0, HOME_CENTER.y), 90);
    this.stage.setFogRange(200, 460);
    this.backdrop.update(
      this.time,
      this.stage.fog,
      this.stage.sun.position.clone().sub(this.stage.sun.target.position).normalize(),
    );
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(MAX_FRAME_SECONDS, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.stage.adaptQuality(dt);
    if (this.phase === "crew") this.crew.frame(dt, this.time);
    else if (this.phase === "title") this.orbit();
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
        const input =
          this.phase === "raid"
            ? this.controls.read(hero.pos, HEROES[hero.kind].attack.range)
            : IDLE_INPUT;
        stepRaid(state, [input], SIM_STEP);
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

    this.rig.update(dt, hero.pos, vec(0, -3));
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
    // The follow camera faces north, so map directions match screen directions (south is down).
    // Projecting the boat itself would flip it once it's behind the camera.
    const angle = Math.atan2(state.boat.pos.y - hero.pos.y, state.boat.pos.x - hero.pos.x);
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
