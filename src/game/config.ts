import Phaser from "phaser";
import { PlayScene } from "./scenes/PlayScene";
import { TitleScene } from "./scenes/TitleScene";

/** Design resolution (portrait). EXPAND mode grows one axis to fill any iPhone aspect ratio. */
export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;

export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#0b1020",
    scale: {
      mode: Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
    },
    input: { activePointers: 3 },
    scene: [TitleScene, PlayScene],
  };
}
