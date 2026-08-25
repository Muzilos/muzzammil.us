const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Checkout is not configured." }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (typeof payload.artwork !== "string") {
    return json({ error: "An artwork is required." }, 400);
  }

  const requestUrl = new URL(request.url);
  const catalogResponse = await env.ASSETS.fetch(new URL("/static/artworks.json", requestUrl));
  if (!catalogResponse.ok) {
    console.error("Unable to load the deployed artwork catalog", catalogResponse.status);
    return json({ error: "Checkout is temporarily unavailable." }, 503);
  }

  const catalog = await catalogResponse.json();
  const artwork = catalog.artworks?.find((entry) => (
    entry.file === payload.artwork
      && entry.listed !== false
      && entry.status !== "sold"
      && entry.status !== "reserved"
      && Number.isInteger(entry.price)
      && entry.price > 0
  ));

  if (!artwork) {
    return json({ error: "This artwork is not available for purchase." }, 404);
  }

  const origin = requestUrl.origin;
  const imageUrl = new URL(artwork.thumbnail || `/paintings/-compressed/thumb_${artwork.file}`, origin).href;
  const stripePayload = new URLSearchParams({
    mode: "payment",
    success_url: new URL("/success.html?session_id={CHECKOUT_SESSION_ID}", origin).href,
    cancel_url: new URL("/cancel.html", origin).href,
    client_reference_id: artwork.file,
    "metadata[artwork]": artwork.file,
    "line_items[0][price_data][currency]": (catalog.currency || "USD").toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(artwork.price),
    "line_items[0][price_data][product_data][name]": artwork.title,
    "line_items[0][price_data][product_data][images][0]": imageUrl,
    "line_items[0][quantity]": "1"
  });

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: stripePayload
  });
  const stripeResult = await stripeResponse.json();

  if (!stripeResponse.ok || !stripeResult.url) {
    console.error("Stripe Checkout session creation failed", stripeResult.error?.message || stripeResponse.status);
    return json({ error: "Stripe Checkout could not be opened." }, 502);
  }

  return json({ url: stripeResult.url });
}

export function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST" }
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
