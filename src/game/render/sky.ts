// The sky over the whole game, following the real sun and moon where the player is: the scene's
// lights, the fog, a sky dome with stars, and the values everything unlit shares (sea, clouds,
// smoke). It looks at the clock every few seconds rather than every frame. The moon lights the
// night as much as its phase allows: a new moon gives no light and no shadows, and on those nights
// the shadow pass stops altogether; moon shadows are redrawn at half the sun's rate.

import * as THREE from "three";
import { moonPhase, moonPosition, type Place, sunPosition, sunRising } from "../logic/sun";
import { clamp, lerp } from "../logic/vec";

/** Seconds between looks at the clock: the sun moves a quarter of a degree a minute. */
const LOOK_SECONDS = 8;
/** Below this the directional light is the moon. It's almost off there, so the swap can't show. */
const MOON_BELOW = -1.5;
/** The light stays this high at sunset, for long shadows that still fit the shadow map. */
const LOWEST_LIGHT = 16;
/** Shadows fade out over these sun heights in degrees, and aren't drawn at all under them. */
const SHADOWS_FROM = [0.5, 6] as const;
/** Lamps come on over these sun heights, in degrees. */
const LAMPS_ON = [8, -3] as const;
/** Stars come out over these sun heights, in degrees. */
const STARS_ON = [-5, -13] as const;
/** The moon's light, at its strongest. */
const MOON_LIGHT = 0xa8bfff;
const MOON_POWER = 1.05;
/** A half moon gives far less than half the light of a full one. */
const MOON_FALLOFF = 1.4;
/** It takes over from dusk as the sun goes down through these heights, in degrees. */
const MOON_TAKES_OVER = [MOON_BELOW, -7] as const;
/** Moonlight fades in as the moon climbs through these heights, in degrees. */
const MOON_RISING = [0, 14] as const;
/** How much moonlight it takes for shadows to start, and to reach full strength. */
const MOON_SHADOWS = [0.15, 0.7] as const;
const MOON_SHADOW_STRENGTH = 0.8;
/** On the darkest nights, how much of the fill light, sea and sky are left. */
const DARKEST = { fill: 0.46, unlit: 0.5, sky: 0.45 } as const;
/** The jungle's own shade at night, under a new moon and a full one (1 is no change). */
const FOREST_SHADE = [0.13, 0.3] as const;
/** Lamps look stronger the less moon there is to compete with them. */
const LAMPS_WHEN_DARKEST = 1.7;
/** How far the sun sits from what it's lighting, in meters. */
export const LIGHT_DISTANCE = 65;
const DAY_DIRECTION = new THREE.Vector3(-28, 48, 34).normalize();
const MAP_SEA = 0x0a2f5a;

/** Values shared with every material that doesn't take its light from the scene. */
export const SKY = {
  /** Towards the sun, or the moon at night. */
  direction: { value: DAY_DIRECTION.clone() },
  /** What unlit things multiply themselves by. */
  unlit: { value: new THREE.Color(1, 1, 1) },
  /** The color of sunlight or moonlight glinting on water. */
  glint: { value: new THREE.Color(1, 0.97, 0.88) },
  /** The sky along the horizon, which the sea reflects. */
  horizon: { value: new THREE.Color(0xbfe6f2) },
  /** The jungle's plants multiply themselves by this, so the forest goes darker than the open. */
  forest: { value: new THREE.Color(1, 1, 1) },
  /** 0 by day, 1 and over once it's dark enough for lamps to show. */
  dark: { value: 0 },
};

interface Look {
  /** The sun's height in degrees that this look belongs to. */
  at: number;
  sun: number;
  sunPower: number;
  top: number;
  bottom: number;
  fill: number;
  zenith: number;
  horizon: number;
  unlit: number;
  glint: number;
  /** The glow round a low sun. */
  glow: number;
}

const NIGHT: Look = {
  at: -14,
  sun: MOON_LIGHT,
  sunPower: 0,
  top: 0x5570c0,
  bottom: 0x343f70,
  fill: 0.85,
  zenith: 0x060c22,
  horizon: 0x141f46,
  unlit: 0x5c70aa,
  glint: 0x7f93c8,
  glow: 0x000000,
};

const LATE_DUSK: Look = {
  at: -6,
  sun: MOON_LIGHT,
  sunPower: 0,
  top: 0x6468b4,
  bottom: 0x443f6c,
  fill: 1.05,
  zenith: 0x121a46,
  horizon: 0x4a3c78,
  unlit: 0x7272ae,
  glint: 0x5a6498,
  glow: 0x301a48,
};

