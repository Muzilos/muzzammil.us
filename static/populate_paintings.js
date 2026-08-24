(function () {
  "use strict";

  const catalogUrl = "https://raw.githubusercontent.com/Muzilos/muzzammil.us/main/static/artworks.json";

  document.addEventListener("DOMContentLoaded", loadArtwork);

  async function loadArtwork() {
    const gallery = document.getElementById("paintings");
    const carousel = document.getElementById("featured-artworks");
    if (!gallery && !carousel) return;

    try {
      const response = await fetch(catalogUrl, { cache: "no-cache" });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

      const catalog = await response.json();
      validateCatalog(catalog);
      catalog.artworks = catalog.artworks.filter((artwork) => artwork.listed !== false);
      if (gallery) renderGallery(gallery, catalog);
      if (carousel) renderCarousel(carousel, catalog);
    } catch (error) {
      console.error("Unable to load the artwork catalog:", error);
      const message = document.createElement("p");
      message.className = "artwork-error";
      message.textContent = "The artwork collection could not be loaded. Please try again shortly.";
      (gallery || carousel).replaceChildren(message);
    }
  }

  function validateCatalog(catalog) {
    if (!catalog || !Array.isArray(catalog.artworks)) {
      throw new Error("The artwork catalog has an invalid format");
    }

    catalog.artworks.forEach((artwork) => {
      if (!artwork.file || !artwork.title || !Number.isInteger(artwork.price) || artwork.price < 0) {
        throw new Error(`Invalid artwork entry: ${artwork.file || "unknown"}`);
      }
    });
  }

  function artworkPaths(file, fromHome) {
    const prefix = fromHome ? "paintings/" : "../paintings/";
    return {
      full: `${prefix}-/${file}`,
      thumbnail: `${prefix}-compressed/thumb_${file}`
    };
  }

  function formatPrice(price, currency) {
    if (price === 0) return "NFS";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD"
    }).format(price / 100);
  }

  function renderGallery(gallery, catalog) {
    const fragment = document.createDocumentFragment();

    catalog.artworks.forEach((artwork) => {
      const paths = artworkPaths(artwork.file, false);
      const card = document.createElement("article");
      card.className = "painting-container";

      const imageLink = document.createElement("a");
      imageLink.href = paths.full;
      imageLink.className = "painting-image-link";

      const image = document.createElement("img");
      image.className = "art";
      image.src = paths.thumbnail;
      image.alt = artwork.title;
      image.loading = "lazy";
      imageLink.appendChild(image);

      const details = artwork.price > 0 ? document.createElement("button") : document.createElement("div");
      details.className = "painting-description";
      if (artwork.price > 0) {
        details.type = "button";
        details.setAttribute("aria-label", `Buy ${artwork.title} for ${formatPrice(artwork.price, catalog.currency)}`);
        details.addEventListener("click", () => initiateCheckout(details, artwork));
      } else {
        details.classList.add("not-for-sale");
      }

      const title = document.createElement("span");
      title.className = "description-text";
      title.textContent = artwork.title;

      const price = document.createElement("span");
      price.className = "price-text";
      price.textContent = formatPrice(artwork.price, catalog.currency);

      details.append(title, price);
      card.append(imageLink, details);
      fragment.appendChild(card);
    });

    gallery.replaceChildren(fragment);
  }

  function renderCarousel(carousel, catalog) {
    const featured = catalog.artworks.filter((artwork) => artwork.featured);
    if (!featured.length) {
      carousel.replaceChildren();
      return;
    }

    let current = 0;
    const viewport = document.createElement("div");
    viewport.className = "carousel-viewport";
    viewport.setAttribute("aria-live", "polite");
    const previous = carouselButton("Previous artwork", "‹");
    const next = carouselButton("Next artwork", "›");
    const dots = document.createElement("div");
    dots.className = "carousel-dots";

    function show(index) {
      current = (index + featured.length) % featured.length;
      const artwork = featured[current];
      const paths = artworkPaths(artwork.file, true);
      const slide = document.createElement("a");
      slide.className = "featured-slide";
      slide.href = "paintings/";

      const image = document.createElement("img");
      image.src = paths.thumbnail;
      image.alt = artwork.title;
      const caption = document.createElement("span");
      caption.className = "featured-caption";
      caption.textContent = `${artwork.title} — ${formatPrice(artwork.price, catalog.currency)}`;
      slide.append(image, caption);
      viewport.replaceChildren(slide);

      Array.from(dots.children).forEach((dot, dotIndex) => {
        dot.classList.toggle("active", dotIndex === current);
        dot.setAttribute("aria-current", dotIndex === current ? "true" : "false");
      });
    }

    featured.forEach((artwork, index) => {
      const dot = carouselButton(`Show ${artwork.title}`, "");
      dot.className = "carousel-dot";
      dot.addEventListener("click", () => show(index));
      dots.appendChild(dot);
    });

    previous.addEventListener("click", () => show(current - 1));
    next.addEventListener("click", () => show(current + 1));
    carousel.replaceChildren(previous, viewport, next, dots);
    show(0);
  }

  function carouselButton(label, text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "carousel-control";
    button.setAttribute("aria-label", label);
    button.textContent = text;
    return button;
  }

  async function initiateCheckout(button, artwork) {
    const priceLabel = button.querySelector(".price-text");
    const originalPrice = priceLabel.textContent;
    button.disabled = true;
    priceLabel.textContent = "Opening…";

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artwork: artwork.file })
      });

      if (!response.ok) throw new Error(`Checkout returned ${response.status}`);
      const result = await response.json();
      if (!result.url) throw new Error("Checkout did not return a URL");
      window.location.assign(result.url);
    } catch (error) {
      console.error("Error creating checkout session:", error);
      button.disabled = false;
      priceLabel.textContent = originalPrice;
      alert("There was an error opening checkout. Please try again.");
    }
  }
})();
