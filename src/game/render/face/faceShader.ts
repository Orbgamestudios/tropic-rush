// The painted parts of a blank-faced character, drawn on patches that lie on its own skin
// (docs/CHARACTERS.md, Faces). Nothing is cut into the model: its sockets, brow ridge and mouth
// pocket are left as sculpted, and these paint into them.
//
// Each patch is drawn with the model's own skin material (its picture, its roughness, the scene's
// lights), and the features are worked out per pixel from a handful of numbers, so the face moves
// every frame without a picture ever being redrawn or sent to the graphics card again. Where the
// patch paints nothing it's clear, so the lids are the face's own skin: a blink closes the opening
// and the skin is simply there. The eye and the inside of the mouth are made glossy and wet; the
// brows, lids and lips stay as matte as the skin round them.
//
// Every length is a share of the feature's own size: an eye's half-width, or the mouth's.

import * as THREE from "three";

/** The numbers one eye-and-brow patch is drawn from. */
export interface EyeUniforms {
  /** Upper lid open (1 is resting, 0 shut, more is wide), lower lid raised, lid slant, squint. */
  lids: { value: THREE.Vector4 };
  /** Where the eye looks (x out to the ear, y up, about -1 to 1), and the pupil's size. */
  gaze: { value: THREE.Vector3 };
  /** The brow's inner end, middle and outer end, raised (+) or lowered, and its base height. */
  brow: { value: THREE.Vector4 };
}

/** The numbers the mouth is drawn from: see visemes.ts for what each means. */
export interface MouthUniforms {
  /** open, wide, round, teeth showing above. */
  shapeA: { value: THREE.Vector4 };
  /** teeth showing below, tongue, lips pressed, lower lip bitten. */
  shapeB: { value: THREE.Vector4 };
  /** corners up (smile), lopsided, tension, and how wide the line is at rest. */
  mood: { value: THREE.Vector4 };
}

export interface FacePalette {
  iris: THREE.Color;
  hair: THREE.Color;
  hairShade: THREE.Color;
  lash: THREE.Color;
  lip: THREE.Color;
}

const SHARED = /* glsl */ `
varying vec2 vFace;
float faceWet = 0.0;

// A soft-edged step one pixel wide, whatever the distance from the camera.
float edge(float d) {
  float w = fwidth(d) * 0.75 + 1e-4;
  return smoothstep(w, -w, d);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Paint over: colour c at coverage a, onto what's there.
void over(inout vec4 base, vec3 c, float a) {
  base.rgb = mix(base.rgb, c, a);
  base.a = a + base.a * (1.0 - a);
}
`;

