# Models every stage of a building in Blender, with no window:
#
#   blender -b -P scripts/blender/make_buildings.py -- gunTurret [--sheet]
#
# Writes models-wip/buildings/<name>.glb, holding one node per stage ("s1" to "s10") with a body and,
# for defenses, a head that turns. Both sides' texture atlases go beside it. `node
# scripts/pack-buildings.mjs` then squeezes them into public/. With --sheet it also renders every
# stage side by side, to look over before the game sees them.
#
# A building keeps one design from first stage to last. Only what it's made of moves on: scrap wood
# and rope, then planks and tin, then a timber frame with riveted plate, then painted steel, then
# polished steel with lights. Defenses sit in sandbags for their first few stages.

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(__file__))
import kit  # noqa: E402
from kit import Group  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "models-wip", "buildings")
STAGES = 10


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------------------------------------
# Gun turret: a round emplacement, a column, and a twin gun with a shield, turning on top.


def turret_ground(g, s):
    if s <= 5:
        rows = [2, 3, 3, 3, 2][s - 1]
        g.bag_ring(2.0 + 0.04 * s, rows, gap=1.2, gap_at=math.pi, base=0.13)
        if s >= 3:
            # Stakes either side of the way in.
            for side in (-1, 1):
                g.bar((-2.0, side * 0.75, 0), (-2.05, side * 0.8, 0.95), 0.07, "log", 6)
    elif s == 6:
        g.cyl(2.3, 2.35, 0.2, (0, 0, 0.1), "concrete", sides=16)
        g.bag_ring(2.12, 1, gap=1.2, gap_at=math.pi, base=0.33)
    else:
        sides = 8 if s <= 8 else 16
        g.cyl(2.3, 2.4, 0.24, (0, 0, 0.12), "concrete", sides=sides)
        g.cyl(2.42, 2.42, 0.1, (0, 0, 0.05), "plate" if s <= 8 else "steel", sides=sides)
        if s >= 9:
            g.cyl(2.32, 2.32, 0.05, (0, 0, 0.26), "hazard", sides=sides, caps=False)


def drum(g, at, r=0.42, h=0.88, material="rust"):
    x, y, z = at
    g.cyl(r, r, h, (x, y, z + h / 2), material, sides=12)
    for lift in (0.2, h - 0.2):
        g.cyl(r + 0.02, r + 0.02, 0.05, (x, y, z + lift), "pipe", sides=12, caps=False)


def deck(g, size, z, material="plank", heading=0.0):
    """Boards laid side by side across the top, none quite square."""
    boards = int(size / 0.24)
    r = g.rng
    for i in range(boards):
        off = -size / 2 + (i + 0.5) * size / boards
        cx, cy = -math.sin(heading) * off, math.cos(heading) * off
        turn = (0, r.uniform(-0.02, 0.02), heading + r.uniform(-0.04, 0.04))
        g.box((size * r.uniform(0.94, 1.06), size / boards * 0.92, 0.06), (cx, cy, z), material, turn, 0.01)


