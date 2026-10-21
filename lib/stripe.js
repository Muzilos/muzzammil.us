export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'
  } });
}

export async function stripe(env, path, data, idempotencyKey) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured');
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  if (data) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: data ? 'POST' : 'GET', headers,
    body: data ? new URLSearchParams(data) : undefined,
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Stripe request failed (${response.status})`);
  return result;
}

export async function readJson(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new Error('Invalid origin');
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Error('JSON required');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 12000) { await reader.cancel(); throw new Error('Body too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const result = JSON.parse(new TextDecoder().decode(bytes));
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid body');
  return result;
}

export async function catalogFor(request, env) {
  const response = await env.ASSETS.fetch(new URL('/static/artworks.json', request.url));
  if (!response.ok) throw new Error('Catalog unavailable');
  return response.json();
}