const EYE = /* glsl */ `
uniform vec4 uLids;
uniform vec3 uGaze;
uniform vec4 uBrow;
uniform vec3 uIris;
uniform vec3 uHair;
uniform vec3 uHairShade;
uniform vec3 uLash;

// The lids' edges across the eye: x from -1 (by the nose) to 1 (by the ear).
float upperLid(float x, float open, float slant) {
  float shape = pow(max(0.0, 1.0 - x * x), 0.62);
  float shut = -0.12 + 0.05 * x;
  // The top of the eye sits a little towards the nose, as eyes do.
  float rest = 0.6 * shape * (1.0 - 0.12 * x) + slant * x * 0.25;
  return mix(shut, rest, open);
}

float lowerLid(float x, float raised, float open) {
  float shape = pow(max(0.0, 1.0 - x * x), 0.9);
  float rest = -0.46 * shape - 0.02 * x;
  float shut = -0.12 + 0.05 * x;
  return mix(rest, shut, clamp(raised * 0.55 + (1.0 - clamp(open, 0.0, 1.0)) * 0.25, 0.0, 1.0));
}

vec4 eyeFeature(vec2 q, vec3 skin) {
  vec4 col = vec4(skin, 0.0);
  float open = uLids.x;
  float x = q.x;
  float y = q.y;
  float low = lowerLid(x, uLids.y, open);
  float restUp = upperLid(x, 1.0, uLids.z);
  // Shut, the upper lid comes all the way down onto the lower one, wherever that is.
  float up = mix(low, restUp, open);

  // The brow: a thick stroke along the ridge through its inner end, middle and outer end.
  float b0 = uBrow.w + uBrow.x;
  float b1 = uBrow.w + 0.2 + uBrow.y;
  float b2 = uBrow.w - 0.02 + uBrow.z;
  float xa = -0.95;
  float xb = 0.12;
  float xc = 1.18;
  // Through three points, as a curve of x.
  float la = (x - xb) * (x - xc) / ((xa - xb) * (xa - xc));
  float lb = (x - xa) * (x - xc) / ((xb - xa) * (xb - xc));
  float lc = (x - xa) * (x - xb) / ((xc - xa) * (xc - xb));
  float centre = b0 * la + b1 * lb + b2 * lc;
  float slope = b0 * (2.0 * x - xb - xc) / ((xa - xb) * (xa - xc))
    + b1 * (2.0 * x - xa - xc) / ((xb - xa) * (xb - xc))
    + b2 * (2.0 * x - xa - xb) / ((xc - xa) * (xc - xb));
  float across = (y - centre) / sqrt(1.0 + slope * slope);
  float along = clamp((x - xa) / (xc - xa), 0.0, 1.0);
  float thick = mix(0.62, 0.24, smoothstep(0.0, 1.0, along)) * (1.0 + 0.08 * uBrow.x);
  float ends = max(xa - x, x - xc);
  float browShape = max(abs(across) - thick * 0.5, ends * 1.4);
  float brow = edge(browShape);
  // Its shadow on the skin below it.
  float shade = smoothstep(0.18, 0.0, -(across + thick * 0.5)) * step(across, -thick * 0.5)
    * smoothstep(0.0, 0.1, -ends) * 0.32;
  over(col, skin * 0.72, shade);
  if (brow > 0.0) {
    float n = across / (thick * 0.5);
    // Rounded like a bevel: lit along the top, darker underneath.
    float light = 0.98 + 0.22 * n - 0.3 * n * n;
    // Hairs growing out and up from the inner end, laid along the brow towards the outer end.
    float strands = 0.86 + 0.2 * sin((x - n * mix(0.5, 0.12, along)) * 46.0 + hash12(floor(vec2(x * 30.0, n * 3.0))) * 2.0);
    vec3 hair = mix(uHairShade, uHair, smoothstep(-0.9, 0.6, n)) * light * strands;
    over(col, hair, brow);
  }

  // The crease above the lid, and the shadow the brow ridge throws into the socket.
  float crease = abs(y - (restUp + 0.3 + 0.03 * x)) ;
  float creaseShade = smoothstep(0.07, 0.0, crease) * smoothstep(1.05, 0.6, abs(x)) * 0.28;
  over(col, skin * 0.68, creaseShade);
  float socket = smoothstep(1.25, 0.2, length(vec2(x * 0.85, (y - 0.15) * 1.1))) * 0.14;
  over(col, skin * 0.75, socket * step(y, restUp + 0.25));

  // The eye itself, inside the lids.
  float inside = edge(max(max(y - up, low - y), abs(x) - 1.0));
  if (inside > 0.0) {
    // The white: warm, shaded under the upper lid and towards the corners.
    float underLid = exp(-(up - y) * 7.0);
    float corner = smoothstep(0.55, 1.0, abs(x));
    vec3 white = vec3(0.86, 0.82, 0.78) * (1.0 - 0.5 * underLid) * (1.0 - 0.28 * corner);
    // Pink by the nose.
    white = mix(white, vec3(0.75, 0.42, 0.38), smoothstep(-0.7, -0.98, x) * 0.6);
    vec3 eye = white;
    // The iris, where the eye looks.
    vec2 at = vec2(uGaze.x * 0.42, uGaze.y * 0.22 - 0.04);
    vec2 d = q - at;
    float r = length(d);
    float R = 0.46;
    float iris = edge(r - R);
    if (iris > 0.0) {
      float a = atan(d.y, d.x);
      float fibres = 0.82 + 0.18 * sin(a * 31.0 + sin(a * 7.0) * 2.0) * (0.5 + 0.5 * sin(r * 40.0));
      vec3 ring = mix(uIris * 1.5, uIris, smoothstep(0.1, 0.32, r / R * 0.5));
      vec3 irisCol = mix(ring, uIris * 0.32, smoothstep(0.72, 0.98, r / R)) * fibres;
      // A warmer ring round the pupil.
      irisCol = mix(irisCol, uIris * 1.9 + vec3(0.03, 0.015, 0.0), smoothstep(0.62, 0.42, r / R) * 0.5);
      irisCol *= 1.0 - 0.55 * underLid;
      float pupil = edge(r - R * 0.4 * uGaze.z);
      irisCol = mix(irisCol, vec3(0.008, 0.006, 0.005), pupil);
      eye = mix(eye, irisCol, iris);
    }
    // Two catchlights, as the sky and a fill would leave on a wet eye.
    float glint = edge(length(q - at - vec2(-0.16, 0.17)) - 0.1);
    float glint2 = edge(length(q - at - vec2(0.14, -0.13)) - 0.045);
    eye = mix(eye, vec3(1.0), max(glint, glint2 * 0.7));
    over(col, eye, inside);
    faceWet = inside;
  }

  // Lashes: a strong dark line along the upper lid, swept out past the outer corner, and a fine
  // one under the lower lid.
  float lashWidth = 0.075 + 0.07 * smoothstep(0.1, 1.0, x);
  float upperLash = edge(max(abs(y - up - lashWidth * 0.5) - lashWidth * 0.5, abs(x) - 1.02));
  float wing = edge(max(abs(y - (up + (x - 1.0) * 0.35) - 0.02) - 0.035 * (1.25 - x) * 2.5, max(1.0 - x, x - 1.22)));
  float lowerLash = edge(max(abs(y - low + 0.01) - 0.018, abs(x) - 0.92)) * 0.55 * clamp(open, 0.0, 1.0);
  over(col, uLash, max(max(upperLash, wing), lowerLash));
  return col;
}
`;

