"""PBR texture set for the 3D scene from Poly Haven CC0 textures.

Usage: python3 art/process_textures.py <assets-src dir> <out dir>

For each material: albedo (sRGB), OpenGL normal and the Poly Haven "ARM" map
(R = ambient occlusion, G = roughness, B = metalness; three.js reads exactly
these channels from one ORM texture) are resized with Lanczos and written as
WebP. Sizes are chosen per role, so the near ground is sharper than wall trim.
"""
import json
import sys
from pathlib import Path

from PIL import Image

# output name: (poly haven id, source resolution, output size, maps)
MATERIALS = {
    "ground-dry": ("dry_ground_01", "1k", 1024, ("Diffuse", "nor_gl", "arm")),
    "ground-macro": ("aerial_ground_rock", "2k", 1024, ("Diffuse",)),
    "ground-laterite": ("red_laterite_soil_stones", "1k", 512, ("Diffuse", "nor_gl")),
    "ground-gravel": ("gravelly_sand", "1k", 512, ("Diffuse", "nor_gl")),
    "ground-grass": ("sparse_grass", "1k", 512, ("Diffuse",)),
    "asphalt": ("asphalt_02", "1k", 512, ("Diffuse", "nor_gl", "arm")),
    "concrete-floor": ("concrete_floor_worn_001", "1k", 512, ("Diffuse", "nor_gl", "arm")),
    "concrete-wall": ("concrete_wall_008", "1k", 512, ("Diffuse", "nor_gl", "arm")),
    "plaster": ("beige_wall_001", "1k", 512, ("Diffuse", "nor_gl", "arm")),
    "corrugated": ("corrugated_iron_02", "1k", 512, ("Diffuse", "nor_gl", "arm")),
    "painted-metal": ("painted_metal_shutter", "1k", 512, ("Diffuse", "nor_gl", "arm")),
}
SUFFIX = {"Diffuse": "albedo", "nor_gl": "normal", "arm": "orm"}
QUALITY = {"Diffuse": 82, "nor_gl": 88, "arm": 82}


def main(src: Path, out: Path):
    manifest = {}
    for name, (pid, res, size, maps) in MATERIALS.items():
        entry = {"source": f"https://polyhaven.com/a/{pid}", "files": {}}
        for m in maps:
            img = Image.open(src / f"tex-{pid}" / f"{pid}_{m}_{res}.jpg").convert("RGB")
            if img.size != (size, size):
                img = img.resize((size, size), Image.LANCZOS)
            target = out / f"{name}-{SUFFIX[m]}.webp"
            img.save(target, "WEBP", quality=QUALITY[m], method=6)
            entry["files"][SUFFIX[m]] = {"file": target.name, "size": size, "bytes": target.stat().st_size}
        manifest[name] = entry
        print(name, {k: v["bytes"] for k, v in entry["files"].items()})
    (out / "textures.json").write_text(json.dumps(manifest, indent=1) + "\n")
    print("total bytes", sum(f["bytes"] for e in manifest.values() for f in e["files"].values()))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
