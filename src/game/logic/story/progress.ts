// Where a crew is in the story: which scenes have been set off, which of the story's islands are
// won, who's been rescued and how it ended. The whole crew shares it (it lives on their island),
// and each phone keeps its own note of what it's shown. No engine imports.

import { HERO_KINDS, type HeroKind, STARTER_HEROES } from "../heroes";
import { createRng } from "../rng";
import { FINALE } from "./finale";
import { OPENING } from "./opening";
import { RESCUES } from "./rescues";
import {
  type Ending,
  type Scene,
  STORY_ISLANDS,
  type StoryHero,
  type StoryIsland,
  type Trigger,
} from "./script";
import { TERROR } from "./terror";

const SCENES: readonly Scene[] = [...OPENING, ...RESCUES, ...TERROR, ...FINALE];
const BY_ID = new Map(SCENES.map((s) => [s.id, s]));

export interface StoryState {
  /** Scenes set off so far, in the order they were. */
  played: string[];
  ending: Ending | null;
  /** The story's islands the crew has won, in order. */
  won: StoryIsland[];
  /** Heroes the crew has brought home, or had already when the radar came. */
  rescued: HeroKind[];
}

export function newStory(): StoryState {
  return { played: [], ending: null, won: [], rescued: [] };
}

const ISLAND_IDS: readonly string[] = STORY_ISLANDS.map((i) => i.id);

/** Reads an untrusted saved story. */
export function readStory(value: unknown): StoryState {
  const v = (value ?? {}) as Partial<Record<keyof StoryState, unknown>>;
  const list = (x: unknown): string[] =>
    Array.isArray(x) ? [...new Set(x.filter((s): s is string => typeof s === "string"))] : [];
  return {
    played: list(v.played).filter((id) => BY_ID.has(id)),
    ending: v.ending === "revived" || v.ending === "rested" ? v.ending : null,
    won: list(v.won).filter((id): id is StoryIsland => ISLAND_IDS.includes(id)),
    rescued: list(v.rescued).filter((k): k is HeroKind => HERO_KINDS.includes(k as HeroKind)),
  };
}

/** Something that's just happened, which may set a scene off. */
export type StoryEvent = Exclude<
  Trigger,
  { on: "start" } | { on: "after" } | { on: "chosen" } | { on: "hq" }
>;

function sets(when: Trigger, event: StoryEvent): boolean {
  if (when.on !== event.on) return false;
  const a = when as unknown as Record<string, unknown>;
  const b = event as unknown as Record<string, unknown>;
  return Object.keys(b).every((key) => a[key] === b[key]);
}

/** Whether a scene can play now: once only, for its own ending, after whatever it waits for. */
function ready(scene: Scene, story: StoryState, more: readonly string[]): boolean {
  if (story.played.includes(scene.id) || more.includes(scene.id)) return false;
  if (scene.only && scene.only !== story.ending) return false;
  return !scene.needs || story.played.includes(scene.needs) || more.includes(scene.needs);
}

/** Adds the scenes that come straight after these, and after those. */
function withFollowing(ids: string[], story: StoryState): string[] {
  for (let i = 0; i < ids.length; i++) {
    for (const scene of SCENES) {
      if (scene.when.on === "after" && scene.when.scene === ids[i] && ready(scene, story, ids)) {
        ids.push(scene.id);
      }
    }
  }
  return ids;
}

/** The scenes something that's happened sets off, in the order they play. */
export function setOff(story: StoryState, event: StoryEvent): string[] {
  const first = SCENES.filter((s) => sets(s.when, event) && ready(s, story, []));
  return withFollowing(
    first.map((s) => s.id),
    story,
  );
}

/** The next of the story's islands, once the headquarters is big enough for it to turn up. */
export function islandWaiting(story: StoryState, hq: number): StoryIsland | null {
  const next = STORY_ISLANDS.find((i) => !story.won.includes(i.id));
  return next && hq >= next.hq ? next.id : null;
}

/**
 * The scenes that are due just from how things stand: the opening, a headquarters level reached,
 * the next island turning up, and anything that follows a scene already played.
 */
export function due(story: StoryState, hq: number): string[] {
  const ids: string[] = [];
  const island = islandWaiting(story, hq);
  for (const scene of SCENES) {
    const { when } = scene;
    const now =
      when.on === "start" ||
      (when.on === "hq" && hq >= when.level) ||
      (when.on === "island" && when.stage === "appears" && when.island === island) ||
      (when.on === "after" && story.played.includes(when.scene));
    if (now && ready(scene, story, ids)) ids.push(scene.id);
  }
  return withFollowing(ids, story);
}

