import { useEffect, useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { useClerk } from '@clerk/react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CreditCard,
  Crown,
  ExternalLink,
  Link2,
  Link2Off,
  LogOut,
  Mail,
  User as UserIcon,
  Calendar,
  ShoppingBag,
  AlertCircle,
  Receipt,
  FileText,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import {
  getCurrentPlanLabel,
  getEntitlements,
  subscribeEntitlements,
} from '@/lib/entitlements';
import {
  createBillingPortalSession,
  fetchBillingHistory,
  fetchSubscription,
  fetchMe,
  fetchLinkedIdentities,
  linkClerkAccount,
  unlinkAccountIdentity,
  type BillingHistoryEntry,
  type LinkedIdentities,
} from '@/lib/api';
import { CATALOG } from '@/data/catalog';

const PRODUCT_NAME_BY_ID = new Map(CATALOG.map((p) => [p.id, p.name]));

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null || amount === undefined) return '—';
  const cur = (currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cur,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${cur}`;
  }
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusStyles(status: string | null): string {
  const s = (status || '').toLowerCase();
  if (s === 'paid' || s === 'completed' || s === 'fulfilled') {
    return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  }
  if (s === 'refunded') {
    return 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30';
  }
  if (s === 'open' || s === 'pending') {
    return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  }
  if (s === 'void' || s === 'uncollectible' || s === 'failed') {
    return 'text-red-300 bg-red-500/10 border-red-500/30';
  }
  return 'text-zinc-400 bg-zinc-800 border-zinc-700';
}

function entryLabel(entry: BillingHistoryEntry): string {
  if (entry.kind === 'invoice') {
    return entry.number ? `Invoice ${entry.number}` : 'Subscription invoice';
  }
  if (entry.productId) {
    return PRODUCT_NAME_BY_ID.get(entry.productId) || entry.productId;
  }
  return 'Purchase';
}

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = !!clerkPubKey;

type SubscriptionInfo = {
  id: string;
  status: string;
  current_period_end: number | string | null;
  cancel_at_period_end?: boolean | null;
} | null;

function formatRenewalDate(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num) || num <= 0) return null;
  const ms = num > 1e12 ? num : num * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function LinkedAccountsSection() {
  const { openSignIn } = useClerk();
  const [identities, setIdentities] = useState<LinkedIdentities | null>(null);
  const [authSource, setAuthSource] = useState<'clerk' | 'operatoros' | 'unknown'>(
    'unknown'
  );
  const [busy, setBusy] = useState<null | 'link-clerk' | 'unlink-clerk' | 'unlink-operatoros'>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchLinkedIdentities(), fetchMe()])
      .then(([res, me]) => {
        if (cancelled) return;
        setIdentities(res);
        const src = me?.user?.authSource;
        setAuthSource(src === 'clerk' || src === 'operatoros' ? src : 'unknown');
      })
      .catch(() => {
        // Non-fatal — section just won't render.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!identities) return null;

  const clerkLinked = identities.clerk.linked;
  const operatorLinked = identities.operatoros.linked;

  const handleLinkClerk = async () => {
    setError(null);
    if (!clerkConfigured) {
      setError('Clerk sign-in is not available in this build.');
      return;
    }
    setBusy('link-clerk');
    try {
      // Open the Clerk modal so the user can authenticate. We don't await
      // the modal directly; instead we poll the identities endpoint once
      // they close it. To keep this simple, we let the user sign in, then
      // call the link endpoint when they close the modal.
      openSignIn();
      // Poll a few times to give Clerk time to attach its session cookie.
      const start = Date.now();
      let result: Awaited<ReturnType<typeof linkClerkAccount>> | null = null;
      while (Date.now() - start < 60_000) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          result = await linkClerkAccount();
          if (result.success) break;
        } catch (err: any) {
          const msg = String(err?.message ?? '');
          // 400 no_clerk_session means the user hasn't completed sign-in yet.
          if (!msg.includes('400')) throw err;
        }
      }
      if (result?.success) {
        setIdentities(result.identities);
        toast.success(
          result.alreadyLinked
            ? 'Clerk login already linked to this account.'
            : 'Clerk login linked. Your accounts are now unified.'
        );
      } else {
        setError('Linking timed out. Sign in with Clerk, then try again.');
      }
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      if (msg.includes('409')) {
        setError(
          'This account is already linked to a different Clerk login. Unlink it first.'
        );
      } else {
        setError('Could not link the Clerk login. Please try again.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleUnlink = async (identity: 'clerk' | 'operatoros') => {
    setError(null);
    setBusy(identity === 'clerk' ? 'unlink-clerk' : 'unlink-operatoros');
    try {
      const res = await unlinkAccountIdentity(identity);
      setIdentities(res.identities);
      toast.success(
        identity === 'clerk'
          ? 'Clerk login unlinked. Progress and purchases stay on this account.'
          : 'OperatorOS unlinked. Progress and purchases stay on this account.'
      );
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      if (msg.includes('400')) {
        setError(
          identity === 'clerk'
            ? "You're signed in with Clerk right now. Sign in with OperatorOS first, then unlink."
            : "You're signed in with OperatorOS right now. Sign in with Clerk first, then unlink."
        );
      } else {
        setError('Could not unlink. Please try again.');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-800/50 bg-[#111822] p-4 sm:p-5">
      <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4">
        Linked Sign-In Methods
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        Link both methods to keep one unified account with shared progress, subscription, and purchases.
      </p>

      {error && (
        <div className="flex items-start gap-2 mb-3 p-2.5 rounded border border-red-500/30 bg-red-500/10">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 p-3 rounded border border-zinc-800/60 bg-zinc-900/40">
          <div className="min-w-0">
            <p className="text-sm text-zinc-200 flex items-center gap-2">
              Clerk login
              {authSource === 'clerk' && (
                <span className="text-[10px] font-mono uppercase text-cyan-400 border border-cyan-500/30 rounded px-1.5 py-0.5">
                  current
                </span>
              )}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {clerkLinked ? 'Linked.' : 'Not linked to this account.'}
            </p>
          </div>
          {clerkLinked ? (
            <button
              onClick={() => handleUnlink('clerk')}
              disabled={busy !== null || authSource === 'clerk'}
              title={
                authSource === 'clerk'
                  ? "You're signed in with Clerk right now."
                  : undefined
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Link2Off size={12} />
              {busy === 'unlink-clerk' ? 'Unlinking…' : 'Unlink'}
            </button>
          ) : (
            <button
              onClick={handleLinkClerk}
              disabled={busy !== null || !clerkConfigured}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Link2 size={12} />
              {busy === 'link-clerk' ? 'Waiting for Clerk…' : 'Link Clerk'}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-3 rounded border border-zinc-800/60 bg-zinc-900/40">
          <div className="min-w-0">
            <p className="text-sm text-zinc-200 flex items-center gap-2">
              OperatorOS
              {authSource === 'operatoros' && (
                <span className="text-[10px] font-mono uppercase text-cyan-400 border border-cyan-500/30 rounded px-1.5 py-0.5">
                  current
                </span>
              )}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {operatorLinked
                ? 'Linked. Launch from OperatorOS to use this method.'
                : 'Not linked. Launch Faultline Lab from OperatorOS while signed in here to link.'}
            </p>
          </div>
          {operatorLinked && (
            <button
              onClick={() => handleUnlink('operatoros')}
              disabled={busy !== null || authSource === 'operatoros'}
              title={
                authSource === 'operatoros'
                  ? "You're signed in with OperatorOS right now."
                  : undefined
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Link2Off size={12} />
              {busy === 'unlink-operatoros' ? 'Unlinking…' : 'Unlink'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function ClerkSignOutRow() {
  const { signOut } = useClerk();
  return (
    <section className="rounded-xl border border-zinc-800/50 bg-[#111822] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LogOut size={16} className="text-zinc-400" />
          <div>
            <p className="text-sm text-zinc-200">Sign out</p>
            <p className="text-xs text-zinc-600">Progress will remain saved locally.</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="px-4 py-1.5 rounded text-xs font-mono uppercase bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </section>
  );
}

export default function AccountScreen() {
  const setView = useAppStore((s) => s.setView);
  const isSignedIn = useAppStore((s) => s.isSignedIn);
  const authUser = useAppStore((s) => s.authUser);
  const profile = useAppStore((s) => s.profile);
  const ent = useSyncExternalStore(
    (cb) => subscribeEntitlements(cb),
    () => getEntitlements()
  );
  const planLabel = getCurrentPlanLabel();

  const [subscription, setSubscription] = useState<SubscriptionInfo>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BillingHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    setSubLoading(true);
    fetchSubscription()
      .then((res) => {
        if (!cancelled) setSubscription(res.subscription);
      })
      .catch(() => {
        // Non-fatal: account screen still renders without server-side subscription info.
      })
      .finally(() => {
        if (!cancelled) setSubLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setHistory([]);
      setHistoryError(null);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    fetchBillingHistory()
      .then((res) => {
        if (!cancelled) setHistory(res.history || []);
      })
      .catch(() => {
        if (!cancelled) setHistoryError('Could not load your billing history.');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const handleManageBilling = async () => {
    setError(null);
    setPortalLoading(true);
    try {
      const { url } = await createBillingPortalSession();
      if (url) {
        window.location.href = url;
      } else {
        setError('Could not open the billing portal. Please try again.');
      }
    } catch (err: any) {
      const msg =
        typeof err?.message === 'string' && err.message.includes('400')
          ? "You don't have any billing history yet. Make a purchase first to manage billing."
          : 'Could not open the billing portal. Please try again.';
      setError(msg);
    } finally {
      setPortalLoading(false);
    }
  };

  const renewalDate = formatRenewalDate(subscription?.current_period_end);
  const cancelAtEnd = !!subscription?.cancel_at_period_end;
  const subStatus = subscription?.status ?? null;

  const displayName =
    authUser?.name?.trim() || profile.name || 'Investigator';
  const email = authUser?.email || null;

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <header className="border-b border-zinc-800/60 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setView('incident-board')}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <span className="text-xs font-mono text-zinc-600 uppercase tracking-wider">
            Account
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 pb-20 sm:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {!isSignedIn && (
            <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-4">
              <p className="text-sm text-zinc-300 mb-3">
                Sign in to view your account, manage your subscription, and sync progress.
              </p>
              <button
                onClick={() => setView('auth')}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Sign In
              </button>
            </div>
          )}

          <section className="rounded-xl border border-zinc-800/50 bg-[#111822] p-4 sm:p-5">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4">
              Profile
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                {authUser?.avatarUrl ? (
                  <img src={authUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={26} className="text-cyan-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-zinc-100 truncate">
                  {displayName}
                </p>
                {email ? (
                  <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                    <Mail size={11} /> <span className="truncate">{email}</span>
                  </p>
                ) : (
                  <p className="text-xs text-zinc-600 mt-0.5">No email on file</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800/50 bg-[#111822] p-4 sm:p-5">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4">
              Subscription
            </h2>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3 min-w-0">
                <Crown
                  size={18}
                  className={
                    ent.isProUser
                      ? 'text-amber-400 shrink-0 mt-0.5'
                      : 'text-zinc-500 shrink-0 mt-0.5'
                  }
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100">{planLabel}</p>
                  {subLoading && isSignedIn ? (
                    <p className="text-xs text-zinc-500 mt-1">Loading subscription details…</p>
                  ) : subscription ? (
                    <div className="text-xs text-zinc-500 mt-1 space-y-0.5">
                      {subStatus && (
                        <p>
                          Status:{' '}
                          <span className="font-mono uppercase text-zinc-300">{subStatus}</span>
                        </p>
                      )}
                      {renewalDate && (
                        <p className="flex items-center gap-1.5">
                          <Calendar size={11} />
                          {cancelAtEnd ? 'Ends' : 'Renews'} on {renewalDate}
                        </p>
                      )}
                    </div>
                  ) : isSignedIn ? (
                    <p className="text-xs text-zinc-500 mt-1">
                      No active subscription. Browse the store to upgrade.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 mb-3 p-2.5 rounded border border-red-500/30 bg-red-500/10">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleManageBilling}
                disabled={!isSignedIn || portalLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono uppercase bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CreditCard size={12} />
                {portalLoading ? 'Opening…' : 'Manage Billing'}
                <ExternalLink size={11} className="opacity-60" />
              </button>
              <button
                onClick={() => setView('store')}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono uppercase bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                <ShoppingBag size={12} />
                Visit Store
              </button>
            </div>
            <p className="text-[11px] text-zinc-600 mt-3">
              Plan changes, payment methods, and invoices are handled in Stripe's secure customer portal.
            </p>
          </section>

          {isSignedIn && (
            <section className="rounded-xl border border-zinc-800/50 bg-[#111822] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                  <Receipt size={12} />
                  Recent Invoices
                </h2>
                {history.some((e) => e.kind === 'invoice') && (
                  <button
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="text-[11px] font-mono uppercase text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    View all in Stripe
                    <ExternalLink size={10} />
                  </button>
                )}
              </div>

              {historyLoading ? (
                <p className="text-xs text-zinc-500">Loading billing history…</p>
              ) : historyError ? (
                <div className="flex items-start gap-2 p-2.5 rounded border border-red-500/30 bg-red-500/10">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{historyError}</p>
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No invoices or purchases yet. Anything you buy will show up here.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-800/60">
                  {history.slice(0, 5).map((entry) => {
                    const link = entry.hostedInvoiceUrl || entry.invoicePdf;
                    return (
                      <li
                        key={`${entry.kind}-${entry.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-zinc-200 truncate">
                              {entryLabel(entry)}
                            </p>
                            <span
                              className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${statusStyles(entry.status)}`}
                            >
                              {entry.status || 'unknown'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            {formatShortDate(entry.createdAt)}
                            {entry.kind === 'purchase' && (
                              <span className="ml-2 text-zinc-600">One-time</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-mono text-zinc-200">
                            {formatAmount(entry.amount, entry.currency)}
                          </span>
                          {link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                              title="Open receipt"
                            >
                              <FileText size={12} />
                              <span className="hidden sm:inline">Receipt</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-zinc-600 hidden sm:inline">
                              No receipt
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {isSignedIn && <LinkedAccountsSection />}

          {isSignedIn && clerkPubKey && <ClerkSignOutRow />}
        </motion.div>
      </main>
    </div>
  );
}
