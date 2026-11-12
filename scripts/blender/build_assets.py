# Builds the store's custom retail assets in Blender and exports them as GLB files to public/assets/models/custom/.
# Run: blender -b --factory-startup --python scripts/blender/build_assets.py -- <out_dir>
#
# Coordinates: Blender Z-up; the glTF exporter converts to Y-up (Blender -Y becomes three.js +Z).
# The store front faces Blender -Y, i.e. three.js +Z. Units are metres.
# Materials are named so the app can retexture or tint them (FloorConcrete, WallPlaster, Oak, Glass, PriceRail, Pack, Screen ...).
import bpy, bmesh, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.abspath("public/assets/models/custom")
os.makedirs(OUT, exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

MATS = {}
def mat(name, color=(0.8, 0.8, 0.8), metal=0.0, rough=0.5, emit=None, emit_strength=1.0, alpha=1.0, transmission=0.0, ior=1.45):
    if name in MATS and MATS[name].name in bpy.data.materials: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    lin = lambda c: tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
    b.inputs["Base Color"].default_value = (*lin(color), 1)
    b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*lin(emit), 1); b.inputs["Emission Strength"].default_value = emit_strength
    if transmission:
        b.inputs["Transmission Weight"].default_value = transmission; b.inputs["IOR"].default_value = ior
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        try: m.surface_render_method = "BLENDED"
        except Exception: pass
    MATS[name] = m; return m

def assign(o, m):
    o.data.materials.clear(); o.data.materials.append(m); return o

def box(name, size, loc, m=None, bevel=0.0, seg=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.active_object; o.name = name
    o.scale = size; bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        bv = o.modifiers.new("bv", "BEVEL"); bv.width = bevel; bv.segments = seg; bv.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier="bv")
    if m: assign(o, m)
    return o

def cyl(name, r, depth, loc, rot=(0, 0, 0), m=None, verts=20, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts); o = bpy.context.active_object; o.name = name
    if bevel > 0:
        bv = o.modifiers.new("bv", "BEVEL"); bv.width = bevel; bv.segments = 2; bv.limit_method = "ANGLE"; bpy.ops.object.modifier_apply(modifier="bv")
    if m: assign(o, m)
    return o

def sphere(name, r, loc, scale=(1, 1, 1), m=None, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=seg // 2); o = bpy.context.active_object; o.name = name
    o.scale = scale; bpy.ops.object.transform_apply(scale=True)
    if m: assign(o, m)
    bpy.ops.object.shade_smooth(); return o

def tube(name, pts, r, m=None, res=6):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = r; cu.bevel_resolution = 1; cu.use_fill_caps = True
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts): sp.points[i].co = (*p, 1)
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target="MESH")
    if m: assign(o, m)
    return o

def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); o = bpy.context.active_object; o.name = name
    return o

