import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const catalog = () => JSON.parse(fs.readFileSync(new URL('../static/artworks.json', import.meta.url), 'utf8'));
const script = name => fs.readFileSync(new URL(`../static/${name}`, import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');

test('legacy print inquiry links redirect to the size selector before loading the form', async () => {
  let destination;
  await vm.runInNewContext(script('inquiry.js'), {
    URLSearchParams,
    location: {
      search: '?artwork=imported%2Fgod-her-warm-light.jpg&offer=print',
      replace(url) { destination = url; }
    }
  });
  assert.equal(destination, '/prints/?artwork=imported%2Fgod-her-warm-light.jpg');
});

test('every listed artwork offers the standard print sizes with Stripe checkout links', () => {
  for (const artwork of catalog().artworks.filter(artwork => artwork.listed !== false)) {
    assert.deepEqual(artwork.printOptions.map(option => [option.size, option.amount]),
      [['Small', 3000], ['Medium', 5000], ['Large', 7500]], artwork.file);
    for (const option of artwork.printOptions) {
      const url = new URL(option.paymentLink);
      assert.equal(url.origin, 'https://buy.stripe.com', artwork.file);
      assert.ok(option.priceId && option.paymentLinkId, artwork.file);
    }
  }
});

test('the reported artwork loads its print sizes and updates the checkout when the size changes', async () => {
  for (const reference of ['imported/god-her-warm-light.jpg', 'god-her-warm-light']) {
    const elements = new Map();
    const get = id => {
      if (!elements.has(id)) elements.set(id, {
        hidden: true, value: '0', options: [], listeners: {},
        append(option) { this.options.push(option); },
        addEventListener(event, callback) { this.listeners[event] = callback; },
        setAttribute(name, value) { this[name] = value; }
      });
      return elements.get(id);
    };
    await vm.runInNewContext(script('prints.js'), {
      URL, URLSearchParams, Intl,
      location: { search: `?artwork=${encodeURIComponent(reference)}` },
      document: { getElementById: get, createElement: () => ({}) },
      fetch: async () => ({ ok: true, json: async () => catalog() }),
      presentArtworkImage() {}
    });
    const artwork = catalog().artworks[0];
    assert.equal(get('print-order').hidden, false);
    assert.equal(get('print-title').textContent, `${artwork.title} — print`);
    assert.deepEqual(get('print-size').options.map(option => option.textContent), ['Small', 'Medium', 'Large']);
    assert.equal(get('print-buy').href, artwork.printOptions[0].paymentLink);
    get('print-size').value = '2';
    get('print-size').listeners.change();
    assert.equal(get('print-price').textContent, '$75');
    assert.equal(get('print-buy').href, artwork.printOptions[2].paymentLink);
  }
});
