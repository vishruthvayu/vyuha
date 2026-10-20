"""Pack Blender-rendered vegetation impostors into one WebP atlas with alpha.

Usage: python3 art/build_vegetation_atlas.py <blender-out dir> <out dir>

Layout (2048 x 1024, 512 px cells):
  row 0: jacaranda side A, jacaranda side B, island tree side A, island tree side B
  row 1: jacaranda top, island tree top, rooibos bush (largest of the scan row), broad shrub
Cells keep the plant's base on the cell's bottom edge. vegetation.json gives each
cell's UV rectangle and real size in metres.
"""
import json
import sys
from pathlib import Path

from PIL import Image

CELL = 512


def crop_largest(img: Image.Image) -> Image.Image:
    """Shrub scans hold a row of plants; keep the right-most (largest) one."""
    alpha = img.getchannel("A")
    w, h = img.size
    cols = [any(alpha.getpixel((x, y)) > 16 for y in range(0, h, 2)) for x in range(w)]
    runs, start = [], None
    for x, on in enumerate(cols + [False]):
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append((start, x))
            start = None
    x0, x1 = max(runs, key=lambda r: r[1] - r[0])
    part = img.crop((max(0, x0 - 2), 0, min(w, x1 + 2), h))
    bbox = part.getbbox()
    return part.crop((0, bbox[1], part.width, bbox[3])), (x1 - x0) / w


def main(src: Path, out: Path):
    meta = json.loads((src / "impostors.json").read_text())
    atlas = Image.new("RGBA", (CELL * 4, CELL * 2), (0, 0, 0, 0))
    cells = {}

    def place(name, img, col, row, width_m, height_m):
        img = img.resize((CELL, CELL), Image.LANCZOS) if img.size == img.size else img
        atlas.paste(img, (col * CELL, row * CELL))
        cells[name] = {"uv": [col / 4, 1 - (row + 1) / 2, (col + 1) / 4, 1 - row / 2], "width_m": round(width_m, 3), "height_m": round(height_m, 3)}

    for col, (plant, view) in enumerate([("tree-jacaranda", "side-a"), ("tree-jacaranda", "side-b"), ("tree-island", "side-a"), ("tree-island", "side-b")]):
        card = meta[plant]["card_m"]
        place(f"{plant}-{view}", Image.open(src / f"{plant}-{view}.png").convert("RGBA"), col, 0, card, card)
    for col, plant in enumerate(["tree-jacaranda", "tree-island"]):
        card = meta[plant]["top_card_m"]
        place(f"{plant}-top", Image.open(src / f"{plant}-top.png").convert("RGBA"), col, 1, card, card)
    for col, plant in [(2, "shrub-rooibos"), (3, "shrub-broad")]:
        img, frac = crop_largest(Image.open(src / f"{plant}-side-a.png").convert("RGBA"))
        width_m = meta[plant]["card_m"] * frac
        height_m = width_m * img.height / img.width
        # square cell, plant bottom-aligned and horizontally centred
        side = max(img.width, img.height)
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.paste(img, ((side - img.width) // 2, side - img.height))
        place(f"{plant}-side", square, col, 1, width_m * side / img.width, width_m * side / img.width)
    # Bleed leaf colour into transparent texels so mipmaps and filtering never
    # average in the (white/black) background: no halos around foliage.
    import numpy as np
    from PIL import ImageFilter

    rgba = np.asarray(atlas).astype(np.float32) / 255
    alpha = rgba[..., 3:4]
    premult = Image.fromarray((np.clip(rgba[..., :3] * alpha, 0, 1) * 255).astype(np.uint8))
    a_img = Image.fromarray((alpha[..., 0] * 255).astype(np.uint8))
    filled = rgba[..., :3].copy()
    for radius in (2, 6, 18, 48):
        p = np.asarray(premult.filter(ImageFilter.BoxBlur(radius))).astype(np.float32) / 255
        a = np.asarray(a_img.filter(ImageFilter.BoxBlur(radius))).astype(np.float32)[..., None] / 255
        colour = p / np.maximum(a, 1e-4)
        hole = (alpha < 0.5) & (a > 1e-3)
        filled = np.where(hole & (alpha < 0.02), colour, filled)
        alpha_known = alpha
    out_rgba = np.concatenate([np.clip(filled, 0, 1), alpha], axis=-1)
    atlas = Image.fromarray((out_rgba * 255 + 0.5).astype(np.uint8), "RGBA")
    target = out / "vegetation-atlas.webp"
    atlas.save(target, "WEBP", quality=82, method=6, exact=True)
    (out / "vegetation.json").write_text(json.dumps({"source": "Poly Haven (CC0) scans rendered in Blender", "atlas": target.name, "bytes": target.stat().st_size, "cells": cells}, indent=1) + "\n")
    print(target, target.stat().st_size, json.dumps(cells)[:400])


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
