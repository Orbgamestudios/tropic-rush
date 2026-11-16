// Runs the story (docs/STORY.md): works out which scenes are due, sets them off for the whole
// crew, and plays whatever this phone hasn't shown yet, in the right place: talked over a raid as
// it's fought, as the base falls, or back on the crew's island. The script and its rules are in
// logic/story; this only decides when, and hands the lines to the screen.

import type * as THREE from "three";
import type { HeroKind } from "../logic/heroes";
import {
  allLines,
  type Cue,
  choose,
  crewHeroes,
  due,
  HINTS,
  type Line,
  moodOf,
  type NextStep,
  openChoice,
  pace,
  QUESTIONS,
  type Scene,
  type Speaker,
  type StoryChange,
  type StoryEvent,
  type StoryState,
  scene,
  setOff,
  shamanHome,
} from "../logic/story";
import type { Vec2 } from "../logic/vec";
import { CutsceneStage } from "../render/cutsceneStage";
import { StoryUi } from "../ui/storyUi";

/** Where the game is, as far as the story cares. */
export type StoryPlace = "home" | "raid" | "raidEnd" | "away";

/** Somewhere to stand a cutscene's cast: a spot, and the way the camera looks at it from. */
export interface StorySet {
  center: Vec2;
  front: number;
  ground(x: number, y: number): number;
}

export interface StoryHost {
  story(): StoryState;
  /** Tells the whole crew the story's moved on. */
  tell(change: StoryChange): void;
  seen(): readonly string[];
  markSeen(ids: readonly string[]): void;
  hq(): number;
  place(): StoryPlace;
  set(): StorySet;
  /** Firsts that are true of the crew's island as it stands (a radar built, a statue found). */
  standing(): StoryEvent[];
  /** What the crew could do next, for the Shaman's advice. */
  nextSteps(): ReadonlySet<NextStep>;
  /** Whether the heroes' models have arrived: a cutscene waits for its cast. */
  ready(): boolean;
  /** Fetches the detailed models of the heroes a cutscene's about to show up close. */
  loadCast(cast: readonly Speaker[]): Promise<unknown>;
  /**
   * A cutscene's starting or over: the game's own buttons go, and the picture turns to film.
   * Each scene of one says which it is, for its light.
   */
  filming(on: boolean, scene?: string): void;
  portrait(who: Speaker): Promise<string>;
  camera: THREE.PerspectiveCamera;
}

/** More scenes than this waiting when the game opens, and the Shaman's advice on firsts is let go. */
const CATCH_UP = 3;
/** How often it looks at how things stand, in seconds. */
const LOOK_EVERY = 0.4;
/** A breath between one scene at home and the next, in seconds. */
const BREATH = 2.5;
/** A cutscene shows this many of its speakers at most. */
const MOST_CAST = 7;
/** The longest a cutscene waits for its cast's detailed models before going on with what it has. */
const CAST_WAIT_MS = 6000;

/** Scenes that are said over a raid as it's fought. */
function duringRaid({ when }: Scene): boolean {
  if (when.on === "power") return true;
  if (when.on === "rescue" || when.on === "island") return when.stage === "landing";
  return (
    when.on === "first" &&
    ["raid", "magicAmmo", "frozenHero", "puzzleIsland", "rivalCrew"].includes(when.thing)
  );
}

/** Scenes that play where the raid ended, before its results. */
function atRaidEnd({ when }: Scene): boolean {
  if (when.on === "rescue") return when.stage === "won";
  if (when.on === "island") return when.stage === "won" || when.stage === "lost";
  return when.on === "first" && ["raidWon", "raidLost", "threeStars"].includes(when.thing);
}

function playsAt(s: Scene, place: StoryPlace): boolean {
  return place === "home" || (place === "raid" ? duringRaid(s) : atRaidEnd(s));
}

export class StoryDirector {
  readonly stage = new CutsceneStage();
  private readonly ui: StoryUi;
  private lookIn = 0;
  /** It's had its first look at home since the game opened. */
  private looked = false;
  /** Which of the things the Shaman can be asked comes next. */
  private shamanTurn = 0;
  private hintTurn = 0;
  /** The scene being talked over a raid, if one is. */
  private barking: string | null = null;
  /** A cutscene's cast is on its way. */
  private casting = false;

  constructor(
    layer: HTMLElement,
    private readonly host: StoryHost,
  ) {
    this.ui = new StoryUi(layer, (who) => host.portrait(who));
  }

