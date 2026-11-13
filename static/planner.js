const reader = document.getElementById('planner-preview');
const status = document.getElementById('preview-status');
const stage = document.getElementById('preview-stage');
const canvas = document.getElementById('preview-canvas');
const cover = document.getElementById('preview-cover');
const previous = document.getElementById('preview-previous');
const next = document.getElementById('preview-next');
const counter = document.getElementById('preview-page');
const retry = document.getElementById('preview-retry');
let pdfUrl, documentPromise, pageNumber = 0, busy = false, totalPages = 0;
let resizePending = false;

async function loadDocument() {
  if (!documentPromise) {
    documentPromise = (async () => {
      const pdfjs = await import('/static/vendor/pdfjs/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/static/vendor/pdfjs/pdf.worker.min.mjs';
      return pdfjs.getDocument({
        url: pdfUrl, isEvalSupported: false,
        standardFontDataUrl: '/static/vendor/pdfjs/standard_fonts/',
        cMapUrl: '/static/vendor/pdfjs/cmaps/', cMapPacked: true,
        wasmUrl: '/static/vendor/pdfjs/wasm/'
      }).promise;
    })().catch(error => { documentPromise = undefined; throw error; });
  }
  return documentPromise;
}

function copyCanvas(source, destination) {
  destination.width = source.width;
  destination.height = source.height;
  destination.getContext('2d').drawImage(source, 0, 0);
}

async function turnPage(buffer, forward) {
  const sheet = document.createElement('div');
  sheet.className = 'page-turn-sheet';
  sheet.setAttribute('aria-hidden', 'true');
  const front = document.createElement('canvas');
  front.className = 'page-turn-front';
  copyCanvas(forward ? canvas : buffer, front);
  const back = document.createElement('div');
  back.className = 'page-turn-back';
  const shade = document.createElement('div');
  shade.className = 'page-turn-shade';
  sheet.append(front, back, shade);
  // On a forward turn the next page waits underneath the turning sheet.
  // On a backward turn the previous page folds back over the current page.
  if (forward) copyCanvas(buffer, canvas);
  stage.append(sheet);
  try {
    await sheet.animate([
      { transform: `rotateY(${forward ? 0 : -180}deg)`, filter: 'brightness(1)' },
      { transform: 'rotateY(-90deg)', filter: 'brightness(.82)', offset: .5 },
      { transform: `rotateY(${forward ? -180 : 0}deg)`, filter: 'brightness(1)' }
    ], { duration: 650, easing: 'ease-in-out', fill: 'forwards' }).finished;
    copyCanvas(buffer, canvas);
  } finally {
    sheet.remove();
  }
}

async function renderPage(number, animate = false) {
  if (busy) return;
  busy = true;
  stage.setAttribute('aria-busy', 'true');
  previous.disabled = next.disabled = true;
  retry.hidden = true;
  status.textContent = pageNumber ? '' : 'Loading pages…';
  try {
    const pdfDocument = await loadDocument();
    totalPages = pdfDocument.numPages;
    number = Math.max(1, Math.min(number, totalPages));
    const label = number === 1 ? 'Front cover' : number === totalPages ? 'Back cover' : `Page ${number - 1}`;
    const page = await pdfDocument.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(stage.clientWidth * ratio));
    const height = Math.max(1, Math.round(stage.clientHeight * ratio));
    const scale = Math.min(width / viewport.width, height / viewport.height);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.ceil(viewport.width * scale);
    pageCanvas.height = Math.ceil(viewport.height * scale);
    // Fit each complete PDF page in the frame, retaining all margins.
    const rendered = page.getViewport({ scale });
    await page.render({ canvasContext: pageCanvas.getContext('2d'), viewport: rendered }).promise;
    const buffer = document.createElement('canvas');
    buffer.width = width;
    buffer.height = height;
    const context = buffer.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(pageCanvas, Math.round((width - pageCanvas.width) / 2), Math.round((height - pageCanvas.height) / 2));
    const motion = animate && pageNumber && number !== pageNumber && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (motion) await turnPage(buffer, number > pageNumber);
    else copyCanvas(buffer, canvas);
    canvas.hidden = false;
    cover.hidden = true;
    canvas.setAttribute('aria-label', `${label}, ${number} of ${totalPages}.`);
    stage.dataset.page = String(number);
    pageNumber = number;
    counter.textContent = `${number} / ${totalPages}`;
    status.textContent = '';
  } catch {
    status.textContent = 'The page could not be loaded. Please try again.';
    retry.hidden = false;
  } finally {
    busy = false;
    stage.setAttribute('aria-busy', 'false');
    previous.disabled = !pageNumber || pageNumber <= 1;
    next.disabled = !pageNumber || pageNumber >= totalPages;
    if (resizePending) { resizePending = false; renderPage(pageNumber || 1); }
  }
}

retry.addEventListener('click', () => renderPage(pageNumber || 1));
previous.addEventListener('click', () => renderPage(pageNumber - 1, true));
next.addEventListener('click', () => renderPage(pageNumber + 1, true));
reader.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' && !previous.disabled) { event.preventDefault(); previous.click(); }
  if (event.key === 'ArrowRight' && !next.disabled) { event.preventDefault(); next.click(); }
});
let touchStart, suppressClickUntil = 0;
stage.addEventListener('click', event => {
  if (busy || Date.now() < suppressClickUntil) return;
  const bounds = stage.getBoundingClientRect();
  if (event.clientX < bounds.left + bounds.width / 2) { if (!previous.disabled) previous.click(); }
  else if (!next.disabled) next.click();
});
stage.addEventListener('touchstart', event => {
  touchStart = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
}, { passive: true });
stage.addEventListener('touchend', event => {
  if (!touchStart) return;
  const x = event.changedTouches[0].clientX - touchStart.x;
  const y = event.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(x) > 50 && Math.abs(x) > Math.abs(y) * 1.5) {
    suppressClickUntil = Date.now() + 500;
    if (x < 0 && !next.disabled) next.click();
    if (x > 0 && !previous.disabled) previous.click();
  }
  touchStart = undefined;
}, { passive: true });
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!pdfUrl || !pageNumber) return;
    if (busy) resizePending = true;
    else renderPage(pageNumber);
  }, 150);
});

try {
  const response = await fetch('/static/planner.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Planner unavailable');
  const planner = await response.json();
  if (planner.previewPdf) {
    const url = new URL(planner.previewPdf, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/static/planner/') || !url.pathname.endsWith('.pdf')) throw new Error('Invalid preview');
    pdfUrl = url.href;
    renderPage(1);
  } else {
    status.textContent = 'The preview is temporarily unavailable. Please try again later.';
  }
} catch {
  document.getElementById('planner-load-status').textContent = 'The preview is temporarily unavailable. You can still reserve your preorder with Stripe.';
  status.textContent = 'The preview is temporarily unavailable. Please try again later.';
}