const DUSK: Look = {
  at: MOON_BELOW,
  sun: 0xffa56a,
  sunPower: 0.02,
  top: 0xa88cc4,
  bottom: 0x70587a,
  fill: 1.15,
  zenith: 0x34448a,
  horizon: 0xee8456,
  unlit: 0xb096ac,
  glint: 0x000000,
  glow: 0x8a3a2c,
};

const SUNSET: Look = {
  at: 3,
  sun: 0xffa868,
  sunPower: 1.9,
  top: 0xffbc9c,
  bottom: 0xa07a6c,
  fill: 1.15,
  zenith: 0x6888c8,
  horizon: 0xffa066,
  unlit: 0xf2b898,
  glint: 0xff9a50,
  glow: 0xc85a2a,
};

const GOLDEN: Look = {
  at: 12,
  sun: 0xffc486,
  sunPower: 2.3,
  top: 0xffe4c6,
  bottom: 0xc8ae86,
  fill: 1.2,
  zenith: 0x9ccce8,
  horizon: 0xffd8a8,
  unlit: 0xfff0dc,
  glint: 0xffd8a0,
  glow: 0x4a2a10,
};

const DAY: Look = {
  at: 28,
  sun: 0xfff0d4,
  sunPower: 2.3,
  top: 0xe4f6ff,
  bottom: 0xd2c08f,
  fill: 1.25,
  zenith: 0x8fd0ec,
  horizon: 0xbfe6f2,
  unlit: 0xffffff,
  glint: 0xfff7e0,
  glow: 0x000000,
};

const EVENING: readonly Look[] = [NIGHT, LATE_DUSK, DUSK, SUNSET, GOLDEN, DAY];