  /** Whether the story has the screen, and the game should wait for it. */
  get blocking(): boolean {
    return this.ui.blocking || this.casting;
  }

  /** Whether there's a scene still to show where a raid ended, before its results. */
  get owedAtRaidEnd(): boolean {
    const seen = this.host.seen();
    return this.host.story().played.some((id) => {
      const s = scene(id);
      return s !== undefined && !seen.includes(id) && atRaidEnd(s);
    });
  }

  /** Something's happened that may set a scene off, and may move the story on by itself. */
  note(event: StoryEvent, change: Omit<StoryChange, "scenes"> = {}): void {
    const scenes = setOff(this.host.story(), event);
    if (scenes.length > 0 || change.won || change.rescued) this.host.tell({ ...change, scenes });
  }

  /** Call once a frame, after the game's placed its camera. */
  update(dt: number): void {
    this.ui.update(dt);
    this.stage.update(dt, this.host.camera);
    // Nobody's still talking over a raid once it's over: what comes next is waiting.
    if (this.barking && this.host.place() !== "raid") {
      this.host.markSeen([this.barking]);
      this.barking = null;
      this.ui.stop();
    }
    if (this.ui.busy || this.casting) return;
    this.lookIn -= dt;
    if (this.lookIn > 0) return;
    this.lookIn = LOOK_EVERY;
    const place = this.host.place();
    if (place === "away" || !this.host.ready()) return;
    if (place === "home" && this.lookAround()) return;
    const story = this.host.story();
    if (place === "home") {
      if (!this.looked) {
        this.looked = true;
        this.letAdviceGo();
      }
      // A choice that was put to the crew and never answered is put again.
      const asking = openChoice(story);
      if (asking && this.host.seen().includes(asking.id)) {
        this.film(asking, []);
        this.ask(asking, place);
        return;
      }
    }
    const next = this.waiting().find((id) => {
      const s = scene(id);
      return s !== undefined && playsAt(s, place);
    });
    if (next) this.play(next, place);
  }

  /** The scenes set off that this phone hasn't shown, oldest first. */
  private waiting(): string[] {
    const seen = this.host.seen();
    return this.host.story().played.filter((id) => !seen.includes(id));
  }

  /**
   * Someone who's been away comes back to a pile of scenes. The story they're told, every scene of
   * it; the Shaman's advice on things their crew did for the first time without them, they aren't.
   */
  private letAdviceGo(): void {
    const waiting = this.waiting();
    if (waiting.length <= CATCH_UP) return;
    const advice = waiting.filter((id) => {
      const s = scene(id);
      return s !== undefined && s.when.on === "first" && !s.cutscene;
    });
    if (advice.length > 0) this.host.markSeen(advice);
  }

  /**
   * Sets off whatever's due from how things stand at home. True if it did, so the next look sees
   * the story as it is now.
   */
  private lookAround(): boolean {
    const story = this.host.story();
    const standing = this.host.standing().flatMap((event) => setOff(story, event));
    if (!story.played.includes("prologue") && standing.length > 0) {
      // An island from before the story: what it's already done is behind it, not news.
      const known = [...new Set(standing)];
      this.host.markSeen(known);
      this.host.tell({ scenes: known });
      return true;
    }
    const more = [...due(story, this.host.hq()), ...(shamanHome(story) ? standing : [])];
    if (more.length === 0) return false;
    this.host.tell({ scenes: [...new Set(more)] });
    return true;
  }

  private play(id: string, place: StoryPlace): void {
    const s = scene(id);
    if (!s) {
      this.host.markSeen([id]);
      return;
    }
    const here = new Set<HeroKind>(crewHeroes(this.host.story()));
    const cues = pace(s.lines, here, s.cast);
    const film = Boolean(s.cutscene) && place !== "raid";
    const start = () => {
      if (film) this.film(s, cues);
      this.barking = place === "raid" ? id : null;
      this.ui.play(cues, {
        mode: film ? "film" : place === "raid" ? "bark" : "talk",
        onCue: (cue) => this.stage.cue(cue),
        onDone: () => this.played(s, place, film),
      });
    };
    if (!film || this.stage.active) {
      start();
      return;
    }
    // A cutscene comes in close, so its heroes are fetched in full detail first.
    this.casting = true;
    const go = () => {
      if (!this.casting) return;
      this.casting = false;
      start();
    };
    void this.host.loadCast(castOf(cues)).then(go, go);
    setTimeout(go, CAST_WAIT_MS);
  }

