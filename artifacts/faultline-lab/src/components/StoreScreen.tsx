import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { CATALOG, getProductsByCategory, type CatalogProduct } from '@/data/catalog';
import { getProductOwnershipStatus, hasEntitlement } from '@/lib/entitlements';
import {
  ArrowLeft,
  Crown,
  Package,
  Zap,
  Layers,
  Lock,
  Check,
  Star,
  ChevronRight,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ProductTag({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    'new': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'popular': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'advanced': 'bg-red-500/20 text-red-400 border-red-500/30',
    'best-value': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  return (
    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${colors[tag] || 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30'}`}>
      {tag.replace('-', ' ')}
    </span>
  );
}

function ProductCard({ product, onSelect }: { product: CatalogProduct; onSelect: (p: CatalogProduct) => void }) {
  const status = getProductOwnershipStatus(product.id);
  const isOwned = status === 'owned';
  const isComingSoon = status === 'coming-soon';

  const categoryIcons: Record<string, React.ReactNode> = {
    'tier': <Crown className="w-5 h-5" />,
    'content-pack': <Package className="w-5 h-5" />,
    'feature-upgrade': <Zap className="w-5 h-5" />,
    'bundle': <Layers className="w-5 h-5" />,
  };

  return (
    <button
      onClick={() => onSelect(product)}
      className={`w-full text-left rounded-xl border transition-all duration-200 overflow-hidden group
        ${isOwned
          ? 'bg-cyan-950/20 border-cyan-800/40 hover:border-cyan-600/60'
          : isComingSoon
            ? 'bg-zinc-900/50 border-zinc-800/40 hover:border-zinc-700/60 opacity-75'
            : 'bg-zinc-900/80 border-zinc-800/60 hover:border-cyan-600/60 hover:bg-zinc-900'
        }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${isOwned ? 'bg-cyan-500/10 text-cyan-400' : 'bg-zinc-800 text-zinc-400'}`}>
              {categoryIcons[product.category] || <Package className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-zinc-100 text-sm sm:text-base truncate">{product.name}</h3>
                {product.tags.map(tag => (
                  <ProductTag key={tag} tag={tag} />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 line-clamp-2">{product.shortDescription}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            {isOwned ? (
              <span className="flex items-center gap-1 text-cyan-400 text-xs font-mono">
                <Check className="w-4 h-4" />
                Owned
              </span>
            ) : isComingSoon ? (
              <span className="text-zinc-500 text-xs font-mono">Soon</span>
            ) : (
              <span className="text-cyan-400 font-mono font-bold text-sm">
                {product.pricingType === 'free' ? 'Free' : formatPrice(product.priceAmountCents)}
              </span>
            )}
          </div>
        </div>
        {product.pricingType === 'subscription-monthly' && !isOwned && !isComingSoon && (
          <div className="mt-2 text-[11px] text-zinc-500 font-mono">
            {formatPrice(product.priceAmountCents)}/mo or {formatPrice(product.yearlyPriceAmountCents || 0)}/yr
          </div>
        )}
      </div>
    </button>
  );
}

function ProductDetail({ product, onClose }: { product: CatalogProduct; onClose: () => void }) {
  const status = getProductOwnershipStatus(product.id);
  const isOwned = status === 'owned';
  const isComingSoon = status === 'coming-soon';
  const isSignedIn = useAppStore(s => s.isSignedIn);
  const setView = useAppStore(s => s.setView);

  const handlePurchase = () => {
    if (!isSignedIn) {
      setView('auth');
      return;
    }
    alert('Purchase flow coming soon. Mock billing mode will be added with Stripe integration.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-zinc-100">{product.name}</h2>
                {product.tags.map(tag => <ProductTag key={tag} tag={tag} />)}
              </div>
              <p className="text-sm text-zinc-400 capitalize">{product.category.replace('-', ' ')}</p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none p-1">
              &times;
            </button>
          </div>

          <p className="text-zinc-300 text-sm leading-relaxed mb-6">{product.longDescription}</p>

          {product.includedFeatures && product.includedFeatures.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">Included Features</h4>
              <div className="space-y-1.5">
                {product.includedFeatures.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="capitalize">{f.replace(/-/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.includedCaseIds && product.includedCaseIds.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">Included Cases</h4>
              <p className="text-sm text-zinc-400">{product.includedCaseIds.length} diagnostic scenarios</p>
            </div>
          )}

          {product.bundledProductIds && product.bundledProductIds.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">Bundle Contents</h4>
              <div className="space-y-1.5">
                {product.bundledProductIds.map(id => {
                  const bundled = CATALOG.find(p => p.id === id);
                  return bundled ? (
                    <div key={id} className="flex items-center gap-2 text-sm text-zinc-300">
                      <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      {bundled.name}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          <div className="border-t border-zinc-800 pt-4 mt-4">
            {isOwned ? (
              <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm justify-center py-2">
                <Check className="w-5 h-5" />
                You own this
              </div>
            ) : isComingSoon ? (
              <div className="text-center py-2">
                <p className="text-zinc-400 font-mono text-sm">Coming Soon</p>
                <p className="text-zinc-600 text-xs mt-1">This content is in development</p>
              </div>
            ) : (
              <button
                onClick={handlePurchase}
                className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                {product.pricingType === 'free' ? 'Get Started Free' :
                 product.pricingType.startsWith('subscription') ? `Subscribe - ${formatPrice(product.priceAmountCents)}/mo` :
                 `Purchase - ${formatPrice(product.priceAmountCents)}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StoreScreen() {
  const setView = useAppStore(s => s.setView);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  const tiers = getProductsByCategory('tier');
  const packs = getProductsByCategory('content-pack');
  const upgrades = getProductsByCategory('feature-upgrade');
  const bundles = getProductsByCategory('bundle');

  return (
    <div className="min-h-screen bg-[#0a0e14] text-zinc-100">
      <header className="border-b border-zinc-800/60 bg-zinc-900/50 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => setView('incident-board')}
            className="text-zinc-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold font-mono tracking-wide text-cyan-400">STORE</h1>
            <p className="text-xs text-zinc-500">Expand your investigation toolkit</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8 pb-24">
        <section className="rounded-2xl border border-cyan-800/30 bg-gradient-to-br from-cyan-950/30 via-zinc-900/50 to-zinc-900/50 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold">Upgrade Your Lab</h2>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
            Unlock new scenarios, advanced diagnostic tools, and premium features to sharpen your troubleshooting instincts. Content packs add new investigations. Feature upgrades expand your toolkit.
          </p>
        </section>

        {tiers.length > 0 && (
          <section>
            <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              Plans
            </h3>
            <div className="grid gap-3">
              {tiers.map(p => (
                <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />
              ))}
            </div>
          </section>
        )}

        {packs.length > 0 && (
          <section>
            <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              Scenario Packs
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {packs.map(p => (
                <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />
              ))}
            </div>
          </section>
        )}

        {upgrades.length > 0 && (
          <section>
            <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-400" />
              Feature Upgrades
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {upgrades.map(p => (
                <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />
              ))}
            </div>
          </section>
        )}

        {bundles.length > 0 && (
          <section>
            <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-purple-400" />
              Bundles
            </h3>
            <div className="grid gap-3">
              {bundles.map(p => (
                <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />
              ))}
            </div>
          </section>
        )}
      </main>

      {selectedProduct && (
        <ProductDetail product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}
