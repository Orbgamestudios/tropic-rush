// The WebGL renderer, scene, sky and sunlight, and the finishing passes over the picture: a soft
// bloom on bright things and a gentle vignette with a touch more color. One Stage lives for the
// whole session; each raid adds its own world to the scene and removes it afterwards.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { COLORS } from "./palette";
import { LIGHT_DISTANCE, Sky } from "./sky";

const BLOOM = { strength: 0.3, radius: 0.55, threshold: 0.92 };

/** Sharpest the picture starts: more than this only costs battery on a phone-sized screen. */
const START_PIXEL_RATIO = 1.75;
/** Frames slower than this count against the current quality. */
const SLOW_FRAME = 1 / 40;
/** Quality steps down after this many seconds of slow frames. */
const SLOW_SECONDS = 1.5;
/** A single frame counts for at most this long, so one hitch can't cost a whole quality step. */
const WORST_FRAME = 0.1;

const FINISH = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      // A little extra color, then darken softly towards the corners.
      float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = mix(vec3(luma), color.rgb, 1.1);
      float edge = smoothstep(0.32, 0.8, length((vUv - 0.5) * vec2(1.2, 1.0)));
      color.rgb *= 1.0 - edge * 0.42;
      gl_FragColor = color;
    }
  `,
};

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 700);
  readonly sun: THREE.DirectionalLight;
  readonly fog: THREE.Fog;
  readonly sky: Sky;
  width = 1;
  height = 1;
  /** Keeps full quality however slow frames are, for screenshots in test browsers. */
  holdQuality = false;

  constructor(private readonly container: HTMLElement) {
    // The finishing passes do their own antialiasing, so the canvas doesn't need any.
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, START_PIXEL_RATIO));
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Redrawn every few frames: nothing casting a shadow moves fast enough to notice.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.fog = new THREE.Fog(COLORS.sky, 60, 170);
    this.scene.fog = this.fog;

    const fill = new THREE.HemisphereLight(0xe4f6ff, 0xd2c08f, 1.25);
    this.scene.add(fill);
    this.sun = new THREE.DirectionalLight(0xfff0d4, 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1536, 1536);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 180;
    this.scene.add(this.sun, this.sun.target);
    this.sky = new Sky(this.scene, this.sun, fill, this.fog);

    this.composer = this.buildComposer();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  /** The finishing passes, or null on a device that can't render to a float target. */
  private buildComposer(): EffectComposer | null {
    const { extensions } = this.renderer;
    if (!extensions.has("EXT_color_buffer_float") && !extensions.has("EXT_color_buffer_half_float"))
      return null;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      BLOOM.strength,
      BLOOM.radius,
      BLOOM.threshold,
    );
    // Bloom is soft anyway: half resolution looks the same for a quarter of the work.
    const setBloomSize = bloom.setSize.bind(bloom);
    bloom.setSize = (width, height) => setBloomSize(width / 2, height / 2);
    composer.addPass(bloom);
    composer.addPass(new ShaderPass(FINISH));
    composer.addPass(new OutputPass());
    return composer;
  }

  resize(): void {
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(this.width, this.height);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  /** Keeps crisp shadows around what the camera is looking at. */
  focusShadows(target: THREE.Vector3, size: number): void {
    this.sun.position.copy(target).addScaledVector(this.sky.direction, LIGHT_DISTANCE);
    this.sun.target.position.copy(target);
    const cam = this.sun.shadow.camera;
    if (cam.right !== size) {
      cam.left = -size;
      cam.right = size;
      cam.top = size;
      cam.bottom = -size;
      cam.updateProjectionMatrix();
    }
  }

  setFogRange(near: number, far: number): void {
    this.fog.near = near;
    this.fog.far = far;
  }

  /**
   * Lowers quality step by step if frames stay slow (older phones, or newer ones running hot):
   * resolution, then the shadow map, then the finishing passes, then shadows altogether. Never
   * raises it again, so the picture doesn't keep flickering between levels.
   */
  adaptQuality(dt: number): void {
    this.elapsed += dt;
    if (this.holdQuality || this.elapsed < 3 || this.quality >= 4) return; // skip start-up compiling
    const frame = Math.min(dt, WORST_FRAME);
    this.slowSeconds =
      dt > SLOW_FRAME ? this.slowSeconds + frame : Math.max(0, this.slowSeconds - frame);
    if (this.slowSeconds < SLOW_SECONDS) return;
    this.slowSeconds = 0;
    this.quality++;
    if (this.quality === 1) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
    } else if (this.quality === 2) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.15));
      this.shadowEvery = 3;
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.shadowsStale = true;
    } else if (this.quality === 3) {
      this.composer?.dispose();
      this.composer = null;
    } else {
      this.sun.castShadow = false;
    }
    this.resize();
  }

  /** Draws shadows on the next frame: for when a light that casts them has just appeared. */
  refreshShadows(): void {
    this.shadowsStale = true;
  }

  /** Forgets slow frames so far: for just after a heavy scene has loaded. */
  ignoreSlowFrames(): void {
    this.elapsed = 0;
    this.slowSeconds = 0;
  }

  private elapsed = 0;
  private slowSeconds = 0;
  private quality = 0;
  private composer: EffectComposer | null = null;
  private frameNumber = 0;
  private shadowEvery = 2;
  /** A light has no shadow map yet: draw them this frame, whichever frame it is. */
  private shadowsStale = true;

  render(): void {
    this.frameNumber++;
    this.sky.update(performance.now() / 1000);
    const shadowEvery = this.sky.moonShadows ? this.shadowEvery * 2 : this.shadowEvery;
    const dueShadows = this.sky.shadows && this.frameNumber % shadowEvery === 0;
    if (this.shadowsStale || dueShadows) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsStale = false;
    }
    this.renderer.info.reset();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Draw calls and triangles in the last frame, shadows and finishing passes included. */
  frameCost(): { calls: number; triangles: number; programs: number; geometries: number } {
    const { render, memory, programs } = this.renderer.info;
    return {
      calls: render.calls,
      triangles: render.triangles,
      programs: programs?.length ?? 0,
      geometries: memory.geometries,
    };
  }
}
