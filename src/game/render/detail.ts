// Surface detail for everything that's a plain flat color: bark and planks get a grain running
// along them, leaves and grass get mottled with sunlit flecks, sand gets its speckle, and stone,
// paint and canvas get a little wear. Nothing has a texture of its own to load: it's all worked
// out from where the surface is and what color it is, from the one small noise texture the sea
// already uses. That costs four texture lookups a pixel on the cheapest kind of material, and no
// draw calls, which is the way a phone game gets surfaces that don't look like flat plastic.

import type * as THREE from "three";
import { noiseTexture } from "./noiseTexture";

const VERTEX_COMMON = /* glsl */ `#include <common>
varying vec3 vDetail;`;

/** Where the surface is on the thing it's part of, so the pattern stays put as it sways or walks. */
const VERTEX_BEGIN = /* glsl */ `#include <begin_vertex>
vDetail = position;
#ifdef USE_INSTANCING
  // Each copy gets its own stretch of the pattern, or a row of crates would all match.
  vDetail += instanceMatrix[3].xyz * 0.37;
#endif`;

const FRAGMENT_COMMON = /* glsl */ `#include <common>
uniform sampler2D uDetail;
varying vec3 vDetail;

// Noise through a solid, from a flat texture: two lookups, a layer apart, blended.
float detailNoise(vec3 p) {
  float layer = floor(p.z);
  float f = fract(p.z);
  f = f * f * (3.0 - 2.0 * f);
  vec2 at = (p.xy + layer * vec2(37.0, 17.0)) / 64.0;
  return mix(texture2D(uDetail, at).r, texture2D(uDetail, at + vec2(37.0, 17.0) / 64.0).r, f);
}

vec3 surfaced(vec3 c, vec3 p) {
  float warm = c.r - c.b;
  float green = c.g - max(c.r, c.b);
  // What it's made of, told from its color: browns are wood, greens are leaves, pale tans sand.
  float wood = smoothstep(0.07, 0.2, warm) * (1.0 - smoothstep(0.42, 0.62, c.g)) * step(green, 0.02);
  float leaf = smoothstep(0.03, 0.14, green);
  float sandy = smoothstep(0.12, 0.25, warm) * smoothstep(0.55, 0.7, c.g) * step(green, 0.02);
  // Too small to see is too small to draw: far off it would only sparkle as the camera moves.
  float near = 1.0 - smoothstep(0.05, 0.4, fwidth(p.x) + fwidth(p.y) + fwidth(p.z));
  vec3 q = mix(p * 2.1, vec3(p.x * 8.0, p.y * 0.85, p.z * 8.0), wood);
  q = mix(q, p * 9.0, sandy);
  float fine = detailNoise(q);
  float broad = detailNoise(p * 0.6 + 11.0);
  float amount = 0.09 + 0.13 * wood + 0.08 * leaf - 0.03 * sandy;
  c *= 1.0 + ((fine - 0.5) * 2.0 * amount * near) + (broad - 0.5) * 0.12;
  // Grain lines in wood, the light catching some leaves, and darker grains in sand.
  c *= 1.0 - wood * smoothstep(0.7, 0.78, fine) * 0.2 * near;
  c = mix(c, c * vec3(1.16, 1.1, 0.7), leaf * smoothstep(0.6, 0.82, fine) * 0.45 * near);
  c *= 1.0 - sandy * smoothstep(0.78, 0.86, fine) * 0.12 * near;
  return c;
}`;

const FRAGMENT_COLOR = /* glsl */ `#include <color_fragment>
diffuseColor.rgb = surfaced(diffuseColor.rgb, vDetail);`;

const done = new WeakSet<THREE.Material>();

/**
 * Gives a plain material its surface detail. It keeps whatever else the material already does to
 * its shader, and it's safe to ask twice.
 */
export function withDetail<T extends THREE.Material>(material: T): T {
  if (done.has(material)) return material;
  done.add(material);
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.uniforms.uDetail = { value: noiseTexture() };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", VERTEX_COMMON)
      .replace("#include <begin_vertex>", VERTEX_BEGIN);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", FRAGMENT_COMMON)
      .replace("#include <color_fragment>", FRAGMENT_COLOR);
  };
  material.customProgramCacheKey = () => `${key}|detail`;
  return material;
}
