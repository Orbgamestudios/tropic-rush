// The crew island screen: touch and mouse handling, placing and moving buildings, and keeping
// this phone's layout in step with the crew server.
// Drag empty sand to pan, pinch or scroll to zoom, tap a building to select it, then drag it.

import type { BuildingType } from "../logic/buildings";
import { BUILDINGS } from "../logic/buildings";
import {
  applyOp,
  buildingAtTile,
  type CrewLayout,
  cornerFor,
  fits,
  GRID_COLUMNS,
  GRID_ROWS,
  type LayoutOp,
  type PlacedBuilding,
  sanitizeLayout,
  tileAt,
} from "../logic/crewIsland";
import { distance, vec } from "../logic/vec";
import { type ConnectionStatus, CrewClient, requestCrewCode } from "../net/crewClient";
import {
  CREW_CODE_PATTERN,
  cleanName,
  type Hold,
  type Member,
  normalizeCrewCode,
} from "../net/protocol";
import { CrewIslandView } from "../render/crewIslandView";
import type { Stage } from "../render/stage";
import { loadLocalLayout, type SaveData, writeLocalLayout } from "../save";
import { CrewUi } from "../ui/crewUi";

interface Drag {
  kind: "place" | "move";
  building: PlacedBuilding;
  pointerId: number;
  valid: boolean;
  overIsland: boolean;
  /** Tile offset from the building's corner to where it was grabbed. */
  grab: { x: number; y: number };
}

type Gesture =
  | { kind: "pending"; startX: number; startY: number; hitId: string | null }
  | { kind: "pan" }
  | { kind: "pinch"; distance: number; midX: number; midY: number };

const TAP_DISTANCE = 10;

function newId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export interface CrewModeHost {
  save(): SaveData;
  updateSave(changes: Partial<SaveData>): void;
  onBack(): void;
}

export class CrewMode {
  private view: CrewIslandView | null = null;
  private layout: CrewLayout = sanitizeLayout(null);
  private client: CrewClient | null = null;
  private status: ConnectionStatus | "solo" = "solo";
  private members: Member[] = [];
  private holds: Hold[] = [];
  private selectedId: string | null = null;
  private drag: Drag | null = null;
  private gesture: Gesture | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private readonly ui: CrewUi;

