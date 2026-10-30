// Draws a raid: mirrors the rules' state into Three.js objects every frame and turns the
// rules' events into effects. It never changes the state.

import * as THREE from "three";
import { BUILDINGS } from "../logic/buildings";
import { HEROES } from "../logic/heroes";
import { type IslandLayout, terrainHeight } from "../logic/island";
import type { Projectile, ProjectileKind, RaidEvent, RaidState, Team } from "../logic/raid";
import { angleDiff, angleOf, distance, normalize, sub, type Vec2 } from "../logic/vec";
import type { WorldLabels } from "../ui/labels";
import { AimView } from "./aimCone";
import { buildCamp } from "./camp";
import { buildClouds, type CloudView } from "./clouds";
import { Effects } from "./effects";
import {
  type BuildingModel,
  buildingModel,
  crewTurretModel,
  gunboatModel,
  type HeroModel,
  heroModel,
  mineModel,
  rubbleModel,
} from "./models";
import { COLORS } from "./palette";
import { buildProps, sandbagPileGeometry, updateWind } from "./props";
import { sceneryMap } from "./scenery";
import { at, ball, barrel, cone, cyl, disposeGeometries, vertexColored } from "./shapes";
import { buildTerrain, type TerrainView } from "./terrain";

interface BuildingView {
  model: BuildingModel;
  rubble: THREE.Group | null;
  baseRotation: number;
}

interface HeroView {
  model: HeroModel;
  walk: number;
  fallen: number;
  facing: number;
  ring: THREE.Mesh;
}

/** A glowing ring on the ground under a hero: bright green for you, blue for squadmates. */
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
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

const BULLET_HEIGHT = 1.1;

function ground(x: number, y: number): number {
  return Math.max(0, terrainHeight(x, y));
}

function projectileMesh(kind: ProjectileKind, team: Team): THREE.Object3D {
  switch (kind) {
    case "bullet": {
      const geometry = new THREE.CapsuleGeometry(0.06, 0.45, 2, 6);
      geometry.rotateZ(Math.PI / 2);
      return new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: team === "crew" ? 0xfff0a0 : 0xff7d4d }),
      );
    }
    case "rocket": {
      const g = new THREE.Group();
      g.add(at(barrel(0.11, 0.7, COLORS.olive, 8), -0.35, 0, 0));
      g.add(at(cone(0.12, 0.25, COLORS.enemyRust, 8), 0.45, 0, 0, 0, 0, -Math.PI / 2));
      g.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffb347 }),
        ),
      );
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
  }
}

export class RaidView {
  readonly root = new THREE.Group();
  readonly effects = new Effects();
  /** Turned off once the raid is over, so bars don't float over the results screen. */
  showBars = true;
  /** Where the player is dragging the aim stick (null when not), for the aim cone. */
  aim: Vec2 | null = null;
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
  private readonly tempSandbags = new Map<number, THREE.Mesh>();
  private readonly mines = new Map<number, THREE.Mesh>();
  private readonly boat: { root: THREE.Group; cannon: THREE.Object3D };
  private readonly boatHeading: number;
  private cannonAim: number;
  private ringPulse = 0;
  private readonly focus = new THREE.Vector3();
  private readonly sandbagGeometry = sandbagPileGeometry();

