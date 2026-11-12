# Builds one lead as a rigged, skinned GLB with Blender + MPFB (MakeHuman, CC0 assets).
#   blender -b --python chars/build_char.py -- chars/<spec>.json assets/characters/<name>.glb
# MPFB makes the body, skin, eyes, brows, lashes, teeth and hair on the game-engine skeleton; the costume
# (robe top, wide sleeves, skirt, trousers, boots, belt, beads) is generated here from the body's own shape and
# bone weights, so it bends with the same skeleton. Body skin under the costume is removed to stop poke-through.
import bpy, bmesh, sys, os, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SPEC = json.load(open(argv[0], encoding='utf8'))
OUT = os.path.abspath(argv[1])

from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.assetservice import AssetService
from bl_ext.blender_org.mpfb.services.locationservice import LocationService
from bl_ext.blender_org.mpfb.services.exportservice import ExportService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService

# ---------------------------------------------------------------- asset packs
data = LocationService.get_user_data()
for z in SPEC.get('packs', []):
    mark = os.path.join(data, 'packs', os.path.basename(z).replace('_cc0.zip', '.json'))
    if not os.path.exists(mark):
        print('installing pack', z)
        AssetService.fix_and_extract_asset_pack_zip(z, data)
AssetService.update_all_asset_lists()

# ---------------------------------------------------------------- human
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
info = HumanService._create_default_human_info_dict()
info.update(SPEC['human'])
info['name'] = SPEC['name']
st = HumanService.get_default_deserialization_settings()
st.update({'subdiv_levels': 0, 'load_clothes': False})
body = HumanService.deserialize_from_dict(info, st)
rig = body.parent
print('rig', rig and rig.name, 'body', body.name)

TargetService.bake_targets(body)
ExportService.bake_modifiers_remove_helpers(body, bake_masks=True, bake_subdiv=False, remove_helpers=True)
for o in body.children if rig is None else rig.children:
    if o.type == 'MESH' and o.data.shape_keys:
        o.shape_key_clear()
for o in (rig.children if rig else []):  # bake masks on hair/brows etc. too
    for m in list(o.modifiers):
        if m.type in ('MASK', 'SUBSURF'):
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)

bones = {b.name: b for b in rig.data.bones}
def bone_head(n): return rig.matrix_world @ bones[n].head_local
def bone_tail(n): return rig.matrix_world @ bones[n].tail_local

# ---------------------------------------------------------------- helpers
def weights(obj):
    names = {g.index: g.name for g in obj.vertex_groups}
    W = []
    for v in obj.data.vertices:
        W.append({names[g.group]: g.weight for g in v.groups if g.group in names and names[g.group] in bones and g.weight > 1e-4})
    return W

def wsum(w, prefixes):
    return sum(x for k, x in w.items() if any(k.startswith(p) for p in prefixes))

def new_obj(name, bm, mat):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    if mat not in bpy.data.materials: bpy.data.materials.new(mat)
    me.materials.append(bpy.data.materials[mat])
    return ob

def bind(ob, groups):
    """groups: list (per vertex) of {bone: weight}"""
    for vi, wd in enumerate(groups):
        s = sum(wd.values()) or 1
        for k, x in wd.items():
            g = ob.vertex_groups.get(k) or ob.vertex_groups.new(name=k)
            g.add([vi], x / s, 'REPLACE')
    ob.parent = rig
    m = ob.modifiers.new('Armature', 'ARMATURE'); m.object = rig
    for p in ob.data.polygons: p.use_smooth = True

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def cyl_uv(bm, cx, cy):
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        us = [math.atan2(l.vert.co.x - cx, -(l.vert.co.y - cy)) / (2 * math.pi) + .5 for l in f.loops]
        if max(us) - min(us) > .5: us = [u + 1 if u < .5 else u for u in us]
        for l, u in zip(f.loops, us): l[uv].uv = (u * 4, l.vert.co.z * 2)

BW = weights(body)
C = SPEC['costume']

