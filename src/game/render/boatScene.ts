// Setting out on a raid (docs/DESIGN.md, Added 2026-11-16), all one unbroken shot from the choosing
// to the fight:
//
// 1. The crew aboard the gunboat out at sea in the late afternoon, standing or sat about her deck;
//    the player swings round her from one to the next and picks who goes.
// 2. The one picked goes into the cabin to the console and sets the time crystals they'll take
//    into its three holders.
// 3. She gets under way and runs in to the island, the camera pulling out of the cabin and round,
//    while the hero goes forward to the bow.
// 4. She runs up onto the beach. Kit's thrown ashore, the hero goes over the rail with a hand on it
//    and drops onto the sand, and walks up to where the fight starts, the camera coming to rest just
//    where the player's camera sits in a raid. The raid takes over from there: the same boat, in
//    the same place, the rest of the crew still aboard.
//
// The boat, the crew and where everything stands are the raid's own (gunboat.ts), at the size they
// are in a raid, so nothing changes at the hand-over.

import * as THREE from "three";
import type { HeroKind } from "../logic/heroes";
import { TIME_POWER_SPECS, type TimePower } from "../logic/timeShards";
import { CaptainInRaid } from "./captainRaid";
import { contactShadow } from "./contactShadow";
import {
  boatRise,
  boatRoll,
  type CrewBoat,
  crewBoatModel,
  gearBag,
  SITTING,
  type Station,
} from "./gunboat";
import { AT_EASE, HeroAnimator, type HeroMove } from "./heroAnimator";
import { type HeroModel, heroModel } from "./heroModels";
import { loadMenuBody, loadRigs } from "./riggedHeroes";

/** Whose place the Captain takes aboard. */
const CAPTAIN_KIND: HeroKind = "rifleman";
/** Seconds the run in to the beach takes. */
const RUN_SECONDS = 7.5;
/** Walking pace, metres a second, on deck and up the beach. */
const DECK_WALK = 2.6;
const BEACH_WALK = 4.2;
/** Seconds a camera move between two set-ups takes. */
const CAMERA_MOVE = 1.4;

type Step = "choose" | "console" | "run" | "ashore" | "done";

interface Copy {
  model: HeroModel;
  animator: HeroAnimator | null;
}

interface Crew {
  kind: HeroKind;
  /** Where they are and which way they face, in the hull's space while aboard, the world's ashore. */
  holder: THREE.Group;
  /** In full for close-ups; the raid copy (null for the Captain, who has his own) further off. */
  near: Copy;
  far: Copy | null;
  /** The Captain, following `near` (a Rifleman no one sees). */
  captain: CaptainInRaid | null;
  station: Station;
  /** Where they're walking to next, in their holder's parent's space. */
  path: THREE.Vector3[];
  facing: number;
  sitting: boolean;
  tall: number;
}

/** What the boat scene needs of the island: where the fight starts, and the raid's camera there. */
export interface LandingSite {
  spawn: { x: number; y: number };
  ground(x: number, y: number): number;
  /** The camera as the raid has it with the hero standing at `spawn`. */
  view: { position: THREE.Vector3; quaternion: THREE.Quaternion };
}

const ease = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
const v = new THREE.Vector3();
const v2 = new THREE.Vector3();

