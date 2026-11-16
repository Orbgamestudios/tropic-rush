"""Turns the stock ActorCore animations into clips the Captain can play (docs/ANIMATION.md).

  blender -b -P scripts/blender/convert_clips.py -- <raw folder> <captain.glb> <out folder> [stats.json]

  e.g. -- models-wip/anims/raw public/models/captain-raid.glb public/models/anims models-wip/anims/stats.json

Each stock animation is an FBX made for Unity with the Character Creator skeleton, the same bones
by the same names as the Captain's. Like the Captain's own FBX (retexture_rig.py), its skeleton
rests lying on its side: Unity's "up" is a quarter turn from Blender's, and the importer turns only
the animation to stand it up, through the root bone. So the clip can't be copied channel for
channel onto the Captain, whose skeleton was turned upright and made plain: his root has no turn
in it, and every bone would come out a quarter turn over. Instead each frame is played on the stock
skeleton and read off as where every bone points in the world, and the Captain's bones are set to
point the same way, which needs no knowledge of how either skeleton was stored. Both rigs keep the
Character Creator habit of each bone's length along its own y and the same roll, so a bone's
whole orientation carries over; the one exception is the hip, which AccuRig fits to each body (the
Captain's leans back), so it moves from his own rest by however much the stock hip moves from its.

The hip's travel is scaled by the two skeletons' leg lengths, so a stride covers ground in
proportion to his legs, and his legs are then bent where needed to keep his (big) shoes on the floor
and his planted feet where the stock actor's were. Every clip is written as an animation-only GLB of the Captain's skeleton, with keys
thinned to what an even blend between them can't reproduce, and clips.json says what each is:
how long, whether it loops, how far it travels, and when the feet land.
"""

import json
import math
import os
import shutil
import struct
import subprocess
import sys

import bpy
import numpy as np

raw_dir, captain, out_dir, *rest_args = (os.path.abspath(a) for a in sys.argv[sys.argv.index("--") + 1 :])
stats_path = rest_args[0] if rest_args else None

# What each stock animation is, worked out by playing it on the Captain (docs/ANIMATION.md has the
# pictures' findings). `cycle` cuts one clean loop out of a longer take: the stretch between two
# landings of the same foot whose two ends look most alike, while walking straight. `loop` marks a
# take made to loop, whose last frame is closed onto its first. None of the takes has a rifle in it:
# the hands hold one that isn't there, and the game puts its own in them.
CLIPS = [
    {"src": "change-pose-379001", "name": "idle", "kind": "idle", "loop": True,
     "about": "Standing at ease, weight shifting foot to foot: hands to his hips, scratches the back of his head, "
              "leans over with his hands on his knees, straightens up. An 18 s loop to idle on."},
    {"src": "sit-talk-378944", "name": "sit-talk", "kind": "sit", "loop": True,
     "about": "Sitting on a knee-high seat (nothing under him: the game gives him a crate or a step), forearms on "
              "his knees, now and then leaning back with his right arm along the seat's back, talking."},
    {"src": "walk-think-378989", "name": "walk-think", "kind": "wander",
     "about": "Pacing slowly, deep in thought: arms folded, hand to his chin, hands behind his back, stopping and "
              "turning back. Not a cycle: a 34 s take for cutscenes and the home island."},
    {"src": "walk-think-378989", "name": "walk", "kind": "walk", "cycle": {"min": 1.2, "max": 2.6},
     "about": "One stride cut from walk-think, straightened and closed into a loop: a slow, unhurried walk with "
              "his arms hanging loose, about half a normal walking pace."},
    {"src": "hold_gun_fastrun_forward_start_279410", "name": "gun-run-start", "kind": "start",
     "about": "At the ready with a rifle for about 1.6 s, then drops into a crouch and sets off into the gun run."},
    {"src": "hold_gun_fastrun_forward_loop_279387", "name": "gun-run", "kind": "run", "cycle": "whole",
     "about": "Running hunched over, a rifle held low across his body in both hands. A one-stride loop."},
    {"src": "hold_gun_fastrun_forward_end_279362", "name": "gun-run-stop", "kind": "stop",
     "about": "Out of the gun run in three strides to a stop, rising back to the ready with the rifle up."},
    {"src": "hold_gun_shooting_279354", "name": "gun-shoot", "kind": "action", "loop": True,
     "about": "At the ready, rifle at his shoulder; sinks into a braced stance and fires with recoil, then rises "
              "back to the ready. Loops."},
    {"src": "b09_hold_gun_turn90_r", "name": "gun-turn-right", "kind": "turn",
     "about": "At the ready, steps round a quarter turn to his right."},
    {"src": "c08_low_hold_gun_turn180_l", "name": "crouch-turn-left", "kind": "turn",
     "about": "Crouched low with the rifle, pivots a half turn to his left."},
    {"src": "cc02_sideshoot", "name": "crouch-shoot", "kind": "action", "loop": True,
     "about": "Kneeling on his right knee, turned side-on to his forward: brings the rifle up to his eye, fires, "
              "lowers it. Loops."},
    {"src": "e07_low_hide_wall_reload", "name": "cover-reload", "kind": "action", "loop": True,
     "about": "Kneeling on one knee behind cover, facing back the way his forward points: reloads the rifle in "
              "front of him. Loops."},
    {"src": "b083-runtoblastb", "name": "blast-fall", "kind": "reaction",
     "about": "Running, then thrown forward off his feet by a blast and left lying face down. Ends on the ground."},
]

# Kinds that travel and so get their feet's landings worked out.
LOCOMOTION = {"walk", "run", "start", "stop", "wander"}
# Keys are thinned until leaving one more out would move a bone by this much (degrees) or the hip
# by this share of his height.
TURN_TOLERANCE = 0.25
MOVE_TOLERANCE = 0.0015

# Blender is z-up and glTF y-up: a point's (x, y, z) in Blender is (x, z, -y) in glTF.
TO_GLTF = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=np.float64)


# -- The Captain's skeleton, read straight from his GLB so the clips fit it exactly. --------------

def read_glb_json(path):
    with open(path, "rb") as f:
        data = f.read()
    length = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20 : 20 + length])


def quat_to_mat(q):
    """(x, y, z, w) quaternions, any leading shape, to rotation matrices."""
    q = np.asarray(q, dtype=np.float64)
    x, y, z, w = q[..., 0], q[..., 1], q[..., 2], q[..., 3]
    m = np.empty(q.shape[:-1] + (3, 3))
    m[..., 0, 0] = 1 - 2 * (y * y + z * z)
    m[..., 0, 1] = 2 * (x * y - z * w)
    m[..., 0, 2] = 2 * (x * z + y * w)
    m[..., 1, 0] = 2 * (x * y + z * w)
    m[..., 1, 1] = 1 - 2 * (x * x + z * z)
    m[..., 1, 2] = 2 * (y * z - x * w)
    m[..., 2, 0] = 2 * (x * z - y * w)
    m[..., 2, 1] = 2 * (y * z + x * w)
    m[..., 2, 2] = 1 - 2 * (x * x + y * y)
    return m


