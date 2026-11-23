// The painted parts of a blank-faced character, drawn on patches that lie on its own skin
// (docs/CHARACTERS.md, Faces). Nothing is cut into the model: its sockets, brow ridge and mouth
// pocket are left as sculpted, and these paint into them.
//
// Each patch is drawn with the model's own skin material (its picture, its roughness, the scene's
// lights), and the features are worked out per pixel from a handful of numbers, so the face moves
// every frame without a picture ever being redrawn or sent to the graphics card again. Where the
// patch paints nothing it's clear, so the lids are the face's own skin: a blink closes the opening
// and the skin is simply there. The eye and the inside of the mouth are a little glossier than the
// skin, with no lamp reflected in them; the brows, lids and lips stay as matte as the skin round them.
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
  /** Where the brow's head starts, across the socket (negative, towards the nose). */
  browFrom: { value: number };
}

/** Where a brow's head starts unless a face says otherwise: in over the root of the nose. */
export const BROW_FROM = -1.04;

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
uniform float uBrowFrom;
uniform vec3 uIris;
uniform vec3 uHair;
uniform vec3 uHairShade;
uniform vec3 uLash;

// The lids' edges across the eye: x from -1 (by the nose) to 1 (by the ear). A human eye's opening
// (the owner's call, 2026-11-22: human, not cartoon): about a third as tall as it's wide, an almond,
// the upper lid at its highest a little in towards the nose and the lower at its lowest a little out
// towards the ear, and the outer corner a touch higher than the inner, the eye tilting up.
float lidAcross(float x, float peak) {
  return x < peak ? (x - peak) / (1.0 + peak) : (x - peak) / (1.0 - peak);
}

float upperLid(float x, float open, float slant) {
  float s = lidAcross(x, -0.18);
  float rest = 0.38 * pow(max(0.0, 1.0 - s * s), 0.75) + 0.07 * x + slant * x * 0.2;
  float shut = -0.1 + 0.07 * x;
  return mix(shut, rest, open);
}

float lowerLid(float x, float raised, float open) {
  float s = lidAcross(x, 0.2);
  // Shallow: a lower lid that dipped far showed white under the iris, a stare.
  float rest = -0.21 * pow(max(0.0, 1.0 - s * s), 1.2) + 0.07 * x;
  float shut = -0.1 + 0.07 * x;
  return mix(rest, shut, clamp(raised * 0.55 + (1.0 - clamp(open, 0.0, 1.0)) * 0.25, 0.0, 1.0));
}

