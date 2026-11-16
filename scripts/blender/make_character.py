"""Builds one of the story's people from scratch (docs/CHARACTERS.md).

  blender -b -P scripts/blender/make_character.py -- captain --look models-wip/look/captain

Two things go in. The base is Blender Studio's stylized man (Human Base Meshes, CC0, kept in
models-wip/bases): a clean body with eyelids, lips, the inside of a mouth and every finger, marked
by region, which can be made to move. The design is the owner's drawing turned into a rough shape in
3D (character_target.py), which can't move but has the right face.

The base is wrapped onto the design: its eyes and mouth are put where the drawing has them, then
its skin is drawn onto the design's surface a little at a time, the lids and the inside of the
mouth left alone so they still work. The face then gets its shapes (blink, smile, jaw and the rest,
named as ARKit names them). The beard and brows are cut out of the face's own surface where the
design is coloured as hair, raised, and coloured from the design; the hair is the design's own, cut
free. Each is its own piece.

Places on the head are given in "face units": from the point between the eyes, in metres on the
base's own head (whose eyes are 0.088 apart), x to his left, y to the back, z up.

So far this makes the head and renders it to look at (--look). The body, clothes, textures and the
model the game loads come next.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from character_export import Space, Writer, eye_picture, thin  # noqa: E402
from character_target import Drawing, Target  # noqa: E402

ROOT = os.path.join(HERE, "..", "..")
BASE = os.path.join(
    ROOT, "models-wip", "bases", "hbm", "human-base-meshes-bundle-v1.4.1",
    "human_base_meshes_bundle.blend",
)
# The base's regions (its sculpting face sets).
NECK, ORBIT, LIDS, EARS, SOCKET, SKULL, NOSE, JAW, MOUTH_UP, MOUTH_LOW, THROAT = (
    6, 27, 28, 29, 37, 44, 45, 46, 47, 48, 49,
)
HEAD = {ORBIT, LIDS, EARS, SOCKET, SKULL, NOSE, JAW, MOUTH_UP, MOUTH_LOW, THROAT}
# The rest of the body's regions, and each finger's three, from the palm out.
CHEST, BELLY, SHOULDER, UPPER_ARM, FOREARM, PALM, THENAR = 259, 258, 260, 263, 262, 273, 359
THIGH, SHIN, ANKLE = 256, 257, 288
FOOT = {316, 317, 318, 319, 320, 321, 322}
FINGERS = {
    "thumb": (359, 285, 284),
    "index": (278, 283, 282),
    "middle": (277, 279, 272),
    "ring": (280, 274, 275),
    "pinky": (281, 286, 276),
}
HAND = {PALM, *[r for f in FINGERS.values() for r in f]}
INSIDE = {MOUTH_UP, MOUTH_LOW, THROAT}
# The distance between the base head's eyes.
EYES_APART = 0.088
# How big its eyeballs are, on a head that size.
EYE_RADIUS = 0.0367

CAPTAIN = {
    "design": os.path.join(ROOT, "models-wip", "captain-raw.glb"),
    # The flat drawings, and where his eyes are in them (pixels): right then left in the front
    # one, the front of the eye in the side one.
    "front": os.path.join(ROOT, "docs", "concept", "tpose", "captain-front.jpg"),
    "side": os.path.join(ROOT, "docs", "concept", "tpose", "captain-side.jpg"),
    "front_eyes": ((956.0, 234.3), (1044.3, 234.3)),
    "side_eye": (926.0, 234.3),
    "iris": (0.20, 0.10, 0.04),
    # The drawing's own colours, which the design's are brought to (it came out darker).
    "skin": (0.93, 0.70, 0.59),
    "blush": (0.95, 0.60, 0.53),
    "lip": (0.80, 0.47, 0.42),
    "hair": (0.93, 0.80, 0.50),
    "beard": (0.76, 0.60, 0.38),
    # Read off the flat drawing, which the 3D design doesn't keep to: its eyes sit closer.
    # Half the face's width at the mouth, which sizes the design to the base.
    "face_half": 0.096,
    "eye_size": 0.78,
    "eyes_apart": 0.006,
    "mouth_z": -0.078,
    "mouth_half": 0.047,
    "lids": 0.03,
    "beard_thick": 0.0045,
    "brow_thick": 0.0075,
    # How many chunks his hair swings in.
    "hair_chunks": 12,
    # Where the design's joints are, as shares of its height: [out to the side, up, forward].
    "joints": {
        "hip": (0.072, 0.27, -0.02),
        "knee": (0.075, 0.14, -0.035),
        "ankle": (0.08, 0.06, -0.04),
        "toe": (0.09, 0.02, 0.07),
        "waist": (0, 0.45, -0.01),
        "neck": (0, 0.69, 0),
        "shoulder": (0.145, 0.61, -0.01),
        "elbow": (0.3, 0.6, -0.01),
        "wrist": (0.42, 0.585, -0.01),
        "fingers": (0.535, 0.57, -0.01),
    },
    # How much thicker or thinner each part is than the base's, once it's the design's length.
    "girth": {"upper": (0.85, 0.95), "lower": (0.85, 0.95), "arm": 1.05, "fore": 1.0, "leg": 0.65,
              "knee": 0.95, "hand": 0.95},
    # His clothes, cut from the design: what colour each is, and between which heights (shares
    # of his height) and how far out to the side it's found.
    "clothes": {
        "shirt": {"is": "cloth", "up": (0.38, 0.75), "colour": (0.62, 0.77, 0.91)},
        "trousers": {"is": "white", "up": (0.045, 0.47), "colour": (0.93, 0.92, 0.89)},
        "belt": {"is": "other", "up": (0.378, 0.413), "out": (0, 0.14), "colour": (0.42, 0.27, 0.2),
                 "thick": 0.006, "keep": 0.9},
        "shoes": {"is": "any", "up": (-0.01, 0.062), "colour": (0.48, 0.3, 0.21), "keep": 0.9},
        "watch": {"is": "dark", "up": (0.54, 0.63), "out": (0.31, 0.41), "side": 1,
                  "colour": (0.2, 0.2, 0.22), "thick": 0.006, "keep": 0.8},
    },
}


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def flat(name, colour, rough=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*colour, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def add_mesh(name, verts, faces, material, level=1):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.update()
    for p in mesh.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    mesh.materials.append(material)
    if level:
        sub = o.modifiers.new("smooth", "SUBSURF")
        sub.levels = sub.render_levels = level
    return o


class Base:
    """The base mesh, its regions, and where its eyes are."""

    def __init__(self, whole):
        names = (
            ["GEO-body_male_stylized", "GEO-body_male_stylized.eye.L", "GEO-body_male_stylized.eye.R"]
            if whole
            else ["GEO-head_stylized", "GEO-head_stylized.eye.L", "GEO-head_stylized.eye.R"]
        )
        with bpy.data.libraries.load(BASE) as (src, dst):
            dst.objects = names
        scene = bpy.context.scene
        for o in dst.objects:
            scene.collection.objects.link(o)
        bpy.context.view_layer.update()
        self.object, *eyes = dst.objects
        self.mesh = self.object.data
        # Stood where its own middle is, so left and right are the sign of x.
        self.mesh.transform(self.object.matrix_world)
        home = Vector((self.object.matrix_world.translation.x, 0, 0))
        centres = []
        for eye in eyes:
            corners = [eye.matrix_world @ Vector(c) for c in eye.bound_box]
            centres.append(sum(corners, Vector()) / 8)
            self.eye_radius = min(eye.dimensions) / 2
            bpy.data.objects.remove(eye)
        self.object.matrix_world.identity()
        xs = [v.co.x for v in self.mesh.vertices]
        shift = (max(xs) + min(xs)) / 2
        for v in self.mesh.vertices:
            v.co.x -= shift
        self.eyes = sorted((c - Vector((shift, 0, 0)) for c in centres), key=lambda c: -c.x)
        del home
        # Left is his left, +x. The two are made exact mirrors of each other.
        mid = (self.eyes[0] + Vector((-self.eyes[1].x, self.eyes[1].y, self.eyes[1].z))) / 2
        self.eyes = [mid, Vector((-mid.x, mid.y, mid.z))]
        self.unit = (2 * mid.x) / EYES_APART
        # The whole body's head is a little smaller than the head on its own, its eyeballs not.
        self.eye_radius = EYE_RADIUS * self.unit
        self.eye_radius_base = self.eye_radius
        self.origin = Vector((0, mid.y, mid.z))
        sets = self.mesh.attributes[".sculpt_face_set"].data
        self.face_region = [sets[p.index].value for p in self.mesh.polygons]
        self.region = [set() for _ in self.mesh.vertices]
        for p in self.mesh.polygons:
            for vi in p.vertices:
                self.region[vi].add(self.face_region[p.index])
        self.near = [[] for _ in self.mesh.vertices]
        for e in self.mesh.edges:
            a, b = e.vertices
            self.near[a].append(b)
            self.near[b].append(a)
        self.head = [i for i, r in enumerate(self.region) if r & HEAD]
        self.eye_fit = [self.rim(side) for side in (1, -1)]
        self.eye_fit = [(self.eyes[k] - c, self.eye_radius / r) for k, (c, r) in enumerate(self.eye_fit)]
        print("MAKE base", len(self.mesh.vertices), "points, eyes", [tuple(round(c, 4) for c in e) for e in self.eyes],
              "radius", round(self.eye_radius, 4), "unit", round(self.unit, 3))

    # Places on the head are given in "face units": from the point between the eyes, in shares
    # of the base's eye spacing, x to his left, y to the back, z up.
    def q(self, p):
        return (p - self.origin) / self.unit

    def p(self, q):
        return self.origin + q * self.unit

    def shared(self, a, b):
        return [i for i, r in enumerate(self.region) if a in r and b in r]

    def co(self, i):
        return self.mesh.vertices[i].co

    def rim(self, side):
        """The middle and the size of the opening between one eye's lids."""
        pts = [self.co(i) for i in self.shared(LIDS, SOCKET) if self.co(i).x * side > 0]
        centre = sum(pts, Vector()) / len(pts)
        return centre, sum((p - centre).length for p in pts) / len(pts)

    def find_eyes(self):
        """Where the eyeballs belong and how big, from the lids as they are now."""
        found = []
        for k, side in enumerate((1, -1)):
            centre, size = self.rim(side)
            offset, ratio = self.eye_fit[k]
            grown = size * ratio / self.eye_radius_base
            found.append((centre + offset * grown, size * ratio))
        left, right = found
        mid = (left[0] + Vector((-right[0].x, right[0].y, right[0].z))) / 2
        mid += Vector((-0.0012, 0.001, 0)) * self.unit
        self.eyes = [mid, Vector((-mid.x, mid.y, mid.z))]
        self.eye_radius = (left[1] + right[1]) / 2 * 0.95

    def jaw_weights(self):
        """How much of the jaw's swing each point takes: all of it on the chin and the floor of
        the mouth, none above the lips, blending over the cheeks."""
        region = self.region
        w = [1.0 if r and r <= {JAW, MOUTH_LOW} else 0.0 for r in region]
        fixed = [
            bool(r & {MOUTH_UP, NOSE}) or (MOUTH_LOW in r and JAW not in r and THROAT not in r)
            for r in region
        ]
        start = list(w)
        for _ in range(10):
            nxt = list(w)
            for i in self.head:
                if fixed[i]:
                    nxt[i] = start[i]
                elif self.near[i]:
                    nxt[i] = 0.5 * w[i] + 0.5 * sum(w[j] for j in self.near[i]) / len(self.near[i])
            w = nxt
        return w

    def lips(self):
        """The lip line's height, how far forward the lips are, and the corners' half-width."""
        ends = [self.q(self.co(i)) for i in self.shared(MOUTH_UP, JAW)]
        z = sum(e.z for e in ends) / len(ends)
        half = sum(abs(e.x) for e in ends) / len(ends)
        front = min(self.q(self.co(i)).y for i in self.shared(MOUTH_UP, SKULL))
        back = sum(e.y for e in ends) / len(ends)
        return z, front, half, back


