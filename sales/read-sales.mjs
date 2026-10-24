// Read-only Stripe audit. No charges, messages, catalog edits, or website writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env'));
if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe key unavailable');
async function get(resource) {
  const response = await fetch(`https://api.stripe.com/v1/${resource}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`Stripe GET failed (${response.status})`);
  return response.json();
}
async function list(resource) {
  const records = [];
  let after;
  for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
    const page = await get(`${resource}?limit=100${after ? `&starting_after=${after}` : ''}`);
    records.push(...page.data);
    if (!page.has_more) return { records, complete: true };
    after = page.data.at(-1)?.id;
  }
  return { records, complete: false };
}
const account = await get('account');
if (account.id !== 'acct_1TdOdAJfRoNnQ3sF' || account.email !== 'smm321@gmail.com') throw new Error('Unexpected artwork Stripe account');
const [customers, sessions, payments] = await Promise.all([list('customers'), list('checkout/sessions'), list('payment_intents')]);
const siteSessions = sessions.records.filter(s => s.metadata?.site === 'muzzammil.us');
const paid = siteSessions.filter(s => s.status === 'complete' && s.payment_status === 'paid' && s.metadata.environment === 'production');
const inquiries = customers.records.filter(c => c.metadata?.site === 'muzzammil.us' && c.metadata?.inquiry === 'true');
const art = paid.filter(s => ['original', 'print', 'merch'].includes(s.metadata.kind));
const outreachReferences = new Set(['oct2026_folio', 'oct2026_collector']);
const outreachArt = art.filter(s => outreachReferences.has(s.client_reference_id));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'static/artworks.json')));
const slugs = ['brooklyn-bridge-study', 'blue-tower-study', 'waterfront-dusk-study', 'Jacket', 'heaven', 'head-i'];
const offers = await Promise.all(slugs.map(async slug => {
  const artwork = catalog.artworks.find(a => a.slug === slug && a.listed !== false);
  if (!artwork || artwork.status !== 'available' || !artwork.purchasePaymentLinkId) throw new Error(`Original unavailable: ${slug}`);
  const link = await get(`payment_links/${artwork.purchasePaymentLinkId}?expand[]=line_items`);
  const item = link.line_items?.data?.[0];
  const valid = link.active && item?.price?.unit_amount === artwork.price && item.price.currency === 'usd' && link.restrictions?.completed_sessions?.limit === 1;
  if (!valid) throw new Error(`Original price or availability changed: ${slug}`);
  return { slug, title: artwork.title, file: artwork.file, medium: artwork.medium, size: artwork.size, year: artwork.year, amount: artwork.price, image: artwork.image, galleryUrl: `https://muzzammil.us/paintings/?artwork=${encodeURIComponent(slug)}`, purchaseUrl: link.url, paymentLinkId: link.id, verifiedAvailable: true };
}));
const summary = {
  checkedAt: new Date().toISOString(), account: account.email, chargesEnabled: account.charges_enabled,
  complete: customers.complete && sessions.complete && payments.complete,
  paidProductionWebsiteOrders: paid.length,
  paidProductionArtOrders: art.length,
  productionArtGrossUsd: art.filter(s => s.currency === 'usd').reduce((sum, s) => sum + s.amount_total, 0) / 100,
  outreachPaidArtOrders: outreachArt.length,
  outreachArtGrossUsd: outreachArt.filter(s => s.currency === 'usd').reduce((sum, s) => sum + s.amount_total, 0) / 100,
  productionInquiries: inquiries.filter(c => c.metadata.environment === 'production').length,
  stagingInquiries: inquiries.filter(c => c.metadata.environment === 'staging').length,
  accountSucceededPayments: payments.records.filter(p => p.status === 'succeeded').length,
  unpaidWebsiteCheckouts: siteSessions.filter(s => s.payment_status !== 'paid').length,
  verifiedAvailableOriginals: offers.length
};
const privateDir = path.join(root, 'sales/private');
fs.mkdirSync(privateDir, { recursive: true });
const records = {
  summary, offers,
  inquiries: inquiries.map(c => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, description: c.description, metadata: c.metadata })),
  paidOrders: paid.map(s => ({ id: s.id, created: s.created, amount: s.amount_total, currency: s.currency, metadata: s.metadata, paymentIntent: s.payment_intent, customer: s.customer, clientReferenceId: s.client_reference_id, paymentLink: s.payment_link })),
  sessionIdsObserved: siteSessions.map(s => ({ id: s.id, status: s.status, paid: s.payment_status, metadata: s.metadata, clientReferenceId: s.client_reference_id, paymentLink: s.payment_link }))
};
fs.writeFileSync(path.join(privateDir, 'sales-audit.json'), JSON.stringify(records, null, 2) + '\n', { mode: 0o600 });
fs.writeFileSync(path.join(root, 'sales/verified-offers.json'), JSON.stringify({ checkedAt: summary.checkedAt, offers }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