def turret_base(g, s, top):
    if s <= 2:
        for i in range(3):
            a = i / 3 * 2 * math.pi + 0.5
            drum(g, (0.5 * math.cos(a), 0.5 * math.sin(a), 0), h=top - 0.48)
        deck(g, 1.7, top - 0.42)
        g.bar((0.04, 0.02, top - 0.4), (-0.02, 0.0, top), 0.14, "log", 7)
        if s == 2:
            for i in range(5):
                a = i / 5 * 2 * math.pi + 0.3
                g.box((0.9, 0.04, top - 0.6), (1.0 * math.cos(a), 1.0 * math.sin(a), (top - 0.6) / 2 + 0.06),
                      "tin", (0.04, 0, a + math.pi / 2 + g.rng.uniform(-0.1, 0.1)), 0.01)
            g.cyl(1.05, 1.05, 0.05, (0, 0, top * 0.45), "rope", sides=14, caps=False)
        # A plank left leaning on the pile.
        g.box((0.22, 0.05, 1.3), (0.6, -1.0, 0.55), "plankGrey", (0.35, 0, 0.3), 0.01)
    elif s <= 4:
        if s == 3:
            # A crib of logs, crossing course on course.
            courses = int((top - 0.3) / 0.22)
            for c in range(courses):
                z = 0.12 + c * 0.22
                for side in (-1, 1):
                    if c % 2 == 0:
                        g.bar((-0.95, side * 0.75, z), (0.95, side * 0.75, z), 0.12, "log", 7)
                    else:
                        g.bar((side * 0.75, -0.95, z), (side * 0.75, 0.95, z), 0.12, "log", 7)
            for side in (-1, 1):
                g.box((1.3, 0.04, 0.7), (0.0, side * 0.9, top * 0.5), "tin", (0.03, 0, g.rng.uniform(-0.05, 0.05)), 0.01)
        else:
            for x in (-0.75, 0.75):
                for y in (-0.75, 0.75):
                    g.beam((x, y, 0), (x * 0.94, y * 0.94, top - 0.1), 0.2, 0.2, "log")
            for x, y, heading in ((0.82, 0, 0), (-0.82, 0, 0), (0, 0.82, 1), (0, -0.82, 1)):
                along = Vector((0, 1, 0)) if heading == 0 else Vector((1, 0, 0))
                low = Vector((x, y, 0.15)) - along * 0.7
                high = Vector((x, y, top - 0.3)) + along * 0.7
                g.beam(tuple(low), tuple(high), 0.1, 0.06, "plank")
                g.beam((low.x + along.x * 1.4, low.y + along.y * 1.4, 0.15), (high.x - along.x * 1.4, high.y - along.y * 1.4, top - 0.3), 0.1, 0.06, "plank")
            # A ladder up the back.
            for side in (-1, 1):
                g.beam((-1.3, side * 0.22, 0), (-0.86, side * 0.22, top), 0.07, 0.05, "plankGrey")
            for i in range(5):
                f = (i + 0.7) / 6
                g.bar((lerp(-1.3, -0.86, f), -0.22, f * top), (lerp(-1.3, -0.86, f), 0.22, f * top), 0.025, "plank", 5)
        deck(g, 1.9, top - 0.06)
        g.cyl(0.5, 0.55, 0.12, (0, 0, top), "plankGrey", sides=10)
    elif s <= 6:
        if s == 5:
            posts = 8
            for i in range(posts):
                a = (i + 0.5) / posts * 2 * math.pi
                g.beam((1.08 * math.cos(a), 1.08 * math.sin(a), 0), (1.0 * math.cos(a), 1.0 * math.sin(a), top), 0.16, 0.16, "log")
            for z in (0.35, top - 0.1):
                g.cyl(1.1, 1.1, 0.12, (0, 0, z), "plank", sides=8, caps=False)
            # Riveted plates hung between the posts, round the lower part.
            for i in range(posts):
                a = i / posts * 2 * math.pi
                at = (1.02 * math.cos(a), 1.02 * math.sin(a), top * 0.42)
                g.box((0.78, 0.05, top * 0.62), at, "plate", (0, 0, a + math.pi / 2), 0.015)
                g.rivets([(1.06 * math.cos(a) - 0.3 * math.sin(a) * k, 1.06 * math.sin(a) + 0.3 * math.cos(a) * k, top * 0.7)
                          for k in (-1, 0, 1)])
        else:
            g.cyl(1.12, 1.02, top, (0, 0, top / 2), "plate", sides=10)
            for z in (0.18, top * 0.5, top - 0.18):
                g.rivets([(1.08 * math.cos(a / 14 * 2 * math.pi), 1.08 * math.sin(a / 14 * 2 * math.pi), z) for a in range(14)])
            g.cyl(1.14, 1.14, 0.14, (0, 0, top - 0.07), "steel", sides=10)
            g.box((0.05, 0.55, 0.75), (0.86, -0.6, 0.6), "paintDark", (0, 0, -0.62), 0.02)
        g.cyl(0.78, 0.8, 0.14, (0, 0, top), "steel", sides=16)
    else:
        sides = 8 if s <= 8 else 16
        paint = "paint" if s <= 8 else "paintClean"
        skirt = top * 0.32
        if s >= 8:
            g.cyl(1.5, 1.14, skirt, (0, 0, 0.24 + skirt / 2), "polished" if s >= 9 else paint, sides=sides)
        g.cyl(1.14, 1.08, top - 0.24, (0, 0, 0.24 + (top - 0.24) / 2), paint, sides=sides)
        g.cyl(1.2, 1.2, 0.3, (0, 0, 0.4), "paintDark", sides=sides)
        g.cyl(1.16, 1.16, 0.16, (0, 0, top - 0.08), "paintDark" if s <= 8 else "brass", sides=sides)
        # An access hatch on the forward side, and vents round the back.
        g.box((0.06, 0.6, 0.85), (1.1, -0.45, top * 0.55), "paintDark", (0, 0, -0.38), 0.02)
        for i in range(3 if s <= 8 else 5):
            a = math.pi + (i - (1 if s <= 8 else 2)) * 0.42
            g.box((0.05, 0.3, 0.38), (1.12 * math.cos(a), 1.12 * math.sin(a), top * 0.62), "gunmetal", (0, 0, a), 0.01)
        if s >= 8:
            for i in range(4):
                f = (i + 1) / 5
                g.bar((-1.18, -0.2, f * top + 0.2), (-1.18, 0.2, f * top + 0.2), 0.025, "steel", 5)
        g.cyl(0.8, 0.84, 0.14, (0, 0, top), "polished" if s >= 9 else "steel", sides=24)
        if s == 10:
            # Finished rather than added to: cooling fins down the drum, a band of light round it,
            # brass at the foot of the skirt and lights set flush in the pad.
            for i in range(16):
                a = (i + 0.5) / 16 * 2 * math.pi
                if abs(((a + math.pi) % (2 * math.pi)) - math.pi) < 0.5:
                    continue
                g.box((0.16, 0.05, top * 0.4), (1.16 * math.cos(a), 1.16 * math.sin(a), top * 0.6), "polished", (0, 0, a), 0.012)
            g.cyl(1.19, 1.19, 0.07, (0, 0, top * 0.84), "lamp", sides=sides, caps=False)
            g.cyl(1.53, 1.53, 0.08, (0, 0, 0.3), "brass", sides=sides, caps=False)
            for i in range(8):
                a = (i + 0.5) / 8 * 2 * math.pi
                g.cyl(0.09, 0.09, 0.04, (2.12 * math.cos(a), 2.12 * math.sin(a), 0.25), "lamp", sides=8)


