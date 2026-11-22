"""A copy of a rigged character for the game (docs/CHARACTERS.md).

  blender -b -P scripts/blender/game_copy.py -- <rigged.glb> <out.glb> [triangles] [picture]

Two are made of each character. The detailed one, for cutscenes and the hero screen, keeps every
triangle (`triangles` 0) and its 4096 pictures. The light one, for raids, where he's small on the
screen, is brought down to about `triangles` (40,000 say), keeping its shape, its UVs (so the paint
still lines up) and every point's bones, with pictures of `picture` (2048 say). Both are written
with their pictures as WebP, which three.js reads and which is several times smaller than PNG.
"""

import os
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1 :]
source, out = os.path.abspath(args[0]), os.path.abspath(args[1])
triangles = int(args[2]) if len(args) > 2 else 0
picture = int(args[3]) if len(args) > 3 else 4096

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
body = next(o for o in bpy.context.scene.objects if o.type == "MESH")
# AccuRig's face shapes: the game paints a face on instead, and they'd double the points it stores.
if body.data.shape_keys:
    body.shape_key_clear()
body.data.calc_loop_triangles()
have = len(body.data.loop_triangles)
if triangles and triangles < have:
    thin = body.modifiers.new("thin", "DECIMATE")
    thin.decimate_type = "COLLAPSE"
    thin.ratio = triangles / have
    # The UVs are cut into patches; collapsing across a cut would smear the paint.
    thin.delimit = {"SEAM", "UV"}
    thin.use_collapse_triangulate = True
    # The armature has to deform what's already thinned: thin first.
    while body.modifiers[0] != thin:
        body.modifiers.move(len(body.modifiers) - 1, 0)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=thin.name)
    body.data.calc_loop_triangles()
print("GAME triangles", have, "->", len(body.data.loop_triangles))

for image in bpy.data.images:
    if image.size[0] > picture:
        image.scale(picture, picture)
        print("GAME picture", image.name, "->", picture)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_skins=True,
    export_animations=False,
    export_image_format="WEBP",
    export_image_quality=88,
)
print("GAME wrote", out, round(os.path.getsize(out) / 1e6, 2), "MB")
