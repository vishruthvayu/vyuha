"""Billboard impostors for vegetation from Poly Haven CC0 scans.

Run headless:  blender -b --factory-startup -P art/blender_impostors.py -- <assets-src> <out-dir>

Each plant is rendered orthographically with Cycles on a transparent film from
two side directions (90 degrees apart, used as crossed quads) and from above
(the canopy card seen from overview cameras). Lighting is a soft sky dome plus
a weak high sun, so the cards carry occlusion but little directional shading;
the scene lights them again. impostors.json records the metric size of each card.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

PLANTS = {
    # name: (poly haven id, side resolution px)
    "tree-jacaranda": ("jacaranda_tree", 512),
    "tree-island": ("island_tree_02", 512),
    "tree-dead": ("dead_tree_trunk_02", 256),
    "shrub-rooibos": ("wild_rooibos_bush", 256),
    "shrub-broad": ("shrub_04", 256),
}


def setup_render(res):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = False
    scene.cycles.device = "CPU"
    scene.render.film_transparent = True
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.78, 0.82, 0.88, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.85
    scene.world = world
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 1.6
    sun.rotation_euler = (math.radians(35), 0, math.radians(30))
    scene.collection.objects.link(sun)


def bounds():
    pts = []
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def render(path, location, rotation, scale):
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = scale
    cam = bpy.data.objects.new("cam", cam_data)
    cam.location = location
    cam.rotation_euler = rotation
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)


def main(src: Path, out: Path):
    report = {}
    for name, (pid, res) in PLANTS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(next((src / f"model-{pid}").glob("*.gltf"))))
        lo, hi = bounds()
        size = hi - lo
        centre = (lo + hi) / 2
        side = max(max(size.x, size.y) * 1.04, size.z * 1.02)
        setup_render(res)
        # Square side cards, bottom edge on the ground: camera centred side/2 above the base.
        render(out / f"{name}-side-a.png", (centre.x, lo.y - 50, lo.z + side / 2), (math.radians(90), 0, 0), side)
        render(out / f"{name}-side-b.png", (hi.x + 50, centre.y, lo.z + side / 2), (math.radians(90), 0, math.radians(90)), side)
        top = max(size.x, size.y) * 1.04
        render(out / f"{name}-top.png", (centre.x, centre.y, hi.z + 50), (0, 0, 0), top)
        report[name] = {
            "source": f"https://polyhaven.com/a/{pid}",
            "card_m": round(side, 3),
            "top_card_m": round(top, 3),
            "height_m": round(size.z, 3),
            "resolution": res,
        }
        print("IMPOSTOR", name, report[name])
    (out / "impostors.json").write_text(json.dumps(report, indent=1) + "\n")


argv = sys.argv[sys.argv.index("--") + 1:]
main(Path(argv[0]), Path(argv[1]))
