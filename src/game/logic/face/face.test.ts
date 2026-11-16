import { describe, expect, it } from "vitest";
import { EXPRESSIONS, FACE_PARTS, FACES, faceTargets, REST } from "./expressions";
import { scriptLine } from "./faceScript";
import { SpringSet, spring, stepSpring } from "./springs";
import { lineSeconds, MOUTH, mouthAt, visemesFor } from "./visemes";

describe("springs", () => {
  it("settle in the time asked, without overshooting", () => {
    const s = spring(0);
    let most = 0;
    for (let t = 0; t < 0.4; t += 1 / 120) {
      stepSpring(s, 1, 0.4, 1 / 120);
      most = Math.max(most, s.value);
    }
    expect(s.value).toBeGreaterThan(0.98);
    expect(most).toBeLessThanOrEqual(1.0001);
  });

  it("move the same at 30 and at 120 frames a second", () => {
    const fast = spring(0);
    const slow = spring(0);
    for (let n = 0; n < 120; n++) stepSpring(fast, 1, 0.5, 1 / 120);
    for (let n = 0; n < 30; n++) stepSpring(slow, 1, 0.5, 1 / 30);
    expect(fast.value).toBeCloseTo(slow.value, 6);
  });

  it("ease a set back to rest when nothing is asked", () => {
    const set = new SpringSet(["a", "b"] as const, () => 1);
    for (let n = 0; n < 120; n++) set.step({ a: 1 }, 0.3, 1 / 60, 0);
    expect(set.get("a")).toBeCloseTo(1, 3);
    expect(set.get("b")).toBeCloseTo(0, 2);
  });
});

describe("expressions", () => {
  it("give every part a target", () => {
    for (const expression of EXPRESSIONS) {
      const targets = faceTargets(expression);
      for (const part of FACE_PARTS) expect(Number.isFinite(targets[part])).toBe(true);
      expect(FACES[expression].settle).toBeGreaterThan(0);
    }
  });

  it("raise the brows in realization and knit them in fury", () => {
    expect(faceTargets("realization").browMidL).toBeGreaterThan(REST.browMidL);
    expect(faceTargets("furious").browInnerL).toBeLessThan(faceTargets("furious").browOuterL);
    expect(faceTargets("skeptical").browMidL).not.toBe(faceTargets("skeptical").browMidR);
  });
});

describe("visemes", () => {
  it("close the lips for M, B and P, and round them for OO", () => {
    const kinds = visemesFor("Mom, boo!").map((k) => k.viseme);
    expect(kinds).toContain("M_B_P");
    expect(kinds).toContain("OO");
    expect(kinds.at(-1)).toBe("sil");
  });

  it("pause on commas and full stops", () => {
    const quick = lineSeconds(visemesFor("all units fall back"));
    const paused = lineSeconds(visemesFor("all units, fall back."));
    expect(paused).toBeGreaterThan(quick + 0.3);
  });

  it("go quicker at a brisker pace", () => {
    const line = "We need to secure the beachhead";
    expect(lineSeconds(visemesFor(line, 1.3))).toBeLessThan(lineSeconds(visemesFor(line)));
  });

  it("shut the mouth before and after a line, and open it in the middle", () => {
    const keys = visemesFor("Captain! We need to secure the beachhead!");
    expect(mouthAt(keys, 0).open).toBe(0);
    expect(mouthAt(keys, lineSeconds(keys) + 1).open).toBe(0);
    let most = 0;
    for (let t = 0; t < lineSeconds(keys); t += 0.01) most = Math.max(most, mouthAt(keys, t).open);
    expect(most).toBeGreaterThan(0.5);
  });

  it("blend between shapes rather than snapping", () => {
    const keys = visemesFor("ah oo");
    let jump = 0;
    let last = mouthAt(keys, 0).round;
    for (let t = 0; t < lineSeconds(keys); t += 0.005) {
      const now = mouthAt(keys, t).round;
      jump = Math.max(jump, Math.abs(now - last));
      last = now;
    }
    expect(jump).toBeLessThan(MOUTH.OO.round * 0.3);
  });
});

describe("scripted lines", () => {
  const line = scriptLine(
    "[skeptical] Wait a second... [realization] they're flanking us from the ridge! [furious] All units, fall back!",
  );

  it("strip the tags out of the words", () => {
    expect(line.text).toBe(
      "Wait a second... they're flanking us from the ridge! All units, fall back!",
    );
  });

  it("put each face on the words after it, in order", () => {
    const faces = line.cues.filter((c) => c.cue.kind === "face");
    expect(faces.map((c) => (c.cue.kind === "face" ? c.cue.expression : ""))).toEqual([
      "skeptical",
      "realization",
      "furious",
    ]);
    expect(faces[0]?.at).toBe(0);
    expect(faces[1]?.at ?? 0).toBeGreaterThan(0.8);
    expect(faces[2]?.at ?? 0).toBeGreaterThan(faces[1]?.at ?? 0);
    expect(line.seconds).toBeGreaterThan(faces[2]?.at ?? 0);
  });

  it("read actions, pauses and pace", () => {
    const acted = scriptLine("[look:left] Over there. [pause:0.5] [nod] [pace:1.4] Go now.");
    expect(acted.cues.map((c) => c.cue.kind)).toEqual(["look", "nod"]);
    const nod = acted.cues.find((c) => c.cue.kind === "nod");
    const plain = scriptLine("Over there. Go now.");
    expect(nod?.at ?? 0).toBeGreaterThan(0.5);
    expect(acted.seconds).toBeGreaterThan(0);
    expect(plain.cues).toEqual([]);
  });
});
