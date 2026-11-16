// The Captain (docs/CHARACTERS.md, The way now): the owner's model, his face (render/face/), the
// stock clips where they're there to play (render/clipLibrary.ts), fingers that curl one by one,
// and his hair moving in the breeze.
//
// Two copies of the same body on one skeleton: every one of the ~490,000 triangles for when the
// camera's close, and a 40,000 one for when it isn't, which also casts his shadow either way (no one
// can tell a shadow's detail, and it halves what he costs). Each file's fetched and unpacked once,
// however many Captains there are: the pictures alone are a phone's worth of memory.

import * as THREE from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { type GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { Expression } from "../logic/face/expressions";
import { ClipLibrary, ClipPlayer } from "./clipLibrary";
import { addFace, type FaceMap, FaceRig } from "./face/faceRig";

const MODEL = "/models/captain-full.glb";
const RAID_MODEL = "/models/captain-raid.glb";
const FACE = "/models/captain-face.json";
const CLIPS = "/models/anims/";
/** How tall the heroes stand in menus (heroAssets.ts). */
const HEIGHT = 1.8;
/** Nearer than this (metres, camera to head) he's drawn in full. */
const NEAR = 4.2;

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const files = new Map<string, Promise<GLTF>>();
/** A model file, fetched and unpacked once; each Captain clones it, sharing its meshes. */
function file(url: string): Promise<GLTF> {
  let load = files.get(url);
  if (!load) {
    load = loader.loadAsync(url);
    load.catch(() => files.delete(url));
    files.set(url, load);
  }
  return load;
}
let faceMap: Promise<FaceMap> | null = null;
let faceSkin: Promise<THREE.Texture> | null = null;
/** The hair found on each mesh, worked out once (it's the same mesh for every Captain). */
const hairOf = new WeakMap<THREE.BufferGeometry, Float32Array>();

export type Side = "L" | "R";
export const FINGERS = ["Thumb", "Index", "Mid", "Ring", "Pinky"] as const;
export type Finger = (typeof FINGERS)[number];
/** How far each joint of a finger bends at a full curl, root to tip, radians. */
const BEND = [1.25, 1.45, 0.95] as const;
const THUMB_BEND = [0.55, 0.7, 0.8] as const;

interface Joint {
  bone: THREE.Bone;
  /** The bend's axis in the bone's own space, found at rest: towards the palm. */
  axis: THREE.Vector3;
  most: number;
  /** The bend put on last frame, taken off again before the clip moves the bone. */
  applied: THREE.Quaternion;
}

const turn = new THREE.Quaternion();

/**
 * Curls a hand's fingers one by one, after whatever the clip did: 0 open as the clip has it, 1 a
 * fist. Each bend's axis is worked out at rest from where the next joint lies and which way the
 * palm faces, so it works whatever way the rig's bones happen to be turned.
 */
class Hands {
  private readonly joints = new Map<string, Joint[]>();
  private readonly curl = new Map<string, number>();
  private readonly want = new Map<string, number>();

  constructor(model: THREE.Object3D) {
    model.updateMatrixWorld(true);
    const at = (name: string) => model.getObjectByName(name)?.getWorldPosition(new THREE.Vector3());
    for (const side of ["L", "R"] as const) {
      const hand = at(`CC_Base_${side}_Hand`);
      const index = at(`CC_Base_${side}_Index1`);
      const pinky = at(`CC_Base_${side}_Pinky1`);
      const mid = at(`CC_Base_${side}_Mid1`);
      if (!hand || !index || !pinky || !mid) continue;
      // The palm's side: across the knuckles and along the hand, whichever way is down at rest.
      const palm = new THREE.Vector3()
        .crossVectors(index.clone().sub(hand), pinky.clone().sub(hand))
        .normalize();
      if (palm.y > 0) palm.negate();
      for (const finger of FINGERS) {
        const chain: Joint[] = [];
        for (let i = 1; i <= 3; i++) {
          const bone = model.getObjectByName(`CC_Base_${side}_${finger}${i}`);
          if (!(bone instanceof THREE.Bone)) continue;
          const from = bone.getWorldPosition(new THREE.Vector3());
          const next = bone.children.find((c) => c instanceof THREE.Bone);
          const to = next
            ? next.getWorldPosition(new THREE.Vector3())
            : from
                .clone()
                .add(
                  from
                    .clone()
                    .sub(chain.at(-1)?.bone.getWorldPosition(new THREE.Vector3()) ?? hand),
                );
          const along = to.sub(from).normalize();
          // The thumb folds in across the palm, towards the middle finger's root.
          const towards = finger === "Thumb" ? mid.clone().sub(from).normalize() : palm;
          const axis = new THREE.Vector3().crossVectors(along, towards).normalize();
          const inBone = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
          const most = (finger === "Thumb" ? THUMB_BEND : BEND)[i - 1] ?? 1;
          chain.push({
            bone,
            axis: axis.applyQuaternion(inBone),
            most,
            applied: new THREE.Quaternion(),
          });
        }
        this.joints.set(`${side}${finger}`, chain);
      }
    }
  }

  /** Sets one finger's curl to ease towards, 0 to 1. */
  set(side: Side, finger: Finger, curl: number): void {
    this.want.set(`${side}${finger}`, Math.min(1, Math.max(0, curl)));
  }

  /** Every finger of a hand at once: 1 is a clasped fist. */
  clasp(side: Side, curl: number): void {
    for (const f of FINGERS) this.set(side, f, curl);
  }

  /**
   * Takes last frame's bends off, before a clip moves the bones: a clip that sets the fingers
   * overwrites them anyway, and one that doesn't leaves them where they were before the bend.
   */
  release(): void {
    for (const chain of this.joints.values()) {
      for (const j of chain) j.bone.quaternion.multiply(turn.copy(j.applied).invert());
    }
  }

  /** Bends the joints, after the clip has had its say. */
  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 12);
    for (const [key, chain] of this.joints) {
      const now = this.curl.get(key) ?? 0;
      const next = now + ((this.want.get(key) ?? 0) - now) * k;
      this.curl.set(key, next);
      for (const j of chain) {
        j.applied.setFromAxisAngle(j.axis, next * j.most);
        j.bone.quaternion.multiply(j.applied);
      }
    }
  }
}