def export(name, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    fp = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=fp, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
    print("EXPORTED", name, os.path.getsize(fp) // 1024, "KB", flush=True)

def smooth(o, angle=40):
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    try: bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
        except Exception: bpy.ops.object.shade_smooth()
    return o

# ---------------- palette ----------------
def P():
    return dict(
        dark=mat("FixtureDark", (0.13, 0.135, 0.14), metal=0.6, rough=0.45),
        light=mat("FixtureLight", (0.93, 0.92, 0.9), metal=0.2, rough=0.4),
        rail=mat("PriceRail", (0.95, 0.95, 0.93), rough=0.3, emit=(1, 0.97, 0.9), emit_strength=0.6),
        oak=mat("Oak", (0.62, 0.45, 0.3), rough=0.55),
        steel=mat("Steel", (0.78, 0.79, 0.8), metal=1.0, rough=0.28),
        chrome=mat("Chrome", (0.9, 0.9, 0.9), metal=1.0, rough=0.12),
        black=mat("BlackPlastic", (0.03, 0.03, 0.035), rough=0.35),
        white=mat("WhitePlastic", (0.92, 0.92, 0.9), rough=0.35),
        grey=mat("GreyPlastic", (0.45, 0.46, 0.48), rough=0.45),
        screen=mat("Screen", (0.02, 0.03, 0.05), rough=0.08, emit=(0.35, 0.55, 0.95), emit_strength=1.4),
        glass=mat("Glass", (0.85, 0.9, 0.92), rough=0.03, transmission=1.0, alpha=0.25),
        rubber=mat("Rubber", (0.04, 0.04, 0.04), rough=0.8),
        pack=mat("Pack", (1, 1, 1), rough=0.45),
        label=mat("PackLabel", (0.96, 0.95, 0.92), rough=0.5),
        fabric=mat("Fabric", (0.2, 0.21, 0.23), rough=0.95),
        mesh=mat("MeshFabric", (0.1, 0.1, 0.11), rough=0.9),
        figure=mat("Figure", (0.86, 0.85, 0.83), rough=0.7),
    )

# ======================= 1. GONDOLA SHELVING =======================
def build_gondola(p):
    W, D, H = 1.25, 1.1, 1.72
    parts = [box("plinth", (W, D, 0.12), (0, 0, 0.06), p["dark"], 0.006)]
    parts.append(box("back", (W - 0.06, 0.04, H - 0.12), (0, 0, 0.12 + (H - 0.12) / 2), p["light"], 0.004))
    for side in (-1, 1):   # pegboard grooves on the back panel
        for k in range(15):
            parts.append(box(f"groove{side}{k}", (W - 0.1, 0.004, 0.006), (0, side * 0.0215, 0.2 + k * 0.1), p["dark"]))
    for sx in (-1, 1):
        parts.append(box(f"post{sx}", (0.035, 0.07, H), (sx * (W / 2 - 0.0175), 0, H / 2), p["dark"], 0.004))
    shelf_z = [0.12, 0.505, 0.865, 1.225]
    for side in (-1, 1):
        for i, z in enumerate(shelf_z):
            y = side * 0.255
            if i: parts.append(box(f"shelf{side}{i}", (W - 0.08, 0.45, 0.022), (0, y, z), p["light"], 0.003))
            parts.append(box(f"rail{side}{i}", (W - 0.08, 0.012, 0.042), (0, side * 0.484, z + 0.005), p["rail"], 0.002))
            if i:
                for sx in (-1, 1):
                    parts.append(box(f"brk{side}{i}{sx}", (0.012, 0.42, 0.05), (sx * (W / 2 - 0.06), y, z - 0.035), p["dark"]))
    parts.append(box("topcap", (W, 0.12, 0.03), (0, 0, H + 0.015), p["dark"], 0.004))
    g = join(parts, "Gondola"); export("gondola", [g])

def build_endcap_sign(p):
    a = box("signpanel", (1.25, 0.05, 0.26), (0, 0, 0.13), p["dark"], 0.006)
    b = box("signface", (1.15, 0.052, 0.18), (0, 0, 0.13), mat("SignFace", (0.95, 0.93, 0.88), rough=0.4, emit=(1, 0.95, 0.85), emit_strength=0.5))
    s = join([a, b], "AisleSign"); export("aisle_sign", [s])

# ======================= 2. PRODUCTS =======================
def build_products(p):
    # carton (generic boxed product): body tinted per sub-category in the app, label band
    a = box("c_body", (0.12, 0.07, 0.22), (0, 0, 0.11), p["pack"], 0.004)
    b = box("c_label", (0.122, 0.072, 0.07), (0, 0, 0.12), p["label"], 0.002)
    export("prod_carton", [join([a, b], "Carton")])
    # paper ream, lying flat, wrapped with a printed band
    a = box("r_body", (0.297, 0.21, 0.052), (0, 0, 0.026), p["pack"], 0.006)
    b = box("r_band", (0.1, 0.212, 0.054), (0.04, 0, 0.026), p["label"], 0.002)
    export("prod_ream", [join([a, b], "Ream")])
    # ring binder standing, spine out (+Y = front after export becomes -Z; the app rotates as needed)
    sp = box("b_cover", (0.05, 0.3, 0.31), (0, 0, 0.155), p["pack"], 0.004)
    lab = box("b_label", (0.052, 0.2, 0.06), (0, -0.0, 0.2), p["label"], 0.002)
    hole = cyl("b_hole", 0.012, 0.054, (0, -0.02, 0.07), (0, math.pi / 2, 0), p["dark"], 16)
    export("prod_binder", [join([sp, lab, hole], "Binder")])
    # storage bin: open-top crate with ribs
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.11)); o = bpy.context.active_object; o.name = "bin"
    o.scale = (0.38, 0.28, 0.22); bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new(); bm.from_mesh(o.data); top = [f for f in bm.faces if f.normal.z > 0.9]; bmesh.ops.delete(bm, geom=top, context="FACES"); bm.to_mesh(o.data); bm.free()
    so = o.modifiers.new("so", "SOLIDIFY"); so.thickness = 0.006; bpy.ops.object.modifier_apply(modifier="so")
    bv = o.modifiers.new("bv", "BEVEL"); bv.width = 0.004; bv.segments = 2; bpy.ops.object.modifier_apply(modifier="bv"); assign(o, p["pack"])
    ribs = [box(f"rib{k}", (0.006, 0.282, 0.16), (-0.15 + k * 0.1, 0, 0.1), p["pack"]) for k in range(4)]
    rim = box("rim", (0.392, 0.292, 0.012), (0, 0, 0.214), p["label"], 0.003)
    export("prod_bin", [join([o, rim] + ribs, "StorageBin")])
    # small box (envelopes, labels, fasteners)
    a = box("s_body", (0.16, 0.1, 0.08), (0, 0, 0.04), p["pack"], 0.003); b = box("s_lab", (0.162, 0.102, 0.03), (0, 0, 0.05), p["label"], 0.001)
    export("prod_smallbox", [join([a, b], "SmallBox")])
    # art tin
    a = box("t_body", (0.2, 0.09, 0.03), (0, 0, 0.015), p["pack"], 0.008, 3); b = box("t_lid", (0.198, 0.088, 0.006), (0, 0, 0.031), p["chrome"], 0.003)
    export("prod_tin", [join([a, b], "ArtTin")])

