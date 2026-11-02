// Little touches that make the UI feel alive: synthesized UI sounds (no audio files needed) and
// sparkle bursts, and the one audio system the recorded sounds and music play through too. Sounds
// start only after the first touch, as iOS requires.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
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
    } catch {
      return null;
    }
  }
  // iPhones also report "interrupted" after a call or an alarm, so anything but running counts.
  if (ctx.state !== "running") void ctx.resume();
  return ctx;
}

/** Where everything is mixed to. */
export function audioDestination(): AudioNode | null {
  return master;
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
  if (!a || !master) return;
  const t0 = a.currentTime + (options.delay ?? 0);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = options.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime((options.gain ?? 0.5) * SYNTH_LEVEL, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noise(
  duration: number,
  options: { gain?: number; freq?: number; delay?: number } = {},
): void {
  const a = audio();
  if (!a || !master) return;
  const t0 = a.currentTime + (options.delay ?? 0);
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * duration), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = options.freq ?? 1200;
  const gain = a.createGain();
  gain.gain.value = (options.gain ?? 0.3) * SYNTH_LEVEL;
  src.connect(filter).connect(gain).connect(master);
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
  levelUp(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(f, 0.22, { type: "triangle", gain: 0.3, delay: i * 0.08 });
    });
    noise(0.5, { freq: 3000, gain: 0.08, delay: 0.25 });
  },
  error(): void {
    tone(220, 0.16, { type: "sawtooth", to: 160, gain: 0.15 });
  },
  victory(): void {
    [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => {
      tone(f, 0.3, { type: "triangle", gain: 0.28, delay: i * 0.11 });
    });
  },
  defeat(): void {
    [392, 330, 262, 196].forEach((f, i) => {
      tone(f, 0.35, { type: "triangle", gain: 0.22, delay: i * 0.16 });
    });
  },
  setMuted(on: boolean): void {
    muted = on;
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
