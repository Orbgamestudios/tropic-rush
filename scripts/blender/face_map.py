"""Maps a blank-faced character's face, for the painted features to sit in (docs/CHARACTERS.md).

  blender -b -P scripts/blender/face_map.py -- <rigged.glb> <out.json> [<picture-prefix>] [eyes=<height>,<brow>] [place=<eye width>,<eye middle from the nose>] [brows=<start>]

Where a face is sculpted so the sockets can't be found (the Shaman's), `eyes=` says how high they
are, and the brow, in the model's own units. Take the height from the deepest point of the socket and
the brow's from the ridge's most forward point, looking down a column through the eye (the Shaman's,
2026-11-22: 0.885 and 0.905; 0.899 put his eyes up on the ridge).

How far apart the eyes are and how big, by a human face's proportions (the owner's call, 2026-11-22:
"match them to what humans look like"): an eye is a fifth of the face's width at the cheekbones, and
about 0.13 of the head from chin to crown; it's drawn the mean of the two, since these faces are
wider or narrower than a person's. One eye's width between the two. The face's width is measured on
its bare skin just under the eyes, to the hairline or where the face turns away. `place=` sets an
eye's width and how far its middle is from the nose's, where a face wants its own (2026-11-23: each
face's, from the owner's notes and the second opinion they asked for; see docs/CHARACTERS.md).
`brows=` is how far from the nose's middle the brows start, on a face whose nose bridge is wide
enough that they'd run onto it (the Rifleman's).

The Captain was made with a blank face: sculpted sockets where the eyes go, a brow ridge, a nose,
and a pocket of skin in the beard where the mouth goes, all one skin. Nothing is cut into it. This
looks at the face square on, a grid of rays from the front, and finds:
  - the two eye sockets: the deepest dips in the band between the brow and the nose, either side;
  - the brow ridge over each: the most forward point above each socket;
  - the mouth: the bare-skin pocket between the moustache and the beard, by its colour;
then builds a patch for each eye-and-brow and one for the mouth: a grid of points lying on the skin
a hair proud of it, with the skin's own normal and the UV the skin is painted from there, so the
game can paint over the face in the face's own colours and light it as skin.

Everything is written in the model's own space as three.js loads it (y up, the face looking +z),
for the game to hang on the head bone.
"""

import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc

# Each patch's own picture of the skin under it, this many pixels a side.
PICTURE = 256

args = sys.argv[sys.argv.index("--") + 1 :]
source, out = os.path.abspath(args[0]), os.path.abspath(args[1])
pictures = os.path.abspath(args[2]) if len(args) > 2 and not args[2].startswith("eyes=") else None
told = next((a[5:] for a in args[2:] if a.startswith("eyes=")), None)
placed = next((a[6:] for a in args[2:] if a.startswith("place=")), None)
brow_start = next((float(a[6:]) for a in args[2:] if a.startswith("brows=")), None)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
bpy.context.view_layer.update()
body = next(o for o in bpy.context.scene.objects if o.type == "MESH")
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
mesh = body.data
world = body.matrix_world
verts = [world @ v.co for v in mesh.vertices]
mesh.calc_loop_triangles()
tris = [tuple(t.vertices) for t in mesh.loop_triangles]
tri_loops = [tuple(t.loops) for t in mesh.loop_triangles]
uv_layer = mesh.uv_layers.active.data
tree = BVHTree.FromPolygons(verts, tris)

# The painted picture, to read colours from.
image = next(
    n.image for m in mesh.materials for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image
    and any(link.to_socket.name == "Base Color" for link in n.outputs["Color"].links)
)
w, h = image.size
pixels = np.empty(w * h * 4, dtype=np.float32)
image.pixels.foreach_get(pixels)
pixels = pixels.reshape(h, w, 4)


def hit(origin, direction):
    """Where a ray meets the skin: point, normal, UV and colour, or None."""
    location, normal, index, _ = tree.ray_cast(origin, direction)
    if location is None:
        return None
    a, b, c = (verts[i] for i in tris[index])
    weights = poly_3d_calc([a, b, c], location)
    uv = sum((Vector(uv_layer[li].uv) * wt for li, wt in zip(tri_loops[index], weights)), Vector((0, 0)))
    x = min(w - 1, max(0, int(uv.x % 1 * w)))
    y = min(h - 1, max(0, int(uv.y % 1 * h)))
    return location, normal, uv, pixels[y, x, :3].copy()


