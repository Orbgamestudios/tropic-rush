// Packs a GLB tighter without losing its look: the points, UVs and bone shares are stored as
// small whole numbers and compressed (meshopt), which three.js unpacks as it loads. Every triangle
// and every pixel of the pictures is kept.
//
//   node scripts/pack-glb.mjs <in.glb> <out.glb>

import { writeFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt, prune } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const [input, output] = process.argv.slice(2);
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(input);
for (const texture of doc.getRoot().listTextures()) {
  console.log(
    `  picture ${texture.getName() || "?"}: ${texture.getMimeType()}, ${(texture.getImage().length / 1e6).toFixed(2)} MB`,
  );
}
await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: "high" }));
const glb = await io.writeBinary(doc);
writeFileSync(output, glb);
console.log(`${output}: ${(glb.length / 1e6).toFixed(2)} MB`);
