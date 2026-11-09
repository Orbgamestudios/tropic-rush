// Draws a raid: mirrors the rules' state into Three.js objects every frame and turns the
// rules' events into effects. It never changes the state.

import * as THREE from "three";
import { SIM_STEP } from "../config";
import { BUILDINGS, type BuildingSpec, type BuildingType } from "../logic/buildings";
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
  Zone,
} from "../logic/raid";
import type { Spoils } from "../logic/spoils";
import { FAST_BARRIER, FAST_FORWARD, SLOW_WORLD } from "../logic/timeShards";
import { angleDiff, angleOf, distance, sub, type Vec2 } from "../logic/vec";
import type { WorldLabels } from "../ui/labels";
import { AimView } from "./aimCone";
import { type AreaMark, areaMark } from "./areaMarks";
import { kitPiece, lampSpots, levelSize, type Piece } from "./buildingKit";
import { buildCamp } from "./camp";
import { type CloudView, homeClouds, RAID_REACH } from "./clouds";
import { DefenseReach } from "./defenseReach";
import { Effects } from "./effects";
import { Fireflies } from "./fireflies";
import { tileFit, tileRotation } from "./footprint";
import { HeroAnimator } from "./heroAnimator";
import { Lightning } from "./lightning";
import { buildingLamps, type Lamp, LightPool } from "./lightPool";
import { Lookout } from "./lookout";
import {
  type BuildingModel,
  buildingModel,
  crewTurretModel,
  decoyDroneModel,
  type GunboatModel,
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
import { SandMask } from "./sandPatches";
import { homeScenery, sceneryMap } from "./scenery";
import { at, ball, barrel, cone, cyl, disposeGeometries } from "./shapes";
import { Snowfall } from "./snowfall";
import { buildTerrain, type TerrainView } from "./terrain";

interface BuildingView {
  model: BuildingModel;
  rubble: THREE.Group | null;
  baseRotation: number;
  /** How far its guns are kicked back, 1 just after a shot, easing back to 0. */
  kick: number;
  /** Seconds since it last fired, for a launcher putting its next harpoon on. */
  sinceShot: number;
  /** Where a launcher's harpoon sits when it's ready. */
  boltRest: THREE.Vector3;
  /** Where its guns sit at rest, along the way they point. */
  gunsRest: THREE.Vector3;
  /** The way its guns point, in what they're mounted on: they kick straight back along it. */
  gunsAxis: THREE.Vector3;
  /** Which barrel fires next. */
  barrel: number;
  /** How far it's come down, 0 to 1, once destroyed. */
  collapse: number | null;
  baseY: number;
  sights: SniperSights | null;
  /** Its head, watching the shore while there's nothing to shoot. */
  lookout: Lookout;
  /** The aim it had last frame, and how much longer it counts as in a fight, in seconds. */
  lastAim: number;
  alert: number;
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
  facing: number;
  /** How fast they're turning, in radians a second. */
  turn: number;
  ring: THREE.Mesh;
  /** Their own materials, put by while they're drawn solid green for a record. */
  greened: Map<THREE.Mesh, THREE.Material | THREE.Material[]> | null;
  /** Fast forward's barrier round them, made the first time they have one. */
  bubble: THREE.Mesh | null;
}

/**
 * A hero being recorded is drawn solid bright green: lit and shaded, casting their shadow as ever,
 * but every part of them the one color.
 */
const RECORDING = new THREE.MeshLambertMaterial({ color: 0x3dff6e, emissive: 0x0d7a2a });

/** Seconds a hero takes running back along the way they came, on a retry or a record's end. */
const REWIND_SLIDE = 0.8;

/** A glowing ring on the ground under a hero: bright green for you, blue for crewmates. */
function heroRing(radius: number, leader: boolean, rgb?: string): THREE.Mesh {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const c = size / 2;
    const color = rgb ?? (leader ? "70, 235, 110" : "80, 175, 255");
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
    new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      // It can't bend with the ground, so it ignores the depth of what's under it.
      depthTest: false,
    }),
  );
  mesh.renderOrder = 2;
  return mesh;
}

/** How far either side the ground is read to find its slope, in meters. */
const SLOPE_SPAN = 0.8;
const UP = new THREE.Vector3(0, 1, 0);
const slope = new THREE.Vector3();

