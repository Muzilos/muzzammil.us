import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as checkout } from '../functions/api/checkout.js';
import { onRequestGet as payment } from '../functions/api/payment.js';
import { onRequestPost as inquiry } from '../functions/api/inquiry.js';

const origin = 'https://staging.muzzammil.us';
const original = { file: 'original.jpg', title: 'Original', price: 40000, status: 'available', purchasePaymentLinkId: 'plink_original123' };
const post = (path, data, headers = {}) => new Request(origin + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(data)
});
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const environment = artworks => ({
  STRIPE_SECRET_KEY: 'local-test-placeholder',
  ASSETS: { fetch: async () => response({ artworks }) }
});

test('sold originals and unknown artworks cannot reach Stripe', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected Stripe request'); });
  for (const artwork of [{ ...original, status: 'sold' }, { ...original, status: 'reserved' }]) {
    const result = await checkout({ request: post('/api/checkout', { artwork: original.file, price: 1 }), env: environment([artwork]) });
    assert.equal(result.status, 404);
  }
  assert.equal((await checkout({ request: post('/api/checkout', { artwork: 'fake' }), env: environment([original]) })).status, 404);
});

test('original checkout reuses its restricted link and ignores browser pricing', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.stripe.com/v1/payment_links/plink_original123');
    assert.equal(options.method, 'GET');
    return response({ active: true, url: 'https://buy.stripe.com/example' });
  });
  const result = await checkout({ request: post('/api/checkout', { artwork: original.file, price: 1, quantity: 99 }), env: environment([original]) });
  assert.deepEqual(await result.json(), { url: 'https://buy.stripe.com/example' });
  assert.equal(fetch.mock.callCount(), 1);
});

test('inactive original links cannot be purchased', async t => {
  t.mock.method(globalThis, 'fetch', async () => response({ active: false }));
  assert.equal((await checkout({ request: post('/api/checkout', { artwork: original.file }), env: environment([original]) })).status, 410);
});

test('checkout rejects cross-origin and oversized requests before Stripe', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected Stripe request'); });
  const env = environment([original]);
  assert.equal((await checkout({ request: post('/api/checkout', { artwork: original.file }, { Origin: 'https://elsewhere.example' }), env })).status, 400);
  assert.equal((await checkout({ request: post('/api/checkout', { artwork: 'x'.repeat(13000) }), env })).status, 400);
});

test('payment status requires both a completed session and a paid payment', async t => {
  let session;
  t.mock.method(globalThis, 'fetch', async () => response(session));
  for (const source of ['staging', 'production']) {
   for (const [status, payment_status, paid] of [['open', 'unpaid', false], ['complete', 'unpaid', false], ['complete', 'paid', true]]) {
    session = { status, payment_status, amount_total: 28500, currency: 'usd', metadata: { site: 'muzzammil.us', environment: source, kind: 'hours', hours: '3' }, customer_details: { email: 'private@example.com', address: { line1: 'Private' } }, line_items: { data: [{ description: '3 hours', quantity: 1 }] } };
    const result = await payment({ request: new Request(origin + '/api/payment?session_id=cs_live_abcdefghijklmnop'), env: environment([]) });
    const body = await result.json();
    assert.equal(body.paid, paid);
    assert.equal(body.hours, 3);
    assert.equal(JSON.stringify(body).includes('private'), false);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
   }
  }
});

test('payment status rejects unrelated sessions and invalid references', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response({ metadata: { site: 'other-site' } }));
  assert.equal((await payment({ request: new Request(origin + '/api/payment?session_id=anything'), env: environment([]) })).status, 400);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal((await payment({ request: new Request(origin + '/api/payment?session_id=cs_live_abcdefghijklmnop'), env: environment([]) })).status, 404);
});

const inquiryPayload = { name: 'Example person', email: 'person@example.com', message: 'A question about the painting.', artwork: 'original.jpg', reference: 'a68dd342-e58e-4be2-80ce-1ebcb03cfc22' };
function inquiryEnv() {
  const store = new Map();
  return {
    ...environment([original]),
    INQUIRY_LIMITS: { get: async key => store.get(key) || null, put: async (key, value) => { store.set(key, value); } },
    INQUIRY_EMAIL: { fetch: async () => response({ sent: true, messageId: 'email_example' }) }
  };
}

test('inquiries are saved once in Stripe with the correct artwork and no payment', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.stripe.com/v1/customers');
    assert.equal(options.body.get('email'), inquiryPayload.email);
    assert.match(options.body.get('description'), /Original \(original.jpg\)/);
    assert.match(options.body.get('description'), /A question about the painting/);
    assert.equal(options.body.get('metadata[inquiry]'), 'true');
    assert.ok(options.headers['Idempotency-Key']);
    return response({ id: 'cus_example' });
  });
  const env = inquiryEnv();
  const notification = t.mock.method(env.INQUIRY_EMAIL, 'fetch', async request => {
    const data = await request.json();
    assert.equal(data.customerId, 'cus_example');
    assert.equal(data.email, inquiryPayload.email);
    assert.equal(data.message, inquiryPayload.message);
    assert.equal(data.artworkTitle, 'Original');
    return response({ sent: true, messageId: 'email_example' });
  });
  for (let retry = 0; retry < 2; retry++) {
    const result = await inquiry({ request: post('/api/inquiry', inquiryPayload), env });
    assert.deepEqual(await result.json(), { received: true });
  }
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(notification.mock.callCount(), 1);
});

