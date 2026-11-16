import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  type ClipInfo,
  eased,
  extractTravel,
  matchedStart,
  namesUnder,
  splitTracks,
  stridePhase,
  syncedTimeScales,
  timeAtPhase,
  transitionFor,
  travelBetween,
} from "./clipLibrary";

function clip(name: string, kind: ClipInfo["kind"], more: Partial<ClipInfo> = {}): ClipInfo {
  return {
    name,
    file: `${name}.glb`,
    kind,
    seconds: 2,
    loops: true,
    rootMotion: false,
    travel: [0, 0],
    turnDegrees: 0,
    reach: 0,
    about: "",
    ...more,
  };
}

// Strides like the real ones: a slow walk (left lands at the seam, right a cycle's half on) and a
// run whose landings sit mid-cycle.
const walk = clip("walk", "walk", { seconds: 2, footfalls: { left: [0], right: [1] } });
const run = clip("run", "run", { seconds: 0.6, footfalls: { left: [0.5], right: [0.2] } });
const idle = clip("idle", "idle", { seconds: 18 });
const stop = clip("stop", "stop", {
  seconds: 2.8,
  loops: false,
  footfalls: { left: [0.5, 1.0], right: [0.2, 0.8, 1.3] },
});

describe("which blend for which change", () => {
  it("blends nothing for the first clip or the same clip again", () => {
    expect(transitionFor(null, walk).seconds).toBe(0);
    expect(transitionFor(walk, walk).reason).toBe("same");
  });

  it("sets off quickly, stops a little slower, and settles slowest", () => {
    const setOff = transitionFor(idle, walk);
    const halt = transitionFor(walk, idle);
    const settle = transitionFor(clip("shoot", "action"), idle);
    expect(setOff.reason).toBe("set off");
    expect(halt.reason).toBe("stop");
    expect(settle.reason).toBe("settle");
    expect(setOff.seconds).toBeLessThan(halt.seconds);
    expect(halt.seconds).toBeLessThan(settle.seconds);
    expect(settle.ease).toBe("smooth");
  });

  it("changes gait foot for foot, about half a step long", () => {
    const gait = transitionFor(walk, run);
    expect(gait.syncFeet).toBe(true);
    expect(gait.seconds).toBeGreaterThanOrEqual(0.2);
    expect(gait.seconds).toBeLessThanOrEqual(0.4);
    expect(transitionFor(run, stop)).toMatchObject({ syncFeet: true, reason: "pull up" });
  });

  it("takes a hit at once, and getting up from a seat slowly", () => {
    expect(transitionFor(run, clip("blast", "reaction")).seconds).toBeLessThan(0.1);
    expect(transitionFor(clip("sit", "sit"), idle).seconds).toBeGreaterThan(0.5);
  });

  it("eases: steady, slow at both ends, or quick then slow", () => {
    expect(eased("linear", 0.25)).toBeCloseTo(0.25);
    expect(eased("smooth", 0.1)).toBeLessThan(0.1);
    expect(eased("smooth", 0.5)).toBeCloseTo(0.5);
    expect(eased("out", 0.25)).toBeGreaterThan(0.25);
    expect(eased("out", 2)).toBe(1);
  });
});

describe("where in the stride", () => {
  it("is 0 as the left foot lands and a half as the right does", () => {
    expect(stridePhase(walk, 0)).toBeCloseTo(0);
    expect(stridePhase(walk, 1)).toBeCloseTo(0.5);
    expect(stridePhase(walk, 1.5)).toBeCloseTo(0.75);
    expect(stridePhase(run, 0.5)).toBeCloseTo(0);
    expect(stridePhase(run, 0.2)).toBeCloseTo(0.5);
    // Round the loop's end: from the right landing at 0.2 to the left at 0.5 is the second half.
    expect(stridePhase(run, 0.35)).toBeCloseTo(0.75);
    expect(stridePhase(run, 0.05)).toBeCloseTo(0.5 - 0.15 / 0.3 / 2);
  });

  it("has no stride without both feet's landings", () => {
    expect(stridePhase(idle, 1)).toBeNull();
    expect(timeAtPhase(idle, 0.5)).toBeNull();
  });

  it("finds the time at a point in the stride, the other way round", () => {
    for (const info of [walk, run]) {
      for (const phase of [0, 0.1, 0.4, 0.5, 0.6, 0.95]) {
        const t = timeAtPhase(info, phase) ?? Number.NaN;
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(info.seconds);
        expect(stridePhase(info, t)).toBeCloseTo(phase);
      }
    }
  });

  it("starts the new stride where the old one's feet are", () => {
    // Half way from the walk's left landing to its right is a quarter of the stride; in the run
    // that's half way from its left landing (0.5) round to its right (0.2 + 0.6): 0.65, which is
    // 0.05 into the next time round.
    expect(matchedStart(walk, 0.5, run)).toBeCloseTo(0.05);
    // A stop picks up within its first stride.
    expect(matchedStart(run, 0.2, stop)).toBeCloseTo(0.2);
    expect(matchedStart(run, 0.5, stop)).toBeCloseTo(0.5);
    // No stride to match: from the start.
    expect(matchedStart(idle, 3, run)).toBe(0);
  });

  it("keeps two strides in step while they blend", () => {
    const start = syncedTimeScales(2, 0.6, 0);
    expect(start.from).toBeCloseTo(1);
    expect(start.to).toBeCloseTo(0.3);
    const end = syncedTimeScales(2, 0.6, 1);
    expect(end.to).toBeCloseTo(1);
    const mid = syncedTimeScales(2, 0.6, 0.5);
    // Both go round their cycles at one rate.
    expect(mid.from / 2).toBeCloseTo(mid.to / 0.6);
  });
});

