import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as checkout, onRequest as retiredCheckout } from '../functions/api/merch-checkout.js';
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

test('withdrawn merch checkout rejects old carts without reaching Stripe or the catalog', async t => {
  const stripe = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected Stripe request'); });
  let catalogReads = 0;
  const retiredEnv = { ...env, ASSETS: { fetch() { catalogReads++; throw new Error('Retired catalog must not be loaded'); } } };
  for (const payload of [{ reference, items: [{ sku: 'jester-small', quantity: 1 }] }, { reference, items: [{ sku: 'planner-2027-a5', quantity: 1 }] }, {}]) {
    const result = await checkout({ request: request(payload), env: retiredEnv });
    assert.equal(result.status, 410);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await result.json(), { error: 'Merchandise is currently unavailable.' });
  }
  assert.equal((await retiredCheckout({ request: new Request(origin + '/api/merch-checkout'), env: retiredEnv })).status, 410);
  assert.equal(stripe.mock.callCount(), 0);
  assert.equal(catalogReads, 0);
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
