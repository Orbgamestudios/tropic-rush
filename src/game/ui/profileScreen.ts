// The player's profile, opened from the crew bar: their icon and name, how they're doing, their
// crew with its invite code, and their account, which keeps all this safe across phones.

import { AVATARS, type Avatar, avatarUrl } from "../logic/avatars";
import { HERO_KINDS } from "../logic/heroes";
import type { SaveData } from "../save";
import {
  button,
  closeOnBackdrop,
  closeSoftly,
  el,
  formatNumber,
  openSoftly,
  panel,
  setLabel,
} from "./kit/dom";
import { sfx } from "./kit/fx";
import { type IconName, icon } from "./kit/icons";

export interface ProfileHandlers {
  save(): SaveData;
  /** The signed-in username, if any. */
  username(): string | null;
  onChange(changes: Pick<SaveData, "nickname" | "avatar">): void;
  onSignUp(username: string, password: string): Promise<string | null>;
  onLogIn(username: string, password: string): Promise<string | null>;
  /** Null once it's done, or what's stopping it. */
  onLogOut(): Promise<string | null>;
  /** The other accounts this phone can switch to. */
  otherAccounts(): string[];
  onSwitch(username: string): Promise<string | null>;
  onAddAccount(): Promise<string | null>;
  onShare(): void;
  onCrew(): void;
  onClose(): void;
}

export class ProfileScreen {
  readonly root = el("div", "screen screen-profile");
  private readonly picture = el("img", "profile-picture");
  private readonly nameInput = el("input", "crew-input profile-name");
  private readonly pictures = el("div", "profile-pictures");
  private readonly stats = el("div", "profile-stats");
  private readonly crewCode = el("div", "profile-code");
  private readonly crewButton: HTMLButtonElement;
  private readonly signedOut = el("div", "profile-signed-out");
  private readonly signedIn = el("div", "profile-signed-in");
  private readonly who = el("div", "profile-who");
  private readonly username = el("input", "crew-input");
  private readonly password = el("input", "crew-input");
  private readonly error = el("div", "crew-join-error");
  private readonly logOutError = el("div", "crew-join-error");
  private readonly switchRows = el("div", "profile-switch");
  private readonly switchRowsOut = el("div", "profile-switch");
  private readonly tiles = new Map<Avatar, HTMLButtonElement>();
  private busy = false;

  constructor(
    parent: HTMLElement,
    private readonly handlers: ProfileHandlers,
  ) {
    const box = panel("Profile", "profile-panel");

    // Who you are.
    const you = el("div", "profile-you");
    this.picture.alt = "";
    this.nameInput.placeholder = "Your name";
    this.nameInput.maxLength = 16;
    this.nameInput.setAttribute("aria-label", "Your name");
    this.nameInput.addEventListener("change", () => this.saveProfile());
    const head = el("div", "profile-head");
    head.append(this.picture, this.nameInput);
    you.append(head, this.pictures, this.stats);
    AVATARS.forEach((avatar, i) => {
      const tile = el("button", "profile-tile");
      tile.setAttribute("aria-label", `Use player icon ${i + 1}`);
      const img = el("img", "profile-tile-img");
      img.alt = "";
      img.src = avatarUrl(avatar);
      tile.append(img);
      tile.addEventListener("click", () => {
        sfx.tick();
        handlers.onChange({ nickname: handlers.save().nickname, avatar });
        this.refresh();
      });
      this.pictures.append(tile);
      this.tiles.set(avatar, tile);
    });

    // Crew and account.
    const side = el("div", "profile-side");
    const crew = el("div", "profile-section");
    this.crewButton = button({
      label: "Share code",
      icon: "share",
      variant: "blue",
      size: "sm",
      onClick: () => (handlers.save().crewCode ? handlers.onShare() : handlers.onCrew()),
    });
    crew.append(el("div", "profile-label", "Crew"), this.crewCode, this.crewButton);

    const account = el("div", "profile-section");
    this.username.placeholder = "Username";
    this.username.setAttribute("aria-label", "Username");
    this.username.autocomplete = "username";
    this.username.autocapitalize = "none";
    this.username.maxLength = 16;
    this.password.placeholder = "Password";
    this.password.setAttribute("aria-label", "Password");
    this.password.type = "password";
    this.password.autocomplete = "current-password";
    const actions = el("div", "profile-actions");
    actions.append(
      button({
        label: "Log in",
        variant: "steel",
        size: "sm",
        onClick: () => void this.send(handlers.onLogIn),
      }),
      button({
        label: "Create account",
        variant: "green",
        size: "sm",
        onClick: () => void this.send(handlers.onSignUp),
      }),
    );
    this.signedOut.append(
      this.username,
      this.password,
      this.error,
      actions,
      el("div", "profile-note", "Keeps your progress on any phone. There's no password reset."),
      this.switchRowsOut,
    );
    this.signedIn.append(
      this.who,
      el(
        "div",
        "profile-note",
        "Your progress is saved to your account. Logging out takes it off this phone.",
      ),
      this.switchRows,
      this.logOutError,
    );
    const signedInActions = el("div", "profile-actions");
    signedInActions.append(
      button({
        label: "Add account",
        icon: "crew",
        variant: "blue",
        size: "sm",
        onClick: () => void this.run(handlers.onAddAccount),
      }),
      button({
        label: "Log out",
        icon: "close",
        variant: "steel",
        size: "sm",
        onClick: () => void this.run(handlers.onLogOut),
      }),
    );
    this.signedIn.append(signedInActions);
    account.append(el("div", "profile-label", "Account"), this.signedOut, this.signedIn);
    side.append(crew, account);

    const columns = el("div", "profile-columns");
    columns.append(you, side);
    box.body.append(columns);
    box.root.append(
      button({
        icon: "close",
        aria: "Close profile",
        round: true,
        variant: "red",
        size: "sm",
        className: "crew-join-close",
        onClick: () => {
          this.saveProfile();
          handlers.onClose();
        },
      }),
    );
    this.root.append(box.root);
    this.root.style.display = "none";
    closeOnBackdrop(this.root, () => {
      this.saveProfile();
      handlers.onClose();
    });
    parent.append(this.root);
  }