/**
 * The hair: which points of the mesh are loose hair, and how loose (more towards the tips), found
 * from the paint (the golden, saturated blond, above the brow, on the head). The breeze then moves
 * them in the vertex shader, each lock a little out of time with the next.
 */
function looseHair(mesh: THREE.SkinnedMesh, browHeight: number): Float32Array | null {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const skinIndex = geometry.getAttribute("skinIndex");
  const skinWeight = geometry.getAttribute("skinWeight");
  const material = mesh.material as THREE.MeshStandardMaterial;
  const image = material.map?.image as CanvasImageSource & { width: number; height: number };
  const head = mesh.skeleton.bones.findIndex((b) => b.name === "CC_Base_Head");
  if (!position || !uv || !skinIndex || !skinWeight || !image || head < 0) return null;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const count = position.count;
  const hair = new Float32Array(count);
  const centre = new THREE.Vector3();
  let found = 0;
  for (let i = 0; i < count; i++) {
    let weight = 0;
    for (let k = 0; k < 4; k++)
      if (skinIndex.getComponent(i, k) === head) weight += skinWeight.getComponent(i, k);
    if (weight < 0.6 || position.getY(i) < browHeight) continue;
    const x = Math.min(size - 1, Math.max(0, Math.floor(uv.getX(i) * size)));
    const y = Math.min(size - 1, Math.max(0, Math.floor(uv.getY(i) * size)));
    const p = (y * size + x) * 4;
    const r = (pixels[p] ?? 0) / 255;
    const g = (pixels[p + 1] ?? 0) / 255;
    const b = (pixels[p + 2] ?? 0) / 255;
    const high = Math.max(r, g, b);
    const low = Math.min(r, g, b);
    // Blond: saturated, red over green over blue, with green well up (skin's is lower and pinker).
    const blond = high > 0.25 && (high - low) / high > 0.45 && r >= g && g > b && g / r > 0.62;
    if (!blond) continue;
    hair[i] = 1;
    centre.x += position.getX(i);
    centre.y += position.getY(i);
    centre.z += position.getZ(i);
    found++;
  }
  if (found < 50) return null;
  centre.divideScalar(found);
  // Looser further out from the middle of the hair: the tips of the locks move, the roots don't.
  centre.y -= 0.04;
  let reach = 0;
  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    if (!hair[i]) continue;
    reach = Math.max(reach, p.fromBufferAttribute(position, i).distanceTo(centre));
  }
  for (let i = 0; i < count; i++) {
    if (!hair[i]) continue;
    const out = p.fromBufferAttribute(position, i).distanceTo(centre) / reach;
    const t = Math.min(1, Math.max(0, (out - 0.55) / 0.45));
    hair[i] = t * t * (3 - 2 * t);
  }
  return hair;
}

