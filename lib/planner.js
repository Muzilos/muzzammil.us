import { SHIPPING_COUNTRIES } from '../static/planner-order.js';

export function plannerPaymentLinkData(price) {
  if (!price.active || price.type !== 'one_time' || price.currency !== 'usd' || price.unit_amount !== 2400 || price.tax_behavior !== 'inclusive') {
    throw new Error('Expected the approved $24 tax-inclusive one-time price.');
  }
  const data = {
    'line_items[0][price]': price.id, 'line_items[0][quantity]': '1',
    customer_creation: 'always', submit_type: 'pay',
    'automatic_tax[enabled]': 'true',
    'after_completion[type]': 'redirect',
    'after_completion[redirect][url]': 'https://muzzammil.us/success.html?session_id={CHECKOUT_SESSION_ID}',
    'custom_text[shipping_address][message]': 'Worldwide shipping is included in the $24 USD total.',
    'custom_text[submit][message]': 'Reserve your 2027 pocket planner. $24 USD total, including taxes, shipping, and all fees. You will be notified when your preorder is ready to ship.'
  };
  for (const [index, country] of SHIPPING_COUNTRIES.entries()) data[`shipping_address_collection[allowed_countries][${index}]`] = country;
  const metadata = {
    site: 'muzzammil.us', environment: 'production', kind: 'planner',
    preorder: 'true', reference: 'muzz_planner_2027_landforms_2400_usd_inclusive',
    quantity: '1', fulfillment: 'manual', pricing: 'all_inclusive'
  };
  for (const [key, value] of Object.entries(metadata)) {
    data[`metadata[${key}]`] = value;
    data[`payment_intent_data[metadata][${key}]`] = value;
  }
  return data;
}
