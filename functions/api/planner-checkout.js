import { json } from '../../lib/stripe.js';

// The direct Payment Link replaces the checkout that added tax and postage.
export function onRequestPost() {
  return json({ error: 'Please use the Stripe preorder link on the merch page.' }, 410);
}

export const onRequest = onRequestPost;
