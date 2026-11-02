// Writes the game's own music, all of it synthesized here, so it's free of anyone else's rights:
// the scouting drums, the victory fanfare and the crew island's calypso. It also cuts the raid
// track down to a clean four bars. Run it again after changing anything here; the tracks come out
// exactly the same every time.
//
//   node scripts/make-music.mjs
//
// A looping track's file carries a quarter of a second of itself either side of the loop, so the
// game can jump between two points in the middle of a repeating wave. However much silence the
// MP3 format adds at the ends, the join can't be heard. See LOOPS in src/game/audio/music.ts.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Mp3Encoder } from "@breezystack/lamejs";
import { MPEGDecoder } from "mpg123-decoder";

const SR = 44100;
const PADDING = 0.25;
const OUT = "public/audio/music";
const RAID_SOURCE = "models-wip/scout-original.mp3";

/** The same noise every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const samples = (seconds) => new Float32Array(Math.ceil(seconds * SR));

function lowpass(input, cutoff) {
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    y += (input[i] - y) * k;
    out[i] = y;
  }
  return out;
}

function highpass(input, cutoff) {
  const low = lowpass(input, cutoff);
  return input.map((v, i) => v - low[i]);
}

// ---------------------------------------------------------------------------------------------
// Drums

/** A field snare: a tight head, a stick's click, and the wires rattling on after it. */
function snareHit(seed, accent) {
  const random = rng(seed);
  const n = samples(0.42);
  const noise = n.map(() => random() * 2 - 1);
  const wires = highpass(lowpass(noise, 8500), 1700);
  const out = samples(0.42);
  const body = accent ? 1 : 0.7;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const head =
      Math.sin(2 * Math.PI * 262 * t * (1 + 0.1 * Math.exp(-t / 0.008))) *
        Math.exp(-t / 0.032) *
        0.55 +
      Math.sin(2 * Math.PI * 418 * t) * Math.exp(-t / 0.018) * 0.3;
    const rattle = wires[i] * Math.exp(-t / (accent ? 0.082 : 0.05)) * (accent ? 1.1 : 0.7);
    const click = t < 0.003 ? (random() * 2 - 1) * 0.9 : 0;
    out[i] = (head * body + rattle + click) * Math.min(1, t / 0.0006);
  }
  return out;
}

const SNARES = [1, 2, 3, 4].map((s) => snareHit(s, false));
const ACCENTS = [5, 6, 7, 8].map((s) => snareHit(s, true));

/** A big marching bass drum: a deep boom under a felt mallet's thump. */
function bassHit(pitch = 1) {
  const random = rng(11);
  const out = samples(1);
  let phase = 0;
  const thump = lowpass(
    out.map(() => random() * 2 - 1),
    900,
  );
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * pitch * (50 + 75 * Math.exp(-t / 0.03))) / SR;
    out[i] =
      Math.sin(phase) * Math.exp(-t / 0.3) +
      Math.sin(phase * 2) * Math.exp(-t / 0.08) * 0.25 +
      thump[i] * Math.exp(-t / 0.012) * 1.6;
  }
  return out;
}

/** A tenor drum, or with a low `freq` a timpani's soft stroke. */
function tomHit(freq, ring = 0.17) {
  const random = rng(Math.round(freq));
  const out = samples(ring * 5);
  const skin = lowpass(
    out.map(() => random() * 2 - 1),
    2400,
  );
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * freq * (1 + 0.45 * Math.exp(-t / 0.02))) / SR;
    out[i] =
      Math.sin(phase) * Math.exp(-t / ring) +
      Math.sin(phase * 1.59) * Math.exp(-t / (ring * 0.6)) * 0.25 +
      skin[i] * Math.exp(-t / 0.014) * 0.7;
  }
  return out;
}

/** Clashed cymbals. */
function crashHit() {
  const random = rng(21);
  const out = samples(2.6);
  const noise = highpass(
    out.map(() => random() * 2 - 1),
    3200,
  );
  const partials = Array.from({ length: 14 }, () => 3000 + random() * 7000);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let metal = 0;
    for (const f of partials) metal += Math.sin(2 * Math.PI * f * t);
    out[i] =
      (noise[i] * 0.9 + (metal / partials.length) * 0.7) *
      Math.exp(-t / 0.62) *
      Math.min(1, t / 0.002);
  }
  return out;
}

