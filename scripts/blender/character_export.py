"""Writes a built character out for the game (docs/CHARACTERS.md).

The game wants one skeleton, its bones named as the heroes' are and resting with no turn in
them, and every piece of the character as its own mesh on that skeleton: each point's bones and
shares, its colour or its place on a picture, and the face's shapes as shapes the game can blend.

Blender's own exporter turns bones its own way, so this writes plain lists instead
(models-wip/built/<who>.json and .bin), and scripts/pack-character.mjs makes the model from them.

The game's space: he stands on the ground facing +x, y up, his left at -z, 2.25 tall.
"""

import json
import math
import os
import struct

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc

HEIGHT = 2.25
# How far along the hand the knuckles are, where the fingers' bones hang from.
KNUCKLES = 0.42
FINGER_NAMES = ("thumb", "index", "middle", "ring", "pinky")


class Space:
    """From the space the character is built in to the game's."""

    def __init__(self, low, top, forward):
        self.low = low
        self.scale = HEIGHT / (top - low)
        self.forward = forward

    def point(self, p):
        return ((self.forward - p.y) * self.scale, (p.z - self.low) * self.scale, -p.x * self.scale)

    def way(self, d):
        return (-d.y, d.z, -d.x)


def skeleton(frame, base, low):
    """The bones, parents first: (name, parent, where it is in the building space)."""
    J = frame.joints
    ground = Vector((0, (J["ankleL"].y + J["ankleR"].y) / 2, low))
    bones = [
        ("root", None, ground),
        ("lower", "root", ground),
        ("upper", "root", J["waist"]),
        ("head", "upper", J["neck"]),
    ]
    for tag in ("R", "L"):
        knuckle = J["wrist" + tag].lerp(J["tips" + tag], KNUCKLES)
        bones += [
            ("arm" + tag, "upper", J["shoulder" + tag]),
            ("fore" + tag, "arm" + tag, J["elbow" + tag]),
            ("hand" + tag, "fore" + tag, J["wrist" + tag]),
            ("tips" + tag, "hand" + tag, knuckle),
            ("leg" + tag, "lower", J["hip" + tag]),
            ("knee" + tag, "leg" + tag, J["knee" + tag]),
            ("foot" + tag, "knee" + tag, J["ankle" + tag]),
        ]
        for finger in FINGER_NAMES:
            for k in (1, 2, 3):
                if k > 1:
                    parent = f"{finger}{tag}{k - 1}"
                else:
                    parent = ("hand" if finger == "thumb" else "tips") + tag
                bones.append((f"{finger}{tag}{k}", parent, J[f"{finger}{tag}{k}"]))
    bones.append(("eyeL", "head", base.eyes[0]))
    bones.append(("eyeR", "head", base.eyes[1]))
    return bones


def eye_picture(path, iris, size=256):
    """An eye's colours as a picture wrapped round a ball: white, a ringed iris, a pupil, looking
    out along the ball's -y."""
    h = size // 2
    u = (np.arange(size) + 0.5) / size
    v = (np.arange(h) + 0.5) / h
    lon = (u * 2 - 1) * math.pi
    lat = (v - 0.5) * math.pi
    # The front of the eye is the middle of the picture.
    front = np.outer(np.cos(lat), np.cos(lon))
    out = np.zeros((h, size, 4), dtype=np.float32)
    out[:, :, 3] = 1
    white = np.array((0.93, 0.92, 0.9))
    stops = [
        (-1.0, white), (0.868, white), (0.875, np.array(iris) * 0.45), (0.90, np.array(iris)),
        (0.945, np.minimum(1, np.array(iris) * 1.5)), (0.952, np.array((0.02, 0.02, 0.02))),
        (1.0, np.array((0.02, 0.02, 0.02))),
    ]
    for c in range(3):
        out[:, :, c] = np.interp(front, [s[0] for s in stops], [s[1][c] for s in stops])
    image = bpy.data.images.new("eye", size, h)
    image.pixels.foreach_set(out.reshape(-1))
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()