const BULLET_HEIGHT = 1.1;
/** How far a turret's guns kick back when they fire, in meters, and how fast they come back. */
const KICK: Partial<Record<BuildingType, { reach: number; back: number }>> = {
  gunTurret: { reach: 0.14, back: 9 },
  // A mortar's tube slams down a long way and comes back up slowly.
  mortar: { reach: 0.35, back: 3 },
  // A launcher's bowstring snaps forward, and is drawn back over most of its reload.
  harpoon: { reach: -0.45, back: 0.5 },
};
/** A launcher's next harpoon shows this long after a shot, then slides on from this far back. */
const BOLT_GONE = 1;
const BOLT_SLIDE = { seconds: 0.9, from: 0.9 } as const;
/** How fast a radar dish turns, in radians a second. */
const SPIN = 1.6;
const BOAT_KICK = 0.45;
const BOAT_KICK_RETURN = 3;
/** Smoke wider than this is a whole screen of it, not a grenade's wisp. */
const SMALL_SMOKE = 5;
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

/** The gunboat's shells and canisters, modeled, by what each leaves behind. */
const BOAT_SHOTS: Partial<Record<string, Piece>> = {
  "": "shell",
  shock: "canisterShock",
  smoke: "canisterSmoke",
};

function projectileMesh(kind: ProjectileKind, team: Team, variant: string): THREE.Object3D {
  const modeled = kind === "artillery" ? BOAT_SHOTS[variant] : undefined;
  const piece = modeled && kitPiece(modeled);
  if (piece) return piece;
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
    case "acid": {
      const g = new THREE.Group();
      g.add(cyl(0.16, 0.16, 0.34, 0xd2f03a, 10, { emissive: 0x6a7a10 }));
      g.add(at(cyl(0.07, 0.09, 0.14, 0x3a3e44, 8), 0, 0.22, 0));
      return g;
    }
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
  private readonly sand = new SandMask();
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
  private snowfall: Snowfall | null = null;
  private readonly snowAt = new THREE.Vector3();
  private lastSize = { width: 1, height: 1 };
  private readonly aimView = new AimView();
  private readonly terrain: TerrainView;
  private readonly props: THREE.Group;
  private readonly clouds: CloudView;
  private readonly buildings = new Map<number, BuildingView>();
  private readonly heroes = new Map<number, HeroView>();
  private readonly projectiles = new Map<number, THREE.Object3D>();
  /** How high a defense's shot set off, and how far it has to drop to whoever it's at. */
  private readonly shotStarts = new Map<number, { height: number; drop: number }>();
  private readonly pool = new Map<string, THREE.Object3D[]>();
  private readonly telegraphs = new Map<number, AreaMark>();
  private readonly zones = new Map<number, AreaMark>();
  private readonly lightning = new Map<number, Lightning>();
  private readonly turrets = new Map<number, { root: THREE.Group; head: THREE.Object3D }>();
  /** Where each hero stood before the rules' last step, and how far on to now the picture is. */
  private readonly before = new Map<number, Vec2>();
  between = 1;
  private readonly mines = new Map<number, THREE.Mesh>();
  private readonly boat: GunboatModel;
  /** How far the gunboat's barrel is kicked back, and where it rests. */
  private boatKick = 0;
  private readonly boatGunsRest: number;
  /** Fading circles for how far defenses shoot; not on the crew's own island. */
  private readonly reach: DefenseReach | null;
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
      this.terrain = buildTerrain(scenery, {
        height,
        shade: this.overgrowth.shade,
        sand: this.sand.texture,
      });
      this.props = new THREE.Group();
      this.props.add(buildShore(layout.seed, scenery, layout.spawn, height, -0.5), homeCliffs());
      this.root.add(this.overgrowth.root);
    } else {
      const scenery = sceneryMap(layout);
      this.terrain = buildTerrain(scenery, { shape, sand: this.sand.texture, snow: layout.snow });
      this.props = buildProps(layout, scenery);
      this.props.add(buildCamp(layout, scenery));
      // Snow falling on the islands up north.
      if ((layout.snow ?? 0) > 0.3) {
        this.snowfall = new Snowfall(layout.snow ?? 0);
        this.root.add(this.snowfall.points);
      }
    }
    // The same sheet of cloud as round the crew's island, kept further off a raid's coast.
    this.clouds = homeClouds(shape, RAID_REACH);
    this.root.add(this.clouds.root, this.aimView.root);
    this.effects = new Effects((x, z) => this.ground(x, z), this.lights);
    this.fireflies = new Fireflies(layout.seed, this.ground);
    // No fireflies out in the snow.
    this.fireflies.away = (layout.snow ?? 0) >= 0.5;
    this.root.add(
      this.terrain.root,
      this.props,
      this.effects.root,
      this.lights.root,
      this.fireflies.mesh,
    );

    state.buildings.forEach((b, i) => {
      const model = buildingModel(b.type, home !== undefined, b.level);
      // Square on its tiles, the same as on the crew's island.
      const rotated = layout.buildings[i]?.rotated ?? false;
      const baseRotation = tileRotation(rotated);
      model.root.scale.setScalar(tileFit(b.type, rotated, model.root) * levelSize(b.type, b.level));
      model.root.position.set(b.pos.x, this.ground(b.pos.x, b.pos.y), b.pos.y);
      model.root.rotation.y = baseRotation;
      this.root.add(model.root);
      const sights = BUILDINGS[b.type].attack?.kind === "sniper" ? sniperSights() : null;
      if (sights) this.root.add(sights.beam, sights.mark);
      this.buildings.set(b.id, {
        model,
        rubble: null,
        baseRotation,
        kick: 0,
        lookout: new Lookout(),
        lastAim: b.aim,
        alert: 0,
        gunsRest: model.guns?.position.clone() ?? new THREE.Vector3(),
        sinceShot: Number.POSITIVE_INFINITY,
        boltRest: model.bolt?.position.clone() ?? new THREE.Vector3(),
        gunsAxis: new THREE.Vector3(1, 0, 0).applyQuaternion(
          model.guns?.quaternion ?? new THREE.Quaternion(),
        ),
        barrel: 0,
        collapse: null,
        baseY: model.root.position.y,
        sights,
      });
    });
    this.sand.paint(
      state.buildings.map((b, i) => ({
        type: b.type,
        x: b.pos.x,
        z: b.pos.y,
        rotated: layout.buildings[i]?.rotated ?? false,
      })),
    );
    this.lightBuildings(state);

    state.heroes.forEach((h, i) => {
      this.addHero(h, i === seat);
    });

    for (const m of state.mines) {
      const mesh = mineModel();
      mesh.position.set(m.pos.x, this.ground(m.pos.x, m.pos.y) + 0.08, m.pos.y);
      this.layOnSlope(mesh, m.pos.x, m.pos.y);
      this.root.add(mesh);
      this.mines.set(m.id, mesh);
    }

    this.reach = home ? null : new DefenseReach(state);
    if (this.reach) this.root.add(this.reach.mesh);

    this.boat = gunboatModel();
    this.boatGunsRest = this.boat.guns?.position.x ?? 0;
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
          if (e.kind === "vial" || e.kind === "acid") break;
          const building = e.team === "enemy" ? this.buildings.get(e.ownerId) : undefined;
          if (building?.model.muzzles?.length) {
            this.fireFrom(building, e.kind === "mortar");
            break;
          }
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
        case "heroDown":
          this.effects.skull(this.at(e.pos, 0));
          break;
        case "retried":
        case "rewound":
          if (e.path.length > 1)
            this.slides.set(e.heroId, { path: e.path, start: performance.now() });
          break;
        case "acidBurst":
          this.effects.acidBurst(this.at(e.pos, 0.4), e.radius);
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
          const { muzzle, cannon } = this.boat;
          const flash = (muzzle ?? cannon).getWorldPosition(new THREE.Vector3());
          if (!muzzle) flash.y += 0.3;
          this.effects.muzzle(flash, 0xffd27a, 1.1);
          this.boatKick = 1;
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

  /** Tilts something lying on the ground to the lie of the land under it. */
  private layOnSlope(mesh: THREE.Object3D, x: number, y: number): void {
    const east = this.ground(x + SLOPE_SPAN, y) - this.ground(x - SLOPE_SPAN, y);
    const south = this.ground(x, y + SLOPE_SPAN) - this.ground(x, y - SLOPE_SPAN);
    slope.set(-east, SLOPE_SPAN * 2, -south).normalize();
    mesh.quaternion.setFromUnitVectors(UP, slope);
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
    // How fast shots move under the time power running, so they're drawn where they really are.
    const power = state.timePower?.power;
    this.shotRate.crew = power === "fastForward" ? FAST_FORWARD : 1;
    this.shotRate.enemy =
      power === "pause" || power === "rewind"
        ? 0
        : power === "slow"
          ? SLOW_WORLD
          : this.shotRate.crew;
    this.terrain.update(time);
    this.clouds.update(time);
    this.updatePlume(dt);
    if (this.snowfall) {
      const watched = state.heroes[this.seat] ?? state.heroes[0];
      if (watched) this.snowAt.set(watched.pos.x, 0, watched.pos.y);
      this.snowfall.update(dt, time, this.snowAt);
    }
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
    this.reach?.update(state, this.showBars && state.conquest === null ? leader : undefined);
    const aiming = this.showBars && !this.defending ? leader : undefined;
    this.aimView.update(state, aiming, this.aim, this.ground, time);
    this.overgrowth?.update(dt);
    this.updateBuildings(state, dt, time);
    this.updateHeroes(state, dt);
    this.lights.update(dt, time);
    this.fireflies.update(time);
    this.updateProjectiles(state, time);
    this.updateZones(state, time, dt);
    this.updateTurrets(state);
    this.updateMines(state, time);
    this.updateBoat(time, dt);
    this.updateLabels(state, camera, width, height);
  }

  /** A volcano smokes all the time, not only when it goes off. */
  private updatePlume(dt: number): void {
    const { volcano } = this.shape;
    if (!volcano) return;
    // Embers drift up off the running lava.
    const rivers = this.shape.rivers;
    if (rivers.length > 0 && Math.random() < dt * 9) {
      const river = rivers[Math.floor(Math.random() * rivers.length)] ?? [];
      const spot = river[Math.floor(Math.random() * river.length)];
      if (spot) this.effects.ember(this.at(spot, 0.4));
    }
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
        .flatMap((b) => {
          const view = this.buildings.get(b.id);
          const spots = view ? lampSpots(view.model.root) : [];
          return buildingLamps(b.type, b.pos.x, this.ground(b.pos.x, b.pos.y), b.pos.y, spots);
        }),
      ...this.lavaLamps(),
    ]);
  }

  private addHero(h: RaidHero, mine: boolean): HeroView {
    const model = heroModel(h.kind);
    // A record's copy stands in a pale ring, a ghost of the hero it's playing for.
    const ghost = h.copyOf !== null ? "215, 255, 230" : undefined;
    const ring = heroRing(HEROES[h.kind].radius * 2 + (mine ? 0.5 : 0.2), mine, ghost);
    this.root.add(model.root, ring);
    const view: HeroView = {
      model,
      animator: model.rig && new HeroAnimator(model.rig),
      last: { ...h.pos },
      lastHp: h.hp,
      speed: 0,
      stepTimer: 0,
      walk: 0,
      facing: h.facing,
      turn: 0,
      ring,
      greened: null,
      bubble: null,
    };
    this.heroes.set(h.id, view);
    return view;
  }

  /** Heroes time is taking back, running backwards along the way they came. */
  private readonly slides = new Map<number, { path: Vec2[]; start: number }>();

  /** Where a hero time is taking back is drawn, quick at first and easing in at the end. */
  private sliding(h: RaidHero): Vec2 | null {
    const slide = this.slides.get(h.id);
    if (!slide) return null;
    const t = (performance.now() - slide.start) / (REWIND_SLIDE * 1000);
    if (t >= 1) {
      this.slides.delete(h.id);
      return null;
    }
    const eased = 1 - (1 - t) ** 2;
    const { path } = slide;
    const along = eased * (path.length - 1);
    const i = Math.min(path.length - 2, Math.floor(along));
    const a = path[i] ?? h.pos;
    const b = path[i + 1] ?? h.pos;
    const k = along - i;
    // A streak of the time it's running back through.
    if (Math.random() < 0.6) this.effects.trail(this.at(a, 1), false);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }

  /** Fast forward's barrier: a bubble round the hero, fainter the more of it's been used up. */
  private showBarrier(view: HeroView, h: RaidHero, pos: Vec2): void {
    if (h.barrier <= 0) {
      if (view.bubble) view.bubble.visible = false;
      return;
    }
    if (!view.bubble) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xff8a1f,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      view.bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material);
      view.bubble.renderOrder = 3;
      this.root.add(view.bubble);
    }
    const bubble = view.bubble;
    const size = HEROES[h.kind].radius * 2.2 + 0.4;
    const left = Math.min(1, h.barrier / (h.maxHp * FAST_BARRIER));
    bubble.visible = true;
    bubble.position.set(pos.x, this.ground(pos.x, pos.y) + size * 0.55, pos.y);
    bubble.scale.set(size, size * 1.1, size);
    if (bubble.material instanceof THREE.MeshBasicMaterial) {
      bubble.material.opacity = 0.1 + 0.25 * left + Math.sin(this.ringPulse * 6) * 0.04;
    }
  }

  /** Turns a hero solid green while they're recorded, and back again after. */
  private greenFor(view: HeroView, on: boolean): void {
    if (on === (view.greened !== null)) return;
    if (on) {
      const kept = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
      view.model.root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        kept.set(o, o.material);
        o.material = RECORDING;
      });
      view.greened = kept;
      return;
    }
    for (const [mesh, material] of view.greened ?? []) mesh.material = material;
    view.greened = null;
  }

  /** A building's gun goes off: from the next barrel's muzzle, kicking the guns back. */
  private fireFrom(view: BuildingView, lobbed: boolean): void {
    const muzzles = view.model.muzzles ?? [];
    const muzzle = muzzles[view.barrel++ % muzzles.length];
    if (!muzzle) return;
    const at = muzzle.getWorldPosition(new THREE.Vector3());
    // A launcher's flash is small: the harpoon itself is what's worth seeing go.
    const size = lobbed ? 0.7 : view.model.bolt ? 0.18 : 0.32;
    this.effects.muzzle(at, 0xffa060, size);
    // A mortar's shot leaves a puff of smoke hanging over the tube.
    if (lobbed) for (let i = 0; i < 3; i++) this.effects.trail(at, false);
    view.kick = 1;
    view.sinceShot = 0;
  }

  private updateBuildings(state: RaidState, dt: number, time: number): void {
    for (const b of state.buildings) {
      const view = this.buildings.get(b.id);
      if (!view) continue;
      const spec = BUILDINGS[b.type];
      this.aimSights(view, b);
      if (b.destroyed) {
        this.collapse(view, spec.height, dt);
        continue;
      }
      if (view.collapse !== null) this.standUp(view, state);
      // A badly hurt building burns, harder the closer it is to falling.
      const health = b.hp / b.maxHp;
      if (health < 0.5 && Math.random() < dt * (health < 0.25 ? 9 : 4)) {
        this.effects.burn(this.at(b.pos, spec.height * 0.55), spec.radius * 0.6);
      }
      // Models point along +x; the root is already turned to face the beach. In a fight the head
      // follows its aim; otherwise it keeps watch.
      if (view.model.head) {
        if (b.firing || b.sights || b.aim !== view.lastAim) view.alert = 1;
        else view.alert = Math.max(0, view.alert - dt);
        view.lastAim = b.aim;
        const aim = view.alert > 0 ? -b.aim - view.baseRotation : null;
        view.model.head.rotation.y = view.lookout.update(time, dt, aim);
      }
      if (b.firing && spec.attack?.kind === "flame") this.flameJet(view, b, spec, dt);
      const { guns, spinner, bolt } = view.model;
      if (bolt) {
        view.sinceShot += dt;
        const sliding = (view.sinceShot - BOLT_GONE) / BOLT_SLIDE.seconds;
        bolt.visible = sliding >= 0;
        const left = 1 - Math.min(1, Math.max(0, sliding));
        bolt.position.copy(view.boltRest).addScaledVector(view.gunsAxis, -left * BOLT_SLIDE.from);
      }
      if (guns) {
        const kick = KICK[b.type] ?? { reach: 0.14, back: 9 };
        view.kick = Math.max(0, view.kick - dt * kick.back);
        guns.position.copy(view.gunsRest).addScaledVector(view.gunsAxis, -view.kick * kick.reach);
      }
      if (spinner) spinner.rotation.y += dt * SPIN;
    }
  }

  /** A flamethrower going: fire pouring out of its nozzle the way it's aimed. */
  private flameJet(view: BuildingView, b: RaidBuilding, spec: BuildingSpec, dt: number): void {
    const { attack } = spec;
    if (attack?.kind !== "flame") return;
    const nozzle = view.model.muzzles?.[0];
    const from = nozzle
      ? nozzle.getWorldPosition(new THREE.Vector3())
      : this.at(b.pos, spec.height * 0.6);
    const dir = new THREE.Vector3(Math.cos(b.aim), 0, Math.sin(b.aim));
    this.effects.flameJet(from, dir, attack.range * 0.9, attack.coneHalfAngle, dt);
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

  /** Time went back to before it fell. */
  private standUp(view: BuildingView, state: RaidState): void {
    view.collapse = null;
    const { root } = view.model;
    root.position.y = view.baseY;
    root.rotation.z = 0;
    root.rotation.x = 0;
    root.visible = true;
    if (view.rubble) this.root.remove(view.rubble);
    view.rubble = null;
    this.lightBuildings(state);
  }

  /** Notes where every hero stands, just before the rules take a step. */
  remember(state: RaidState): void {
    for (const h of state.heroes) {
      const before = this.before.get(h.id);
      if (before) {
        before.x = h.pos.x;
        before.y = h.pos.y;
      } else this.before.set(h.id, { ...h.pos });
    }
  }

  /** Where a hero is drawn: between where it stood before the last step and where it is now. */
  drawnAt(h: RaidHero): Vec2 {
    const slid = this.sliding(h);
    if (slid) return slid;
    const before = this.before.get(h.id);
    if (!before || this.between >= 1) return h.pos;
    const t = this.between;
    return { x: before.x + (h.pos.x - before.x) * t, y: before.y + (h.pos.y - before.y) * t };
  }

  private updateHeroes(state: RaidState, dt: number): void {
    this.ringPulse += dt;
    // A record's copy comes and goes.
    for (const [id, view] of this.heroes) {
      if (state.heroes.some((h) => h.id === id)) continue;
      view.model.root.visible = false;
      view.ring.visible = false;
    }
    for (const h of state.heroes) {
      const view = this.heroes.get(h.id) ?? this.addHero(h, false);
      const running = state.timePower;
      this.greenFor(
        view,
        running?.power === "record" && !running.replaying && running.heroId === h.id,
      );
      const { model, ring } = view;
      // Nobody lies about: a fallen hero has gone up in smoke.
      model.root.visible = h.alive;
      if (!h.alive) {
        ring.visible = false;
        continue;
      }
      const pos = this.drawnAt(h);
      model.root.position.set(pos.x, this.ground(pos.x, pos.y), pos.y);
      ring.visible = h.alive && !this.defending;
      ring.position.set(pos.x, this.ground(pos.x, pos.y) + 0.06, pos.y);
      this.layOnSlope(ring, pos.x, pos.y);
      ring.scale.setScalar(1 + Math.sin(this.ringPulse * 0.9) * 0.04);
      this.showBarrier(view, h, pos);
      // Turn smoothly rather than snapping.
      const turned = angleDiff(h.facing, view.facing) * Math.min(1, dt * 18);
      view.facing += turned;
      view.turn = dt > 0 ? turned / dt : 0;
      model.root.rotation.y = -view.facing;

      if (h.moving) {
        view.stepTimer -= dt;
        if (view.stepTimer <= 0) {
          view.stepTimer = 0.2;
          this.effects.footstep(this.at(h.pos, 0));
        }
      }
      if (view.animator) {
        this.animateHero(view, view.animator, h, state, dt);
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
      cheering: state.status === "won" || state.conquest !== null,
      turn: view.turn,
    });
  }

  private takeFromPool(kind: ProjectileKind, team: Team, variant: string): THREE.Object3D {
    const key = `${kind}:${team}:${variant}`;
    const free = this.pool.get(key);
    const reused = free?.pop();
    const obj = reused ?? projectileMesh(kind, team, variant);
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

  private updateProjectiles(state: RaidState, time: number): void {
    this.trailTick++;
    const live = new Set<number>();
    for (const p of state.projectiles) {
      live.add(p.id);
      let obj = this.projectiles.get(p.id);
      if (!obj) {
        obj = this.takeFromPool(p.kind, p.team, p.leaves?.kind ?? "");
        this.projectiles.set(p.id, obj);
        const start = this.shotStart(p, state);
        if (start) this.shotStarts.set(p.id, start);
      }
      this.placeProjectile(p, obj);
      if (p.lob && (p.kind === "mortar" || p.kind === "artillery" || p.kind === "lava")) {
        this.placeTelegraph(p, time);
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
      this.shotStarts.delete(id);
    }
    for (const [id, t] of this.telegraphs) {
      if (live.has(id)) continue;
      this.root.remove(t.mesh);
      t.dispose();
      this.telegraphs.delete(id);
    }
  }

  /** How far a step moves the defenses' shots and the crew's, under the time power running. */
  private readonly shotRate = { enemy: 1, crew: 1 };

  private placeProjectile(p: Projectile, obj: THREE.Object3D): void {
    // Drawn as far back along its way as the picture is behind the rules: not at all for a shot
    // that time is holding still, which would otherwise shiver back and forth.
    const rate = p.team === "enemy" ? this.shotRate.enemy : this.shotRate.crew;
    const behind = (1 - this.between) * SIM_STEP * rate;
    if (p.lob) {
      const { from, to, t: elapsed, duration, peak } = p.lob;
      obj.visible = elapsed >= 0;
      const t = Math.max(0, Math.min(1, (elapsed - behind) / duration));
      const h0 = this.ground(from.x, from.y) + 1.6;
      const h1 = this.ground(to.x, to.y) + 0.2;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      obj.position.set(x, h0 + (h1 - h0) * t + 4 * peak * t * (1 - t), y);
      // Nose first along the arc: a shell points the way it's going.
      const climb = h1 - h0 + 4 * peak * (1 - 2 * t);
      obj.rotation.set(
        0,
        -Math.atan2(to.y - from.y, to.x - from.x),
        Math.atan2(climb, distance(from, to)),
      );
      return;
    }
    const x = p.pos.x - p.vel.x * behind;
    const y = p.pos.y - p.vel.y * behind;
    // A defense's shot leaves its gun up on the building and comes down to whoever it's aimed at.
    const start = this.shotStarts.get(p.id);
    const above = start ? start.height - BULLET_HEIGHT : 0;
    const left = start ? Math.max(0, 1 - p.traveled / start.drop) : 0;
    obj.position.set(x, this.ground(x, y) + BULLET_HEIGHT + above * left, y);
    obj.rotation.set(
      0,
      -Math.atan2(p.vel.y, p.vel.x),
      start && left > 0 ? -Math.atan2(above, start.drop) : 0,
    );
  }

  /** Where a defense's shot sets off from: its gun's muzzle, so not low down by its base. */
  private shotStart(p: Projectile, state: RaidState): { height: number; drop: number } | null {
    if (p.lob || p.team !== "enemy") return null;
    const view = this.buildings.get(p.ownerId);
    const building = state.buildings.find((b) => b.id === p.ownerId);
    if (!view || !building) return null;
    const muzzle = view.model.muzzles?.[0];
    const height = muzzle
      ? muzzle.getWorldPosition(new THREE.Vector3()).y - this.ground(building.pos.x, building.pos.y)
      : BUILDINGS[building.type].height * 0.7;
    if (height <= BULLET_HEIGHT) return null;
    const target = state.heroes.reduce(
      (nearest, h) => (h.alive ? Math.min(nearest, distance(h.pos, p.pos)) : nearest),
      p.maxDistance,
    );
    return { height, drop: Math.max(3, target) };
  }

  /** Where a lobbed shell will land, filling in as it comes down. */
  private placeTelegraph(p: Projectile, time: number): void {
    if (!p.lob) return;
    let t = this.telegraphs.get(p.id);
    if (!t) {
      t = areaMark("incoming", p.splash, p.team === "enemy" ? 0xff4b3a : 0xffd84a);
      t.mesh.position.set(p.lob.to.x, this.ground(p.lob.to.x, p.lob.to.y) + 0.12, p.lob.to.y);
      this.root.add(t.mesh);
      this.telegraphs.set(p.id, t);
    }
    t.mesh.visible = p.lob.t >= 0;
    t.update(time, Math.max(0.02, Math.min(1, p.lob.t / p.lob.duration)));
  }

  private updateZones(state: RaidState, time: number, dt: number): void {
    const live = new Set<number>();
    for (const z of state.zones) {
      live.add(z.id);
      let mark = this.zones.get(z.id);
      if (!mark) {
        mark = areaMark(z.kind, z.radius);
        mark.mesh.position.set(z.pos.x, this.ground(z.pos.x, z.pos.y) + 0.1, z.pos.y);
        this.root.add(mark.mesh);
        this.zones.set(z.id, mark);
        if (z.kind === "shock") {
          const bolts = new Lightning(
            () => this.at(this.somewhereIn(z), 0),
            (at) => this.lights.flash(at.x, at.y, at.z, 0x9fdcff, 6, 2.5, 0.12),
          );
          this.root.add(bolts.mesh);
          this.lightning.set(z.id, bolts);
        }
        if (z.kind === "smoke") {
          if (z.radius > SMALL_SMOKE)
            this.effects.smokeCloud(this.at(z.pos, 0.4), z.radius, z.time);
          else this.effects.smokeColumn(this.at(z.pos, 0.4), z.time, false);
        }
      }
      mark.update(time, Math.min(1, z.time));
      if (z.kind === "fire" && Math.random() < 0.3) {
        this.effects.burn(this.at(this.somewhereIn(z), 0.3), 0.5);
      }
      // Green crosses drift up off healing ground.
      if (z.kind === "heal" && Math.random() < 0.3) {
        this.effects.heal(this.at(this.somewhereIn(z), -0.2));
      }
      if (z.kind === "shock") this.crackle(state, z, dt);
    }
    for (const [id, mark] of this.zones) {
      if (live.has(id)) continue;
      this.root.remove(mark.mesh);
      mark.dispose();
      this.zones.delete(id);
      const bolts = this.lightning.get(id);
      if (!bolts) continue;
      this.root.remove(bolts.mesh);
      bolts.dispose();
      this.lightning.delete(id);
    }
  }

  private somewhereIn(z: Zone): Vec2 {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * z.radius;
    return { x: z.pos.x + Math.cos(a) * r, y: z.pos.y + Math.sin(a) * r };
  }

  /**
   * Lightning across a shock circle and up into the defenses it's caught, and sparks off them where
   * it strikes.
   */
  private crackle(state: RaidState, z: Zone, dt: number): void {
    const struck: THREE.Vector3[] = [];
    for (const b of state.buildings) {
      const { attack, height } = BUILDINGS[b.type];
      if (b.destroyed || !attack || distance(b.pos, z.pos) - b.radius > z.radius) continue;
      const at = this.at(b.pos, height * (0.55 + Math.random() * 0.4));
      struck.push(at);
      if (Math.random() < 0.2) this.effects.zap(at);
    }
    this.lightning.get(z.id)?.update(dt, struck);
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

  private updateBoat(time: number, dt: number): void {
    const { root, cannon, guns } = this.boat;
    if (guns) {
      this.boatKick = Math.max(0, this.boatKick - dt * BOAT_KICK_RETURN);
      guns.position.x = this.boatGunsRest - this.boatKick * BOAT_KICK;
    }
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
    const aboard = state.heroes[this.seat]?.inBoat ?? false;
    for (const b of state.buildings) {
      if (b.destroyed) continue;
      // A dense base would be all bars: only what's been hit nearby, what the hero's firing at,
      // and the headquarters. From the gunboat nothing's nearby, and the whole base is the fight.
      const damaged = b.hp < b.maxHp;
      const near = aboard || (focus ? distance(focus, b.pos) < 22 : false);
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
    this.snowfall?.dispose();
    this.sand.dispose();
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
    for (const t of this.telegraphs.values()) t.dispose();
    for (const mark of this.zones.values()) mark.dispose();
    for (const bolts of this.lightning.values()) bolts.dispose();
  }
}