  constructor(
    private readonly stage: Stage,
    private readonly surface: HTMLElement,
    private readonly labelLayer: HTMLElement,
    uiLayer: HTMLElement,
    private readonly host: CrewModeHost,
  ) {
    this.ui = new CrewUi(uiLayer, {
      onBack: () => host.onBack(),
      onCreate: (name) => void this.createCrew(name),
      onJoin: (name, code) => this.joinCrew(name, code),
      onOffline: (name) => this.goOffline(name),
      onChipDown: (type, event) => this.startPlacing(type, event),
      onRotate: () => this.rotateSelected(),
      onRemove: () => this.removeSelected(),
      onDone: () => this.select(null),
    });
    surface.addEventListener("pointerdown", (e) => this.onDown(e));
    surface.addEventListener("pointermove", (e) => this.onMove(e));
    surface.addEventListener("pointerup", (e) => this.onUp(e));
    surface.addEventListener("pointercancel", (e) => this.onUp(e));
    surface.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.view?.camera.zoom(e.deltaY > 0 ? 1.12 : 0.89);
    });
    window.addEventListener("pointermove", (e) => {
      if (this.drag?.kind === "place" && e.pointerId === this.drag.pointerId)
        this.updateDrag(e.clientX, e.clientY);
    });
    window.addEventListener("pointerup", (e) => {
      if (this.drag?.kind === "place" && e.pointerId === this.drag.pointerId) this.finishDrag();
    });
    window.addEventListener("pointercancel", (e) => {
      // The browser took the touch over (e.g. to scroll the build bar): drop the placement.
      if (this.drag?.kind === "place" && e.pointerId === this.drag.pointerId) {
        this.drag = null;
        this.view?.showPreview(null);
      }
    });
  }

  /** Read-only view of the island for automated tests (`?testhooks`). */
  snapshot(): { layout: CrewLayout; members: Member[]; status: string; code: string } {
    return {
      layout: this.layout,
      members: this.members,
      status: this.status,
      code: this.host.save().crewCode,
    };
  }

  get active(): boolean {
    return this.view !== null;
  }

  enter(): void {
    this.view = new CrewIslandView(this.stage, this.labelLayer);
    this.stage.scene.add(this.view.root);
    this.surface.style.display = "block";
    this.ui.show(true);
    this.layout = sanitizeLayout(loadLocalLayout());
    this.select(null);
    const save = this.host.save();
    if (save.crewCode && save.nickname) this.connect();
    else if (save.nickname && save.crewCode === "" && this.hasLocalIsland()) this.refreshTop();
    else this.ui.showJoin(save.nickname);
    this.refreshTop();
  }

  exit(): void {
    this.client?.close();
    this.client = null;
    if (this.view) {
      this.stage.scene.remove(this.view.root);
      this.view.dispose();
      this.view = null;
    }
    this.drag = null;
    this.gesture = null;
    this.pointers.clear();
    this.surface.style.display = "none";
    this.ui.show(false);
    this.ui.hideJoin();
  }

  frame(dt: number, time: number): void {
    if (!this.view) return;
    const save = this.host.save();
    const others = this.holds.filter((h) => h.memberId !== save.memberId);
    const hidden = this.drag?.kind === "move" ? this.drag.building.id : null;
    this.view.sync(this.layout, hidden, others);
    const selected = this.selected();
    this.view.showSelection(this.drag ? null : (selected ?? null));
    this.view.update(dt, time);
  }

  // -------------------------------------------------------------------------------------------
  // Crew membership

  private hasLocalIsland(): boolean {
    return loadLocalLayout() !== null;
  }

  private ensureMember(name: string): string | null {
    const clean = cleanName(name);
    if (!clean) {
      this.ui.showJoin(name, "Pick a nickname first");
      return null;
    }
    const save = this.host.save();
    this.host.updateSave({ nickname: clean, memberId: save.memberId || newId() });
    return clean;
  }

  private async createCrew(name: string): Promise<void> {
    if (!this.ensureMember(name)) return;
    const code = await requestCrewCode();
    if (!code) {
      this.ui.showJoin(
        name,
        "Couldn't reach the crew server. Try again, or build offline for now.",
      );
      return;
    }
    this.host.updateSave({ crewCode: code });
    this.ui.hideJoin();
    this.connect();
    this.ui.flash(`Crew ${code} created: tap the code to share it`);
  }

  private joinCrew(name: string, rawCode: string): void {
    if (!this.ensureMember(name)) return;
    const code = normalizeCrewCode(rawCode);
    if (!CREW_CODE_PATTERN.test(code)) {
      this.ui.showJoin(name, "Crew codes are 6 letters and numbers");
      return;
    }
    this.host.updateSave({ crewCode: code });
    this.ui.hideJoin();
    this.connect();
  }

  private goOffline(name: string): void {
    if (!this.ensureMember(name)) return;
    this.host.updateSave({ crewCode: "" });
    writeLocalLayout(this.layout);
    this.ui.hideJoin();
    this.status = "solo";
    this.refreshTop();
  }

  private connect(): void {
    const save = this.host.save();
    this.client?.close();
    this.status = "connecting";
    this.client = new CrewClient(save.crewCode, save.memberId, save.nickname, {
      onState: (layout, members, holds, by) => {
        this.layout = sanitizeLayout(layout);
        writeLocalLayout(this.layout);
        this.members = members;
        this.holds = holds;
        if (this.selectedId && !this.layout.buildings.some((b) => b.id === this.selectedId))
          this.select(null);
        if (by && by !== this.host.save().nickname) this.refreshSelection();
        this.refreshTop();
      },
      onReject: (reason) => this.ui.flash(reason),
      onStatus: (status) => {
        this.status = status;
        if (status === "full") {
          this.host.updateSave({ crewCode: "" });
          this.ui.showJoin(this.host.save().nickname, "That crew already has 5 members.");
        }
        this.refreshTop();
      },
    });
    this.refreshTop();
  }

  private refreshTop(): void {
    const save = this.host.save();
    const members =
      this.members.length > 0
        ? this.members
        : save.nickname
          ? [{ id: save.memberId, name: save.nickname, online: true }]
          : [];
    this.ui.setCrew(save.crewCode, members, save.crewCode ? this.status : "solo");
  }

  // -------------------------------------------------------------------------------------------
  // Changes

  private commit(op: LayoutOp): boolean {
    const next = applyOp(this.layout, op);
    if (!next) return false;
    this.layout = next;
    writeLocalLayout(next);
    this.client?.sendOp(op);
    return true;
  }

  private heldByOther(id: string): Hold | undefined {
    const me = this.host.save().memberId;
    return this.holds.find((h) => h.buildingId === id && h.memberId !== me);
  }

  private selected(): PlacedBuilding | undefined {
    return this.layout.buildings.find((b) => b.id === this.selectedId);
  }

  private select(id: string | null): void {
    this.selectedId = id;
    this.refreshSelection();
  }

  private refreshSelection(): void {
    const b = this.selected();
    if (!b) {
      this.ui.setSelection(null, false);
      return;
    }
    const holder = this.heldByOther(b.id);
    const label = holder
      ? `${BUILDINGS[b.type].label} (${holder.name} is moving it)`
      : BUILDINGS[b.type].label;
    this.ui.setSelection(`${label}: drag it to move`, b.type !== "headquarters");
  }

  private rotateSelected(): void {
    const b = this.selected();
    if (!b) return;
    if (this.heldByOther(b.id)) {
      this.ui.flash("A crewmate is moving that");
      return;
    }
    if (!this.commit({ kind: "move", id: b.id, x: b.x, y: b.y, rotated: !b.rotated })) {
      this.ui.flash("No room to turn it here");
    }
  }

  private removeSelected(): void {
    const b = this.selected();
    if (!b || b.type === "headquarters") return;
    if (this.heldByOther(b.id)) {
      this.ui.flash("A crewmate is moving that");
      return;
    }
    if (this.commit({ kind: "remove", id: b.id })) this.select(null);
  }

  // -------------------------------------------------------------------------------------------
  // Placing and moving

  private startPlacing(type: BuildingType, event: PointerEvent): void {
    if (!this.view) return;
    this.select(null);
    this.drag = {
      kind: "place",
      building: { id: newId(), type, x: 0, y: 0, rotated: false },
      pointerId: event.pointerId,
      valid: false,
      overIsland: false,
      grab: { x: 0, y: 0 },
    };
  }

  private updateDrag(clientX: number, clientY: number): void {
    const drag = this.drag;
    if (!drag || !this.view) return;
    const ground = this.view.camera.groundPoint(
      clientX,
      clientY,
      this.stage.renderer.domElement.getBoundingClientRect(),
    );
    drag.overIsland = ground !== null && !this.ui.overBar(clientY);
    if (!ground || !drag.overIsland) {
      this.view.showPreview(null);
      return;
    }
    const corner = cornerFor(drag.building.type, drag.building.rotated, ground);
    if (drag.kind === "move") {
      const tile = tileAt(ground);
      corner.x = tile.x - drag.grab.x;
      corner.y = tile.y - drag.grab.y;
    }
    drag.building = { ...drag.building, x: corner.x, y: corner.y };
    drag.valid =
      drag.kind === "place"
        ? applyOp(this.layout, { kind: "place", building: drag.building }) !== null
        : fits(this.layout, drag.building);
    this.view.showPreview({ building: drag.building, valid: drag.valid });
  }

  private finishDrag(): void {
    const drag = this.drag;
    this.drag = null;
    this.view?.showPreview(null);
    if (!drag) return;
    if (drag.kind === "move") {
      this.client?.hold(null);
      const original = this.layout.buildings.find((b) => b.id === drag.building.id);
      const moved = original && (original.x !== drag.building.x || original.y !== drag.building.y);
      if (drag.overIsland && drag.valid && moved) {
        this.commit({
          kind: "move",
          id: drag.building.id,
          x: drag.building.x,
          y: drag.building.y,
          rotated: drag.building.rotated,
        });
      } else if (drag.overIsland && !drag.valid) {
        this.ui.flash("That doesn't fit there");
      }
      return;
    }
    if (!drag.overIsland) {
      // A tap on the build bar (or dropping back onto it): place it at the nearest free spot.
      this.placeNearCenter(drag.building);
      return;
    }
    if (drag.valid && this.commit({ kind: "place", building: drag.building }))
      this.select(drag.building.id);
    else this.ui.flash("That doesn't fit there");
  }

  private placeNearCenter(building: PlacedBuilding): void {
    if (!this.view) return;
    const focus = this.view.camera.focus;
    const start = cornerFor(building.type, false, vec(focus.x, focus.z));
    for (let radius = 0; radius < Math.max(GRID_COLUMNS, GRID_ROWS); radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const candidate = { ...building, x: start.x + dx, y: start.y + dy };
          if (this.commit({ kind: "place", building: candidate })) {
            this.select(candidate.id);
            return;
          }
        }
      }
    }
    this.ui.flash("No free space left for that");
  }

  private onDown(e: PointerEvent): void {
    if (!this.view || this.drag) return;
    this.surface.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      if (a && b) {
        this.gesture = {
          kind: "pinch",
          distance: distance(a, b),
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2,
        };
      }
      return;
    }
    const ground = this.view.camera.groundPoint(
      e.clientX,
      e.clientY,
      this.stage.renderer.domElement.getBoundingClientRect(),
    );
    const hit = ground ? buildingAtTile(this.layout, tileAt(ground)) : undefined;
    if (ground && hit && hit.id === this.selectedId && !this.heldByOther(hit.id)) {
      const tile = tileAt(ground);
      this.drag = {
        kind: "move",
        building: { ...hit },
        pointerId: e.pointerId,
        valid: true,
        overIsland: true,
        grab: { x: tile.x - hit.x, y: tile.y - hit.y },
      };
      this.client?.hold(hit.id);
      this.view.showPreview({ building: hit, valid: true });
      return;
    }
    this.gesture = {
      kind: "pending",
      startX: e.clientX,
      startY: e.clientY,
      hitId: hit?.id ?? null,
    };
  }

  private onMove(e: PointerEvent): void {
    const last = this.pointers.get(e.pointerId);
    if (!last || !this.view) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.drag?.kind === "move" && e.pointerId === this.drag.pointerId) {
      this.updateDrag(e.clientX, e.clientY);
      return;
    }
    const gesture = this.gesture;
    if (gesture?.kind === "pinch" && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const d = distance(a, b);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      if (d > 0) this.view.camera.zoom(gesture.distance / d);
      this.view.camera.pan(midX - gesture.midX, midY - gesture.midY);
      this.gesture = { kind: "pinch", distance: d, midX, midY };
      return;
    }
    if (gesture?.kind === "pending") {
      if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) < TAP_DISTANCE) return;
      this.gesture = { kind: "pan" };
    }
    if (this.gesture?.kind === "pan") this.view.camera.pan(dx, dy);
  }

  private onUp(e: PointerEvent): void {
    if (this.drag?.kind === "move" && e.pointerId === this.drag.pointerId) {
      this.pointers.delete(e.pointerId);
      this.finishDrag();
      return;
    }
    const gesture = this.gesture;
    if (gesture?.kind === "pending" && this.pointers.size === 1 && e.type === "pointerup") {
      this.select(gesture.hitId);
    }
    this.pointers.delete(e.pointerId);
    this.gesture =
      this.pointers.size === 1 ? { kind: "pan" } : this.pointers.size === 0 ? null : this.gesture;
  }
}
