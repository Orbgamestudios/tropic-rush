// The crew's unlocked heroes, strolling round the base between jobs: each ambles to a random open
// spot, stands about for a while, and sets off again. Tap one to open them up.

import * as THREE from "three";
import {
  buildableTiles,
  buildingAtTile,
  type CrewLayout,
  GRID_ORIGIN,
  HOME_START,
  obstacleAtTile,
  TILE,
  tileAt,
} from "../logic/crewIsland";
import type { HeroKind } from "../logic/heroes";
import { HERO_NAMES } from "../logic/heroProgress";
import { homeHeight } from "../logic/island";
import { angleDiff, type Vec2, vec } from "../logic/vec";
import { type HeroModel, heroModel } from "./models";
import { AT_EASE, RiflemanAnimator } from "./riflemanAnimator";

/** Meters per second: a stroll, not a march. */
const WALK_SPEED = 1.5;
/** How far they wander from the middle of the base, in meters. */
const WANDER = 26;
/** A tap this close to a hero (CSS pixels) counts as tapping them. */
const TAP_RADIUS = 46;

/** Heroes' names show once the camera is closer than this. */
const NAME_DISTANCE = 38;

interface Walker {
  kind: HeroKind;
  model: HeroModel;
  tag: HTMLDivElement;
  pos: Vec2;
  target: Vec2 | null;
  rest: number;
  walk: number;
  animator: RiflemanAnimator | null;
  facing: number;
  /** Where the name tag was last put, and whether it's showing. */
  tagX: number;
  tagY: number;
  tagShown: boolean;
}

export class HomeHeroes {
  readonly root = new THREE.Group();
  private readonly walkers = new Map<HeroKind, Walker>();
  private named = false;
  private open = new Set<string>();
  private spots: Vec2[] = [];
  private openKey = "";

  constructor(
    private readonly stage: { camera: THREE.Camera; width: number; height: number },
    private readonly labelLayer: HTMLElement,
  ) {}

  /** Keeps one walker per unlocked hero, and tracks where's free to walk. */
  sync(kinds: readonly HeroKind[], layout: Pick<CrewLayout, "cleared" | "buildings">): void {
    const key = `${layout.cleared.length}:${layout.buildings.map((b) => `${b.x}.${b.y}`).join()}`;
    if (key !== this.openKey) {
      this.openKey = key;
      this.open.clear();
      this.spots = [];
      for (const t of buildableTiles()) {
        const center = vec(GRID_ORIGIN.x + (t.x + 0.5) * TILE, GRID_ORIGIN.y + (t.y + 0.5) * TILE);
        if (Math.hypot(center.x - HOME_START.x, center.y - HOME_START.y) > WANDER) continue;
        if (obstacleAtTile(layout, t) || buildingAtTile(layout as CrewLayout, t)) continue;
        this.open.add(`${t.x},${t.y}`);
        this.spots.push(center);
      }
    }
    for (const kind of kinds) {
      if (this.walkers.has(kind) || this.spots.length === 0) continue;
      const model = heroModel(kind);
      if (kind === "tank") model.root.scale.setScalar(0.6);
      const tag = document.createElement("div");
      tag.className = "name-tag hero-tag";
      tag.style.display = "none";
      tag.textContent = HERO_NAMES[kind];
      this.labelLayer.append(tag);
      this.root.add(model.root);
      const start = this.randomSpot();
      this.walkers.set(kind, {
        kind,
        model,
        tag,
        tagX: Number.NaN,
        tagY: Number.NaN,
        tagShown: false,
        pos: { ...start },
        target: null,
        rest: Math.random() * 3,
        walk: 0,
        animator: model.rig && new RiflemanAnimator(model.rig),
        facing: Math.random() * Math.PI * 2,
      });
    }
  }

  private randomSpot(): Vec2 {
    return this.spots[Math.floor(Math.random() * this.spots.length)] ?? HOME_START;
  }

