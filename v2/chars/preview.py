# Quick look at a built GLB: front, three-quarter and face renders with Eevee.
#   blender -b --factory-startup --python chars/preview.py -- assets/characters/x.glb out/test/x
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=a[0])
for m in bpy.data.materials:
    if not any(k in m.name for k in ('eyelash', 'eyebrow', 'ponytail', 'hair')): m.blend_method = 'OPAQUE'; m.surface_render_method = 'DITHERED'
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 900, 1200
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True
sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.08, .09, .12, 1)
for rot, en in [((50, 0, -30), 4), ((70, 0, 150), 2)]:
    l = bpy.data.lights.new('l', 'SUN'); l.energy = en; o = bpy.data.objects.new('l', l); sc.collection.objects.link(o); o.rotation_euler = [math.radians(x) for x in rot]
cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam
def shot(name, pos, look, lens):
    cam.location = pos; cam.data.lens = lens
    cam.rotation_euler = (Vector(look) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = a[1] + '-' + name + '.png'; bpy.ops.render.render(write_still=True)
shot('front', (0, -4.2, 1.0), (0, 0, .9), 50)
shot('side', (3.0, -3.0, 1.2), (0, 0, .9), 50)
shot('back', (0, 4.2, 1.0), (0, 0, .9), 50)
shot('face', (.25, -1.0, 1.62), (0, 0, 1.58), 85)
