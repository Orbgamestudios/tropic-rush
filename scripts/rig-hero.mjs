// Turns a TRELLIS model into a hero the game can animate: drops stray scraps (TRELLIS models the
// shadow under the feet), stands it on the ground facing +x, smooths its surface, gives it a
// skeleton from the joints listed below, works out how much each bone moves each vertex, and writes
// two copies: a light one for raids and a detailed one for the hero screen. The Tank is one solid
// piece, so it lists a size instead of joints and gets no skeleton.
//
//   node scripts/rig-hero.mjs rifleman
//
// Joints are [sideways, up, forward] as shares of the model's height, read off its outline. Limbs
// are listed for one side and mirrored. Every bone rests with no rotation, so the animator can turn
// it about the hero's own axes whatever the model looks like.

import { writeFileSync } from "node:fs";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const HEROES = {
  rifleman: {
    source: "models-wip/rifleman-tpose-raw.glb",
    out: "public/models/rifleman",
    joints: {
      hip: [0.08, 0.265, -0.04],
      knee: [0.08, 0.155, -0.045],
      ankle: [0.085, 0.07, -0.05],
      toe: [0.1, 0.03, 0.07],
      waist: [0, 0.42, -0.03],
      neck: [0, 0.79, -0.015],
      top: [0, 1, 0.01],
      shoulder: [0.175, 0.69, -0.03],
      elbow: [0.33, 0.665, -0.03],
      wrist: [0.48, 0.64, -0.03],
      fingers: [0.63, 0.625, -0.03],
    },
  },
  medic: {
    source: "models-wip/medic-raw.glb",
    out: "public/models/medic",
    joints: {
      hip: [0.065, 0.26, 0.09],
      knee: [0.065, 0.15, 0.09],
      ankle: [0.07, 0.06, 0.085],
      toe: [0.08, 0.02, 0.17],
      waist: [0, 0.44, 0.1],
      neck: [0, 0.63, 0.09],
      top: [0, 1, 0],
      shoulder: [0.125, 0.565, 0.1],
      elbow: [0.235, 0.56, 0.1],
      wrist: [0.345, 0.555, 0.1],
      fingers: [0.455, 0.55, 0.1],
    },
  },
  bazooka: {
    source: "models-wip/bazooka-raw.glb",
    out: "public/models/bazooka",
    joints: {
      hip: [0.08, 0.41, 0],
      knee: [0.085, 0.225, 0],
      ankle: [0.09, 0.08, 0],
      toe: [0.1, 0.03, 0.09],
      waist: [0, 0.53, 0.02],
      neck: [0, 0.755, 0.01],
      top: [0, 1, 0],
      shoulder: [0.095, 0.7, 0.02],
      elbow: [0.21, 0.7, 0.02],
      wrist: [0.335, 0.695, 0.02],
      fingers: [0.5, 0.69, 0.02],
    },
  },
  engineer: {
    source: "models-wip/engineer-raw.glb",
    out: "public/models/engineer",
    joints: {
      hip: [0.1, 0.3, -0.015],
      knee: [0.1, 0.175, -0.02],
      ankle: [0.11, 0.085, -0.02],
      toe: [0.12, 0.03, 0.1],
      waist: [0, 0.46, 0],
      neck: [0, 0.74, 0],
      top: [0, 1, 0.01],
      shoulder: [0.17, 0.635, 0],
      elbow: [0.32, 0.62, 0],
      wrist: [0.47, 0.605, 0],
      fingers: [0.62, 0.6, 0],
    },
  },
  grenadier: {
    source: "models-wip/grenadier-raw.glb",
    out: "public/models/grenadier",
    joints: {
      hip: [0.075, 0.26, -0.03],
      knee: [0.08, 0.15, -0.035],
      ankle: [0.085, 0.07, -0.035],
      toe: [0.1, 0.03, 0.07],
      waist: [0, 0.42, -0.02],
      neck: [0, 0.77, -0.01],
      top: [0, 1, 0],
      shoulder: [0.16, 0.675, -0.02],
      elbow: [0.29, 0.665, -0.02],
      wrist: [0.42, 0.655, -0.02],
      fingers: [0.565, 0.64, -0.02],
    },
  },
  heavy: {
    source: "models-wip/heavy-raw.glb",
    out: "public/models/heavy",
    joints: {
      hip: [0.08, 0.295, -0.03],
      knee: [0.085, 0.165, -0.035],
      ankle: [0.095, 0.07, -0.04],
      toe: [0.11, 0.03, 0.065],
      waist: [0, 0.45, 0],
      neck: [0, 0.8, 0.02],
      top: [0, 1, 0.03],
      shoulder: [0.19, 0.705, 0],
      elbow: [0.335, 0.695, 0],
      wrist: [0.49, 0.69, 0],
      fingers: [0.67, 0.685, 0],
    },
  },
  tank: {
    source: "models-wip/tank-raw.glb",
    out: "public/models/tank",
    height: 2.6,
    middle: -0.1,
  },
};