def mat_to_quat(m):
    """Rotation matrices to (x, y, z, w) quaternions, by the largest of the four's squares."""
    m = np.asarray(m, dtype=np.float64)
    shape = m.shape[:-2]
    m = m.reshape(-1, 3, 3)
    q = np.empty((len(m), 4))
    t = np.stack([1 + m[:, 0, 0] - m[:, 1, 1] - m[:, 2, 2], 1 - m[:, 0, 0] + m[:, 1, 1] - m[:, 2, 2],
                  1 - m[:, 0, 0] - m[:, 1, 1] + m[:, 2, 2], 1 + m[:, 0, 0] + m[:, 1, 1] + m[:, 2, 2]], axis=1)
    big = np.argmax(t, axis=1)
    for k in range(4):
        sel = big == k
        if not sel.any():
            continue
        a = m[sel]
        s = np.sqrt(np.maximum(t[sel, k], 1e-12)) * 2
        if k == 0:
            q[sel] = np.stack([s / 4, (a[:, 0, 1] + a[:, 1, 0]) / s, (a[:, 0, 2] + a[:, 2, 0]) / s, (a[:, 2, 1] - a[:, 1, 2]) / s], 1)
        elif k == 1:
            q[sel] = np.stack([(a[:, 0, 1] + a[:, 1, 0]) / s, s / 4, (a[:, 1, 2] + a[:, 2, 1]) / s, (a[:, 0, 2] - a[:, 2, 0]) / s], 1)
        elif k == 2:
            q[sel] = np.stack([(a[:, 0, 2] + a[:, 2, 0]) / s, (a[:, 1, 2] + a[:, 2, 1]) / s, s / 4, (a[:, 1, 0] - a[:, 0, 1]) / s], 1)
        else:
            q[sel] = np.stack([(a[:, 2, 1] - a[:, 1, 2]) / s, (a[:, 0, 2] - a[:, 2, 0]) / s, (a[:, 1, 0] - a[:, 0, 1]) / s, s / 4], 1)
    q /= np.linalg.norm(q, axis=1, keepdims=True)
    return q.reshape(shape + (4,))


def yaw(angle):
    """A turn about the vertical (glTF y) by `angle` radians."""
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


class Skeleton:
    def __init__(self, path):
        self.gltf = read_glb_json(path)
        nodes = self.gltf["nodes"]
        self.nodes = nodes
        parent = {}
        for i, n in enumerate(nodes):
            for c in n.get("children", []):
                parent[c] = i
        self.parent_of = parent
        self.index = {n["name"]: i for i, n in enumerate(nodes)}
        self.bone_root = self.index["root"]
        self.trans = {i: np.array(n.get("translation", [0, 0, 0]), dtype=np.float64) for i, n in enumerate(nodes)}
        self.rot = {i: quat_to_mat(n.get("rotation", [0, 0, 0, 1])) for i, n in enumerate(nodes)}
        # Rest: every node's place and turn in the model's own space.
        self.rest_pos, self.rest_rot = {}, {}
        for i in range(len(nodes)):
            self._rest(i)
        # The bones below the root, parents first.
        self.bones = []

        def walk(i):
            for c in nodes[i].get("children", []):
                if nodes[c].get("mesh") is None:
                    self.bones.append(c)
                    walk(c)

        walk(self.bone_root)
        self.names = [nodes[i]["name"] for i in self.bones]

    def _rest(self, i):
        if i in self.rest_rot:
            return
        p = self.parent_of.get(i)
        if p is None:
            self.rest_rot[i], self.rest_pos[i] = self.rot[i], self.trans[i]
        else:
            self._rest(p)
            self.rest_rot[i] = self.rest_rot[p] @ self.rot[i]
            self.rest_pos[i] = self.rest_pos[p] + self.rest_rot[p] @ self.trans[i]

    def pos(self, name):
        return self.rest_pos[self.index[name]]


# -- A stock animation, read frame by frame off the skeleton Blender plays it on. -----------------

def load_take(fbx):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=fbx)
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    action = next(a for a in bpy.data.actions if "T-Pose" not in a.name)
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]
    fps = bpy.context.scene.render.fps / bpy.context.scene.render.fps_base
    first, last = (int(round(f)) for f in action.frame_range)
    names = [b.name for b in arm.data.bones]
    world = np.array(arm.matrix_world)

    def place(matrices):
        """Blender world matrices (bone to armature) as glTF turns and places, scale taken out."""
        rot = np.empty((len(matrices), 3, 3))
        pos = np.empty((len(matrices), 3))
        for k, m in enumerate(matrices):
            w = world @ np.array(m)
            r = w[:3, :3]
            r = r / np.linalg.norm(r, axis=0, keepdims=True)
            rot[k] = TO_GLTF @ r
            pos[k] = TO_GLTF @ w[:3, 3]
        return rot, pos

    rest_rot, rest_pos = place([b.matrix_local for b in arm.data.bones])
    frames = list(range(first, last + 1))
    rot = np.empty((len(frames), len(names), 3, 3))
    pos = np.empty((len(frames), len(names), 3))
    for k, f in enumerate(frames):
        bpy.context.scene.frame_set(f)
        rot[k], pos[k] = place([arm.pose.bones[n].matrix for n in names])
    return {"names": names, "fps": fps, "rot": rot, "pos": pos, "rest_rot": rest_rot, "rest_pos": rest_pos}


def upright_turn(take, skel):
    """The quarter turn that stands the stock skeleton's rest up the way the Captain's stands.

    Judged by where each bone points (towards its first child) in the two rests: lying on its side,
    nearly every bone points a quarter turn away from his.
    """
    index = {n: i for i, n in enumerate(take["names"])}

    def misfit(turn):
        total, count = 0.0, 0
        for b in skel.bones:
            kids = skel.nodes[b].get("children", [])
            name = skel.nodes[b]["name"]
            if not kids or name not in index:
                continue
            child = skel.nodes[kids[0]]["name"]
            if child not in index:
                continue
            mine = skel.rest_pos[kids[0]] - skel.rest_pos[b]
            theirs = turn @ (take["rest_pos"][index[child]] - take["rest_pos"][index[name]])
            if np.linalg.norm(mine) < 1e-4 or np.linalg.norm(theirs) < 1e-4:
                continue
            c = np.dot(mine, theirs) / np.linalg.norm(mine) / np.linalg.norm(theirs)
            total += math.degrees(math.acos(max(-1.0, min(1.0, c))))
            count += 1
        return total / count

    turns = {a: np.array([[1, 0, 0], [0, math.cos(math.radians(a)), -math.sin(math.radians(a))],
                          [0, math.sin(math.radians(a)), math.cos(math.radians(a))]]) for a in (0, 90, -90, 180)}
    scores = {a: misfit(t) for a, t in turns.items()}
    best = min(scores, key=scores.get)
    print(f"CLIPS rest lies {best} degrees about x from the Captain's (bones off by {scores[0]:.0f} deg as stored, "
          f"{scores[best]:.0f} deg turned)")
    return turns[best]


