import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log('Creating Faultline Lab products in Stripe...\n');

    const products = [
      {
        name: 'Pro Investigator',
        description: 'Full access with cloud sync, daily challenges, and advanced analytics.',
        metadata: { catalogId: 'pro-subscription', category: 'tier' },
        prices: [
          { amount: 999, interval: 'month' as const },
          { amount: 7999, interval: 'year' as const },
        ],
      },
      {
        name: 'Network Ops Pack',
        description: '5 networking and infrastructure diagnostic scenarios.',
        metadata: { catalogId: 'pack-network-ops', category: 'content-pack' },
        prices: [{ amount: 499 }],
      },
      {
        name: 'Server Graveyard Pack',
        description: '5 server and service failure investigations.',
        metadata: { catalogId: 'pack-server-graveyard', category: 'content-pack' },
        prices: [{ amount: 499 }],
      },
      {
        name: 'Garage Diagnostics Pack',
        description: '5 automotive diagnostic puzzles.',
        metadata: { catalogId: 'pack-garage-diagnostics', category: 'content-pack' },
        prices: [{ amount: 499 }],
      },
      {
        name: 'Sensor Mesh Pack',
        description: '5 IoT and embedded systems investigations.',
        metadata: { catalogId: 'pack-sensor-mesh', category: 'content-pack' },
        prices: [{ amount: 499 }],
      },
      {
        name: 'Mixed Cascades Pack',
        description: '5 cross-domain multi-system failure scenarios.',
        metadata: { catalogId: 'pack-mixed-cascades', category: 'content-pack' },
        prices: [{ amount: 699 }],
      },
      {
        name: 'Healthcare Imaging Pack',
        description: '5 medical imaging system diagnostic cases.',
        metadata: { catalogId: 'pack-healthcare-imaging', category: 'content-pack' },
        prices: [{ amount: 699 }],
      },
      {
        name: 'Advanced Tool Suite',
        description: 'Unlock Wireshark views, packet analysis, and advanced diagnostic panels.',
        metadata: { catalogId: 'upgrade-advanced-tools', category: 'feature-upgrade' },
        prices: [{ amount: 799 }],
      },
      {
        name: 'Chaos Mode',
        description: 'Randomized evidence order, red herring injection, time pressure.',
        metadata: { catalogId: 'upgrade-chaos-mode', category: 'feature-upgrade' },
        prices: [{ amount: 499 }],
      },
      {
        name: 'Deep Telemetry Pack',
        description: 'Detailed performance metrics and investigation analytics.',
        metadata: { catalogId: 'upgrade-deep-telemetry', category: 'feature-upgrade' },
        prices: [{ amount: 399 }],
      },
      {
        name: 'Sandbox Pro',
        description: 'Custom sandbox slots for creating your own diagnostic scenarios.',
        metadata: { catalogId: 'upgrade-sandbox-pro', category: 'feature-upgrade' },
        prices: [{ amount: 999 }],
      },
      {
        name: 'Master Investigator Bundle',
        description: 'Everything in Faultline Lab. All packs, all upgrades, Pro subscription.',
        metadata: { catalogId: 'bundle-master-investigator', category: 'bundle' },
        prices: [{ amount: 4999 }],
      },
    ];

    for (const prod of products) {
      const existing = await stripe.products.search({
        query: `name:'${prod.name}' AND active:'true'`,
      });

      if (existing.data.length > 0) {
        console.log(`  [skip] ${prod.name} already exists (${existing.data[0].id})`);
        continue;
      }

      const product = await stripe.products.create({
        name: prod.name,
        description: prod.description,
        metadata: prod.metadata,
      });
      console.log(`  [created] ${prod.name} (${product.id})`);

      for (const price of prod.prices) {
        const priceParams: any = {
          product: product.id,
          unit_amount: price.amount,
          currency: 'usd',
        };
        if ('interval' in price) {
          priceParams.recurring = { interval: price.interval };
        }
        const created = await stripe.prices.create(priceParams);
        const label = 'interval' in price ? `$${(price.amount / 100).toFixed(2)}/${price.interval}` : `$${(price.amount / 100).toFixed(2)} one-time`;
        console.log(`    [price] ${label} (${created.id})`);
      }
    }

    console.log('\nDone. Webhooks will sync this data to the database.');
  } catch (error: any) {
    console.error('Error creating products:', error.message);
    process.exit(1);
  }
}

createProducts();