def build_tech(p):
    # smartphone on a small acrylic stand
    body = box("ph_body", (0.072, 0.0085, 0.152), (0, 0, 0.076), p["black"], 0.004, 3)
    scr = box("ph_scr", (0.066, 0.001, 0.144), (0, -0.0045, 0.076), p["screen"], 0.002)
    cam = box("ph_cam", (0.026, 0.002, 0.026), (0.016, 0.0052, 0.13), p["dark"], 0.003)
    stand = box("ph_stand", (0.08, 0.06, 0.006), (0, 0.01, 0.003), mat("Acrylic", (0.9, 0.92, 0.95), rough=0.05, transmission=0.8, alpha=0.5))
    ph = join([body, scr, cam], "Phone"); ph.rotation_euler.x = math.radians(-12); ph.location.z = 0.006; bpy.ops.object.transform_apply(rotation=True, location=True)
    export("tech_phone", [join([ph, stand], "PhoneOnStand")])
    # laptop, lid open 110°
    base = box("lp_base", (0.31, 0.215, 0.014), (0, 0, 0.007), p["steel"], 0.004, 3)
    kb = box("lp_kb", (0.27, 0.1, 0.002), (0, 0.02, 0.0145), p["black"])
    tp = box("lp_tp", (0.1, 0.06, 0.001), (0, -0.065, 0.0142), p["grey"])
    lid = box("lp_lid", (0.31, 0.007, 0.205), (0, 0, 0.1025), p["steel"], 0.003)
    ls = box("lp_scr", (0.29, 0.001, 0.185), (0, -0.004, 0.105), p["screen"])
    l2 = join([lid, ls], "lid"); l2.location = (0, 0.1075, 0.012); l2.rotation_euler.x = math.radians(-20); bpy.ops.object.transform_apply(rotation=True, location=True)
    export("tech_laptop", [join([base, kb, tp, l2], "Laptop")])
    # monitor
    pnl = box("m_pnl", (0.62, 0.035, 0.37), (0, 0, 0.36), p["black"], 0.006)
    msc = box("m_scr", (0.6, 0.001, 0.345), (0, -0.018, 0.365), p["screen"])
    neck = box("m_neck", (0.05, 0.03, 0.2), (0, 0.04, 0.16), p["steel"], 0.006)
    foot = box("m_foot", (0.24, 0.17, 0.012), (0, 0.02, 0.006), p["steel"], 0.005)
    export("tech_monitor", [join([pnl, msc, neck, foot], "Monitor")])
    # multifunction copier (floor standing)
    parts = [box("cp_body", (0.62, 0.62, 0.78), (0, 0, 0.47), p["white"], 0.01)]
    for k in range(3): parts.append(box(f"cp_tray{k}", (0.6, 0.012, 0.004), (0, -0.31, 0.16 + k * 0.13), p["grey"]))
    for k in range(3): parts.append(box(f"cp_handle{k}", (0.18, 0.02, 0.018), (0, -0.318, 0.22 + k * 0.13), p["grey"], 0.004))
    parts.append(box("cp_base", (0.6, 0.6, 0.08), (0, 0, 0.04), p["dark"], 0.005))
    parts.append(box("cp_scan", (0.6, 0.48, 0.12), (0, 0.06, 0.92), p["white"], 0.01))
    parts.append(box("cp_lid", (0.58, 0.46, 0.03), (0, 0.06, 0.995), p["grey"], 0.006))
    parts.append(box("cp_out", (0.4, 0.3, 0.012), (0.05, 0.02, 0.83), p["grey"], 0.004))
    pan = box("cp_panel", (0.26, 0.02, 0.15), (-0.12, -0.3, 1.0), p["black"], 0.006); pan.rotation_euler.x = math.radians(-55); bpy.ops.object.transform_apply(rotation=True)
    psc = box("cp_pscr", (0.22, 0.001, 0.11), (-0.12, -0.312, 1.002), p["screen"]); psc.rotation_euler.x = math.radians(-55); bpy.ops.object.transform_apply(rotation=True)
    for sx in (-1, 1):
        for sy in (-1, 1): parts.append(cyl(f"cp_wheel{sx}{sy}", 0.025, 0.02, (sx * 0.26, sy * 0.26, 0.025), (0, math.pi / 2, 0), p["rubber"], 12))
    export("tech_copier", [join(parts + [pan, psc], "Copier")])
    # desktop printer
    a = box("pr_body", (0.44, 0.38, 0.22), (0, 0, 0.11), p["white"], 0.012, 3)
    b = box("pr_slot", (0.3, 0.02, 0.012), (0, -0.19, 0.08), p["black"])
    c = box("pr_tray", (0.28, 0.15, 0.008), (0, -0.25, 0.05), p["grey"], 0.003)
    d = box("pr_pan", (0.1, 0.004, 0.05), (0.14, -0.191, 0.17), p["screen"])
    export("tech_printer", [join([a, b, c, d], "Printer")])
    # keyboard with keys
    kb = [box("k_base", (0.44, 0.135, 0.018), (0, 0, 0.009), p["dark"], 0.004)]
    for r in range(5):
        for k in range(15):
            kb.append(box(f"key{r}{k}", (0.024, 0.021, 0.008), (-0.2 + k * 0.0285, -0.05 + r * 0.025, 0.022), p["black"], 0.002))
    export("tech_keyboard", [join(kb, "Keyboard")])
    # headphones on a stand
    st = [cyl("hp_base", 0.06, 0.012, (0, 0, 0.006), m=p["dark"], verts=32), cyl("hp_pole", 0.008, 0.26, (0, 0, 0.14), m=p["chrome"], verts=12)]
    band = tube("hp_band", [(math.cos(a) * 0.085, 0, 0.27 + math.sin(a) * 0.085) for a in [math.pi * i / 16 for i in range(17)]], 0.009, p["black"])
    cups = [sphere(f"hp_cup{s}", 0.045, (s * 0.088, 0, 0.255), (0.45, 1, 1.15), p["black"]) for s in (-1, 1)]
    export("tech_headphones", [join(st + [band] + cups, "Headphones")])
    # display table (tech showroom): white base, oak top
    tb = [box("dt_base", (1.5, 0.7, 0.84), (0, 0, 0.42), p["white"], 0.01), box("dt_top", (1.6, 0.8, 0.05), (0, 0, 0.865), p["oak"], 0.006),
          box("dt_kick", (1.46, 0.66, 0.06), (0, 0, 0.03), p["dark"])]
    export("display_table", [join(tb, "DisplayTable")])

