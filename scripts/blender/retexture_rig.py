"""Puts a model's paint back on after rigging (docs/CHARACTERS.md).

  blender -b -P scripts/blender/retexture_rig.py -- <painted.glb> <rigged.fbx> <out.glb>

AccuRig keeps a model's shape and its UV layout (where on the picture each point is painted from)
but drops the pictures themselves, so the rigged FBX comes back with a bare material. This takes
the pictures from the painted model it was made from (its colour, and its metal-and-roughness map),
checks the two models' UVs agree point for point, sets the pictures on the rigged model, puts the
skeleton back inside the body if the FBX's idea of "up" turned it on its side, and writes it as
one GLB with its skeleton, ready for three.js.
"""

import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

painted, rigged, out = (os.path.abspath(a) for a in sys.argv[sys.argv.index("--") + 1 :][:3])


def uvs_of(mesh):
    loops = len(mesh.loops)
    uv = np.empty(loops * 2, dtype=np.float32)
    mesh.uv_layers[0].data.foreach_get("uv", uv)
    order = np.empty(loops, dtype=np.int32)
    mesh.loops.foreach_get("vertex_index", order)
    return uv, order


bpy.ops.wm.read_factory_settings(use_empty=True)

# The painted model: its pictures, and its UVs to check against.
bpy.ops.import_scene.gltf(filepath=painted)
source = next(o for o in bpy.context.scene.objects if o.type == "MESH")
source_uv, source_order = uvs_of(source.data)
nodes = source.data.materials[0].node_tree.nodes
links = source.data.materials[0].node_tree.links
colour = metal_rough = None
for link in links:
    if link.from_node.type != "TEX_IMAGE":
        continue
    if link.to_socket.name == "Base Color":
        colour = link.from_node.image
    elif link.to_node.type == "SEPARATE_COLOR":
        metal_rough = link.from_node.image
if colour is None:
    raise SystemExit("The painted model has no colour picture")
for image in (colour, metal_rough):
    if image:
        image.use_fake_user = True
for o in list(bpy.context.scene.objects):
    bpy.data.objects.remove(o)

# The rigged model.
bpy.ops.import_scene.fbx(filepath=rigged)
body = next(o for o in bpy.context.scene.objects if o.type == "MESH")
skeleton = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")


def misfit(arm_world):
    """How far, on average, a few bones are from the middle of the points each moves most."""
    groups = {g.index: g.name for g in body.vertex_groups}
    totals = {}
    for v in body.data.vertices:
        for g in v.groups:
            if g.weight > 0.5:
                name = groups[g.group]
                sums = totals.setdefault(name, [Vector(), 0])
                sums[0] += v.co
                sums[1] += 1
    far = []
    for name, (total, count) in totals.items():
        bone = skeleton.data.bones.get(name)
        if bone is None or count < 50:
            continue
        middle = body.matrix_world @ (total / count)
        far.append((arm_world @ bone.head_local - middle).length)
    return sum(far) / len(far)


# An FBX made for Unity says which way is up differently from Blender, and the importer can turn
# the body to match but not the skeleton, leaving the skeleton lying on its side in a standing
# body. It shows as bones far from what they move. Whichever quarter turn about the side-to-side
# axis puts them back is the one taken, the body staying where it is.
body_world = body.matrix_world.copy()
before = skeleton.matrix_world.copy()
best = min(
    (Matrix.Rotation(math.radians(a), 4, "X") for a in (0, 90, -90, 180)),
    key=lambda turn: misfit(turn @ before),
)
print("RETEXTURE skeleton off by", round(misfit(before), 4), "-> turned, off by", round(misfit(best @ before), 4))
skeleton.matrix_world = best @ before
bpy.context.view_layer.update()
body.matrix_world = body_world
bpy.context.view_layer.update()
# Both made plain (no turn, no scale left on either), as a game wants them.
bpy.ops.object.select_all(action="DESELECT")
skeleton.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = skeleton
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.context.view_layer.update()
print("RETEXTURE after making plain, off by", round(misfit(skeleton.matrix_world), 4))
uv, order = uvs_of(body.data)
if len(uv) != len(source_uv) or not (order == source_order).all():
    raise SystemExit("The rigged model's points aren't the painted model's: its UVs can't be trusted")
off = float(np.abs(uv - source_uv).max())
if off > 1e-4:
    raise SystemExit(f"The rigged model's UVs have moved (by up to {off}): the paint wouldn't line up")
print("RETEXTURE UVs match, largest difference", off)

# Its material, as the painted model had it.
material = body.data.materials[0]
material.use_nodes = True
tree = material.node_tree
tree.nodes.clear()
shader = tree.nodes.new("ShaderNodeBsdfPrincipled")
output = tree.nodes.new("ShaderNodeOutputMaterial")
tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
paint = tree.nodes.new("ShaderNodeTexImage")
paint.image = colour
tree.links.new(paint.outputs["Color"], shader.inputs["Base Color"])
if metal_rough:
    metal_rough.colorspace_settings.name = "Non-Color"
    surface = tree.nodes.new("ShaderNodeTexImage")
    surface.image = metal_rough
    split = tree.nodes.new("ShaderNodeSeparateColor")
    tree.links.new(surface.outputs["Color"], split.inputs["Color"])
    tree.links.new(split.outputs["Green"], shader.inputs["Roughness"])
    tree.links.new(split.outputs["Blue"], shader.inputs["Metallic"])
material.name = "captain"
print("RETEXTURE colour", colour.size[:], "metal and roughness", metal_rough.size[:] if metal_rough else None)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_skins=True,
    export_animations=False,
    export_image_format="AUTO",
)
print("RETEXTURE wrote", out, round(os.path.getsize(out) / 1e6, 1), "MB")
