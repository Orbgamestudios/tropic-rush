"""The owner's design as a shape in 3D, to fit a character to (docs/CHARACTERS.md).

A design drawn flat was turned into a rough model by a generator (models-wip/<who>-raw.glb). As a
model it's no use: one fused skin, painted eyes. As a mould it's good: it has the design's head,
jaw, nose, hair and beard in the round, and its colours say which is which. This reads it: its
surface, the colour at any point of it, and where its eyes, mouth, nose and chin are.

  blender -b -P scripts/blender/character_target.py -- models-wip/captain-raw.glb models-wip/look/captain-target
"""

import colorsys
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc


class Target:
    def __init__(self, path, head_only=False):
        self.head_only = head_only
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
        made = [o for o in bpy.data.objects if o not in before]
        bpy.context.view_layer.update()
        obj = max((o for o in made if o.type == "MESH"), key=lambda o: len(o.data.vertices))
        mesh = obj.data
        mesh.transform(obj.matrix_world)
        mesh.calc_loop_triangles()
        self.verts = [v.co.copy() for v in mesh.vertices]
        uv = mesh.uv_layers.active.data
        self.tris = []
        self.uvs = []
        for t in mesh.loop_triangles:
            self.tris.append(tuple(t.vertices))
            self.uvs.append(tuple(uv[i].uv.copy() for i in t.loops))
        self.tree = BVHTree.FromPolygons(self.verts, self.tris)
        image = next(
            n.image for m in mesh.materials for n in m.node_tree.nodes
            if n.type == "TEX_IMAGE" and n.image
        )
        self.image = image
        self.width, self.height = image.size
        pixels = np.empty(self.width * self.height * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        self.pixels = pixels.reshape(self.height, self.width, 4)
        for o in made:
            bpy.data.objects.remove(o)
        zs = [v.z for v in self.verts]
        self.low, self.top = min(zs), max(zs)
        self.tall = self.top - self.low
        # Its own space, until `fit` says how it lies over the character being built.
        self.scale = 1.0
        self.shift = Vector((0, 0, 0))
        self.marks = self.find_marks()

    # --- its surface and colours, in its own space ---

    def pixel(self, u, v):
        x = min(self.width - 1, max(0, int(u % 1.0 * self.width)))
        y = min(self.height - 1, max(0, int(v % 1.0 * self.height)))
        return tuple(float(c) for c in self.pixels[y, x, :3])

    def colour_at(self, location, index):
        a, b, c = (self.verts[i] for i in self.tris[index])
        w = poly_3d_calc([a, b, c], location)
        ua, ub, uc = self.uvs[index]
        return self.pixel(
            ua.x * w[0] + ub.x * w[1] + uc.x * w[2], ua.y * w[0] + ub.y * w[1] + uc.y * w[2]
        )

    def cut(self, keep):
        """The part of the design's own surface that `keep` wants, where the character is: lists
        of points, triangles, and a colour for each triangle's corners. `keep` is asked with a
        triangle's middle and its colour there."""
        points, index, tris, colours, where = [], {}, [], [], []
        for t, (a, b, c) in enumerate(self.tris):
            middle = self.here((self.verts[a] + self.verts[b] + self.verts[c]) / 3)
            ua, ub, uc = self.uvs[t]
            colour = self.pixel((ua.x + ub.x + uc.x) / 3, (ua.y + ub.y + uc.y) / 3)
            if not keep(middle, colour):
                continue
            tri = []
            for i in (a, b, c):
                if i not in index:
                    index[i] = len(points)
                    points.append(self.here(self.verts[i]))
                tri.append(index[i])
            tris.append(tri)
            colours.append(tuple(self.pixel(uv.x, uv.y) for uv in (ua, ub, uc)))
            where.append(((ua.x, ua.y), (ub.x, ub.y), (uc.x, uc.y)))
        self.cut_uvs = where
        return points, tris, colours

    def raw_ray(self, origin, direction):
        location, normal, index, _ = self.tree.ray_cast(origin, direction)
        if location is None:
            return None
        return location, normal, self.colour_at(location, index)

    def raw_nearest(self, point, reach=1e9):
        location, normal, index, distance = self.tree.find_nearest(point, reach)
        if location is None:
            return None
        return location, normal, self.colour_at(location, index), distance

    # --- the same, in the space of the character being built ---

    def fit(self, scale, shift):
        """From now on, a point p of the design is at p * scale + shift."""
        self.scale, self.shift = scale, shift

    def here(self, p):
        return p * self.scale + self.shift

    def there(self, p):
        return (p - self.shift) / self.scale

    def nearest(self, point, reach=1e9):
        hit = self.raw_nearest(self.there(point), reach / self.scale)
        if hit is None:
            return None
        location, normal, colour, distance = hit
        return self.here(location), normal, colour, distance * self.scale

    def ray(self, origin, direction):
        hit = self.raw_ray(self.there(origin), direction)
        if hit is None:
            return None
        return self.here(hit[0]), hit[1], hit[2]

    # --- what is where ---

    @staticmethod
    def skin(colour):
        h, sat, v = colorsys.rgb_to_hsv(*colour)
        return 0.02 < h < 0.075 and sat > 0.3 and v > 0.55

    @staticmethod
    def cloth(colour):
        h, sat, v = colorsys.rgb_to_hsv(*colour)
        return 0.45 < h < 0.75 and sat > 0.2

    @staticmethod
    def eye(colour):
        h, sat, v = colorsys.rgb_to_hsv(*colour)
        return sat < 0.22 or v < 0.4

    @staticmethod
    def hairy(colour):
        """Whether a colour is hair, beard or brow rather than skin, cloth or an eye."""
        h, sat, v = colorsys.rgb_to_hsv(*colour)
        return 0.064 < h < 0.17 and sat > 0.25 and v > 0.3

    def front_picture(self, step=None):
        """The head seen from the front: for each point of a grid, how deep the surface is and
        its colour. Returns (xs, zs, depth, colour) with None where there is nothing."""
        step = step or self.tall * (0.004 if self.head_only else 0.002)
        half = self.tall * (0.5 if self.head_only else 0.17)
        deep = 1.0 if self.head_only else 0.40
        xs = [(-half + i * step) for i in range(int(2 * half / step) + 1)]
        zs = [(self.top - j * step) for j in range(int(self.tall * deep / step) + 1)]
        rows = []
        for z in zs:
            row = []
            for x in xs:
                hit = self.raw_ray(Vector((x, -10, z)), Vector((0, 1, 0)))
                row.append((hit[0].y, hit[2]) if hit else None)
            rows.append(row)
        return xs, zs, rows

    def find_marks(self):
        """Where the eyes, nose, mouth and chin are, in its own space."""
        xs, zs, rows = self.front_picture()
        self.picture = (xs, zs, rows)
        step = xs[1] - xs[0]
        # The middle: the picture's widest rows are the arms; the head's own middle is the mean x
        # of its top fifth.
        heads = [(xs[i], zs[j]) for j, row in enumerate(rows) for i, c in enumerate(row)
                 if c and zs[j] > self.top - self.tall * (0.6 if self.head_only else 0.2)]
        mid = sum(x for x, _ in heads) / len(heads)
        # Pupils: the darkest points in the upper face.
        band = []
        for j, row in enumerate(rows):
            high, low_, wide = (0.6, 0.38, 0.22) if self.head_only else (0.28, 0.08, 0.1)
            if not self.top - self.tall * high < zs[j] < self.top - self.tall * low_:
                continue
            for i, c in enumerate(row):
                if c and abs(xs[i] - mid) < self.tall * wide:
                    band.append((max(c[1]), xs[i], zs[j], c[0]))
        band.sort(key=lambda b: b[0])
        dark = [(x, z, y) for _, x, z, y in band[: max(8, len(band) // 50)]]
        eyes = []
        for sign in (1, -1):
            side = [d for d in dark if (d[0] - mid) * sign > self.tall * (0.04 if self.head_only else 0.012)]
            eyes.append(Vector((
                sum(d[0] for d in side) / len(side),
                sum(d[2] for d in side) / len(side),
                sum(d[1] for d in side) / len(side),
            )))
        mid = (eyes[0].x + eyes[1].x) / 2
        eye_z = (eyes[0].z + eyes[1].z) / 2
        apart = abs(eyes[0].x - eyes[1].x)
        column = min(range(len(xs)), key=lambda i: abs(xs[i] - mid))
        profile = [(zs[j], rows[j][column][0], rows[j][column][1]) for j in range(len(zs))
                   if rows[j][column]]
        below = [p for p in profile if p[0] < eye_z]
        nose = min((p for p in below if p[0] > eye_z - apart * 0.9), key=lambda p: p[1])
        # The chin: the lowest the face goes before the surface falls back to the neck.
        face_front = min(p[1] for p in below if p[0] > eye_z - apart * 1.8)
        chin = eye_z
        for z, y, _ in below:
            if y > face_front + apart * 0.75:
                break
            chin = z
        # The mouth is in a bare patch in the beard: going down the middle from the nose, past the
        # moustache, the patch is where skin shows again, and the mouth is its reddest row.
        def tone(c):
            return colorsys.rgb_to_hsv(*c)

        skin = rows[min(range(len(zs)), key=lambda k: abs(zs[k] - (eye_z - apart * 0.3)))][
            min(range(len(xs)), key=lambda k: abs(xs[k] - eyes[0].x))
        ][1]
        self.skin = skin
        down = [j for j, z in enumerate(zs) if chin < z < nose[0] and rows[j][column]]
        state = "nose"
        patch = []
        for j in down:
            hairy = self.hairy(rows[j][column][1])
            if state == "nose" and hairy:
                state = "moustache"
            elif state == "moustache" and not hairy:
                state = "patch"
            if state == "patch":
                if hairy:
                    break
                patch.append(j)
        if not patch:
            patch = [j for j in down if zs[j] < nose[0] - apart * 0.12][: max(1, len(down) // 3)]

        def redness(j):
            h, sat, v = tone(rows[j][column][1])
            return sat * (1.2 - v) if (h < 0.06 or h > 0.95) else 0.0

        mouth_row = max(patch[: max(1, len(patch) * 2 // 3)], key=redness)
        mouth_z = zs[mouth_row]
        reach = [abs(xs[i] - mid) for i, c in enumerate(rows[mouth_row])
                 if c and abs(xs[i] - mid) < apart and not self.hairy(c[1])]
        # The patch is a little wider than the lips.
        edge = 0.0
        for r in sorted(reach):
            if r - edge > step * 2.5:
                break
            edge = r
        mouth_half = edge * 0.9
        # How big each eye is drawn: everything round the pupil that isn't skin.
        index_of = {(i, j): c for j, row in enumerate(rows) for i, c in enumerate(row) if c}
        whites = []
        for e in eyes:
            i0 = min(range(len(xs)), key=lambda k: abs(xs[k] - e.x))
            j0 = min(range(len(zs)), key=lambda k: abs(zs[k] - e.z))
            seen = {(i0, j0)}
            stack = [(i0, j0)]
            while stack:
                i, j = stack.pop()
                for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    k = (i + a, j + b)
                    c = index_of.get(k)
                    if k in seen or c is None:
                        continue
                    if abs(xs[k[0]] - e.x) > apart * 0.32 or abs(zs[k[1]] - e.z) > apart * 0.26:
                        continue
                    _, sat, v = tone(c[1])
                    if sat < 0.25 or v < 0.42:
                        seen.add(k)
                        stack.append(k)
            px = [xs[i] for i, _ in seen]
            pz = [zs[j] for _, j in seen]
            whites.append(((max(px) - min(px) + step) / 2, (max(pz) - min(pz) + step) / 2,
                           (max(px) + min(px)) / 2, (max(pz) + min(pz)) / 2))
        bridge = rows[min(range(len(zs)), key=lambda k: abs(zs[k] - eye_z))][column][0]
        # How wide the head is across the cheeks, below the ears: at the mouth's height.
        def width_at(z):
            j = min(range(len(zs)), key=lambda k: abs(zs[k] - z))
            hit = [xs[i] for i, c in enumerate(rows[j]) if c]
            return (max(hit) - min(hit)) / 2 if hit else 0.0

        marks = {
            "mid": mid,
            "eyes": eyes,
            "eye_z": eye_z,
            "apart": apart,
            "eye_half": sum(w[0] for w in whites) / 2,
            "eye_tall": sum(w[1] for w in whites) / 2,
            "nose_tip": Vector((mid, nose[1], nose[0])),
            "mouth_z": mouth_z,
            "mouth_half": mouth_half,
            "chin_z": chin,
            "face_front": face_front,
            "bridge": bridge,
            "eye_boxes": whites,
            "jaw_half": width_at(mouth_z),
            "top": self.top,
        }
        return marks

    def save_picture(self, path):
        """The front picture as an image, with what was found drawn on it."""
        xs, zs, rows = self.picture
        w, h = len(xs), len(zs)
        out = np.zeros((h, w, 4), dtype=np.float32)
        out[:, :, 3] = 1
        for j, row in enumerate(rows):
            for i, c in enumerate(row):
                out[h - 1 - j, i, :3] = c[1] if c else (0.2, 0.25, 0.3)
        m = self.marks

        def dot(x, z, colour):
            i = min(range(w), key=lambda k: abs(xs[k] - x))
            j = min(range(h), key=lambda k: abs(zs[k] - z))
            out[max(0, h - 2 - j) : h + 1 - j, max(0, i - 1) : i + 2, :3] = colour

        for e in m["eyes"]:
            dot(e.x, e.z, (0, 1, 0))
            dot(e.x - m["eye_half"], e.z, (0, 1, 1))
            dot(e.x + m["eye_half"], e.z, (0, 1, 1))
        dot(m["nose_tip"].x, m["nose_tip"].z, (1, 0, 1))
        for x in (m["mid"] - m["mouth_half"], m["mid"], m["mid"] + m["mouth_half"]):
            dot(x, m["mouth_z"], (0, 0, 1))
        dot(m["mid"], m["chin_z"], (1, 1, 0))
        dot(m["mid"] - m["jaw_half"], m["mouth_z"], (1, 0, 0))
        dot(m["mid"] + m["jaw_half"], m["mouth_z"], (1, 0, 0))
        image = bpy.data.images.new("picture", w, h)
        image.pixels.foreach_set(out.reshape(-1))
        image.filepath_raw = path
        image.file_format = "PNG"
        image.save()


class Drawing:
    """The owner's flat drawings, front and side, laid over the head: what colour the drawing has
    at any point of it. The drawing's colours are clean where the 3D design's are muddy, so this
    is what says where beard, brow and skin are, and what colour.

    Laid over by the eyes: `eyes` are the pixels of his right and left eye in the front drawing,
    `side_eye` the pixel of the front of his eye in the side one (he faces left in it). `apart`
    is how far apart the character's eyes are, and `eye_front` how far in front of their middles
    the eyes' fronts are, both in face units."""

    def __init__(self, front, side, eyes, side_eye, apart, eye_front):
        self.front = self.load(front)
        self.side = self.load(side)
        (ax, ay), (bx, by) = eyes
        self.per_unit = (bx - ax) / apart
        self.mid = (ax + bx) / 2
        self.eye_y = (ay + by) / 2
        self.side_x, self.side_y = side_eye
        self.eye_front = eye_front
        self.front_hair = self.hair_shape(self.front)
        self.side_hair = self.hair_shape(self.side)

    def hair_shape(self, picture):
        """Where a drawing has hair, beard or brow, from 0 to 1, with a clean edge: every point
        is scored, the scores are evened out over a few points' width (the drawn strokes and the
        shading go), and the edge is drawn where they cross half."""
        r, g, b = picture[:, :, 0], picture[:, :, 1], picture[:, :, 2]
        v = np.maximum(np.maximum(r, g), b)
        low = np.minimum(np.minimum(r, g), b)
        spread = v - low
        sat = np.where(v > 0, spread / np.maximum(v, 1e-6), 0)
        safe = np.maximum(spread, 1e-6)
        h = np.where(v == r, ((g - b) / safe) % 6, np.where(v == g, (b - r) / safe + 2, (r - g) / safe + 4)) / 6
        yellow = np.clip((h - 0.066) / (0.082 - 0.066), 0, 1)
        yellow = yellow * yellow * (3 - 2 * yellow)
        dark = np.clip((0.80 - v) / (0.80 - 0.68), 0, 1)
        dark = dark * dark * (3 - 2 * dark) * (h > 0.055)
        score = np.maximum(yellow, dark) * (sat >= 0.2) * (v >= 0.4) * (h > 0.02) * (h < 0.2)
        score = score.astype(np.float32)
        for _ in range(3):
            for axis in (0, 1):
                total = np.zeros_like(score)
                for shift in range(-4, 5):
                    total += np.roll(score, shift, axis=axis)
                score = total / 9
        edge = np.clip((score - 0.4) / 0.2, 0, 1)
        return edge * edge * (3 - 2 * edge)

    def cover(self, q, normal):
        """How much hair the drawings have at a point of the head, 0 to 1: the front drawing for
        what faces front, the side one for what faces sideways, the two shared out between where
        the cheek turns, so there is no seam down it."""
        y = self.eye_y - q.z * self.per_unit
        if normal.y > 0.3 and abs(normal.x) < 0.5:
            return None

        def read(shape, x):
            hh, ww = shape.shape
            xi, yi = int(round(x)), int(round(y))
            return float(shape[hh - 1 - yi, xi]) if 0 <= xi < ww and 0 <= yi < hh else 0.0

        side = max(0.0, min(1.0, (abs(normal.x) - 0.45) / 0.35)) if q.y > -0.035 else 0.0
        side = side * side * (3 - 2 * side)
        front = read(self.front_hair, self.mid + q.x * self.per_unit) if side < 1 else 0.0
        flank = read(self.side_hair, self.side_x + (q.y + self.eye_front) * self.per_unit) if side > 0 else 0.0
        return front * (1 - side) + flank * side

    @staticmethod
    def load(path):
        image = bpy.data.images.load(os.path.abspath(path))
        w, h = image.size
        pixels = np.empty(w * h * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        return pixels.reshape(h, w, 4)

    @staticmethod
    def read(picture, x, y):
        h, w, _ = picture.shape
        x, y = int(round(x)), int(round(y))
        if not (0 <= x < w and 0 <= y < h):
            return None
        return tuple(float(c) for c in picture[h - 1 - y, x, :3])

    def colour(self, q, normal):
        """The drawing's colour at a point of the head (in face units), or None where the
        drawing doesn't show it: the back, the top, or off the figure."""
        y = self.eye_y - q.z * self.per_unit
        if abs(normal.x) > 0.62 and q.y > -0.035:
            c = self.read(self.side, self.side_x + (q.y + self.eye_front) * self.per_unit, y)
        elif normal.y < 0.15:
            c = self.read(self.front, self.mid + q.x * self.per_unit, y)
        else:
            return None
        if c is None:
            return None
        h, sat, v = colorsys.rgb_to_hsv(*c)
        if sat < 0.09 and v > 0.9:
            return None
        return c

    @staticmethod
    def hairiness(colour):
        """How much a colour of the drawing looks like hair, beard or brow rather than skin, from
        0 to 1. Hair is yellower than skin; a beard is also darker, and its drawn strokes darker
        still, with hardly any yellow to them."""
        h, sat, v = colorsys.rgb_to_hsv(*colour)
        if sat < 0.2 or v < 0.4 or not 0.02 < h < 0.2:
            return 0.0
        t = max(0.0, min(1.0, (h - 0.066) / (0.082 - 0.066)))
        yellow = t * t * (3 - 2 * t)
        d = max(0.0, min(1.0, (0.80 - v) / (0.80 - 0.68)))
        dark = d * d * (3 - 2 * d) * (1.0 if h > 0.055 else 0.0)
        return max(yellow, dark)

    @staticmethod
    def kind(colour):
        """What a colour of the drawing is: "hair" (hair, beard or brow), "eye", "cloth" or "skin"."""
        h, sat, v = colorsys.rgb_to_hsv(*colour)
        if 0.45 < h < 0.75 and sat > 0.15:
            return "cloth"
        if sat < 0.2 or v < 0.45:
            return "eye"
        if 0.078 < h < 0.2 and sat > 0.25:
            return "hair"
        return "skin"


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1 :]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    target = Target(args[0])
    m = target.marks
    a = m["apart"]
    print("TARGET tall", round(target.tall, 4), "eyes apart", round(a, 4))
    print("TARGET in eye-spacings: eye half", round(m["eye_half"] / a, 3), "tall", round(m["eye_tall"] / a, 3),
          "nose tip down", round((m["eye_z"] - m["nose_tip"].z) / a, 3),
          "out", round((m["bridge"] - m["nose_tip"].y) / a, 3),
          "mouth down", round((m["eye_z"] - m["mouth_z"]) / a, 3), "half", round(m["mouth_half"] / a, 3),
          "chin down", round((m["eye_z"] - m["chin_z"]) / a, 3), "jaw half", round(m["jaw_half"] / a, 3),
          "top up", round((m["top"] - m["eye_z"]) / a, 3))
    target.save_picture(os.path.abspath(args[1]) + ".png")
    xs, zs, rows = target.picture

    def at(dx, dz):
        j = min(range(len(zs)), key=lambda k: abs(zs[k] - (m["eye_z"] + dz * a)))
        i = min(range(len(xs)), key=lambda k: abs(xs[k] - (m["mid"] + dx * a)))
        c = rows[j][i]
        if not c:
            return None
        h, sat, v = colorsys.rgb_to_hsv(*c[1])
        return tuple(round(x, 2) for x in c[1]), "hsv", round(h, 3), round(sat, 2), round(v, 2)

    for name, dx, dz in (("cheek", 0.5, -0.35), ("forehead", 0, 0.75), ("hair", 0, 1.6), ("brow", 0.5, 0.42),
                         ("beard", 0, -1.5), ("beard side", 0.8, -1.0), ("moustache", 0, -0.75),
                         ("lip", 0, (m["mouth_z"] - m["eye_z"]) / a), ("fade", 1.02, 0.5), ("shirt", 0.6, -2.3),
                         ("nose", 0, -0.3), ("ear", 1.3, -0.2)):
        print("TARGET colour", name, at(dx, dz))
