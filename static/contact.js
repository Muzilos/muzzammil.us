(function () {
  "use strict";

  const link = document.getElementById("contact-link");
  const params = new URLSearchParams(window.location.search);
  const artwork = params.get("artwork");
  if (!link || !artwork) return;

  const title = (params.get("title") || artwork).slice(0, 200);
  const isPrint = params.get("offer") === "print";
  const artworkUrl = new URL("/paintings/", window.location.origin);
  artworkUrl.searchParams.set("artwork", artwork.slice(0, 200));
  const contactUrl = new URL(link.href);
  contactUrl.searchParams.set("subject", `${isPrint ? "Print" : "Artwork"} inquiry: ${title}`);
  contactUrl.searchParams.set("body", isPrint
    ? `Hi Muzzammil,\n\nI’d like a print of ${title}.\n\nArtwork: ${artworkUrl.href}\n\nPreferred size:\nShipping destination:\n\nPlease confirm available sizes, paper, price, shipping, and timing.`
    : `Hi Muzzammil,\n\nI am interested in ${title}.\n\nArtwork: ${artworkUrl.href}\n\nPlease let me know about its availability and price.`);
  link.href = contactUrl.href;
  link.textContent = `${isPrint ? "Ask about a print of" : "Contact me about"} ${title}`;
})();
