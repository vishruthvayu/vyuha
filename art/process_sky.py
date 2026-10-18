"""Sky backdrops for the 3D scene from Poly Haven CC0 pure-sky HDRIs.

Usage: python3 art/process_sky.py <assets-src dir> <out dir>

Reads the Radiance .hdr files listed in SKIES, tone-maps them to sRGB with a
fixed exposure (filmic curve), keeps only elevations -5..+90 degrees (the scene
draws its own ground) and writes WebP images plus sky.json with the sun
direction measured from the HDR. Every step is deterministic.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SKIES = {
    # name: (source dir/file, output width, exposure, saturation)
    "sky-day": ("hdri-kloofendal_48d_partly_cloudy_puresky/kloofendal_48d_partly_cloudy_puresky_4k.hdr", 4096, 0.62, 1.0),
    "sky-night": ("hdri-qwantani_night_puresky/qwantani_night_puresky_2k.hdr", 2048, 0.028, 0.8),
}
BELOW_HORIZON_DEG = 5


def read_hdr(path: Path) -> np.ndarray:
    """Minimal Radiance RGBE reader (new-style run-length scanlines)."""
    data = path.read_bytes()
    header_end = data.index(b"\n\n") + 2
    size_end = data.index(b"\n", header_end)
    parts = data[header_end:size_end].split()
    assert parts[0] == b"-Y" and parts[2] == b"+X", "unsupported orientation"
    h, w = int(parts[1]), int(parts[3])
    buf = np.frombuffer(data, dtype=np.uint8, offset=size_end + 1)
    out = np.empty((h, w, 4), dtype=np.uint8)
    p = 0
    for y in range(h):
        assert buf[p] == 2 and buf[p + 1] == 2, "only RLE scanlines supported"
        p += 4
        for c in range(4):
            x = 0
            row = out[y, :, c]
            while x < w:
                n = int(buf[p]); p += 1
                if n > 128:
                    n -= 128
                    row[x:x + n] = buf[p]; p += 1
                else:
                    row[x:x + n] = buf[p:p + n]; p += n
                x += n
    rgbe = out.astype(np.float32)
    scale = np.where(out[..., 3] > 0, np.ldexp(1.0, out[..., 3].astype(np.int32) - 136), 0.0)
    return rgbe[..., :3] * scale[..., None]


def filmic(x: np.ndarray) -> np.ndarray:
    # ACES fitted curve (Narkowicz); output linear 0..1
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    return np.clip((x * (a * x + b)) / (x * (c * x + d) + e), 0, 1)


def to_srgb(x: np.ndarray) -> np.ndarray:
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def sun_direction(hdr: np.ndarray):
    lum = hdr @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    h, w = lum.shape
    threshold = np.percentile(lum, 99.995)
    ys, xs = np.nonzero(lum >= threshold)
    weights = lum[ys, xs]
    u = float(np.average(xs + 0.5, weights=weights) / w)
    v = float(np.average(ys + 0.5, weights=weights) / h)
    theta = v * np.pi  # polar angle from +Y
    phi = u * 2 * np.pi
    # three.js SphereGeometry convention: x = -cos(phi) sin(theta), z = sin(phi) sin(theta)
    d = [-np.cos(phi) * np.sin(theta), np.cos(theta), np.sin(phi) * np.sin(theta)]
    return {"u": round(u, 5), "v": round(v, 5), "elevation_deg": round(90 - float(np.degrees(theta)), 2), "direction": [round(float(c), 5) for c in d], "peak_luminance": round(float(lum.max()), 1)}


def main(src: Path, out: Path):
    meta = {"source": "Poly Haven (CC0)", "below_horizon_deg": BELOW_HORIZON_DEG, "skies": {}}
    for name, (rel, width, exposure, saturation) in SKIES.items():
        hdr = read_hdr(src / rel)
        h, w, _ = hdr.shape
        sun = sun_direction(hdr)
        rows = int(round(h * (90 + BELOW_HORIZON_DEG) / 180))
        crop = hdr[:rows] * exposure
        lum = (crop @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
        crop = lum + (crop - lum) * saturation
        ldr = to_srgb(filmic(np.maximum(crop, 0)))
        img = Image.fromarray(np.clip(ldr * 255 + 0.5, 0, 255).astype(np.uint8))
        img = img.resize((width, int(round(rows * width / w))), Image.LANCZOS)
        target = out / f"{name}.webp"
        img.save(target, "WEBP", quality=80, method=6)
        meta["skies"][name] = {"source": rel.split("/")[0][5:], "width": img.width, "height": img.height, "exposure": exposure, "bytes": target.stat().st_size, "sun": sun}
        print(name, img.size, target.stat().st_size, sun)
    (out / "sky.json").write_text(json.dumps(meta, indent=1) + "\n")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
