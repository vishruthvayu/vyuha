"""Decimate Poly Haven CC0 photoscanned props into light GLB files.

Run headless:  blender -b --factory-startup -P art/blender_props.py -- <assets-src> <out-dir>

Each prop: import the 1K glTF, join meshes, apply transforms, collapse-decimate to
a fixed triangle budget (UVs kept), downscale textures and export a GLB with
WebP images. Output sizes and triangle counts are written to props.json.
"""
import json
import sys
from pathlib import Path

import bpy

PROPS = {
    # out name: (poly haven id, target triangles, texture size)
    "barrel": ("barrel_03", 360, 256),
    "jersey-barrier": ("concrete_road_barrier_02", 420, 256),
    "covered-car": ("covered_car", 1400, 512),
    "boulder-a": ("namaqualand_boulder_02", 420, 256),
    "boulder-b": ("namaqualand_boulder_05", 300, 256),
    "utility-box": ("utility_box_02", 320, 256),
    "crate": ("wooden_crate_02", 160, 256),
}


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def main(src: Path, out: Path):
    report = {}
    for name, (pid, target, tex) in PROPS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        gltf = next((src / f"model-{pid}").glob("*.gltf"))
        bpy.ops.import_scene.gltf(filepath=str(gltf))
        meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
        bpy.ops.object.select_all(action="DESELECT")
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        if len(meshes) > 1:
            bpy.ops.object.join()
        obj = bpy.context.view_layer.objects.active
        # Bake the importer's parent transforms into the mesh so the GLB root is clean.
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        before = triangles(obj)
        if before > target:
            mod = obj.modifiers.new("decimate", "DECIMATE")
            mod.decimate_type = "COLLAPSE"
            mod.ratio = target / before
            mod.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=mod.name)
        after = triangles(obj)
        # Rest the prop on the ground at its footprint centre.
        xs = [v.co.x for v in obj.data.vertices]
        ys = [v.co.y for v in obj.data.vertices]
        zs = [v.co.z for v in obj.data.vertices]
        cx, cy, z0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
        for v in obj.data.vertices:
            v.co.x -= cx
            v.co.y -= cy
            v.co.z -= z0
        for img in bpy.data.images:
            if img.size[0] > tex:
                img.scale(tex, tex)
        for o in list(bpy.context.scene.objects):
            if o != obj:
                bpy.data.objects.remove(o, do_unlink=True)
        target_file = out / f"{name}.glb"
        bpy.ops.export_scene.gltf(
            filepath=str(target_file),
            export_format="GLB",
            export_image_format="WEBP",
            export_image_quality=80,
            export_apply=True,
            export_yup=True,
            export_tangents=False,
            export_animations=False,
            export_cameras=False,
            export_lights=False,
        )
        report[name] = {"source": f"https://polyhaven.com/a/{pid}", "source_triangles": before, "triangles": after, "texture": tex, "bytes": target_file.stat().st_size, "size_m": [round(max(xs) - min(xs), 2), round(max(zs) - min(zs), 2), round(max(ys) - min(ys), 2)]}
        print("PROP", name, report[name])
    (out / "props.json").write_text(json.dumps(report, indent=1) + "\n")


argv = sys.argv[sys.argv.index("--") + 1:]
main(Path(argv[0]), Path(argv[1]))