  /** A scene's been shown: what comes next, and whether the cutscene carries on into it. */
  private played(s: Scene, place: StoryPlace, film: boolean): void {
    this.barking = null;
    this.host.markSeen([s.id]);
    if (!film) {
      if (place === "home") this.lookIn = BREATH;
      return;
    }
    if (openChoice(this.host.story())?.id === s.id) {
      this.ask(s, place);
      return;
    }
    this.carryOn(s, place);
  }

  /** Runs straight on into the next scene if it's a cutscene that follows this one, or ends. */
  private carryOn(from: Scene, place: StoryPlace): void {
    const next = scene(this.waiting()[0] ?? "");
    const follows =
      next?.cutscene &&
      playsAt(next, place) &&
      (next.when.on === "chosen" || (next.when.on === "after" && next.when.scene === from.id));
    if (next && follows) {
      this.play(next.id, place);
      return;
    }
    this.endFilm();
    if (place === "home") this.lookIn = BREATH;
  }

  /** Stands a cutscene's cast and turns the picture to film, unless one's already running. */
  private film(s: Scene, cues: readonly Cue[]): void {
    // Someone only ever heard over a radio isn't standing there.
    const cast = castOf(cues).filter((who) =>
      cues.some((c) => "line" in c && c.line[0] === who && moodOf(c.line) !== "radio"),
    );
    // A choice asked again with nobody speaking still has the people it concerns standing there.
    if (cast.length === 0) cast.push("rifleman", "shaman");
    const set = this.host.set();
    this.host.filming(true, s.id);
    // A night round the fire, or the storm the Professor brews up.
    const words = s.lines
      .map((b) => ("shot" in b ? b.shot : ""))
      .join(" ")
      .toLowerCase();
    this.stage.setLight(
      /\bfire\b|campfire|embers|flames/.test(words) && !/mountain/.test(words)
        ? "fire"
        : /storm|lightning|thunder/.test(words)
          ? "storm"
          : "day",
    );
    this.stage.begin(cast.slice(0, MOST_CAST), set.center, set.front, set.ground, this.host.camera);
  }

  private endFilm(): void {
    if (this.stage.active) {
      this.stage.end(this.host.camera);
      this.host.filming(false);
    }
    this.ui.endFilm();
  }

  /**
   * The crew's choice at the end of a scene, put to them inside the cutscene, which carries on
   * into what they chose. Whoever answers first answers for the crew.
   */
  private ask(asking: Scene, place: StoryPlace): void {
    const { choice } = asking;
    if (!choice) return;
    this.stage.hold();
    this.ui.ask(
      choice.ask,
      choice.options.map((o) => o.say),
      (pick) => {
        const chosen = choose(this.host.story(), asking.id, pick);
        if (chosen) {
          this.host.tell({ scenes: chosen.scenes, ending: chosen.ending ?? undefined });
        }
        this.carryOn(asking, place);
      },
    );
  }

  private say(lines: readonly Line[]): void {
    const here = new Set<HeroKind>(crewHeroes(this.host.story()));
    this.ui.play(pace(lines, here), { mode: "talk", onDone: () => {} });
  }

  /**
   * The Shaman's been tapped. He's asked the next thing there is to ask him, round and round: what
   * to do next (a nudge towards the most pressing thing, said a new way each time), then each of
   * the things the story's given the crew to ask about so far.
   */
  talkToShaman(): void {
    if (this.blocking || this.ui.busy || !shamanHome(this.host.story())) return;
    const seen = this.host.seen();
    const asks = QUESTIONS.filter((q) => seen.includes(q.after));
    const turn = this.shamanTurn++ % (asks.length + 1);
    const question = asks[turn - 1];
    if (question) {
      this.say([["rifleman", question.ask], ...allLines(question.answer)]);
      return;
    }
    const steps = this.host.nextSteps();
    const hint = HINTS.find((h) => steps.has(h.step)) ?? HINTS.at(-1);
    const saying = hint?.sayings[this.hintTurn++ % hint.sayings.length];
    if (saying) this.say(saying);
  }

  /** Drops whatever's on screen: the game's going somewhere else. */
  stop(): void {
    this.casting = false;
    this.endFilm();
    this.ui.stop();
  }
}

/** Everyone who speaks in a scene, in the order they first do. */
function castOf(cues: readonly Cue[]): Speaker[] {
  const cast: Speaker[] = [];
  for (const cue of cues) {
    if ("line" in cue && !cast.includes(cue.line[0])) cast.push(cue.line[0]);
  }
  return cast;
}