const MOUTH = /* glsl */ `
uniform vec4 uShapeA;
uniform vec4 uShapeB;
uniform vec4 uMood;
uniform vec3 uLip;

vec4 mouthFeature(vec2 q, vec3 skin) {
  vec4 col = vec4(skin, 0.0);
  float open = uShapeA.x;
  float wide = uShapeA.y;
  float round = uShapeA.z;
  float press = uShapeB.z;
  float bite = uShapeB.w;
  float w = uMood.w * wide * (1.0 - 0.32 * round);
  float x = q.x;
  float u = x / w;
  // The line of the mouth: its corners up for a smile, one higher than the other when lopsided.
  float corners = (uMood.x + uMood.y * sign(x) * 0.6) * 0.16;
  float line = corners * u * u - 0.03 * uMood.z * u * u;
  float shape = max(0.0, 1.0 - u * u);
  float top = line + open * 0.44 * pow(shape, 0.7 - round * 0.35);
  float bottom = line - open * 0.66 * pow(shape, 0.8 - round * 0.4) - 0.01;
  float parted = smoothstep(0.03, 0.1, open);
  float inMouth = edge(max(max(q.y - top, bottom - q.y), abs(u) - 1.0)) * parted;
  float lipTone = 0.92 - 0.12 * press;
  vec3 lip = skin * uLip * lipTone;

  // The lips: a thin upper lip above the line or the opening, a fuller lower lip under it.
  float upperLip = edge(max(abs(q.y - (top + 0.05)) - 0.05 - 0.02 * press, abs(u) - 1.02));
  float lowerY = bottom - 0.08 + bite * 0.07;
  float lowerLip = edge(max(abs(q.y - lowerY) - 0.075 - 0.02 * press, abs(u) - 0.95));
  float lipHighlight = smoothstep(0.06, 0.0, abs(q.y - (lowerY + 0.02))) * lowerLip * shape;
  // At rest the lips are only a hint; they fill out as the mouth opens or presses.
  float lipShow = 0.3 + 0.7 * max(parted, press);
  over(col, lip, upperLip * 0.7 * lipShow * smoothstep(1.0, 0.75, abs(u)));
  over(col, lip * (1.0 + 0.25 * lipHighlight), lowerLip * 0.8 * lipShow * smoothstep(1.0, 0.7, abs(u)));
  faceWet = max(faceWet, lipHighlight * 0.4);

  if (inMouth > 0.0) {
    // The dark inside, darkest deep in the middle.
    float deep = length(vec2(u, (q.y - (top + bottom) * 0.5) / max(0.05, (top - bottom) * 0.6)));
    vec3 inside = mix(vec3(0.05, 0.008, 0.012), vec3(0.22, 0.045, 0.05), smoothstep(0.2, 1.0, deep));
    // Upper teeth hang from the top lip; lower teeth stand on the lower one.
    float upH = 0.085 * uShapeA.w + 0.05 * bite;
    float teethUp = edge(max(q.y - top, top - upH - q.y)) * smoothstep(1.0, 0.8, abs(u));
    float downH = 0.06 * uShapeB.x;
    float teethDown = edge(max(q.y - bottom - downH, bottom - q.y)) * smoothstep(0.95, 0.7, abs(u));
    float gaps = 0.9 + 0.1 * smoothstep(0.02, 0.0, abs(fract(u * 3.2 + 0.5) - 0.5));
    vec3 tooth = vec3(0.82, 0.79, 0.72) * (0.78 + 0.22 * smoothstep(1.0, 0.2, abs(u))) * (2.0 - gaps);
    // The tongue, low and forward.
    float tongue = edge(length(vec2(u * 0.9, (q.y - bottom - 0.04) / max(0.04, 0.16 * uShapeB.y))) - 0.85)
      * step(0.05, uShapeB.y);
    vec3 tongueCol = vec3(0.6, 0.2, 0.22) * (0.8 + 0.3 * smoothstep(-0.2, 0.1, q.y - bottom - 0.04));
    inside = mix(inside, tongueCol, tongue);
    inside = mix(inside, tooth * 0.85, teethDown);
    inside = mix(inside, tooth, teethUp);
    over(col, inside, inMouth);
    faceWet = max(faceWet, inMouth * (0.4 + 0.4 * max(teethUp, tongue)));
  }

  // Shut, the mouth is a soft dark crease with a little shade at the corners.
  float shut = 1.0 - smoothstep(0.02, 0.08, open);
  float crease = edge(max(abs(q.y - line) - 0.012 - 0.01 * press, abs(u) - 0.98)) * shut;
  float cornerShade = smoothstep(0.12, 0.0, length(vec2((abs(u) - 1.0) * 1.4, q.y - line))) * 0.4;
  over(col, skin * 0.42, crease * 0.85);
  over(col, skin * 0.7, cornerShade);
  return col;
}
`;