def place_features(base, who, chin_to):
    """Puts the eyes and the mouth where the drawing has them, and the chin as low as the
    design's (`chin_to`, in face units), before the skin is fitted."""
    mesh = base.mesh
    Q = [base.q(v.co) for v in mesh.vertices]
    head = base.head

    def write():
        for i, q in enumerate(Q):
            mesh.vertices[i].co = base.p(q)

    # The eyes: smaller, and further apart. Nothing moves on the middle line.
    s = who["eye_size"]
    for side in (1, -1):
        c = Vector((side * EYES_APART / 2, 0, 0))
        for i in head:
            q = Q[i]
            if q.x * side <= 0:
                continue
            d = (q - c).length
            if d > 0.08:
                continue
            keep = smooth(0.0, 0.012, abs(q.x))
            sigma = s + (1 - s) * smooth(0.037, 0.064, d)
            carried = 1 - smooth(0.037, 0.078, d)
            Q[i] = q + keep * ((c - q) * (1 - sigma) + Vector((side * who["eyes_apart"] * carried, 0, 0)))
    write()
    base.find_eyes()

    # The mouth's height: everything below the eyes comes up or goes down with it.
    lip_z, lip_front, lip_half, lip_back = base.lips()
    rise = who["mouth_z"] - lip_z
    for q in Q:
        q.z += rise * smooth(-0.028, -0.07, q.z)

    # The chin: the jaw stretched down from the lips to where the design's chin is. Left short,
    # the skin of the neck would be drawn over the chin in its place.
    write()
    lip_z, lip_front, lip_half, lip_back = base.lips()
    jaw = base.jaw_weights()
    chin = min(Q[i].z for i in head if JAW in base.region[i] and Q[i].y < lip_front + 0.05)
    drop = chin - chin_to
    if drop > 0:
        for i in head:
            if jaw[i] > 0 and Q[i].z < lip_z:
                Q[i].z -= min((lip_z - Q[i].z) * drop / (lip_z - chin), drop) * jaw[i]
    print("MAKE chin from", round(chin, 4), "to", round(chin_to, 4))

    # The base's lips rest a little apart, which shows his teeth. The lower lip comes up to meet
    # the upper one.
    write()
    lip_z, lip_front, lip_half, lip_back = base.lips()
    upper = [Q[i].z for i in base.shared(MOUTH_UP, SKULL) if abs(Q[i].x) < 0.012]
    lower = [Q[i].z for i in base.shared(MOUTH_LOW, JAW) if abs(Q[i].x) < 0.012]
    if upper and lower:
        apart = min(upper) - max(lower)
        if apart > 0:
            for i in head:
                if jaw[i] > 0 and Q[i].z < lip_z + 0.002:
                    Q[i].z += apart * jaw[i] * math.exp(-(((lip_z - Q[i].z) / 0.02) ** 2))
            print("MAKE lips closed by", round(apart, 4))

    # The base's own nose is smoothed away to bare cheek: the design's is drawn out of that.
    inner = [i for i in head if base.region[i] == {NOSE}]
    for _ in range(260):
        moved = {i: sum((Q[j] for j in base.near[i]), Vector()) / len(base.near[i]) for i in inner}
        for i, q in moved.items():
            Q[i] = q

    # The mouth's width.
    write()
    lip_z, lip_front, lip_half, lip_back = base.lips()
    grow = who["mouth_half"] / lip_half - 1
    centre = Vector((0, (lip_front + lip_back) / 2, lip_z))
    for i in head:
        q = Q[i]
        d = Vector((q.x * 0.55, q.y - centre.y, q.z - centre.z)).length
        q.x *= 1 + grow * math.exp(-((d / 0.04) ** 2))
    write()
    mesh.update()


def lay_design(base, who):
    """Reads the design and lays it over the base: sized by the face's width, its eye line on
    the base's, its painted eyes on the fronts of the base's eyeballs."""
    design = Target(who["design"])
    m = design.marks
    scale = who["face_half"] * base.unit / m["jaw_half"]
    eye = Vector((m["mid"], (m["eyes"][0].y + m["eyes"][1].y) / 2, m["eye_z"]))
    here = Vector((0, base.eyes[0].y - base.eye_radius, base.origin.z))
    design.fit(scale, here - eye * scale)
    print("MAKE design scale", round(scale, 4), "eyes apart there", round(m["apart"] * scale, 4))
    return design