head_bone = arm.data.bones["CC_Base_Head"]
neck = arm.matrix_world @ head_bone.head_local
top = max(v.z for v in verts if abs(v.x) < 0.05 and abs(v.y - neck.y) < 0.15)
size = top - neck.z
print("FACE neck", tuple(round(c, 4) for c in neck), "top", round(top, 4), "head", round(size, 4))

# The face, square on: depth (how far back the skin is) and colour on a fine grid.
step = size / 220
xs = np.arange(-size * 0.42, size * 0.42, step)
zs = np.arange(neck.z - size * 0.3, top, step)
depth = np.full((len(zs), len(xs)), np.nan)
colour = np.zeros((len(zs), len(xs), 3))
for j, z in enumerate(zs):
    for i, x in enumerate(xs):
        found = hit(Vector((x, neck.y - 2, z)), Vector((0, 1, 0)))
        if found:
            depth[j, i] = found[0].y
            colour[j, i] = found[3]
front = np.nanmin(depth)


def at(j, i):
    return float(xs[i]), float(zs[j])


# The nose: the most forward point of the face.
nj, ni = np.unravel_index(np.nanargmin(depth), depth.shape)
nose_x, nose_z = at(nj, ni)
print("FACE nose tip", round(nose_x, 4), round(nose_z, 4), "depth", round(float(depth[nj, ni]), 4))

# Hairiness, as the earlier scripts read it: yellow-brown, saturated, not too dark.
r, g, b = colour[..., 0], colour[..., 1], colour[..., 2]
v = colour.max(-1)
sat = np.where(v > 0, (v - colour.min(-1)) / np.maximum(v, 1e-6), 0)
safe = np.maximum(v - colour.min(-1), 1e-6)
hue = np.where(v == r, ((g - b) / safe) % 6, np.where(v == g, (b - r) / safe + 2, (r - g) / safe + 4)) / 6
hairy = (hue > 0.075) & (hue < 0.2) & (sat > 0.3)
skinny = (hue > 0.0) & (hue < 0.072) & (sat > 0.2) & (v > 0.45)

# The eye sockets: either side of the nose, between it and the brow, the skin furthest back
# relative to the face round it (a dip, not just the side of the head turning away).
smooth = np.copy(depth)
band = (zs > nose_z + size * 0.12) & (zs < nose_z + size * 0.45)
sockets = []
for side in (1, -1):
    best = None
    for j in np.nonzero(band)[0]:
        for i in range(len(xs)):
            x = xs[i]
            if not (size * 0.1 < x * side - nose_x * side < size * 0.3) or np.isnan(depth[j, i]):
                continue
            # Only on bare skin: hair framing the face (the Shaman's) dips and overhangs too.
            if not skinny[j, i]:
                continue
            # How far back this is compared with the ring of skin round it.
            ring = []
            for dj, di in ((0, 18), (0, -18), (18, 0), (-18, 0), (13, 13), (-13, 13), (13, -13), (-13, -13)):
                jj, ii = j + dj, i + di
                if 0 <= jj < len(zs) and 0 <= ii < len(xs) and not np.isnan(depth[jj, ii]):
                    ring.append(depth[jj, ii])
            if len(ring) < 6:
                continue
            dip = depth[j, i] - float(np.mean(ring))
            if best is None or dip > best[0]:
                best = (dip, j, i)
    sockets.append(best)
eyes = []
for dip, j, i in sockets:
    # The socket's middle: the middle of the dip's deepest part, not its single deepest point.
    near = [(jj, ii) for jj in range(j - 14, j + 15) for ii in range(i - 14, i + 15)
            if 0 <= jj < len(zs) and 0 <= ii < len(xs) and not np.isnan(depth[jj, ii])
            and depth[jj, ii] > depth[j, i] - size * 0.012]
    cj = sum(p[0] for p in near) / len(near)
    ci = sum(p[1] for p in near) / len(near)
    eyes.append((float(np.interp(ci, range(len(xs)), xs)), float(np.interp(cj, range(len(zs)), zs)), dip))
