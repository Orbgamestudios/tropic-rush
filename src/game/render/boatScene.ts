// Setting out on a raid (docs/DESIGN.md, Added 2026-11-16): the crew aboard the gunboat out at sea,
// the island they're heading for on the horizon in the late afternoon light, and the choice of who
// goes made by swinging round the boat from one hero to the next. Once everyone's ready the boat
// gets under way and runs in to the island.
//
// The boat here is the raid's gunboat, made bigger, a figure for the crew to stand on in close-up.
// The landing itself is shot on the island at the raid's own scale (see landing in Game.ts), so the
// two never have to match: it's a cut, as a film would make it.

import * as THREE from "three";
import type { HeroKind } from "../logic/heroes";
import { type Captain, loadCaptain } from "./captain";
import { AT_EASE, type HeroAnimator } from "./heroAnimator";
import { type MenuHero, menuHero } from "./heroAssets";
import { gunboatModel } from "./models";

/** Whose place the Captain takes aboard. */
const CAPTAIN_KIND: HeroKind = "rifleman";

/** How much bigger than in a raid the boat is made, so a crew fits on it. */
const BOAT_SIZE = 2.3;

/**
 * Where on the boat each hero stands, in the boat's own space (x to the bow, z to starboard), and
 * which way they face (radians, 0 towards the bow). The first places are the ones the camera finds
 * best: the bow, then along each side, then the stern.
 */
const STATIONS: readonly [number, number, number][] = [
  [1.0, 1.35, 0.9],
  [1.0, -1.35, -0.9],
  [4.7, 1.55, 0.4],
  [4.7, -1.55, -0.4],
  [-0.7, 1.4, 1.6],
  [-0.7, -1.4, -1.6],
  [-3.0, 0.95, 2.2],
  [-3.0, -0.95, -2.2],
];

interface Aboard {
  kind: HeroKind;
  holder: THREE.Group;
  animator: HeroAnimator | null;
  /** The Captain in full, with his face and hands, standing in the Rifleman's place. */
  captain: Captain | null;
  /** Where they stand, in the boat's space. */
  station: THREE.Vector3;
  facing: number;
  /** How tall they stand, which sets how far back the camera has to be to fit them in. */
  tall: number;
}

const ease = (t: number) => t * t * (3 - 2 * t);
const towards = new THREE.Vector3();
const look = new THREE.Vector3();
const eye = new THREE.Vector3();

export class BoatScene {
  readonly root = new THREE.Group();
  private readonly hull = new THREE.Group();
  private aboard: Aboard[] = [];
  private chosen = 0;
  /** Where the camera is going round the boat: a bearing and a height, eased towards. */
  private bearing = 0;
  private wantBearing = 0;
  private time = 0;
  /** 0 at anchor, 1 arrived: the run in to the island. */
  private run = 0;
  private running = false;
  private readonly start = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private heading = 0;
  /** Straight down over the boat, for laying out where the crew stands. */
  overview = false;

