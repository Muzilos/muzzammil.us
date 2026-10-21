// Close unpaid merchandise checkout tabs after withdrawing the shop.
// Existing standalone print links, originals, bookings, and paid orders are untouched.
import fs from 'node:fs';
process.loadEnvFile('.env');
const apply = process.argv.includes('--apply');
async function stripe(resource, data) {
  const headers = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` };
  if (data) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  const response = await fetch(`https://api.stripe.com/v1/${resource}`, {
    method: data ? 'POST' : 'GET', headers,
    body: data ? new URLSearchParams(data) : undefined,
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error(`Stripe request failed (${response.status})`);
  return response.json();
}
const account = await stripe('account');
if (account.id !== 'acct_1TdOdAJfRoNnQ3sF' || account.email !== 'smm321@gmail.com') throw new Error('Unexpected artwork account');
const candidates = [];
let after;
do {
  const page = await stripe(`checkout/sessions?status=open&limit=100${after ? `&starting_after=${after}` : ''}`);
  candidates.push(...page.data.filter(s => s.metadata?.site === 'muzzammil.us' && s.metadata?.kind === 'merch'));
  after = page.has_more ? page.data.at(-1).id : null;
} while (after);
const results = [];
for (const candidate of candidates) {
  const session = await stripe(`checkout/sessions/${candidate.id}`);
  if (session.metadata?.site !== 'muzzammil.us' || session.metadata?.kind !== 'merch') throw new Error('Session ownership changed');
  if (session.status !== 'open' || session.payment_status === 'paid') {
    results.push({ id: session.id, status: session.status, action: 'unchanged' });
    continue;
  }
  const result = apply ? await stripe(`checkout/sessions/${session.id}/expire`, {}) : session;
  if (apply && result.status !== 'expired') throw new Error('Checkout did not expire');
  results.push({ id: result.id, status: result.status, action: apply ? 'expired' : 'would_expire', environment: session.metadata.environment });
}
const report = { checkedAt: new Date().toISOString(), applied: apply, account: account.email, candidates: candidates.length, results, chargesMade: 0 };
if (apply) fs.writeFileSync('production/withdrawn-merch-20261020/stripe-withdrawal.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
