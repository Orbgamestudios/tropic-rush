// How far the enemy's defenses can shoot, as one shape however many of them there are. Each reach
// is painted once into a small mask, so overlapping guns simply merge, and a single sheet laid over
// the land draws the mask's outline: no rings inside rings, and no red piling up over the base. On
// a raid only the stretch of the line near the hero shows, to warn of the edge. Scouting shows all
// of it, faintly shaded, with a bright ring round the one defense the player tapped. A sniper
// reaches so far that it would swallow the rest, so snipers get a line of their own and no shading.

import * as THREE from "three";
import { BUILDINGS } from "../logic/buildings";
import type { RaidHero, RaidState } from "../logic/raid";
import { overlayOpacity } from "./sky";

const MASK_SIZE = 512;
/** Meters a reach takes to fade out on the mask, either side of its true edge. */
const EDGE = 1.6;
/** Squares in the sheet that follows the ground, each way. */
const GRID = 56;
/** A raid's line shows fully this far from the hero, in meters, and has gone by the second. */
const NEAR_METERS = 5;
const FAR_METERS = 12;

const FILL = { scout: 0.1, raid: 0.05 } as const;
const LINE = { scout: 0.75, raid: 0.55 } as const;
const SELECTED_FILL = 0.2;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMask;
  uniform vec2 uHero;
  uniform float uFollow;
  uniform float uFill;
  uniform float uLine;
  uniform float uDim;
  varying vec2 vUv;
  varying vec2 vWorld;
  void main() {
    vec2 m = texture2D(uMask, vUv).rg;
    float near = mix(
      1.0,
      1.0 - smoothstep(${NEAR_METERS.toFixed(1)}, ${FAR_METERS.toFixed(1)}, length(vWorld - uHero)),
      uFollow
    );
    // The mask crosses a half exactly where a reach ends.
    float guns = 1.0 - smoothstep(0.05, 0.11, abs(m.r - 0.5));
    float sniper = 1.0 - smoothstep(0.05, 0.11, abs(m.g - 0.5));
    float inside = smoothstep(0.5, 0.6, m.r);
    float alpha = (inside * uFill + max(guns, sniper * 0.8) * uLine) * near * uDim;
    if (alpha < 0.004) discard;
    vec3 color = mix(vec3(1.0, 0.24, 0.16), vec3(1.0, 0.68, 0.2), sniper * (1.0 - guns));
    gl_FragColor = vec4(color, alpha);
  }
`;

function flatOverlay(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: opacity * overlayOpacity(),
    depthTest: false,
    depthWrite: false,
  });
}

export class DangerMap {
  readonly root = new THREE.Group();
  private readonly canvas = document.createElement("canvas");
  private readonly texture = new THREE.CanvasTexture(this.canvas);
  private readonly sheet: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly hero = new THREE.Vector2();
  private readonly dim = { value: 1 };
  /** How many defenses are standing, so the mask is only repainted when that changes. */
  private standing = -1;
  private readonly size: number;
  /** The one defense picked out while scouting. */
  private readonly disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2),
    flatOverlay(0xff3a2a, SELECTED_FILL),
  );
  private readonly ring = new THREE.Mesh(
    new THREE.RingGeometry(0.975, 1, 72).rotateX(-Math.PI / 2),
    flatOverlay(0xffd66a, 0.95),
  );

  constructor(
    private readonly state: RaidState,
    mode: "scout" | "raid",
  ) {
    this.size = state.shape.reach * 2 + 60;
    this.canvas.width = MASK_SIZE;
    this.canvas.height = MASK_SIZE;
    this.texture.flipY = false;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    const geometry = new THREE.PlaneGeometry(this.size, this.size, GRID, GRID).rotateX(
      -Math.PI / 2,
    );
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      position.setY(i, Math.max(0, state.shape.height(x, z)) + 0.3);
      uv.setXY(i, x / this.size + 0.5, z / this.size + 0.5);
    }
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMask: { value: this.texture },
        uHero: { value: this.hero },
        uFollow: { value: mode === "raid" ? 1 : 0 },
        uFill: { value: FILL[mode] },
        uLine: { value: LINE[mode] },
        uDim: this.dim,
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      // Laid over hills and rooftops alike, so it ignores the depth of what's under it.
      depthTest: false,
      depthWrite: false,
    });
    this.sheet = new THREE.Mesh(geometry, this.material);
    this.sheet.renderOrder = 3;
    this.sheet.frustumCulled = false;
    this.disc.renderOrder = 4;
    this.ring.renderOrder = 4;
    this.disc.visible = false;
    this.ring.visible = false;
    this.root.add(this.sheet, this.disc, this.ring);
    this.paint();
  }

  private paint(): void {
    const g = this.canvas.getContext("2d");
    if (!g) return;
    const scale = MASK_SIZE / this.size;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#000";
    g.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
    g.globalCompositeOperation = "lighter";
    let standing = 0;
    for (const b of this.state.buildings) {
      const attack = BUILDINGS[b.type].attack;
      if (!attack || b.destroyed) continue;
      standing++;
      const color = attack.kind === "sniper" ? "#0f0" : "#f00";
      const outer = attack.range + EDGE;
      const inner = attack.kind === "mortar" ? attack.minRange : 0;
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, outer);
      // A mortar can't hit anything inside its blind spot, so its reach leaves that out.
      if (inner > 0) {
        glow.addColorStop((inner - EDGE) / outer, "#000");
        glow.addColorStop((inner + EDGE) / outer, color);
      } else glow.addColorStop(0, color);
      glow.addColorStop((attack.range - EDGE) / outer, color);
      glow.addColorStop(1, "#000");
      g.save();
      g.translate((b.pos.x / this.size + 0.5) * MASK_SIZE, (b.pos.y / this.size + 0.5) * MASK_SIZE);
      g.scale(scale, scale);
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, 0, outer, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    this.standing = standing;
    this.texture.needsUpdate = true;
  }

  /** Follows the hero along the line on a raid; nobody following hides it. */
  update(hero: RaidHero | undefined): void {
    this.dim.value = overlayOpacity();
    this.sheet.visible = hero?.alive ?? false;
    if (!hero) return;
    this.hero.set(hero.pos.x, hero.pos.y);
    const left = this.state.buildings.filter(
      (b) => !b.destroyed && BUILDINGS[b.type].attack,
    ).length;
    if (left !== this.standing) this.paint();
  }

  /** Lights up one defense's reach; anything else clears it. */
  select(id: number | null): void {
    const b = this.state.buildings.find((o) => o.id === id);
    const attack = b && BUILDINGS[b.type].attack;
    this.disc.visible = Boolean(attack);
    this.ring.visible = Boolean(attack);
    if (!b || !attack) return;
    const y = Math.max(0, this.state.shape.height(b.pos.x, b.pos.y)) + 0.35;
    for (const mesh of [this.disc, this.ring]) {
      mesh.position.set(b.pos.x, y, b.pos.y);
      mesh.scale.set(attack.range, 1, attack.range);
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.texture.dispose();
    this.material.dispose();
    for (const mesh of [this.sheet, this.disc, this.ring]) {
      mesh.geometry.dispose();
      if (mesh !== this.sheet) (mesh.material as THREE.Material).dispose();
    }
  }
}
