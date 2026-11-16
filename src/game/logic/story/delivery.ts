// How lines are spoken and paced: what each mood asks of a voice, the direction a line's recording
// is made from, and a cutscene's timing, so it breathes like a film rather than reading lines out
// back to back. No engine imports.

import type { HeroKind } from "../heroes";
import {
  type Beat,
  deliveryOf,
  heard,
  type Line,
  type Mood,
  moodOf,
  type Shot,
  SPEAKERS,
} from "./script";

interface MoodDelivery {
  /** For the voice: the feeling and its prosody. */
  voice: string;
  /** Speaking rate, in words a second. */
  rate: number;
  /** Silence before the line, in seconds, when someone else spoke last. */
  gap: number;
}

const PLAIN: MoodDelivery = {
  voice: "natural and conversational, relaxed pace, even pitch",
  rate: 2.6,
  gap: 0.5,
};

export const MOOD_DELIVERY: Record<Mood, MoodDelivery> = {
  happy: {
    voice: "warm and bright, a smile in the voice, lively and lilting",
    rate: 2.8,
    gap: 0.4,
  },
  laugh: { voice: "laughing through the words, breathy with amusement", rate: 2.6, gap: 0.35 },
  sad: {
    voice: "sad and heavy, slow and soft, pitch falling at the ends, catching on the words",
    rate: 1.9,
    gap: 1,
  },
  angry: { voice: "angry, clipped and forceful, hard consonants, quick", rate: 3, gap: 0.2 },
  scared: {
    voice: "frightened, quick and breathless, pitch raised, unsteady",
    rate: 3.1,
    gap: 0.2,
  },
  surprised: {
    voice: "surprised, a sharp breath in, pitch jumping up on the first word",
    rate: 2.7,
    gap: 0.25,
  },
  shout: {
    voice: "shouting over noise, loud and projected, still in their own natural voice",
    rate: 2.9,
    gap: 0.15,
  },
  whisper: {
    voice: "whispering, breathy and barely voiced, slow, long breaths between phrases",
    rate: 1.6,
    gap: 1.1,
  },
  radio: {
    voice: "speaking into a radio, clear, projected and a little clipped",
    rate: 2.5,
    gap: 0.6,
  },
};

/**
 * The direction a line's recording is made from: the speaker's voice, then the mood's feeling and
 * prosody, then anything the line itself asks for.
 */
export function voiceDirection(line: Line): string {
  const { how } = deliveryOf(line);
  const mood = moodOf(line);
  return [SPEAKERS[line[0]].voice, (mood ? MOOD_DELIVERY[mood] : PLAIN).voice, how]
    .filter(Boolean)
    .join(" ");
}

/** About how long a line takes to say, before there's a recording to measure. */
export function spokenSeconds(line: Line): number {
  const mood = moodOf(line);
  const { rate } = mood ? MOOD_DELIVERY[mood] : PLAIN;
  const text = line[1];
  const words = text.split(/\s+/).filter((w) => /\w/.test(w)).length;
  const trails = (text.match(/\.\.\.|—/g) ?? []).length;
  const stops = (text.match(/[.!?,;:](?=\s)/g) ?? []).length;
  return Math.max(0.8, words / rate + trails * 0.45 + stops * 0.15);
}

export type Cue =
  | { at: number; seconds: number; shot: Shot }
  | { at: number; seconds: number; line: Line };

/**
 * A cutscene's timing: when each shot and line starts and how long it runs. Sad and whispered
 * lines come slowly, after long silences; shouts and anger cut in fast. Someone answering waits a
 * beat longer than someone carrying on, and a line's own \`before\` and \`after\` add their holds.
 * Recorded lines will bring their real lengths; the pauses stay.
 */
export function pace(
  beats: readonly Beat[],
  rescued: ReadonlySet<HeroKind>,
  cast: readonly HeroKind[] = [],
  lengthOf: (line: Line) => number = spokenSeconds,
): Cue[] {
  const cues: Cue[] = [];
  let at = 0;
  let last: Line | null = null;
  for (const beat of heard(beats, rescued, cast)) {
    if ("shot" in beat) {
      cues.push({ at, seconds: beat.seconds, shot: beat });
      at += beat.seconds;
      last = null;
      continue;
    }
    const { before = 0, after = 0 } = deliveryOf(beat);
    const mood = moodOf(beat);
    const { gap } = mood ? MOOD_DELIVERY[mood] : PLAIN;
    const answering = last !== null && last[0] !== beat[0];
    at += (last === null ? 0 : answering ? gap : gap * 0.6) + before;
    const seconds = lengthOf(beat);
    cues.push({ at, seconds, line: beat });
    at += seconds + after;
    last = beat;
  }
  return cues;
}
