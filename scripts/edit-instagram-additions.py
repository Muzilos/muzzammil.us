"""Prepare faithful catalog assets using Pillow/NumPy; no generated imagery.

The first two posts are already tightly cropped. Preserve their full image and
aspect ratio, except Wrong way, confirmed as a 12 × 12 inch square. The third shows a square
panel on an easel; isolate its photographed perimeter and correct perspective.
"""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'production/artwork-sources'
OUTPUT = ROOT / 'paintings/imported'
POSTS = [
    ('wrong-way', 'DDV5tquuJB4', 'Wrong way'),
    ('untitled-ddn3pdiJo7j'.lower(), 'DDn3pdIJo7J', None),
    ('old-lady-liberty', 'DaV9NUsBdXF', 'Old Lady Liberty'),
]
records = []
for slug, shortcode, title in POSTS:
    source_path = ARCHIVE / f'{slug}-instagram.jpg'
    source = Image.open(source_path).convert('RGBA')
    corners = None
    if slug == 'old-lady-liberty':
        assert source.size == (1440, 1920)
        # Coordinates traced on the 1440-pixel source, clockwise.
        corners = [(20, 188), (1390, 192), (1366, 1533), (48, 1538)]
        edge = [(20,188),(185,185),(207,179),(230,188),(780,190),
                (1195,190),(1258,179),(1290,181),(1305,191),(1390,192),
                (1385,650),(1377,1070),(1366,1533),(48,1538),
                (43,1400),(33,950),(17,550)]
        mask = Image.new('L', source.size)
        ImageDraw.Draw(mask).polygon(edge, fill=255)
        source.putalpha(mask.filter(ImageFilter.GaussianBlur(.45)))
        side = 1280
        destination = [(0,0),(side-1,0),(side-1,side-1),(0,side-1)]
        matrix, values = [], []
        for (x,y),(u,v) in zip(destination,corners):
            matrix.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]])
            values.extend([u,v])
        panel = source.transform((side,side),Image.Transform.PERSPECTIVE,
                                 np.linalg.solve(matrix,values),Image.Resampling.BICUBIC)
    else:
        panel = source.resize((1440,1440),Image.Resampling.BICUBIC) if slug == 'wrong-way' else source.copy()
    panel.save(ARCHIVE / f'{slug}-extracted.png')
    crop = Image.new('RGB',panel.size,'white')
    crop.paste(panel,mask=panel.getchannel('A'))
    crop.save(OUTPUT / f'{slug}.jpg',quality=97,subsampling=0)
    # Match Candle's plain white wall, restrained shadow and asymmetric margins.
    w,h = panel.size
    margin_x,margin_y = round(w*.18),round(h*.045)
    wall = Image.new('RGBA',(w+2*margin_x,h+2*margin_y),'white')
    shadow = Image.new('L',wall.size)
    shadow.paste(panel.getchannel('A').point(lambda a:a*30//255),(margin_x+3,margin_y+5))
    layer = Image.new('RGBA',wall.size,(0,0,0,0))
    layer.putalpha(shadow.filter(ImageFilter.GaussianBlur(7)))
    wall = Image.alpha_composite(wall,layer)
    wall.alpha_composite(panel,(margin_x,margin_y))
    wall = wall.convert('RGB')
    wall.save(OUTPUT / f'{slug}-gallery.jpg',quality=95,subsampling=0)
    wall.thumbnail((600,800),Image.Resampling.LANCZOS)
    wall.save(OUTPUT / 'thumbs' / f'{slug}-gallery.webp',quality=90,method=6)
    metadata_path = ARCHIVE / f'{slug}.json'
    record = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
    record.update(dict(slug=slug,title=title,source=f'https://www.instagram.com/p/{shortcode}/',
                  original=source_path.name,sourceSha256=hashlib.sha256(source_path.read_bytes()).hexdigest(),
                  sourceSize=list(source.size),cornersClockwise=corners,
                  method='Pillow and NumPy only: preserve photo colors; white wall composite; perspective correction and perimeter mask for Old Lady Liberty.',
                  image=f'/paintings/imported/{slug}-gallery.jpg',
                  thumbnail=f'/paintings/imported/thumbs/{slug}-gallery.webp',
                  file=f'imported/{slug}.jpg',price=record.get('price',47500),
                  script='scripts/edit-instagram-additions.py'))
    record['title'] = title or 'Untitled'
    record['medium'] = 'Oil and joint compound on wood' if slug == 'old-lady-liberty' else 'Mixed media'
    if slug == 'wrong-way': record['size'] = '12 × 12 in'
    record.pop('pending', None)
    (ARCHIVE / f'{slug}.json').write_text(json.dumps(record,indent=2)+'\n')
    records.append(record)
print('Prepared', ', '.join(r['slug'] for r in records))
