// Draws a raid: mirrors the rules' state into Three.js objects every frame and turns the
// rules' events into effects. It never changes the state.

import * as THREE from "three";
import { BUILDINGS } from "../logic/buildings";
import { type CrewLayout, HOME_START } from "../logic/crewIsland";
import { CRYSTAL_KINDS } from "../logic/crystals";
import { costText, type Purse } from "../logic/economy";
import { HEROES } from "../logic/heroes";
import { HOME_SHAPE, type IslandLayout, type IslandShape } from "../logic/island";
import type {
  Projectile,
  ProjectileKind,
  RaidBuilding,
  RaidEvent,
  RaidHero,
  RaidState,
  Team,
  TurretKind,
  ZoneKind,
} from "../logic/raid";
import type { Spoils } from "../logic/spoils";
import { angleDiff, angleOf, distance, sub, type Vec2 } from "../logic/vec";
import type { WorldLabels } from "../ui/labels";
import { AimView } from "./aimCone";
import { buildCamp } from "./camp";
import { buildClouds, type CloudView } from "./clouds";
import { DangerMap } from "./dangerMap";
import { Effects } from "./effects";
import { Fireflies } from "./fireflies";
import { tileFit, tileRotation } from "./footprint";
import { HeroAnimator } from "./heroAnimator";
import { buildingLamps, type Lamp, LightPool } from "./lightPool";
import {
  type BuildingModel,
  buildingModel,
  crewTurretModel,
  decoyDroneModel,
  gunboatModel,
  type HeroModel,
  heroModel,
  mineModel,
  rubbleModel,
} from "./models";
import { OvergrowthView } from "./overgrowth";
import { COLORS } from "./palette";
import { buildProps, buildShore, homeCliffs, updateWind } from "./props";
import { crystalGem } from "./relics";
import { homeScenery, sceneryMap } from "./scenery";
import { at, ball, barrel, cone, cyl, disposeGeometries } from "./shapes";
import { buildTerrain, type TerrainView } from "./terrain";

interface BuildingView {
  model: BuildingModel;
  rubble: THREE.Group | null;
  baseRotation: number;
  /** How far it's come down, 0 to 1, once destroyed. */
  collapse: number | null;
  baseY: number;
  sights: SniperSights | null;
}

interface HeroView {
  model: HeroModel;
  /** Moves the full rig, for the heroes that have one. */
  animator: HeroAnimator | null;
  /** Where the hero was last frame and how much health they had, to see what changed. */
  last: Vec2;
  lastHp: number;
  speed: number;
  stepTimer: number;
  walk: number;
  fallen: number;
  facing: number;
  ring: THREE.Mesh;
}

/** A glowing ring on the ground under a hero: bright green for you, blue for crewmates. */
function heroRing(radius: number, leader: boolean): THREE.Mesh {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const c = size / 2;
    const color = leader ? "70, 235, 110" : "80, 175, 255";
    // A crisp ring with a soft glow either side, clear in the middle.
    const glow = g.createRadialGradient(c, c, c * 0.5, c, c, c);
    glow.addColorStop(0, `rgba(${color}, 0)`);
    glow.addColorStop(0.55, `rgba(${color}, 0.12)`);
    glow.addColorStop(0.78, `rgba(${color}, 0.9)`);
    glow.addColorStop(0.84, `rgba(${color}, 0.9)`);
    glow.addColorStop(0.92, `rgba(${color}, 0.25)`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    g.fillStyle = glow;
    g.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      // Laid flat over slopes, so it ignores the depth of what's under it.
      depthTest: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

const BULLET_HEIGHT = 1.1;
/** How high a sniper's beam starts, as a share of its tower. */
const SIGHTS_FROM = 0.92;

interface SniperSights {
  /** A thin line one meter long, stretched out to reach its target. */
  beam: THREE.Mesh;
  /** A ring on the ground, so whoever's in the sights can't miss it. */
  mark: THREE.Mesh;
}

function sniperSights(): SniperSights {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xff1408).multiplyScalar(1.6),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  const line = new THREE.CylinderGeometry(0.09, 0.09, 1, 5, 1, true);
  line.rotateX(Math.PI / 2);
  line.translate(0, 0, 0.5);
  const beam = new THREE.Mesh(line, material);
  const ring = new THREE.RingGeometry(0.9, 1.15, 20);
  ring.rotateX(-Math.PI / 2);
  const mark = new THREE.Mesh(ring, material.clone());
  (mark.material as THREE.MeshBasicMaterial).depthTest = false;
  beam.visible = false;
  mark.visible = false;
  return { beam, mark };
}

/** How near the screen's top and sides a building's health bar can go, as a share of it. */
const BAR_TOP = 0.2;
const BAR_MARGIN = 0.12;

function projectileMesh(kind: ProjectileKind, team: Team): THREE.Object3D {
  switch (kind) {
    case "bullet": {
      const geometry = new THREE.CapsuleGeometry(0.06, 0.45, 2, 6);
      geometry.rotateZ(Math.PI / 2);
      // Brighter than white, so tracers catch the bloom.
      const color = new THREE.Color(team === "crew" ? 0xfff0a0 : 0xff7d4d).multiplyScalar(3);
      return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color }));
    }
    case "sniper": {
      const geometry = new THREE.CapsuleGeometry(0.08, 1.8, 2, 6);
      geometry.rotateZ(Math.PI / 2);
      const color = new THREE.Color(0xff3a26).multiplyScalar(4);
      return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color }));
    }
    case "rocket": {
      const g = new THREE.Group();
      g.add(at(barrel(0.11, 0.7, COLORS.olive, 8), -0.35, 0, 0));
      g.add(at(cone(0.12, 0.25, COLORS.enemyRust, 8), 0.45, 0, 0, 0, 0, -Math.PI / 2));
      return g;
    }
    case "harpoon": {
      const g = new THREE.Group();
      g.add(at(barrel(0.05, 1.6, COLORS.darkMetal, 6), -1.2, 0, 0));
      g.add(at(cone(0.13, 0.4, COLORS.metal, 8), 0.5, 0, 0, 0, 0, -Math.PI / 2));
      return g;
    }
    case "grenade":
      return ball(0.18, COLORS.olive, 10);
    case "shell":
      return ball(0.22, COLORS.darkMetal, 10);
    case "mortar":
      return ball(0.32, COLORS.darkMetal, 10);
    case "artillery":
      return ball(0.42, COLORS.darkMetal, 12);
    case "lava":
      return new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.9, 1),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a1c).multiplyScalar(2) }),
      );
    case "vial": {
      const g = new THREE.Group();
      g.add(cyl(0.16, 0.16, 0.34, 0x7dff9a, 10, { emissive: 0x2a8a45 }));
      g.add(at(cyl(0.07, 0.09, 0.14, 0xf7f7f2, 8), 0, 0.22, 0));
      return g;
    }
  }
}

