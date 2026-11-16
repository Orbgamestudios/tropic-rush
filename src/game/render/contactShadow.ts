// A soft dark patch on the ground under someone's feet: where the light can't get in under them.
// The sun's shadow has to be lifted off a surface a little to keep it from shadowing itself in
// stripes, which leaves a thin gap of light just where shoes touch the ground; this closes it, as
// studios ground a character in a close-up.

import * as THREE from "three";

let texture: THREE.Texture | null = null;

/** A round blur, darkest in the middle, drawn once and shared. */
function blur(): THREE.Texture {
  if (texture) return texture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    r.addColorStop(0, "rgba(0,0,0,1)");
    r.addColorStop(0.45, "rgba(0,0,0,0.55)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, size, size);
  }
  texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/** A contact shadow `width` across (a little wider than the feet are apart), lying flat. */
export function contactShadow(width: number, strength = 0.42): THREE.Mesh {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * 0.8),
    new THREE.MeshBasicMaterial({
      map: blur(),
      transparent: true,
      opacity: strength,
      depthWrite: false,
      // Laid on whatever's under it without fighting it for depth.
      polygonOffset: true,
      polygonOffsetFactor: -4,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.renderOrder = 1;
  shadow.userData.contact = true;
  return shadow;
}
