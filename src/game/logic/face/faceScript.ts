// A line of dialogue with what the face does written into it (docs/CHARACTERS.md, Faces):
//
//   "[skeptical] Wait a second... [realization] they're flanking us from the ridge! [furious] All
//    units, fall back!"
//
// A tag in square brackets is an expression (see expressions.ts) or an action: [blink], [nod],
// [shake], [look:left] / [look:right] / [look:up] / [look:down] / [look:ahead], [pace:1.3] for how
// fast what follows is said, [pause:0.5] for a held beat. Each takes effect at the moment the words
// after it are reached, so a face changes on the word, not at the start of the line.

import { type Expression, isExpression } from "./expressions";
import { lineSeconds, type VisemeKey, visemesFor } from "./visemes";

export type Look = "left" | "right" | "up" | "down" | "ahead";

export type Cue =
  | { kind: "face"; expression: Expression }
  | { kind: "blink" }
  | { kind: "nod" }
  | { kind: "shake" }
  | { kind: "look"; look: Look };

export interface TimedCue {
  at: number;
  cue: Cue;
}

export interface ScriptedLine {
  /** The words alone, as they'd be shown in a subtitle. */
  text: string;
  /** The mouth's shapes, timed from the start of the line. */
  visemes: VisemeKey[];
  cues: TimedCue[];
  seconds: number;
}

const LOOKS: readonly Look[] = ["left", "right", "up", "down", "ahead"];

function readTag(tag: string): Cue | { pace: number } | { pause: number } | null {
  const [word = "", value = ""] = tag.toLowerCase().trim().split(":");
  if (isExpression(word)) return { kind: "face", expression: word };
  if (word === "blink") return { kind: "blink" };
  if (word === "nod") return { kind: "nod" };
  if (word === "shake") return { kind: "shake" };
  if (word === "look" && (LOOKS as readonly string[]).includes(value))
    return { kind: "look", look: value as Look };
  if (word === "pace" && Number(value) > 0) return { pace: Number(value) };
  if (word === "pause" && Number(value) >= 0) return { pause: Number(value) };
  return null;
}

/**
 * Reads a scripted line: the words, the mouth's timing, and each tag's moment. The line is said in
 * stretches between tags, each at its own pace, one after another.
 */
export function scriptLine(source: string, pace = 1): ScriptedLine {
  const visemes: VisemeKey[] = [];
  const cues: TimedCue[] = [];
  let text = "";
  let t = 0;
  let speed = pace;
  // The line as stretches of words, each led by the tags just before it.
  const parts = source.split(/(\[[^\]]*\])/);
  for (const part of parts) {
    if (part.startsWith("[") && part.endsWith("]")) {
      const read = readTag(part.slice(1, -1));
      if (!read) continue;
      if ("pace" in read) speed = pace * read.pace;
      else if ("pause" in read) t += read.pause;
      else cues.push({ at: t, cue: read });
      continue;
    }
    if (part.trim() === "") {
      text += part;
      continue;
    }
    const stretch = visemesFor(part, speed);
    const offset = text.length;
    // The closing silence of each stretch but the last is where the next one starts.
    const length = lineSeconds(stretch);
    for (const key of stretch.slice(0, -1))
      visemes.push({ ...key, at: key.at + t, char: key.char + offset });
    t += length;
    text += part;
  }
  visemes.push({ at: t, viseme: "sil", weight: 0, char: text.length });
  return { text: text.replace(/\s+/g, " ").trim(), visemes, cues, seconds: t };
}