/** What the crew chose at the end of a scene: the scenes that follow, and the ending if it's one. */
export function choose(
  story: StoryState,
  sceneId: string,
  option: number,
): { scenes: string[]; ending: Ending | null } | null {
  const picked = BY_ID.get(sceneId)?.choice?.options[option];
  if (!picked || story.played.includes(picked.next)) return null;
  const ending = picked.ending ?? null;
  const after = { ...story, ending: ending ?? story.ending };
  return { scenes: withFollowing([picked.next], after), ending };
}

/** A choice the crew still has to make: a scene that asked, with none of its answers played. */
export function openChoice(story: StoryState): Scene | null {
  for (const id of story.played) {
    const scene = BY_ID.get(id);
    if (scene?.choice?.options.every((o) => !story.played.includes(o.next))) return scene;
  }
  return null;
}

export interface StoryChange {
  scenes?: readonly string[];
  ending?: Ending;
  won?: StoryIsland;
  rescued?: HeroKind;
}

/** The story with a change made to it. Anything already there is left as it is. */
export function advance(story: StoryState, change: StoryChange): StoryState {
  const add = <T>(list: readonly T[], more: readonly T[]) => [
    ...list,
    ...more.filter((x) => !list.includes(x)),
  ];
  return {
    played: add(
      story.played,
      (change.scenes ?? []).filter((id) => BY_ID.has(id)),
    ),
    ending: story.ending ?? change.ending ?? null,
    won: add(story.won, change.won && ISLAND_IDS.includes(change.won) ? [change.won] : []),
    rescued: add(
      story.rescued,
      change.rescued && HERO_KINDS.includes(change.rescued) ? [change.rescued] : [],
    ),
  };
}

/** Whether the Shaman's on the crew's island: from when they bring him home until he sails. */
export function shamanHome(story: StoryState): boolean {
  if (!story.played.includes("shamanArrives")) return false;
  return !story.played.some((id) => BY_ID.get(id)?.leaves === "shaman");
}

/** Who the ending has let the crew play. */
export function storyHeroes(story: StoryState): StoryHero[] {
  return story.played.flatMap((id) => BY_ID.get(id)?.joins ?? []);
}

/** The headquarters levels the last four signals come at, in an order nobody's told. */
const LATER_SIGNALS = [8, 10, 12, 15] as const;

export interface Rescue {
  hero: HeroKind;
  /** The headquarters level their signal comes at. */
  hq: number;
  /** The radar level it takes to pick it up. */
  radar: number;
}

/**
 * Who calls for help, and when: the Medic first, then the Heavy, then the other four in an order
 * that's different for every crew and the same for everyone in it.
 */
export function rescues(seed: number): Rescue[] {
  const rng = createRng(seed ^ 0x51a9);
  const rest = HERO_KINDS.filter(
    (k) => !STARTER_HEROES.includes(k) && k !== "medic" && k !== "heavy",
  );
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j] as HeroKind, rest[i] as HeroKind];
  }
  const order: { hero: HeroKind; hq: number }[] = [
    { hero: "medic", hq: 3 },
    { hero: "heavy", hq: 5 },
    ...rest.map((hero, i) => ({ hero, hq: LATER_SIGNALS[i] ?? 15 })),
  ];
  return order.map((r, i) => ({ ...r, radar: i + 1 }));
}

/** The signal the radar's picking up now: the earliest hero still out there that it can hear. */
export function signal(
  story: StoryState,
  hq: number,
  radarLevel: number,
  seed: number,
): Rescue | null {
  const next = rescues(seed).find((r) => !story.rescued.includes(r.hero));
  return next && hq >= next.hq && radarLevel >= next.radar ? next : null;
}

/** The heroes a crew can play: Sergeant Steele, and everyone they've brought home. */
export function crewHeroes(story: StoryState): HeroKind[] {
  return HERO_KINDS.filter((k) => STARTER_HEROES.includes(k) || story.rescued.includes(k));
}

/** A scene's name for the story log, from its id: "medicSignal" is "Medic signal". */
export function sceneTitle(id: string): string {
  const words = id
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Za-z])/g, "$1 $2")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
