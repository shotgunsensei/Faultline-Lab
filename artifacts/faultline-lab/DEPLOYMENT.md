# Faultline Lab — Production Deployment Guide

Audience: an operator who already has the repo running in dev and now needs to
ship Faultline Lab + the API server to a production deployment on Replit.

This guide is intentionally short and concrete. Follow it top-to-bottom; the
final checklist should take ~15 minutes end-to-end.

---

## 1. Service map

Faultline Lab is two artifacts in one monorepo:

| Artifact                  | Path                       | Role                                                                 |
| ------------------------- | -------------------------- | -------------------------------------------------------------------- |
| `@workspace/faultline-lab`| `artifacts/faultline-lab`  | React + Vite SPA. Built static, served at `/`.                       |
| `@workspace/api-server`   | `artifacts/api-server`     | Express. Owns Stripe webhook, entitlements, admin, Clerk JWT proxy. |

The shared reverse proxy (configured per artifact via `.replit-artifact/artifact.toml`)
maps `/api/*` to the api-server. Do **not** call service ports directly in
production — both artifacts are reached through the user's `*.replit.app` (or
custom) domain over HTTPS.

---

## 2. Required environment variables

### Set by the platform (do not edit)

| Variable                    | Provided by                          | Used for                                  |
| --------------------------- | ------------------------------------ | ----------------------------------------- |
| `DATABASE_URL`              | Replit Postgres                      | App data, Stripe schema, sessions         |
| `PORT`                      | Per-artifact workflow                | Service port binding                      |
| `REPLIT_DOMAINS`            | Deployment runtime (comma-separated) | Stripe webhook URL construction on boot   |
| `REPLIT_DEV_DOMAIN`         | Dev runtime                          | CORS allow-list (dev) + Stripe return URLs|
| `REPLIT_DEPLOYMENT_URL`     | Deployment runtime                   | CORS allow-list (production)              |
| `BASE_PATH`                 | Per-artifact workflow                | Vite base path; required by `vite.config.ts` in serve/preview |
| `REPL_ID`                   | Workspace runtime                    | Optional dev-only Replit Vite plugins     |
| `REPLIT_DEPLOYMENT`         | `=1` in production                   | Selects Stripe **production** connector   |
| `REPLIT_CONNECTORS_HOSTNAME`| Connectors runtime                   | Resolves Stripe credentials from Connectors |
| `REPL_IDENTITY` / `WEB_REPL_RENEWAL` | Connectors runtime          | Auth token for the Connectors API         |
| `NODE_ENV`                  | `=production` in deployment          | Pino log format, Clerk middleware mode    |

### Must be set by you (Deployment → Secrets)

| Variable                       | Where to get it                                | Notes                                                                 |
| ------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------- |
| `CLERK_SECRET_KEY`             | Clerk dashboard → API Keys → **Production**    | Starts with `sk_live_…`. Required for Clerk JWT verification.         |
| `VITE_CLERK_PUBLISHABLE_KEY`   | Clerk dashboard → API Keys → **Production**    | Starts with `pk_live_…`. **Build-time** — must be set before deploy.  |
| `VITE_CLERK_PROXY_URL`         | Optional                                       | Only set if you proxy Clerk through your own domain.                  |
| `LOG_LEVEL`                    | Optional                                       | Defaults to `info`. Use `debug` for first-launch troubleshooting.     |

### Variables you might expect, but **do not** need to set

The original deployment brief listed three more variables. Each is
intentionally **not** required in the current implementation; they are listed
here so an operator coming from the brief doesn't waste time chasing them:

