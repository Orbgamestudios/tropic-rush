// Recorded sound effects: gunshots, blasts and impacts, loaded once and played from memory. The
// quieter synthesized UI sounds live in ui/kit/fx.ts. Credits are in public/audio/CREDITS.md.

import { audioContext, audioDestination, isMuted } from "../ui/kit/fx";

export type Sample =
  | "rifle"
  | "gun"
  | "turret"
  | "cannon"
  | "thump"
  | "blast"
  | "bigblast"
  | "collapse"
  | "hit"
  | "heal"
  | "loot";

const SAMPLES: readonly Sample[] = [
  "rifle",
  "gun",
  "turret",
  "cannon",
  "thump",
  "blast",
  "bigblast",
  "collapse",
  "hit",
  "heal",
  "loot",
];

/** The same sound won't start again sooner than this, however many things want it. */
const MIN_GAP_SECONDS: Partial<Record<Sample, number>> = {
  rifle: 0.05,
  gun: 0.06,
  turret: 0.09,
  hit: 0.08,
  blast: 0.08,
};
const DEFAULT_GAP = 0.03;

const buffers = new Map<Sample, AudioBuffer>();
const lastPlayed = new Map<Sample, number>();
let loading = false;

/** Fetches and decodes everything, once the audio system is allowed to start. */
export function loadSamples(): void {
  const context = audioContext();
  if (!context || loading) return;
  loading = true;
  for (const name of SAMPLES) {
    void fetch(`/audio/sfx/${name}.mp3`)
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => buffers.set(name, buffer))
      .catch(() => {});
  }
}

/** Plays a sound; `rate` changes its pitch as well as its speed. */
export function playSample(name: Sample, volume = 1, rate = 1): void {
  const context = audioContext();
  const destination = audioDestination();
  const buffer = buffers.get(name);
  if (!context || !destination || !buffer || isMuted() || volume < 0.02) return;
  const now = context.currentTime;
  if (now - (lastPlayed.get(name) ?? -1) < (MIN_GAP_SECONDS[name] ?? DEFAULT_GAP)) return;
  lastPlayed.set(name, now);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
  const gain = context.createGain();
  gain.gain.value = volume;
  source.connect(gain).connect(destination);
  source.start();
}