def wrap(base, design, drawing, who, rounds=18):
    """Draws the base's skin onto the design's surface, a little at a time, the pull spread over
    neighbours so the skin keeps its even weave. Lids, eye sockets, ears and the inside of the
    mouth aren't pulled: they ride along. Under the design's hair and brows the skin only gets out
    of the way; under its beard it stops a beard's thickness short."""
    mesh, u = base.mesh, base.unit
    ids = [i for i, r in enumerate(base.region) if r & (HEAD | {NECK})]
    place = {i: k for k, i in enumerate(ids)}
    near = [[place[j] for j in base.near[i] if j in place] for i in ids]
    middle = base.p(Vector((0, 0.085, 0.02)))
    still = [bool(base.region[i] & (INSIDE | {SOCKET, LIDS})) or base.region[i] == {EARS} for i in ids]
    # The lips keep their shape and thickness: the skin within a few steps of their edges isn't
    # pulled either.
    edge = {i for i in ids if base.region[i] & INSIDE and not base.region[i] <= INSIDE}
    zone = set(edge)
    for _ in range(3):
        zone |= {j for i in zone for j in base.near[i] if not base.region[j] & INSIDE}
    still = [flag or i in zone for flag, i in zip(still, ids)]
    # The inside of the mouth goes with the lips' edges, each eye's socket with its lids, whole.
    bag = [k for k, i in enumerate(ids) if base.region[i] <= INSIDE]
    lips = [k for k, i in enumerate(ids) if base.region[i] & INSIDE and not base.region[i] <= INSIDE]
    sockets = [
        ([k for k, i in enumerate(ids) if base.region[i] == {SOCKET} and base.co(i).x * side > 0],
         [k for k, i in enumerate(ids) if LIDS in base.region[i] and base.co(i).x * side > 0])
        for side in (1, -1)
    ]
    for step in range(rounds):
        mesh.update()
        reach = (0.055 - 0.03 * step / rounds) * u
        pull = [None] * len(ids)
        weight = [0.0] * len(ids)
        for k, i in enumerate(ids):
            if still[k]:
                continue
            v = mesh.vertices[i]
            p, n = v.co, v.normal
            best = None
            for d in (n, -n):
                hit = design.ray(p, d)
                if hit and (hit[0] - p).length < reach and (best is None or (hit[0] - p).length < best[3]):
                    best = (*hit, (hit[0] - p).length)
            close = design.nearest(p, reach)
            if close and (best is None or close[3] < best[3] * 0.6):
                best = close
            if best is None:
                continue
            at, normal, colour, _ = best
            if normal.dot(at - middle) < 0:
                normal = -normal
            if Target.cloth(colour) or Target.eye(colour):
                continue
            q = base.q(p)
            w = 1.0
            drawn = drawing.colour(q, n)
            hairy = Drawing.kind(drawn) == "hair" if drawn else Target.hairy(colour)
            if hairy:
                if q.z > -0.004:
                    # Hair or a brow lies over this: the skin only has to stay under it.
                    if (p - at).dot(normal) < -0.002 * u:
                        continue
                    at = at - normal * (0.003 * u)
                    w = 0.5
                else:
                    at = at - normal * (who["beard_thick"] * u)
            if ORBIT in base.region[i]:
                w *= 0.4
            if NECK in base.region[i]:
                w *= 0.5
            pull[k] = at - p
            weight[k] = w
        hold = 0.12 * 1.36**step
        move = [pull[k] * 1.0 if pull[k] is not None else Vector() for k in range(len(ids))]
        for _ in range(26):
            nxt = []
            for k in range(len(ids)):
                if near[k]:
                    mean = sum((move[j] for j in near[k]), Vector()) / len(near[k])
                else:
                    mean = move[k]
                w = weight[k] * hold
                nxt.append((pull[k] * w + mean) / (w + 1) if w > 0 else mean)
            move = nxt
        if lips:
            carried = sum((move[k] for k in lips), Vector()) / len(lips)
            for k in bag:
                move[k] = carried
        for inner, lids in sockets:
            if lids:
                carried = sum((move[k] for k in lids), Vector()) / len(lids)
                for k in inner:
                    move[k] = carried
        for k, i in enumerate(ids):
            mesh.vertices[i].co = mesh.vertices[i].co + move[k] * 0.8
    mesh.update()
    base.find_eyes()
    base.origin = Vector((0, base.eyes[0].y, base.eyes[0].z))


def soften(base, times=4):
    """Fitting leaves a ridge round each eye, where the skin that was pulled meets the skin that
    wasn't. The cheeks, the brow and the temples are evened out; lids, lips, nose and ears keep
    their shape."""
    mesh = base.mesh
    lip_z, lip_front, lip_half, _ = base.lips()
    soft = []
    for i in base.head:
        r = base.region[i]
        if r & (INSIDE | {SOCKET, LIDS, EARS}) or not r & {ORBIT, SKULL, JAW, NOSE}:
            continue
        q = base.q(base.co(i))
        if q.y > 0.03 or not -0.075 < q.z < 0.075:
            continue
        if abs(q.x) < lip_half + 0.012 and abs(q.z - lip_z) < 0.02:
            continue
        soft.append(i)
    for _ in range(times):
        moved = {}
        for i in soft:
            near = base.near[i]
            mean = sum((base.co(j) for j in near), Vector()) / len(near)
            moved[i] = base.co(i).lerp(mean, 0.5)
        for i, p in moved.items():
            mesh.vertices[i].co = p
    mesh.update()


def tuck_ears(base, much=0.6):
    """Widening the head carries the ears out with it. Each is brought back in towards where it
    joins the head."""
    mesh = base.mesh
    for side in (1, -1):
        root = [base.co(i) for i in base.shared(EARS, SKULL) if base.co(i).x * side > 0]
        if not root:
            continue
        hold = sum(root, Vector()) / len(root)
        for i in base.head:
            if EARS in base.region[i] and base.co(i).x * side > 0:
                p = mesh.vertices[i].co
                out = (p.x - hold.x) * side
                if out > 0:
                    p.x = hold.x + side * out * much
    mesh.update()


def tuck_mouth(base):
    """After the face is fitted, the inside of the mouth can be left wider than the cheeks it's
    in. Any of it that would show is drawn back inside the skin."""
    from mathutils.bvhtree import BVHTree

    mesh, u = base.mesh, base.unit
    verts = [v.co.copy() for v in mesh.vertices]
    skin = [tuple(p.vertices) for p in mesh.polygons
            if base.face_region[p.index] in HEAD - INSIDE - {SOCKET}]
    tree = BVHTree.FromPolygons(verts, skin)
    lip_z, lip_front, lip_half, lip_back = base.lips()
    centre = base.p(Vector((0, lip_back + 0.025, lip_z)))
    moved = 0
    for i, r in enumerate(base.region):
        if not r or not r <= INSIDE:
            continue
        out = mesh.vertices[i].co - centre
        far = out.length
        if far < 1e-6:
            continue
        hit = tree.ray_cast(centre, out / far)
        if hit[0] is None:
            continue
        room = (hit[0] - centre).length - 0.005 * u
        if far > room:
            mesh.vertices[i].co = centre + out / far * max(0.25 * far, room)
            moved += 1
    mesh.update()
    print("MAKE mouth tucked in at", moved, "points")


