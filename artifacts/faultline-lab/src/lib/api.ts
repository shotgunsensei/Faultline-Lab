const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/../api-server/api';

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

export async function adminRevokeEntitlement(userId: string, entitlementId: string) {
  return apiFetch(
    `/admin/users/${encodeURIComponent(userId)}/entitlements/${encodeURIComponent(entitlementId)}`,
    { method: 'DELETE' }
  );
}
