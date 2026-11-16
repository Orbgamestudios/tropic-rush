// What a mouth does to say a line: the line's letters turned into the sounds of speech, each sound
// into a mouth shape (a viseme), timed the way people talk (docs/CHARACTERS.md, Faces).
//
// English spelling is a poor guide to sound, but a mouth only needs to be about right: the shapes
// people notice are the open vowels, the lips closing for M, B and P, the teeth on the lip for F
// and V, rounded lips for OO and W, and stopping for commas and full stops. Letters are read in
// pairs where a pair makes one sound (TH, SH, OO, EE...), then one at a time.

export type Viseme = "sil" | "AA" | "EE" | "IH" | "OH" | "OO" | "M_B_P" | "F_V" | "L_T_D" | "W_R";

export const VISEMES: readonly Viseme[] = [
  "sil",
  "AA",
  "EE",
  "IH",
  "OH",
  "OO",
  "M_B_P",
  "F_V",
  "L_T_D",
  "W_R",
];

/**
 * A mouth shape: how far open (0 shut, 1 a wide shout), how wide (1 at rest, more is stretched,
 * less is pursed), how rounded (lips pushed forward into an O), how much of the upper and lower
 * teeth show, and how much tongue.
 */
export interface MouthShape {
  open: number;
  wide: number;
  round: number;
  teethUp: number;
  teethDown: number;
  tongue: number;
  /** Lips pressed together (M, B, P): shut, and a little rolled in. */
  press: number;
  /** The lower lip tucked under the upper teeth (F, V). */
  bite: number;
}

export const MOUTH: Record<Viseme, MouthShape> = {
  sil: { open: 0, wide: 1, round: 0, teethUp: 0, teethDown: 0, tongue: 0, press: 0, bite: 0 },
  AA: {
    open: 0.85,
    wide: 1.05,
    round: 0.1,
    teethUp: 0.6,
    teethDown: 0.3,
    tongue: 0.5,
    press: 0,
    bite: 0,
  },
  EE: {
    open: 0.32,
    wide: 1.32,
    round: 0,
    teethUp: 0.9,
    teethDown: 0.7,
    tongue: 0.2,
    press: 0,
    bite: 0,
  },
  IH: {
    open: 0.45,
    wide: 1.15,
    round: 0.05,
    teethUp: 0.7,
    teethDown: 0.4,
    tongue: 0.4,
    press: 0,
    bite: 0,
  },
  OH: {
    open: 0.7,
    wide: 0.78,
    round: 0.75,
    teethUp: 0.3,
    teethDown: 0.1,
    tongue: 0.3,
    press: 0,
    bite: 0,
  },
  OO: {
    open: 0.3,
    wide: 0.6,
    round: 1,
    teethUp: 0.1,
    teethDown: 0,
    tongue: 0.1,
    press: 0,
    bite: 0,
  },
  M_B_P: { open: 0, wide: 0.95, round: 0, teethUp: 0, teethDown: 0, tongue: 0, press: 1, bite: 0 },
  F_V: { open: 0.12, wide: 1.05, round: 0, teethUp: 1, teethDown: 0, tongue: 0, press: 0, bite: 1 },
  L_T_D: {
    open: 0.35,
    wide: 1.08,
    round: 0,
    teethUp: 0.8,
    teethDown: 0.5,
    tongue: 0.85,
    press: 0,
    bite: 0,
  },
  W_R: {
    open: 0.25,
    wide: 0.68,
    round: 0.85,
    teethUp: 0.1,
    teethDown: 0,
    tongue: 0.15,
    press: 0,
    bite: 0,
  },
};

/** A mouth shape reached at a moment of a line. */
export interface VisemeKey {
  /** Seconds from the start of the line. */
  at: number;
  viseme: Viseme;
  /** How strongly it's said: stressed vowels and line ends get more. */
  weight: number;
  /** Which letter of the line it came from, so things tied to letters can find their moment. */
  char: number;
}

// Two letters that make one sound, and the shape it takes. Checked before single letters.
const PAIRS: Record<string, Viseme> = {
  th: "L_T_D",
  sh: "IH",
  ch: "IH",
  ph: "F_V",
  wh: "W_R",
  qu: "W_R",
  ng: "IH",
  ck: "IH",
  oo: "OO",
  ou: "OH",
  ow: "OH",
  oa: "OH",
  oi: "OH",
  oy: "OH",
  ee: "EE",
  ea: "EE",
  ie: "EE",
  ey: "EE",
  ai: "EE",
  ay: "EE",
  au: "AA",
  aw: "AA",
};

const SINGLE: Record<string, Viseme> = {
  a: "AA",
  e: "IH",
  i: "IH",
  o: "OH",
  u: "OO",
  y: "EE",
  m: "M_B_P",
  b: "M_B_P",
  p: "M_B_P",
  f: "F_V",
  v: "F_V",
  l: "L_T_D",
  t: "L_T_D",
  d: "L_T_D",
  n: "L_T_D",
  w: "W_R",
  r: "W_R",
  s: "EE",
  z: "EE",
  c: "IH",
  k: "IH",
  g: "IH",
  j: "IH",
  q: "IH",
  x: "IH",
  h: "AA",
};

