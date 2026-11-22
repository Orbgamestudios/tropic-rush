// Setting out on a raid (docs/DESIGN.md, Added 2026-11-16), all one unbroken shot from the choosing
// to the fight, with no cut anywhere:
//
// 1. The crew aboard the gunboat out at sea in the late afternoon, standing or sat about her deck;
//    the player swings round her from one to the next and picks who goes.
// 2. The one picked goes into the wheelhouse to the console and sets the time crystals they'll take
//    in its three cradles.
// 3. She gets under way and curves in to the island, her bow lifting, her wake spreading, while the
//    camera comes out of the wheelhouse door and along her side and up, and the hero goes forward.
// 4. She runs up onto the beach. Kit's thrown ashore, the hero climbs the bow and drops onto the
//    sand from where they stand, and walks up to where the fight starts, the camera coming down to
//    just where the player's camera sits in a raid. The raid takes over from there: the same boat in
//    the same place, swaying to the same clock, the rest of the crew still aboard.
//
// Every camera position is planned in 3D before it's used: candidates round the subject are tried
// against the boat's own geometry and the crew, and only one that sees them clearly (not through a
// wall, the turret, a crewmate, or from inside anything) is kept.

import * as THREE from "three";
import type { HeroKind } from "../logic/heroes";
import type { TimePower } from "../logic/timeShards";
import { CaptainInRaid } from "./captainRaid";
import { contactShadow } from "./contactShadow";
import {
  boatRise,
  boatRoll,
  type CrewBoat,
  crewBoatModel,
  deckY,
  gearBag,
  SITTING,
  type Station,
} from "./gunboat";
import { AT_EASE, HeroAnimator, type HeroMove } from "./heroAnimator";
import { type HeroModel, heroModel } from "./heroModels";
import { loadMenuBody, loadRigs } from "./riggedHeroes";
import { crystalDetail, crystalTime, timeCrystal } from "./timeShard";

/** Whose place the Captain takes aboard. */
const CAPTAIN_KIND: HeroKind = "rifleman";
/** Seconds the run in to the beach takes. */
const RUN_SECONDS = 9;
/** Walking pace, metres a second, on deck and up the beach. */
const DECK_WALK = 2.4;
const BEACH_WALK = 4.2;
/** Seconds the camera takes to settle on a new subject while choosing. */
const CAMERA_MOVE = 1.2;

type Step = "choose" | "console" | "run" | "ashore" | "done";

interface Copy {
  model: HeroModel;
  animator: HeroAnimator | null;
}

interface Crew {
  kind: HeroKind;
  /** Where they are and which way they face: in the hull's space aboard, the world's ashore. */
  holder: THREE.Group;
  /** The raid copy, drawn from the start; the detailed one once it's arrived, for close-ups. */
  far: Copy;
  near: Copy | null;
  /** The Captain, following `far` (a Rifleman no one sees). */
  captain: CaptainInRaid | null;
  station: Station;
  path: THREE.Vector3[];
  facing: number;
  sitting: boolean;
  tall: number;
  /** Where the camera sees them best from, worked out once they're aboard (see planShot). */
  shot: Shot | null;
}