/** The two copies written: light for raids, detailed for the hero screen. */
const COPIES = [
  { suffix: "rig", triangles: 7000, texture: 512, quality: 80 },
  { suffix: "hi", triangles: 32000, texture: 1024, quality: 90 },
];
const HERO_HEIGHT = 2.25;
/** Passes of blending each vertex's bones with its neighbors', so joints bend softly. */
const WEIGHT_PASSES = 30;
/** How far along the hand the knuckles are. */
const KNUCKLES = 0.42;
/** Pieces with less than this share of the triangles are thrown away. */
const SCRAP = 0.0005;
/** So is anything this flat lying this close to the ground, as shares of height: a modeled shadow. */
const SHADOW_THICKNESS = 0.012;
const SHADOW_HEIGHT = 0.02;

const name = process.argv[2];
const hero = HEROES[name];
if (!hero) throw new Error(`Say which hero: ${Object.keys(HEROES).join(", ")}`);

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

/** Positions, normals, uvs and triangles, with the node's own transform applied. */
function flatMesh(doc) {
  const node = doc
    .getRoot()
    .listNodes()
    .find((n) => n.getMesh());
  const m = node.getWorldMatrix();
  const prim = node.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute("POSITION");
  const nor = prim.getAttribute("NORMAL");
  const uv = prim.getAttribute("TEXCOORD_0");
  const count = pos.getCount();
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const p = [0, 0, 0];
  const n = [0, 0, 0];
  const t = [0, 0];
  for (let i = 0; i < count; i++) {
    pos.getElement(i, p);
    nor.getElement(i, n);
    uv.getElement(i, t);
    positions[i * 3] = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    positions[i * 3 + 1] = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    positions[i * 3 + 2] = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
    const size = Math.hypot(n[0], n[1], n[2]) || 1;
    normals.set([n[0] / size, n[1] / size, n[2] / size], i * 3);
    uvs.set(t, i * 2);
  }
  const indices = Uint32Array.from(prim.getIndices().getArray());
  return { positions, normals, uvs, indices, texture: prim.getMaterial().getBaseColorTexture() };
}

/** Keeps the pieces that matter, going by which vertices touch once uv seams are ignored. */
function dropScraps(mesh) {
  const { positions, indices } = mesh;
  const count = positions.length / 3;
  const sameSpot = new Map();
  const parent = new Int32Array(count).map((_, i) => i);
  const find = (i) => {
    let at = i;
    while (parent[at] !== at) {
      parent[at] = parent[parent[at]];
      at = parent[at];
    }
    return at;
  };
  const join = (a, b) => {
    parent[find(a)] = find(b);
  };
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(positions[i * 3] * 2e4)},${Math.round(positions[i * 3 + 1] * 2e4)},${Math.round(positions[i * 3 + 2] * 2e4)}`;
    const other = sameSpot.get(key);
    if (other === undefined) sameSpot.set(key, i);
    else join(i, other);
  }
  for (let i = 0; i < indices.length; i += 3) {
    join(indices[i], indices[i + 1]);
    join(indices[i], indices[i + 2]);
  }
  const pieces = new Map();
  let bottom = Number.POSITIVE_INFINITY;
  let top = Number.NEGATIVE_INFINITY;
  for (const v of indices) {
    const y = positions[v * 3 + 1];
    bottom = Math.min(bottom, y);
    top = Math.max(top, y);
    const root = find(v);
    const piece = pieces.get(root) ?? { size: 0, low: y, high: y };
    piece.size++;
    piece.low = Math.min(piece.low, y);
    piece.high = Math.max(piece.high, y);
    pieces.set(root, piece);
  }
  const height = top - bottom;
  const triangles = indices.length / 3;
  const keep = (piece) =>
    piece.size / 3 / triangles >= SCRAP &&
    !(
      piece.high - piece.low < height * SHADOW_THICKNESS &&
      piece.high - bottom < height * SHADOW_HEIGHT
    );
  const kept = [];
  for (let i = 0; i < indices.length; i += 3) {
    if (keep(pieces.get(find(indices[i])))) kept.push(indices[i], indices[i + 1], indices[i + 2]);
  }
  console.log(`  pieces ${pieces.size}, kept triangles ${kept.length / 3} of ${triangles}`);
  return { ...mesh, indices: Uint32Array.from(kept) };
}

/** Which vertices share a spot: uv seams split them, and the surface shouldn't show it. */
function spots(mesh) {
  const { positions } = mesh;
  const count = positions.length / 3;
  const seen = new Map();
  const group = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(positions[i * 3] * 5e3)},${Math.round(positions[i * 3 + 1] * 5e3)},${Math.round(positions[i * 3 + 2] * 5e3)}`;
    if (!seen.has(key)) seen.set(key, seen.size);
    group[i] = seen.get(key);
  }
  return { group, count: seen.size };
}