# -- Retargeting. -----------------------------------------------------------------------------

# The hip is fitted to each body by AccuRig, so it moves from his rest as the stock hip moves from
# its rest rather than taking the stock hip's whole turn (see the note at the top).
FROM_REST = {"CC_Base_Hip"}


def retarget(take, skel):
    """The Captain's bones' local turns, frame by frame, and his hip's place under the root."""
    turn = upright_turn(take, skel)
    index = {n: i for i, n in enumerate(take["names"])}
    frames = len(take["rot"])
    hip = index["CC_Base_Hip"]

    def leg(positions, names):
        a, b, c = (positions(f"CC_Base_L_{n}") for n in names)
        return np.linalg.norm(b - a) + np.linalg.norm(c - b)

    # Travel scales with the legs, not the whole body: his legs swing through the same angles as the
    # stock actor's, so a planted foot only stays put if the hip moves by his leg's length for every
    # length of theirs. His legs are shorter for his height than the stock actor's.
    names = ("Thigh", "Calf", "Foot")
    scale = leg(skel.pos, names) / leg(lambda n: take["rest_pos"][index[n]], names)
    their_rest_height = (turn @ take["rest_pos"][hip])[1]
    root = skel.bone_root
    world = {root: np.broadcast_to(skel.rest_rot[root], (frames, 3, 3))}
    local = {}
    for b in skel.bones:
        name = skel.nodes[b]["name"]
        p = skel.parent_of[b]
        if name in index:
            theirs = take["rot"][:, index[name]]
            if name in FROM_REST:
                rest = turn @ take["rest_rot"][index[name]]
                world[b] = theirs @ (rest.T @ skel.rest_rot[b])
            else:
                world[b] = theirs
        else:
            world[b] = world[p] @ skel.rot[b]
        local[b] = np.transpose(world[p], (0, 2, 1)) @ world[b]
    hip_world = take["pos"][:, hip] * scale
    # Standing tall puts his hip at his own hip's height; every drop from there is scaled like travel.
    hip_world[:, 1] = skel.pos("CC_Base_Hip")[1] + (take["pos"][:, hip, 1] - their_rest_height) * scale
    root_rot, root_pos = skel.rest_rot[root], skel.rest_pos[root]
    hip_local = (hip_world - root_pos) @ root_rot
    # Where the balls of the stock actor's feet are on the ground, scaled like the hip: a planted
    # foot is held there (see `ground`), so his feet creep no more than the stock actor's did.
    feet = {side: take["pos"][:, index[f"CC_Base_{side}_ToeBase"]] * scale for side in "LR"}
    return {"local": local, "hip": hip_local, "feet": feet, "scale": scale, "fps": take["fps"]}


def pose_world(clip, skel):
    """Where each of the Captain's bones is, frame by frame, in the model's space (for measuring)."""
    frames = len(clip["hip"])
    root = skel.bone_root
    rot = {root: np.broadcast_to(skel.rest_rot[root], (frames, 3, 3))}
    pos = {root: np.broadcast_to(skel.rest_pos[root], (frames, 3))}
    hip = skel.index["CC_Base_Hip"]
    for b in skel.bones:
        p = skel.parent_of[b]
        rot[b] = rot[p] @ clip["local"][b]
        offset = clip["hip"] if b == hip else np.broadcast_to(skel.trans[b], (frames, 3))
        pos[b] = pos[p] + np.einsum("fij,fj->fi", rot[p], offset)
    return rot, pos


# -- Keeping him out of the ground. ---------------------------------------------------------

# His height in his model's units, crown to sole, measured in models-wip/debug/rig/clips.html (the
# skeleton alone can't tell: his head is a third again bigger than a real head on his body).
HEIGHT = 0.998
# His soles, measured off his shoes at rest (in shares of his height): the back of the heel behind
# the ankle, and the shoe's tip ahead of the ball of the foot. His shoes are big for his feet, so a
# tip of the toes that clears the floor for the stock actor can put his shoe through it.
HEEL_BACK = 0.06
SHOE_TIP = 0.063
# Parts of him that meet the ground when he kneels or lies down: a bone, how far along it the
# part's middle is, and how far its surface is from that middle (shares of his height). His head
# is big for his body, a cartoon's, so it reaches the ground before the stock actor's would.
BODY = [
    ("CC_Base_L_Calf", 0, 0.035), ("CC_Base_R_Calf", 0, 0.035),
    ("CC_Base_L_Forearm", 0, 0.03), ("CC_Base_R_Forearm", 0, 0.03),
    ("CC_Base_L_Hand", 0.04, 0.025), ("CC_Base_R_Hand", 0.04, 0.025),
    ("CC_Base_Head", 0.12, 0.12), ("CC_Base_Spine02", 0.04, 0.12), ("CC_Base_Hip", 0, 0.1),
]


def smooth_lift(lift, fps):
    """A lift held a little either side of where it's needed and eased in and out, so the body
    rises into a contact rather than popping up on the frame it touches."""
    n = len(lift)
    reach = max(1, int(fps * 0.08))
    held = lift.copy()
    for k in range(1, reach + 1):
        held[k:] = np.maximum(held[k:], lift[:-k])
        held[:-k] = np.maximum(held[:-k], lift[k:])
    width = 2 * reach + 1
    padded = np.concatenate([np.full(reach, held[0]), held, np.full(reach, held[-1])])
    out = np.convolve(padded, np.ones(width) / width, mode="valid")
    return np.maximum(out[:n], lift)


def turn_between(a, b):
    """The least turn taking each direction in `a` onto the matching one in `b` (rows)."""
    a = a / np.linalg.norm(a, axis=1, keepdims=True)
    b = b / np.linalg.norm(b, axis=1, keepdims=True)
    v = np.cross(a, b)
    c = np.sum(a * b, axis=1)
    k = np.zeros((len(a), 3, 3))
    k[:, 0, 1], k[:, 0, 2], k[:, 1, 2] = -v[:, 2], v[:, 1], -v[:, 0]
    k[:, 1, 0], k[:, 2, 0], k[:, 2, 1] = v[:, 2], -v[:, 1], v[:, 0]
    return np.eye(3) + k + (k @ k) / (1 + c).clip(1e-6)[:, None, None]