const BASS = bassHit();
const CRASH = crashHit();
const TOMS = { high: tomHit(196), mid: tomHit(147), low: tomHit(110), timpani: tomHit(58, 0.42) };

// ---------------------------------------------------------------------------------------------
// Tuned instruments

/** A brass player: bright on the attack, a scoop up to the note, and vibrato if it's held. */
function brassNote(midi, seconds, bright, seed) {
  const random = rng(seed);
  const out = samples(seconds + 0.22);
  const f = hz(midi) * (1 + (random() - 0.5) * 0.004);
  const most = Math.min(20, Math.floor(SR / 2.2 / f));
  let phase = random() * 6;
  const wobble = 5 + random();
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const attack = Math.min(1, t / 0.022);
    const release = t > seconds ? Math.max(0, 1 - (t - seconds) / 0.09) : 1;
    const held = Math.min(1, Math.max(0, (t - 0.28) / 0.3));
    const pitch =
      f * (1 - 0.018 * Math.exp(-t / 0.016)) * (1 + 0.0035 * held * Math.sin(6.283 * wobble * t));
    phase += (2 * Math.PI * pitch) / SR;
    const blast = bright * (0.72 + 0.55 * Math.exp(-t / 0.07)) * attack ** 0.5;
    const tilt = 2.35 - 1.55 * Math.min(1, blast);
    let sum = 0;
    for (let k = 1; k <= most; k++) sum += Math.sin(phase * k) * k ** -tilt;
    out[i] = sum * attack * release * (0.86 + 0.14 * Math.exp(-t / 0.12));
  }
  return out;
}

/** One steel pan note: a soft strike and a long shimmering ring. */
function steelNote(midi, seconds) {
  const out = samples(seconds + 0.9);
  const f = hz(midi);
  const partials = [
    [1, 1, 0.75],
    [2, 0.6, 0.5],
    [3, 0.24, 0.3],
    [4.02, 0.12, 0.2],
    [5.1, 0.05, 0.12],
  ];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let sum = 0;
    for (const [ratio, level, decay] of partials) {
      sum += Math.sin(2 * Math.PI * f * ratio * t) * level * Math.exp(-t / decay);
    }
    const shimmer = 1 + 0.08 * Math.sin(2 * Math.PI * 6.2 * t);
    out[i] = sum * shimmer * Math.min(1, t / 0.004);
  }
  return out;
}

function marimbaNote(midi) {
  const out = samples(0.9);
  const f = hz(midi);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] =
      (Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.26) +
        Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t / 0.06) * 0.32 +
        Math.sin(2 * Math.PI * f * 9.8 * t) * Math.exp(-t / 0.02) * 0.1) *
      Math.min(1, t / 0.002);
  }
  return out;
}

/** A plucked string, ringing down the way a real one does (Karplus-Strong). */
function pluck(midi, seconds, seed, damping = 0.994) {
  const random = rng(seed);
  const period = Math.round(SR / hz(midi));
  const loop = lowpass(
    Float32Array.from({ length: period }, () => random() * 2 - 1),
    3800,
  );
  const out = samples(seconds);
  for (let i = 0; i < out.length; i++) {
    const at = i % period;
    out[i] = loop[at];
    loop[at] = (loop[at] + loop[(at + 1) % period]) * 0.5 * damping;
  }
  return out;
}

function bassNote(midi) {
  const out = samples(1.1);
  const f = hz(midi);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] =
      (Math.sin(2 * Math.PI * f * t) +
        Math.sin(4 * Math.PI * f * t) * 0.32 * Math.exp(-t / 0.2) +
        Math.sin(6 * Math.PI * f * t) * 0.12 * Math.exp(-t / 0.1)) *
      Math.exp(-t / 0.42) *
      Math.min(1, t / 0.005);
  }
  return out;
}