| Variable                  | Status        | Why                                                                                                                                                  |
| ------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`          | Not consumed  | Faultline Lab uses Clerk-issued JWTs end-to-end; no Express session middleware is mounted. The dev secret can stay unset in prod with no effect.     |
| `STRIPE_SECRET_KEY`       | Not consumed  | `artifacts/api-server/src/stripeClient.ts` resolves the secret from the Replit **Stripe Connector** (`development` in dev, `production` when `REPLIT_DEPLOYMENT=1`). |
| `STRIPE_WEBHOOK_SECRET`   | Not consumed  | The webhook endpoint **and** its signing secret are created/managed by `stripe-replit-sync` on first boot and stored in the database (see §4).       |

If you ever migrate off the Replit Stripe Connector or off
`stripe-replit-sync`, re-introduce `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` here and update `stripeClient.ts` / `app.ts` accordingly.

---

## 3. Switching Clerk from test to production keys

1. Open the Clerk dashboard → **Production** instance for `faultlinelab`. If you
   only have a Development instance, click **Create production instance** and
   walk through the Clerk-hosted DNS/redirect setup.
2. **API Keys** tab → copy the new `pk_live_…` and `sk_live_…`.
3. In the Replit deployment, open **Secrets** and set:
   - `VITE_CLERK_PUBLISHABLE_KEY` = `pk_live_…`
   - `CLERK_SECRET_KEY` = `sk_live_…`
4. **Domains** tab in Clerk → add the production deployment domain
   (every entry in `REPLIT_DOMAINS`, plus any custom domain).
5. **Paths** tab → confirm sign-in `/`, sign-up `/`, after-sign-in `/`,
   after-sign-up `/` (Faultline Lab uses Clerk's modal, not hosted pages).
6. Re-deploy. `VITE_CLERK_PUBLISHABLE_KEY` is read at build time, so a fresh
   build is required after rotating it.

> If `VITE_CLERK_PUBLISHABLE_KEY` is unset, the app silently runs in
> demo-only mode (no auth, no checkout) — that is intentional for previews,
> but for production you must verify the key is present.

---

## 4. Configuring the Stripe webhook

Webhook configuration is **automatic** when the api-server boots. On startup
(`artifacts/api-server/src/index.ts`):

1. `runMigrations({ databaseUrl })` creates / updates the `stripe.*` schema.
2. `findOrCreateManagedWebhook(...)` ensures Stripe has a webhook endpoint
   pointing at this deployment and stores the signing secret in the database.
   The receiving route is `POST /api/stripe/webhook` (mounted in
   `app.ts`); the api-server's `paths` in `.replit-artifact/artifact.toml` is
   `/api`, so the externally reachable URL is
   `https://<your-domain>/api/stripe/webhook`.
3. `syncBackfill()` pulls existing products / prices into the local Stripe
   schema asynchronously.

What you still need to do manually:

1. In the Stripe dashboard, ensure the **Connector** (`Tools → Connectors → Stripe`
   in Replit) is connected to the **production** Stripe account before flipping
   the deployment live. The `production` environment of the Connector is what
   the api-server will read when `REPLIT_DEPLOYMENT=1`.
2. After the first deploy, open the Stripe dashboard → **Developers → Webhooks**
   and confirm exactly one endpoint exists pointing at
   `https://<your-domain>/api/stripe/webhook`. Listed events should include at
   least `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`.
3. In the Stripe dashboard, create your live **Products** and **Prices** with a
   `catalogId` metadata field that matches the catalog ids used in
   `artifacts/faultline-lab/src/data/catalog.ts`. The app resolves prices
   server-side by `metadata->>'catalogId'`; without this metadata, checkout
   returns `Product not configured in Stripe`.

---

## 5. Verifying the Stripe schema migrated cleanly

After the first production boot, in the deployment shell:

```bash
psql "$DATABASE_URL" -c "\dn"           # expect: stripe schema present
psql "$DATABASE_URL" -c "\dt stripe.*"  # expect: products, prices, customers, subscriptions, invoices, webhook_endpoints, etc.
psql "$DATABASE_URL" -c "SELECT count(*) FROM stripe.products WHERE active = true;"
```

Then check the api-server logs for the `Stripe schema ready` and
`Webhook configured` messages. If you see `Failed to initialize Stripe`,
inspect the next log line — usually a missing Connector or a Postgres
permissions issue.

---

## 6. Pre-launch checklist (≤ 15 minutes)

Run these in order against the **production** deployment URL.

- [ ] **Boot.** Visit the site root. Boot screen renders; Incident Board loads
      the four free starter cases (`FREE_CASE_IDS`).
- [ ] **Auth.** Click **Sign In** in the Incident Board header. The full-page
      Clerk `AuthScreen` renders with the `pk_live_…` key (Network → request to
      `clerk.…` confirms the live host). Create a throwaway account; ensure
      you land back on the Incident Board.
- [ ] **API health.** `curl https://<domain>/api/healthz` returns `{"status":"ok"}`.
- [ ] **Clerk → server.** With your test account signed in, browser DevTools
      Network shows `/api/profile` returning 200 (verifies `CLERK_SECRET_KEY`
      validates the JWT).
- [ ] **Stripe schema.** Run the §5 `psql` checks. Expect ≥1 active product.
- [ ] **Checkout.** From the Store, choose any paid product → **Buy**. You
      should be redirected to `checkout.stripe.com` with the live publishable
      key. Cancel and return.
- [ ] **Webhook signature.** In the Stripe dashboard, **Developers → Webhooks →
      <your endpoint> → Send test event** (`checkout.session.completed`). The
      Stripe dashboard's **Recent deliveries** view should show the test
      event with HTTP **200** within a few seconds. A 400 means the signing
      secret is wrong — delete the webhook in Stripe and restart the
      api-server so it re-runs `findOrCreateManagedWebhook`. (The webhook
      route is mounted ahead of `pino-http`, so server-side logs for it are
      sparse — trust the Stripe dashboard for delivery status.)