  private saveProfile(): void {
    const save = this.handlers.save();
    const nickname = this.nameInput.value.replace(/\s+/g, " ").trim().slice(0, 16);
    if (nickname && nickname !== save.nickname) {
      this.handlers.onChange({ nickname, avatar: save.avatar });
    }
  }

  private async send(action: ProfileHandlers["onLogIn"]): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error.textContent = "";
    const problem = await action(this.username.value.trim(), this.password.value);
    this.busy = false;
    this.error.textContent = problem ?? "";
    if (problem) sfx.error();
    else this.password.value = "";
    this.refresh();
  }

  /** An account action with no form: the game restarts if it works. */
  private async run(action: () => Promise<string | null>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.logOutError.textContent = "";
    const problem = await action();
    this.busy = false;
    this.logOutError.textContent = problem ?? "";
    if (problem) sfx.error();
    this.refresh();
  }

  /** A button for each other account on this phone, in whichever list is showing. */
  private drawSwitchRows(): void {
    const names = this.handlers.otherAccounts();
    const rows = names.map((name) =>
      button({
        label: name,
        icon: "up",
        variant: "steel",
        size: "sm",
        onClick: () => void this.run(() => this.handlers.onSwitch(name)),
      }),
    );
    const list = this.handlers.username() ? this.switchRows : this.switchRowsOut;
    this.switchRows.replaceChildren();
    this.switchRowsOut.replaceChildren();
    if (rows.length > 0) list.append(el("div", "profile-note", "Switch to:"), ...rows);
  }

  show(on: boolean): void {
    if (on) openSoftly(this.root);
    else closeSoftly(this.root);
    if (on) this.refresh();
  }

  private refresh(): void {
    const save = this.handlers.save();
    if (document.activeElement !== this.nameInput) this.nameInput.value = save.nickname;
    this.picture.src = avatarUrl(save.avatar);
    for (const [avatar, tile] of this.tiles) {
      tile.classList.toggle("selected", avatar === save.avatar);
    }
    const stat = (name: IconName, value: string, label: string) => {
      const row = el("div", "profile-stat");
      row.append(
        icon(name, "profile-stat-icon"),
        el("span", "profile-stat-value", value),
        el("span", "profile-stat-label", label),
      );
      return row;
    };
    this.stats.replaceChildren(
      stat("sword2", formatNumber(save.wins), "raids won"),
      stat("island", formatNumber(save.world.taken.length), "islands held"),
      stat("skull", `${save.bestDestruction}%`, "best raid"),
      stat("crew", `${save.unlocked.length} of ${HERO_KINDS.length}`, "heroes"),
    );
    this.crewCode.textContent = save.crewCode || "No crew yet";
    setLabel(this.crewButton, save.crewCode ? "Share code" : "Join a crew");
    const name = this.handlers.username();
    this.signedOut.style.display = name ? "none" : "flex";
    this.signedIn.style.display = name ? "flex" : "none";
    this.who.textContent = name ? `Signed in as ${name}` : "";
    this.drawSwitchRows();
  }
}