def linear(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def tone(name):
    """A material coloured by the piece's own "tone", point by point."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.62
    a = m.node_tree.nodes.new("ShaderNodeAttribute")
    a.attribute_name = "tone"
    m.node_tree.links.new(a.outputs["Color"], b.inputs["Base Color"])
    return m


def brought_to(colours, wanted, keep=1.0):
    """Colours (as drawn on screen) shifted so their average is `wanted`, their differences kept
    by `keep`: returned as light, which is what a material wants."""
    lit = [Vector(linear(c)) for c in colours]
    mean = sum(lit, Vector()) / len(lit)
    goal = Vector(linear(wanted))
    gain = Vector((goal.x / mean.x, goal.y / mean.y, goal.z / mean.z))
    out = []
    for c in lit:
        even = mean + (c - mean) * keep
        out.append((even.x * gain.x, even.y * gain.y, even.z * gain.z))
    return out


def hair_zone(base, q, region):
    """What kind of hair, if any, can grow at a point of the head: "brow", "beard", "scalp" or
    None. The drawings laid over a head never fit to the last hair, so a stray patch of hair
    colour on a cheek or an ear is not believed."""
    if region & (INSIDE | {SOCKET, LIDS, EARS, NECK, NOSE}):
        return None
    if 0.004 < q.z < 0.062 and q.y < -0.012 and abs(q.x) < 0.095:
        return "brow"
    if q.z > 0.066 or (q.y > 0.03 and q.z > 0.0) or (q.y > 0.1 and q.z > -0.045):
        return "scalp"
    if q.z < -0.004 or (0.012 < q.y < 0.09 and q.z < 0.04):
        return "beard"
    return None


def raise_hair(base, drawing, who):
    """The beard, the brows and the short hair at the sides are the face's own skin, raised a
    little where the drawing has them. Nothing is laid on, so nothing can sit wrong, and it all
    moves as the face moves."""
    mesh, u = base.mesh, base.unit
    mesh.update()
    score = [0.0] * len(mesh.vertices)
    zone = [None] * len(mesh.vertices)
    for i in base.head:
        v = mesh.vertices[i]
        q = base.q(v.co)
        zone[i] = hair_zone(base, q, base.region[i])
        if zone[i] is None:
            continue
        score[i] = drawing.cover(q, v.normal) or 0.0
    for _ in range(1):
        score = [
            (score[i] + sum(score[j] for j in base.near[i])) / (1 + len(base.near[i]))
            if base.near[i] else score[i]
            for i in range(len(score))
        ]
    thick = {"brow": who["brow_thick"], "beard": who["beard_thick"], "scalp": 0.002}
    for i in base.head:
        on = smooth(0.35, 0.7, score[i])
        if on <= 0 or zone[i] is None:
            continue
        v = mesh.vertices[i]
        v.co = v.co + v.normal * (thick[zone[i]] * u * on)
    mesh.update()


def paint_face(base, drawing, who, path, size=1024):
    """The picture that colours the head. It's painted clean, not copied: plain skin with a
    blush on the cheeks, nose and ears, and the beard, the brows and the short hair filled in
    where the drawings have them, each only where it can grow. The drawings give the outlines and
    the strokes in the beard; their shading is left behind, since the game lights him itself."""
    import numpy as np

    mesh = base.mesh
    mesh.update()
    uv = mesh.uv_layers.active.data
    hair = np.zeros((size, size), dtype=np.float32)
    stroke = np.ones((size, size), dtype=np.float32)
    kind = np.zeros((size, size), dtype=np.int8)
    place = np.zeros((size, size, 3), dtype=np.float32)
    known = np.zeros((size, size), dtype=bool)
    inside = np.zeros((size, size), dtype=bool)
    lip = np.zeros((size, size), dtype=np.float32)
    KINDS = {None: 0, "brow": 1, "beard": 2, "scalp": 3}
    lip_z, lip_front, lip_half, lip_back = base.lips()
    for p in mesh.polygons:
        region = base.face_region[p.index]
        if region not in HEAD and region != NECK:
            continue
        loops = list(p.loop_indices)
        for a in range(1, len(loops) - 1):
            corners = (loops[0], loops[a], loops[a + 1])
            t = np.array([uv[li].uv[:] for li in corners]) * size
            x0, x1 = int(max(0, np.floor(t[:, 0].min()))), int(min(size - 1, np.ceil(t[:, 0].max())))
            y0, y1 = int(max(0, np.floor(t[:, 1].min()))), int(min(size - 1, np.ceil(t[:, 1].max())))
            if x1 < x0 or y1 < y0:
                continue
            d = (t[1, 1] - t[2, 1]) * (t[0, 0] - t[2, 0]) + (t[2, 0] - t[1, 0]) * (t[0, 1] - t[2, 1])
            if abs(d) < 1e-9:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            w0 = ((t[1, 1] - t[2, 1]) * (gx - t[2, 0]) + (t[2, 0] - t[1, 0]) * (gy - t[2, 1])) / d
            w1 = ((t[2, 1] - t[0, 1]) * (gx - t[2, 0]) + (t[0, 0] - t[2, 0]) * (gy - t[2, 1])) / d
            w2 = 1 - w0 - w1
            verts = [mesh.vertices[mesh.loops[li].vertex_index] for li in corners]
            for j, i in zip(*np.nonzero((w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02))):
                y, x = y0 + int(j), x0 + int(i)
                known[y, x] = True
                if region in INSIDE:
                    inside[y, x] = True
                    continue
                b = (float(w0[j, i]), float(w1[j, i]), float(w2[j, i]))
                at = verts[0].co * b[0] + verts[1].co * b[1] + verts[2].co * b[2]
                way = verts[0].normal * b[0] + verts[1].normal * b[1] + verts[2].normal * b[2]
                q = base.q(at)
                place[y, x] = q
                zone = hair_zone(base, q, {region})
                kind[y, x] = KINDS[zone]
                covered = drawing.cover(q, way)
                if zone is not None:
                    # No drawing shows the back of the head: short hair above the nape.
                    hair[y, x] = 1.0 if covered is None and zone == "scalp" else covered or 0.0
                    continue
                drawn = drawing.colour(q, way)
                if drawn is None:
                    continue
                if abs(q.x) < lip_half and abs(q.z - lip_z) < 0.012 and q.y < lip_front + 0.02:
                    # The drawn line of the mouth: redder and darker than the skin round it.
                    h, sat, v = __import__("colorsys").rgb_to_hsv(*drawn)
                    lip[y, x] = smooth(0.42, 0.55, sat) * (1.0 if h < 0.06 else 0.0)

    def blur(a, times):
        for _ in range(times):
            total = np.zeros_like(a)
            count = np.zeros((size, size), dtype=np.float32)
            for dy, dx in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                near = np.roll(known, (dy, dx), axis=(0, 1))
                total += np.roll(a, (dy, dx), axis=(0, 1)) * near
                count += near
            a = np.where(known, total / np.maximum(count, 1), a)
        return a

    # The edge of the beard as drawn, without the speckle of its strokes.
    cover = blur(hair, 2)
    # The strokes: how light or dark the drawing is there against its hair's usual.
    lit = stroke[(hair > 0.6) & (kind == 2)]
    usual = float(np.median(lit)) if lit.size else 1.0
    strokes = np.clip(stroke / usual, 0.82, 1.12)
    strokes = np.where((hair > 0.3) & (kind > 0), strokes, 1.0)
    skin = np.array(who["skin"], dtype=np.float32)
    beard = np.array(who["beard"], dtype=np.float32)
    long_hair = np.array(who["hair"], dtype=np.float32)
    short = beard * 0.6 + long_hair * 0.4
    picture = np.broadcast_to(skin, (size, size, 3)).copy()
    # A blush: on the cheeks, the end of the nose and the ears.
    blush = np.array(who["blush"], dtype=np.float32)
    warm = np.zeros((size, size), dtype=np.float32)
    for centre, reach, much in (
        ((0.052, -0.052, -0.038), 0.03, 0.55), ((-0.052, -0.052, -0.038), 0.03, 0.55),
        ((0.0, -0.105, -0.04), 0.022, 0.5), ((0.1, 0.07, -0.015), 0.035, 0.4),
        ((-0.1, 0.07, -0.015), 0.035, 0.4),
    ):
        far = np.linalg.norm(place - np.array(centre, dtype=np.float32), axis=2)
        warm = np.maximum(warm, much * np.exp(-((far / reach) ** 2)))
    picture = picture * (1 - warm[:, :, None]) + blush * warm[:, :, None]
    mouth_line = blur(lip, 1)[:, :, None]
    picture = picture * (1 - mouth_line) + np.array(who["lip"], dtype=np.float32) * mouth_line
    # Hair over it: the long hair's colour on top (it lies under the hair itself), the short
    # hair's at the sides and back, the beard's on the beard and the brows.
    top = np.clip((place[:, :, 2] - 0.085) / 0.03, 0, 1)[:, :, None]
    scalp = short * (1 - top) + long_hair * top
    tint = np.where((kind == 3)[:, :, None], scalp, beard) * strokes[:, :, None]
    picture = picture * (1 - cover[:, :, None]) + tint * cover[:, :, None]
    picture[inside] = (0.55, 0.2, 0.2)
    # A rim round every patch, so no seam shows.
    filled = known.copy()
    for _ in range(12):
        total = np.zeros_like(picture)
        count = np.zeros((size, size), dtype=np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            near = np.roll(filled, (dy, dx), axis=(0, 1))
            total += np.roll(picture, (dy, dx), axis=(0, 1)) * near[:, :, None]
            count += near
        fresh = ~filled & (count > 0)
        picture[fresh] = total[fresh] / count[fresh][:, None]
        filled |= fresh
    picture[~filled] = skin
    out = np.ones((size, size, 4), dtype=np.float32)
    out[:, :, :3] = np.clip(picture, 0, 1)
    image = bpy.data.images.new("face", size, size)
    image.pixels.foreach_set(out.reshape(-1))
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    # In Blender: the head wears the picture, the rest of the body the skin's plain colour.
    face = bpy.data.materials.new("face")
    face.use_nodes = True
    b = face.node_tree.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.6
    tex = face.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = image
    face.node_tree.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    mesh.materials.clear()
    mesh.materials.append(face)
    mesh.materials.append(flat("skin", linear(who["skin"]), 0.6))
    for p in mesh.polygons:
        region = base.face_region[p.index]
        p.material_index = 0 if region in HEAD or region == NECK else 1
    return who["skin"]


def clean_piece(name, points, tris, design, colour, base, thick=0.01, fine=0.0035, keep=0.7):
    """Makes a clean piece of something cut from the design. What's cut is a ragged skin of small
    triangles with loose scraps round it. The scraps are dropped; the skin is given thickness, so
    its edges are rounded walls and not torn paper; it's rebuilt as an even, smooth skin; what
    faces inwards, where no one sees, is taken off again; and it's coloured from the design, its
    colours brought to the drawing's."""
    import bmesh as bm_
    from mathutils.bvhtree import BVHTree

    u = base.unit
    # Loose scraps: only what hangs together in a fair size is kept.
    parent = list(range(len(points)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b, c in tris:
        ra, rb, rc = find(a), find(b), find(c)
        parent[rb] = ra
        parent[rc] = ra
    sizes = {}
    for a, _, _ in tris:
        r = find(a)
        sizes[r] = sizes.get(r, 0) + 1
    most = max(sizes.values())
    tris = [t for t in tris if sizes[find(t[0])] >= most * 0.04]
    mesh = bpy.data.meshes.new(name + "-cut")
    mesh.from_pydata([tuple(p) for p in points], [], tris)
    mesh.update()
    first = BVHTree.FromPolygons([p.copy() for p in points], tris)
    rough = bpy.data.objects.new(name + "-cut", mesh)
    bpy.context.scene.collection.objects.link(rough)
    solid = rough.modifiers.new("thick", "SOLIDIFY")
    solid.thickness = thick * u
    solid.offset = -1
    remesh = rough.modifiers.new("even", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = fine * u
    remesh.use_smooth_shade = True
    even = rough.modifiers.new("smooth", "SMOOTH")
    even.factor = 0.5
    even.iterations = 3
    deps = bpy.context.evaluated_depsgraph_get()
    deps.update()
    shown = rough.evaluated_get(deps)
    made = bpy.data.meshes.new_from_object(shown)
    bpy.data.objects.remove(rough)
    # Off with what faces in: it looks the other way from the skin it was cut from.
    work = bm_.new()
    work.from_mesh(made)
    work.normal_update()
    inner = []
    for f in work.faces:
        near = first.find_nearest(f.calc_center_median())
        if near[0] is not None and f.normal.dot(near[1]) < -0.25:
            inner.append(f)
    bm_.ops.delete(work, geom=inner, context="FACES")
    work.to_mesh(made)
    work.free()
    for p in made.polygons:
        p.use_smooth = True
    layer = made.color_attributes.new("tone", "FLOAT_COLOR", "POINT")
    seen = []
    for v in made.vertices:
        hit = design.nearest(v.co, 0.03 * u)
        seen.append(hit[2] if hit else None)
    known = [c for c in seen if c]
    mean = tuple(sum(c[a] for c in known) / len(known) for a in range(3))
    for k, c in enumerate(brought_to([c or mean for c in seen], colour, keep)):
        layer.data[k].color = (*c, 1)
    o = bpy.data.objects.new(name, made)
    bpy.context.scene.collection.objects.link(o)
    made.materials.append(tone(name))
    print("MAKE", name, "clean:", len(made.polygons), "faces from", len(tris), "triangles cut")
    return o


def cut_hair(base, design, who):
    """The hair is the design's own, cut free of the rest: everything coloured as hair above the
    eyes and behind the ears, but for the brows."""

    def keep(p, colour):
        if not Target.hairy(colour):
            return False
        q = base.q(p)
        if q.z > 0.062:
            return True
        if q.y < -0.012 and q.z < 0.062:
            return False
        return q.z > -0.004 or (q.y > 0.1 and q.z > -0.12)

    from mathutils.bvhtree import BVHTree

    scalp = BVHTree.FromPolygons(
        [v.co.copy() for v in base.mesh.vertices],
        [tuple(p.vertices) for p in base.mesh.polygons if base.face_region[p.index] in HEAD - INSIDE],
    )
    wanted = keep

    def keep(p, colour):
        if not wanted(p, colour):
            return False
        # Not what lies flat on the head: that's the short hair of the sides, painted on.
        q = base.q(p)
        near = scalp.find_nearest(p)
        return q.z > 0.085 or near[0] is None or near[3] > 0.0075 * base.unit

    points, tris, _ = design.cut(keep)
    return clean_piece("hair", points, tris, design, who["hair"], base, thick=0.012, keep=0.5)


def hair_chunks(base, hair, count):
    """Splits the hair into chunks that can each swing: `count` clumps of it, each with a short
    chain of bones from where it leaves the head to its end. Returns the bones, and what gives
    any point of the hair its bones and shares. A chunk's root goes with the head and its end with
    the chain, and where two chunks meet they share, so the hair stays one skin and never tears."""
    u = base.unit
    points = [hair.matrix_world @ v.co for v in hair.data.vertices]
    skull = base.p(Vector((0, 0.085, 0.03)))
    # Clumps: start as far apart as can be, then settle on the middles of what's nearest each.
    centres = [max(points, key=lambda p: p.z)]
    while len(centres) < count:
        centres.append(max(points[::7], key=lambda p: min((p - c).length for c in centres)))
    for _ in range(8):
        groups = [[] for _ in centres]
        for p in points[::2]:
            groups[min(range(count), key=lambda k: (p - centres[k]).length_squared)].append(p)
        centres = [sum(g, Vector()) / len(g) if g else c for g, c in zip(groups, centres)]
    groups = [[] for _ in centres]
    for p in points:
        groups[min(range(count), key=lambda k: (p - centres[k]).length_squared)].append(p)
    bones = []
    chains = []
    for k, group in enumerate(groups):
        if len(group) < 8:
            chains.append(None)
            continue
        root = min(group, key=lambda p: (p - skull).length)
        tip = max(group, key=lambda p: (p - root).length)
        # A chunk that lies flat on the head still gets a chain, a short one, pointing out.
        if (tip - root).length < 0.02 * u:
            tip = root + (root - skull).normalized() * 0.02 * u
        mid = root.lerp(tip, 0.5)
        n = len([c for c in chains if c])
        bones += [
            (f"hair{n}_1", "head", root),
            (f"hair{n}_2", f"hair{n}_1", mid),
            (f"hair{n}_3", f"hair{n}_2", tip),
        ]
        chains.append((n, root, tip))

    def of_chunk(k, p):
        n, root, tip = chains[k]
        along = tip - root
        t = max(0.0, min(1.0, (p - root).dot(along) / along.length_squared))
        free = smooth(0.12, 0.5, t)
        end = smooth(0.5, 0.9, t)
        return {"head": 1 - free, f"hair{n}_1": free * (1 - end), f"hair{n}_2": free * end}

    def shares(p):
        near = sorted((k for k in range(count) if chains[k]), key=lambda k: (p - centres[k]).length_squared)[:2]
        a = of_chunk(near[0], p)
        if len(near) < 2:
            return a
        da, db = (p - centres[near[0]]).length, (p - centres[near[1]]).length
        mix = max(0.0, min(0.5, 0.5 - (db - da) / (0.03 * u)))
        b = of_chunk(near[1], p)
        out = {}
        for bone, w in a.items():
            out[bone] = out.get(bone, 0.0) + w * (1 - mix)
        for bone, w in b.items():
            out[bone] = out.get(bone, 0.0) + w * mix
        return {bone: w for bone, w in out.items() if w > 0.001}

    print("MAKE hair in", len([c for c in chains if c]), "chunks")
    return bones, shares


def turn_x(p, c, angle):
    """Turns a point about the sideways line through c: positive lifts what is in front."""
    dy, dz = c.y - p.y, p.z - c.z
    ca, sa = math.cos(angle), math.sin(angle)
    return Vector((p.x, c.y - (dy * ca - dz * sa), c.z + (dy * sa + dz * ca)))


def face_shapes(base, who):
    """The face's shapes, made here: the base has eyelids, lips and the inside of a mouth, but
    nothing that moves them. Returns the teeth, which are their own pieces."""
    mesh, region, unit = base.mesh, base.region, base.unit
    radius = base.eye_radius
    head = base.head

    lip_z, lip_front, lip_half, lip_back = base.lips()
    # How far back the inside of the lips is, in the middle: the teeth go just behind that.
    behind = min(
        base.q(base.co(i)).y for i in head
        if region[i] and region[i] <= INSIDE and abs(base.q(base.co(i)).x) < 0.012
        and abs(base.q(base.co(i)).z - lip_z) < 0.014
    )

    def phi(p, c):
        return math.atan2(p.z - c.z, c.y - p.y)

    def lids(c, amount, wide=0.0, squint=0.0):
        """Where every point round one eye goes for lids closed by `amount`."""
        side = 1 if c.x > 0 else -1
        rim = [i for i in base.shared(LIDS, SOCKET) if base.co(i).x * side > 0]
        pts = sorted((base.co(i).copy() for i in rim), key=lambda p: p.x * side)
        inner, outer = pts[0], pts[-1]

        def middle(x):
            t = max(0.0, min(1.0, (x - inner.x) / (outer.x - inner.x)))
            return phi(inner, c) + (phi(outer, c) - phi(inner, c)) * t

        upper = [p for p in pts if phi(p, c) > middle(p.x) + 0.02]
        lower = [p for p in pts if phi(p, c) < middle(p.x) - 0.02]

        def edge(line, x):
            return phi(min(line, key=lambda p: abs(p.x - x)), c)

        moved = {}
        reach = radius * 0.95
        for i in head:
            p = base.co(i)
            if p.x * side <= 0 or not region[i] & {LIDS, ORBIT, SOCKET}:
                continue
            if (p - c).length > radius * 2.1 or p.y > c.y:
                continue
            x = max(min(p.x * side, outer.x * side), inner.x * side) * side
            up, low, mid = edge(upper, x), edge(lower, x), middle(x)
            is_upper = phi(p, c) > mid
            gap = min((p - r).length for r in (upper if is_upper else lower))
            w = 1.0 - smooth(0.0, reach, gap)
            # The corners hardly move.
            across = (x - inner.x) / (outer.x - inner.x)
            w *= smooth(0.0, 0.22, across) * smooth(1.0, 0.78, across)
            if w <= 0:
                continue
            meet = low + 0.2 * (up - low)
            if is_upper:
                angle = -(up - meet) * amount + math.radians(11) * wide
            else:
                angle = (meet - low) * amount + (up - low) * 0.22 * squint
            moved_to = turn_x(p, c, angle * w)
            # Stay outside the eyeball.
            out = moved_to - c
            need = radius * (1.0 + 0.035 * w * max(amount, squint))
            if out.length < need:
                moved_to = c + out.normalized() * need
            moved[i] = moved_to
        return moved

    # The calm look he rests in: lids a little lowered.
    for c in base.eyes:
        for i, p in lids(c, who["lids"]).items():
            mesh.vertices[i].co = p
    rest = [v.co.copy() for v in mesh.vertices]
    base.object.shape_key_add(name="Basis")

    def key(name, moved):
        # A new shape starts as a copy of the one before it, so every point is set.
        block = base.object.shape_key_add(name=name, from_mix=False)
        # Made this way a shape starts switched fully on.
        block.value = 0.0
        for i, p in enumerate(rest):
            block.data[i].co = moved.get(i, p)

    def field(points):
        """Moves everything near some points: each is (centre, reach, shift), in face units."""
        moved = {}
        for i in head:
            q = base.q(rest[i])
            to = q.copy()
            hit = False
            for centre, reach, shift in points:
                w = math.exp(-(((q - centre).length / reach) ** 2))
                if w > 0.01:
                    to += (shift(q) if callable(shift) else shift) * w
                    hit = True
            if hit:
                moved[i] = base.p(to)
        return moved

    sides = (("Left", base.eyes[0], 1), ("Right", base.eyes[1], -1))
    for tag, c, _ in sides:
        key(f"eyeBlink{tag}", lids(c, 1.0))
        key(f"eyeWide{tag}", lids(c, 0.0, wide=1.0))
        key(f"eyeSquint{tag}", lids(c, 0.0, squint=1.0))

    jaw = base.jaw_weights()
    hinge = base.p(Vector((0, 0.075, -0.05)))
    swing = math.radians(21)
    key("jawOpen", {i: turn_x(rest[i], hinge, -swing * jaw[i]) for i in head if jaw[i] > 0.001})

    eye_reach = radius / unit
    for tag, c, s in sides:
        corner = Vector((s * lip_half, lip_back, lip_z))
        cheek = corner + Vector((s * 0.014, 0.004, 0.04))
        brow = base.q(c) + Vector((0, -eye_reach * 1.1, eye_reach * 1.25))
        key(f"mouthSmile{tag}", field([
            (corner, 0.027, Vector((s * 0.009, 0.007, 0.013))),
            (cheek, 0.03, Vector((s * 0.002, -0.004, 0.006))),
        ]))
        key(f"mouthFrown{tag}", field([(corner, 0.025, Vector((s * 0.002, 0.004, -0.011)))]))
        key(f"mouthStretch{tag}", field([(corner, 0.026, Vector((s * 0.008, 0.005, -0.003)))]))
        key(f"cheekSquint{tag}", field([(cheek, 0.028, Vector((0, -0.003, 0.006)))]))
        key(f"browDown{tag}", field([(brow, 0.034, Vector((-s * 0.004, -0.002, -0.008)))]))
        key(f"browOuterUp{tag}", field([
            (brow + Vector((s * eye_reach * 0.8, 0, 0)), 0.03, Vector((0, 0, 0.009))),
        ]))
    key("browInnerUp", field([
        (base.q(c) + Vector((-s * eye_reach * 0.9, -eye_reach * 1.1, eye_reach * 1.25)), 0.028,
         Vector((0, 0, 0.010)))
        for _, c, s in sides
    ]))
    lips = Vector((0, lip_front, lip_z))
    key("mouthFunnel", field([
        (lips, 0.04, lambda q: Vector((-q.x * 0.42, -0.008, 0.0035 if q.z > lip_z else -0.0045))),
    ]))
    key("mouthPucker", field([
        (lips, 0.04, lambda q: Vector((-q.x * 0.5, -0.006, 0))),
    ]))

    # Teeth: plain arcs, the lower one going with the jaw.
    white = flat("teeth", (0.86, 0.84, 0.78), 0.3)
    made = []
    wide = lip_half * 0.86
    below = [
        base.q(base.co(i)).y for i in head
        if region[i] and region[i] <= {MOUTH_LOW} and abs(base.q(base.co(i)).x) < 0.012
        and -0.02 < base.q(base.co(i)).z - lip_z < -0.002
    ]
    behind_low = max(behind, min(below)) if below else behind
    for name, z, tall, goes in (
        ("teeth_upper", lip_z + 0.0095, 0.012, False),
        ("teeth_lower", lip_z - 0.0105, 0.009, True),
    ):
        verts, faces = [], []
        steps = 16
        for i in range(steps + 1):
            a = math.radians(-80 + 160 * i / steps)
            for thick, zz in ((0.0, -1), (0.004, -1), (0.004, 1), (0.0, 1)):
                verts.append(base.p(Vector((
                    math.sin(a) * ((wide * 0.9 if goes else wide) - thick),
                    (behind_low + 0.0075 if goes else behind + 0.0055) + 0.036
                    - math.cos(a) * (0.036 - thick),
                    z + zz * tall / 2,
                ))))
        for i in range(steps):
            for k in range(4):
                a, b = i * 4 + k, i * 4 + (k + 1) % 4
                faces.append([a, b, b + 4, a + 4])
        o = add_mesh(name, verts, faces, white)
        if goes:
            o.shape_key_add(name="Basis")
            block = o.shape_key_add(name="jawOpen", from_mix=False)
            block.value = 0.0
            for i, v in enumerate(o.data.vertices):
                block.data[i].co = turn_x(v.co, hinge, -swing)
        made.append(o)
    # The tongue: a flat cushion on the floor of the mouth, going with the jaw.
    verts, faces = [], []
    rings, around = 7, 10
    centre = Vector((0, behind + 0.034, lip_z - 0.0105))
    for r in range(rings + 1):
        along = -1 + 2 * r / rings
        wide = math.sqrt(max(0.0, 1 - along * along)) * (0.75 + 0.25 * (along + 1) / 2)
        for k in range(around):
            a = 2 * math.pi * k / around
            verts.append(base.p(centre + Vector((
                math.cos(a) * 0.019 * wide, along * 0.027, math.sin(a) * 0.0055 * wide,
            ))))
    for r in range(rings):
        for k in range(around):
            a, b = r * around + k, r * around + (k + 1) % around
            faces.append([a, b, b + around, a + around])
    tongue = add_mesh("tongue", verts, faces, flat("tongue", (0.72, 0.27, 0.27), 0.4))
    tongue.shape_key_add(name="Basis")
    block = tongue.shape_key_add(name="jawOpen", from_mix=False)
    block.value = 0.0
    for i, v in enumerate(tongue.data.vertices):
        block.data[i].co = turn_x(v.co, hinge, -swing * 0.9)
    made.append(tongue)
    print("MAKE face shapes", len(mesh.shape_keys.key_blocks) - 1)
    return made


def eyeball(name, centre, radius, iris):
    """An eye looking forward: white, a ringed iris, a pupil."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=radius)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    layer = mesh.uv_layers.new(name="UVMap")
    for p in mesh.polygons:
        for li in p.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            layer.data[li].uv = (
                math.atan2(co.x, -co.y) / (2 * math.pi) + 0.5,
                math.asin(max(-1, min(1, co.z / radius))) / math.pi + 0.5,
            )
    o = bpy.data.objects.new(name, mesh)
    o.location = centre
    bpy.context.scene.collection.objects.link(o)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.1
    coords = nt.nodes.new("ShaderNodeTexCoord")
    norm = nt.nodes.new("ShaderNodeVectorMath")
    norm.operation = "NORMALIZE"
    nt.links.new(coords.outputs["Object"], norm.inputs[0])
    split = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(norm.outputs[0], split.inputs[0])
    front = nt.nodes.new("ShaderNodeMath")
    front.operation = "MULTIPLY"
    front.inputs[1].default_value = -1.0
    nt.links.new(split.outputs["Y"], front.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    white = (0.9, 0.89, 0.87)
    stops = [
        (0.0, white),
        (0.868, white),
        (0.875, tuple(c * 0.3 for c in iris)),
        (0.90, iris),
        (0.945, tuple(min(1, c * 1.7) for c in iris)),
        (0.952, (0.004, 0.004, 0.004)),
        (1.0, (0.004, 0.004, 0.004)),
    ]
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (*stops[0][1], 1)
    els[1].position, els[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = (*col, 1)
    nt.links.new(front.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    mesh.materials.append(m)
    return o


# --- The body ----------------------------------------------------------------------------------


class Frame:
    """The body's joints and how much each bone moves each point. Bones are named as the game
    names them: lower, upper, head, arm/fore/hand L and R, a bone for each of a finger's three
    parts, leg/knee/foot L and R."""

    def __init__(self, base):
        self.base = base
        mesh = base.mesh
        J = {}

        def loop(a, b, side=0):
            pts = [base.co(i) for i in base.shared(a, b) if side == 0 or base.co(i).x * side > 0]
            return sum(pts, Vector()) / len(pts)

        def middle(p):
            return Vector((0, p.y, p.z))

        J["waist"] = middle(loop(CHEST, BELLY))
        J["neck"] = middle(loop(NECK, CHEST))
        J["hips"] = middle(loop(BELLY, THIGH))
        for tag, side in (("L", 1), ("R", -1)):
            J["shoulder" + tag] = loop(SHOULDER, UPPER_ARM, side)
            J["elbow" + tag] = loop(UPPER_ARM, FOREARM, side)
            J["wrist" + tag] = loop(FOREARM, PALM, side)
            tip = FINGERS["middle"][2]
            J["tips" + tag] = max(
                (base.co(i) for i, r in enumerate(base.region) if tip in r and base.co(i).x * side > 0),
                key=lambda p: (p - J["wrist" + tag]).length,
            ).copy()
            J["hip" + tag] = loop(BELLY, THIGH, side)
            J["knee" + tag] = loop(THIGH, SHIN, side)
            J["ankle" + tag] = loop(SHIN, ANKLE, side)
            J["toe" + tag] = min(
                (base.co(i) for i, r in enumerate(base.region) if r & FOOT and base.co(i).x * side > 0),
                key=lambda p: p.y,
            ).copy()
            for finger, parts in FINGERS.items():
                chain = [PALM if finger != "thumb" else PALM, *parts]
                for k in range(3):
                    J[f"{finger}{tag}{k + 1}"] = loop(chain[k], chain[k + 1], side)
                J[f"{finger}{tag}4"] = max(
                    (base.co(i) for i, r in enumerate(base.region)
                     if parts[2] in r and base.co(i).x * side > 0),
                    key=lambda p: (p - J[f"{finger}{tag}3"]).length,
                ).copy()
        self.joints = J

        # Which bone each region belongs to, to begin with.
        def owner(i):
            r = base.region[i]
            tag = "L" if base.co(i).x > 0 else "R"
            if r & HEAD:
                return "head"
            for finger, parts in FINGERS.items():
                for k, part in enumerate(parts):
                    if part in r:
                        return f"{finger}{tag}{k + 1}"
            if PALM in r:
                return "hand" + tag
            if FOREARM in r:
                return "fore" + tag
            if UPPER_ARM in r:
                return "arm" + tag
            if SHOULDER in r:
                return "arm" + tag if abs(base.co(i).x) > J["shoulder" + tag].x * tag_sign(tag) * 0.86 else "upper"
            if r & FOOT or ANKLE in r:
                return "foot" + tag
            if SHIN in r:
                return "knee" + tag
            if THIGH in r:
                return "leg" + tag
            if BELLY in r:
                return "lower"
            if NECK in r:
                return "head" if base.co(i).z > (J["neck"].z + base.origin.z - 0.1 * base.unit) / 2 else "upper"
            return "upper"

        def tag_sign(tag):
            return 1 if tag == "L" else -1

        first = [owner(i) for i in range(len(mesh.vertices))]
        weights = [{b: 1.0} for b in first]
        # How many times each point's share is evened out with its neighbours': joints bend
        # softly, fingers stay their own, the head stays whole.
        def passes(i):
            r = base.region[i]
            if r & HEAD:
                return 0
            if r & HAND:
                return 1
            return 6

        limit = [passes(i) for i in range(len(mesh.vertices))]
        for step in range(6):
            nxt = list(weights)
            for i, near in enumerate(base.near):
                if limit[i] <= step or not near:
                    continue
                mixed = dict(weights[i])
                for j in near:
                    for b, w in weights[j].items():
                        mixed[b] = mixed.get(b, 0.0) + w / len(near)
                total = sum(mixed.values())
                nxt[i] = {b: w / total for b, w in mixed.items() if w / total > 0.01}
            weights = nxt
        self.weights = weights

    def bones(self):
        """Each bone that reshapes the body: (name, where it starts, where it ends)."""
        J = self.joints
        out = [("lower", J["hips"], J["waist"]), ("upper", J["waist"], J["neck"])]
        for tag in ("L", "R"):
            out += [
                ("arm" + tag, J["shoulder" + tag], J["elbow" + tag]),
                ("fore" + tag, J["elbow" + tag], J["wrist" + tag]),
                ("hand" + tag, J["wrist" + tag], J["tips" + tag]),
                ("leg" + tag, J["hip" + tag], J["knee" + tag]),
                ("knee" + tag, J["knee" + tag], J["ankle" + tag]),
                ("foot" + tag, J["ankle" + tag], J["toe" + tag]),
            ]
        return out


def design_joints(design, who):
    """The design's joints, where the character is."""
    out = {}

    def at(share, side):
        return design.here(Vector((
            share[0] * side * design.tall, -share[2] * design.tall, design.low + share[1] * design.tall,
        )))

    j = who["joints"]
    out["waist"] = at(j["waist"], 0)
    out["neck"] = at(j["neck"], 0)
    hip = at(j["hip"], 1)
    out["hips"] = Vector((0, hip.y, hip.z))
    for tag, side in (("L", 1), ("R", -1)):
        out["shoulder" + tag] = at(j["shoulder"], side)
        out["elbow" + tag] = at(j["elbow"], side)
        out["wrist" + tag] = at(j["wrist"], side)
        out["tips" + tag] = at(j["fingers"], side)
        out["hip" + tag] = at(j["hip"], side)
        out["knee" + tag] = at(j["knee"], side)
        out["ankle" + tag] = at(j["ankle"], side)
        out["toe" + tag] = at(j["toe"], side)
    return out


def fit_body(base, frame, design, who):
    """Stands the base as the design stands (arms straight out) and gives it the design's build:
    each part of it is turned, moved and sized to run between the design's joints. Each point
    goes with its bones by their shares, so the joints between stay whole."""
    mesh = base.mesh
    goal = design_joints(design, who)
    moves = {}
    for name, start, end in frame.bones():
        part = name.rstrip("LR")
        tag = name[len(part):]
        keys = {
            "lower": ("hips", "waist"), "upper": ("waist", "neck"), "arm": ("shoulder", "elbow"),
            "fore": ("elbow", "wrist"), "hand": ("wrist", "tips"), "leg": ("hip", "knee"),
            "knee": ("knee", "ankle"), "foot": ("ankle", "toe"),
        }[part]
        to_start, to_end = goal[keys[0] + tag], goal[keys[1] + tag]
        axis = (end - start).normalized()
        turn = axis.rotation_difference((to_end - to_start).normalized())
        long = (to_end - to_start).length / (end - start).length
        girth = who["girth"].get(part, long)
        moves[name] = (start, axis, turn, long, girth, to_start)
    # A finger goes as its hand goes.
    for i, shares in enumerate(frame.weights):
        p = mesh.vertices[i].co
        out = Vector()
        for bone, w in shares.items():
            if bone == "head":
                out += p * w
                continue
            if bone not in moves:
                bone = "hand" + bone[-2]
            start, axis, turn, long, girth, to_start = moves[bone]
            d = p - start
            along = d.dot(axis)
            across = d - axis * along
            if isinstance(girth, tuple):
                # A trunk: wide by one share, deep by another.
                across = Vector((across.x * girth[0], across.y * girth[1], across.z * girth[0]))
            else:
                across = across * girth
            out += (to_start + turn @ (axis * along * long + across)) * w
        mesh.vertices[i].co = out
    mesh.update()
    # The joints go where the design's are; a finger's go with its hand.
    for name in list(frame.joints):
        if name in goal:
            continue
        tag = name[-2]
        start, axis, turn, long, girth, to_start = moves["hand" + tag]
        d = frame.joints[name] - start
        along = d.dot(axis)
        frame.joints[name] = to_start + turn @ (axis * along * long + (d - axis * along) * girth)
    frame.joints.update(goal)


def wrap_body(base, design, rounds=12):
    """Draws the body's skin onto the design, as the face was. Hands and feet aren't pulled: the
    design's are mittens. The head is already made and doesn't move."""
    mesh, u = base.mesh, base.unit
    ids = [i for i, r in enumerate(base.region) if not r & HEAD]
    place = {i: k for k, i in enumerate(ids)}
    near = [[place.get(j, -1) for j in base.near[i]] for i in ids]
    still = [bool(base.region[i] & (HAND | FOOT | {THENAR, ANKLE})) for i in ids]
    for step in range(rounds):
        mesh.update()
        reach = (0.06 - 0.03 * step / rounds) * u
        pull = [None] * len(ids)
        for k, i in enumerate(ids):
            if still[k]:
                continue
            v = mesh.vertices[i]
            best = None
            for d in (v.normal, -v.normal):
                hit = design.ray(v.co, d)
                if hit and (hit[0] - v.co).length < reach and (best is None or (hit[0] - v.co).length < best[1]):
                    best = (hit[0], (hit[0] - v.co).length)
            close = design.nearest(v.co, reach)
            if close and (best is None or close[3] < best[1] * 0.6):
                best = (close[0], close[3])
            if best:
                pull[k] = best[0] - v.co
        hold = 0.15 * 1.4**step
        move = [p if p is not None else Vector() for p in pull]
        for _ in range(20):
            nxt = []
            for k in range(len(ids)):
                around = [move[j] if j >= 0 else Vector() for j in near[k]]
                mean = sum(around, Vector()) / len(around) if around else move[k]
                nxt.append((pull[k] * hold + mean) / (hold + 1) if pull[k] is not None else mean)
            move = nxt
        for k, i in enumerate(ids):
            mesh.vertices[i].co = mesh.vertices[i].co + move[k] * 0.8
    mesh.update()


def under_clothes(base, design):
    """Which of the body's points are under his clothes: the design is cloth there, not skin. They
    are drawn in a little so cloth never has skin showing through, and left out of the model."""
    mesh, u = base.mesh, base.unit
    mesh.update()
    covered = set()
    for i, r in enumerate(base.region):
        if r & (HEAD | HAND | {THENAR}):
            continue
        hit = design.nearest(mesh.vertices[i].co, 0.05 * u)
        # Where the design is out of reach, the trunk and the legs are taken to be clothed.
        clothed = bool(r & ({CHEST, BELLY, SHOULDER, THIGH, SHIN, ANKLE} | FOOT))
        if (hit and not Target.skin(hit[2])) or (not hit and clothed):
            covered.add(i)
    # Not the last ring before bare skin: that would leave a gap at a cuff or a collar.
    edge = {i for i in covered if any(j not in covered for j in base.near[i])}
    covered -= edge
    for i in covered:
        v = mesh.vertices[i]
        v.co = v.co - v.normal * (0.008 * u)
    mesh.update()
    print("MAKE under his clothes:", len(covered), "points")
    return covered


def cut_clothes(base, design, who):
    """His clothes are the design's own, cut free of it by colour and by where on him they are:
    shirt, trousers, belt, shoes, watch. Each keeps its place on the design's picture."""
    made = []
    image = design.image
    for name, rule in who["clothes"].items():
        low, high = rule["up"]
        out = rule.get("out")
        side = rule.get("side", 0)

        def keep(p, colour, rule=rule, low=low, high=high, out=out, side=side):
            there = design.there(p)
            up = (there.z - design.low) / design.tall
            if not low < up < high:
                return False
            across = there.x / design.tall
            if out and not out[0] <= abs(across) <= out[1]:
                return False
            if side and across * side < 0:
                return False
            kind = rule["is"]
            if kind == "any":
                return True
            if kind == "cloth":
                return Target.cloth(colour)
            h, sat, v = __import__("colorsys").rgb_to_hsv(*colour)
            if kind == "white":
                return sat < 0.22 and v > 0.5
            if kind == "dark":
                return v < 0.42 and not Target.cloth(colour)
            # Whatever isn't cloth, white or skin: leather, a buckle.
            return not Target.cloth(colour) and not (sat < 0.22 and v > 0.62) and not Target.skin(colour)

        points, tris, _ = design.cut(keep)
        if not tris:
            print("MAKE no", name)
            continue
        made.append(clean_piece(name, points, tris, design, rule["colour"], base,
                                thick=rule.get("thick", 0.01), keep=rule.get("keep", 0.6)))
    return made


# --- Looking at it ------------------------------------------------------------------------------


def stage():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.9, 0.9, 0.9, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    scene.world = world
    for name, energy, rot, colour in [
        ("key", 2.0, (55, 0, -30), (1.0, 0.96, 0.9)),
        ("rim", 1.0, (60, 0, 150), (0.85, 0.92, 1.0)),
    ]:
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
        light.data.energy = energy
        light.data.color = colour
        light.data.angle = 0.2
        light.rotation_euler = tuple(math.radians(a) for a in rot)
        scene.collection.objects.link(light)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 135
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    quick = "--quick" in sys.argv
    scene.cycles.samples = 12 if quick else 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 500 if quick else 750
    scene.render.resolution_y = 600 if quick else 900
    scene.view_settings.view_transform = "Standard"
    return cam


def shot(cam, path, centre, tall, turn=0.0, lift=0.0):
    """A portrait taking in `tall` of height, from `turn` degrees round to his left."""
    scene = bpy.context.scene
    distance = tall * cam.data.lens / (36.0 * scene.render.resolution_y / scene.render.resolution_x)
    a = math.radians(turn)
    back = Vector((math.sin(a), -math.cos(a), math.sin(math.radians(lift)))).normalized() * distance
    cam.location = centre + back
    cam.rotation_euler = (-back).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


FACES = {
    "blink": {"eyeBlinkLeft": 1, "eyeBlinkRight": 1},
    "smile": {"mouthSmileLeft": 0.9, "mouthSmileRight": 0.9, "cheekSquintLeft": 0.5,
              "cheekSquintRight": 0.5, "eyeSquintLeft": 0.3, "eyeSquintRight": 0.3},
    "angry": {"browDownLeft": 1, "browDownRight": 1, "mouthFrownLeft": 0.6, "mouthFrownRight": 0.6,
              "eyeSquintLeft": 0.4, "eyeSquintRight": 0.4},
    "talk": {"jawOpen": 0.5, "mouthFunnel": 0.4, "browInnerUp": 0.4},
    "shock": {"jawOpen": 0.4, "eyeWideLeft": 1, "eyeWideRight": 1, "browInnerUp": 1,
              "browOuterUpLeft": 1, "browOuterUpRight": 1},
}
# The mouth for the sounds of speech.
SPEECH = {
    "say-rest": {},
    "say-ah": {"jawOpen": 0.62},
    "say-ee": {"jawOpen": 0.2, "mouthStretchLeft": 0.9, "mouthStretchRight": 0.9,
               "mouthSmileLeft": 0.3, "mouthSmileRight": 0.3},
    "say-oh": {"jawOpen": 0.45, "mouthFunnel": 0.8},
    "say-oo": {"jawOpen": 0.16, "mouthPucker": 1.0},
    "say-mm": {"mouthPucker": 0.12},
}


def set_face(pieces, values):
    for o in pieces:
        keys = o.data.shape_keys
        if keys:
            for block in keys.key_blocks[1:]:
                block.value = values.get(block.name, 0.0)


# How many triangles each piece cut from the design is brought down to.
THIN = {"shirt": 10000, "trousers": 6000, "shoes": 4000, "belt": 1600, "watch": 700, "hair": 10000}


def export(name, base, frame, design, who, pieces, covered, face_picture, skin):
    """Writes the character for scripts/pack-character.mjs to make the game's model from."""
    out = os.path.join(ROOT, "models-wip", "built")
    writer = Writer(name, out, frame, base)
    for o in pieces:
        if o.name in THIN:
            thin(o, THIN[o.name])
    deps = bpy.context.evaluated_depsgraph_get()
    deps.update()
    zs = [(o.matrix_world @ v.co).z for o in pieces for v in o.data.vertices]
    hair = next((o for o in pieces if o.name == "hair"), None)
    hair_bones, hair_shares = hair_chunks(base, hair, who["hair_chunks"]) if hair else ([], None)
    writer.stand(
        Space(min(zs), max(zs), (frame.joints["ankleL"].y + frame.joints["ankleR"].y) / 2), hair_bones
    )
    eye = os.path.join(out, f"{name}-eye.png")
    eye_picture(eye, who["iris"])
    for o in pieces:
        n = o.name
        if o is base.object:
            headed = [r in HEAD or r == NECK for r in base.face_region]
            writer.add(o, "head", "skin", {"picture": "face", "rough": 0.6},
                       faces=lambda f: headed[f])
            writer.add(o, "body", "skin", {"colour": list(linear(skin)), "rough": 0.6}, keys=False,
                       drop=covered, faces=lambda f: not headed[f])
        elif n.startswith("eye_"):
            writer.add(o, n, "eyeL" if n.endswith("L") else "eyeR", {"picture": "eye", "rough": 0.1})
        elif n.startswith("teeth"):
            writer.add(o, n, "head", {"colour": [0.86, 0.84, 0.78], "rough": 0.3})
        elif n == "tongue":
            writer.add(o, n, "head", {"colour": [0.72, 0.27, 0.27], "rough": 0.4})
        elif n == "hair":
            writer.add(o, n, hair_shares, {"colours": True, "rough": 0.5})
        elif n == "watch":
            writer.add(o, n, "foreL", {"colours": True, "rough": 0.5})
        else:
            writer.add(o, n, "near", {"colours": True, "rough": 0.75})
    writer.save({"eye": eye, "face": face_picture})


def main():
    args = sys.argv[sys.argv.index("--") + 1 :]
    who = {"captain": CAPTAIN}[args[0]]
    look = os.path.abspath(args[args.index("--look") + 1]) if "--look" in args else None
    bpy.ops.wm.read_factory_settings(use_empty=True)
    base = Base(whole="--body" in args)
    design = lay_design(base, who)
    m = design.marks
    chin_to = base.q(design.here(Vector((m["mid"], 0, m["chin_z"])))).z + who["beard_thick"]
    place_features(base, who, chin_to)
    drawing = Drawing(
        who["front"], who["side"], who["front_eyes"], who["side_eye"],
        EYES_APART + 2 * who["eyes_apart"], base.eye_radius / base.unit,
    )
    if "--nowrap" not in args:
        wrap(base, design, drawing, who)
        soften(base)
        tuck_ears(base)
        base.find_eyes()
        tuck_mouth(base)
    whole = "--body" in args
    if whole:
        frame = Frame(base)
        fit_body(base, frame, design, who)
        if "--nowrap" not in args:
            wrap_body(base, design)
        covered = under_clothes(base, design)
    body = base.object
    raise_hair(base, drawing, who)
    for p in body.data.polygons:
        p.use_smooth = True
    built = os.path.join(ROOT, "models-wip", "built")
    os.makedirs(built, exist_ok=True)
    face_picture = os.path.join(built, f"{args[0]}-face.png")
    skin = paint_face(base, drawing, who, face_picture)
    pieces = [body, *face_shapes(base, who)]
    for tag, c in (("L", base.eyes[0]), ("R", base.eyes[1])):
        pieces.append(eyeball(f"eye_{tag}", c, base.eye_radius, who["iris"]))
    if "--bare" not in args:
        pieces.append(cut_hair(base, design, who))
        if whole:
            pieces += cut_clothes(base, design, who)
    if "--export" in args and whole:
        export(args[0], base, frame, design, who, pieces, covered, face_picture, skin)
    sub = body.modifiers.new("smooth", "SUBSURF")
    sub.levels = sub.render_levels = 1
    body.hide_render = "--pieces-only" in args
    if not look:
        return
    cam = stage()
    u = base.unit
    centre = Vector((0, base.origin.y + 0.07 * u, base.origin.z + 0.03 * u))
    tall = 0.58 * u
    set_face(pieces, {})
    shot(cam, f"{look}-front.png", centre, tall, 0)
    shot(cam, f"{look}-side.png", centre, tall, 90)
    shot(cam, f"{look}-three.png", centre, tall, -28, 4)
    if whole:
        low = min(v.co.z for v in body.data.vertices)
        top = base.origin.z + 0.2 * u
        middle = Vector((0, base.origin.y + 0.07 * u, (low + top) / 2))
        scene = bpy.context.scene
        scene.render.resolution_x, scene.render.resolution_y = scene.render.resolution_y, scene.render.resolution_x
        shot(cam, f"{look}-body.png", middle, (top - low) * 1.08, 0)
        shot(cam, f"{look}-body-three.png", middle, (top - low) * 1.08, -35, 6)
        scene.render.resolution_x, scene.render.resolution_y = scene.render.resolution_y, scene.render.resolution_x
    if "--faces" in args:
        for name, values in {**FACES, **SPEECH}.items():
            set_face(pieces, values)
            shot(cam, f"{look}-{name}.png", centre, tall, -22, 3)


main()
