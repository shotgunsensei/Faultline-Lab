import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import {
  CATALOG,
  FREE_FEATURES,
  PRO_FEATURES,
  formatPrice,
  type CatalogProduct,
} from '@/data/catalog';
import {
  hasEntitlement,
  getEntitlements,
  subscribeEntitlements,
} from '@/lib/entitlements';
import EcosystemFooter from './EcosystemFooter';
import { ArrowLeft, Check, Minus, Crown, Layers, Sparkles } from 'lucide-react';

function useEntitlementsTick() {
  return useSyncExternalStore(
    (cb) => subscribeEntitlements(cb),
    () => getEntitlements(),
  );
}

const FEATURE_LABELS: Record<string, { label: string; helper?: string }> = {
  'standard-tools': {
    label: 'Standard diagnostic tools',
    helper: 'Terminal, evidence pinning, scoring engine',
  },
  'local-progress': { label: 'Local progress tracking' },
  'guest-mode': { label: 'Play without an account' },
  'cloud-sync': {
    label: 'Cloud sync across devices',
    helper: 'Resume an investigation from any browser',
  },
  'daily-challenge': {
    label: 'Daily challenge rotation',
    helper: 'A new scored case every day',
  },
  'full-archive': {
    label: 'Full case archive access',
    helper: 'Every active case across every pack',
  },
  'advanced-stats': {
    label: 'Advanced investigator stats',
    helper: 'Per-category mastery and time-to-diagnosis trends',
  },
  'priority-access': { label: 'Priority access to new packs' },
  'wireshark-panel': {
    label: 'Advanced Tool Suite',
    helper: 'Wireshark, registry deep-dive, service graph, metric overlays',
  },
  'chaos-mode': {
    label: 'Chaos Mode',
    helper: 'Randomized evidence, red herrings, time pressure',
  },
  'deep-telemetry': { label: 'Deep Telemetry' },
  'sandbox-pro': {
    label: 'Sandbox Pro authoring',
    helper: 'Build and share your own scenarios',
  },
  'pro-analytics': { label: 'Pro Investigator Analytics' },
};

const ADVANCED_FEATURE_GROUP_KEYS = new Set([
  'wireshark-panel',
  'registry-deep-dive',
  'service-graph',
  'metric-overlay',
]);

interface FeatureRow {
  key: string;
  label: string;
  helper?: string;
  free: boolean;
  pro: boolean;
  bundle: boolean;
}

function buildFeatureRows(): FeatureRow[] {
  const bundleProduct = CATALOG.find((p) => p.id === 'bundle-master-investigator');
  const bundledIds = new Set(bundleProduct?.bundledProductIds ?? []);

  const bundleFeatures = new Set<string>();
  if (bundleProduct) {
    for (const inner of bundleProduct.bundledProductIds ?? []) {
      const innerProduct = CATALOG.find((p) => p.id === inner);
      for (const f of innerProduct?.includedFeatures ?? []) {
        bundleFeatures.add(f);
      }
    }
  }

  const proFeatures = new Set<string>(PRO_FEATURES);
  const freeFeatures = new Set<string>(FREE_FEATURES);
  // Anything Pro entitles, the bundle (which includes Pro) also entitles.
  for (const f of proFeatures) bundleFeatures.add(f);
  for (const f of freeFeatures) bundleFeatures.add(f);

  // Order: starter cases, free features, pro features, bundle-only features,
  // then a derived "every general content pack" row for the bundle.
  const orderedKeys: string[] = [
    'starter-cases',
    ...FREE_FEATURES,
    ...PRO_FEATURES,
    'wireshark-panel',
    'chaos-mode',
    'deep-telemetry',
    'sandbox-pro',
    'pro-analytics',
    'general-packs',
  ];

  const rows: FeatureRow[] = [];
  for (const key of orderedKeys) {
    if (key === 'starter-cases') {
      rows.push({
        key,
        label: 'Hand-crafted starter cases',
        helper: '4 included, free forever',
        free: true,
        pro: true,
        bundle: true,
      });
      continue;
    }
    if (key === 'general-packs') {
      const generalPackIds = (bundleProduct?.bundledProductIds ?? []).filter((id) => {
        const p = CATALOG.find((cp) => cp.id === id);
        return p?.entitlementType === 'content-pack';
      });
      if (generalPackIds.length === 0) continue;
      rows.push({
        key,
        label: 'Every general content pack included',
        helper: `${generalPackIds.length} packs across networking, servers, automotive, IoT, and cascades`,
        free: false,
        pro: false,
        bundle: true,
      });
      continue;
    }
    // Skip the duplicate sub-feature rows that roll up into Advanced Tool Suite
    if (ADVANCED_FEATURE_GROUP_KEYS.has(key) && key !== 'wireshark-panel') continue;
    const meta = FEATURE_LABELS[key];
    if (!meta) continue;
    rows.push({
      key,
      label: meta.label,
      helper: meta.helper,
      free: freeFeatures.has(key),
      pro: freeFeatures.has(key) || proFeatures.has(key),
      bundle:
        freeFeatures.has(key) ||
        proFeatures.has(key) ||
        bundleFeatures.has(key) ||
        // Advanced tool sub-features are bundled via upgrade-advanced-tools
        (key === 'wireshark-panel' && bundledIds.has('upgrade-advanced-tools')),
    });
  }
  return rows;
}