/** A camera set-up in the boat's own space: where it is, and what it looks at. */
interface Shot {
  eye: THREE.Vector3;
  look: THREE.Vector3;
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
const ray = new THREE.Raycaster();

/** A splash of foam or spray: where it is, how it's going, how long it's left. */
interface Fleck {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  grow: number;
}

let foamTexture: THREE.Texture | null = null;
function foam(): THREE.Texture {
  if (foamTexture) return foamTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,0.95)");
    r.addColorStop(0.5, "rgba(255,255,255,0.5)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  foamTexture = new THREE.CanvasTexture(canvas);
  return foamTexture;
}

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
  /** Her course in: a curve from out at sea to the beach, ending on her raid heading. */
  private readonly course: THREE.CubicBezierCurve3;
  private readonly endHeading: number;
  private heading: number;
  private speed = 0;
  /** Seconds the camera's been on its current subject; over 90, it starts there with no move. */
  private cameraSince = 99;
  private gear: { bag: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; turn: number }[] =
    [];
  private readonly gems: THREE.Object3D[] = [];
  private readonly flecks: Fleck[] = [];
  private fleckDue = 0;
  /** The run in's camera path, in the boat's space, planned when she sets off. */
  private runPath: { eyes: THREE.CatmullRomCurve3; looks: THREE.CatmullRomCurve3 } | null = null;
  private readonly cameraAt = new THREE.Vector3();
  private readonly cameraLook = new THREE.Vector3();
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
    const start = new THREE.Vector3(from.x, 0, from.y);
    const end = new THREE.Vector3(place.x, 0, place.y);
    const length = start.distanceTo(end);
    const inbound = new THREE.Vector3(Math.cos(place.heading), 0, Math.sin(place.heading));
    // She comes in on a curve: from off to one side, swinging onto her final heading.
    const across = new THREE.Vector3(-inbound.z, 0, inbound.x);
    const begin = start.clone().addScaledVector(across, length * 0.35);
    this.course = new THREE.CubicBezierCurve3(
      begin,
      begin
        .clone()
        .addScaledVector(inbound, length * 0.35)
        .addScaledVector(across, -length * 0.05),
      end.clone().addScaledVector(inbound, -length * 0.4),
      end,
    );
    this.endHeading = place.heading;
    const tangent = this.course.getTangent(0);
    this.heading = Math.atan2(tangent.z, tangent.x);
    this.boat = crewBoatModel();
    this.hull.add(this.boat.root);
    this.root.add(this.hull);
    this.root.position.copy(begin);
    this.root.rotation.y = -this.heading;
  }

  /**
   * Puts the crew aboard: straight away in their raid copies (already loaded), so she's never
   * empty; the detailed models follow for close-ups as they arrive.
   */
  async board(kinds: readonly HeroKind[], chosen: HeroKind): Promise<void> {
    await loadRigs();
    // The Captain stands (he has no sitting pose): he goes to the first station.
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
        const farModel = heroModel(kind, false);
        const far: Copy = {
          model: farModel,
          animator: farModel.rig && new HeroAnimator(farModel.rig),
        };
        holder.add(farModel.root, contactShadow(1.4));
        const captain = kind === CAPTAIN_KIND ? await CaptainInRaid.follow(farModel) : null;
        if (captain) holder.add(captain.root);
        this.hull.add(holder);
        holder.updateMatrixWorld(true);
        const tall = Math.max(1.4, new THREE.Box3().setFromObject(farModel.root).getSize(v).y);
        return {
          kind,
          holder,
          far,
          near: null,
          captain,
          station,
          path: [],
          facing: station.facing,
          sitting: station.sit && !captain,
          tall,
          shot: null,
        };
      }),
    );
    this.hull.updateMatrixWorld(true);
    for (const c of this.crew) c.shot = this.planShot(c);
    this.choose(chosen, true);
    // The detailed models, as they come.
    for (const c of this.crew) {
      if (c.captain) continue;
      void loadMenuBody(c.kind).then(() => {
        const model = heroModel(c.kind, true);
        model.root.visible = false;
        c.holder.add(model.root);
        c.near = { model, animator: model.rig && new HeroAnimator(model.rig) };
      });
    }
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
    this.cameraSince = 0;
    this.greet();
    return this.current;
  }

  choose(kind: HeroKind, now = false): void {
    const at = this.crew.findIndex((c) => c.kind === kind);
    this.chosen = Math.max(0, at);
    this.cameraSince = now ? 99 : 0;
    this.greet();
  }

  /** What the player sees a hero called aboard: the Captain stands in the Rifleman's place. */
  nameOf(kind: HeroKind): string | null {
    return this.crew.find((c) => c.kind === kind)?.captain ? "The Captain" : null;
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

  // ---------------------------------------------------------------------------------------------
  // Planning the camera in 3D.

  /** What the camera mustn't see through: the boat, and the crew other than `except`. */
  private blockers(except: Crew | null): THREE.Object3D[] {
    const list: THREE.Object3D[] = [this.boat.root];
    for (const c of this.crew) if (c !== except) list.push(c.holder);
    return list;
  }

  /** Whether the line from `eye` to `target` (both in the world) is clear of `blockers`. */
  private clear(eye: THREE.Vector3, target: THREE.Vector3, blockers: THREE.Object3D[]): boolean {
    const to = v2.copy(target).sub(eye);
    const far = to.length();
    ray.set(eye, to.normalize());
    ray.far = far - 0.15;
    ray.near = 0.05;
    return ray.intersectObjects(blockers, true).length === 0;
  }

  /** The camera's not inside anything: straight up from it there's nothing within a few metres. */
  private open(eye: THREE.Vector3, blockers: THREE.Object3D[]): boolean {
    ray.set(eye, new THREE.Vector3(0, 1, 0));
    ray.near = 0;
    ray.far = 3;
    const above = ray.intersectObjects(blockers, true);
    // Inside a solid, or under the wheelhouse roof, both count as shut in.
    return above.length === 0;
  }

  /**
   * Where to see one of the crew from, planned in 3D: round them from in front, a little off to
   * one side, at a few distances and heights, the first spot that sees both their face and their
   * middle without anything (the boat, the turret, a crewmate) in the way, and not shut in.
   */
  private planShot(c: Crew): Shot {
    const blockers = this.blockers(c);
    const local = c.holder.position;
    const eyes = c.sitting ? c.tall * 0.45 : c.tall * 0.8;
    const face = new THREE.Vector3(local.x, local.y + eyes, local.z);
    const middle = new THREE.Vector3(local.x, local.y + eyes * 0.6, local.z);
    const turns = [0.45, -0.45, 0, 0.9, -0.9, 1.35, -1.35, 1.9, -1.9, Math.PI];
    for (const reachK of [1, 1.3, 0.8]) {
      for (const lift of [0.35, 1.1, 2.0]) {
        for (const turn of turns) {
          const bearing = c.station.facing + turn;
          const reach = (1.4 + c.tall * 1.5) * reachK;
          const eye = new THREE.Vector3(
            local.x + Math.cos(bearing) * reach,
            local.y + eyes + lift,
            local.z + Math.sin(bearing) * reach,
          );
          const w = this.hull.localToWorld(eye.clone());
          const wFace = this.hull.localToWorld(face.clone());
          const wMid = this.hull.localToWorld(middle.clone());
          if (
            this.open(w, blockers) &&
            this.clear(w, wFace, blockers) &&
            this.clear(w, wMid, blockers)
          ) {
            return { eye, look: face.clone().setY(face.y - 0.1) };
          }
        }
      }
    }
    // Nothing clear: high over them, looking down.
    return {
      eye: new THREE.Vector3(local.x + 3, local.y + eyes + 4, local.z + 3),
      look: face,
    };
  }

  /**
   * The console shot, planned the same way under the hardtop: over the shoulder of whoever's at
   * it, seeing the cradles and their hands, from somewhere under the roof (not up in it).
   */
  private planConsole(c: Crew): Shot {
    const blockers = this.blockers(c).filter((b) => b !== this.boat.root);
    const s = this.boat.console.stand;
    const { back, front, side, roof } = this.boat.helm;
    const holder = this.boat.console.holders[1];
    const cradles = holder
      ? this.hull
          .worldToLocal(holder.getWorldPosition(new THREE.Vector3()))
          .add(new THREE.Vector3(0, 0.12, 0))
      : new THREE.Vector3(s.x + 0.75, s.y + 1.4, s.z);
    for (const [dx, dy, dz] of [
      [-1.4, 2.1, 1.25],
      [-1.1, 2.0, 1.6],
      [-1.8, 2.2, 0.9],
      [-0.8, 2.15, 2.0],
    ] as const) {
      const eye = new THREE.Vector3(s.x + dx, s.y + dy, s.z + dz);
      // Under the roof, clear of the crew.
      if (eye.x < back || eye.x > front || Math.abs(eye.z) > side || eye.y > roof - 0.15) continue;
      const w = this.hull.localToWorld(eye.clone());
      if (this.clear(w, this.hull.localToWorld(cradles.clone()), blockers)) {
        return { eye, look: cradles };
      }
    }
    return { eye: new THREE.Vector3(s.x - 1.5, s.y + 2.2, s.z + 1.3), look: cradles };
  }

  /**
   * The run in's camera, one move with no cut: from the console, out from under the hardtop on the
   * side the hero goes forward on, alongside them up the side deck, low by the bow wave with the
   * island ahead, up and back to a high chase, and down to the raid's camera over the hero. Each
   * point is in the boat's space; the last is filled in each frame (it follows the hero and the
   * beach). `side` is +1 to starboard, -1 to port.
   */
  private planRun(c: Crew, side: number): void {
    const shot = this.planConsole(c);
    const deck = deckY(0);
    const lane = this.boat.sideDeck;
    const mid = lane[Math.floor(lane.length / 2)] ?? { x: 2.8, z: 1.75 };
    const z = (v: number) => v * side;
    const eyes = [
      shot.eye.clone(),
      new THREE.Vector3(-1.4, deck + 2.15, z(1.0)),
      new THREE.Vector3(-1.6, deck + 2.0, z(3.6)),
      new THREE.Vector3(mid.x - 1.2, deck + 2.6, z(4.9)),
      new THREE.Vector3(8.0, 2.6, z(4.6)),
      new THREE.Vector3(-4, 7.5, z(9.5)),
      new THREE.Vector3(-12, 10, z(11)),
    ];
    const looks = [
      shot.look.clone(),
      new THREE.Vector3(0.2, deck + 1.6, z(1.6)),
      new THREE.Vector3(1.6, deck + 1.5, z(1.9)),
      new THREE.Vector3(mid.x + 1.2, deck + 1.4, z(mid.z)),
      new THREE.Vector3(12, 1.5, z(-1)),
      new THREE.Vector3(4, 1.6, 0),
      new THREE.Vector3(6, 1.2, 0),
    ];
    this.runPath = {
      eyes: new THREE.CatmullRomCurve3(eyes, false, "centripetal"),
      looks: new THREE.CatmullRomCurve3(looks, false, "centripetal"),
    };
  }

  // ---------------------------------------------------------------------------------------------
  // The steps.

  /** Ready: the one picked goes to the console at the helm. */
  ready(): void {
    const c = this.crew[this.chosen];
    if (!c || this.stage !== "choose") return;
    this.setStep("console");
    c.sitting = false;
    const { console } = this.boat;
    c.path = this.routeTo(c, { x: console.stand.x, z: console.stand.z });
    c.captain?.self.face?.express("tactical_focus");
  }

  /** The crystals in the console's cradles, as the player sets them. */
  setCrystals(powers: readonly TimePower[]): void {
    for (const g of this.gems) g.removeFromParent();
    this.gems.length = 0;
    this.boat.console.holders.forEach((holder, i) => {
      const power = powers[i];
      if (!power) return;
      const crystal = timeCrystal(power, 0.42);
      holder.add(crystal);
      this.gems.push(crystal);
    });
  }

  /** Where in the bow someone goes over the side, on their side of the boat. */
  private overFor(c: Crew): CrewBoat["over"][number] {
    const side = c.holder.position.z >= 0 ? 1 : -1;
    const over = this.boat.over.find((o) => Math.sign(o.z) === side) ?? this.boat.over[0];
    return over ?? { x: 7.45, z: 0.45 * side, top: 2.7, reach: 0.65 };
  }

  /** Set off: she gets under way, and the hero goes forward to the bow. */
  setOff(): void {
    const c = this.crew[this.chosen];
    if (!c || this.stage !== "console") return;
    const over = this.overFor(c);
    this.overUsed = over;
    this.planRun(c, Math.sign(over.z) || 1);
    this.setStep("run");
    c.path = this.routeTo(c, over);
    c.captain?.self.face?.say("[tactical_focus] Bring her in. [pause:0.3] [look:ahead] Quietly.");
  }

  /**
   * The way along the deck from where someone is to a point: across the cockpit as the crow flies,
   * and between the cockpit and the bow along a side deck past the cuddy (the side they're on).
   */
  private routeTo(c: Crew, to: { x: number; z: number }): THREE.Vector3[] {
    const from = { x: c.holder.position.x, z: c.holder.position.z };
    const fore = (p: { x: number; z: number }) => p.x > this.boat.foreOf;
    const lane = (side: number) => this.boat.sideDeck.map((p) => ({ x: p.x, z: p.z * side }));
    const route: { x: number; z: number }[] = [];
    if (fore(from) !== fore(to)) {
      const side = Math.sign(fore(from) ? from.z : to.z) || Math.sign(from.z) || 1;
      // Only the stretch of the side deck between where they are and where they're going.
      const between = lane(side).filter(
        (p) => p.x > Math.min(from.x, to.x) && p.x < Math.max(from.x, to.x),
      );
      route.push(...(fore(to) ? between : between.reverse()));
    } else if (
      fore(from) &&
      Math.sign(from.z) !== Math.sign(to.z) &&
      Math.min(from.x, to.x) < 5.8
    ) {
      // From one side deck to the other: round the cuddy's nose.
      const out = lane(Math.sign(from.z) || 1).filter((p) => p.x > from.x);
      const back = lane(Math.sign(to.z) || 1).filter((p) => p.x > to.x);
      route.push(...out, ...back.reverse());
    }
    route.push(to);
    return route.map((p) => new THREE.Vector3(p.x, deckY(p.x), p.z));
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
      this.arrived(c);
      return;
    }
    if (this.stage !== "run" && this.stage !== "ashore") return;
    this.run = 1;
    this.placeBoat(0);
    this.root.updateMatrixWorld(true);
    if (this.stage === "run") {
      const over = this.overFor(c);
      this.overUsed = over;
      c.holder.position.set(over.x, deckY(over.x), over.z);
      c.path.length = 0;
      this.setStep("ashore");
    }
    this.throwGear();
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

  /** Where the sun's shadows are kept sharp, and how far round. */
  get shadowFocus(): { at: THREE.Vector3; size: number } {
    const c = this.crew[this.chosen];
    if (c && (this.stage === "choose" || this.stage === "console" || this.stage === "ashore")) {
      return { at: c.holder.getWorldPosition(new THREE.Vector3()), size: 4 };
    }
    return { at: this.root.position.clone(), size: 11 };
  }

  private setStep(step: Step): void {
    this.stage = step;
    this.stepTime = 0;
  }

  // ---------------------------------------------------------------------------------------------
  // Each frame.

  /** `time` is the game's clock, the same one the raid sways her by, so the hand-over matches. */
  update(dt: number, camera: THREE.PerspectiveCamera, time: number): void {
    this.time = time;
    this.stepTime += dt;
    this.cameraSince += dt;
    crystalTime.value += dt;
    if (this.stage === "run") this.run = Math.min(1, this.run + dt / RUN_SECONDS);
    this.placeBoat(dt);
    this.moveCrew(dt);
    const picked = this.crew[this.chosen];
    if (this.stage === "run" && this.run >= 1 && picked && picked.path.length === 0) {
      this.setStep("ashore");
    }
    if (this.stage === "ashore") this.ashore(dt);
    this.splash(dt);
    this.place(dt, camera);
    for (const gem of this.gems) crystalDetail(gem, camera);
  }

  /** Where she is on her course, and how she rides. */
  private placeBoat(dt: number): void {
    // Speeding up out at sea, slowing for the beach: the run's progress through her course.
    const k = this.run < 0.5 ? 2 * this.run * this.run : 1 - (-2 * this.run + 2) ** 2 / 2;
    const at = this.course.getPoint(k);
    const was = this.root.position.clone();
    this.root.position.set(at.x, 0, at.z);
    const tangent = this.course.getTangent(Math.min(0.999, k));
    this.heading = this.run >= 1 ? this.endHeading : Math.atan2(tangent.z, tangent.x);
    this.root.rotation.y = -this.heading;
    const moved = dt > 0 ? was.distanceTo(this.root.position) / dt : 0;
    this.speed += (moved - this.speed) * Math.min(1, dt * 3);
    // Her bow lifts with speed; out at sea she rolls and pitches on the swell, run aground she only
    // shifts as the raid has her (the same clock and the same sway).
    const sea = 1 - ease(this.run * 1.15);
    const t = this.time;
    this.hull.position.y = boatRise(t) + Math.sin(t * 1.1) * 0.12 * sea;
    this.hull.rotation.x = Math.sin(t * 0.9) * 0.035 * sea;
    this.hull.rotation.z =
      boatRoll(t) + Math.sin(t * 0.63 + 1) * 0.02 * sea + Math.min(0.07, this.speed * 0.012);
  }

  /** Foam along her sides and astern, and spray off the bow, while she's moving. */
  private splash(dt: number): void {
    const world = this.root.parent;
    if (!world) return;
    this.fleckDue -= dt;
    const moving = this.speed > 0.5 && this.stage === "run";
    while (moving && this.fleckDue <= 0) {
      this.fleckDue += 0.045;
      const spray = Math.random() < 0.45;
      const side = Math.random() < 0.5 ? -1 : 1;
      const local = spray
        ? new THREE.Vector3(6.2 + Math.random() * 1.2, 0.3, side * 1.6)
        : new THREE.Vector3(-7.2 + Math.random() * 1.5, 0.05, side * (1.5 + Math.random() * 1.2));
      const at = this.root.localToWorld(local);
      const out = new THREE.Vector3(0, 0, side).applyQuaternion(this.root.quaternion);
      const sprite =
        this.flecks.find((f) => f.age >= f.life)?.sprite ??
        new THREE.Sprite(
          new THREE.SpriteMaterial({ map: foam(), transparent: true, depthWrite: false }),
        );
      if (!sprite.parent) world.add(sprite);
      sprite.position.copy(at);
      const fleck = this.flecks.find((f) => f.sprite === sprite);
      const velocity = spray
        ? out.multiplyScalar(2 + Math.random() * 2).setY(2.5 + Math.random() * 2)
        : out.multiplyScalar(0.6);
      if (fleck) {
        fleck.velocity.copy(velocity);
        fleck.age = 0;
        fleck.life = spray ? 0.9 : 2.6;
        fleck.grow = spray ? 0.6 : 2.2;
      } else {
        this.flecks.push({
          sprite,
          velocity,
          age: 0,
          life: spray ? 0.9 : 2.6,
          grow: spray ? 0.6 : 2.2,
        });
      }
    }
    for (const f of this.flecks) {
      f.age += dt;
      const k = f.age / f.life;
      f.sprite.visible = k < 1;
      if (k >= 1) continue;
      f.velocity.y -= 9.8 * dt * (f.grow < 1 ? 1 : 0);
      f.sprite.position.addScaledVector(f.velocity, dt);
      if (f.grow >= 1) f.sprite.position.y = 0.06;
      f.sprite.scale.setScalar(0.5 + f.grow * k);
      (f.sprite.material as THREE.SpriteMaterial).opacity = (1 - k) * (f.grow < 1 ? 0.9 : 0.55);
    }
  }

  private moveCrew(dt: number): void {
    const picked = this.crew[this.chosen];
    for (const c of this.crew) {
      if (c === picked && this.stage === "ashore") continue;
      let moving = false;
      const target = c.path[0];
      if (target) {
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
          c.holder.position.addScaledVector(to.normalize(), Math.min(gap, DECK_WALK * dt));
          c.holder.position.y = deckY(c.holder.position.x);
          const want = Math.atan2(to.z, to.x);
          let d = want - c.facing;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          c.facing += d * Math.min(1, dt * 10);
        }
      }
      c.holder.rotation.y = -c.facing;
      // In full while it's them the camera's on (or they're walking); the raid copy otherwise.
      const close = (c === picked || moving) && c.near !== null;
      const shown = close && c.near ? c.near : c.far;
      if (!c.captain) {
        c.far.model.root.visible = shown === c.far;
        if (c.near) c.near.model.root.visible = shown === c.near;
      }
      const move: HeroMove = c.sitting
        ? SITTING
        : { ...AT_EASE, moving, speed: moving ? DECK_WALK : 0 };
      if (c.captain) c.far.animator?.update(dt, move);
      else shown.animator?.update(dt, move);
      c.captain?.update(dt, moving ? "deck-walk" : "deck-still");
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

  /** Two bags of kit, thrown from the bow onto the sand ahead. */
  private throwGear(): void {
    const world = this.root.parent;
    if (!world || this.gear.length > 0) return;
    const up = new THREE.Vector3(Math.cos(this.heading), 0, Math.sin(this.heading));
    const across = new THREE.Vector3(-up.z, 0, up.x);
    const bow = this.hull.localToWorld(new THREE.Vector3(7.4, deckY(7.4) + 0.5, 0));
    for (const [lead, side] of [
      [3.4, 1.4],
      [4.6, -1.0],
    ] as const) {
      const bag = gearBag();
      const from = bow.clone().add(new THREE.Vector3(0, 0.8, 0));
      const to = bow.clone().addScaledVector(up, lead).addScaledVector(across, side);
      to.y = Math.max(0, this.site.ground(to.x, to.z));
      bag.visible = false;
      world.add(bag);
      this.gear.push({ bag, from, to, turn: Math.random() * Math.PI });
    }
  }

  /** At the beach: kit over the side, the hero over the bow from where they stand, and up the sand. */
  private ashore(dt: number): void {
    const c = this.crew[this.chosen];
    const world = this.root.parent;
    if (!c || !world) return;
    const t = this.stepTime;
    this.throwGear();
    this.gear.forEach((g, i) => {
      const s = Math.min(1, Math.max(0, (t - i * 0.35) / 0.7));
      g.bag.position.lerpVectors(g.from, g.to, ease(s));
      g.bag.position.y += Math.sin(s * Math.PI) * 1.4;
      g.bag.rotation.set(0, g.turn + s * 2.5, s * 1.2 * (1 - s));
      g.bag.visible = t > i * 0.35;
    });
    // Over the bow from exactly where they stand: up onto the bulwark, then down onto the sand.
    if (c.holder.parent !== world) {
      world.attach(c.holder);
      c.path = [];
      this.climbFrom.copy(c.holder.position);
    }
    const up = new THREE.Vector3(Math.cos(this.heading), 0, Math.sin(this.heading));
    // Up onto the bulwark ahead (as high above the deck as it is there), and over.
    const over = this.overUsed ?? this.boat.over[0];
    const reach = over?.reach ?? 0.6;
    const climb = over ? over.top - deckY(over.x) : 0.95;
    const landAt = this.climbFrom.clone().addScaledVector(up, reach + 2.4);
    landAt.y = Math.max(0, this.site.ground(landAt.x, landAt.z));
    const top = this.climbFrom.clone().addScaledVector(up, reach);
    top.y += climb;
    c.facing = this.heading;
    let walking = false;
    let mode: "deck-walk" | "fight" = "deck-walk";
    if (t < 0.6) {
      c.holder.position.lerpVectors(this.climbFrom, top, ease(t / 0.6));
    } else if (t < 1.3) {
      const k = (t - 0.6) / 0.7;
      c.holder.position.lerpVectors(top, landAt, ease(k));
      c.holder.position.y += Math.sin(k * Math.PI) * 0.6;
    } else {
      // Up the beach to where the fight starts, drawing the rifle on the way.
      const spawn = this.site.spawn;
      const to = v.set(spawn.x, 0, spawn.y);
      const step = to.sub(c.holder.position);
      step.y = 0;
      const gap = step.length();
      if (gap < 0.1) {
        this.setStep("done");
        return;
      }
      if (gap < 3.5) mode = "fight";
      c.holder.position.addScaledVector(step.normalize(), Math.min(gap, BEACH_WALK * dt));
      c.holder.position.y = Math.max(0, this.site.ground(c.holder.position.x, c.holder.position.z));
      c.facing = Math.atan2(step.z, step.x);
      walking = true;
    }
    c.holder.rotation.y = -c.facing;
    const blob = c.holder.children.find((o) => o.userData.contact === true);
    if (blob) {
      const below = Math.max(0, this.site.ground(c.holder.position.x, c.holder.position.z));
      blob.position.y = Math.min(0.02, below - c.holder.position.y + 0.02);
      blob.visible = t > 1.25;
    }
    const move = { ...AT_EASE, moving: walking, speed: walking ? BEACH_WALK : 0 };
    const shown = c.near && !c.captain ? c.near : c.far;
    shown.animator?.update(dt, move);
    c.captain?.update(dt, mode);
  }

  private readonly climbFrom = new THREE.Vector3();
  /** Where the hero went over the side. */
  private overUsed: CrewBoat["over"][number] | null = null;

  // ---------------------------------------------------------------------------------------------
  // The camera.

  private place(dt: number, camera: THREE.PerspectiveCamera): void {
    if (this.overview) {
      const p = this.root.position;
      camera.position.set(p.x, p.y + 40, p.z + 0.01);
      camera.lookAt(p.x, p.y, p.z);
      return;
    }
    this.root.updateMatrixWorld(true);
    const c = this.crew[this.chosen];
    let eye: THREE.Vector3;
    let look: THREE.Vector3;
    if (!c || !c.shot) {
      // Before the crew's aboard: the whole boat, from off her quarter.
      eye = this.root.localToWorld(new THREE.Vector3(-14, 7, 12));
      look = this.root.localToWorld(new THREE.Vector3(0, 2, 0));
    } else if (this.stage === "choose") {
      eye = this.hull.localToWorld(c.shot.eye.clone());
      look = this.hull.localToWorld(c.shot.look.clone());
    } else if (this.stage === "console") {
      const shot = this.planConsole(c);
      eye = this.hull.localToWorld(shot.eye.clone());
      look = this.hull.localToWorld(shot.look.clone());
    } else {
      const follow = this.followView(c);
      if (this.stage === "run" && this.runPath) {
        const k = Math.min(1, this.stepTime / (RUN_SECONDS * 0.82));
        eye = this.root.localToWorld(this.runPath.eyes.getPoint(ease(k)));
        look = this.root.localToWorld(this.runPath.looks.getPoint(ease(k)));
        // The last stretch comes down onto the raid's camera over the hero.
        const w = ease((this.run - 0.72) / 0.28);
        eye.lerp(follow.position, w);
        look.lerp(follow.look, w);
      } else {
        eye = follow.position;
        look = follow.look;
      }
    }
    // Eased towards where it wants to be: a move, never a jump.
    const settle = this.stage === "choose" ? 1 - Math.exp(-dt * 4) : 1 - Math.exp(-dt * 9);
    if (this.cameraSince > 90) {
      this.cameraAt.copy(eye);
      this.cameraLook.copy(look);
      this.cameraSince = 0;
    } else {
      this.cameraAt.lerp(eye, settle);
      this.cameraLook.lerp(look, settle);
    }
    camera.position.copy(this.cameraAt);
    camera.lookAt(this.cameraLook);
    void CAMERA_MOVE;
  }

  /** The raid's camera, kept on the hero as they go: where it'll be when the fight starts. */
  private followView(c: Crew): { position: THREE.Vector3; look: THREE.Vector3 } {
    const { spawn, view, ground } = this.site;
    const spawnAt = new THREE.Vector3(spawn.x, Math.max(0, ground(spawn.x, spawn.y)), spawn.y);
    const offset = view.position.clone().sub(spawnAt);
    const hero = c.holder.getWorldPosition(new THREE.Vector3());
    hero.y = Math.max(0, ground(hero.x, hero.z));
    const position = hero.clone().add(offset);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(view.quaternion);
    return { position, look: position.clone().addScaledVector(forward, 10) };
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const g of this.gear) g.bag.removeFromParent();
    for (const f of this.flecks) f.sprite.removeFromParent();
    for (const c of this.crew) c.holder.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
