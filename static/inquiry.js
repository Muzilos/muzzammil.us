import { contactErrors } from './inquiry-contact.js?v=20261020-contact-choice';

(async function () {
  'use strict';
  const form = document.getElementById('inquiry-form');
  const status = document.getElementById('inquiry-status');
  const reference = crypto.randomUUID();
  const email = form.elements.email;
  const phone = form.elements.phone;
  function validateContact() {
    const errors = contactErrors(email.value.trim(), phone.value.trim());
    email.setCustomValidity(errors.email);
    phone.setCustomValidity(errors.phone);
  }
  for (const input of [email, phone]) {
    input.addEventListener('input', validateContact);
    input.addEventListener('change', validateContact);
  }
  const selected = new URLSearchParams(location.search).get('artwork');
  let artwork;
  if (selected) {
    form.querySelector('button').disabled = true;
    try {
      const response = await fetch('/static/artworks.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error();
      const catalog = await response.json();
      artwork = catalog.artworks.find(a => a.listed !== false && (a.file === selected || a.slug === selected));
      if (!artwork) throw new Error();
      const title = document.getElementById('inquiry-artwork');
      title.textContent = artwork.title;
      title.hidden = false;
    } catch {
      status.textContent = 'Artwork could not be loaded. You can include its name in your message.';
    }
    form.querySelector('button').disabled = false;
  }
  let sending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    validateContact();
    if (!form.reportValidity()) return;
    sending = true;
    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Sending…';
    status.textContent = '';
    try {
      const values = Object.fromEntries(new FormData(form));
      const response = await fetch('/api/inquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, reference, ...(artwork ? { artwork: artwork.file } : {}) })
      });
      const result = await response.json();
      if (!response.ok || !result.received) throw new Error(result.error || 'Please try again.');
      form.hidden = true;
      status.textContent = 'Thank you. Your inquiry has been received.';
    } catch (error) {
      status.textContent = error.message || 'Please try again, or email smm321@gmail.com.';
      button.disabled = false;
      button.textContent = 'Send inquiry';
      sending = false;
    }
  });
})();
