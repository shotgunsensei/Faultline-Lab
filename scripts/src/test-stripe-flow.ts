/**
 * test-stripe-flow.ts — Stripe purchase end-to-end test for Faultline Lab.
 *
 * What this verifies (against the *test-mode* Stripe Connector):
 *   1. The Stripe schema (`stripe.products`, `stripe.prices`) actually has the
 *      catalog product we want to buy. (Catches schema-migration regressions
 *      and missing seed data.)
 *   2. The api-server's webhook route at `/api/stripe/webhook` is reachable
 *      and accepts a Stripe-signed payload using the secret currently stored
 *      in `stripe._managed_webhooks`.
 *   3. After the webhook fires `checkout.session.completed`, the local DB
 *      gets a row in `user_entitlements` and `purchases` for our test user
 *      via `grantEntitlementFromCheckout` / `recordPurchase` in the api-server.
 *   4. `stripe-replit-sync` records the (real) checkout session in the
 *      `stripe.checkout_sessions` table.
 *
 * The script creates a *real* Stripe Checkout Session in test mode (so that
 * `stripe-replit-sync`'s `listLineItems(sessionId)` call succeeds), then
 * forges a signed `checkout.session.completed` event whose payload claims the
 * session is paid. The api-server's grant logic only inspects metadata on the
 * webhook payload, so this is enough to exercise the full path without ever
 * touching the hosted Checkout UI.
 *
 * What this does NOT verify (intentionally out of scope):
 *   - Driving the hosted Stripe Checkout page in a browser. Stripe does not
 *     allow programmatic completion of a Checkout Session via API — a
 *     headless-browser dance would add a lot of moving parts and brittleness
 *     for very little extra coverage versus what the synthetic webhook gives
 *     us. Use a real test-mode card (4242 4242 4242 4242, any future expiry,
 *     any 3-digit CVC, any ZIP) if you want to exercise the hosted page
 *     manually.
 *
 * How to run (from the repo root):
 *
 *     # 1. Make sure the api-server workflow is running (it serves /api/stripe/webhook).
 *     # 2. Make sure Stripe products are seeded:
 *     pnpm --filter @workspace/scripts run seed-products
 *     # 3. Run the test:
 *     pnpm --filter @workspace/scripts run test-stripe-flow
 *
 * Useful environment overrides (all optional):
 *
 *     TEST_CATALOG_PRODUCT_ID   Catalog id to purchase. Default: pack-network-ops.
 *     TEST_WEBHOOK_URL          Override the webhook URL. Defaults to the
 *                               managed webhook in `stripe._managed_webhooks`
 *                               whose URL matches `REPLIT_DEV_DOMAIN`.
 *     TEST_KEEP_DATA            Set to "1" to skip cleanup (debugging).
 *     ALLOW_PROD_E2E            Set to "1" to bypass the safety check that
 *                               refuses to run inside a production deployment
 *                               (REPLIT_DEPLOYMENT=1). Use with extreme care
 *                               — it will hit the live Stripe account.
 *
 * Stripe test cards reference (for the manual hosted-page path):
 *     4242 4242 4242 4242  — succeeds
 *     4000 0000 0000 9995  — declines (insufficient_funds)
 *     4000 0025 0000 3155  — requires 3D Secure
 *
 * Exit codes: 0 on success, 1 on any failure.
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import Stripe from 'stripe';
import { getUncachableStripeClient } from './stripeClient';

const TEST_CATALOG_PRODUCT_ID =
  process.env.TEST_CATALOG_PRODUCT_ID || 'pack-network-ops';
const KEEP_DATA = process.env.TEST_KEEP_DATA === '1';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

if (process.env.REPLIT_DEPLOYMENT === '1' && process.env.ALLOW_PROD_E2E !== '1') {
  console.error(
    'Refusing to run inside a production deployment (REPLIT_DEPLOYMENT=1). ' +
      'This script creates real Stripe Checkout Sessions and posts synthetic ' +
      'paid webhooks. Run it from the dev workspace (test-mode Connector). ' +
      'Override with ALLOW_PROD_E2E=1 only if you really know what you are doing.',
  );
  process.exit(1);
}

const EXPECTED_WEBHOOK_HOST = (() => {
  if (process.env.TEST_WEBHOOK_URL) {
    try {
      return new URL(process.env.TEST_WEBHOOK_URL).host;
    } catch {
      console.error(`TEST_WEBHOOK_URL is not a valid URL: ${process.env.TEST_WEBHOOK_URL}`);
      process.exit(1);
    }
  }
  return process.env.REPLIT_DEV_DOMAIN || null;
})();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let createdUserId: string | null = null;
let createdCustomerId: string | null = null;
let syntheticSessionId: string | null = null;

async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  process.stdout.write(`  • ${label} ... `);
  try {
    const out = await fn();
    process.stdout.write('ok\n');
    return out;
  } catch (err: any) {
    process.stdout.write('FAIL\n');
    console.error(`    ${err?.message || err}`);
    throw err;
  }
}

async function createRealCheckoutSession(
  stripe: Stripe,
  opts: {
    customerId: string;
    priceId: string;
    userId: string;
    clerkId: string;
    catalogProductId: string;
  },
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer: opts.customerId,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
    metadata: {
      userId: opts.userId,
      clerkId: opts.clerkId,
      catalogProductId: opts.catalogProductId,
      interval: '',
      e2eTest: '1',
    },
  });
}

async function getCatalogProduct(): Promise<{
  stripeProductId: string;
  stripePriceId: string;
  unitAmount: number;
  currency: string;
}> {
  const productRow = await pool.query<{ id: string }>(
    `SELECT id FROM stripe.products
       WHERE active = true AND metadata->>'catalogId' = $1
       LIMIT 1`,
    [TEST_CATALOG_PRODUCT_ID],
  );
  if (productRow.rows.length === 0) {
    throw new Error(
      `No active stripe.products row with metadata.catalogId=${TEST_CATALOG_PRODUCT_ID}. ` +
        `Run "pnpm --filter @workspace/scripts run seed-products" first.`,
    );
  }
  const stripeProductId = productRow.rows[0].id;

  const priceRow = await pool.query<{
    id: string;
    unit_amount: number | null;
    currency: string;
  }>(
    `SELECT id, unit_amount, currency FROM stripe.prices
       WHERE product = $1 AND active = true
       ORDER BY unit_amount ASC
       LIMIT 1`,
    [stripeProductId],
  );
  if (priceRow.rows.length === 0) {
    throw new Error(`No active price for stripe product ${stripeProductId}`);
  }
  return {
    stripeProductId,
    stripePriceId: priceRow.rows[0].id,
    unitAmount: priceRow.rows[0].unit_amount ?? 0,
    currency: priceRow.rows[0].currency,
  };
}

async function getWebhookConfig(): Promise<{ url: string; secret: string }> {
  // Scope the lookup to the host we expect to be hitting (the current dev
  // workspace, or a caller-supplied TEST_WEBHOOK_URL). This prevents the
  // script from accidentally signing a payload with one environment's secret
  // and POSTing it to another environment's URL when multiple managed
  // webhooks exist for the same Stripe account.
  if (!EXPECTED_WEBHOOK_HOST) {
    throw new Error(
      'Cannot determine target webhook host. Set TEST_WEBHOOK_URL or run ' +
        'inside a Replit workspace where REPLIT_DEV_DOMAIN is defined.',
    );
  }
  const row = await pool.query<{ url: string; secret: string }>(
    `SELECT url, secret FROM stripe._managed_webhooks
       WHERE status = 'enabled' AND secret IS NOT NULL AND url LIKE $1
       ORDER BY updated_at DESC
       LIMIT 1`,
    [`%${EXPECTED_WEBHOOK_HOST}%`],
  );
  if (row.rows.length === 0 || !row.rows[0].secret) {
    throw new Error(
      `No managed webhook found whose URL matches host "${EXPECTED_WEBHOOK_HOST}". ` +
        'Restart the api-server so it can register one for this environment, ' +
        'or set TEST_WEBHOOK_URL explicitly.',
    );
  }
  const url = process.env.TEST_WEBHOOK_URL || row.rows[0].url;
  // Final guard: signed payload must be POSTed to the same host its secret was
  // registered for.
  const targetHost = new URL(url).host;
  if (targetHost !== EXPECTED_WEBHOOK_HOST) {
    throw new Error(
      `Refusing to use webhook secret registered for "${row.rows[0].url}" ` +
        `against POST target "${url}" — host mismatch.`,
    );
  }
  return { url, secret: row.rows[0].secret };
}

async function createTestUser(): Promise<string> {
  const id = randomUUID();
  const clerkId = `test_clerk_${id}`;
  await pool.query(
    `INSERT INTO users (id, clerk_id, email, display_name)
       VALUES ($1, $2, $3, $4)`,
    [id, clerkId, `e2e+${id}@faultline.test`, 'E2E Test User'],
  );
  createdUserId = id;
  return id;
}

async function createTestCustomer(stripe: Stripe, userId: string): Promise<string> {
  const customer = await stripe.customers.create({
    email: `e2e+${userId}@faultline.test`,
    metadata: { userId, e2eTest: '1' },
  });
  createdCustomerId = customer.id;
  await pool.query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [
    customer.id,
    userId,
  ]);
  return customer.id;
}

async function postSignedWebhook(
  url: string,
  secret: string,
  event: any,
): Promise<{ status: number; body: string }> {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature,
    },
    body: payload,
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function assertEntitlementGranted(userId: string, productId: string): Promise<void> {
  const ent = await pool.query(
    `SELECT id, is_active, entitlement_type FROM user_entitlements
       WHERE user_id = $1 AND product_id = $2`,
    [userId, productId],
  );
  if (ent.rows.length === 0) {
    throw new Error('No user_entitlements row created');
  }
  if (!ent.rows[0].is_active) {
    throw new Error('Entitlement row exists but is_active=false');
  }
}

async function assertPurchaseRecorded(
  userId: string,
  productId: string,
  sessionId: string,
): Promise<void> {
  const p = await pool.query(
    `SELECT id, status, stripe_session_id FROM purchases
       WHERE user_id = $1 AND product_id = $2 AND stripe_session_id = $3`,
    [userId, productId, sessionId],
  );
  if (p.rows.length === 0) {
    throw new Error('No purchases row created for this session');
  }
  if (p.rows[0].status !== 'completed') {
    throw new Error(`Expected purchases.status='completed', got '${p.rows[0].status}'`);
  }
}

async function assertCheckoutSessionSynced(sessionId: string): Promise<void> {
  // stripe-replit-sync writes the event payload through to its mirrored
  // table. Allow a brief window for the sync to land.
  for (let i = 0; i < 10; i += 1) {
    const r = await pool.query(
      `SELECT id FROM stripe.checkout_sessions WHERE id = $1`,
      [sessionId],
    );
    if (r.rows.length > 0) return;
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(
    `stripe.checkout_sessions still missing ${sessionId} after 2.5s — webhook handler may not have synced it`,
  );
}

async function cleanup(stripe: Stripe): Promise<void> {
  if (KEEP_DATA) {
    console.log('  (TEST_KEEP_DATA=1, skipping cleanup)');
    return;
  }
  if (createdUserId) {
    // ON DELETE CASCADE clears user_entitlements + purchases + user_profiles
    await pool.query(`DELETE FROM users WHERE id = $1`, [createdUserId]);
  }
  if (createdCustomerId) {
    try {
      await stripe.customers.del(createdCustomerId);
    } catch {
      // ignore — Stripe test-mode cleanup is best-effort
    }
  }
}

async function main(): Promise<void> {
  console.log('Faultline Lab — Stripe purchase E2E test');
  console.log(`  catalog product: ${TEST_CATALOG_PRODUCT_ID}`);

  const stripe = await step('connect to Stripe (test mode via Replit Connector)', () =>
    getUncachableStripeClient(),
  );

  const product = await step(
    `look up ${TEST_CATALOG_PRODUCT_ID} in stripe.products / stripe.prices`,
    () => getCatalogProduct(),
  );

  const webhook = await step('read managed webhook secret from stripe._managed_webhooks', () =>
    getWebhookConfig(),
  );
  console.log(`    → ${webhook.url}`);

  const userId = await step('create test user row', () => createTestUser());
  await step('create test Stripe customer (test mode)', () =>
    createTestCustomer(stripe, userId),
  );

  const realSession = await step(
    'create real test-mode Checkout Session in Stripe',
    () =>
      createRealCheckoutSession(stripe, {
        customerId: createdCustomerId!,
        priceId: product.stripePriceId,
        userId,
        clerkId: `test_clerk_${userId}`,
        catalogProductId: TEST_CATALOG_PRODUCT_ID,
      }),
  );
  const sessionId = realSession.id;
  syntheticSessionId = sessionId;

  const event = {
    id: `evt_test_${randomUUID().replace(/-/g, '')}`,
    object: 'event',
    api_version: '2025-08-27.basil',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        ...realSession,
        amount_total: product.unitAmount,
        currency: product.currency,
        payment_intent: `pi_test_e2e_${randomUUID().replace(/-/g, '')}`,
        payment_status: 'paid',
        status: 'complete',
      },
    },
  };

  const res = await step('POST signed checkout.session.completed to webhook', () =>
    postSignedWebhook(webhook.url, webhook.secret, event),
  );
  if (res.status !== 200) {
    throw new Error(`Webhook returned HTTP ${res.status}: ${res.body}`);
  }

  await step('verify user_entitlements row created', () =>
    assertEntitlementGranted(userId, TEST_CATALOG_PRODUCT_ID),
  );
  await step('verify purchases row created', () =>
    assertPurchaseRecorded(userId, TEST_CATALOG_PRODUCT_ID, sessionId),
  );
  await step('verify stripe.checkout_sessions row synced', () =>
    assertCheckoutSessionSynced(sessionId),
  );

  console.log('\nAll checks passed.');
}

main()
  .then(async () => {
    const stripe = await getUncachableStripeClient().catch(() => null);
    if (stripe) await cleanup(stripe);
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\nE2E FAILED:', err?.message || err);
    try {
      const stripe = await getUncachableStripeClient();
      await cleanup(stripe);
    } catch {
      // ignore
    }
    await pool.end();
    process.exit(1);
  });
