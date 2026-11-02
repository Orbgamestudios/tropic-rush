// Prints what's in an MP3: its length, how loud it is over time, and anything that looks wrong for
// a loop: silence at either end, sudden drop-outs, and a jump where the end meets the start.
//
//   node scripts/inspect-audio.mjs public/audio/music/raid.mp3

import { readFileSync } from "node:fs";
import { MPEGDecoder } from "mpg123-decoder";

const decoder = new MPEGDecoder();
await decoder.ready;
const { channelData, samplesDecoded, sampleRate } = decoder.decode(readFileSync(process.argv[2]));
decoder.free();
const [left] = channelData;
const seconds = samplesDecoded / sampleRate;
console.log(`${seconds.toFixed(3)} s, ${sampleRate} Hz, ${channelData.length} channels`);

const window = Math.round(sampleRate * 0.05);
const rms = [];
for (let i = 0; i + window <= samplesDecoded; i += window) {
  let sum = 0;
  for (let j = i; j < i + window; j++) sum += left[j] ** 2;
  rms.push(Math.sqrt(sum / window));
}
const peak = Math.max(...rms);
const bars = " .:-=+*#%@";
const line = rms.map((v) => bars[Math.min(9, Math.floor((v / peak) * 9.99))]).join("");
for (let i = 0; i < line.length; i += 100) {
  console.log(`${((i * window) / sampleRate).toFixed(1).padStart(6)}s ${line.slice(i, i + 100)}`);
}

const quiet = (v) => v < peak * 0.02;
let head = 0;
while (head < rms.length && quiet(rms[head])) head++;
let tail = 0;
while (tail < rms.length && quiet(rms[rms.length - 1 - tail])) tail++;
console.log(
  `silence: ${(head * 0.05).toFixed(2)} s at the start, ${(tail * 0.05).toFixed(2)} s at the end`,
);

const gaps = [];
for (let i = 1; i < rms.length - 1; i++) {
  if (quiet(rms[i]) && !quiet(rms[i - 1])) gaps.push(((i * window) / sampleRate).toFixed(2));
}
console.log(`drop-outs: ${gaps.length ? gaps.join(" ") : "none"}`);
let worst = 0;
let at = 0;
for (let i = 1; i < samplesDecoded; i++) {
  const jump = Math.abs(left[i] - left[i - 1]);
  if (jump > worst) {
    worst = jump;
    at = i;
  }
}
console.log(`biggest click: ${worst.toFixed(3)} at ${(at / sampleRate).toFixed(3)} s`);
console.log(
  `end meets start with a jump of ${Math.abs(left[0] - left[samplesDecoded - 1]).toFixed(3)}`,
);

// The tempo, from when the loudness rises fastest.
const hop = Math.round(sampleRate * 0.01);
const energy = [];
for (let i = 0; i + hop <= samplesDecoded; i += hop) {
  let sum = 0;
  for (let j = i; j < i + hop; j++) sum += left[j] ** 2;
  energy.push(Math.sqrt(sum / hop));
}
const onset = energy.map((v, i) => Math.max(0, v - (energy[i - 1] ?? 0)));
let best = 0;
let bpm = 0;
for (let tempo = 60; tempo <= 200; tempo += 0.5) {
  const lag = Math.round(6000 / tempo);
  let score = 0;
  for (let i = lag; i < onset.length; i++) score += onset[i] * onset[i - lag];
  if (score > best) {
    best = score;
    bpm = tempo;
  }
}
console.log(`about ${bpm} beats a minute`);
