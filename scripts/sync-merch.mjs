import fs from 'node:fs';
import crypto from 'node:crypto';

process.loadEnvFile('.env');
if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is required.');
const file = 'static/merch.json';
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
if (catalog.available === false) throw new Error('Merchandise was withdrawn by the owner. Select products and providers before relaunching.');
const digest = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
async function stripe(resource, data, key) {
  const headers = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` };
  if (data) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (key) headers['Idempotency-Key'] = key;
  const response = await fetch(`https://api.stripe.com/v1/${resource}`, { method: data ? 'POST' : 'GET', headers, body: data ? new URLSearchParams(data) : undefined, signal: AbortSignal.timeout(25000) });
  const result = await response.json();
  if (!response.ok) throw new Error(`Stripe ${resource.split('?')[0]} failed (${response.status})`);
  return result;
}
async function list(resource) {
  const records = [];
  let after;
  do {
    const page = await stripe(`${resource}?limit=100${after ? `&starting_after=${after}` : ''}`);
    records.push(...page.data);
    after = page.has_more ? page.data.at(-1).id : null;
  } while (after);
  return records;
}
const account = await stripe('account');
if (account.id !== 'acct_1TdOdAJfRoNnQ3sF' || !account.charges_enabled) throw new Error('Expected active artwork Stripe account is required.');
const [products, prices] = await Promise.all([list('products'), list('prices')]);
let createdProducts = 0, createdPrices = 0;
for (const item of catalog.products.filter(p => p.fulfillment === 'manual-merch')) {
  const reference = `muzz_merch_${item.id}`;
  const name = `${item.artwork} — ${item.name}`;
  const description = `${item.description} Printed and shipped by the artist.`;
  let product = products.find(p => p.active && p.metadata?.reference === reference);
  if (!product) {
    product = await stripe('products', {
      name, description, shippable: 'true',
      'metadata[site]': 'muzzammil.us', 'metadata[kind]': 'merch',
      'metadata[reference]': reference, 'metadata[artwork]': item.artworkFile,
      'metadata[fulfillment]': 'manual', 'metadata[category]': item.category
    }, `muzz-merch-product-${digest(reference)}`);
    products.push(product); createdProducts++;
  }
  if (product.metadata?.artwork !== item.artworkFile || product.name !== name || product.description !== description) {
    product = await stripe(`products/${product.id}`, { name, description, 'metadata[artwork]': item.artworkFile }, `muzz-merch-description-${digest(`${product.id}:${item.artworkFile}:${name}:${description}`)}`);
  }
  for (const variant of item.variants) {
    if (!Number.isInteger(variant.amount) || variant.amount <= 0 || !variant.available || !item.available) throw new Error('Invalid merchandise price or availability');
    const lookup = `muzz_merch_${digest(`${variant.sku}:${variant.amount}`)}`;
    let price = prices.find(p => p.active && p.product === product.id && p.currency === 'usd' && p.type === 'one_time' && p.unit_amount === variant.amount && p.lookup_key === lookup);
    if (!price) {
      price = await stripe('prices', {
        product: product.id, currency: 'usd', unit_amount: String(variant.amount),
        nickname: variant.label, lookup_key: lookup,
        'metadata[site]': 'muzzammil.us', 'metadata[kind]': 'merch',
        'metadata[sku]': variant.sku, 'metadata[option]': variant.label
      }, `muzz-merch-price-${digest(lookup)}`);
      prices.push(price); createdPrices++;
    }
    variant.stripePriceId = price.id;
    variant.stripeProductId = product.id;
  }
}
fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + '\n');
console.log(JSON.stringify({ accountEmail: account.email, createdProducts, createdPrices, manualMerchProducts: catalog.products.filter(p => p.fulfillment === 'manual-merch').length, chargesMade: 0 }));
