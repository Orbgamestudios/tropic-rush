// How the story's told on screen (docs/STORY.md): a dialogue box along the bottom with the
// speaker's portrait and name, typed out letter by letter, tap for the next line; a smaller box
// that talks over a raid without stopping it; and a cutscene's subtitles, laid straight over the
// picture, with the crew's choices put to them the same way. It only shows what it's handed and
// says when it's done.

import { type Cue, type Line, moodOf, SPEAKERS, type Speaker } from "../logic/story";
import { el } from "./kit/dom";
import { sfx } from "./kit/fx";

/** A box that waits for a tap, one that talks over the game, or a cutscene. */
export type StoryMode = "talk" | "bark" | "film";

export interface PlayOptions {
  mode: StoryMode;
  /** Each shot and line as it starts, for whatever's staging it. */
  onCue?(cue: Cue): void;
  onDone(): void;
}

/** Letters a second in a box that waits for a tap. */
const TYPING = 70;
/** How long a line that nobody's tapping past stays up after it's said, in seconds. */
const LINGER = 0.9;
/** A cutscene's last line or shot holds this long before it ends. */
const LAST_HOLD = 1.2;

export class StoryUi {
  private readonly root: HTMLDivElement;
  private readonly subtitle = el("div", "story-subtitle");
  private readonly subName = el("span", "story-sub-name");
  private readonly subText = el("span", "story-sub-text");
  private readonly box = el("div", "story-box");
  private readonly portrait = el("img", "story-portrait");
  private readonly name = el("div", "story-name");
  private readonly text = el("div", "story-text");
  private readonly more = el("div", "story-more", "Tap");
  private readonly choice = el("div", "story-choice");
  private cues: readonly Cue[] = [];
  private options: PlayOptions | null = null;
  private index = -1;
  /** Seconds into the scene, for the modes that keep their own time. */
  private clock = 0;
  /** Seconds into the line on show. */
  private said = 0;
  private shown = 0;
  private face: Speaker | null = null;
  private asking = false;
  /** A cutscene's on, whether or not a line is: between scenes of one, the picture stays up. */
  private filming = false;

  constructor(
    parent: HTMLElement,
    private readonly portraitOf: (who: Speaker) => Promise<string>,
  ) {
    this.root = el("div", "story");
    this.subtitle.append(this.subName, this.subText);
    const words = el("div", "story-words");
    words.append(this.name, this.text);
    this.box.append(this.portrait, words, this.more);
    this.root.append(this.subtitle, this.box, this.choice);
    this.root.addEventListener("pointerdown", (e) => {
      if (!this.options || this.asking || this.options.mode === "bark") return;
      e.preventDefault();
      this.tap();
    });
    parent.append(this.root);
    this.show();
  }

  /** Something's playing or being asked. */
  get busy(): boolean {
    return this.options !== null || this.asking;
  }

  /** Whether what's playing takes the whole screen, and the game under it should wait. */
  get blocking(): boolean {
    return this.asking || this.filming || (this.options !== null && this.options.mode !== "bark");
  }

  play(cues: readonly Cue[], options: PlayOptions): void {
    this.cues = options.mode === "film" ? cues : cues.filter((c) => "line" in c);
    this.options = options;
    this.index = -1;
    this.clock = 0;
    this.filming = options.mode === "film";
    this.subtitle.classList.remove("on");
    this.show();
    if (this.cues.length === 0) this.finish();
    else this.start(0);
  }

  /**
   * Puts a choice to the player, inside the cutscene: the question where a subtitle would be, and
   * each answer as a line to tap.
   */
  ask(question: string, answers: readonly string[], onPick: (index: number) => void): void {
    this.asking = true;
    this.filming = true;
    this.subtitle.classList.remove("on");
    this.choice.replaceChildren(
      el("div", "story-ask", question),
      ...answers.map((say, i) => {
        const answer = el("button", "story-answer", say);
        answer.addEventListener("pointerdown", (e) => e.stopPropagation());
        answer.addEventListener("click", () => {
          sfx.press();
          this.asking = false;
          this.choice.replaceChildren();
          this.show();
          onPick(i);
        });
        return answer;
      }),
    );
    this.show();
  }

  /** A cutscene's over: the picture goes back to the game. */
  endFilm(): void {
    this.filming = false;
    this.show();
  }

