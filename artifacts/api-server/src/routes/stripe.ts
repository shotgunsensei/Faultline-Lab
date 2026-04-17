import { Router, type IRouter } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { getUncachableStripeClient } from '../stripeClient';
import { stripeStorage } from '../stripeStorage';
import { db } from '@workspace/db';
import { usersTable } from '@workspace/db/schema';
import { eq, sql } from 'drizzle-orm';

const router: IRouter = Router();

router.get('/products', async (_req, res) => {
  try {
    const rows = await stripeStorage.listProductsWithPrices();
    const productsMap = new Map();
    for (const row of rows) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          active: row.product_active,
          metadata: row.product_metadata,
          prices: []
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
          active: row.price_active,
        });
      }
    }
    res.json({ data: Array.from(productsMap.values()) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list products' });
  }
});

router.post('/checkout', requireAuth, async (req: any, res) => {
  try {
    const { priceId } = req.body;
    if (!priceId) {
      return res.status(400).json({ error: 'priceId is required' });
    }

    const clerkId = req.userId as string;
    const stripe = await getUncachableStripeClient();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
    if (!user) return res.status(404).json({ error: 'User profile not found' });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { userId: user.id, clerkId },
      });
      customerId = customer.id;
      await db.update(usersTable).set({ stripeCustomerId: customerId }).where(eq(usersTable.id, user.id));
    }

    const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost'}`;

    const price = await stripe.prices.retrieve(priceId);
    const mode = price.recurring ? 'subscription' : 'payment';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancel`,
      metadata: { userId: user.id, clerkId },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.post('/checkout-by-catalog', requireAuth, async (req: any, res) => {
  try {
    const { catalogProductId, interval } = req.body || {};
    if (!catalogProductId || typeof catalogProductId !== 'string') {
      return res.status(400).json({ error: 'catalogProductId required' });
    }
    if (interval && interval !== 'month' && interval !== 'year') {
      return res.status(400).json({ error: 'interval must be month or year' });
    }

    const clerkId = req.userId as string;
    const stripe = await getUncachableStripeClient();

    let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
    if (!user) {
      const id = (await import('crypto')).randomUUID();
      await db.insert(usersTable).values({
        id,
        clerkId,
        email: null,
        displayName: 'Investigator',
      });
      [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
      if (!user) return res.status(500).json({ error: 'Failed to provision user' });
    }

    const productRows = await db.execute(
      sql`SELECT id FROM stripe.products
          WHERE active = true
            AND metadata->>'catalogId' = ${catalogProductId}
          LIMIT 1`
    );
    const stripeProductId = productRows.rows[0]?.id as string | undefined;
    if (!stripeProductId) {
      return res.status(404).json({ error: 'Product not configured in Stripe' });
    }

    const priceRows = await db.execute(
      sql`SELECT id, unit_amount, currency, recurring
          FROM stripe.prices
          WHERE product = ${stripeProductId} AND active = true`
    );
    const prices = priceRows.rows as Array<{
      id: string;
      unit_amount: number | null;
      currency: string;
      recurring: any;
    }>;
    if (prices.length === 0) {
      return res.status(404).json({ error: 'No active prices for product' });
    }

    let chosen = prices.find((p) => {
      const r = p.recurring;
      const intervalVal = typeof r === 'string' ? JSON.parse(r)?.interval : r?.interval;
      if (interval === 'year') return intervalVal === 'year';
      if (interval === 'month') return intervalVal === 'month';
      return !r;
    });
    if (!chosen) chosen = prices[0];

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { userId: user.id, clerkId },
      });
      customerId = customer.id;
      await db.update(usersTable).set({ stripeCustomerId: customerId }).where(eq(usersTable.id, user.id));
    }

    const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost'}`;
    const recurringRaw = chosen.recurring;
    const recurringObj = typeof recurringRaw === 'string' ? JSON.parse(recurringRaw) : recurringRaw;
    const mode = recurringObj ? 'subscription' : 'payment';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: chosen.id, quantity: 1 }],
      mode,
      success_url: `${baseUrl}/?checkout=success&product=${encodeURIComponent(catalogProductId)}`,
      cancel_url: `${baseUrl}/?checkout=cancel`,
      metadata: { userId: user.id, clerkId, catalogProductId, interval: interval || '' },
      ...(mode === 'subscription'
        ? { subscription_data: { metadata: { userId: user.id, clerkId, catalogProductId, interval: interval || '' } } }
        : { payment_intent_data: { metadata: { userId: user.id, clerkId, catalogProductId, interval: interval || '' } } }),
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('checkout-by-catalog error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.get('/subscription', requireAuth, async (req: any, res) => {
  try {
    const clerkId = req.userId as string;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));

    if (!user?.stripeSubscriptionId) {
      return res.json({ subscription: null });
    }

    const subscription = await stripeStorage.getSubscription(user.stripeSubscriptionId);
    res.json({ subscription });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

export default router;
