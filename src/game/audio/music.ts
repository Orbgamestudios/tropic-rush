// The music: a track for each part of the game, crossfading as the player moves between them.
// Tracks are fetched whole and played from memory: iPhones won't stream an <audio> element through
// a service worker, and this way they also play offline. Credits are in public/audio/CREDITS.md.

import { audioContext, audioDestination } from "../ui/kit/fx";

export type Track = "home" | "heroes" | "map" | "scout" | "raid" | "night" | "win";

const FADE_SECONDS = 1.2;
/** How loud each track plays: the same level for all, under the sound effects. */
const LEVEL = 0.5;
const ONCE: readonly Track[] = ["win"];

interface Player {
  track: Track;
  audio: HTMLAudioElement;
  gain: GainNode;
}

class Music {
  private muted = false;
  private wanted: Track | null = null;
  private current: Player | null = null;
  private readonly urls = new Map<Track, Promise<string>>();

  constructor() {
    // Nothing should keep playing with the phone locked or the game in the background.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.current?.audio.pause();
        return;
      }
      audioContext();
      void this.current?.audio.play().catch(() => {});
    });
  }

  private url(track: Track): Promise<string> {
    let url = this.urls.get(track);
    if (!url) {
      url = fetch(`/audio/music/${track}.mp3`)
        .then((response) => response.blob())
        .then((blob) => URL.createObjectURL(blob));
      this.urls.set(track, url);
    }
    return url;
  }

  /** Moves on to a track, or fades out with null. Safe to call over and over. */
  play(track: Track | null): void {
    if (track === this.wanted) return;
    this.wanted = track;
    this.sync();
  }

  /** Tries again: the first track can only start after the player touches the screen. */
  unlock(): void {
    if (this.current) void this.current.audio.play().catch(() => {});
    else this.sync();
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

  private fadeOut(player: Player): void {
    const context = audioContext();
    if (context) {
      const t = context.currentTime;
      player.gain.gain.cancelScheduledValues(t);
      player.gain.gain.setValueAtTime(player.gain.gain.value, t);
      player.gain.gain.linearRampToValueAtTime(0, t + FADE_SECONDS);
    }
    setTimeout(() => {
      player.audio.pause();
      player.audio.removeAttribute("src");
      player.gain.disconnect();
    }, FADE_SECONDS * 1000);
  }

  private async start(track: Track): Promise<void> {
    const context = audioContext();
    const destination = audioDestination();
    if (!context || !destination) return;
    let src: string;
    try {
      src = await this.url(track);
    } catch {
      return; // Offline before the file was cached: the game simply stays quiet.
    }
    // The player may have moved on while it loaded.
    if ((this.muted ? null : this.wanted) !== track || this.current) return;
    const audio = new Audio();
    audio.src = src;
    audio.loop = !ONCE.includes(track);
    const gain = context.createGain();
    gain.gain.value = 0;
    context.createMediaElementSource(audio).connect(gain).connect(destination);
    gain.gain.linearRampToValueAtTime(LEVEL, context.currentTime + FADE_SECONDS);
    this.current = { track, audio, gain };
    await audio.play().catch(() => {});
  }
}

export const music = new Music();
