# muzzammil.us

This is the static source for the personal site and artwork gallery.

## Artwork catalog

The homepage carousel and paintings page both fetch `static/artworks.json` directly from the `main` branch on GitHub. Each artwork has:

- `file`: the filename shared by `paintings/-/` and `paintings/-compressed/`
- `title`: the displayed artwork title
- `price`: the price in cents, or `0` for not for sale
- `featured`: optional; set to `true` to include it in the homepage carousel
- `listed`: optional; set to `false` to hide it from both the gallery and carousel

Every listed artwork with a nonzero price automatically gets a purchase button. The same-origin Cloudflare Pages Function validates the selected artwork against the deployed catalog, creates a Stripe Checkout Session, and redirects the visitor to Stripe. Prices sent by the browser are never trusted.

## Cloudflare deployment

The site, static artwork assets, and Stripe Checkout API deploy together as one Cloudflare Pages project named `muzzammil-us`. AWS and S3 are not used.

### Writing editor

Published thoughts appear at `/writing/`. The editor lives at the intentionally unlinked `/write` address. On its first visit it asks you to create a password; afterward it uses that password to open the draft and publishing interface. Passwords are derived with PBKDF2 and editor sessions use HTTP-only cookies.

The writing API stores its password, sessions, drafts, and published posts in the `muzzammil-writing` D1 database exposed to Pages Functions as `WRITING_DB`. Its binding is committed in `wrangler.toml`. To initialize or update its schema, run:

```sh
npx wrangler d1 migrations apply WRITING_DB --remote
```

For local development, Wrangler uses the same binding name with a locally persisted database:

```sh
./publish staging --dry-run
npx wrangler pages dev .cloudflare-dist
```

The application also checks the schema on each new runtime, so a first request can safely initialize an empty database. Use a different D1 database for a public staging deployment if production content must stay isolated. After the first production deployment, visit `/write` promptly to claim the editor and set its password. The hidden URL is not the security boundary—the password and server-side session are.

Install the pinned deployment tool and authenticate once:

```sh
npm install
npx wrangler login
```

Create the Pages project the first time, selecting `main` as its production branch:

```sh
npx wrangler pages project create muzzammil-us
```

Configure Stripe secrets under **Workers & Pages → muzzammil-us → Settings → Variables and Secrets**. Use the live key only for production and a Stripe test key for preview:

```text
Production: STRIPE_SECRET_KEY=sk_live_...
Preview:    STRIPE_SECRET_KEY=sk_test_...
```

Deploy production or staging:

```sh
./publish prod
./publish staging
```

The staging command creates a `staging.muzzammil-us.pages.dev` branch deployment. Use `./publish staging --dry-run` to assemble and validate the deployment without uploading it.

### Custom domains

After the `muzzammil.us` zone is active on Cloudflare:

1. In the Pages project, open **Custom domains** and add `muzzammil.us`.
2. Add `staging.muzzammil.us` there as well.
3. In Cloudflare DNS, edit the proxied `staging` CNAME target to `staging.muzzammil-us.pages.dev`, so the domain follows the staging branch rather than production.
4. Confirm both domains have active certificates before removing the old AWS records or resources.

Cloudflare must associate each custom domain with the Pages project; creating DNS records alone is insufficient.
