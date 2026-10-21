export const CART_KEY = 'muzzammil-merch-cart-v1';
export const PENDING_KEY = 'muzzammil-merch-checkout-v1';
export const MAX_PER_VARIANT = 10;
export const MAX_CART_QUANTITY = 25;

export function validateItems(input, products, { allowUnavailable = false } = {}) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 25) throw new Error('Add an item to your bag.');
  const quantities = new Map();
  for (const item of input) {
    if (!item || typeof item.sku !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_PER_VARIANT) throw new Error('Choose a quantity between 1 and 10.');
    const product = products.find(p => p.variants.some(v => v.sku === item.sku));
    const variant = product?.variants.find(v => v.sku === item.sku);
    if (!variant || (!allowUnavailable && (!product.available || !variant.available))) throw new Error('An item in your bag is no longer available.');
    const quantity = (quantities.get(item.sku) || 0) + item.quantity;
    if (quantity > MAX_PER_VARIANT) throw new Error('The limit is 10 of each option.');
    quantities.set(item.sku, quantity);
  }
  if ([...quantities.values()].reduce((sum, q) => sum + q, 0) > MAX_CART_QUANTITY) throw new Error('The limit is 25 items per order.');
  return [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([sku, quantity]) => ({ sku, quantity }));
}

export function restoreCart(storage, products) {
  try {
    const saved = JSON.parse(storage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    const known = saved.filter(item => products.some(p => p.available && p.variants.some(v => v.sku === item?.sku && v.available)));
    return known.length ? validateItems(known, products) : [];
  } catch { return []; }
}

// Remove only the items paid for in this checkout, preserving later additions.
export function acknowledgePurchase(storage, reference) {
  if (!reference) return;
  try {
    const pending = JSON.parse(storage.getItem(PENDING_KEY) || 'null');
    if (pending?.reference !== reference || !Array.isArray(pending.items)) return;
    const saved = JSON.parse(storage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(saved)) return;
    const purchased = new Map(pending.items.map(i => [i.sku, i.quantity]));
    const remaining = saved.map(i => ({ sku: i.sku, quantity: i.quantity - (purchased.get(i.sku) || 0) })).filter(i => Number.isInteger(i.quantity) && i.quantity > 0);
    storage.setItem(CART_KEY, JSON.stringify(remaining));
    storage.removeItem(PENDING_KEY);
  } catch { /* Payment confirmation must work when browser storage is blocked. */ }
}