def build_appliances(p):
    parts = [box("fr_body", (0.74, 0.7, 1.8), (0, 0, 0.9), p["steel"], 0.015, 3)]
    parts.append(box("fr_gap", (0.742, 0.702, 0.006), (0, 0, 1.2), p["dark"]))
    parts.append(box("fr_gap2", (0.006, 0.702, 1.19), (0, 0, 0.6), p["dark"]))
    for sx in (-1, 1): parts.append(box(f"fr_h{sx}", (0.02, 0.03, 0.42), (sx * 0.04, -0.37, 0.75), p["chrome"], 0.008))
    parts.append(box("fr_h3", (0.42, 0.03, 0.02), (0, -0.37, 1.16), p["chrome"], 0.008))
    parts.append(box("fr_disp", (0.09, 0.004, 0.13), (-0.2, -0.351, 1.0), p["screen"]))
    parts.append(box("fr_kick", (0.7, 0.66, 0.06), (0, 0.02, 0.03), p["dark"]))
    export("app_fridge", [join(parts, "Fridge")])
    # coffee machine
    c = [box("cm_body", (0.22, 0.3, 0.36), (0, 0.03, 0.18), p["black"], 0.012, 3), box("cm_drip", (0.18, 0.12, 0.03), (0, -0.11, 0.015), p["chrome"], 0.004),
         cyl("cm_pot", 0.065, 0.13, (0, -0.1, 0.1), m=p["glass"], verts=24), box("cm_head", (0.2, 0.16, 0.08), (0, -0.07, 0.32), p["black"], 0.012),
         box("cm_btn", (0.06, 0.004, 0.03), (0, -0.15, 0.32), p["screen"])]
    export("app_coffee", [join(c, "CoffeeMaker")])
    # toaster
    t = [box("ts_body", (0.28, 0.17, 0.19), (0, 0, 0.1), p["steel"], 0.035, 4), box("ts_slot1", (0.2, 0.025, 0.004), (0, -0.03, 0.198), p["black"]),
         box("ts_slot2", (0.2, 0.025, 0.004), (0, 0.03, 0.198), p["black"]), box("ts_lever", (0.02, 0.03, 0.03), (0.15, 0, 0.13), p["black"], 0.006)]
    export("app_toaster", [join(t, "Toaster")])
    # countertop appliance plinth / display counter
    dc = [box("ac_base", (1.8, 0.65, 0.88), (0, 0, 0.44), p["light"], 0.008), box("ac_top", (1.84, 0.68, 0.04), (0, 0, 0.9), mat("Quartz", (0.86, 0.85, 0.82), rough=0.25), 0.004)]
    export("app_counter", [join(dc, "ApplianceCounter")])