function congaHit(freq, slap) {
  const random = rng(Math.round(freq) + (slap ? 1 : 0));
  const out = samples(0.45);
  const skin = highpass(
    out.map(() => random() * 2 - 1),
    700,
  );
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] =
      Math.sin(2 * Math.PI * freq * t * (1 + 0.12 * Math.exp(-t / 0.012))) *
        Math.exp(-t / (slap ? 0.05 : 0.13)) +
      skin[i] * Math.exp(-t / (slap ? 0.02 : 0.007)) * (slap ? 0.9 : 0.35);
  }
  return out;
}

function shakerHit(seed) {
  const random = rng(seed);
  const out = samples(0.1);
  const grains = highpass(
    out.map(() => random() * 2 - 1),
    5200,
  );
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = grains[i] * Math.min(1, t / 0.012) * Math.exp(-t / 0.028);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Putting it together

/** A stereo track, with a send to a shared room. A loop's tails wrap round to its start. */
class Mix {
  constructor(seconds, loop) {
    this.length = Math.round(seconds * SR);
    this.loop = loop;
    this.left = new Float32Array(this.length);
    this.right = new Float32Array(this.length);
    this.room = new Float32Array(this.length);
    this.jitter = rng(this.length);
  }

  put(sound, at, gain = 1, pan = 0, send = 0.15) {
    const start = Math.round(at * SR);
    const l = gain * Math.cos(((pan + 1) * Math.PI) / 4);
    const r = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < sound.length; i++) {
      let k = start + i;
      if (this.loop) k %= this.length;
      else if (k >= this.length) break;
      if (k < 0) continue;
      this.left[k] += sound[i] * l;
      this.right[k] += sound[i] * r;
      this.room[k] += sound[i] * gain * send;
    }
  }

  /** A hit a player made: never quite on the grid, or quite as hard as the last. */
  hit(sound, at, gain, pan = 0, send = 0.15) {
    const late = (this.jitter() - 0.5) * 0.005;
    const firm = 0.92 + this.jitter() * 0.16;
    this.put(sound, at + late, gain * firm, pan, send);
  }

  snare(at, gain, accent = false, pan = 0.08) {
    const set = accent ? ACCENTS : SNARES;
    this.hit(set[Math.floor(this.jitter() * set.length)], at, gain, pan);
  }
}

/** One side of a short open-air echo. */
function room(input, seconds, loop) {
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((d) => Math.round(d * SR * seconds.spread));
  const length = input.length * (loop ? 2 : 1);
  const out = new Float32Array(length);
  for (const delay of combs) {
    const g = 10 ** ((-3 * (delay / SR)) / seconds.decay);
    const line = new Float32Array(delay);
    for (let i = 0; i < length; i++) {
      const at = i % delay;
      const dry = input[i % input.length];
      const held = line[at];
      line[at] = dry + held * g;
      out[i] += held * 0.25;
    }
  }
  return loop ? out.subarray(input.length) : out;
}

/** The room added, peaks rounded off and the level set, ready to encode. */
function finish(mix, { decay, wet }) {
  const left = room(mix.room, { spread: 1, decay }, mix.loop);
  const right = room(mix.room, { spread: 1.07, decay }, mix.loop);
  const out = [mix.left, mix.right].map((dry, c) => {
    const echo = c === 0 ? left : right;
    return dry.map((v, i) => v + echo[i] * wet);
  });
  let peak = 0;
  for (const channel of out) for (const v of channel) peak = Math.max(peak, Math.abs(v));
  const drive = 1.25 / peak;
  const level = 0.9 / Math.tanh(1.25);
  return out.map((channel) => channel.map((v) => Math.tanh(v * drive) * level));
}

function encode(left, right, name) {
  const encoder = new Mp3Encoder(2, SR, 128);
  const pcm = (data) => Int16Array.from(data, (v) => Math.round(v * 32767));
  const [l, r] = [pcm(left), pcm(right)];
  const chunks = [];
  for (let i = 0; i < l.length; i += 1152) {
    chunks.push(encoder.encodeBuffer(l.subarray(i, i + 1152), r.subarray(i, i + 1152)));
  }
  chunks.push(encoder.flush());
  const bytes = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(`${OUT}/${name}.mp3`, bytes);
  console.log(`${name}: ${(l.length / SR).toFixed(2)} s, ${(bytes.length / 1024) | 0} KB`);
}

