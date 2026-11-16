// How wide a mouth is, moment to moment, while a line is said: worked out from the words, until
// there are recordings to work it out from (docs/CHARACTERS.md, Faces). Each letter is given the
// shape a mouth makes for it, the way animators' mouth charts do: wide open for "ah", round for
// "oo", nearly shut for "ee", shut for "m", "b" and "p" (a mouth has to close for those, or it
// reads wrong at once), and shut for a breath at every comma and full stop. The line is spread
// over the time it takes to say, so the mouth keeps pace with the words on screen.

/** What a mouth does for a sound: how far the jaw drops, and how round the lips go. */
export interface MouthShape {
  open: number;
  round: number;
}

const SHUT: MouthShape = { open: 0, round: 0 };

/** Letters as mouth shapes. Anything not here is a consonant said with the mouth a little open. */
const SHAPES: Record<string, MouthShape> = {
  a: { open: 1, round: 0.1 },
  e: { open: 0.55, round: 0 },
  i: { open: 0.45, round: 0 },
  o: { open: 0.8, round: 0.85 },
  u: { open: 0.45, round: 1 },
  y: { open: 0.4, round: 0 },
  w: { open: 0.3, round: 0.9 },
  m: SHUT,
  b: SHUT,
  p: SHUT,
  f: { open: 0.12, round: 0 },
  v: { open: 0.12, round: 0 },
  l: { open: 0.4, round: 0 },
  r: { open: 0.35, round: 0.4 },
  h: { open: 0.5, round: 0 },
};
const CONSONANT: MouthShape = { open: 0.25, round: 0 };

/** The shape for one letter of a line, or shut for a gap in it. */
function shapeOf(letter: string): MouthShape {
  if (/[.,!?;:—]/.test(letter)) return SHUT;
  if (!/[a-z]/i.test(letter)) return SHUT;
  return SHAPES[letter.toLowerCase()] ?? CONSONANT;
}

/**
 * The mouth `seconds` into a line that takes `length` to say. Pauses at punctuation take longer
 * than letters do, as they would spoken.
 */
export function mouthAt(text: string, seconds: number, length: number): MouthShape {
  if (seconds < 0 || seconds >= length || text.length === 0) return SHUT;
  // A stop takes as long as four letters; a space as long as half of one.
  const weight = (c: string) => (/[.,!?;:—]/.test(c) ? 4 : c === " " ? 0.5 : 1);
  let total = 0;
  for (const c of text) total += weight(c);
  const at = (seconds / length) * total;
  let run = 0;
  const letters = [...text];
  for (let i = 0; i < letters.length; i++) {
    const c = letters[i] ?? " ";
    const w = weight(c);
    if (run + w >= at) {
      // Blend into the next shape, so the mouth moves between sounds rather than snapping.
      const into = (at - run) / w;
      const now = shapeOf(c);
      const next = shapeOf(letters[i + 1] ?? ".");
      const t = Math.max(0, into - 0.5) * 2;
      return {
        open: now.open + (next.open - now.open) * t,
        round: now.round + (next.round - now.round) * t,
      };
    }
    run += w;
  }
  return SHUT;
}