vec4 eyeFeature(vec2 q, vec3 skin) {
  vec4 col = vec4(skin, 0.0);
  float open = uLids.x;
  float x = q.x;
  float y = q.y;
  // The eye is drawn smaller than its socket, as in the owner's designs (small, not anime): its
  // lids, white, iris and lashes in these units; the brow and the socket's shading in the socket's.
  const float EYE = 0.7;
  // Set a little in towards the nose and up towards the brow, as the owner asked (2026-11-16).
  vec2 e = (q - vec2(-0.13, 0.12)) / EYE;
  float low = lowerLid(e.x, uLids.y, open);
  float restUp = upperLid(e.x, 1.0, uLids.z);
  // Shut, the upper lid comes all the way down onto the lower one, wherever that is.
  float up = mix(low, restUp, open);

  // The brow along the ridge, as a person's runs: its head over the eye's inner corner, a low arch
  // over the outer third, its tail past the outer corner and level with its head; set down onto the
  // bottom of the ridge, about two thirds of an eye's width over the eye's middle.
  float b0 = uBrow.w - 0.3 + uBrow.x;
  float b1 = uBrow.w - 0.2 + uBrow.y;
  float b2 = uBrow.w - 0.3 + uBrow.z;
  // Its head reaches in over the root of the nose, not stopping short over the eye's corner, nor
  // onto the bridge's side (BROW_FROM, or where the face says).
  float xa = uBrowFrom;
  float xb = 0.55;
  float xc = 1.22;
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
  // Thickest at its head and tapering to a fine tail, as a brow grows.
  float thick = mix(0.42, 0.13, smoothstep(0.05, 1.0, along)) * (1.0 + 0.08 * uBrow.x);
  float ends = max(xa - x, x - xc);
  // Hairs, not a painted bar: they stand up at the head and lie along it towards the tail, and the
  // edge is ragged with them.
  float lean = mix(1.5, 0.5, smoothstep(0.0, 0.45, along));
  float strand = (x - across * lean) * 26.0;
  float own = hash12(vec2(floor(strand), 7.1));
  float hairs = mix(0.75, 1.0, own) * (0.88 + 0.12 * sin(fract(strand) * 3.1416));
  float ragged = (hash12(vec2(floor(strand), 2.3)) - 0.5) * 0.09;
  // The head starts soft, sparse hairs thickening over its first stretch; the tail ends finer.
  float browShape = max(abs(across) - thick * 0.5 + ragged, max((xa - x) * 0.9, (x - xc) * 2.2));
  float brow = smoothstep(0.035, -0.02, browShape) * mix(0.8, 1.0, own) * smoothstep(-0.05, 0.18, x - xa);
  // A faint shadow on the skin below it.
  float shade = smoothstep(0.14, 0.0, -(across + thick * 0.5)) * step(across, -thick * 0.5)
    * smoothstep(0.0, 0.1, -ends) * 0.18;
  over(col, skin * 0.78, shade);
  if (brow > 0.0) {
    float n = across / (thick * 0.5);
    vec3 browHair = mix(uHair, uHairShade, 0.25);
    vec3 hair = mix(uHairShade, browHair, smoothstep(-1.0, 0.6, n)) * (0.9 + 0.2 * hairs);
    over(col, hair, brow);
  }

  // The socket: a soft shadow under the brow ridge, deepest at the inner corner.
  float socket = smoothstep(1.3, 0.25, length(vec2(x * 0.8 + 0.1, (y - 0.18) * 1.15))) * 0.16;
  over(col, skin * 0.74, socket * step(e.y, restUp + 0.42));

  // The upper lid: skin rounding over the eye, from the lash line up to its crease, catching the
  // light along the middle and darker into the crease, the way the designs model it.
  float lidH = 0.24;
  float lidT = (e.y - up) / lidH;
  float lidSpan = smoothstep(1.12, 0.92, abs(e.x));
  if (lidT > 0.0 && lidT < 1.35) {
    float lidLit = 0.93 + 0.13 * sin(clamp(lidT, 0.0, 1.0) * 3.1416) - 0.06 * lidT;
    over(col, skin * lidLit, lidSpan * smoothstep(1.35, 1.0, lidT));
    // The crease, a soft dark line where the lid tucks under the brow ridge.
    float crease = smoothstep(0.22, 0.0, abs(lidT - 1.0)) * lidSpan * 0.3;
    over(col, skin * 0.62, crease);
  }
  // The lower lid: a slight fullness under the eye, lit on top, shadowed underneath.
  float lowT = (low - e.y) / 0.15;
  if (lowT > 0.0 && lowT < 1.4) {
    float lowSpan = smoothstep(1.0, 0.75, abs(e.x));
    float lowLit = lowT < 0.45 ? 1.04 : mix(1.04, 0.86, smoothstep(0.45, 1.0, lowT));
    over(col, skin * lowLit, lowSpan * smoothstep(1.4, 1.0, lowT) * 0.8);
  }

  // The eye itself, inside the lids.
  float inside = edge(max(max(e.y - up, low - e.y), abs(e.x) - 1.0));
  if (inside > 0.0) {
    // The white: warm, shaded under the upper lid and towards the corners.
    // The lid's shadow on the eye: a soft band under its edge.
    float underLid = exp(-(up - e.y) * 5.0);
    float corner = smoothstep(0.55, 1.0, abs(e.x));
    vec3 white = vec3(0.86, 0.83, 0.8) * (1.0 - 0.45 * underLid) * (1.0 - 0.25 * corner);
    // Pink by the nose.
    white = mix(white, vec3(0.75, 0.42, 0.38), smoothstep(-0.7, -0.98, e.x) * 0.5);
    vec3 eye = white;
    // The iris, where the eye looks: two fifths of the eye across, as a person's is, its top fifth
    // under the upper lid and its bottom resting on the lower, with a darker rim.
    vec2 at = vec2(uGaze.x * 0.38, 0.15 + uGaze.y * 0.12);
    vec2 d = e - at;
    float r = length(d);
    float R = 0.4;
    float iris = edge(r - R);
    if (iris > 0.0) {
      float a = atan(d.y, d.x);
      float fibres = 0.92 + 0.08 * sin(a * 23.0 + sin(a * 5.0) * 2.0);
      // Lighter brown round the pupil, deepening to a dark rim, as drawn.
      vec3 irisCol = mix(uIris * 1.35, uIris * 0.4, smoothstep(0.45, 0.98, r / R)) * fibres;
      irisCol *= 1.0 - 0.45 * underLid;
      float pupil = edge(r - R * 0.42 * uGaze.z);
      irisCol = mix(irisCol, vec3(0.012, 0.01, 0.009), pupil);
      eye = mix(eye, irisCol, iris);
    }
    // One small catchlight, up and to one side.
    float glint = edge(length(e - at - vec2(-0.12, 0.12)) - 0.055);
    eye = mix(eye, vec3(0.97), glint);
    over(col, eye, inside);
    faceWet = inside;
  }

  // The upper lid's edge: a thin dark line, a touch heavier at the outer end; no wing, and only a
  // hint of one under the lower lid.
  float lashWidth = 0.035 + 0.02 * smoothstep(0.1, 1.0, e.x);
  float upperLash = edge(max(abs(e.y - up - lashWidth * 0.5) - lashWidth * 0.5, abs(e.x) - 1.0));
  float lowerLash = edge(max(abs(e.y - low + 0.01) - 0.012, abs(e.x) - 0.85)) * 0.25 * clamp(open, 0.0, 1.0);
  over(col, uLash, max(upperLash, lowerLash));
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
  // The line of the mouth: its corners up for a smile, one higher than the other when lopsided;
  // even at rest they tuck up a touch, as in the designs.
  float corners = (uMood.x + uMood.y * sign(x) * 0.6) * 0.16 + 0.035;
  float line = corners * u * u - 0.03 * uMood.z * u * u;
  float shape = max(0.0, 1.0 - u * u);
  float top = line + open * 0.44 * pow(shape, 0.7 - round * 0.35);
  float bottom = line - open * 0.66 * pow(shape, 0.8 - round * 0.4) - 0.01;
  float parted = smoothstep(0.03, 0.1, open);
  float inMouth = edge(max(max(q.y - top, bottom - q.y), abs(u) - 1.0)) * parted;
  float lipTone = 0.92 - 0.12 * press;
  vec3 lip = skin * uLip * lipTone;

  // The lips: a thin upper lip above the line or the opening, a fuller lower lip under it.
  // The upper lip a bow (higher either side of the middle); the lower one fuller in the middle.
  float bow = 0.018 * smoothstep(0.0, 0.35, abs(u)) * smoothstep(1.0, 0.5, abs(u));
  // Lips have no hard outline: they fade into the skin round them.
  float upperLip = smoothstep(0.035, -0.02, max(abs(q.y - (top + 0.05 + bow)) - 0.05 - bow - 0.02 * press, abs(u) - 1.0));
  float lowerY = bottom - 0.11 + bite * 0.07;
  float lowerFull = 0.105 * (0.7 + 0.3 * shape);
  float lowerLip = smoothstep(0.045, -0.025, max(abs(q.y - lowerY) - lowerFull - 0.02 * press, abs(u) - 0.9));
  float lipHighlight = smoothstep(0.06, 0.0, abs(q.y - (lowerY + 0.02))) * lowerLip * shape;
  // At rest the lips still read, as in the designs: the upper one in its own shade, the lower one
  // fuller and lit, with its shadow on the chin below; they fill out as the mouth opens or presses.
  float lipShow = 0.85 + 0.15 * max(parted, press);
  float lowerBottom = lowerY - lowerFull - 0.02 * press;
  float chinShade = smoothstep(0.1, 0.0, lowerBottom - q.y) * step(q.y, lowerBottom)
    * smoothstep(0.95, 0.5, abs(u)) * 0.35;
  over(col, skin * 0.78, chinShade);
  over(col, lip * 0.82, upperLip * 0.75 * lipShow * smoothstep(1.0, 0.75, abs(u)));
  // Rounded: lighter across its middle, darker toward the line and its lower edge.
  float lowerRound = 1.0 - pow(abs(q.y - lowerY) / 0.085, 2.0) * 0.25;
  over(col, lip * lowerRound * (1.0 + 0.3 * lipHighlight), lowerLip * 0.85 * lipShow * smoothstep(1.0, 0.7, abs(u)));
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
  // Where each corner tucks into the cheek: a short soft curve up and out.
  float cu = abs(u) - 1.0;
  float tuck = smoothstep(0.03, 0.0, abs(q.y - (line + 0.02 + cu * cu * 1.6)))
    * smoothstep(-0.02, 0.04, cu) * smoothstep(0.22, 0.08, cu) * 0.35;
  over(col, skin * 0.6, tuck);
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
      shader.uniforms.uBrowFrom = options.eye.browFrom;
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
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.3, faceWet);",
      )
      // No lamp or sun reflects in the face: the eye's shine is its painted catchlight, which stays
      // put; a glossy eye's reflection is a point far brighter than the screen can show.
      .replace(
        "#include <lights_fragment_end>",
        "#include <lights_fragment_end>\nreflectedLight.directSpecular = vec3(0.0);",
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
    browFrom: { value: BROW_FROM },
  };
}

export function mouthUniforms(): MouthUniforms {
  return {
    shapeA: { value: new THREE.Vector4(0, 1, 0, 0) },
    shapeB: { value: new THREE.Vector4(0, 0, 0, 0) },
    mood: { value: new THREE.Vector4(0.1, 0, 0, 0.62) },
  };
}