/** Normals worked out across uv seams, so they don't show as lines on the skin. */
function smoothNormals(mesh) {
  const { positions, indices, normals } = mesh;
  const { group, count } = spots(mesh);
  const sum = new Float32Array(count * 3);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]];
    const ux = positions[b * 3] - positions[a * 3];
    const uy = positions[b * 3 + 1] - positions[a * 3 + 1];
    const uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const vx = positions[c * 3] - positions[a * 3];
    const vy = positions[c * 3 + 1] - positions[a * 3 + 1];
    const vz = positions[c * 3 + 2] - positions[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      const g = group[v];
      sum[g * 3] += nx;
      sum[g * 3 + 1] += ny;
      sum[g * 3 + 2] += nz;
    }
  }
  for (let i = 0; i < group.length; i++) {
    const g = group[i];
    const size = Math.hypot(sum[g * 3], sum[g * 3 + 1], sum[g * 3 + 2]) || 1;
    normals[i * 3] = sum[g * 3] / size;
    normals[i * 3 + 1] = sum[g * 3 + 1] / size;
    normals[i * 3 + 2] = sum[g * 3 + 2] / size;
  }
}

/** Blends each vertex's bones with its neighbors', spreading a bend over a joint. */
function smoothWeights(mesh, weights, boneCount) {
  const { group, count } = spots(mesh);
  const links = Array.from({ length: count }, () => new Set());
  const { indices } = mesh;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [group[indices[i]], group[indices[i + 1]], group[indices[i + 2]]];
    links[a].add(b).add(c);
    links[b].add(a).add(c);
    links[c].add(a).add(b);
  }
  let now = new Float32Array(count * boneCount);
  for (let i = 0; i < group.length; i++) {
    now.set(weights.subarray(i * boneCount, (i + 1) * boneCount), group[i] * boneCount);
  }
  let next = new Float32Array(now.length);
  for (let pass = 0; pass < WEIGHT_PASSES; pass++) {
    for (let g = 0; g < count; g++) {
      const near = links[g];
      for (let b = 0; b < boneCount; b++) {
        let total = 0;
        for (const n of near) total += now[n * boneCount + b];
        next[g * boneCount + b] =
          near.size > 0
            ? now[g * boneCount + b] * 0.5 + (total / near.size) * 0.5
            : now[g * boneCount + b];
      }
    }
    [now, next] = [next, now];
  }
  const out = new Float32Array(weights.length);
  for (let i = 0; i < group.length; i++) {
    const from = group[i] * boneCount;
    out.set(now.subarray(from, from + boneCount), i * boneCount);
  }
  return out;
}

/** The four bones that matter most to each vertex, as the file wants them. */
function topFour(weights, boneCount) {
  const count = weights.length / boneCount;
  const joints = new Uint8Array(count * 4);
  const top = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const ranked = [...weights.subarray(i * boneCount, (i + 1) * boneCount)]
      .map((weight, bone) => ({ weight, bone }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 4);
    const sum = ranked.reduce((total, r) => total + r.weight, 0) || 1;
    ranked.forEach((r, k) => {
      joints[i * 4 + k] = r.bone;
      top[i * 4 + k] = r.weight / sum;
    });
  }
  return { joints, weights: top };
}

/** A copy with this many triangles, keeping only the vertices it still uses. */
function reduced(mesh, skin, triangles) {
  const { positions, normals, uvs, indices } = mesh;
  const [cut, error] = MeshoptSimplifier.simplifyWithAttributes(
    indices,
    positions,
    3,
    normals,
    3,
    [0.6, 0.6, 0.6],
    null,
    triangles * 3,
    0.1,
    [],
  );
  console.log(`  ${cut.length / 3} triangles, error ${error.toFixed(4)}`);
  const map = new Map();
  const remapped = new Uint32Array(cut.length);
  cut.forEach((v, i) => {
    if (!map.has(v)) map.set(v, map.size);
    remapped[i] = map.get(v);
  });
  const count = map.size;
  const out = {
    positions: new Float32Array(count * 3),
    normals: new Float32Array(count * 3),
    uvs: new Float32Array(count * 2),
    indices: remapped,
  };
  const joints = new Uint8Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (const [v, i] of map) {
    out.positions.set(positions.subarray(v * 3, v * 3 + 3), i * 3);
    out.normals.set(normals.subarray(v * 3, v * 3 + 3), i * 3);
    out.uvs.set(uvs.subarray(v * 2, v * 2 + 2), i * 2);
    if (!skin) continue;
    joints.set(skin.joints.subarray(v * 4, v * 4 + 4), i * 4);
    weights.set(skin.weights.subarray(v * 4, v * 4 + 4), i * 4);
  }
  return { mesh: out, skin: skin && { joints, weights } };
}

