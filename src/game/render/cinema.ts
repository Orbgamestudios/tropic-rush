// The film look: the scene is drawn into a picture of its own, in full range, and finished the way
// a camera would finish it. Bright things bloom (the sun, its glints on the sea, fire, crystals),
// the sun throws a flare down the lens when it's in the shot, whatever's off the focus goes soft,
// and the frame gets a little grade, vignette and grain. Cutscenes always have it; the game has
// the cheap half of it (everything but the soft focus) while the phone's keeping up.
//
// It's built the way phone games build it: the bloom is a short chain of pictures each half the
// size of the last, blurred on the way down and added back on the way up, so its widest glow costs
// a handful of pixels; the soft focus is a blend towards a quarter-size copy, not a blur per
// pixel; and everything else happens in the one last pass that would be needed anyway.

import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/** Halvings in the bloom chain: the last is 1/64 of the screen across. */
const BLOOM_STEPS = 4;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Half the size: four taps, each already the mean of four texels. */
const HALVE = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uTexel;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb
           + texture2D(tMap, vUv + uTexel * vec2(1.0, -1.0)).rgb
           + texture2D(tMap, vUv + uTexel * vec2(-1.0, 1.0)).rgb
           + texture2D(tMap, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    c *= 0.25;
    if (uThreshold > 0.0) {
      // Only what's brighter than the picture can show glows, coming in softly past the knee.
      float bright = max(c.r, max(c.g, c.b));
      float soft = clamp(bright - uThreshold + 0.5, 0.0, 1.0);
      c *= max(soft * soft * 0.5, bright - uThreshold) / max(bright, 1e-4);
      // One glint a pixel wide mustn't light the whole chain up as it flickers.
      c = min(c, vec3(12.0));
    }
    gl_FragColor = vec4(c, 1.0);
  }
