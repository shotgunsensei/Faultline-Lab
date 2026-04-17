import { useState, useSyncExternalStore } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import {
  CATALOG,
  formatPrice,
  getProductsBySection,
  type CatalogProduct,
} from '@/data/catalog';
import {
  getProductOwnershipStatus,
  hasEntitlement,
  addOwnedProduct,
  getOwnedProducts,
  subscribeEntitlements,
  getEntitlements,
  getBetterValueBundle,
} from '@/lib/entitlements';
import { recommendProducts } from '@/lib/recommendations';
import { startStripeCheckout } from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Crown,
  Package,
  Zap,
  Layers,
  Check,
  Star,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Wand2,
  ShieldCheck,
} from 'lucide-react';

function useEntitlementsTick() {
  return useSyncExternalStore(
    (cb) => subscribeEntitlements(cb),
    () => getEntitlements()
  );
}

function ProductTag({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    new: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    popular: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    advanced: 'bg-red-500/20 text-red-400 border-red-500/30',
    'best-value': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    specialty: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  };
  return (
    <span
      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
        colors[tag] || 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30'
      }`}
    >
      {tag.replace('-', ' ')}
    </span>
  );
}

function categoryIcon(category: string) {
  switch (category) {
    case 'tier':
      return <Crown className="w-5 h-5" />;
    case 'content-pack':
      return <Package className="w-5 h-5" />;
    case 'feature-upgrade':
      return <Zap className="w-5 h-5" />;
    case 'bundle':
      return <Layers className="w-5 h-5" />;
    default:
      return <Package className="w-5 h-5" />;
  }
}

function ctaLabel(
  product: CatalogProduct,
  isOwned: boolean,
  isComingSoon: boolean,
  isDisabled: boolean = false
): string {
  if (isOwned) return 'Owned';
  if (isDisabled) return 'Unavailable';
  if (isComingSoon) return 'Coming soon';
  if (product.pricingType === 'free') return 'Get started';
  if (product.pricingType.startsWith('subscription')) return `Subscribe`;
  return 'Buy';
}

function ProductCard({
  product,
  onSelect,
  reason,
}: {
  product: CatalogProduct;
  onSelect: (p: CatalogProduct) => void;
  reason?: string;
}) {
  const status = getProductOwnershipStatus(product.id);
  const isOwned = status === 'owned';
  const isComingSoon = status === 'coming-soon';
  const isDisabled = status === 'disabled';

  return (
    <button
      onClick={() => onSelect(product)}
      className={`w-full text-left rounded-xl border transition-all duration-200 overflow-hidden group
        ${
          isOwned
            ? 'bg-cyan-950/20 border-cyan-800/40 hover:border-cyan-600/60'
            : isDisabled
              ? 'bg-zinc-900/40 border-zinc-800/40 opacity-60'
              : isComingSoon
                ? 'bg-zinc-900/50 border-zinc-800/40 hover:border-zinc-700/60 opacity-80'
                : 'bg-zinc-900/80 border-zinc-800/60 hover:border-cyan-600/60 hover:bg-zinc-900'
        }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2 rounded-lg shrink-0 ${
                isOwned ? 'bg-cyan-500/10 text-cyan-400' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {categoryIcon(product.category)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-zinc-100 text-sm sm:text-base truncate">
                  {product.name}
                </h3>
                {product.tags.map((tag) => (
                  <ProductTag key={tag} tag={tag} />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 line-clamp-2">
                {product.shortDescription}
              </p>
              {reason && (
                <p className="text-[11px] text-cyan-300/80 mt-1.5 italic line-clamp-2">{reason}</p>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            {isOwned ? (
              <span className="flex items-center gap-1 text-cyan-400 text-xs font-mono">
                <Check className="w-4 h-4" />
                Owned
              </span>
            ) : isDisabled ? (
              <span className="text-zinc-500 text-xs font-mono">Unavailable</span>
            ) : isComingSoon ? (
              <span className="text-zinc-500 text-xs font-mono">Coming soon</span>
            ) : (
              <span className="text-cyan-400 font-mono font-bold text-sm">
                {product.pricingType === 'free' ? 'Free' : formatPrice(product.priceAmountCents)}
              </span>
            )}
          </div>
        </div>
        {product.pricingType === 'subscription-monthly' && !isOwned && !isComingSoon && !isDisabled && (
          <div className="mt-2 text-[11px] text-zinc-500 font-mono">
            {formatPrice(product.priceAmountCents)}/mo or{' '}
            {formatPrice(product.yearlyPriceAmountCents || 0)}/yr
          </div>
        )}
        <div className="mt-3 text-[11px] font-mono uppercase tracking-wider text-zinc-500 group-hover:text-cyan-400 transition-colors">
          {ctaLabel(product, isOwned, isComingSoon, isDisabled)}{' '}
          {!isOwned && !isComingSoon && !isDisabled && <span aria-hidden>›</span>}
        </div>
      </div>
    </button>
  );
}

function ProductDetail({
  product,
  onClose,
  onPurchased,
}: {
  product: CatalogProduct;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const status = getProductOwnershipStatus(product.id);
  const isOwned = status === 'owned';
  const isComingSoon = status === 'coming-soon';
  const isDisabled = status === 'disabled';
  const isSignedIn = useAppStore((s) => s.isSignedIn);
  const setView = useAppStore((s) => s.setView);
  const [purchasing, setPurchasing] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const bundle = getBetterValueBundle(product.id);

  const handlePurchase = async () => {
    if (isDisabled || isComingSoon || isOwned) return;
    if (!isSignedIn && import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
      onClose();
      setView('auth');
      return;
    }

    setPurchasing(true);

    if (product.pricingType === 'free') {
      addOwnedProduct(product.id);
      setPurchasing(false);
      toast.success(`${product.name} unlocked`, {
        description: 'You now have access to the included content.',
      });
      onPurchased();
      onClose();
      return;
    }

    try {
      const interval =
        product.pricingType === 'subscription-monthly' && billingInterval === 'year'
          ? 'year'
          : product.pricingType.startsWith('subscription')
            ? 'month'
            : undefined;
      const { url } = await startStripeCheckout(product.id, interval);
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (err) {
      if (import.meta.env.DEV) {
        addOwnedProduct(product.id);
        toast.success(`${product.name} unlocked (dev)`, {
          description: 'Stripe is not configured — granted locally for development.',
        });
        onPurchased();
        onClose();
      } else {
        toast.error('Checkout unavailable', {
          description: 'This product is not available for purchase right now.',
        });
      }
    } finally {
      setPurchasing(false);
    }
  };

  const includedItems = (product.bundledProductIds || [])
    .map((id) => CATALOG.find((p) => p.id === id))
    .filter((p): p is CatalogProduct => !!p);

  const related = (product.relatedProductIds || [])
    .map((id) => CATALOG.find((p) => p.id === id))
    .filter((p): p is CatalogProduct => !!p);

  let ctaText = 'Purchase';
  let priceLabel = formatPrice(product.priceAmountCents);
  if (product.pricingType === 'free') ctaText = 'Get started free';
  else if (product.pricingType.startsWith('subscription')) {
    const usingYearly = billingInterval === 'year' && product.yearlyPriceAmountCents;
    priceLabel = usingYearly
      ? `${formatPrice(product.yearlyPriceAmountCents!)}/yr`
      : `${formatPrice(product.priceAmountCents)}/mo`;
    ctaText = `Subscribe — ${priceLabel}`;
  } else {
    ctaText = `Purchase — ${formatPrice(product.priceAmountCents)}`;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-3 gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-xl font-bold text-zinc-100">{product.name}</h2>
                {product.tags.map((tag) => (
                  <ProductTag key={tag} tag={tag} />
                ))}
              </div>
              <p className="text-sm text-zinc-400 capitalize">
                {product.category.replace('-', ' ')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 text-xl leading-none p-2 -m-2"
            >
              &times;
            </button>
          </div>

          <p className="text-zinc-300 text-sm leading-relaxed mb-3">{product.longDescription}</p>
          {product.valueProposition && (
            <p className="text-xs text-cyan-300/90 italic border-l-2 border-cyan-500/40 pl-3 mb-5">
              {product.valueProposition}
            </p>
          )}

          {product.includedFeatures && product.includedFeatures.length > 0 && (
            <Block label="Included features">
              <div className="space-y-1.5">
                {product.includedFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="capitalize">{f.replace(/-/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </Block>
          )}

          {product.includedCaseIds && product.includedCaseIds.length > 0 && (
            <Block label="Included cases">
              <p className="text-sm text-zinc-400">
                {product.includedCaseIds.length} diagnostic scenarios
              </p>
            </Block>
          )}

          {product.caseCount && (!product.includedCaseIds || product.includedCaseIds.length === 0) && (
            <Block label="Pack contents">
              <p className="text-sm text-zinc-400">
                {product.caseCount} cases planned. Cases drop in as the pack ships.
              </p>
            </Block>
          )}

          {includedItems.length > 0 && (
            <Block label="Bundle contents">
              <div className="space-y-1.5">
                {includedItems.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm text-zinc-300">
                    <span className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      {b.name}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {b.pricingType === 'subscription-monthly'
                        ? `${formatPrice(b.priceAmountCents)}/mo`
                        : formatPrice(b.priceAmountCents)}
                    </span>
                  </div>
                ))}
              </div>
            </Block>
          )}

          {bundle && bundle.id !== product.id && !hasEntitlement(bundle.id) && (
            <Block label="Better value">
              <div className="rounded-lg border border-purple-700/40 bg-purple-950/20 p-3 text-xs text-zinc-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                <span>
                  <span className="font-semibold text-zinc-100">{bundle.name}</span> includes this and
                  more for <span className="font-mono text-purple-300">{formatPrice(bundle.priceAmountCents)}</span>.
                </span>
              </div>
            </Block>
          )}

          {related.length > 0 && (
            <Block label="Related products">
              <div className="grid gap-2">
                {related.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between text-xs text-zinc-400 border border-zinc-800/60 rounded-lg px-3 py-2"
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="text-zinc-500 font-mono shrink-0">
                      {hasEntitlement(r.id)
                        ? 'Owned'
                        : r.pricingType === 'free'
                          ? 'Free'
                          : formatPrice(r.priceAmountCents)}
                    </span>
                  </div>
                ))}
              </div>
            </Block>
          )}

          <div className="border-t border-zinc-800 pt-4 mt-4">
            {isOwned ? (
              <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm justify-center py-2">
                <Check className="w-5 h-5" />
                You own this
              </div>
            ) : isDisabled ? (
              <div className="text-center py-2">
                <p className="text-zinc-400 font-mono text-sm">Unavailable</p>
                <p className="text-zinc-600 text-xs mt-1">
                  This product is not currently available for purchase.
                </p>
              </div>
            ) : isComingSoon ? (
              <div className="text-center py-2">
                <p className="text-zinc-400 font-mono text-sm">Coming soon</p>
                <p className="text-zinc-600 text-xs mt-1">This content is in development</p>
              </div>
            ) : (
              <>
                {product.pricingType === 'subscription-monthly' && product.yearlyPriceAmountCents && (
                  <div className="flex items-center justify-center gap-2 mb-3">
                    {(['month', 'year'] as const).map((interval) => (
                      <button
                        key={interval}
                        onClick={() => setBillingInterval(interval)}
                        className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors ${
                          billingInterval === interval
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/60'
                        }`}
                      >
                        {interval === 'month' ? 'Monthly' : 'Annual (save)'}
                      </button>
                    ))}
                  </div>
                )}
                {!isSignedIn && import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && (
                  <p className="text-xs text-zinc-500 text-center mb-3">Sign in to purchase</p>
                )}
                <button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:cursor-wait text-white font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {purchasing ? (
                    <span className="animate-pulse">Processing...</span>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      {!isSignedIn && import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
                        ? 'Sign in to purchase'
                        : ctaText}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h4 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">{label}</h4>
      {children}
    </div>
  );
}

function SectionHeader({
  icon,
  label,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  helper?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
      <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-2">
        {icon}
        {label}
      </h3>
      {helper && <span className="text-[11px] text-zinc-600">{helper}</span>}
    </div>
  );
}

export default function StoreScreen() {
  const setView = useAppStore((s) => s.setView);
  const profile = useAppStore((s) => s.profile);
  const toolUsageSignals = useAppStore((s) => s.toolUsageSignals);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  useEntitlementsTick();

  const featured = CATALOG.filter((p) => p.featured && p.status !== 'disabled');
  const plans = getProductsBySection('plan');
  const packs = getProductsBySection('content-pack');
  const upgrades = getProductsBySection('feature-upgrade');
  const bundles = getProductsBySection('bundle');
  const specialty = getProductsBySection('specialty');
  const owned = getOwnedProducts().filter((p) => p.id !== 'base-free');
  const recs = recommendProducts(profile, toolUsageSignals, 4);

  return (
    <div className="min-h-screen bg-[#0a0e14] text-zinc-100">
      <header className="border-b border-zinc-800/60 bg-zinc-900/50 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => setView('incident-board')}
            className="text-zinc-400 hover:text-cyan-400 transition-colors p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold font-mono tracking-wide text-cyan-400">STORE</h1>
            <p className="text-xs text-zinc-500">Expand your investigation toolkit</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-10 pb-24">
        {featured.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2">
            {featured.map((p) => {
              const isOwned = hasEntitlement(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className="text-left rounded-2xl border border-cyan-700/30 bg-gradient-to-br from-cyan-950/40 via-zinc-900/60 to-zinc-900/30 p-6 hover:border-cyan-500/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                      {categoryIcon(p.category)}
                    </div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-300/80">
                      Featured
                    </div>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-100 mb-1">{p.name}</h2>
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-4">{p.shortDescription}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400 font-mono font-bold">
                      {p.pricingType === 'subscription-monthly'
                        ? `${formatPrice(p.priceAmountCents)}/mo`
                        : formatPrice(p.priceAmountCents)}
                    </span>
                    <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 group-hover:text-cyan-300 transition-colors">
                      {isOwned ? 'Owned' : 'View ›'}
                    </span>
                  </div>
                </button>
              );
            })}
          </section>
        )}

        {recs.length > 0 && (
          <section>
            <SectionHeader
              icon={<Wand2 className="w-4 h-4 text-cyan-400" />}
              label="Recommended for you"
              helper="Based on your activity"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {recs.map((r) => (
                <ProductCard
                  key={r.product.id}
                  product={r.product}
                  onSelect={setSelectedProduct}
                  reason={r.reason}
                />
              ))}
            </div>
          </section>
        )}

        {owned.length > 0 && (
          <section>
            <SectionHeader
              icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
              label="Your library"
              helper={`${owned.length} owned`}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {owned.map((p) => (
                <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHeader icon={<Crown className="w-4 h-4 text-amber-400" />} label="Subscription plans" />
          <div className="grid gap-3">
            {plans.map((p) => (
              <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader
            icon={<Package className="w-4 h-4 text-emerald-400" />}
            label="Content packs"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {packs.map((p) => (
              <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader icon={<Zap className="w-4 h-4 text-violet-400" />} label="Feature upgrades" />
          <div className="grid gap-3 sm:grid-cols-2">
            {upgrades.map((p) => (
              <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />
            ))}
          </div>
        </section>

        {bundles.length > 0 && (
          <section>
            <SectionHeader icon={<Star className="w-4 h-4 text-purple-400" />} label="Bundles" />
            <div className="grid gap-3">
              {bundles.map((p) => (
                <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />
              ))}
            </div>
          </section>
        )}

        {specialty.length > 0 && (
          <section>
            <SectionHeader
              icon={<Stethoscope className="w-4 h-4 text-sky-400" />}
              label="Specialty"
              helper="Targeted vertical bundles"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {specialty.map((p) => (
                <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />
              ))}
            </div>
          </section>
        )}
      </main>

      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onPurchased={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