eyes.sort(key=lambda e: -e[0])
# Across the socket at its height, its middle is halfway between where its sides rise back to
# the face: the single deepest point sits towards the nose.
refined = []
for x0, z0, dip in eyes:
    j = int(np.argmin(np.abs(zs - z0)))
    side = 1 if x0 > nose_x else -1
    line = [(xs[i], depth[j, i]) for i in range(len(xs))
            if 0 < (xs[i] - nose_x) * side < size * 0.4 and not np.isnan(depth[j, i])]
    deepest = max(d for _, d in line)
    ridge_j = int(np.argmin(np.abs(zs - (z0 + size * 0.15))))
    ridge = np.nanmin(depth[ridge_j, [i for i in range(len(xs)) if 0 < (xs[i] - nose_x) * side < size * 0.3]])
    # How far the brow overhangs the socket in each column: the socket's middle is where it most does.
    rows_up = [jj for jj in range(len(zs)) if z0 < zs[jj] < z0 + size * 0.2]
    over = []
    for i in range(len(xs)):
        if not (0 < (xs[i] - nose_x) * side < size * 0.3) or np.isnan(depth[j, i]) or not skinny[j, i]:
            continue
        brow = np.nanmin(depth[rows_up, i]) if rows_up else np.nan
        if not np.isnan(brow):
            over.append((xs[i], depth[j, i] - brow))
    most = max(o for _, o in over)
    strong = [(x, o) for x, o in over if o > most * 0.85]
    middle = sum(x * o for x, o in strong) / sum(o for _, o in strong)
    refined.append((middle, z0, dip))
    print("FACE socket", side, "overhang", round(most, 4), "strongest from", round(min(x for x, _ in strong), 4), "to", round(max(x for x, _ in strong), 4))
eyes = sorted(refined, key=lambda e: -e[0])
told_numbers = [float(v) for v in told.split(",")] if told else []
eye_z = told_numbers[0] if told_numbers else (eyes[0][1] + eyes[1][1]) / 2
mid = nose_x
print("FACE sockets found", [(round(e[0], 4), round(e[1], 4), round(e[2], 4)) for e in eyes], "height used", round(eye_z, 4))


# Skin, loosely (shaded skin included), for measuring the face across.
bare_skin = (hue > 0.0) & (hue < 0.09) & (sat > 0.18) & (v > 0.25)


def skin_width(z):
    """How wide the bare skin is across the face at this height, from the nose out each way to the
    hairline (or where the head turns away), stepping over a single odd cell."""
    j = int(np.argmin(np.abs(zs - z)))
    i0 = int(np.argmin(np.abs(xs - nose_x)))
    ends = []
    for step in (-1, 1):
        i, last, gap = i0, i0, 0
        while 0 <= i + step < len(xs):
            i += step
            # Bare skin still facing the front: past the cheekbone the head turns away to the ears.
            if bare_skin[j, i] and not np.isnan(depth[j, i]) and depth[j, i] - front < size * 0.4:
                last, gap = i, 0
            else:
                gap += 1
                if gap > 1:
                    break
        ends.append(xs[last])
    return float(ends[1] - ends[0])


# The face's width at the cheekbones, just under the eyes (the sockets' shading breaks the skin up
# at the eyes themselves).
face_width = max(skin_width(eye_z - size * 0.07), skin_width(eye_z - size * 0.1))
# An eye: between a fifth of the face across and 0.13 of the head, scaled as told; one eye's width
# between them, so each eye's middle an eye's width out from the nose.
eye_width = (face_width / 5 + size * 0.13) / 2
eye_middle = eye_width
if placed:
    eye_width, eye_middle = (float(v) for v in placed.split(","))
print("FACE width at the cheekbones", round(face_width, 4), "head", round(size, 4), "an eye", round(eye_width, 4),
      "its middle", round(eye_middle, 4), "from the nose")
# In the game's terms (render/face/faceShader.ts): an eye is drawn 0.7 of its socket's half-width
# either side of a middle set 0.13 of it in towards the nose.
eye_half = eye_width / 1.4
half = eye_middle + 0.13 * eye_half

