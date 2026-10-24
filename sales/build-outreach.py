"""Create reviewable local sales material. Does not send mail or modify the site."""
import csv
import datetime as dt
import html
import json
import math
import re
from io import BytesIO
from email.message import EmailMessage
from email.policy import SMTP
from pathlib import Path
from urllib.parse import urlencode

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[1]
SALES = ROOT / 'sales'
preferences = json.loads((SALES / 'preferences.json').read_text()) if (SALES / 'preferences.json').exists() else {}
if preferences.get('outreachAllowed') is False:
    raise SystemExit('Outreach is prohibited by the owner. Do not recreate or send this campaign.')
DRAFTS = SALES / 'drafts'
DRAFTS.mkdir(exist_ok=True)
batch = json.loads((SALES / 'batch-one.json').read_text())
verified = json.loads((SALES / 'verified-offers.json').read_text())
offers = verified['offers']
by_slug = {a['slug']: a for a in offers}
manifest = json.loads((ROOT / 'production/2027/print-manifest.json').read_text())
crops = {a['slug']: a['crop'] for a in manifest['artworks']}
crops['blue-tower-study'] = [.170, .139, .830, .880]
for name, file in [('SalesSans', 'DejaVuSans.ttf'), ('SalesSerif', 'DejaVuSerif.ttf')]:
    pdfmetrics.registerFont(TTFont(name, '/usr/share/fonts/truetype/dejavu/' + file))
ink = HexColor('#262925')
muted = HexColor('#666c64')
rule_color = HexColor('#c9cec5')


def text(c, x, y, value, size=9, font='SalesSans', color=ink, right=False):
    c.setFillColor(color)
    c.setFont(font, size)
    (c.drawRightString if right else c.drawString)(x, y, value)


def draw_art(c, artwork, x, y, w, h):
    file = ROOT / artwork['image'].lstrip('/')
    with Image.open(file) as image:
        iw, ih = image.size
    crop = crops.get(artwork['slug'], [0, 0, 1, 1])
    left, top, right, bottom = [round(value * (iw if i % 2 == 0 else ih)) for i, value in enumerate(crop)]
    cw, ch = right - left, bottom - top
    scale = min(w / cw, h / ch, 72 / 200)
    dw, dh = cw * scale, ch * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    c.saveState()
    clip = c.beginPath()
    clip.rect(dx, dy, dw, dh)
    c.clipPath(clip, stroke=0, fill=0)
    # Embed at up to 220 PPI for this small folio; source artwork stays intact.
    with Image.open(file) as image:
        target = (min(iw, math.ceil(iw * scale * 220 / 72)), min(ih, math.ceil(ih * scale * 220 / 72)))
        if image.format == 'JPEG' and target == image.size:
            reader = ImageReader(str(file))
        else:
            buffer = BytesIO()
            embedded = image.convert('RGB')
            embedded.thumbnail(target, Image.Resampling.LANCZOS)
            embedded.save(buffer, format='JPEG', quality=95, subsampling=0)
            buffer.seek(0)
            reader = ImageReader(buffer)
        c.drawImage(reader, dx - left * scale, dy - (ih - bottom) * scale, iw * scale, ih * scale)
    c.restoreState()


def purchase_url(artwork):
    return artwork['purchaseUrl'] + '?' + urlencode({'client_reference_id': 'oct2026_folio', 'utm_source': 'artist_outreach', 'utm_medium': 'email', 'utm_campaign': 'oct2026_originals'})


folio = SALES / 'available-originals.pdf'
c = canvas.Canvas(str(folio), pagesize=(210 * mm, 297 * mm), pageCompression=1)
c.setTitle('Available Originals — Muzzammil Mehdi')
c.setAuthor('Muzzammil Mehdi')
for page in range(3):
    text(c, 18 * mm, 279 * mm, 'Muzzammil Mehdi', 18, 'SalesSerif')
    text(c, 18 * mm, 270 * mm, 'smm321@gmail.com · muzzammil.us/paintings/', 8, color=muted)
    text(c, 192 * mm, 279 * mm, 'Available originals', 9, color=muted, right=True)
    c.setStrokeColor(rule_color)
    c.line(18 * mm, 265 * mm, 192 * mm, 265 * mm)
    for row in range(2):
        artwork = offers[page * 2 + row]
        y = (174 if row == 0 else 58) * mm
        draw_art(c, artwork, 18 * mm, y, 174 * mm, 86 * mm)
        text(c, 18 * mm, y - 10 * mm, artwork['title'], 13, 'SalesSerif')
        text(c, 192 * mm, y - 10 * mm, f"${artwork['amount'] / 100:,.0f}", 11, right=True)
        details = f"{artwork['year']} · {artwork['medium']} · {artwork['size']}"
        text(c, 18 * mm, y - 17 * mm, details, 8, color=muted)
        actions_y = y - 24 * mm
        for label, url, x in [('View artwork', artwork['galleryUrl'], 18), ('Inquire', 'mailto:smm321@gmail.com?' + urlencode({'subject': artwork['title']}), 58), ('Buy original', purchase_url(artwork), 85)]:
            text(c, x * mm, actions_y, label, 7.5)
            c.linkURL(url, (x * mm, actions_y - 2, x * mm + pdfmetrics.stringWidth(label, 'SalesSans', 7.5), actions_y + 8), relative=0)
    text(c, 18 * mm, 17 * mm, 'Retail prices in USD. Availability checked 20 October 2026.', 6.5, color=muted)
    text(c, 18 * mm, 12 * mm, 'Please confirm delivery and framing details before purchasing.', 6.5, color=muted)
    text(c, 192 * mm, 12 * mm, f'{page + 1}/3', 6.5, color=muted, right=True)
    c.showPage()
