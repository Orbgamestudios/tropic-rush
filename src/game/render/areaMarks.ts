// The circles on the ground that show where something reaches: a medkit's healing ground, a shock
// circle, a smoke cloud's shadow, burning ground, and where an incoming shell will land. Each is
// one flat quad drawn by a shader: a soft fill, a glowing rim and a pulse running out to the edge.
// A shock circle's rim crackles (its lightning is in the air: see lightning.ts); healing ground
// breathes a soft cross; smoke is a stain with a drifting edge, and no rim, since the cloud over
// it says enough.

import * as THREE from "three";

export type AreaKind = "heal" | "shock" | "smoke" | "fire" | "incoming";

const LOOKS: Record<AreaKind, { color: number; style: number }> = {
  heal: { color: 0x6dff9a, style: 0 },
  shock: { color: 0x6fd8ff, style: 1 },
  smoke: { color: 0xc9ced6, style: 2 },
  fire: { color: 0xff6a1c, style: 3 },
  incoming: { color: 0xff4b3a, style: 4 },
};

/** How far past its edge the quad goes, for the rim's glow. */
const OUTSET = 1.18;

const VERTEX = /* glsl */ `
  varying vec2 vPlace;
  void main() {
    vPlace = position.xz * ${OUTSET.toFixed(2)};
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStyle;
  uniform float uSeed;
  /** How far along it is: a shell's flight, or how much is left of a zone (fading out under 1). */
  uniform float uLife;
  varying vec2 vPlace;

  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
  }

  void main() {
    float r = length(vPlace);
    float a = atan(vPlace.y, vPlace.x);
    if (r > ${OUTSET.toFixed(2)}) discard;
    float inside = smoothstep(1.02, 0.97, r);
    vec3 color = uColor;
    float alpha;

    if (uStyle > 1.5 && uStyle < 2.5) {
      // Smoke: a soft grey stain, its edge drifting.
      float edge = 0.78 + 0.16 * noise(a * 2.5 + uTime * 0.4 + uSeed);
      alpha = smoothstep(1.0, edge, r) * 0.42 * uLife;
      gl_FragColor = vec4(color, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      return;
    }

    float fill = inside * (0.1 + 0.16 * r * r);
    float rim = exp(-pow((r - 1.0) / 0.022, 2.0)) + 0.4 * exp(-pow((r - 1.0) / 0.08, 2.0));
    float pulseAt = fract(uTime * 0.6 + uSeed);
    float pulse = exp(-pow((r - pulseAt) / 0.035, 2.0)) * (1.0 - pulseAt) * 0.5 * inside;
    float extra = 0.0;

    if (uStyle < 0.5) {
      // Healing: a soft cross, breathing.
      vec2 p = abs(vPlace);
      float arm = 0.07;
      float reach = 0.3;
      float cross = max(
        smoothstep(arm, arm * 0.6, p.x) * smoothstep(reach, reach * 0.9, p.y),
        smoothstep(arm, arm * 0.6, p.y) * smoothstep(reach, reach * 0.9, p.x)
      );
      extra = cross * (0.22 + 0.1 * sin(uTime * 3.0));
    } else if (uStyle < 1.5) {
      // Shock: a rim that crackles all the way round.
      rim *= 0.55 + 0.9 * noise(a * 12.0 + uTime * 30.0 + uSeed * 9.0);
    } else if (uStyle > 3.5) {
      // Where a shell will land: it fills in as the shell comes down.
      fill = inside * (0.06 + 0.2 * smoothstep(uLife, uLife - 0.05, r) * r);
      pulse = 0.0;
    }

    alpha = (fill + rim * 0.85 + pulse + extra) * (uStyle > 3.5 ? 1.0 : uLife);
    gl_FragColor = vec4(color * (1.0 + extra * 1.5), clamp(alpha, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface AreaMark {
  mesh: THREE.Mesh;
  /** Moves its clock on, and how far along it is (see uLife). */
  update(time: number, life: number): void;
  dispose(): void;
}

/** A circle on the ground showing what a zone or an incoming shell covers. */
export function areaMark(
  kind: AreaKind,
  radius: number,
  color = LOOKS[kind].color,
  seed = Math.random(),
): AreaMark {
  const look = LOOKS[kind];
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uTime: { value: 0 },
    uStyle: { value: look.style },
    uSeed: { value: seed },
    uLife: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    // Laid flat over slopes, so it ignores the depth of what's under it.
    depthTest: false,
  });
  // The quad's corners sit at ±1 before OUTSET, so the rim is the radius.
  const geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(radius * OUTSET, 1, radius * OUTSET);
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return {
    mesh,
    update(time, life) {
      uniforms.uTime.value = time;
      uniforms.uLife.value = life;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