describe("upper and lower body", () => {
  it("splits a clip's tracks by bone", () => {
    const q = [0, 0, 0, 1];
    const tracks = [
      new THREE.QuaternionKeyframeTrack("CC_Base_Hip.quaternion", [0], q),
      new THREE.VectorKeyframeTrack("CC_Base_Hip.position", [0], [0, 0, 0]),
      new THREE.QuaternionKeyframeTrack("CC_Base_Spine01.quaternion", [0], q),
      new THREE.QuaternionKeyframeTrack("CC_Base_L_Hand.quaternion", [0], q),
    ];
    const { inside, outside } = splitTracks(
      new THREE.AnimationClip("wave", 1, tracks),
      new Set(["CC_Base_Spine01", "CC_Base_L_Hand"]),
    );
    expect(inside.tracks.map((t) => t.name)).toEqual([
      "CC_Base_Spine01.quaternion",
      "CC_Base_L_Hand.quaternion",
    ]);
    expect(outside.tracks.map((t) => t.name)).toEqual([
      "CC_Base_Hip.quaternion",
      "CC_Base_Hip.position",
    ]);
    expect(inside.duration).toBe(1);
  });

  it("finds the bones under the spine", () => {
    const hip = new THREE.Bone();
    hip.name = "CC_Base_Hip";
    const spine = new THREE.Bone();
    spine.name = "CC_Base_Spine01";
    const hand = new THREE.Bone();
    hand.name = "CC_Base_L_Hand";
    const thigh = new THREE.Bone();
    thigh.name = "CC_Base_L_Thigh";
    hip.add(spine, thigh);
    spine.add(hand);
    expect([...namesUnder(hip, "CC_Base_Spine01")].sort()).toEqual([
      "CC_Base_L_Hand",
      "CC_Base_Spine01",
    ]);
  });
});

describe("the hip's travel", () => {
  const up = new THREE.Vector3(0, 0, 1);
  // A loop going 1 ahead (+y here, as in the Captain's z-up skeleton) over 2 s, swaying side to
  // side (x) and bobbing (z).
  const times = [0, 0.5, 1, 1.5, 2];
  const values = [0, 0, 0.4, 0.05, 0.25, 0.38, 0, 0.5, 0.4, -0.05, 0.75, 0.38, 0, 1, 0.4];

  it("takes a loop's steady travel out and keeps its sway and bob", () => {
    const { values: kept, travel } = extractTravel(times, values, up, true);
    // Forward is left where the line from first to last would have it: in place.
    expect(kept[1]).toBeCloseTo(0);
    expect(kept[7]).toBeCloseTo(0);
    expect(kept[13]).toBeCloseTo(0);
    // Sway and bob stay.
    expect(kept[3]).toBeCloseTo(0.05);
    expect(kept[5]).toBeCloseTo(0.38);
    expect(travel[13]).toBeCloseTo(1);
    expect(travel[14]).toBeCloseTo(0);
  });

  it("takes all of a one-off's travel out, keeping its height", () => {
    const { values: kept } = extractTravel(times, values, up, false);
    expect(kept[3]).toBeCloseTo(0);
    expect(kept[4]).toBeCloseTo(0);
    expect(kept[5]).toBeCloseTo(0.38);
  });

  it("measures the travel between two times, counting each time round a loop", () => {
    const { travel } = extractTravel(times, values, up, true);
    const into = new THREE.Vector3();
    expect(travelBetween(times, travel, 0.5, 1.5, 0, into).y).toBeCloseTo(0.5);
    // From 1.5 round the end to 0.5: the rest of this cycle and the start of the next.
    expect(travelBetween(times, travel, 1.5, 0.5, 1, into).y).toBeCloseTo(0.5);
  });
});
