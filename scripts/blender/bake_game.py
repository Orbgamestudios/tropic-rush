"""A light copy of a rigged character, its detail baked into pictures (docs/CHARACTERS.md).

  blender -b -P scripts/blender/bake_game.py -- <rigged.glb> <out.glb> [triangles] [picture]

The walkthrough the owner was given (2026-11-21) for taking a 300,000-triangle model down to a
game-ready 5,000 to 8,000 with its look kept, done here without the clicking:

1. The rigged model is copied: the copy (the light one) keeps the skeleton and its weights.
2. The light one is thinned (Decimate, collapse) to about `triangles` (8,000 unless told) and
   shaded smooth.
3. It's unwrapped afresh (Smart UV Project, margin 0.02): the original's UVs are cut into thousands
   of scraps, which a thinned mesh can't follow.
4. Two pictures, `picture` square (2048 unless told), are baked from the full model onto the light
   one in Cycles, selected to active, the rays cast a little way out from the light one's surface
   and back: its colour (Diffuse, colour only, no light), and its normals (tangent space), which
   is what puts the full model's folds, seams and edges back on the light one's few faces.
5. The light one gets a material of just those two, the full model is dropped, and it's written as
   a GLB with its skeleton, the pictures as WebP.

Both are posed at rest while baking, so the bake sees the shape the skin is bound to.
"""

import os
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1 :]
source, out = os.path.abspath(args[0]), os.path.abspath(args[1])
triangles = int(args[2]) if len(args) > 2 else 8000
picture = int(args[3]) if len(args) > 3 else 2048

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
skeleton = next((o for o in bpy.context.scene.objects if o.type == "ARMATURE"), None)
high = next(o for o in bpy.context.scene.objects if o.type == "MESH")
if skeleton:
    skeleton.data.pose_position = "REST"
bpy.context.view_layer.update()
high.data.calc_loop_triangles()
have = len(high.data.loop_triangles)
size = max(high.dimensions)

# 1. The copy, in the same place.
low = high.copy()
low.data = high.data.copy()
low.name = high.name + "_low"
bpy.context.collection.objects.link(low)
high.name = high.name + "_high"

# 2. Thinned, and smooth. AccuRig's face shapes go: a face is drawn on in the game, and Blender
# won't thin a mesh that has them.
bpy.context.view_layer.objects.active = low
if low.data.shape_keys:
    print("BAKE dropping", len(low.data.shape_keys.key_blocks), "shape keys")
    low.shape_key_clear()
thin = low.modifiers.new("thin", "DECIMATE")
thin.decimate_type = "COLLAPSE"
thin.ratio = min(1.0, triangles / have)
thin.use_collapse_triangulate = True
while low.modifiers[0] != thin:
    low.modifiers.move(len(low.modifiers) - 1, 0)
bpy.context.view_layer.objects.active = low
bpy.ops.object.select_all(action="DESELECT")
low.select_set(True)
bpy.ops.object.modifier_apply(modifier=thin.name)
for poly in low.data.polygons:
    poly.use_smooth = True
low.data.calc_loop_triangles()
print("BAKE triangles", have, "->", len(low.data.loop_triangles))

# 3. Unwrapped afresh, as its only UVs.
while low.data.uv_layers:
    low.data.uv_layers.remove(low.data.uv_layers[0])
low.data.uv_layers.new(name="baked")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
# Thinning turns some faces inside out; a bake ray from an inside-out face starts under the
# clothes and paints the skin beneath onto them. All faced outward first.
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.uv.smart_project(island_margin=0.02)
bpy.ops.object.mode_set(mode="OBJECT")

# 4. Its material, with the two pictures to bake into.
material = bpy.data.materials.new("baked")
material.use_nodes = True
tree = material.node_tree
shader = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
shader.inputs["Roughness"].default_value = 0.72
shader.inputs["Metallic"].default_value = 0.0
colour_image = bpy.data.images.new("BakedColor", picture, picture, alpha=False)
normal_image = bpy.data.images.new("BakedNormal", picture, picture, alpha=False)
normal_image.colorspace_settings.name = "Non-Color"
colour_node = tree.nodes.new("ShaderNodeTexImage")
colour_node.image = colour_image
normal_node = tree.nodes.new("ShaderNodeTexImage")
normal_node.image = normal_image
low.data.materials.clear()
low.data.materials.append(material)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 4
scene.cycles.device = "CPU"
bake = scene.render.bake
bake.use_selected_to_active = True
bake.cage_extrusion = size * 0.015
bake.max_ray_distance = size * 0.05
bake.margin = 8

bpy.ops.object.select_all(action="DESELECT")
high.select_set(True)
low.select_set(True)
bpy.context.view_layer.objects.active = low


def bake_into(node, kind, **settings):
    for n in tree.nodes:
        n.select = False
    node.select = True
    tree.nodes.active = node
    bpy.ops.object.bake(type=kind, **settings)
    print("BAKE", kind, "done")


bake_into(colour_node, "DIFFUSE", pass_filter={"COLOR"})
bake_into(normal_node, "NORMAL", normal_space="TANGENT")

# 5. Wired up; the full model dropped; written out.
tree.links.new(colour_node.outputs["Color"], shader.inputs["Base Color"])
normal_map = tree.nodes.new("ShaderNodeNormalMap")
tree.links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
tree.links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
for image in (colour_image, normal_image):
    image.pack()
bpy.data.objects.remove(high)
if skeleton:
    skeleton.data.pose_position = "POSE"

bpy.ops.object.select_all(action="DESELECT")
low.select_set(True)
if skeleton:
    skeleton.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_selection=True,
    export_skins=True,
    export_animations=False,
    export_image_format="WEBP",
    export_image_quality=90,
    export_tangents=False,
)
print("BAKE wrote", out, round(os.path.getsize(out) / 1e6, 2), "MB")