  constructor(
    layout: IslandLayout,
    state: RaidState,
    private readonly labels: WorldLabels,
  ) {
    const scenery = sceneryMap(layout);
    this.terrain = buildTerrain(scenery);
    this.props = buildProps(layout, scenery);
    this.props.add(buildCamp(layout, scenery));
    this.clouds = buildClouds(layout.seed);
    this.root.add(this.clouds.root, this.aimView.root);
    this.root.add(this.terrain.root, this.props, this.effects.root);

    for (const b of state.buildings) {
      const model = buildingModel(b.type);
      // Turn each building's front towards the landing beach.
      const toBeach = sub(layout.spawn, b.pos);
      const baseRotation = Math.atan2(toBeach.x, toBeach.y);
      model.root.position.set(b.pos.x, ground(b.pos.x, b.pos.y), b.pos.y);
      model.root.rotation.y = baseRotation;
      this.root.add(model.root);
      this.buildings.set(b.id, { model, rubble: null, baseRotation });
    }

    state.heroes.forEach((h, i) => {
      const model = heroModel(h.kind);
      const ring = heroRing(HEROES[h.kind].radius * 2 + (i === 0 ? 0.5 : 0.2), i === 0);
      this.root.add(model.root, ring);
      this.heroes.set(h.id, { model, walk: 0, fallen: 0, facing: h.facing, ring });
    });

    for (const m of state.mines) {
      const mesh = mineModel();
      mesh.position.set(m.pos.x, ground(m.pos.x, m.pos.y) + 0.03, m.pos.y);
      this.root.add(mesh);
      this.mines.set(m.id, mesh);
    }

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
          const big =
            e.kind === "rocket" ||
            e.kind === "shell" ||
            e.kind === "mortar" ||
            e.kind === "harpoon";
          const h = e.kind === "mortar" ? 2.6 : BULLET_HEIGHT;
          this.effects.muzzle(
            this.at(e.pos, h),
            e.team === "crew" ? 0xffe08a : 0xffa060,
            big ? 0.5 : 0.25,
          );
          break;
        }
        case "explosion":
          this.effects.explosion(this.at(e.pos, 0.4), e.radius);
          break;
        case "hit":
          this.effects.hit(this.at(e.pos, BULLET_HEIGHT));
          break;
        case "heal":
          this.effects.heal(this.at(e.pos, 0.5));
          break;
        case "destroyed": {
          const radius = BUILDINGS[e.buildingType].radius;
          this.effects.explosion(this.at(e.pos, 1.2), radius * 1.3);
          this.effects.smokeColumn(this.at(e.pos, 0.5), e.buildingType === "headquarters" ? 8 : 4);
          const view = this.buildings.get(e.id);
          if (view) {
            view.model.root.visible = false;
            view.rubble = rubbleModel(radius);
            view.rubble.position.copy(view.model.root.position);
            this.root.add(view.rubble);
          }
          break;
        }
        case "super":
          this.effects.explosion(this.at(e.pos, 1), 0.6);
          break;
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

  private at(pos: Vec2, height: number): THREE.Vector3 {
    return new THREE.Vector3(pos.x, ground(pos.x, pos.y) + height, pos.y);
  }

  update(
    state: RaidState,
    dt: number,
    time: number,
    camera: THREE.Camera,
    width: number,
    height: number,
  ): void {
    this.terrain.update(time);
    this.clouds.update(time);
    // Plants between the camera and the followed hero dissolve so the hero never disappears.
    const leader = state.heroes[0];
    const watched = leader?.alive ? leader : state.heroes.find((h) => h.alive);
    this.focus.set(
      watched?.pos.x ?? 0,
      watched ? ground(watched.pos.x, watched.pos.y) + 1 : 0,
      watched?.pos.y ?? 0,
    );
    updateWind(time, watched && !watched.inBoat && this.showBars ? this.focus : null);
    this.effects.update(dt);
    this.aimView.update(state, this.showBars ? leader : undefined, this.aim, ground, time);
    this.updateBuildings(state);
    this.updateHeroes(state, dt);
    this.updateProjectiles(state);
    this.updateZones(state, time);
    this.updateTurrets(state);
    this.updateObstacles(state);
    this.updateMines(state, time);
    this.updateBoat(time);
    this.updateLabels(state, camera, width, height);
  }

  private updateBuildings(state: RaidState): void {
    for (const b of state.buildings) {
      const view = this.buildings.get(b.id);
      if (!view || b.destroyed) continue;
      // Models point along +x; the root is already turned to face the beach.
      if (view.model.head) view.model.head.rotation.y = -b.aim - view.baseRotation;
      if (view.model.flame) view.model.flame.visible = b.firing;
    }
  }