export class RaidView {
  readonly root = new THREE.Group();
  /** Who's playing each hero, for the tags over crewmates. */
  names: readonly string[] = [];
  readonly effects: Effects;
  private readonly lights = new LightPool();
  private readonly fireflies: Fireflies;
  /** How hard the last blasts should shake the camera; Game takes it each frame. */
  private tremor = 0;
  private trailTick = 0;
  /** Turned off once the raid is over, so bars don't float over the results screen. */
  showBars = true;
  /** Where the player is dragging the aim stick (null when not), for the aim cone. */
  aim: Vec2 | null = null;
  /** Where the last building fell. */
  lastBlast: Vec2 | null = null;
  /** The camera as of the last frame, for placing words over things. */
  private lastCamera: THREE.Camera | null = null;
  private lastSize = { width: 1, height: 1 };
  private readonly aimView = new AimView();
  private readonly terrain: TerrainView;
  private readonly props: THREE.Group;
  private readonly clouds: CloudView;
  private readonly buildings = new Map<number, BuildingView>();
  private readonly heroes = new Map<number, HeroView>();
  private readonly projectiles = new Map<number, THREE.Object3D>();
  private readonly pool = new Map<string, THREE.Object3D[]>();
  private readonly telegraphs = new Map<number, { ring: THREE.Mesh; fill: THREE.Mesh }>();
  private readonly zones = new Map<number, THREE.Object3D>();
  private readonly turrets = new Map<number, { root: THREE.Group; head: THREE.Object3D }>();
  private readonly mines = new Map<number, THREE.Mesh>();
  private readonly boat: { root: THREE.Group; cannon: THREE.Object3D };
  /** Fading circles for how far defenses shoot; not on the crew's own island. */
  private readonly reach: DangerMap | null;
  private readonly boatHeading: number;
  private cannonAim: number;
  private ringPulse = 0;
  private readonly focus = new THREE.Vector3();

  /** Set when the island being raided is the crew's own (a nightly raid's replay). */
  private readonly overgrowth: OvergrowthView | null = null;
  private readonly defending: boolean;
  private readonly ground: (x: number, y: number) => number;
  private readonly shape: IslandShape;
  /** Seconds until the volcano's next plume of smoke. */
  private plumeIn = 0;
  private readonly gems: THREE.Group[] = [];

