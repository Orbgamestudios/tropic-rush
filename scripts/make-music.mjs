// Writes the music the game makes for itself: riffs on the crew island's song for the world map,
// scouting and raids, and a bugle and drum fanfare for winning. The song is exactly 32 bars at 90
// beats a minute and starts on a beat, so anything can be locked to it. The map is the song out in
// front over a light march, with a double-time breakdown in the middle: its chords come round
// twice as fast, at the same pitch, over drums at double the feel. Scouting is the song far off
// and muffled under a field drum corps. A raid is the song sped up to 120, which also lifts it a
// fourth, over the attack drum loop slowed to match, with most of its hi-hat taken out, ducking out
// of the way of each kick. Everything drawn on is CC0, and what's synthesized here is free of
// anyone else's rights. Run it again after changing anything here; the tracks come out exactly the
// same every time.
//
//   node scripts/make-music.mjs
//
// A looping track's file carries a quarter of a second of itself either side of the loop, so the
// game can jump between two points in the middle of a repeating wave. However much silence the
// MP3 format adds at the ends, the join can't be heard. See LOOPS in src/game/audio/music.ts.

import { readFileSync, writeFileSync } from "node:fs";
import { Mp3Encoder } from "@breezystack/lamejs";
import { MPEGDecoder } from "mpg123-decoder";

const SR = 44100;
const PADDING = 0.25;
const OUT = "public/audio/music";
const SONG = "public/audio/music/heroes.mp3";
/** "Tense bass boost drum loop" as downloaded: four bars at 140, and 18 ms of the next bar. */
const DRUM_LOOP = "scripts/audio/raid-drums.mp3";
const SONG_BARS = 32;
const SONG_TEMPO = 90;
const RAID_TEMPO = 120;
/** How loud the song sits against the drums while scouting. */
const SONG_BEHIND_DRUMS = 0.75;
/** What's left of the drum loop's top end on each sixteenth of a bar: a hi-hat just before the turn. */
const TOP_END = [0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.4, 0, 0.2, 0];
/** Where the drums' top end starts, in Hz. */
const TOP_END_FROM = 3000;
/** The double-time breakdown on the map: which bars, counting from 0. */
const BREAKDOWN = { from: 16, bars: 8 };

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
// Tuned to the song: the fifth, third and root of B minor, and a low B on the timpani.
const TOMS = {
  high: tomHit(185),
  mid: tomHit(147),
  low: tomHit(123.5),
  timpani: tomHit(61.7, 0.42),
};

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

/** Decodes an MP3 to its two channels. */
async function decode(path) {
  const decoder = new MPEGDecoder();
  await decoder.ready;
  const { channelData } = decoder.decode(readFileSync(path));
  decoder.free();
  return channelData;
}

/** A wave played `speed` times as fast, wrapping round as a loop does. */
function resampled(input, speed, length) {
  const n = input.length;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const at = i * speed;
    const k = Math.floor(at);
    const t = at - k;
    const a = input[(k - 1 + n) % n];
    const b = input[k % n];
    const c = input[(k + 1) % n];
    const d = input[(k + 2) % n];
    // A smooth curve through the four samples round the point wanted.
    out[i] = b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
  }
  return out;
}

/** Takes most of the hi-hat out of a drum loop that's been stretched to the raid's tempo. */
function fewerHats(beat) {
  const step = (15 / RAID_TEMPO) * SR;
  const top = highpass(beat, TOP_END_FROM);
  const follow = 1 - Math.exp(-1 / (0.002 * SR));
  let open = 0;
  return beat.map((v, i) => {
    // A hit lands a moment early as often as late, so each step opens just before it's due.
    const on = Math.floor((i + 0.006 * SR) / step) % TOP_END.length;
    open += (TOP_END[on] - open) * follow;
    return v - top[i] * (1 - open);
  });
}

/** Rounds off the peaks and sets the level, ready to encode. */
function master(channels, loudest = 0.9) {
  let peak = 0;
  for (const channel of channels) for (const v of channel) peak = Math.max(peak, Math.abs(v));
  const drive = 1.25 / peak;
  const level = loudest / Math.tanh(1.25);
  return channels.map((channel) => channel.map((v) => Math.tanh(v * drive) * level));
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
  return master(out);
}

