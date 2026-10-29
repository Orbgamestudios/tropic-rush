// The WebGL renderer, scene, sky and sunlight. One Stage lives for the whole session; each raid
// adds its own world to the scene and removes it afterwards.

import * as THREE from "three";
import { COLORS } from "./palette";

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 700);
  readonly sun: THREE.DirectionalLight;
  readonly fog: THREE.Fog;
  width = 1;
  height = 1;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(COLORS.sky);
    this.fog = new THREE.Fog(COLORS.sky, 60, 170);
    this.scene.fog = this.fog;

    this.scene.add(new THREE.HemisphereLight(0xe4f6ff, 0xd2c08f, 1.25));
    this.sun = new THREE.DirectionalLight(0xfff0d4, 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 180;
    this.scene.add(this.sun, this.sun.target);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  resize(): void {
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  /** Keeps crisp shadows around what the camera is looking at. */
  focusShadows(target: THREE.Vector3, size: number): void {
    this.sun.position.copy(target).add(new THREE.Vector3(-28, 48, 34));
    this.sun.target.position.copy(target);
    const cam = this.sun.shadow.camera;
    if (cam.right !== size) {
      cam.left = -size;
      cam.right = size;
      cam.top = size;
      cam.bottom = -size;
      cam.updateProjectionMatrix();
    }
  }

  setFogRange(near: number, far: number): void {
    this.fog.near = near;
    this.fog.far = far;
  }

  /**
   * Lowers quality step by step if frames stay slow (older phones): first resolution, then the
   * shadow map. Never raises it again, so the picture doesn't keep flickering between levels.
   */
  adaptQuality(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed < 3 || this.quality >= 2) return; // ignore start-up shader compiling
    this.slowSeconds = dt > 1 / 24 ? this.slowSeconds + dt : Math.max(0, this.slowSeconds - dt);
    if (this.slowSeconds < 2) return;
    this.slowSeconds = 0;
    this.quality++;
    if (this.quality === 1) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } else {
      this.renderer.setPixelRatio(1);
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.resize();
  }

  private elapsed = 0;
  private slowSeconds = 0;
  private quality = 0;

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
