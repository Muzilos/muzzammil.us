import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../static/snow.js', import.meta.url), 'utf8');
const key = 'holiday-snow-drift-v1';

function browser(storage = new Map(), { reduced = false, blocked = false, locks } = {}) {
  const listeners = {};
  const rectangles = [];
  const callbacks = new Map();
  let frameId = 0;
  const context = {
    setTransform() {}, clearRect() { rectangles.length = 0; },
    fillRect(...rectangle) { rectangles.push(rectangle); }
  };
  const canvas = { style: {}, setAttribute() {}, getContext: () => context };
  const listen = (name, callback) => { listeners[name] = callback; };
  const document = { hidden: false, body: { appendChild() {} }, createElement: () => canvas, addEventListener: listen };
  const window = {
    innerWidth: 960, innerHeight: 600, devicePixelRatio: 1, navigator: { locks },
    matchMedia: () => ({ matches: reduced, addEventListener: listen }),
    addEventListener: listen,
    localStorage: {
      getItem(name) { if (blocked) throw new Error('blocked'); return storage.get(name) ?? null; },
      setItem(name, value) { if (blocked) throw new Error('blocked'); storage.set(name, value); }
    }
  };
  vm.runInNewContext(source, {
    window, document, Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
    requestAnimationFrame(callback) { callbacks.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { callbacks.delete(id); }
  });
  return {
    window, document, listeners, rectangles, callbacks,
    run() {
      for (let time = 1; time <= 40001; time += 40) {
        const current = [...callbacks.values()];
        callbacks.clear();
        current.forEach(callback => callback(time));
      }
    }
  };
}

const depths = storage => JSON.parse(storage.get(key)).depths;
const total = storage => depths(storage).reduce((sum, depth) => sum + depth, 0);

test('flakes accumulate, persist between sessions, and stay bounded', () => {
  const storage = new Map();
  browser(storage).run();
  assert.ok(total(storage) > 0);
  assert.ok(depths(storage).every(depth => depth >= 0 && depth <= 40));
  const next = browser(storage, { reduced: true });
  assert.ok(next.rectangles.length > 0);
  assert.equal(next.callbacks.size, 0);
  const before = total(storage);
  browser(storage).run();
  assert.ok(total(storage) > before);
});

test('existing tabs redraw saved snow, including in reduced-motion mode', () => {
  const storage = new Map();
  const other = browser(storage, { reduced: true });
  assert.equal(other.rectangles.length, 0);
  browser(storage).run();
  other.listeners.storage({ key });
  assert.ok(other.rectangles.length > 0);
  const depth = other.rectangles[0][3];
  other.window.innerWidth = 400;
  other.listeners.resize();
  assert.equal(other.rectangles[0][3], depth);
});

test('concurrent tabs serialize deposits without losing either contribution', async () => {
  const storage = new Map();
  let queue = Promise.resolve();
  const locks = { request(name, callback) { queue = queue.then(callback); return queue; } };
  const first = browser(storage, { locks });
  const second = browser(storage, { locks });
  first.run();
  second.run();
  await new Promise(resolve => setImmediate(resolve));
  const separate = new Map();
  browser(separate).run();
  assert.ok(Math.abs(total(storage) - 2 * total(separate)) < 0.00001);
});

test('corrupt or unavailable storage does not interrupt snowfall', () => {
  const storage = new Map([[key, '{invalid']]);
  browser(storage).run();
  assert.ok(total(storage) > 0);
  const blocked = browser(new Map(), { blocked: true });
  assert.doesNotThrow(() => blocked.run());
  assert.ok(blocked.rectangles.some(rectangle => rectangle[1] > 590));
});

test('hidden pages pause and restored pages resume snowfall', () => {
  const page = browser();
  assert.equal(page.callbacks.size, 1);
  page.document.hidden = true;
  page.listeners.visibilitychange();
  assert.equal(page.callbacks.size, 0);
  page.document.hidden = false;
  page.listeners.visibilitychange();
  assert.equal(page.callbacks.size, 1);
  page.listeners.pagehide();
  assert.equal(page.callbacks.size, 0);
  page.listeners.pageshow();
  assert.equal(page.callbacks.size, 1);
});
