import { describe, expect, it } from "vitest";
import { HERO_KINDS } from "../heroes";
import {
  allLines,
  CHATTER,
  FIRSTS,
  isHero,
  linesFor,
  QUESTIONS,
  SCENES,
  STORY_ISLANDS,
  scene,
  type TimePower,
  together,
  voiceKey,
} from ".";

const nobody = new Set<never>();

describe("the story's script", () => {
  it("gives everything its own id, so every recording has its own key", () => {
    const ids = [...SCENES, ...QUESTIONS, ...CHATTER].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = [...SCENES, ...CHATTER].flatMap((s) =>
      allLines(s.lines).map((_, i) => voiceKey(s.id, i)),
    );
    const answers = QUESTIONS.flatMap((q) => allLines(q.answer).map((_, i) => voiceKey(q.id, i)));
    expect(new Set([...keys, ...answers]).size).toBe(keys.length + answers.length);
  });

  it("only points at scenes that exist", () => {
    for (const s of SCENES) {
      if (s.when.on === "after") expect(scene(s.when.scene), s.id).toBeDefined();
      if (s.needs) expect(scene(s.needs), s.id).toBeDefined();
      for (const option of s.choice?.options ?? []) expect(scene(option.next), s.id).toBeDefined();
    }
    for (const q of [...QUESTIONS, ...CHATTER]) expect(scene(q.after), q.id).toBeDefined();
  });

  it("plays a chosen scene only when the crew chooses it", () => {
    const chosen = SCENES.filter((s) => s.when.on === "chosen").map((s) => s.id);
    const choices = SCENES.flatMap((s) => s.choice?.options.map((o) => o.next) ?? []);
    expect(chosen.sort()).toEqual([...choices].sort());
  });

  it("ends one of two ways", () => {
    const options = SCENES.flatMap((s) => s.choice?.options ?? []);
    expect(options.map((o) => o.ending).sort()).toEqual(["rested", "revived"]);
  });

  it("reads right whoever the crew has rescued so far", () => {
    for (const s of SCENES)
      expect(linesFor(s.lines, nobody, s.cast).length, s.id).toBeGreaterThan(0);
    for (const q of QUESTIONS) expect(linesFor(q.answer, nobody).length, q.id).toBeGreaterThan(0);
  });

  it("keeps every line short enough for a dialogue box", () => {
    const lines = [...SCENES, ...CHATTER].flatMap((s) => allLines(s.lines));
    for (const [who, says] of [...lines, ...QUESTIONS.flatMap((q) => allLines(q.answer))]) {
      expect(says.length, `${who}: ${says}`).toBeLessThanOrEqual(100);
    }
  });

  it("gives every hero a signal, a landing, a rescue and a homecoming", () => {
    for (const hero of HERO_KINDS.filter((h) => h !== "rifleman")) {
      for (const stage of ["signal", "landing", "won", "home"]) {
        const found = SCENES.filter(
          (s) => s.when.on === "rescue" && s.when.hero === hero && s.when.stage === stage,
        );
        expect(found.length, `${hero} ${stage}`).toBe(1);
        expect(found[0]?.cast).toContain(hero);
      }
    }
  });

  it("has something for every story island, as it appears, is landed on and is won", () => {
    for (const { id } of STORY_ISLANDS) {
      for (const stage of ["appears", "landing", "won"]) {
        const found = SCENES.filter(
          (s) => s.when.on === "island" && s.when.island === id && s.when.stage === stage,
        );
        expect(found.length, `${id} ${stage}`).toBe(1);
      }
    }
    const levels = STORY_ISLANDS.map((i) => i.hq);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("has something for every first, and the first use of every time power", () => {
    for (const thing of FIRSTS) {
      const found = SCENES.filter((s) => s.when.on === "first" && s.when.thing === thing);
      expect(found.length, thing).toBe(1);
    }
    const powers: TimePower[] = ["rewind", "fastForward", "pause", "record", "slow", "retry"];
    for (const power of powers) {
      const found = SCENES.filter((s) => s.when.on === "power" && s.when.power === power);
      expect(found.length, power).toBe(1);
    }
  });

  it("lets Captain Brack's islands come only after Terror is brought back", () => {
    for (const island of STORY_ISLANDS.filter((i) => i.id.startsWith("brack"))) {
      expect("only" in island && island.only).toBe("revived");
    }
  });

  it("gives every chatter a hero to talk to", () => {
    for (const c of CHATTER) {
      expect(
        allLines(c.lines).some(([who]) => isHero(who) || who === "theo" || who === "clara"),
      ).toBe(true);
    }
  });
});

describe("which lines the crew hears", () => {
  const lines = [
    ["shaman", "Hello."],
    ["medic", "Hello, Shaman."],
    together(["heavy", "Is there food?"], ["tank", "Tank's hungry."]),
    ["rifleman", "Steady."],
  ] as const;

  it("leaves out heroes the crew hasn't rescued, but never the Sergeant", () => {
    expect(linesFor(lines, nobody).map(([who]) => who)).toEqual(["shaman", "rifleman"]);
    expect(linesFor(lines, new Set(["medic"] as const)).map(([who]) => who)).toEqual([
      "shaman",
      "medic",
      "rifleman",
    ]);
  });

  it("keeps lines that go together, together", () => {
    expect(linesFor(lines, new Set(["heavy"] as const)).length).toBe(2);
    expect(linesFor(lines, new Set(["heavy", "tank"] as const)).length).toBe(4);
  });

  it("lets a scene's cast speak before they're rescued", () => {
    expect(linesFor(lines, nobody, ["medic"]).length).toBe(3);
  });
});
