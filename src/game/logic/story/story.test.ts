import { describe, expect, it } from "vitest";
import { HERO_KINDS, STARTER_HEROES } from "../heroes";
import {
  allLines,
  deliveryOf,
  type Ending,
  FIRSTS,
  HINTS,
  type Line,
  linesFor,
  MOOD_DELIVERY,
  pace,
  QUESTIONS,
  SCENES,
  type Scene,
  STORY_ISLANDS,
  scene,
  shot,
  spokenSeconds,
  type TimePower,
  together,
  voiceDirection,
  voiceKey,
} from ".";

const nobody = new Set<never>();

describe("the story's script", () => {
  it("gives everything its own id, so every recording has its own key", () => {
    const ids = [...SCENES, ...QUESTIONS].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = SCENES.flatMap((s) => allLines(s.lines).map((_, i) => voiceKey(s.id, i)));
    const answers = QUESTIONS.flatMap((q) => allLines(q.answer).map((_, i) => voiceKey(q.id, i)));
    expect(new Set([...keys, ...answers]).size).toBe(keys.length + answers.length);
  });

  it("only points at scenes that exist", () => {
    for (const s of SCENES) {
      if (s.when.on === "after") expect(scene(s.when.scene), s.id).toBeDefined();
      if (s.needs) expect(scene(s.needs), s.id).toBeDefined();
      for (const option of s.choice?.options ?? []) expect(scene(option.next), s.id).toBeDefined();
    }
    for (const q of QUESTIONS) expect(scene(q.after), q.id).toBeDefined();
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
    const lines = SCENES.flatMap((s) => allLines(s.lines));
    const hints = HINTS.flatMap((h) => h.sayings.flat());
    for (const [who, says] of [
      ...lines,
      ...hints,
      ...QUESTIONS.flatMap((q) => allLines(q.answer)),
    ]) {
      expect(says.length, `${who}: ${says}`).toBeLessThanOrEqual(100);
    }
  });

  it("gives every hero a signal, a landing, a rescue and a homecoming", () => {
    for (const hero of HERO_KINDS.filter((h) => !STARTER_HEROES.includes(h))) {
      for (const stage of ["signal", "landing", "won", "home"]) {
        const found = SCENES.filter(
          (s) => s.when.on === "rescue" && s.when.hero === hero && s.when.stage === stage,
        );
        expect(found.length, `${hero} ${stage}`).toBe(1);
        expect(found[0]?.cast).toContain(hero);
      }
    }
  });

  it("has something for every story island, as it appears, is landed on and is won, whichever way it ended", () => {
    for (const { id } of STORY_ISLANDS) {
      for (const stage of ["appears", "landing", "won"]) {
        for (const ending of ["revived", "rested"]) {
          const found = SCENES.filter(
            (s) =>
              s.when.on === "island" &&
              s.when.island === id &&
              s.when.stage === stage &&
              (s.only === undefined || s.only === ending),
          );
          expect(found.length, `${id} ${stage} ${ending}`).toBe(1);
        }
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

  it("gives the crew Theo to play if they bring him back, or else the Shaman", () => {
    const ending = (s: Scene): Ending | undefined => {
      if (s.only) return s.only;
      if (s.when.on === "chosen") {
        const id = s.id;
        return SCENES.flatMap((c) => c.choice?.options ?? []).find((o) => o.next === id)?.ending;
      }
      const before = s.when.on === "after" ? scene(s.when.scene) : undefined;
      return before && ending(before);
    };
    const joining = SCENES.filter((s) => s.joins).map((s) => [s.joins, ending(s)]);
    expect(joining.sort()).toEqual([
      ["shaman", "rested"],
      ["theo", "revived"],
    ]);
    const leaving = SCENES.filter((s) => s.leaves).map((s) => [s.leaves, ending(s)]);
    expect(leaving).toEqual([["shaman", "revived"]]);
  });
});

describe("cutscenes", () => {
  const cutscenes = SCENES.filter((s) => s.cutscene);

  it("show what the camera sees, and say how every line is delivered", () => {
    expect(cutscenes.length).toBeGreaterThan(30);
    for (const s of cutscenes) {
      expect(
        s.lines.some((b) => "shot" in b),
        s.id,
      ).toBe(true);
      for (const line of allLines(s.lines))
        expect(deliveryOf(line).how, `${s.id}: ${line[1]}`).toBeTruthy();
    }
  });

  it("are paced in order, with every shot and line in its place", () => {
    for (const s of cutscenes) {
      const cues = pace(s.lines, nobody, s.cast);
      for (let i = 1; i < cues.length; i++) {
        const before = cues[i - 1];
        const cue = cues[i];
        expect(before && cue && cue.at >= before.at + before.seconds, s.id).toBe(true);
      }
    }
  });
});

describe("delivery", () => {
  const whispered: Line = ["shaman", "Take care of the island, and each other.", "whisper"];
  const shouted: Line = ["shaman", "Take care of the island, and each other.", "shout"];

  it("speaks a whisper slower than a shout", () => {
    expect(spokenSeconds(whispered)).toBeGreaterThan(spokenSeconds(shouted) * 1.5);
  });

  it("leaves a longer silence before a sad or whispered line than an angry one", () => {
    expect(MOOD_DELIVERY.whisper.gap).toBeGreaterThan(MOOD_DELIVERY.angry.gap * 3);
    expect(MOOD_DELIVERY.sad.gap).toBeGreaterThan(MOOD_DELIVERY.shout.gap * 3);
  });

  it("waits longer for someone answering than for the same person carrying on", () => {
    const one = (who: Line[0]): Line => [who, "Yes."];
    const answered = pace([one("rifleman"), one("shaman")], nobody, [], () => 1);
    const carriedOn = pace([one("shaman"), one("shaman")], nobody, [], () => 1);
    expect(answered[1]?.at).toBeGreaterThan(carriedOn[1]?.at ?? 0);
  });

  it("holds a shot for its length, and a line's own pauses before and after it", () => {
    const cues = pace(
      [
        shot("The sea.", 3),
        ["shaman", "Hm.", { how: "thinking", before: 1, after: 2 }],
        ["shaman", "Yes."],
      ],
      nobody,
      [],
      () => 1,
    );
    expect(cues.map((c) => c.at)).toEqual([0, 4, 7 + 0.5 * 0.6]);
  });

  it("tells the voice who's speaking, how they feel and anything the line asks", () => {
    const direction = voiceDirection(["shaman", "Hm.", { mood: "whisper", how: "dying" }]);
    expect(direction).toContain("old island elder");
    expect(direction).toContain(MOOD_DELIVERY.whisper.voice);
    expect(direction).toContain("dying");
  });
});

describe("the Shaman's hints", () => {
  it("has a few ways of saying each, in his voice, with something for when nothing's pressing", () => {
    const steps = HINTS.map((h) => h.step);
    expect(new Set(steps).size).toBe(steps.length);
    expect(steps.at(-1)).toBe("rest");
    for (const h of HINTS) {
      expect(h.sayings.length, h.step).toBeGreaterThanOrEqual(2);
      for (const [who] of h.sayings.flat()) expect(who).toBe("shaman");
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