def build_furniture(p):
    # modern bookcase (oak, open shelves)
    bc = [box("bk_l", (0.025, 0.32, 1.8), (-0.4375, 0, 0.9), p["oak"], 0.003), box("bk_r", (0.025, 0.32, 1.8), (0.4375, 0, 0.9), p["oak"], 0.003),
          box("bk_back", (0.85, 0.01, 1.8), (0, 0.155, 0.9), p["light"])]
    for k in range(6): bc.append(box(f"bk_s{k}", (0.85, 0.32, 0.025), (0, 0, 0.04 + k * 0.345), p["oak"], 0.003))
    export("furn_bookcase", [join(bc, "Bookcase")])
    # ergonomic office chair
    ch = []
    for k in range(5):
        a = k * 2 * math.pi / 5
        ch.append(tube(f"oc_leg{k}", [(0, 0, 0.1), (math.cos(a) * 0.32, math.sin(a) * 0.32, 0.07)], 0.018, p["dark"]))
        ch.append(sphere(f"oc_cast{k}", 0.03, (math.cos(a) * 0.32, math.sin(a) * 0.32, 0.03), (1, 0.6, 1), p["rubber"], 12))
    ch.append(cyl("oc_lift", 0.025, 0.32, (0, 0, 0.26), m=p["chrome"], verts=16))
    seat = box("oc_seat", (0.5, 0.48, 0.08), (0, 0, 0.47), p["fabric"], 0.03, 4); ch.append(seat)
    ch.append(box("oc_mech", (0.22, 0.22, 0.05), (0, 0, 0.415), p["dark"], 0.01))
    back = box("oc_back", (0.46, 0.05, 0.56), (0, 0.27, 0.84), p["mesh"], 0.025, 4); back.rotation_euler.x = math.radians(-8); ch.append(back)
    ch.append(box("oc_spine", (0.06, 0.03, 0.4), (0, 0.29, 0.6), p["dark"], 0.01))
    for sx in (-1, 1):
        ch.append(tube(f"oc_arm{sx}", [(sx * 0.25, 0.1, 0.48), (sx * 0.27, 0.05, 0.66), (sx * 0.27, -0.12, 0.66)], 0.014, p["dark"]))
        ch.append(box(f"oc_pad{sx}", (0.07, 0.22, 0.025), (sx * 0.27, -0.03, 0.675), p["rubber"], 0.008))
    export("furn_chair", [join(ch, "OfficeChair")])
    # conference table
    tt = [box("tb_top", (1.8, 0.9, 0.04), (0, 0, 0.74), p["oak"], 0.006)]
    for sx in (-1, 1): tt.append(box(f"tb_leg{sx}", (0.06, 0.7, 0.72), (sx * 0.8, 0, 0.36), p["dark"], 0.005))
    tt.append(box("tb_beam", (1.56, 0.05, 0.06), (0, 0, 0.66), p["dark"]))
    export("furn_table", [join(tt, "Table")])