def barrel_pair(g, s, top, length, spread, z):
    material = "pipe" if s <= 3 else "steel" if s <= 6 else "gunmetal"
    radius = 0.065 if s <= 3 else 0.075
    for i, side in enumerate((-1, 1)):
        y = side * spread
        g.points[f"muzzle{i}"] = (length + (0.2 if s >= 9 else 0.04), y, z)
        g.bar((-0.15, y, z), (length, y, z), radius, material, 8 if s >= 4 else 7)
        if s <= 2:
            for x in (0.35, 0.8):
                g.cyl(radius + 0.035, radius + 0.035, 0.07, (x, y, z), "rope", (0, math.pi / 2, 0), sides=7)
        elif s <= 6:
            g.cyl(radius + 0.03, radius + 0.03, 0.12, (length - 0.05, y, z), "steel", (0, math.pi / 2, 0), sides=8)
            if s >= 5:
                g.cyl(radius + 0.06, radius + 0.06, 0.55, (0.45, y, z), "gunmetal", (0, math.pi / 2, 0), sides=10)
        else:
            jacket = "gunmetal" if s <= 8 else "polished"
            g.cyl(radius + 0.06, radius + 0.06, length * 0.42, (length * 0.3, y, z), jacket, (0, math.pi / 2, 0), sides=12)
            for k in range(4):
                g.cyl(radius + 0.075, radius + 0.075, 0.04, (length * (0.14 + k * 0.1), y, z), "steel", (0, math.pi / 2, 0), sides=12, caps=False)
            if s >= 9:
                g.box((0.24, 0.2, 0.2), (length + 0.08, y, z), "gunmetal", chamfer=0.03)
                g.box((0.08, 0.22, 0.06), (length + 0.08, y, z), "steel", chamfer=0.01)