  /** `home` draws the crew's own island instead: the heroes are then the attackers. */
  constructor(
    layout: IslandLayout,
    state: RaidState,
    private readonly labels: WorldLabels,
    home?: Pick<CrewLayout, "buildings" | "cleared">,
    /** Which of the state's heroes is this phone's player. */
    private readonly seat = 0,
  ) {
    this.defending = home !== undefined;
    const shape = layout.shape ?? HOME_SHAPE;
    this.shape = shape;
    const { height } = shape;
    this.ground = (x, y) => Math.max(0, height(x, y));
    if (home) {
      const scenery = homeScenery(HOME_START);
      this.overgrowth = new OvergrowthView(scenery);
      this.overgrowth.sync(home);
      this.terrain = buildTerrain(scenery, { height, shade: this.overgrowth.shade });
      this.props = new THREE.Group();
      this.props.add(buildShore(layout.seed, scenery, layout.spawn, height, -0.5), homeCliffs());
      this.root.add(this.overgrowth.root);
    } else {
      const scenery = sceneryMap(layout);
      this.terrain = buildTerrain(scenery, { shape });
      this.props = buildProps(layout, scenery);
      this.props.add(buildCamp(layout, scenery));
    }
    this.clouds = buildClouds(layout.seed, shape);
    this.root.add(this.clouds.root, this.aimView.root);
    this.effects = new Effects((x, z) => this.ground(x, z), this.lights);
    this.fireflies = new Fireflies(layout.seed, this.ground);
    this.root.add(
      this.terrain.root,
      this.props,
      this.effects.root,
      this.lights.root,
      this.fireflies.mesh,
    );

    state.buildings.forEach((b, i) => {
      const model = buildingModel(b.type, home !== undefined);
      // Square on its tiles, the same as on the crew's island.
      const rotated = layout.buildings[i]?.rotated ?? false;
      const baseRotation = tileRotation(rotated);
      model.root.scale.setScalar(tileFit(b.type, rotated, model.root));
      model.root.position.set(b.pos.x, this.ground(b.pos.x, b.pos.y), b.pos.y);
      model.root.rotation.y = baseRotation;
      this.root.add(model.root);
      const sights = BUILDINGS[b.type].attack?.kind === "sniper" ? sniperSights() : null;
      if (sights) this.root.add(sights.beam, sights.mark);
      this.buildings.set(b.id, {
        model,
        rubble: null,
        baseRotation,
        collapse: null,
        baseY: model.root.position.y,
        sights,
      });
    });
    this.lightBuildings(state);

    state.heroes.forEach((h, i) => {
      const model = heroModel(h.kind);
      const ring = heroRing(HEROES[h.kind].radius * 2 + (i === seat ? 0.5 : 0.2), i === seat);
      this.root.add(model.root, ring);
      this.heroes.set(h.id, {
        model,
        animator: model.rig && new HeroAnimator(model.rig),
        last: { ...h.pos },
        lastHp: h.hp,
        speed: 0,
        stepTimer: 0,
        walk: 0,
        fallen: 0,
        facing: h.facing,
        ring,
      });
    });

    for (const m of state.mines) {
      const mesh = mineModel();
      mesh.position.set(m.pos.x, this.ground(m.pos.x, m.pos.y) + 0.03, m.pos.y);
      this.root.add(mesh);
      this.mines.set(m.id, mesh);
    }

    this.reach = home ? null : new DangerMap(state, "raid");
    if (this.reach) this.root.add(this.reach.root);

    this.boat = gunboatModel();
    const toLand = sub(layout.spawn, layout.boat);
    this.boatHeading = angleOf(toLand);
    this.cannonAim = this.boatHeading;
    this.boat.root.position.set(layout.boat.x, 0, layout.boat.y);
    this.boat.root.rotation.y = -this.boatHeading;
    this.root.add(this.boat.root);
  }

  handleEvents(events: readonly RaidEvent[], state: RaidState): void {
    for (const e of events) {
      switch (e.type) {
        case "shot": {
          if (e.kind === "vial") break;
          const big =
            e.kind === "rocket" ||
            e.kind === "shell" ||
            e.kind === "mortar" ||
            e.kind === "harpoon";
          const h = e.kind === "mortar" ? 2.6 : BULLET_HEIGHT;
          const shooter = e.team === "crew" ? this.heroes.get(e.ownerId) : undefined;
          const hero = state.heroes.find((x) => x.id === e.ownerId);
          // Ricochets are also shots of his, but they start off a building and not the barrel.
          const fromBarrel = hero && distance(hero.pos, e.pos) < 2;
          if (shooter?.animator && fromBarrel) {
            shooter.animator.shot();
            const barrel = shooter.animator.muzzle(new THREE.Vector3());
            this.effects.muzzle(barrel, 0xffe08a, 0.25);
            const a = shooter.facing;
            const right = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
            this.effects.casing(barrel.addScaledVector(right, 0.1), right);
            break;
          }
          this.effects.muzzle(
            this.at(e.pos, h),
            e.team === "crew" ? 0xffe08a : 0xffa060,
            big ? 0.5 : 0.25,
          );
          break;
        }
        case "explosion":
          this.effects.explosion(this.at(e.pos, 0.4), e.radius);
          this.shake(e.pos, e.radius * 0.11, state);
          break;
        case "enrage":
          this.effects.burn(this.at(e.pos, 1.2), 1.4);
          this.effects.muzzle(this.at(e.pos, 1.2), 0xff5a2a, 1.2);
          break;
        case "eruption":
          this.effects.explosion(this.at(e.pos, 2), 9);
          this.effects.smokeColumn(this.at(e.pos, 1), 6);
          this.tremor = Math.max(this.tremor, 0.7);
          break;
        case "hit":
          this.effects.hit(this.at(e.pos, BULLET_HEIGHT));
          this.aimView.hit(e.pos);
          break;
        case "heal":
          this.effects.heal(this.at(e.pos, 0.5));
          break;
        case "healBurst":
          this.effects.healBurst(this.at(e.pos, 0.5), e.radius);
          break;
        case "loot":
          this.showLoot(e.pos, e.loot);
          break;
        case "sprint":
          this.effects.footstep(this.at(e.pos, 0));
          break;
        case "destroyed": {
          const radius = BUILDINGS[e.buildingType].radius;
          this.lastBlast = e.pos;
          this.aimView.fell(e.pos, radius);
          this.effects.explosion(this.at(e.pos, 1.2), radius * 1.3);
          this.effects.smokeColumn(this.at(e.pos, 0.5), e.buildingType === "headquarters" ? 8 : 4);
          this.shake(e.pos, radius * 0.16, state);
          this.lightBuildings(state);
          const view = this.buildings.get(e.id);
          if (view) {
            // It comes down rather than vanishing; the rubble grows in under it.
            view.collapse = 0;
            view.rubble = rubbleModel(radius);
            view.rubble.position.copy(view.model.root.position);
            view.rubble.scale.setScalar(0.3);
            this.root.add(view.rubble);
          }
          break;
        }
        case "boatFire": {
          this.cannonAim = angleOf(sub(e.target, state.boat.pos));
          const muzzle = new THREE.Vector3();
          this.boat.cannon.getWorldPosition(muzzle);
          this.effects.muzzle(muzzle.add(new THREE.Vector3(0, 0.3, 0)), 0xffd27a, 1.1);
          break;
        }
        default:
          break;
      }
    }
  }