/** Drops unused vertices, stands the model on the ground and turns it to face +x. */
function placed(mesh) {
  const { positions, normals, uvs, indices } = mesh;
  const map = new Map();
  const remapped = new Uint32Array(indices.length);
  indices.forEach((v, i) => {
    if (!map.has(v)) map.set(v, map.size);
    remapped[i] = map.get(v);
  });
  const count = map.size;
  const out = {
    positions: new Float32Array(count * 3),
    normals: new Float32Array(count * 3),
    uvs: new Float32Array(count * 2),
    indices: remapped,
  };
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const v of map.keys()) {
    low = Math.min(low, positions[v * 3 + 1]);
    high = Math.max(high, positions[v * 3 + 1]);
  }
  const height = high - low;
  const scale = (hero.height ?? HERO_HEIGHT) / height;
  // Stood so the feet are under the middle of the hero, wherever TRELLIS left the body.
  const middle = (hero.middle ?? hero.joints.ankle[2]) * height;
  for (const [v, i] of map) {
    const [x, y, z] = [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]];
    out.positions.set([(z - middle) * scale, (y - low) * scale, -x * scale], i * 3);
    out.normals.set([normals[v * 3 + 2], normals[v * 3 + 1], -normals[v * 3]], i * 3);
    out.uvs.set([uvs[v * 2], uvs[v * 2 + 1]], i * 2);
  }
  return out;
}

/** [sideways, up, forward] as shares of height, to the hero's own meters. */
function spot(joint, side) {
  const [across, up, forward] = joint;
  const middle = hero.joints.ankle[2];
  return [(forward - middle) * HERO_HEIGHT, up * HERO_HEIGHT, -across * side * HERO_HEIGHT];
}

/** The skeleton, parents first. `to` is where the bone ends, and `reach` how thick it is. */
function skeleton(joints) {
  const j = joints;
  const middle = (p) => [p[0], p[1], 0];
  const knuckle = j.wrist.map((v, i) => v + (j.fingers[i] - v) * KNUCKLES);
  const bones = [
    { name: "root", parent: null, at: [0, 0, 0] },
    { name: "lower", parent: "root", at: [0, 0, 0], from: middle(j.hip), to: j.waist, reach: 0.16 },
    { name: "upper", parent: "root", at: j.waist, to: j.neck, reach: 0.2 },
    { name: "head", parent: "upper", at: j.neck, to: j.top, reach: 0.15 },
  ];
  for (const [suffix, side] of [
    ["R", -1],
    ["L", 1],
  ]) {
    const limb = (joint) => joint.map((v, i) => (i === 0 ? v * side : v));
    bones.push(
      {
        name: `arm${suffix}`,
        parent: "upper",
        at: limb(j.shoulder),
        to: limb(j.elbow),
        reach: 0.075,
        side,
      },
      {
        name: `fore${suffix}`,
        parent: `arm${suffix}`,
        at: limb(j.elbow),
        to: limb(j.wrist),
        reach: 0.07,
        side,
      },
      {
        name: `hand${suffix}`,
        parent: `fore${suffix}`,
        at: limb(j.wrist),
        to: limb(knuckle),
        reach: 0.06,
        side,
      },
      {
        name: `tips${suffix}`,
        parent: `hand${suffix}`,
        at: limb(knuckle),
        to: limb(j.fingers),
        reach: 0.05,
        side,
      },
      {
        name: `leg${suffix}`,
        parent: "lower",
        at: limb(j.hip),
        to: limb(j.knee),
        reach: 0.085,
        side,
        below: j.waist[1],
      },
      {
        name: `knee${suffix}`,
        parent: `leg${suffix}`,
        at: limb(j.knee),
        to: limb(j.ankle),
        reach: 0.07,
        side,
        below: j.hip[1],
      },
      {
        name: `foot${suffix}`,
        parent: `knee${suffix}`,
        at: limb(j.ankle),
        to: limb(j.toe),
        reach: 0.065,
        side,
        below: j.knee[1],
      },
    );
  }
  return bones;
}

