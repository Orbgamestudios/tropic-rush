# The parts every building is made from, for Blender to run with no window:
#
#   blender -b -P scripts/blender/make_buildings.py -- gunTurret
#
# Everything shares one texture: a grid of materials, from scrap wood to polished steel. A part names
# the material it's made of and is cut out of that square of the texture, so a whole base draws from
# one image. The paint squares come out in the raiders' rust or the crew's blue, in a second copy of
# the image, which is all that tells the two sides' buildings apart.
#
# Blender's axes: x is forward, z is up, and y is sideways.

import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

GRID = 6
ATLAS = 1024
CELL = ATLAS // GRID
# Meters of a part that one square of the texture covers.
TILE = 2.0

MATERIALS = [
    "plank",
    "plankGrey",
    "log",
    "rope",
    "sandbag",
    "canvas",
    "tin",
    "rust",
    "plate",
    "paint",
    "paintDark",
    "paintClean",
    "steel",
    "polished",
    "brass",
    "gunmetal",
    "rubber",
    "concrete",
    "lamp",
    "glass",
    "hazard",
    "pipe",
]

PAINT = {
    "enemy": {"paint": (0.62, 0.2, 0.1), "paintDark": (0.2, 0.16, 0.15), "clean": (0.72, 0.2, 0.1)},
    "crew": {"paint": (0.14, 0.34, 0.62), "paintDark": (0.27, 0.32, 0.4), "clean": (0.12, 0.38, 0.74)},
}


def cell_of(material):
    index = MATERIALS.index(material)
    return index % GRID, index // GRID


# ---------------------------------------------------------------------------------------------
# The texture


def blotches(rng, size, scale, octaves=3):
    """Soft tiling-free noise for wear and grain, from small grids scaled up."""
    out = np.zeros((size, size))
    weight = 1.0
    total = 0.0
    for octave in range(octaves):
        cells = max(2, int(size / (scale / 2**octave)))
        grid = rng.random((cells + 2, cells + 2))
        xs = np.linspace(0, cells, size, endpoint=False)
        x0 = xs.astype(int)
        t = xs - x0
        t = t * t * (3 - 2 * t)
        top = grid[np.ix_(x0, x0)] * (1 - t)[None, :] + grid[np.ix_(x0, x0 + 1)] * t[None, :]
        low = grid[np.ix_(x0 + 1, x0)] * (1 - t)[None, :] + grid[np.ix_(x0 + 1, x0 + 1)] * t[None, :]
        out += (top * (1 - t)[:, None] + low * t[:, None]) * weight
        total += weight
        weight *= 0.5
    return out / total


def tint(base, amount):
    return np.stack([np.clip(amount * c, 0, 1) for c in base], axis=-1)


def wood(rng, size, base, boards, knots=True):
    """Boards run along u: streaky grain, dark gaps between them, each a shade of its own."""
    grain = np.tile(rng.random(size)[:, None], (1, size))
    for _ in range(3):
        grain = (grain + np.roll(grain, 1, axis=0)) / 2
    streak = blotches(rng, size, size / 3)
    light = 0.78 + grain * 0.32 + (streak - 0.5) * 0.3
    v = np.arange(size) / size
    board = (v * boards).astype(int)
    shade = rng.random(boards + 1)[board][:, None]
    light = light * (0.84 + shade * 0.26)
    gap = np.abs(((v * boards) % 1) - 0.5) > 0.46
    light = light * np.where(gap[:, None], 0.42, 1.0)
    return tint(base, light)


def corrugated(rng, size, base, ridges, rust_amount):
    v = np.arange(size) / size
    ridge = 0.8 + 0.28 * np.sin(v * math.pi * 2 * ridges)
    light = np.tile(ridge[:, None], (1, size))
    colour = tint(base, light)
    rust = np.clip((blotches(rng, size, size / 2) - (1 - rust_amount)) * 6, 0, 1)[..., None]
    return colour * (1 - rust) + tint((0.46, 0.23, 0.12), light * 1.05) * rust


def plated(rng, size, base, wear, rivets=True, brushed=False):
    colour = tint(base, 0.94 + (blotches(rng, size, size / 2) - 0.5) * 0.3)
    if brushed:
        streaks = np.tile(rng.random(size)[:, None], (1, size))
        colour = colour * (0.94 + streaks[..., None] * 0.12)
    if wear > 0:
        scuff = np.clip((blotches(rng, size, size / 5) - (1 - wear)) * 8, 0, 1)[..., None]
        colour = colour * (1 - scuff) + tint((0.34, 0.33, 0.33), 1) * scuff
    # Seams round the edge, and rivets along them.
    edge = 5
    colour[:edge, :] *= 0.55
    colour[-edge:, :] *= 0.55
    colour[:, :edge] *= 0.55
    colour[:, -edge:] *= 0.55
    if rivets:
        for a in range(10, size - 8, 24):
            for x, y in ((a, 11), (a, size - 12), (11, a), (size - 12, a)):
                colour[y - 2 : y + 3, x - 2 : x + 3] *= 1.35
                colour[y + 3 : y + 4, x - 2 : x + 3] *= 0.5
    return colour


