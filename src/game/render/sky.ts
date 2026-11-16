// The sky over the whole game: the scene's lights, the fog, a sky dome with clouds and stars, and
// the values everything unlit shares (sea, clouds, smoke). It follows the game's scenes (the
// owner's call, 2026-11-16): bright midday on the crew's own island, late afternoon in the boat
// choosing a crew, golden evening for a raid, dusk as the boat lands or after a win, and moonlit
// night for being raided and for the boat home after a raid. Moving from one scene to the next
// eases over a few seconds, and inside one the sun sinks a degree or so every few minutes, so it
// never sits dead still. With no scene set, it follows the real sun and moon where the player is,
// looking at the clock every few seconds rather than every frame. The moon lights the night as
// much as its phase allows: a new moon gives no light and no shadows, and on those nights the
// shadow pass stops altogether; moon shadows are redrawn at half the sun's rate. The clouds are in
// skyClouds.ts.

import * as THREE from "three";
import { moonPhase, moonPosition, type Place, sunPosition, sunRising } from "../logic/sun";
import { clamp, lerp } from "../logic/vec";
import { CLOUD_LAYERS, cloudTexture, lightClouds } from "./skyClouds";

/** Seconds between looks at the clock: the sun moves a quarter of a degree a minute. */
const LOOK_SECONDS = 8;
/** Seconds between looks inside a scene, whose sun moves slower still. */
const SCENE_LOOK_SECONDS = 2;
/** Below this the directional light is the moon. It's almost off there, so the swap can't show. */
const MOON_BELOW = -1.5;
/**
 * Shadows are cast as if the light were never lower than this, in degrees: any lower and a palm's
 * shadow is a long bar of trunk across the island, with none of its crown.
 */
const LOWEST_LIGHT = 38;
/** Shadows fade out over these sun heights in degrees, and aren't drawn at all under them. */
const SHADOWS_FROM = [0.5, 6] as const;
/** Lamps come on over these sun heights, in degrees. */
const LAMPS_ON = [8, -3] as const;
/** Stars come out over these sun heights, in degrees. */
const STARS_ON = [-5, -13] as const;
/** The moon's light, at its strongest. */
const MOON_LIGHT = 0xa8bfff;
const MOON_POWER = 1.3;
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
const DARKEST = { fill: 0.88, unlit: 0.76, sky: 0.55 } as const;
/** The jungle's own shade at night, under a new moon and a full one (1 is no change). */
const FOREST_SHADE = [0.27, 0.45] as const;
/** How much selection squares and range circles fade at night. */
const OVERLAY_DIMMING = 0.62;
/** Lamps look stronger the less moon there is to compete with them. */
const LAMPS_WHEN_DARKEST = 1.7;
/** How far the sun sits from what it's lighting, in meters. */
export const LIGHT_DISTANCE = 65;
const DAY_DIRECTION = new THREE.Vector3(-28, 48, 34).normalize();
const MAP_SEA = 0x0a2f5a;
/**
 * Just after sunset the Earth's shadow rises in the sky opposite the sun, a band of dusky blue,
 * and above it the last sunlight in the air glows pink: the Belt of Venus. It shows over these sun
 * heights, in degrees, and goes again as the shadow climbs out of the way.
 */
const BELT_SHOWS = [1.5, -1] as const;
const BELT_GOES = [-5, -9] as const;
const BELT = 0xe88aa8;
const EARTH_SHADOW = new THREE.Color(0.52, 0.56, 0.86);

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
  /** Where the sun itself is (the moon, at night), which is where its light on the water leads. */
  sun: { value: DAY_DIRECTION.clone() },
  /** The sky straight up, which the sea reflects when it's looked down on. */
  zenith: { value: new THREE.Color(0x4f9fe0) },
  /** The jungle's plants multiply themselves by this, so the forest goes darker than the open. */
  forest: { value: new THREE.Color(1, 1, 1) },
  /** 0 by day, 1 and over once it's dark enough for lamps to show. */
  dark: { value: 0 },
  /**
   * What lamplight is multiplied by to land on what's already lit: the light falling on open
   * ground just now, as its brightness over each of its colors. Under a blue moon a warm lamp
   * shows warm, rather than brightening the blue that's already there.
   */
  lampBalance: { value: new THREE.Color(1, 1, 1) },
};

