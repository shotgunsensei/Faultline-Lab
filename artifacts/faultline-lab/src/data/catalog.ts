export type EntitlementType = 'base' | 'subscription' | 'content-pack' | 'feature-upgrade' | 'bundle' | 'promo';
export type PricingType = 'free' | 'one-time' | 'subscription-monthly' | 'subscription-yearly';
export type ProductStatus = 'available' | 'coming-soon' | 'disabled';

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  entitlementType: EntitlementType;
  pricingType: PricingType;
  priceAmountCents: number;
  yearlyPriceAmountCents?: number;
  includedCaseIds?: string[];
  includedFeatures?: string[];
  bundledProductIds?: string[];
  tags: string[];
  status: ProductStatus;
  sortOrder: number;
  stripePriceId?: string;
  stripeYearlyPriceId?: string;
}

export const FREE_CASE_IDS = ['windows-ad-kerberos', 'automotive-alternator'];

export const CATALOG: CatalogProduct[] = [
  {
    id: 'base-free',
    name: 'Free Tier',
    slug: 'free',
    shortDescription: 'Get started with 2 starter cases and standard tools.',
    longDescription: 'Begin your investigation career with access to two hand-crafted diagnostic scenarios, standard terminal tools, and local progress tracking. No account required.',
    category: 'tier',
    entitlementType: 'base',
    pricingType: 'free',
    priceAmountCents: 0,
    includedCaseIds: FREE_CASE_IDS,
    includedFeatures: ['standard-tools', 'local-progress', 'guest-mode'],
    tags: [],
    status: 'available',
    sortOrder: 0,
  },
  {
    id: 'pro-subscription',
    name: 'Pro Investigator',
    slug: 'pro',
    shortDescription: 'Full access with cloud sync, daily challenges, and advanced analytics.',
    longDescription: 'Unlock the complete Faultline Lab experience. Cloud-synced progress across devices, daily challenge rotations, full case archive access, advanced investigator statistics, and priority access to new scenario packs as they release.',
    category: 'tier',
    entitlementType: 'subscription',
    pricingType: 'subscription-monthly',
    priceAmountCents: 999,
    yearlyPriceAmountCents: 7999,
    includedFeatures: ['cloud-sync', 'daily-challenge', 'full-archive', 'advanced-stats', 'priority-access'],
    tags: ['popular'],
    status: 'available',
    sortOrder: 1,
  },

  {
    id: 'pack-network-ops',
    name: 'Network Ops Pack',
    slug: 'network-ops',
    shortDescription: '5 networking and infrastructure diagnostic scenarios.',
    longDescription: 'Dive into complex networking failures spanning VPN tunnels, BGP route leaks, DNS poisoning, load balancer misconfigs, and firewall rule cascades. Each case features realistic packet captures and routing tables.',
    category: 'content-pack',
    entitlementType: 'content-pack',
    pricingType: 'one-time',
    priceAmountCents: 499,
    includedCaseIds: [],
    tags: ['new'],
    status: 'coming-soon',
    sortOrder: 10,
  },
  {
    id: 'pack-server-graveyard',
    name: 'Server Graveyard Pack',
    slug: 'server-graveyard',
    shortDescription: '5 server and service failure investigations.',
    longDescription: 'Investigate critical server failures including runaway processes, disk corruption, memory leaks, certificate expiration chains, and cascading microservice outages.',
    category: 'content-pack',
    entitlementType: 'content-pack',
    pricingType: 'one-time',
    priceAmountCents: 499,
    includedCaseIds: [],
    tags: [],
    status: 'coming-soon',
    sortOrder: 11,
  },
  {
    id: 'pack-garage-diagnostics',
    name: 'Garage Diagnostics Pack',
    slug: 'garage-diagnostics',
    shortDescription: '5 automotive diagnostic puzzles.',
    longDescription: 'Troubleshoot automotive systems from OBD-II codes to oscilloscope readings. Cases include intermittent misfires, CAN bus interference, hybrid battery degradation, and transmission solenoid failures.',
    category: 'content-pack',
    entitlementType: 'content-pack',
    pricingType: 'one-time',
    priceAmountCents: 499,
    includedCaseIds: [],
    tags: [],
    status: 'coming-soon',
    sortOrder: 12,
  },
  {
    id: 'pack-sensor-mesh',
    name: 'Sensor Mesh Pack',
    slug: 'sensor-mesh',
    shortDescription: '5 IoT and embedded systems investigations.',
    longDescription: 'Debug sensor networks, firmware glitches, and embedded systems failures. Cases span smart building HVAC loops, industrial PLC faults, mesh radio interference, and edge compute anomalies.',
    category: 'content-pack',
    entitlementType: 'content-pack',
    pricingType: 'one-time',
    priceAmountCents: 499,
    includedCaseIds: [],
    tags: [],
    status: 'coming-soon',
    sortOrder: 13,
  },
  {
    id: 'pack-mixed-cascades',
    name: 'Mixed Cascades Pack',
    slug: 'mixed-cascades',
    shortDescription: '5 cross-domain multi-system failure scenarios.',
    longDescription: 'The most challenging scenarios in Faultline Lab. Each case spans multiple technical domains where failures in one system cascade into another. Requires broad diagnostic skills and lateral thinking.',
    category: 'content-pack',
    entitlementType: 'content-pack',
    pricingType: 'one-time',
    priceAmountCents: 699,
    includedCaseIds: [],
    tags: ['advanced'],
    status: 'coming-soon',
    sortOrder: 14,
  },
  {
    id: 'pack-healthcare-imaging',
    name: 'Healthcare Imaging Pack',
    slug: 'healthcare-imaging',
    shortDescription: '5 medical imaging system diagnostic cases.',
    longDescription: 'Investigate failures in medical imaging systems including DICOM routing errors, PACS connectivity issues, modality calibration drift, and HL7 integration breakdowns.',
    category: 'content-pack',
    entitlementType: 'content-pack',
    pricingType: 'one-time',
    priceAmountCents: 699,
    includedCaseIds: [],
    tags: [],
    status: 'coming-soon',
    sortOrder: 15,
  },

  {
    id: 'upgrade-advanced-tools',
    name: 'Advanced Tool Suite',
    slug: 'advanced-tools',
    shortDescription: 'Unlock Wireshark views, packet analysis, and advanced diagnostic panels.',
    longDescription: 'Expand your investigation toolkit with advanced diagnostic panels including packet capture analysis, registry deep-dive, service dependency graphs, and real-time metric overlays.',
    category: 'feature-upgrade',
    entitlementType: 'feature-upgrade',
    pricingType: 'one-time',
    priceAmountCents: 799,
    includedFeatures: ['wireshark-panel', 'registry-deep-dive', 'service-graph', 'metric-overlay'],
    tags: [],
    status: 'coming-soon',
    sortOrder: 20,
  },
  {
    id: 'upgrade-chaos-mode',
    name: 'Chaos Mode',
    slug: 'chaos-mode',
    shortDescription: 'Randomized evidence order, red herring injection, time pressure.',
    longDescription: 'For seasoned investigators who want more challenge. Chaos Mode randomizes evidence availability, injects additional red herrings, adds time pressure, and reduces hint availability.',
    category: 'feature-upgrade',
    entitlementType: 'feature-upgrade',
    pricingType: 'one-time',
    priceAmountCents: 499,
    includedFeatures: ['chaos-mode'],
    tags: [],
    status: 'coming-soon',
    sortOrder: 21,
  },
  {
    id: 'upgrade-deep-telemetry',
    name: 'Deep Telemetry Pack',
    slug: 'deep-telemetry',
    shortDescription: 'Detailed performance metrics and investigation analytics.',
    longDescription: 'Track your diagnostic performance over time with detailed charts, heatmaps of your investigation patterns, efficiency metrics across categories, and comparative analytics against your own history.',
    category: 'feature-upgrade',
    entitlementType: 'feature-upgrade',
    pricingType: 'one-time',
    priceAmountCents: 399,
    includedFeatures: ['deep-telemetry'],
    tags: [],
    status: 'coming-soon',
    sortOrder: 22,
  },
  {
    id: 'upgrade-sandbox-pro',
    name: 'Sandbox Pro',
    slug: 'sandbox-pro',
    shortDescription: 'Custom sandbox slots for creating your own diagnostic scenarios.',
    longDescription: 'Build and share your own troubleshooting scenarios with Sandbox Pro. Create custom cases with your own terminal commands, event logs, and evidence chains.',
    category: 'feature-upgrade',
    entitlementType: 'feature-upgrade',
    pricingType: 'one-time',
    priceAmountCents: 999,
    includedFeatures: ['sandbox-pro'],
    tags: [],
    status: 'coming-soon',
    sortOrder: 23,
  },

  {
    id: 'bundle-master-investigator',
    name: 'Master Investigator Bundle',
    slug: 'master-investigator',
    shortDescription: 'Everything in Faultline Lab. All packs, all upgrades, Pro subscription.',
    longDescription: 'The ultimate package. Includes Pro Investigator subscription, all current and future content packs, every feature upgrade, and exclusive Master Investigator badge.',
    category: 'bundle',
    entitlementType: 'bundle',
    pricingType: 'one-time',
    priceAmountCents: 4999,
    bundledProductIds: [
      'pro-subscription',
      'pack-network-ops',
      'pack-server-graveyard',
      'pack-garage-diagnostics',
      'pack-sensor-mesh',
      'pack-mixed-cascades',
      'pack-healthcare-imaging',
      'upgrade-advanced-tools',
      'upgrade-chaos-mode',
      'upgrade-deep-telemetry',
      'upgrade-sandbox-pro',
    ],
    tags: ['best-value'],
    status: 'coming-soon',
    sortOrder: 30,
  },
];

export function getProduct(id: string): CatalogProduct | undefined {
  return CATALOG.find(p => p.id === id);
}

export function getProductsByCategory(category: string): CatalogProduct[] {
  return CATALOG.filter(p => p.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getAvailableProducts(): CatalogProduct[] {
  return CATALOG.filter(p => p.status !== 'disabled').sort((a, b) => a.sortOrder - b.sortOrder);
}
