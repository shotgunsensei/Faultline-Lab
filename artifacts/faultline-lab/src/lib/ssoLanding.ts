import { toast } from 'sonner';

/**
 * Reads `?sso=ok|error&reason=…` query params produced by the api-server's
 * `/sso` endpoint and surfaces the result to the user. Strips the params from
 * the URL afterwards so a refresh doesn't re-fire the toast.
 *
 * Returns `true` when an SSO success was detected — the caller should then
 * trigger an /api/me bootstrap so signed-in state hydrates without a hard
 * reload.
 */
const REASON_COPY: Record<string, string> = {
  expired: 'Your sign-in link expired. Launch Faultline Lab again from OperatorOS.',
  invalid_token: 'Sign-in link was invalid. Launch Faultline Lab again from OperatorOS.',
  wrong_audience: 'Sign-in link was issued for a different module.',
  wrong_env: 'Sign-in link was issued for a different environment.',
  consume_failed: 'Sign-in link was already used. Launch Faultline Lab again from OperatorOS.',
  sso_consume_unavailable: 'OperatorOS is unreachable right now. Try the launch again in a moment.',
  not_configured: 'Single sign-on is not yet configured for this environment.',
  server_error: 'Something went wrong completing sign-in. Please try again.',
  missing_token: 'Sign-in link was malformed.',
};

export function consumeSsoLandingParams(): { ok: boolean; error: string | null } {
  if (typeof window === 'undefined') return { ok: false, error: null };
  const url = new URL(window.location.href);
  const ssoParam = url.searchParams.get('sso');
  if (!ssoParam) return { ok: false, error: null };

  const reason = url.searchParams.get('reason');
  url.searchParams.delete('sso');
  url.searchParams.delete('reason');
  window.history.replaceState({}, '', url.toString());

  if (ssoParam === 'ok') {
    toast.success('Signed in via OperatorOS');
    return { ok: true, error: null };
  }

  const message = (reason && REASON_COPY[reason]) || 'Sign-in failed.';
  toast.error(message);
  return { ok: false, error: reason };
}