/**
 * Standing at ease without any clip: the arms brought down from the rig's pose to hang by his
 * sides with the elbows a little bent, breathing, and a slow shift of weight. For when the stock
 * clips aren't there (they aren't in the repo), and a start on moves of his own.
 */
class AtEase {
  private readonly posed: { bone: THREE.Object3D; pose: THREE.Quaternion }[] = [];
  private readonly chest: {
    bone: THREE.Object3D;
    pose: THREE.Quaternion;
    side: THREE.Vector3;
  } | null;
  private readonly waist: {
    bone: THREE.Object3D;
    pose: THREE.Quaternion;
    front: THREE.Vector3;
  } | null;
  private time = Math.random() * 10;

  constructor(model: THREE.Object3D, forward: THREE.Vector3) {
    model.updateMatrixWorld(true);
    const up = new THREE.Vector3(0, 1, 0);
    const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    const bone = (name: string) => model.getObjectByName(name) ?? null;
    /** Turns a bone so the way to its child points along `to` (in the world). */
    const aim = (b: THREE.Object3D, child: THREE.Object3D, to: THREE.Vector3) => {
      const from = at(child).sub(at(b)).normalize();
      const turn = new THREE.Quaternion().setFromUnitVectors(from, to.clone().normalize());
      const parent = b.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
      const own = b.getWorldQuaternion(new THREE.Quaternion());
      b.quaternion.copy(parent.invert().multiply(turn).multiply(own));
      b.updateMatrixWorld(true);
    };
    const spine = bone("CC_Base_Spine02");
    for (const side of ["L", "R"] as const) {
      const upper = bone(`CC_Base_${side}_Upperarm`);
      const fore = bone(`CC_Base_${side}_Forearm`);
      const hand = bone(`CC_Base_${side}_Hand`);
      if (!upper || !fore || !hand || !spine) continue;
      const out = at(upper).sub(at(spine)).setY(0).normalize();
      aim(
        upper,
        fore,
        up.clone().negate().addScaledVector(out, 0.16).addScaledVector(forward, 0.04),
      );
      aim(
        fore,
        hand,
        up.clone().negate().addScaledVector(forward, 0.32).addScaledVector(out, 0.04),
      );
      this.posed.push({ bone: upper, pose: upper.quaternion.clone() });
      this.posed.push({ bone: fore, pose: fore.quaternion.clone() });
    }
    const side = new THREE.Vector3().crossVectors(up, forward).normalize();
    const local = (b: THREE.Object3D, v: THREE.Vector3) =>
      v.clone().applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()).invert());
    this.chest = spine
      ? { bone: spine, pose: spine.quaternion.clone(), side: local(spine, side) }
      : null;
    const waist = bone("CC_Base_Waist");
    this.waist = waist
      ? { bone: waist, pose: waist.quaternion.clone(), front: local(waist, forward) }
      : null;
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    for (const p of this.posed) p.bone.quaternion.copy(p.pose);
    // A breath every four seconds or so, the chest lifting; the weight going over from one foot to
    // the other and back every twenty.
    if (this.chest) {
      const breath = Math.sin(t * 1.55) * 0.018;
      this.chest.bone.quaternion
        .copy(this.chest.pose)
        .multiply(turn.setFromAxisAngle(this.chest.side, -breath));
    }
    if (this.waist) {
      const shift = Math.sin(t * 0.31) * 0.025 + Math.sin(t * 0.13) * 0.01;
      this.waist.bone.quaternion
        .copy(this.waist.pose)
        .multiply(turn.setFromAxisAngle(this.waist.front, shift));
    }
  }
}