def turret_gun(g, guns, s, top):
    t = (s - 1) / 9
    length = lerp(1.45, 2.15, t)
    spread = lerp(0.17, 0.26, t)
    z = top + lerp(0.42, 0.62, t)
    width = lerp(0.9, 1.35, t)
    if s <= 2:
        g.box((0.95, 0.95, 0.08), (0, 0, top + 0.04), "plankGrey", (0, 0, 0.1), 0.01)
        for side in (-1, 1):
            g.box((0.75, 0.07, 0.5), (0.0, side * 0.36, top + 0.3), "plank", (0, 0.05, 0), 0.01)
        barrel_pair(guns, s, top, length, spread, z)
        if s == 1:
            g.planks(1.15, 0.72, (0.5, 0, z + 0.05), math.pi / 2, "plank", boards=3, sag=0.06, thick=0.06)
        else:
            g.box((0.05, 1.25, 0.8), (0.52, 0, z + 0.05), "tin", (0.04, -0.12, 0.03), 0.01)
            g.box((0.04, 1.0, 0.18), (0.48, 0, z + 0.48), "plankGrey", (0, 0, 0.05), 0.01)
        g.box((0.44, 0.3, 0.28), (-0.38, 0.33, top + 0.22), "plank", (0, 0, 0.2), 0.012)
        g.box((0.36, 0.26, 0.24), (-0.42, -0.3, top + 0.2), "plankGrey", (0, 0, -0.15), 0.012)
        return
    if s <= 4:
        g.cyl(0.55, 0.58, 0.1, (0, 0, top + 0.05), "plankGrey", sides=10)
        g.box((0.95, width, 0.55), (-0.05, 0, top + 0.37), "plank", chamfer=0.015)
        roof = "rust" if s == 3 else "tin"
        g.box((1.15, width + 0.15, 0.05), (-0.1, 0, top + 0.68), roof, (0, 0.12, 0.02), 0.01)
        barrel_pair(guns, s, top, length, spread, z)
        g.box((0.05, width + 0.2, 0.85), (0.5, 0, z), "tin", (0, -0.1, 0), 0.01)
        if s == 4:
            g.rivets([(0.54, y, z + dz) for y in (-0.5, -0.17, 0.17, 0.5) for dz in (-0.3, 0.32)])
            g.bar((0.1, 0.0, top + 0.68), (0.1, 0.0, top + 1.0), 0.02, "steel", 5)
        g.box((0.4, 0.3, 0.3), (-0.6, width / 2 + 0.05, top + 0.25), "plank", chamfer=0.012)
        return
    plate = "plate" if s <= 6 else "paint" if s <= 8 else "paintClean"
    trim = "steel" if s <= 6 else "paintDark" if s <= 8 else "brass"
    g.cyl(0.74, 0.74, 0.12, (0, 0, top + 0.06), trim, sides=16 if s <= 8 else 24)
    height = lerp(0.6, 0.85, t)
    g.box((1.15, width, height), (-0.12, 0, top + 0.12 + height / 2), plate, chamfer=0.04)
    # A sloped front plate over the guns' roots.
    armour = plate if s <= 8 else "polished"
    g.box((0.62, width + 0.04, 0.06), (0.52, 0, top + 0.18 + height * 0.62), armour, (0, -0.62, 0), 0.02)
    g.box((0.22, width * 0.7, 0.5), (0.5, 0, z), "gunmetal", chamfer=0.03)
    barrel_pair(guns, s, top, length, spread, z)
    if s <= 6:
        g.rivets([(0.45, y, top + 0.2) for y in (-0.45, 0, 0.45)] + [(-0.7, y, top + 0.15 + height) for y in (-0.4, 0, 0.4)])
        g.cyl(0.2, 0.2, 0.4, (-0.3, -(width / 2 + 0.16), top + 0.42), "plate", (math.pi / 2, 0, 0), sides=10)
    else:
        g.box((0.5, 0.26, 0.4), (-0.35, -(width / 2 + 0.12), top + 0.42), "paintDark" if s <= 8 else "gunmetal", chamfer=0.03)
        g.box((0.2, 0.16, 0.22), (-0.25, 0.25, top + 0.2 + height), "paintDark", chamfer=0.02)
        g.box((0.04, 0.12, 0.08), (-0.14, 0.25, top + 0.26 + height), "glass", chamfer=0.0)
    if s >= 8:
        side = width / 2 + 0.2
        g.cyl(0.04, 0.04, 0.3, (0.0, side - 0.08, top + height * 0.6), "steel", (math.pi / 2, 0, 0), sides=6)
        g.cyl(0.17, 0.15, 0.3, (0.05, side, top + height * 0.8), "steel" if s <= 8 else "polished", (0, math.pi / 2, 0), sides=12)
        g.cyl(0.14, 0.14, 0.03, (0.21, side, top + height * 0.8), "lamp", (0, math.pi / 2, 0), sides=12)
    if s >= 9:
        g.box((0.04, width + 0.06, 0.07), (0.79, 0, top + 0.2 + height * 0.42), "hazard", (0, -0.62, 0), 0.0)
        for y in (-1, 1):
            g.box((0.6, 0.05, 0.05), (-0.15, y * (width / 2 + 0.03), top + 0.12 + height), "brass", chamfer=0.01)
    if s == 10:
        g.bar((-0.6, 0.3, top + 0.12 + height), (-0.6, 0.3, top + 1.4 + height), 0.025, "steel", 6)
        g.bar((-0.45, -0.3, top + 0.12 + height), (-0.45, -0.3, top + 0.55 + height), 0.05, "steel", 8)
        # The dish turns on its own, round the top of its mast.
        dish = Group("radar", pivot=(-0.45, -0.3, top + 0.55 + height), seed=300, parent=g)
        dish.cyl(0.07, 0.07, 0.08, (-0.45, -0.3, top + 0.59 + height), "brass", sides=10)
        dish.cyl(0.42, 0.08, 0.2, (-0.38, -0.3, top + 0.72 + height), "polished", (0.0, -0.45, 0), sides=16, caps=False)
        dish.bar((-0.38, -0.3, top + 0.72 + height), (-0.12, -0.3, top + 0.84 + height), 0.02, "steel", 5)
        dish.cyl(0.05, 0.05, 0.08, (-0.12, -0.3, top + 0.84 + height), "lamp", sides=8)
        return [dish]
        for y in (-1, 1):
            g.cyl(0.07, 0.07, 0.06, (0.32, y * (width / 2 - 0.08), top + 0.14 + height), "lamp", sides=8)


