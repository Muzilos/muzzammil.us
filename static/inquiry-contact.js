export function contactErrors(email, phone) {
  const errors = { email: '', phone: '' };
  if (!email && !phone) errors.email = 'Enter an email or phone number.';
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    errors.email = 'Enter a valid email address.';
  }
  if (phone) {
    const number = phone.split(/\s*(?:ext\.?|x|#)\s*/i)[0];
    const digits = number.replace(/\D/g, '');
    const format = /^\+?[\d\s().-]+(?:\s*(?:ext\.?|x|#)\s*\d{1,8})?$/i;
    if (phone.length > 40 || digits.length < 7 || digits.length > 15 || !format.test(phone)) {
      errors.phone = 'Enter a valid phone number.';
    }
  }
  return errors;
}
