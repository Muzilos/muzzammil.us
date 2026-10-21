import fs from 'node:fs';
import crypto from 'node:crypto';

// Creates only missing records. Keys never enter the generated catalog.
process.loadEnvFile('.env');
if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is missing.');
const origin = 'https://muzzammil.us';
const catalogPath = 'static/artworks.json';
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const digest = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 20);
const created = { products: 0, prices: 0, payment_links: 0 };

async function stripe(path, data, idempotencyKey) {
  const headers = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` };
  if (data) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: data ? 'POST' : 'GET', headers,
    body: data ? new URLSearchParams(data) : undefined,
    signal: AbortSignal.timeout(30000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${path}: ${result.error?.message || response.status}`);
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

const products = await list('products');
const prices = await list('prices');
const links = await list('payment_links');

async function offer({ reference, name, amount, size, artwork, hours, kind, image }) {
  let product = products.find(p => p.active && p.metadata?.reference === reference);
  if (!product) {
    const data = {
      name, 'metadata[site]': 'muzzammil.us', 'metadata[reference]': reference,
      'metadata[kind]': kind, shippable: kind !== 'hours' ? 'true' : 'false'
    };
    if (artwork) data['metadata[artwork]'] = artwork.file;
    if (image) data['images[0]'] = image;
    if (kind === 'print') data.description = 'Art print. US shipping included.';
    if (hours) data.description = `Prepaid time with Muzzammil Mehdi: ${hours} ${hours === 1 ? 'hour' : 'hours'}.`;
    product = await stripe('products', data, `muzz-product-${reference}`);
    products.push(product); created.products++;
  }
  if (image && product.images?.[0] !== image) {
    Object.assign(product, await stripe(`products/${product.id}`, {
      'images[0]': image
    }, `muzz-image-${product.id}-${digest(image)}`));
  }
  const lookup = `${reference}_${digest(size || 'standard')}_${amount}`;
  let price = prices.find(p => p.active && p.lookup_key === lookup && p.product === product.id && p.unit_amount === amount);
  if (!price) {
    price = await stripe('prices', {
      product: product.id, currency: 'usd', unit_amount: String(amount),
      nickname: size || (hours ? `${hours} hours` : 'Original'), lookup_key: lookup,
      'metadata[site]': 'muzzammil.us', 'metadata[kind]': kind,
      ...(size ? { 'metadata[size]': size } : {})
    }, `muzz-price-${lookup}`);
    prices.push(price); created.prices++;
  }
  const linkReference = `production_${lookup}`;
  // Preserve the original's single-use link even after it is exhausted or
  // deactivated. Reissuing one would allow the same original to sell again.
  let link = links.find(l => l.metadata?.reference === linkReference || l.metadata?.reference === `staging_${lookup}`);
  if (!link) {
    const metadata = {
      site: 'muzzammil.us', environment: 'production', kind,
      reference: linkReference, ...(artwork ? { artwork: artwork.file } : {}),
      ...(size ? { size } : {}), ...(hours ? { hours: String(hours) } : {})
    };
    const data = {
      'line_items[0][price]': price.id, 'line_items[0][quantity]': '1',
      customer_creation: 'always', submit_type: 'pay',
      'after_completion[type]': 'redirect',
      'after_completion[redirect][url]': `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`
    };
    for (const [key, value] of Object.entries(metadata)) {
      data[`metadata[${key}]`] = value;
      data[`payment_intent_data[metadata][${key}]`] = value;
    }
    if (kind === 'print') {
      data['shipping_address_collection[allowed_countries][0]'] = 'US';
      data['custom_text[shipping_address][message]'] = 'US shipping is included.';
      data['custom_text[submit][message]'] = `${size} print. US shipping included.`;
    }
    if (kind === 'original') {
      data['restrictions[completed_sessions][limit]'] = '1';
      data.inactive_message = 'This original is no longer available.';
    }
    if (kind === 'hours') {
      for (const [index, [key, label]] of [['request', 'What do you need?'], ['availability', 'Availability']].entries()) {
        data[`custom_fields[${index}][key]`] = key;
        data[`custom_fields[${index}][label][type]`] = 'custom';
        data[`custom_fields[${index}][label][custom]`] = label;
        data[`custom_fields[${index}][type]`] = 'text';
        data[`custom_fields[${index}][optional]`] = 'true';
        data[`custom_fields[${index}][text][maximum_length]`] = '200';
      }
    }
    link = await stripe('payment_links', data, `muzz-link-${linkReference}`);
    links.push(link); created.payment_links++;
  }
  const returnUrl = `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`;
  if (link.metadata?.environment !== 'production' || link.metadata?.reference !== linkReference || link.after_completion?.redirect?.url !== returnUrl) {
    link = await stripe(`payment_links/${link.id}`, {
      'metadata[environment]': 'production', 'metadata[reference]': linkReference,
      'payment_intent_data[metadata][environment]': 'production',
      'payment_intent_data[metadata][reference]': linkReference,
      'after_completion[type]': 'redirect', 'after_completion[redirect][url]': returnUrl
    }, `muzz-production-${link.id}`);
  }
  if (kind === 'print' && link.custom_text?.submit?.message !== `${size} print. US shipping included.`) {
    await stripe(`payment_links/${link.id}`, {
      'custom_text[submit][message]': `${size} print. US shipping included.`
    }, `muzz-print-size-${link.id}`);
  }
  return { productId: product.id, priceId: price.id, paymentLinkId: link.id, paymentLink: link.url };
}

