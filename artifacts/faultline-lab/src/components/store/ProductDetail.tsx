import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import {
  CATALOG,
  formatPrice,
  type CatalogProduct,
} from '@/data/catalog';
import {
  getCasesByProductId,
  getCaseCountForProduct,
  getCaseCountLabelForProduct,
} from '@/data/caseCatalog';
import {
  getProductOwnershipStatus,
  addOwnedProduct,
  getBetterValueBundle,
  isCaseAccessible,
  hasEntitlement,
} from '@/lib/entitlements';
import { startStripeCheckout } from '@/lib/api';
import { toast } from 'sonner';
import { Check, ShoppingCart, Sparkles, Wand2 } from 'lucide-react';
import { ProductTag } from './ProductTag';
import { Block } from './helpers';

export function ProductDetail({
  product,
  onClose,
  onPurchased,
  reason,
  initialBillingInterval,
}: {
  product: CatalogProduct;
  onClose: () => void;
  onPurchased: () => void;
  reason?: string;
  initialBillingInterval?: 'month' | 'year';
}) {
  const status = getProductOwnershipStatus(product.id);
  const isOwned = status === 'owned';
  const isComingSoon = status === 'coming-soon';
  const isDisabled = status === 'disabled';
  const isSignedIn = useAppStore((s) => s.isSignedIn);
  const setView = useAppStore((s) => s.setView);
  const [purchasing, setPurchasing] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>(initialBillingInterval ?? 'month');
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
      // Mock-grant only when explicitly opted in (VITE_MOCK_BILLING=1) AND in a
      // dev build. This prevents accidental local grants when Stripe is
      // genuinely configured but a transient checkout error occurs, and ensures
      // production builds never short-circuit billing.
      const mockBillingEnabled =
        import.meta.env.DEV && import.meta.env.VITE_MOCK_BILLING === '1';
      if (mockBillingEnabled) {
        addOwnedProduct(product.id);
        toast.success(`${product.name} unlocked (mock billing)`, {
          description:
            'VITE_MOCK_BILLING=1 — granted locally without contacting Stripe.',
        });
        onPurchased();
        onClose();
      } else {
        toast.error('Checkout unavailable', {
          description:
            err instanceof Error && err.message
              ? err.message
              : 'This product is not available for purchase right now.',
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

          {reason && (
            <div className="mb-4 rounded-lg border border-cyan-700/40 bg-cyan-950/20 p-3 flex items-start gap-2">
              <Wand2 className="w-3.5 h-3.5 text-cyan-300 mt-0.5 shrink-0" />
              <p className="text-xs text-cyan-200 leading-relaxed">{reason}</p>
            </div>
          )}

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

          {(() => {
            const label = getCaseCountLabelForProduct(product.id);
            if (!label) return null;
            const { ready, planned, total } = getCaseCountForProduct(product.id);
            const cases = getCasesByProductId(product.id);
            const isPartial = planned > 0 && ready < total;
            return (
              <Block label={ready > 0 ? 'Pack contents' : 'Pack roadmap'}>
                <p className="text-sm text-zinc-400 mb-2">
                  {label}
                  {isPartial && (
                    <span className="block text-[11px] font-mono text-zinc-500 mt-1">
                      Remaining cases drop in as the pack ships.
                    </span>
                  )}
                </p>
                {cases.length > 0 && (
                  <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {cases.map((c) => {
                      const playable = c.status === 'playable';
                      const owned = isCaseAccessible(c.id);
                      return (
                        <li
                          key={c.id}
                          className="flex items-start gap-2 text-xs text-zinc-400"
                        >
                          <span
                            className={`mt-0.5 inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                              playable ? 'bg-cyan-400' : 'bg-purple-400/60'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-zinc-200">{c.title}</span>
                              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">
                                {c.difficulty} | {c.estimatedMinutes} min
                              </span>
                              {!playable && (
                                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300/80">
                                  In dev
                                </span>
                              )}
                              {playable && owned && (
                                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/80">
                                  Owned
                                </span>
                              )}
                              {playable && !owned && (
                                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                                  Locked
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">
                              {c.shortSummary}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Block>
            );
          })()}

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