/** Writes a loop with a little of its own end before it and its own start after it. */
function writeLoop(left, right, name) {
  const pad = Math.round(PADDING * SR);
  const padded = (channel) => {
    const out = new Float32Array(channel.length + pad * 2);
    out.set(channel.subarray(channel.length - pad), 0);
    out.set(channel, pad);
    out.set(channel.subarray(0, pad), pad + channel.length);
    return out;
  };
  encode(padded(left), padded(right), name);
  console.log(`  loop ${(left.length / SR).toFixed(6)} s`);
}

// ---------------------------------------------------------------------------------------------
// Attacking: the old scouting loop, cut to its true four bars

async function raidTrack() {
  // The original as downloaded, kept out of the repo with the other raw files.
  if (!existsSync(RAID_SOURCE)) return;
  const decoder = new MPEGDecoder();
  await decoder.ready;
  const source = decoder.decode(readFileSync(RAID_SOURCE));
  decoder.free();
  // Four bars at 140 beats a minute. The file ran 18 ms over, into the next bar's first kick.
  const bars = Math.round((4 * 4 * 60 * SR) / 140);
  writeLoop(source.channelData[0].slice(0, bars), source.channelData[1].slice(0, bars), "raid");
}

// ---------------------------------------------------------------------------------------------
// Scouting: a tense field drum corps, no tune to it

/** Plays one bar from strings of sixteenth notes. */
function drumBar(mix, at, step, parts) {
  const { snare = "", bass = "", tenor = "", timpani = "" } = parts;
  [...snare].forEach((c, i) => {
    const t = at + i * step;
    if (c === "f") {
      mix.snare(t - 0.028, 0.34);
      mix.snare(t, 0.95, true);
    } else if (c === "A") mix.snare(t, 0.95, true);
    else if (c === "x") mix.snare(t, 0.42);
    else if (c === "r") {
      // A press roll: the sticks bouncing as fast as they'll go.
      for (let b = 0; b < 4; b++) mix.snare(t + (b * step) / 4, 0.36 + b * 0.015);
    } else if (c === "R") {
      for (let b = 0; b < 4; b++) mix.snare(t + (b * step) / 4, 0.62 + b * 0.02);
    }
  });
  [...bass].forEach((c, i) => {
    if (c === "B") mix.hit(BASS, at + i * step, 0.95, -0.05, 0.3);
    if (c === "b") mix.hit(BASS, at + i * step, 0.55, -0.05, 0.3);
  });
  [...tenor].forEach((c, i) => {
    const tom = { h: TOMS.high, m: TOMS.mid, l: TOMS.low }[c];
    if (tom) mix.hit(tom, at + i * step, 0.55, c === "h" ? -0.32 : c === "m" ? 0.3 : 0.05, 0.25);
  });
  [...timpani].forEach((c, i) => {
    if (c === "T") mix.hit(TOMS.timpani, at + i * step, 0.75, -0.12, 0.35);
  });
}

function scoutTrack() {
  const beat = 60 / 92;
  const step = beat / 4;
  const barTime = beat * 4;
  const cadence = {
    a: {
      snare: "f..xx.x.f..xx.x.",
      bass: "B.......b.......",
      timpani: "T.......T.......",
    },
    b: {
      snare: "f..xx.x.f.xxrrrA",
      bass: "B.......b.....b.",
      tenor: "....m.....l.....",
      timpani: "T.......T.......",
    },
    c: {
      snare: "f.x.x.f.x.x.f.x.",
      bass: "B.....b.B.....b.",
      tenor: "..h...m...h...m.",
      timpani: "T.......T.......",
    },
    d: {
      snare: "rrrrRRRRRRRRRRRA",
      bass: "B...b...B...b.B.",
      tenor: "............hml.",
      timpani: "T.T.T.T.T.T.T.TT",
    },
  };
  const song = "aabacabd";
  const mix = new Mix(barTime * song.length, true);
  [...song].forEach((name, i) => {
    drumBar(mix, mix.length ? i * barTime : 0, step, cadence[name]);
  });
  const [left, right] = finish(mix, { decay: 0.9, wet: 0.5 });
  writeLoop(left, right, "scout");
}

