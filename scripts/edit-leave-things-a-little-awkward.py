"""Rebuild the gallery photo from the archived Instagram JPEG with Pillow and NumPy."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SLUG = "leave-things-a-little-awkward"
SOURCE = ROOT / "production/artwork-sources" / f"{SLUG}-instagram.jpg"
OUTPUT = ROOT / "paintings/imported"

source = ImageOps.exif_transpose(Image.open(SOURCE)).convert("RGBA")
if source.size != (1440, 1920):
    raise ValueError("Recheck panel coordinates for the new source dimensions")

# Trace just inside the photographed perimeter to exclude the dark table.
edge = [(78, 157), (84, 150), (200, 153), (350, 156), (500, 153),
        (700, 158), (900, 153), (1100, 157), (1250, 157), (1320, 150),
        (1350, 149), (1368, 154), (1373, 162), (1373, 300), (1371, 500),
        (1369, 650), (1367, 900), (1366, 1150), (1366, 1400),
        (1367, 1600), (1368, 1758), (1365, 1773), (1350, 1774),
        (1100, 1772), (900, 1771), (700, 1771), (500, 1772),
        (350, 1774), (200, 1776), (89, 1777), (79, 1773),
        (80, 1690), (83, 1550), (85, 1350), (86, 1140), (86, 850),
        (85, 600), (82, 390), (79, 235), (77, 175)]
mask = Image.new("L", source.size, 0)
ImageDraw.Draw(mask).polygon(edge, fill=255)
source.putalpha(mask.filter(ImageFilter.GaussianBlur(0.45)))

# Straighten to the panel's 11:14 ratio, without any color or exposure changes.
width, height = 1210, 1540
corners = [(75, 148), (1377, 150), (1371, 1777), (77, 1780)]
destination = [(0, 0), (width - 1, 0), (width - 1, height - 1), (0, height - 1)]
matrix, values = [], []
for (x, y), (u, v) in zip(destination, corners):
    matrix.extend([[x, y, 1, 0, 0, 0, -u*x, -u*y],
                   [0, 0, 0, x, y, 1, -v*x, -v*y]])
    values.extend([u, v])
panel = source.transform((width, height), Image.Transform.PERSPECTIVE,
                         np.linalg.solve(matrix, values), Image.Resampling.BICUBIC)

margin = 54
wall = Image.new("RGB", (width + 2*margin, height + 2*margin), "white")
wall.paste(panel, (margin, margin), panel.getchannel("A"))
wall.save(OUTPUT / f"{SLUG}-white.jpg", quality=95, subsampling=0)
wall.thumbnail((600, 800), Image.Resampling.LANCZOS)
wall.save(OUTPUT / "thumbs" / f"{SLUG}-white.webp", quality=90, method=6)
