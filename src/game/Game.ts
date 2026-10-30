// Runs the app: the title screen over the slowly orbiting home island, then the crew island.
// (The raid is parked for now: its rules and drawing code stay in the repo, unused.)

import * as THREE from "three";
import { MAX_FRAME_SECONDS } from "./config";
import { CrewMode } from "./crew/crewMode";
import { buildHomeIsland, HOME_CENTER, type HomeIslandView } from "./render/homeIsland";
import { Stage } from "./render/stage";
import { loadSave, type SaveData, writeSave } from "./save";
import { Screens } from "./ui/screens";

type Phase = "menu" | "crew";

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
  private readonly screens: Screens;
  private save: SaveData = loadSave();
  private phase: Phase = "menu";
  private last = performance.now();
  private time = 0;
  private readonly crew: CrewMode;
  private readonly backdrop: HomeIslandView;

  constructor(container: HTMLElement) {
    this.stage = new Stage(container);
    this.screens = new Screens(layer(container, "screens"), {
      onCrew: () => this.enterCrew(),
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
        updateSave: (changes) => {
          this.save = { ...this.save, ...changes };
          writeSave(this.save);
        },
        onBack: () => this.leaveCrew(),
      },
    );

    this.backdrop = buildHomeIsland();
    this.backdrop.showOverlays(false);
    this.stage.scene.add(this.backdrop.root);
    this.screens.showTitle();
    if (new URLSearchParams(location.search).has("testhooks")) this.installTestHooks();
    requestAnimationFrame(this.frame);
  }

  /** For automated tests only (`?testhooks` in the URL). */
  private installTestHooks(): void {
    const hooks = {
      crew: () => this.crew.snapshot(),
    };
    Object.assign(window, { tropicRush: hooks });
  }

  private enterCrew(): void {
    this.phase = "crew";
    this.screens.hideAll();
    this.stage.scene.remove(this.backdrop.root);
    this.crew.enter();
  }

  private leaveCrew(): void {
    this.crew.exit();
    this.phase = "menu";
    this.stage.scene.add(this.backdrop.root);
    this.screens.showTitle();
  }

  /** The title screen's camera: a slow circle high above the island. */
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
    else this.orbit();
    this.stage.render();
    requestAnimationFrame(this.frame);
  };
}