# ---------------------------------------------------------------- garment from the body surface (fitted top, trousers, boots)
def shell(name, mat, keep, off, smooth_it=4, extra=None):
    bm = bmesh.new(); bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    dl = [v for v in bm.verts if not keep(v.index, v.co)]
    bmesh.ops.delete(bm, geom=dl, context='VERTS')
    for _ in range(smooth_it): bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # relax the cut edges: vertex-deletion leaves stair steps, so slide each boundary vertex toward its boundary neighbours
    for _ in range(10):
        moves = []
        for v in bm.verts:
            if not v.is_boundary: continue
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2: moves.append((v, (nb[0].co + nb[1].co) * .5))
        for v, c in moves: v.co = v.co * .4 + c * .6
    bm.normal_update()
    for v in bm.verts: v.co += v.normal * (off(v.co) if callable(off) else off)
    if extra: extra(bm)
    # remember source vertex ids through a layer so weights can be copied
    return bm

def shell_obj(name, mat, keep, off, smooth_it=4, extra=None):
    idx = [i for i, v in enumerate(body.data.vertices) if keep(i, v.co)]
    bm = shell(name, mat, keep, off, smooth_it, extra)
    cyl_uv(bm, 0, 0)
    ob = new_obj(name, bm, mat)
    bind(ob, [BW[i] for i in idx[:len(ob.data.vertices)]])
    return ob

pel = bone_head('pelvis'); waistZ = bone_head('spine_01').z + .02
kneeZ = bone_head('calf_l').z; ankleZ = bone_head('foot_l').z
TORSO = ('pelvis', 'spine_', 'clavicle_', 'neck_01')
ARMS = ('hand_', 'lowerarm_', 'upperarm_', 'index_', 'middle_', 'ring_', 'pinky_', 'thumb_')
covered = []

top = C.get('top')
if top:
    bare_r = top.get('bare_right', False)
    sh_l = bone_head('upperarm_l'); hip_r = bone_head('thigh_r')
    nz = bone_head('neck_01').z
    cut = lambda x: nz - .06 - max(0.0, -x + .03) * 1.05
    def in_top(i, co, margin=0.0):
        w = BW[i]
        t = wsum(w, TORSO + ('upperarm_l',)) + (0 if bare_r else wsum(w, ('upperarm_r',))) + wsum(w, ('lowerarm_',)) * top.get('forearm', 1)
        if w.get('neck_01', 0) > .35 or wsum(w, ('head',)) > .1 or wsum(w, ('hand_',)) > .2: return False
        if co.z < waistZ - .24 and wsum(w, ('lowerarm_', 'upperarm_')) < .5: return False
        if bare_r:
            # kasaya: bare right shoulder; the cloth runs from the left shoulder down across to the right ribs
            if wsum(w, ('upperarm_r', 'lowerarm_r', 'clavicle_r')) > .3: return False
            if co.x < .03 and co.z > cut(co.x) - margin: return False
        return t > .55
    def straighten(bm):
        # pull the stair-stepped kasaya edge onto the diagonal so the hem reads as one clean fold
        if not bare_r: return
        for v in bm.verts:
            if v.is_boundary and v.co.x < .06 and v.co.z > cut(v.co.x) - .07 and v.co.z > waistZ + .1: v.co.z = cut(v.co.x) + .012
    shell_obj(SPEC['name'] + '_top', top['mat'], in_top, top.get('off', .012), 4, straighten)
    covered.append(lambda i, co: in_top(i, co, .05) and not (BW[i].get('neck_01', 0) > .1) and co.z < waistZ + .55 or (in_top(i, co) and wsum(BW[i], ('upperarm_',)) > .5))

pants = C.get('pants')
if pants:
    def in_pants(i, co):
        w = BW[i]
        return wsum(w, ('thigh_', 'calf_')) + w.get('pelvis', 0) > .6 and co.z < waistZ + .02 and co.z > ankleZ + .06
    shell_obj(SPEC['name'] + '_pants', pants['mat'], in_pants, pants.get('off', .008))
    covered.append(lambda i, co: in_pants(i, co) and co.z < waistZ - .06)

boots = C.get('boots')
if boots:
    def in_boots(i, co):
        w = BW[i]
        return (wsum(w, ('foot_', 'ball_')) > .3 or (wsum(w, ('calf_',)) > .5 and co.z < ankleZ + boots.get('h', .22)))
    shell_obj(SPEC['name'] + '_boots', boots['mat'], in_boots, boots.get('off', .016), 12)
    covered.append(lambda i, co: in_boots(i, co) and co.z < ankleZ + boots.get('h', .22) - .03)