  /** The crystals a fallen headquarters gives up, rising out of the wreck and turning. */
  dropCrystal(state: RaidState, spoils: Spoils | null): void {
    const hq = state.buildings.find((b) => b.type === "headquarters");
    if (!hq || !spoils) return;
    for (const kind of CRYSTAL_KINDS) {
      if (!spoils.crystals[kind]) continue;
      const gem = crystalGem(kind);
      gem.scale.setScalar(0.1);
      gem.position.copy(this.at(hq.pos, 2));
      this.root.add(gem);
      this.gems.push(gem);
    }
  }

  private updateGems(dt: number, time: number): void {
    for (const gem of this.gems) {
      gem.scale.setScalar(Math.min(1.9, gem.scale.x + dt * 1.4));
      gem.position.y += (this.groundUnderGem(gem) + 6.5 - gem.position.y) * Math.min(1, dt * 2);
      gem.rotation.y = time * 1.6;
    }
  }

  private groundUnderGem(gem: THREE.Group): number {
    return this.ground(gem.position.x, gem.position.z);
  }

  /** The materials a broken mill or storage gives up, rising off the wreck. */
  private showLoot(pos: Vec2, loot: Partial<Purse>): void {
    if (!this.lastCamera) return;
    const { width, height } = this.lastSize;
    const p = this.screenPosition(pos, 3, this.lastCamera, width, height);
    if (p.inFront) this.labels.note(p.x, p.y, `+${costText(loot)}`);
  }

  /** Blasts near the player shake the camera; distant ones barely do. */
  private shake(pos: Vec2, amount: number, state: RaidState): void {
    const hero = state.heroes[this.seat];
    const near = hero ? 1 - Math.min(1, distance(hero.pos, pos) / 40) : 1;
    this.tremor = Math.max(this.tremor, amount * near);
  }

  /** The shake built up since the last call. */
  takeTremor(): number {
    const tremor = this.tremor;
    this.tremor = 0;
    return tremor;
  }

  private at(pos: Vec2, height: number): THREE.Vector3 {
    return new THREE.Vector3(pos.x, this.ground(pos.x, pos.y) + height, pos.y);
  }

  update(
    state: RaidState,
    dt: number,
    time: number,
    camera: THREE.Camera,
    width: number,
    height: number,
  ): void {
    this.lastCamera = camera;
    this.lastSize = { width, height };
    this.terrain.update(time);
    this.clouds.update(time);
    this.updatePlume(dt);
    this.updateGems(dt, time);
    // Plants between the camera and the followed hero dissolve so the hero never disappears.
    const leader = state.heroes[this.seat];
    const watched = leader?.alive ? leader : state.heroes.find((h) => h.alive);
    this.focus.set(
      watched?.pos.x ?? 0,
      watched ? this.ground(watched.pos.x, watched.pos.y) + 1 : 0,
      watched?.pos.y ?? 0,
    );
    updateWind(time, watched && !watched.inBoat && this.showBars ? this.focus : null);
    this.effects.update(dt);
    this.reach?.update(this.showBars && state.conquest === null ? leader : undefined);
    const aiming = this.showBars && !this.defending ? leader : undefined;
    this.aimView.update(state, aiming, this.aim, this.ground, time);
    this.overgrowth?.update(dt);
    this.updateBuildings(state, dt);
    this.updateHeroes(state, dt);
    this.lights.update(dt, time);
    this.fireflies.update(time);
    this.updateProjectiles(state);
    this.updateZones(state, time);
    this.updateTurrets(state);
    this.updateMines(state, time);
    this.updateBoat(time);
    this.updateLabels(state, camera, width, height);
  }

  /** A volcano smokes all the time, not only when it goes off. */
  private updatePlume(dt: number): void {
    const { volcano } = this.shape;
    if (!volcano) return;
    this.plumeIn -= dt;
    if (this.plumeIn > 0) return;
    this.plumeIn = 2.4;
    this.effects.smokeColumn(this.at(volcano.pos, 1), 3, false);
  }