# The brow ridge: straight up from each socket, the most forward point.
ci = int(np.argmin(np.abs(xs - (mid + half))))
column = [(zs[j], depth[j, ci]) for j in range(len(zs)) if eye_z < zs[j] < eye_z + size * 0.22 and not np.isnan(depth[j, ci])]
brow_z = min(column, key=lambda c: c[1])[0]
if len(told_numbers) > 1:
    brow_z = told_numbers[1]
print("FACE brow ridge at", round(float(brow_z), 4), "above the socket by", round(float(brow_z - eye_z), 4))

# The mouth: below the nose, the band of bare skin in the beard nearest the middle.
mouth_rows = []
for j in range(len(zs)):
    z = zs[j]
    if not (nose_z - size * 0.35 < z < nose_z - size * 0.06):
        continue
    row = [i for i in range(len(xs)) if abs(xs[i] - mid) < size * 0.18 and skinny[j, i]]
    hair_row = [i for i in range(len(xs)) if abs(xs[i] - mid) < size * 0.18 and hairy[j, i]]
    mouth_rows.append((z, len(row), len(hair_row), row))
bare = [m for m in mouth_rows if m[1] > 6]
if bare:
    mouth_z = float(sum(m[0] * m[1] for m in bare) / sum(m[1] for m in bare))
    mouth_widths = [(max(xs[i] for i in m[3]) - min(xs[i] for i in m[3])) / 2 for m in bare]
    mouth_half = float(np.percentile(mouth_widths, 75))
    mouth_tall = (max(m[0] for m in bare) - min(m[0] for m in bare)) / 2
else:
    mouth_z, mouth_half, mouth_tall = nose_z - size * 0.15, size * 0.12, size * 0.04
print("FACE mouth", round(mouth_z, 4), "half wide", round(mouth_half, 4), "half tall", round(float(mouth_tall), 4),
      "bare rows", len(bare))


def picture_of(centre_x, centre_z, half_wide, half_tall):
    """The skin under a patch, as a picture of its own: each pixel looked up on the model's texture
    where a ray from the front meets the skin. The model's texture is cut into many small pieces, so
    a patch spanning several can't be painted from it by blending between its corners."""
    out = np.ones((PICTURE, PICTURE, 4), dtype=np.float32)
    last = np.array([0.8, 0.6, 0.5])
    for row in range(PICTURE):
        z = centre_z + half_tall * ((2 * row + 1) / PICTURE - 1)
        for col in range(PICTURE):
            x = centre_x + half_wide * ((2 * col + 1) / PICTURE - 1)
            found = hit(Vector((x, neck.y - 2, z)), Vector((0, 1, 0)))
            if found is not None:
                last = found[3]
            out[row, col, :3] = last
    return out


def patch(centre_x, centre_z, half_wide, half_tall, columns, rows):
    """A grid lying on the skin over a square-on rectangle of the face."""
    points, normals, uvs = [], [], []
    for row in range(rows):
        for col in range(columns):
            x = centre_x + half_wide * (2 * col / (columns - 1) - 1)
            z = centre_z + half_tall * (2 * row / (rows - 1) - 1)
            found = hit(Vector((x, neck.y - 2, z)), Vector((0, 1, 0)))
            if found is None:
                found = (Vector((x, front + size * 0.2, z)), Vector((0, -1, 0)), Vector((0, 0)), None)
            location, normal, uv, _ = found
            if normal.y > 0:
                normal = -normal
            lifted = location + normal * size * 0.004
            # Into three.js's space: Blender's (x, y, z) is three's (x, z, -y).
            points += [lifted.x, lifted.z, -lifted.y]
            normals += [normal.x, normal.z, -normal.y]
            uvs += [uv.x, 1 - uv.y]
    return {
        "columns": columns,
        "rows": rows,
        "middle": [centre_x, centre_z, 0.0],
        "halfWide": half_wide,
        "halfTall": half_tall,
        "points": [round(p, 5) for p in points],
        "normals": [round(n, 4) for n in normals],
        "uvs": [round(u, 5) for u in uvs],
    }