for (const [index, artwork] of catalog.artworks.entries()) {
  if (artwork.listed === false) continue;
  const reference = `muzz_print_${digest(artwork.file)}`;
  const image = new URL(artwork.thumbnail || `/paintings/-compressed/optimized/thumb_${artwork.file}.webp`, origin).href;
  artwork.printOptions = [];
  for (const [size, amount] of Object.entries(artwork.printPrices || {})) {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error(`Invalid print price: ${artwork.file}`);
    const record = await offer({ reference, name: /\(print\)/i.test(artwork.title) ? artwork.title : `${artwork.title} (print)`, amount, size, artwork, kind: 'print', image });
    artwork.printOptions.push({ size, amount, ...record });
  }
  artwork.printPaymentLink = artwork.printOptions[0]?.paymentLink;
  if (artwork.status !== 'sold' && artwork.status !== 'reserved' && Number.isInteger(artwork.price) && artwork.price > 0) {
    if (/\(print\)/i.test(artwork.title)) {
      artwork.purchasePaymentLink = artwork.printPaymentLink;
    } else {
      const record = await offer({ reference: `muzz_original_${digest(artwork.file)}`, name: artwork.title, amount: artwork.price, artwork, kind: 'original', image });
      artwork.purchasePaymentLink = record.paymentLink;
      artwork.purchasePaymentLinkId = record.paymentLinkId;
      artwork.stripeProductId = record.productId;
    }
  }
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  if ((index + 1) % 10 === 0) console.log(`Synced ${index + 1}/${catalog.artworks.length} artworks.`);
}

const packs = [];
for (const [hours, amount] of [[1, 10000], [3, 28500], [5, 45000]]) {
  packs.push({ hours, amount, ...await offer({ reference: `muzz_hours_${hours}`, name: `${hours} ${hours === 1 ? 'hour' : 'hours'} with Muzzammil`, hours, amount, kind: 'hours' }) });
}
fs.writeFileSync('static/hourly-packs.json', `${JSON.stringify({ currency: 'USD', packs }, null, 2)}\n`);
console.log(JSON.stringify({ created, artworks: catalog.artworks.filter(a => a.listed !== false).length, printOptions: catalog.artworks.reduce((n, a) => n + (a.printOptions?.length || 0), 0), packs: packs.length }));