  /** The glow of a volcano's crater and its rivers, seen after dark. */
  private lavaLamps(): Lamp[] {
    const { shape } = this;
    const { volcano } = shape;
    if (!volcano) return [];
    const lamp = (x: number, z: number, reach: number): Lamp => ({
      x,
      y: this.ground(x, z),
      z,
      reach,
      power: 2.6,
      color: 0xff6a24,
      halo: 2,
      height: 0.5,
      flicker: true,
    });
    const lamps = [lamp(volcano.pos.x, volcano.pos.y, volcano.radius * 0.6)];
    // Along the rivers, wherever the lava runs on open ground.
    for (let x = -shape.reach; x < shape.reach; x += 16) {
      for (let y = -shape.reach; y < shape.reach; y += 16) {
        for (let dx = 0; dx < 16; dx += 4) {
          if (shape.lava(x + dx, y + dx) <= 0.5) continue;
          lamps.push(lamp(x + dx, y + dx, 12));
          break;
        }
      }
    }
    return lamps;
  }

  /** Lamps on everything still standing. */
  private lightBuildings(state: RaidState): void {
    this.lights.setLamps([
      ...state.buildings
        .filter((b) => !b.destroyed)
        .flatMap((b) =>
          buildingLamps(b.type, b.pos.x, this.ground(b.pos.x, b.pos.y), b.pos.y, !this.defending),
        ),
      ...this.lavaLamps(),
    ]);
  }

  private updateBuildings(state: RaidState, dt: number): void {
    for (const b of state.buildings) {
      const view = this.buildings.get(b.id);
      if (!view) continue;
      const spec = BUILDINGS[b.type];
      this.aimSights(view, b);
      if (b.destroyed) {
        this.collapse(view, spec.height, dt);
        continue;
      }
      // A badly hurt building burns, harder the closer it is to falling.
      const health = b.hp / b.maxHp;
      if (health < 0.5 && Math.random() < dt * (health < 0.25 ? 9 : 4)) {
        this.effects.burn(this.at(b.pos, spec.height * 0.55), spec.radius * 0.6);
      }
      // Models point along +x; the root is already turned to face the beach.
      if (view.model.head) view.model.head.rotation.y = -b.aim - view.baseRotation;
      if (view.model.flame) view.model.flame.visible = b.firing;
    }
  }

  private aimSights(view: BuildingView, b: RaidBuilding): void {
    const { sights } = view;
    if (!sights) return;
    const { beam, mark } = sights;
    const on = b.sights !== null && !b.destroyed;
    beam.visible = on;
    mark.visible = on;
    if (!on || !b.sights) return;
    const top = view.baseY + BUILDINGS[b.type].height * SIGHTS_FROM;
    beam.position.set(b.pos.x, top, b.pos.y);
    const target = this.at(b.sights, BULLET_HEIGHT);
    beam.scale.set(1, 1, beam.position.distanceTo(target));
    beam.lookAt(target);
    mark.position.copy(this.at(b.sights, 0.1));
  }

  private collapse(view: BuildingView, height: number, dt: number): void {
    if (view.collapse === null || view.collapse >= 1) return;
    view.collapse = Math.min(1, view.collapse + dt * 1.5);
    const t = view.collapse;
    const { root } = view.model;
    root.position.y = view.baseY - height * 1.05 * t * t;
    root.rotation.z = t * 0.22;
    root.rotation.x = t * 0.12;
    view.rubble?.scale.setScalar(0.3 + 0.7 * t);
    if (t >= 1) root.visible = false;
  }

  private updateHeroes(state: RaidState, dt: number): void {
    this.ringPulse += dt;
    for (const h of state.heroes) {
      const view = this.heroes.get(h.id);
      if (!view) continue;
      const { model, ring } = view;
      model.root.position.set(h.pos.x, this.ground(h.pos.x, h.pos.y), h.pos.y);
      ring.visible = h.alive && !this.defending;
      ring.position.set(h.pos.x, this.ground(h.pos.x, h.pos.y) + 0.06, h.pos.y);
      ring.scale.setScalar(1 + Math.sin(this.ringPulse * 0.9) * 0.04);
      // Turn smoothly rather than snapping.
      view.facing += angleDiff(h.facing, view.facing) * Math.min(1, dt * 18);
      model.root.rotation.y = -view.facing;
      if (h.alive && this.lights.active) {
        this.lights.follow(h.pos.x, this.ground(h.pos.x, h.pos.y), h.pos.y, 8, 2.2, 0xffe8c8);
      }

      if (h.alive && h.moving) {
        view.stepTimer -= dt;
        if (view.stepTimer <= 0) {
          view.stepTimer = h.sprint > 0 ? 0.08 : 0.2;
          this.effects.footstep(this.at(h.pos, 0));
        }
      }
      if (view.animator) {
        this.animateHero(view, view.animator, h, state, dt);
        continue;
      }
      if (!h.alive) {
        view.fallen = Math.min(1, view.fallen + dt * 3);
        model.body.rotation.x = (view.fallen * Math.PI) / 2.2;
        model.body.position.y = -view.fallen * 0.2;
        continue;
      }
      const speed = HEROES[h.kind].speed;
      if (h.moving) view.walk += dt * speed * 2.2;
      const swing = h.moving ? Math.sin(view.walk) : 0;
      if (model.legs) {
        model.legs[0].rotation.z = swing * 0.7;
        model.legs[1].rotation.z = -swing * 0.7;
      }
      model.body.position.y = h.moving ? Math.abs(Math.sin(view.walk)) * 0.07 : 0;
      model.body.rotation.z = h.moving ? -0.08 : 0;
      model.body.position.x = h.firing ? -0.04 * Math.random() : 0;
    }
  }