// ---------------------------------------------------------------------------------------------
// Victory: bugles and drums, brass all the way, in B flat

function winTrack() {
  const beat = 0.48;
  const mix = new Mix(beat * 15 + 2.4, false);
  const note = (midi, at, length, gain, pan, bright, seed) => {
    mix.put(brassNote(midi, length * beat, bright, seed), at * beat, gain, pan, 0.28);
  };
  // The bugles' tune, with the two parts under it a third and a fifth or so below.
  const tune = [
    [2, 1 / 3, 70, 65, 62],
    [2 + 1 / 3, 1 / 3, 70, 65, 62],
    [2 + 2 / 3, 1 / 3, 70, 65, 62],
    [3, 1, 77, 74, 70],
    [4, 1 / 3, 74, 70, 65],
    [4 + 1 / 3, 1 / 3, 74, 70, 65],
    [4 + 2 / 3, 1 / 3, 74, 70, 65],
    [5, 1, 82, 77, 74],
    [6, 0.5, 82, 77, 74],
    [6.5, 0.25, 82, 77, 74],
    [6.75, 0.25, 82, 77, 74],
    [7, 0.5, 84, 81, 77],
    [7.5, 0.5, 82, 77, 74],
    [8, 0.5, 77, 74, 70],
    [8.5, 0.5, 82, 77, 74],
    [9, 0.25, 86, 82, 77],
    [9.25, 0.25, 86, 82, 77],
    [9.5, 0.5, 86, 82, 77],
    [10, 3.6, 82, 77, 74],
  ];
  tune.forEach(([at, length, top, middle, low], i) => {
    note(top, at, length * 0.92, 0.5, -0.1, 0.95, 100 + i);
    note(top, at + 0.008, length * 0.92, 0.32, 0.12, 0.9, 200 + i);
    note(middle, at, length * 0.92, 0.36, 0.28, 0.82, 300 + i);
    note(low, at, length * 0.92, 0.32, -0.3, 0.76, 400 + i);
  });
  // Trombones and tubas under it, on the chords.
  const chords = [
    [2, 2, [46, 53, 58, 62]],
    [4, 2, [51, 55, 58, 63]],
    [6, 2, [53, 57, 60, 65]],
    [8, 1, [46, 53, 58, 62]],
    [9, 1, [53, 57, 60, 65]],
    [10, 3.6, [46, 53, 58, 62]],
  ];
  chords.forEach(([at, length, voices], c) => {
    voices.forEach((midi, v) => {
      note(midi, at, length * 0.94, v === 0 ? 0.55 : 0.34, (v - 1.5) * 0.2, 0.58, 500 + c * 8 + v);
    });
  });
  // A roll to bring it in, the corps marching under the tune, and a roll through the last chord.
  for (let i = 0; i < 2 * 8; i++) mix.snare((i * beat) / 8, 0.25 + (i / 16) * 0.55);
  const pattern = "f.x.x.f.x.xxf.x.";
  for (let bar = 0; bar < 2; bar++) {
    [...pattern].forEach((c, i) => {
      const at = (2 + bar * 4 + i / 4) * beat;
      if (c === "f") {
        mix.snare(at - 0.03, 0.3);
        mix.snare(at, 0.85, true);
      } else if (c === "x") mix.snare(at, 0.42);
    });
  }
  for (let i = 0; i < 3.5 * 8; i++) mix.snare((10 + i / 8) * beat, 0.4 + (i / 28) * 0.3);
  for (const at of [2, 4, 6, 8, 9]) mix.hit(BASS, at * beat, 0.95, 0, 0.3);
  for (const at of [3, 5, 7, 8.5, 9.5]) mix.hit(BASS, at * beat, 0.6, 0, 0.3);
  mix.hit(CRASH, 2 * beat, 0.55, 0, 0.3);
  mix.hit(CRASH, 10 * beat, 0.7, 0, 0.3);
  // The last hit, all together, and the cut-off.
  mix.hit(BASS, 13.6 * beat, 1.1, 0, 0.3);
  mix.snare(13.6 * beat, 1.1, true);
  mix.hit(CRASH, 13.6 * beat, 0.75, 0, 0.3);
  const [left, right] = finish(mix, { decay: 1.3, wet: 0.5 });
  encode(left, right, "win");
}

