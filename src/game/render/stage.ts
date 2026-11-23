// The WebGL renderer, scene, sky and sunlight. While the phone's keeping up, the picture goes
// through a lens on its way to the screen (cinema.ts: bloom, the sun's flare, a little grade), and
// a cutscene gets the whole film look, soft focus and all, at Ultra's sharpness and shadows. The
// moment frames run slow, or on the lower graphics settings, everything draws straight to the
// screen instead, with no passes over the finished picture: each of those is a screen of extra
// work on every frame. Drawn straight, the touch more color is part of tone mapping, in each
// material. One Stage lives for the whole session; each raid adds its own world to the scene and
// removes it afterwards.

import * as THREE from "three";
import type { Graphics } from "../save";
import { Cinema, FILM, type FilmLook, PLAY } from "./cinema";
import { COLORS } from "./palette";
import { LIGHT_DISTANCE, Sky } from "./sky";

const snapRight = new THREE.Vector3();
const snapUp = new THREE.Vector3();
const snapAt = new THREE.Vector3();
const viewRay = new THREE.Vector3();
const viewPoint = new THREE.Vector3();
/** How high over the ground in view the shadows still matter: the treetops. */
const VIEW_TOPS = 9;

/** How sharp a fight is at each step of quality: any more only costs battery on a phone. */
const PIXEL_RATIOS = [1.5, 1.3, 1.15, 1.15];
/** The steps of quality a fixed graphics setting sits at, the last of them dropping to 1. */
const FIXED_QUALITY = { ultra: 0, high: 0, medium: 2, low: 3 } as const;
const LOW_PIXEL_RATIO = 1;
/** Ultra: as sharp as a light screen everywhere, with bigger shadows redrawn every frame. */
const ULTRA_PIXEL_RATIO = 2;
/**
 * A cutscene: the game's own top sharpness. At Ultra's, with the film look's four-sample picture in
 * full range and its depth on top, a phone drew a cutscene at 30 frames a second.
 */
const FILM_PIXEL_RATIO = 1.5;
const ULTRA_SHADOW_MAP = 2048;
/** A screen with little on it, that mostly sits still, can afford to be sharper. */
const LIGHT_PIXEL_RATIO = 2;
/**
 * Frames slower than this count against the current quality. It's under 30 a second on purpose: a
 * phone in low power mode holds the game to exactly that, and that's no reason to spoil the picture.
 */
const SLOW_FRAME = 1 / 27;
/** With the lens on, frames slower than this for this long in a row turn it off. */
const LENS_FRAME = 1 / 45;
const LENS_SECONDS = 1.2;
/** Quality steps down after this many seconds of slow frames. */
const SLOW_SECONDS = 1.5;
/** A single frame counts for at most this long, so one hitch can't cost a whole quality step. */
const WORST_FRAME = 0.1;
/** How many times less often shadows are redrawn on a screen that's sitting still. */
const CALM_SHADOWS = 4;
/** The longest a screen waits for its shaders before drawing anyway. */
const MOST_PREPARING_MS = 3000;

THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
  "vec3 CustomToneMapping( vec3 color ) { return color; }",
  /* glsl */ `
    vec3 CustomToneMapping( vec3 color ) {
      float luma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
      return NeutralToneMapping( mix( vec3( luma ), color, 1.1 ) );
    }
  `,
);

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
  /** Shadows redrawn every frame (see render). */
  liveShadows = false;
  /** What the settings ask for; anything but auto stays where it's put. */
  private graphics: Graphics = "auto";

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    // Asking after each shader whether it built makes the phone finish building it there and then,
    // one at a time, which is most of the freeze when a new screen first draws. Only worth it while
    // the shaders are being written.
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIOS[0] ?? 1));
    this.renderer.info.autoReset = false;
    // Glass that bends the light (the time crystals) draws the scene behind it again; at half the
    // screen's resolution it costs a quarter as much and looks the same through a crystal.
    this.renderer.transmissionResolutionScale = 0.5;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Redrawn every few frames: nothing casting a shadow moves fast enough to notice.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.CustomToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const vignette = document.createElement("div");
    vignette.className = "stage-vignette";
    container.append(this.renderer.domElement, vignette);

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

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  resize(): void {
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Keeps crisp shadows on what the camera can see round `target`: the sun's view is fitted to the
   * ground in sight (and the treetops over it), never more than `size` either way of the target, so
   * the shadow map's pixels go only where they show. The owner, 2026-11-23: a smaller map, spent on
   * the view.
   */
  focusShadows(target: THREE.Vector3, size: number): void {
    const d = this.sky.direction;
    const right = snapRight.set(-d.z, 0, d.x);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const up = snapUp.crossVectors(d, right).normalize();
    // Each corner of the view, where it meets the ground and the treetops, in the sun's terms.
    const view = this.camera;
    view.updateMatrixWorld();
    const ta = target.dot(right);
    const tb = target.dot(up);
    let minA = size;
    let maxA = -size;
    let minB = size;
    let maxB = -size;
    for (let corner = 0; corner < 4; corner++) {
      const ray = viewRay
        .set(corner & 1 ? 1 : -1, corner & 2 ? 1 : -1, 1)
        .unproject(view)
        .sub(view.position)
        .normalize();
      for (const height of [target.y - 1, target.y + VIEW_TOPS]) {
        // Looking over the horizon, as far as a shadow could matter.
        let t = ray.y < -1e-4 ? (height - view.position.y) / ray.y : Number.POSITIVE_INFINITY;
        if (!(t > 0)) t = Number.POSITIVE_INFINITY;
        const p = viewPoint.copy(view.position).addScaledVector(ray, Math.min(t, size * 4));
        const a = p.dot(right) - ta;
        const b = p.dot(up) - tb;
        minA = Math.min(minA, a);
        maxA = Math.max(maxA, a);
        minB = Math.min(minB, b);
        maxB = Math.max(maxB, b);
      }
    }
    minA = Math.max(minA, -size);
    maxA = Math.min(maxA, size);
    minB = Math.max(minB, -size);
    maxB = Math.min(maxB, size);
    // In whole steps, with a step to spare: a frame that changed size with every small move of the
    // camera would move every shadow's edge with it, and they'd shimmer.
    const step = Math.max(0.5, size / 16);
    const halfA = Math.min(size, (Math.ceil((maxA - minA) / 2 / step) + 1) * step);
    const halfB = Math.min(size, (Math.ceil((maxB - minB) / 2 / step) + 1) * step);
    const midA = Math.max(-size + halfA, Math.min(size - halfA, (minA + maxA) / 2));
    const midB = Math.max(-size + halfB, Math.min(size - halfB, (minB + maxB) / 2));
    // Kept on the shadow map's own grid of pixels as it follows something moving: otherwise every
    // edge in the map shifts by part of a pixel each frame and shadows shimmer and flicker.
    const map = this.sun.shadow.mapSize.x;
    const texelA = (2 * halfA) / map;
    const texelB = (2 * halfB) / map;
    const a = Math.round((ta + midA) / texelA) * texelA - ta;
    const b = Math.round((tb + midB) / texelB) * texelB - tb;
    const at = snapAt.copy(target).addScaledVector(right, a).addScaledVector(up, b);
    this.sun.position.copy(at).addScaledVector(d, LIGHT_DISTANCE);
    this.sun.target.position.copy(at);
    const cam = this.sun.shadow.camera;
    if (cam.right !== halfA || cam.top !== halfB) {
      cam.left = -halfA;
      cam.right = halfA;
      cam.top = halfB;
      cam.bottom = -halfB;
      cam.updateProjectionMatrix();
      // The offset that keeps a surface from shadowing itself in stripes goes with the size of a
      // shadow's pixel: close up it's small, so the chin's shadow sits on the neck, not off it.
      this.sun.shadow.normalBias = Math.min(0.04, Math.max(0.006, Math.max(texelA, texelB) * 1.9));
      this.shadowsStale = true;
    }
  }

  setFogRange(near: number, far: number): void {
    this.fog.near = near;
    this.fog.far = far;
  }

  /**
   * Lowers quality step by step if frames stay slow (older phones, or newer ones running hot):
   * resolution, then the shadow map, then shadows altogether. Never raises it again, so the picture
   * doesn't keep flickering between levels. A light screen doesn't count, and keeps its sharpness
   * however the last fight went.
   */
  adaptQuality(dt: number): void {
    this.elapsed += dt;
    if (this.holdQuality || this.light || this.filming || this.graphics !== "auto") return;
    // The lens goes well before anything else does: it's wanted at a smooth rate or not at all.
    if (!this.lensOff && !this.flat && this.elapsed > 3) {
      this.lensSlow = dt > LENS_FRAME ? this.lensSlow + Math.min(dt, WORST_FRAME) : 0;
      if (this.lensSlow > LENS_SECONDS) this.lensOff = true;
    }
    if (this.elapsed < 3 || this.quality >= PIXEL_RATIOS.length - 1) return; // skip start-up compiling
    const frame = Math.min(dt, WORST_FRAME);
    this.slowSeconds =
      dt > SLOW_FRAME ? this.slowSeconds + frame : Math.max(0, this.slowSeconds - frame);
    if (this.slowSeconds < SLOW_SECONDS) return;
    this.slowSeconds = 0;
    this.setQuality(this.quality + 1);
  }

  /** The graphics setting: auto starts sharp and steps down if it must; the rest stay put. */
  setGraphics(graphics: Graphics): void {
    if (graphics === this.graphics) return;
    this.graphics = graphics;
    this.slowSeconds = 0;
    this.setQuality(graphics === "auto" ? 0 : FIXED_QUALITY[graphics]);
  }

  /** Each step down: resolution, then a smaller shadow map drawn less often, then no shadows. */
  private setQuality(quality: number): void {
    this.quality = quality;
    // The sun's view is fitted to what's on screen (focusShadows), so a smaller map does: 1024, 512
    // on a phone that's struggling. Only Ultra keeps a big one.
    const ultra = this.graphics === "ultra";
    const shadowSize = ultra ? ULTRA_SHADOW_MAP : quality >= 2 ? 512 : 1024;
    if (this.sun.shadow.mapSize.x !== shadowSize) {
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    // A cutscene's people move slowly: their shadows every other frame is half the work, unseen.
    this.shadowEvery = this.graphics === "ultra" ? 1 : this.filming ? 2 : quality >= 2 ? 4 : 3;
    this.sun.castShadow = quality < 3 || this.filming;
    this.shadowsStale = true;
    this.setPixelRatio();
  }

  /** Says whether what's on screen is one of the light screens, which stay sharp. */
  setLight(on: boolean): void {
    if (on === this.light) return;
    this.light = on;
    this.setPixelRatio();
  }

  private setPixelRatio(): void {
    const ratio = this.filming
      ? this.graphics === "ultra"
        ? ULTRA_PIXEL_RATIO
        : FILM_PIXEL_RATIO
      : this.graphics === "low"
        ? LOW_PIXEL_RATIO
        : this.graphics === "ultra"
          ? ULTRA_PIXEL_RATIO
          : this.light
            ? LIGHT_PIXEL_RATIO
            : (PIXEL_RATIOS[this.quality] ?? 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, ratio));
    this.resize();
  }

  /** A cutscene's starting or over: the film look, at its sharpest, for as long as it's on. */
  setFilming(on: boolean): void {
    if (on === this.filming) return;
    this.filming = on;
    this.lens.fade = 1;
    this.setQuality(this.quality);
  }

  /** Whether the phone's keeping up at the top quality: for things worth drawing only then. */
  get detailed(): boolean {
    if (this.graphics === "ultra" || this.graphics === "high") return true;
    // On auto, until frames first run under 45 a second (when the lens goes too).
    return this.graphics === "auto" && this.quality === 0 && !this.lensOff;
  }

  /** The lens the picture goes through, for whoever's pulling its focus. */
  get lens(): Cinema {
    this.cinema ??= new Cinema();
    return this.cinema;
  }

  /** What the picture gets on its way to the screen just now, or nothing if it's drawn straight. */
  private look(): FilmLook | null {
    if (this.filming) return FILM;
    if (this.flat || this.graphics === "low" || this.graphics === "medium") return null;
    if (this.graphics === "auto" && this.lensOff) return null;
    // The first thing to go when frames run slow: it's a few screens of work the game can do without.
    if (this.graphics === "auto" && this.quality > 0) return null;
    return PLAY;
  }

  /** Draws shadows on the next frame: for when a light that casts them has just appeared. */
  refreshShadows(): void {
    this.shadowsStale = true;
  }

  /** Forgets slow frames so far: for just after a heavy scene has loaded. */
  ignoreSlowFrames(): void {
    this.elapsed = 0;
    this.slowSeconds = 0;
    this.lensSlow = 0;
  }

  /**
   * Builds the shaders for everything now in view before drawing it, in the background where the
   * browser can (Safari can). Otherwise the first frame of a new screen stops to build every new
   * material's shader in turn, which is most of the freeze when one opens. Until they're ready the
   * screen keeps its last frame, under the wipe, rather than locking up.
   */
  prepare(): void {
    const token = ++this.preparing;
    const done = () => {
      if (this.preparing === token) this.preparing = 0;
    };
    this.renderer.compileAsync(this.scene, this.camera).then(done, done);
    setTimeout(done, MOST_PREPARING_MS);
  }

  private elapsed = 0;
  private slowSeconds = 0;
  private quality = 0;
  private light = false;
  private frameNumber = 0;
  private shadowEvery = 3;
  /** A light has no shadow map yet: draw them this frame, whichever frame it is. */
  private shadowsStale = true;
  /** Nobody's touching the screen and nothing's fast: shadows can wait much longer. */
  calm = false;
  /** Shaders are being built for what's just appeared (see prepare); nothing's drawn till then. */
  private preparing = 0;

  render(): void {
    this.sky.update(performance.now() / 1000);
    if (this.preparing) return;
    this.frameNumber++;
    const pace = this.calm ? CALM_SHADOWS : 1;
    // Something big moving through a close shot (the boat setting out) needs its shadows every
    // frame, or they lag it in steps: unless the device is already struggling (two steps down), when
    // a smooth picture matters more than a shadow keeping up.
    const every = this.liveShadows && this.quality < 2 ? 1 : this.shadowEvery;
    const shadowEvery = (this.sky.moonShadows ? every * 2 : every) * pace;
    const dueShadows = this.sky.shadows && this.frameNumber % shadowEvery === 0;
    if (this.shadowsStale || dueShadows) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsStale = false;
    }
    this.renderer.info.reset();
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastRender) / 1000);
    this.lastRender = now;
    const look = this.look();
    if (!look) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const sun = this.sky.sunDirection;
    this.lens.render(
      this.renderer,
      this.scene,
      this.camera,
      look,
      sun.y > -0.03 ? sun : null,
      this.sky.sunColor,
      dt,
      now / 1000,
    );
  }

  /** A screen seen from straight above, which the lens has nothing to add to. */
  flat = false;
  /** The phone couldn't hold a smooth rate with the lens on, so it's off until the game's reopened. */
  private lensOff = false;
  private lensSlow = 0;
  private cinema: Cinema | null = null;
  private filming = false;
  private lastRender = performance.now();

  /** Draw calls and triangles in the last frame, shadows included. */
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