/** The breeze's clock, shared by every Captain on screen, seconds. */
export const windTime = { value: 0 };

/**
 * The cloth, leather, skin and hair up close: the generated paint is smooth, so each is given a
 * fine relief of its own in the shader, told apart by its color. An oxford weave in the blue shirt,
 * a diagonal twill in the white trousers, a pebbled grain and a sheen on the brown leather, pores in
 * the skin and strands in the blond. The relief fades out before it's finer than a pixel, so it
 * never shimmers at a distance.
 */
const SURFACE = /* glsl */ `
float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cHash(i), cHash(i + vec2(1, 0)), f.x), mix(cHash(i + vec2(0, 1)), cHash(i + vec2(1, 1)), f.x), f.y);
}
// What the paint here is: shirt, trousers, leather, skin, hair (each 0 to 1).
void cKinds(vec3 linear, out float shirt, out float white, out float leather, out float skin, out float hair) {
  vec3 c = pow(max(linear, vec3(0.0)), vec3(1.0 / 2.2));
  float high = max(c.r, max(c.g, c.b)); float low = min(c.r, min(c.g, c.b));
  float sat = (high - low) / max(high, 1e-3);
  shirt = smoothstep(0.03, 0.12, c.b - c.r);
  white = smoothstep(0.66, 0.78, low) * (1.0 - shirt);
  float warm = step(c.b, c.g) * step(c.g, c.r) * (1.0 - shirt) * (1.0 - white);
  leather = warm * smoothstep(0.6, 0.45, high) * smoothstep(0.3, 0.45, sat);
  hair = warm * (1.0 - leather) * smoothstep(0.42, 0.55, sat) * smoothstep(0.6, 0.66, c.g / max(c.r, 1e-3));
  skin = warm * (1.0 - leather) * (1.0 - hair);
}
// The relief of one kind of surface (0 shirt, 1 trousers, 2 leather, 3 skin, 4 hair), in units of
// a third of a thread. Only the kind that's there is worked out: each pixel pays for one pattern.
float cRelief(vec2 p, int kind) {
  float k = 6.2832 / 4.0;
  if (kind == 0) return (sin(p.x * k) * sin(p.y * k) + 0.35 * sin((p.x - p.y) * k * 0.5)) * 0.9;
  if (kind == 1) return (sin((p.x + p.y) * k * 0.9) + 0.3 * cNoise(p * 0.5)) * 0.8;
  if (kind == 2) {
    float grain = cNoise(p * 0.22) * 0.7 + cNoise(p * 0.55) * 0.3;
    return (1.0 - pow(abs(grain - 0.5) * 2.0, 0.6)) * 1.6;
  }
  // Skin: barely any, and none at the finest scale (see SURFACE_COLOR): on a face it read as grit.
  if (kind == 3) return cNoise(p * 0.7) * 0.15;
  // Hair and beard: soft clumps, a little longer one way, not drawn lines (those read as ridges).
  return (cNoise(p * vec2(0.08, 0.3)) - 0.5) * 0.5;
}
`;

