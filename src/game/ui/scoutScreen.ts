// Scouting an island before attacking: the real base from above, with the player free to drag and
// pinch round it. Lists every defense, says what a tapped one does, and leads on to Attack or back
// to the map.

import { BUILDINGS } from "../logic/buildings";
import type { ScoutRow } from "../logic/enemyBase";
import type { RaidBuilding } from "../logic/raid";
import type { MapIsland } from "../logic/worldMap";
import { buildingIcon } from "../render/thumbnails";
import { button, el } from "./kit/dom";
import { sfx } from "./kit/fx";

export interface ScoutHandlers {
  onAttack(island: MapIsland): void;
  onBack(): void;
  /** Drags the view, in screen pixels. */
  onPan(dx: number, dy: number): void;
  /** Above 1 pulls back. */
  onZoom(factor: number): void;
  /** A tap at a client position; returns the building there, if any. */
  onTap(x: number, y: number): RaidBuilding | null;
}

const HINT = "Drag to look round, pinch to zoom. Red ground is in range of a defense.";

/** Further than this and a touch counts as a drag, not a tap. */
const TAP_SLOP = 8;

export class ScoutScreen {
  private readonly attack: HTMLButtonElement;
  readonly root = el("div", "scout");
  private readonly name = el("div", "scout-name");
  private readonly rating = el("div", "scout-rating");
  private readonly tally = el("div", "scout-tally");
  private readonly info = el("div", "scout-info");
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private island: MapIsland | null = null;
  private moved = 0;
  private spread = 0;

  constructor(
    parent: HTMLElement,
    private readonly handlers: ScoutHandlers,
  ) {
    const title = el("div", "scout-title");
    title.append(el("div", "scout-tag", "Scouting"), this.name, this.rating);
    const back = button({
      icon: "map",
      aria: "Back to map",
      round: true,
      variant: "blue",
      size: "lg",
      className: "map-return",
      onClick: () => handlers.onBack(),
    });
    back.append(el("span", "map-return-label", "Back to map"));
    this.attack = button({
      label: "Attack",
      icon: "sword2",
      variant: "red",
      size: "lg",
      className: "scout-attack",
      onClick: () => {
        if (this.island) handlers.onAttack(this.island);
      },
    });
    const bars = [title, this.tally, back, this.attack];
    for (const bar of bars) bar.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.root.append(this.info, ...bars);

    this.root.addEventListener("pointerdown", (e) => this.onDown(e));
    this.root.addEventListener("pointermove", (e) => this.onMove(e));
    this.root.addEventListener("pointerup", (e) => this.onUp(e));
    this.root.addEventListener("pointercancel", (e) => this.pointers.delete(e.pointerId));
    this.root.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        handlers.onZoom(e.deltaY > 0 ? 1.1 : 0.9);
      },
      { passive: false },
    );
    this.root.style.display = "none";
    parent.append(this.root);
  }

  /** `canAttack` is false for a hero who can't take an island alone: a look is still free. */
  show(island: MapIsland, report: readonly ScoutRow[], canAttack = true): void {
    this.island = island;
    this.attack.disabled = !canAttack;
    this.pointers.clear();
    this.name.textContent = island.name;
    this.rating.className = `scout-rating map-${island.difficulty.toLowerCase()}`;
    this.rating.textContent = `${island.difficulty} · Headquarters ${island.hq}`;
    this.tally.replaceChildren(
      ...report.map((row) => {
        const tile = el("div", "scout-tile");
        const picture = el("img", "scout-tile-icon");
        picture.src = buildingIcon(row.type);
        picture.alt = BUILDINGS[row.type].label;
        tile.append(
          picture,
          el("span", "scout-tile-count", `×${row.count}`),
          el("span", "scout-tile-level", `Lv ${row.level}`),
        );
        return tile;
      }),
    );
    this.info.textContent = HINT;
    this.root.style.display = "block";
  }

  hide(): void {
    this.root.style.display = "none";
    this.island = null;
  }

  private onDown(e: PointerEvent): void {
    this.root.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moved = this.pointers.size > 1 ? TAP_SLOP : 0;
    this.spread = this.pinchSpread();
  }

  private onMove(e: PointerEvent): void {
    const from = this.pointers.get(e.pointerId);
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moved += Math.hypot(dx, dy);
    if (this.pointers.size === 1) {
      if (this.moved >= TAP_SLOP) this.handlers.onPan(dx, dy);
      return;
    }
    const spread = this.pinchSpread();
    if (this.spread > 0 && spread > 0) this.handlers.onZoom(this.spread / spread);
    this.spread = spread;
  }

  private onUp(e: PointerEvent): void {
    const known = this.pointers.delete(e.pointerId);
    this.spread = this.pinchSpread();
    if (!known || this.moved >= TAP_SLOP || this.pointers.size > 0) return;
    const building = this.handlers.onTap(e.clientX, e.clientY);
    sfx.tick();
    this.info.textContent = building ? factsAbout(building) : HINT;
  }

  private pinchSpread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}

/** What a scout can say about a building. */
function factsAbout(b: RaidBuilding): string {
  const spec = BUILDINGS[b.type];
  const facts = [`${spec.label} level ${b.level}`, `${Math.round(b.maxHp)} health`];
  if (spec.attack) {
    const dps = (spec.attack.damage * b.power) / spec.attack.reload;
    facts.push(`${Math.round(dps)} damage a second`, `${spec.attack.range} m range`);
  }
  return facts.join(" · ");
}
