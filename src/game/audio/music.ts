// The music: a track for each part of the game, crossfading as the player moves between them.
// Tracks are fetched whole and played from memory, so they also play offline, and so a loop can
// jump back with no gap at all: an <audio> element always stumbles at the end of a file. Credits
// are in public/audio/CREDITS.md, and scripts/make-music.mjs makes the tracks that loop exactly.

import { audioContext, audioDestination } from "../ui/kit/fx";

export type Track = "heroes" | "map" | "scout" | "raid" | "night" | "win";

const FADE_SECONDS = 1.2;
/** How loud each track plays: the same level for all, under the sound effects. */
const LEVEL = 0.5;
const ONCE: readonly Track[] = ["win"];
/** How long the exact loops are. Their files carry this many seconds more of it at either end. */
const LOOPS: Partial<Record<Track, number>> = {
  map: 85.333333,
  scout: 85.333333,
  raid: 64,
};
const LOOP_PADDING = 0.25;

interface Player {
  track: Track;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

class Music {
  private muted = false;
  private wanted: Track | null = null;
  private current: Player | null = null;
  private loading: { track: Track; buffer: Promise<AudioBuffer> } | null = null;

  constructor() {
    // Nothing should keep playing with the phone locked or the game in the background.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void audioContext()?.suspend();
      else audioContext();
    });
  }

  private fetchTrack(track: Track, context: AudioContext): Promise<AudioBuffer> {
    if (this.loading?.track === track) return this.loading.buffer;
    const buffer = fetch(`/audio/music/${track}.mp3`)
      .then((response) => response.arrayBuffer())
      .then((bytes) => context.decodeAudioData(bytes));
    this.loading = { track, buffer };
    return buffer;
  }

  /** Moves on to a track, or fades out with null. Safe to call over and over. */
  play(track: Track | null): void {
    if (track === this.wanted) return;
    this.wanted = track;
    this.sync();
  }

  /** Tries again: the first track can only start after the player touches the screen. */
  unlock(): void {
    if (!this.current) this.sync();
  }

  setMuted(on: boolean): void {
    this.muted = on;
    this.sync();
  }

  private sync(): void {
    const target = this.muted ? null : this.wanted;
    if (this.current?.track === target) return;
    if (this.current) this.fadeOut(this.current);
    this.current = null;
    if (target) void this.start(target);
  }

  private fadeOut({ source, gain }: Player): void {
    const context = audioContext();
    const t = context?.currentTime ?? 0;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + FADE_SECONDS);
    source.stop(t + FADE_SECONDS);
    source.onended = () => gain.disconnect();
  }

  private async start(track: Track): Promise<void> {
    const context = audioContext();
    const destination = audioDestination();
    if (!context || !destination) return;
    let buffer: AudioBuffer;
    try {
      buffer = await this.fetchTrack(track, context);
    } catch {
      return; // Offline before the file was cached: the game simply stays quiet.
    }
    // The player may have moved on while it loaded.
    if ((this.muted ? null : this.wanted) !== track || this.current) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = !ONCE.includes(track);
    const loop = LOOPS[track];
    if (loop) {
      source.loopStart = LOOP_PADDING;
      source.loopEnd = LOOP_PADDING + loop;
    }
    const gain = context.createGain();
    const t = context.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(LEVEL, t + FADE_SECONDS);
    source.connect(gain).connect(destination);
    source.start(t, loop ? LOOP_PADDING : 0);
    this.current = { track, source, gain };
  }
}

export const music = new Music();
