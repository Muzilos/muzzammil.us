(function () {
  'use strict';
  const title = document.getElementById('payment-title');
  const summary = document.getElementById('payment-summary');
  const followup = document.getElementById('payment-followup');
  const retry = document.getElementById('payment-retry');
  const session = new URLSearchParams(location.search).get('session_id');
  async function check() {
    retry.hidden = true;
    followup.hidden = true;
    title.textContent = 'Checking payment…';
    summary.textContent = '';
    if (!session) {
      title.textContent = 'Payment status';
      summary.textContent = 'No payment reference was provided.';
      return;
    }
    try {
      const response = await fetch(`/api/payment?session_id=${encodeURIComponent(session)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Payment could not be checked.');
      if (!result.paid) {
        title.textContent = result.status === 'expired' ? 'Checkout expired' : 'Payment not confirmed';
        summary.textContent = result.status === 'complete' ? 'Your payment is processing. Please check again shortly.' : 'This checkout has not been paid.';
        retry.hidden = result.status === 'expired';
        return;
      }
      title.textContent = 'Payment received';
      if (result.kind === 'merch') {
        try {
          const { acknowledgePurchase } = await import('./merch-cart.js');
          acknowledgePurchase(localStorage, result.reference);
        } catch { /* The receipt remains available when browser storage is blocked. */ }
      }
      const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: result.currency }).format(result.amount / 100);
      summary.textContent = `${result.items.map(item => `${item.name}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`).join(', ')} — ${amount}`;
      const email = new URL('mailto:smm321@gmail.com');
      email.searchParams.set('subject', result.kind === 'hours' ? `${result.hours}-hour pack` : 'My art order');
      email.searchParams.set('body', `Hi Muzzammil,\n\n${result.kind === 'hours' ? 'I bought an hourly pack. My availability is:' : 'I have a question about my order:'}\n\n\nOrder reference: ${session}`);
      followup.href = email.href;
      followup.textContent = result.kind === 'hours' ? 'Arrange a time' : 'Contact me';
      followup.hidden = false;
    } catch (error) {
      title.textContent = 'Payment status';
      summary.textContent = error.message || 'Payment could not be checked.';
      retry.hidden = false;
    }
  }
  retry.addEventListener('click', check);
  check();
})();
