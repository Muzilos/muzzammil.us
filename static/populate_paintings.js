(function () {
  "use strict";

  const catalogUrl = "https://raw.githubusercontent.com/Muzilos/muzzammil.us/main/static/artworks.json";

  window.addEventListener("pageshow", resetCheckoutState);
  window.addEventListener("focus", resetCheckoutState);
  loadArtwork();

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
      thumbnail: `${prefix}-compressed/optimized/thumb_${file}.webp`
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

      const imageControl = document.createElement("button");
      imageControl.type = "button";
      imageControl.className = "painting-image-link painting-image-button";
      imageControl.setAttribute("aria-label", `View ${artwork.title}`);
      imageControl.addEventListener("click", () => openArtworkModal(artwork, paths, catalog.currency, imageControl));

      const image = document.createElement("img");
      image.className = "art";
      image.src = paths.thumbnail;
      image.alt = artwork.title;
      image.loading = "lazy";
      image.decoding = "async";
      imageControl.appendChild(image);

      const details = document.createElement("div");
      details.className = "painting-description";
      if (artwork.price === 0) {
        details.classList.add("not-for-sale");
      }

      const title = document.createElement("span");
      title.className = "description-text";
      title.textContent = artwork.title;

      const price = document.createElement("span");
      price.className = "price-text";
      price.textContent = formatPrice(artwork.price, catalog.currency);

      details.append(title, price);
      if (artwork.price > 0) {
        const buyButton = document.createElement("button");
        buyButton.type = "button";
        buyButton.className = "buy-button";
        buyButton.textContent = "Buy";
        buyButton.setAttribute("aria-label", `Buy ${artwork.title} for ${formatPrice(artwork.price, catalog.currency)}`);
        buyButton.addEventListener("click", () => initiateCheckout(card, artwork));
        details.appendChild(buyButton);
      }

      card.append(imageControl, details);
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
    const previous = carouselButton("Previous artwork", "‹", "previous");
    const next = carouselButton("Next artwork", "›", "next");
    const dots = document.createElement("div");
    dots.className = "carousel-dots";

    function show(index) {
      current = (index + featured.length) % featured.length;
      const artwork = featured[current];
      const paths = artworkPaths(artwork.file, true);
      const slide = document.createElement("button");
      slide.className = "featured-slide";
      slide.type = "button";
      slide.setAttribute("aria-label", `View featured artwork ${artwork.title}`);
      slide.addEventListener("click", () => openArtworkModal(artwork, paths, catalog.currency, slide));

      const image = document.createElement("img");
      image.src = paths.thumbnail;
      image.alt = artwork.title;
      image.decoding = "async";
      if (current === 0) image.fetchPriority = "high";
      const caption = document.createElement("span");
      caption.className = "featured-caption";
      caption.textContent = `${artwork.title} · ${formatPrice(artwork.price, catalog.currency)} · View details`;
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

    featured.slice(1).forEach((artwork) => {
      const preload = new Image();
      preload.src = artworkPaths(artwork.file, true).thumbnail;
    });
  }

  function carouselButton(label, text, position) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "carousel-control";
    if (position) button.classList.add(`carousel-${position}`);
    button.setAttribute("aria-label", label);
    button.textContent = text;
    return button;
  }

  function openArtworkModal(artwork, paths, currency, trigger) {
    const modal = document.createElement("div");
    modal.className = "artwork-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "artwork-modal-title");

    const panel = document.createElement("div");
    panel.className = "artwork-modal-panel";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "artwork-modal-close";
    closeButton.setAttribute("aria-label", "Close artwork details");
    closeButton.textContent = "×";

    const imageStage = document.createElement("div");
    imageStage.className = "artwork-modal-stage";
    const image = document.createElement("img");
    image.className = "artwork-modal-image";
    image.src = paths.thumbnail;
    image.alt = artwork.title;
    image.decoding = "async";
    imageStage.appendChild(image);

    const information = document.createElement("aside");
    information.className = "artwork-modal-info";
    const title = document.createElement("h2");
    title.id = "artwork-modal-title";
    title.textContent = artwork.title;
    const price = document.createElement("p");
    price.className = "artwork-modal-price";
    price.textContent = formatPrice(artwork.price, currency);
    information.append(title, price);

    if (artwork.price > 0) {
      const buyButton = document.createElement("button");
      buyButton.type = "button";
      buyButton.className = "buy-button artwork-modal-buy";
      buyButton.textContent = "Buy now";
      buyButton.setAttribute("aria-label", `Buy ${artwork.title} for ${formatPrice(artwork.price, currency)}`);
      buyButton.addEventListener("click", () => initiateCheckout(modal, artwork));
      information.appendChild(buyButton);
    } else {
      const availability = document.createElement("p");
      availability.className = "artwork-modal-availability";
      availability.textContent = "This piece is not currently for sale.";
      information.appendChild(availability);
    }

    function closeModal() {
      document.removeEventListener("keydown", handleKeydown);
      document.body.classList.remove("modal-open");
      modal.remove();
      trigger.focus();
    }

    function handleKeydown(event) {
      if (event.key === "Escape") closeModal();
    }

    closeButton.addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener("keydown", handleKeydown);

    panel.append(closeButton, imageStage, information);
    modal.appendChild(panel);
    document.body.classList.add("modal-open");
    document.body.appendChild(modal);
    closeButton.focus();
  }

  async function initiateCheckout(container, artwork) {
    const controls = container.matches("button") ? [container] : Array.from(container.querySelectorAll("button"));
    const statusLabel = container.querySelector?.(".buy-button") || container.querySelector?.(".featured-caption");
    container.classList.add("checkout-pending");
    controls.forEach((control) => { control.disabled = true; });
    if (statusLabel) {
      statusLabel.dataset.checkoutLabel = statusLabel.textContent;
      statusLabel.textContent = "Opening Stripe…";
    }

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
      resetCheckoutContainer(container);
      alert("There was an error opening checkout. Please try again.");
    }
  }

  function resetCheckoutState() {
    document.querySelectorAll(".checkout-pending").forEach(resetCheckoutContainer);
  }

  function resetCheckoutContainer(container) {
    const controls = container.matches("button") ? [container] : Array.from(container.querySelectorAll("button"));
    const statusLabel = container.querySelector?.("[data-checkout-label]");
    controls.forEach((control) => { control.disabled = false; });
    if (statusLabel) {
      statusLabel.textContent = statusLabel.dataset.checkoutLabel;
      delete statusLabel.dataset.checkoutLabel;
    }
    container.classList.remove("checkout-pending");
  }
})();