const SURFACE_COLOR = /* glsl */ `
  float kShirt, kWhite, kLeather, kSkin, kHair;
  cKinds(diffuseColor.rgb, kShirt, kWhite, kLeather, kSkin, kHair);
  // Laid on the body itself (where each point is at rest), from the three sides, blended by
  // which way the surface faces: the paint's layout is in small scattered pieces, and a pattern laid
  // across it would turn at every piece's edge. Four of these units is a thread and a half of shirt.
  vec3 cAt = vCPos * 4800.0;
  // From the side the surface mostly faces (blending all three cost three times as much, for a
  // difference no one could see in a weave this fine).
  vec3 cN = abs(vCNorm);
  vec2 cTexel = cN.x > cN.y && cN.x > cN.z ? cAt.yz : (cN.y > cN.z ? cAt.xz : cAt.xy);
  // What it is, by whichever kind's strongest.
  float cTop = max(max(kShirt, kWhite), max(kLeather, max(kSkin, kHair)));
  int cKind = cTop == kShirt ? 0 : (cTop == kWhite ? 1 : (cTop == kLeather ? 2 : (cTop == kSkin ? 3 : 4)));
  float cFine = 1.0 - smoothstep(0.7, 1.6, length(fwidth(cTexel)));
  // The same again four times coarser and stronger, which still shows when the threads are too fine
  // to: the twill's ribs, the leather's pebbles, slubs in the cotton, clumps in the hair.
  float cMid = 1.0 - smoothstep(0.7, 1.6, length(fwidth(cTexel * 0.25)));
  float cMidStrength = cKind == 0 ? 0.4 : (cKind == 3 ? 0.5 : 1.0);
  float cH = 0.0;
  if (cFine > 0.0 && cKind != 3) cH += cRelief(cTexel, cKind) * cTop * cFine;
  if (cMid > 0.0) cH += cRelief(cTexel * 0.25, cKind) * cTop * cMid * 2.5 * cMidStrength;
  // Heathered cotton: threads a shade lighter or darker, in slubs along the weave.
  diffuseColor.rgb *= 1.0 + (kShirt + kWhite * 0.5) * (cNoise(cTexel * vec2(0.02, 0.15)) - 0.5) * 0.12;
  // The threads' and the grain's own small changes of shade, and darker hollows.
  diffuseColor.rgb *= 1.0 + (kShirt + kWhite) * 0.06 * cH * cFine
    + kLeather * (cNoise(cTexel * 0.04) - 0.5) * 0.35 + kHair * 0.1 * cH;
`;

const SURFACE_ROUGHNESS = /* glsl */ `
  // Leather has a sheen worn into it; hair a little shine; cotton none.
  roughnessFactor = mix(roughnessFactor, 0.42, kLeather * 0.8);
  roughnessFactor = mix(roughnessFactor, 0.5, kHair * 0.5);
  roughnessFactor = mix(roughnessFactor, 0.92, (kShirt + kWhite) * 0.6);
  // Skin and hair are never glossy: the generated paint's roughness map has shiny patches, and the
  // forehead's caught the key light as a glowing spot.
  roughnessFactor = max(roughnessFactor, 0.68 * kSkin + 0.55 * kHair);
`;

const SURFACE_METALNESS = /* glsl */ `
  // Nor metal: only the belt's buckle and the watch can be.
  metalnessFactor *= 1.0 - clamp(kSkin + kHair + kShirt + kWhite, 0.0, 1.0);
`;

