import * as THREE from "three";

// Colors from the art direction in docs/DESIGN.md: blue is the crew's color, the enemy is
// charcoal and painted rust-orange, and nothing on the enemy side uses blue.
export const COLORS = {
  sky: 0xbfe6f2,
  grass: 0x7fc955,
  sand: 0xf0d9a0,
  wetSand: 0xdcc287,
  seabed: 0x8fe3d6,
  deepSeabed: 0x3bb4c3,
  water: 0x3ccbd4,
  foam: 0xffffff,

  enemyDark: 0x3d4149,
  enemyRust: 0xc4582c,
  bamboo: 0xcdb36b,
  tin: 0xa9b1b6,
  wood: 0x8b5a3c,
  woodDark: 0x6a4329,
  woodLight: 0xb0815a,
  stone: 0xa9a497,
  gold: 0xf3c24c,
  metal: 0x6e747b,
  darkMetal: 0x3a3e44,

  crewBlue: 0x4f86c6,
  crewBlueDark: 0x3b6aa3,
  skin: 0xf1c3a0,
  skinDark: 0x6f452f,
  hairBlonde: 0xf0d36b,
  hairBlack: 0x23252b,
  hairBrown: 0x7a4b2c,
  khaki: 0xa99c70,
  brown: 0x7a5a3e,
  olive: 0x7d8358,
  cream: 0xeee4cc,
  orange: 0xf08a3c,
  teal: 0x2f9e9a,
  denim: 0x4a6b8f,
  medicGreen: 0x5f8a5a,
  white: 0xf7f7f2,
  tankSand: 0xd8c08f,

  palmTrunk: 0x9a7048,
  palmLeaf: 0x5cb84b,
  bush: 0x4f9e43,
  rock: 0xb4ae9f,
} as const;

export interface MaterialOptions {
  emissive?: number;
}

const cache = new Map<string, THREE.MeshLambertMaterial>();

/**
 * Shared matte materials, one per color, reused across raids (never disposed). Lambert rather than
 * physically based: nothing here is shiny enough to show it, and a phone fills the screen far
 * faster without it.
 */
export function material(color: number, options: MaterialOptions = {}): THREE.MeshLambertMaterial {
  const emissive = options.emissive ?? 0x000000;
  const key = `${color}|${emissive}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, emissive });
    cache.set(key, m);
  }
  return m;
}
