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
