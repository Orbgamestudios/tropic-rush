import type Phaser from "phaser";

export function textStyle(
  size: number,
  color = "#ffffff",
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: `${size}px`,
    fontStyle: "bold",
    color,
    // Render text at screen density so it stays sharp on Retina displays.
    resolution: Math.min(window.devicePixelRatio, 3),
  };
}
