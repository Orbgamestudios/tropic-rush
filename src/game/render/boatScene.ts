// Setting out on a raid (docs/DESIGN.md, Added 2026-11-16), all one unbroken shot from the choosing
// to the fight, with no cut anywhere:
//
// 1. The crew aboard the gunboat out at sea in the late afternoon, standing or sat about her deck;
//    the player swings round her from one to the next and picks who goes.
// 2. The one picked goes to the console and sets the time crystals they'll take in its three
//    cradles, while she runs in to the island: by the time they're set she's all but on the beach.
// 3. Set off, and a cut (the owner's call, 2026-11-23: quick, no long run in, no kit thrown ashore):
//    from the sand ahead as she grounds, the hero at her bow; they hop over onto the beach, and the
//    camera comes down to just where the player's camera sits in a raid. The raid takes over from
//    where they land: the same boat in the same place, swaying to the same clock, the rest of the
//    crew still aboard.
//
// Every camera position is planned in 3D before it's used: candidates round the subject are tried
// against the boat's own geometry and the crew, and only one that sees them clearly (not through a
// wall, the turret, a crewmate, or from inside anything) is kept. On the way between them, the
// camera is held clear of the boat (cameraGuard.ts): it never passes through a post, the roof or the
// glass, and never comes close enough to anything to cut into it.

import * as THREE from "three";
import type { HeroKind } from "../logic/heroes";
import type { TimePower } from "../logic/timeShards";
import { CameraGuard } from "./cameraGuard";
import type { Person } from "./captain";
import { PersonInRaid, personFor } from "./captainRaid";
import { contactShadow } from "./contactShadow";
import {
  boatRise,
  boatRoll,
  type CrewBoat,
  crewBoatModel,
  deckY,
  SITTING,
  type Station,
} from "./gunboat";
import { AT_EASE, HeroAnimator, type HeroMove } from "./heroAnimator";
import { type HeroModel, heroModel } from "./heroModels";
import { loadMenuBody, loadRigs } from "./riggedHeroes";
import { crystalDetail, crystalTime, timeCrystal } from "./timeShard";

/** What each of the rigged people says when picked, and when the boat sets off. */
const LINES: Partial<Record<Person, { picked: string; setOff: string }>> = {
  captain: {
    picked: "[confident_smirk] [look:ahead] Ready when you are. [nod]",
    setOff: "[tactical_focus] Bring her in. [pause:0.3] [look:ahead] Quietly.",
  },
  rifleman: {
    picked: "[confident_smirk] [look:ahead] Locked and loaded. [nod]",
    setOff: "[tactical_focus] [look:ahead] Take us in.",
  },
};
/** How far through her run in she gets while the crystals are being set: all but aground. */
const APPROACH = 0.86;
/** Seconds that takes, from Ready: the walk to the console and a moment at it. */
const APPROACH_SECONDS = 9;
/**
 * The longest from Set off to her grounding, the hero at her bow, in seconds: set off early and she
 * comes the rest of the way in faster, but never slower than she was already coming in.
 */
const LAND_SECONDS = 3;
/** Seconds over the bow: up onto the bulwark, down onto the sand, and a beat. */
const HOP = { up: 0.4, down: 0.55, done: 1.15 } as const;
/** Walking pace on deck, metres a second. */
const DECK_WALK = 2.4;
/** Seconds the camera takes to settle on a new subject while choosing. */
const CAMERA_MOVE = 1.2;
/**
 * The camera's near plane aboard, in metres: the stage's own is half a metre, which cut into the
 * roof, the posts and the heads of the crew on the close shots under the hardtop.
 */