# ======================= 3. STORE FIXTURES =======================
def build_fixtures(p):
    # checkout lane
    ck = [box("ck_body", (2.4, 0.75, 0.88), (0, 0, 0.44), mat("CounterFace", (0.18, 0.18, 0.19), rough=0.6), 0.01),
          box("ck_top", (2.44, 0.79, 0.03), (0, 0, 0.895), mat("Quartz", (0.86, 0.85, 0.82), rough=0.25), 0.004),
          box("ck_belt", (1.5, 0.5, 0.012), (-0.4, -0.02, 0.915), p["rubber"]),
          box("ck_divider", (0.3, 0.04, 0.04), (-0.2, -0.02, 0.94), p["grey"], 0.01),
          box("ck_scanner", (0.36, 0.4, 0.004), (0.6, -0.02, 0.913), mat("ScannerGlass", (0.15, 0.05, 0.05), rough=0.05, emit=(0.6, 0.05, 0.05), emit_strength=0.4)),
          box("ck_bag", (0.6, 0.6, 0.02), (1.45, 0, 0.8), p["steel"], 0.004)]
    pole = cyl("ck_pole", 0.02, 0.4, (0.95, 0.25, 1.11), m=p["chrome"], verts=12)
    pos = box("ck_pos", (0.32, 0.03, 0.22), (0.95, 0.24, 1.38), p["black"], 0.008)
    pscr = box("ck_pscr", (0.29, 0.001, 0.19), (0.95, 0.224, 1.38), p["screen"])
    card = box("ck_card", (0.08, 0.12, 0.05), (0.55, -0.3, 0.94), p["black"], 0.008)
    lp = cyl("ck_lanepole", 0.025, 1.9, (-1.15, 0.3, 1.85), m=p["dark"], verts=12)
    lb = box("ck_lanebox", (0.18, 0.18, 0.22), (-1.15, 0.3, 2.85), p["dark"], 0.01)
    ll = box("ck_lanelight", (0.185, 0.185, 0.08), (-1.15, 0.3, 2.85), mat("LaneLight", (1, 0.75, 0.35), emit=(1, 0.72, 0.3), emit_strength=3))
    export("checkout", [join(ck + [pole, pos, pscr, card, lp, lb, ll], "Checkout")])
    # shopping cart (wire basket)
    wire = p["chrome"]; parts = []
    L, Wd, H0, H1 = 0.85, 0.52, 0.45, 0.95
    xs = [-L / 2 + i * L / 10 for i in range(11)]; ys = [-Wd / 2 + i * Wd / 6 for i in range(7)]
    for x in xs:   # side wires
        parts.append(tube(f"cw_s{x:.2f}", [(x, -Wd / 2, H0), (x, -Wd / 2, H1)], 0.004, wire)); parts.append(tube(f"cw_t{x:.2f}", [(x, Wd / 2, H0), (x, Wd / 2, H1)], 0.004, wire))
        parts.append(tube(f"cw_b{x:.2f}", [(x, -Wd / 2, H0), (x, Wd / 2, H0)], 0.004, wire))
    for y in ys:
        parts.append(tube(f"cw_f{y:.2f}", [(-L / 2, y, H0), (-L / 2, y, H1)], 0.004, wire)); parts.append(tube(f"cw_r{y:.2f}", [(L / 2, y, H0 + 0.05), (L / 2, y, H1)], 0.004, wire))
        parts.append(tube(f"cw_bl{y:.2f}", [(-L / 2, y, H0), (L / 2, y, H0)], 0.004, wire))
    for z in [H0 + (H1 - H0) * k / 4 for k in range(1, 5)]:
        parts.append(tube(f"cw_ring{z:.2f}", [(-L / 2, -Wd / 2, z), (L / 2, -Wd / 2, z), (L / 2, Wd / 2, z), (-L / 2, Wd / 2, z), (-L / 2, -Wd / 2, z)], 0.005, wire))
    parts.append(tube("cw_handle", [(L / 2 + 0.12, -Wd / 2 - 0.02, H1 + 0.08), (L / 2 + 0.12, Wd / 2 + 0.02, H1 + 0.08)], 0.016, mat("HandleBlue", (0.15, 0.3, 0.6), rough=0.4)))
    for s in (-1, 1): parts.append(tube(f"cw_hs{s}", [(L / 2, s * Wd / 2, H1), (L / 2 + 0.12, s * (Wd / 2 + 0.02), H1 + 0.08)], 0.01, wire))
    for s in (-1, 1): parts.append(tube(f"cw_ch{s}", [(-L / 2 + 0.05, s * 0.2, 0.1), (L / 2, s * 0.22, 0.1), (L / 2, s * 0.24, H0)], 0.012, wire))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cyl(f"cw_wh{sx}{sy}", 0.05, 0.03, (sx * (L / 2 - 0.05), sy * 0.21, 0.05), (math.pi / 2, 0, 0), p["rubber"], 16))
    parts.append(box("cw_tray", (0.7, 0.4, 0.01), (0, 0, 0.14), p["grey"]))
    export("cart", [join(parts, "Cart")])
    # department sign (hanging)
    s = [box("ds_frame", (3.2, 0.1, 0.62), (0, 0, 0.31), p["dark"], 0.01), box("ds_face", (3.05, 0.104, 0.48), (0, 0, 0.31), mat("SignFace", (0.95, 0.93, 0.88), rough=0.4, emit=(1, 0.95, 0.85), emit_strength=0.5))]
    for sx in (-1, 1): s.append(cyl(f"ds_wire{sx}", 0.003, 1.6, (sx * 1.4, 0, 1.42), m=p["chrome"], verts=6))
    export("dept_sign", [join(s, "DeptSign")])
    # architectural figure, standing and mid-stride
    for name, stride in (("figure_stand", 0.0), ("figure_walk", 1.0)):
        f = p["figure"]; body = []
        body.append(sphere("head", 0.105, (0, 0, 1.62), (0.9, 1, 1.12), f))
        body.append(cyl("neck", 0.045, 0.1, (0, 0, 1.49), m=f, verts=12))
        body.append(sphere("torso", 0.2, (0, 0, 1.22), (0.95, 0.62, 1.55), f))
        body.append(sphere("pelvis", 0.17, (0, 0, 0.95), (1.0, 0.7, 0.75), f))
        for s in (-1, 1):
            sw = stride * s * 0.18
            body.append(tube(f"arm{s}", [(s * 0.21, 0, 1.4), (s * 0.24, -sw * 0.6, 1.12), (s * 0.25, -sw, 0.86)], 0.042, f))
            body.append(tube(f"leg{s}", [(s * 0.09, 0, 0.92), (s * 0.1, sw * 0.8, 0.5), (s * 0.1, sw * 1.1, 0.08)], 0.065, f))
            body.append(sphere(f"foot{s}", 0.06, (s * 0.1, sw * 1.1 - 0.05, 0.04), (0.8, 1.6, 0.5), f))
        o = join(body, name); smooth(o, 60); export(name, [o])