// ---------------------------------------------------------------------------------------------
// The crew island: an easy calypso in F, and every so often the drum corps goes past

const CHORD = {
  F: { strum: [69, 60, 65, 69], root: 41, fifth: 48, arp: [65, 69, 72, 77] },
  Bb: { strum: [70, 62, 65, 70], root: 46, fifth: 41, arp: [62, 65, 70, 74] },
  C: { strum: [67, 60, 64, 72], root: 48, fifth: 43, arp: [64, 67, 72, 76] },
  Dm: { strum: [69, 62, 65, 69], root: 50, fifth: 45, arp: [62, 65, 69, 74] },
  Gm: { strum: [67, 62, 65, 70], root: 43, fifth: 50, arp: [62, 67, 70, 74] },
};

/** The tune: [beat, length, note], a bar at a time. */
const VERSE = [
  [
    [0, 0.5, 72],
    [0.5, 0.5, 74],
    [1, 1, 72],
    [2.5, 0.5, 69],
    [3, 1, 72],
  ],
  [
    [0, 1.5, 77],
    [1.5, 0.5, 76],
    [2, 0.5, 74],
    [2.5, 1.5, 72],
  ],
  [
    [0, 0.5, 74],
    [0.5, 0.5, 77],
    [1, 1, 74],
    [2.5, 0.5, 70],
    [3, 1, 74],
  ],
  [
    [0, 1, 76],
    [1, 0.5, 74],
    [1.5, 0.5, 72],
    [2, 0.5, 70],
    [2.5, 0.5, 69],
    [3, 1, 67],
  ],
  [
    [0, 0.5, 72],
    [0.5, 0.5, 74],
    [1, 1, 72],
    [2.5, 0.5, 69],
    [3, 1, 72],
  ],
  [
    [0, 1, 77],
    [1, 0.5, 81],
    [1.5, 0.5, 77],
    [2, 1.5, 74],
  ],
  [
    [0, 0.5, 79],
    [0.5, 0.5, 77],
    [1, 1, 74],
    [2, 0.5, 76],
    [2.5, 0.5, 74],
    [3, 0.5, 72],
    [3.5, 0.5, 70],
  ],
  [
    [0, 1.5, 69],
    [2, 1, 65],
  ],
];
const CHORUS = [
  [
    [0, 1.5, 77],
    [1.5, 0.5, 74],
    [2, 1, 70],
    [3, 1, 74],
  ],
  [
    [0, 1.5, 72],
    [1.5, 0.5, 69],
    [2, 1, 65],
    [3, 1, 69],
  ],
  [
    [0, 0.5, 70],
    [0.5, 0.5, 74],
    [1, 1, 79],
    [2, 0.5, 77],
    [2.5, 0.5, 74],
    [3, 1, 70],
  ],
  [
    [0, 1.5, 76],
    [1.5, 0.5, 72],
    [2, 1, 67],
    [3, 0.5, 70],
    [3.5, 0.5, 72],
  ],
  [
    [0, 1.5, 77],
    [1.5, 0.5, 74],
    [2, 1, 70],
    [3, 1, 74],
  ],
  [
    [0, 1, 81],
    [1, 0.5, 77],
    [1.5, 0.5, 72],
    [2, 1, 69],
    [3, 1, 72],
  ],
  [
    [0, 0.5, 74],
    [0.5, 0.5, 72],
    [1, 0.5, 70],
    [1.5, 0.5, 69],
    [2, 1, 67],
    [3, 1, 76],
  ],
  [[0, 2, 77]],
];
const VERSE_CHORDS = ["F", "F", "Bb", "C", "F", "Dm", "Gm", "F"];
const CHORUS_CHORDS = ["Bb", "F", "Gm", "C", "Bb", "F", "C", "F"];