def ground(clip, skel, height):
    """Lifts him where a knee, hand, head or the like would sink into the floor, then bends each leg
    so its shoe sits on the floor rather than in it (and stays where it was if the lift raised it).
    The stock actor's proportions aren't his, so its contacts come out a little off on him."""
    fps = clip["fps"]
    rot, pos = pose_world(clip, skel)
    n = len(clip["hip"])
    sink = np.zeros(n)
    for bone, along, radius in BODY:
        b = skel.index[bone]
        middle = pos[b] + rot[b][:, :, 1] * along * height
        sink = np.maximum(sink, radius * height - middle[:, 1])
    lift = smooth_lift(sink, fps)
    if lift.max() > 0:
        root_rot = skel.rest_rot[skel.bone_root]
        clip["hip"] = clip["hip"] + np.outer(lift, root_rot.T @ np.array([0.0, 1.0, 0.0]))
    report = {"lift": round(float(lift.max() / height), 4)}
    for side in "LR":
        thigh, calf, foot, toe = (skel.index[f"CC_Base_{side}_{n}"] for n in ("Thigh", "Calf", "Foot", "ToeBase"))
        ankle_rest, toe_rest = skel.rest_pos[foot], skel.rest_pos[toe]
        soles = [
            (foot, ankle_rest, np.array([ankle_rest[0], 0, ankle_rest[2] - HEEL_BACK * height])),
            (foot, ankle_rest, np.array([toe_rest[0], 0, toe_rest[2]])),
            (toe, toe_rest, np.array([toe_rest[0], 0, toe_rest[2] + SHOE_TIP * height])),
        ]
        under = np.zeros(n)
        for b, joint, point in soles:
            local = skel.rest_rot[b].T @ (point - joint)
            y = pos[b][:, 1] + np.einsum("fij,j->fi", rot[b], local)[:, 1]
            under = np.maximum(under, -y)
        raise_by = smooth_lift(under, fps)
        report[f"{side}Foot"] = round(float(raise_by.max() / height), 4)
        # While the foot is planted, its ankle goes where the stock actor's was (scaled): his legs
        # aren't theirs, so the same leg turns alone would slide his planted foot about. Eased in
        # and out over a few frames either side of the plant.
        planted, _, _ = contacts(pos, skel, side, fps, height)
        width = max(3, int(fps * 0.06)) | 1
        hold = np.convolve(np.pad(planted.astype(float), width // 2, mode="edge"), np.ones(width) / width, mode="valid")
        busy = (raise_by > 1e-6) | (lift > 1e-6) | (hold > 1e-6)
        if not busy.any():
            continue
        # The leg as it was, lifted with the body; the ankle where it was (or held), clear of the floor.
        top = pos[thigh] + lift[:, None] * [0, 1, 0]
        knee = pos[calf] + lift[:, None] * [0, 1, 0]
        ankle = pos[foot] + lift[:, None] * [0, 1, 0]
        want = pos[foot] + raise_by[:, None] * [0, 1, 0]
        # Held by the ball of the foot, which a planted foot turns about.
        off = clip["feet"][side][:, [0, 2]] - pos[toe][:, [0, 2]]
        want[:, [0, 2]] += hold[:, None] * off
        report[f"{side}Held"] = round(float(np.max(hold * np.linalg.norm(off, axis=1))) / height, 4)
        upper = np.linalg.norm(skel.trans[calf])
        lower = np.linalg.norm(skel.trans[foot])
        reach = want - top
        dist = np.linalg.norm(reach, axis=1).clip(1e-6, (upper + lower) * 0.9999)
        along = reach / np.linalg.norm(reach, axis=1, keepdims=True)
        # Which way the knee bends: as it was, off the line from hip to ankle.
        bend = (knee - top) - along * np.sum((knee - top) * along, axis=1, keepdims=True)
        forward = rot[calf][:, :, 2]
        bend += 1e-3 * (forward - along * np.sum(forward * along, axis=1, keepdims=True))
        bend /= np.linalg.norm(bend, axis=1, keepdims=True)
        cos = ((upper**2 + dist**2 - lower**2) / (2 * upper * dist)).clip(-1, 1)
        new_knee = top + along * (upper * cos)[:, None] + bend * (upper * np.sqrt(1 - cos**2))[:, None]
        new_ankle = top + along * dist[:, None]
        turn_thigh = turn_between(knee - top, new_knee - top)
        turn_calf = turn_between(np.einsum("fij,fj->fi", turn_thigh, ankle - knee), new_ankle - new_knee)
        thigh_rot = turn_thigh @ rot[thigh]
        calf_rot = turn_calf @ turn_thigh @ rot[calf]
        parent = rot[skel.parent_of[thigh]]
        new = {
            thigh: np.transpose(parent, (0, 2, 1)) @ thigh_rot,
            calf: np.transpose(thigh_rot, (0, 2, 1)) @ calf_rot,
            # The foot keeps its turn in the world, so it lands flat however the leg bent.
            foot: np.transpose(calf_rot, (0, 2, 1)) @ rot[foot],
        }
        for b, m in new.items():
            clip["local"][b] = np.where(busy[:, None, None], m, clip["local"][b])
    return report


# -- Measuring a clip. ------------------------------------------------------------------------

def angle_between(qa, qb):
    """Degrees between two sets of (x, y, z, w) turns."""
    d = np.abs(np.sum(qa * qb, axis=-1)).clip(0, 1)
    return np.degrees(2 * np.arccos(d))


def quats(clip, skel):
    return {b: mat_to_quat(clip["local"][b]) for b in skel.bones}


def contacts(pos, skel, side, fps, height):
    """Frames each foot is planted: low, and all but still."""
    foot = pos[skel.index[f"CC_Base_{side}_Foot"]]
    toe = pos[skel.index[f"CC_Base_{side}_ToeBase"]]
    rest_foot = skel.pos(f"CC_Base_{side}_Foot")[1]
    rest_toe = skel.pos(f"CC_Base_{side}_ToeBase")[1]

    def still(point):
        """Speed along the ground, in heights a second."""
        speed = np.zeros(len(point))
        speed[1:-1] = np.linalg.norm((point[2:] - point[:-2])[:, [0, 2]], axis=1) * fps / 2 / height
        speed[0], speed[-1] = speed[1], speed[-2]
        return speed

    heel_low, toe_low = foot[:, 1] - rest_foot, toe[:, 1] - rest_toe
    heel_speed, toe_speed = still(foot), still(toe)
    # A foot is down while its heel or its toe is on the ground and not moving: heel strike, then
    # the roll onto the ball, then push-off from the toe.
    heel = (heel_low < 0.03 * height) & (heel_speed < 0.35)
    ball = (toe_low < 0.03 * height) & (toe_speed < 0.35)
    planted = heel | ball
    # Close flickers of a frame or two in the middle of a plant.
    for k in range(1, len(planted) - 2):
        if not planted[k] and planted[k - 1] and (planted[k + 1] or planted[k + 2]):
            planted[k] = True
    low = np.minimum(heel_low, toe_low)
    speed = np.where(heel_low < toe_low, heel_speed, toe_speed)
    return planted, low / height, speed


def plant_drift(pos, skel, side, planted):
    """For each stretch a foot is planted, how far its ball moves along the ground in that time."""
    ball = pos[skel.index[f"CC_Base_{side}_ToeBase"]][:, [0, 2]]
    out = []
    k, n = 0, len(planted)
    while k < n:
        if planted[k]:
            end = k
            while end + 1 < n and planted[end + 1]:
                end += 1
            if end - k >= 3:
                out.append(float(np.linalg.norm(ball[end] - ball[k])))
            k = end + 1
        else:
            k += 1
    return out


def landings(planted, wraps=False):
    """Frames where a planted stretch starts (and lasts at least a few frames). In a loop, whose
    last frame is its first again, a stretch can run on round the end."""
    if wraps:
        period = len(planted) - 1
        thrice = np.concatenate([planted[:period]] * 3 + [planted[:1]])
        return sorted({k - period for k in landings(thrice) if period <= k < 2 * period})
    out = []
    k = 0
    n = len(planted)
    # A foot lifting for a frame or few mid-plant (rolling off the heel onto the ball) hasn't left
    # the ground: it's the same plant, not a new landing.
    last_end = -100
    while k < n:
        if planted[k] and (k == 0 or not planted[k - 1]):
            run = 0
            while k + run < n and planted[k + run]:
                run += 1
            if run >= 3 and k > 0 and k - last_end > 6:
                out.append(k)
            if run >= 3:
                last_end = k + run
            k += run
        else:
            k += 1
    return out


def heading(rot_hip):
    """Which way the hip faces on the ground, radians from +z (the model's forward), frame by frame."""
    fwd = rot_hip[:, :, 2]
    return np.arctan2(fwd[:, 0], fwd[:, 2])


# -- Cutting and closing loops. ----------------------------------------------------------------

def cut(clip, start, end):
    return {
        **clip,
        "local": {b: m[start : end + 1] for b, m in clip["local"].items()},
        "hip": clip["hip"][start : end + 1],
        "feet": {side: f[start : end + 1].copy() for side, f in clip["feet"].items()},
    }


def straighten(clip, skel, start_turn=None):
    """Turns a cycle about the vertical so its travel points straight ahead, and starts it at zero."""
    hip_node = skel.index["CC_Base_Hip"]
    root_rot = skel.rest_rot[skel.bone_root]
    world_hip = clip["hip"] @ root_rot.T
    travel = world_hip[-1] - world_hip[0]
    angle = math.atan2(travel[0], travel[2]) if start_turn is None else start_turn
    turn = yaw(-angle)
    # Only the hip's own turn changes: everything below it hangs off it.
    hip_world_rot = root_rot @ clip["local"][hip_node]
    clip["local"][hip_node] = root_rot.T @ (turn @ hip_world_rot)
    world_hip = world_hip @ turn.T
    start = world_hip[0, [0, 2]].copy()
    world_hip[:, [0, 2]] -= start
    clip["hip"] = world_hip @ root_rot
    for side, feet in clip["feet"].items():
        feet = feet @ turn.T
        feet[:, [0, 2]] -= start
        clip["feet"][side] = feet
    return math.degrees(angle)


def close_loop(clip, skel):
    """Spreads the difference between a cycle's last frame and its first over the cycle, so it loops
    without a pop: each bone's turn by an even share, the hip's height likewise (its travel stays)."""
    n = len(clip["hip"])
    u = np.linspace(0, 1, n)[:, None]
    worst = 0.0
    for b in skel.bones:
        q = mat_to_quat(clip["local"][b])
        q = make_continuous(q)
        a, z = q[0], q[-1]
        if np.dot(a, z) < 0:
            z = -z
        # delta = a * z^-1, applied before each frame's turn, grown from nothing to all of it.
        delta = quat_mul(a, quat_conj(z))
        worst = max(worst, math.degrees(2 * math.acos(min(1.0, abs(delta[3])))))
        part = slerp(np.broadcast_to([0, 0, 0, 1.0], (n, 4)), np.broadcast_to(delta, (n, 4)), u[:, 0])
        clip["local"][b] = quat_to_mat(quat_mul(part, q))
    root_rot = skel.rest_rot[skel.bone_root]
    world_hip = clip["hip"] @ root_rot.T
    world_hip[:, 1] += u[:, 0] * (world_hip[0, 1] - world_hip[-1, 1])
    # Sideways drift, too: a loop's travel is straight ahead.
    sideways = u[:, 0] * (world_hip[0, 0] - world_hip[-1, 0])
    world_hip[:, 0] += sideways
    clip["hip"] = world_hip @ root_rot
    for feet in clip["feet"].values():
        feet[:, 0] += sideways
    return worst


def quat_mul(a, b):
    ax, ay, az, aw = np.moveaxis(np.asarray(a, dtype=np.float64), -1, 0)
    bx, by, bz, bw = np.moveaxis(np.asarray(b, dtype=np.float64), -1, 0)
    return np.stack([aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz], axis=-1)


def quat_conj(q):
    q = np.array(q, dtype=np.float64)
    q[..., :3] *= -1
    return q


def slerp(a, b, u):
    a = np.asarray(a, dtype=np.float64)
    b = np.array(b, dtype=np.float64)
    d = np.sum(a * b, axis=-1)
    b[d < 0] *= -1
    d = np.abs(d).clip(-1, 1)
    theta = np.arccos(d)
    s = np.sin(theta)
    small = s < 1e-6
    wa = np.where(small, 1 - u, np.sin((1 - u) * theta) / np.where(small, 1, s))
    wb = np.where(small, u, np.sin(u * theta) / np.where(small, 1, s))
    out = a * wa[..., None] + b * wb[..., None]
    return out / np.linalg.norm(out, axis=-1, keepdims=True)


def make_continuous(q):
    """Flips quaternions onto the same side as the one before, so blending between keys takes the
    short way round."""
    q = q.copy()
    for k in range(1, len(q)):
        if np.dot(q[k], q[k - 1]) < 0:
            q[k] = -q[k]
    return q


def find_cycle(clip, skel, fps, height, shortest, longest):
    """The best single stride cycle: from one landing of the left foot to the next, preferring ends
    that look alike, steady straight travel, and a walking pace."""
    rot, pos = pose_world(clip, skel)
    planted, _, _ = contacts(pos, skel, "L", fps, height)
    lands = landings(planted)
    q = quats(clip, skel)
    hip = skel.index["CC_Base_Hip"]
    face = heading(rot[hip])
    ground = pos[hip][:, [0, 2]]
    best = None
    for i, s in enumerate(lands):
        for e in lands[i + 1 : i + 3]:
            seconds = (e - s) / fps
            if not shortest <= seconds <= longest:
                continue
            pose_gap = float(np.mean([angle_between(q[b][s], q[b][e]) for b in skel.bones if b != hip]))
            turn = abs(math.degrees(math.atan2(math.sin(face[e] - face[s]), math.cos(face[e] - face[s]))))
            step = np.linalg.norm(np.diff(ground[s : e + 1], axis=0), axis=1) * fps / height
            speed = float(np.mean(step))
            steadiness = float(np.std(step) / max(speed, 1e-6))
            if speed < 0.15:
                continue
            score = pose_gap + turn * 0.5 + steadiness * 10
            if best is None or score < best[0]:
                best = (score, s, e, pose_gap, turn, speed)
    if best is None:
        raise SystemExit("No clean stride cycle found")
    _, s, e, gap, turn, speed = best
    print(f"CLIPS cycle frames {s}-{e} ({(e - s) / fps:.2f} s): ends differ by {gap:.1f} deg a bone, "
          f"turns {turn:.1f} deg, {speed:.2f} heights/s")
    return s, e


# -- Writing. ---------------------------------------------------------------------------------

def thin(times, values, tolerance, rotation):
    """The keys worth keeping: Douglas-Peucker over time, so an even blend between the kept keys
    stays within `tolerance` of every key left out."""
    n = len(times)
    # A bone that never moves needs only one key.
    still = angle_between(values, np.broadcast_to(values[0], values.shape)) if rotation else np.linalg.norm(values - values[0], axis=1)
    if np.all(still < tolerance):
        return [0]
    keep = np.zeros(n, dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        u = (times[a + 1 : b] - times[a]) / (times[b] - times[a])
        if rotation:
            guess = slerp(np.broadcast_to(values[a], (len(u), 4)), np.broadcast_to(values[b], (len(u), 4)), u)
            err = angle_between(guess, values[a + 1 : b])
        else:
            guess = values[a] + (values[b] - values[a]) * u[:, None]
            err = np.linalg.norm(guess - values[a + 1 : b], axis=1)
        k = int(np.argmax(err))
        if err[k] > tolerance:
            mid = a + 1 + k
            keep[mid] = True
            stack += [(a, mid), (mid, b)]
    return list(np.nonzero(keep)[0])


def write_glb(path, name, clip, skel, height):
    fps = clip["fps"]
    n = len(clip["hip"])
    times_all = np.arange(n) / fps
    blobs = []
    accessors = []
    views = []
    offset = 0

    def add(array, kind, with_bounds=False):
        nonlocal offset
        data = np.ascontiguousarray(array, dtype=np.float32).tobytes()
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data)})
        blobs.append(data)
        offset += len(data)
        pad = (-offset) % 4
        if pad:
            blobs.append(b"\0" * pad)
            offset += pad
        acc = {"bufferView": len(views) - 1, "componentType": 5126, "count": len(array), "type": kind}
        if with_bounds:
            acc["min"] = [float(np.min(array))]
            acc["max"] = [float(np.max(array))]
        accessors.append(acc)
        return len(accessors) - 1

    time_cache = {}

    def times_for(idx):
        key = tuple(idx)
        if key not in time_cache:
            time_cache[key] = add(times_all[idx], "SCALAR", True)
        return time_cache[key]

    samplers, channels = [], []
    hip = skel.index["CC_Base_Hip"]
    for b in skel.bones:
        q = make_continuous(mat_to_quat(clip["local"][b]))
        idx = thin(times_all, q, TURN_TOLERANCE, True)
        samplers.append({"input": times_for(idx), "output": add(q[idx], "VEC4"), "interpolation": "LINEAR"})
        channels.append({"sampler": len(samplers) - 1, "target": {"node": b, "path": "rotation"}})
    idx = thin(times_all, clip["hip"], MOVE_TOLERANCE * height, False)
    samplers.append({"input": times_for(idx), "output": add(clip["hip"][idx], "VEC3"), "interpolation": "LINEAR"})
    channels.append({"sampler": len(samplers) - 1, "target": {"node": hip, "path": "translation"}})

    nodes = []
    for nd in skel.nodes:
        keep = {k: v for k, v in nd.items() if k in ("name", "translation", "rotation", "scale")}
        kids = [c for c in nd.get("children", []) if skel.nodes[c].get("mesh") is None]
        if kids:
            keep["children"] = kids
        nodes.append(keep)
    # Mesh nodes become empty placeholders, so node numbers stay the Captain's.
    gltf = {
        "asset": {"version": "2.0", "generator": "tropic-rush convert_clips.py"},
        "scene": 0,
        "scenes": [{"nodes": skel.gltf["scenes"][0]["nodes"]}],
        "nodes": nodes,
        "animations": [{"name": name, "samplers": samplers, "channels": channels}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": offset}],
    }
    body = json.dumps(gltf, separators=(",", ":")).encode()
    body += b" " * ((-len(body)) % 4)
    binary = b"".join(blobs)
    total = 12 + 8 + len(body) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(body), 0x4E4F534A) + body)
        f.write(struct.pack("<II", len(binary), 0x004E4942) + binary)
    return os.path.getsize(path)


