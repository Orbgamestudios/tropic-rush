// The finer parts of a hero's skeleton, found on the model itself rather than listed by hand:
// three bones in every finger and the thumb, and chains of bones down whatever hair hangs free, so
// the hands can hold, point and curl a finger at a time, and hair can swing in the wind and follow
// the head (docs/CHARACTERS.md). rig-hero.mjs builds the body's skeleton and weights; this adds to
// both.
//
// Everything here works in the hero's own meters, as rig-hero.mjs has placed them: x forward, y up,
// z sideways, the right arm along +z. Models are generated as one piece with the fingers often
// touching, so fingers are told apart by where they lie across the hand: each gets a strip, a
// quarter of the hand's width, and keeps it crisply rather than blurring into its neighbors.

import sharp from "sharp";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => scale(a, 1 / (length(a) || 1));
const lerp3 = (a, b, t) => add(a, scale(sub(b, a), t));

function quantile(values, q) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
}

const FINGERS = ["index", "middle", "ring", "pinky"];
/** Where along the hand, from the wrist to the fingertips, the knuckles are. */
const KNUCKLE = 0.42;
/** Where the finger's own two joints are, along it from the knuckle. */
const FINGER_JOINTS = [0.48, 0.77];

/**
 * The bones of one hand's thumb and fingers, from where the hand's vertices lie. `wrist` and
 * `tips` are the hand's two ends.
 */
export function measureHand(mesh, wrist, tips, side, apart = false) {
  const along = sub(tips, wrist);
  const reach = length(along);
  const a = unit(along);
  // Across the hand (forward, the way the thumb points in a T-pose) and through it (up).
  let across = sub([1, 0, 0], scale(a, a[0]));
  across = unit(across);
  let through = sub([0, 1, 0], scale(a, a[1]));
  through = sub(through, scale(across, dot(through, across)));
  through = unit(through);
  const hand = [];
  const count = mesh.positions.length / 3;
  for (let i = 0; i < count; i++) {
    const p = [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];
    const d = sub(p, wrist);
    const t = dot(d, a) / reach;
    if (t < -0.05 || t > 1.25) continue;
    const u = dot(d, across);
    const v = dot(d, through);
    if (Math.hypot(u, v) > reach * 0.8) continue;
    hand.push({ i, t, u, v });
  }
  const at = (t, u, v) =>
    add(add(add(wrist, scale(a, t * reach)), scale(across, u)), scale(through, v));
  const middleV = quantile(
    hand.map((h) => h.v),
    0.5,
  );
  // The thumb is whatever reaches furthest forward before the fingertips.
  const early = hand.filter((h) => h.t > 0.12 && h.t < 0.72);
  let thumbTip = early[0] ?? { t: 0.5, u: reach * 0.4, v: middleV };
  for (const h of early) if (h.u > thumbTip.u) thumbTip = h;
  // The fingers: what's past the knuckles, and not the thumb.
  const fingerRegion = hand.filter(
    (h) => h.t > KNUCKLE + 0.04 && !(h.u > thumbTip.u * 0.6 && h.t < thumbTip.t + 0.08),
  );
  const low = quantile(
    fingerRegion.map((h) => h.u),
    0.04,
  );
  const high = quantile(
    fingerRegion.map((h) => h.u),
    0.96,
  );
  const width = Math.max(high - low, reach * 0.15);
  const bones = [];
  const name = side < 0 ? "R" : "L";
  // The thumb: from the heel of the hand, out to its tip in three bones.
  const thumbBase = { t: 0.1, u: thumbTip.u * 0.32, v: middleV };
  const thumbAt = (k) =>
    at(
      thumbBase.t + (thumbTip.t - thumbBase.t) * k,
      thumbBase.u + (thumbTip.u - thumbBase.u) * k,
      thumbBase.v + (thumbTip.v - thumbBase.v) * k,
    );
  const thumbJoints = [thumbAt(0), thumbAt(0.42), thumbAt(0.72), thumbAt(1)];
  for (let k = 0; k < 3; k++) {
    bones.push({
      name: `thumb${name}${k + 1}`,
      parent: k === 0 ? `hand${name}` : `thumb${name}${k}`,
      at: thumbJoints[k],
      to: thumbJoints[k + 1],
      finger: "thumb",
    });
  }
  // Fingers that were made apart are found where they are: they fan out from the heel of the
  // hand, so what's past the knuckles falls into four bunches by which way it lies from there.
  const fan = apart ? apartFingers(mesh, hand, thumbTip) : null;
  if (apart && !fan) console.log("  the fingers of one hand couldn't be told apart: using strips");
  if (fan) {
    const owner = new Map();
    for (const [f, bunch] of fan.entries()) {
      const finger = FINGERS[f];
      for (const h of bunch) owner.set(h.i, finger);
      const byT = [...bunch].sort((x, y) => y.t - x.t);
      const far = byT.slice(0, Math.max(3, bunch.length >> 4));
      const near = byT.slice(-Math.max(4, bunch.length >> 3));
      const mean = (list, k) => list.reduce((sum, h) => sum + h[k], 0) / list.length;
      const tip = at(mean(far, "t"), mean(far, "u"), mean(far, "v"));
      const root = at(mean(near, "t"), mean(near, "u"), mean(near, "v"));
      // The knuckle is back along the finger's own line, at the knuckles' distance.
      const back = (KNUCKLE - mean(near, "t")) / Math.max(0.1, mean(far, "t") - mean(near, "t"));
      const knuckle = add(root, scale(sub(tip, root), back));
      const joints = [
        knuckle,
        lerp3(knuckle, tip, FINGER_JOINTS[0]),
        lerp3(knuckle, tip, FINGER_JOINTS[1]),
        tip,
      ];
      for (let k = 0; k < 3; k++) {
        bones.push({
          name: `${finger}${name}${k + 1}`,
          parent: k === 0 ? `tips${name}` : `${finger}${name}${k}`,
          at: joints[k],
          to: joints[k + 1],
          finger,
        });
      }
    }
    return { bones, hand, reach, axis: a, wrist, owner };
  }
  // Four strips across the hand, the index nearest the thumb.
  const strips = FINGERS.map((finger, f) => {
    const centre = high - (f + 0.5) * (width / 4);
    const mine = fingerRegion.filter((h) => Math.abs(h.u - centre) < width / 8);
    const tipT = Math.max(
      KNUCKLE + 0.25,
      quantile(
        mine.map((h) => h.t),
        0.97,
      ),
    );
    const v = quantile(
      mine.map((h) => h.v),
      0.5,
    );
    return { finger, centre, tipT, v: mine.length > 0 ? v : middleV };
  });
  for (const { finger, centre, tipT, v } of strips) {
    const knuckle = at(KNUCKLE, centre * 0.85, v);
    const tip = at(tipT, centre, v);
    const joints = [
      knuckle,
      lerp3(knuckle, tip, FINGER_JOINTS[0]),
      lerp3(knuckle, tip, FINGER_JOINTS[1]),
      tip,
    ];
    for (let k = 0; k < 3; k++) {
      bones.push({
        name: `${finger}${name}${k + 1}`,
        parent: k === 0 ? `tips${name}` : `${finger}${name}${k}`,
        at: joints[k],
        to: joints[k + 1],
        finger,
      });
    }
  }
  return { bones, hand, reach, axis: a, wrist };
}

