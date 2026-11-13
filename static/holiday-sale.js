// Shared sale banner for the homepage, art, and about pages.
const bannerContent = `
<svg class="holiday-leds" width="0" height="0" aria-hidden="true" focusable="false"><rect x="4" y="4" style="--light-offset: 0; --light-color: #ff2400"/><rect x="4" y="4" style="--light-offset: -12; --light-color: #ffff00"/><rect x="4" y="4" style="--light-offset: -24; --light-color: #00e640"/></svg>
<span class="holiday-sale-label">Holiday sale</span>
<span class="holiday-sale-offer">All paintings <strong>$475</strong> <small>or less</small></span>
`;

for (const banner of document.querySelectorAll("[data-holiday-sale]")) {
  banner.innerHTML = bannerContent;
}