# Wide enough for the whole brow, which reaches past the eye at both ends (render/face/faceShader.ts:
# from 0.95 of the socket in towards the nose to 1.18 out towards the ear, its ends rounded). Patches
# that stopped short cut the brows off square.
eye_patch_wide = eye_half * 1.3
eye_patch_low = eye_z - size * 0.085
# Room above the brow for it to rise in surprise.
eye_patch_high = brow_z + size * 0.135
facts = {
    "head": size,
    "eyes": [[mid + s * half, eye_z] for s in (1, -1)],
    "browZ": float(brow_z),
    "eyeHalf": float(eye_half),
    **({"browStart": brow_start} if brow_start is not None else {}),
    "mouth": [mid, mouth_z],
    "mouthHalf": mouth_half,
    "mouthTall": float(mouth_tall),
    "patches": {
        "eyeL": patch(mid + half, (eye_patch_low + eye_patch_high) / 2, eye_patch_wide, (eye_patch_high - eye_patch_low) / 2, 28, 30),
        "eyeR": patch(mid - half, (eye_patch_low + eye_patch_high) / 2, eye_patch_wide, (eye_patch_high - eye_patch_low) / 2, 28, 30),
        "mouth": patch(mid, mouth_z, mouth_half * 1.35, max(float(mouth_tall) * 2.2, size * 0.06), 30, 18),
    },
}
# The three patches' own pictures of the skin under them, side by side in one picture next to the
# notes: tile 0 his left eye, 1 his right, 2 the mouth.
tiles = []
for n, key in enumerate(("eyeL", "eyeR", "mouth")):
    p = facts["patches"][key]
    tiles.append(picture_of(p["middle"][0], p["middle"][1], p["halfWide"], p["halfTall"]))
    p["tile"] = n
strip = np.concatenate(tiles, axis=1)
picture = bpy.data.images.new("face-skin", strip.shape[1], strip.shape[0])
picture.pixels.foreach_set(strip.reshape(-1))
picture.filepath_raw = os.path.splitext(out)[0] + ".png"
picture.file_format = "PNG"
picture.save()
facts["picture"] = os.path.basename(picture.filepath_raw)
facts["tiles"] = len(tiles)
print("FACE skin pictures", picture.filepath_raw, strip.shape[1], "x", strip.shape[0])
with open(out, "w", encoding="utf8") as f:
    json.dump(facts, f)
print("FACE wrote", out)

if pictures:
    # The depth and the colour, square on, with what was found marked: to look at.
    # Depth shown with the face's own range stretched, so the sockets show.
    face_depth = depth[(zs > nose_z - size * 0.3)[:, None] & (np.abs(xs - nose_x) < size * 0.3)[None, :]]
    near_, far_ = np.nanpercentile(face_depth, 2), np.nanpercentile(face_depth, 70)
    shade = np.clip(np.nan_to_num((depth - near_) / max(1e-6, far_ - near_), nan=1.0), 0, 1)
    rgba = np.ones((len(zs), len(xs) * 2, 4), dtype=np.float32)
    rgba[:, : len(xs), :3] = (1 - shade)[..., None] ** 1.6
    rgba[:, len(xs) :, :3] = colour

    def mark(x, z, col):
        i = int(np.argmin(np.abs(xs - x)))
        j = int(np.argmin(np.abs(zs - z)))
        for di in (0, len(xs)):
            rgba[max(0, j - 2) : j + 3, max(0, i + di - 2) : i + di + 3, :3] = col

    for e in facts["eyes"]:
        mark(e[0], e[1], (0, 1, 0))
        mark(e[0], float(brow_z), (0, 0.6, 1))
    mark(mid, mouth_z, (1, 0, 1))
    mark(mid - mouth_half, mouth_z, (1, 0, 0))
    mark(mid + mouth_half, mouth_z, (1, 0, 0))
    mark(nose_x, nose_z, (1, 1, 0))
    img = bpy.data.images.new("map", len(xs) * 2, len(zs))
    img.pixels.foreach_set(rgba.reshape(-1))
    img.filepath_raw = pictures + "-facemap.png"
    img.file_format = "PNG"
    img.save()
    print("FACE picture", pictures + "-facemap.png")