def paint_cell(rng, name, size, side):
    colours = PAINT[side]
    if name == "plank":
        return wood(rng, size, (0.56, 0.36, 0.19), 4)
    if name == "plankGrey":
        return wood(rng, size, (0.42, 0.37, 0.31), 3)
    if name == "log":
        return wood(rng, size, (0.36, 0.25, 0.15), 1)
    if name == "rope":
        v = np.arange(size) / size
        stripe = 0.8 + 0.3 * np.sin((v * 14 + np.arange(size)[:, None] / size * 7) * math.pi * 2)
        return tint((0.66, 0.52, 0.32), stripe)
    if name == "sandbag":
        weave = (np.indices((size, size)).sum(axis=0) % 4 < 2) * 0.05 + 0.92
        return tint((0.62, 0.53, 0.37), weave + (blotches(rng, size, size / 2) - 0.5) * 0.34)
    if name == "canvas":
        return tint((0.34, 0.37, 0.22), 0.95 + (blotches(rng, size, size / 2) - 0.5) * 0.3)
    if name == "tin":
        return corrugated(rng, size, (0.56, 0.58, 0.58), 7, 0.42)
    if name == "rust":
        return corrugated(rng, size, (0.43, 0.26, 0.17), 0.1, 0.8)
    if name == "plate":
        return plated(rng, size, (0.42, 0.44, 0.46), 0.3)
    if name == "paint":
        return plated(rng, size, colours["paint"], 0.34)
    if name == "paintDark":
        return plated(rng, size, colours["paintDark"], 0.24)
    if name == "paintClean":
        return plated(rng, size, colours["clean"], 0.02, rivets=False)
    if name == "steel":
        return plated(rng, size, (0.62, 0.65, 0.68), 0.04, rivets=False, brushed=True)
    if name == "polished":
        # Painted-on shine: Lambert has no highlights of its own.
        v = np.arange(size) / size
        band = 0.8 + 0.42 * np.exp(-(((v - 0.3) / 0.14) ** 2)) + 0.14 * np.exp(-(((v - 0.8) / 0.08) ** 2))
        return tint((0.76, 0.8, 0.84), np.tile(band[:, None], (1, size)))
    if name == "brass":
        return plated(rng, size, (0.83, 0.62, 0.24), 0.04, rivets=False, brushed=True)
    if name == "gunmetal":
        return plated(rng, size, (0.13, 0.14, 0.16), 0.1, rivets=False, brushed=True)
    if name == "rubber":
        return tint((0.08, 0.08, 0.09), 1 + (blotches(rng, size, size / 3) - 0.5) * 0.3)
    if name == "concrete":
        return tint((0.55, 0.54, 0.51), 0.96 + (blotches(rng, size, size / 4, 4) - 0.5) * 0.36)
    if name == "lamp":
        return tint((1.0, 0.86, 0.5), 1.0 + np.zeros((size, size)))
    if name == "glass":
        v = np.arange(size) / size
        return tint((0.42, 0.74, 0.86), np.tile((0.8 + 0.4 * v)[:, None], (1, size)))
    if name == "hazard":
        i, j = np.indices((size, size))
        stripes = ((i + j) // 28) % 2
        out = np.zeros((size, size, 3))
        out[stripes == 0] = (0.9, 0.7, 0.12)
        out[stripes == 1] = (0.1, 0.1, 0.11)
        return out
    if name == "pipe":
        return plated(rng, size, (0.3, 0.3, 0.31), 0.5, rivets=False)
    raise ValueError(name)


def write_atlas(path, side):
    rng = np.random.default_rng(7)
    atlas = np.zeros((ATLAS, ATLAS, 3))
    for name in MATERIALS:
        cx, cy = cell_of(name)
        painted = paint_cell(rng, name, CELL, side)
        atlas[cy * CELL : (cy + 1) * CELL, cx * CELL : (cx + 1) * CELL] = np.clip(painted, 0, 1)
    pixels = np.dstack([atlas[::-1], np.ones((ATLAS, ATLAS))]).reshape(-1)
    image = bpy.data.images.new(f"atlas-{side}", ATLAS, ATLAS)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(pixels.astype(np.float32))
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    return image


# ---------------------------------------------------------------------------------------------
# Parts


class Group:
    """One piece of a building: the body, or a head that turns on its own."""

    def __init__(self, name, pivot=(0, 0, 0), seed=1, parent=None, tilt=(0, 0, 0)):
        self.name = name
        self.pivot = Vector(pivot)
        # Turned this way about its pivot: its parts are drawn as if it weren't, such as a mortar's
        # tube laid flat, and the turn tips them up.
        self.tilt = Euler(tilt, "XYZ")
        # Another group this one moves with, and named spots on it, such as where a gun's muzzle is.
        self.parent = parent
        self.points = {}
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        # The normal a corner is shaded with, where it's set: see box().
        self.shading = self.bm.verts.layers.float_vector.new("shading")
        self.rng = random.Random(seed)

    def _matrix(self, at, size, turn):
        return (
            Matrix.Translation(Vector(at) - self.pivot)
            @ Euler(turn, "XYZ").to_matrix().to_4x4()
            @ Matrix.Diagonal((*size, 1))
        )

    def _texture(self, faces, material, centre, extent, smooth, owner=None):
        """Cuts each face out of its material's square, along its longest side. With `owner`, each
        corner is cut the way the face it belongs to is, so faces can share their corners."""
        cx, cy = cell_of(material)
        span = [max(TILE, e) for e in extent]
        room = [max(0.0, 1 - min(1.0, e / TILE)) for e in extent]
        shift = [self.rng.random() * r for r in room]
        for face in faces:
            face.smooth = smooth
            for loop in face.loops:
                source = owner[loop.vert] if owner else face
                normal = [abs(c) for c in source.normal]
                flat = normal.index(max(normal))
                a, b = [axis for axis in range(3) if axis != flat]
                if extent[b] > extent[a]:
                    a, b = b, a
                co = loop.vert.co
                u = (co[a] - centre[a]) / span[a] + 0.5 * min(1, extent[a] / TILE) + shift[a]
                v = (co[b] - centre[b]) / span[b] + 0.5 * min(1, extent[b] / TILE) + shift[b]
                loop[self.uv].uv = (
                    (cx + 0.03 + min(0.94, max(0.0, u)) * 0.94) / GRID,
                    1 - (cy + 0.03 + min(0.94, max(0.0, v)) * 0.94) / GRID,
                )

    def box(self, size, at, material, turn=(0, 0, 0), chamfer=0.03, smooth=False):
        before = set(self.bm.faces)
        made = bmesh.ops.create_cube(self.bm, size=1.0, matrix=self._matrix(at, size, turn))
        verts = made["verts"]
        if chamfer > 0:
            edges = list({e for v in verts for e in v.link_edges})
            bmesh.ops.bevel(
                self.bm, geom=edges, offset=chamfer, segments=1, profile=0.5, affect="EDGES"
            )
        # A bevel rebuilds the box's own faces too, so look for everything that's new.
        faces = [f for f in self.bm.faces if f not in before]
        points = [v.co for f in faces for v in f.verts]
        low = Vector([min(p[i] for p in points) for i in range(3)])
        high = Vector([max(p[i] for p in points) for i in range(3)])
        owner = None
        if chamfer > 0:
            # Every corner of a bevelled box belongs to just one of its six sides. Shading it as
            # that side lets the sides stay flat while the bevels round off between them, and the
            # faces share their corners: a quarter of the vertices of shading each face apart.
            for face in faces:
                face.normal_update()
            axes = [Euler(turn, "XYZ").to_matrix() @ Vector(a) for a in ((1, 0, 0), (0, 1, 0), (0, 0, 1))]
            sides = [f for f in faces if max(abs(f.normal.dot(a)) for a in axes) > 0.999]
            owner = {}
            for side in sides:
                for v in side.verts:
                    owner[v] = side
                    if not smooth:
                        v[self.shading] = side.normal
            if len(owner) != len({v for f in faces for v in f.verts}):
                owner = None
        self._texture(faces, material, (low + high) / 2, high - low, smooth or owner is not None, owner)
        return self

    def cyl(self, r1, r2, height, at, material, turn=(0, 0, 0), sides=12, caps=True):
        made = bmesh.ops.create_cone(
            self.bm,
            cap_ends=caps,
            cap_tris=False,
            segments=sides,
            radius1=r1,
            radius2=r2,
            depth=height,
            matrix=self._matrix(at, (1, 1, 1), turn),
        )
        faces = list({f for v in made["verts"] for f in v.link_faces})
        cx, cy = cell_of(material)
        around = min(1.0, 2 * math.pi * max(r1, r2) / TILE)
        along = min(1.0, height / TILE)
        inverse = self._matrix(at, (1, 1, 1), turn).inverted()
        for face in faces:
            is_cap = len(face.verts) > 4
            face.smooth = not is_cap
            middle = inverse @ face.calc_center_median()
            base = math.atan2(middle.y, middle.x)
            for loop in face.loops:
                local = inverse @ loop.vert.co
                if is_cap:
                    u = 0.5 + local.x / max(TILE, 2 * max(r1, r2))
                    v = 0.5 + local.y / max(TILE, 2 * max(r1, r2))
                else:
                    angle = math.atan2(local.y, local.x)
                    if angle - base > math.pi:
                        angle -= 2 * math.pi
                    if base - angle > math.pi:
                        angle += 2 * math.pi
                    u = (angle / (2 * math.pi) + 0.5) * around
                    v = (local.z / height + 0.5) * along
                loop[self.uv].uv = (
                    (cx + 0.03 + min(0.94, max(0.0, u)) * 0.94) / GRID,
                    1 - (cy + 0.03 + min(0.94, max(0.0, v)) * 0.94) / GRID,
                )
        return self

    def bar(self, a, b, radius, material, sides=7):
        """A rod or pipe from one point to another."""
        a = Vector(a)
        b = Vector(b)
        along = b - a
        turn = along.to_track_quat("Z", "Y").to_euler("XYZ")
        return self.cyl(radius, radius, along.length, (a + b) / 2, material, tuple(turn), sides)

    def beam(self, a, b, width, depth, material):
        """A squared timber from one point to another."""
        a = Vector(a)
        b = Vector(b)
        along = b - a
        turn = along.to_track_quat("Z", "Y").to_euler("XYZ")
        return self.box((width, depth, along.length), (a + b) / 2, material, tuple(turn), 0.015)

    def bag(self, at, heading=0.0, size=(0.7, 0.36, 0.24), tilt=0.05):
        """A sandbag: a soft pillow, a little different every time."""
        r = self.rng
        grown = (
            size[0] * r.uniform(0.92, 1.08),
            size[1] * r.uniform(0.92, 1.08),
            size[2] * r.uniform(0.9, 1.1),
        )
        turn = (r.uniform(-tilt, tilt), r.uniform(-tilt, tilt), heading + r.uniform(-0.08, 0.08))
        return self.box(grown, at, "sandbag", turn, chamfer=size[2] * 0.44, smooth=True)

    def bag_ring(self, radius, rows, gap=0.9, gap_at=math.pi, base=0.14):
        """A low wall of sandbags round the middle, staggered row on row, with a way in."""
        for row in range(rows):
            count = max(6, int(2 * math.pi * radius / 0.74))
            for i in range(count):
                angle = (i + 0.5 * (row % 2)) / count * 2 * math.pi
                off = (angle - gap_at + math.pi) % (2 * math.pi) - math.pi
                if abs(off) < gap / 2 / radius:
                    continue
                r = radius - row * 0.05
                at = (r * math.cos(angle), r * math.sin(angle), base + row * 0.22)
                self.bag(at, angle + math.pi / 2)
        return self

    def planks(self, length, height, at, heading, material="plank", boards=4, sag=0.03, thick=0.05):
        """A wall of boards nailed up by hand: none of them quite straight or quite the same."""
        r = self.rng
        each = height / boards
        for i in range(boards):
            lift = -height / 2 + each * (i + 0.5)
            run = length * r.uniform(0.92, 1.06)
            turn = (r.uniform(-sag, sag), 0, heading + r.uniform(-sag, sag))
            where = (at[0], at[1], at[2] + lift)
            self.box((run, thick, each * 0.9), where, material, turn, 0.008)
        return self

    def rivets(self, points, radius=0.035):
        for p in points:
            self.cyl(radius, radius * 0.7, 0.03, p, "steel", sides=6)
        return self

    def normal_of(self, loop):
        """The normal a corner is shaded with."""
        set_to = Vector(loop.vert[self.shading])
        if set_to.length > 0.5:
            return set_to
        return loop.vert.normal if loop.face.smooth else loop.face.normal

    def build(self, parent_collection):
        mesh = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        normals = [self.normal_of(loop) for face in self.bm.faces for loop in face.loops]
        self.bm.to_mesh(mesh)
        self.bm.free()
        mesh.normals_split_custom_set(normals)
        mesh.attributes.remove(mesh.attributes["shading"])
        obj = bpy.data.objects.new(self.name, mesh)
        obj.location = self.pivot
        parent_collection.objects.link(obj)
        return obj
