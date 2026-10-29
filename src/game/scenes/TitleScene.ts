import Phaser from "phaser";
import { loadSave } from "../save";
import { textStyle } from "../ui";

export interface TitleData {
  lastScore?: number;
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(data: TitleData): void {
    const { bestScore } = loadSave();
    const title = this.add.text(0, 0, "TAP RUSH", textStyle(96)).setOrigin(0.5);
    const scores = this.add
      .text(0, 0, scoreLines(data.lastScore, bestScore), textStyle(40, "#9aa4c7"))
      .setOrigin(0.5)
      .setAlign("center");
    const prompt = this.add.text(0, 0, "Tap to start", textStyle(48, "#ffcc00")).setOrigin(0.5);

    const layout = (width: number, height: number) => {
      title.setPosition(width / 2, height * 0.32);
      scores.setPosition(width / 2, height * 0.46);
      prompt.setPosition(width / 2, height * 0.66);
    };
    layout(this.scale.width, this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, (size: Phaser.Structs.Size) =>
      layout(size.width, size.height),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE),
    );

    this.tweens.add({ targets: prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    this.input.once("pointerdown", () => this.scene.start("play"));
  }
}

function scoreLines(lastScore: number | undefined, bestScore: number): string {
  const best = `Best: ${bestScore}`;
  return lastScore === undefined ? best : `Score: ${lastScore}\n${best}`;
}