const SURFACE_NORMAL = /* glsl */ `
  {
    // Bumped by the relief's change across the screen (as three.js does for a bump map).
    vec3 dx = dFdx(-vViewPosition); vec3 dy = dFdy(-vViewPosition);
    float hx = dFdx(cH); float hy = dFdy(cH);
    vec3 r1 = cross(dy, normal); vec3 r2 = cross(normal, dx);
    float det = dot(dx, r1);
    // The relief's depth: a tenth of a millimetre or so.
    vec3 grad = sign(det) * (hx * r1 + hy * r2) * 0.00012;
    // Never tipped more than about 30 degrees: where the surface is nearly edge-on to the screen,
    // or a pixel steps across a hard change in the relief, the tip would be huge, and a wet-looking
    // spot of light flashes there as he moves (it did on his forehead).
    float most = abs(det) * 0.55;
    float g = length(grad);
    if (g > most) grad *= most / g;
    normal = normalize(abs(det) * normal - grad);
  }
`;

/** The surface's relief, and the loose hair (all zero if none was found) blowing in the breeze. */
function dress(mesh: THREE.SkinnedMesh, loose: Float32Array): void {
  mesh.geometry.setAttribute("aHair", new THREE.BufferAttribute(loose, 1));
  const material = mesh.material as THREE.MeshStandardMaterial;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vCPos;\nvarying vec3 vCNorm;\n${SURFACE}`,
      )
      .replace("#include <map_fragment>", `#include <map_fragment>\n${SURFACE_COLOR}`)
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>\n${SURFACE_ROUGHNESS}`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>\n${SURFACE_METALNESS}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>\n${SURFACE_NORMAL}`,
      );
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aHair;\nuniform float uWindTime;\nvarying vec3 vCPos;\nvarying vec3 vCNorm;",
      )
      .replace(
        "#include <skinning_vertex>",
        `#include <skinning_vertex>
        vCPos = position;
        vCNorm = normal;
        if (aHair > 0.0) {
          // Each lock on its own phase; gusts that build and fall; a lean downwind, a lift, a sway.
          float phase = dot(position, vec3(41.0, 23.0, 37.0));
          float gust = 0.55 + 0.45 * sin(uWindTime * 0.37) * sin(uWindTime * 0.23 + 1.3);
          float sway = sin(uWindTime * 2.3 + phase) * 0.6 + sin(uWindTime * 4.1 + phase * 1.7) * 0.4;
          vec3 wind = normalize(vec3(0.85, 0.05, -0.5));
          transformed += (wind * (0.55 + sway) * gust + vec3(0.0, 0.35 * sway, 0.0)) * aHair * 0.02;
        }`,
      );
  };
  material.customProgramCacheKey = () => "captain-hair";
}

export interface Captain {
  holder: THREE.Group;
  /** The model itself, inside the holder (which stands him 1.8 m tall on the ground). */
  model: THREE.Object3D;
  /** Which way he faces in the model's own space, found at rest from his eyes. */
  forward: THREE.Vector3;
  face: FaceRig | null;
  hands: Hands;
  /** Playing the stock clips, or null when they aren't there and he stands at ease instead. */
  player: ClipPlayer | null;
  /** Moves him on; `pose`, when given, sets his body instead of the clips or his stance at ease. */
  update(dt: number, pose?: () => void): void;
  /** Runs his stock clips on by `dt`: standing about, or walking (for his upper body). */
  clipStep(dt: number, mode: "stand" | "stroll"): void;
  /** Draws him in full when this camera's close to his face, the lighter copy when it isn't. */
  detailFor(camera: THREE.Camera): void;
}

/** Writes nothing to the picture: the light copy, kept only for the shadow it casts. */
const SHADOW_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

/** What to load: the full model, or the lighter raid copy, moved by whatever leads him there. */
export interface CaptainOptions {
  raid?: boolean;
}

let clipsLoad: Promise<ClipLibrary | null> | null = null;
/** The stock clips he uses, fetched once for every Captain. */
function stockClips(): Promise<ClipLibrary | null> {
  clipsLoad ??= ClipLibrary.load(CLIPS, ["walk-think", "walk"]).catch(() => null);
  return clipsLoad;
}

/**
 * Standing about: the stretches of the stock "pacing, deep in thought" take where he's stopped,
 * arms folded or a hand to his chin, looped (the owner found the stock idle, hands on hips, too
 * feminine for him). Seconds into the take.
 */