export class BoatScene {
  readonly root = new THREE.Group();
  private readonly hull = new THREE.Group();
  private readonly boat: CrewBoat;
  private crew: Crew[] = [];
  private chosen = 0;
  private stage: Step = "choose";
  private stepTime = 0;
  private time = 0;
  /** 0 out at sea, 1 run up on the beach. */
  private run = 0;
  private readonly start = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly heading: number;
  /** Where the camera's swung round to for the one picked: a bearing in the boat's space, eased. */
  private bearing = 0;
  private wantBearing = 0;
  /** The camera as it was when the set-up last changed, to move on from. */
  private readonly lastCamera = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  };
  /** Seconds since the set-up changed; the first frame starts settled, not moving in from nowhere. */
  private cameraSince = CAMERA_MOVE;
  private gear: { bag: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; turn: number }[] =
    [];
  private readonly gems: THREE.Mesh[] = [];
  /** Called once the hero picked is at the console. */
  onConsole: (() => void) | null = null;
  /** Straight down over the boat, for laying out where the crew stands. */
  overview = false;

  /**
   * `from` is where she waits, out at sea; `place` where she runs aground, with the way her bow
   * points, just as the raid has her (raidView.ts: boatPlace).
   */
  constructor(
    from: { x: number; y: number },
    place: { x: number; y: number; heading: number },
    private readonly site: LandingSite,
  ) {
    this.start.set(from.x, 0, from.y);
    this.end.set(place.x, 0, place.y);
    this.heading = place.heading;
    this.boat = crewBoatModel();
    this.hull.add(this.boat.root);
    this.root.add(this.hull);
    this.root.position.copy(this.start);
    this.root.rotation.y = -this.heading;
  }

  /** Puts the crew aboard, each at a station, in their detailed models once they've loaded. */
  async board(kinds: readonly HeroKind[], chosen: HeroKind): Promise<void> {
    await loadRigs();
    await Promise.all(kinds.map((k) => loadMenuBody(k)));
    // The Captain stands (he's no sitting pose of his own yet): he goes to the first station.
    const order = [...kinds].sort(
      (a, b) => Number(b === CAPTAIN_KIND) - Number(a === CAPTAIN_KIND),
    );
    const stations = this.boat.stations;
    this.crew = await Promise.all(
      order.slice(0, stations.length).map(async (kind, i) => {
        const station = stations[i] as Station;
        const holder = new THREE.Group();
        holder.position.set(station.x, station.y, station.z);
        holder.rotation.y = -station.facing;
        const nearModel = heroModel(kind, true);
        const near: Copy = {
          model: nearModel,
          animator: nearModel.rig && new HeroAnimator(nearModel.rig),
        };
        holder.add(nearModel.root, contactShadow(1.4));
        let far: Copy | null = null;
        let captain: CaptainInRaid | null = null;
        if (kind === CAPTAIN_KIND) captain = await CaptainInRaid.follow(nearModel, true);
        if (captain) holder.add(captain.root);
        else {
          const farModel = heroModel(kind, false);
          far = { model: farModel, animator: farModel.rig && new HeroAnimator(farModel.rig) };
          holder.add(farModel.root);
        }
        this.hull.add(holder);
        holder.updateMatrixWorld(true);
        const tall = Math.max(1.4, new THREE.Box3().setFromObject(nearModel.root).getSize(v).y);
        return {
          kind,
          holder,
          near,
          far,
          captain,
          station,
          path: [],
          facing: station.facing,
          sitting: station.sit,
          tall,
        };
      }),
    );
    this.choose(chosen, true);
  }

  get kinds(): HeroKind[] {
    return this.crew.map((c) => c.kind);
  }

  get current(): HeroKind | null {
    return this.crew[this.chosen]?.kind ?? null;
  }

  /** The next hero round the boat (+1) or the one before (-1). */
  step(by: number): HeroKind | null {
    if (this.crew.length === 0 || this.stage !== "choose") return this.current;
    this.chosen = (this.chosen + by + this.crew.length) % this.crew.length;
    this.aim();
    return this.current;
  }

  choose(kind: HeroKind, now = false): void {
    const at = this.crew.findIndex((c) => c.kind === kind);
    this.chosen = Math.max(0, at);
    this.aim();
    if (now) this.bearing = this.wantBearing;
  }

  /** What the player sees a hero called aboard: the Captain stands in the Rifleman's place. */
  nameOf(kind: HeroKind): string | null {
    return this.crew.find((c) => c.kind === kind)?.captain ? "The Captain" : null;
  }

  /** The camera's bearing for the one picked: in front of them, a little to one side. */
  private aim(): void {
    const c = this.crew[this.chosen];
    if (!c) return;
    let want = c.station.facing + 0.45;
    while (want - this.bearing > Math.PI) want -= Math.PI * 2;
    while (want - this.bearing < -Math.PI) want += Math.PI * 2;
    this.wantBearing = want;
    this.greet();
  }

  /** The Captain answers being picked, and goes back to watching the sea when he isn't. */
  private greet(): void {
    for (const c of this.crew) {
      const face = c.captain?.self.face;
      if (!face) continue;
      if (c === this.crew[this.chosen]) {
        face.say("[confident_smirk] [look:ahead] Ready when you are. [nod]");
      } else {
        face.express("neutral");
        face.lookAt("left");
      }
    }
  }

  /** Ready: the one picked goes into the cabin to the console. */
  ready(): void {
    const c = this.crew[this.chosen];
    if (!c || this.stage !== "choose") return;
    this.setStep("console");
    c.sitting = false;
    const { console } = this.boat;
    c.path = this.routeTo(c, { x: console.stand.x, z: console.stand.z });
    c.captain?.self.face?.express("tactical_focus");
  }

  /** The crystals in the console's holders, as the player sets them. */
  setCrystals(powers: readonly TimePower[]): void {
    for (const g of this.gems) g.removeFromParent();
    this.gems.length = 0;
    this.boat.console.holders.forEach((holder, i) => {
      const power = powers[i];
      if (!power) return;
      const color = new THREE.Color(TIME_POWER_SPECS[power].color);
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.13, 0),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.8,
          roughness: 0.25,
        }),
      );
      gem.position.y = 0.2;
      holder.add(gem);
      this.gems.push(gem);
    });
  }

  /** Set off: she gets under way, and the hero goes forward to the bow. */
  setOff(): void {
    const c = this.crew[this.chosen];
    if (!c || this.stage !== "console") return;
    this.setStep("run");
    const over = this.boat.over[0] ?? { x: 6.6, z: 1.3 };
    c.path = this.routeTo(c, { x: over.x - 0.7, z: over.z });
    c.captain?.self.face?.say("[tactical_focus] Bring her in. [pause:0.3] [look:ahead] Quietly.");
  }

  /**
   * Where the sun's shadows are kept sharp, and how far round: tight on the one picked while the
   * camera's close (every pixel of the shadow on them, for the beard's shadow on the neck, the
   * arms' on the shirt), the whole boat while she runs in.
   */
  get shadowFocus(): { at: THREE.Vector3; size: number } {
    const c = this.crew[this.chosen];
    if (c && (this.stage === "choose" || this.stage === "console" || this.stage === "ashore")) {
      return { at: c.holder.getWorldPosition(new THREE.Vector3()), size: 4 };
    }
    return { at: this.root.position.clone(), size: 11 };
  }

  /** Whether there's something to skip just now: a walk to the console, or the run in and landing. */
  get skippable(): boolean {
    const c = this.crew[this.chosen];
    return (
      (this.stage === "console" && (c?.path.length ?? 0) > 0) ||
      this.stage === "run" ||
      this.stage === "ashore"
    );
  }

  /**
   * Skips to the end of what's happening: the hero at the console, or ashore where the fight
   * starts, the kit lying on the sand, the boat run up on the beach.
   */
  skip(): void {
    const c = this.crew[this.chosen];
    if (!c) return;
    if (this.stage === "console" && c.path.length > 0) {
      const s = this.boat.console.stand;
      c.holder.position.set(s.x, s.y, s.z);
      c.path.length = 0;
      this.cameraSince = CAMERA_MOVE;
      this.arrived(c);
      return;
    }
    if (this.stage !== "run" && this.stage !== "ashore") return;
    this.run = 1;
    this.root.position.copy(this.end);
    this.root.updateMatrixWorld(true);
    // Lay the kit out as it would have landed.
    this.stage = "ashore";
    this.stepTime = 0;
    this.ashore(0);
    for (const g of this.gear) {
      g.bag.position.copy(g.to);
      g.bag.visible = true;
    }
    const world = this.root.parent;
    if (world && c.holder.parent !== world) world.attach(c.holder);
    const { spawn, ground } = this.site;
    c.holder.position.set(spawn.x, Math.max(0, ground(spawn.x, spawn.y)), spawn.y);
    c.path.length = 0;
    this.setStep("done");
  }

  /** The way along the deck from where someone is to a point, round the cabin. */
  private routeTo(c: Crew, to: { x: number; z: number }): THREE.Vector3[] {
    const from = c.holder.position;
    const y = this.boat.stations[0]?.y ?? 1.6;
    const door = { x: 1.2, z: 0 };
    const inside = { x: -0.6, z: 0 };
    const inCabin = (p: { x: number; z: number }) => p.x > -3.6 && p.x < 0.4 && Math.abs(p.z) < 2.1;
    const aft = (p: { x: number; z: number }) => p.x < -3.4;
    const route: { x: number; z: number }[] = [];
    const side = from.z >= 0 ? 2.6 : -2.6;
    // Out of the cabin by the door, or round it from aft.
    if (inCabin({ x: from.x, z: from.z })) route.push(inside, door);
    else if (aft({ x: from.x, z: from.z }) && !aft(to))
      route.push({ x: -3.9, z: side }, { x: 0.9, z: side });
    if (inCabin(to)) {
      if (!inCabin({ x: from.x, z: from.z })) route.push(door, inside);
    } else if (aft(to) && !aft({ x: from.x, z: from.z })) {
      const toSide = to.z >= 0 ? 2.6 : -2.6;
      route.push({ x: 0.9, z: toSide }, { x: -3.9, z: toSide });
    }
    route.push(to);
    return route.map((p) => new THREE.Vector3(p.x, y, p.z));
  }

  /** Done: the hero's walked up the beach to where the fight starts. */
  get done(): boolean {
    return this.stage === "done";
  }

  /** Where the kit thrown ashore ended up, for the raid to leave it lying there. */
  get gearDrops(): { x: number; y: number; z: number; turn: number }[] {
    return this.gear.map((g) => ({ x: g.to.x, y: g.to.y, z: g.to.z, turn: g.turn }));
  }

  /** The rest of the crew, in the order they stand aboard (gunboat.ts stations). */
  get stayingAboard(): HeroKind[] {
    return this.crew.filter((_, i) => i !== this.chosen).map((c) => c.kind);
  }

  private setStep(step: Step): void {
    this.stage = step;
    this.stepTime = 0;
    this.cameraSince = 0;
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    this.time += dt;
    this.stepTime += dt;
    this.cameraSince += dt;
    if (this.cameraSince <= dt) {
      this.lastCamera.position.copy(camera.position);
      this.lastCamera.quaternion.copy(camera.quaternion);
    }
    if (this.stage === "run") this.run = Math.min(1, this.run + dt / RUN_SECONDS);
    const travelled = ease(this.run);
    this.root.position.lerpVectors(this.start, this.end, travelled);
    // Out at sea she rides the swell; run up on the beach she only shifts as the raid has her.
    const sea = 1 - travelled;
    this.hull.rotation.x = Math.sin(this.time * 0.9) * 0.03 * sea;
    this.hull.position.y = boatRise(this.time) + Math.sin(this.time * 1.1) * 0.1 * sea;
    this.hull.rotation.z = boatRoll(this.time) + Math.sin(this.time * 0.63 + 1) * 0.015 * sea;
    this.moveCrew(dt);
    // Beached, and the hero's at the bow: over the side.
    const picked = this.crew[this.chosen];
    if (this.stage === "run" && this.run >= 1 && picked && picked.path.length === 0) {
      this.setStep("ashore");
    }
    if (this.stage === "ashore") this.ashore(dt);
    this.place(dt, camera);
    for (const c of this.crew) c.captain?.self.detailFor(camera);
  }

  private moveCrew(dt: number): void {
    const picked = this.crew[this.chosen];
    for (const c of this.crew) {
      // Ashore, the hero's moved by ashore().
      if (c === picked && this.stage === "ashore") continue;
      let moving = false;
      const target = c.path[0];
      if (target) {
        const pace = c.holder.parent === this.hull ? DECK_WALK : BEACH_WALK;
        const to = v.copy(target).sub(c.holder.position);
        to.y = 0;
        const gap = to.length();
        if (gap < 0.05) {
          c.holder.position.x = target.x;
          c.holder.position.z = target.z;
          c.path.shift();
          if (c.path.length === 0) this.arrived(c);
        } else {
          moving = true;
          c.holder.position.addScaledVector(to.normalize(), Math.min(gap, pace * dt));
          const want = Math.atan2(to.z, to.x);
          let d = want - c.facing;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          c.facing += d * Math.min(1, dt * 10);
        }
      }
      c.holder.rotation.y = -c.facing;
      const close = c === picked || moving;
      const shown = c.far && !close ? c.far : c.near;
      if (c.far) {
        c.near.model.root.visible = shown === c.near || c.captain !== null;
        c.far.model.root.visible = shown === c.far;
      }
      const move: HeroMove = c.sitting
        ? SITTING
        : {
            ...AT_EASE,
            moving,
            speed: moving ? (c.holder.parent === this.hull ? DECK_WALK : BEACH_WALK) : 0,
          };
      shown.animator?.update(dt, move);
      // Standing about aboard, the Captain's on his own idle; walking, he follows the game's walk.
      c.captain?.update(dt, !moving);
    }
  }

  /** Someone's got where they were going. */
  private arrived(c: Crew): void {
    if (c !== this.crew[this.chosen]) return;
    if (this.stage === "console") {
      c.facing = this.boat.console.stand.facing;
      this.onConsole?.();
    }
  }

  /** At the beach: kit over the side, the hero over the rail and down, and up the sand. */
  private ashore(dt: number): void {
    const c = this.crew[this.chosen];
    if (!c) return;
    let walking = false;
    const t = this.stepTime;
    const world = this.root.parent;
    if (!world) return;
    const up = new THREE.Vector3(Math.cos(this.heading), 0, Math.sin(this.heading));
    const across = new THREE.Vector3(-up.z, 0, up.x);
    const bow = this.hull.localToWorld(new THREE.Vector3(this.boat.length / 2 - 0.4, 1.6, 0));
    // Two bags of kit thrown ahead onto the sand, one after the other.
    if (this.gear.length === 0) {
      for (const [lead, side] of [
        [3.2, 1.3],
        [4.4, -0.9],
      ] as const) {
        const bag = gearBag();
        const from = bow.clone().add(new THREE.Vector3(0, 1.0, 0));
        const to = bow.clone().addScaledVector(up, lead).addScaledVector(across, side);
        to.y = Math.max(0, this.site.ground(to.x, to.z));
        world.add(bag);
        this.gear.push({ bag, from, to, turn: Math.random() * Math.PI });
      }
    }
    this.gear.forEach((g, i) => {
      const k = ease((t - i * 0.35) / 0.7);
      g.bag.position.lerpVectors(g.from, g.to, k);
      g.bag.position.y += Math.sin(Math.min(1, Math.max(0, (t - i * 0.35) / 0.7)) * Math.PI) * 1.4;
      g.bag.rotation.set(0, g.turn + k * 2.5, k * 1.2 * (1 - k));
      g.bag.visible = t > i * 0.35;
    });
    // Up onto the rail, a hand on it, and over: down onto the sand ahead of the bow.
    if (c.holder.parent === this.hull) world.attach(c.holder);
    const railAt = this.hull.localToWorld(
      new THREE.Vector3(this.boat.length / 2 - 1.3, 1.6, (this.boat.over[0]?.z ?? 1.3) * 0.6),
    );
    const landAt = bow.clone().addScaledVector(up, 2.2).addScaledVector(across, 0.8);
    landAt.y = Math.max(0, this.site.ground(landAt.x, landAt.z));
    c.facing = this.heading;
    if (t < 0.7) {
      const k = ease(t / 0.7);
      c.holder.position.copy(railAt).setY(railAt.y + 0.95 * k);
    } else if (t < 1.4) {
      const k = (t - 0.7) / 0.7;
      c.holder.position.lerpVectors(v2.copy(railAt).setY(railAt.y + 0.95), landAt, ease(k));
      c.holder.position.y += Math.sin(k * Math.PI) * 0.7;
    } else {
      // Up the beach to where the fight starts.
      if (c.path.length === 0 && t < 1.5) {
        const spawn = this.site.spawn;
        c.path = [new THREE.Vector3(spawn.x, this.site.ground(spawn.x, spawn.y), spawn.y)];
      }
      const to = c.path[0];
      if (to) {
        const step = v.copy(to).sub(c.holder.position);
        step.y = 0;
        const gap = step.length();
        if (gap < 0.1) {
          c.path.length = 0;
          this.setStep("done");
          return;
        }
        c.holder.position.addScaledVector(step.normalize(), Math.min(gap, BEACH_WALK * dt));
        c.facing = Math.atan2(step.z, step.x);
        c.holder.position.y = Math.max(
          0,
          this.site.ground(c.holder.position.x, c.holder.position.z),
        );
        walking = true;
      }
    }
    c.holder.rotation.y = -c.facing;
    // Their contact shadow stays on the sand (or the deck) as they go up and over.
    const blob = c.holder.children.find((o) => o.userData.contact === true);
    if (blob) {
      const below = Math.max(0, this.site.ground(c.holder.position.x, c.holder.position.z));
      blob.position.y = Math.min(0.02, below - c.holder.position.y + 0.02);
      blob.visible = t > 1.35;
    }
    c.near.animator?.update(dt, { ...AT_EASE, moving: walking, speed: walking ? BEACH_WALK : 0 });
    c.captain?.update(dt);
  }

  /** The camera, for the step the scene is on. */
  private place(dt: number, camera: THREE.PerspectiveCamera): void {
    if (this.overview) {
      const p = this.root.position;
      camera.position.set(p.x, p.y + 40, p.z + 0.01);
      camera.lookAt(p.x, p.y, p.z);
      return;
    }
    const want = this.shot(dt);
    // From the last set-up to this one over a moment, rather than a cut.
    const k = ease(this.cameraSince / CAMERA_MOVE);
    camera.position.lerpVectors(this.lastCamera.position, want.position, k);
    camera.quaternion.slerpQuaternions(this.lastCamera.quaternion, want.quaternion, k);
  }

  private readonly shotCamera = new THREE.PerspectiveCamera();

  /** Where the camera wants to be, for the step the scene's on. */
  private shot(dt: number): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
    const cam = this.shotCamera;
    const c = this.crew[this.chosen];
    this.hull.updateMatrixWorld(true);
    if (this.stage === "choose" || !c) {
      // In front of the one picked, a little off to one side, at their eye height.
      this.bearing += (this.wantBearing - this.bearing) * (1 - Math.exp(-dt * 2.6));
      const tall = c?.tall ?? 2.4;
      const at = c ? c.holder.position : new THREE.Vector3();
      const reach = 1.4 + tall * 1.5;
      const eyes = c?.sitting ? tall * 0.45 : tall * 0.78;
      cam.position.copy(
        this.root.localToWorld(
          new THREE.Vector3(
            at.x + Math.cos(this.bearing) * reach,
            at.y + eyes + 0.35,
            at.z + Math.sin(this.bearing) * reach,
          ),
        ),
      );
      cam.lookAt(this.root.localToWorld(new THREE.Vector3(at.x, at.y + eyes - 0.1, at.z)));
      return cam;
    }
    if (this.stage === "console") {
      // In the cabin, over their shoulder to the console and its crystals.
      const s = this.boat.console.stand;
      cam.position.copy(
        this.root.localToWorld(new THREE.Vector3(s.x - 1.5, s.y + 2.25, s.z + 1.25)),
      );
      cam.lookAt(this.root.localToWorld(new THREE.Vector3(s.x + 0.85, s.y + 1.05, s.z)));
      return cam;
    }
    // Out of the cabin, wide, as she runs in; then down to where the raid's camera will be.
    const chase = new THREE.Vector3(-15, 9, 11);
    cam.position.copy(this.root.localToWorld(chase));
    cam.lookAt(this.root.localToWorld(new THREE.Vector3(5, 1.5, 0)));
    const follow = this.followView(c);
    const k = this.stage === "ashore" ? 1 : ease((this.run - 0.55) / 0.45);
    cam.position.lerp(follow.position, k);
    cam.quaternion.slerp(follow.quaternion, k);
    return cam;
  }

  /** The raid's camera, kept on the hero as they go: where it'll be when the fight starts. */
  private followView(c: Crew): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
    const { spawn, view, ground } = this.site;
    const spawnAt = new THREE.Vector3(spawn.x, Math.max(0, ground(spawn.x, spawn.y)), spawn.y);
    const offset = view.position.clone().sub(spawnAt);
    const hero = c.holder.getWorldPosition(new THREE.Vector3());
    hero.y = Math.max(0, ground(hero.x, hero.z));
    return { position: hero.add(offset), quaternion: view.quaternion };
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const g of this.gear) g.bag.removeFromParent();
    for (const c of this.crew) c.holder.removeFromParent();
    // The Captain's meshes are shared with every other Captain (captain.ts): not ours to free.
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