def gun_turret(s):
    top = lerp(1.35, 2.6, (s - 1) / 9)
    body = Group("body", seed=s)
    head = Group("head", pivot=(0, 0, top), seed=100 + s)
    # The barrels kick back on their own when they fire.
    guns = Group("guns", pivot=(0, 0, top), seed=200 + s, parent=head)
    turret_ground(body, s)
    turret_base(body, s, top)
    extra = turret_gun(head, guns, s, top) or []
    return [body, head, guns, *extra]


BUILDINGS = {"gunTurret": gun_turret}


# ---------------------------------------------------------------------------------------------
# The crew's gunboat, and what it fires. Bow towards +x, the waterline at z = 0.

# Stern to bow: where each frame of the hull stands, its half-width, keel and gunwale.
FRAMES = [
    (-3.2, 1.12, -0.32, 1.02),
    (-2.6, 1.24, -0.46, 1.0),
    (-1.6, 1.3, -0.55, 1.0),
    (-0.4, 1.3, -0.56, 1.02),
    (0.8, 1.24, -0.52, 1.08),
    (1.8, 1.08, -0.42, 1.16),
    (2.6, 0.8, -0.22, 1.27),
    (3.25, 0.42, 0.12, 1.38),
    (3.65, 0.03, 0.62, 1.48),
]


def frame_ring(x, half, keel, top):
    """One cross-section of the hull, port gunwale round under the keel to starboard."""
    rise = top - keel
    side = [(half, top), (half * 0.99, keel + rise * 0.55), (half * 0.86, keel + rise * 0.22),
            (half * 0.5, keel + rise * 0.05)]
    ring = side + [(0.0, keel)] + [(-y, z) for y, z in reversed(side)]
    return [Vector((x, y, z)) for y, z in ring]


def hull(g):
    bm = g.bm
    rings = [[bm.verts.new(p - g.pivot) for p in frame_ring(*f)] for f in FRAMES]
    upper, lower = [], []
    for a, b in zip(rings, rings[1:]):
        for i in range(len(a) - 1):
            face = bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
            # A dark band where the hull meets the water, and the bottom below it.
            (upper if i in (0, len(a) - 2) else lower).append(face)
    transom = bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=[*upper, *lower, transom])
    bm.normal_update()
    for faces, material in ((upper, "paint"), (lower, "paintDark"), ([transom], "paint")):
        points = [v.co for f in faces for v in f.verts]
        low = Vector([min(p[i] for p in points) for i in range(3)])
        high = Vector([max(p[i] for p in points) for i in range(3)])
        g._texture(faces, material, (low + high) / 2, high - low, smooth=True)
    # The deck, planked, a hand's width under the gunwale.
    for (xa, ha, _, ta), (xb, hb, _, tb) in zip(FRAMES, FRAMES[1:]):
        if xb > 3.3:
            break
        mid = (xa + xb) / 2
        g.box((xb - xa + 0.02, (ha + hb) * 0.96, 0.08), (mid, 0, (ta + tb) / 2 - 0.08), "plank",
              (0, -math.atan2(tb - ta, xb - xa), 0), 0.0)
    # Rubbing strakes and the rail along each side.
    for side in (-1, 1):
        points = [Vector((x, side * (h + 0.02), t - 0.22)) for x, h, _, t in FRAMES[:-1]]
        for a, b in zip(points, points[1:]):
            g.bar(tuple(a), tuple(b), 0.06, "paintDark", 6)
        posts = [Vector((x, side * h * 0.94, t)) for x, h, _, t in FRAMES[1:-2]]
        for p in posts:
            g.bar(tuple(p), tuple(p + Vector((0, 0, 0.42))), 0.03, "steel", 6)
        for a, b in zip(posts, posts[1:]):
            g.bar(tuple(a + Vector((0, 0, 0.42))), tuple(b + Vector((0, 0, 0.42))), 0.035, "polished", 6)
            g.bar(tuple(a + Vector((0, 0, 0.21))), tuple(b + Vector((0, 0, 0.21))), 0.02, "steel", 5)
        # Old tyres hung over the side as fenders.
        for x in (-2.2, -0.9, 0.4):
            h = 1.3 if x < 0.5 else 1.24
            g.cyl(0.27, 0.27, 0.16, (x, side * (h + 0.1), 0.62), "rubber", (math.pi / 2, 0, 0), sides=12)
            g.cyl(0.12, 0.12, 0.17, (x, side * (h + 0.1), 0.62), "gunmetal", (math.pi / 2, 0, 0), sides=8)