/**
 * A hand's four fingers, where they were made apart, the index (furthest forward) first: each is
 * the points past the knuckles that hang together, one skin, without touching the next finger's.
 * Looked for from further and further back along the hand, to take in as much of each finger as is
 * its own. Null if they can't be told apart that way: if the fingers touch.
 */
function apartFingers(mesh, hand, thumbTip) {
  const { positions, indices } = mesh;
  const tOf = new Map(hand.map((h) => [h.i, h]));
  // A model's skin is cut into patches for its picture: points at one spot count as one.
  const spot = new Map();
  const at = (i) => {
    const key = `${Math.round(positions[i * 3] * 4e3)},${Math.round(positions[i * 3 + 1] * 4e3)},${Math.round(positions[i * 3 + 2] * 4e3)}`;
    if (!spot.has(key)) spot.set(key, spot.size);
    return spot.get(key);
  };
  for (const from of [0.52, 0.57, 0.62, 0.67, 0.72]) {
    const parent = new Map();
    const find = (x) => {
      while (parent.get(x) !== x) {
        parent.set(x, parent.get(parent.get(x)));
        x = parent.get(x);
      }
      return x;
    };
    const past = (i) => {
      const h = tOf.get(i);
      // Not the thumb, which stands apart from the hand sooner.
      return h && h.t > from && !(h.u > thumbTip.u * 0.6 && h.t < thumbTip.t + 0.08);
    };
    for (let f = 0; f < indices.length; f += 3) {
      const [a, b, c] = [indices[f], indices[f + 1], indices[f + 2]];
      if (!past(a) || !past(b) || !past(c)) continue;
      const [sa, sb, sc] = [at(a), at(b), at(c)];
      for (const x of [sa, sb, sc]) if (!parent.has(x)) parent.set(x, x);
      parent.set(find(sb), find(sa));
      parent.set(find(sc), find(sa));
    }
    const bunches = new Map();
    for (const h of hand) {
      if (!past(h.i) || !parent.has(at(h.i))) continue;
      const root = find(at(h.i));
      if (!bunches.has(root)) bunches.set(root, []);
      bunches.get(root).push(h);
    }
    const total = [...bunches.values()].reduce((sum, b) => sum + b.length, 0);
    const fair = [...bunches.values()].filter((b) => b.length > total * 0.07);
    if (fair.length !== 4) continue;
    const middle = (b) => b.reduce((sum, h) => sum + h.u, 0) / b.length;
    fair.sort((x, y) => middle(y) - middle(x));
    console.log(
      `  fingers apart from ${from} along the hand: ${fair.map((b) => b.length).join(", ")} points`,
    );
    return fair;
  }
  return null;
}

