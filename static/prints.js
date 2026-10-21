(async function () {
  'use strict';
  const status = document.getElementById('print-status');
  try {
    const reference = new URLSearchParams(location.search).get('artwork');
    const response = await fetch('/static/artworks.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error();
    const catalog = await response.json();
    const artwork = catalog.artworks.find(a => a.listed !== false && a.file === reference);
    if (!artwork?.printOptions?.length) throw new Error();
    document.getElementById('print-title').textContent = `${artwork.title} — print`;
    document.title = `${artwork.title} — print — Muzzammil Mehdi`;
    const image = document.getElementById('print-image');
    image.src = artwork.thumbnail || `/paintings/-compressed/optimized/thumb_${artwork.file}.webp`;
    image.alt = artwork.title;
    const select = document.getElementById('print-size');
    const buy = document.getElementById('print-buy');
    const choices = artwork.printOptions.filter(option => {
      try {
        const url = new URL(option.paymentLink);
        return url.protocol === 'https:' && url.hostname === 'buy.stripe.com' && !url.username && !url.password && Number.isInteger(option.amount) && option.amount > 0;
      } catch { return false; }
    });
    if (!choices.length) throw new Error();
    for (const [index, option] of choices.entries()) {
      const element = document.createElement('option');
      element.value = String(index);
      element.textContent = option.size;
      select.append(element);
    }
    function update() {
      const choice = choices[Number(select.value)];
      document.getElementById('print-price').textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: catalog.currency, maximumFractionDigits: 0 }).format(choice.amount / 100);
      buy.href = choice.paymentLink;
      buy.setAttribute('aria-label', `Buy ${choice.size.toLowerCase()} print of ${artwork.title}`);
    }
    select.addEventListener('change', update);
    update();
    document.getElementById('print-order').hidden = false;
    status.textContent = '';
  } catch {
    status.textContent = 'Print not found. Please choose a piece from the paintings page.';
  }
})();
