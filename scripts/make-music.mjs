// Writes the music the game makes for itself: riffs on the crew island's song for the world map,
// scouting and raids, and a drum riff for winning. The song is exactly 32 bars at 90
// beats a minute and starts on a beat, so anything can be locked to it. The map is the song out in
// front with barely a drum under it, and a half-time breakdown in the middle: the theme at half
// speed, soft and dark. Scouting is the song muffled behind an unhurried field drum corps. A raid
// is the song sped up to 120, which also lifts it a fourth, over the attack drum loop slowed to
// match, with most of its hi-hat taken out, ducking out of the way of each kick. Everything drawn on is CC0, and what's synthesized here is free of
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
const SONG_BEHIND_DRUMS = 1.25;
/** How loud a scout's drums play. */
const SCOUT_DRUMS = 0.62;
/** How loud a raid's drum loop sits. */
const RAID_DRUMS = 0.56;
/** What's left of the drum loop's top end on each sixteenth of a bar: a hi-hat just before the turn. */
const TOP_END = [0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.4, 0, 0.2, 0];
/** Where the drums' top end starts, in Hz. */
const TOP_END_FROM = 3000;
/** The half-time breakdown on the map: which bars, counting from 0, and the song's bars it slows. */
const BREAKDOWN = { from: 16, bars: 8, theme: 16 };
/** Seconds the breakdown takes to fade in and out of the song. */
const BREAKDOWN_FADE = 0.7;

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
    /** How loud the drums play, against everything else. */
    this.drums = 1;
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
    this.put(sound, at + late, gain * firm * this.drums, pan, send);
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
    return sped.map((v, i) => v * 1.5 * duck[i] + beat[i] * RAID_DRUMS);
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
  // Slow and steady, with room between the hits: a patrol, not a charge.
  const cadence = {
    a: {
      snare: "f.......x.......",
      bass: "B.......b.......",
      timpani: "T.......T.......",
    },
    b: {
      snare: "f.......x...x...",
      bass: "B.......b.......",
      tenor: "............m...",
      timpani: "T.......T.......",
    },
    c: {
      snare: "f.......f.......",
      bass: "B.......B.......",
      tenor: "....m.......l...",
      timpani: "T.......T.......",
    },
    d: {
      snare: "f.......x...x.x.",
      bass: "B.......b.......",
      tenor: "............h.m.",
      timpani: "T.......T.......",
    },
  };
  const verse = "aabacabd";
  const mix = new Mix(barTime * SONG_BARS, true);
  mix.drums = SCOUT_DRUMS;
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
// The world map: the song up front, with a half-time breakdown in the middle

/** The theme at half speed, an octave down, softened: two bars of it for each of the song's. */
function halfTime(channel, bar, { bars, theme }) {
  const start = theme * bar;
  const slowed = resampled(channel.subarray(start, start + bars * bar), 0.5, bars * bar);
  return lowpass(lowpass(highpass(slowed, 90), 1500), 1500);
}

async function mapTrack() {
  const song = await decode(SONG);
  const beat = 60 / SONG_TEMPO;
  const step = beat / 4;
  const barTime = beat * 4;
  const bar = Math.round(barTime * SR);
  const groove = {
    // A heartbeat under the song, and little else.
    a: { bass: "B...............", timpani: "........T......." },
    b: { bass: "B...............", tenor: "............m...", timpani: "........T......." },
    // Half time: one soft beat to the bar, and every other bar nothing at all.
    half: { timpani: "T..............." },
    rest: {},
  };
  const { from, bars } = BREAKDOWN;
  const line = "aaabaaab";
  const mix = new Mix(barTime * SONG_BARS, true);
  mix.drums = 0.5;
  for (let b = 0; b < SONG_BARS; b++) {
    const into = b - from;
    const breakdown = into >= 0 && into < bars;
    const part = breakdown ? groove[into % 2 ? "rest" : "half"] : groove[line[b % line.length]];
    drumBar(mix, b * barTime, step, part);
  }
  const start = from * bar;
  const fade = Math.round(BREAKDOWN_FADE * SR);
  song.forEach((channel, c) => {
    const out = c === 0 ? mix.left : mix.right;
    const slow = halfTime(channel, bar, BREAKDOWN);
    for (let i = 0; i < out.length; i++) {
      const at = i - start;
      const inside = Math.min(at + fade, slow.length + fade - at) / (fade * 2);
      const blend = Math.min(1, Math.max(0, inside));
      const wet = Math.sin((blend * Math.PI) / 2);
      const dry = Math.cos((blend * Math.PI) / 2);
      const slowNow = at >= 0 && at < slow.length ? slow[at] : 0;
      out[i] += channel[i] * dry * 0.95 + slowNow * wet * 1.5;
    }
  });
  const [left, right] = finish(mix, { decay: 1, wet: 0.45 });
  writeLoop(left, right, "map", 112);
}

// ---------------------------------------------------------------------------------------------
// Victory: bugles and drums, brass all the way, in B flat

/**
 * Winning: a drum riff at 120. A fill down the toms crashes into a bar of groove, a roll takes it
 * down the toms again, and it ends on one big hit left to ring.
 */
function winTrack() {
  const beat = 60 / 120;
  const step = beat / 4;
  const bar = beat * 4;
  const mix = new Mix(bar * 3 + 2.6, false);
  drumBar(mix, 0, step, {
    snare: "R.R.x.x.........",
    bass: "B.......B.......",
    tenor: "........hhmmllll",
  });
  mix.hit(CRASH, bar, 0.6, -0.2, 0.3);
  drumBar(mix, bar, step, {
    snare: "....A..x.x..A..x",
    bass: "B.....B.B.....B.",
  });
  drumBar(mix, bar * 2, step, {
    snare: "....A..xR.R.....",
    bass: "B.....B.B.......",
    tenor: "............hmll",
  });
  // The last hit, all together, and the cymbal left to ring.
  const end = bar * 3;
  mix.hit(BASS, end, 1.1, 0, 0.3);
  mix.snare(end, 1.05, true);
  mix.hit(CRASH, end, 0.8, 0.15, 0.35);
  mix.hit(TOMS.timpani, end, 0.8, -0.12, 0.35);
  const [left, right] = finish(mix, { decay: 1.1, wet: 0.4 });
  encode(left, right, "win");
}

await mapTrack();
await raidTrack();
await scoutTrack();
winTrack();
