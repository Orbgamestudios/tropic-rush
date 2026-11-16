// The faces a character can pull, as targets for the parts of a face (docs/CHARACTERS.md, Faces).
//
// Every number is a target for one spring of the face. Brows are given at their inner end (by the
// nose), middle and outer end, in eye-heights up (+) or down (-), so they can arch, knit and tilt;
// each side on its own, so a sceptic can raise one. Lids: how open the upper lid is (1 is the eye's
// resting opening, more is wide), how far the lower lid rises (a squint, a smile pushing up), and
// the pupil's size. The mouth: how far the corners curl up (+) or down (-), and how lopsided it is
// (+ pulls his left corner up more). The head: tilts, in radians, layered over whatever the body is
// doing: nods forward (+), turns to his left (+), leans his head to his left (+).
//
// How long a face takes to come over him (`settle`) is part of it: shock is quick, sympathy slow.

export type Expression =
  | "neutral"
  | "confident_smirk"
  | "realization"
  | "furious"
  | "tactical_focus"
  | "skeptical"
  | "sympathetic"
  | "shocked"
  | "happy"
  | "sad"
  | "scared";

export const EXPRESSIONS: readonly Expression[] = [
  "neutral",
  "confident_smirk",
  "realization",
  "furious",
  "tactical_focus",
  "skeptical",
  "sympathetic",
  "shocked",
  "happy",
  "sad",
  "scared",
];

/** The parts of a face that springs move. */
export const FACE_PARTS = [
  "browInnerL",
  "browMidL",
  "browOuterL",
  "browInnerR",
  "browMidR",
  "browOuterR",
  "lidL",
  "lidR",
  "lowerL",
  "lowerR",
  "pupil",
  "smile",
  "lopsided",
  "mouthTense",
  "nod",
  "turn",
  "lean",
] as const;

export type FacePart = (typeof FACE_PARTS)[number];

export interface Face {
  parts: Partial<Record<FacePart, number>>;
  /** Seconds the face takes to come over him. */
  settle: number;
}

/** What every part is when nothing's asked of it. */
export const REST: Record<FacePart, number> = {
  browInnerL: 0,
  browMidL: 0,
  browOuterL: 0,
  browInnerR: 0,
  browMidR: 0,
  browOuterR: 0,
  lidL: 1,
  lidR: 1,
  lowerL: 0,
  lowerR: 0,
  pupil: 1,
  smile: 0.12,
  lopsided: 0,
  mouthTense: 0,
  nod: 0,
  turn: 0,
  lean: 0,
};

const both = (inner: number, mid: number, outer: number) => ({
  browInnerL: inner,
  browMidL: mid,
  browOuterL: outer,
  browInnerR: inner,
  browMidR: mid,
  browOuterR: outer,
});

export const FACES: Record<Expression, Face> = {
  neutral: { parts: {}, settle: 0.4 },
  // A knowing half-smile: one corner up, that side's brow a touch up, lids lazy.
  confident_smirk: {
    parts: {
      ...both(0, 0.05, 0.05),
      browOuterL: 0.22,
      browMidL: 0.14,
      lidL: 0.82,
      lidR: 0.86,
      lowerL: 0.25,
      lowerR: 0.15,
      smile: 0.45,
      lopsided: 0.55,
      nod: -0.06,
      lean: 0.05,
    },
    settle: 0.45,
  },
  // The penny drops: brows up and back, eyes wide, the pupils opening, the head lifting.
  realization: {
    parts: {
      ...both(0.55, 0.65, 0.45),
      lidL: 1.28,
      lidR: 1.28,
      pupil: 1.18,
      smile: 0,
      nod: -0.1,
    },
    settle: 0.4,
  },
  // Brows down and knotted at the nose, lids hard, the mouth pulled down and tight, chin down.
  furious: {
    parts: {
      ...both(-0.55, -0.25, 0.12),
      lidL: 0.8,
      lidR: 0.8,
      lowerL: 0.35,
      lowerR: 0.35,
      pupil: 0.8,
      smile: -0.55,
      mouthTense: 1,
      nod: 0.12,
    },
    settle: 0.3,
  },
  // Reading the field: brows a little down and level, lids narrowed, mouth set.
  tactical_focus: {
    parts: {
      ...both(-0.22, -0.08, -0.02),
      lidL: 0.78,
      lidR: 0.78,
      lowerL: 0.3,
      lowerR: 0.3,
      pupil: 0.9,
      smile: -0.05,
      mouthTense: 0.5,
      nod: 0.04,
    },
    settle: 0.5,
  },
  // One brow up, the other down, the mouth twisted to one side, the head tilted back a little.
  skeptical: {
    parts: {
      browInnerL: 0.3,
      browMidL: 0.48,
      browOuterL: 0.36,
      browInnerR: -0.22,
      browMidR: -0.12,
      browOuterR: -0.04,
      lidL: 1.02,
      lidR: 0.74,
      lowerR: 0.3,
      smile: -0.1,
      lopsided: -0.45,
      nod: -0.05,
      lean: -0.07,
    },
    settle: 0.45,
  },
  // Inner brows up (the worried slant), lids soft, a small closed smile, head tilted to listen.
  sympathetic: {
    parts: {
      ...both(0.45, 0.12, -0.12),
      lidL: 0.84,
      lidR: 0.84,
      lowerL: 0.12,
      lowerR: 0.12,
      pupil: 1.12,
      smile: 0.2,
      lean: 0.1,
      nod: 0.05,
    },
    settle: 0.6,
  },
  // Everything up and open, the pupils shrinking, the head jerking back.
  shocked: {
    parts: {
      ...both(0.8, 0.85, 0.6),
      lidL: 1.4,
      lidR: 1.4,
      pupil: 0.72,
      smile: -0.15,
      nod: -0.16,
    },
    settle: 0.18,
  },
  happy: {
    parts: {
      ...both(0.18, 0.2, 0.1),
      lidL: 0.92,
      lidR: 0.92,
      lowerL: 0.4,
      lowerR: 0.4,
      pupil: 1.1,
      smile: 0.85,
      nod: -0.04,
    },
    settle: 0.35,
  },
  sad: {
    parts: {
      ...both(0.5, 0.05, -0.25),
      lidL: 0.72,
      lidR: 0.72,
      smile: -0.45,
      nod: 0.14,
      lean: 0.06,
    },
    settle: 0.7,
  },
  scared: {
    parts: {
      ...both(0.7, 0.45, 0.15),
      lidL: 1.3,
      lidR: 1.3,
      pupil: 1.25,
      smile: -0.3,
      mouthTense: 0.6,
      nod: -0.08,
    },
    settle: 0.25,
  },
};

/** Every part's target for an expression, filled in from rest. */
export function faceTargets(expression: Expression): Record<FacePart, number> {
  return { ...REST, ...FACES[expression].parts };
}

export function isExpression(word: string): word is Expression {
  return (EXPRESSIONS as readonly string[]).includes(word);
}
