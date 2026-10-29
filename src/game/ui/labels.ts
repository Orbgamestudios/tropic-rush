// Health bars that float over buildings and heroes, drawn as HTML on top of the 3D view so they
// stay crisp at any screen density.

export type BarStyle = "enemy" | "crew";

interface Bar {
  root: HTMLDivElement;
  fill: HTMLDivElement;
  seen: boolean;
}

export class WorldLabels {
  private readonly bars = new Map<number, Bar>();

  constructor(private readonly layer: HTMLElement) {}

  /** Call once per frame before placing bars; bars not placed this frame are hidden. */
  begin(): void {
    for (const bar of this.bars.values()) bar.seen = false;
  }

  place(id: number, style: BarStyle, x: number, y: number, fraction: number, wide = false): void {
    let bar = this.bars.get(id);
    if (!bar) {
      const root = document.createElement("div");
      root.className = `bar bar-${style}${wide ? " bar-wide" : ""}`;
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      root.append(fill);
      this.layer.append(root);
      bar = { root, fill, seen: false };
      this.bars.set(id, bar);
    }
    bar.seen = true;
    bar.root.style.display = "block";
    bar.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    bar.fill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  }

  end(): void {
    for (const bar of this.bars.values()) if (!bar.seen) bar.root.style.display = "none";
  }

  clear(): void {
    for (const bar of this.bars.values()) bar.root.remove();
    this.bars.clear();
  }
}
