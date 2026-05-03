const API_BASE = '/api';

async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchProfile() {
  return apiFetch('/profile');
}

export async function saveProfileToCloud(data: {
  profile: unknown;
  settings: unknown;
  caseStates: unknown;
}) {
  return apiFetch('/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchEntitlements() {
  return apiFetch('/entitlements');
}

export async function startStripeCheckout(
  catalogProductId: string,
  interval?: 'month' | 'year'
): Promise<{ url: string | null }> {
  return apiFetch('/stripe/checkout-by-catalog', {
    method: 'POST',
    body: JSON.stringify({ catalogProductId, interval }),
  });
}

export async function fetchSubscription(): Promise<{
  subscription: {
    id: string;
    status: string;
    current_period_end: number | string | null;
    cancel_at_period_end?: boolean | null;
  } | null;
}> {
  return apiFetch('/stripe/subscription');
}

export async function createBillingPortalSession(): Promise<{ url: string }> {
  return apiFetch('/stripe/portal-session', { method: 'POST' });
}

export async function adminFetchUsers() {
  return apiFetch('/admin/users');
}

export async function adminFetchUserEntitlements(userId: string) {
  return apiFetch(`/admin/users/${encodeURIComponent(userId)}/entitlements`);
}

export async function adminGrantEntitlement(
  userId: string,
  productId: string,
  source: string = 'admin-grant'
) {
  return apiFetch(`/admin/users/${encodeURIComponent(userId)}/entitlements`, {
    method: 'POST',
    body: JSON.stringify({ productId, source }),
  });
}

export async function fetchCatalogOverrides() {
  return apiFetch('/catalog/overrides');
}

export function getCatalogOverridesStreamUrl(): string {
  return `${API_BASE}/catalog/overrides/stream`;
}

export async function adminFetchCatalogOverrides() {
  return apiFetch('/admin/catalog/overrides');
}

export type CatalogOverridePayload = {
  status?: 'available' | 'coming-soon' | 'disabled';
  featured?: boolean;
  shortDescription?: string;
  longDescription?: string;
  tags?: string[];
};

export type AdminSaveCatalogOverrideResponse = {
  success: boolean;
  updatedAt: string;
  updatedByUserId: string | null;
};

export async function adminSaveCatalogOverride(
  productId: string,
  overrides: CatalogOverridePayload
): Promise<AdminSaveCatalogOverrideResponse> {
  return apiFetch(`/admin/catalog/overrides/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    body: JSON.stringify(overrides),
  }) as Promise<AdminSaveCatalogOverrideResponse>;
}

export async function adminRevertCatalogOverride(productId: string) {
  return apiFetch(`/admin/catalog/overrides/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
  });
}

export type CatalogOverrideHistoryEntry = {
  id: string;
  productId: string;
  action: 'create' | 'update' | 'rollback' | 'revert' | string;
  overrides: CatalogOverridePayload | null;
  previousOverrides: CatalogOverridePayload | null;
  changedAt: string | null;
  changedByUserId: string | null;
  editor: { id: string; displayName: string | null; email: string | null } | null;
};

export async function adminFetchCatalogOverrideHistory(
  productId: string
): Promise<{ history: CatalogOverrideHistoryEntry[] }> {
  return apiFetch(
    `/admin/catalog/overrides/${encodeURIComponent(productId)}/history`
  );
}

export async function adminRollbackCatalogOverride(
  productId: string,
  historyId: string
): Promise<{
  success: boolean;
  restored: CatalogOverridePayload | null;
  updatedAt?: string;
  updatedByUserId?: string | null;
}> {
  return apiFetch(
    `/admin/catalog/overrides/${encodeURIComponent(productId)}/rollback/${encodeURIComponent(historyId)}`,
    { method: 'POST' }
  );
}

export type CaseDraftEditor = {
  id: string;
  displayName: string | null;
  email: string | null;
};

export type CaseDraftRecord = {
  id: string;
  draft: unknown;
  updatedAt: string | null;
  updatedByUserId: string | null;
  editor: CaseDraftEditor | null;
};

export async function adminFetchCaseDrafts(): Promise<{ drafts: CaseDraftRecord[] }> {
  return apiFetch('/admin/case-drafts');
}

export async function adminSaveCaseDraft(
  draftId: string,
  draft: unknown
): Promise<{ success: boolean; updatedAt: string; updatedByUserId: string | null }> {
  return apiFetch(`/admin/case-drafts/${encodeURIComponent(draftId)}`, {
    method: 'PUT',
    body: JSON.stringify({ draft }),
  });
}

export async function adminDeleteCaseDraft(draftId: string): Promise<{ success: boolean }> {
  return apiFetch(`/admin/case-drafts/${encodeURIComponent(draftId)}`, {
    method: 'DELETE',
  });
}

export async function adminRevokeEntitlement(userId: string, entitlementId: string) {
  return apiFetch(
    `/admin/users/${encodeURIComponent(userId)}/entitlements/${encodeURIComponent(entitlementId)}`,
    { method: 'DELETE' }
  );
}

export async function adminUpdateUserRole(
  userId: string,
  patch: { isAdmin?: boolean; isSuperAdmin?: boolean }
): Promise<{ success: boolean }> {
  return apiFetch(`/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function adminDeleteUser(userId: string): Promise<{ success: boolean }> {
  return apiFetch(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export type CrossPromoClickEvent = {
  placementId: string;
  targetProduct: string;
  targetUrl: string;
  route?: string;
  userTier: 'anonymous' | 'free' | 'pro';
};

/**
 * Fire-and-forget cross-promo click telemetry. Never throws and never blocks
 * navigation — the caller should not await this in a way that delays the
 * user. Uses `fetch` with `keepalive: true` so the request survives a
 * page-unload / target=_blank handoff.
 */
export function recordCrossPromoClick(event: CrossPromoClickEvent): void {
  try {
    void fetch(`${API_BASE}/cross-promo/click`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => {});
  } catch {
    // swallow — telemetry must never block navigation
  }
}
