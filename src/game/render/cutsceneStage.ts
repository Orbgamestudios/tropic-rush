// A cutscene's cast and camera (docs/STORY.md, Cutscenes). Whoever's in the scene stands together
// wherever the game is, in their detailed models, and acts: they turn and look at whoever's
// speaking, hold themselves the way the line's mood says, and talk with their heads and hands.
// The camera is cut like a film's: over a shoulder onto whoever's speaking, across two people
// talking, onto a listener for a voice on the radio, and for a shot with no line, out over the
// sea, up at the cast against the sky, round them, or wide to set the place. Each shot has its
// own lens, a slow move, and a focus the picture is pulled to. Nothing's described in words: a
// shot the script only tells about is the camera's to make something of.

import * as THREE from "three";
import type { HeroKind } from "../logic/heroes";
import { type Cue, isHero, type Mood, moodOf, type Speaker } from "../logic/story";
import { angleDiff, type Vec2 } from "../logic/vec";
import { type Captain, castCaptain, MOOD_FACE } from "./captain";
import { type Acting, AT_EASE, HeroAnimator } from "./heroAnimator";
import { type HeroModel, heroModel, type StoryFigure, storyFigure } from "./heroModels";
import { mouthAt } from "./lipSync";

/** The light a scene's played in, beyond the hour of the day. */
export type SceneLight = "day" | "fire" | "storm";

/**
 * Lights on the set, the way a film crew lights faces: a key light off to one side of the camera
 * so a face has shape, a rim light behind the actor to lift them off the background, and for a
 * night by the fire, the fire itself, flickering. They move with every cut. Brightness here is
 * against the sun's, at the distance each one sits from a face.
 */
const KEY_POWER = 7;
const RIM_POWER = 11;
const FIRE_POWER = 34;

interface Actor {
  who: Speaker;
  model: HeroModel;
  animator: HeroAnimator | null;
  /** The Captain, playing Steele's part, with a face that speaks and shows the mood. */
  captain: Captain | null;
  pos: Vec2;
  facing: number;
  /** Who they're looking at, or the middle of the group. */
  looking: Vec2;
  act: Acting;
  /** What they're saying, and when they started, for their mouth. */
  line: { text: string; at: number; seconds: number } | null;
}

/** What the picture's sharpest on, and anything else that wants a say in the lens. */
export interface Lens {
  focus: number;
  fade: number;
}

/** How high a figure's eyes are, about: the camera sits there and looks there. */
const EYES = 1.85;
/** The camera never goes nearer the ground than this, on a slope or a dune. */
const CLEAR = 0.35;
/** Lenses, as fields of view: a portrait lens for faces, a normal one, and a wide one for places. */
const PORTRAIT = 22;
const NORMAL = 31;
const WIDE = 44;
/** Moods the camera can't hold still for. */
const TENSE: readonly Mood[] = ["angry", "scared", "shout", "surprised"];

type Vista = "sea" | "sky" | "low" | "round" | "wide" | "face";

/** What a shot the script only describes is about, from its words. */
function vistaFor(words: string, turn: number): Vista {
  const has = (...any: string[]) => any.some((w) => words.includes(w));
  const text = words.toLowerCase();
  const says = (...any: string[]) => any.some((w) => text.includes(w));
  if (has("Wide") || says("wide:", "pull back", "from above", "the whole")) return "wide";
  if (says("sky", "sun ", "sunrise", "sunset", "dawn", "stars", "storm", "cloud", "light pours")) {
    return "sky";
  }
  if (
    says("sea", "water", "boat", "ship", "reef", "horizon", "flag", "across the", "sails", "wave")
  ) {
    return "sea";
  }
  if (says("looks", "eyes", "face", "smile", "turns", "kneel", "hand", "whisper", "close")) {
    return "face";
  }
  return (["round", "low", "wide"] as const)[turn % 3] ?? "wide";
}

