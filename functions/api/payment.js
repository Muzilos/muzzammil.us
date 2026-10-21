import { json, stripe } from '../../lib/stripe.js';

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('session_id');
  if (!/^cs_(live|test)_[A-Za-z0-9]{16,220}$/.test(id || '')) return json({ error: 'A valid payment reference is required.' }, 400);
  try {
    const session = await stripe(env, `checkout/sessions/${id}?expand[]=line_items`);
    // Keep purchases already opened on staging valid during the release.
    if (session.metadata?.site !== 'muzzammil.us' || !['staging', 'production'].includes(session.metadata?.environment)) return json({ error: 'Payment not found.' }, 404);
    // Only expose the purchase summary; no customer or shipping information.
    return json({
      status: session.status,
      paid: session.status === 'complete' && session.payment_status === 'paid',
      amount: session.amount_total, currency: session.currency,
      kind: session.metadata.kind,
      reference: session.metadata.kind === 'merch' ? session.metadata.reference : undefined,
      hours: session.metadata.kind === 'hours' ? Number(session.metadata.hours) : undefined,
      items: (session.line_items?.data || []).map(item => ({ name: item.description, quantity: item.quantity }))
    });
  } catch { return json({ error: 'Payment could not be checked. Please try again.' }, 502); }
}

export function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return json({ error: 'Method not allowed.' }, 405);
}