def wheelhouse(g):
    deck = 0.94
    g.box((1.7, 1.75, 1.05), (-1.55, 0, deck + 0.53), "paint", chamfer=0.05)
    g.box((1.95, 2.0, 0.1), (-1.5, 0, deck + 1.1), "paintDark", chamfer=0.03)
    g.box((0.06, 1.5, 0.38), (-0.69, 0, deck + 0.74), "glass", chamfer=0.0)
    for side in (-1, 1):
        g.box((0.95, 0.06, 0.34), (-1.45, side * 0.88, deck + 0.76), "glass", chamfer=0.0)
    g.box((0.07, 0.62, 0.82), (-2.42, 0.4, deck + 0.42), "paintDark", chamfer=0.015)
    # Mast, yard, aerial and a flag; a searchlight on the roof.
    g.bar((-1.75, 0, deck + 1.15), (-1.75, 0, deck + 2.75), 0.05, "steel", 8)
    g.bar((-1.75, -0.55, deck + 2.2), (-1.75, 0.55, deck + 2.2), 0.03, "steel", 6)
    g.bar((-1.75, 0, deck + 2.75), (-1.75, 0, deck + 3.35), 0.015, "steel", 5)
    g.box((0.62, 0.03, 0.38), (-2.1, 0, deck + 2.55), "paint", (0, 0, 0.05), 0.0)
    g.cyl(0.16, 0.14, 0.26, (-1.05, 0.55, deck + 1.3), "polished", (0, math.pi / 2, 0), sides=12)
    g.cyl(0.14, 0.14, 0.03, (-0.91, 0.55, deck + 1.3), "lamp", (0, math.pi / 2, 0), sides=12)
    # The engine's stack, leaning aft.
    g.cyl(0.2, 0.17, 0.95, (-2.55, -0.45, deck + 0.95), "gunmetal", (0, -0.18, 0), sides=12)
    g.cyl(0.21, 0.21, 0.08, (-2.63, -0.45, deck + 1.42), "brass", (0, -0.18, 0), sides=12, caps=False)
    # Ammunition aft, lashed down, and a coil of rope at the bow.
    for i, (x, y) in enumerate(((-2.75, 0.55), (-2.75, 0.0))):
        g.box((0.42, 0.46, 0.32), (x, y, deck + 0.16), "plank", (0, 0, 0.04 * i), 0.012)
    for i in range(4):
        g.cyl(0.07, 0.07, 0.42, (-0.35 + i * 0.17, -0.85, deck + 0.21), "brass", sides=8)
    g.cyl(0.3, 0.3, 0.12, (2.65, 0.25, 1.24), "rope", sides=14)
    g.cyl(0.12, 0.12, 0.13, (2.65, 0.25, 1.25), "plank", sides=10)


def bow_gun(g, gun):
    """The cannon on the foredeck: a turntable, a shielded mount and a long barrel."""
    base = g.pivot.z
    x0 = g.pivot.x
    g.cyl(0.62, 0.66, 0.14, (x0, 0, base + 0.07), "steel", sides=24)
    g.cyl(0.66, 0.66, 0.05, (x0, 0, base + 0.15), "brass", sides=24, caps=False)
    g.box((0.95, 0.95, 0.55), (x0 - 0.12, 0, base + 0.42), "paint", chamfer=0.05)
    g.box((0.5, 1.15, 0.07), (x0 + 0.38, 0, base + 0.62), "paint", (0, -0.55, 0), 0.02)
    for side in (-1, 1):
        g.box((0.7, 0.06, 0.5), (x0 + 0.05, side * 0.56, base + 0.45), "paintDark", (0, 0, 0), 0.015)
    # The barrel kicks back on its own.
    z = base + 0.5
    gun.box((0.36, 0.42, 0.36), (x0 + 0.42, 0, z), "gunmetal", chamfer=0.04)
    gun.bar((x0 + 0.3, 0, z), (x0 + 2.25, 0, z), 0.12, "gunmetal", 12)
    gun.cyl(0.17, 0.17, 0.7, (x0 + 0.95, 0, z), "polished", (0, math.pi / 2, 0), sides=12)
    for k in range(3):
        gun.cyl(0.18, 0.18, 0.04, (x0 + 0.7 + k * 0.22, 0, z), "brass", (0, math.pi / 2, 0), sides=12, caps=False)
    gun.box((0.3, 0.3, 0.26), (x0 + 2.32, 0, z), "gunmetal", chamfer=0.04)
    gun.box((0.1, 0.32, 0.08), (x0 + 2.32, 0, z), "steel", chamfer=0.01)
    gun.points["muzzle0"] = (x0 + 2.55, 0, z)