  /** Drops whatever's playing without saying it's done: the game's leaving for somewhere else. */
  stop(): void {
    this.options = null;
    this.asking = false;
    this.filming = false;
    this.choice.replaceChildren();
    this.show();
  }

  update(dt: number): void {
    const { options } = this;
    if (!options) return;
    const cue = this.cues[this.index];
    if (!cue) return;
    this.said += dt;
    if ("line" in cue) this.type(cue.line, cue.seconds, options.mode);
    if (options.mode === "talk") return;
    this.clock += dt;
    const next = this.cues[this.index + 1];
    const hold = options.mode === "film" ? LAST_HOLD : LINGER;
    const until = next ? Math.max(next.at, options.mode === "bark" ? cue.at + cue.seconds : 0) : 0;
    if (next ? this.clock >= until : this.clock >= cue.at + cue.seconds + hold) this.advance();
  }

  /** Shows whichever of its parts are in use, or nothing at all. */
  private show(): void {
    const mode = this.filming ? "film" : (this.options?.mode ?? null);
    const on = mode !== null || this.asking;
    this.root.className = ["story", mode ?? "", this.asking ? "asking" : ""].join(" ").trim();
    this.root.style.display = on ? "" : "none";
  }

  private start(index: number): void {
    const cue = this.cues[index];
    if (!cue) return;
    this.index = index;
    this.said = 0;
    this.shown = -1;
    this.clock = Math.max(this.clock, cue.at);
    const mode = this.options?.mode ?? "talk";
    if ("shot" in cue) {
      // A shot is the camera's alone: nothing's said, so nothing's written.
      this.subtitle.classList.remove("on");
    } else {
      const [who] = cue.line;
      const mood = moodOf(cue.line) ?? "plain";
      const { name } = SPEAKERS[who];
      if (mode === "film") {
        this.subName.textContent = name;
        this.subtitle.className = `story-subtitle on mood-${mood}`;
      } else {
        this.name.textContent = name;
        this.text.className = `story-text mood-${mood}`;
        this.box.classList.toggle("radio", mood === "radio");
        if (who !== this.face) {
          this.face = who;
          this.portrait.style.visibility = "hidden";
          void this.portraitOf(who).then((url) => {
            if (this.face !== who) return;
            this.portrait.src = url;
            this.portrait.style.visibility = "";
          });
        }
      }
      this.type(cue.line, cue.seconds, mode);
    }
    this.options?.onCue?.(cue);
  }

  /** Shows as much of a line as has been said so far. */
  private type(line: Line, seconds: number, mode: StoryMode): void {
    const words = line[1];
    // A box types fast and waits; a cutscene's subtitle keeps time with the line being spoken.
    const rate = mode === "talk" ? TYPING : Math.max(28, words.length / (seconds * 0.75));
    const count = Math.min(words.length, Math.floor(this.said * rate));
    if (count === this.shown) return;
    if (mode === "talk" && count > this.shown && count % 4 === 0 && count < words.length) {
      sfx.tick();
    }
    this.shown = count;
    const target = mode === "film" ? this.subText : this.text;
    // The rest is there but unseen, so the box never changes size as it types.
    const seen = document.createElement("span");
    seen.textContent = words.slice(0, count);
    const unseen = document.createElement("span");
    unseen.className = "story-unseen";
    unseen.textContent = words.slice(count);
    target.replaceChildren(seen, unseen);
    this.more.classList.toggle("on", mode === "talk" && count >= words.length);
  }

  private tap(): void {
    const cue = this.cues[this.index];
    if (!cue || !this.options) return;
    if (this.options.mode === "talk" && "line" in cue && this.shown < cue.line[1].length) {
      // The first tap finishes the line; the next moves on.
      this.said = cue.line[1].length / TYPING + 1;
      this.type(cue.line, cue.seconds, "talk");
      return;
    }
    sfx.press();
    this.advance();
  }

  private advance(): void {
    if (this.index + 1 < this.cues.length) this.start(this.index + 1);
    else this.finish();
  }

  private finish(): void {
    const { options } = this;
    if (!options) return;
    this.options = null;
    this.face = null;
    this.subtitle.classList.remove("on");
    // A cutscene's picture stays up until whoever's staging it says it's over.
    this.show();
    options.onDone();
  }
}