  /**
   * `from` is where the boat waits, out at sea; `to` where the run in ends, off the beach; both on
   * the water, in the raid's own ground coordinates (x, then y as the scene's z).
   */
  constructor(from: { x: number; y: number }, to: { x: number; y: number }) {
    this.start.set(from.x, 0, from.y);
    this.end.set(to.x, 0, to.y);
    this.heading = Math.atan2(to.y - from.y, to.x - from.x);
    const boat = gunboatModel(false);
    boat.root.scale.setScalar(BOAT_SIZE);
    this.hull.add(boat.root);
    this.root.add(this.hull);
    this.root.position.copy(this.start);
    this.root.rotation.y = -this.heading;
    this.hull.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  /** Puts the crew aboard, each at a station, their detailed models once they've loaded. */
  async board(kinds: readonly HeroKind[], chosen: HeroKind): Promise<void> {
    // The Captain is the player's own character, in the Rifleman's place (docs/DESIGN.md). If his
    // model can't be had, the Rifleman stands there instead.
    const aboard = (kind: HeroKind): Promise<MenuHero & { captain: Captain | null }> =>
      kind === CAPTAIN_KIND
        ? loadCaptain()
            .then((captain) => ({ holder: captain.holder, animator: null, captain }))
            .catch(() => menuHero(kind, true).then((h) => ({ ...h, captain: null })))
        : menuHero(kind, true).then((h) => ({ ...h, captain: null }));
    const loaded = await Promise.all(kinds.map(aboard));
    // Each stands on whatever's there: the deck, or the cabin's roof. Found by looking down.
    this.hull.updateMatrixWorld(true);
    const down = new THREE.Raycaster();
    const surfaces: THREE.Object3D[] = [];
    this.hull.traverse((o) => {
      if (o instanceof THREE.Mesh) surfaces.push(o);
    });
    const standOn = (x: number, z: number) => {
      const from = this.hull.localToWorld(new THREE.Vector3(x, 20, z));
      down.set(from, new THREE.Vector3(0, -1, 0));
      const hit = down.intersectObjects(surfaces, false)[0];
      return hit ? this.hull.worldToLocal(hit.point.clone()).y : 1.2 * BOAT_SIZE;
    };
    this.aboard = loaded.slice(0, STATIONS.length).map(({ holder, animator, captain }, i) => {
      const [x, z, facing] = STATIONS[i] ?? [0, 0, 0];
      const station = new THREE.Vector3(x, standOn(x, z), z);
      holder.position.copy(station);
      // Turned out to sea, towards where the camera comes to them, each a little their own way.
      holder.rotation.y = -Math.atan2(z, x) + facing * 0.15;
      this.hull.add(holder);
      holder.updateMatrixWorld(true);
      const tall = Math.max(1.2, new THREE.Box3().setFromObject(holder).getSize(look).y);
      return { kind: kinds[i] as HeroKind, holder, animator, captain, station, facing, tall };
    });
    this.choose(chosen, true);
  }

  get kinds(): HeroKind[] {
    return this.aboard.map((a) => a.kind);
  }

  get current(): HeroKind | null {
    return this.aboard[this.chosen]?.kind ?? null;
  }

  /** The next hero round the boat (+1) or the one before (-1). */
  step(by: number): HeroKind | null {
    if (this.aboard.length === 0) return null;
    this.chosen = (this.chosen + by + this.aboard.length) % this.aboard.length;
    this.aim();
    return this.current;
  }

  choose(kind: HeroKind, now = false): void {
    const at = this.aboard.findIndex((a) => a.kind === kind);
    this.chosen = Math.max(0, at);
    this.aim();
    if (now) this.bearing = this.wantBearing;
  }

  /**
   * The camera's bearing for the chosen hero: out over the water on their side, a little aft, so
   * it looks in across the rail and never through the cabin or the gun.
   */
  private aim(): void {
    const a = this.aboard[this.chosen];
    if (!a) return;
    const out = Math.atan2(Math.sign(a.station.z) || 1, -0.3);
    // The shortest way round from where the camera is now.
    let want = out;
    while (want - this.bearing > Math.PI) want -= Math.PI * 2;
    while (want - this.bearing < -Math.PI) want += Math.PI * 2;
    this.wantBearing = want;
    this.greet();
  }

  /** Sets off for the island; `progress` is read back to know when the run in is done. */
  sail(): void {
    this.running = true;
    const captain = this.aboard[this.chosen]?.captain;
    if (captain) {
      // Fists closed, one hand then the other, eyes on the island.
      captain.face?.say("[tactical_focus] Bring her in. [pause:0.3] [look:ahead] Quietly.");
      captain.hands.clasp("R", 1);
      setTimeout(() => captain.hands.clasp("L", 1), 250);
    }
  }

  /** What the player sees a hero called aboard: the Captain stands in the Rifleman's place. */
  nameOf(kind: HeroKind): string | null {
    return this.aboard.find((a) => a.kind === kind)?.captain ? "The Captain" : null;
  }

  /** The Captain answers being picked, and goes back to watching the sea when he isn't. */
  private greet(): void {
    for (const a of this.aboard) {
      const captain = a.captain;
      if (!captain) continue;
      if (a === this.aboard[this.chosen]) {
        captain.face?.say("[confident_smirk] [look:ahead] Ready when you are. [nod]");
        // Hands easy, the fingers loosely curled, the thumbs left out.
        captain.hands.clasp("L", 0.35);
        captain.hands.clasp("R", 0.35);
        captain.hands.set("L", "Thumb", 0.1);
        captain.hands.set("R", "Thumb", 0.1);
      } else {
        captain.face?.express("neutral");
        captain.face?.lookAt("left");
        captain.hands.clasp("L", 0);
        captain.hands.clasp("R", 0);
      }
    }
  }

  get progress(): number {
    return this.run;
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    this.time += dt;
    const { time } = this;
    if (this.running) this.run = Math.min(1, this.run + dt / 5);
    const travelled = ease(this.run);
    this.root.position.lerpVectors(this.start, this.end, travelled);
    // Riding the swell: a slow roll and pitch, heavier once she's under way.
    const way = this.running ? 1.6 : 1;
    this.hull.rotation.x = Math.sin(time * 0.9) * 0.025 * way;
    this.hull.rotation.z = Math.sin(time * 0.63 + 1) * 0.018 * way;
    this.hull.position.y = Math.sin(time * 1.1) * 0.12 + (this.running ? 0.1 * travelled : 0);
    for (const a of this.aboard) {
      // Braced as she moves, at ease at anchor.
      a.animator?.update(dt, {
        ...AT_EASE,
        cheering: this.running && a === this.aboard[this.chosen],
      });
      a.captain?.update(dt);
    }

    // The camera: round the boat to the chosen hero, eased, at their height; under way it swings
    // round behind them to look ahead to the island.
    if (this.overview) {
      const p = this.root.position;
      camera.position.set(p.x, p.y + 30, p.z + 0.01);
      camera.lookAt(p.x, p.y, p.z);
      return;
    }
    this.bearing += (this.wantBearing - this.bearing) * (1 - Math.exp(-dt * 2.6));
    const chosen = this.aboard[this.chosen];
    const target = chosen ? chosen.holder.getWorldPosition(look) : this.root.position;
    const tall = chosen?.tall ?? 2;
    const height = chosen ? tall * 0.72 : 3;
    const pull = this.running ? ease(Math.min(1, this.run * 2.2)) : 0;
    // Worked out in the boat's own space (unrolled), then carried out into the world's.
    // Under way, round to their quarter (the bow is +x), to look ahead to the island past them
    // rather than over the cabin.
    let astern = (Math.sign(chosen?.station.z ?? 1) || 1) * (Math.PI - 0.6);
    while (astern - this.bearing > Math.PI) astern -= Math.PI * 2;
    while (astern - this.bearing < -Math.PI) astern += Math.PI * 2;
    const bearing = this.bearing + (astern - this.bearing) * pull;
    const reach = 1.2 + tall * 1.85 + 9 * pull;
    const station = chosen ? chosen.station : towards.set(0, 0, 0);
    eye.set(
      station.x + Math.cos(bearing) * reach,
      station.y + height + 0.55 + 2.8 * pull,
      station.z + Math.sin(bearing) * reach,
    );
    camera.position.copy(this.root.localToWorld(eye));
    const ahead = 14 * pull;
    camera.lookAt(
      target.x + Math.cos(this.heading) * ahead,
      target.y + height - 0.15 * (1 - pull),
      target.z + Math.sin(this.heading) * ahead,
    );
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