class Writer:
    def __init__(self, who, out_dir, frame, base):
        self.who = who
        self.dir = out_dir
        os.makedirs(out_dir, exist_ok=True)
        self.base = base
        self.frame = frame
        self.blob = bytearray()
        self.pieces = []
        mesh = base.mesh
        self.skin = BVHTree.FromPolygons(
            [v.co.copy() for v in mesh.vertices], [tuple(p.vertices) for p in mesh.polygons]
        )
        self.skin_faces = [tuple(p.vertices) for p in mesh.polygons]
        self.space = None

    def stand(self, space, more=()):
        """Says where the ground is and how big he is: the bones are laid out from that, with
        any `more` after them (the hair's)."""
        self.space = space
        self.bones = skeleton(self.frame, self.base, space.low) + list(more)
        self.index = {name: i for i, (name, _, _) in enumerate(self.bones)}

    def put(self, array):
        start = len(self.blob)
        self.blob += array.tobytes()
        while len(self.blob) % 4:
            self.blob += b"\0"
        return [start, int(array.size)]

    def shares_near(self, p):
        """The bones and shares of the body's skin nearest a point: what a sleeve or a shoe goes by."""
        location, _, face, _ = self.skin.find_nearest(p)
        ids = self.skin_faces[face]
        w = poly_3d_calc([self.base.mesh.vertices[i].co for i in ids], location)
        mixed = {}
        for i, share in zip(ids, w):
            for bone, amount in self.frame.weights[i].items():
                mixed[bone] = mixed.get(bone, 0.0) + amount * share
        return mixed

    def add(self, obj, name, shares, material, keys=True, drop=(), faces=None):
        """One piece. `shares` is a bone's name (it goes wholly with that bone), "skin" (the body
        itself: each point has its own), "near" (what the skin nearest it has), or something that
        gives the bones and shares of a point from where it is."""
        deps = bpy.context.evaluated_depsgraph_get()

        def read():
            deps.update()
            shown = obj.evaluated_get(deps)
            mesh = shown.to_mesh()
            mesh.calc_loop_triangles()
            return shown, mesh

        blocks = obj.data.shape_keys.key_blocks if obj.data.shape_keys else []
        for b in blocks[1:]:
            b.value = 0.0
        shown, mesh = read()
        uv = mesh.uv_layers.active
        tone = mesh.color_attributes.get("tone")
        corner_tone = tone is not None and tone.domain == "CORNER"
        # A point of the mesh becomes one point of the model for each place on the picture it has.
        made = {}
        order = []
        tris = []
        for t in mesh.loop_triangles:
            if drop and all(vi in drop for vi in t.vertices):
                continue
            if faces and not faces(t.polygon_index):
                continue
            tri = []
            for vi, li in zip(t.vertices, t.loops):
                key = (vi, tuple(round(c, 5) for c in uv.data[li].uv)) if uv else vi
                if key not in made:
                    made[key] = len(order)
                    order.append((vi, li))
                tri.append(made[key])
            tris.append(tri)
        count = len(order)
        normals = [Vector() for _ in mesh.vertices]
        for t in mesh.loop_triangles:
            for vi in t.vertices:
                normals[vi] += t.normal * t.area
        if self.space is None:
            raise RuntimeError("Say how big he is first: Writer.space")
        # Where the piece stands counts: an eyeball is a ball about its own middle, set in place.
        world = obj.matrix_world.copy()
        position = np.array([self.space.point(world @ mesh.vertices[vi].co) for vi, _ in order], dtype=np.float32)
        normal = np.array(
            [self.space.way(normals[vi].normalized() if normals[vi].length else Vector((0, 0, 1)))
             for vi, _ in order], dtype=np.float32,
        )
        piece = {
            "name": name,
            "points": count,
            "material": material,
            "position": self.put(position),
            "normal": self.put(normal),
            "triangles": self.put(np.array(tris, dtype=np.uint32)),
        }
        if uv:
            piece["uv"] = self.put(np.array(
                [(uv.data[li].uv.x, 1 - uv.data[li].uv.y) for _, li in order], dtype=np.float32))
        if tone:
            piece["colour"] = self.put(np.array(
                [tuple(tone.data[li if corner_tone else vi].color)[:3] for vi, li in order],
                dtype=np.float32))
        joints = np.zeros((count, 4), dtype=np.uint16)
        weights = np.zeros((count, 4), dtype=np.float32)
        cache = {}
        for k, (vi, _) in enumerate(order):
            if vi not in cache:
                if shares == "skin":
                    mixed = self.frame.weights[vi]
                elif shares == "near":
                    mixed = self.shares_near(world @ mesh.vertices[vi].co)
                elif callable(shares):
                    mixed = shares(world @ mesh.vertices[vi].co)
                else:
                    mixed = {shares: 1.0}
                top = sorted(mixed.items(), key=lambda kv: -kv[1])[:4]
                total = sum(w for _, w in top)
                cache[vi] = [(self.index[b], w / total) for b, w in top]
            for slot, (bone, w) in enumerate(cache[vi]):
                joints[k, slot] = bone
                weights[k, slot] = w
        piece["joints"] = self.put(joints)
        piece["weights"] = self.put(weights)
        rest = [mesh.vertices[vi].co.copy() for vi, _ in order]
        shown.to_mesh_clear()
        shapes = []
        if keys:
            for b in blocks[1:]:
                b.value = 1.0
                shown, mesh = read()
                moved = np.array(
                    [self.space.way(mesh.vertices[vi].co - rest[k]) for k, (vi, _) in enumerate(order)],
                    dtype=np.float32,
                ) * self.space.scale
                shown.to_mesh_clear()
                b.value = 0.0
                if float(np.abs(moved).max()) > 1e-5:
                    shapes.append({"name": b.name, "move": self.put(moved)})
        piece["shapes"] = shapes
        self.pieces.append(piece)
        print("EXPORT", name, count, "points", len(tris), "triangles", len(shapes), "shapes")

    def save(self, pictures):
        bones = []
        for name, parent, at in self.bones:
            bones.append({"name": name, "parent": parent, "at": [round(c, 5) for c in self.space.point(at)]})
        with open(os.path.join(self.dir, f"{self.who}.json"), "w", encoding="utf8") as f:
            json.dump({"bones": bones, "pieces": self.pieces, "pictures": pictures}, f)
        with open(os.path.join(self.dir, f"{self.who}.bin"), "wb") as f:
            f.write(struct.pack("<I", len(self.blob)))
            f.write(self.blob)
        print("EXPORT wrote", self.who, len(self.pieces), "pieces", len(bones), "bones",
              round(len(self.blob) / 1e6, 1), "MB")


def thin(obj, triangles):
    """Brings a piece down to about so many triangles, keeping its shape and its picture."""
    obj.data.calc_loop_triangles()
    have = len(obj.data.loop_triangles)
    if have <= triangles:
        return
    mod = obj.modifiers.new("thin", "DECIMATE")
    mod.ratio = triangles / have