  private animateHero(
    view: HeroView,
    animator: HeroAnimator,
    h: RaidHero,
    state: RaidState,
    dt: number,
  ): void {
    if (dt <= 0) return;
    const gone = distance(h.pos, view.last);
    view.speed += (gone / dt - view.speed) * Math.min(1, dt * 12);
    const heading = gone > 1e-4 ? angleDiff(angleOf(sub(h.pos, view.last)), view.facing) : 0;
    view.last = { ...h.pos };
    if (h.hp < view.lastHp - 0.5 && h.alive) animator.flinch();
    view.lastHp = h.hp;
    const { attack } = HEROES[h.kind];
    const reloadTime = (attack.kind === "burst" ? attack.reload : 1) * h.mods.reload;
    animator.update(dt, {
      moving: h.moving,
      speed: view.speed,
      heading,
      aiming: h.firing || (this.aim !== null && h === state.heroes[this.seat]),
      reload: attack.kind === "burst" && h.burstLeft === 0 ? Math.min(1, h.reload / reloadTime) : 0,
      down: !h.alive,
      cheering: state.status === "won" || state.conquest !== null,
    });
  }

  private takeFromPool(kind: ProjectileKind, team: Team): THREE.Object3D {
    const key = `${kind}:${team}`;
    const free = this.pool.get(key);
    const reused = free?.pop();
    const obj = reused ?? projectileMesh(kind, team);
    obj.userData.poolKey = key;
    obj.visible = true;
    this.root.add(obj);
    return obj;
  }

  private returnToPool(obj: THREE.Object3D): void {
    const key = obj.userData.poolKey as string;
    obj.visible = false;
    this.root.remove(obj);
    const free = this.pool.get(key) ?? [];
    free.push(obj);
    this.pool.set(key, free);
  }

  private updateProjectiles(state: RaidState): void {
    this.trailTick++;
    const live = new Set<number>();
    for (const p of state.projectiles) {
      live.add(p.id);
      let obj = this.projectiles.get(p.id);
      if (!obj) {
        obj = this.takeFromPool(p.kind, p.team);
        this.projectiles.set(p.id, obj);
      }
      this.placeProjectile(p, obj);
      if (p.lob && (p.kind === "mortar" || p.kind === "artillery" || p.kind === "lava")) {
        this.placeTelegraph(p);
      }
      if (p.kind === "rocket" || p.kind === "lava") this.effects.trail(obj.position, true);
      else if (
        p.kind !== "bullet" &&
        p.kind !== "harpoon" &&
        p.kind !== "vial" &&
        this.trailTick % 3 === 0
      )
        this.effects.trail(obj.position, false);
    }
    for (const [id, obj] of this.projectiles) {
      if (live.has(id)) continue;
      this.returnToPool(obj);
      this.projectiles.delete(id);
    }
    for (const [id, t] of this.telegraphs) {
      if (live.has(id)) continue;
      this.root.remove(t.ring, t.fill);
      t.ring.geometry.dispose();
      t.fill.geometry.dispose();
      (t.ring.material as THREE.Material).dispose();
      (t.fill.material as THREE.Material).dispose();
      this.telegraphs.delete(id);
    }
  }

  private placeProjectile(p: Projectile, obj: THREE.Object3D): void {
    if (p.lob) {
      const { from, to, t: elapsed, duration, peak } = p.lob;
      obj.visible = elapsed >= 0;
      const t = Math.max(0, Math.min(1, elapsed / duration));
      const h0 = this.ground(from.x, from.y) + 1.6;
      const h1 = this.ground(to.x, to.y) + 0.2;
      obj.position.set(p.pos.x, h0 + (h1 - h0) * t + 4 * peak * t * (1 - t), p.pos.y);
      return;
    }
    obj.position.set(p.pos.x, this.ground(p.pos.x, p.pos.y) + BULLET_HEIGHT, p.pos.y);
    obj.rotation.y = -Math.atan2(p.vel.y, p.vel.x);
  }