const STANDING: readonly (readonly [number, number])[] = [
  [18.4, 26.9],
  [6.9, 11.9],
];

/**
 * Keeps him standing about, starting a stretch again as one comes to its end. True when it jumped
 * within the same take, which the clip player can't blend, so the caller fades the pose across.
 */
function stand(player: ClipPlayer): boolean {
  const t = player.time;
  if (player.current === "walk-think" && STANDING.some(([a, b]) => t >= a && t < b)) return false;
  const jump = player.current === "walk-think";
  const [start] = STANDING[Math.floor(Math.random() * STANDING.length)] ?? [18.4];
  player.play("walk-think", { at: start, fade: player.current ? 0.9 : 0 });
  return jump;
}

/** Walking, arms swinging loose (for his upper body over the game's own walk). */
function stroll(player: ClipPlayer): void {
  if (player.current !== "walk") player.play("walk", { fade: 0.35 });
}

/** Fades every bone from where it was to where a clip's jumped it, over a moment. */
class PoseFade {
  private readonly bones: THREE.Object3D[] = [];
  private readonly from: THREE.Quaternion[] = [];
  private left = 0;
  private readonly seconds = 0.8;

  constructor(model: THREE.Object3D) {
    model.traverse((o) => {
      if (o instanceof THREE.Bone) {
        this.bones.push(o);
        this.from.push(new THREE.Quaternion());
      }
    });
  }

  capture(): void {
    this.bones.forEach((b, i) => {
      this.from[i]?.copy(b.quaternion);
    });
    this.left = this.seconds;
  }

  apply(dt: number): void {
    if (this.left <= 0) return;
    this.left = Math.max(0, this.left - dt);
    const k = this.left / this.seconds;
    const keep = k * k * (3 - 2 * k);
    this.bones.forEach((b, i) => {
      const from = this.from[i];
      if (from) b.quaternion.slerp(from, keep);
    });
  }
}

let cast: Promise<Captain | null> | null = null;

/**
 * The Captain for cutscenes: one copy, loaded once and kept, since a cutscene can start any time
 * and his full model takes a moment. Null if he can't be had (offline), and Steele plays the part.
 */
export function castCaptain(): Promise<Captain | null> {
  cast ??= loadCaptain().catch(() => null);
  return cast;
}

/** The expression for a line said in each of the story's moods (logic/story/script.ts). */
export const MOOD_FACE: Record<string, Expression> = {
  happy: "happy",
  laugh: "happy",
  sad: "sad",
  angry: "furious",
  scared: "scared",
  surprised: "shocked",
  shout: "furious",
  whisper: "sympathetic",
};

