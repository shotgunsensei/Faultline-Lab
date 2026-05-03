import { useEffect, useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { useClerk } from '@clerk/react';
import {
  ArrowLeft,
  CreditCard,
  Crown,
  ExternalLink,
  LogOut,
  Mail,
  User as UserIcon,
  Calendar,
  ShoppingBag,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import {
  getCurrentPlanLabel,
  getEntitlements,
  subscribeEntitlements,
} from '@/lib/entitlements';
import { createBillingPortalSession, fetchSubscription } from '@/lib/api';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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

          {isSignedIn && clerkPubKey && <ClerkSignOutRow />}
        </motion.div>
      </main>
    </div>
  );
}