function homeTrack() {
  const beat = 60 / 112;
  const bar = beat * 4;
  // Verse, chorus and a march past, twice: the second time round with more going on.
  const sections = [
    [VERSE, VERSE_CHORDS, 0],
    [CHORUS, CHORUS_CHORDS, 0],
    [null, ["F", "F"], 0],
    [VERSE, VERSE_CHORDS, 1],
    [CHORUS, CHORUS_CHORDS, 1],
    [null, ["C", "F"], 1],
  ];
  const bars = sections.reduce((sum, [, chords]) => sum + chords.length, 0);
  const mix = new Mix(bar * bars, true);
  const strums = new Map();
  const strum = (name, up, seed) => {
    const key = `${name}${up}${seed}`;
    if (!strums.has(key)) {
      const voices = CHORD[name].strum.map((midi, s) => pluck(midi, 0.8, seed + s * 7));
      const sound = samples(0.9);
      const order = up ? [3, 2, 1, 0] : [0, 1, 2, 3];
      order.forEach((v, i) => {
        const at = Math.round(i * 0.009 * SR);
        voices[v].forEach((s, k) => {
          sound[at + k] += s * 0.3;
        });
      });
      strums.set(key, sound);
    }
    return strums.get(key);
  };
  let at = 0;
  for (const [tune, chords, round] of sections) {
    chords.forEach((name, b) => {
      const start = at + b * bar;
      const chord = CHORD[name];
      const quiet = tune ? 1 : 0.6;
      // The island strum: down, down-up, up, down-up.
      for (const [offset, up, gain] of [
        [0, false, 0.5],
        [1, false, 0.42],
        [1.5, true, 0.32],
        [2.5, true, 0.34],
        [3, false, 0.42],
        [3.5, true, 0.3],
      ]) {
        mix.hit(strum(name, up, b % 3), start + offset * beat, gain * quiet, -0.22, 0.14);
      }
      for (const [offset, midi, gain] of [
        [0, chord.root, 0.8],
        [1.5, chord.fifth, 0.55],
        [2, chord.root, 0.65],
        [3.5, chord.fifth, 0.5],
      ]) {
        mix.hit(bassNote(midi - 0), start + offset * beat, gain * 0.62, 0, 0.05);
      }
      for (let s = 0; s < 8; s++) {
        mix.hit(shakerHit(s), start + (s * beat) / 2, s % 2 ? 0.1 : 0.06, 0.34, 0.05);
      }
      for (const [offset, freq, slap, gain] of [
        [0.5, 330, false, 0.22],
        [1, 262, true, 0.26],
        [2.5, 330, false, 0.22],
        [3, 262, true, 0.26],
        [3.5, 220, false, 0.2],
      ]) {
        mix.hit(congaHit(freq, slap), start + offset * beat, gain, 0.4, 0.1);
      }
      if (tune) {
        // Marimba rippling round the chord, more of it the second time.
        const notes = round ? [0, 2, 3, 1, 2, 3, 1, 2] : [0, 2, 1, 3];
        notes.forEach((n, i) => {
          const offset = (i * 4) / notes.length + (round ? 0 : 0.5);
          mix.hit(marimbaNote(chord.arp[n] - 12), start + offset * beat, 0.16, -0.42, 0.2);
        });
        for (const [offset, length, midi] of tune[b] ?? []) {
          mix.hit(steelNote(midi, length * beat), start + offset * beat, 0.4, 0.14, 0.3);
          if (round) {
            mix.hit(steelNote(midi - 5, length * beat), start + offset * beat, 0.16, 0.34, 0.3);
          }
        }
      }
    });
    if (tune) {
      // A rat-a-tat from somewhere up the beach as the verse turns over.
      const riff = at + (tune.length - 1) * bar;
      drumBar(mix, riff, beat / 4, { snare: "........f.xxf.f." });
    } else {
      const step = beat / 4;
      drumBar(mix, at, step, {
        snare: round ? "f..xx.x.f.xxrrrA" : "f.x.x.f.f.x.x.f.",
        bass: "B.......B.......",
      });
      drumBar(mix, at + bar, step, {
        snare: round ? "rrrrRRRRRRRRA.A." : "f..xx.x.f.xxrrrA",
        bass: "B...b...B...B.B.",
      });
    }
    at += chords.length * bar;
  }
  const [left, right] = finish(mix, { decay: 0.8, wet: 0.42 });
  writeLoop(left, right, "home");
}

await raidTrack();
scoutTrack();
winTrack();
homeTrack();