function encode(left, right, name, rate = 128) {
  const encoder = new Mp3Encoder(2, SR, rate);
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
function writeLoop(left, right, name, rate) {
  const pad = Math.round(PADDING * SR);
  const padded = (channel) => {
    const out = new Float32Array(channel.length + pad * 2);
    out.set(channel.subarray(channel.length - pad), 0);
    out.set(channel, pad);
    out.set(channel.subarray(0, pad), pad + channel.length);
    return out;
  };
  encode(padded(left), padded(right), name, rate);
  console.log(`  loop ${(left.length / SR).toFixed(6)} s`);
}

// ---------------------------------------------------------------------------------------------
// Attacking: the song sped up, over the attack drum loop

async function raidTrack() {
  const song = await decode(SONG);
  const drums = await decode(DRUM_LOOP);
  const beats = SONG_BARS * 4;
  const length = Math.round((beats * 60 * SR) / RAID_TEMPO);
  // Four bars of drums at 140, and no further: the file ran on into the next bar's first kick.
  const drumBars = Math.round((4 * 4 * 60 * SR) / 140);
  const slowed = drums.map((channel) =>
    resampled(channel.slice(0, drumBars), 140 / RAID_TEMPO, length),
  );
  const kick = lowpass(
    slowed[0].map((v, i) => (v + (slowed[1]?.[i] ?? v)) / 2),
    130,
  );
  // How hard the kick is hitting right now: at once on the way up, easing off after.
  let peak = 0;
  for (const v of kick) peak = Math.max(peak, Math.abs(v));
  const release = Math.exp(-1 / (0.16 * SR));
  let hit = 0;
  const duck = kick.map((v) => {
    hit = Math.max(Math.abs(v) / peak, hit * release);
    return 1 - 0.5 * hit;
  });
  const [left, right] = song.map((channel, c) => {
    // The song leaves the bottom end to the drums.
    const sped = highpass(resampled(channel, RAID_TEMPO / SONG_TEMPO, length), 170);
    const beat = fewerHats(slowed[c] ?? slowed[0]);
    return sped.map((v, i) => v * 1.5 * duck[i] + beat[i] * 0.85);
  });
  // Drums this dense read loud: this brings it level with the other tracks.
  const [l, r] = master([left, right], 0.52);
  writeLoop(l, r, "raid");
}

// ---------------------------------------------------------------------------------------------
// Scouting: a tense field drum corps, with the song far off behind it

/** Plays one bar from strings of sixteenth notes. */
function drumBar(mix, at, step, parts, level = 1) {
  const { snare = "", bass = "", tenor = "", timpani = "" } = parts;
  [...snare].forEach((c, i) => {
    const t = at + i * step;
    if (c === "f") {
      mix.snare(t - 0.028, 0.34 * level);
      mix.snare(t, 0.95 * level, true);
    } else if (c === "A") mix.snare(t, 0.95 * level, true);
    else if (c === "x") mix.snare(t, 0.42 * level);
    else if (c === "r") {
      // A press roll: the sticks bouncing as fast as they'll go.
      for (let b = 0; b < 4; b++) mix.snare(t + (b * step) / 4, (0.36 + b * 0.015) * level);
    } else if (c === "R") {
      for (let b = 0; b < 4; b++) mix.snare(t + (b * step) / 4, (0.62 + b * 0.02) * level);
    }
  });
  [...bass].forEach((c, i) => {
    if (c === "B") mix.hit(BASS, at + i * step, 0.95 * level, -0.05, 0.3);
    if (c === "b") mix.hit(BASS, at + i * step, 0.55 * level, -0.05, 0.3);
  });
  [...tenor].forEach((c, i) => {
    const tom = { h: TOMS.high, m: TOMS.mid, l: TOMS.low }[c];
    const pan = c === "h" ? -0.32 : c === "m" ? 0.3 : 0.05;
    if (tom) mix.hit(tom, at + i * step, 0.55 * level, pan, 0.25);
  });
  [...timpani].forEach((c, i) => {
    if (c === "T") mix.hit(TOMS.timpani, at + i * step, 0.75 * level, -0.12, 0.35);
  });
}

async function scoutTrack() {
  const song = await decode(SONG);
  const beat = 60 / SONG_TEMPO;
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
  const verse = "aabacabd";
  const mix = new Mix(barTime * SONG_BARS, true);
  for (let bar = 0; bar < SONG_BARS; bar++) {
    drumBar(mix, bar * barTime, step, cadence[verse[bar % verse.length]]);
  }
  // Heard through the trees: nothing of it above the middle of a piano. How loud goes by how
  // loud the drums came out, so it stays clearly there behind them.
  const rms = (wave) => Math.sqrt(wave.reduce((sum, v) => sum + v * v, 0) / wave.length);
  song.forEach((channel, c) => {
    const far = lowpass(lowpass(channel, 1000), 1000);
    const out = c === 0 ? mix.left : mix.right;
    const gain = (SONG_BEHIND_DRUMS * rms(out)) / rms(far);
    for (let i = 0; i < out.length; i++) out[i] += far[i] * gain;
  });
  const [left, right] = finish(mix, { decay: 0.9, wet: 0.5 });
  writeLoop(left, right, "scout", 112);
}

// ---------------------------------------------------------------------------------------------
// The world map: the song up front, with a double-time breakdown in the middle

/**
 * The song's chords at twice the speed and the same pitch: the first half of each bar, one after
 * another, so two bars of it go by in the time of one.
 */
function doubleTime(channel, bar, { from, bars }) {
  const half = bar / 2;
  const join = Math.round(0.008 * SR);
  const out = new Float32Array(bars * bar + join);
  for (let i = 0; i < bars * 2; i++) {
    const source = i * bar;
    for (let k = 0; k < half + join; k++) {
      const fade = Math.min(1, k / join, (half + join - k) / join);
      out[i * half + k] += channel[source + k] * Math.sin((fade * Math.PI) / 2);
    }
  }
  return { start: from * bar, wave: out.subarray(0, bars * bar) };
}

async function mapTrack() {
  const song = await decode(SONG);
  const beat = 60 / SONG_TEMPO;
  const step = beat / 4;
  const barTime = beat * 4;
  const bar = Math.round(barTime * SR);
  const groove = {
    // A light march, with room for the song.
    a: { bass: "B.......b.......", tenor: "....m.......m...", timpani: "T.......T......." },
    b: {
      snare: "....x.......x.x.",
      bass: "B.....b.B.......",
      tenor: "....m.......m.l.",
      timpani: "T.......T.......",
    },
    // Double time: the backbeat comes round twice as often, in the same bars.
    thin: { snare: "..x...x...x...x.", bass: "B...b...B...b...", tenor: "h.m.h.m.h.m.h.m." },
    full: {
      snare: "..A.x.A.x.A.x.A.",
      bass: "B...b...B...b.b.",
      tenor: "h.m.h.m.h.m.h.ml",
      timpani: "T.......T.......",
    },
    roll: {
      snare: "rrrrrrrrRRRRRRRA",
      bass: "B.b.B.b.B.B.B.B.",
      tenor: "h.h.m.m.l.l.hml.",
      timpani: "T.T.T.T.T.T.T.TT",
    },
  };
  const { from, bars } = BREAKDOWN;
  const line = "aabaaaba";
  const mix = new Mix(barTime * SONG_BARS, true);
  for (let b = 0; b < SONG_BARS; b++) {
    const into = b - from;
    let part = groove[line[b % line.length]];
    if (into >= 0 && into < bars) {
      part = into === bars - 1 ? groove.roll : into < bars / 2 ? groove.thin : groove.full;
    }
    drumBar(
      mix,
      b * barTime,
      step,
      part,
      part === groove.full ? 0.6 : part === groove.roll ? 0.7 : 1,
    );
  }
  mix.hit(CRASH, from * barTime, 0.4, 0, 0.3);
  mix.hit(CRASH, (from + bars) * barTime, 0.55, 0, 0.3);
  song.forEach((channel, c) => {
    const out = c === 0 ? mix.left : mix.right;
    const { start, wave } = doubleTime(channel, bar, BREAKDOWN);
    // The breakdown starts stripped back to the middle of the song, and opens up as it goes.
    const thin = highpass(wave, 420);
    for (let i = 0; i < out.length; i++) {
      const at = i - start;
      if (at < 0 || at >= wave.length) {
        out[i] += channel[i] * 0.95;
        continue;
      }
      const open = Math.min(1, Math.max(0, (at / wave.length - 0.25) / 0.7));
      out[i] += (thin[at] * (1 - open) + wave[at] * open) * 0.95;
    }
  });
  const [left, right] = finish(mix, { decay: 0.8, wet: 0.35 });
  writeLoop(left, right, "map", 112);
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

await mapTrack();
await raidTrack();
await scoutTrack();
winTrack();
