// Packs the buildings Blender made (scripts/blender/make_buildings.py) for the game: each model's
// meshes squeezed with meshopt, and the two texture atlases, raiders' paint and crew's, as webp.
//
//   node scripts/pack-buildings.mjs gunTurret

import { mkdir } from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const FROM = "models-wip/buildings";
const ATLAS_QUALITY = 84;

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

await mkdir("public/models/kit", { recursive: true });
for (const name of process.argv.slice(2)) {
  const doc = await io.read(`${FROM}/${name}.glb`);
  // Empty leaves are kept: they mark spots on a model, such as where a gun's muzzle is.
  await doc.transform(
    dedup(),
    prune({ keepLeaves: true }),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  const out = `public/models/kit/${name}.glb`;
  await io.write(out, doc);
  console.log(`${out} written`);
}
for (const side of ["enemy", "crew"]) {
  const out = `public/textures/building-kit-${side}.webp`;
  await sharp(`${FROM}/kit-${side}.png`).webp({ quality: ATLAS_QUALITY }).toFile(out);
  console.log(`${out} written`);
}
