import { json } from '../../lib/stripe.js';

// Keep the retired endpoint closed, including for carts in already-open tabs.
export function onRequest() {
  return json({ error: 'Merchandise is currently unavailable.' }, 410);
}

export const onRequestPost = onRequest;
