import { CATALOG, FREE_CASE_IDS, FREE_FEATURES, PRO_FEATURES, type CatalogProduct } from '@/data/catalog';
import { allCases } from '@/data/cases';

export interface EntitlementState {
  ownedProductIds: string[];
  activeSubscription: string | null;
  isProUser: boolean;
  isAdmin?: boolean;
  subscriptionInterval?: 'month' | 'year' | null;
  subscriptionRenewsAt?: number | null;
}

const DEFAULT_ENTITLEMENTS: EntitlementState = {
  ownedProductIds: ['base-free'],
  activeSubscription: null,
  isProUser: false,
  isAdmin: false,
  subscriptionInterval: null,
  subscriptionRenewsAt: null,
};

let currentEntitlements: EntitlementState = { ...DEFAULT_ENTITLEMENTS };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeEntitlements(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setEntitlements(state: EntitlementState): void {
  currentEntitlements = { ...DEFAULT_ENTITLEMENTS, ...state };
  emit();
}

export function getEntitlements(): EntitlementState {
  return currentEntitlements;
}

export function resetEntitlements(): void {
  currentEntitlements = { ...DEFAULT_ENTITLEMENTS };
  emit();
}

export function addOwnedProduct(productId: string): void {
  if (!currentEntitlements.ownedProductIds.includes(productId)) {
    currentEntitlements = {
      ...currentEntitlements,
      ownedProductIds: [...currentEntitlements.ownedProductIds, productId],
    };
    const product = CATALOG.find((p) => p.id === productId);
    if (product?.entitlementType === 'subscription') {
      currentEntitlements.isProUser = true;
      currentEntitlements.activeSubscription = productId;
    }
    if (product?.bundledProductIds) {
      for (const bundledId of product.bundledProductIds) {
        if (!currentEntitlements.ownedProductIds.includes(bundledId)) {
          currentEntitlements.ownedProductIds.push(bundledId);
          const bundled = CATALOG.find((p) => p.id === bundledId);
          if (bundled?.entitlementType === 'subscription') {
            currentEntitlements.isProUser = true;
            currentEntitlements.activeSubscription = bundledId;
          }
        }
      }
    }
    emit();
  }
}

export function removeOwnedProduct(productId: string): void {
  if (currentEntitlements.ownedProductIds.includes(productId)) {
    currentEntitlements = {
      ...currentEntitlements,
      ownedProductIds: currentEntitlements.ownedProductIds.filter((id) => id !== productId),
    };
    const product = CATALOG.find((p) => p.id === productId);
    if (product?.entitlementType === 'subscription') {
      currentEntitlements.isProUser = false;
      currentEntitlements.activeSubscription = null;
    }
    emit();
  }
}

export function hasEntitlement(productId: string): boolean {
  if (productId === 'base-free') return true;

  if (currentEntitlements.ownedProductIds.includes(productId)) return true;

  if (currentEntitlements.isProUser) {
    const product = CATALOG.find((p) => p.id === productId);
    if (product && isIncludedInPro(product)) return true;
  }

  for (const ownedId of currentEntitlements.ownedProductIds) {
    const ownedProduct = CATALOG.find((p) => p.id === ownedId);
    if (ownedProduct?.bundledProductIds?.includes(productId)) return true;
  }

  return false;
}

function isIncludedInPro(product: CatalogProduct): boolean {
  if (product.includedFeatures?.some((f) => PRO_FEATURES.includes(f))) return true;
  return false;
}

export function getOwnedProducts(): CatalogProduct[] {
  const ids = new Set<string>(currentEntitlements.ownedProductIds);
  for (const id of currentEntitlements.ownedProductIds) {
    const p = CATALOG.find((x) => x.id === id);
    if (p?.bundledProductIds) {
      for (const b of p.bundledProductIds) ids.add(b);
    }
  }
  return Array.from(ids)
    .map((id) => CATALOG.find((p) => p.id === id))
    .filter((p): p is CatalogProduct => !!p)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getAllCurrentCaseIds(): string[] {
  return allCases.map((c) => c.id);
}

export function isCaseAccessible(caseId: string): boolean {
  if (FREE_CASE_IDS.includes(caseId)) return true;

  const currentCaseIds = getAllCurrentCaseIds();
  if (currentCaseIds.includes(caseId)) {
    const hasCatalogPack = CATALOG.some(
      (p) =>
        p.status === 'available' &&
        p.includedCaseIds?.includes(caseId) &&
        !FREE_CASE_IDS.includes(caseId)
    );
    if (!hasCatalogPack) return true;
  }

  if (currentEntitlements.isProUser) return true;

  for (const ownedId of currentEntitlements.ownedProductIds) {
    const product = CATALOG.find((p) => p.id === ownedId);
    if (product?.includedCaseIds?.includes(caseId)) return true;

    if (product?.bundledProductIds) {
      for (const bundledId of product.bundledProductIds) {
        const bundled = CATALOG.find((p) => p.id === bundledId);
        if (bundled?.includedCaseIds?.includes(caseId)) return true;
      }
    }
  }

  return false;
}

export function hasFeature(featureId: string): boolean {
  if (FREE_FEATURES.includes(featureId)) return true;

  if (currentEntitlements.isProUser && PRO_FEATURES.includes(featureId)) return true;

  for (const ownedId of currentEntitlements.ownedProductIds) {
    const product = CATALOG.find((p) => p.id === ownedId);
    if (product?.includedFeatures?.includes(featureId)) return true;

    if (product?.bundledProductIds) {
      for (const bundledId of product.bundledProductIds) {
        const bundled = CATALOG.find((p) => p.id === bundledId);
        if (bundled?.includedFeatures?.includes(featureId)) return true;
      }
    }
  }

  return false;
}

export function getProductOwnershipStatus(
  productId: string
): 'owned' | 'available' | 'coming-soon' | 'disabled' {
  if (hasEntitlement(productId)) return 'owned';
  const product = CATALOG.find((p) => p.id === productId);
  if (!product) return 'coming-soon';
  if (product.status === 'disabled') return 'disabled';
  if (product.status === 'coming-soon') return 'coming-soon';
  return 'available';
}

export function getRequiredProductForCase(caseId: string): CatalogProduct | null {
  if (isCaseAccessible(caseId)) return null;

  const pack = CATALOG.find(
    (p) => p.entitlementType === 'content-pack' && p.includedCaseIds?.includes(caseId)
  );
  if (pack) return pack;

  const proProduct = CATALOG.find((p) => p.id === 'pro-subscription');
  return proProduct || null;
}

export function getPackForCase(caseId: string): CatalogProduct | null {
  return (
    CATALOG.find(
      (p) => p.entitlementType === 'content-pack' && p.includedCaseIds?.includes(caseId)
    ) || null
  );
}

export function getRequiredProductForFeature(featureId: string): CatalogProduct | null {
  if (hasFeature(featureId)) return null;
  if (PRO_FEATURES.includes(featureId)) {
    return CATALOG.find((p) => p.id === 'pro-subscription') || null;
  }
  const upgrade = CATALOG.find((p) => p.includedFeatures?.includes(featureId));
  return upgrade || null;
}

export function getBetterValueBundle(productId: string): CatalogProduct | null {
  const bundles = CATALOG.filter(
    (p) =>
      p.entitlementType === 'bundle' &&
      p.bundledProductIds?.includes(productId) &&
      p.status !== 'disabled'
  );
  if (bundles.length === 0) return null;
  // Pick the smaller bundle that includes this product (better targeted value)
  return bundles.sort((a, b) => (a.bundledProductIds?.length || 0) - (b.bundledProductIds?.length || 0))[0];
}

export function getCurrentPlanLabel(): string {
  if (currentEntitlements.isProUser) {
    if (currentEntitlements.subscriptionInterval === 'year') return 'Pro Investigator (Annual)';
    return 'Pro Investigator (Monthly)';
  }
  if (
    currentEntitlements.ownedProductIds.includes('bundle-master-investigator') ||
    currentEntitlements.ownedProductIds.includes('bundle-clinical-systems')
  ) {
    return 'Bundle Owner';
  }
  if (currentEntitlements.ownedProductIds.length > 1) return 'Free + Add-ons';
  return 'Free Tier';
}
