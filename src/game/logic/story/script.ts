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
  | "clara"
  | "brack";

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
      "An old island elder: deep, slow and warm, always half smiling. Tells everything like a story.",
  },
  terror: {
    name: "Professor Terror",
    voice:
      "An old scientist: precise, cultured and cold, never hurried. Crackly over his loudspeakers.",
  },
  youngTerror: {
    name: "Professor Terror",
    voice: "The same man fifty years younger: a richer, warmer voice, but every bit as cold.",
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
  brack: {
    name: "Captain Brack",
    voice:
      "A raider captain: gravelly, loud and greedy, laughs at his own jokes. Always over a radio.",
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
  /** Heard over a radio or a loudspeaker. */
  | "radio";

/** One line: who says it, what they say, and how. */
export type Line = readonly [Speaker, string] | readonly [Speaker, string, Mood];

/**
 * Lines that only make sense together, such as a question and its answer: all of them are left
 * out unless the crew has every hero speaking in them.
 */
export interface Together {
  together: readonly Line[];
}

export type Beat = Line | Together;

export function together(...lines: Line[]): Together {
  return { together: lines };
}

export type TimePower = "rewind" | "fastForward" | "pause" | "record" | "slow" | "retry";

/** How the story ends, which the crew chooses at the finale. */
export type Ending = "revived" | "rested";

/**
 * The islands the story puts on the map, in order, and the headquarters level each turns up at: a
 * first pass. Captain Brack's turn up only if the crew brings Terror back, straight away for a crew
 * that's past their level by then.
 */
export const STORY_ISLANDS = [
  { id: "terror1", hq: 6 },
  { id: "terror2", hq: 9 },
  { id: "creation", hq: 12 },
  { id: "terror3", hq: 15 },
  { id: "terror4", hq: 18 },
  { id: "chaos", hq: 21 },
  { id: "terror5", hq: 24 },
  { id: "terror6", hq: 27 },
  { id: "time", hq: 30 },
  { id: "eternal", hq: 33 },
  { id: "brack1", hq: 35, only: "revived" },
  { id: "brack2", hq: 38, only: "revived" },
  { id: "brack3", hq: 41, only: "revived" },
  { id: "brackFort", hq: 45, only: "revived" },
] as const satisfies readonly { id: string; hq: number; only?: Ending }[];

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
  /** The crew chooses at the end, and the scene for what they chose plays next. */
  choice?: { ask: string; options: readonly { say: string; next: string; ending?: Ending }[] };
}

/** Something to ask the Shaman about, once a scene has told the crew of it. */
export interface Question {
  id: string;
  ask: string;
  after: string;
  answer: readonly Beat[];
}

/**
 * A few words between the Shaman and a hero as he wanders the island: any time after a scene, once
 * the crew has every hero in it, and only after one ending if it says so.
 */
export interface Chatter {
  id: string;
  after: string;
  only?: Ending;
  lines: readonly Beat[];
}

/** Every line, in order, whoever's there to hear it. */
export function allLines(beats: readonly Beat[]): Line[] {
  return beats.flatMap((beat) => ("together" in beat ? beat.together : [beat]));
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
  const here = ([who]: Line) =>
    !isHero(who) || who === "rifleman" || rescued.has(who) || cast.includes(who);
  return beats.flatMap((beat) => {
    if ("together" in beat) return beat.together.every(here) ? beat.together : [];
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
  brack: true,
};
