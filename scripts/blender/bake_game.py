"""A light copy of a rigged character, its detail baked into pictures (docs/CHARACTERS.md).

  blender -b -P scripts/blender/bake_game.py -- <rigged.glb> <out.glb> [triangles] [picture]

The walkthrough the owner was given (2026-11-21) for taking a 300,000-triangle model down to a
game-ready few thousand with its look kept, done here without the clicking. The owner's budget for
what's only seen from the game's high cameras (2026-11-23): 2,000 to 4,000 triangles, pictures 512
to 1024, the look carried by the baked color and normals.

1. The rigged model is copied: the copy (the light one) keeps the skeleton.
2. The light one is made one closed skin over everything (a voxel remesh, about a centimetre fine),
   so clothes, hair and the body under them are a single surface that thins cleanly: thinned as
   they were, the Captain's shirt, a thin shell over his body, broke up into holes at 4,000
   triangles. Its bones' weights are carried over from the nearest point of the full model.
3. It's thinned (Decimate, collapse) to about `triangles` (4,000 unless told), the head to a share
   of its own first, and shaded smooth.
4. It's unwrapped afresh (Smart UV Project, margin 0.02): the original's UVs are cut into thousands
   of scraps, which a thinned mesh can't follow.
5. Two pictures, `picture` square (1024 unless told), are baked from the full model onto the light
   one in Cycles, selected to active, the rays cast a little way out from the light one's surface
   and back: its colour (Diffuse, colour only, no light), and its normals (tangent space), which
   is what puts the full model's folds, seams and edges back on the light one's few faces.
6. The light one gets a material of just those two, the full model is dropped, and it's written as
   a GLB with its skeleton, the pictures as WebP.

Both are posed at rest while baking, so the bake sees the shape the skin is bound to.
"""

import os
import sys

import bmesh
import bpy

args = sys.argv[sys.argv.index("--") + 1 :]
source, out = os.path.abspath(args[0]), os.path.abspath(args[1])
triangles = int(args[2]) if len(args) > 2 else 4000
picture = int(args[3]) if len(args) > 3 else 1024

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


def applied(modifier):
    """Applies a modifier to the light one's resting shape: ahead of the armature, which has to
    move what's already been done to it."""
    while low.modifiers[0] != modifier:
        low.modifiers.move(len(low.modifiers) - 1, 0)
    bpy.context.view_layer.objects.active = low
    bpy.ops.object.select_all(action="DESELECT")
    low.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    low.data.calc_loop_triangles()
    return len(low.data.loop_triangles)


skin = low.modifiers.new("skin", "REMESH")
skin.mode = "VOXEL"
skin.voxel_size = size * 0.005
skin.adaptivity = 0.0
applied(skin)
# Crumbs the remesh leaves (a strand, a strap's end) go: each can only thin so far, and a few
# thousand of them held the Rifleman at twice his budget.
mesh = bmesh.new()
mesh.from_mesh(low.data)
pieces = []
seen = set()
for start in mesh.faces:
    if start in seen:
        continue
    piece = [start]
    seen.add(start)
    for face in piece:
        for edge in face.edges:
            for other in edge.link_faces:
                if other not in seen:
                    seen.add(other)
                    piece.append(other)
    pieces.append(piece)
largest = max(len(p) for p in pieces)
crumbs = [face for p in pieces if len(p) < largest * 0.002 for face in p]
bmesh.ops.delete(mesh, geom=crumbs, context="FACES")
mesh.to_mesh(low.data)
mesh.free()
print("BAKE pieces", len(pieces), "dropped faces", len(crumbs))
weights = low.modifiers.new("weights", "DATA_TRANSFER")
weights.object = high
weights.use_vert_data = True
weights.data_types_verts = {"VGROUP_WEIGHTS"}
weights.vert_mapping = "POLYINTERP_NEAREST"
weights.layers_vgroup_select_src = "ALL"
weights.layers_vgroup_select_dst = "NAME"
bpy.context.view_layer.objects.active = low
bpy.ops.object.datalayout_transfer(modifier=weights.name)
closed = applied(weights)
print("BAKE closed skin", closed)


def thinned(ratio, group=None, keep=False):
    """Thins the light one to `ratio` of its faces; with `group`, only that part (or, `keep`,
    everything but that part)."""
    thin = low.modifiers.new("thin", "DECIMATE")
    thin.decimate_type = "COLLAPSE"
    thin.ratio = min(1.0, ratio)
    thin.use_collapse_triangulate = True
    if group:
        thin.vertex_group = group
        thin.invert_vertex_group = keep
    left = applied(thin)
    print("BAKE thinned", group or "all", "kept" if keep else "", round(ratio, 4), "->", left)
    return left


# The head gets a budget of its own, or the whole-body budget flattens the face (rig-hero.mjs does
# the same for the heroes): thinned to its share first, then the rest with the head held.
HEAD = "CC_Base_Head"
if HEAD in low.vertex_groups and triangles < closed:
    low.data.calc_loop_triangles()
    group = low.vertex_groups[HEAD].index
    on_head = {
        v.index for v in low.data.vertices if any(g.group == group and g.weight > 0.5 for g in v.groups)
    }
    head_faces = sum(1 for t in low.data.loop_triangles if all(i in on_head for i in t.vertices))
    head_budget = round(triangles * 0.35)
    if head_faces > head_budget:
        thinned((closed - head_faces + head_budget) / closed, HEAD)
    now = len(low.data.loop_triangles)
    now = thinned(triangles / now, HEAD, keep=True)
    # The neck, half the head's, is held too: whatever that leaves over, taken off everything (in a
    # few goes: one collapse can stop short of what it's asked for).
    for _ in range(4):
        if now <= triangles * 1.03:
            break
        now = thinned(triangles / now)
else:
    thinned(triangles / closed)
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
# Far enough out to start outside the full model wherever the light one has cut in under it (at
# 4,000 triangles it does by a few centimetres), or the rays find the teeth and the eyes' insides
# under the skin and speckle the face dark.
bake.cage_extrusion = size * 0.03
bake.max_ray_distance = size * 0.07
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
