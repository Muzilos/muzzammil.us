(function () {
  "use strict";

  const link = document.getElementById("contact-link");
  const params = new URLSearchParams(window.location.search);
  const artwork = params.get("artwork");
  if (!link || !artwork) return;

  const title = (params.get("title") || artwork).slice(0, 200);
  const artworkUrl = new URL("/paintings/", window.location.origin);
  artworkUrl.searchParams.set("artwork", artwork.slice(0, 200));
  const contactUrl = new URL(link.href);
  contactUrl.searchParams.set("subject", `Artwork inquiry: ${title}`);
  contactUrl.searchParams.set("body", `Hi, I am interested in ${title}.\n\nArtwork: ${artworkUrl.href}\n\nPlease let me know about its availability and price.`);
  link.href = contactUrl.href;
  link.textContent = `Contact me about ${title}`;
})();