function distanceToSegment(p, a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return { distance: length(sub(p, add(a, scale(ab, t)))), t };
}

/**
 * Hands each finger its own skin: whatever the hand and the knuckles moved, past the heel of the
 * hand, goes to the finger it's nearest, or the thumb. `weights` are already blended across the
 * wrist and knuckles, so the hand still bends softly where it meets the arm.
 */
export function fingerWeights(mesh, weights, boneNames, measured, side) {
  const name = side < 0 ? "R" : "L";
  const boneCount = boneNames.length;
  const index = new Map(boneNames.map((n, i) => [n, i]));
  const hand = index.get(`hand${name}`);
  const tips = index.get(`tips${name}`);
  const chains = new Map();
  for (const b of measured.bones) {
    const list = chains.get(b.finger) ?? [];
    list.push({ ...b, bone: index.get(b.name) });
    chains.set(b.finger, list);
  }
  for (const { i, t } of measured.hand) {
    if (t < 0.08) continue;
    const base = i * boneCount;
    const held = weights[base + hand] + weights[base + tips];
    if (held < 0.02) continue;
    const p = [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];
    // Nearest finger, and how near: along it, between which of its bones.
    let best = null;
    const own = measured.owner?.get(i);
    for (const [finger, list] of chains) {
      if (own && finger !== own) continue;
      for (const seg of list) {
        const { distance, t: along } = distanceToSegment(p, seg.at, seg.to);
        if (!best || distance < best.distance) best = { finger, seg, distance, along };
      }
    }
    if (!best) continue;
    if (best.finger === "thumb") {
      // The thumb takes everything the hand had there, softening in from its root.
      const into = best.seg.name.endsWith("1") ? Math.min(1, best.along * 1.6 + 0.2) : 1;
      const moved = weights[base + hand] * into + weights[base + tips];
      weights[base + hand] *= 1 - into;
      weights[base + tips] = 0;
      weights[base + best.seg.bone] += moved;
    } else {
      // A finger takes what the knuckles had: the hand keeps the palm.
      weights[base + best.seg.bone] += weights[base + tips];
      weights[base + tips] = 0;
    }
  }
}

/** The color of a model's texture at each vertex. */
export async function vertexColors(mesh, image) {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const count = mesh.positions.length / 3;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = mesh.uvs[i * 2] - Math.floor(mesh.uvs[i * 2]);
    const v = mesh.uvs[i * 2 + 1] - Math.floor(mesh.uvs[i * 2 + 1]);
    const x = Math.min(info.width - 1, Math.floor(u * info.width));
    const y = Math.min(info.height - 1, Math.floor(v * info.height));
    const at = (y * info.width + x) * info.channels;
    colors.set([data[at] / 255, data[at + 1] / 255, data[at + 2] / 255], i * 3);
  }
  return colors;
}

/**
 * Chains of bones down the hair that hangs free of the head: a ponytail, long locks, a fringe. The
 * hair's color is read off the back of the head; anything that color that stands out from the
 * skull, or hangs below the ears, is free hair. It's gathered into sectors round the head, each a
 * chain of three bones from where it leaves the scalp to its ends.
 */
