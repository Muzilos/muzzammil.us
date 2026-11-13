"""Match Brooklyn Bridge Study's wall presentation with conventional pixel edits.

Retain the full scan and its aspect ratio. Clone only the photographed white wall
from the reference's top margin; no generated imagery or changes to paint colors.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'paintings/imported'
source_path = ASSETS / 'waterfront-dusk-study-scan.png'
reference_path = ASSETS / 'nyc-study-brooklyn-bridge.jpg'
source = ImageOps.exif_transpose(Image.open(source_path)).convert('RGB')
reference = Image.open(reference_path).convert('RGB')
assert reference.size == (1280, 960)
# The reference's painted face occupies x=115..1164. Use the same width,
# centering the intact scan vertically instead of stretching or clipping it.
width = 1049
height = round(source.height * width / source.width)
panel = source.resize((width, height), Image.Resampling.LANCZOS)
offset = ((reference.width-width)//2, (reference.height-height)//2)
# Mirror adjacent cloned wall strips for seamless conventional texture tiling.
strip = reference.crop((0, 0, reference.width, 64))
wall = Image.new('RGB', reference.size)
for index, y in enumerate(range(0, wall.height, strip.height)):
    wall.paste(strip if index % 2 == 0 else ImageOps.flip(strip), (0,y))
wall = wall.convert('RGBA')
for shift, blur, opacity in [((2,5),5,38),((1,2),1.5,23)]:
    mask = Image.new('L',wall.size,0)
    mask.paste(opacity,(offset[0]+shift[0],offset[1]+shift[1],offset[0]+shift[0]+width,offset[1]+shift[1]+height))
    shadow = Image.new('RGBA',wall.size,(0,0,0,0))
    shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(blur)))
    wall = Image.alpha_composite(wall,shadow)
wall.paste(panel,offset)
wall = wall.convert('RGB')
wall.save(ASSETS / 'waterfront-dusk-study-gallery.jpg',quality=95,subsampling=0)
wall.resize((600,450),Image.Resampling.LANCZOS).save(
    ASSETS / 'thumbs/waterfront-dusk-study-gallery.webp',quality=90,method=6)
metadata = dict(source='/paintings/imported/waterfront-dusk-study-scan.png',
    sourceSha256=hashlib.sha256(source_path.read_bytes()).hexdigest(),
    reference='/paintings/imported/nyc-study-brooklyn-bridge.jpg',
    sourceSize=list(source.size), outputSize=list(wall.size),panelSize=list(panel.size),offset=list(offset),
    method='Pillow only: full scan resized proportionally; reference wall margin cloned and mirrored; composited drop shadow. No generative editing.',
    script='scripts/frame-waterfront-dusk-study.py')
(ROOT / 'production/artwork-sources/waterfront-dusk-study-framing.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(f'Prepared {wall.size} presentation; intact {panel.size} artwork at {offset}.')
