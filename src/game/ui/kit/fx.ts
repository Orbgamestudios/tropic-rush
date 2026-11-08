// Little touches that make the UI feel alive: synthesized UI sounds (no audio files needed) and
// sparkle bursts, and the one audio system the recorded sounds and music play through too. Sounds
// start only after the first touch, as iOS requires.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Everything but the music, so the two can have sliders of their own. */
let effects: GainNode | null = null;
let effectsVolume = 1;
let muted = false;
/** The synthesized sounds stay as loud as they were before recorded ones raised the master. */
const SYNTH_LEVEL = 0.6;

/** The audio system, made on first use. */
export function audioContext(): AudioContext | null {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      effects = ctx.createGain();
      effects.gain.value = effectsVolume;
      effects.connect(master);
    } catch {
      return null;
    }
  }
  // iPhones also report "interrupted" after a call or an alarm, so anything but running counts.
  if (ctx.state !== "running") void ctx.resume();
  return ctx;
}

/** Where the music is mixed to. */
export function audioDestination(): AudioNode | null {
  return master;
}

/** Where sound effects are mixed to. */
export function effectsDestination(): AudioNode | null {
  return effects;
}

export function isMuted(): boolean {
  return muted;
}

function audio(): AudioContext | null {
  return muted ? null : audioContext();
}

function tone(
  freq: number,
  duration: number,
  options: { type?: OscillatorType; to?: number; gain?: number; delay?: number } = {},
): void {
  const a = audio();
  if (!a || !effects) return;
  const t0 = a.currentTime + (options.delay ?? 0);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = options.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime((options.gain ?? 0.5) * SYNTH_LEVEL, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(effects);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noise(
  duration: number,
  /** `swell` grows to its end instead of dying away from its start. */
  options: { gain?: number; freq?: number; delay?: number; swell?: boolean } = {},
): void {
  const a = audio();
  if (!a || !effects) return;
  const t0 = a.currentTime + (options.delay ?? 0);
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * duration), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const along = i / data.length;
    data[i] = (Math.random() * 2 - 1) * (options.swell ? along * along : 1 - along);
  }
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = options.freq ?? 1200;
  const gain = a.createGain();
  gain.gain.value = (options.gain ?? 0.3) * SYNTH_LEVEL;
  src.connect(filter).connect(gain).connect(effects);
  src.start(t0);
}

export const sfx = {
  press(): void {
    tone(520, 0.07, { type: "triangle", to: 380, gain: 0.35 });
  },
  tick(): void {
    tone(900, 0.04, { type: "square", gain: 0.08 });
  },
  whoosh(): void {
    noise(0.28, { freq: 900, gain: 0.25 });
  },
  coin(): void {
    tone(988, 0.09, { type: "square", gain: 0.12 });
    tone(1319, 0.22, { type: "square", gain: 0.12, delay: 0.08 });
  },
  /**
   * A star flying into its slot and locking there: it whooshes in, lands with a thud and a click,
   * and rings like struck metal, a little higher for each star.
   */
  starLock(index: number): void {
    const lands = 0.13;
    const up = 2 ** ((index * 3) / 12);
    noise(lands, { freq: 2400, gain: 0.16, swell: true });
    tone(160, 0.18, { type: "sine", to: 55, gain: 0.6, delay: lands });
    noise(0.025, { freq: 5200, gain: 0.45, delay: lands });
    // A struck plate's partials, which aren't whole multiples of each other: that's what makes it
    // sound like metal and not a note.
    const partials = [
      [1, 0.55, 0.2],
      [2.76, 0.4, 0.12],
      [5.4, 0.26, 0.07],
      [8.93, 0.16, 0.045],
    ] as const;
    for (const [ratio, length, gain] of partials) {
      tone(560 * up * ratio, length, { type: "sine", gain, delay: lands });
    }
    noise(0.4, { freq: 8000, gain: 0.05, delay: lands + 0.02 });
  },
  /** Time bending as a shard is used: down for slow, a frozen ring for pause, up for fast forward. */
  timePower(power: string): void {
    noise(0.35, { freq: 1600, gain: 0.18, swell: true });
    if (power === "slow") tone(620, 0.7, { type: "sine", to: 180, gain: 0.35, delay: 0.3 });
    else if (power === "pause") {
      for (const [f, gain] of [
        [1480, 0.18],
        [2217, 0.1],
        [3320, 0.06],
      ] as const) {
        tone(f, 0.9, { type: "sine", gain, delay: 0.3 });
      }
      noise(0.05, { freq: 6000, gain: 0.3, delay: 0.3 });
    } else if (power === "fastForward") {
      tone(180, 0.5, { type: "sawtooth", to: 900, gain: 0.12, delay: 0.3 });
    } else if (power === "retry") {
      tone(240, 0.45, { type: "triangle", to: 720, gain: 0.3 });
      tone(960, 0.4, { type: "sine", gain: 0.15, delay: 0.35 });
    } else tone(440, 0.5, { type: "sine", to: 330, gain: 0.25, delay: 0.3 });
  },
  /** Time going back to its own pace. */
  timeEnd(): void {
    tone(300, 0.35, { type: "sine", to: 520, gain: 0.18 });
    noise(0.25, { freq: 1200, gain: 0.1 });
  },
  levelUp(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(f, 0.22, { type: "triangle", gain: 0.3, delay: i * 0.08 });
    });
    noise(0.5, { freq: 3000, gain: 0.08, delay: 0.25 });
  },
  error(): void {
    tone(220, 0.16, { type: "sawtooth", to: 160, gain: 0.15 });
  },
  defeat(): void {
    [392, 330, 262, 196].forEach((f, i) => {
      tone(f, 0.35, { type: "triangle", gain: 0.22, delay: i * 0.16 });
    });
  },
  setMuted(on: boolean): void {
    muted = on;
  },
  setVolume(volume: number): void {
    effectsVolume = volume;
    if (effects) effects.gain.value = volume;
  },
};

/** Sprays sparkles out from a point on screen (CSS pixels within `layer`). */
export function sparkle(
  layer: HTMLElement,
  x: number,
  y: number,
  options: { count?: number; colors?: string[]; spread?: number } = {},
): void {
  const colors = options.colors ?? ["#fff6b0", "#ffd84a", "#ffffff", "#8fd4ff"];
  const count = options.count ?? 18;
  const spread = options.spread ?? 90;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "ui-spark";
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = spread * (0.45 + Math.random() * 0.75);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle) * dist - 20}px`);
    p.style.setProperty("--c", colors[i % colors.length] ?? "#fff");
    p.style.setProperty("--s", `${0.6 + Math.random() * 0.9}`);
    p.style.animationDelay = `${Math.random() * 0.08}s`;
    layer.append(p);
    setTimeout(() => p.remove(), 1100);
  }
}

/** Sparkles from the middle of an element. */
export function sparkleAt(
  layer: HTMLElement,
  target: Element,
  options?: Parameters<typeof sparkle>[3],
): void {
  const a = layer.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  sparkle(layer, b.left - a.left + b.width / 2, b.top - a.top + b.height / 2, options);
}
