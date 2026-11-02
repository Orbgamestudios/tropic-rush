// Scouting's danger map: a faint red disc for every defense's reach, so the ground gets redder
// where more guns overlap, and a bright ring round the one the player tapped.

import * as THREE from "three";
import { BUILDINGS } from "../logic/buildings";
import { terrainHeight } from "../logic/island";
import type { RaidState } from "../logic/raid";
import { overlayOpacity } from "./sky";

const DISC_OPACITY = 0.14;
const EDGE_OPACITY = 0.6;
const SELECTED_OPACITY = 0.3;

function overlay(color: number, opacity: number): THREE.MeshBasicMaterial {
  // Laid flat over hills and rooftops alike, so it ignores the depth of what's under it.
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: opacity * overlayOpacity(),
    depthTest: false,
    depthWrite: false,
  });
}

export class RangeRings {
  readonly root = new THREE.Group();
  private readonly discs = new Map<number, THREE.Mesh>();
  private readonly unit = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  private readonly edge = new THREE.RingGeometry(0.97, 1, 64).rotateX(-Math.PI / 2);
  private readonly faint = overlay(0xff3a2a, DISC_OPACITY);
  private readonly red = overlay(0xff3a2a, EDGE_OPACITY);
  private readonly bright = overlay(0xff3a2a, SELECTED_OPACITY);
  private readonly gold = overlay(0xffd66a, 0.95);
  private readonly outline = new THREE.Mesh(this.edge, this.gold);
  private selected: THREE.Mesh | null = null;

  constructor(state: RaidState) {
    for (const b of state.buildings) {
      const attack = BUILDINGS[b.type].attack;
      if (!attack) continue;
      const mesh = new THREE.Mesh(this.unit, this.faint);
      mesh.position.set(b.pos.x, Math.max(0, terrainHeight(b.pos.x, b.pos.y)) + 0.3, b.pos.y);
      mesh.scale.set(attack.range, 1, attack.range);
      mesh.renderOrder = 3;
      const edge = new THREE.Mesh(this.edge, this.red);
      edge.position.copy(mesh.position);
      edge.scale.copy(mesh.scale);
      edge.renderOrder = 3;
      this.discs.set(b.id, mesh);
      this.root.add(mesh, edge);
    }
    this.outline.renderOrder = 4;
    this.outline.visible = false;
    this.root.add(this.outline);
  }

  /** Lights up one defense's reach; anything else clears it. */
  select(id: number | null): void {
    if (this.selected) this.selected.material = this.faint;
    this.selected = (id !== null && this.discs.get(id)) || null;
    this.outline.visible = this.selected !== null;
    if (!this.selected) return;
    this.selected.material = this.bright;
    this.outline.position.copy(this.selected.position);
    this.outline.scale.copy(this.selected.scale);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.unit.dispose();
    this.edge.dispose();
    this.faint.dispose();
    this.red.dispose();
    this.bright.dispose();
    this.gold.dispose();
  }
}