def gunboat():
    boat = Group("body", seed=7)
    hull(boat)
    wheelhouse(boat)
    cannon = Group("head", pivot=(1.55, 0, 1.12), seed=8)
    guns = Group("guns", pivot=(1.55, 0, 1.12), seed=9, parent=cannon)
    bow_gun(cannon, guns)
    return [boat, cannon, guns]


def fins(g, x, radius, material):
    for k in range(4):
        a = k / 4 * 2 * math.pi + math.pi / 4
        g.box((0.26, 0.03, radius * 1.1), (x, math.cos(a) * radius * 1.05, math.sin(a) * radius * 1.05),
              material, (a - math.pi / 2, 0, 0), 0.006)


def shell():
    g = Group("body", seed=11)
    along = (0, math.pi / 2, 0)
    g.cyl(0.21, 0.21, 0.62, (-0.12, 0, 0), "paintDark", along, sides=14)
    g.cyl(0.21, 0.04, 0.46, (0.42, 0, 0), "gunmetal", along, sides=14)
    g.cyl(0.225, 0.225, 0.07, (0.12, 0, 0), "brass", along, sides=14, caps=False)
    g.cyl(0.2, 0.18, 0.12, (-0.48, 0, 0), "brass", along, sides=14)
    return [g]


def canister(stripes, cap, lamp):
    g = Group("body", seed=12)
    along = (0, math.pi / 2, 0)
    g.cyl(0.24, 0.24, 0.78, (0, 0, 0), stripes, along, sides=14)
    g.cyl(0.24, 0.14, 0.2, (0.49, 0, 0), cap, along, sides=14)
    g.cyl(0.25, 0.25, 0.1, (-0.44, 0, 0), cap, along, sides=14)
    for x in (-0.18, 0.2):
        g.cyl(0.255, 0.255, 0.05, (x, 0, 0), lamp, along, sides=14, caps=False)
    fins(g, -0.5, 0.2, cap)
    return [g]


MODELS = {
    "gunboat": lambda: [
        ("boat", gunboat()),
        ("shell", shell()),
        ("canisterShock", canister("hazard", "gunmetal", "lamp")),
        ("canisterSmoke", canister("plate", "paintDark", "lamp")),
    ],
}


def pieces(name):
    """What goes in a file: a building's ten stages, or a model's named parts."""
    if name in BUILDINGS:
        return [(f"s{n}", BUILDINGS[name](n), n) for n in range(1, STAGES + 1)]
    return [(holder, groups, 6) for holder, groups in MODELS[name]()]

# ---------------------------------------------------------------------------------------------
# Light baked in: how open each corner is to the sky, from rays cast round it.

RAYS = 40
REACH = 1.6


def hemisphere():
    out = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(RAYS):
        z = math.sqrt(1 - (i + 0.5) / RAYS)
        r = math.sqrt(1 - z * z)
        out.append(Vector((math.cos(i * golden) * r, math.sin(i * golden) * r, z)))
    return out


def bake_light(groups, stage):
    whole = bmesh.new()
    for g in groups:
        copy = g.bm.copy()
        bmesh.ops.translate(copy, verts=copy.verts, vec=g.pivot)
        mesh = bpy.data.meshes.new("scratch")
        copy.to_mesh(mesh)
        copy.free()
        whole.from_mesh(mesh)
        bpy.data.meshes.remove(mesh)
    tree = BVHTree.FromBMesh(whole)
    rays = hemisphere()
    grime = max(0.0, 1 - (stage - 1) / 6)
    for g in groups:
        g.bm.normal_update()
        layer = g.bm.loops.layers.color.new("Col")
        for face in g.bm.faces:
            for loop in face.loops:
                normal = g.normal_of(loop)
                at = loop.vert.co + g.pivot + normal * 0.012
                turn = normal.to_track_quat("Z", "Y")
                blocked = 0.0
                for ray in rays:
                    way = turn @ ray
                    hit = tree.ray_cast(at, way, REACH)
                    near = hit[3] if hit[0] is not None else REACH
                    if way.z < -0.01:
                        near = min(near, -at.z / way.z)
                    if near < REACH:
                        blocked += (1 - near / REACH) ** 0.6
                light = 1 - 0.78 * blocked / RAYS
                # Older stages are grubby towards the ground.
                light *= 1 - grime * 0.22 * max(0.0, 1 - at.z / 0.9)
                light = max(0.18, min(1.0, light))
                loop[layer] = (light, light, light, 1.0)
    whole.free()