- [ ] **Entitlement grant.** Complete a real low-cost purchase with a live
      card, or trigger Stripe's **Replay** on a real `checkout.session.completed`
      that has `metadata.userId` and `metadata.catalogProductId` set. Confirm
      the user's premium feature unlocks (e.g. Wireshark / Sandbox panel
      becomes available) and a row appears in `purchases` and `entitlements`.
- [ ] **Cross-promo & footers.** Incident Board, Store, and Debrief render the
      `EcosystemFooter` linking back to ShotgunNinjas.com (the Boot screen has
      its own inline ecosystem link, not the full footer).
- [ ] **No console errors.** DevTools console is clean on Boot, Incident Board,
      Store, and Debrief.

If every box is checked, Faultline Lab is launch-ready.

### Optional: scripted Stripe purchase E2E

For a repeatable check that does not require sitting in front of the Stripe
Checkout UI, run the scripted end-to-end test **from the dev workspace only,
against the test-mode Stripe Connector**. The script refuses to run inside a
production deployment (it detects `REPLIT_DEPLOYMENT=1` and aborts) because it
would otherwise create real Checkout Sessions and post synthetic paid webhooks
against the live Stripe account.

```bash
pnpm --filter @workspace/scripts run seed-products      # one-time per Stripe account
pnpm --filter @workspace/scripts run test-stripe-flow
```

This script (`scripts/src/test-stripe-flow.ts`):

- Calls the real `/api/stripe/checkout-by-catalog` app endpoint via a
  test-only auth bypass in `requireAuth`. The api-server only honours the
  bypass when ALL of these hold: not running inside a production
  deployment (`REPLIT_DEPLOYMENT !== "1"`), `ENABLE_E2E_AUTH_BYPASS=1`,
  and the request's `x-e2e-test-token` matches the server's
  `E2E_AUTH_TOKEN`. In dev, the api-server bootstrap auto-generates a
  fresh `E2E_AUTH_TOKEN` and writes it to `.local/.e2e-auth-token` (mode
  0600); the test script reads from the same file. Regressions in user
  provisioning, customer creation, price selection, or session metadata
  are caught.
- Looks up the catalog product in `stripe.products` (default
  `pack-network-ops`, override with `TEST_CATALOG_PRODUCT_ID`).
- Creates and confirms a side test-mode PaymentIntent for the same customer,
  amount, and currency with `pm_card_visa`, exercising real Stripe payment
  processing. (Stripe only attaches a PaymentIntent to a Checkout Session
  after the hosted page is opened, so the side-PI is the closest scriptable
  proof of card-charge capability.)
- Signs a `checkout.session.completed` event with the secret stored in
  `stripe._managed_webhooks` and POSTs it to `/api/stripe/webhook` using
  the *real* Checkout Session id and *real* PaymentIntent id (so
  `stripe-replit-sync`'s `listLineItems(sessionId)` and any downstream
  PI lookups work). Stripe itself does not deliver `checkout.session.
  completed` for a session whose hosted page was never opened, so this is
  the deliberate way the event reaches the webhook in this scripted test;
  the verification, decoding, and handler paths exercised are identical.
- Asserts the api-server created `user_entitlements` and `purchases` rows
  for the test user, and that `stripe-replit-sync` mirrored the session into
  `stripe.checkout_sessions`.
- Cleans up the test user and Stripe customer on completion (set
  `TEST_KEEP_DATA=1` to inspect the rows).

The hosted Stripe Checkout page itself is not driven (Stripe has no public
API for "complete this Checkout Session"); confirming the underlying
PaymentIntent is the closest faithful path that stays in CI/scripted form.

Stripe test card numbers for the manual hosted-page path: `4242 4242 4242 4242`
(succeeds), `4000 0000 0000 9995` (declines), `4000 0025 0000 3155` (requires
3D Secure). Use any future expiry, any 3-digit CVC, any ZIP.

---

## 7. Rollback

If a launch goes wrong:

1. Replit deployments retain the previous build — use **Deployments → History →
   Roll back** to the last green build.
2. If a bad Stripe webhook was registered, delete it in
   **Developers → Webhooks** in the Stripe dashboard. The next api-server boot
   will recreate it.
3. If `CLERK_SECRET_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` were rotated to a
   broken pair, restore the previous values in **Secrets** and redeploy.
   `VITE_*` changes require a fresh build to take effect.
