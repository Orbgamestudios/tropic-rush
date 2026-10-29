import Phaser from "phaser";
import { hit, isHit, miss, newRound, type RoundState, tick } from "../logic/round";
import { loadSave, writeSave } from "../save";
import { textStyle } from "../ui";
import type { TitleData } from "./TitleScene";

const TARGET_RADIUS = 70;
const HUD_HEIGHT = 120;

export class PlayScene extends Phaser.Scene {
  private round!: RoundState;
  private target!: Phaser.GameObjects.Arc;
  private hud!: Phaser.GameObjects.Text;

  constructor() {
    super("play");
  }

  create(): void {
    this.round = newRound();
    this.target = this.add.circle(0, 0, TARGET_RADIUS, 0xffcc00);
    this.hud = this.add.text(32, 32, "", textStyle(44));
    this.moveTarget();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (isHit(pointer.worldX, pointer.worldY, this.target.x, this.target.y, TARGET_RADIUS)) {
        this.round = hit(this.round);
        this.moveTarget();
      } else {
        this.round = miss(this.round);
        this.cameras.main.shake(120, 0.004);
      }
    });

    // Keep the target on screen if the phone rotates or the browser UI resizes the view.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.moveTarget, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.moveTarget, this),
    );
  }

  update(_time: number, delta: number): void {
    this.round = tick(this.round, delta);
    const seconds = Math.ceil(this.round.timeLeftMs / 1000);
    this.hud.setText(`Score ${this.round.score}   x${this.round.streak}   ${seconds}s`);

    if (this.round.over) {
      const save = loadSave();
      if (this.round.score > save.bestScore) writeSave({ ...save, bestScore: this.round.score });
      this.scene.start("title", { lastScore: this.round.score } satisfies TitleData);
    }
  }

  private moveTarget(): void {
    const { width, height } = this.scale;
    const r = TARGET_RADIUS;
    this.target.setPosition(
      Phaser.Math.Between(r, width - r),
      Phaser.Math.Between(HUD_HEIGHT + r, height - r),
    );
    this.target.setScale(0.6);
    this.tweens.add({ targets: this.target, scale: 1, duration: 120, ease: "Back.Out" });
  }
}