# -- Main. ------------------------------------------------------------------------------------

def find_fbx(stem):
    for folder, _, files in os.walk(raw_dir):
        for f in files:
            if f == stem + ".fbx":
                return os.path.join(folder, f)
    raise SystemExit(f"No {stem}.fbx under {raw_dir}")


def measure(name, kind, clip, skel, height):
    fps = clip["fps"]
    n = len(clip["hip"])
    rot, pos = pose_world(clip, skel)
    hip = skel.index["CC_Base_Hip"]
    q = quats(clip, skel)
    ends_gap = float(np.max([angle_between(q[b][0], q[b][-1]) for b in skel.bones if b != hip]))
    hip_pos = pos[hip]
    rise_gap = abs(float(hip_pos[-1, 1] - hip_pos[0, 1])) / height
    travel = hip_pos[-1, [0, 2]] - hip_pos[0, [0, 2]]
    path = float(np.sum(np.linalg.norm(np.diff(hip_pos[:, [0, 2]], axis=0), axis=1)))
    face = heading(rot[hip])
    turned = math.degrees(math.atan2(math.sin(face[-1] - face[0]), math.cos(face[-1] - face[0])))
    moves = np.linalg.norm(travel) > 0.08 * height or abs(turned) > 20
    loops = ends_gap < 4 and rise_gap < 0.01 and abs(turned) < 5 and (kind in ("walk", "run") or not moves)
    reach = float(np.max(np.linalg.norm(hip_pos[:, [0, 2]] - hip_pos[0, [0, 2]], axis=1)))
    info = {
        "name": name,
        "file": f"{name}.glb",
        "kind": kind,
        "seconds": round((n - 1) / fps, 3),
        "loops": bool(loops),
        # Whether the clip carries him somewhere (or turns him) that the game should take over.
        "rootMotion": bool(moves),
        "travel": [round(float(travel[0]), 4), round(float(travel[1]), 4)],
        "turnDegrees": round(turned, 1),
        # Which way he faces as it starts, degrees from the model's forward (+z) towards +x.
        "facingDegrees": round(math.degrees(face[0]), 1),
        # How far the hip strays from where it started at any point, even in a clip that comes back.
        "reach": round(reach, 4),
        "path": round(path, 4),
    }
    if kind in ("walk", "run"):
        info["distancePerCycle"] = round(float(np.linalg.norm(travel)), 4)
        info["speed"] = round(float(np.linalg.norm(travel)) / info["seconds"], 4)
    sides = {}
    for side in "LR":
        planted, low, speed = contacts(pos, skel, side, fps, height)
        sides[side] = (planted, low, speed)
        if kind in LOCOMOTION:
            lands = landings(planted, wraps=kind in ("walk", "run"))
            info.setdefault("footfalls", {})["left" if side == "L" else "right"] = [round(k / fps, 3) for k in lands]
    # Checks: feet through the ground, feet sliding while planted, hands inside the body.
    checks = {}
    for side in "LR":
        planted, low, speed = sides[side]
        checks[f"{side}FootLowest"] = round(float(low.min()), 4)
        # How far a planted foot creeps from landing to lifting, worst plant, in shares of height.
        drift = plant_drift(pos, skel, side, planted)
        if drift:
            checks[f"{side}FootCreep"] = round(max(drift) / height, 4)
    spine = [skel.index[n] for n in ("CC_Base_Waist", "CC_Base_Spine01", "CC_Base_Spine02", "CC_Base_NeckTwist01")]
    for side in "LR":
        hand = pos[skel.index[f"CC_Base_{side}_Hand"]]
        near = min(float(np.min(np.linalg.norm(hand - pos[s], axis=1))) for s in spine)
        checks[f"{side}HandNearestSpine"] = round(near / height, 3)
    checks["endsDiffer"] = round(ends_gap, 1)
    checks["endsRise"] = round(rise_gap, 4)
    info["checks"] = checks
    info["about"] = None
    return info, rot, pos


