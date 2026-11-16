// The story's script: every scene of dialogue in the game, who says what, and what sets each one
// off. Every line is voiced (docs/STORY.md, Voices), so each has a key its recording is filed
// under. Nothing plays any of it yet. No engine imports.

import type { HeroKind } from "../heroes";

export type Speaker =
  | HeroKind
  | "shaman"
  | "terror"
  /** Professor Terror once the time crystal has made him young again. */
  | "youngTerror"
  /** The same man, brought back at the end, if the crew chooses to. */
  | "theo"
  | "clara";

export interface SpeakerInfo {
  /** As the dialogue box shows it. */
  name: string;
  /** For whoever voices them. */
  voice: string;
}

export const SPEAKERS: Record<Speaker, SpeakerInfo> = {
  rifleman: {
    name: "Sgt. Steele",
    voice:
      "A steady sergeant: low, dry, unhurried. Short sentences, a joke buried in most of them.",
  },
  medic: {
    name: "Doc Penny",
    voice:
      "A young doctor: quick, bright and bossy, warm underneath. Teases everyone she patches up.",
  },
  tank: {
    name: "Tilly",
    voice:
      "A young tank driver: loud, fearless, always grinning. Talks to her tank like a big dog.",
  },
  heavy: {
    name: "Big Mo",
    voice:
      "A gentle giant: deep, slow and kind, laughs from his belly. Fierce only when his crew's hurt.",
  },
  bazooka: {
    name: "Ace",
    voice:
      "A pilot: fast, cocky and cool, a bit of a show-off. Drawls when she's bored, which is often.",
  },
  grenadier: {
    name: "Mr. Pemberton",
    voice:
      "An English gentleman: polite, precise, unflappable, quietly very funny. Never raises his voice.",
  },
  engineer: {
    name: "Gus",
    voice:
      "A tinkerer: excitable, rambling, half his sentences trailing off into ideas. Kind and a bit guilty.",
  },
  shaman: {
    name: "The Shaman",
    voice:
      "An old island elder: warm, slow and gravelly, always half smiling. Tells everything like a story.",
  },
  terror: {
    name: "Professor Terror",
    voice:
      "An old scientist with a crisp, posh South Dublin accent, theatrical and mercurial: a mocking sing-song one moment, flat and deadly quiet the next. Crackly over the radio.",
  },
  youngTerror: {
    name: "Professor Terror",
    voice:
      "The same man fifty years younger, the same strong Dublin bite: hyper-articulate, sneering, leaping from giggling glee to a smooth, quiet, lethal whisper. A natural male pitch, never shrill.",
  },
  theo: {
    name: "Theo",
    voice:
      "Professor Terror brought back young, without the crystals: gentle, unsure, heavy with guilt.",
  },
  clara: {
    name: "Clara",
    voice:
      "A young botanist from fifty years ago: bright, curious and kind, a little old-fashioned.",
  },
};

/** How a line's said: the portrait's face and the voice's delivery. Plain if it isn't given. */
export type Mood =
  | "happy"
  | "laugh"
  | "sad"
  | "angry"
  | "scared"
  | "surprised"
  | "shout"
  | "whisper"
  /** Heard over a radio. */
  | "radio";

/**
 * How a line's delivered, beyond its mood. `how` is for whoever voices it: the feeling, the pace,
 * the pitch and loudness, which word takes the stress, where the breaths and catches go. `before`
 * and `after` are seconds a cutscene holds in silence before and after it, on top of its usual
 * pacing (see delivery.ts).
 */
export interface Delivery {
  mood?: Mood;
  how?: string;
  before?: number;
  after?: number;
}

/** One line: who says it, what they say, and how. */
export type Line = readonly [Speaker, string] | readonly [Speaker, string, Mood | Delivery];

export function moodOf(line: Line): Mood | undefined {
  const how = line[2];
  return typeof how === "object" ? how.mood : how;
}

export function deliveryOf(line: Line): Delivery {
  const how = line[2];
  return typeof how === "object" ? how : { mood: how };
}

/**
 * In a cutscene: what the camera shows and what happens, held for this many seconds, and what the
 * music or sound does from there, if it changes.
 */
export interface Shot {
  shot: string;
  seconds: number;
  sound?: string;
}

export function shot(what: string, seconds: number, sound?: string): Shot {
  return sound ? { shot: what, seconds, sound } : { shot: what, seconds };
}

/**
 * Lines that only make sense together, such as a question and its answer: all of them are left
 * out unless the crew has every hero speaking in them.
 */
export interface Together {
  together: readonly Line[];
}

export type Beat = Line | Together | Shot;

export function together(...lines: Line[]): Together {
  return { together: lines };
}

export type TimePower = "rewind" | "fastForward" | "pause" | "record" | "slow" | "retry";

/** How the story ends, which the crew chooses at the finale. */
export type Ending = "revived" | "rested";

/** Who the ending lets the crew play: Theo if they bring him back, the Shaman if they don't. */
export type StoryHero = "theo" | "shaman";

/**
 * The islands the story puts on the map, in order, and the headquarters level each turns up at: a
 * first pass, stretched so the story runs to headquarters 42 (the owner's call, 2026-11-08). Each
 * turns up once the one before it is won and the headquarters is at its level.
 */
