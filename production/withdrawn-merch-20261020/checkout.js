import { json, readJson, stripe } from '../../lib/stripe.js';
import { validateItems } from '../../static/merch-cart.js';

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Checkout is temporarily unavailable. Please try again shortly.' }, 503);
  let payload;
  try { payload = await readJson(request); }
  catch { return json({ error: 'Invalid checkout request.' }, 400); }
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(payload.reference || '')) return json({ error: 'Please reload your bag and try again.' }, 400);
  try {
    const response = await env.ASSETS.fetch(new URL('/static/merch.json', request.url));
    if (!response.ok) throw new Error('Catalog unavailable');
    const catalog = await response.json();
    let items;
    try { items = validateItems(payload.items, catalog.products); }
    catch (error) { return json({ error: error.message }, 400); }
    const order = items.map(item => {
      const product = catalog.products.find(p => p.variants.some(v => v.sku === item.sku));
      return { ...item, product, variant: product.variants.find(v => v.sku === item.sku) };
    });
    // No made-to-order goods can be charged without a configured fulfillment route.
    if (order.some(i => !i.product.fulfillment || !/^price_[A-Za-z0-9]+$/.test(i.variant.stripePriceId || ''))) return json({ error: 'An item is not available for checkout yet.' }, 409);
    const prices = await Promise.all(order.map(i => stripe(env, `prices/${i.variant.stripePriceId}?expand[]=product`)));
    for (let n = 0; n < prices.length; n++) {
      const price = prices[n];
      const { variant, product } = order[n];
      if (!price.active || price.product?.active === false || price.currency !== 'usd' || price.type !== 'one_time' || price.unit_amount !== variant.amount || price.product?.id !== variant.stripeProductId || price.product?.metadata?.site !== 'muzzammil.us') return json({ error: 'An item has changed. Please refresh the shop before checking out.' }, 409);
      if (!['manual-print', 'manual-merch'].includes(product.fulfillment)) return json({ error: 'This item is not available for checkout yet.' }, 409);
    }
    const hasMerch = order.some(item => item.product.fulfillment === 'manual-merch');
    const shipping = hasMerch ? catalog.shipping?.merchOrderAmount : 0;
    if (!Number.isInteger(shipping) || shipping < 0 || shipping > 5000) throw new Error('Shipping unavailable');
    const origin = new URL(request.url).origin;
    const data = {
      mode: 'payment', customer_creation: 'always', submit_type: 'pay',
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/merch/?checkout=cancelled`,
      client_reference_id: payload.reference,
      'shipping_address_collection[allowed_countries][0]': 'US',
      'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
      'shipping_options[0][shipping_rate_data][fixed_amount][amount]': String(shipping),
      'shipping_options[0][shipping_rate_data][fixed_amount][currency]': 'usd',
      'shipping_options[0][shipping_rate_data][display_name]': shipping ? 'US standard shipping' : 'US shipping included',
      'custom_text[submit][message]': hasMerch ? 'Printed and shipped by the artist. Questions? smm321@gmail.com' : 'Art print order. US shipping included.'
    };
    const metadata = { site: 'muzzammil.us', environment: env.SITE_ENVIRONMENT || 'staging', kind: 'merch', fulfillment: 'manual', reference: payload.reference };
    for (const [key, value] of Object.entries(metadata)) {
      data[`metadata[${key}]`] = value;
      data[`payment_intent_data[metadata][${key}]`] = value;
    }
    order.forEach((item, index) => {
      // Inline product names keep the chosen size visible in Checkout and on
      // receipts. Amounts come from the approved, verified live Stripe prices.
      const prefix = `line_items[${index}][price_data]`;
      data[`${prefix}[currency]`] = 'usd';
      data[`${prefix}[unit_amount]`] = String(prices[index].unit_amount);
      data[`${prefix}[product_data][name]`] = `${item.product.artwork} — ${item.product.name} / ${item.variant.label}`;
      data[`${prefix}[product_data][metadata][site]`] = 'muzzammil.us';
      data[`${prefix}[product_data][metadata][sku]`] = item.sku;
      data[`${prefix}[product_data][metadata][approved_price]`] = item.variant.stripePriceId;
      data[`line_items[${index}][quantity]`] = String(item.quantity);
      data[`metadata[item_${index + 1}]`] = `${item.sku}:${item.quantity}`;
      data[`payment_intent_data[metadata][item_${index + 1}]`] = `${item.sku}:${item.quantity}`;
    });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
    const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    const session = await stripe(env, 'checkout/sessions', data, `merch-${payload.reference}-${hash}`);
    if (!session.url?.startsWith('https://checkout.stripe.com/')) throw new Error('Checkout unavailable');
    return json({ url: session.url });
  } catch { return json({ error: 'Checkout could not be opened. Your bag is saved; please try again.' }, 502); }
}

export function onRequest(context) {
  return context.request.method === 'POST' ? onRequestPost(context) : json({ error: 'Method not allowed.' }, 405);
}
