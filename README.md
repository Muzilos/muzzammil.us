# muzzammil.us

This is the static source for the personal site and artwork gallery.

## Artwork catalog

The homepage carousel and paintings page both fetch the deployed, same-origin `static/artworks.json`. Each artwork has:

- `file`: the filename shared by `paintings/-/` and `paintings/-compressed/`
- `title`: the displayed artwork title
- `price`: the price in cents, or `0` for not for sale
- `featured`: optional; set to `true` to include it in the homepage carousel
- `listed`: optional; set to `false` to hide it from both the gallery and carousel

Every available artwork with a numeric price has a purchase button. The Cloudflare Pages Function validates the artwork and opens its existing Stripe Payment Link. Each original's link permits one completed purchase. Prices and quantities live in Stripe; browser-supplied prices are ignored.

## Monetization

Production and staging share the approved live Stripe catalog. Checkout returns to `https://muzzammil.us/success.html`. Each environment has its own inquiry counters and records its source in Stripe metadata.

- `/`: the artwork carousel, with the Home | Art | About | Book navbar, with a steady white Book label.
- `/bookings/`: 1 hour for $100, 3 hours for $285, and 5 hours for $450, with direct Stripe checkout links.
- `/studio-hours/` redirects permanently to `/bookings/` for existing links.
- `/prints/?artwork=…`: a print size selector and one purchase button. US shipping is included; Stripe collects a US shipping address.
- `/inquire/`: a free inquiry form. Artwork inquiry links include the selected piece. Email and Phone appear side by side; at least one must be provided, and both are allowed. The server stores the name, provided contact details, and full message in a Stripe Customer record with `inquiry=true` metadata. A honeypot, bounded request bodies, retry protection, and an environment-specific KV binding limit spam. Email remains available as a fallback.
- `/about/`: biography, project links, inquiry form link, and email. `/services/` remains a working copy for old links.
- Previous `/approaches/` links return to the homepage. The comparison layouts and toolbar have been removed.

Every listed artwork has a Prints button beside the original's purchase or inquiry button, on its card and in its detail dialog. Sold and reserved originals still offer prints. Multiple sizes open the size picker; a single size opens Stripe directly. Each `printOptions` record contains the approved amount and its Stripe product, price, and Payment Link IDs. The 43 formerly unpriced print listings use the approved $40/$70/$120 sizes; existing print prices are preserved.

The supplied keys belong to **Syed Mehdi / smm321@gmail.com**, account `acct_1TdOdAJfRoNnQ3sF`. Both environments use the supplied **live** Stripe key: payments are real. The public key is not needed for hosted checkout, and the secret key is stored only in server-side Pages secrets. `.env` is ignored and never enters the deployment assets.

Payments and inquiries are managed in this account's Stripe Dashboard. Purchased hours are recorded on the product, Checkout Session, and payment metadata. Scheduling and recording used hours are manual; no automatic credit balance or scheduling calendar is advertised. Print shipping and other fulfillment are manual. Every inquiry is saved in Stripe Customers and emailed to `smm321@gmail.com`, with the visitor as Reply-To when an email is provided. Phone-only inquiries are supported; the phone number is stored in Stripe and included in the notification. The message includes the artwork, inquiry text, and a link to the Stripe customer. Staging messages have a `[Staging]` subject prefix. Email failures preserve the Stripe record and can be retried without creating another customer. Stripe receipts depend on the account's receipt settings. No subscriptions or recurring charges are created.

`/success.html` checks the Checkout Session server-side before showing payment received. It never treats a redirect or a query flag as proof of payment, and the API returns no customer email or shipping address.

To create missing Stripe records after editing the catalog, run `npm run stripe:sync` with the account key in `.env`. It reuses products, prices, and links by stable artwork references, uses idempotency keys, and writes only public IDs and purchase URLs. Existing staging links are promoted in place to production; exhausted or deactivated original links are retained so synchronization cannot sell the same original twice. The current catalog contains 71 print products / 193 size prices, 40 available originals, and 3 hourly packs. Existing Stripe records are not deleted. If a price changes, review and retire the old purchase links in Stripe after publishing the replacement. Hourly table prices and links must match `static/hourly-packs.json`. Run `npm test` to verify payment validation, confirmation states, and inquiry handling.

The staging build adds an `X-Robots-Tag: noindex, nofollow` header. Production omits that header and removes the staging-only robots meta tag from its public pages.

Production publishes `/robots.txt` and `/sitemap.xml` for passive search discovery. The sitemap lists the home, artwork gallery, about, bookings, and inquiry pages; these pages have search descriptions and canonical URLs. The legacy Services page identifies About as its canonical version. Staging publishes a disallow-all robots file and no sitemap. These changes do not submit inquiries, send messages, or demonstrate that a search engine has indexed a page.