# ---------------------------------------------------------------------------------------------


def empty_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build(name, sheet):
    os.makedirs(OUT, exist_ok=True)
    empty_scene()
    scene = bpy.context.scene
    made = []
    for title, groups, stage in pieces(name):
        bake_light(groups, stage)
        holder = bpy.data.objects.new(title, None)
        scene.collection.objects.link(holder)
        built = {}
        for g in groups:
            g.name = f"{title}_{g.name}"
            shape = g.build(scene.collection)
            shape.name = f"{g.name}_mesh"
            shape.data.color_attributes.active_color_name = "Col"
            # Each part turns about an empty at its pivot. Packing moves a mesh's own origin to
            # wherever suits the compression, so the mesh can't be what turns.
            pivot = bpy.data.objects.new(g.name, None)
            pivot.location = g.pivot
            scene.collection.objects.link(pivot)
            shape.parent = pivot
            shape.location = (0, 0, 0)
            built[g] = pivot
        for g, obj in built.items():
            if g.parent:
                obj.parent = built[g.parent]
                obj.location = g.pivot - g.parent.pivot
            else:
                obj.parent = holder
            for point, at in g.points.items():
                mark = bpy.data.objects.new(f"{title}_{point}", None)
                scene.collection.objects.link(mark)
                mark.parent = obj
                mark.location = Vector(at) - g.pivot
        made.append(holder)
        tris = 0
        for o in holder.children_recursive:
            if o.type != "MESH":
                continue
            o.data.calc_loop_triangles()
            tris += len(o.data.loop_triangles)
        print(f"PIECE {title}: {tris} triangles")
    for side in ("enemy", "crew"):
        kit.write_atlas(os.path.join(OUT, f"kit-{side}.png"), side)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, f"{name}.glb"),
        export_format="GLB",
        export_vertex_color="ACTIVE",
        export_materials="NONE",
        export_normals=True,
        export_texcoords=True,
        export_yup=True,
        export_apply=False,
    )
    if sheet:
        render_sheet(name, made, "enemy" if name in BUILDINGS else "crew")


def render_sheet(name, holders, side):
    scene = bpy.context.scene
    image = bpy.data.images.load(os.path.join(OUT, f"kit-{side}.png"))
    material = bpy.data.materials.new("kit")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    texture.interpolation = "Linear"
    colour = nodes.new("ShaderNodeVertexColor")
    colour.layer_name = "Col"
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    links.new(texture.outputs["Color"], mix.inputs[6])
    links.new(colour.outputs["Color"], mix.inputs[7])
    links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    spacing = 6.5
    for i, holder in enumerate(holders):
        holder.location = ((i % 5) * spacing, -(i // 5) * spacing * 1.05, 0)
        if side == "crew" and i > 0:
            # What the boat fires, blown up beside it.
            holder.location = (16 + (i - 1) * 4.5, -4, 1.5)
            holder.scale = (3, 3, 3)
            holder.rotation_euler = (0, -0.3, 0.6)
        for child in holder.children_recursive:
            if child.type == "MESH":
                child.data.materials.append(material)
            if child.name.endswith("head"):
                child.rotation_euler = (0, 0, -0.55)
    ground = bpy.data.meshes.new("ground")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=60)
    bm.to_mesh(ground)
    bm.free()
    floor = bpy.data.objects.new("ground", ground)
    floor.location = (13, -3, 0)
    sand = bpy.data.materials.new("sand")
    sand.use_nodes = True
    sand.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.55, 0.45, 0.3, 1)
    ground.materials.append(sand)
    scene.collection.objects.link(floor)
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 3.2
    sun.data.angle = 0.2
    sun.rotation_euler = (0.75, 0.35, 0.9)
    scene.collection.objects.link(sun)
    world = bpy.data.worlds.new("sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.7, 0.9, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    scene.world = world
    camera = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 34
    camera.location = (13, -32, 30)
    camera.rotation_euler = (math.radians(46), 0, 0)
    scene.collection.objects.link(camera)
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 900
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = os.path.join(OUT, f"{name}-sheet.png")
    bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    names = [a for a in args if not a.startswith("--")] or [*BUILDINGS, *MODELS]
    for name in names:
        build(name, "--sheet" in args)


main()
