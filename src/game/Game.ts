// Runs the app: menus over an orbiting island, then raids. Each frame it reads the controls,
// advances the rules in fixed steps, and draws the result.

import { COMBAT_ZOOM_DISTANCE, MAX_FRAME_SECONDS, RESULTS_DELAY, SIM_STEP } from "./config";
import { type ControlMode, Controls } from "./controls";
import { BUILDINGS } from "./logic/buildings";
import { HEROES, type HeroKind } from "./logic/heroes";
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
import { RaidView } from "./render/raidView";
import { Stage } from "./render/stage";
import { loadSave, type SaveData, writeSave } from "./save";
import { Hud } from "./ui/hud";
import { WorldLabels } from "./ui/labels";
import { type RaidResult, Screens } from "./ui/screens";

type Phase = "menu" | "raid" | "ended";

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
  private readonly hud: Hud;
  private readonly screens: Screens;
  private save: SaveData = loadSave();
  private phase: Phase = "menu";
  private state: RaidState;
  private view: RaidView;
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
      onRetreat: () => this.retreat(),
    });
    this.screens = new Screens(layer(container, "screens"), {
      onPlay: () => this.screens.showSelect(this.save.hero, this.save.level),
      onStart: (hero, level) => this.startRaid(hero, level),
      onAgain: () => this.startRaid(this.save.hero, this.save.level),
      onChangeHero: () => this.showMenu(true),
    });
    const rotate = layer(container, "rotate");
    rotate.textContent = "Turn your phone sideways to play";

    const menu = this.menuIsland();
    this.state = menu.state;
    this.view = menu.view;
    this.screens.showTitle();
    if (new URLSearchParams(location.search).has("testhooks")) this.installTestHooks();
    requestAnimationFrame(this.frame);
  }

  /**
   * For automated tests only (`?testhooks` in the URL): place the hero and fast-forward the rules,
   * since a software-rendered test browser is too slow to play in real time.
   */
  private installTestHooks(): void {
    const hooks = {
      state: () => this.state,
      teleport: (x: number, y: number) => {
        const hero = this.player();
        if (hero) hero.pos = vec(x, y);
      },
      advance: (seconds: number, input: Partial<HeroInput> = {}) => {
        for (let t = 0; t < seconds && this.phase === "raid"; t += SIM_STEP) {
          stepRaid(this.state, [{ ...IDLE_INPUT, ...input }], SIM_STEP);
          this.view.handleEvents(this.state.events, this.state);
        }
      },
    };
    Object.assign(window, { tropicRush: hooks });
  }

  private menuIsland(): { state: RaidState; view: RaidView } {
    const layout = generateIsland(randomSeed(), 3);
    const state = createRaid(layout, []);
    const view = new RaidView(layout, state, this.labels);
    this.stage.scene.add(view.root);
    this.rig.mode = "orbit";
    return { state, view };
  }

  private replaceWorld(next: { state: RaidState; view: RaidView }): void {
    this.stage.scene.remove(this.view.root);
    this.view.dispose();
    this.state = next.state;
    this.view = next.view;
    this.accumulator = 0;
  }

  private showMenu(select: boolean): void {
    this.phase = "menu";
    this.hud.show(false);
    this.setControlMode("off");
    this.replaceWorld(this.menuIsland());
    if (select) this.screens.showSelect(this.save.hero, this.save.level);
    else this.screens.showTitle();
  }

  private startRaid(hero: HeroKind, level: number): void {
    this.save = { ...this.save, hero, level };
    writeSave(this.save);
    this.screens.hideAll();
    const layout = generateIsland(randomSeed(), level);
    const state = createRaid(layout, [hero]);
    this.stage.scene.remove(this.view.root);
    this.view.dispose();
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
    this.hud.show(true);
  }

  private retreat(): void {
    if (this.phase !== "raid") return;
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
    if (this.phase !== "menu") this.rig.mode = mode === "boat" ? "boat" : "follow";
  }

  private player(): RaidHero | undefined {
    return this.state.heroes[0];
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(MAX_FRAME_SECONDS, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.stage.adaptQuality(dt);
    const hero = this.player();

    if (this.phase !== "menu" && hero) {
      this.accumulator += dt;
      while (this.accumulator >= SIM_STEP) {
        const input =
          this.phase === "raid"
            ? this.controls.read(hero.pos, HEROES[hero.kind].attack.range)
            : IDLE_INPUT;
        stepRaid(this.state, [input], SIM_STEP);
        this.view.handleEvents(this.state.events, this.state);
        this.accumulator -= SIM_STEP;
      }
      this.setControlMode(
        this.phase !== "raid" ? "off" : hero.inBoat ? "boat" : hero.alive ? "hero" : "off",
      );
      const fighting = this.state.buildings.some(
        (b) =>
          !b.destroyed &&
          BUILDINGS[b.type].attack &&
          distance(b.pos, hero.pos) < COMBAT_ZOOM_DISTANCE,
      );
      this.rig.zoomOut = lerp(this.rig.zoomOut, fighting ? 1 : 0, Math.min(1, dt * 1.5));
      if (this.phase === "raid" && this.state.status !== "playing") this.endRaid();
      if (this.phase === "ended" && !this.resultShown && now >= this.resultsAt) this.showResults();
    }

    const focus = hero && this.phase !== "menu" ? hero.pos : null;
    this.rig.update(dt, focus, vec(0, -3));
    this.view.update(
      this.state,
      dt,
      this.time,
      this.stage.camera,
      this.stage.width,
      this.stage.height,
    );
    if (hero && this.phase !== "menu") {
      const boat = this.view.screenPosition(
        this.state.boat.pos,
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
      const angle = Math.atan2(
        this.state.boat.pos.y - hero.pos.y,
        this.state.boat.pos.x - hero.pos.x,
      );
      this.hud.update(this.state, hero, canBoard(this.state, hero), this.controls.selectedAbility, {
        angle,
        onScreen,
      });
    }
    this.stage.render();
    requestAnimationFrame(this.frame);
  };

  private endRaid(): void {
    this.phase = "ended";
    this.resultsAt = performance.now() + RESULTS_DELAY * 1000;
    this.setControlMode("off");
    const won = this.state.status === "won";
    const percent = destructionPercent(this.state);
    this.save = {
      ...this.save,
      wins: this.save.wins + (won ? 1 : 0),
      bestDestruction: Math.max(this.save.bestDestruction, percent),
    };
    writeSave(this.save);
  }

  private showResults(): void {
    this.resultShown = true;
    this.hud.show(false);
    this.view.showBars = false;
    const result: RaidResult = {
      won: this.state.status === "won",
      reason: this.retreated ? "retreat" : this.state.lostReason,
      destroyedPercent: destructionPercent(this.state),
      destroyedCount: this.state.buildings.filter((b) => b.destroyed).length,
      totalCount: this.state.buildings.length,
      seconds: this.state.time,
    };
    this.screens.showResults(result);
  }
}