br = C.get('bracers')
if br:
    hl = {s: bone_head('hand_' + s) for s in 'lr'}
    def in_br(i, co):
        w = BW[i]; s = 'l' if co.x > 0 else 'r'
        return wsum(w, ('lowerarm_',)) > .4 and (co - hl[s]).length < br.get('len', .17) and wsum(w, ('hand_',)) < .5
    shell_obj(SPEC['name'] + '_bracers', br['mat'], in_br, br.get('off', .02), 6)

# ---------------------------------------------------------------- lathe garments: skirt and wide sleeves
def section(z, band=.02, side=None):
    xs = [(v.co.x, v.co.y) for v in body.data.vertices if abs(v.co.z - z) < band and (side is None or v.co.x * side > .02) and wsum(BW[v.index], ARMS) < .05]
    if not xs: return 0, 0, .15, .1
    cx = sum(p[0] for p in xs) / len(xs) if side else 0; cy = sum(p[1] for p in xs) / len(xs)
    rx = max(abs(p[0] - cx) for p in xs); ry = max(abs(p[1] - cy) for p in xs)
    return cx, cy, rx, ry

skirt = C.get('skirt')
if skirt:
    z0 = waistZ + skirt.get('top', 0); z1 = ankleZ + skirt.get('hem', .06)
    cx, cy, rx, ry = section(z0, .03)
    _, _, hx, hy = section(bone_head('thigh_l').z - .06, .03)
    rows, cols = 22, 80; OV = .35   # an open wrap: starts at the front centre, runs round the left, the back, the right and overlaps the left front panel
    bm = bmesh.new(); grid = []; W = []
    def left_frac(a):
        if a < math.pi / 2: return 1.0
        if a < math.pi: return 1 - .5 * smooth(math.pi / 2, math.pi, a)
        if a < 1.5 * math.pi: return .5 * (1 - smooth(math.pi, 1.5 * math.pi, a))
        return 0.0
    for r in range(rows + 1):
        f = r / rows; z = z0 + (z1 - z0) * f
        hipk = smooth(0, .3, f)
        ax = (rx + .02) * (1 - hipk) + (hx + .035) * hipk + skirt.get('flare', .12) * f ** 1.3
        ay = (ry + .02) * (1 - hipk) + (hy + .035) * hipk + skirt.get('flare', .12) * .8 * f ** 1.3
        row = []
        for c in range(cols + 1):
            a = c / cols * (2 * math.pi + OV)
            lift = .004 * (c / cols) if a > 2 * math.pi else 0
            x = cx + math.sin(a) * (ax + lift * 3); y = cy - math.cos(a) * (ay + lift * 3)
            row.append(bm.verts.new((x, y, z)))
            k = min(.9, f * 1.25); lf = left_frac(a)
            kz = smooth(kneeZ + .1, kneeZ - .15, z)
            W.append({'pelvis': 1 - k + 1e-3, 'thigh_l': k * lf * (1 - kz * .45), 'calf_l': k * lf * kz * .45, 'thigh_r': k * (1 - lf) * (1 - kz * .45), 'calf_r': k * (1 - lf) * kz * .45})
        grid.append(row)
    for r in range(rows):
        for c in range(cols):
            bm.faces.new((grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=.006)
    cyl_uv(bm, cx, cy)
    bm.verts.ensure_lookup_table()
    ob = new_obj(SPEC['name'] + '_skirt', bm, skirt['mat'])
    nW = len(W)
    bind(ob, [W[i % nW] for i in range(len(ob.data.vertices))])
    covered.append(lambda i, co: co.z < z0 and co.z > z1 + .05 and wsum(BW[i], ('thigh_', 'pelvis')) > .5 and skirt.get('cover_thigh', False))

for s in C.get('sleeves', []):
    side = s['side']; e = bone_head('lowerarm_' + side); w = bone_head('hand_' + side)
    ax = (w - e).normalized(); L = (w - e).length + s.get('over', .1)
    up = Vector((0, 0, 1)); u = ax.cross(up).normalized(); v = u.cross(ax).normalized()
    rows, cols = 14, 40
    bm = bmesh.new(); grid = []; W = []
    for r in range(rows + 1):
        f = r / rows; c0 = e + ax * (L * f - .03)
        rad = s.get('r0', .065) + (s.get('r1', .16) - s.get('r0', .065)) * f ** 1.6
        sag = s.get('sag', .06) * f ** 2
        row = []
        for c in range(cols):
            a = c / cols * 2 * math.pi
            p = c0 + u * math.cos(a) * rad + v * math.sin(a) * rad * (1 + .25 * f) - v * sag * (1 - math.sin(a)) * .5 - Vector((0, 0, sag))
            row.append(bm.verts.new(p))
            W.append({'lowerarm_' + side: 1 - .35 * f, 'hand_' + side: .35 * f * f, 'upperarm_' + side: .25 * (1 - f) ** 3})
        grid.append(row)
    for r in range(rows):
        for c in range(cols):
            bm.faces.new((grid[r][c], grid[r][(c + 1) % cols], grid[r + 1][(c + 1) % cols], grid[r + 1][c]))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=.005)
    cyl_uv(bm, e.x, e.y)
    ob = new_obj(SPEC['name'] + '_sleeve_' + side, bm, s['mat'])
    nW = len(W); bind(ob, [W[i % nW] for i in range(len(ob.data.vertices))])

