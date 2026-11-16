// Makes the game's model of one of the story's people from what Blender built
// (docs/CHARACTERS.md).
//
//   blender -b -P scripts/blender/make_character.py -- captain --body --export
//   node scripts/pack-character.mjs captain
//
// Blender writes plain lists (models-wip/built/<who>.json and .bin): the bones, and each piece of
// the character with its points, the bones and shares of each, its colours or its place on a
// picture, and the face's shapes. This puts them together as one skeleton, every bone resting with
// no turn in it as the game's animator expects, every piece its own mesh on it, the shapes as
// shapes the game can blend, and writes public/models/<who>-hi.glb.

import { readFileSync, writeFileSync } from "node:fs";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

/** How big the pictures are, at most. */
const PICTURE = { cloth: 1024, eye: 256, face: 1024 };

const name = process.argv[2];
if (!name) throw new Error("Say who: node scripts/pack-character.mjs captain");
const built = JSON.parse(readFileSync(`models-wip/built/${name}.json`, "utf8"));
const file = readFileSync(`models-wip/built/${name}.bin`);
const blob = file.subarray(4, 4 + file.readUInt32LE(0));
const list = (Kind, [start, count]) => {
  const bytes = blob.subarray(start, start + count * Kind.BYTES_PER_ELEMENT);
  return new Kind(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = new Document();
const buffer = doc.createBuffer();
doc.createExtension(EXTTextureWebP).setRequired(true);
const accessor = (array, type) =>
  doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const scene = doc.createScene(name);

const places = new Map(built.bones.map((b) => [b.name, b.at]));
const nodes = new Map();
const skin = doc.createSkin("skeleton");
const inverse = new Float32Array(built.bones.length * 16);
built.bones.forEach((b, i) => {
  const parent = b.parent ? places.get(b.parent) : [0, 0, 0];
  const node = doc
    .createNode(b.name)
    .setTranslation([b.at[0] - parent[0], b.at[1] - parent[1], b.at[2] - parent[2]]);
  nodes.set(b.name, node);
  if (b.parent) nodes.get(b.parent).addChild(node);
  skin.addJoint(node);
  inverse.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -b.at[0], -b.at[1], -b.at[2], 1], i * 16);
});
skin.setInverseBindMatrices(accessor(inverse, "MAT4"));
skin.setSkeleton(nodes.get("root"));
scene.addChild(nodes.get("root"));

const pictures = new Map();
for (const [key, path] of Object.entries(built.pictures)) {
  const size = PICTURE[key] ?? 1024;
  const image = await sharp(path)
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  pictures.set(key, doc.createTexture(key).setMimeType("image/webp").setImage(image));
}

let triangles = 0;
for (const piece of built.pieces) {
  const indices = list(Uint32Array, piece.triangles);
  triangles += indices.length / 3;
  const prim = doc
    .createPrimitive()
    .setIndices(accessor(indices, "SCALAR"))
    .setAttribute("POSITION", accessor(list(Float32Array, piece.position), "VEC3"))
    .setAttribute("NORMAL", accessor(list(Float32Array, piece.normal), "VEC3"))
    .setAttribute("JOINTS_0", accessor(list(Uint16Array, piece.joints), "VEC4"))
    .setAttribute("WEIGHTS_0", accessor(list(Float32Array, piece.weights), "VEC4"));
  if (piece.uv) prim.setAttribute("TEXCOORD_0", accessor(list(Float32Array, piece.uv), "VEC2"));
  if (piece.colour)
    prim.setAttribute("COLOR_0", accessor(list(Float32Array, piece.colour), "VEC3"));
  const { colour, picture, rough } = piece.material;
  const material = doc
    .createMaterial(piece.name)
    .setRoughnessFactor(rough ?? 0.7)
    .setMetallicFactor(0)
    .setBaseColorFactor(colour ? [...colour, 1] : [1, 1, 1, 1]);
  if (picture) material.setBaseColorTexture(pictures.get(picture));
  prim.setMaterial(material);
  const mesh = doc.createMesh(piece.name).addPrimitive(prim);
  for (const shape of piece.shapes) {
    prim.addTarget(
      doc
        .createPrimitiveTarget(shape.name)
        .setAttribute("POSITION", accessor(list(Float32Array, shape.move), "VEC3")),
    );
  }
  if (piece.shapes.length > 0) {
    mesh.setWeights(piece.shapes.map(() => 0));
    mesh.setExtras({ targetNames: piece.shapes.map((s) => s.name) });
  }
  scene.addChild(doc.createNode(piece.name).setMesh(mesh).setSkin(skin));
}

await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
const glb = await io.writeBinary(doc);
const out = `public/models/${name}-hi.glb`;
writeFileSync(out, glb);
console.log(
  `${out}: ${(glb.length / 1e6).toFixed(2)} MB, ${built.pieces.length} pieces, ${triangles} triangles, ${built.bones.length} bones`,
);
