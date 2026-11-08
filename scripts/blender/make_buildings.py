# Models every stage of a building in Blender, with no window:
#
#   blender -b -P scripts/blender/make_buildings.py -- gunTurret [--sheet]
#
# Writes models-wip/buildings/<name>.glb, holding one node per stage ("s1" to "s10") with a body and,
# for defenses, a head that turns. Both sides' texture atlases go beside it. `node
# scripts/pack-buildings.mjs` then squeezes them into public/. With --sheet it also renders every
# stage side by side, to look over before the game sees them.
#
# A building keeps one design from first stage to last. Only what it's made of moves on: wood and
# rope, then planks, then a timber frame with flat plate, then painted steel, then clean paint with
# lights. Nothing is rusty or shiny, and from the first stage some of it is painted in the side's
# own colour, the crew's blue or the raiders' red. Defenses stand on the bare ground for their
# first stages, then on a concrete pad that ends up with lights set in it.

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
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
    if s == 6:
        g.cyl(2.3, 2.35, 0.2, (0, 0, 0.1), "concrete", sides=16)
    elif s >= 7:
        sides = 8 if s <= 8 else 16
        g.cyl(2.3, 2.4, 0.24, (0, 0, 0.12), "concrete", sides=sides)
        g.cyl(2.42, 2.42, 0.1, (0, 0, 0.05), "plate" if s <= 8 else "plate", sides=sides)
        if s >= 9:
            g.cyl(2.32, 2.32, 0.05, (0, 0, 0.26), "hazard", sides=sides, caps=False)
        if s == 10:
            for i in range(8):
                a = (i + 0.5) / 8 * 2 * math.pi
                g.cyl(0.09, 0.09, 0.04, (2.12 * math.cos(a), 2.12 * math.sin(a), 0.25), "lamp", sides=8)


def grow(groups, k, lift=0.0):
    """Scales parts up by k about the middle of the ground, raised by lift to stand on a pad."""
    def moved(at):
        return Vector((at[0] * k, at[1] * k, lift + (at[2] - lift) * k))

    for g in groups:
        for v in g.bm.verts:
            v.co *= k
        g.pivot = moved(g.pivot)
        g.points = {name: tuple(moved(at)) for name, at in g.points.items()}


# The defenses are drawn a size up from the rest, on pads that still fit their tiles.
GROW = 1.15
# Every look of a defense is its last look's size: only what it's made of moves on, so it never
# starts small and grows.
FULL = 1.0


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
            drum(g, (0.5 * math.cos(a), 0.5 * math.sin(a), 0), h=top - 0.48, material="paint")
        deck(g, 1.7, top - 0.42)
        g.bar((0.04, 0.02, top - 0.4), (-0.02, 0.0, top), 0.14, "log", 7)
        if s == 2:
            for i in range(5):
                a = i / 5 * 2 * math.pi + 0.3
                g.box((0.9, 0.04, top - 0.6), (1.0 * math.cos(a), 1.0 * math.sin(a), (top - 0.6) / 2 + 0.06),
                      "plate", (0.04, 0, a + math.pi / 2 + g.rng.uniform(-0.1, 0.1)), 0.01)
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
                g.box((1.3, 0.04, 0.7), (0.0, side * 0.9, top * 0.5), "paint", (0.03, 0, g.rng.uniform(-0.05, 0.05)), 0.01)
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
                g.box((0.78, 0.05, top * 0.62), at, "paint" if i % 2 else "plate", (0, 0, a + math.pi / 2), 0.015)
                g.rivets([(1.06 * math.cos(a) - 0.3 * math.sin(a) * k, 1.06 * math.sin(a) + 0.3 * math.cos(a) * k, top * 0.7)
                          for k in (-1, 0, 1)])
        else:
            g.cyl(1.12, 1.02, top, (0, 0, top / 2), "plate", sides=10)
            # A painted band round the drum.
            g.cyl(1.13, 1.11, top * 0.22, (0, 0, top * 0.72), "paint", sides=10, caps=False)
            for z in (0.18, top * 0.5, top - 0.18):
                g.rivets([(1.08 * math.cos(a / 14 * 2 * math.pi), 1.08 * math.sin(a / 14 * 2 * math.pi), z) for a in range(14)])
            g.cyl(1.14, 1.14, 0.14, (0, 0, top - 0.04), "plate", sides=10)
            g.box((0.05, 0.55, 0.75), (0.86, -0.6, 0.6), "paintDark", (0, 0, -0.62), 0.02)
        g.cyl(0.78, 0.8, 0.14, (0, 0, top), "plate", sides=16)
    else:
        sides = 8 if s <= 8 else 16
        paint = "paint" if s <= 8 else "paintClean"
        skirt = top * 0.32
        if s >= 8:
            g.cyl(1.5, 1.14, skirt, (0, 0, 0.24 + skirt / 2), paint, sides=sides)
        g.cyl(1.14, 1.08, top - 0.24, (0, 0, 0.24 + (top - 0.24) / 2), paint, sides=sides)
        g.cyl(1.2, 1.2, 0.3, (0, 0, 0.4), "paintDark", sides=sides)
        g.cyl(1.16, 1.16, 0.16, (0, 0, top - 0.05), "paintDark", sides=sides)
        # An access hatch on the forward side, and vents round the back.
        g.box((0.06, 0.6, 0.85), (1.1, -0.45, top * 0.55), "paintDark", (0, 0, -0.38), 0.02)
        for i in range(3 if s <= 8 else 5):
            a = math.pi + (i - (1 if s <= 8 else 2)) * 0.42
            g.box((0.05, 0.3, 0.38), (1.12 * math.cos(a), 1.12 * math.sin(a), top * 0.62), "gunmetal", (0, 0, a), 0.01)
        if s >= 8:
            for i in range(4):
                f = (i + 1) / 5
                g.bar((-1.18, -0.2, f * top + 0.2), (-1.18, 0.2, f * top + 0.2), 0.025, "plate", 5)
        g.cyl(0.8, 0.84, 0.14, (0, 0, top), "gunmetal" if s >= 9 else "plate", sides=24)
        if s == 10:
            # Finished rather than added to: cooling fins down the drum, a band of light round it,
            # a dark band at the foot of the skirt and lights set flush in the pad.
            for i in range(16):
                a = (i + 0.5) / 16 * 2 * math.pi
                if abs(((a + math.pi) % (2 * math.pi)) - math.pi) < 0.5:
                    continue
                g.box((0.16, 0.05, top * 0.4), (1.16 * math.cos(a), 1.16 * math.sin(a), top * 0.6), "paintDark", (0, 0, a), 0.012)
            g.cyl(1.19, 1.19, 0.07, (0, 0, top * 0.84), "lamp", sides=sides, caps=False)
            g.cyl(1.53, 1.53, 0.08, (0, 0, 0.3), "paintDark", sides=sides, caps=False)


def barrel_pair(g, s, top, length, spread, z):
    material = "pipe" if s <= 3 else "plate" if s <= 6 else "gunmetal"
    radius = 0.065 if s <= 3 else 0.075
    for i, side in enumerate((-1, 1)):
        y = side * spread
        g.points[f"muzzle{i}"] = (length + (0.2 if s >= 9 else 0.04), y, z)
        g.bar((-0.15, y, z), (length, y, z), radius, material, 8 if s >= 4 else 7)
        if s <= 2:
            for x in (0.35, 0.8):
                g.cyl(radius + 0.035, radius + 0.035, 0.07, (x, y, z), "rope", (0, math.pi / 2, 0), sides=7)
        elif s <= 6:
            g.cyl(radius + 0.03, radius + 0.03, 0.12, (length - 0.05, y, z), "plate", (0, math.pi / 2, 0), sides=8)
            if s >= 5:
                g.cyl(radius + 0.06, radius + 0.06, 0.55, (0.45, y, z), "gunmetal", (0, math.pi / 2, 0), sides=10)
        else:
            g.cyl(radius + 0.06, radius + 0.06, length * 0.42, (length * 0.3, y, z), "gunmetal", (0, math.pi / 2, 0), sides=12)
            for k in range(4):
                g.cyl(radius + 0.075, radius + 0.075, 0.04, (length * (0.14 + k * 0.1), y, z), "plate", (0, math.pi / 2, 0), sides=12, caps=False)
            if s >= 9:
                g.box((0.24, 0.2, 0.2), (length + 0.08, y, z), "gunmetal", chamfer=0.03)
                g.box((0.08, 0.22, 0.06), (length + 0.08, y, z), "plate", chamfer=0.01)


def turret_gun(g, guns, s, top):
    t = FULL
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
            g.box((0.05, 1.25, 0.8), (0.52, 0, z + 0.05), "paint", (0.04, -0.12, 0.03), 0.01)
            g.box((0.04, 1.0, 0.18), (0.48, 0, z + 0.48), "plankGrey", (0, 0, 0.05), 0.01)
        g.box((0.44, 0.3, 0.28), (-0.38, 0.33, top + 0.22), "plank", (0, 0, 0.2), 0.012)
        g.box((0.36, 0.26, 0.24), (-0.42, -0.3, top + 0.2), "plankGrey", (0, 0, -0.15), 0.012)
        return
    if s <= 4:
        g.cyl(0.55, 0.58, 0.1, (0, 0, top + 0.05), "plankGrey", sides=10)
        g.box((0.95, width, 0.55), (-0.05, 0, top + 0.37), "plank", chamfer=0.015)
        g.box((1.15, width + 0.15, 0.05), (-0.1, 0, top + 0.68), "paint", (0, 0.12, 0.02), 0.01)
        barrel_pair(guns, s, top, length, spread, z)
        g.box((0.05, width + 0.2, 0.85), (0.5, 0, z), "paint", (0, -0.1, 0), 0.01)
        if s == 4:
            g.rivets([(0.54, y, z + dz) for y in (-0.5, -0.17, 0.17, 0.5) for dz in (-0.3, 0.32)])
            g.bar((0.1, 0.0, top + 0.68), (0.1, 0.0, top + 1.0), 0.02, "plate", 5)
        g.box((0.4, 0.3, 0.3), (-0.6, width / 2 + 0.05, top + 0.25), "plank", chamfer=0.012)
        return
    plate = "paint" if s <= 8 else "paintClean"
    trim = "plate" if s <= 6 else "paintDark"
    g.cyl(0.74, 0.74, 0.12, (0, 0, top + 0.06), trim, sides=16 if s <= 8 else 24)
    height = lerp(0.6, 0.85, t)
    g.box((1.15, width, height), (-0.12, 0, top + 0.12 + height / 2), plate, chamfer=0.04)
    # A sloped front plate over the guns' roots.
    armour = plate
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
        g.cyl(0.04, 0.04, 0.3, (0.0, side - 0.08, top + height * 0.6), "plate", (math.pi / 2, 0, 0), sides=6)
        g.cyl(0.17, 0.15, 0.3, (0.05, side, top + height * 0.8), "plate" if s <= 8 else "gunmetal", (0, math.pi / 2, 0), sides=12)
        g.cyl(0.14, 0.14, 0.03, (0.21, side, top + height * 0.8), "lamp", (0, math.pi / 2, 0), sides=12)
    if s >= 9:
        g.box((0.04, width + 0.06, 0.07), (0.79, 0, top + 0.2 + height * 0.42), "hazard", (0, -0.62, 0), 0.0)
        for y in (-1, 1):
            g.box((0.6, 0.05, 0.05), (-0.15, y * (width / 2 + 0.03), top + 0.12 + height), "paintDark", chamfer=0.01)
    if s == 10:
        g.bar((-0.6, 0.3, top + 0.12 + height), (-0.6, 0.3, top + 1.4 + height), 0.025, "plate", 6)
        g.bar((-0.45, -0.3, top + 0.12 + height), (-0.45, -0.3, top + 0.55 + height), 0.05, "plate", 8)
        # The dish turns on its own, round the top of its mast.
        dish = Group("radar", pivot=(-0.45, -0.3, top + 0.55 + height), seed=300, parent=g)
        dish.cyl(0.07, 0.07, 0.08, (-0.45, -0.3, top + 0.59 + height), "gunmetal", sides=10)
        dish.cyl(0.42, 0.08, 0.2, (-0.38, -0.3, top + 0.72 + height), "plate", (0.0, -0.45, 0), sides=16, caps=False)
        dish.bar((-0.38, -0.3, top + 0.72 + height), (-0.12, -0.3, top + 0.84 + height), 0.02, "plate", 5)
        dish.cyl(0.05, 0.05, 0.08, (-0.12, -0.3, top + 0.84 + height), "lamp", sides=8)
        return [dish]
        for y in (-1, 1):
            g.cyl(0.07, 0.07, 0.06, (0.32, y * (width / 2 - 0.08), top + 0.14 + height), "lamp", sides=8)