`;

/** Back up a size: a soft tent over the smaller picture, added to the one at this size. */
const WIDEN = /* glsl */ `
  uniform sampler2D tSmall;
  uniform sampler2D tHere;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSmall, vUv).rgb * 4.0;
    c += texture2D(tSmall, vUv + uTexel * vec2(-1.0, 0.0)).rgb * 2.0;
    c += texture2D(tSmall, vUv + uTexel * vec2(1.0, 0.0)).rgb * 2.0;
    c += texture2D(tSmall, vUv + uTexel * vec2(0.0, -1.0)).rgb * 2.0;
    c += texture2D(tSmall, vUv + uTexel * vec2(0.0, 1.0)).rgb * 2.0;
    c += texture2D(tSmall, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
    c += texture2D(tSmall, vUv + uTexel * vec2(1.0, -1.0)).rgb;
    c += texture2D(tSmall, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
    c += texture2D(tSmall, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    gl_FragColor = vec4(c / 16.0 + texture2D(tHere, vUv).rgb, 1.0);
  }
`;

const FINISH = /* glsl */ `
  #include <packing>
  uniform sampler2D tScene;
  uniform sampler2D tDepth;
  uniform sampler2D tSoft;
  uniform sampler2D tBloom;
  uniform vec2 uSoftTexel;
  uniform float uNear;
  uniform float uFar;
  uniform float uBloom;
  uniform float uSoftness;
  uniform float uFocus;
  uniform vec3 uSun;
  uniform vec3 uFlare;
  uniform float uAspect;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uGrade;
  uniform float uTime;
  uniform float uFade;
  varying vec2 vUv;

  float away(vec2 uv) {
    float z = perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
    return -z;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  /** A soft-edged disc of a ghost, somewhere along the line through the middle of the lens. */
  float ghost(vec2 p, vec2 at, float radius) {
    float d = length(p - at) / radius;
    return smoothstep(1.0, 0.82, d) * (0.35 + 0.65 * d * d);
  }

  void main() {
    vec3 color = texture2D(tScene, vUv).rgb;

    #ifdef SOFT_FOCUS
      // How far off the focus this is, as a share of the way there: near things blur sooner.
      float distance = away(vUv);
      float off = (distance - uFocus) / max(uFocus, 0.5);
      float blur = clamp((off > 0.0 ? off * 0.55 : -off * 1.6) - 0.12, 0.0, 1.0) * uSoftness;
      vec3 soft = texture2D(tSoft, vUv + uSoftTexel * vec2(-0.5, -0.5)).rgb
                + texture2D(tSoft, vUv + uSoftTexel * vec2(0.5, -0.5)).rgb
                + texture2D(tSoft, vUv + uSoftTexel * vec2(-0.5, 0.5)).rgb
                + texture2D(tSoft, vUv + uSoftTexel * vec2(0.5, 0.5)).rgb;
      color = mix(color, soft * 0.25, blur);
    #endif

    color += texture2D(tBloom, vUv).rgb * uBloom;

    #ifdef LENS_FLARE
      if (uSun.z > 0.0) {
        // The sun only flares for as much of it as nothing's standing in front of.
        float open = 0.0;
        for (int i = 0; i < 5; i++) {
          vec2 o = vec2(float(i == 1) - float(i == 2), float(i == 3) - float(i == 4)) * 0.012;
          open += step(0.99995, texture2D(tDepth, clamp(uSun.xy + o, 0.001, 0.999)).x);
        }
        float lit = uSun.z * open * 0.2;
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        vec2 s = (uSun.xy - 0.5) * vec2(uAspect, 1.0);
        vec2 q = p - s;
        float d = length(q);
        vec3 flare = uFlare * 0.3 / (1.0 + d * d * 22.0);
        // A streak across the frame, and a few short rays round the sun itself.
        flare += uFlare * 0.2 * exp(-abs(q.y) * 70.0) / (1.0 + q.x * q.x * 5.0);
        float angle = atan(q.y, q.x);
        float rays = pow(abs(sin(angle * 4.0 + 0.6)), 24.0) + 0.6 * pow(abs(sin(angle * 7.0)), 40.0);
        flare += uFlare * rays * 0.16 * exp(-d * 5.5);
        // Ghosts: the sun's light bouncing between the glasses of the lens, each its own tint.
        flare += vec3(0.25, 0.55, 1.0) * ghost(p, s * -0.42, 0.075) * 0.07;
        flare += vec3(1.0, 0.5, 0.25) * ghost(p, s * -0.9, 0.14) * 0.05;
        flare += vec3(0.4, 1.0, 0.6) * ghost(p, s * 0.38, 0.035) * 0.08;
        flare += vec3(0.8, 0.5, 1.0) * ghost(p, s * -1.45, 0.24) * 0.035;
        flare += vec3(1.0, 0.8, 0.5) * ghost(p, s * 0.62, 0.02) * 0.1;
        color += flare * lit;
      }
    #endif

    #ifdef TONE_MAPPING
      color = toneMapping(color);
    #endif

    // A film's grade, laid over the finished picture: deeper blacks with a touch of teal in
    // them, warm highlights, and corners that fall off.
    // (Done on the picture as the eye sees it, not on the light that made it, or the darks drown.)
    vec3 c = linearToOutputTexel(vec4(clamp(color, 0.0, 1.0), 1.0)).rgb;
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 graded = mix(c, c * c * (3.0 - 2.0 * c), 0.45);
    graded += vec3(-0.01, 0.004, 0.016) * (1.0 - luma) + vec3(0.02, 0.008, -0.018) * luma;
    c = mix(c, graded, uGrade);
    vec2 corner = (vUv - 0.5) * vec2(uAspect, 1.0);
    c *= 1.0 - uVignette * smoothstep(0.25, 1.15, dot(corner, corner) * 1.6);
    c += (hash(vUv * 917.0 + fract(uTime) * 61.0) - 0.5) * uGrain;
    gl_FragColor = vec4(c * uFade, 1.0);
  }
`;

/** How strongly each part of the look comes through. */
export interface FilmLook {
  bloom: number;
  /** Soft focus, 0 for none: how blurred the far background gets. */
  softness: number;
  flare: number;
  vignette: number;
  grain: number;
  grade: number;
}

/** A cutscene: the whole look. */
export const FILM: FilmLook = {
  bloom: 0.55,
  softness: 0.85,
  flare: 1,
  vignette: 0.42,
  grain: 0.022,
  grade: 0.7,
};
/** The game itself: glow and flare, with nothing soft and nothing in the way of reading it. */
export const PLAY: FilmLook = {
  bloom: 0.38,
  softness: 0,
  flare: 0.6,
  vignette: 0,
  grain: 0,
  grade: 0.25,
};

function target(samples = 0): THREE.WebGLRenderTarget {
  const t = new THREE.WebGLRenderTarget(4, 4, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: samples > 0,
    samples,
  });
  t.texture.generateMipmaps = false;
  return t;
}

export class Cinema {
  private readonly scene: THREE.WebGLRenderTarget;
  private readonly half = target();
  private readonly quarter = target();
  private readonly down: THREE.WebGLRenderTarget[] = [];
  private readonly up: THREE.WebGLRenderTarget[] = [];
  private readonly halve: THREE.ShaderMaterial;
  private readonly widen: THREE.ShaderMaterial;
  private readonly finish: THREE.ShaderMaterial;
  private readonly quad = new FullScreenQuad();
  private readonly sunAt = new THREE.Vector3();
  private width = 0;
  private height = 0;
  /** The distance that's sharp, in meters, and where it's heading: focus is pulled, not cut. */
  focus = 8;
  private focused = 8;
  /** 1 is the picture as it is; lower fades it to black, for the way in and out of a scene. */
  fade = 1;

  constructor() {
    this.scene = target(4);
    this.scene.depthTexture = new THREE.DepthTexture(4, 4);
    this.scene.depthTexture.type = THREE.UnsignedIntType;
    for (let i = 0; i < BLOOM_STEPS; i++) {
      this.down.push(target());
      if (i < BLOOM_STEPS - 1) this.up.push(target());
    }
    const plain = { depthTest: false, depthWrite: false, toneMapped: false } as const;
    this.halve = new THREE.ShaderMaterial({
      ...plain,
      vertexShader: VERTEX,
      fragmentShader: HALVE,
      uniforms: {
        tMap: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uThreshold: { value: 0 },
      },
    });
    this.widen = new THREE.ShaderMaterial({
      ...plain,
      vertexShader: VERTEX,
      fragmentShader: WIDEN,
      uniforms: {
        tSmall: { value: null },
        tHere: { value: null },
        uTexel: { value: new THREE.Vector2() },
      },
    });
    this.finish = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      vertexShader: VERTEX,
      fragmentShader: FINISH,
      defines: { LENS_FLARE: "" },
      uniforms: {
        tScene: { value: this.scene.texture },
        tDepth: { value: this.scene.depthTexture },
        tSoft: { value: this.quarter.texture },
        tBloom: { value: null },
        uSoftTexel: { value: new THREE.Vector2() },
        uNear: { value: 0.5 },
        uFar: { value: 700 },
        uBloom: { value: 0 },
        uSoftness: { value: 0 },
        uFocus: { value: 8 },
        uSun: { value: new THREE.Vector3() },
        uFlare: { value: new THREE.Color(1, 0.86, 0.62) },
        uAspect: { value: 1 },
        uVignette: { value: 0 },
        uGrain: { value: 0 },
        uGrade: { value: 0 },
        uTime: { value: 0 },
        uFade: { value: 1 },
      },
    });
  }

  private resize(renderer: THREE.WebGLRenderer): void {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (size.x === this.width && size.y === this.height) return;
    this.width = size.x;
    this.height = size.y;
    this.scene.setSize(size.x, size.y);
    let w = size.x;
    let h = size.y;
    const next = () => {
      w = Math.max(2, Math.round(w / 2));
      h = Math.max(2, Math.round(h / 2));
    };
    next();
    this.half.setSize(w, h);
    next();
    this.quarter.setSize(w, h);
    this.down.forEach((t, i) => {
      // The first bloom picture is the quarter's size: it only has to hold what's bright.
      if (i > 0) next();
      t.setSize(w, h);
      this.up[i]?.setSize(w, h);
    });
  }

  private pass(
    renderer: THREE.WebGLRenderer,
    material: THREE.ShaderMaterial,
    into: THREE.WebGLRenderTarget | null,
  ): void {
    this.quad.material = material;
    renderer.setRenderTarget(into);
    this.quad.render(renderer);
  }

  /**
   * Draws the scene through the lens. \`sun\` is the way to the sun (or nothing, at night) and
   * \`sunColor\` its light; \`dt\` moves the focus on towards where it's been set.
   */
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    look: FilmLook,
    sun: THREE.Vector3 | null,
    sunColor: THREE.Color,
    dt: number,
    time: number,
  ): void {
    this.resize(renderer);
    renderer.setRenderTarget(this.scene);
    renderer.render(scene, camera);

    const halve = this.halve.uniforms;
    const texel = (of: THREE.WebGLRenderTarget) =>
      (halve.uTexel as THREE.IUniform<THREE.Vector2>).value.set(1 / of.width, 1 / of.height);
    const from = (of: THREE.WebGLRenderTarget, threshold = 0) => {
      (halve.tMap as THREE.IUniform).value = of.texture;
      (halve.uThreshold as THREE.IUniform).value = threshold;
      texel(of);
    };
    from(this.scene);
    this.pass(renderer, this.halve, this.half);
    from(this.half);
    this.pass(renderer, this.halve, this.quarter);
    // Bloom: what's bright, halved and halved, then widened back up, each size added in.
    let last = this.half;
    this.down.forEach((t, i) => {
      from(last, i === 0 ? 1 : 0);
      this.pass(renderer, this.halve, t);
      last = t;
    });
    const widen = this.widen.uniforms;
    for (let i = this.up.length - 1; i >= 0; i--) {
      const small = i === this.up.length - 1 ? this.down[i + 1] : this.up[i + 1];
      const here = this.down[i];
      const into = this.up[i];
      if (!small || !here || !into) continue;
      (widen.tSmall as THREE.IUniform).value = small.texture;
      (widen.tHere as THREE.IUniform).value = here.texture;
      (widen.uTexel as THREE.IUniform<THREE.Vector2>).value.set(1 / small.width, 1 / small.height);
      this.pass(renderer, this.widen, into);
    }

    const u = this.finish.uniforms;
    const soft = look.softness > 0;
    if (soft !== "SOFT_FOCUS" in this.finish.defines) {
      if (soft) this.finish.defines.SOFT_FOCUS = "";
      else delete this.finish.defines.SOFT_FOCUS;
      this.finish.needsUpdate = true;
    }
    this.focused += (this.focus - this.focused) * (1 - Math.exp(-dt * 4));
    (u.tBloom as THREE.IUniform).value = this.up[0]?.texture ?? null;
    (u.uSoftTexel as THREE.IUniform<THREE.Vector2>).value.set(
      1 / this.quarter.width,
      1 / this.quarter.height,
    );
    (u.uNear as THREE.IUniform).value = camera.near;
    (u.uFar as THREE.IUniform).value = camera.far;
    (u.uBloom as THREE.IUniform).value = look.bloom;
    (u.uSoftness as THREE.IUniform).value = look.softness;
    (u.uFocus as THREE.IUniform).value = this.focused;
    (u.uAspect as THREE.IUniform).value = this.width / this.height;
    (u.uVignette as THREE.IUniform).value = look.vignette;
    (u.uGrain as THREE.IUniform).value = look.grain;
    (u.uGrade as THREE.IUniform).value = look.grade;
    (u.uTime as THREE.IUniform).value = time;
    (u.uFade as THREE.IUniform).value = this.fade;
    // Where the sun is in the frame, and how much of a flare it's worth: none behind the camera,
    // less as it leaves the picture.
    const at = (u.uSun as THREE.IUniform<THREE.Vector3>).value;
    at.z = 0;
    if (sun && look.flare > 0) {
      this.sunAt.copy(camera.position).addScaledVector(sun, 500).project(camera);
      const facing = sun.dot(camera.getWorldDirection(SCRATCH));
      const inFrame = Math.max(Math.abs(this.sunAt.x), Math.abs(this.sunAt.y));
      if (facing > 0 && inFrame < 1.25) {
        at.set(this.sunAt.x * 0.5 + 0.5, this.sunAt.y * 0.5 + 0.5, 0);
        const up = Math.max(0, Math.min(1, sun.y * 6 + 0.35));
        at.z = look.flare * Math.min(1, (1.25 - inFrame) * 4) * up;
      }
      (u.uFlare as THREE.IUniform<THREE.Color>).value.copy(sunColor);
    }
    this.pass(renderer, this.finish, null);
  }

  dispose(): void {
    for (const t of [this.scene, this.half, this.quarter, ...this.down, ...this.up]) t.dispose();
    this.scene.depthTexture?.dispose();
    this.halve.dispose();
    this.widen.dispose();
    this.finish.dispose();
    this.quad.dispose();
  }
}

const SCRATCH = new THREE.Vector3();
