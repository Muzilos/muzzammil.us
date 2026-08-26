(function () {
  "use strict";

  const catalogUrl = "/static/artworks.json";
  const inquiryEmail = "youngthugnumberone@gmail.com";
  let loadedCatalog = null;
  let activeArtworkModal = null;

  window.addEventListener("pageshow", resetCheckoutState);
  window.addEventListener("focus", resetCheckoutState);
  window.addEventListener("popstate", syncArtworkFromUrl);
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
      loadedCatalog = catalog;
      if (gallery) renderGallery(gallery, catalog);
      if (carousel) renderCarousel(carousel, catalog);
      syncArtworkFromUrl();
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
      const validPrice = (Number.isInteger(artwork.price) && artwork.price >= 0)
        || (typeof artwork.price === "string" && artwork.price.trim());
      if (!artwork.file || !artwork.title || !validPrice) {
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

  function pathsForArtwork(artwork, fromHome) {
    const fallback = artworkPaths(artwork.file, fromHome);
    return {
      full: artwork.image || fallback.full,
      thumbnail: artwork.thumbnail || fallback.thumbnail
    };
  }

  function artworkStatus(artwork) {
    if (artwork.status === "sold") return "Sold";
    if (artwork.status === "reserved") return "Reserved";
    if (artwork.status === "available") return "Available";
    return artwork.price === 0 ? "Not for sale" : "Available";
  }

  function canCheckout(artwork) {
    return artwork.status !== "sold"
      && artwork.status !== "reserved"
      && Number.isInteger(artwork.price)
      && artwork.price > 0;
  }

  function canInquire(artwork) {
    return artwork.status !== "sold"
      && artwork.status !== "reserved"
      && typeof artwork.price === "string";
  }

  function formatPrice(price, currency) {
    if (typeof price === "string") return price;
    if (price === 0) return "NFS";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD"
    }).format(price / 100);
  }

  function displayPrice(artwork, currency) {
    if (artwork.status === "sold") return "Sold";
    if (artwork.status === "reserved") return "Reserved";
    return formatPrice(artwork.price, currency);
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function shortHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function artworkSlug(artwork) {
    return artwork.slug || `${slugify(artwork.title) || "artwork"}-${shortHash(artwork.file)}`;
  }

  function artworkUrl(artwork) {
    const url = new URL(window.location.href);
    url.searchParams.set("artwork", artworkSlug(artwork));
    url.hash = "";
    return url;
  }

  function inquiryUrl(artwork) {
    const subject = `Artwork inquiry: ${artwork.title}`;
    const body = [
      `Hi, I'm interested in ${artwork.title}.`,
      "",
      `Artwork: ${artworkUrl(artwork).href}`,
      "",
      "Please let me know about its availability and price."
    ].join("\n");
    return `mailto:${inquiryEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function createInquiryLink(artwork, className) {
    const link = document.createElement("a");
    link.className = className;
    link.href = inquiryUrl(artwork);
    link.textContent = "Inquire";
    link.setAttribute("aria-label", `Inquire about ${artwork.title}`);
    return link;
  }

  function selectArtwork(artwork, paths, currency, trigger) {
    const slug = artworkSlug(artwork);
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("artwork") !== slug) {
      history.pushState({ artworkModal: slug }, "", artworkUrl(artwork));
    }
    openArtworkModal(artwork, paths, currency, trigger);
  }

  function syncArtworkFromUrl() {
    if (!loadedCatalog) return;

    const url = new URL(window.location.href);
    const slug = url.searchParams.get("artwork");
    if (!slug) {
      activeArtworkModal?.dismiss(false);
      return;
    }

    const artwork = loadedCatalog.artworks.find((item) => artworkSlug(item) === slug);
    if (!artwork) {
      url.searchParams.delete("artwork");
      history.replaceState(history.state, "", url);
      activeArtworkModal?.dismiss(false);
      return;
    }

    if (activeArtworkModal?.slug === slug) return;
    const fromHome = Boolean(document.getElementById("featured-artworks"));
    const trigger = document.querySelector(`[data-artwork-slug="${CSS.escape(slug)}"]`);
    openArtworkModal(
      artwork,
      pathsForArtwork(artwork, fromHome),
      loadedCatalog.currency,
      trigger
    );
  }

  function renderGallery(gallery, catalog) {
    const fragment = document.createDocumentFragment();

    catalog.artworks.forEach((artwork) => {
      const paths = pathsForArtwork(artwork, false);
      const card = document.createElement("article");
      card.className = "painting-container";

      const imageControl = document.createElement("button");
      imageControl.type = "button";
      imageControl.className = "painting-image-link painting-image-button";
      imageControl.dataset.artworkSlug = artworkSlug(artwork);
      imageControl.setAttribute("aria-label", `View ${artwork.title}`);
      imageControl.addEventListener("click", () => selectArtwork(artwork, paths, catalog.currency, imageControl));

      const image = document.createElement("img");
      image.className = "art";
      image.src = paths.thumbnail;
      image.alt = artwork.title;
      image.loading = "lazy";
      image.decoding = "async";
      imageControl.appendChild(image);

      const details = document.createElement("div");
      details.className = "painting-description";
      if (!canCheckout(artwork) && !canInquire(artwork)) {
        details.classList.add("not-for-sale");
      }

      const title = document.createElement("span");
      title.className = "description-text";
      title.textContent = artwork.title;

      const price = document.createElement("span");
      price.className = "price-text";
      price.textContent = displayPrice(artwork, catalog.currency);

      details.append(title, price);
      if (canCheckout(artwork)) {
        const buyButton = document.createElement("button");
        buyButton.type = "button";
        buyButton.className = "buy-button";
        buyButton.textContent = "Buy";
        buyButton.setAttribute("aria-label", `Buy ${artwork.title} for ${displayPrice(artwork, catalog.currency)}`);
        buyButton.addEventListener("click", () => initiateCheckout(card, artwork));
        details.appendChild(buyButton);
      } else if (canInquire(artwork)) {
        details.appendChild(createInquiryLink(artwork, "buy-button inquiry-button"));
      }

      card.append(imageControl, details);
      fragment.appendChild(card);
    });

    gallery.replaceChildren(fragment);
  }

  function renderCarousel(carousel, catalog) {
    const featured = orderedFeaturedArtworks(catalog);
    let suppressSlideClick = false;
    let suppressResetTimer;

    function markCarouselSwipe() {
      suppressSlideClick = true;
      window.clearTimeout(suppressResetTimer);
      suppressResetTimer = window.setTimeout(() => { suppressSlideClick = false; }, 600);
    }

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
      const paths = pathsForArtwork(artwork, true);
      const slide = document.createElement("button");
      slide.className = "featured-slide";
      slide.type = "button";
      slide.dataset.artworkSlug = artworkSlug(artwork);
      slide.setAttribute("aria-label", `View featured artwork ${artwork.title}`);
      slide.addEventListener("click", () => {
        if (suppressSlideClick) {
          suppressSlideClick = false;
          return;
        }
        selectArtwork(artwork, paths, catalog.currency, slide);
      });

      const image = document.createElement("img");
      image.src = paths.thumbnail;
      image.alt = artwork.title;
      image.decoding = "async";
      if (current === 0) image.fetchPriority = "high";
      const caption = document.createElement("span");
      caption.className = "featured-caption";
      caption.textContent = `${artwork.title} · ${displayPrice(artwork, catalog.currency)} · View details`;
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
    carousel.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        show(current - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        show(current + 1);
      }
    });
    addHorizontalSwipe(viewport, () => {
      markCarouselSwipe();
      show(current - 1);
    }, () => {
      markCarouselSwipe();
      show(current + 1);
    });
    carousel.replaceChildren(previous, viewport, next, dots);
    show(0);

    featured.slice(1).forEach((artwork) => {
      const preload = new Image();
      preload.src = pathsForArtwork(artwork, true).thumbnail;
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

  function orderedFeaturedArtworks(catalog) {
    const featured = catalog.artworks.filter((artwork) => artwork.featured);
    featured
      .filter((artwork) => Number.isInteger(artwork.featuredPosition))
      .sort((left, right) => left.featuredPosition - right.featuredPosition)
      .forEach((artwork) => {
        featured.splice(featured.indexOf(artwork), 1);
        featured.splice(Math.max(0, artwork.featuredPosition - 1), 0, artwork);
      });
    return featured;
  }

  function visibleArtworkSequence() {
    if (!loadedCatalog) return [];
    if (document.getElementById("featured-artworks")) return orderedFeaturedArtworks(loadedCatalog);

    const visibleSlugs = Array.from(document.querySelectorAll(".painting-image-button"))
      .filter((control) => control.getClientRects().length > 0)
      .map((control) => control.dataset.artworkSlug);
    return visibleSlugs.map((slug) => (
      loadedCatalog.artworks.find((artwork) => artworkSlug(artwork) === slug)
    )).filter(Boolean);
  }

  function addHorizontalSwipe(element, showPrevious, showNext) {
    let startX = 0;
    let startY = 0;

    element.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });

    element.addEventListener("touchend", (event) => {
      const touch = event.changedTouches[0];
      const horizontalDistance = touch.clientX - startX;
      const verticalDistance = touch.clientY - startY;
      if (Math.abs(horizontalDistance) < 50 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return;
      if (horizontalDistance > 0) showPrevious();
      else showNext();
    }, { passive: true });
  }

  function openArtworkModal(artwork, paths, currency, trigger) {
    activeArtworkModal?.dismiss(false);

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
    image.src = paths.full;
    image.alt = artwork.title;
    image.decoding = "async";
    imageStage.appendChild(image);

    const sequence = visibleArtworkSequence();
    const artworkIndex = sequence.findIndex((item) => artworkSlug(item) === artworkSlug(artwork));

    function navigateArtwork(offset) {
      if (artworkIndex < 0 || sequence.length < 2) return;
      const nextArtwork = sequence[(artworkIndex + offset + sequence.length) % sequence.length];
      const nextSlug = artworkSlug(nextArtwork);
      history.replaceState({ ...history.state, artworkModal: nextSlug }, "", artworkUrl(nextArtwork));
      const nextTrigger = document.querySelector(`[data-artwork-slug="${CSS.escape(nextSlug)}"]`);
      openArtworkModal(
        nextArtwork,
        pathsForArtwork(nextArtwork, Boolean(document.getElementById("featured-artworks"))),
        currency,
        nextTrigger
      );
    }

    if (sequence.length > 1 && artworkIndex >= 0) {
      const previousArtwork = carouselButton("View previous artwork", "‹");
      previousArtwork.className = "artwork-modal-navigation artwork-modal-previous";
      previousArtwork.addEventListener("click", () => navigateArtwork(-1));
      const nextArtwork = carouselButton("View next artwork", "›");
      nextArtwork.className = "artwork-modal-navigation artwork-modal-next";
      nextArtwork.addEventListener("click", () => navigateArtwork(1));
      imageStage.append(previousArtwork, nextArtwork);
      addHorizontalSwipe(imageStage, () => navigateArtwork(-1), () => navigateArtwork(1));
    }

    const information = document.createElement("aside");
    information.className = "artwork-modal-info";
    const title = document.createElement("h2");
    title.id = "artwork-modal-title";
    title.textContent = artwork.title;
    const metadata = document.createElement("p");
    metadata.className = "artwork-modal-metadata";
    metadata.textContent = [artwork.year, artwork.size, artwork.medium].filter(Boolean).join(" · ");
    const status = document.createElement("p");
    status.className = `artwork-modal-status artwork-status-${artwork.status || "legacy"}`;
    status.textContent = artworkStatus(artwork);
    const price = document.createElement("p");
    price.className = "artwork-modal-price";
    price.textContent = displayPrice(artwork, currency);
    information.append(title);
    if (metadata.textContent) information.appendChild(metadata);
    information.appendChild(status);
    if (price.textContent !== status.textContent) information.appendChild(price);

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.className = "artwork-share-button";
    shareButton.textContent = "Share artwork";
    shareButton.addEventListener("click", async () => {
      const shareUrl = artworkUrl(artwork).href;
      try {
        if (navigator.share) {
          await navigator.share({ title: artwork.title, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          shareButton.textContent = "Link copied";
          window.setTimeout(() => { shareButton.textContent = "Share artwork"; }, 1800);
        }
      } catch (error) {
        if (error.name !== "AbortError") console.error("Unable to share artwork:", error);
      }
    });
    information.appendChild(shareButton);

    if (artwork.description) {
      const description = document.createElement("p");
      description.className = "artwork-modal-description";
      description.textContent = artwork.description;
      information.appendChild(description);
    }

    if (artwork.printsAvailable) {
      const printDetails = document.createElement("p");
      printDetails.className = "artwork-modal-prints";
      const prices = Object.entries(artwork.printPrices || {}).map(([size, printPrice]) => (
        `${size} ${formatPrice(printPrice, currency)}`
      ));
      printDetails.textContent = prices.length
        ? `Prints available: ${prices.join(" · ")}`
        : "Prints available by inquiry.";
      information.appendChild(printDetails);
    }

    if (canCheckout(artwork)) {
      const buyButton = document.createElement("button");
      buyButton.type = "button";
      buyButton.className = "buy-button artwork-modal-buy";
      buyButton.textContent = "Buy now";
      buyButton.setAttribute("aria-label", `Buy ${artwork.title} for ${displayPrice(artwork, currency)}`);
      buyButton.addEventListener("click", () => initiateCheckout(modal, artwork));
      information.appendChild(buyButton);
    } else {
      const availability = document.createElement("p");
      availability.className = "artwork-modal-availability";
      availability.textContent = artwork.status === "sold"
        ? "This original has sold."
        : artwork.status === "reserved"
          ? "This original is currently reserved."
          : typeof artwork.price === "string"
            ? "Contact the studio to inquire about this original."
            : "This piece is not currently for sale.";
      information.appendChild(availability);
      if (canInquire(artwork)) {
        information.appendChild(createInquiryLink(
          artwork,
          "buy-button inquiry-button artwork-modal-buy"
        ));
      }
    }

    function dismissModal(restoreFocus) {
      document.removeEventListener("keydown", handleKeydown);
      document.body.classList.remove("modal-open");
      modal.remove();
      if (activeArtworkModal?.element === modal) activeArtworkModal = null;
      if (restoreFocus && trigger?.focus) trigger.focus();
    }

    function closeModal() {
      const slug = artworkSlug(artwork);
      if (history.state?.artworkModal === slug) {
        history.back();
        return;
      }

      const url = new URL(window.location.href);
      url.searchParams.delete("artwork");
      history.replaceState(history.state, "", url);
      dismissModal(true);
    }

    function handleKeydown(event) {
      if (event.key === "Escape") closeModal();
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateArtwork(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateArtwork(1);
      }
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
    activeArtworkModal = {
      element: modal,
      slug: artworkSlug(artwork),
      dismiss: dismissModal
    };
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
