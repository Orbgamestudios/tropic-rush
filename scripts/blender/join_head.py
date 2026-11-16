"""Gets a generated character ready for the rig (docs/CHARACTERS.md).

  blender -b -P scripts/blender/join_head.py -- models-wip/captain-apose-raw.glb \\
      models-wip/captain-prepped.glb models-wip/captain-face.json --head models-wip/captain-head-raw.glb

A generator spends its detail evenly, so on a whole figure the face gets little of it. With
--head, a second model made from the head alone takes the place of the figure's own head: it's
sized and set where the figure's head is (by the eyes, the jaw and the chin of each), the figure's
head is taken off above the chin, the head's colours are brought to the figure's, and the two share
one picture, side by side.

The face itself is left as the generator made it. His eyes and mouth are painted in the game, on
patches that lie on the face and change as he blinks, looks about and speaks (render/facePaint.ts).
This writes down where they go: where the eyes and the mouth are and how big, as shares of the
model's height ([out to his left, up, forward], as scripts/rig-hero.mjs has its joints), and the
colours of the skin beside the eyes and round the mouth, which the patches are painted on.
"""

import colorsys
import json
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from character_target import Target  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1 :]
source, out, notes = (os.path.abspath(a) for a in args[:3])
head_source = os.path.abspath(args[args.index("--head") + 1]) if "--head" in args else None
bpy.ops.wm.read_factory_settings(use_empty=True)
figure = Target(source)
fm = figure.marks
tall = figure.tall

bpy.ops.import_scene.gltf(filepath=source)
bpy.context.view_layer.update()
body = max((o for o in bpy.context.scene.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
world = body.matrix_world.copy()
body.parent = None
body.matrix_world.identity()
body.data.transform(world)
mesh = body.data

# Whose face it is: the figure's own, or the head made on its own, laid where the figure's is.
face = figure
m = fm
if head_source:
    face = Target(head_source, head_only=True)
    hm = face.marks
    sizes = sorted([
        fm["apart"] / hm["apart"],
        fm["jaw_half"] / hm["jaw_half"],
        (fm["eye_z"] - fm["chin_z"]) / (hm["eye_z"] - hm["chin_z"]),
    ])
    scale = sizes[1]
    theirs = Vector((hm["mid"], (hm["eyes"][0].y + hm["eyes"][1].y) / 2, hm["eye_z"]))
    ours = Vector((fm["mid"], (fm["eyes"][0].y + fm["eyes"][1].y) / 2, fm["eye_z"]))
    face.fit(scale, ours - theirs * scale)

    # Two runs of the generator never quite agree on colour. The head's picture is brought most
    # of the way to the figure's by the skin of the cheek, which both have: all the way turns his
    # hair orange.
    def cheek_of(model, marks):
        return model.raw_ray(
            Vector((marks["eyes"][0].x, -10, marks["eye_z"] - marks["apart"] * 0.45)), Vector((0, 1, 0))
        )[2]

    gain = [1 + (a / max(b, 0.05) - 1) * 0.6 for a, b in zip(cheek_of(figure, fm), cheek_of(face, hm))]
    for c in range(3):
        face.pixels[:, :, c] = np.clip(face.pixels[:, :, c] * gain[c], 0, 1)
    print("JOIN head laid on at", round(scale, 4), "of its size, colours by", [round(g, 3) for g in gain])
    m = hm


def here(x, y, z):
    return face.here(Vector((x, y, z)))


mid = here(m["mid"], 0, 0).x
mouth_z = here(0, 0, m["mouth_z"]).z
eye_z = here(0, 0, m["eye_z"]).z
chin_z = here(0, 0, m["chin_z"]).z
half = m["mouth_half"] * face.scale
eye_half = m["eye_half"] * face.scale
apart = m["apart"] * face.scale

if head_source:
    bm = bmesh.new()
    bm.from_mesh(mesh)
    layer = bm.loops.layers.uv.verify()
    # Off with the figure's own head, above its chin.
    gone = [
        f for f in bm.faces
        if f.calc_center_median().z > fm["chin_z"] + tall * 0.002
        and abs(f.calc_center_median().x - fm["mid"]) < tall * 0.2
    ]
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    for f in bm.faces:
        for loop in f.loops:
            loop[layer].uv.x *= 0.5

    # On with the new one, but for the stub of collar the generator stood it on.
    def keep(p, colour):
        _, sat, v = colorsys.rgb_to_hsv(*colour)
        if p.z < chin_z - apart * 0.9:
            return False
        return not (sat < 0.25 and v < 0.5 and p.z < mouth_z)

    points, tris, _ = face.cut(keep)
    made = [bm.verts.new(p) for p in points]
    added = 0
    for tri, uvs in zip(tris, face.cut_uvs):
        try:
            f = bm.faces.new([made[i] for i in tri])
        except ValueError:
            continue
        f.smooth = True
        for loop, uv in zip(f.loops, uvs):
            loop[layer].uv = (0.5 + uv[0] * 0.5, uv[1])
        added += 1
    print("JOIN head swapped:", len(gone), "faces off,", added, "on")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    # One picture for both: the figure's on the left half, the head's on the right.
    if figure.pixels.shape != face.pixels.shape:
        raise RuntimeError("The two models' pictures are different sizes")
    both = np.hstack([figure.pixels, face.pixels])
    h, w, _ = both.shape
    picture = bpy.data.images.new("both", w, h)
    picture.pixels.foreach_set(both.reshape(-1))
    picture.filepath_raw = os.path.splitext(out)[0] + "-picture.png"
    picture.file_format = "PNG"
    picture.save()
    skin_of = bpy.data.materials.new("skin")
    skin_of.use_nodes = True
    shader = skin_of.node_tree.nodes["Principled BSDF"]
    shader.inputs["Roughness"].default_value = 0.8
    shader.inputs["Metallic"].default_value = 0.0
    tex = skin_of.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = picture
    skin_of.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    mesh.materials.clear()
    mesh.materials.append(skin_of)
    for p in mesh.polygons:
        p.material_index = 0

zs = [v.co.z for v in mesh.vertices]
low, top = min(zs), max(zs)
whole = top - low


def share(p):
    return [round(p.x / whole, 5), round((p.z - low) / whole, 5), round(-p.y / whole, 5)]


def colour_at(x, z):
    hit = face.ray(Vector((x, -10, z)), Vector((0, 1, 0)))
    return [round(c, 4) for c in hit[2]], hit[0].y


# The eyes' own middles (the painted pupils may be looking aside), on the skin.
eyes = sorted(
    (here(box[2], pupil.y, box[3]) for box, pupil in zip(m["eye_boxes"], m["eyes"])), key=lambda p: -p.x
)
beside, _ = colour_at(eyes[0].x, eye_z - apart * 0.42)
under, lips = colour_at(mid, mouth_z - half * 0.28)
facts = {
    "eyes": [share(p) for p in eyes],
    "eye_half": round(eye_half / whole, 5),
    "mouth": share(Vector((mid, lips, mouth_z))),
    "mouth_half": round(half / whole, 5),
    # The skin beside the eyes, and what's round the mouth, which the patches are painted on.
    "skin": beside,
    "round_mouth": under,
}
with open(notes, "w", encoding="utf8") as f:
    json.dump(facts, f, indent=1)
print("JOIN", facts)

bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True)
print("JOIN wrote", out)
