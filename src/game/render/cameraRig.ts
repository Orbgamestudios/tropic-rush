// The MOBA-style camera (Decided in docs/DESIGN.md): angled top-down, following your hero, with
// a gentle dynamic zoom. The gunboat gets a higher overhead view you can pan, and the menus
// slowly orbit the island.

import * as THREE from "three";
import { VIEW_YAW } from "../config";
import { terrainHeight } from "../logic/island";
import { angleDiff, clamp, lerp, type Vec2, vec } from "../logic/vec";
import type { Stage } from "./stage";

export type RigMode = "follow" | "boat" | "orbit";

/** Follow camera pitch at tilt 0, and how much each unit of tilt adds. */
const FOLLOW_PITCH = 0.6;
const FOLLOW_PITCH_PER_TILT = 0.54;
/** The behind-the-hero camera: lower and closer, swinging round to follow the hero's heading. */
const BEHIND_PITCH = 0.42;
const BEHIND_DISTANCE = 17;
const BEHIND_HEIGHT = 1.5;
const BEHIND_TURN_RATE = 2.4;
/** The little push-in while firing. */
const BEHIND_FIRE_ZOOM = 0.92;
const FOLLOW_NEAR = 28;
const FOLLOW_FAR = 34;
/** The zoom setting scales the follow distance across this range. */
const FOLLOW_ZOOM = [0.62, 1.6] as const;
const BOAT_PITCH = 1.12;
const BOAT_DISTANCE = 60;
const ORBIT_PITCH = 0.6;
const ORBIT_DISTANCE = 118;
const PAN_LIMIT = 85;

export class CameraRig {
  mode: RigMode = "orbit";
  /** 0 = close (exploring), 1 = pulled back (in a fight). */
  zoomOut = 0;
  /** Player settings: tilt (lower looks out further, higher looks down), zoom (0 close, 1 far). */
  tilt = 0;
  zoom = 0.37;
  /** Follow from close behind the hero instead of from above. */
  behind = false;
  readonly boatFocus = new THREE.Vector3(0, 0, -10);

  private readonly target = new THREE.Vector3(0, 0, -8);
  private distance = ORBIT_DISTANCE;
  private pitch = ORBIT_PITCH;
  private yaw = 0.5;
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(private readonly stage: Stage) {}

  /** How far the view is turned from north, in radians; sticks are turned to match. */
  get turn(): number {
    return this.yaw;
  }

  /** Jumps straight to the desired view (no easing), e.g. when a raid starts. */
  snap(focus: Vec2 | null): void {
    this.yaw = VIEW_YAW;
    this.update(10, focus);
  }

  /** `heading` is the direction to swing behind (null holds the view), `firing` pushes in. */
  update(
    dt: number,
    focus: Vec2 | null,
    lead: Vec2 = vec(0, 0),
    heading: number | null = null,
    firing = false,
  ): void {
    const desired = new THREE.Vector3();
    let distance: number;
    let pitch: number;
    let yaw = VIEW_YAW;
    let turnRate = 5;
    switch (this.mode) {
      case "follow": {
        const f = focus ?? vec(0, 0);
        const zoom = lerp(FOLLOW_ZOOM[0], FOLLOW_ZOOM[1], this.zoom);
        if (this.behind) {
          desired.set(f.x, terrainHeight(f.x, f.y) + BEHIND_HEIGHT, f.y);
          distance = BEHIND_DISTANCE * zoom * (firing ? BEHIND_FIRE_ZOOM : 1);
          pitch = BEHIND_PITCH + FOLLOW_PITCH_PER_TILT * this.tilt;
          // Sit opposite the way the hero faces.
          yaw = heading === null ? this.yaw : Math.atan2(-Math.cos(heading), -Math.sin(heading));
          turnRate = BEHIND_TURN_RATE;
          break;
        }
        // Lead is in screen terms: turn it with the view.
        const c = Math.cos(VIEW_YAW);
        const s = Math.sin(VIEW_YAW);
        desired.set(
          f.x + c * lead.x + s * lead.y,
          terrainHeight(f.x, f.y) + 0.8,
          f.y + c * lead.y - s * lead.x,
        );
        distance = lerp(FOLLOW_NEAR, FOLLOW_FAR, this.zoomOut) * zoom;
        pitch = FOLLOW_PITCH + FOLLOW_PITCH_PER_TILT * this.tilt;
        break;
      }
      case "boat":
        desired.copy(this.boatFocus);
        distance = BOAT_DISTANCE;
        pitch = BOAT_PITCH;
        break;
      case "orbit":
        desired.set(0, 0, -8);
        distance = ORBIT_DISTANCE;
        pitch = ORBIT_PITCH;
        yaw = this.yaw + dt * 0.05;
        break;
    }
    const k = 1 - Math.exp(-dt * 5);
    this.target.lerp(desired, k);
    this.distance = lerp(this.distance, distance, k);
    this.pitch = lerp(this.pitch, pitch, k);
    this.yaw =
      this.mode === "orbit"
        ? yaw
        : this.yaw + angleDiff(yaw, this.yaw) * (1 - Math.exp(-dt * turnRate));

    const cam = this.stage.camera;
    const flat = Math.cos(this.pitch) * this.distance;
    cam.position.set(
      this.target.x + Math.sin(this.yaw) * flat,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * flat,
    );
    cam.lookAt(this.target);

    const shadowSize = this.mode === "follow" ? 34 : 80;
    this.stage.focusShadows(this.target, shadowSize);
    if (this.mode === "follow") this.stage.setFogRange(70, 170);
    else this.stage.setFogRange(110, 320);
  }

  /** Drags the gunboat's view around the island. */
  pan(dxPixels: number, dyPixels: number): void {
    const fov = THREE.MathUtils.degToRad(this.stage.camera.fov);
    const metersPerPixel = (2 * this.distance * Math.tan(fov / 2)) / this.stage.height;
    const across = dxPixels * metersPerPixel;
    const along = (dyPixels * metersPerPixel) / Math.sin(this.pitch);
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    this.boatFocus.x = clamp(this.boatFocus.x - c * across - s * along, -PAN_LIMIT, PAN_LIMIT);
    this.boatFocus.z = clamp(this.boatFocus.z + s * across - c * along, -PAN_LIMIT, PAN_LIMIT);
  }

  /** The point on the island under a screen position (client pixels), or null for the sky. */
  groundPoint(clientX: number, clientY: number, rect: DOMRect): Vec2 | null {
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.stage.camera);
    const hit = new THREE.Vector3();
    let height = 0.8;
    for (let i = 0; i < 3; i++) {
      this.plane.constant = -height;
      if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return null;
      height = Math.max(0, terrainHeight(hit.x, hit.z));
    }
    return vec(hit.x, hit.z);
  }
}
