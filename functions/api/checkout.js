import { catalogFor, json, readJson, stripe } from '../../lib/stripe.js';

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Checkout is temporarily unavailable.' }, 503);
  let payload;
  try { payload = await readJson(request); }
  catch { return json({ error: 'Invalid request.' }, 400); }
  if (typeof payload.artwork !== 'string') return json({ error: 'Choose an artwork.' }, 400);
  try {
    const catalog = await catalogFor(request, env);
    const artwork = catalog.artworks.find(entry => entry.file === payload.artwork && entry.listed !== false);
    if (!artwork || artwork.status === 'sold' || artwork.status === 'reserved' || !Number.isInteger(artwork.price) || artwork.price <= 0) {
      return json({ error: 'This artwork is not available for purchase.' }, 404);
    }
    // Reuse Stripe's one-purchase link for each original instead of creating
    // duplicate sessions with no inventory limit.
    const linkId = /\(print\)/i.test(artwork.title) ? artwork.printOptions?.[0]?.paymentLinkId : artwork.purchasePaymentLinkId;
    if (!linkId || !/^plink_[A-Za-z0-9]+$/.test(linkId)) return json({ error: 'Checkout is temporarily unavailable.' }, 503);
    const link = await stripe(env, `payment_links/${linkId}`);
    if (!link.active) return json({ error: 'This artwork is no longer available.' }, 410);
    return json({ url: link.url });
  } catch { return json({ error: 'Stripe could not be opened. Please try again.' }, 502); }
}

export function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'Method not allowed.' }, 405);
}
