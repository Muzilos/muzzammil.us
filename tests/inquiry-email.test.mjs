import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/inquiry-email/index.js';

const data = {
  name: 'Visitor', email: 'visitor@example.com', message: 'What is the price of Covenant?',
  reference: 'a68dd342-e58e-4be2-80ce-1ebcb03cfc22', fingerprint: 'a'.repeat(64),
  customerId: 'cus_example123', environment: 'production',
  artworkTitle: 'Covenant', artworkSlug: 'covenant', to: 'unwanted@example.com'
};
const request = payload => new Request('https://inquiry-email.internal/', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
});
function environment(send) {
  const store = new Map();
  return {
    NOTIFICATIONS: { send },
    DELIVERY_RECEIPTS: { get: async key => JSON.parse(store.get(key) || 'null'), put: async (key, value) => { store.set(key, value); } }
  };
}

test('notifications go only to the owner and Reply-To is the visitor', async () => {
  let sent = 0;
  const env = environment(async email => {
    sent++;
    assert.equal(email.to, 'smm321@gmail.com');
    assert.equal(email.from.email, 'inquiries@notify.muzzammil.us');
    assert.equal(email.replyTo, data.email);
    assert.equal(email.subject, 'New inquiry — Covenant');
    assert.match(email.text, /What is the price of Covenant\?/);
    assert.match(email.text, /artwork=covenant/);
    assert.match(email.text, /customers\/cus_example123/);
    return { messageId: 'email_123' };
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.deepEqual(await (await worker.fetch(request(data), env)).json(), { sent: true, messageId: 'email_123' });
  }
  assert.equal(sent, 1);
});

test('staging notifications are labeled and references cannot change content', async () => {
  const env = environment(async email => {
    assert.equal(email.subject, '[Staging] New inquiry — Covenant');
    return { messageId: 'email_staging' };
  });
  const staging = { ...data, environment: 'staging' };
  assert.equal((await worker.fetch(request(staging), env)).status, 200);
  assert.equal((await worker.fetch(request({ ...staging, fingerprint: 'b'.repeat(64) }), env)).status, 409);
});

test('invalid visitor emails cannot reach the email provider', async () => {
  const env = environment(async () => { throw new Error('Unexpected email'); });
  assert.equal((await worker.fetch(request({ ...data, email: 'bad\r\nBcc: unwanted@example.com' }), env)).status, 400);
});

test('phone-only notifications include the phone without an empty Reply-To', async () => {
  const phone = '+1 (202) 555-0119 ext. 42';
  const env = environment(async email => {
    assert.equal(email.to, 'smm321@gmail.com');
    assert.equal(Object.hasOwn(email, 'replyTo'), false);
    assert.ok(email.text.includes(`Phone: ${phone}`));
    assert.equal(email.text.includes('Email:'), false);
    return { messageId: 'email_phone' };
  });
  const result = await worker.fetch(request({ ...data, email: '', phone }), env);
  assert.deepEqual(await result.json(), { sent: true, messageId: 'email_phone' });
});

test('combined contacts include the phone and keep the visitor email as Reply-To', async () => {
  const env = environment(async email => {
    assert.equal(email.replyTo, data.email);
    assert.match(email.text, /Phone: \+1 202 555 0119/);
    assert.match(email.text, /Email: visitor@example.com/);
    return { messageId: 'email_both' };
  });
  assert.equal((await worker.fetch(request({ ...data, phone: '+1 202 555 0119' }), env)).status, 200);
});

test('notifications require at least one valid contact method', async () => {
  const env = environment(async () => { throw new Error('Unexpected email'); });
  for (const contact of [{ email: '', phone: '' }, { email: '', phone: 'abc' }]) {
    assert.equal((await worker.fetch(request({ ...data, ...contact }), env)).status, 400);
  }
});