  private updateHeroes(state: RaidState, dt: number): void {
    this.ringPulse += dt;
    for (const h of state.heroes) {
      const view = this.heroes.get(h.id);
      if (!view) continue;
      const { model, ring } = view;
      model.root.visible = !h.inBoat;
      model.root.position.set(h.pos.x, ground(h.pos.x, h.pos.y), h.pos.y);
      ring.visible = h.alive && !h.inBoat;
      ring.position.set(h.pos.x, ground(h.pos.x, h.pos.y) + 0.06, h.pos.y);
      ring.scale.setScalar(1 + Math.sin(this.ringPulse * 0.9) * 0.04);
      // Turn smoothly rather than snapping.
      view.facing += angleDiff(h.facing, view.facing) * Math.min(1, dt * 18);
      model.root.rotation.y = -view.facing;

      if (!h.alive) {
        view.fallen = Math.min(1, view.fallen + dt * 3);
        model.body.rotation.x = (view.fallen * Math.PI) / 2.2;
        model.body.position.y = -view.fallen * 0.2;
        if (model.spray) model.spray.visible = false;
        continue;
      }
      const speed = HEROES[h.kind].speed * (h.sprintTime > 0 ? 1.6 : 1);
      if (h.moving) view.walk += dt * speed * 2.2;
      const swing = h.moving ? Math.sin(view.walk) : 0;
      if (model.legs) {
        model.legs[0].rotation.z = swing * 0.7;
        model.legs[1].rotation.z = -swing * 0.7;
      }
      model.body.position.y = h.moving ? Math.abs(Math.sin(view.walk)) * 0.07 : 0;
      model.body.rotation.z = h.moving ? -0.08 - (h.sprintTime > 0 ? 0.12 : 0) : 0;
      model.body.position.x = h.firing ? -0.04 * Math.random() : 0;
      if (model.spray) model.spray.visible = h.firing;
    }
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
    const live = new Set<number>();
    for (const p of state.projectiles) {
      live.add(p.id);
      let obj = this.projectiles.get(p.id);
      if (!obj) {
        obj = this.takeFromPool(p.kind, p.team);
        this.projectiles.set(p.id, obj);
      }
      this.placeProjectile(p, obj);
      if (p.lob && (p.kind === "mortar" || p.kind === "artillery")) this.placeTelegraph(p);
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
      const h0 = ground(from.x, from.y) + 1.6;
      const h1 = ground(to.x, to.y) + 0.2;
      obj.position.set(p.pos.x, h0 + (h1 - h0) * t + 4 * peak * t * (1 - t), p.pos.y);
      return;
    }
    obj.position.set(p.pos.x, ground(p.pos.x, p.pos.y) + BULLET_HEIGHT, p.pos.y);
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
      const ring = new THREE.Mesh(
        ringGeometry,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      const fill = new THREE.Mesh(
        fillGeometry,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false }),
      );
      const y = ground(p.lob.to.x, p.lob.to.y) + 0.12;
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
        obj = z.kind === "smoke" ? this.smokeCloud(z.radius) : this.healCircle(z.radius);
        obj.position.set(z.pos.x, ground(z.pos.x, z.pos.y), z.pos.y);
        this.root.add(obj);
        this.zones.set(z.id, obj);
      }
      const fade = Math.min(1, z.time);
      obj.scale.setScalar(0.6 + 0.4 * fade);
      if (z.kind === "heal") obj.rotation.y = time * 0.6;
    }
    for (const [id, obj] of this.zones) {
      if (live.has(id)) continue;
      this.root.remove(obj);
      disposeGeometries(obj);
      this.zones.delete(id);
    }
  }

  private smokeCloud(radius: number): THREE.Group {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({
      color: 0xd9dcd8,
      transparent: true,
      opacity: 0.82,
      roughness: 1,
    });
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const r = i % 2 ? radius * 0.55 : radius * 0.2;
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(radius * (0.35 + (i % 3) * 0.08), 12, 9),
        m,
      );
      puff.position.set(Math.cos(angle) * r, radius * 0.3 + (i % 3) * 0.4, Math.sin(angle) * r);
      g.add(puff);
    }
    return g;
  }

  private healCircle(radius: number): THREE.Group {
    const g = new THREE.Group();
    const disc = new THREE.CircleGeometry(radius, 40);
    disc.rotateX(-Math.PI / 2);
    g.add(
      at(
        new THREE.Mesh(
          disc,
          new THREE.MeshBasicMaterial({
            color: 0x7dff9a,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
          }),
        ),
        0,
        0.1,
        0,
      ),
    );
    const ring = new THREE.RingGeometry(radius * 0.9, radius, 40);
    ring.rotateX(-Math.PI / 2);
    g.add(
      at(
        new THREE.Mesh(
          ring,
          new THREE.MeshBasicMaterial({
            color: 0x9dffb4,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
          }),
        ),
        0,
        0.12,
        0,
      ),
    );
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
        view = crewTurretModel();
        view.root.position.set(t.pos.x, ground(t.pos.x, t.pos.y), t.pos.y);
        this.root.add(view.root);
        this.turrets.set(t.id, view);
      }
      view.head.rotation.y = -t.aim;
    }
    for (const [id, view] of this.turrets) {
      if (live.has(id)) continue;
      this.root.remove(view.root);
      disposeGeometries(view.root);
      this.turrets.delete(id);
    }
  }

  /** The Heavy's temporary sandbag walls (permanent ones are part of the props). */
  private updateObstacles(state: RaidState): void {
    const live = new Set<number>();
    for (const o of state.obstacles) {
      if (o.time === null) continue;
      live.add(o.id);
      if (this.tempSandbags.has(o.id)) continue;
      const mesh = new THREE.Mesh(this.sandbagGeometry, vertexColored());
      mesh.castShadow = true;
      mesh.position.set(o.pos.x, ground(o.pos.x, o.pos.y), o.pos.y);
      mesh.rotation.y = -o.rotation;
      this.root.add(mesh);
      this.tempSandbags.set(o.id, mesh);
    }
    for (const [id, mesh] of this.tempSandbags) {
      if (live.has(id)) continue;
      this.root.remove(mesh);
      this.tempSandbags.delete(id);
    }
  }

  private updateMines(state: RaidState, time: number): void {
    for (const m of state.mines) {
      const mesh = this.mines.get(m.id);
      if (!mesh) continue;
      mesh.visible = !m.exploded;
      const near = state.heroes.some((h) => h.alive && distance(h.pos, m.pos) < 5);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = near || m.fuse !== null ? 0.9 : 0.3;
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
    const v = new THREE.Vector3(pos.x, ground(pos.x, pos.y) + height, pos.y).project(camera);
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
    const focus = state.heroes.find((h) => h.alive)?.pos;
    for (const b of state.buildings) {
      if (b.destroyed) continue;
      const damaged = b.hp < b.maxHp;
      const near = focus ? distance(focus, b.pos) < 22 : false;
      if (!damaged && !near && b.type !== "headquarters") continue;
      const p = this.screenPosition(b.pos, BUILDINGS[b.type].height + 0.9, camera, width, height);
      if (!p.inFront) continue;
      this.labels.place(
        b.id,
        "enemy",
        p.x,
        p.y,
        b.hp / b.maxHp,
        b.type === "headquarters",
        b.maxHp,
      );
    }
    for (const h of state.heroes) {
      if (!h.alive || h.inBoat) continue;
      const view = this.heroes.get(h.id);
      const p = this.screenPosition(
        h.pos,
        (view?.model.height ?? 2.2) + 0.3,
        camera,
        width,
        height,
      );
      if (p.inFront) this.labels.place(h.id, "crew", p.x, p.y, h.hp / h.maxHp, false, h.maxHp);
    }
    for (const t of state.turrets) {
      const p = this.screenPosition(t.pos, 1.7, camera, width, height);
      if (p.inFront) this.labels.place(t.id, "crew", p.x, p.y, t.hp / t.maxHp, false, t.maxHp);
    }
    this.labels.end();
  }

  /** Direction from a hero to the gunboat, for the off-screen arrow. */
  boatDirection(state: RaidState, from: Vec2): Vec2 {
    return normalize(sub(state.boat.pos, from));
  }

  dispose(): void {
    this.clouds.dispose();
    this.aimView.dispose();
    for (const { ring } of this.heroes.values()) {
      const m = ring.material as THREE.MeshBasicMaterial;
      m.map?.dispose();
      m.dispose();
    }
    this.labels.clear();
    this.terrain.dispose();
    this.effects.dispose();
    disposeGeometries(this.root);
    this.sandbagGeometry.dispose();
    for (const objects of this.pool.values()) for (const o of objects) disposeGeometries(o);
    for (const t of this.telegraphs.values()) {
      (t.ring.material as THREE.Material).dispose();
      (t.fill.material as THREE.Material).dispose();
    }
  }
}