def gun_turret(s):
    top = lerp(1.35, 2.6, FULL)
    body = Group("body", seed=s)
    head = Group("head", pivot=(0, 0, top), seed=100 + s)
    # The barrels kick back on their own when they fire.
    guns = Group("guns", pivot=(0, 0, top), seed=200 + s, parent=head)
    turret_base(body, s, top)
    extra = turret_gun(head, guns, s, top) or []
    parts = [body, head, guns, *extra]
    grow(parts, GROW, 0.24 if s >= 7 else 0.0)
    turret_ground(body, s)
    return parts


# ---------------------------------------------------------------------------------------------
# Mortar: a low emplacement, and a stubby tube on a turning mount, tipped up towards its target.

MORTAR_PITCH = 0.95


def mortar_base(g, s, top):
    if s <= 2:
        for y in (-0.55, 0.55):
            g.bar((-0.9, y, 0.1), (0.9, y, 0.1), 0.12, "log", 7)
        deck(g, 1.9, top - 0.03, "plank" if s == 1 else "plankGrey")
        if s == 2:
            g.box((1.7, 1.7, 0.03), (0, 0, top + 0.005), "paint", (0, 0, 0.12), 0.0)
    elif s <= 4:
        for c in range(2):
            z = 0.12 + c * 0.22
            for side in (-1, 1):
                if c % 2 == 0:
                    g.bar((-0.95, side * 0.8, z), (0.95, side * 0.8, z), 0.12, "log", 7)
                else:
                    g.bar((side * 0.8, -0.95, z), (side * 0.8, 0.95, z), 0.12, "log", 7)
        deck(g, 2.0, top - 0.03)
        if s == 4:
            for x, y in ((0.9, 0.9), (-0.9, 0.9), (0.9, -0.9), (-0.9, -0.9)):
                g.cyl(0.1, 0.1, top + 0.3, (x, y, (top + 0.3) / 2), "log", sides=7)
            g.cyl(0.62, 0.66, 0.1, (0, 0, top + 0.05), "plankGrey", sides=12)
    elif s <= 6:
        g.cyl(1.2, 1.15, top, (0, 0, top / 2), "plate", sides=8 if s == 5 else 12)
        # A painted band round the drum.
        g.cyl(1.21, 1.19, top * 0.3, (0, 0, top * 0.35), "paint", sides=8 if s == 5 else 12, caps=False)
        g.rivets([(1.18 * math.cos(a / 12 * 2 * math.pi), 1.18 * math.sin(a / 12 * 2 * math.pi), top * 0.6) for a in range(12)])
        g.cyl(1.2, 1.2, 0.1, (0, 0, top - 0.02), "plate", sides=8 if s == 5 else 12)
        g.cyl(0.66, 0.7, 0.12, (0, 0, top + 0.06), "plate", sides=16)
    else:
        sides = 12 if s <= 8 else 20
        paint = "paint" if s <= 8 else "paintClean"
        if s >= 8:
            g.cyl(1.55, 1.22, 0.35, (0, 0, 0.42), paint, sides=sides)
        g.cyl(1.22, 1.16, top - 0.24, (0, 0, 0.24 + (top - 0.24) / 2), paint, sides=sides)
        g.cyl(1.25, 1.25, 0.1, (0, 0, 0.36), "paintDark", sides=sides, caps=False)
        g.cyl(1.24, 1.24, 0.12, (0, 0, top - 0.02), "paintDark", sides=sides, caps=False)
        g.cyl(0.7, 0.74, 0.12, (0, 0, top + 0.08), "gunmetal" if s >= 9 else "plate", sides=24)
        if s == 10:
            g.cyl(1.27, 1.27, 0.05, (0, 0, top * 0.62), "lamp", sides=sides, caps=False)
    # Rounds ready to hand, round the back.
    if s <= 4:
        for i, (x, y) in enumerate(((-1.55, 0.7), (-1.6, -0.2))):
            g.box((0.5, 0.42, 0.34), (x, y, 0.17), "plank" if i == 0 else "plankGrey", (0, 0, 0.2 * i - 0.1), 0.012)
    elif s <= 6:
        for i, (x, y) in enumerate(((-1.6, 0.6), (-1.6, -0.1))):
            g.box((0.5, 0.45, 0.36), (x, y, 0.42), "paint", (0, 0, 0.05 * i), 0.02)
    else:
        g.box((0.55, 0.8, 0.4), (-1.65, 0.3, 0.46), "paintDark", chamfer=0.03)
        for i in range(4):
            g.cyl(0.08, 0.08, 0.4, (-1.55 + (i % 2) * 0.2, -0.45 + (i // 2) * 0.2, 0.46), "paint", sides=8)


def mortar_gun(head, s, top):
    t = FULL
    radius = 0.36
    # Raised as it fattens, so the breech clears the base.
    pivot_z = top + lerp(0.5, 0.65, t) + (radius - 0.2) * 1.2
    length = lerp(1.6, 2.2, t)
    tube = Group("guns", pivot=(0, 0, pivot_z), seed=200 + s, parent=head, tilt=(0, -MORTAR_PITCH, 0))
    z = pivot_z
    material = "pipe" if s <= 3 else "plate" if s <= 6 else "gunmetal"
    # The tube is drawn lying along +x through its pivot; the tilt stands it up.
    tube.bar((-0.55, 0, z), (length, 0, z), radius, material, 12)
    tube.cyl(radius + 0.06, radius + 0.03, 0.22, (-0.62, 0, z), "plate" if s >= 3 else "pipe", (0, math.pi / 2, 0), sides=12)
    tube.points["muzzle0"] = (length + 0.12, 0, z)
    if s <= 2:
        for x in (0.2, 0.9):
            tube.cyl(radius + 0.04, radius + 0.04, 0.08, (x, 0, z), "rope", (0, math.pi / 2, 0), sides=10)
    elif s <= 6:
        for x in (0.1, length - 0.1):
            tube.cyl(radius + 0.04, radius + 0.04, 0.1, (x, 0, z), "plate", (0, math.pi / 2, 0), sides=12, caps=False)
        if s >= 5:
            tube.cyl(radius + 0.08, radius + 0.08, 0.6, (0.25, 0, z), "gunmetal", (0, math.pi / 2, 0), sides=12)
    else:
        tube.cyl(radius + 0.07, radius + 0.07, length * 0.45, (length * 0.25, 0, z), "gunmetal", (0, math.pi / 2, 0), sides=14)
        for k in range(3):
            tube.cyl(radius + 0.09, radius + 0.09, 0.05, (length * (0.1 + k * 0.12), 0, z), "paint" if s <= 8 else "paintClean", (0, math.pi / 2, 0), sides=14, caps=False)
        if s >= 9:
            tube.box((0.22, radius * 2 + 0.06, radius * 2 + 0.06), (length + 0.04, 0, z), "gunmetal", chamfer=0.03)
    # The mount the tube turns on, and what holds it up.
    if s <= 4:
        for side in (-1, 1):
            head.box((0.5, 0.08, 0.6), (0, side * (radius + 0.12), pivot_z - 0.2), "plank", (0, 0.1, 0), 0.01)
        leg = "log" if s <= 2 else "pipe"
        for side in (-1, 1):
            head.bar((1.0, side * 0.45, top), (0.35, side * 0.12, pivot_z + 0.45), 0.06, leg, 7)
        head.box((0.8, 0.8, 0.08), (-0.1, 0, top + 0.04), "plankGrey" if s <= 2 else "paint", (0, 0, 0.1), 0.01)
    else:
        plate = "paint" if s <= 8 else "paintClean"
        for side in (-1, 1):
            head.box((0.7, 0.1, 0.75), (-0.05, side * (radius + 0.15), pivot_z - 0.15), plate, chamfer=0.03)
        for side in (-1, 1):
            head.bar((0.95, side * 0.5, top + 0.1), (0.4, side * 0.14, pivot_z + 0.5), 0.05, "plate", 8)
        head.cyl(0.6, 0.6, 0.12, (0, 0, top + 0.18), plate, sides=20)
        if s >= 7:
            head.box((0.28, 0.2, 0.22), (-0.2, radius + 0.36, pivot_z + 0.15), "paintDark", chamfer=0.02)
            head.box((0.04, 0.14, 0.08), (-0.07, radius + 0.36, pivot_z + 0.18), "glass", chamfer=0.0)
            for side in (-1, 1):
                head.bar((-0.4, side * 0.3, top + 0.2), (0.05, side * 0.18, pivot_z + 0.25), 0.045, "pipe", 8)
        if s >= 9:
            head.box((0.04, 0.9, 0.06), (0.32, 0, top + 0.26), "hazard", chamfer=0.0)
    extra = []
    if s == 10:
        head.bar((-0.55, -0.45, top + 0.2), (-0.55, -0.45, top + 1.2), 0.04, "plate", 8)
        dish = Group("radar", pivot=(-0.55, -0.45, top + 1.2), seed=300, parent=head)
        dish.cyl(0.06, 0.06, 0.08, (-0.55, -0.45, top + 1.24), "gunmetal", sides=10)
        dish.cyl(0.38, 0.07, 0.18, (-0.48, -0.45, top + 1.36), "plate", (0.0, -0.45, 0), sides=16, caps=False)
        dish.cyl(0.05, 0.05, 0.08, (-0.25, -0.45, top + 1.46), "lamp", sides=8)
        extra.append(dish)
    return [tube, *extra]


def mortar(s):
    top = lerp(0.42, 0.95, FULL)
    body = Group("body", seed=s)
    head = Group("head", pivot=(0, 0, top), seed=100 + s)
    mortar_base(body, s, top)
    parts = [body, head, *mortar_gun(head, s, top)]
    grow(parts, GROW, 0.24 if s >= 7 else 0.0)
    turret_ground(body, s)
    return parts


# ---------------------------------------------------------------------------------------------
# Harpoon launcher: a great crossbow on a turning mount, a harpoon on its stock and its line on a
# drum. When it fires, the bowstring snaps forward and the harpoon goes; then the string draws back
# and the next harpoon slides on.


def harpoon_base(g, s, top):
    if s <= 2:
        for i in range(3):
            a = i / 3 * 2 * math.pi + 0.5
            drum(g, (0.5 * math.cos(a), 0.5 * math.sin(a), 0), h=top - 0.42, material="paint")
        deck(g, 1.7, top - 0.36)
        g.bar((0.0, 0.0, top - 0.34), (0.0, 0.0, top), 0.16, "log", 7)
    elif s <= 4:
        for x in (-0.65, 0.65):
            for y in (-0.65, 0.65):
                g.beam((x, y, 0), (x * 0.9, y * 0.9, top - 0.1), 0.18, 0.18, "log")
        for x, y in ((0.7, 0), (-0.7, 0), (0, 0.7), (0, -0.7)):
            along = Vector((0, 1, 0)) if abs(x) > 0 else Vector((1, 0, 0))
            low = Vector((x, y, 0.2)) - along * 0.6
            high = Vector((x, y, top - 0.35)) + along * 0.6
            g.beam(tuple(low), tuple(high), 0.08, 0.05, "plank")
        deck(g, 1.7, top - 0.06, "plank" if s == 4 else "plankGrey")
        g.cyl(0.5, 0.55, 0.12, (0, 0, top), "plankGrey", sides=10)
    elif s <= 6:
        g.cyl(1.0, 0.9, top, (0, 0, top / 2), "plate", sides=8 if s == 5 else 12)
        # A painted band round the drum.
        g.cyl(0.98, 0.96, top * 0.3, (0, 0, top * 0.5), "paint", sides=8 if s == 5 else 12, caps=False)
        for z in (0.2, top - 0.2):
            g.rivets([(0.98 * math.cos(a / 12 * 2 * math.pi), 0.98 * math.sin(a / 12 * 2 * math.pi), z) for a in range(12)])
        g.cyl(1.02, 1.02, 0.12, (0, 0, top - 0.02), "plate", sides=8 if s == 5 else 12, caps=False)
        g.cyl(0.66, 0.7, 0.12, (0, 0, top), "plate", sides=16)
    else:
        sides = 12 if s <= 8 else 20
        paint = "paint" if s <= 8 else "paintClean"
        if s >= 8:
            g.cyl(1.4, 1.02, 0.5, (0, 0, 0.49), paint, sides=sides)
        g.cyl(1.02, 0.94, top - 0.24, (0, 0, 0.24 + (top - 0.24) / 2), paint, sides=sides)
        g.cyl(1.05, 1.05, 0.25, (0, 0, 0.42), "paintDark", sides=sides, caps=False)
        g.cyl(1.04, 1.04, 0.12, (0, 0, top - 0.02), "paintDark", sides=sides, caps=False)
        g.box((0.06, 0.5, 0.7), (0.98, -0.35, top * 0.55), "paintDark", (0, 0, -0.4), 0.02)
        g.cyl(0.7, 0.74, 0.12, (0, 0, top), "gunmetal" if s >= 9 else "plate", sides=24)
        if s == 10:
            g.cyl(1.07, 1.07, 0.05, (0, 0, top * 0.75), "lamp", sides=sides, caps=False)
    # Spare harpoons lying on a crate round the back.
    spare = "log" if s <= 3 else "plate" if s <= 6 else "gunmetal"
    tip = "plate" if s <= 6 else "gunmetal"
    crate = "plank" if s <= 2 else "paint" if s <= 8 else "paintClean"
    g.box((0.5, 0.9, 0.3), (-1.55, -0.2, 0.15), crate, chamfer=0.015)
    for y in (-0.45, -0.2, 0.05):
        g.bar((-1.75, y - 0.3, 0.34), (-1.35, y + 0.35, 0.34), 0.035, spare, 6)
        g.cyl(0.07, 0.01, 0.2, (-1.3, y + 0.43, 0.34), tip, (-math.pi / 2, 0, -0.55), sides=6)


def harpoon_gun(head, s, top):
    t = FULL
    z = top + lerp(0.42, 0.55, t)
    reach = lerp(1.15, 1.6, t)
    wood = s <= 4
    stock = "plank" if s <= 2 else "plankGrey" if s <= 4 else "plate" if s <= 6 else "gunmetal"
    limbs = "log" if s <= 2 else "plank" if s <= 4 else "plate" if s <= 6 else "paint" if s <= 8 else "paintClean"
    head.cyl(0.6, 0.62, 0.12, (0, 0, top + 0.06), "plankGrey" if wood else "plate", sides=16)
    # The stock the harpoon lies along, on a post up from the mount.
    head.box((0.3, 0.3, z - top - 0.1), (-0.05, 0, (top + z) / 2), stock, chamfer=0.02)
    head.box((2.1, 0.34, 0.18), (-0.15, 0, z), stock, chamfer=0.02 if not wood else 0.012)
    # The bow, its limbs swept back from the front of the stock.
    tips = []
    for side in (-1, 1):
        root = (0.75, side * 0.14, z + 0.02)
        tip = (0.32, side * reach, z + 0.02)
        head.beam(root, tip, 0.14 if wood else 0.1, 0.12, limbs)
        if s >= 5:
            mid = ((root[0] + tip[0]) / 2 - 0.05, (root[1] + tip[1]) / 2, z + 0.1)
            head.beam((0.72, side * 0.14, z + 0.1), mid, 0.08, 0.06, limbs)
        if s <= 4:
            for k in (0.3, 0.65):
                at = (lerp(root[0], tip[0], k), lerp(root[1], tip[1], k), z + 0.02)
                head.cyl(0.085, 0.085, 0.05, at, "rope" if s <= 2 else "plate", (0, math.pi / 2, 0), sides=7, caps=False)
        tips.append(tip)
    head.box((0.24, 0.42, 0.24), (0.78, 0, z + 0.02), "plank" if wood else "gunmetal", chamfer=0.02)
    # Its line, wound on a drum at the side, and a crank at the back.
    head.cyl(0.22, 0.22, 0.34, (-0.45, -0.42, z - 0.05), "rope", (math.pi / 2, 0, 0), sides=12)
    head.cyl(0.26, 0.26, 0.04, (-0.45, -0.25, z - 0.05), stock, (math.pi / 2, 0, 0), sides=12)
    head.cyl(0.26, 0.26, 0.04, (-0.45, -0.59, z - 0.05), stock, (math.pi / 2, 0, 0), sides=12)
    head.bar((-1.2, -0.25, z), (-1.2, 0.25, z), 0.04, "plate", 6)
    head.bar((-1.2, 0.25, z), (-1.2, 0.25, z + 0.25), 0.03, "plate", 6)
    if s >= 5:
        plate = "paint" if s <= 8 else "paintClean"
        # A housing round the back of the stock, and a shield over the bow's middle.
        head.box((0.7, 0.62, 0.42), (-0.75, 0, z + 0.12), plate, chamfer=0.04)
        head.box((0.06, 1.1, 0.5), (0.95, 0, z + 0.22), plate, (0, -0.35, 0), 0.02)
        if s <= 6:
            head.rivets([(0.99, y, z + 0.3) for y in (-0.4, 0, 0.4)])
    if s >= 7:
        head.box((0.24, 0.14, 0.16), (-0.6, 0.36, z + 0.4), "paintDark", chamfer=0.02)
        head.box((0.04, 0.1, 0.07), (-0.47, 0.36, z + 0.42), "glass", chamfer=0.0)
    if s >= 8:
        head.cyl(0.15, 0.13, 0.26, (-0.5, -0.45, z + 0.42), "plate" if s <= 8 else "gunmetal", (0, math.pi / 2, 0), sides=12)
        head.cyl(0.12, 0.12, 0.03, (-0.36, -0.45, z + 0.42), "lamp", (0, math.pi / 2, 0), sides=12)
    if s >= 9:
        head.box((0.04, 1.12, 0.07), (0.98, 0, z + 0.43), "hazard", (0, -0.35, 0), 0.0)
    extra = []
    if s == 10:
        head.bar((-1.0, 0.3, z), (-1.0, 0.3, z + 0.9), 0.04, "plate", 8)
        dish = Group("radar", pivot=(-1.0, 0.3, z + 0.9), seed=300, parent=head)
        dish.cyl(0.06, 0.06, 0.08, (-1.0, 0.3, z + 0.94), "gunmetal", sides=10)
        dish.cyl(0.36, 0.07, 0.17, (-0.94, 0.3, z + 1.05), "plate", (0.0, -0.45, 0), sides=16, caps=False)
        dish.cyl(0.05, 0.05, 0.08, (-0.73, 0.3, z + 1.14), "lamp", sides=8)
        extra.append(dish)
    # The bowstring and its latch: they snap forward when it fires.
    string = Group("guns", pivot=(0, 0, top), seed=200 + s, parent=head)
    cord = "rope" if s <= 4 else "pipe"
    latch = (-0.55, 0, z + 0.12)
    for tip in tips:
        string.bar(tip, latch, 0.025, cord, 5)
    string.box((0.16, 0.2, 0.12), latch, "plank" if wood else "gunmetal", chamfer=0.015)
    # The harpoon on the stock: it goes when it fires, and the next slides on.
    bolt = Group("bolt", pivot=(0, 0, top), seed=250 + s, parent=head)
    shaft = "log" if s <= 3 else "plate" if s <= 6 else "gunmetal"
    point = "plate" if s <= 6 else "gunmetal"
    by = z + 0.15
    end = 1.25 + 0.35 * t
    bolt.bar((-0.5, 0, by), (end, 0, by), 0.045 if s <= 3 else 0.04, shaft, 7)
    bolt.cyl(0.1, 0.01, 0.34, (end + 0.15, 0, by), point, (0, math.pi / 2, 0), sides=8)
    for side in (-1, 1):
        bolt.beam((end + 0.02, side * 0.02, by), (end - 0.14, side * 0.14, by), 0.04, 0.02, point)
    if s >= 7:
        bolt.cyl(0.06, 0.06, 0.05, (0.2, 0, by), "paint" if s <= 8 else "paintClean", (0, math.pi / 2, 0), sides=8, caps=False)
    bolt.points["muzzle0"] = (end + 0.35, 0, by)
    return [string, bolt, *extra]


def harpoon(s):
    top = lerp(1.25, 2.25, FULL)
    body = Group("body", seed=s)
    head = Group("head", pivot=(0, 0, top), seed=100 + s)
    harpoon_base(body, s, top)
    parts = [body, head, *harpoon_gun(head, s, top)]
    grow(parts, GROW, 0.24 if s >= 7 else 0.0)
    turret_ground(body, s)
    return parts


BUILDINGS = {"gunTurret": gun_turret, "mortar": mortar, "harpoon": harpoon}


# ---------------------------------------------------------------------------------------------
# Headquarters: a block with its door to the front, an upper floor from the fourth look, wings down
# its sides from the fifth and a lookout room on top from the sixth. Doors, trim, banners and roofs
# are painted, so they come out in the side's own colour. No sandbags: it isn't a defense.

PANEL = 1.8


def panels(g, a, b, z0, height, material, thick=0.16, gap=None, skew=0.0):
    """A wall from a to b made of panels about PANEL long, so a long wall's texture stays the
    right size. With gap, a doorway that wide is left in the middle."""
    a = Vector(a)
    b = Vector(b)
    length = (b - a).length
    heading = math.atan2(b.y - a.y, b.x - a.x)
    count = max(1, round(length / PANEL))
    each = length / count
    r = g.rng
    for i in range(count):
        middle = (i + 0.5) * each
        if gap and abs(middle - length / 2) < gap / 2 + each / 2 - 0.05:
            # Either side of the doorway, a narrower panel up to its edge.
            near = length / 2 - gap / 2 if middle < length / 2 else length / 2 + gap / 2
            far = i * each if middle < length / 2 else (i + 1) * each
            lo, hi = sorted((near, far))
            if hi - lo < 0.15:
                continue
            middle = (lo + hi) / 2
            run = hi - lo
        else:
            run = each
        at = a + (b - a) * (middle / length)
        tilt = (r.uniform(-skew, skew), r.uniform(-skew, skew), heading + r.uniform(-skew, skew))
        g.box((run * 0.98, thick, height), (at.x, at.y, z0 + height / 2), material, tilt, 0.012)


def halves(half):
    """A block's half depth and half width, from one number or the two."""
    return half if isinstance(half, tuple) else (half, half)


def box_walls(g, half, z0, height, material, door=0.0, thick=0.16, skew=0.0, mix=None, at=(0, 0)):
    """Four walls round a block centred on `at`; the front one (towards +x) with a door if `door`
    is wide. The side walls run on past the corners, so there's no notch where two walls meet."""
    hx, hy = halves(half)
    x, y = at
    edge = thick / 2
    walls = [
        ((x + hx, y - hy + edge), (x + hx, y + hy - edge)),
        ((x + hx + edge, y + hy), (x - hx - edge, y + hy)),
        ((x - hx, y + hy - edge), (x - hx, y - hy + edge)),
        ((x - hx - edge, y - hy), (x + hx + edge, y - hy)),
    ]
    for i, (a, b) in enumerate(walls):
        stuff = mix[i % len(mix)] if mix else material
        panels(g, (*a, 0), (*b, 0), z0, height, stuff, thick, gap=door if i == 0 and door else None, skew=skew)


def slab(g, half, z, material, thick=0.14, at=(0, 0)):
    """A flat roof or floor, laid in panels too."""
    hx, hy = halves(half)
    across = max(1, round(hx * 2 / PANEL))
    along = max(1, round(hy * 2 / PANEL))
    for i in range(across):
        for j in range(along):
            centre = (at[0] - hx + (i + 0.5) * hx * 2 / across, at[1] - hy + (j + 0.5) * hy * 2 / along, z)
            g.box((hx * 2 / across, hy * 2 / along, thick), centre, material, chamfer=0.0)


def gable(g, half, z, rise, material, at=(0, 0)):
    """A pitched roof of two slopes, ridge running front to back, over a block centred on `at`."""
    hx, hy = halves(half)
    for side in (-1, 1):
        slope = math.atan2(rise, hy)
        span = math.hypot(hy, rise) + 0.25
        count = max(1, round(hx * 2 / PANEL))
        each = (hx * 2 + 0.5) / count
        for i in range(count):
            x = at[0] - hx - 0.25 + (i + 0.5) * each
            spot = (x, at[1] + side * hy / 2, z + rise / 2)
            g.box((each * 0.99, span, 0.06), spot, material, (side * -slope, 0, 0), 0.01)


def headquarters(s):
    t = (s - 1) / 9
    g = Group("body", seed=s)
    parts = [g]
    half = lerp(2.4, 3.2, t)
    lower = lerp(1.7, 2.5, t)
    door = 1.3
    team = "paint" if s <= 8 else "paintClean"
    if s <= 3:
        # A shack, then a cabin: boards, then logs, under a pitched roof of flat sheet metal.
        if s == 3:
            courses = int(lower / 0.26)
            for c in range(courses):
                for x0, y0, x1, y1 in ((half, -half, half, half), (-half, -half, -half, half), (-half, half, half, half), (-half, -half, half, -half)):
                    # The side walls' logs sit half a log up, so they cross the others' at corners.
                    z = 0.13 + c * 0.26 + (0.13 if y0 == y1 else 0.0)
                    if x0 == x1 == half and c < 7:
                        # The doorway in the front wall.
                        for y_from, y_to in ((-half - 0.15, -door / 2), (door / 2, half + 0.15)):
                            g.bar((half, y_from, z), (half, y_to, z), 0.13, "log", 7)
                        continue
                    g.bar((x0 + (0.15 if x0 == x1 == -half else 0), y0 - 0.15 if y0 == y1 else y0, z), (x1, y1 + 0.15 if y0 == y1 else y1, z), 0.13, "log", 7)
        else:
            mix = ["plank", "plankGrey"] if s == 1 else ["plank", "plate", "plankGrey", "plank"]
            box_walls(g, half, 0, lower, "plank", door=door, skew=0.03, mix=mix)
        eaves = half + 0.2
        rise = half * 0.55
        gable(g, eaves, lower, rise, "plate")
        # A painted cap along the ridge, and painted boards along the eaves.
        g.bar((-eaves - 0.25, 0, lower + rise + 0.03), (eaves + 0.25, 0, lower + rise + 0.03), 0.09, team, 8)
        slope = math.atan2(rise, eaves)
        reach = (math.hypot(eaves, rise) + 0.25) / 2
        for side in (-1, 1):
            y = side * (eaves / 2 + math.cos(slope) * reach + 0.02)
            z = lower + rise / 2 - math.sin(slope) * reach - 0.05
            g.box((eaves * 2 + 0.5, 0.05, 0.16), (0, y, z), team, chamfer=0.01)
        g.box((0.06, door * 0.9, lower * 0.85), (half + 0.02, 0, lower * 0.42), team, (0, 0, 0.25), 0.01)
        wall_face = half + (0.13 if s == 3 else 0.08)
        if s >= 2:
            # A sign over the door, and shutters either side of a window down each side.
            g.box((0.05, 1.2, 0.32), (wall_face + 0.03, 0, lower * 0.95), team, chamfer=0.01)
            for side in (-1, 1):
                y = side * (wall_face + 0.02)
                g.box((0.55, 0.04, 0.42), (-half * 0.25, y, lower * 0.55), "gunmetal", chamfer=0.0)
                for dx in (-0.43, 0.43):
                    g.box((0.28, 0.05, 0.5), (-half * 0.25 + dx, y + side * 0.01, lower * 0.55), team, chamfer=0.01)
            # A radio mast at the back corner.
            mast = (-half - 0.45, -half + 0.3)
            g.bar((*mast, 0), (*mast, lower + rise + 1.3), 0.06, "log", 6)
            g.box((0.06, 0.9, 0.06), (mast[0], mast[1], lower + rise + 1.1), "plankGrey", chamfer=0.0)
        if s == 3:
            g.cyl(0.18, 0.18, 1.2, (-half * 0.5, half * 0.4, lower + half * 0.55), "pipe", sides=8)
        if s == 2:
            # A lean-to round the back.
            panels(g, (-half - 1.4, -1.2, 0), (-half - 1.4, 1.2, 0), 0, 1.3, "plankGrey", skew=0.04)
            g.box((1.6, 2.6, 0.05), (-half - 0.75, 0.2, 1.45), "plate", (0.0, 0.25, 0.0), 0.01)
        # Crates by the door.
        for i, (x, y) in enumerate(((half + 0.9, -half + 0.6), (half + 0.8, -half + 1.2))):
            g.box((0.5, 0.5, 0.5), (x, y, 0.25), "plank" if i == 0 else "plankGrey", (0, 0, 0.3 * i), 0.012)
        flag_at = (0.1, 0.1)
        flag_z = lower + rise
    else:
        wood = s == 4
        wall = "plank" if wood else "plate" if s <= 6 else "concrete"
        window = "glass" if s >= 7 else "gunmetal"
        floor = 0.2 if s >= 5 else 0.0
        wing = lerp(0.9, 1.2, t) if s >= 5 else 0.0
        # The ground it stands on.
        if s >= 5:
            g.box((half * 2 + 1.4, (half + wing) * 2 + 1.0, 0.2), (0, 0, 0.1), "concrete", chamfer=0.04)
            if s >= 7:
                g.box((half * 2 + 1.6, (half + wing) * 2 + 1.2, 0.08), (0, 0, 0.04), "plate", chamfer=0.02)
        # The hall: a flat sheet-metal roof inside a painted parapet.
        box_walls(g, half, floor, lower, wall, door=door, skew=0.01 if wood else 0.0)
        g.box((0.16, door, lower * 0.25), (half, 0, floor + lower * 0.875), wall, chamfer=0.012)
        roof_z = floor + lower + 0.07
        slab(g, half + 0.12, floor + lower, "plank" if wood else "plate")
        box_walls(g, half + 0.04, roof_z, 0.3, team)
        # The door, under a painted canopy, a step up to it and a banner either side.
        g.box((0.08, door * 0.95, lower * 0.75), (half, 0, floor + lower * 0.375), team, chamfer=0.015)
        g.box((0.9, door + 0.7, 0.07), (half + 0.45, 0, floor + lower * 0.82), team, (0, -0.18, 0), 0.015)
        g.box((0.6, door + 0.4, 0.14), (half + 0.35, 0, floor + 0.07), "plank" if wood else "concrete", chamfer=0.02)
        for side in (-1, 1):
            g.box((0.04, 0.55, lower * 0.55), (half + 0.1, side * (door / 2 + 0.75), floor + lower * 0.5), team, chamfer=0.0)
        if wing:
            # A lower wing down each side, roofed in paint, and windows in the hall above it.
            wing_h = lower * 0.62
            deep = half * 0.7
            wx = -half * 0.1
            for side in (-1, 1):
                inner = side * (half + 0.08)
                outer = side * (half + wing)
                panels(g, (wx + deep + 0.08, outer, 0), (wx - deep - 0.08, outer, 0), floor, wing_h, wall)
                for x in (wx + deep, wx - deep):
                    panels(g, (x, inner, 0), (x, outer - side * 0.08, 0), floor, wing_h, wall)
                width = wing + 0.11
                slab(g, (deep + 0.2, width / 2), floor + wing_h, team, 0.12, at=(wx, side * (half + 0.09 + width / 2)))
                for x in (wx - deep * 0.5, wx + deep * 0.5):
                    g.box((0.7, 0.06, 0.35), (x, side * (half + wing + 0.09), floor + wing_h * 0.55), window, chamfer=0.0)
            window_z = floor + (wing_h + lower) / 2
        else:
            window_z = floor + lower * 0.62
        for side in (-1, 1):
            for x in (-half * 0.45, half * 0.35):
                g.box((0.7, 0.06, 0.35), (x, side * (half + 0.09), window_z), window, chamfer=0.0)
        if wood:
            # A ladder up the front to the roof.
            for side in (-1, 1):
                g.beam((half + 0.5, half * 0.6 + side * 0.22, 0), (half + 0.1, half * 0.6 + side * 0.22, lower), 0.06, 0.05, "plankGrey")
        if s >= 9:
            g.box((0.04, door + 0.4, 0.12), (half + 0.67, 0, floor + 0.07), "hazard", chamfer=0.0)
            g.box((0.04, half * 2, 0.06), (half + 0.14, 0, roof_z + 0.2), "lamp", chamfer=0.0)
        # The upper floor, set back to leave a deck at the front, under a painted roof.
        ux = -half * 0.2
        upper_half = (half * 0.55, half * 0.6)
        upper = lerp(1.2, 1.7, t)
        upper_wall = "plank" if wood else "plate" if s <= 6 else team
        box_walls(g, upper_half, roof_z, upper, upper_wall, thick=0.14, at=(ux, 0))
        for side in (-1, 1):
            g.box((0.06, 0.8, 0.35), (ux + upper_half[0] + 0.08, side * upper_half[1] * 0.45, roof_z + upper * 0.6), window, chamfer=0.0)
        slab(g, (upper_half[0] + 0.25, upper_half[1] + 0.25), roof_z + upper, team, at=(ux, 0))
        top_z = roof_z + upper + 0.07
        flag_at = (ux + upper_half[0] * 0.5, upper_half[1] * 0.5)
        if s >= 6:
            # A lookout room on top: slits in plate at first, then glass all round.
            tx = ux - upper_half[0] * 0.2
            th = lerp(0.55, 0.85, t)
            tall = lerp(0.9, 1.4, (s - 6) / 4)
            if s == 6:
                box_walls(g, th, top_z, tall, "plate", thick=0.12, at=(tx, 0))
                g.box((0.06, th * 1.2, 0.2), (tx + th + 0.06, 0, top_z + tall * 0.6), "gunmetal", chamfer=0.0)
            else:
                box_walls(g, th, top_z, tall, "glass", thick=0.08, at=(tx, 0))
            slab(g, th + 0.25, top_z + tall, team, 0.12, at=(tx, 0))
            top_z += tall + 0.06
            corner = th * 0.8
            flag_at = (tx + corner, corner)
            if s >= 8:
                g.bar((tx - corner, -corner, top_z), (tx - corner, -corner, top_z + 1.3), 0.03, "gunmetal", 6)
                g.box((0.04, 0.5, 0.04), (tx - corner, -corner, top_z + 1.1), "gunmetal", chamfer=0.0)
            if s == 10:
                mast = (tx, 0)
                g.bar((*mast, top_z), (*mast, top_z + 0.6), 0.05, "gunmetal", 8)
                dish = Group("radar", pivot=(*mast, top_z + 0.6), seed=300, parent=g)
                dish.cyl(0.08, 0.08, 0.1, (*mast, top_z + 0.65), "gunmetal", sides=10)
                dish.cyl(0.6, 0.1, 0.26, (mast[0] + 0.1, mast[1], top_z + 0.82), "plate", (0.0, -0.45, 0), sides=18, caps=False)
                dish.cyl(0.06, 0.06, 0.1, (mast[0] + 0.42, mast[1], top_z + 0.98), "lamp", sides=8)
                parts.append(dish)
                around = half + wing + 0.25
                for x, y in ((half + 0.45, around), (half + 0.45, -around), (-half - 0.45, around), (-half - 0.45, -around), (0, around), (0, -around), (-half - 0.45, 0)):
                    g.cyl(0.1, 0.1, 0.04, (x, y, 0.21), "lamp", sides=8)
        flag_z = top_z
    # The flag, ragged on a crooked pole at first.
    pole = "log" if s <= 4 else "gunmetal"
    lean = 0.08 if s <= 2 else 0.0
    top = (flag_at[0] + lean, flag_at[1], flag_z + (2.2 if s <= 5 else 1.8))
    g.bar((*flag_at, flag_z), top, 0.05, pole, 6)
    g.box((0.9, 0.03, 0.55), (top[0] - 0.47, top[1], top[2] - 0.32), team, (0, 0, 0.1 if s <= 3 else 0), 0.0)
    return parts


BUILDINGS["headquarters"] = headquarters

# ---------------------------------------------------------------------------------------------
# The rest of the buildings. Each grows the way the headquarters does: boards and logs under flat
# sheet metal, then plate, then concrete and paint, with something in the side's colour from the
# first stage on: a roof, a door, a band or a flag. Doors face the front (+x).


def team_of(s):
    return "paint" if s <= 8 else "paintClean"


def wall_of(s):
    return "plank" if s <= 2 else "plankGrey" if s <= 4 else "plate" if s <= 6 else "concrete"


def frame_of(s):
    """What posts, masts and frames are made of."""
    return "log" if s <= 4 else "plate" if s <= 6 else team_of(s)


def shed(g, s, at, half, height, door=0.9, windows=True):
    """A small building: boards under a pitched metal roof with a painted ridge at first, then plate
    and concrete under a flat painted roof. Its door faces the front."""
    hx, hy = halves(half)
    x, y = at
    team = team_of(s)
    box_walls(g, (hx, hy), 0, height, wall_of(s), door=door, skew=0.02 if s <= 2 else 0.0, at=at)
    if s <= 4:
        rise = hy * 0.55
        gable(g, (hx + 0.15, hy + 0.15), height, rise, "plate", at=at)
        g.bar((x - hx - 0.4, y, height + rise + 0.03), (x + hx + 0.4, y, height + rise + 0.03), 0.07, team, 8)
    else:
        slab(g, (hx + 0.15, hy + 0.15), height, team, 0.14, at=at)
    if door:
        g.box((0.06, door * 0.9, height * 0.78), (x + hx + 0.02, y, height * 0.39), team, chamfer=0.01)
    if windows and s >= 5:
        glass = "glass" if s >= 7 else "gunmetal"
        for side in (-1, 1):
            g.box((min(0.7, hx), 0.06, 0.32), (x - hx * 0.2, y + side * (hy + 0.09), height * 0.62), glass, chamfer=0.0)


def flag(g, s, at, z, height=1.6):
    """A flag in the side's colour on a pole."""
    x, y = at
    pole = "log" if s <= 4 else "gunmetal"
    g.bar((x, y, z), (x, y, z + height), 0.04, pole, 6)
    g.box((0.6, 0.03, 0.38), (x - 0.31, y, z + height - 0.21), team_of(s), chamfer=0.0)


def lamps(g, points):
    for p in points:
        g.cyl(0.08, 0.08, 0.05, p, "lamp", sides=8)


def rails(g, s, a, b, gauge=0.35):
    """A little track from a to b, sleepers and all."""
    a = Vector(a)
    b = Vector(b)
    along = (b - a).normalized()
    side = Vector((-along.y, along.x, 0))
    length = (b - a).length
    for k in (-1, 1):
        g.bar(a + side * gauge * k + Vector((0, 0, 0.08)), b + side * gauge * k + Vector((0, 0, 0.08)), 0.035, "gunmetal", 6)
    for i in range(int(length / 0.5)):
        p = a + along * (0.25 + i * 0.5)
        g.box((0.14, gauge * 2 + 0.35, 0.05), (p.x, p.y, 0.03), "plankGrey", (0, 0, math.atan2(along.y, along.x)), 0.0)


def cart(g, s, at, load="ore"):
    x, y = at
    body = "plankGrey" if s <= 3 else "plate" if s <= 6 else team_of(s)
    g.box((0.95, 0.75, 0.45), (x, y, 0.42), body, chamfer=0.03)
    for dx in (-0.3, 0.3):
        for dy in (-0.4, 0.4):
            g.cyl(0.14, 0.14, 0.08, (x + dx, y + dy, 0.16), "gunmetal", (math.pi / 2, 0, 0), sides=10)
    g.cyl(0.42, 0.1, 0.32, (x, y, 0.78), load, sides=7)


def rock(g, at, r, h, turn=0.0):
    """A boulder: a squat cone of rough rock."""
    x, y = at
    g.cyl(r, r * 0.5, h, (x, y, h / 2), "stone", (0, 0, turn), sides=7)


# --- Producers: 4 x 4 tiles, so everything stays within 3.6 m of the middle. ---------------------


def gold_mine(s):
    t = (s - 1) / 9
    g = Group("body", seed=s)
    team = team_of(s)
    # A hill of rock at the back, tunnelled into from the front.
    for x, y, r, h in ((-1.9, 0.0, 1.8, 2.0), (-1.3, 1.6, 1.25, 1.3), (-1.4, -1.6, 1.3, 1.2), (-2.6, 1.0, 1.0, 1.1)):
        rock(g, (x, y), r, h + 0.4 * t, turn=x + y)
    tall = lerp(1.7, 2.3, t)
    wide = 1.5
    post = frame_of(s)
    g.box((0.5, wide - 0.2, tall - 0.1), (-0.65, 0, (tall - 0.1) / 2), "gunmetal", chamfer=0.0)
    for side in (-1, 1):
        g.beam((-0.4, side * wide / 2, 0), (-0.4, side * wide / 2, tall), 0.24, 0.24, post)
    g.beam((-0.4, -wide / 2 - 0.25, tall), (-0.4, wide / 2 + 0.25, tall), 0.28, 0.28, post)
    if s >= 2:
        g.box((0.05, 1.2, 0.34), (-0.24, 0, tall + 0.36), team, chamfer=0.01)
    rails(g, s, (-0.5, 0, 0), (3.2, 0, 0))
    cart(g, s, (1.9, 0))
    g.cyl(0.8, 0.15, 0.55, (1.2, 1.9, 0.27), "ore", sides=8)
    if s >= 3:
        shed(g, s, (1.5, -2.1), (1.0, 0.85), lerp(1.6, 2.3, t), door=0.8)
    if s >= 5:
        # A headframe over the shaft, with its winding wheel.
        top = lerp(4.2, 5.4, (s - 5) / 5)
        for side in (-1, 1):
            g.beam((-1.6, side * 0.9, 1.6), (-1.6, side * 0.45, top), 0.16, 0.16, post)
            g.beam((-0.6, side * 0.75, 0.3), (-1.55, side * 0.45, top - 0.2), 0.12, 0.12, post)
        g.beam((-1.6, -0.6, top), (-1.6, 0.6, top), 0.18, 0.18, post)
        g.cyl(0.65, 0.65, 0.12, (-1.6, 0, top + 0.1), "gunmetal", (math.pi / 2, 0, 0), sides=16)
        g.cyl(0.2, 0.2, 0.16, (-1.6, 0, top + 0.1), team, (math.pi / 2, 0, 0), sides=10)
        flag(g, s, (-1.6, 0.6), top + 0.1, 1.4)
    else:
        flag(g, s, (-1.9, 0.0), 2.3, 1.4)
    if s >= 9:
        lamps(g, [(-0.4, -wide / 2 - 0.1, tall + 0.2), (-0.4, wide / 2 + 0.1, tall + 0.2)])
    return [g]


def lumber_camp(s):
    t = (s - 1) / 9
    g = Group("body", seed=s)
    team = team_of(s)
    # Logs waiting at the back, piled up.
    rows = 3 if s <= 4 else 4
    for row in range(rows):
        for i in range(rows - row):
            y = (i - (rows - row - 1) / 2) * 0.55
            g.bar((-3.1, y, 0.27 + row * 0.46), (-1.2, y, 0.27 + row * 0.46), 0.25, "log", 9)
    # The saw shed: open at the front at first, walled in later.
    height = lerp(2.1, 2.9, t)
    hx, hy = 1.4, 1.4
    x0 = 0.5
    post = frame_of(s)
    if s <= 4:
        for px in (x0 - hx, x0 + hx):
            for py in (-hy, hy):
                g.beam((px, py, 0), (px, py, height), 0.18, 0.18, post)
        gable(g, (hx + 0.2, hy + 0.2), height, hy * 0.55, "plate", at=(x0, 0))
        g.bar((x0 - hx - 0.45, 0, height + hy * 0.55 + 0.03), (x0 + hx + 0.45, 0, height + hy * 0.55 + 0.03), 0.07, team, 8)
    else:
        panels(g, (x0 - hx, -hy, 0), (x0 - hx, hy, 0), 0, height, wall_of(s))
        for side in (-1, 1):
            panels(g, (x0 - hx - 0.08, side * hy, 0), (x0 + hx * 0.2, side * hy, 0), 0, height, wall_of(s))
        slab(g, (hx + 0.25, hy + 0.25), height, team, 0.14, at=(x0, 0))
    # The bench, a log on it, and the blade.
    g.box((2.4, 0.6, 0.7), (x0, 0, 0.35), "plank" if s <= 4 else "plate", chamfer=0.02)
    g.bar((x0 - 1.1, 0, 0.95), (x0 + 0.9, 0, 0.95), 0.24, "log", 9)
    blade = 0.5 + 0.1 * t
    g.cyl(blade, blade, 0.04, (x0 + 0.4, 0, 0.7 + blade * 0.5), "plate", (math.pi / 2, 0, 0), sides=18)
    g.cyl(0.12, 0.12, 0.1, (x0 + 0.4, 0, 0.7 + blade * 0.5), team, (math.pi / 2, 0, 0), sides=10)
    # Sawn boards stacked out front.
    for k in range(3 + s // 3):
        g.box((1.6, 0.9, 0.08), (2.6, -1.5, 0.05 + k * 0.1), "plank", (0, 0, 0.03 * (k % 2)), 0.008)
    if s >= 6:
        # A steam engine driving the saw, its stack smoking.
        g.box((0.9, 0.8, 0.9), (x0 - 0.2, 1.9, 0.45), "gunmetal", chamfer=0.04)
        g.cyl(0.16, 0.18, 2.4 + t, (x0 - 0.4, 1.9, 1.2 + t / 2), "pipe", sides=10)
        g.cyl(0.21, 0.21, 0.12, (x0 - 0.4, 1.9, 0.6 + 2.4 * 0.62), team, sides=10, caps=False)
    flag(g, s, (x0 + hx, hy), height + 0.1, 1.3)
    if s >= 9:
        lamps(g, [(x0 + hx + 0.1, -hy, height - 0.2), (x0 + hx + 0.1, hy, height - 0.2)])
    return [g]


def quarry(s):
    t = (s - 1) / 9
    g = Group("body", seed=s)
    team = team_of(s)
    # The rock face it's cut from, stepped where blocks have come out.
    for i, (x, y, w, h) in enumerate(((-2.6, 0.0, 1.4, 2.2), (-2.4, 1.7, 1.5, 1.6), (-2.5, -1.6, 1.3, 1.8), (-1.6, 0.6, 0.9, 0.9))):
        g.box((w, 1.8, h + 0.4 * t), (x, y, (h + 0.4 * t) / 2), "stone", (0, 0, 0.1 * i), 0.08)
    g.box((4.2, 5.4, 0.04), (0.8, 0, 0.02), "dirt", chamfer=0.0)
    # Cut blocks, stacked on pallets.
    for px, py in ((1.2, 1.7), (2.4, 1.7), (1.2, -1.9)):
        g.box((1.0, 1.0, 0.12), (px, py, 0.06), "plank", chamfer=0.01)
        for k in range(1 + (s + int(px)) % 3):
            g.box((0.85, 0.85, 0.42), (px, py, 0.33 + k * 0.42), "stone", (0, 0, 0.06 * k), 0.03)
    # A derrick lifting a block off the face.
    mast = frame_of(s)
    top = lerp(3.2, 4.6, t)
    base = (-0.2, -0.9)
    g.bar((*base, 0), (*base, top), 0.12 if s <= 4 else 0.1, mast, 8)
    g.bar((base[0], base[1], top * 0.3), (-2.0, 0.2, top), 0.08, mast, 8)
    g.bar((-2.0, 0.2, top), (-2.0, 0.2, 1.4), 0.02, "rope" if s <= 4 else "gunmetal", 5)
    g.box((0.6, 0.6, 0.45), (-2.0, 0.2, 1.15), "stone", chamfer=0.03)
    g.box((0.6, 0.5, 0.4), (base[0], base[1] + 0.45, 0.6), "plankGrey" if s <= 4 else team, chamfer=0.02)
    cart(g, s, (2.4, -0.4), "stone")
    if s >= 3:
        shed(g, s, (2.2, -2.5), (0.9, 0.7), lerp(1.5, 2.2, t), door=0.7)
    flag(g, s, (-2.6, 0.0), 2.6 + 0.4 * t, 1.3)
    if s >= 9:
        lamps(g, [(base[0], base[1], top + 0.1)])
    return [g]


def scrap_yard(s):
    t = (s - 1) / 9
    g = Group("body", seed=s)
    team = team_of(s)
    # Sorted stock: stacks of plate, drums, and crates, nothing left lying about.
    for k in range(3 + s // 3):
        g.box((1.4, 1.0, 0.07), (-2.2, 1.6, 0.04 + k * 0.08), "plate", (0, 0, 0.05 * (k % 3)), 0.006)
    for i in range(3 if s <= 4 else 5):
        a = i * 1.3
        drum(g, (1.9 + 0.55 * math.cos(a), 1.9 + 0.5 * math.sin(a), 0), material=team if i % 2 else "plate", r=0.32, h=0.75)
    for i, (x, y) in enumerate(((-2.4, -0.3), (-2.4, 0.5), (-1.7, -0.1))):
        g.box((0.6, 0.6, 0.6), (x, y, 0.3 + (0.6 if i == 2 else 0)), "plank" if s <= 4 else "plate", (0, 0, 0.2 * i), 0.012)
    # The press that bales it.
    press = "plankGrey" if s <= 2 else "gunmetal"
    g.box((1.3, 1.1, 1.0 + 0.4 * t), (-0.4, -1.8, (1.0 + 0.4 * t) / 2), press, chamfer=0.04)
    g.box((1.32, 0.2, 0.25), (-0.4, -1.8, 0.75 + 0.3 * t), team, chamfer=0.01)
    for k in range(min(4, s // 2)):
        g.box((0.5, 0.5, 0.5), (0.6 + (k % 2) * 0.55, -2.3 + (k // 2) * 0.55, 0.25), "plate", chamfer=0.02)
    if s >= 2:
        shed(g, s, (2.0, -1.4), (1.0, 0.9), lerp(1.6, 2.3, t), door=0.8)
    if s >= 5:
        # A crane with a magnet on it.
        top = lerp(3.4, 4.6, (s - 5) / 5)
        mast = frame_of(s)
        g.box((0.7, 0.7, 0.5), (0.2, 0.5, 0.25), "gunmetal", chamfer=0.03)
        g.bar((0.2, 0.5, 0.5), (0.2, 0.5, top), 0.14, mast, 8)
        g.bar((0.2, 0.5, top), (-1.8, 1.3, top + 0.3), 0.08, mast, 8)
        g.bar((-1.8, 1.3, top + 0.3), (-1.8, 1.3, 1.3), 0.02, "gunmetal", 5)
        g.cyl(0.38, 0.38, 0.16, (-1.8, 1.3, 1.2), team, sides=14)
    flag(g, s, (2.9, 0.5), 0.0, 2.0 + t)
    if s >= 9:
        lamps(g, [(-0.4, -1.25, 1.2 + 0.4 * t)])
    return [g]


# --- Storages: 3 x 3 tiles, so everything stays within 2.6 m of the middle. ----------------------


def gold_vault(s):
    t = (s - 1) / 9
    g = Group("body", seed=s)
    team = team_of(s)
    if s <= 3:
        shed(g, s, (-0.5, 0), (1.3, 1.2), lerp(1.7, 2.1, t), door=0.8)
        # A strongbox at the door, banded in paint, and sacks of gold beside it.
        g.box((0.8, 0.6, 0.55), (1.4, -1.2, 0.28), "plank", chamfer=0.02)
        for dx in (-0.25, 0.25):
            g.box((0.06, 0.62, 0.57), (1.4 + dx, -1.2, 0.28), team, chamfer=0.0)
    else:
        height = lerp(1.9, 2.8, t)
        walls = "plate" if s <= 6 else "concrete"
        g.box((2.8, 2.8, 0.2), (-0.3, 0, 0.1), "concrete", chamfer=0.03)
        box_walls(g, 1.3, 0.2, height, walls, thick=0.2, at=(-0.3, 0))
        slab(g, 1.5, 0.2 + height, team, 0.18, at=(-0.3, 0))
        # The round door, with its wheel.
        g.cyl(0.75, 0.75, 0.16, (1.08, 0, 0.2 + height * 0.45), "gunmetal", (0, math.pi / 2, 0), sides=20)
        g.cyl(0.6, 0.6, 0.06, (1.18, 0, 0.2 + height * 0.45), team, (0, math.pi / 2, 0), sides=20, caps=False)
        g.cyl(0.25, 0.25, 0.08, (1.22, 0, 0.2 + height * 0.45), "plate", (0, math.pi / 2, 0), sides=6)
        if s >= 7:
            g.box((0.06, 2.6, 0.2), (1.05, 0, 0.2 + height - 0.15), team, chamfer=0.0)
    # Gold, stacked in bars on a pallet.
    bars = 2 + s // 2
    g.box((1.0, 0.8, 0.1), (1.6, 1.4, 0.05), "plank", chamfer=0.01)
    for k in range(bars):
        layer = k // 4
        i = k % 4
        g.box((0.4, 0.18, 0.12), (1.4 + (i % 2) * 0.42, 1.25 + (i // 2) * 0.32, 0.16 + layer * 0.13), "ore", (0, 0, (layer % 2) * 0.1), 0.02)
    for i in range(2 if s <= 5 else 3):
        g.cyl(0.24, 0.16, 0.42, (2.1, -0.3 + i * 0.5, 0.21), "canvas", sides=8)
    if s >= 9:
        lamps(g, [(1.1, -0.9, 2.4), (1.1, 0.9, 2.4)])
    flag(g, s, (-1.5, -1.5), 0.2 + lerp(1.9, 2.8, t) if s >= 4 else 0.0, 1.4 if s >= 4 else 2.6)
    return [g]


def timber_shed(s):
    t = (s - 1) / 9
    g = Group("body", seed=s)
    team = team_of(s)
    height = lerp(2.0, 2.8, t)
    hx, hy = 1.6, 1.5
    post = frame_of(s)
    for px in (-hx, hx):
        for py in (-hy, hy):
            g.beam((px, py, 0), (px, py, height), 0.18, 0.18, post)
    if s >= 5:
        panels(g, (-hx, -hy, 0), (-hx, hy, 0), 0, height, wall_of(s))
    if s <= 4:
        gable(g, (hx + 0.2, hy + 0.2), height, hy * 0.55, "plate")
        g.bar((-hx - 0.45, 0, height + hy * 0.55 + 0.03), (hx + 0.45, 0, height + hy * 0.55 + 0.03), 0.07, team, 8)
    else:
        slab(g, (hx + 0.3, hy + 0.3), height, team, 0.14)
    # Logs stacked inside, ends to the front.
    rows = 2 + min(3, s // 3)
    for row in range(rows):
        for i in range(rows - row + 1):
            y = (i - (rows - row) / 2) * 0.5
            g.bar((-hx + 0.3, y, 0.25 + row * 0.42), (hx - 0.1, y, 0.25 + row * 0.42), 0.22, "log", 9)
    if s >= 7:
        g.box((0.06, hy * 2, 0.22), (hx + 0.12, 0, height - 0.18), team, chamfer=0.0)
    if s >= 9:
        lamps(g, [(hx + 0.12, -hy + 0.2, height - 0.4), (hx + 0.12, hy - 0.2, height - 0.4)])
    return [g]


def stone_yard(s):
    t = (s - 1) / 9
    g = Group("body", seed=s)
    team = team_of(s)
    # A low wall round three sides, capped in paint once it's built properly.
    wall = "stone" if s <= 4 else "plate" if s <= 6 else "concrete"
    high = lerp(0.5, 0.9, t)
    edge = 2.3
    panels(g, (-edge, -edge, 0), (-edge, edge, 0), 0, high, wall, thick=0.3)
    for side in (-1, 1):
        panels(g, (-edge - 0.15, side * edge, 0), (edge, side * edge, 0), 0, high, wall, thick=0.3)
    if s >= 5:
        for a, b in (((-edge, -edge), (-edge, edge)), ((-edge, -edge), (edge, -edge)), ((-edge, edge), (edge, edge))):
            g.bar((*a, high + 0.05), (*b, high + 0.05), 0.08, team, 6)
    # Blocks, stacked high.
    stacks = ((-1.2, -1.1), (-1.2, 0.2), (0.2, -1.1), (0.2, 1.2), (-1.2, 1.3))
    for n, (x, y) in enumerate(stacks[: 3 + s // 4]):
        for k in range(1 + (n + s) % 3):
            g.box((0.95, 0.95, 0.5), (x, y, 0.25 + k * 0.5), "stone", (0, 0, 0.08 * ((n + k) % 3)), 0.04)
    if s >= 6:
        # A gantry to lift them, over the middle.
        top = lerp(2.4, 3.2, (s - 6) / 4)
        frame = frame_of(s)
        for side in (-1, 1):
            g.beam((-1.6, side * 1.9, 0), (-1.6, side * 1.9, top), 0.14, 0.14, frame)
            g.beam((1.2, side * 1.9, 0), (1.2, side * 1.9, top), 0.14, 0.14, frame)
            g.beam((-1.6, side * 1.9, top), (1.2, side * 1.9, top), 0.16, 0.16, frame)
        g.beam((-0.4, -2.0, top + 0.1), (-0.4, 2.0, top + 0.1), 0.18, 0.18, team)
        g.bar((-0.4, 0.2, top), (-0.4, 0.2, 1.8), 0.02, "gunmetal", 5)
    flag(g, s, (1.9, 1.9), 0.0, 2.0 + t)
    if s >= 9:
        lamps(g, [(-edge, -edge, high + 0.15), (-edge, edge, high + 0.15)])
    return [g]


def scrap_bin(s):
    t = (s - 1) / 9
    g = Group("body", seed=s)
    team = team_of(s)
    if s <= 3:
        for i, (x, y) in enumerate(((-1.0, -1.0), (-1.0, 0.0), (0.0, -1.0), (-1.0, 1.0), (0.0, 0.2))):
            if i >= 3 + s:
                break
            g.box((0.8, 0.8, 0.7), (x, y, 0.35), "plank" if i % 2 else "plankGrey", (0, 0, 0.15 * i), 0.012)
            g.box((0.82, 0.12, 0.72), (x, y, 0.35), team, (0, 0, 0.15 * i), 0.0)
    else:
        # Bins with painted lids, then a container behind them.
        for i, y in enumerate((-1.4, -0.5, 0.4)):
            g.box((0.9, 0.8, 0.9), (1.2, y, 0.45), "plate" if s <= 6 else "gunmetal", chamfer=0.03)
            g.box((0.95, 0.85, 0.08), (1.2, y, 0.94), team, (0, 0.12 * (i % 2), 0), 0.01)
        if s >= 7:
            g.box((1.4, 4.2, 1.5), (-1.2, 0, 0.75), team, chamfer=0.03)
            for k in range(7):
                g.box((1.42, 0.05, 1.3), (-1.2, -1.8 + k * 0.6, 0.75), "paintDark", chamfer=0.0)
            g.box((0.06, 1.2, 1.3), (-0.5, -1.2, 0.75), "gunmetal", chamfer=0.0)
        else:
            shed(g, s, (-1.0, 0), (1.0, 1.4), lerp(1.7, 2.2, t), door=0.9)
    flag(g, s, (1.9, 1.9), 0.0, 2.0 + t)
    if s >= 9:
        lamps(g, [(1.7, -1.4, 1.0), (1.7, 0.4, 1.0)])
    return [g]


def refinery(s):
    t = (s - 1) / 9
    g = Group("body", seed=s)
    team = team_of(s)
    tank = "plank" if s <= 3 else "plate" if s <= 6 else team
    spots = ((-1.8, -1.6, 1.0), (-1.8, 1.4, 0.9), (0.4, -1.9, 0.8))
    for i, (x, y, r) in enumerate(spots[: 2 + (s >= 4)]):
        h = (1.6 + i * 0.3) * (1 + 0.5 * t)
        g.cyl(r, r, h, (x, y, h / 2), tank, sides=14)
        g.cyl(r * 0.85, r * 0.3, 0.4, (x, y, h + 0.2), "gunmetal" if s >= 4 else "plankGrey", sides=14)
        for k in (0.25, 0.75):
            g.cyl(r + 0.03, r + 0.03, 0.12, (x, y, h * k), team if tank != team else "paintDark", sides=14, caps=False)
    # Pipes between them, and to the still.
    g.bar((-1.8, -1.6, 1.2), (-1.8, 1.4, 1.2), 0.1, "pipe", 8)
    g.bar((-1.8, -0.2, 1.2), (0.8, -0.2, 1.2), 0.1, "pipe", 8)
    # The still: a stack and its house.
    stack = lerp(3.4, 6.0, t)
    g.cyl(0.32, 0.26, stack, (1.3, 1.3, stack / 2), "stone" if s <= 3 else "plate" if s <= 6 else "concrete", sides=10)
    g.cyl(0.35, 0.35, 0.3, (1.3, 1.3, stack * 0.8), team, sides=10, caps=False)
    shed(g, s, (1.6, -0.6), (1.1, 1.0), lerp(1.7, 2.6, t), door=0.8)
    if s >= 9:
        lamps(g, [(1.3, 1.3, stack + 0.05)])
    flag(g, s, (2.8, 2.6), 0.0, 2.2 + t)
    return [g]


def laboratory(s):
    t = (s - 1) / 9
    g = Group("body", seed=s)
    parts = [g]
    team = team_of(s)
    height = lerp(1.9, 2.8, t)
    shed(g, s, (-0.3, 0), (1.4, 1.3), height, door=0.8)
    top = height + (1.3 * 0.55 if s <= 4 else 0.07)
    # A bench out front with its glassware.
    g.box((0.6, 1.2, 0.75), (1.75, -0.8, 0.38), "plank" if s <= 4 else "plate", chamfer=0.02)
    for i in range(3):
        g.cyl(0.08, 0.05, 0.22, (1.75, -1.2 + i * 0.35, 0.86), "glass", sides=8)
    if s >= 4:
        # A glass dome on the roof.
        dome = lerp(0.6, 0.9, t)
        g.cyl(dome, dome * 0.4, dome * 0.8, (-0.3, 0, top + dome * 0.4), "glass", sides=14)
        g.cyl(dome + 0.05, dome + 0.05, 0.12, (-0.3, 0, top + 0.06), team, sides=14)
    mast = (-1.3, 1.0)
    g.bar((*mast, top), (*mast, top + 1.4 + t), 0.04, "gunmetal", 6)
    g.box((0.04, 0.5, 0.04), (mast[0], mast[1], top + 1.2 + t), "gunmetal", chamfer=0.0)
    if s >= 7:
        # A dish that turns on its own.
        at = (0.7, -1.0, top)
        g.bar(at, (at[0], at[1], top + 0.5), 0.05, "gunmetal", 8)
        dish = Group("radar", pivot=(at[0], at[1], top + 0.5), seed=300, parent=g)
        dish.cyl(0.07, 0.07, 0.08, (at[0], at[1], top + 0.55), "gunmetal", sides=10)
        dish.cyl(0.45, 0.08, 0.2, (at[0] + 0.08, at[1], top + 0.7), "plate", (0.0, -0.45, 0), sides=16, caps=False)
        dish.cyl(0.05, 0.05, 0.08, (at[0] + 0.32, at[1], top + 0.82), "lamp", sides=8)
        parts.append(dish)
    if s >= 9:
        lamps(g, [(0.92, -0.6, height - 0.2), (0.92, 0.6, height - 0.2)])
    return parts


# --- Two more defenses. -------------------------------------------------------------------------


def flamethrower(s):
    t = FULL
    top = lerp(1.25, 2.4, t)
    body = Group("body", seed=s)
    head = Group("head", pivot=(0, 0, top), seed=100 + s)
    nozzle = Group("guns", pivot=(0, 0, top), seed=200 + s, parent=head)
    team = team_of(s)
    turret_base(body, s, top)
    # The fuel: two tanks riding on the mount, then a shielded housing.
    head.cyl(0.6, 0.62, 0.12, (0, 0, top + 0.06), "plankGrey" if s <= 4 else "plate", sides=16)
    for side in (-1, 1):
        r = lerp(0.2, 0.28, t)
        head.cyl(r, r, 1.0, (-0.35, side * (r + 0.05), top + 0.12 + r), team, (0, math.pi / 2, 0), sides=12)
        head.cyl(r * 0.6, r * 0.6, 0.1, (0.18, side * (r + 0.05), top + 0.12 + r), "gunmetal", (0, math.pi / 2, 0), sides=10)
    z = top + lerp(0.6, 0.85, t)
    if s >= 5:
        head.box((0.9, 0.9, 0.6), (-0.1, 0, z), team, chamfer=0.04)
        head.box((0.06, 1.0, 0.7), (0.4, 0, z), "plate" if s <= 6 else team, (0, -0.25, 0), 0.02)
    else:
        head.box((0.6, 0.5, 0.4), (-0.1, 0, z - 0.05), "plank" if s <= 2 else "plankGrey", chamfer=0.02)
    length = lerp(1.2, 1.7, t)
    nozzle.bar((0.0, 0, z), (length, 0, z), lerp(0.08, 0.11, t), "gunmetal", 10)
    nozzle.cyl(0.14, 0.1, 0.22, (length, 0, z), "gunmetal", (0, math.pi / 2, 0), sides=10)
    nozzle.bar((0.2, 0, z - 0.12), (length - 0.1, 0, z - 0.12), 0.03, "pipe", 6)
    if s >= 3:
        nozzle.cyl(0.04, 0.04, 0.06, (length + 0.05, 0, z - 0.12), "lamp", (0, math.pi / 2, 0), sides=6)
    nozzle.points["muzzle0"] = (length + 0.15, 0, z)
    parts = [body, head, nozzle]
    grow(parts, GROW, 0.24 if s >= 7 else 0.0)
    turret_ground(body, s)
    return parts


def watchtower(s):
    t = FULL
    top = lerp(4.2, 6.2, t)
    body = Group("body", seed=s)
    head = Group("head", pivot=(0, 0, top), seed=100 + s)
    rifle = Group("guns", pivot=(0, 0, top), seed=200 + s, parent=head)
    team = team_of(s)
    spread = 1.2
    if s <= 4:
        # Log legs leaning in, braced, with a ladder up the back.
        for dx in (-1, 1):
            for dy in (-1, 1):
                body.beam((dx * spread, dy * spread, 0), (dx * 0.8, dy * 0.8, top), 0.2, 0.2, "log")
        for z in (top * 0.35, top * 0.7):
            k = 1 - z / top * 0.33
            for a, b in (((-1, -1), (1, -1)), ((-1, 1), (1, 1)), ((-1, -1), (-1, 1)), ((1, -1), (1, 1))):
                body.bar((a[0] * spread * k, a[1] * spread * k, z), (b[0] * spread * k, b[1] * spread * k, z), 0.06, "plankGrey", 6)
        for side in (-1, 1):
            body.beam((-spread - 0.4, side * 0.25, 0), (-0.95, side * 0.25, top), 0.06, 0.05, "plankGrey")
        if s >= 3:
            panels(body, (-0.85, -0.85, top * 0.62), (-0.85, 0.85, top * 0.62), top * 0.62, top * 0.3, "plank")
    else:
        # A square tower, then a tapered concrete one, banded in paint.
        walls = "plate" if s <= 6 else "concrete"
        body.cyl(1.25, 0.95, top - 0.1, (0, 0, (top - 0.1) / 2), walls, (0, 0, math.pi / 4), sides=4)
        for k in (0.3, 0.7):
            body.cyl(1.25 - 0.3 * k + 0.04, 1.25 - 0.3 * k - 0.02, 0.3, (0, 0, top * k), team, (0, 0, math.pi / 4), sides=4, caps=False)
        body.box((0.06, 0.7, 1.3), (0.88, 0, 0.65), team, chamfer=0.01)
        if s >= 7:
            for k in range(3):
                body.box((0.06, 0.35, 0.2), (0.84 - k * 0.05, 0, top * (0.35 + k * 0.2)), "glass", chamfer=0.0)
    # The platform, with a parapet round it.
    deck(body, 2.0, top - 0.04, "plank" if s <= 4 else "plankGrey")
    rail = "plankGrey" if s <= 2 else "plank" if s <= 4 else team
    for a, b in (((-1, -1), (1, -1)), ((-1, 1), (1, 1)), ((-1, -1), (-1, 1))):
        body.box((abs(b[0] - a[0]) * 1.0 + 0.1, abs(b[1] - a[1]) * 1.0 + 0.1, 0.45), ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, top + 0.22), rail, chamfer=0.01)
    # The rifle, on a swivel, with its scope and a shield.
    z = top + 0.75
    head.cyl(0.3, 0.34, 0.25, (0, 0, top + 0.12), "plankGrey" if s <= 4 else "gunmetal", sides=12)
    head.box((0.5, 0.3, 0.3), (-0.15, 0, z - 0.12), team, chamfer=0.03)
    length = lerp(1.6, 2.2, t)
    rifle.bar((-0.4, 0, z), (length, 0, z), 0.05, "gunmetal", 8)
    rifle.cyl(0.07, 0.07, 0.45, (0.1, 0, z + 0.14), "gunmetal", (0, math.pi / 2, 0), sides=8)
    rifle.cyl(0.05, 0.05, 0.04, (0.34, 0, z + 0.14), "glass", (0, math.pi / 2, 0), sides=8)
    rifle.points["muzzle0"] = (length + 0.08, 0, z)
    if s >= 5:
        head.box((0.06, 0.8, 0.45), (0.45, 0, z - 0.1), team, (0, -0.2, 0), 0.02)
    flag(body, s, (-0.9, 0.9), top + 0.4, 1.3)
    if s >= 9:
        lamps(body, [(1.0, -1.0, top + 0.5), (1.0, 1.0, top + 0.5)])
    parts = [body, head, rifle]
    turret_ground(body, s)
    return parts


BUILDINGS.update(
    {
        "flamethrower": flamethrower,
        "watchtower": watchtower,
        "goldMine": gold_mine,
        "lumberCamp": lumber_camp,
        "quarry": quarry,
        "scrapYard": scrap_yard,
        "goldVault": gold_vault,
        "timberShed": timber_shed,
        "stoneYard": stone_yard,
        "scrapBin": scrap_bin,
        "refinery": refinery,
        "laboratory": laboratory,
    }
)


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
        place = Matrix.Translation(g.pivot) @ g.tilt.to_matrix().to_4x4()
        bmesh.ops.transform(copy, matrix=place, verts=copy.verts)
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
        tilt = g.tilt.to_matrix()
        for face in g.bm.faces:
            for loop in face.loops:
                normal = tilt @ g.normal_of(loop)
                at = tilt @ loop.vert.co + g.pivot + normal * 0.012
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


def build(name, sheet, crew=False):
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
            pivot.rotation_euler = g.tilt
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
        render_sheet(name, made, "enemy" if name in BUILDINGS and not crew else "crew")


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
    # Room for each look: a headquarters is twice the width of a turret.
    grow = 1.75 if name == "headquarters" else 1.0
    spacing = 6.5 * grow
    for i, holder in enumerate(holders):
        holder.location = ((i % 5) * spacing, -(i // 5) * spacing * 1.05, 0)
        if name not in BUILDINGS and i > 0:
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
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=60 * grow)
    bm.to_mesh(ground)
    bm.free()
    floor = bpy.data.objects.new("ground", ground)
    floor.location = (13 * grow, -3 * grow, 0)
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
    camera.data.ortho_scale = 34 * grow
    camera.location = (13 * grow, -32 * grow, 30 * grow)
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
    painted = "-crew" if side == "crew" and name in BUILDINGS else ""
    scene.render.filepath = os.path.join(OUT, f"{name}{painted}-sheet.png")
    bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    names = [a for a in args if not a.startswith("--")] or [*BUILDINGS, *MODELS]
    for name in names:
        build(name, "--sheet" in args, "--crew" in args)


main()
