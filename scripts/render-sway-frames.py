"""Render synced sway-loop frames for all four moods. Never saves the .blend.

Sim is stepped once (frames 1-192, first 24 are settle pre-roll); at each
captured frame all four mood skies are rendered, so grass geometry is
pixel-identical across moods at every timestamp. Resumable: existing output
frames are skipped (the sim still steps every frame to stay deterministic).

Frames 25-168 are the 6s/24fps loop body; 169-192 are the tail that gets
cross-blended over the head for a seamless loop.
"""
import bpy, math, os, sys, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUTDIR = argv[0]

scene = bpy.context.scene
prefs = bpy.context.preferences
prefs.use_preferences_save = False
cprefs = prefs.addons["cycles"].preferences
cprefs.compute_device_type = "OPTIX"
cprefs.refresh_devices()
for d in cprefs.devices:
    d.use = d.type == "OPTIX"
scene.cycles.device = "GPU"
scene.cycles.use_denoising = True
scene.cycles.samples = 256
scene.cycles.adaptive_threshold = 0.05
scene.render.use_persistent_data = True  # keep Cycles data across the 4 renders per frame
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"

sky = next(n for n in scene.world.node_tree.nodes if n.type == "TEX_SKY")
bg = next(n for n in scene.world.node_tree.nodes if n.type == "BACKGROUND")

BASE_SIZE = sky.sun_size          # user's stylized big sun (~14 deg)
BASE_INTENSITY = sky.sun_intensity  # 12.8

MOODS = {
    "sunrise": {"sun_disc": True, "sun_size": BASE_SIZE, "sun_elevation": 0.013963,
                "sun_rotation": 0.191986, "sun_intensity": BASE_INTENSITY,
                "dust_density": 1.0, "bg_strength": 1.0},
    "high-noon": {"sun_disc": True, "sun_size": BASE_SIZE, "sun_elevation": math.radians(60),
                  "sun_rotation": 0.191986, "sun_intensity": 0.05,
                  "dust_density": 1.0, "bg_strength": 0.3},
    "golden-hour": {"sun_disc": True, "sun_size": math.radians(3.0), "sun_elevation": math.radians(2.0),
                    "sun_rotation": 0.78, "sun_intensity": 6.0,
                    "dust_density": 5.0, "bg_strength": 0.7},
    "midnight": {"sun_disc": False, "sun_size": BASE_SIZE, "sun_elevation": math.radians(-4.0),
                 "sun_rotation": 3.63, "sun_intensity": BASE_INTENSITY,
                 "dust_density": 1.0, "bg_strength": 1.4},
}

for mood in MOODS:
    os.makedirs(os.path.join(OUTDIR, mood), exist_ok=True)

def apply_mood(cfg):
    sky.sun_disc = cfg["sun_disc"]
    sky.sun_size = cfg["sun_size"]
    sky.sun_elevation = cfg["sun_elevation"]
    sky.sun_rotation = cfg["sun_rotation"]
    sky.sun_intensity = cfg["sun_intensity"]
    sky.dust_density = cfg["dust_density"]
    bg.inputs["Strength"].default_value = cfg["bg_strength"]

# --- hair dynamics on the grass emitters ---
for ob in scene.objects:
    for psys in ob.particle_systems:
        psys.use_hair_dynamics = True
        cs = psys.cloth.settings
        cs.pin_stiffness = 1.0
        cs.mass = 0.05
        cs.bending_stiffness = 0.6
        cs.quality = 4

# --- gusting wind + turbulence across the frame ---
bpy.ops.object.effector_add(type="WIND", location=(0, 0, 1))
wind = bpy.context.object
wind.name = "SwayWind"
wind.rotation_euler = (math.radians(90), 0, math.atan2(-0.479, 0.878))
wind.field.noise = 3.0
wind.field.flow = 0.2
for frame, strength in [(1, 0.6), (30, 2.2), (60, 0.6), (90, 2.2), (120, 0.6),
                        (150, 2.2), (180, 0.6), (210, 2.2)]:
    wind.field.strength = strength
    wind.field.keyframe_insert("strength", frame=frame)

bpy.ops.object.effector_add(type="TURBULENCE", location=(0, 0, 1))
turb = bpy.context.object
turb.name = "SwayTurb"
turb.field.strength = 6.0
turb.field.size = 2.5
turb.field.flow = 0.5

FIRST, LAST = 25, 192
scene.frame_start = 1
scene.frame_end = LAST

t_start = time.time()
for f in range(1, LAST + 1):
    scene.frame_set(f)
    if f < FIRST:
        continue
    for mood, cfg in MOODS.items():
        path = os.path.join(OUTDIR, mood, f"f{f:04d}.png")
        if os.path.exists(path):
            continue
        apply_mood(cfg)
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
    done = f - FIRST + 1
    total = LAST - FIRST + 1
    elapsed = time.time() - t_start
    print(f"FRAME {f} done ({done}/{total}, {elapsed/60:.1f} min elapsed)", flush=True)

print("ALL_DONE")