test('failed email delivery can be retried without another Stripe customer', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response({ id: 'cus_retry123' }));
  const env = inquiryEnv();
  let attempts = 0;
  env.INQUIRY_EMAIL.fetch = async () => ++attempts === 1
    ? new Response(JSON.stringify({ error: 'Unavailable' }), { status: 502 })
    : response({ sent: true, messageId: 'email_retry' });
  const failed = await inquiry({ request: post('/api/inquiry', inquiryPayload), env });
  assert.equal(failed.status, 502);
  assert.match((await failed.json()).error, /inquiry is saved/);
  const retried = await inquiry({ request: post('/api/inquiry', inquiryPayload), env });
  assert.deepEqual(await retried.json(), { received: true });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(attempts, 2);
});

test('phone-only and combined contacts are stored in Stripe and sent in notifications', async t => {
  const phone = '+44 20 7946 0958';
  let payload;
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.body.get('phone'), phone);
    assert.equal(options.body.get('email'), payload.email || null);
    return response({ id: 'cus_phone123' });
  });
  for (const email of ['', 'person@example.com']) {
    payload = { ...inquiryPayload, email, phone };
    const env = inquiryEnv();
    env.INQUIRY_EMAIL.fetch = async request => {
      const data = await request.json();
      assert.equal(data.phone, phone);
      assert.equal(data.email, email);
      return response({ sent: true, messageId: 'email_phone' });
    };
    assert.deepEqual(await (await inquiry({ request: post('/api/inquiry', payload), env })).json(), { received: true });
  }
  assert.equal(fetch.mock.callCount(), 2);
});

test('inquiries reject missing or invalid contact details before Stripe', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected Stripe request'); });
  for (const contact of [
    { email: '', phone: '' }, { email: '  ', phone: '   ' },
    { email: '', phone: 'call me' }, { email: '', phone: '123' },
    { email: 'invalid', phone: '+1 202 555 0119' },
    { email: 'person@example.com', phone: 'invalid' }
  ]) {
    const result = await inquiry({ request: post('/api/inquiry', { ...inquiryPayload, ...contact }), env: inquiryEnv() });
    assert.equal(result.status, 400);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('phone formatting cannot bypass the contact submission limit', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response({ id: 'cus_limit123' }));
  const env = inquiryEnv();
  for (let index = 0; index < 4; index++) {
    const payload = { ...inquiryPayload, email: '', phone: index % 2 ? '(202) 555-0119' : '202.555.0119', reference: crypto.randomUUID() };
    const result = await inquiry({ request: post('/api/inquiry', payload), env });
    assert.equal(result.status, index < 3 ? 200 : 429);
  }
  assert.equal(fetch.mock.callCount(), 3);
});

test('unconfigured email delivery does not silently accept inquiries', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected Stripe request'); });
  const env = inquiryEnv();
  delete env.INQUIRY_EMAIL;
  assert.equal((await inquiry({ request: post('/api/inquiry', inquiryPayload), env })).status, 503);
  assert.equal(fetch.mock.callCount(), 0);
});

test('invalid inquiries and honeypots never create Stripe customers', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected Stripe request'); });
  const env = inquiryEnv();
  for (const payload of [{ ...inquiryPayload, email: 'invalid' }, { ...inquiryPayload, message: 'x'.repeat(2001) }, { ...inquiryPayload, artwork: 'fake' }]) {
    assert.equal((await inquiry({ request: post('/api/inquiry', payload), env })).status, 400);
  }
  assert.equal((await inquiry({ request: post('/api/inquiry', { ...inquiryPayload, website: 'spam' }), env })).status, 200);
  assert.equal(fetch.mock.callCount(), 0);
});

test('production inquiries are recorded as production in Stripe', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.body.get('metadata[environment]'), 'production');
    return response({ id: 'cus_production_example' });
  });
  const env = { ...inquiryEnv(), SITE_ENVIRONMENT: 'production' };
  const request = new Request('https://muzzammil.us/api/inquiry', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://muzzammil.us' }, body: JSON.stringify(inquiryPayload)
  });
  assert.deepEqual(await (await inquiry({ request, env })).json(), { received: true });
});

test('inquiry limits stop repeated submissions', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected Stripe request'); });
  const env = inquiryEnv();
  env.INQUIRY_LIMITS.get = async () => '5';
  const result = await inquiry({ request: post('/api/inquiry', inquiryPayload), env });
  // A receipt with a different body cannot be reused to bypass limits.
  assert.equal(result.status, 409);
  env.INQUIRY_LIMITS.get = async key => key.startsWith('limit:') ? '5' : null;
  assert.equal((await inquiry({ request: post('/api/inquiry', inquiryPayload), env })).status, 429);
  assert.equal(fetch.mock.callCount(), 0);
});