export function hairChains(mesh, colors, neck, top, options, onHead = () => true) {
  const count = mesh.positions.length / 3;
  const centre = lerp3(neck, top, 0.55);
  const radius = (top[1] - neck[1]) * 0.5;
  // The back of the head is hair on anyone with hair.
  const back = [];
  for (let i = 0; i < count; i++) {
    const y = mesh.positions[i * 3 + 1];
    const x = mesh.positions[i * 3];
    if (y > centre[1] && y < top[1] && x < centre[0] - radius * 0.55) back.push(i);
  }
  const channel = (c) =>
    quantile(
      back.map((i) => colors[i * 3 + c]),
      0.5,
    );
  const hair = options.color ?? [channel(0), channel(1), channel(2)];
  const tolerance = options.tolerance ?? 0.16;
  const free = [];
  for (let i = 0; i < count; i++) {
    const p = [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];
    if (p[1] < neck[1] - radius * (options.below ?? 1.6)) continue;
    const d = Math.hypot(
      colors[i * 3] - hair[0],
      colors[i * 3 + 1] - hair[1],
      colors[i * 3 + 2] - hair[2],
    );
    if (d > tolerance) continue;
    // Hair hangs near the head: never out along the arms, nor in front of the face, and only on
    // what the head or the upper back already carries. Skin can be the color of blonde hair.
    if (!onHead(i)) continue;
    if (Math.abs(p[2] - centre[2]) > radius * 2.1) continue;
    if (p[0] > centre[0] + radius * 0.35) continue;
    const off = sub(p, centre);
    const out = length(off);
    const hangs = p[1] < centre[1] - radius * 0.55;
    const standsOut = out > radius * (options.standsOut ?? 1.12);
    if (!hangs && !standsOut) continue;
    free.push({ i, p, out, angle: Math.atan2(off[2], off[0]) });
  }
  const sectors = options.chains ?? 8;
  const chains = [];
  for (let k = 0; k < sectors; k++) {
    const from = -Math.PI + (k * 2 * Math.PI) / sectors;
    const to = from + (2 * Math.PI) / sectors;
    const mine = free.filter((h) => h.angle >= from && h.angle < to);
    if (mine.length < Math.max(30, free.length * 0.02)) continue;
    const outs = mine.map((h) => h.out);
    const marks = [0.04, 0.4, 0.7, 0.98].map((q) => quantile(outs, q));
    const joints = marks.map((m, j) => {
      const band = (marks[Math.min(3, j + 1)] - marks[Math.max(0, j - 1)]) * 0.25 + 0.005;
      const near = mine.filter((h) => Math.abs(h.out - m) <= band);
      const pick = near.length > 0 ? near : mine;
      return scale(
        pick.reduce((s, h) => add(s, h.p), [0, 0, 0]),
        1 / pick.length,
      );
    });
    chains.push({ index: chains.length, joints, marks, verts: mine });
  }
  return { chains, color: hair, count: free.length };
}

/**
 * The hair chains as bones, each hung from the head, with a fourth at each lock's tip that moves
 * nothing: it's there so the game knows where the last bone ends.
 */
export function hairBones(chains) {
  return chains.flatMap(({ index, joints }) =>
    [0, 1, 2, 3].map((k) => ({
      name: `hair${index}_${k + 1}`,
      parent: k === 0 ? "head" : `hair${index}_${k}`,
      at: joints[k],
      to: joints[k + 1],
    })),
  );
}

/**
 * Free hair goes from the head to its chain: still the head's where it leaves the scalp, the
 * chain's further down, each bone taking the stretch nearest it.
 */
export function hairWeights(weights, boneNames, chains) {
  const boneCount = boneNames.length;
  const index = new Map(boneNames.map((n, i) => [n, i]));
  const head = index.get("head");
  for (const { index: c, marks, verts } of chains) {
    const ids = [1, 2, 3].map((k) => index.get(`hair${c}_${k}`));
    for (const { i, out } of verts) {
      const base = i * boneCount;
      const r = Math.max(0, Math.min(1, (out - marks[0]) / (marks[3] - marks[0] || 1)));
      const free = Math.min(1, r / 0.18);
      for (let b = 0; b < boneCount; b++) weights[base + b] *= 1 - free;
      // Between the joints: which two bones share this stretch, and how.
      const s = marks[0] + r * (marks[3] - marks[0]);
      let seg = 0;
      while (seg < 2 && s > marks[seg + 1]) seg++;
      const within = Math.max(
        0,
        Math.min(1, (s - marks[seg]) / (marks[seg + 1] - marks[seg] || 1)),
      );
      const mine = ids[seg];
      const next = ids[Math.min(2, seg + 1)];
      const blend = seg < 2 ? Math.max(0, within - 0.6) / 0.4 : 0;
      weights[base + mine] += free * (1 - blend * 0.5);
      weights[base + next] += free * blend * 0.5;
      weights[base + head] += 0;
    }
  }
}
