import fs from 'node:fs';
import { stripe } from '../lib/stripe.js';
import { plannerPaymentLinkData } from '../lib/planner.js';

process.loadEnvFile('.env');
const file = 'static/planner.json';
const planner = JSON.parse(fs.readFileSync(file, 'utf8'));
if (planner.id !== 'planner-2027' || planner.amount !== 2400 || planner.currency !== 'USD') throw new Error('Expected the approved $24 USD planner.');
const account = await stripe(process.env, 'account');
if (account.id !== 'acct_1TdOdAJfRoNnQ3sF' || !account.charges_enabled) throw new Error('Expected active artwork Stripe account.');
const reference = 'muzz_planner_2027_landforms';
const query = new URLSearchParams({ query: `metadata['site']:'muzzammil.us' AND metadata['reference']:'${reference}'`, limit: '100' });
const products = await stripe(process.env, `products/search?${query}`);
let product = products.data.find(p => p.active);
if (!product) product = await stripe(process.env, 'products', {
  name: planner.name, description: 'Preorder for the physical 2027 pocket planner by Muzzammil Mehdi.',
  shippable: 'true', tax_code: 'txcd_37060003',
  'metadata[site]': 'muzzammil.us', 'metadata[reference]': reference,
  'metadata[kind]': 'planner', 'metadata[preorder]': 'true', 'metadata[fulfillment]': 'manual'
}, 'muzz-planner-landforms-2027-product-v1');
if (product.tax_code !== 'txcd_37060003') throw new Error('Planner tax category needs review.');
planner.checkout.stripeProductId = product.id;
const lookup = reference + '_2400_usd_inclusive';
const prices = await stripe(process.env, `prices?lookup_keys[]=${lookup}&limit=100`);
let price = prices.data.find(p => p.active && p.product === product.id && p.unit_amount === 2400 && p.currency === 'usd' && p.type === 'one_time' && p.tax_behavior === 'inclusive');
if (!price) price = await stripe(process.env, 'prices', {
  product: product.id, currency: 'usd', unit_amount: '2400', tax_behavior: 'inclusive', lookup_key: lookup,
  'metadata[site]': 'muzzammil.us', 'metadata[kind]': 'planner'
}, 'muzz-planner-landforms-2027-price-2400-usd-inclusive-v1');
const tax = await stripe(process.env, 'tax/settings');
if (tax.status !== 'active') throw new Error('Stripe Tax must be active for the inclusive checkout.');
const linkData = plannerPaymentLinkData(price);
let link;
if (planner.checkout.stripePaymentLinkId) {
  link = await stripe(process.env, `payment_links/${planner.checkout.stripePaymentLinkId}`);
  // A price change needs a new checkout link; keep historical purchases intact.
  if (link.metadata?.reference !== lookup) link = null;
}
if (!link) {
  link = await stripe(process.env, 'payment_links', linkData, 'muzz-planner-landforms-2027-link-2400-usd-inclusive-v1');
}
const items = await stripe(process.env, `payment_links/${link.id}/line_items`);
if (!link.active || link.currency !== 'usd' || link.automatic_tax?.enabled !== true || link.adaptive_pricing?.enabled === true || link.shipping_options?.length || link.allow_promotion_codes || items.data.length !== 1 || items.data[0].price.id !== price.id || items.data[0].quantity !== 1 || items.data[0].adjustable_quantity?.enabled) {
  throw new Error('Unexpected preorder Payment Link configuration.');
}
const url = new URL(link.url);
if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com') throw new Error('Invalid Stripe payment link.');
planner.checkout = {
  enabled: true, stripeProductId: product.id, stripePriceId: price.id,
  stripePaymentLinkId: link.id, paymentLink: url.href,
  taxBehavior: 'inclusive', shippingIncluded: true
};
fs.writeFileSync(file, JSON.stringify(planner, null, 2) + '\n');
const pageFile = 'merch/index.html';
const page = fs.readFileSync(pageFile, 'utf8');
if (!/id="planner-checkout"[^>]*href="[^"]*"/.test(page)) throw new Error('Planner checkout anchor missing.');
fs.writeFileSync(pageFile, page.replace(/(id="planner-checkout"[^>]*href=")[^"]*(")/, (_, before, after) => before + url.href + after));
console.log(JSON.stringify({ productId: product.id, priceId: price.id, paymentLinkId: link.id, paymentLink: link.url, amount: price.unit_amount, taxBehavior: price.tax_behavior, shippingIncluded: true, chargesMade: 0 }));