# ======================= 4. ARCHITECTURE =======================
X0, X1, Z0, Z1, HT = -30.0, 30.0, -24.0, 18.0, 7.5     # three.js frame (x, z) → Blender (x, -y)
def bx(x0, x1, z0, z1, y0, y1, name, m, bevel=0):
    return box(name, (x1 - x0, z1 - z0, y1 - y0), ((x0 + x1) / 2, -(z0 + z1) / 2, (y0 + y1) / 2), m, bevel)

def build_building(p):
    floor = mat("FloorConcrete", (0.72, 0.71, 0.69), rough=0.35)
    wall = mat("WallPlaster", (0.86, 0.85, 0.83), rough=0.9)
    ceil = mat("CeilingDark", (0.11, 0.115, 0.12), rough=0.9)
    mull = mat("Mullion", (0.09, 0.095, 0.1), metal=0.7, rough=0.35)
    fas = mat("Fascia", (0.12, 0.125, 0.13), metal=0.3, rough=0.5)
    plaza = mat("PlazaPaving", (0.6, 0.6, 0.58), rough=0.8)
    shell = []
    shell.append(bx(X0, X1, Z0, Z1, -0.3, 0.0, "Floor", floor))
    shell.append(bx(X0 - 0.4, X0, Z0, Z1, 0, HT, "WallW", wall)); shell.append(bx(X1, X1 + 0.4, Z0, Z1, 0, HT, "WallE", wall))
    shell.append(bx(X0 - 0.4, X1 + 0.4, Z0 - 0.4, Z0, 0, HT, "WallN", wall))
    shell.append(bx(X0 - 0.4, X1 + 0.4, Z0 - 0.4, Z1 + 0.4, HT, HT + 0.6, "Roof", ceil))
    ext = mat("ExteriorClad", (0.2, 0.205, 0.21), metal=0.2, rough=0.6)
    shell.append(bx(X0 - 0.45, X1 + 0.45, Z0 - 0.45, Z1, HT + 0.6, HT + 1.4, "Parapet", ext))
    for (a, b) in ((X0 - 0.45, X0 - 0.4), (X1 + 0.4, X1 + 0.45)): shell.append(bx(a, b, Z0 - 0.45, Z1 + 0.4, 0, HT + 1.4, "SideClad", ext))
    # wood ceiling baffles running front-to-back
    baf = [bx(x - 0.05, x + 0.05, Z0 + 0.5, Z1 - 0.5, HT - 0.55, HT - 0.05, f"baffle{i}", p["oak"]) for i, x in enumerate([X0 + 1 + k * 0.75 for k in range(int((X1 - X0 - 2) / 0.75) + 1)])]
    shell.append(join(baf, "CeilingBaffles"))
    cols = []
    for x in (-18, -6, 6, 18):
        for z in (-12, 0, 10):
            cols.append(bx(x - 0.28, x + 0.28, z - 0.28, z + 0.28, 0, HT, f"col{x}{z}", wall, 0.01))
    shell.append(join(cols, "Columns"))
    # glass front with mullions; door opening x∈[-2.2, 2.2], y∈[0, 3.2]
    fz = Z1
    glass = [bx(X0, -2.4, fz - 0.02, fz + 0.02, 0, HT, "GlassL", p["glass"]), bx(2.4, X1, fz - 0.02, fz + 0.02, 0, HT, "GlassR", p["glass"]),
             bx(-2.4, 2.4, fz - 0.02, fz + 0.02, 3.4, HT, "GlassTop", p["glass"])]
    shell.append(join(glass, "FacadeGlass"))
    mm = []
    for x in [X0 + k * 2.0 for k in range(int((X1 - X0) / 2) + 1)]:
        if -2.4 < x < 2.4: continue
        mm.append(bx(x - 0.04, x + 0.04, fz - 0.12, fz + 0.06, 0, HT, f"mv{x}", mull))
    for y in (0.08, 3.4, 6.0):
        mm.append(bx(X0, X1, fz - 0.12, fz + 0.06, y - 0.05, y + 0.05, f"mh{y}", mull))
    for x in (-2.45, 2.45): mm.append(bx(x - 0.1, x + 0.1, fz - 0.15, fz + 0.1, 0, 3.45, f"doorjamb{x}", mull))
    mm.append(bx(-2.45, 2.45, fz - 0.15, fz + 0.1, 3.2, 3.45, "doorhead", mull))
    shell.append(join(mm, "Mullions"))
    # entrance canopy with oak soffit, fascia band with letters
    shell.append(bx(-7, 7, fz, fz + 4.2, 4.2, 4.5, "Canopy", fas)); shell.append(bx(-6.9, 6.9, fz + 0.05, fz + 4.15, 4.17, 4.2, "CanopySoffit", p["oak"]))
    shell.append(bx(X0 - 0.45, X1 + 0.45, fz, fz + 0.3, HT, HT + 1.4, "FasciaBand", fas))
    bpy.ops.object.text_add(location=(0, -(fz + 0.32), HT + 0.25)); t = bpy.context.active_object; t.name = "SignText"
    t.data.body = "SUPERSTORE"; t.data.align_x = "CENTER"; t.data.size = 0.95; t.data.extrude = 0.06; t.rotation_euler.x = math.radians(90)
    t.data.space_character = 1.25
    bpy.ops.object.convert(target="MESH"); assign(t, mat("SignLetters", (1, 0.97, 0.9), emit=(1, 0.93, 0.8), emit_strength=6)); shell.append(t)
    # plaza + kerb + planters
    shell.append(bx(-60, 60, Z1, Z1 + 45, -0.32, -0.02, "Plaza", plaza))
    shell.append(bx(-60, 60, Z1 + 45, Z1 + 80, -0.36, -0.06, "Road", mat("Asphalt", (0.1, 0.1, 0.105), rough=0.85)))
    pl = []
    for x in (-24, -14, 14, 24):
        pl.append(bx(x - 2, x + 2, Z1 + 6, Z1 + 7.2, 0, 0.55, f"planter{x}", mat("PlanterConcrete", (0.55, 0.54, 0.52), rough=0.8), 0.03))
    shell.append(join(pl, "Planters"))
    # entrance mat
    shell.append(bx(-2.2, 2.2, fz - 3, fz - 0.05, 0.0, 0.012, "EntryMat", mat("EntryMat", (0.08, 0.08, 0.085), rough=0.95)))
    export("building", shell)
    # sliding doors (separate, animated in the app): each leaf 2.2 x 3.2 with a slim frame
    for name, sx in (("door_left", -1), ("door_right", 1)):
        leaf = [bx(-1.1, 1.1, -0.02, 0.02, 0.0, 3.2, "pane", p["glass"]),
                bx(-1.1, 1.1, -0.04, 0.04, 0.0, 0.08, "rail_b", mull), bx(-1.1, 1.1, -0.04, 0.04, 3.12, 3.2, "rail_t", mull),
                bx(-1.1, -1.04, -0.04, 0.04, 0, 3.2, "stile_a", mull), bx(1.04, 1.1, -0.04, 0.04, 0, 3.2, "stile_b", mull),
                bx(sx * -1.0 - 0.01, sx * -1.0 + 0.01, -0.06, 0.06, 0.9, 1.6, "pull", p["chrome"])]
        export(name, [join(leaf, name)])

reset(); pal = P()
build_gondola(pal); build_endcap_sign(pal)
reset(); MATS.clear(); pal = P(); build_products(pal)
reset(); MATS.clear(); pal = P(); build_tech(pal)
reset(); MATS.clear(); pal = P(); build_appliances(pal)
reset(); MATS.clear(); pal = P(); build_furniture(pal)
reset(); MATS.clear(); pal = P(); build_fixtures(pal)
reset(); MATS.clear(); pal = P(); build_building(pal)
print("ALL DONE", flush=True)