  private isOpen(p: Vec2): boolean {
    const t = tileAt(p);
    return this.open.has(`${t.x},${t.y}`);
  }

  /** A clear straight walk from here, or null to try again next time. */
  private pickTarget(from: Vec2): Vec2 | null {
    const to = this.randomSpot();
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.isOpen(vec(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)))
        return null;
    }
    return to;
  }

  /** `distance` is how far back the camera is: names only show from close up. */
  update(dt: number, distance: number): void {
    this.named = distance < NAME_DISTANCE;
    for (const w of this.walkers.values()) {
      // A new building or job landed on them: step aside.
      if (!this.isOpen(w.pos) && this.spots.length > 0) {
        w.pos = { ...this.randomSpot() };
        w.target = null;
      }
      if (!w.target) {
        w.rest -= dt;
        if (w.rest <= 0) {
          w.target = this.pickTarget(w.pos);
          w.rest = 1.5 + Math.random() * 5;
        }
      }
      const moving = w.target !== null;
      if (w.target) {
        const dx = w.target.x - w.pos.x;
        const dy = w.target.y - w.pos.y;
        const gap = Math.hypot(dx, dy);
        const step = Math.min(gap, WALK_SPEED * dt);
        if (gap > 0.01) {
          w.pos.x += (dx / gap) * step;
          w.pos.y += (dy / gap) * step;
          const heading = Math.atan2(dy, dx);
          w.facing += angleDiff(heading, w.facing) * Math.min(1, dt * 6);
        }
        if (gap < 0.1) w.target = null;
        w.walk += dt * WALK_SPEED * 3;
      }
      const { model } = w;
      model.root.position.set(w.pos.x, Math.max(0, homeHeight(w.pos.x, w.pos.y)), w.pos.y);
      model.root.rotation.y = -w.facing;
      if (w.animator) {
        w.animator.update(dt, { ...AT_EASE, moving, speed: moving ? WALK_SPEED : 0 });
        this.placeTag(w);
        continue;
      }
      const swing = moving ? Math.sin(w.walk) : 0;
      if (model.legs) {
        model.legs[0].rotation.z = swing * 0.6;
        model.legs[1].rotation.z = -swing * 0.6;
      }
      model.body.position.y = moving ? Math.abs(Math.sin(w.walk)) * 0.05 : 0;
      this.placeTag(w);
    }
  }

  private screen(w: Walker, height: number): { x: number; y: number; ok: boolean } {
    const ground = Math.max(0, homeHeight(w.pos.x, w.pos.y));
    const p = new THREE.Vector3(w.pos.x, ground + height, w.pos.y).project(this.stage.camera);
    return {
      x: ((p.x + 1) / 2) * this.stage.width,
      y: ((1 - p.y) / 2) * this.stage.height,
      ok: p.z < 1,
    };
  }

  private placeTag(w: Walker): void {
    const s = this.screen(w, w.model.height + 0.4);
    const show = s.ok && this.named;
    if (show !== w.tagShown) {
      w.tagShown = show;
      w.tag.style.display = show ? "block" : "none";
    }
    if (!show) return;
    // A phone lays the page out again for every write, moved or not.
    if (Math.abs(s.x - w.tagX) < 0.5 && Math.abs(s.y - w.tagY) < 0.5) return;
    w.tagX = s.x;
    w.tagY = s.y;
    w.tag.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  /** The hero nearest a screen point (relative to the canvas), if one's close enough. */
  heroAt(x: number, y: number): HeroKind | null {
    let best: HeroKind | null = null;
    let bestGap = TAP_RADIUS;
    for (const w of this.walkers.values()) {
      const s = this.screen(w, 1);
      if (!s.ok) continue;
      const gap = Math.hypot(s.x - x, s.y - y);
      if (gap < bestGap) {
        best = w.kind;
        bestGap = gap;
      }
    }
    return best;
  }

  dispose(): void {
    for (const w of this.walkers.values()) w.tag.remove();
    this.walkers.clear();
  }
}
