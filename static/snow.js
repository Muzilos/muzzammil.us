(function () {
  'use strict';

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'holiday-snow';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:900;';
  const context = canvas.getContext('2d');
  if (!context) return;
  document.body.appendChild(canvas);

  let width = 0;
  let height = 0;
  let flakes = [];
  let animation = 0;
  let lastFrame = 0;
  let activePage = true;

  const storageKey = 'holiday-snow-drift-v1';
  const bins = 96;
  const maxDepth = 40;
  let settled = readDrift();
  let pending = Array(bins).fill(0);
  let saving = false;

  function readDrift() {
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey));
      if (value && value.version === 1 && Array.isArray(value.depths) && value.depths.length === bins) {
        return value.depths.map(depth => Number.isFinite(depth) ? Math.max(0, Math.min(maxDepth, depth)) : 0);
      }
    } catch (_) { /* Storage may be unavailable or contain invalid data. */ }
    return Array(bins).fill(0);
  }

  function persist() {
    if (saving || !pending.some(depth => depth > 0)) return;
    const save = () => {
      const latest = readDrift();
      const next = latest.map((depth, index) => Math.min(maxDepth, Math.max(depth, settled[index]) + pending[index]));
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, depths: next }));
      } catch (_) { /* Keep the drift in memory when storage is blocked or full. */ }
      settled = next;
      pending.fill(0);
    };
    // Serialize deposits from different tabs so their snow is added, never overwritten.
    if (window.navigator.locks) {
      saving = true;
      window.navigator.locks.request(storageKey, save).catch(() => save()).finally(() => {
        saving = false;
        persist();
      });
    } else {
      save();
    }
  }

  function depthAt(index) {
    return Math.min(maxDepth, settled[index] + pending[index]);
  }

  function deposit(snow, index) {
    // Spread each landing into a small mound, with a stable scale on all screen sizes.
    const amount = snow.size * snow.size * (snow.star ? 5 : 1) / 12.5;
    for (let offset = -2; offset <= 2; offset++) {
      const target = Math.max(0, Math.min(bins - 1, index + offset));
      pending[target] += amount * (3 - Math.abs(offset)) / 9;
    }
    persist();
  }

  function drawDrift() {
    context.fillStyle = '#fff';
    context.globalAlpha = 0.85;
    const binWidth = width / bins;
    for (let index = 0; index < bins; index++) {
      const depth = Math.min(depthAt(index), height * 0.08);
      if (depth > 0) context.fillRect(Math.floor(index * binWidth), height - depth, Math.ceil(binWidth) + 1, depth);
    }
    context.globalAlpha = 1;
  }

  function renderStill() {
    context.clearRect(0, 0, width, height);
    drawDrift();
  }

  function flake(scattered = true) {
    return {
      x: Math.random() * width,
      y: scattered ? Math.random() * height : -12,
      size: Math.random() < 0.6 ? 2 : 1,
      speed: 16 + Math.random() * 22,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.2 + Math.random() * 0.35,
      star: Math.random() < 0.3
    };
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    renderStill();
    flakes = Array.from({ length: Math.min(48, Math.max(16, Math.round(width / 30))) }, () => flake());
  }

  function draw(time) {
    animation = requestAnimationFrame(draw);
    if (lastFrame && time - lastFrame < 1000 / 30) return;
    const seconds = lastFrame ? Math.min((time - lastFrame) / 1000, 0.1) : 0;
    lastFrame = time;
    renderStill();
    context.fillStyle = '#fff';
    for (const snow of flakes) {
      snow.y += snow.speed * seconds;
      snow.x += Math.sin(time / 2200 + snow.phase) * 6 * seconds;
      const index = Math.max(0, Math.min(bins - 1, Math.floor(snow.x / width * bins)));
      if (snow.y + snow.size >= height - Math.min(depthAt(index), height * 0.08)) {
        deposit(snow, index);
        Object.assign(snow, flake(false));
      }
      if (snow.x < -12) snow.x = width + 12;
      if (snow.x > width + 12) snow.x = -12;
      const x = Math.round(snow.x);
      const y = Math.round(snow.y);
      const size = snow.size;
      context.globalAlpha = snow.opacity;
      context.fillRect(x, y, size, size);
      if (snow.star) {
        context.fillRect(x - size, y, size * 3, size);
        context.fillRect(x, y - size, size, size * 3);
      }
    }
  }

  function updateMotion() {
    cancelAnimationFrame(animation);
    animation = 0;
    lastFrame = 0;
    renderStill();
    if (document.hidden || !activePage) persist();
    if (!motion.matches && !document.hidden && activePage) animation = requestAnimationFrame(draw);
  }

  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    settled = readDrift();
    renderStill();
  });
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', updateMotion);
  motion.addEventListener('change', updateMotion);
  window.addEventListener('pagehide', () => { activePage = false; updateMotion(); });
  window.addEventListener('pageshow', () => { settled = readDrift(); activePage = true; updateMotion(); });
  resize();
  updateMotion();
})();