/** Loads the Captain, standing 1.8 m on y = 0 facing +x, as the menus' heroes do. */
export async function loadCaptain(options: CaptainOptions = {}): Promise<Captain> {
  faceMap ??= fetch(FACE).then((r) => {
    if (!r.ok) throw new Error("No face map");
    return r.json() as Promise<FaceMap>;
  });
  faceSkin ??= faceMap.then((m) => new THREE.TextureLoader().loadAsync(`/models/${m.picture}`));
  const [full, light, map, skin, clips] = await Promise.all([
    options.raid ? null : file(MODEL),
    file(RAID_MODEL),
    faceMap,
    faceSkin,
    // The owner's stock clips; without them (offline) he stands at ease on moves of his own.
    stockClips(),
  ]);
  const model = clone((full ?? light).scene);
  const nearMeshes: THREE.SkinnedMesh[] = [];
  model.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) nearMeshes.push(o);
  });
  // The light copy on the same skeleton, beside the full one: for the shadow, and for afar.
  const farMeshes: THREE.SkinnedMesh[] = [];
  if (full) {
    const extra = clone(light.scene);
    extra.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) farMeshes.push(o);
    });
    const beside = nearMeshes[0];
    for (const m of farMeshes) {
      const bones = m.skeleton.bones.map((b) => model.getObjectByName(b.name));
      if (!beside?.parent || bones.some((b) => !(b instanceof THREE.Bone))) continue;
      beside.parent.add(m);
      m.position.copy(beside.position);
      m.quaternion.copy(beside.quaternion);
      m.scale.copy(beside.scale);
      m.bind(new THREE.Skeleton(bones as THREE.Bone[], m.skeleton.boneInverses), m.bindMatrix);
    }
  }
  const parts = addFace(model, map, skin);
  const face = parts && new FaceRig(parts);
  const hands = new Hands(model);
  const farMaterial = new Map<THREE.SkinnedMesh, THREE.Material | THREE.Material[]>();
  for (const o of [...nearMeshes, ...farMeshes]) {
    o.frustumCulled = false;
    let loose = hairOf.get(o.geometry);
    if (!loose) {
      const count = o.geometry.getAttribute("position")?.count ?? 0;
      loose = looseHair(o, map.browZ) ?? new Float32Array(count);
      hairOf.set(o.geometry, loose);
    }
    dress(o, loose);
  }
  for (const o of nearMeshes) o.castShadow = farMeshes.length === 0;
  for (const o of farMeshes) {
    o.castShadow = true;
    farMaterial.set(o, o.material);
  }
  let near = true;
  const setNear = (on: boolean) => {
    if (farMeshes.length === 0 || on === near) return;
    near = on;
    for (const o of nearMeshes) o.visible = on;
    for (const o of farMeshes) o.material = on ? SHADOW_ONLY : (farMaterial.get(o) ?? o.material);
  };
  near = false;
  setNear(true);
  const player = clips && new ClipPlayer(model, clips);
  if (player) stand(player);
  const fade = new PoseFade(model);
  /** The clips moved on: standing about, or (for his upper body) walking. */
  const clipStep = (dt: number, mode: "stand" | "stroll") => {
    if (!player) return;
    if (mode === "stroll") stroll(player);
    else if (stand(player)) fade.capture();
    player.update(dt);
    fade.apply(dt);
  };
  if (face && (player || options.raid)) face.animated = true;
  // Which way he faces: from the head to his eyes, at rest.
  const forward = new THREE.Vector3(1, 0, 0);
  if (parts) {
    model.updateMatrixWorld(true);
    const eyes = new THREE.Vector3();
    const patches = parts.head.children.filter((o) => o instanceof THREE.Mesh);
    // The patches are drawn in the head's own space, so where they are is in their points.
    for (const p of patches) {
      p.geometry.computeBoundingBox();
      eyes.add(
        p.localToWorld(
          p.geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3(),
        ),
      );
    }
    if (patches.length > 0) {
      eyes.divideScalar(patches.length).sub(parts.head.getWorldPosition(new THREE.Vector3()));
      eyes.y = 0;
      if (eyes.lengthSq() > 1e-8) forward.copy(eyes.normalize());
    }
  }
  const atEase = player || options.raid ? null : new AtEase(model, forward);
  const box = new THREE.Box3().setFromObject(model);
  const root = new THREE.Group();
  root.add(model);
  root.scale.setScalar(HEIGHT / Math.max(0.1, box.max.y - box.min.y));
  root.position.y = -box.min.y * root.scale.y;
  const holder = new THREE.Group();
  holder.add(root);
  return {
    holder,
    model,
    forward,
    face,
    hands,
    player,
    clipStep,
    update(dt: number, pose?: () => void) {
      windTime.value += dt;
      hands.release();
      if (pose) pose();
      else if (player) clipStep(dt, "stand");
      else atEase?.update(dt);
      hands.update(dt);
      face?.update(dt);
    },
    detailFor(camera: THREE.Camera) {
      const head = parts?.head ?? holder;
      setNear(camera.position.distanceTo(head.getWorldPosition(headAt)) < NEAR);
    },
  };
}

const headAt = new THREE.Vector3();