function modelFor(who: Speaker): HeroModel {
  if (isHero(who)) {
    const model = heroModel(who as HeroKind, true);
    if (who === "tank") model.root.scale.setScalar(0.6);
    return model;
  }
  return storyFigure(who as StoryFigure, true);
}

export class CutsceneStage {
  readonly root = new THREE.Group();
  /** The middle of the cast, for whoever aims the shadows. */
  readonly middle = new THREE.Vector3();
  /** The lens the picture's going through, if it is. */
  lens: Lens | null = null;
  private readonly actors = new Map<Speaker, Actor>();
  private center: Vec2 = { x: 0, y: 0 };
  private ground: (x: number, y: number) => number = () => 0;
  /** The way the wide shot looks from: the group opens towards it. */
  private front = 0;
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly drift = new THREE.Vector3();
  private readonly lookDrift = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private fov = WIDE;
  private savedFov = 0;
  private sinceCut = 0;
  private cuts = 0;
  private shots = 0;
  private time = 0;
  /** How much the camera's hand shakes: more when tempers are up. */
  private handheld = 0.25;
  private last: Speaker | null = null;
  active = false;
  private readonly key = new THREE.PointLight(0xfff0dc, 0, 9, 2);
  private readonly rim = new THREE.PointLight(0xdce8ff, 0, 10, 2);
  private readonly fire = new THREE.PointLight(0xff9440, 0, 16, 2);
  private readonly keyAt = new THREE.Vector3();
  private readonly rimAt = new THREE.Vector3();
  private keyWant = 0;
  private rimWant = 0;
  private light: SceneLight = "day";
  /** Seconds to the next flash of lightning, in a storm, and how bright the last one still is. */
  private nextFlash = 2;
  private flash = 0;
  /** The Captain, once he's loaded; null until then or if he can't be had, and Steele stands in. */
  private captain: Captain | null = null;

  /** Fetches the Captain for Steele's part (docs/CHARACTERS.md, The way now). */
  loadCaptain(): Promise<void> {
    return castCaptain().then((captain) => {
      this.captain = captain;
    });
  }

  constructor() {
    for (const lamp of [this.key, this.rim, this.fire]) {
      lamp.castShadow = false;
      lamp.visible = false;
      this.root.add(lamp);
    }
  }

  /** The light the scene's in: the fire in the middle of them, or a storm's lightning. */
  setLight(light: SceneLight): void {
    this.light = light;
    this.fire.visible = light === "fire" && this.active;
  }