const BOAT_NEAR = 0.2;

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
  /** The Captain or the Rifleman, following `far` (their figure, which no one sees). */
  person: PersonInRaid | null;
  /** Which of the rigged people they are, if they are one. */
  who: Person | null;
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
const v3 = new THREE.Vector3();
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
  private readonly gems: THREE.Object3D[] = [];
  private readonly flecks: Fleck[] = [];
  private fleckDue = 0;
  /** Where her run in stood at Set off, and the shot she lands in, planned then. */
  private runFrom = 0;
  private landingShot: Shot | null = null;
  private readonly cameraAt = new THREE.Vector3();
  private readonly cameraLook = new THREE.Vector3();
  /** The boat's surfaces, for keeping the camera clear of them. */
  private readonly guard: CameraGuard;
  /** The console shot, planned once each time someone goes to the console. */
  private consoleShot: Shot | null = null;
  /** The camera, and its own near plane, given back when she's done with. */
  private camera: THREE.PerspectiveCamera | null = null;
  private cameraNear = 0;
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
    this.guard = new CameraGuard(this.boat.root, this.hull);
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
    // The rigged people stand (they've no sitting pose): they go to the first stations, which stand.
    const order = [...kinds].sort(
      (a, b) => Number(personFor(b) !== null) - Number(personFor(a) !== null),
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
        const who = personFor(kind);
        // Up close aboard (the console, the landing), the full model: the others' light copies are
        // too rough that near. The Captain's raid copy holds up, and his full one is half a million
        // triangles.
        const person = who
          ? await PersonInRaid.follow(farModel, who, { full: who !== "captain" })
          : null;
        if (person) holder.add(person.root);
        this.hull.add(holder);
        holder.updateMatrixWorld(true);
        const tall = Math.max(1.4, new THREE.Box3().setFromObject(farModel.root).getSize(v).y);
        return {
          kind,
          holder,
          far,
          near: null,
          person,
          who,
          station,
          path: [],
          facing: station.facing,
          sitting: station.sit && !person,
          tall,
          shot: null,
        };
      }),
    );
    this.hull.updateMatrixWorld(true);
    for (const c of this.crew) if (!c.sitting) this.standClear(c);
    this.hull.updateMatrixWorld(true);
    for (const c of this.crew) c.shot = this.planShot(c);
    this.choose(chosen, true);
    // The detailed models, as they come.
    for (const c of this.crew) {
      if (c.person) continue;
      void loadMenuBody(c.kind).then(() => {
        const model = heroModel(c.kind, true);
        model.root.visible = false;
        c.holder.add(model.root);
        c.near = { model, animator: model.rig && new HeroAnimator(model.rig) };
      });
    }
  }

  /**
   * Moves a crewmate standing at their place, and if need be turns them, until no part of them cuts
   * through the boat: an elbow through the cabin's side, a rifle through the rail. Their body is
   * looked at in a few moments of standing about (the arms move), from their chest out to each
   * point; the nearest spot (a few centimetres, never through a wall, still over the deck) where
   * nothing crosses one of her surfaces is where they stand.
   */
  private standClear(c: Crew): void {
    const points: THREE.Vector3[] = [];
    const sample = () => {
      c.holder.updateMatrixWorld(true);
      c.holder.traverseVisible((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const material = o.material as THREE.Material;
        if (material.colorWrite === false) return;
        const position = o.geometry.getAttribute("position");
        if (!position) return;
        const step = Math.max(1, Math.floor(position.count / 500));
        for (let i = 0; i < position.count; i += step) {
          const point = o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(o.matrixWorld);
          points.push(this.hull.worldToLocal(point));
        }
      });
    };
    for (let moment = 0; moment < 8; moment++) {
      if (c.person) {
        c.far.animator?.update(1.25, AT_EASE);
        c.person.update(1.25, "deck-still");
      }
      sample();
    }
    const at = c.holder.position.clone();
    const knees = at.y + c.tall * 0.2;
    const above = points.filter((q) => q.y > knees);
    // A few hundred points are plenty to find an elbow through a wall.
    const stride = Math.max(1, Math.floor(above.length / 600));
    const body = above.filter((_, i) => i % stride === 0);
    const chest = new THREE.Vector3(at.x, at.y + c.tall * 0.6, at.z);
    const turned = new THREE.Vector3();
    const moved = new THREE.Vector3();
    const cuts = (offset: THREE.Vector3, turn: number, most = Infinity) => {
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const from = moved.copy(chest).add(offset);
      let n = 0;
      for (const q of body) {
        const dx = q.x - at.x;
        const dz = q.z - at.z;
        turned.set(
          at.x + dx * cos + dz * sin + offset.x,
          q.y,
          at.z - dx * sin + dz * cos + offset.z,
        );
        if (this.guard.crosses(from, turned) && ++n >= most) return n;
      }
      return n;
    };
    let best = { offset: new THREE.Vector3(), turn: 0, cuts: cuts(new THREE.Vector3(), 0) };
    if (best.cuts === 0) return;
    const deck = new THREE.Vector3();
    search: for (const reach of [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4]) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const offset = new THREE.Vector3(Math.cos(a) * reach, 0, Math.sin(a) * reach);
        const there = chest.clone().add(offset);
        // Never through a wall to get there, and still standing on her deck.
        if (this.guard.crosses(chest, there)) continue;
        if (!this.guard.crosses(there, deck.copy(there).setY(at.y - 0.2))) continue;
        for (const turn of [0, 0.25, -0.25, 0.5, -0.5]) {
          const n = cuts(offset, turn, best.cuts);
          if (n < best.cuts) best = { offset, turn, cuts: n };
          if (n === 0) break search;
        }
      }
    }
    c.holder.position.add(best.offset);
    c.holder.position.y = deckY(c.holder.position.x);
    c.facing -= best.turn;
    c.holder.rotation.y = -c.facing;
    c.station = {
      ...c.station,
      x: c.holder.position.x,
      z: c.holder.position.z,
      y: c.holder.position.y,
      facing: c.facing,
    };
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

  /** The rigged people answer being picked, and go back to watching the sea when they aren't. */
  private greet(): void {
    for (const c of this.crew) {
      const face = c.person?.self.face;
      if (!face) continue;
      if (c === this.crew[this.chosen]) {
        const line = c.who && LINES[c.who];
        if (line) face.say(line.picked);
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
            this.guard.isOpen(eye) &&
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
   * The console shot: from beside whoever's at it and a little ahead, out over the side deck, so
   * their face is seen three-quarters on with the crystals in front of them (from behind, the back
   * of a head filled the shot). Failing that, from inboard. Never up in the roof, and clear of the
   * boat and the crew.
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
    const face = new THREE.Vector3(s.x, s.y + c.tall * 0.88, s.z);
    const look = face.clone().lerp(cradles, 0.45);
    // Out to the side the console's on (positive), or in towards the middle (negative).
    const outward = s.z > 0 ? 1 : -1;
    for (const [dx, dy, dz] of [
      [0.6, 2.3, 1.7],
      [0.3, 2.2, 1.9],
      [0.8, 2.1, 1.5],
      [0, 2.3, -2.1],
      [-0.8, 2.5, -1.5],
      [-1.4, 2.3, -1.25],
    ] as const) {
      const eye = new THREE.Vector3(s.x + dx, s.y + dy, s.z + dz * outward);
      const underRoof = eye.x > back && eye.x < front && Math.abs(eye.z) < side;
      if (underRoof && eye.y > roof - 0.3) continue;
      if (this.guard.reach(look, eye) < 1) continue;
      const w = this.hull.localToWorld(eye.clone());
      if (this.clear(w, this.hull.localToWorld(look.clone()), blockers)) return { eye, look };
    }
    return { eye: new THREE.Vector3(s.x - 1.5, s.y + 2.3, s.z - 1.3 * outward), look: cradles };
  }

  /** The console shot for whoever's at it, planned the first time it's wanted. */
  private consoleView(c: Crew): Shot {
    if (!this.consoleShot) this.consoleShot = this.planConsole(c);
    return this.consoleShot;
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
    c.person?.self.face?.express("tactical_focus");
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

  /**
   * Set off: a cut. The hero's at her bow on their side, ready to go over, and the camera's on the
   * sand ahead as she runs the last of the way in.
   */
  setOff(): void {
    const c = this.crew[this.chosen];
    if (!c || this.stage !== "console") return;
    const over = this.overFor(c);
    this.overUsed = over;
    c.path.length = 0;
    c.holder.position.set(over.x, deckY(over.x), over.z);
    c.facing = 0;
    c.holder.rotation.y = 0;
    this.runFrom = this.run;
    this.landingShot = this.planLanding(Math.sign(over.z) || 1);
    this.cameraSince = 999;
    this.setStep("run");
    const line = c.who && LINES[c.who];
    if (line) c.person?.self.face?.say(line.setOff);
  }

  /**
   * The shot she lands in: low on the sand ahead and off to the hero's side, looking back at her bow
   * as she grounds, so the hop down comes towards the camera. In the world, where she'll ground.
   */
  private planLanding(side: number): Shot {
    const up = new THREE.Vector3(Math.cos(this.endHeading), 0, Math.sin(this.endHeading));
    const across = new THREE.Vector3(-up.z, 0, up.x);
    const end = this.course.getPoint(1);
    const bow = end.clone().addScaledVector(up, 7.6);
    const eye = bow
      .clone()
      .addScaledVector(up, 6)
      .addScaledVector(across, side * 4.2);
    eye.y = Math.max(0, this.site.ground(eye.x, eye.z)) + 1.7;
    const look = bow
      .clone()
      .addScaledVector(up, 0.8)
      .addScaledVector(across, side * 0.4);
    look.y = deckY(7.4) + 1.2;
    return { eye, look };
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

  /** Whether there's something to skip just now: a walk to the console, or the landing. */
  get skippable(): boolean {
    const c = this.crew[this.chosen];
    return (
      (this.stage === "console" && (c?.path.length ?? 0) > 0) ||
      this.stage === "run" ||
      this.stage === "ashore"
    );
  }

  /** Skips to the end of what's happening: the hero at the console, or on the sand, she aground. */
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
    const world = this.root.parent;
    if (world && c.holder.parent !== world) {
      world.attach(c.holder);
      this.climbFrom.copy(c.holder.position);
    }
    c.holder.position.copy(this.landingSpot());
    c.path.length = 0;
    this.setStep("done");
  }

  /** Done: the hero's down on the sand, where the fight starts. */
  get done(): boolean {
    return this.stage === "done";
  }

  /** Where the hero landed, in the raid's terms (x, and the world's z as y), for the fight to start. */
  get landedAt(): { x: number; y: number } {
    const at = this.crew[this.chosen]?.holder.getWorldPosition(new THREE.Vector3());
    return at ? { x: at.x, y: at.z } : { x: this.site.spawn.x, y: this.site.spawn.y };
  }

  /** The rest of the crew, and just where each stands aboard (clear of her, see standClear). */
  get stayingAboard(): { kind: HeroKind; station: Station }[] {
    return this.crew
      .filter((_, i) => i !== this.chosen)
      .map((c) => ({ kind: c.kind, station: c.station }));
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
    if (step === "console") this.consoleShot = null;
  }

  // ---------------------------------------------------------------------------------------------
  // Each frame.

  /**
   * `time` is the game's clock, the same one the raid sways her by, so the hand-over matches;
   * `rich` whether the phone's keeping up at the top quality.
   */
  update(dt: number, camera: THREE.PerspectiveCamera, time: number, rich = true): void {
    this.time = time;
    this.stepTime += dt;
    this.cameraSince += dt;
    crystalTime.value += dt;
    // She runs in while the crystals are set, all but aground by the time they are, and the rest of
    // the way after Set off.
    if (this.stage === "console") {
      this.run = Math.min(APPROACH, this.run + (APPROACH / APPROACH_SECONDS) * dt);
    }
    if (this.stage === "run") {
      const rate = Math.max((1 - this.runFrom) / LAND_SECONDS, APPROACH / APPROACH_SECONDS);
      this.run = Math.min(1, this.run + rate * dt);
    }
    this.placeBoat(dt);
    this.moveCrew(dt);
    const picked = this.crew[this.chosen];
    if (this.stage === "run" && this.run >= 1 && picked && picked.path.length === 0) {
      this.setStep("ashore");
    }
    if (this.stage === "ashore") this.ashore(dt);
    this.splash(dt);
    this.place(dt, camera);
    for (const c of this.crew) c.person?.self.detailFor(camera);
    for (const gem of this.gems) crystalDetail(gem, camera, rich);
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
    const moving = this.speed > 0.5 && (this.stage === "run" || this.stage === "console");
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
      if (!c.person) {
        c.far.model.root.visible = shown === c.far;
        if (c.near) c.near.model.root.visible = shown === c.near;
      }
      const move: HeroMove = c.sitting
        ? SITTING
        : { ...AT_EASE, moving, speed: moving ? DECK_WALK : 0 };
      if (c.person) c.far.animator?.update(dt, move);
      else shown.animator?.update(dt, move);
      c.person?.update(dt, moving ? "deck-walk" : "deck-still");
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

  /** Where the hero comes down on the sand: ahead of where they went over the bow. */
  private landingSpot(): THREE.Vector3 {
    const up = new THREE.Vector3(Math.cos(this.endHeading), 0, Math.sin(this.endHeading));
    const reach = this.overUsed?.reach ?? 0.6;
    const at = this.climbFrom.clone().addScaledVector(up, reach + 2.2);
    at.y = Math.max(0, this.site.ground(at.x, at.z));
    return at;
  }

  /** At the beach: the hero hops over the bow from where they stand, onto the sand, weapon ready. */
  private ashore(dt: number): void {
    const c = this.crew[this.chosen];
    const world = this.root.parent;
    if (!c || !world) return;
    const t = this.stepTime;
    if (c.holder.parent !== world) {
      world.attach(c.holder);
      c.path = [];
      this.climbFrom.copy(c.holder.position);
    }
    const up = new THREE.Vector3(Math.cos(this.heading), 0, Math.sin(this.heading));
    // Up onto the bulwark ahead (as high above the deck as it is there), and down onto the sand.
    const over = this.overUsed ?? this.boat.over[0];
    const reach = over?.reach ?? 0.6;
    const climb = over ? over.top - deckY(over.x) : 0.95;
    const landAt = this.landingSpot();
    const top = this.climbFrom.clone().addScaledVector(up, reach);
    top.y += climb;
    c.facing = this.heading;
    if (t < HOP.up) {
      c.holder.position.lerpVectors(this.climbFrom, top, ease(t / HOP.up));
    } else if (t < HOP.up + HOP.down) {
      const k = (t - HOP.up) / HOP.down;
      c.holder.position.lerpVectors(top, landAt, ease(k));
      c.holder.position.y += Math.sin(k * Math.PI) * 0.5;
    } else {
      c.holder.position.copy(landAt);
      if (t >= HOP.done) {
        this.setStep("done");
        return;
      }
    }
    c.holder.rotation.y = -c.facing;
    const blob = c.holder.children.find((o) => o.userData.contact === true);
    if (blob) {
      const below = Math.max(0, this.site.ground(c.holder.position.x, c.holder.position.z));
      blob.position.y = Math.min(0.02, below - c.holder.position.y + 0.02);
      blob.visible = t > HOP.up + HOP.down * 0.8;
    }
    const shown = c.near && !c.person ? c.near : c.far;
    shown.animator?.update(dt, { ...AT_EASE, moving: false, speed: 0 });
    c.person?.update(dt, t > HOP.up ? "fight" : "deck-walk");
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
      const shot = this.consoleView(c);
      eye = this.hull.localToWorld(shot.eye.clone());
      look = this.hull.localToWorld(shot.look.clone());
    } else {
      const follow = this.followView(c);
      const landing = this.landingShot;
      if (landing && this.stage === "run") {
        // On the sand as she grounds, easing a step in towards her bow and turning a little to keep
        // it in the middle.
        eye = landing.eye.clone().lerp(landing.look, 0.14 * ease(this.stepTime / LAND_SECONDS));
        look = landing.look.clone().lerp(c.holder.getWorldPosition(v).setY(landing.look.y), 0.3);
      } else if (landing && this.stage === "ashore") {
        // As the hero comes down, up and round onto the raid's camera over them, landing on it as
        // they do.
        const w = ease(Math.min(1, this.stepTime / HOP.done));
        const from = landing.eye.clone().lerp(landing.look, 0.14);
        eye = from.lerp(follow.position, w);
        look = landing.look.clone().lerp(follow.look, w);
      } else {
        eye = follow.position;
        look = follow.look;
      }
    }
    // Eased towards where it wants to be (a move, never a jump), except on the landing, which is
    // cut together and laid out move by move above.
    const landing = this.stage === "run" || this.stage === "ashore";
    const settle = landing
      ? 1
      : this.stage === "choose"
        ? 1 - Math.exp(-dt * 4)
        : 1 - Math.exp(-dt * 9);
    if (this.cameraSince > 90) {
      this.cameraAt.copy(eye);
      this.cameraLook.copy(look);
      this.cameraSince = 0;
    } else {
      this.cameraAt.lerp(eye, settle);
      this.cameraLook.lerp(look, settle);
    }
    // Never inside the boat or close enough to cut into her, even passing a post on the way between
    // two shots.
    const free = this.guard.free(
      this.hull.worldToLocal(v.copy(this.cameraAt)),
      this.hull.worldToLocal(v2.copy(this.cameraLook)),
      v3,
    );
    camera.position.copy(this.hull.localToWorld(free));
    camera.lookAt(this.cameraLook);
    if (camera.near !== BOAT_NEAR) {
      this.camera = camera;
      this.cameraNear = camera.near;
      camera.near = BOAT_NEAR;
      camera.updateProjectionMatrix();
    }
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
    if (this.camera) {
      this.camera.near = this.cameraNear;
      this.camera.updateProjectionMatrix();
    }
    this.root.removeFromParent();
    for (const f of this.flecks) f.sprite.removeFromParent();
    for (const c of this.crew) c.holder.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
