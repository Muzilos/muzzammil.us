# muzzammil.us

This is the static source for the personal site and artwork gallery.

## Artwork catalog

The homepage carousel and paintings page both fetch the deployed, same-origin `static/artworks.json`. Each artwork has:

- `file`: the filename shared by `paintings/-/` and `paintings/-compressed/`
- `title`: the displayed artwork title
- `description`: optional; displayed in the artwork detail dialog when provided
- `price`: the price in cents, or `0` for not for sale
- `featured`: optional; set to `true` to include it in the homepage carousel
- `listed`: optional; set to `false` to hide it from both the gallery and carousel

Every available artwork with a numeric price has a purchase button. The Cloudflare Pages Function validates the artwork and opens its existing Stripe Payment Link. Each original's link permits one completed purchase. Prices and quantities live in Stripe; browser-supplied prices are ignored.

The holiday sale banner appears on Home, Art, and About, with a vivid pink, cyan, violet, and yellow palette and square neon blocks chasing and gently flashing around its border. Pixel snowfall runs across public pages, with larger flakes, a denser distribution, and a slightly faster fall. Both effects respect reduced-motion settings; snowfall pauses in background tabs and never blocks page controls.

## Monetization

Production and staging share the approved live Stripe catalog. Checkout returns to `https://muzzammil.us/success.html`. Each environment has its own inquiry counters and records its source in Stripe metadata.

- `/`: the artwork carousel, with the Home | Art | About | Merch navbar.
- `/merch/`: a single 2027 pocket planner at $24.00 USD each, including taxes, worldwide shipping, and all fees. A direct Stripe Payment Link reserves one prepaid planner and collects the delivery address.
- `/bookings/` and `/studio-hours/` redirect permanently to `/merch/` for existing links. Hourly offers are removed from the public pages; historical Stripe records remain available for existing purchases.
- `/prints/?artwork=…`: a print size selector and one purchase button. US shipping is included; Stripe collects a US shipping address.
- Legacy `/inquire/?artwork=…&offer=print` links redirect to the print size selector. Prints buttons always use print checkout rather than the inquiry form. To sync one artwork's offers without changing other artworks, run `npm run stripe:sync -- --artwork imported/god-her-warm-light.jpg`.
- `/inquire/`: a free inquiry form. Artwork inquiry links include the selected piece. Email and Phone appear side by side; at least one must be provided, and both are allowed. The server stores the name, provided contact details, and full message in a Stripe Customer record with `inquiry=true` metadata. A honeypot, bounded request bodies, retry protection, and an environment-specific KV binding limit spam. Email remains available as a fallback.
- `/about/`: biography, project links, inquiry form link, and email. `/services/` remains a working copy for old links.
- Previous `/approaches/` links return to the homepage. The comparison layouts and toolbar have been removed.

Every listed artwork has a Prints button beside the original's purchase or inquiry button, on its card and in its detail dialog. Sold and reserved originals still offer prints. Multiple sizes open the size picker; a single size opens Stripe directly. Each `printOptions` record contains the approved amount and its Stripe product, price, and Payment Link IDs. Every available print uses Small $30, Medium $50, and Large $75. Available originals cost $475 or retain their explicitly listed lower price. Vacuuming, It's getting cold, Snake, and Candle are reserved. Two Trees is sold. Former “(print)” listings, A strange invention, Study of a GoFundMe campaign, and Extinction button show Unavailable for the original, with print purchases still offered. Their titles omit “(print)” and original prices. Existing shared artwork links are preserved.

The supplied keys belong to **Syed Mehdi / smm321@gmail.com**, account `acct_1TdOdAJfRoNnQ3sF`. Both environments use the supplied **live** Stripe key: payments are real. The public key is not needed for hosted checkout, and the secret key is stored only in server-side Pages secrets. `.env` is ignored and never enters the deployment assets.

Payments and inquiries are managed in this account's Stripe Dashboard. Purchased hours are recorded on the product, Checkout Session, and payment metadata. Scheduling and recording used hours are manual; no automatic credit balance or scheduling calendar is advertised. Print shipping and other fulfillment are manual. Every inquiry is saved in Stripe Customers and emailed to `smm321@gmail.com`, with the visitor as Reply-To when an email is provided. Phone-only inquiries are supported; the phone number is stored in Stripe and included in the notification. The message includes the artwork, inquiry text, and a link to the Stripe customer. Staging messages have a `[Staging]` subject prefix. Email failures preserve the Stripe record and can be retried without creating another customer. Stripe receipts depend on the account's receipt settings. No subscriptions or recurring charges are created.