/** Mornings are pinker than evenings. */
const MORNING: readonly Look[] = [
  NIGHT,
  { ...LATE_DUSK, horizon: 0x56407c, zenith: 0x161e4e },
  { ...DUSK, horizon: 0xee8496, top: 0xb490c8, unlit: 0xb89ab8, glow: 0x8a3a58 },
  {
    ...SUNSET,
    sun: 0xffa684,
    top: 0xffc4c6,
    horizon: 0xffa898,
    unlit: 0xf4c0c0,
    glint: 0xffa890,
    glow: 0xc85a5a,
  },
  { ...GOLDEN, sun: 0xffd09c, horizon: 0xffe0bc, unlit: 0xfff2e4 },
  DAY,
];

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uSun;
  uniform vec3 uMoon;
  uniform vec3 uDisc;
  uniform vec3 uMoonDisc;
  uniform float uMoonGlow;
  uniform float uStars;
  uniform sampler2D uStarMap;
  varying vec3 vDirection;

  void main() {
    vec3 d = normalize(vDirection);
    float up = max(d.y, 0.0);
    vec3 color = mix(uHorizon, uZenith, pow(up, 0.6));
    // The glow leaves the horizon line alone, so the foggy sea meets the sky without a seam.
    float toward = max(dot(d, uSun), 0.0);
    float lifted = smoothstep(0.0, 0.07, d.y);
    color += uGlow * (toward * toward * toward * 0.7 + pow(toward, 28.0)) * lifted;
    color += uDisc * smoothstep(0.9988, 0.9994, toward) * lifted;
    float moon = max(dot(d, uMoon), 0.0);
    color += uMoonDisc * pow(moon, 400.0) * 0.14 * uMoonGlow * lifted;
    if (moon > 0.9985) {
      // A ball lit from where the sun really is, so the phase shows and leans the right way.
      vec3 across = (d - uMoon * moon) / 0.0548;
      vec3 ball = across + uMoon * sqrt(max(0.0, 1.0 - dot(across, across)));
      float lit = smoothstep(-0.06, 0.1, dot(ball, uSun));
      color = mix(color, uMoonDisc * lit, smoothstep(0.9985, 0.9987, moon) * lifted * lit);
    }
    color += uStars * texture2D(uStarMap, d.xz / (up + 0.4) * 1.4).r * smoothstep(0.03, 0.3, up);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function starTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    g.fillStyle = "#000";
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 170; i++) {
      const shade = Math.round(90 + Math.random() * 165);
      g.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
      const width = Math.random() < 0.12 ? 2 : 1;
      g.fillRect(Math.random() * size, Math.random() * size, width, width);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

/** Where a bearing and height point, in scene space: x is east and z is south. */
function pointing(out: THREE.Vector3, azimuth: number, elevation: number): THREE.Vector3 {
  const around = THREE.MathUtils.degToRad(azimuth);
  const up = THREE.MathUtils.degToRad(elevation);
  return out.set(Math.sin(around) * Math.cos(up), Math.sin(up), -Math.cos(around) * Math.cos(up));
}

/** 0 outside the range, 1 past its far end, whichever way round the range runs. */
function fade(value: number, [from, to]: readonly [number, number]): number {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

const paint = new THREE.Color();

function blendColor(out: THREE.Color, a: number, b: number, t: number): void {
  out.setHex(a).lerp(paint.setHex(b), t);
}

export class Sky {
  /** The scene's background and the fog share this. */
  readonly background = new THREE.Color();
  /** The open sea past the islands on the world map. */
  readonly mapBackground = new THREE.Color();
  /** Whether the shadow pass is worth drawing. */
  shadows = true;
  /** Shadows are the moon's: faint, so they needn't keep up as closely as the sun's. */
  moonShadows = false;
  private readonly dome: THREE.Mesh;
  private readonly uniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uSun: { value: new THREE.Vector3() },
    uMoon: { value: new THREE.Vector3() },
    uDisc: { value: new THREE.Color() },
    uMoonDisc: { value: new THREE.Color() },
    uMoonGlow: { value: 0 },
    uStars: { value: 0 },
    uStarMap: { value: null as THREE.Texture | null },
  };
  private readonly lightDirection = DAY_DIRECTION.clone();
  private place: Place = { lat: 0, lon: 0 };
  /** A fixed moment to show instead of the clock, for tests. */
  private heldClock: number | null = null;
  private studio = false;
  private nextLook = 0;
  /** What's over the sky just now: the dome shows when nothing is. */
  private readonly covers = new Set<string>();

  constructor(
    scene: THREE.Scene,
    private readonly sun: THREE.DirectionalLight,
    private readonly fill: THREE.HemisphereLight,
    private readonly fog: THREE.Fog,
  ) {
    this.uniforms.uStarMap.value = starTexture();
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDirection;
        void main() {
          vDirection = position;
          // Turns with the camera but never gets nearer, and sits right at the back of the view.
          vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
          gl_Position = clip.xyww;
        }
      `,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), material);
    this.dome.frustumCulled = false;
    // Last of the solid things, so it only fills what they've left open.
    this.dome.renderOrder = 100;
    scene.background = this.background;
    scene.add(this.dome);
  }

  /** Puts the sky over a new place on Earth. */
  setPlace(place: Place): void {
    this.place = place;
    this.nextLook = 0;
  }

  /** Shows a moment of the day instead of the clock (null goes back to the clock). */
  holdClock(ms: number | null): void {
    this.heldClock = ms;
    this.nextLook = 0;
  }

  /** The moment being shown. */
  now(): number {
    return this.heldClock ?? Date.now();
  }

  /** Hero portraits stand under steady daylight whatever the hour. */
  setStudio(on: boolean): void {
    this.studio = on;
    this.nextLook = 0;
  }

  /** The map and the pedestal have backdrops of their own, so the dome hides while they're up. */
  cover(by: string, on: boolean): void {
    if (on) this.covers.add(by);
    else this.covers.delete(by);
    this.dome.visible = this.covers.size === 0;
  }

  /** Call every frame: it only does anything every few seconds. */
  update(seconds: number): void {
    if (seconds < this.nextLook) return;
    this.nextLook = seconds + LOOK_SECONDS;
    if (this.studio) {
      this.apply(DAY, DAY, 0, 90, 0, null);
      return;
    }
    const ms = this.now();
    const { elevation, azimuth } = sunPosition(ms, this.place);
    const moon = moonPosition(ms, this.place);
    const light = moonPhase(ms).lit ** MOON_FALLOFF * fade(moon.elevation, MOON_RISING);
    const looks = sunRising(ms, this.place) ? MORNING : EVENING;
    let index = 0;
    while (index < looks.length - 2 && elevation > (looks[index + 1] as Look).at) index++;
    const a = looks[index] as Look;
    const b = looks[index + 1] as Look;
    const t = clamp((elevation - a.at) / (b.at - a.at), 0, 1);
    this.apply(a, b, t, elevation, azimuth, { ...moon, light });
  }

  private apply(
    a: Look,
    b: Look,
    t: number,
    elevation: number,
    azimuth: number,
    /** Where the moon is and how much light it gives, or null for steady daylight. */
    moon: { elevation: number; azimuth: number; light: number } | null,
  ): void {
    const { sun, fill, uniforms } = this;
    blendColor(sun.color, a.sun, b.sun, t);
    sun.intensity = lerp(a.sunPower, b.sunPower, t);
    blendColor(fill.color, a.top, b.top, t);
    blendColor(fill.groundColor, a.bottom, b.bottom, t);
    fill.intensity = lerp(a.fill, b.fill, t);
    blendColor(uniforms.uZenith.value, a.zenith, b.zenith, t);
    blendColor(this.background, a.horizon, b.horizon, t);
    uniforms.uHorizon.value.copy(this.background);
    SKY.horizon.value.copy(this.background);
    this.fog.color.copy(this.background);
    blendColor(uniforms.uGlow.value, a.glow, b.glow, t);
    blendColor(SKY.unlit.value, a.unlit, b.unlit, t);
    blendColor(SKY.glint.value, a.glint, b.glint, t);
    this.mapBackground.setHex(MAP_SEA).multiply(SKY.unlit.value);

    const moonTime = moon ? fade(elevation, MOON_TAKES_OVER) : 0;
    const moonlight = moon ? moon.light : 0;
    if (!moon) {
      this.lightDirection.copy(DAY_DIRECTION);
      SKY.direction.value.copy(DAY_DIRECTION);
    } else if (elevation > MOON_BELOW) {
      pointing(this.lightDirection, azimuth, Math.max(elevation, LOWEST_LIGHT));
      pointing(SKY.direction.value, azimuth, Math.max(elevation, 2));
    } else {
      pointing(this.lightDirection, moon.azimuth, Math.max(moon.elevation, LOWEST_LIGHT));
      pointing(SKY.direction.value, moon.azimuth, Math.max(moon.elevation, 2));
      sun.color.setHex(MOON_LIGHT);
      sun.intensity = MOON_POWER * moonlight * moonTime;
      SKY.glint.value.multiplyScalar(moonlight);
    }

    // Without a moon the night closes in: less of everything, and the stars come out more.
    const gloom = moon ? fade(elevation, [-3, -12]) * (1 - moonlight) : 0;
    fill.intensity *= lerp(1, DARKEST.fill, gloom);
    SKY.unlit.value.multiplyScalar(lerp(1, DARKEST.unlit, gloom));
    const skyShade = lerp(1, DARKEST.sky, gloom);
    this.background.multiplyScalar(skyShade);
    uniforms.uZenith.value.multiplyScalar(skyShade);
    uniforms.uHorizon.value.copy(this.background);
    SKY.horizon.value.copy(this.background);
    this.fog.color.copy(this.background);
    this.mapBackground.setHex(MAP_SEA).multiply(SKY.unlit.value);

    const dark = moon ? fade(elevation, LAMPS_ON) : 0;
    const shade = lerp(1, lerp(FOREST_SHADE[0], FOREST_SHADE[1], moonlight), dark);
    SKY.forest.value.setRGB(shade, shade, shade * 1.1);
    SKY.dark.value = dark * lerp(LAMPS_WHEN_DARKEST, 1, moonlight);

    pointing(uniforms.uSun.value, azimuth, elevation);
    if (moon) pointing(uniforms.uMoon.value, moon.azimuth, moon.elevation);
    const sunUp = fade(elevation, [-1.5, 1]);
    uniforms.uDisc.value.copy(sun.color).multiplyScalar(sunUp * 6);
    const moonUp = moon ? fade(elevation, [-1, -6]) : 0;
    uniforms.uMoonDisc.value.setRGB(moonUp * 1.6, moonUp * 1.7, moonUp * 1.9);
    uniforms.uMoonGlow.value = moonlight;
    uniforms.uStars.value = fade(elevation, STARS_ON) * lerp(0.6, 1.1, gloom);

    this.moonShadows = moon !== null && elevation <= MOON_BELOW;
    const strength = this.moonShadows
      ? fade(moonlight, MOON_SHADOWS) * moonTime * MOON_SHADOW_STRENGTH
      : fade(elevation, SHADOWS_FROM);
    this.shadows = strength > 0;
    sun.shadow.intensity = strength;
    sun.position.copy(sun.target.position).addScaledVector(this.lightDirection, LIGHT_DISTANCE);
  }

  /** Where the light comes from, as a unit vector. */
  get direction(): THREE.Vector3 {
    return this.lightDirection;
  }
}
