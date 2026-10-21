import { catalogFor, json, readJson, stripe } from '../../lib/stripe.js';
import { contactErrors } from '../../static/inquiry-contact.js';

async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY || !env.INQUIRY_LIMITS || !env.INQUIRY_EMAIL) return json({ error: 'Please email smm321@gmail.com.' }, 503);
  let payload;
  try { payload = await readJson(request); }
  catch { return json({ error: 'Invalid request.' }, 400); }
  if (payload.website) return json({ received: true });
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const reference = payload.reference;
  const errors = contactErrors(email, phone);
  if (errors.email || errors.phone) return json({ error: errors.email || errors.phone }, 400);
  if (!name || name.length > 100 || !message || message.length > 2000 || !/^[a-f0-9-]{36}$/.test(reference || '')) {
    return json({ error: 'Please enter your name and message.' }, 400);
  }
  let saved = false;
  try {
    let artwork;
    if (payload.artwork) {
      const catalog = await catalogFor(request, env);
      artwork = catalog.artworks.find(a => a.file === payload.artwork && a.listed !== false);
      if (!artwork) return json({ error: 'Artwork not found.' }, 400);
    }
    const fingerprint = await hash(JSON.stringify({ name, email, ...(phone ? { phone } : {}), message, artwork: artwork?.file }));
    const receiptKey = `receipt:${reference}`;
    const receipt = await env.INQUIRY_LIMITS.get(receiptKey);
    // Older deployments stored only the fingerprint for completed submissions.
    if (receipt === fingerprint) return json({ received: true });
    let record;
    if (receipt) {
      try { record = JSON.parse(receipt); } catch { /* A different old receipt. */ }
      if (record?.fingerprint !== fingerprint) return json({ error: 'Please reload and try again.' }, 409);
      if (record.notified) return json({ received: true });
      saved = true;
    } else {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const bucket = Math.floor(Date.now() / 3600000);
      const contact = email ? `email:${email}` : `phone:${phone.replace(/\D/g, '')}`;
      const keys = await Promise.all([ip, contact].map(value => hash(`${env.STRIPE_SECRET_KEY}:${value}`).then(h => `limit:${bucket}:${h}`)));
      const counts = await Promise.all(keys.map(key => env.INQUIRY_LIMITS.get(key).then(n => Number(n || 0))));
      if (counts[0] >= 5 || counts[1] >= 3) return json({ error: 'Please try again later, or email smm321@gmail.com.' }, 429);
      await Promise.all(keys.map((key, i) => env.INQUIRY_LIMITS.put(key, String(counts[i] + 1), { expirationTtl: 7200 })));
      const customer = await stripe(env, 'customers', {
        name, ...(email ? { email } : {}), ...(phone ? { phone } : {}),
        description: `Website inquiry${artwork ? ` — ${artwork.title} (${artwork.file})` : ''}\n\n${message}`,
        'metadata[site]': 'muzzammil.us', 'metadata[environment]': env.SITE_ENVIRONMENT || 'staging',
        'metadata[inquiry]': 'true', 'metadata[inquiry_reference]': reference,
        ...(artwork ? { 'metadata[artwork]': artwork.file } : {})
      }, `muzz-inquiry-${reference}-${fingerprint}`);
      saved = true;
      record = { fingerprint, customerId: customer.id, notified: false };
      await env.INQUIRY_LIMITS.put(receiptKey, JSON.stringify(record), { expirationTtl: 86400 });
    }
    const notification = await env.INQUIRY_EMAIL.fetch(new Request('https://inquiry-email.internal/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, ...(phone ? { phone } : {}), message, reference, fingerprint, customerId: record.customerId,
        environment: env.SITE_ENVIRONMENT || 'staging',
        ...(artwork ? { artworkTitle: artwork.title, artworkSlug: artwork.slug } : {})
      })
    }));
    const delivery = await notification.json();
    if (!notification.ok || !delivery.sent) throw new Error('Email notification failed');
    await env.INQUIRY_LIMITS.put(receiptKey, JSON.stringify({ ...record, notified: true, messageId: delivery.messageId }), { expirationTtl: 86400 });
    return json({ received: true });
  } catch {
    return json({ error: saved
      ? 'Your inquiry is saved, but the email could not be sent. Please try again, or email smm321@gmail.com.'
      : 'Your inquiry could not be saved. Please try again, or email smm321@gmail.com.' }, 502);
  }
}

export function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'Method not allowed.' }, 405);
}