export const STORY_ISLANDS = [
  { id: "terror1", hq: 6 },
  { id: "terror2", hq: 10 },
  { id: "creation", hq: 14 },
  { id: "terror3", hq: 18 },
  { id: "terror4", hq: 22 },
  { id: "chaos", hq: 26 },
  { id: "terror5", hq: 30 },
  { id: "terror6", hq: 34 },
  { id: "time", hq: 38 },
  { id: "eternal", hq: 42 },
] as const satisfies readonly { id: string; hq: number }[];

export type StoryIsland = (typeof STORY_ISLANDS)[number]["id"];

/** Firsts the story has something to say about. */
export const FIRSTS = [
  "raid",
  "raidWon",
  "crystal",
  "radar",
  "fullCrew",
  "blueprint",
  "laboratory",
  "gunboatWeapon",
  "heroUpgrade",
  "chest",
  "beachFind",
  "raiderShip",
  "nightRaidHeld",
  "nightRaidLost",
  "islandRetaken",
  "raidLost",
  "threeStars",
  "puzzleIsland",
  "rivalCrew",
  "pickaxe",
  "chainsaw",
  "dynamite",
  "statueNature",
  "statueIce",
  "statueFire",
  "statueDark",
  "statueRestored",
  "allStatues",
  "magicAmmo",
  "frozenHero",
] as const;

export type First = (typeof FIRSTS)[number];

/** What sets a scene off. Each scene plays once, for the whole crew. */
export type Trigger =
  /** The first time the crew opens the game. */
  | { on: "start" }
  /** Straight after another scene. */
  | { on: "after"; scene: string }
  /** Only when the crew chooses it, at the end of another scene. */
  | { on: "chosen" }
  | { on: "hq"; level: number }
  | { on: "first"; thing: First }
  /** The radar picks up a hero's signal, the crew lands there, wins, and brings them home. */
  | { on: "rescue"; hero: HeroKind; stage: "signal" | "landing" | "won" | "home" }
  | { on: "island"; island: StoryIsland; stage: "appears" | "landing" | "won" | "lost" }
  /** The ruined Hourglass in the forest, where crystals are broken into time shards. */
  | { on: "hourglass"; stage: "found" | "repaired" | "firstShards" }
  /** The first time anyone in the crew uses a time power. */
  | { on: "power"; power: TimePower };

export interface Scene {
  id: string;
  when: Trigger;
  /** Waits, once it's set off, until this other scene has played. */
  needs?: string;
  /** Only after this ending. */
  only?: Ending;
  /**
   * Heroes who speak in it even before the crew has rescued them. Lines from any other hero the
   * crew hasn't got yet are left out, so every scene reads right without them.
   */
  cast?: readonly HeroKind[];
  /** Played as a cutscene in the engine rather than in dialogue boxes over the game. */
  cutscene?: true;
  lines: readonly Beat[];
  /** Joins the crew as a hero to play once it's played. */
  joins?: StoryHero;
  /** Leaves the crew's island once it's played. */
  leaves?: "shaman";
  /** The crew chooses at the end, and the scene for what they chose plays next. */
  choice?: { ask: string; options: readonly { say: string; next: string; ending?: Ending }[] };
}

/**
 * Something to ask the Shaman about, once a scene has told the crew of it, for as long as he's on
 * the crew's island.
 */
export interface Question {
  id: string;
  ask: string;
  after: string;
  answer: readonly Beat[];
}

/** Every line, in order, whoever's there to hear it. */
export function allLines(beats: readonly Beat[]): Line[] {
  return beats.flatMap((beat) => {
    if ("shot" in beat) return [];
    return "together" in beat ? beat.together : [beat];
  });
}

/**
 * What the line at this place in `allLines` has its recording filed under. Recorded from the
 * finished script, so a line added in the middle of a scene later needs the rest re-filed.
 */
export function voiceKey(id: string, index: number): string {
  return `${id}/${index + 1}`;
}

/**
 * The lines the crew hears, leaving out heroes they haven't rescued yet. Sergeant Steele is there
 * from the start, and a scene's cast is there for it.
 */
export function linesFor(
  beats: readonly Beat[],
  rescued: ReadonlySet<HeroKind>,
  cast: readonly HeroKind[] = [],
): Line[] {
  return heard(beats, rescued, cast).flatMap((beat) => ("shot" in beat ? [] : [beat]));
}

/** The lines the crew hears, as `linesFor`, with a cutscene's shots kept in their places. */
export function heard(
  beats: readonly Beat[],
  rescued: ReadonlySet<HeroKind>,
  cast: readonly HeroKind[] = [],
): (Line | Shot)[] {
  const here = ([who]: Line) =>
    !isHero(who) || who === "rifleman" || rescued.has(who) || cast.includes(who);
  return beats.flatMap((beat): (Line | Shot)[] => {
    if ("shot" in beat) return [beat];
    if ("together" in beat) return beat.together.every(here) ? [...beat.together] : [];
    return here(beat) ? [beat] : [];
  });
}

export function isHero(who: Speaker): who is HeroKind {
  return !(who in NON_HEROES);
}

const NON_HEROES: Record<Exclude<Speaker, HeroKind>, true> = {
  shaman: true,
  terror: true,
  youngTerror: true,
  theo: true,
  clara: true,
};