  /**
   * Stands the cast together at a place, open towards where the camera sits for wide shots.
   * \`ground\` is how high the land is there. A new scene on a stage that's already up keeps anyone
   * who's in both where they were.
   */
  begin(
    cast: readonly Speaker[],
    center: Vec2,
    front: number,
    ground: (x: number, y: number) => number,
    camera: THREE.PerspectiveCamera,
  ): void {
    const fresh = !this.active;
    if (fresh) this.savedFov = camera.fov;
    this.active = true;
    this.center = center;
    this.front = front;
    this.ground = ground;
    this.last = null;
    this.middle.set(center.x, ground(center.x, center.y), center.y);
    for (const [who, actor] of this.actors) {
      if (cast.includes(who)) continue;
      this.root.remove(actor.model.root);
      this.actors.delete(who);
    }
    // A loose arc, deeper in the middle, with nobody's back to the wide shot and nobody lined up.
    const radius = 1.25 + cast.length * 0.42;
    cast.forEach((who, i) => {
      const spread = cast.length === 1 ? 0 : (i / (cast.length - 1) - 0.5) * Math.PI * 1.05;
      const angle = front + Math.PI + spread;
      const out = radius * (1 + ((i * 7) % 3) * 0.07);
      const pos = { x: center.x + Math.cos(angle) * out, y: center.y + Math.sin(angle) * out };
      const standing = this.actors.get(who);
      if (standing) {
        standing.pos = pos;
        return;
      }
      // The Captain plays Steele's part until the scripts are gone over.
      const captain = who === "rifleman" ? this.captain : null;
      const model: HeroModel = captain
        ? { root: captain.holder, body: captain.holder, legs: null, rig: null, height: 1.8 }
        : modelFor(who);
      model.root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true;
      });
      this.root.add(model.root);
      captain?.face?.express("neutral");
      this.actors.set(who, {
        who,
        model,
        captain,
        animator: model.rig && new HeroAnimator(model.rig),
        pos,
        facing: angle + Math.PI,
        looking: center,
        act: { talking: false, mood: null, lookYaw: 0, lookPitch: 0, mouth: 0 },
        line: null,
      });
    });
    this.vista("wide");
    this.place(camera);
    if (fresh && this.lens) this.lens.fade = 0;
    this.key.visible = true;
    this.rim.visible = true;
    this.fire.visible = this.light === "fire";
    this.fire.position.set(center.x, ground(center.x, center.y) + 0.55, center.y);
  }

  /** The camera's cut for a shot or a line, and everyone turning to whoever's talking. */
  cue(cue: Cue): void {
    if (!this.active) return;
    this.sinceCut = 0;
    this.cuts++;
    for (const actor of this.actors.values()) {
      actor.act.talking = false;
      actor.line = null;
    }
    if ("shot" in cue) {
      this.handheld = 0.2;
      this.vista(vistaFor(cue.shot.shot, this.shots++));
      this.lightPlace(null);
      return;
    }
    const mood = moodOf(cue.line) ?? null;
    this.handheld = mood && TENSE.includes(mood) ? 1 : 0.3;
    const speaker = this.actors.get(cue.line[0]);
    if (!speaker) {
      // A voice from somewhere else (a radio, a locked room): the camera's on whoever's hearing it.
      const listener = (this.last && this.actors.get(this.last)) || [...this.actors.values()][0];
      if (listener) this.closeOn(listener, this.center, true);
      else this.vista("sea");
      this.lightPlace(listener ?? null, mood);
      return;
    }
    const listener = this.last && this.last !== speaker.who ? this.actors.get(this.last) : null;
    for (const actor of this.actors.values()) {
      actor.looking = actor === speaker ? (listener?.pos ?? this.center) : speaker.pos;
    }
    speaker.act.talking = true;
    speaker.act.mood = mood;
    speaker.line = { text: cue.line[1], at: this.time, seconds: cue.seconds };
    // The Captain's own face says it, his look set by the mood, at a pace to fill the line's time.
    const face = speaker.captain?.face;
    if (face) {
      const words = cue.line[1];
      face.express((mood && MOOD_FACE[mood]) ?? "neutral");
      const natural = face.say(words);
      if (natural > 0 && cue.seconds > 0 && natural > cue.seconds)
        face.say(words, natural / cue.seconds);
    }
    this.last = speaker.who;
    // Mostly over the shoulder onto the speaker; now and then, across the two of them.
    if (listener && this.cuts % 4 === 3) this.across(speaker, listener);
    else this.closeOn(speaker, listener?.pos ?? this.center, mood === "whisper" || mood === "sad");
    this.lightPlace(speaker, mood);
  }

  /**
   * Places the lights for a cut. On a face: the key between the camera and the side the light's
   * coming from, a little above the eyes, and the rim behind them on the far side. A sad or quiet
   * line gets less key, so the shadow side of the face goes deeper; a shout or anger gets a harder
   * rim. On a shot of the place, the key goes and the rim stays, faint.
   */
  private lightPlace(actor: Actor | null, mood: Mood | null = null): void {
    if (!actor) {
      this.keyWant = 0;
      this.rimWant = RIM_POWER * 0.35;
      this.rimAt.set(this.center.x, this.heightAt(this.center) + 3, this.center.y);
      return;
    }
    const y = this.heightAt(actor.pos) + EYES;
    const cx = this.from.x - actor.pos.x;
    const cz = this.from.z - actor.pos.y;
    const gap = Math.hypot(cx, cz) || 1;
    // The key comes from the side the camera's already on, so the near cheek is lit and the far
    // one falls into shadow: that's what gives a face its shape.
    const side = this.cuts % 2 === 0 ? 1 : -1;
    const around = Math.atan2(cz, cx) + side * 0.75;
    this.keyAt.set(
      actor.pos.x + Math.cos(around) * 2.3,
      y + 0.55,
      actor.pos.y + Math.sin(around) * 2.3,
    );
    this.rimAt.set(
      actor.pos.x - (cx / gap) * 2 - side * (cz / gap) * 0.9,
      y + 0.7,
      actor.pos.y - (cz / gap) * 2 + side * (cx / gap) * 0.9,
    );
    const quiet = mood === "sad" || mood === "whisper";
    const hard = mood === "angry" || mood === "shout" || mood === "scared";
    this.keyWant = KEY_POWER * (quiet ? 0.45 : hard ? 0.85 : 1);
    this.rimWant = RIM_POWER * (hard ? 1.35 : quiet ? 0.7 : 1);
  }

  /** Holds on the whole cast while something's decided: a slow move round them, nobody speaking. */
  hold(): void {
    if (!this.active) return;
    for (const actor of this.actors.values()) actor.act.talking = false;
    this.sinceCut = 0;
    this.cuts++;
    this.handheld = 0.2;
    this.vista("round");
  }

  private heightAt(p: Vec2): number {
    return this.ground(p.x, p.y);
  }

  /** A shot of the place, with the cast in it somewhere. */
  private vista(kind: Vista): void {
    const { center, front } = this;
    const y = this.heightAt(center);
    const out = { x: Math.cos(front), y: Math.sin(front) };
    const side = { x: -out.y, y: out.x };
    const turn = this.cuts % 2 === 0 ? 1 : -1;
    const back = 5.5 + this.actors.size * 0.7;
    this.lookDrift.set(0, 0, 0);
    if (kind === "face") {
      const actor = (this.last && this.actors.get(this.last)) || [...this.actors.values()][0];
      if (actor) {
        this.closeOn(actor, center, true);
        return;
      }
    }
    if (kind === "sea") {
      // From behind the cast, past their shoulders, out over the water.
      this.from.set(
        center.x - out.x * back + side.x * turn,
        y + 2.5,
        center.y - out.y * back + side.y * turn,
      );
      this.to.set(center.x + out.x * 40, y + 1.2, center.y + out.y * 40);
      this.drift.set(side.x * 0.16 * turn, 0.03, side.y * 0.16 * turn);
      this.fov = NORMAL;
      this.focus(back + 14);
    } else if (kind === "sky") {
      // Low, in front of them, tilting up past their heads to the clouds.
      this.from.set(center.x + out.x * 3.4, y + 0.7, center.y + out.y * 3.4);
      this.to.set(center.x - out.x * 2, y + 3.4, center.y - out.y * 2);
      this.drift.set(0, 0, 0);
      this.lookDrift.set(0, 0.22, 0);
      this.fov = WIDE;
      this.focus(4);
    } else if (kind === "low") {
      // Down in the sand, looking up at the cast against the sky.
      this.from.set(
        center.x + out.x * 4.6 + side.x * 1.6 * turn,
        y + 0.55,
        center.y + out.y * 4.6 + side.y * 1.6 * turn,
      );
      this.to.set(center.x, y + 1.7, center.y);
      this.drift.set(-side.x * 0.12 * turn, 0.02, -side.y * 0.12 * turn);
      this.fov = NORMAL;
      this.focus(5);
    } else if (kind === "round") {
      // A slow arc round the side of them.
      this.from.set(
        center.x + out.x * 4.2 + side.x * 4.4 * turn,
        y + 2.1,
        center.y + out.y * 4.2 + side.y * 4.4 * turn,
      );
      this.to.set(center.x, y + 1.45, center.y);
      this.drift.set(
        -side.x * 0.32 * turn + out.x * 0.08,
        0.02,
        -side.y * 0.32 * turn + out.y * 0.08,
      );
      this.fov = NORMAL;
      this.focus(6.2);
    } else {
      // High and wide from the front, craning slowly down and across.
      this.from.set(center.x + out.x * (back + 2.5), y + 4.2, center.y + out.y * (back + 2.5));
      this.to.set(center.x, y + 1.2, center.y);
      this.drift.set(side.x * 0.2 * turn, -0.09, side.y * 0.2 * turn);
      this.fov = WIDE;
      this.focus(back + 3);
    }
  }

  /**
   * Over the shoulder of whoever they're talking to, onto their face, pushing slowly in. \`tight\`
   * comes in closer, on a longer lens, for a line that's quiet or lands hard.
   */
  private closeOn(speaker: Actor, towards: Vec2, tight = false): void {
    const dx = towards.x - speaker.pos.x;
    const dy = towards.y - speaker.pos.y;
    const gap = Math.hypot(dx, dy) || 1;
    const side = this.cuts % 2 === 0 ? 0.95 : -0.95;
    const out = tight ? 3.6 : 3.1;
    const y = this.heightAt(speaker.pos);
    this.from.set(
      speaker.pos.x + (dx / gap) * out - (dy / gap) * side,
      y + EYES + (tight ? 0.02 : 0.12),
      speaker.pos.y + (dy / gap) * out + (dx / gap) * side,
    );
    this.to.set(speaker.pos.x, y + EYES - 0.1, speaker.pos.y);
    this.drift.set((-dx / gap) * 0.09, 0, (-dy / gap) * 0.09);
    this.lookDrift.set(0, 0, 0);
    this.fov = tight ? PORTRAIT : NORMAL - 4;
    this.focus(Math.hypot(out, side));
  }

  /** Side on to two people talking, both in the frame. */
  private across(a: Actor, b: Actor): void {
    const mx = (a.pos.x + b.pos.x) / 2;
    const my = (a.pos.y + b.pos.y) / 2;
    const dx = b.pos.x - a.pos.x;
    const dy = b.pos.y - a.pos.y;
    const gap = Math.hypot(dx, dy) || 1;
    // From whichever side is nearer the front, so the place is behind them and not the camera.
    const nx = -dy / gap;
    const ny = dx / gap;
    const facing = nx * Math.cos(this.front) + ny * Math.sin(this.front) >= 0 ? 1 : -1;
    const out = 2.6 + gap * 0.75;
    const y = this.ground(mx, my);
    this.from.set(mx + nx * out * facing, y + EYES - 0.25, my + ny * out * facing);
    this.to.set(mx, y + EYES - 0.3, my);
    this.drift.set((dx / gap) * 0.1, 0, (dy / gap) * 0.1);
    this.lookDrift.set(0, 0, 0);
    this.fov = NORMAL;
    this.focus(out);
  }

  private focus(distance: number): void {
    if (this.lens) this.lens.focus = distance;
  }

  private place(camera: THREE.PerspectiveCamera): void {
    const t = this.sinceCut;
    // A shot starts where it starts and drifts: slower as it goes, so a long hold doesn't wander off.
    const moved = (1 - Math.exp(-t * 0.35)) / 0.35;
    camera.position.copy(this.from).addScaledVector(this.drift, moved);
    // A hand's holding it: it breathes, more when the scene's tense.
    const sway = this.handheld * 0.012;
    camera.position.x += Math.sin(this.time * 1.3) * sway;
    camera.position.y += Math.sin(this.time * 1.9 + 1) * sway * 0.8;
    const floor = this.ground(camera.position.x, camera.position.z) + CLEAR;
    if (camera.position.y < floor) camera.position.y = floor;
    this.at.copy(this.to).addScaledVector(this.lookDrift, moved);
    this.at.x += Math.sin(this.time * 0.9 + 2) * sway;
    this.at.y += Math.sin(this.time * 1.5) * sway;
    if (camera.fov !== this.fov) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(this.at);
  }

  /** Moves the cast and the camera. Call it after anything else that places the camera. */
  update(dt: number, camera: THREE.PerspectiveCamera): void {
    if (!this.active) return;
    this.sinceCut += dt;
    this.time += dt;
    if (this.lens) this.lens.fade = Math.min(1, this.lens.fade + dt * 1.1);
    this.lightUpdate(dt);
    for (const actor of this.actors.values()) {
      // Their mouth keeps pace with the words they're saying.
      const { line } = actor;
      actor.act.mouth = line ? mouthAt(line.text, this.time - line.at, line.seconds).open : 0;
      const want = Math.atan2(actor.looking.y - actor.pos.y, actor.looking.x - actor.pos.x);
      const off = angleDiff(want, actor.facing);
      // The head goes first; the feet only shuffle round when it's a long way to look.
      const turn = Math.abs(off) > 0.5 ? off - Math.sign(off) * 0.35 : 0;
      actor.facing += turn * Math.min(1, dt * 2.2);
      actor.act.lookYaw = angleDiff(want, actor.facing);
      const { root } = actor.model;
      root.position.set(actor.pos.x, this.heightAt(actor.pos), actor.pos.y);
      root.rotation.y = -actor.facing;
      actor.animator?.update(dt, { ...AT_EASE, act: actor.act });
      actor.captain?.update(dt);
    }
    this.place(camera);
  }

  /** The lights jump with a cut, as on a real set, then breathe; a fire flickers, a storm flashes. */
  private lightUpdate(dt: number): void {
    const t = this.time;
    if (this.sinceCut < 0.05) {
      this.key.position.copy(this.keyAt);
      this.rim.position.copy(this.rimAt);
    }
    const settle = 1 - Math.exp(-dt * 10);
    this.key.intensity += (this.keyWant - this.key.intensity) * settle;
    this.rim.intensity += (this.rimWant - this.rim.intensity) * settle;
    // Light off a face moves a little as the sun goes in and out behind a cloud.
    this.key.position.y = this.keyAt.y + Math.sin(t * 0.4) * 0.08;
    if (this.light === "fire") {
      const flicker =
        0.72 +
        0.16 * Math.sin(t * 13.1) +
        0.09 * Math.sin(t * 23.7 + 1) +
        0.06 * Math.sin(t * 41.3);
      this.fire.intensity = FIRE_POWER * flicker;
      this.fire.position.y =
        this.fire.position.y * 0.9 + (this.heightAt(this.center) + 0.5 + flicker * 0.15) * 0.1;
      // By firelight the key is the fire's color.
      this.key.color.setRGB(1, 0.72, 0.45);
    } else {
      this.key.color.setRGB(1, 0.94, 0.86);
    }
    if (this.light === "storm") {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.flash = 1;
        this.nextFlash = 2.5 + Math.random() * 5;
      }
      this.flash = Math.max(0, this.flash - dt * (this.flash > 0.6 ? 9 : 3));
      this.rim.intensity += RIM_POWER * 5 * this.flash * (0.6 + 0.4 * Math.sin(t * 60));
      this.rim.color.setRGB(0.8, 0.86, 1);
    }
  }

  end(camera: THREE.PerspectiveCamera): void {
    if (!this.active) return;
    this.active = false;
    for (const lamp of [this.key, this.rim, this.fire]) {
      lamp.visible = false;
      lamp.intensity = 0;
    }
    for (const actor of this.actors.values()) this.root.remove(actor.model.root);
    this.actors.clear();
    camera.fov = this.savedFov;
    camera.updateProjectionMatrix();
    if (this.lens) this.lens.fade = 1;
  }
}
