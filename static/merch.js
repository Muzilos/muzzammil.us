const grid = document.querySelector('#product-grid');
const dialog = document.querySelector('#product-dialog');
const detail = document.querySelector('#product-detail');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let products = [];
let selected;
let opener;

function scene(product, mode = 'tee', eager = false) {
  const title = escape(product.artwork);
  const crop = escape(product.image);
  if (mode === 'artwork') return `<div class="artwork-scene"><img src="${crop}" alt="Clean crop of ${title}" width="${product.cropSize[0]}" height="${product.cropSize[1]}"></div>`;
  return `<div class="tee-scene"><img class="tee-blank" src="/static/merch/tees/oversized-ecru.png" width="1122" height="1402" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}><img class="tee-stamp${product.cropSize[0] > product.cropSize[1] ? ' landscape' : ''}" src="${crop}" width="${product.cropSize[0]}" height="${product.cropSize[1]}" alt="${title} centered on an ecru oversized tee — digital concept" ${eager ? '' : 'loading="lazy"'}></div>`;
}

function openProduct(id, button) {
  selected = products.find(product => product.id === id);
  if (!selected) return;
  opener = button;
  detail.innerHTML = `<div class="detail-layout"><div id="detail-scene">${scene(selected, 'tee', true)}</div><div class="detail-copy"><p class="eyebrow">Oversized tee / ${escape(selected.edition)}</p><h2 id="product-title">${escape(selected.artwork)}</h2><p class="detail-status">In development</p><p class="detail-description">${escape(selected.description)}</p><div class="preview-switch" role="group" aria-label="Preview view"><button type="button" data-view="tee" aria-pressed="true">On the tee</button><button type="button" data-view="artwork" aria-pressed="false">Artwork crop</button></div><dl><div><dt>Fit direction</dt><dd>Boxy, oversized · dropped shoulders</dd></div><div><dt>Color concept</dt><dd>Ecru</dd></div><div><dt>Print placement</dt><dd>Centered front stamp</dd></div></dl><p class="sample-note">Digital concept. Final fabric, print, sizing, and price are pending physical samples.</p><a class="detail-link" href="/inquire/?artwork=${encodeURIComponent(selected.artwork)}">Ask about this tee <span aria-hidden="true">↗</span></a></div></div>`;
  detail.querySelector('.detail-link').href = `mailto:smm321@gmail.com?subject=${encodeURIComponent(`${selected.artwork} oversized tee inquiry`)}`;
  dialog.showModal();
}

grid.addEventListener('click', event => {
  const button = event.target.closest('[data-product]');
  if (button) openProduct(button.dataset.product, button);
});
detail.addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button || !selected) return;
  detail.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelector('#detail-scene').innerHTML = scene(selected, button.dataset.view, true);
});
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
dialog.addEventListener('close', () => opener?.focus());

try {
  const response = await fetch('/static/merch.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Collection unavailable');
  const catalog = await response.json();
  products = catalog.products;
  grid.innerHTML = products.map((product, index) => `<article class="product-card"><button type="button" data-product="${escape(product.id)}" aria-label="Preview ${escape(product.artwork)} oversized tee"><div class="product-visual">${scene(product, 'tee', index < 3)}<span class="preview-label">Digital concept</span><span class="preview-arrow" aria-hidden="true">↗</span></div><p class="product-kind">Oversized tee <span>${escape(product.edition)}</span></p><h3>${escape(product.artwork)}</h3><p class="product-note">Ecru / Front artwork stamp</p></button></article>`).join('') || '<p>The collection is in development.</p>';
} catch {
  grid.innerHTML = '<p role="alert">The collection couldn’t load. Please refresh, or <a href="/inquire/">get in touch</a>.</p>';
}
