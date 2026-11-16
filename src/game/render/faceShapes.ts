import * as THREE from "three";

/**
 * A face's shapes on a character built in pieces (docs/CHARACTERS.md): blink, jaw, smile, brows
 * and the rest, named as ARKit names them. The skin has them all; the beard, the brows and the
 * lower teeth were cut to follow it and have their own copies. A shape is set by name, on every
 * piece that has it.
 */
export class FaceShapes {
  private readonly slots = new Map<string, [number[], number][]>();

  static from(scene: THREE.Object3D): FaceShapes | null {
    const face = new FaceShapes();
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.morphTargetDictionary || !o.morphTargetInfluences)
        return;
      for (const [name, index] of Object.entries(o.morphTargetDictionary)) {
        const slot = face.slots.get(name) ?? [];
        slot.push([o.morphTargetInfluences, index]);
        face.slots.set(name, slot);
      }
    });
    return face.slots.size > 0 ? face : null;
  }

  set(name: string, value: number): void {
    const slot = this.slots.get(name);
    if (!slot) return;
    for (const [influences, index] of slot) influences[index] = value;
  }

  /** Both sides of a shape that has a left and a right. */
  both(name: string, value: number): void {
    this.set(`${name}Left`, value);
    this.set(`${name}Right`, value);
  }
}