type TierKey = 'free' | 'pro' | 'bundle';

function Cell({ on }: { on: boolean }) {
  return on ? (
    <Check className="w-4 h-4 text-emerald-400 inline-block" aria-label="Included" />
  ) : (
    <Minus className="w-4 h-4 text-zinc-600 inline-block" aria-label="Not included" />
  );
}

export default function PricingScreen() {
  const setView = useAppStore((s) => s.setView);
  const openStoreWithProduct = useAppStore((s) => s.openStoreWithProduct);
  const pricingIntroActive = useAppStore((s) => s.pricingIntroActive);
  const setPricingIntroActive = useAppStore((s) => s.setPricingIntroActive);
  useEntitlementsTick();
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');

  useEffect(() => {
    return () => {
      if (useAppStore.getState().pricingIntroActive) {
        useAppStore.getState().setPricingIntroActive(false);
      }
    };
  }, []);

  const proProduct = CATALOG.find((p) => p.id === 'pro-subscription') as CatalogProduct;
  const bundleProduct = CATALOG.find((p) => p.id === 'bundle-master-investigator') as CatalogProduct;
  const isProOwned = hasEntitlement('pro-subscription');
  const isBundleOwned = hasEntitlement('bundle-master-investigator');
  const bundleAvailable = bundleProduct?.status === 'available';

  const featureRows = useMemo(() => buildFeatureRows(), []);

  const proPriceLabel =
    billingInterval === 'year' && proProduct.yearlyPriceAmountCents
      ? `${formatPrice(proProduct.yearlyPriceAmountCents)}/yr`
      : `${formatPrice(proProduct.priceAmountCents)}/mo`;

  const proPerMonthEquivalent =
    billingInterval === 'year' && proProduct.yearlyPriceAmountCents
      ? `≈ ${formatPrice(Math.round(proProduct.yearlyPriceAmountCents / 12))}/mo billed yearly`
      : 'Billed monthly. Cancel anytime.';

  const onChooseFree = () => setView('incident-board');
  const onChoosePro = () =>
    openStoreWithProduct('pro-subscription', 'pricing-page', billingInterval);
  const onChooseBundle = () =>
    openStoreWithProduct('bundle-master-investigator', 'pricing-page');

  return (
    <div className="min-h-screen bg-[#0a0e14] text-zinc-100">
      <header className="border-b border-zinc-800/60 bg-zinc-900/50 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => setView('incident-board')}
            className="text-zinc-400 hover:text-cyan-400 transition-colors p-1"
            aria-label="Back to Incident Board"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold font-mono tracking-wide text-cyan-400">PRICING</h1>
            <p className="text-xs text-zinc-500">Compare tiers side-by-side</p>
          </div>
          <button
            onClick={() => setView('store')}
            className="text-xs font-mono uppercase tracking-wider text-zinc-400 hover:text-cyan-300 transition-colors px-3 py-1.5 rounded border border-zinc-700 hover:border-cyan-500/40"
          >
            Browse store ›
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10 pb-24">
        {pricingIntroActive && (
          <section
            role="status"
            aria-live="polite"
            className="max-w-3xl mx-auto rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 via-zinc-900/40 to-zinc-900/20 px-4 py-4 sm:px-5 sm:py-4 flex items-start gap-3"
          >
            <Sparkles className="w-5 h-5 text-cyan-300 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm text-cyan-200 uppercase tracking-wider">
                Welcome to Faultline Lab
              </div>
              <p className="text-sm text-zinc-300 mt-1 leading-relaxed">
                Pick the plan that fits your investigation cadence — or continue free
                with the four hand-crafted starter cases. You can upgrade any time.
              </p>
            </div>
            <button
              onClick={() => setPricingIntroActive(false)}
              className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 hover:text-cyan-300 transition-colors px-2 py-1 rounded border border-zinc-700 hover:border-cyan-500/40 shrink-0"
              aria-label="Dismiss welcome banner"
            >
              Dismiss
            </button>
          </section>
        )}
        <section className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="font-mono text-2xl sm:text-3xl text-zinc-100 tracking-tight">
            Pick the tier that fits your investigation cadence.
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Faultline Lab is free to start. Upgrade when you want every case unlocked,
            cross-device sync, or every premium tool in one shot.
          </p>
          <div className="inline-flex items-center gap-1 p-1 rounded-md bg-zinc-900/60 border border-zinc-800">
            <button
              onClick={() => setBillingInterval('month')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-colors ${
                billingInterval === 'month'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
              aria-pressed={billingInterval === 'month'}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('year')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-colors flex items-center gap-2 ${
                billingInterval === 'year'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
              aria-pressed={billingInterval === 'year'}
            >
              Yearly
              <span className="text-[10px] text-emerald-400">save ~27%</span>
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <TierCard
            tier="free"
            title="Free"
            price="$0"
            cadence="Forever"
            tagline="Get the rhythm with 4 starter cases and the standard toolkit."
            cta="Continue free"
            disabled={false}
            onClick={onChooseFree}
            highlight={false}
            ownedLabel={null}
          />
          <TierCard
            tier="pro"
            title={proProduct.name}
            price={proPriceLabel}
            cadence={proPerMonthEquivalent}
            tagline={proProduct.shortDescription}
            cta={isProOwned ? 'Active' : 'Subscribe'}
            disabled={isProOwned}
            onClick={onChoosePro}
            highlight
            ownedLabel={isProOwned ? 'You are here' : null}
          />
          <TierCard
            tier="bundle"
            title={bundleProduct.name}
            price={formatPrice(bundleProduct.priceAmountCents)}
            cadence="One-time, lifetime access to everything"
            tagline={bundleProduct.shortDescription}
            cta={
              isBundleOwned
                ? 'Owned'
                : bundleAvailable
                  ? 'Get bundle'
                  : 'Coming soon'
            }
            disabled={isBundleOwned || !bundleAvailable}
            onClick={onChooseBundle}
            highlight={false}
            ownedLabel={isBundleOwned ? 'You are here' : null}
          />
        </section>

        <section>
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Feature comparison
          </h3>
          <div className="overflow-x-auto rounded-lg border border-zinc-800/80 bg-zinc-900/40">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                  <th className="text-left px-4 py-3 font-normal">Feature</th>
                  <th className="px-4 py-3 font-normal text-zinc-300">Free</th>
                  <th className="px-4 py-3 font-normal text-cyan-300">Pro</th>
                  <th className="px-4 py-3 font-normal text-amber-300">Bundle</th>
                </tr>
              </thead>
              <tbody>
                {featureRows.map((row, i) => (
                  <tr
                    key={row.key}
                    className={i % 2 === 0 ? 'bg-zinc-900/20' : ''}
                  >
                    <td className="px-4 py-3">
                      <div className="text-zinc-200">{row.label}</div>
                      {row.helper && (
                        <div className="text-[11px] text-zinc-500 mt-0.5">{row.helper}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center"><Cell on={row.free} /></td>
                    <td className="px-4 py-3 text-center"><Cell on={row.pro} /></td>
                    <td className="px-4 py-3 text-center"><Cell on={row.bundle} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-zinc-600 mt-3 font-mono">
            Looking for à la carte content packs or a single feature upgrade? Browse the{' '}
            <button
              onClick={() => setView('store')}
              className="text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline"
            >
              store
            </button>{' '}
            for individual SKUs.
          </p>
        </section>
      </main>

      <EcosystemFooter />
    </div>
  );
}

function TierCard({
  tier,
  title,
  price,
  cadence,
  tagline,
  cta,
  disabled,
  highlight,
  onClick,
  ownedLabel,
}: {
  tier: TierKey;
  title: string;
  price: string;
  cadence: string;
  tagline: string;
  cta: string;
  disabled: boolean;
  highlight: boolean;
  onClick: () => void;
  ownedLabel: string | null;
}) {
  const accent =
    tier === 'pro'
      ? 'border-cyan-500/40 bg-gradient-to-br from-cyan-950/40 via-zinc-900/60 to-zinc-900/30'
      : tier === 'bundle'
        ? 'border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-zinc-900/60 to-zinc-900/30'
        : 'border-zinc-800 bg-zinc-900/40';
  const textAccent =
    tier === 'pro'
      ? 'text-cyan-300'
      : tier === 'bundle'
        ? 'text-amber-300'
        : 'text-zinc-300';
  const ctaClass = disabled
    ? 'bg-zinc-800/60 text-zinc-500 border-zinc-700 cursor-not-allowed'
    : tier === 'pro'
      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
      : tier === 'bundle'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
        : 'bg-zinc-800/60 text-zinc-200 border-zinc-700 hover:bg-zinc-800';
  const Icon = tier === 'bundle' ? Layers : tier === 'pro' ? Crown : Sparkles;

  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 ${accent} ${
        highlight ? 'ring-1 ring-cyan-500/30' : ''
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-cyan-200 bg-cyan-500/20 border border-cyan-500/40 rounded">
          Most popular
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${textAccent}`} />
        <h3 className={`font-mono uppercase tracking-wider text-sm ${textAccent}`}>{title}</h3>
        {ownedLabel && (
          <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded">
            {ownedLabel}
          </span>
        )}
      </div>
      <div className="font-mono text-3xl text-zinc-100 mb-1">{price}</div>
      <div className="text-[11px] text-zinc-500 mb-4">{cadence}</div>
      <p className="text-sm text-zinc-400 leading-relaxed mb-6 flex-1">{tagline}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full py-2.5 text-xs font-mono uppercase tracking-wider rounded border transition-colors ${ctaClass}`}
      >
        {cta}
      </button>
    </div>
  );
}
