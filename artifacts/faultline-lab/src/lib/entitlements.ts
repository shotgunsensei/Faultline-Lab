import { CATALOG, FREE_CASE_IDS, type CatalogProduct } from '@/data/catalog';

export interface EntitlementState {
  ownedProductIds: string[];
  activeSubscription: string | null;
  isProUser: boolean;
}

const DEFAULT_ENTITLEMENTS: EntitlementState = {
  ownedProductIds: ['base-free'],
  activeSubscription: null,
  isProUser: false,
};

let currentEntitlements: EntitlementState = { ...DEFAULT_ENTITLEMENTS };

export function setEntitlements(state: EntitlementState): void {
  currentEntitlements = state;
}

export function getEntitlements(): EntitlementState {
  return currentEntitlements;
}

export function resetEntitlements(): void {
  currentEntitlements = { ...DEFAULT_ENTITLEMENTS };
}

export function hasEntitlement(productId: string): boolean {
  if (productId === 'base-free') return true;

  if (currentEntitlements.ownedProductIds.includes(productId)) return true;

  if (currentEntitlements.isProUser) {
    const product = CATALOG.find(p => p.id === productId);
    if (product && isIncludedInPro(product)) return true;
  }

  for (const ownedId of currentEntitlements.ownedProductIds) {
    const ownedProduct = CATALOG.find(p => p.id === ownedId);
    if (ownedProduct?.bundledProductIds?.includes(productId)) return true;
  }

  return false;
}

function isIncludedInPro(product: CatalogProduct): boolean {
  const proFeatures = ['cloud-sync', 'daily-challenge', 'full-archive', 'advanced-stats', 'priority-access'];
  if (product.includedFeatures?.some(f => proFeatures.includes(f))) return true;
  return false;
}

export function isCaseAccessible(caseId: string): boolean {
  if (FREE_CASE_IDS.includes(caseId)) return true;

  const allFreeCaseIds = ['windows-ad-kerberos', 'networking-vpn-phase2', 'automotive-alternator', 'electronics-mesh-firmware'];
  if (allFreeCaseIds.includes(caseId)) return true;

  if (currentEntitlements.isProUser) return true;

  for (const ownedId of currentEntitlements.ownedProductIds) {
    const product = CATALOG.find(p => p.id === ownedId);
    if (product?.includedCaseIds?.includes(caseId)) return true;

    if (product?.bundledProductIds) {
      for (const bundledId of product.bundledProductIds) {
        const bundled = CATALOG.find(p => p.id === bundledId);
        if (bundled?.includedCaseIds?.includes(caseId)) return true;
      }
    }
  }

  return false;
}

export function hasFeature(featureId: string): boolean {
  const freeFeatures = ['standard-tools', 'local-progress', 'guest-mode'];
  if (freeFeatures.includes(featureId)) return true;

  if (currentEntitlements.isProUser) {
    const proFeatures = ['cloud-sync', 'daily-challenge', 'full-archive', 'advanced-stats', 'priority-access'];
    if (proFeatures.includes(featureId)) return true;
  }

  for (const ownedId of currentEntitlements.ownedProductIds) {
    const product = CATALOG.find(p => p.id === ownedId);
    if (product?.includedFeatures?.includes(featureId)) return true;

    if (product?.bundledProductIds) {
      for (const bundledId of product.bundledProductIds) {
        const bundled = CATALOG.find(p => p.id === bundledId);
        if (bundled?.includedFeatures?.includes(featureId)) return true;
      }
    }
  }

  return false;
}

export function getProductOwnershipStatus(productId: string): 'owned' | 'available' | 'coming-soon' {
  if (hasEntitlement(productId)) return 'owned';
  const product = CATALOG.find(p => p.id === productId);
  if (!product || product.status === 'coming-soon') return 'coming-soon';
  return 'available';
}

export function getRequiredProductForCase(caseId: string): CatalogProduct | null {
  if (FREE_CASE_IDS.includes(caseId)) return null;

  const pack = CATALOG.find(p =>
    p.entitlementType === 'content-pack' && p.includedCaseIds?.includes(caseId)
  );
  if (pack) return pack;

  const proProduct = CATALOG.find(p => p.id === 'pro-subscription');
  return proProduct || null;
}
