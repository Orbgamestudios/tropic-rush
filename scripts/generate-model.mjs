// Makes a 3D model of a character from one picture, with TRELLIS.2 (docs/CHARACTERS.md).
//
//   node scripts/cut-out.mjs docs/concept/tpose/captain-blank.png models-wip/captain-blank.png
//   node scripts/generate-model.mjs models-wip/captain-blank.png models-wip/captain-blank-raw.glb
//
// TRELLIS.2 needs about 24 GB of graphics memory, so it runs on Hugging Face, not here: on
// Microsoft's own Space, which takes every sampler setting. Its free allowance for a caller with no
// account is small and a run at these settings can use all of it; with HF_TOKEN set to a (free)
// Hugging Face token it has more. Nothing here is ever paid for.
//
// The picture should be a cut-out (scripts/cut-out.mjs), so the Space's own background removal has
// nothing to get wrong. The settings are the owner's, for a model that's light enough for a phone
// and keeps its fingers and beard sharp:
//   - 1024 cascade;
//   - shape: 35 steps at guidance 8, for both the rough structure and the fine shape;
//   - colour: 30 steps at guidance 1.8, low so skin and shirt don't come out burnt;
//   - remeshed, brought down to 20,000 faces, with a 2048 picture.
// `--fallback` uses the Upsampler Space instead, which takes only the size settings.

import { readFileSync, writeFileSync } from "node:fs";
import { Client, handle_file } from "@gradio/client";

const args = process.argv.slice(2);
const fallback = args.includes("--fallback");
const [image, out, seed = "42"] = args.filter((a) => !a.startsWith("--"));
if (!image || !out)
  throw new Error("node scripts/generate-model.mjs <cut-out.png> <out.glb> [seed]");

export const SETTINGS = {
  resolution: "1024",
  structure: { steps: 35, guidance: 8.0 },
  shape: { steps: 35, guidance: 8.0 },
  colour: { steps: 30, guidance: 1.8 },
  faces: 20000,
  picture: 2048,
};

const say = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const picture = handle_file(new Blob([readFileSync(image)], { type: "image/png" }));
const save = async (data) => {
  const file = data.find((d) => d?.url) ?? data[0];
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`download ${response.status}`);
  writeFileSync(out, Buffer.from(await response.arrayBuffer()));
  say("saved", out, `${(readFileSync(out).length / 1e6).toFixed(1)} MB`);
};

if (fallback) {
  const app = await Client.connect("Upsampler/trellis-2");
  say("Upsampler Space: size settings only");
  const made = await app.predict("/image_to_glb", [
    picture,
    Number(seed),
    SETTINGS.resolution,
    SETTINGS.faces,
    SETTINGS.picture,
  ]);
  await save(made.data);
} else {
  const token = process.env.HF_TOKEN;
  const app = await Client.connect("microsoft/TRELLIS.2", token ? { hf_token: token } : {});
  say("Microsoft's Space,", token ? "signed in" : "no account");
  await app.predict("/start_session", {}).catch(() => undefined);
  const ready = await app.predict("/preprocess_image", { input: picture });
  await app.predict("/image_to_3d", {
    image: ready.data[0],
    seed: Number(seed),
    resolution: SETTINGS.resolution,
    ss_guidance_strength: SETTINGS.structure.guidance,
    ss_guidance_rescale: 0.7,
    ss_sampling_steps: SETTINGS.structure.steps,
    ss_rescale_t: 5,
    shape_slat_guidance_strength: SETTINGS.shape.guidance,
    shape_slat_guidance_rescale: 0.5,
    shape_slat_sampling_steps: SETTINGS.shape.steps,
    shape_slat_rescale_t: 3,
    tex_slat_guidance_strength: SETTINGS.colour.guidance,
    tex_slat_guidance_rescale: 0,
    tex_slat_sampling_steps: SETTINGS.colour.steps,
    tex_slat_rescale_t: 3,
  });
  say("shape and colour made");
  const made = await app.predict("/extract_glb", {
    decimation_target: SETTINGS.faces,
    texture_size: SETTINGS.picture,
  });
  await save(made.data);
}
process.exit(0);