function distanceToBone(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const length = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = length > 0 ? (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / length : 0;
  const along = Math.max(0, Math.min(1, t));
  return Math.hypot(ap[0] - ab[0] * along, ap[1] - ab[1] * along, ap[2] - ab[2] * along);
}

/** How much each bone moves each vertex, before any blending. */
function skinWeights(mesh, bones) {
  const count = mesh.positions.length / 3;
  const weights = new Float32Array(count * bones.length);
  const shaped = bones.map((b, index) => ({
    ...b,
    index,
    start: spot(b.from ?? b.at, 1),
    end: b.to ? spot(b.to, 1) : null,
  }));
  for (let i = 0; i < count; i++) {
    const p = [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];
    const up = p[1] / HERO_HEIGHT;
    let best = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const b of shaped) {
      if (!b.end) continue;
      // A limb only takes what's on its own side, and legs nothing above them.
      if (b.side && p[2] * b.side > 0 && Math.abs(p[2]) > 0.01) continue;
      if (b.below !== undefined && up > b.below) continue;
      const score = distanceToBone(p, b.start, b.end) / (b.reach * HERO_HEIGHT);
      if (score < bestScore) {
        bestScore = score;
        best = b.index;
      }
    }
    weights[i * bones.length + best] = 1;
  }
  return weights;
}

async function write(mesh, skin, bones, image) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const accessor = (array, type) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setIndices(accessor(Uint16Array.from(mesh.indices), "SCALAR"))
    .setAttribute("POSITION", accessor(mesh.positions, "VEC3"))
    .setAttribute("NORMAL", accessor(mesh.normals, "VEC3"))
    .setAttribute("TEXCOORD_0", accessor(mesh.uvs, "VEC2"));
  const texture = doc.createTexture("skin").setMimeType("image/webp").setImage(image);
  prim.setMaterial(
    doc
      .createMaterial("skin")
      .setBaseColorTexture(texture)
      .setRoughnessFactor(1)
      .setMetallicFactor(0),
  );

  const body = doc.createNode("body").setMesh(doc.createMesh("body").addPrimitive(prim));
  const scene = doc.createScene("hero").addChild(body);
  if (skin) {
    prim
      .setAttribute("JOINTS_0", accessor(skin.joints, "VEC4"))
      .setAttribute("WEIGHTS_0", accessor(skin.weights, "VEC4"));
    scene.addChild(skeletonNodes(doc, bones, body, accessor));
  }
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  return io.writeBinary(doc);
}

/** The bones as nodes, with the body skinned to them. Returns the root bone. */
function skeletonNodes(doc, bones, body, accessor) {
  const nodes = new Map();
  const places = new Map();
  const skinNode = doc.createSkin("skeleton");
  const inverse = new Float32Array(bones.length * 16);
  bones.forEach((b, i) => {
    const place = spot(b.at, 1);
    const parent = b.parent ? places.get(b.parent) : [0, 0, 0];
    const node = doc
      .createNode(b.name)
      .setTranslation([place[0] - parent[0], place[1] - parent[1], place[2] - parent[2]]);
    nodes.set(b.name, node);
    places.set(b.name, place);
    if (b.parent) nodes.get(b.parent).addChild(node);
    skinNode.addJoint(node);
    inverse.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -place[0], -place[1], -place[2], 1], i * 16);
  });
  skinNode.setInverseBindMatrices(accessor(inverse, "MAT4"));
  const root = nodes.get("root");
  skinNode.setSkeleton(root);
  body.setSkin(skinNode);
  return root;
}

const source = await io.read(hero.source);
const flat = flatMesh(source);
console.log(`${name}: ${flat.indices.length / 3} triangles`);
const full = placed(dropScraps(flat));
smoothNormals(full);
const bones = hero.joints ? skeleton(hero.joints) : null;
const skin =
  bones && topFour(smoothWeights(full, skinWeights(full, bones), bones.length), bones.length);
for (const copy of COPIES) {
  const made = reduced(full, skin, copy.triangles);
  const image = await sharp(flat.texture.getImage())
    .resize(copy.texture, copy.texture, { fit: "inside" })
    .webp({ quality: copy.quality })
    .toBuffer();
  const glb = await write(made.mesh, made.skin, bones, image);
  const out = `${hero.out}-${copy.suffix}.glb`;
  writeFileSync(out, glb);
  console.log(`  ${out}: ${(glb.length / 1024) | 0} KB, texture ${(image.length / 1024) | 0} KB`);
}
