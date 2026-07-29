"""Render the emilybday scene per time-of-day mood. Never saves the .blend.

Usage: blender --background emilybday.blend --python render_moods.py -- <mode> <outdir> [moods]
  mode:  culltest | preview | final
  moods: comma-separated subset (default: all four)
"""
import bpy
import json
import math
import os
import sys
import time

from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE = argv[0] if len(argv) > 0 else "preview"
OUTDIR = argv[1] if len(argv) > 1 else os.path.join(os.path.expanduser("~"), "Desktop", "mood_renders")
MOOD_FILTER = argv[2].split(",") if len(argv) > 2 else None

os.makedirs(OUTDIR, exist_ok=True)

scene = bpy.context.scene

# ---------------- GPU setup (session-only; preferences are not saved) ----------------
prefs = bpy.context.preferences
prefs.use_preferences_save = False
cprefs = prefs.addons["cycles"].preferences
cprefs.compute_device_type = "OPTIX"
cprefs.refresh_devices()
for d in cprefs.devices:
    d.use = d.type == "OPTIX"
scene.cycles.device = "GPU"
scene.cycles.use_denoising = True

if MODE == "final":
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.cycles.samples = 4096
else:
    scene.render.resolution_x = 640
    scene.render.resolution_y = 360
    scene.cycles.samples = 128
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"

sky = next(n for n in scene.world.node_tree.nodes if n.type == "TEX_SKY")
bg = next(n for n in scene.world.node_tree.nodes if n.type == "BACKGROUND")

# ---------------- Mood sky configs (radians) ----------------
# Baseline from the file (user's sunrise draft): elevation 0.01396, rotation 0.19199,
# sun_disc on, sun_size ~14deg, sun_intensity 12.8 - size/intensity left untouched
# unless a mood overrides them.
MOODS = {
    "sunrise": {"sun_disc": True, "sun_elevation": 0.013963, "sun_rotation": 0.191986},
    "high-noon": {"sun_disc": True, "sun_elevation": math.radians(60), "sun_rotation": 0.191986,
                  "sun_intensity": 0.05, "bg_strength": 0.3},
    # small sun disc: the stylized ~14deg disc averages too white for golden light
    "golden-hour": {"sun_disc": True, "sun_size": math.radians(3.0), "sun_elevation": math.radians(2.0),
                    "sun_rotation": 0.78, "sun_intensity": 6.0, "dust_density": 5.0, "bg_strength": 0.7},
    # glow rotated behind camera: dark blue ambient without a sunset band
    "midnight": {"sun_disc": False, "sun_elevation": math.radians(-4.0), "sun_rotation": 3.63,
                 "bg_strength": 1.4},
}

TUNABLE = ["sun_disc", "sun_elevation", "sun_rotation", "sun_intensity", "dust_density", "sun_size"]
BASELINE = {k: getattr(sky, k) for k in TUNABLE}
BASELINE_BG = bg.inputs["Strength"].default_value

def apply_mood(cfg):
    for k in TUNABLE:
        setattr(sky, k, cfg.get(k, BASELINE[k]))
    bg.inputs["Strength"].default_value = cfg.get("bg_strength", BASELINE_BG)

# ---------------- Frustum culling (in-memory only) ----------------
def particle_instance_names():
    names = set()
    for ps in bpy.data.particles:
        if getattr(ps, "instance_object", None):
            names.add(ps.instance_object.name)
        if getattr(ps, "instance_collection", None):
            for o in ps.instance_collection.objects:
                names.add(o.name)
    return names

def cull_out_of_frame(margin=0.12):
    """Hide objects whose evaluated bounding box (inflated) never projects into
    the camera frame. Lattice-samples the AABB so large objects crossing the
    view are never falsely culled. Returns the list of hidden object names."""
    cam = scene.camera
    deps = bpy.context.evaluated_depsgraph_get()
    protected = particle_instance_names()
    culled = []
    for ob in list(scene.objects):
        if ob.type in {"LIGHT", "CAMERA", "EMPTY"}:
            continue
        if ob.name in protected or ob.hide_render:
            continue
        ob_eval = ob.evaluated_get(deps)
        corners = [ob_eval.matrix_world @ Vector(c) for c in ob_eval.bound_box]
        grow = 1.0 if any(m.type == "PARTICLE_SYSTEM" for m in ob.modifiers) else 0.2
        xs = [c.x for c in corners]
        ys = [c.y for c in corners]
        zs = [c.z for c in corners]
        lo = Vector((min(xs) - grow, min(ys) - grow, min(zs) - grow))
        hi = Vector((max(xs) + grow, max(ys) + grow, max(zs) + grow))
        n = 6
        visible = False
        for i in range(n):
            for j in range(n):
                for k in range(n):
                    p = Vector((
                        lo.x + (hi.x - lo.x) * i / (n - 1),
                        lo.y + (hi.y - lo.y) * j / (n - 1),
                        lo.z + (hi.z - lo.z) * k / (n - 1),
                    ))
                    co = world_to_camera_view(scene, cam, p)
                    if co.z > 0 and -margin <= co.x <= 1 + margin and -margin <= co.y <= 1 + margin:
                        visible = True
                        break
                if visible:
                    break
            if visible:
                break
        if not visible:
            ob.hide_render = True
            culled.append(ob.name)
    return culled

def render_to(path):
    scene.render.filepath = path
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED {path} in {time.time() - t0:.1f}s")

def diff_images(path_a, path_b):
    import numpy as np
    ia = bpy.data.images.load(path_a)
    ib = bpy.data.images.load(path_b)
    a = np.array(ia.pixels[:], dtype=np.float32)
    b = np.array(ib.pixels[:], dtype=np.float32)
    d = np.abs(a - b)
    return {
        "mean": float(d.mean()),
        "p99": float(np.percentile(d, 99)),
        "max": float(d.max()),
        "frac_gt_2pct": float((d > 0.02).mean()),
    }

# ---------------- Modes ----------------
if MODE == "culltest":
    apply_mood(MOODS["sunrise"])
    base = os.path.join(OUTDIR, "culltest_baseline.png")
    render_to(base)
    culled = cull_out_of_frame()
    print("CULLED_OBJECTS " + json.dumps(culled))
    test = os.path.join(OUTDIR, "culltest_culled.png")
    render_to(test)
    print("DIFF_STATS " + json.dumps(diff_images(base, test)))
else:
    if os.environ.get("MOOD_CULL", "1") == "1":
        culled = cull_out_of_frame()
        print("CULLED_OBJECTS " + json.dumps(culled))
    for mood, cfg in MOODS.items():
        if MOOD_FILTER and mood not in MOOD_FILTER:
            continue
        apply_mood(cfg)
        scene.render.image_settings.file_format = "PNG"
        render_to(os.path.join(OUTDIR, f"{mood}.png"))
        if MODE == "final":
            webp_dir = os.path.join(OUTDIR, "webp")
            os.makedirs(webp_dir, exist_ok=True)
            scene.render.image_settings.file_format = "WEBP"
            scene.render.image_settings.quality = 92
            bpy.data.images["Render Result"].save_render(
                os.path.join(webp_dir, f"{mood}.webp"), scene=scene
            )

print("ALL_DONE")