/** How far the light already there may push a lamp's color, either way. */
const BALANCE_RANGE = [0.3, 3] as const;

/** Where the game is, which decides the hour: see the top of this file. */
export type SkyScene = "day" | "afternoon" | "evening" | "dusk" | "night";

/** How much of each layer of cloud there is, 0 to 1 (see skyClouds.ts). */
interface Weather {
  low: number;
  mid: number;
  high: number;
  /** The banks of cumulus round the horizon. */
  bank: number;
}

interface SceneSky {
  /** The sun's height in degrees as the scene opens, and where it's sunk to after DRIFT_SECONDS. */
  sun: readonly [number, number];
  /** Its bearing, 0 north and 90 east. The game looks north-east, so this is where it lights from. */
  azimuth: number;
  /** The moon's height as the scene opens and after the drift, its bearing, and its phase's light. */
  moon: { elevation: readonly [number, number]; azimuth: number; light: number };
  clouds: Weather;
}

/** How long a scene's sun takes to drift from where it starts to where it ends, in seconds. */
const DRIFT_SECONDS = 300;

/**
 * The game looks north-east. By day the sun is high behind the view, so everything's lit full on
 * in bright color. Later it swings round to the left and sinks, lighting the island from the side
 * with long shadows and laying its road of light across the sea to the left. At night the moon
 * hangs ahead and to the right, where the boat looks out to it.
 */
const SCENES: Record<SkyScene, SceneSky> = {
  day: {
    sun: [64, 60],
    azimuth: 200,
    moon: { elevation: [-30, -30], azimuth: 20, light: 0 },
    clouds: { low: 0.52, mid: 0.12, high: 0.35, bank: 0.62 },
  },
  afternoon: {
    sun: [15, 9],
    azimuth: 255,
    moon: { elevation: [-20, -20], azimuth: 75, light: 0 },
    clouds: { low: 0.42, mid: 0.38, high: 0.5, bank: 0.55 },
  },
  evening: {
    sun: [9, 5],
    azimuth: 285,
    moon: { elevation: [-6, -4], azimuth: 105, light: 0 },
    clouds: { low: 0.24, mid: 0.42, high: 0.48, bank: 0.45 },
  },
  dusk: {
    sun: [-1.5, -4.5],
    azimuth: 290,
    moon: { elevation: [5, 7], azimuth: 105, light: 0.8 },
    clouds: { low: 0.18, mid: 0.34, high: 0.4, bank: 0.42 },
  },
  night: {
    sun: [-24, -24],
    azimuth: 245,
    moon: { elevation: [20, 23], azimuth: 70, light: 0.85 },
    clouds: { low: 0.32, mid: 0.28, high: 0.3, bank: 0.38 },
  },
};

/** The clock's sky gets the same fair-weather clouds every day. */
const CLOCK_WEATHER: Weather = { low: 0.42, mid: 0.3, high: 0.42, bank: 0.5 };

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
  top: 0x6682cc,
  bottom: 0x4a5788,
  fill: 1.4,
  zenith: 0x060c22,
  horizon: 0x141f46,
  unlit: 0x6f84be,
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
  zenith: 0x2c4892,
  horizon: 0xd8807e,
  unlit: 0xb096ac,
  glint: 0x000000,
  glow: 0xd07020,
};