def style_stats(name, kind, clip, skel, height, rot, pos, info):
    """Numbers for docs/ANIMATION.md: how much the body moves, in shares of his height and degrees."""
    fps = clip["fps"]
    hip = skel.index["CC_Base_Hip"]
    out = {"name": name, "kind": kind, "seconds": info["seconds"]}
    hp = pos[hip]
    out["hipHeight"] = [round(float(hp[:, 1].min() / height), 3), round(float(hp[:, 1].max() / height), 3)]
    out["hipSway"] = round(float(np.ptp(hp[:, 0]) / height), 3) if kind not in LOCOMOTION else None

    def world_range(bone):
        """How far a bone's whole orientation in the world wanders: 95th percentile of degrees from its average."""
        b = skel.index[bone]
        qq = make_continuous(mat_to_quat(rot[b]))
        mean = np.mean(qq, axis=0)
        mean /= np.linalg.norm(mean)
        return round(float(np.percentile(angle_between(qq, np.broadcast_to(mean, qq.shape)), 95)), 1)

    out["turnWander"] = {b: world_range(f"CC_Base_{b}") for b in ("Hip", "Spine02", "Head")}
    out["headVsChest"] = round(float(np.percentile(angle_between(mat_to_quat(rot[skel.index["CC_Base_Head"]]),
                                                                    mat_to_quat(rot[skel.index["CC_Base_Spine02"]])), 95)), 1)
    if kind in ("walk", "run"):
        per = info["seconds"]
        hp_y = hp[:, 1] / height
        out["bob"] = round(float(np.ptp(hp_y)), 4)
        falls = info.get("footfalls", {})
        steps = len(falls.get("left", [])) + len(falls.get("right", []))
        out["stepsPerSecond"] = round(steps / per, 2) if steps else None
        out["strideLength"] = round(info["distancePerCycle"] / height, 3)
        # Arm and thigh swing: forward of straight down (cycles are straightened to travel along +z).
        for side in "LR":
            ua = pos[skel.index[f"CC_Base_{side}_Forearm"]] - pos[skel.index[f"CC_Base_{side}_Upperarm"]]
            ang = np.degrees(np.arctan2(ua[:, 2], -ua[:, 1]))
            out[f"{side}ArmSwing"] = [round(float(ang.min()), 1), round(float(ang.max()), 1)]
            th = pos[skel.index[f"CC_Base_{side}_Calf"]] - pos[skel.index[f"CC_Base_{side}_Thigh"]]
            ang = np.degrees(np.arctan2(th[:, 2], -th[:, 1]))
            out[f"{side}ThighSwing"] = [round(float(ang.min()), 1), round(float(ang.max()), 1)]
            ft = pos[skel.index[f"CC_Base_{side}_Foot"]][:, 1] - skel.pos(f"CC_Base_{side}_Foot")[1]
            out[f"{side}FootLift"] = round(float(ft.max() / height), 3)
            planted, _, _ = contacts(pos, skel, side, fps, height)
            out[f"{side}PlantedShare"] = round(float(planted.mean()), 2)
        # Pelvis twist and tilt over the cycle, in the hip's own heading.
        face = heading(rot[hip])
        out["pelvisYaw"] = round(float(np.degrees(np.ptp(np.unwrap(face)))), 1)
        up = rot[hip][:, :, 1]
        out["pelvisRoll"] = round(float(np.degrees(np.ptp(np.arcsin(up[:, 0].clip(-1, 1))))), 1)
        sp = rot[skel.index["CC_Base_Spine02"]][:, :, 2]
        out["chestYaw"] = round(float(np.degrees(np.ptp(np.unwrap(np.arctan2(sp[:, 0], sp[:, 2]))))), 1)
        # When in the cycle the hip is lowest and highest, as shares of a step after a landing.
        lands = sorted(falls.get("left", []) + falls.get("right", []))
        if len(lands) >= 2:
            step = per / max(1, steps)
            low_t = float(np.argmin(hp_y)) / fps
            high_t = float(np.argmax(hp_y)) / fps
            out["hipLowestAfterLanding"] = round(((low_t - lands[0]) % step) / step, 2)
            out["hipHighestAfterLanding"] = round(((high_t - lands[0]) % step) / step, 2)
        # How far each part turns over a stride, peak to peak, degrees in the world (head steadiness).
        for part in ("Head", "Spine02", "Hip"):
            b = skel.index[f"CC_Base_{part}"]
            fwd = rot[b][:, :, 2]
            out[f"{part}Pitch"] = round(float(np.degrees(np.ptp(np.arcsin(fwd[:, 1].clip(-1, 1))))), 1)
    # The body's moves: stretches when it's turning its limbs and trunk, between holds.
    major = [skel.index[f"CC_Base_{n}"] for n in ("Hip", "Spine02", "Head", "L_Upperarm", "R_Upperarm", "L_Forearm",
                                                   "R_Forearm", "L_Thigh", "R_Thigh", "L_Calf", "R_Calf")]
    speed = np.zeros(len(hp))
    for b in major:
        qq = make_continuous(mat_to_quat(rot[b]))
        step_deg = angle_between(qq[1:], qq[:-1]) * fps
        speed[1:] += step_deg
    width = max(1, int(fps * 0.1))
    speed = np.convolve(speed, np.ones(width) / width, mode="same")
    every = max(1, int(fps / 10))
    out["poseSpeed10Hz"] = [int(round(x)) for x in speed[::every]]
    out["hipHeight10Hz"] = [round(float(x / height), 3) for x in hp[::every, 1]]
    if kind not in ("walk", "run"):
        threshold = max(60.0, 0.25 * float(np.percentile(speed, 95)))
        moving = speed > threshold
        moves = []
        k, n = 0, len(speed)
        while k < n:
            if moving[k]:
                end = k
                while end + 1 < n and moving[end + 1]:
                    end += 1
                if (end - k) / fps >= 0.2:
                    peak = k + int(np.argmax(speed[k : end + 1]))
                    moves.append({"at": round(k / fps, 2), "seconds": round((end - k) / fps, 2),
                                  "peakShare": round((peak - k) / max(1, end - k), 2)})
                k = end + 1
            else:
                k += 1
        out["moves"] = moves
        if moves:
            out["moveSeconds"] = round(float(np.median([m["seconds"] for m in moves])), 2)
            out["peakShare"] = round(float(np.median([m["peakShare"] for m in moves])), 2)
    # Setting off and stopping: when the hip gets going, and how long it takes to reach full speed.
    if kind in ("start", "stop", "reaction"):
        ground_speed = np.linalg.norm(np.gradient(hp[:, [0, 2]], axis=0), axis=1) * fps
        top = float(np.percentile(ground_speed, 98))
        over = np.nonzero(ground_speed > 0.2 * top)[0]
        full = np.nonzero(ground_speed > 0.9 * top)[0]
        if len(over) and len(full):
            out["goesAt"] = round(float(over[0]) / fps, 2)
            out["fullSpeedAt"] = round(float(full[0]) / fps, 2)
            out["stillAt"] = round(float(over[-1]) / fps, 2)
            out["topSpeed"] = round(top / height, 2)
    return out