export interface FacePatchMaterialOptions {
  kind: "eye" | "mouth";
  /**
   * The skin under the patches, as pictures of their own (see scripts/blender/face_map.py), and how
   * rough the skin is, so the patches are lit as the face round them is.
   */
  skin: THREE.Texture;
  roughness: number;
  palette: FacePalette;
  eye?: EyeUniforms;
  mouth?: MouthUniforms;
}

/** A material that draws the model's skin and paints a feature over it. */
export function facePatchMaterial(options: FacePatchMaterialOptions): THREE.MeshStandardMaterial {
  const { skin, palette, kind, roughness } = options;
  const material = new THREE.MeshStandardMaterial({
    map: skin,
    roughness,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  material.name = `face-${kind}`;
  const linear = (c: THREE.Color) => c.clone();
  material.onBeforeCompile = (shader) => {
    if (kind === "eye" && options.eye) {
      shader.uniforms.uLids = options.eye.lids;
      shader.uniforms.uGaze = options.eye.gaze;
      shader.uniforms.uBrow = options.eye.brow;
      shader.uniforms.uIris = { value: linear(palette.iris) };
      shader.uniforms.uHair = { value: linear(palette.hair) };
      shader.uniforms.uHairShade = { value: linear(palette.hairShade) };
      shader.uniforms.uLash = { value: linear(palette.lash) };
    }
    if (kind === "mouth" && options.mouth) {
      shader.uniforms.uShapeA = options.mouth.shapeA;
      shader.uniforms.uShapeB = options.mouth.shapeB;
      shader.uniforms.uMood = options.mouth.mood;
      shader.uniforms.uLip = { value: linear(palette.lip) };
    }
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aFace;\nvarying vec2 vFace;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFace = aFace;");
    const feature = kind === "eye" ? "eyeFeature" : "mouthFeature";
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${SHARED}\n${kind === "eye" ? EYE : MOUTH}`)
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>\n{\n  vec4 painted = ${feature}(vFace, diffuseColor.rgb);\n  diffuseColor = vec4(painted.rgb, painted.a * opacity);\n}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.07, faceWet);",
      );
  };
  // One program for every face that's the same kind of feature.
  material.customProgramCacheKey = () => `face-${kind}`;
  return material;
}

export function eyeUniforms(): EyeUniforms {
  return {
    lids: { value: new THREE.Vector4(1, 0, 0, 0) },
    gaze: { value: new THREE.Vector3(0, 0, 1) },
    brow: { value: new THREE.Vector4(0, 0, 0, 1.25) },
  };
}

export function mouthUniforms(): MouthUniforms {
  return {
    shapeA: { value: new THREE.Vector4(0, 1, 0, 0) },
    shapeB: { value: new THREE.Vector4(0, 0, 0, 0) },
    mood: { value: new THREE.Vector4(0.1, 0, 0, 0.62) },
  };
}
