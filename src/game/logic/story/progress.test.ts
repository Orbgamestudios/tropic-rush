import { describe, expect, it } from "vitest";
import { HERO_KINDS, STARTER_HEROES } from "../heroes";
import { SCENES, STORY_ISLANDS, scene } from ".";
import {
  advance,
  choose,
  crewHeroes,
  due,
  islandWaiting,
  newStory,
  openChoice,
  readStory,
  rescues,
  type StoryState,
  sceneTitle,
  setOff,
  shamanHome,
  signal,
  storyHeroes,
} from "./progress";

const played = (story: StoryState, ...scenes: string[]) => advance(story, { scenes });

describe("the story's progress", () => {
  it("opens with the prologue, once", () => {
    const story = newStory();
    expect(due(story, 1)).toEqual(["prologue"]);
    expect(due(played(story, "prologue"), 1)).toEqual([]);
  });

  it("sets a scene off once, with whatever follows it", () => {
    const story = newStory();
    expect(setOff(story, { on: "first", thing: "raidWon" })).toEqual([
      "shamanFreed",
      "shamanArrives",
    ]);
    const after = played(story, "shamanFreed", "shamanArrives");
    expect(setOff(after, { on: "first", thing: "raidWon" })).toEqual([]);
  });

  it("picks up what follows a scene another phone left half told", () => {
    expect(due(played(newStory(), "prologue", "shamanFreed"), 1)).toEqual(["shamanArrives"]);
  });

  it("brings the story's islands up one at a time, each once the last is won", () => {
    let story = played(newStory(), "prologue");
    expect(islandWaiting(story, 5)).toBeNull();
    expect(due(story, 6)).toEqual(["terror1Appears", "hourglassTold"]);
    story = played(story, "terror1Appears", "hourglassTold");
    expect(islandWaiting(story, 40)).toBe("terror1");
    expect(due(story, 40)).toEqual([]);
    story = advance(story, { won: "terror1" });
    expect(islandWaiting(story, 9)).toBeNull();
    expect(due(story, 10)).toEqual(["terror2Appears"]);
  });

  it("has a scene for every island turning up and being won", () => {
    let story = newStory();
    for (const { id, hq } of STORY_ISLANDS) {
      expect(
        due(story, hq).some((s) => s.endsWith("Appears")),
        id,
      ).toBe(true);
      const won = setOff(story, { on: "island", island: id, stage: "won" });
      expect(won.length, id).toBeGreaterThan(0);
      story = advance(story, { won: id, scenes: [...due(story, hq), ...won] });
    }
    expect(islandWaiting(story, 50)).toBeNull();
  });

  it("asks the crew to choose, and plays only the ending they picked", () => {
    let story = played(newStory(), "finale", "shamanReturns");
    expect(openChoice(story)?.id).toBe("shamanReturns");
    const rested = choose(story, "shamanReturns", 1);
    const revived = choose(story, "shamanReturns", 0);
    expect(new Set([rested?.ending, revived?.ending])).toEqual(new Set(["rested", "revived"]));
    const pick = rested?.ending === "rested" ? rested : revived;
    story = advance(story, { scenes: pick?.scenes, ending: "rested" });
    expect(openChoice(story)).toBeNull();
    expect(story.played).toContain("shamanJoins");
    expect(story.played).not.toContain("revived");
    expect(storyHeroes(story)).toEqual(["shaman"]);
    expect(choose(story, "shamanReturns", 0)?.scenes ?? []).not.toContain("rested");
    // The other ending's later scenes never come.
    const later = due(story, 50);
    for (const id of later) expect(scene(id)?.only ?? "rested", id).toBe("rested");
    expect(later).toContain("restedOrchid");
    expect(later).not.toContain("claraGarden");
  });

  it("keeps the ending once it's chosen", () => {
    const story = advance(newStory(), { ending: "rested" });
    expect(advance(story, { ending: "revived" }).ending).toBe("rested");
  });

  it("has the Shaman on the island from when he's brought home until he sails", () => {
    let story = newStory();
    expect(shamanHome(story)).toBe(false);
    story = played(story, "shamanFreed", "shamanArrives");
    expect(shamanHome(story)).toBe(true);
    expect(shamanHome(played(story, "shamanLeaves"))).toBe(false);
    expect(shamanHome(played(story, "shamanJoins"))).toBe(true);
  });

  it("calls the Medic first, the Heavy next, and everyone by headquarters 15", () => {
    for (const seed of [1, 77, 123456]) {
      const order = rescues(seed);
      expect(order.map((r) => r.hero).slice(0, 2)).toEqual(["medic", "heavy"]);
      expect(order.map((r) => r.hq)).toEqual([3, 5, 8, 10, 12, 15]);
      expect(new Set(order.map((r) => r.hero)).size).toBe(
        HERO_KINDS.length - STARTER_HEROES.length,
      );
      expect(rescues(seed)).toEqual(order);
    }
    expect(rescues(1).map((r) => r.hero)).not.toEqual(rescues(2).map((r) => r.hero));
  });

  it("hears one signal at a time, when the headquarters and the radar are both up to it", () => {
    let story = newStory();
    expect(signal(story, 2, 1, 9)).toBeNull();
    expect(signal(story, 3, 0, 9)).toBeNull();
    expect(signal(story, 3, 1, 9)?.hero).toBe("medic");
    story = advance(story, { rescued: "medic" });
    expect(signal(story, 5, 1, 9)).toBeNull();
    expect(signal(story, 5, 2, 9)?.hero).toBe("heavy");
    expect(crewHeroes(story)).toEqual(["captain", "rifleman", "medic"]);
  });

  it("has all four scenes for every rescue", () => {
    for (const { hero } of rescues(3)) {
      for (const stage of ["signal", "landing", "won", "home"] as const) {
        expect(setOff(newStory(), { on: "rescue", hero, stage }).length, hero + stage).toBe(1);
      }
    }
  });

  it("reads a saved story, dropping what it doesn't know", () => {
    expect(readStory(null)).toEqual(newStory());
    expect(
      readStory({
        played: ["prologue", "nonsense", "prologue", 4],
        ending: "sideways",
        won: ["terror1", "moon"],
        rescued: ["medic", "wizard"],
      }),
    ).toEqual({ played: ["prologue"], ending: null, won: ["terror1"], rescued: ["medic"] });
  });

  it("names every scene for the log", () => {
    expect(sceneTitle("medicSignal")).toBe("Medic signal");
    expect(sceneTitle("terror1Appears")).toBe("Terror 1 appears");
    for (const s of SCENES) expect(sceneTitle(s.id).length).toBeGreaterThan(3);
  });
});