belt = C.get('belt')
if belt:
    cx, cy, rx, ry = section(waistZ + belt.get('z', 0), .02)
    bm = bmesh.new(); grid = []; rows, cols = 4, 64; Hh = belt.get('h', .07)
    for r in range(rows + 1):
        z = waistZ + belt.get('z', 0) - Hh / 2 + Hh * r / rows; bulge = .012 * math.sin(math.pi * r / rows)
        grid.append([bm.verts.new((cx + math.sin(c / cols * 6.283) * (rx + .03 + bulge), cy - math.cos(c / cols * 6.283) * (ry + .03 + bulge), z)) for c in range(cols)])
    for r in range(rows):
        for c in range(cols): bm.faces.new((grid[r][c], grid[r][(c + 1) % cols], grid[r + 1][(c + 1) % cols], grid[r + 1][c]))
    cyl_uv(bm, cx, cy)
    ob = new_obj(SPEC['name'] + '_belt', bm, belt['mat'])
    bind(ob, [{'pelvis': .5, 'spine_01': .5}] * len(ob.data.vertices))

beads = C.get('beads')
if beads:
    n = beads.get('n', 54); nk = bone_head('neck_01'); sp = bone_head('spine_03')
    bm = bmesh.new(); W = []
    for k in range(n):
        a = k / n * 2 * math.pi
        # hangs from the back of the neck down to the sternum: a tilted loop
        p = Vector((math.sin(a) * .135, nk.y - math.cos(a) * (.13 + .12 * (1 + math.cos(a)) * .5) + .01, nk.z - .04 - (1 + math.cos(a)) * .5 * .2))
        r = beads.get('r', .011) * (1.8 if k == 0 else 1)
        before = len(bm.verts)
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=r, matrix=__import__('mathutils').Matrix.Translation(p))
        W += [{'spine_03': .6, 'neck_01': .4}] * (len(bm.verts) - before)
    ob = new_obj(SPEC['name'] + '_beads', bm, beads['mat'])
    bind(ob, W)

# ---------------------------------------------------------------- remove skin hidden under the costume
if covered:
    bm = bmesh.new(); bm.from_mesh(body.data); bm.verts.ensure_lookup_table()
    dl = [v for v in bm.verts if any(f(v.index, v.co) for f in covered)]
    bmesh.ops.delete(bm, geom=dl, context='VERTS'); bm.to_mesh(body.data); bm.free()

# ---------------------------------------------------------------- export
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for o in rig.children_recursive: o.select_set(True)
bpy.context.view_layer.objects.active = rig
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_skins=True,
                          export_morph=False, export_animations=False, export_image_format='JPEG', export_jpeg_quality=92, export_yup=True)
print('wrote', OUT, [o.name for o in rig.children_recursive])