const VOWELS = new Set<Viseme>(["AA", "EE", "IH", "OH", "OO"]);

/** How long each kind of sound is held, in seconds, at an ordinary speaking pace. */
export const TIMING = {
  vowel: 0.11,
  consonant: 0.065,
  /** The lips need a moment shut to read as M, B or P. */
  closed: 0.08,
  betweenWords: 0.03,
  comma: 0.26,
  stop: 0.48,
  ellipsis: 0.62,
  dash: 0.3,
} as const;

/** The sound each letter of a word makes, with the letter it starts at. */
function sounds(word: string): { viseme: Viseme; char: number }[] {
  const out: { viseme: Viseme; char: number }[] = [];
  const lower = word.toLowerCase();
  let i = 0;
  while (i < lower.length) {
    const pair = PAIRS[lower.slice(i, i + 2)];
    // A silent E at the end of a word lengthens the vowel before it rather than being said.
    const silentE = lower[i] === "e" && i === lower.length - 1 && lower.length > 2;
    if (pair) {
      out.push({ viseme: pair, char: i });
      i += 2;
    } else if (silentE) {
      i += 1;
    } else {
      const single = SINGLE[lower[i] ?? ""];
      if (single) out.push({ viseme: single, char: i });
      i += 1;
    }
  }
  // Two of the same shape in a row read as one, held.
  return out.filter((s, n) => n === 0 || s.viseme !== out[n - 1]?.viseme || !VOWELS.has(s.viseme));
}

/**
 * A line as timed mouth shapes. `pace` scales speed (1 is ordinary, 1.3 brisk, 0.8 slow and
 * thoughtful). Letters that aren't speech (tags in square brackets) take no time.
 */
export function visemesFor(line: string, pace = 1): VisemeKey[] {
  const keys: VisemeKey[] = [];
  let t = 0;
  const say = (viseme: Viseme, char: number, length: number, weight = 1) => {
    keys.push({ at: t, viseme, weight, char });
    t += length / pace;
  };
  const pattern = /\[[^\]]*\]|\.\.\.|…|[A-Za-z']+|[,;:]|[.!?]+|[-–—]+|\s+/g;
  for (const match of line.matchAll(pattern)) {
    const piece = match[0];
    const char = match.index ?? 0;
    if (piece.startsWith("[")) continue;
    if (/^\s+$/.test(piece)) {
      if (keys.length > 0) t += TIMING.betweenWords / pace;
      continue;
    }
    if (piece === "..." || piece === "…") say("sil", char, TIMING.ellipsis, 0);
    else if (/^[,;:]$/.test(piece)) say("sil", char, TIMING.comma, 0);
    else if (/^[.!?]+$/.test(piece)) say("sil", char, TIMING.stop, 0);
    else if (/^[-–—]+$/.test(piece)) say("sil", char, TIMING.dash, 0);
    else {
      const word = piece.replace(/'/g, "");
      const heard = sounds(word);
      heard.forEach((s, n) => {
        const vowel = VOWELS.has(s.viseme);
        const length = vowel
          ? TIMING.vowel
          : s.viseme === "M_B_P"
            ? TIMING.closed
            : TIMING.consonant;
        // The first vowel of a word carries its stress; shouting makes everything bigger.
        const firstVowel = vowel && heard.findIndex((h) => VOWELS.has(h.viseme)) === n;
        const loud = /!/.test(line.slice(char, char + piece.length + 2)) ? 1.15 : 1;
        say(s.viseme, char + s.char, length, (firstVowel ? 1 : 0.8) * loud);
      });
    }
  }
  keys.push({ at: t, viseme: "sil", weight: 0, char: line.length });
  return keys;
}

/** How long a line takes to say. */
export function lineSeconds(keys: readonly VisemeKey[]): number {
  return keys.length > 0 ? (keys[keys.length - 1]?.at ?? 0) : 0;
}

/**
 * The mouth's shape at a moment of a line, blended: each sound eases in over the end of the one
 * before it, as real speech runs one sound into the next.
 */
export function mouthAt(keys: readonly VisemeKey[], seconds: number): MouthShape {
  const rest = MOUTH.sil;
  if (keys.length === 0 || seconds <= 0 || seconds >= lineSeconds(keys)) return { ...rest };
  let n = 0;
  while (n < keys.length - 1 && (keys[n + 1]?.at ?? 0) <= seconds) n++;
  const now = keys[n] as VisemeKey;
  const next = keys[n + 1] ?? now;
  const span = Math.max(1e-3, next.at - now.at);
  // The last 40% of each sound blends into the next.
  const t = Math.min(1, Math.max(0, ((seconds - now.at) / span - 0.6) / 0.4));
  const blend = t * t * (3 - 2 * t);
  const a = scaled(MOUTH[now.viseme], now.weight);
  const b = scaled(MOUTH[next.viseme], next.weight);
  return mix(a, b, blend);
}

function scaled(shape: MouthShape, weight: number): MouthShape {
  const rest = MOUTH.sil;
  return mix(rest, shape, Math.min(1.2, weight));
}

export function mix(a: MouthShape, b: MouthShape, t: number): MouthShape {
  const out = { ...a };
  for (const key of Object.keys(a) as (keyof MouthShape)[])
    out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}
