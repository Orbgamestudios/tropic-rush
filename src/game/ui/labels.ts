// Health bars that float over buildings and heroes, drawn as HTML on top of the 3D view so they
// stay crisp at any screen density. When something takes damage, a "-N" number pops up and
// floats away (hits within a quarter second are added together so they don't pile up).

export type BarStyle = "enemy" | "crew";

interface Bar {
  root: HTMLDivElement;
  fill: HTMLDivElement;
  lag: HTMLDivElement;
  seen: boolean;
  fraction: number;
  lagFraction: number;
  pending: number;
  pendingSince: number;
}

const POP_GROUP_MS = 250;

export class WorldLabels {
  private readonly bars = new Map<number, Bar>();

  constructor(private readonly layer: HTMLElement) {}

  /** Call once per frame before placing bars; bars not placed this frame are hidden. */
  begin(): void {
    for (const bar of this.bars.values()) bar.seen = false;
  }

  place(
    id: number,
    style: BarStyle,
    x: number,
    y: number,
    fraction: number,
    wide = false,
    maxHp = 0,
  ): void {
    const f = Math.max(0, Math.min(1, fraction));
    let bar = this.bars.get(id);
    if (!bar) {
      const root = document.createElement("div");
      root.className = `bar bar-${style}${wide ? " bar-wide" : ""}`;
      const lag = document.createElement("div");
      lag.className = "bar-lag";
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      root.append(lag, fill);
      this.layer.append(root);
      bar = {
        root,
        fill,
        lag,
        seen: false,
        fraction: f,
        lagFraction: f,
        pending: 0,
        pendingSince: 0,
      };
      this.bars.set(id, bar);
    }
    const now = performance.now();
    if (f < bar.fraction && maxHp > 0) {
      if (bar.pending === 0) bar.pendingSince = now;
      bar.pending += (bar.fraction - f) * maxHp;
    }
    if (bar.pending > 0 && now - bar.pendingSince > POP_GROUP_MS) {
      this.pop(x, y, Math.round(bar.pending), style);
      bar.pending = 0;
    }
    bar.fraction = f;
    bar.lagFraction = Math.max(f, bar.lagFraction - 0.012);
    bar.seen = true;
    bar.root.style.display = "block";
    bar.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    bar.fill.style.width = `${f * 100}%`;
    bar.lag.style.width = `${bar.lagFraction * 100}%`;
  }

  /** A damage number that jumps up and fades. */
  private pop(x: number, y: number, amount: number, style: BarStyle): void {
    if (amount < 1) return;
    const n = document.createElement("div");
    n.className = `dmg dmg-${style}${amount >= 150 ? " dmg-big" : ""}`;
    n.textContent = `-${amount}`;
    n.style.left = `${(x + (Math.random() - 0.5) * 18).toFixed(1)}px`;
    n.style.top = `${(y - 14).toFixed(1)}px`;
    this.layer.append(n);
    setTimeout(() => n.remove(), 950);
  }

  end(): void {
    for (const bar of this.bars.values()) if (!bar.seen) bar.root.style.display = "none";
  }

  clear(): void {
    for (const bar of this.bars.values()) bar.root.remove();
    this.bars.clear();
  }
}
