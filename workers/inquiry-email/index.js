const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

// This Worker has no public URL. Only the site's private service binding calls it.
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    let data;
    try { data = await request.json(); }
    catch { return json({ error: 'Invalid request.' }, 400); }
    const email = typeof data?.email === 'string' ? data.email.trim() : '';
    const phone = typeof data?.phone === 'string' ? data.phone.trim() : '';
    const errors = contactErrors(email, phone);
    if (!data || errors.email || errors.phone || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100
      || typeof data.message !== 'string' || !data.message.trim() || data.message.length > 2000
      || !/^[a-f0-9-]{36}$/.test(data.reference || '')
      || !/^[a-f0-9]{64}$/.test(data.fingerprint || '')
      || !/^cus_[A-Za-z0-9]+$/.test(data.customerId || '')
      || !['production', 'staging'].includes(data.environment)) return json({ error: 'Invalid inquiry.' }, 400);
    const receiptKey = `email:${data.environment}:${data.reference}`;
    try {
      const existing = await env.DELIVERY_RECEIPTS.get(receiptKey, 'json');
      if (existing) {
        if (existing.fingerprint !== data.fingerprint) return json({ error: 'Reference already used.' }, 409);
        return json({ sent: true, messageId: existing.messageId });
      }
      const title = typeof data.artworkTitle === 'string' ? data.artworkTitle.replace(/[\r\n]/g, ' ').slice(0, 200) : '';
      const subject = `${data.environment === 'staging' ? '[Staging] ' : ''}New inquiry${title ? ` — ${title}` : ''}`;
      const lines = [`Name: ${data.name}`];
      if (email) lines.push(`Email: ${email}`);
      if (phone) lines.push(`Phone: ${phone}`);
      if (title) {
        lines.push(`Artwork: ${title}`);
        const url = new URL('https://muzzammil.us/paintings/');
        if (typeof data.artworkSlug === 'string') url.searchParams.set('artwork', data.artworkSlug);
        lines.push(url.href);
      }
      lines.push('', data.message, '', `Stripe: https://dashboard.stripe.com/acct_1TdOdAJfRoNnQ3sF/customers/${data.customerId}`, `Reference: ${data.reference}`);
      const result = await env.NOTIFICATIONS.send({
        to: 'smm321@gmail.com',
        from: { email: 'inquiries@notify.muzzammil.us', name: 'muzzammil.us' },
        ...(email ? { replyTo: email } : {}), subject, text: lines.join('\n')
      });
      if (!result?.messageId) throw new Error('Email was not accepted');
      await env.DELIVERY_RECEIPTS.put(receiptKey, JSON.stringify({ fingerprint: data.fingerprint, messageId: result.messageId }), { expirationTtl: 86400 });
      return json({ sent: true, messageId: result.messageId });
    } catch (error) {
      console.error('Inquiry notification failed', error.code || 'delivery_error');
      return json({ error: 'Email could not be sent.' }, 502);
    }
  }
};
import { contactErrors } from '../../static/inquiry-contact.js';
