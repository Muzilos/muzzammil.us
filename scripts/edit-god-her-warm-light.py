"""Extract the Instagram photograph with Pillow/NumPy; no generative editing.

Run from any directory with Pillow and NumPy installed. The archived source is
untouched; the four photographed corners map to the caption's square panel.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SLUG = "god-her-warm-light"
ARCHIVE = ROOT / "production/artwork-sources"
OUTPUT = ROOT / "paintings/imported"
SOURCE = ARCHIVE / f"{SLUG}-instagram.jpg"
WALL_COLOR = "#ffffff"

source = ImageOps.exif_transpose(Image.open(SOURCE)).convert("RGB")
assert source.size == (1440, 1440), "Recheck corner coordinates for a new source"

# Clockwise: top left, top right, bottom right, bottom left. These surround
# the whole painted face, including its slightly rounded physical corners.
corners = [(50, 60), (1368, 64), (1345, 1369), (72, 1357)]
side = 1280
destination = [(0, 0), (side - 1, 0), (side - 1, side - 1), (0, side - 1)]
matrix, values = [], []
for (x, y), (u, v) in zip(destination, corners):
    matrix.extend([[x, y, 1, 0, 0, 0, -u*x, -u*y],
                   [0, 0, 0, x, y, 1, -v*x, -v*y]])
    values.extend([u, v])
coefficients = np.linalg.solve(matrix, values)

# A traced perimeter removes the easel while retaining the uneven panel edge.
perimeter = [(59, 62), (131, 60), (398, 62), (690, 63), (1042, 65),
             (1346, 65), (1360, 71), (1366, 84), (1366, 260),
             (1361, 444), (1356, 665), (1351, 897), (1348, 1140),
             (1345, 1352), (1340, 1364), (1313, 1368), (1003, 1363),
             (713, 1360), (388, 1358), (88, 1354), (75, 1348),
             (71, 1287), (71, 1131), (66, 976), (63, 788),
             (59, 600), (55, 407), (52, 247), (52, 141), (51, 76)]
mask = Image.new("L", source.size, 0)
ImageDraw.Draw(mask).polygon(perimeter, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(0.45))
panel = source.copy().convert("RGBA")
panel.putalpha(mask)
panel = panel.transform((side, side), Image.Transform.PERSPECTIVE,
                        coefficients, Image.Resampling.BICUBIC)

# A plain painted gallery wall, with only a conventional composited drop shadow.
wall_size, offset = 1600, (160, 160)
wall = Image.new("RGBA", (wall_size, wall_size), WALL_COLOR)
for shift, blur, opacity in [((5, 10), 14, 28), ((2, 3), 3, 30)]:
    alpha = Image.new("L", wall.size, 0)
    alpha.paste(panel.getchannel("A").point(lambda a: a * opacity // 255),
                (offset[0] + shift[0], offset[1] + shift[1]))
    shadow = Image.new("RGBA", wall.size, (0, 0, 0, 0))
    shadow.putalpha(alpha.filter(ImageFilter.GaussianBlur(blur)))
    wall = Image.alpha_composite(wall, shadow)
wall.alpha_composite(panel, offset)
wall = wall.convert("RGB")
wall.save(OUTPUT / f"{SLUG}-gallery.jpg", quality=95, subsampling=0)
wall.resize((600, 600), Image.Resampling.LANCZOS).save(
    OUTPUT / "thumbs" / f"{SLUG}-gallery.webp", quality=90, method=6)

# Retain the extracted artwork separately from the wall presentation.
panel.save(ARCHIVE / f"{SLUG}-extracted.png")
crop = Image.new("RGB", panel.size, WALL_COLOR)
crop.paste(panel, mask=panel.getchannel("A"))
crop.save(OUTPUT / f"{SLUG}.jpg", quality=97, subsampling=0)

metadata = {
    "slug": SLUG,
    "source": "https://www.instagram.com/p/Dfhj_WPh4V0/",
    "caption": "God her warm light every day we stray further\n12x12 mixed on wood",
    "original": SOURCE.name,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "sourceSize": list(source.size),
    "method": "Perspective correction, traced edge mask, and white wall compositing using Pillow and NumPy, preserving the photographed panel's color and exposure.",
    "wallColor": WALL_COLOR,
    "cornersClockwise": corners,
    "extracted": f"{SLUG}-extracted.png",
    "image": f"/paintings/imported/{SLUG}-gallery.jpg",
    "thumbnail": f"/paintings/imported/thumbs/{SLUG}-gallery.webp",
    "script": "scripts/edit-god-her-warm-light.py"
}
(ARCHIVE / f"{SLUG}.json").write_text(json.dumps(metadata, indent=2) + "\n")
print(f"Prepared {SLUG}: square extraction, gallery wall, thumbnail, provenance.")
