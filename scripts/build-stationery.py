"""Typeset the 2027 physical planner/calendar; original artwork files stay intact.

Dependencies: reportlab, pillow, pypdf, pypdfium2. Run from the repository root.
"""
import calendar
import collections
import datetime as dt
import io
import json
import math
from pathlib import Path

from PIL import Image, ImageOps
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'production' / '2027'
PUBLIC = ROOT / 'static' / 'merch'
OUTPUT.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)
YEAR = 2027
BLEED = 3 * mm
MIN_PPI = 220
INK = HexColor('#252c28')
MUTED = HexColor('#737b73')
RULE = HexColor('#cdd2c8')
PAPER = HexColor('#faf8f0')
ACCENT = HexColor('#a27957')
FONT_ROOT = Path('/usr/share/fonts/truetype/dejavu')
for name, file in [('Sans', 'DejaVuSans.ttf'), ('SansBold', 'DejaVuSans-Bold.ttf'), ('Serif', 'DejaVuSerif.ttf'), ('SerifItalic', 'DejaVuSerif-Italic.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_ROOT / file)))

catalog = json.loads((ROOT / 'static/artworks.json').read_text())['artworks']
# Fractional source-image rectangles remove photographed walls/frames, without
# cutting the artwork to a page ratio or resampling the original image.
SELECTION = [
    ('brooklyn-bridge-study', [0.092, 0.085, 0.908, 0.897]),
    ('head-i', [0.038, 0.040, 0.972, 0.972]),
    ('tree', [0, 0, 1, 1]),
    ('covenant', [0.134, 0.095, 0.876, 0.882]),
    ('waterfront-dusk-study', [0, 0, 1, 1]),
    ('city-street', [0.135, 0.108, 0.877, 0.900]),
    ('heaven', [0, 0, 1, 1]),
    ('runnin', [0.110, 0.080, 0.900, 0.922]),
    ('Jacket', [0, 0, 1, 1]),
    ('candle', [0.153, 0.054, 0.865, 0.953]),
    ('untitled-blue-painting', [0.007, 0.008, 0.996, 0.992]),
    ('its-getting-cold', [0, 0, 1, 1]),
]
ART = []
for slug, crop in SELECTION:
    record = next(a for a in catalog if a.get('slug') == slug)
    source = ROOT / record['image'].lstrip('/')
    original = Image.open(source)
    image = ImageOps.exif_transpose(original).convert('RGB')
    if original.format == 'JPEG' and original.getexif().get(274, 1) == 1:
        reader = ImageReader(str(source))
    else:
        encoded = io.BytesIO()
        image.save(encoded, format='JPEG', quality=98, subsampling=0)
        encoded.seek(0)
        reader = ImageReader(encoded)
    ART.append({**record, 'crop': crop, 'pixels': image.size, 'reader': reader})


def text(c, x, y, value, size=9, font='Sans', color=INK, align='left'):
    c.setFillColor(color)
    c.setFont(font, size)
    getattr(c, {'left': 'drawString', 'center': 'drawCentredString', 'right': 'drawRightString'}[align])(x, y, str(value))


def wrap(c, value, x, y, width, size=9, leading=15, font='Sans', color=MUTED):
    line = ''
    for word in value.split():
        proposal = (line + ' ' + word).strip()
        if pdfmetrics.stringWidth(proposal, font, size) > width and line:
            text(c, x, y, line, size, font, color)
            y -= leading
            line = word
        else:
            line = proposal
    if line:
        text(c, x, y, line, size, font, color)
        y -= leading
    return y


def rule(c, x1, y, x2, color=RULE, width=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y, x2, y)


class Document:
    def __init__(self, name, trim, title):
        self.name = name
        self.width, self.height = [n * mm for n in trim]
        self.raw = OUTPUT / (name + '-layout.pdf')
        self.path = OUTPUT / (name + '-print.pdf')
        self.c = canvas.Canvas(str(self.raw), pagesize=(self.width + 2 * BLEED, self.height + 2 * BLEED), pageCompression=1)
        self.c.setTitle(title)
        self.c.setAuthor('Muzzammil Mehdi')
        self.c.setSubject('Artist-designed 2027 stationery · print master with 3 mm bleed')
        self.c.setCreator('Muzzammil Mehdi Studio')
        self.pages = []
        self.placements = []

    def page(self, kind, **metadata):
        if self.pages:
            self.c.restoreState()
            self.c.showPage()
        self.pages.append({'number': len(self.pages) + 1, 'kind': kind, **metadata})
        self.c.saveState()
        self.c.translate(BLEED, BLEED)
        self.c.setFillColor(PAPER if kind in ['cover', 'back-cover', 'art'] else HexColor('#ffffff'))
        self.c.rect(-BLEED, -BLEED, self.width + 2 * BLEED, self.height + 2 * BLEED, fill=1, stroke=0)
        return self.c

    def footer(self, section):
        number = len(self.pages)
        x = 12 * mm if number % 2 == 0 else 18 * mm
        text(self.c, x, 9 * mm, section.upper(), 5.5, color=MUTED)
        text(self.c, self.width - 12 * mm, 9 * mm, f'{number:03}', 5.5, color=MUTED, align='right')

    def art(self, art, x, y, width, height):
        iw, ih = art['pixels']
        left, top, right, bottom = [int(round(n * (iw if index % 2 == 0 else ih))) for index, n in enumerate(art['crop'])]
        cw, ch = right - left, bottom - top
        scale = min(width / cw, height / ch, 72 / MIN_PPI)
        dw, dh = cw * scale, ch * scale
        dx, dy = x + (width - dw) / 2, y + (height - dh) / 2
        self.c.saveState()
        clip = self.c.beginPath()
        clip.rect(dx, dy, dw, dh)
        self.c.clipPath(clip, stroke=0, fill=0)
        self.c.drawImage(art['reader'], dx - left * scale, dy - (ih - bottom) * scale, iw * scale, ih * scale)
        self.c.restoreState()
        self.placements.append({'page': len(self.pages), 'slug': art['slug'], 'title': art['title'], 'crop': [left, top, right, bottom], 'effectivePpi': round(72 / scale, 2), 'rectMm': [round(n / mm, 3) for n in [dx, dy, dw, dh]]})

    def finish(self):
        self.c.restoreState()
        self.c.save()
        reader = PdfReader(self.raw)
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        for page in writer.pages:
            page.trimbox = RectangleObject([BLEED, BLEED, BLEED + self.width, BLEED + self.height])
            page.bleedbox = RectangleObject([0, 0, self.width + 2 * BLEED, self.height + 2 * BLEED])
            page.cropbox = RectangleObject(page.mediabox)
        with self.path.open('wb') as output:
            writer.write(output)
        self.raw.unlink()
        return {'file': str(self.path.relative_to(ROOT)), 'trimMm': [self.width / mm, self.height / mm], 'bleedMm': 3, 'pages': self.pages, 'placements': self.placements}


def mini_month(c, month, x, top, width, height, year=YEAR):
    text(c, x, top, calendar.month_name[month], 7.5, 'SansBold')
    cell = width / 7
    weekdays_y = top - 15
    for index, day in enumerate(['M', 'T', 'W', 'T', 'F', 'S', 'S']):
        text(c, x + (index + .5) * cell, weekdays_y, day, 5.3, color=MUTED, align='center')
    for row, week in enumerate(calendar.Calendar(firstweekday=0).monthdayscalendar(year, month)):
        for col, day in enumerate(week):
            if day:
                text(c, x + (col + .5) * cell, weekdays_y - 12 - row * 11, day, 5.9, color=MUTED if col > 4 else INK, align='center')


def planner_cover(doc):
    c = doc.page('cover')
    text(c, 14 * mm, 178 * mm, '2027', 38, 'Serif')
    doc.art(ART[3], 14 * mm, 32 * mm, 120 * mm, 132 * mm)
    text(c, 14 * mm, 17 * mm, 'Muzzammil Mehdi', 7, color=MUTED)


def art_page(doc, month, context):
    art = ART[month - 1]
    c = doc.page('art', month=month, artwork=art['slug'], context=context)
    doc.art(art, 12 * mm, 17 * mm, 118 * mm, 178 * mm)


def planner_month(doc, month):
    c = doc.page('monthly', month=month)
    x, width = 18 * mm, 118 * mm
    text(c, x, 188 * mm, calendar.month_name[month], 22, 'Serif')
    text(c, x + width, 189 * mm, YEAR, 9, color=MUTED, align='right')
    top = 167 * mm
    cell, row_height = width / 7, 23 * mm
    for col, day in enumerate(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']):
        text(c, x + col * cell + 2 * mm, top + 5 * mm, day, 5.4, color=MUTED)
    weeks = calendar.Calendar(firstweekday=0).monthdayscalendar(YEAR, month)
    for row in range(7):
        rule(c, x, top - row * row_height, x + width)
    for row, week in enumerate(weeks):
        for col, day in enumerate(week):
            if day:
                text(c, x + col * cell + 2 * mm, top - row * row_height - 5 * mm, day, 7, color=MUTED if col > 4 else INK)


def weekly_page(doc, start, index, total):
    days = [start + dt.timedelta(days=i) for i in range(7)]
    c = doc.page('weekly', start=start.isoformat(), dates=[d.isoformat() for d in days])
    x, width = 18 * mm, 118 * mm
    years = str(days[0].year) if days[0].year == days[-1].year else f'{days[0].year}–{days[-1].year}'
    text(c, x + width, 193 * mm, years, 7, color=MUTED, align='right')
    label = f'{days[0].day} {days[0].strftime("%b")} – {days[-1].day} {days[-1].strftime("%b")}'
    text(c, x, 192 * mm, label, 16, 'Serif')
    top, row_height = 181 * mm, 23 * mm
    for row, day in enumerate(days):
        y = top - row * row_height
        rule(c, x, y, x + width)
        text(c, x, y - 6 * mm, day.strftime('%a').upper(), 6.4, 'SansBold', MUTED)
        text(c, x, y - 13 * mm, f'{day.day:02}', 11, 'Serif', MUTED if day.year != YEAR else INK)
        for offset in [8, 14, 20]:
            rule(c, x + 18 * mm, y - offset * mm, x + width, HexColor('#e6e9e2'), 0.35)
    rule(c, x, top - 7 * row_height, x + width)


planner = Document('planner-2027-A5', (148, 210), '2027 Weekly Art Planner — Muzzammil Mehdi')
planner_cover(planner)
planner.page('inside-cover')
c = planner.page('year-overview')
text(c, 18 * mm, 189 * mm, '2027', 20, 'Serif')
for month in range(1, 13):
    col, row = (month - 1) % 3, (month - 1) // 3
    mini_month(c, month, (18 + col * 40) * mm, (169 - row * 36) * mm, 35 * mm, 32 * mm)
for month in range(1, 13):
    art_page(planner, month, 'monthly')
    planner_month(planner, month)
first = dt.date(YEAR, 1, 1)
start = first - dt.timedelta(days=first.weekday())
starts = []
while start <= dt.date(YEAR, 12, 31):
    starts.append(start)
    start += dt.timedelta(days=7)
for index, start in enumerate(starts, 1):
    midpoint = start + dt.timedelta(days=3)
    month = 1 if midpoint.year < YEAR else 12 if midpoint.year > YEAR else midpoint.month
    art_page(planner, month, 'weekly')
    weekly_page(planner, start, index, len(starts))
c = planner.page('back-cover')
text(c, 74 * mm, 17 * mm, 'Muzzammil Mehdi', 7, color=MUTED, align='center')
planner_manifest = planner.finish()

wall = Document('calendar-2027-A4', (210, 297), '2027 Art Calendar — Muzzammil Mehdi')
c = wall.page('cover')
text(c, 16 * mm, 250 * mm, '2027', 52, 'Serif')
wall.art(ART[4], 16 * mm, 49 * mm, 178 * mm, 181 * mm)
text(c, 16 * mm, 22 * mm, 'Muzzammil Mehdi', 8, color=MUTED)
for month in range(1, 13):
    art = ART[month - 1]
    weeks = calendar.Calendar(firstweekday=0).monthdayscalendar(YEAR, month)
    dates = [dt.date(YEAR, month, day).isoformat() for week in weeks for day in week if day]
    c = wall.page('calendar-month', month=month, dates=dates, artwork=art['slug'])
    wall.art(art, 16 * mm, 142 * mm, 178 * mm, 121 * mm)
    text(c, 16 * mm, 115 * mm, calendar.month_name[month], 24, 'Serif')
    text(c, 194 * mm, 116 * mm, YEAR, 14, color=MUTED, align='right')
    x, width, top, row_height = 16 * mm, 178 * mm, 96 * mm, 12 * mm
    cell = width / 7
    for col, day in enumerate(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']):
        text(c, x + col * cell + 2 * mm, 102 * mm, day, 7, color=MUTED)
    for row in range(7):
        rule(c, x, top - row * row_height, x + width)
    for row, week in enumerate(weeks):
        for col, day in enumerate(week):
            if day:
                text(c, x + col * cell + 2 * mm, top - row * row_height - 6 * mm, day, 10, 'Sans', MUTED if col > 4 else INK)
calendar_manifest = wall.finish()


def sample(document, pages, name):
    source = PdfReader(document['file'])
    writer = PdfWriter()
    for page in pages:
        writer.add_page(source.pages[page - 1])
    writer.add_metadata({'/Title': f'2027 {name.title()} — Inside Preview', '/Author': 'Muzzammil Mehdi'})
    output = PUBLIC / f'{name}-2027-preview.pdf'
    with output.open('wb') as target:
        writer.write(target)


def render(document, page_number, filename, scale=2):
    pdf = pdfium.PdfDocument(document['file'])
    page = pdf[page_number - 1]
    image = page.render(scale=scale).to_pil().convert('RGB')
    bleed_px = round(BLEED * scale)
    image = image.crop((bleed_px, bleed_px, image.width - bleed_px, image.height - bleed_px))
    image.save(PUBLIC / filename, quality=92)
    page.close()
    pdf.close()
    return image


sample(planner_manifest, [1, 3, 4, 5, 28, 29, 30, 31], 'planner')
sample(calendar_manifest, [1, 2, 8], 'calendar')
render(planner_manifest, 1, 'planner-2027-cover.jpg')
render(calendar_manifest, 1, 'calendar-2027-cover.jpg')
left = render(planner_manifest, 28, 'planner-2027-art-page.jpg', 1.7)
right = render(planner_manifest, 29, 'planner-2027-week-page.jpg', 1.7)
spread = Image.new('RGB', (left.width + right.width + 10, max(left.height, right.height)), '#e2ddd0')
spread.paste(left, (0, 0))
spread.paste(right, (left.width + 10, 0))
spread.save(PUBLIC / 'planner-2027-spread.jpg', quality=92)
render(calendar_manifest, 2, 'calendar-2027-january.jpg')
render(calendar_manifest, 8, 'calendar-2027-july.jpg')

manifest = {'year': YEAR, 'minimumEffectivePpi': MIN_PPI, 'artworks': [{'slug': a['slug'], 'title': a['title'], 'source': a['image'], 'crop': a['crop'], 'sourcePixels': a['pixels']} for a in ART], 'planner': planner_manifest, 'calendar': calendar_manifest}
(OUTPUT / 'print-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

# Completion checks audit the actual PDF page count/boxes and the date schedule.
expected_dates = {(dt.date(YEAR, 1, 1) + dt.timedelta(days=i)).isoformat() for i in range(365)}
weekly_dates = [d for p in planner_manifest['pages'] if p['kind'] == 'weekly' for d in p['dates'] if d.startswith(str(YEAR))]
monthly_dates = [d for p in calendar_manifest['pages'] if p['kind'] == 'calendar-month' for d in p['dates']]
assert set(weekly_dates) == expected_dates and len(weekly_dates) == 365
assert set(monthly_dates) == expected_dates and len(monthly_dates) == 365
assert len(planner_manifest['pages']) == 134
assert len(calendar_manifest['pages']) == 13
assert len([p for p in planner_manifest['pages'] if p['kind'] == 'weekly']) == 53
for p in planner_manifest['pages'][3:-1]:
    assert (p['kind'] == 'art') == (p['number'] % 2 == 0)
for document in [planner_manifest, calendar_manifest]:
    reader = PdfReader(document['file'])
    assert len(reader.pages) == len(document['pages'])
    for page in reader.pages:
        assert abs(float(page.trimbox.width) / mm - document['trimMm'][0]) < .01
        assert abs(float(page.trimbox.height) / mm - document['trimMm'][1]) < .01
    assert min(p['effectivePpi'] for p in document['placements']) >= MIN_PPI
print(json.dumps({'plannerPages': 134, 'weeklySpreads': 53, 'monthlySpreads': 12, 'calendarPages': 13, 'unique2027DatesInWeeklyPlanner': len(weekly_dates), 'unique2027DatesInCalendar': len(monthly_dates), 'minimumEffectivePpi': min(p['effectivePpi'] for d in [planner_manifest, calendar_manifest] for p in d['placements']), 'files': [planner_manifest['file'], calendar_manifest['file']]}))
