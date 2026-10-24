import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequestPost as checkout } from '../functions/api/merch-checkout.js';
import { validateItems, restoreCart, acknowledgePurchase, CART_KEY, PENDING_KEY } from '../static/merch-cart.js';

const origin = 'https://staging.muzzammil.us';
const reference = '9a9bb8c0-44f5-4c25-a848-2826c23025f9';
const products = [{ id: 'print', artwork: 'Infinite Jester', name: 'Art print', available: true, fulfillment: 'manual-print', variants: [
  { sku: 'jester-small', label: 'Small', amount: 4000, available: true, stripePriceId: 'price_small', stripeProductId: 'prod_jester' },
  { sku: 'jester-large', label: 'Large', amount: 12000, available: true, stripePriceId: 'price_large', stripeProductId: 'prod_jester' }
] }, { id: 'tshirt', available: false, fulfillment: null, variants: [{ sku: 'shirt-m', amount: 3800, available: false }] }];
const response = value => new Response(JSON.stringify(value));
const env = { STRIPE_SECRET_KEY: 'local-test-placeholder', SITE_ENVIRONMENT: 'staging', ASSETS: { fetch: async () => response({ products, shipping: { merchOrderAmount: 695 } }) } };
const request = (payload, originHeader = origin) => new Request(`${origin}/api/merch-checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: originHeader }, body: JSON.stringify(payload) });

test('merch cart rejects unavailable goods, forged SKUs, and invalid or excessive quantities', () => {
  for (const items of [[], null, {}, [{ sku: 'unknown', quantity: 1 }], [{ sku: 'shirt-m', quantity: 1 }], [{ sku: 'jester-small', quantity: 0 }], [{ sku: 'jester-small', quantity: 1.1 }], [{ sku: 'jester-small', quantity: '1' }], [{ sku: 'jester-small', quantity: 11 }], [{ sku: 'jester-small', quantity: 6 }, { sku: 'jester-small', quantity: 6 }]]) assert.throws(() => validateItems(items, products));
  const many = [{ available: true, variants: ['one', 'two', 'three'].map(sku => ({ sku, available: true })) }];
  assert.throws(() => validateItems(['one', 'two', 'three'].map(sku => ({ sku, quantity: 10 })), many), /25 items/);
  assert.deepEqual(validateItems([{ sku: 'jester-small', quantity: 2 }, { sku: 'jester-small', quantity: 3 }], products), [{ sku: 'jester-small', quantity: 5 }]);
});

test('merch checkout rejects invalid or unavailable carts without contacting Stripe', async t => {
  const stripe = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected Stripe request'); });
  for (const payload of [{ reference, items: [{ sku: 'shirt-m', quantity: 1 }] }, { reference, items: [{ sku: 'forged', quantity: 1 }] }, { reference: 'anything', items: [{ sku: 'jester-small', quantity: 1 }] }]) assert.equal((await checkout({ request: request(payload), env })).status, 400);
  assert.equal((await checkout({ request: request({ reference, items: [{ sku: 'jester-small', quantity: 1 }] }, 'https://other.example'), env })).status, 400);
  assert.equal((await checkout({ request: request({ reference, items: [], extra: 'x'.repeat(13000) }), env })).status, 400);
  assert.equal(stripe.mock.callCount(), 0);
});

test('multi-item merch checkout uses validated Stripe prices, shipping address, and idempotency', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options });
    if (url.includes('/prices/')) return response({ active: true, type: 'one_time', currency: 'usd', unit_amount: url.includes('price_small') ? 4000 : 12000, product: { id: 'prod_jester', active: true, metadata: { site: 'muzzammil.us' } } });
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(options.method, 'POST');
    assert.equal(options.body.get('mode'), 'payment');
    assert.equal(options.body.get('metadata[kind]'), 'merch');
    assert.equal(options.body.get('metadata[environment]'), 'staging');
    assert.equal(options.body.get('payment_intent_data[metadata][reference]'), reference);
    assert.equal(options.body.get('shipping_address_collection[allowed_countries][0]'), 'US');
    assert.equal(options.body.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '0');
    assert.equal(options.body.get('success_url'), origin + '/success.html?session_id={CHECKOUT_SESSION_ID}');
    assert.equal(options.body.get('cancel_url'), origin + '/merch/?checkout=cancelled');
    assert.equal(options.body.get('line_items[0][price]'), null);
    assert.equal(options.body.get('line_items[0][price_data][product_data][name]'), 'Infinite Jester — Art print / Large');
    assert.equal(options.body.get('line_items[0][price_data][product_data][metadata][approved_price]'), 'price_large');
    assert.equal(options.body.get('line_items[0][quantity]'), '1');
    assert.equal(options.body.get('line_items[1][price_data][product_data][metadata][approved_price]'), 'price_small');
    assert.equal(options.body.get('line_items[1][quantity]'), '2');
    assert.equal(options.body.get('line_items[0][price_data][unit_amount]'), '12000');
    assert.equal(options.body.get('line_items[1][price_data][unit_amount]'), '4000');
    assert.match(options.headers['Idempotency-Key'], /^merch-9a9bb8c0/);
    return response({ url: 'https://checkout.stripe.com/c/pay/cs_example' });
  });
  const payload = { reference, items: [{ sku: 'jester-small', quantity: 2, amount: 1, stripePriceId: 'price_forged' }, { sku: 'jester-large', quantity: 1 }], total: 1 };
  const result = await checkout({ request: request(payload), env });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { url: 'https://checkout.stripe.com/c/pay/cs_example' });
  const key = requests.at(-1).options.headers['Idempotency-Key'];
  await checkout({ request: request({ ...payload, items: payload.items.toReversed() }), env });
  assert.equal(requests.at(-1).options.headers['Idempotency-Key'], key);
});

test('merch checkout blocks changed, inactive, unrelated, and recurring Stripe prices before session creation', async t => {
  let price;
  const stripe = t.mock.method(globalThis, 'fetch', async url => {
    assert.match(url, /\/prices\//);
    return response(price);
  });
  const valid = { active: true, type: 'one_time', currency: 'usd', unit_amount: 4000, product: { id: 'prod_jester', active: true, metadata: { site: 'muzzammil.us' } } };
  for (const mismatch of [{ active: false }, { type: 'recurring' }, { currency: 'eur' }, { unit_amount: 1 }, { product: { ...valid.product, id: 'prod_other' } }, { product: { ...valid.product, active: false } }, { product: { ...valid.product, metadata: { site: 'other.example' } } }]) {
    price = { ...valid, ...mismatch };
    assert.equal((await checkout({ request: request({ reference, items: [{ sku: 'jester-small', quantity: 1 }] }), env })).status, 409);
  }
  assert.equal(stripe.mock.callCount(), 7);
});

test('mixed merchandise and print orders charge US shipping once for the whole cart', async t => {
  const shirt = { id: 'shirt', available: true, fulfillment: 'manual-merch', variants: [{ sku: 'shirt-m', label: 'M', amount: 3800, available: true, stripePriceId: 'price_shirt', stripeProductId: 'prod_shirt' }] };
  const mixedEnv = { ...env, ASSETS: { fetch: async () => response({ products: [...products.filter(p => p.id !== 'tshirt'), shirt], shipping: { merchOrderAmount: 695 } }) } };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.includes('/prices/')) {
      const isShirt = url.includes('price_shirt');
      return response({ active: true, currency: 'usd', type: 'one_time', unit_amount: isShirt ? 3800 : 4000, product: { id: isShirt ? 'prod_shirt' : 'prod_jester', active: true, metadata: { site: 'muzzammil.us' } } });
    }
    assert.equal(options.body.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '695');
    assert.equal(options.body.get('shipping_options[1][shipping_rate_data][fixed_amount][amount]'), null);
    assert.equal(options.body.get('metadata[fulfillment]'), 'manual');
    assert.equal(options.body.get('metadata[item_2]'), 'shirt-m:3');
    return response({ url: 'https://checkout.stripe.com/c/pay/cs_example' });
  });
  assert.equal((await checkout({ request: request({ reference, items: [{ sku: 'shirt-m', quantity: 3 }, { sku: 'jester-small', quantity: 1 }] }), env: mixedEnv })).status, 200);
});

function storageWith(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}

test('saved cart removes unavailable goods and tolerates malformed or blocked storage', () => {
  assert.deepEqual(restoreCart(storageWith({ [CART_KEY]: JSON.stringify([{ sku: 'shirt-m', quantity: 1 }, { sku: 'jester-small', quantity: 2 }]) }), products), [{ sku: 'jester-small', quantity: 2 }]);
  for (const value of ['{broken', '{}', 'null', '[{"sku":"jester-small","quantity":-1}]']) assert.deepEqual(restoreCart(storageWith({ [CART_KEY]: value }), products), []);
  assert.deepEqual(restoreCart({ getItem() { throw new Error('Blocked'); } }, products), []);
});

test('paid checkout removes its own items once and preserves items added later', () => {
  const storage = storageWith({ [CART_KEY]: JSON.stringify([{ sku: 'jester-small', quantity: 3 }, { sku: 'jester-large', quantity: 1 }]), [PENDING_KEY]: JSON.stringify({ reference, items: [{ sku: 'jester-small', quantity: 2 }] }) });
  acknowledgePurchase(storage, 'unrelated-reference');
  assert.equal(JSON.parse(storage.getItem(CART_KEY))[0].quantity, 3);
  acknowledgePurchase(storage, reference);
  const expected = [{ sku: 'jester-small', quantity: 1 }, { sku: 'jester-large', quantity: 1 }];
  assert.deepEqual(JSON.parse(storage.getItem(CART_KEY)), expected);
  acknowledgePurchase(storage, reference);
  assert.deepEqual(JSON.parse(storage.getItem(CART_KEY)), expected);
});

test('merchandise has complete fulfillment and Stripe IDs, and art prints match the approved catalog', () => {
  const catalog = JSON.parse(fs.readFileSync('static/merch.json'));
  const artworks = JSON.parse(fs.readFileSync('static/artworks.json')).artworks;
  const skus = new Set();
  for (const product of catalog.products) {
    const artwork = artworks.find(a => a.file === product.artworkFile);
    assert.ok(artwork);
    if (['planner', 'calendar'].includes(product.category)) {
      assert.equal(product.sourceArtworks.length, 12);
      assert.equal(fs.existsSync(new URL(product.previewPdf, origin).pathname.slice(1)), true);
      assert.equal(fs.existsSync(new URL(product.insideImage, origin).pathname.slice(1)), true);
      for (const image of product.sourceArtworks) assert.equal(fs.existsSync(image.slice(1)), true);
    } else assert.equal(product.artwork, artwork.title);
    assert.equal(fs.existsSync(new URL(product.image, origin).pathname.slice(1)), true);
    for (const variant of product.variants) {
      assert.equal(skus.has(variant.sku), false);
      skus.add(variant.sku);
      if (product.category === 'print') {
        const approved = artwork.printOptions.find(p => p.size === variant.label);
        assert.equal(product.fulfillment, 'manual-print');
        assert.equal(variant.amount, approved.amount);
        assert.equal(variant.stripePriceId, approved.priceId);
        assert.equal(variant.stripeProductId, approved.productId);
      } else if (product.available) {
        assert.equal(product.fulfillment, 'manual-merch');
        assert.match(variant.stripePriceId, /^price_[A-Za-z0-9]+$/);
        assert.match(variant.stripeProductId, /^prod_[A-Za-z0-9]+$/);
      } else {
        assert.equal(variant.available, false);
      }
    }
  }
});