const SUNSET: Look = {
  at: 3,
  sun: 0xffa868,
  sunPower: 1.9,
  top: 0xffbc9c,
  bottom: 0xa07a6c,
  fill: 1.15,
  zenith: 0x4a6cc0,
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
  zenith: 0x78b0e2,
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
  zenith: 0x6fbdf0,
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

/** A look worked out for one sun height: colors ready to use. */
class Shade {
  readonly sun = new THREE.Color();
  sunPower = 0;
  readonly top = new THREE.Color();
  readonly bottom = new THREE.Color();
  fill = 0;
  readonly zenith = new THREE.Color();
  readonly horizon = new THREE.Color();
  readonly unlit = new THREE.Color();
  readonly glint = new THREE.Color();
  readonly glow = new THREE.Color();

  /** The look for this sun height, between the two looks either side of it. */
  at(looks: readonly Look[], elevation: number): this {
    let index = 0;
    while (index < looks.length - 2 && elevation > (looks[index + 1] as Look).at) index++;
    const a = looks[index] as Look;
    const b = looks[index + 1] as Look;
    const t = clamp((elevation - a.at) / (b.at - a.at), 0, 1);
    blendColor(this.sun, a.sun, b.sun, t);
    this.sunPower = lerp(a.sunPower, b.sunPower, t);
    blendColor(this.top, a.top, b.top, t);
    blendColor(this.bottom, a.bottom, b.bottom, t);
    this.fill = lerp(a.fill, b.fill, t);
    blendColor(this.zenith, a.zenith, b.zenith, t);
    blendColor(this.horizon, a.horizon, b.horizon, t);
    blendColor(this.unlit, a.unlit, b.unlit, t);
    blendColor(this.glint, a.glint, b.glint, t);
    blendColor(this.glow, a.glow, b.glow, t);
    return this;
  }

  /** Moves this look towards another. */
  toward(other: Shade, t: number): this {
    this.sun.lerp(other.sun, t);
    this.sunPower = lerp(this.sunPower, other.sunPower, t);
    this.top.lerp(other.top, t);
    this.bottom.lerp(other.bottom, t);
    this.fill = lerp(this.fill, other.fill, t);
    this.zenith.lerp(other.zenith, t);
    this.horizon.lerp(other.horizon, t);
    this.unlit.lerp(other.unlit, t);
    this.glint.lerp(other.glint, t);
    this.glow.lerp(other.glow, t);
    return this;
  }
}

/** Everything that decides the sky at one moment, as numbers that can be eased between. */
interface Moment {
  sun: number;
  azimuth: number;
  moon: number;
  moonAzimuth: number;
  /** The moon's light, 0 to 1, for its phase and how high it is. */
  moonLight: number;
  /** 1 while the sun's climbing, for the pinker colors of a morning. */
  morning: number;
  clouds: Weather;
}

function moment(): Moment {
  return {
    sun: 0,
    azimuth: 0,
    moon: 0,
    moonAzimuth: 0,
    moonLight: 0,
    morning: 0,
    clouds: { ...CLOCK_WEATHER },
  };
}

/** Bearings ease the short way round. */
function lerpBearing(a: number, b: number, t: number): number {
  const turn = ((((b - a) % 360) + 540) % 360) - 180;
  return a + turn * t;
}

function blendMoments(out: Moment, a: Moment, b: Moment, t: number): void {
  out.sun = lerp(a.sun, b.sun, t);
  out.azimuth = lerpBearing(a.azimuth, b.azimuth, t);
  out.moon = lerp(a.moon, b.moon, t);
  out.moonAzimuth = lerpBearing(a.moonAzimuth, b.moonAzimuth, t);
  out.moonLight = lerp(a.moonLight, b.moonLight, t);
  out.morning = lerp(a.morning, b.morning, t);
  out.clouds.low = lerp(a.clouds.low, b.clouds.low, t);
  out.clouds.mid = lerp(a.clouds.mid, b.clouds.mid, t);
  out.clouds.high = lerp(a.clouds.high, b.clouds.high, t);
  out.clouds.bank = lerp(a.clouds.bank, b.clouds.bank, t);
}

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
  uniform float uTime;
  uniform vec3 uBelt;
  uniform vec3 uEarthShadow;
  uniform float uBeltFrom;
  uniform float uPale;
  uniform float uRise;
  uniform float uDuskPale;
  varying vec3 vDirection;
  ${CLOUD_LAYERS}

  void main() {
    vec3 d = normalize(vDirection);
    float up = max(d.y, 0.0);
    vec2 bearing = normalize(d.xz + 1e-5);
    float rise = pow(up, uRise);
    // Blended as the eye sees it, not as light adds: mixed straight, a bright horizon swamps the
    // deep blue overhead and the whole sky takes its color.
    vec3 low = sqrt(uHorizon);
    vec3 high = sqrt(uZenith);
    vec3 color = mix(low, high, rise);
    float toward = max(dot(d, uSun), 0.0);
    float side = dot(bearing, normalize(uSun.xz + 1e-5));
    // Even so, a golden horizon and a blue sky make a dull mauve between them. In the real golden
    // hour the sky passes through a pale band instead: creamy towards the sun, a light clear blue
    // away from it. After sunset the purple between is real, and stays, except towards where the
    // sun went down, where the glow fades up through yellow.
    float sunward = max(side, 0.0);
    float paling = max(uPale, uDuskPale * sunward * sunward);
    float warmth = clamp((uHorizon.r - uHorizon.b) * 2.5, 0.0, 1.0) * paling;
    vec3 pale = mix(high * 1.12 + 0.07, vec3(1.0, 0.93, 0.76) * dot(low, vec3(0.3, 0.6, 0.1)), sunward);
    vec3 banded = rise < 0.3 ? mix(low, pale, rise / 0.3) : mix(pale, high, (rise - 0.3) / 0.7);
    color = mix(color, banded, warmth);
    color *= color;
    // Everything that depends on the bearing leaves the horizon line alone, so the foggy sea meets
    // the sky without a seam.
    float lifted = smoothstep(0.0, 0.06, d.y);
    // The glow round a low sun: a wide aureole, a bright core, and a band along the horizon under
    // it, where its light comes through the most air.
    // Once the sun's down its aureole sinks with it, leaving the sky above to darken to blue.
    float halo = (pow(toward, 8.0) * 0.4 + pow(toward, 48.0) * 0.9) * mix(1.0, exp(-up * 7.0), uDuskPale);
    float band = pow(sunward, 2.0) * exp(-up * 8.0) + pow(sunward, 4.0) * exp(-up * 18.0) * uDuskPale;
    float bright = pow(toward, 24.0) * 0.02 + pow(toward, 140.0) * 0.05;
    color += (uGlow * (halo + band * 0.9) + uDisc * bright) * lifted;
    // The Earth's shadow and the Belt of Venus over it, opposite the sun and fading round the sides.
    float opposite = smoothstep(-0.2, 0.8, -side);
    float shadowed = 1.0 - smoothstep(uBeltFrom - 0.015, uBeltFrom + 0.03, up);
    float belt = (1.0 - shadowed) * (1.0 - smoothstep(uBeltFrom + 0.03, uBeltFrom + 0.2, up));
    color = mix(color, color * uEarthShadow, shadowed * opposite * smoothstep(0.0, 0.02, d.y));
    color += uBelt * belt * opposite * lifted;

    color += uDisc * smoothstep(0.99975, 0.99988, toward) * lifted;
    float moon = max(dot(d, uMoon), 0.0);
    color += uMoonDisc * pow(moon, 400.0) * 0.14 * uMoonGlow * lifted;
    color += uMoonDisc * pow(moon, 12.0) * 0.05 * uMoonGlow * lifted;
    if (moon > 0.9985) {
      // A ball lit from where the sun really is, so the phase shows and leans the right way. Its
      // face is the half turned back towards us.
      vec3 across = (d - uMoon * moon) / 0.0548;
      vec3 ball = across - uMoon * sqrt(max(0.0, 1.0 - dot(across, across)));
      float lit = smoothstep(-0.06, 0.1, dot(ball, uSun));
      // Never darker than the sky behind it: in twilight it's a pale disc, not a hole.
      vec3 face = max(uMoonDisc, vec3(0.95, 0.97, 1.0)) * lit;
      color = max(color, mix(color, face, smoothstep(0.9985, 0.9987, moon) * lifted * lit));
    }
    if (uStars > 0.01) {
      float stars = texture2D(uStarMap, d.xz / (up + 0.4) * 1.4).r;
      // The Milky Way, a faint river of light arched across the sky.
      float river = exp(-pow(dot(d, vec3(0.42, 0.3, 0.86)), 2.0) * 26.0);
      float dust = texture2D(uClouds, d.xz / (up + 0.5) * 0.7).r;
      float milky = river * smoothstep(0.25, 0.8, dust);
      color += uStars * (stars * (1.0 + milky * 1.5) + vec3(0.06, 0.07, 0.11) * milky) * smoothstep(0.03, 0.3, up);
    }
    if (d.y > -0.01) color = cloudLayers(d, bearing, color, uTime);
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

/** How much of its opacity a bright flat overlay keeps just now, so it won't glare after dark. */
export function overlayOpacity(): number {
  return 1 - OVERLAY_DIMMING * Math.min(1, SKY.dark.value);
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
const WHITE = new THREE.Color(1, 1, 1);

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
    uTime: { value: 0 },
    uBelt: { value: new THREE.Color(0, 0, 0) },
    uEarthShadow: { value: new THREE.Color(1, 1, 1) },
    /** How high the Earth's shadow has risen, as the sine of its height. */
    uBeltFrom: { value: 0 },
    /** How much the sky between a golden horizon and blue overhead goes pale rather than mauve. */
    uPale: { value: 0 },
    /** How quickly the sky turns from the horizon's color to the color overhead, going up. */
    uRise: { value: 0.55 },
    /** Just after sunset: how much the sky over where the sun went down fades up through yellow. */
    uDuskPale: { value: 0 },
    uClouds: { value: null as THREE.Texture | null },
    uCover: { value: new THREE.Vector4() },
    uLight: { value: new THREE.Vector3(0, 1, 0) },
    uScatter: { value: 1 },
    uHighLit: { value: new THREE.Color() },
    uHighShade: { value: new THREE.Color() },
    uMidLit: { value: new THREE.Color() },
    uMidShade: { value: new THREE.Color() },
    uLowLit: { value: new THREE.Color() },
    uLowShade: { value: new THREE.Color() },
  };
  private readonly cloudLit = [
    this.uniforms.uLowLit.value,
    this.uniforms.uMidLit.value,
    this.uniforms.uHighLit.value,
  ] as const;
  private readonly cloudShade = [
    this.uniforms.uLowShade.value,
    this.uniforms.uMidShade.value,
    this.uniforms.uHighShade.value,
  ] as const;
  private readonly lightDirection = DAY_DIRECTION.clone();
  private readonly lit = new THREE.Color();
  private readonly sunLit = new THREE.Color();
  private readonly look = new Shade();
  private readonly morningLook = new Shade();
  private place: Place = { lat: 0, lon: 0 };
  /** A fixed moment to show instead of the clock, for tests. */
  private heldClock: number | null = null;
  /** A cutscene's being shot: faces get more light than the hour alone would give them. */
  private filming = false;
  private studio = false;
  private nextLook = 0;
  /** What's over the sky just now: the dome shows when nothing is. */
  private readonly covers = new Set<string>();
  /** The scene the game's in, or null to follow the clock. */
  private scene: SkyScene | null = null;
  /** When the scene began, for its sun's drift; below 0 until the next update says. */
  private sceneSince = -1;
  /** Easing from `from` since this many seconds, over this many; below 0 until the next update. */
  private easeSince = -1;
  private easeSeconds = 0;
  private readonly from = moment();
  private readonly wanted = moment();
  private readonly shown = moment();
  private showing = false;

  constructor(
    scene: THREE.Scene,
    private readonly sun: THREE.DirectionalLight,
    private readonly fill: THREE.HemisphereLight,
    private readonly fog: THREE.Fog,
  ) {
    this.uniforms.uStarMap.value = starTexture();
    this.uniforms.uClouds.value = cloudTexture();
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

  /**
   * Shows a moment of the day instead of the clock (null goes back to the clock). A held moment
   * outranks a scene, and shows at once.
   */
  holdClock(ms: number | null): void {
    this.heldClock = ms;
    this.easeSeconds = 0;
    this.nextLook = 0;
  }

  /**
   * Says which scene the game is in, and the sky eases there over `seconds`; null goes back to
   * following the clock. Saying the scene it's already in changes nothing, so its sun's drift
   * carries on.
   */
  setScene(scene: SkyScene | null, seconds = 3): void {
    if (scene === this.scene) return;
    this.scene = scene;
    this.sceneSince = -1;
    this.easeFrom(seconds);
  }

  /** The scene being shown, or null while it follows the clock. */
  get currentScene(): SkyScene | null {
    return this.scene;
  }

  private easeFrom(seconds: number): void {
    blendMoments(this.from, this.shown, this.shown, 0);
    this.easeSince = -1;
    this.easeSeconds = this.showing ? seconds : 0;
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

  /** Call every frame: it only does anything every few seconds, or while easing to a new scene. */
  update(seconds: number): void {
    this.uniforms.uTime.value = seconds;
    if (this.sceneSince < 0) this.sceneSince = seconds;
    if (this.easeSince < 0) this.easeSince = seconds;
    const eased = (seconds - this.easeSince) / Math.max(this.easeSeconds, 1e-6);
    const easing = this.easeSeconds > 0 && eased < 1;
    if (!easing && seconds < this.nextLook) return;
    const following = this.scene === null || this.heldClock !== null;
    this.nextLook = easing ? 0 : seconds + (following ? LOOK_SECONDS : SCENE_LOOK_SECONDS);
    if (this.studio) {
      this.look.at(EVENING, 90);
      this.apply(this.look, 90, 0, null, CLOCK_WEATHER);
      return;
    }
    if (following) this.clockMoment(this.wanted);
    else this.sceneMoment(this.scene as SkyScene, seconds, this.wanted);
    const t = easing && this.showing ? eased * eased * (3 - 2 * eased) : 1;
    blendMoments(this.shown, this.from, this.wanted, t);
    this.showing = true;
    const m = this.shown;
    this.look.at(EVENING, m.sun);
    if (m.morning > 0) this.look.toward(this.morningLook.at(MORNING, m.sun), m.morning);
    const moon = { elevation: m.moon, azimuth: m.moonAzimuth, light: m.moonLight };
    this.apply(this.look, m.sun, m.azimuth, moon, m.clouds);
  }

  private clockMoment(out: Moment): void {
    const ms = this.now();
    const sun = sunPosition(ms, this.place);
    const moon = moonPosition(ms, this.place);
    out.sun = sun.elevation;
    out.azimuth = sun.azimuth;
    out.moon = moon.elevation;
    out.moonAzimuth = moon.azimuth;
    out.moonLight = moonPhase(ms).lit ** MOON_FALLOFF * fade(moon.elevation, MOON_RISING);
    out.morning = sunRising(ms, this.place) ? 1 : 0;
    Object.assign(out.clouds, CLOCK_WEATHER);
  }

  private sceneMoment(scene: SkyScene, seconds: number, out: Moment): void {
    const sky = SCENES[scene];
    const drift = clamp((seconds - this.sceneSince) / DRIFT_SECONDS, 0, 1);
    out.sun = lerp(sky.sun[0], sky.sun[1], drift);
    out.azimuth = sky.azimuth;
    out.moon = lerp(sky.moon.elevation[0], sky.moon.elevation[1], drift);
    out.moonAzimuth = sky.moon.azimuth;
    out.moonLight = sky.moon.light * fade(out.moon, MOON_RISING);
    out.morning = 0;
    Object.assign(out.clouds, sky.clouds);
  }

  private apply(
    look: Shade,
    elevation: number,
    azimuth: number,
    /** Where the moon is and how much light it gives, or null for steady daylight. */
    moon: { elevation: number; azimuth: number; light: number } | null,
    clouds: Weather,
  ): void {
    const { sun, fill, uniforms } = this;
    sun.color.copy(look.sun);
    sun.intensity = look.sunPower;
    fill.color.copy(look.top);
    fill.groundColor.copy(look.bottom);
    fill.intensity = look.fill;
    uniforms.uZenith.value.copy(look.zenith);
    this.background.copy(look.horizon);
    uniforms.uGlow.value.copy(look.glow);
    SKY.unlit.value.copy(look.unlit);
    SKY.glint.value.copy(look.glint);

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
    if (this.filming) {
      // The lower the sun, the more of the fill a face needs.
      fill.intensity *= lerp(1.75, 1.2, clamp(elevation / 35, 0, 1));
      sun.intensity *= 1.12;
    }
    SKY.unlit.value.multiplyScalar(lerp(1, DARKEST.unlit, gloom));
    const skyShade = lerp(1, DARKEST.sky, gloom);
    this.background.multiplyScalar(skyShade);
    uniforms.uZenith.value.multiplyScalar(skyShade);
    uniforms.uHorizon.value.copy(this.background);
    SKY.horizon.value.copy(this.background);
    this.fog.color.copy(this.background);
    this.mapBackground.setHex(MAP_SEA).multiply(SKY.unlit.value);
    SKY.zenith.value.copy(uniforms.uZenith.value);

    const dark = moon ? fade(elevation, LAMPS_ON) : 0;
    const shade = lerp(1, lerp(FOREST_SHADE[0], FOREST_SHADE[1], moonlight), dark);
    SKY.forest.value.setRGB(shade, shade, shade * 1.1);
    SKY.dark.value = dark * lerp(LAMPS_WHEN_DARKEST, 1, moonlight);

    pointing(uniforms.uSun.value, azimuth, elevation);
    if (moon) pointing(uniforms.uMoon.value, moon.azimuth, moon.elevation);
    SKY.sun.value.copy(
      moon && elevation <= MOON_BELOW ? uniforms.uMoon.value : uniforms.uSun.value,
    );
    const sunUp = fade(elevation, [-1.5, 1]);
    uniforms.uDisc.value.copy(sun.color).multiplyScalar(sunUp * 6);
    const moonUp = moon ? fade(elevation, [-1, -6]) : 0;
    uniforms.uMoonDisc.value.setRGB(moonUp * 1.6, moonUp * 1.7, moonUp * 1.9);
    uniforms.uMoonGlow.value = moonlight;
    uniforms.uStars.value = fade(elevation, STARS_ON) * lerp(0.6, 1.1, gloom);

    const belt = fade(elevation, BELT_SHOWS) * (1 - fade(elevation, BELT_GOES));
    uniforms.uBelt.value.setHex(BELT).multiplyScalar(belt * 0.34 * skyShade);
    uniforms.uEarthShadow.value.copy(WHITE).lerp(EARTH_SHADOW, belt);
    uniforms.uBeltFrom.value = Math.sin(THREE.MathUtils.degToRad(Math.max(-elevation, 0))) + 0.01;
    uniforms.uPale.value = fade(elevation, [1, 6]);
    uniforms.uDuskPale.value = belt;
    // Once the sun's down the color of the horizon hugs it, and the deep blue comes further down.
    uniforms.uRise.value = lerp(0.55, 0.38, fade(elevation, [1, -4]));

    // The clouds catch the sun until it's well down, then the moon.
    const sunOnClouds = fade(elevation, [-7, -2]);
    if (moon && sunOnClouds === 0) {
      uniforms.uLight.value.copy(uniforms.uMoon.value);
      uniforms.uScatter.value = moonlight * 0.55 * fade(moon.elevation, [-2, 6]) * moonUp;
    } else {
      uniforms.uLight.value.copy(uniforms.uSun.value);
      uniforms.uScatter.value = sunOnClouds;
    }
    uniforms.uCover.value.set(clouds.low, clouds.mid, clouds.high, clouds.bank);
    lightClouds(this.cloudLit, this.cloudShade, {
      sun: moon ? elevation : 60,
      horizon: this.background,
      zenith: uniforms.uZenith.value,
      moonlight: moon ? moonlight * moonUp : 0,
    });

    this.moonShadows = moon !== null && elevation <= MOON_BELOW;
    const strength = this.moonShadows
      ? fade(moonlight, MOON_SHADOWS) * moonTime * MOON_SHADOW_STRENGTH
      : fade(elevation, SHADOWS_FROM);
    this.shadows = strength > 0;
    sun.shadow.intensity = strength;
    sun.position.copy(sun.target.position).addScaledVector(this.lightDirection, LIGHT_DISTANCE);

    const sunOnGround = sun.intensity * Math.max(0, this.lightDirection.y);
    const ground = this.lit
      .copy(fill.color)
      .multiplyScalar(fill.intensity)
      .add(this.sunLit.copy(sun.color).multiplyScalar(sunOnGround));
    const brightness = 0.2126 * ground.r + 0.7152 * ground.g + 0.0722 * ground.b;
    const balance = (c: number) =>
      clamp(brightness / Math.max(c, 1e-4), BALANCE_RANGE[0], BALANCE_RANGE[1]);
    SKY.lampBalance.value.setRGB(balance(ground.r), balance(ground.g), balance(ground.b));
  }

  /**
   * Where the sun really is, as a unit vector, and its light. The scene's light is never lower
   * than its shadows can stand, and at night it's the moon: this is the sun itself, for a lens.
   */
  get sunDirection(): THREE.Vector3 {
    return this.uniforms.uSun.value;
  }

  get sunColor(): THREE.Color {
    return this.sun.color;
  }

  /**
   * Lights a cutscene the way a film crew would: the same sun and sky, with the shade filled in so
   * a face against a low sun isn't a silhouette.
   */
  setFilming(on: boolean): void {
    this.filming = on;
    this.nextLook = 0;
  }

  /** Looks at the clock again on the next frame: the hour's just been changed. */
  lookNow(): void {
    this.nextLook = 0;
  }

  /** Where the light comes from, as a unit vector. */
  get direction(): THREE.Vector3 {
    return this.lightDirection;
  }
}