`/success.html` checks the Checkout Session server-side before showing payment received. It never treats a redirect or a query flag as proof of payment, and the API returns no customer email or shipping address.

To synchronize Stripe records after editing the catalog, run `npm run stripe:sync` with the account key in `.env`. It reuses products, prices, and links by stable artwork references, uses idempotency keys, and writes only public IDs and purchase URLs. Existing staging links are promoted in place to production; exhausted or deactivated original links are retained so synchronization cannot sell the same original twice. The current catalog contains 72 print products / 216 size options and 41 available originals. Synchronization deactivates obsolete artwork Payment Links, including reserved and unavailable originals, while preserving Stripe products, prices, and purchase history. It refuses to reissue an original that has already sold or whose links are all withdrawn. Historical hourly pack records remain in `static/hourly-packs.json`; synchronization and the public shop no longer offer them. Run `npm test` to verify payment validation, confirmation states, and inquiry handling.

The staging build adds an `X-Robots-Tag: noindex, nofollow` header. Production omits that header and removes the staging-only robots meta tag from its public pages.

Production publishes `/robots.txt` and `/sitemap.xml` for passive search discovery. The sitemap lists the home, artwork gallery, about, merch, and inquiry pages; these pages have search descriptions and canonical URLs. The legacy Services page identifies About as its canonical version. Staging publishes a disallow-all robots file and no sitemap. These changes do not submit inquiries, send messages, or demonstrate that a search engine has indexed a page.

## Planner preorders

The merch page offers the 2027 pocket planner for **$24.00 USD total per planner**, including taxes, worldwide shipping, and all fees. The reserve button opens a direct, live Stripe Payment Link; there is no preorder inquiry form or country selector on the shop. Stripe collects the buyer’s contact and shipping details. Each checkout reserves one planner. Customers will be notified when their preorder is ready to ship; fulfillment is manual.

The owner supplied `2027 Pocket Planner.pdf` in the project root. The unchanged 52-page source is served internally at `static/planner/pocket-planner-2027.pdf` for PDF.js; the merch page has no PDF download/open link. The reader shows all 52 individual pages in PDF order, from front cover to back cover. Every page is shown in full, including all margins, at 324 × 512.64 PDF points. The initial JPEG cover is generated from the new PDF’s first page with the same full-page framing. The page-turn animation, keyboard arrows, clicks, swipes, reduced-motion behavior and retry button remain available. Without JavaScript the full cover and direct Stripe checkout link remain usable.

`node scripts/sync-planner.mjs` idempotently reuses the existing planner product and creates/reuses its $24 **tax-inclusive** one-time price and Payment Link. It saves public Stripe identifiers in `static/planner.json` and updates the static checkout anchor, which works without JavaScript. Automatic tax uses the account’s existing Stripe Tax settings and registrations; this task does not create tax registrations. The included price stays $24 regardless of the calculated tax. No shipping rates, extra fees, optional items, or quantity adjustments are configured. Previous prices and purchases remain in Stripe as history. The replaced $35 tax-inclusive Payment Link is inactive. No payment is made by synchronization.

The Payment Link records `kind=planner`, `preorder=true`, manual fulfillment and production metadata on Checkout Sessions and payments. Its success URL uses the existing server-verified payment confirmation. The previous `/api/planner-checkout` endpoint returns HTTP 410 so older clients cannot create sessions that add tax or shipping. Other merchandise remains withdrawn.

## Previous merchandise concepts

Other merchandise remains withdrawn. `POST /api/merch-checkout` still returns HTTP 410, including for previous shopping bags. The public `static/merch.json` remains empty when built. Old shop scripts, styles, and all `static/merch/` previews are excluded from publishing. Standalone artwork prints remain available. Full stationery masters and withdrawn source backups stay in `production/`, excluded from deployment. The local tee concept page is preserved at `production/tees/shop-concept.html`; its six mockups and printing brief also stay local.

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

Publish commands, including dry runs, share a lock for the full build and upload. A second command waits until the first finishes so it cannot remove assets from an upload in progress.

### Custom domains

After the `muzzammil.us` zone is active on Cloudflare:

1. In the Pages project, open **Custom domains** and add `muzzammil.us`.
2. Add `staging.muzzammil.us` there as well.
3. In Cloudflare DNS, edit the proxied `staging` CNAME target to `staging.muzzammil-us.pages.dev`, so the domain follows the staging branch rather than production.
4. Confirm both domains have active certificates before removing the old AWS records or resources.

Cloudflare must associate each custom domain with the Pages project; creating DNS records alone is insufficient.
