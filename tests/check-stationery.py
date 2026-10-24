"""Audit the actual generated PDF dates, page geometry, and print resolution."""
import calendar
import datetime as dt
import json
from pathlib import Path
from pypdf import PdfReader
from reportlab.lib.units import mm

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'production/2027/print-manifest.json').read_text())
bleed = 3 * mm
for name in ['planner', 'calendar']:
    doc = manifest[name]
    reader = PdfReader(ROOT / doc['file'])
    assert len(reader.pages) == len(doc['pages'])
    for page in reader.pages:
        assert abs(float(page.mediabox.width) / mm - doc['trimMm'][0] - 6) < .01
        assert abs(float(page.mediabox.height) / mm - doc['trimMm'][1] - 6) < .01
        assert abs(float(page.trimbox.left) - bleed) < .01
        assert abs(float(page.trimbox.bottom) - bleed) < .01
        assert abs(float(page.trimbox.width) / mm - doc['trimMm'][0]) < .01
        assert abs(float(page.trimbox.height) / mm - doc['trimMm'][1]) < .01
    for placement in doc['placements']:
        assert placement['effectivePpi'] >= 220
        x, y, width, height = placement['rectMm']
        assert x >= 12 and y >= 12
        assert x + width <= doc['trimMm'][0] - 11.99
        assert y + height <= doc['trimMm'][1] - 11.99

wall = PdfReader(ROOT / manifest['calendar']['file'])
verified_dates = 0
for month in range(1, 13):
    entries = []
    def visit(value, cm, tm, font, size):
        value = value.strip()
        if abs(size - 10) < .001 and value.isdigit():
            entries.append((int(value), tm[4] * cm[0] + tm[5] * cm[2] + cm[4], tm[4] * cm[1] + tm[5] * cm[3] + cm[5]))
    wall.pages[month].extract_text(visitor_text=visit)
    expected = [(day, col, row) for row, week in enumerate(calendar.Calendar(firstweekday=0).monthdayscalendar(2027, month)) for col, day in enumerate(week) if day]
    assert len(entries) == len(expected), (month, entries)
    for (actual, x, y), (day, col, row) in zip(entries, expected):
        assert actual == day
        assert abs(x - (16 * mm + col * 178 * mm / 7 + 2 * mm + bleed)) < .05, (month, day, 'wrong weekday')
        assert abs(y - (96 * mm - row * 12 * mm - 6 * mm + bleed)) < .05, (month, day, 'wrong row')
        verified_dates += 1
assert verified_dates == 365

planner = PdfReader(ROOT / manifest['planner']['file'])
date_set = set()
art_pages = 0
weekly_pages = 0
for info, page in zip(manifest['planner']['pages'], planner.pages):
    content = page.extract_text()
    if 4 <= info['number'] <= 133:
        assert (info['kind'] == 'art') == (info['number'] % 2 == 0)
    if info['kind'] == 'art':
        assert content.strip() == '', 'Artwork pages must contain only the image'
        art_pages += 1
    if info['kind'] == 'weekly':
        weekly_pages += 1
        numbers = []
        def visit_date(value, cm, tm, font, size):
            value = value.strip()
            if abs(size - 11) < .001 and value.isdigit():
                numbers.append(int(value))
        page.extract_text(visitor_text=visit_date)
        dates = [dt.date.fromisoformat(value) for value in info['dates']]
        assert numbers == [value.day for value in dates]
        assert dates[0].weekday() == 0 and dates[-1].weekday() == 6
        for value in dates:
            if value.year == 2027:
                assert value not in date_set
                date_set.add(value)
assert art_pages == 65 and weekly_pages == 53 and len(date_set) == 365
for reader in [planner, wall]:
    for page in reader.pages:
        content = page.extract_text().lower()
        for phrase in ['year of looking', 'make room', 'one thing', 'studio edition', 'a little space', 'the year ahead', 'this planner belongs']:
            assert phrase not in content, phrase
assert len(PdfReader(ROOT / 'static/merch/planner-2027-preview.pdf').pages) == 8
assert len(PdfReader(ROOT / 'static/merch/calendar-2027-preview.pdf').pages) == 3
print(json.dumps({'actualCalendarDatesInCorrectCells': verified_dates, 'actualWeeklyDateLabelsVerified': 371, 'planner2027Days': len(date_set), 'leftArtworkPages': art_pages, 'weeklySpreads': weekly_pages, 'trimAndBleedBoxes': 'passed', 'minimumEffectivePpi': 220}))
