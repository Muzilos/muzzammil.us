import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as checkout } from '../functions/api/planner-checkout.js';
import { plannerPaymentLinkData } from '../lib/planner.js';
import { SHIPPING_COUNTRIES } from '../static/planner-order.js';

const price = { id: 'price_planner', active: true, type: 'one_time', currency: 'usd', unit_amount: 2400, tax_behavior: 'inclusive' };

test('planner Payment Link keeps checkout at $24 including tax and shipping and collects a delivery address', () => {
  const data = plannerPaymentLinkData(price);
  assert.equal(data['line_items[0][price]'], price.id);
  assert.equal(data['line_items[0][quantity]'], '1');
  assert.equal(data['automatic_tax[enabled]'], 'true');
  assert.equal(Object.keys(data).some(key => /shipping_options|tax_rates|optional_items|adjustable_quantity/.test(key)), false);
  const countries = Object.entries(data).filter(([key]) => key.startsWith('shipping_address_collection[')).map(([, value]) => value);
  assert.deepEqual(countries, SHIPPING_COUNTRIES);
  assert.equal(new Set(countries).size, countries.length);
  assert.ok(countries.includes('US') && countries.includes('CA') && countries.includes('GB'));
  assert.equal(data['metadata[kind]'], 'planner');
  assert.equal(data['metadata[reference]'], 'muzz_planner_2027_landforms_2400_usd_inclusive');
  assert.match(data['custom_text[submit][message]'], /\$24 USD total/);
  assert.match(data['custom_text[shipping_address][message]'], /\$24 USD total/);
  assert.equal(data['metadata[environment]'], 'production');
  assert.equal(data['payment_intent_data[metadata][preorder]'], 'true');
  assert.equal(data['after_completion[redirect][url]'], 'https://muzzammil.us/success.html?session_id={CHECKOUT_SESSION_ID}');
});

test('planner link creation refuses exclusive taxes, changed prices and recurring or inactive offers', () => {
  for (const change of [{ tax_behavior: 'exclusive' }, { unit_amount: 2401 }, { unit_amount: 3500 }, { active: false }, { type: 'recurring' }, { currency: 'cad' }]) {
    assert.throws(() => plannerPaymentLinkData({ ...price, ...change }), /approved/);
  }
});

test('old planner endpoint cannot create checkout sessions with extra postage', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected Stripe request'); });
  assert.equal((await checkout()).status, 410);
  assert.equal(fetch.mock.callCount(), 0);
});
