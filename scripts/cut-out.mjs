// Cuts a character out of a plain background, for the 3D generator (docs/CHARACTERS.md).
//
//   node scripts/cut-out.mjs docs/concept/tpose/captain-apose.jpg models-wip/captain-apose.png
//
// The background is taken from the picture's corners. It's flooded in from the edges, a point at a
// time, wherever the colour is close to it: so white trousers or grey shoes inside the figure are
// never taken for background, however close their colour, unless the flood can reach them from
// outside. The edge is softened a little. It then reports how solid the figure came out, band by
// band down the picture, to catch a leg or a shoe eaten away.

import sharp from "sharp";

const [input, output, closeArg] = process.argv.slice(2);
const close = Number(closeArg ?? 38);
const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const at = (x, y) => (y * w + x) * 3;
const corners = [
  [4, 4],
  [w - 5, 4],
  [4, h - 5],
  [w - 5, h - 5],
];
const back = [0, 1, 2].map((c) => corners.reduce((sum, [x, y]) => sum + data[at(x, y) + c], 0) / 4);
const far = (i) => Math.hypot(data[i] - back[0], data[i + 1] - back[1], data[i + 2] - back[2]);

const outside = new Uint8Array(w * h);
const queue = new Int32Array(w * h);
let head = 0;
let tail = 0;
const push = (x, y) => {
  const k = y * w + x;
  if (outside[k] || far(k * 3) > close) return;
  outside[k] = 1;
  queue[tail++] = k;
};
for (let x = 0; x < w; x++) {
  push(x, 0);
  push(x, h - 1);
}
for (let y = 0; y < h; y++) {
  push(0, y);
  push(w - 1, y);
}
while (head < tail) {
  const k = queue[head++];
  const x = k % w;
  const y = (k - x) / w;
  if (x > 0) push(x - 1, y);
  if (x < w - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < h - 1) push(x, y + 1);
}

// The edge: a point of the figure beside the background is partly the background's colour.
const out = Buffer.alloc(w * h * 4);
for (let k = 0; k < w * h; k++) {
  const x = k % w;
  const y = (k - x) / w;
  let alpha = outside[k] ? 0 : 255;
  if (!outside[k]) {
    let beside = 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || outside[ny * w + nx]) beside++;
    }
    if (beside > 0) alpha = Math.round(255 * Math.min(1, far(k * 3) / (close * 2.2)));
  }
  out[k * 4] = data[k * 3];
  out[k * 4 + 1] = data[k * 3 + 1];
  out[k * 4 + 2] = data[k * 3 + 2];
  out[k * 4 + 3] = alpha;
}
await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .png()
  .toFile(output);

// How solid the figure is: in each band, between its leftmost and rightmost points, how much of
// each row is figure. Holes the flood couldn't have made show as gaps only where the body parts
// (legs, arms) really are apart.
let top = h;
let bottom = 0;
for (let k = 0; k < w * h; k++) {
  if (outside[k]) continue;
  const y = Math.floor(k / w);
  top = Math.min(top, y);
  bottom = Math.max(bottom, y);
}
console.log(`background ${back.map((c) => Math.round(c)).join(",")}  figure rows ${top}-${bottom}`);
const bands = 12;
for (let b = 0; b < bands; b++) {
  const y0 = Math.round(top + ((bottom - top) * b) / bands);
  const y1 = Math.round(top + ((bottom - top) * (b + 1)) / bands);
  let figure = 0;
  let span = 0;
  let pale = 0;
  for (let y = y0; y < y1; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < w; x++) {
      if (outside[y * w + x]) continue;
      if (left < 0) left = x;
      right = x;
      figure++;
      const i = at(x, y);
      if (data[i] > 200 && data[i + 1] > 195 && data[i + 2] > 185) pale++;
    }
    if (left >= 0) span += right - left + 1;
  }
  console.log(
    `  band ${String(b + 1).padStart(2)}: rows ${y0}-${y1}, figure fills ${((100 * figure) / Math.max(1, span)).toFixed(0)}% of its width, ${pale} pale points kept`,
  );
}
