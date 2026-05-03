import { recordCrossPromoClick } from './api';
import { getEntitlements } from './entitlements';
import { useAppStore } from '@/stores/useAppStore';

export type CrossPromoUserTier = 'anonymous' | 'free' | 'pro';

function currentUserTier(): CrossPromoUserTier {
  const isSignedIn = useAppStore.getState().isSignedIn;
  if (!isSignedIn) return 'anonymous';
  return getEntitlements().isProUser ? 'pro' : 'free';
}

function currentRoute(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.location.pathname + window.location.search;
  } catch {
    return undefined;
  }
}

export interface TrackCrossPromoClickArgs {
  placementId: string;
  targetProduct: string;
  targetUrl: string;
}

/**
 * Fire-and-forget cross-promo click telemetry. Safe to call from a click
 * handler — never throws and never blocks navigation.
 */
export function trackCrossPromoClick(args: TrackCrossPromoClickArgs): void {
  recordCrossPromoClick({
    placementId: args.placementId,
    targetProduct: args.targetProduct,
    targetUrl: args.targetUrl,
    route: currentRoute(),
    userTier: currentUserTier(),
  });
}