  private placeTelegraph(p: Projectile): void {
    if (!p.lob) return;
    let t = this.telegraphs.get(p.id);
    if (!t) {
      const color = p.team === "enemy" ? 0xff4b3a : 0xffd84a;
      const ringGeometry = new THREE.RingGeometry(p.splash * 0.88, p.splash, 40);
      ringGeometry.rotateX(-Math.PI / 2);
      const fillGeometry = new THREE.CircleGeometry(p.splash, 40);
      fillGeometry.rotateX(-Math.PI / 2);
      // Laid flat over slopes, so they ignore the depth of what's under them.
      const overlay = (opacity: number) =>
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          depthTest: false,
        });
      // Several shells can land on one spot, so the fill is faint enough to overlap.
      const ring = new THREE.Mesh(ringGeometry, overlay(0.7));
      const fill = new THREE.Mesh(fillGeometry, overlay(0.13));
      ring.renderOrder = 2;
      fill.renderOrder = 2;
      const y = this.ground(p.lob.to.x, p.lob.to.y) + 0.12;
      ring.position.set(p.lob.to.x, y, p.lob.to.y);
      fill.position.set(p.lob.to.x, y + 0.01, p.lob.to.y);
      this.root.add(ring, fill);
      t = { ring, fill };
      this.telegraphs.set(p.id, t);
    }
    const progress = Math.max(0.02, Math.min(1, p.lob.t / p.lob.duration));
    t.ring.visible = p.lob.t >= 0;
    t.fill.visible = p.lob.t >= 0;
    t.fill.scale.setScalar(progress);
  }

  private updateZones(state: RaidState, time: number): void {
    const live = new Set<number>();
    for (const z of state.zones) {
      live.add(z.id);
      let obj = this.zones.get(z.id);
      if (!obj) {
        obj = z.kind === "heal" ? this.healCircle(z.radius) : this.groundPatch(z.kind, z.radius);
        obj.position.set(z.pos.x, this.ground(z.pos.x, z.pos.y), z.pos.y);
        this.root.add(obj);
        this.zones.set(z.id, obj);
        if (z.kind === "smoke") this.effects.smokeColumn(this.at(z.pos, 0.4), z.time, false);
      }
      const fade = Math.min(1, z.time);
      obj.scale.setScalar(0.6 + 0.4 * fade);
      obj.rotation.y = time * 0.6;
      if (z.kind === "fire" && Math.random() < 0.3) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * z.radius;
        const flame = { x: z.pos.x + Math.cos(a) * r, y: z.pos.y + Math.sin(a) * r };
        this.effects.burn(this.at(flame, 0.3), 0.5);
      }
    }
    for (const [id, obj] of this.zones) {
      if (live.has(id)) continue;
      this.root.remove(obj);
      disposeGeometries(obj);
      this.zones.delete(id);
    }
  }

  /** A soft stain on the ground under burning ground or a smoke cloud. */
  private groundPatch(kind: Exclude<ZoneKind, "heal">, radius: number): THREE.Group {
    const g = new THREE.Group();
    const disc = new THREE.CircleGeometry(radius, 32);
    disc.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: kind === "fire" ? 0xff6a1c : 0xc9ced6,
      transparent: true,
      opacity: kind === "fire" ? 0.3 : 0.55,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(disc, material);
    mesh.renderOrder = 2;
    g.add(at(mesh, 0, 0.1, 0));
    return g;
  }

  private healCircle(radius: number): THREE.Group {
    const g = new THREE.Group();
    const flat = (shape: THREE.BufferGeometry, color: number, opacity: number) => {
      const mesh = new THREE.Mesh(
        shape,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          depthTest: false,
        }),
      );
      mesh.renderOrder = 2;
      return mesh;
    };
    const disc = new THREE.CircleGeometry(radius, 40);
    disc.rotateX(-Math.PI / 2);
    g.add(at(flat(disc, 0x7dff9a, 0.22), 0, 0.1, 0));
    const ring = new THREE.RingGeometry(radius * 0.9, radius, 40);
    ring.rotateX(-Math.PI / 2);
    g.add(at(flat(ring, 0x9dffb4, 0.7), 0, 0.12, 0));
    for (const [x, z] of [
      [0.5, 0],
      [-0.5, 0],
    ] as const) {
      g.add(at(cyl(0.12, 0.12, 0.9, 0x7dff9a), x * radius * 0.6, 0.6, z));
    }
    return g;
  }

  private updateTurrets(state: RaidState): void {
    const live = new Set<number>();
    for (const t of state.turrets) {
      live.add(t.id);
      let view = this.turrets.get(t.id);
      if (!view) {
        view = this.turretModel(t.kind);
        view.root.position.set(t.pos.x, this.ground(t.pos.x, t.pos.y), t.pos.y);
        this.root.add(view.root);
        this.turrets.set(t.id, view);
      }
      view.head.rotation.y = -t.aim;
      // A decoy hangs in the air, bobbing and turning to draw the eye.
      if (t.kind === "decoy") {
        view.head.rotation.y = t.time * 3;
        view.root.position.y = this.ground(t.pos.x, t.pos.y) + 1.6 + Math.sin(t.time * 4) * 0.15;
      }
    }
    for (const [id, view] of this.turrets) {
      if (live.has(id)) continue;
      this.root.remove(view.root);
      disposeGeometries(view.root);
      this.turrets.delete(id);
    }
  }

  private turretModel(kind: TurretKind): { root: THREE.Group; head: THREE.Object3D } {
    if (kind === "decoy") return decoyDroneModel();
    const view = crewTurretModel();
    if (kind === "pocket") view.root.scale.setScalar(0.72);
    return view;
  }

  private updateMines(state: RaidState, time: number): void {
    // A Grenadier who's been trained to sweep sees every mine on the island.
    const swept = state.heroes.some((h) => h.alive && h.mods.mineSweeper);
    for (const m of state.mines) {
      const mesh = this.mines.get(m.id);
      if (!mesh) continue;
      const near = state.heroes.some((h) => h.alive && distance(h.pos, m.pos) < 5);
      const showing = near || swept || m.fuse !== null;
      // Hidden from raiders until they're on top of it; a replay of your island shows your own.
      mesh.visible = !m.exploded && (showing || this.defending);
      const mat = mesh.material as THREE.MeshLambertMaterial;
      mat.opacity = showing ? 0.9 : 0.3;
      mat.emissive.set(m.fuse !== null && Math.sin(time * 40) > 0 ? 0xff2a1a : 0x000000);
    }
  }

  private updateBoat(time: number): void {
    const { root, cannon } = this.boat;
    root.position.y = 0.12 + Math.sin(time * 1.6) * 0.08;
    root.rotation.z = Math.sin(time * 1.1) * 0.025;
    const relative = -angleDiff(this.cannonAim, this.boatHeading);
    cannon.rotation.y += (relative - cannon.rotation.y) * 0.1;
  }

  /** Where a ground point appears on screen, in CSS pixels. */
  screenPosition(pos: Vec2, height: number, camera: THREE.Camera, width: number, h: number) {
    const v = new THREE.Vector3(pos.x, this.ground(pos.x, pos.y) + height, pos.y).project(camera);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * h, inFront: v.z < 1 };
  }

  private updateLabels(
    state: RaidState,
    camera: THREE.Camera,
    width: number,
    height: number,
  ): void {
    this.labels.begin();
    // The menu's island has no crew; keep it free of health bars.
    if (!this.showBars || state.heroes.length === 0) {
      this.labels.end();
      return;
    }
    const focus = (
      state.heroes[this.seat]?.alive ? state.heroes[this.seat] : state.heroes.find((h) => h.alive)
    )?.pos;
    for (const b of state.buildings) {
      if (b.destroyed) continue;
      // A dense base would be all bars: only what's been hit nearby, what the hero's firing at,
      // and the headquarters.
      const damaged = b.hp < b.maxHp;
      const near = focus ? distance(focus, b.pos) < 22 : false;
      const aimedAt = state.heroes[this.seat]?.targetId === b.id;
      if (!(damaged && near) && !aimedAt && b.type !== "headquarters") continue;
      const p = this.screenPosition(b.pos, BUILDINGS[b.type].height + 0.9, camera, width, height);
      if (!p.inFront) continue;
      // Off screen a bar means nothing, unless it's the headquarters taking damage.
      const hq = b.type === "headquarters";
      const off = p.x < 0 || p.x > width || p.y < 0 || p.y > height;
      if (off && !(hq && damaged)) continue;
      // Up close a tall building reaches past the HUD: its bar stays where it can be read.
      this.labels.place(
        b.id,
        this.defending ? "crew" : "enemy",
        Math.max(BAR_MARGIN * width, Math.min((1 - BAR_MARGIN) * width, p.x)),
        Math.max(BAR_TOP * height, p.y),
        b.hp / b.maxHp,
        b.type === "headquarters",
        b.maxHp,
      );
    }
    for (const h of state.heroes) {
      if (!h.alive) continue;
      const view = this.heroes.get(h.id);
      const p = this.screenPosition(
        h.pos,
        (view?.model.height ?? 2.2) + 0.3,
        camera,
        width,
        height,
      );
      const style = this.defending ? "enemy" : "crew";
      const seat = state.heroes.indexOf(h);
      const name = seat === this.seat ? "" : this.names[seat];
      if (p.inFront) this.labels.place(h.id, style, p.x, p.y, h.hp / h.maxHp, false, h.maxHp, name);
    }
    for (const t of state.turrets) {
      const p = this.screenPosition(t.pos, 1.7, camera, width, height);
      if (p.inFront) this.labels.place(t.id, "crew", p.x, p.y, t.hp / t.maxHp, false, t.maxHp);
    }
    this.labels.end();
  }

  dispose(): void {
    // The plants share geometry and materials with other views: dispose them separately.
    if (this.overgrowth) {
      this.root.remove(this.overgrowth.root);
      this.overgrowth.dispose();
    }
    this.clouds.dispose();
    this.aimView.dispose();
    this.reach?.dispose();
    for (const { ring } of this.heroes.values()) {
      const m = ring.material as THREE.MeshBasicMaterial;
      m.map?.dispose();
      m.dispose();
    }
    this.labels.clear();
    this.terrain.dispose();
    this.effects.dispose();
    this.lights.dispose();
    this.fireflies.dispose();
    disposeGeometries(this.root);
    for (const objects of this.pool.values()) for (const o of objects) disposeGeometries(o);
    for (const t of this.telegraphs.values()) {
      (t.ring.material as THREE.Material).dispose();
      (t.fill.material as THREE.Material).dispose();
    }
  }
}
