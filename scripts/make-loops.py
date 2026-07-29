"""Turn rendered frame sequences into seamless looping MP4s + webp posters.

Run with: blender --background --factory-startup --python make_loops.py -- <framesdir> <videodir> <posterdir>

Loop construction: body = frames 25..168 (144 @ 24fps = 6s). The first 24
output frames are a cross-blend of tail frames 169..192 (weight 1->0) over
head frames 25..48 (weight 0->1), so frame 144 -> frame 1 is continuous.
"""
import bpy, os, shutil, sys
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
FRAMESDIR, VIDEODIR, POSTERDIR = argv[0], argv[1], argv[2]
os.makedirs(VIDEODIR, exist_ok=True)
os.makedirs(POSTERDIR, exist_ok=True)

MOODS = ["sunrise", "high-noon", "golden-hour", "midnight"]
FIRST, BODY_LAST, TAIL_LAST = 25, 168, 192
N_BODY = BODY_LAST - FIRST + 1   # 144
N_BLEND = TAIL_LAST - BODY_LAST  # 24

W, H = 1920, 1080

def load_px(path):
    img = bpy.data.images.load(path)
    arr = np.empty(W * H * 4, dtype=np.float32)
    img.pixels.foreach_get(arr)
    bpy.data.images.remove(img)
    return arr

def save_px(arr, path):
    img = bpy.data.images.new("blend_out", W, H, alpha=False)
    img.pixels.foreach_set(arr)
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)

scene = bpy.context.scene
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.view_settings.view_transform = "Standard"  # frames are already display-referred

for mood in MOODS:
    src = os.path.join(FRAMESDIR, mood)
    loopdir = os.path.join(FRAMESDIR, f"loop-{mood}")
    os.makedirs(loopdir, exist_ok=True)

    # 1) blended head
    for i in range(N_BLEND):
        out = os.path.join(loopdir, f"l{i + 1:04d}.png")
        if os.path.exists(out):
            continue
        head = load_px(os.path.join(src, f"f{FIRST + i:04d}.png"))
        tail = load_px(os.path.join(src, f"f{BODY_LAST + 1 + i:04d}.png"))
        w_head = i / N_BLEND
        save_px(head * w_head + tail * (1.0 - w_head), out)
    # 2) hardlink the rest of the body
    for i in range(N_BLEND, N_BODY):
        out = os.path.join(loopdir, f"l{i + 1:04d}.png")
        if os.path.exists(out):
            continue
        srcf = os.path.join(src, f"f{FIRST + i:04d}.png")
        try:
            os.link(srcf, out)
        except OSError:
            shutil.copyfile(srcf, out)
    print(f"LOOP FRAMES READY {mood}", flush=True)

    # 3) poster = loop frame 1, as webp
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 92
    scene.render.image_settings.color_mode = "RGB"
    pimg = bpy.data.images.load(os.path.join(loopdir, "l0001.png"))
    pimg.save_render(os.path.join(POSTERDIR, f"{mood}.webp"), scene=scene)
    bpy.data.images.remove(pimg)
    print(f"POSTER READY {mood}", flush=True)

    # 4) encode via the sequencer
    se = scene.sequence_editor_create()
    strips = getattr(se, "strips", None) or se.sequences
    for s in list(strips):
        strips.remove(s)
    strip = strips.new_image(name=mood, filepath=os.path.join(loopdir, "l0001.png"),
                             channel=1, frame_start=1)
    for i in range(2, N_BODY + 1):
        strip.elements.append(f"l{i:04d}.png")
    scene.frame_start = 1
    scene.frame_end = N_BODY
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "HIGH"
    scene.render.ffmpeg.ffmpeg_preset = "GOOD"
    scene.render.ffmpeg.audio_codec = "NONE"
    scene.render.filepath = os.path.join(VIDEODIR, f"{mood}.mp4")
    bpy.ops.render.render(animation=True)
    print(f"ENCODED {mood}", flush=True)

print("ALL_DONE")