## Withdrawn merchandise

The owner withdrew the Merch shop, planner, calendar, T-shirts, totes, and mugs on 20 October 2026 while selecting products and providers. The existing standalone print listings and Prints buttons remain available by explicit request.

The Merch navigation link is removed. `/merch/` and former stationery preview URLs redirect temporarily to `/paintings/`. The public merchandise catalog has no products. `POST /api/merch-checkout` returns HTTP 410 without contacting Stripe, including for previously saved shopping bags. Open unpaid merchandise Checkout Sessions are expired with `node scripts/withdraw-merch.mjs --apply`; originals, standalone print links, bookings, and paid orders are preserved.

The publish script excludes the shop HTML, shop script/styles, and all `static/merch/` previews. Full stationery masters remain local in `production/2027/`; the former catalog, checkout handler, shop HTML, and tests are backed up in `production/withdrawn-merch-20261020/`. These directories and private sales material are excluded from deployment. `stripe:sync-merch` refuses to run against the withdrawn catalog. Relaunch requires the owner's selected products, print specifications, and providers.

The new local `/merch/` concept collection contains only oversized ecru tees featuring Covenant, Snake, Adam enjoying his apple, Insanity, Runnin', and Two Trees. Each has a photographed blank with a direct crop of the existing painting and an artwork-only inspection view. All six remain unavailable with no variants, prices, or fulfillment provider. The live shop remains withdrawn; publishing emits an empty public merchandise catalog and excludes these previews. The mockups are digital concepts, not approved physical samples.

Run `node scripts/build-tee-previews.mjs` to rebuild the six lossless SVG viewport crops. Their embedded JPEG pixels are unchanged; wrapping a raster in SVG adds no resolution. `production/tees/` holds the resolution manifest, provider research and sampling brief, image-generation prompt, six exported concept images, and desktop/mobile review screenshots. These files stay local. Higher-resolution artwork captures are needed before committing to large apparel prints.

The owner also prohibited cold email and all outreach on their behalf. `sales/preferences.json` records this instruction; the prepared outreach batch is cancelled and must not be sent. No outreach was sent.

## Cloudflare deployment

The site, static artwork assets, and Stripe Checkout API deploy together as one Cloudflare Pages project named `muzzammil-us`. AWS and S3 are not used.

Install the pinned deployment tool and authenticate once:

```sh
npm install
npx wrangler login
```

Create the Pages project the first time, selecting `main` as its production branch:

```sh
npx wrangler pages project create muzzammil-us
```

Configure Stripe secrets under **Workers & Pages → muzzammil-us → Settings → Variables and Secrets**. Production and staging currently use the supplied live key by request. For an isolated test checkout, use a test key and generate matching test-mode products and links rather than mixing modes:

```text
Production: STRIPE_SECRET_KEY=sk_live_...
Preview:    STRIPE_SECRET_KEY=<the configured account key>
```

`wrangler.toml` binds `INQUIRY_LIMITS` to `muzzammil-production-inquiry-limits` in production and `muzzammil-staging-inquiry-limits` in preview. `SITE_ENVIRONMENT` identifies the deployment. Keeping these bindings in the deployment configuration prevents direct uploads from dropping them. These namespaces hold hashed rate-limit counters and retry status with Stripe customer and email message IDs, without plaintext inquiry details.

The private `muzzammil-inquiry-email` Worker is connected to Pages through `INQUIRY_EMAIL`. It can send only to the verified owner address, from `inquiries@notify.muzzammil.us`; it has no public endpoint and uses Cloudflare’s native email binding. The `notify.muzzammil.us` sending subdomain is configured in Cloudflare Email Sending. Deploy changes to that Worker before publishing Pages:

```sh
npm run deploy:email
```

Deploy production or staging:

```sh
./publish prod
./publish staging
```

The production command deploys branch `main` to `muzzammil.us`. The staging command deploys branch `staging` to `staging.muzzammil.us`. Add `--dry-run` to either command to assemble and validate its assets without uploading them. If a future experiment adds a `.staging-only` marker, production deployment is blocked until that work is approved.

### Custom domains

After the `muzzammil.us` zone is active on Cloudflare:

1. In the Pages project, open **Custom domains** and add `muzzammil.us`.
2. Add `staging.muzzammil.us` there as well.
3. In Cloudflare DNS, edit the proxied `staging` CNAME target to `staging.muzzammil-us.pages.dev`, so the domain follows the staging branch rather than production.
4. Confirm both domains have active certificates before removing the old AWS records or resources.

Cloudflare must associate each custom domain with the Pages project; creating DNS records alone is insufficient.
