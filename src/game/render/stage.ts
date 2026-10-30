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

const BLOOM = { strength: 0.3, radius: 0.55, threshold: 0.92 };

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
  width = 1;
  height = 1;
  /** Keeps full quality however slow frames are, for screenshots in test browsers. */
  holdQuality = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(COLORS.sky);
    this.fog = new THREE.Fog(COLORS.sky, 60, 170);
    this.scene.fog = this.fog;

    this.scene.add(new THREE.HemisphereLight(0xe4f6ff, 0xd2c08f, 1.25));
    this.sun = new THREE.DirectionalLight(0xfff0d4, 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 180;
    this.scene.add(this.sun, this.sun.target);

    this.composer = this.buildComposer();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  /** The finishing passes, or null on a device that can't render to a float target. */
  private buildComposer(): EffectComposer | null {
    const { extensions } = this.renderer;
    if (!extensions.has("EXT_color_buffer_float") && !extensions.has("EXT_color_buffer_half_float"))
      return null;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
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
    this.sun.position.copy(target).add(new THREE.Vector3(-28, 48, 34));
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
   * Lowers quality step by step if frames stay slow (older phones): first resolution, then the
   * shadow map, then the finishing passes. Never raises it again, so the picture doesn't keep
   * flickering between levels.
   */
  adaptQuality(dt: number): void {
    this.elapsed += dt;
    if (this.holdQuality || this.elapsed < 3 || this.quality >= 3) return; // skip start-up compiling
    this.slowSeconds = dt > 1 / 24 ? this.slowSeconds + dt : Math.max(0, this.slowSeconds - dt);
    if (this.slowSeconds < 2) return;
    this.slowSeconds = 0;
    this.quality++;
    if (this.quality === 3) {
      this.composer?.dispose();
      this.composer = null;
    } else if (this.quality === 1) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } else {
      this.renderer.setPixelRatio(1);
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.resize();
  }

  private elapsed = 0;
  private slowSeconds = 0;
  private quality = 0;
  private composer: EffectComposer | null = null;

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