c.save()

assert len(PdfReader(folio).pages) == 3
text_content = '\n'.join(p.extract_text() for p in PdfReader(folio).pages)
for artwork in offers:
    assert artwork['title'] in text_content
    assert artwork['size'] in text_content

review = [
    'OUTREACH BATCH ONE — 20 OCTOBER 2026',
    'Sender: Muzzammil Mehdi <smm321@gmail.com>',
    'Status: prepared; nothing sent. Six business contacts, not confirmed buyers.',
    'Gmail currently authenticates Edward Torres. Do not send these through that account.',
    'Retail offers and original purchase links were checked against Stripe on ' + verified['checkedAt'] + '.',
    'All work is local to sales/. No website or Stripe catalog changes were made.',
    '',
    'ATTACHMENT: available-originals.pdf (six originals, $400–$2,700)',
    '',
]
csv_fields = ['id', 'priority', 'company', 'contact_name', 'email', 'route', 'source_urls', 'evidence', 'fit', 'buyer_intent', 'status', 'draft_file', 'offered_works', 'followup_rule', 'sent_at', 'reply_at', 'paid_amount_usd', 'next_action']
with (SALES / 'leads.csv').open('w', newline='') as output:
    writer = csv.DictWriter(output, fieldnames=csv_fields)
    writer.writeheader()
    for message in batch['messages']:
        eml = EmailMessage(policy=SMTP)
        eml['From'] = f"{batch['senderName']} <{batch['senderEmail']}>"
        eml['Reply-To'] = batch['senderEmail']
        eml['To'] = message['to']
        eml['Subject'] = message['subject']
        eml['X-Unsent'] = '1'
        eml.set_content(message['body'])
        def html_paragraph(paragraph):
            escaped = html.escape(paragraph).replace('\n', '<br>')
            return '<p>' + re.sub(r'(https://muzzammil\.us/paintings/)', r'<a href="\1">\1</a>', escaped) + '</p>'
        paragraphs = ''.join(html_paragraph(p) for p in message['body'].split('\n\n'))
        eml.add_alternative('<html><body style="font:15px/1.5 Arial,sans-serif;color:#222">' + paragraphs + '</body></html>', subtype='html')
        for attachment in message['attachments']:
            file = ROOT / attachment
            assert file.exists(), attachment
            if file.suffix.lower() == '.pdf':
                main, sub = 'application', 'pdf'
                filename = 'Muzzammil-Mehdi-Available-Originals.pdf'
            else:
                main, sub = 'image', 'jpeg'
                matching = next(a for a in offers if a['image'].lstrip('/') == attachment)
                filename = matching['title'].replace(' ', '-') + '.jpg'
            eml.add_attachment(file.read_bytes(), maintype=main, subtype=sub, filename=filename)
        filename = message['id'] + '-' + message['company'].lower().replace(' ', '-') + '.eml'
        (DRAFTS / filename).write_bytes(eml.as_bytes())
        review.extend([message['id'] + ' — ' + message['company'], 'To: ' + message['to'], 'Subject: ' + message['subject'], 'Route: ' + message['route'], 'Sources: ' + ', '.join(message['sources']), 'Attachments: ' + ', '.join(message['attachments']), '', message['body'], '', 'Follow-up: ' + message['followup'], '', '-' * 60, ''])
        writer.writerow({'id': message['id'], 'priority': message['priority'], 'company': message['company'], 'contact_name': message.get('contactName', ''), 'email': message['to'], 'route': message['route'], 'source_urls': ' | '.join(message['sources']), 'evidence': message['evidence'], 'fit': message['fit'], 'buyer_intent': 'Unknown; no purchase brief or reply verified', 'status': 'prepared_not_sent', 'draft_file': 'sales/drafts/' + filename, 'offered_works': ' | '.join(by_slug[s]['title'] for s in message['offeredSlugs']), 'followup_rule': message['followup'], 'sent_at': '', 'reply_at': '', 'paid_amount_usd': '0', 'next_action': 'Review exact message; authenticate smm321@gmail.com; obtain explicit send instruction'})
(SALES / 'OUTREACH-REVIEW.txt').write_text('\n'.join(review) + '\n')

pdf = pdfium.PdfDocument(folio)
preview = pdf[0].render(scale=1.5).to_pil()
preview.save(SALES / 'portfolio-preview.jpg', quality=92)
pdf.close()
print(json.dumps({'portfolioPages': 3, 'originals': len(offers), 'messagesPrepared': len(batch['messages']), 'emailsSent': 0, 'portfolioBytes': folio.stat().st_size, 'review': 'sales/OUTREACH-REVIEW.txt', 'leadTracker': 'sales/leads.csv'}))