def main():
    skel = Skeleton(captain)
    os.makedirs(out_dir, exist_ok=True)
    height = HEIGHT
    print(f"CLIPS Captain: hip {skel.pos('CC_Base_Hip')[1]:.3f}, head bone {skel.pos('CC_Base_Head')[1]:.3f}, {height:.3f} tall")
    takes = {}
    listing, stats = [], []
    for spec in CLIPS:
        src = spec["src"]
        if src not in takes:
            print("CLIPS reading", src)
            takes = {src: load_take(find_fbx(src))}
        take = takes[src]
        clip = retarget(take, skel)
        print(f"CLIPS {spec['name']}: {len(clip['hip'])} frames at {clip['fps']:.0f} fps, hip travel scaled by {clip['scale']:.3f}")
        cycle = spec.get("cycle")
        if cycle:
            if cycle == "whole":
                s, e = 0, len(clip["hip"]) - 1
            else:
                s, e = find_cycle(clip, skel, clip["fps"], height, cycle["min"], cycle["max"])
            clip = cut(clip, s, e)
            turned = straighten(clip, skel)
            worst = close_loop(clip, skel)
            print(f"CLIPS   straightened by {turned:.1f} deg; loop closed, the most any bone was off {worst:.1f} deg")
        elif spec.get("loop"):
            worst = close_loop(clip, skel)
            print(f"CLIPS   loop closed, the most any bone was off {worst:.1f} deg")
        grounded = ground(clip, skel, height)
        print(f"CLIPS   kept out of the floor: {grounded}")
        if cycle or spec.get("loop"):
            # Holding the feet can leave the two ends a few degrees apart again: close it once more.
            worst = close_loop(clip, skel)
            print(f"CLIPS   loop closed again after the feet, off by {worst:.1f} deg")
        info, rot, pos = measure(spec["name"], spec["kind"], clip, skel, height)
        info["about"] = spec["about"]
        info["source"] = src
        size = write_glb(os.path.join(out_dir, info["file"]), spec["name"], clip, skel, height)
        info["bytes"] = size
        print(f"CLIPS   {info['seconds']} s, loops {info['loops']}, root motion {info['rootMotion']} "
              f"travel {info['travel']} turn {info['turnDegrees']}, {size / 1000:.0f} kB, checks {info['checks']}")
        if "footfalls" in info:
            print("CLIPS   footfalls", info["footfalls"])
        listing.append(info)
        stats.append(style_stats(spec["name"], spec["kind"], clip, skel, height, rot, pos, info))
    for info in listing:
        info.pop("bytes")
    doc = {
        "about": "Stock ActorCore animations on the Captain's skeleton, made by scripts/blender/convert_clips.py. "
                 "Lengths are in the model's own units, as loaded (before the game scales him); forward is +z.",
        "height": round(height, 4),
        "fps": 60,
        "clips": listing,
    }
    listing_path = os.path.join(out_dir, "clips.json")
    with open(listing_path, "w") as f:
        json.dump(doc, f, indent=2)
        f.write("\n")
    # Laid out the way the repo's formatter wants it, so `npm run check` passes.
    npx = shutil.which("npx")
    if npx:
        subprocess.run([npx, "biome", "format", "--write", listing_path], cwd=os.path.dirname(os.path.abspath(__file__)), check=False)
    if stats_path:
        with open(stats_path, "w") as f:
            json.dump(stats, f, indent=2)
    print("CLIPS wrote", len(listing), "clips to", out_dir)


main()
