import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { getEntitlements, subscribeEntitlements } from '@/lib/entitlements';
import { useSyncExternalStore } from 'react';
import { getAllCaseEntries } from '@/data/caseCatalog';
import type { CaseCatalogEntry } from '@/data/caseCatalog';
import {
  getSandboxAuthoredEntries,
  subscribeSandboxScenarios,
} from '@/lib/sandboxScenarios';
import {
  Trophy,
  User,
  Settings,
  Clock,
  ShoppingBag,
  LogIn,
  Hammer,
  Calendar,
  FlaskConical,
  Sparkles,
  Zap,
  ArrowRight,
} from 'lucide-react';
import EcosystemFooter from './EcosystemFooter';
import { CaseCard } from './incident-board/CaseCard';

// Cache the authored-entries snapshot so useSyncExternalStore sees a stable
// reference between renders. The cached value is only refreshed when the
// underlying scenarios actually change (subscriber callback fires + content
// differs from the previous snapshot).
let cachedAuthoredEntriesSnapshot: CaseCatalogEntry[] = getSandboxAuthoredEntries();
let cachedAuthoredEntriesKey = JSON.stringify(
  cachedAuthoredEntriesSnapshot.map((e) => [e.id, e.sortOrder, e.title])
);
function getAuthoredEntriesSnapshot(): CaseCatalogEntry[] {
  const fresh = getSandboxAuthoredEntries();
  const key = JSON.stringify(fresh.map((e) => [e.id, e.sortOrder, e.title]));
  if (key !== cachedAuthoredEntriesKey) {
    cachedAuthoredEntriesSnapshot = fresh;
    cachedAuthoredEntriesKey = key;
  }
  return cachedAuthoredEntriesSnapshot;
}
const EMPTY_AUTHORED_ENTRIES: CaseCatalogEntry[] = [];
function getAuthoredEntriesServerSnapshot(): CaseCatalogEntry[] {
  return EMPTY_AUTHORED_ENTRIES;
}

export default function IncidentBoard() {
  const profile = useAppStore(s => s.profile);
  const setView = useAppStore(s => s.setView);
  const isSignedIn = useAppStore(s => s.isSignedIn);
  const ent = useSyncExternalStore((cb) => subscribeEntitlements(cb), () => getEntitlements());
  const authoredEntries = useSyncExternalStore(
    subscribeSandboxScenarios,
    getAuthoredEntriesSnapshot,
    getAuthoredEntriesServerSnapshot
  );
  const catalogEntries = getAllCaseEntries();
  const playableCount = catalogEntries.filter((e) => e.status === 'playable').length;
  const plannedCount = catalogEntries.filter((e) => e.status === 'planned').length;
  const authoredCount = authoredEntries.length;

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <header className="border-b border-zinc-800/60 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt=""
              aria-hidden="true"
              className="h-9 sm:h-10 w-auto select-none"
              draggable={false}
            />
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="font-mono text-lg font-bold text-cyan-400 tracking-wider uppercase">
              Faultline Lab
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setView('daily')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-cyan-400 transition-colors rounded-md hover:bg-zinc-800/50"
            >
              <Calendar size={14} />
              <span className="hidden sm:inline">Daily</span>
              {profile.dailyChallenge.currentStreak > 0 && (
                <span className="text-orange-400 font-mono">
                  {profile.dailyChallenge.currentStreak}
                </span>
              )}
            </button>
            <button
              onClick={() => setView('sandbox')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-purple-300 transition-colors rounded-md hover:bg-zinc-800/50"
            >
              <FlaskConical size={14} />
              <span className="hidden sm:inline">Sandbox</span>
            </button>
            <button
              onClick={() => setView('store')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-cyan-400 transition-colors rounded-md hover:bg-zinc-800/50"
            >
              <ShoppingBag size={14} />
              <span className="hidden sm:inline">Store</span>
            </button>
            <button
              onClick={() => setView('profile')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded-md hover:bg-zinc-800/50"
            >
              <User size={14} />
              <span className="hidden sm:inline">{profile.name}</span>
              <span className="text-cyan-400 font-mono">
                {profile.casesSolved} solved
              </span>
            </button>
            {!isSignedIn && import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && (
              <button
                onClick={() => setView('auth')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20"
              >
                <LogIn size={14} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
            {ent.isAdmin && (
              <button
                onClick={() => setView('admin')}
                className="px-2.5 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 font-mono uppercase tracking-wider"
              >
                Admin
              </button>
            )}
            <button
              onClick={() => setView('settings')}
              className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 sm:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">
              Incident Board
            </h2>
            <p className="text-sm text-zinc-500">
              Select a case to investigate. Each incident requires real diagnostic work — use tools, collect evidence, and submit your diagnosis.
            </p>
          </div>

          {profile.casesSolved === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-6 p-5 bg-gradient-to-r from-cyan-500/5 via-cyan-500/[0.02] to-transparent border border-cyan-500/20 rounded-lg"
            >
              <div className="flex items-start gap-4 flex-wrap">
                <div className="p-2.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="flex-1 min-w-[240px]">
                  <h3 className="text-base font-semibold text-zinc-100 mb-1">
                    Welcome, Investigator.
                  </h3>
                  <p className="text-sm text-zinc-400 mb-3 leading-relaxed">
                    Faultline Lab drops you into broken systems. Read the briefing, run real commands, gather evidence, then submit your diagnosis.
                    Start with one of the four free starter cases below — they teach the rhythm in about 20 minutes each.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setView('daily')}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-mono uppercase tracking-wider px-3 py-1.5 rounded border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors flex items-center gap-1.5"
                    >
                      <Calendar size={12} />
                      Try Daily Challenge
                    </button>
                    <button
                      onClick={() => setView('store')}
                      className="text-xs text-zinc-400 hover:text-zinc-200 font-mono uppercase tracking-wider px-3 py-1.5 rounded border border-zinc-700 hover:border-zinc-600 transition-colors flex items-center gap-1.5"
                    >
                      Browse Packs
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {profile.casesSolved > 0 && !ent.isProUser && !ent.isAdmin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-6 p-4 bg-gradient-to-r from-amber-500/5 to-transparent border border-amber-500/20 rounded-lg flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-amber-500/10 text-amber-400">
                  <Zap size={16} />
                </div>
                <div>
                  <div className="text-sm text-zinc-200 font-medium">
                    Ready for harder cases?
                  </div>
                  <div className="text-xs text-zinc-500">
                    Pro unlocks every case, advanced tools, and deep telemetry — $8.99/mo or $79/yr.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setView('store')}
                className="text-xs text-amber-300 hover:text-amber-200 font-mono uppercase tracking-wider px-3 py-1.5 rounded border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5"
              >
                See Pricing
                <ArrowRight size={12} />
              </button>
            </motion.div>
          )}

          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded text-xs text-cyan-400 font-mono">
              <Clock size={12} />
              {playableCount} playable
            </div>
            {plannedCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-300 font-mono">
                <Hammer size={12} />
                {plannedCount} in development
              </div>
            )}
            {authoredCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded text-xs text-fuchsia-300 font-mono">
                <FlaskConical size={12} />
                {authoredCount} sandbox-authored
              </div>
            )}
          </div>

          {authoredCount > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical size={14} className="text-fuchsia-400" />
                <h3 className="text-sm font-mono text-fuchsia-300 uppercase tracking-wider">
                  Your Sandbox Cases
                </h3>
                <span className="text-xs text-zinc-500">
                  Authored locally · ephemeral runs
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {authoredEntries.map((entry) => (
                  <CaseCard key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}

          {authoredCount > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-mono text-zinc-400 uppercase tracking-wider">
                Catalog
              </h3>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {catalogEntries.map((entry) => (
              <CaseCard key={entry.id} entry={entry} />
            ))}
          </div>

          {profile.casesSolved > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 p-4 bg-[#111822] border border-zinc-800/40 rounded-lg"
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider">
                      Cases Solved
                    </div>
                    <div className="text-xl font-bold text-zinc-100 font-mono">
                      {profile.casesSolved}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider">
                      Total Score
                    </div>
                    <div className="text-xl font-bold text-cyan-400 font-mono">
                      {profile.totalScore}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider">
                      Chaos Score
                    </div>
                    <div className="text-xl font-bold text-fuchsia-400 font-mono">
                      {profile.totalChaosScore}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider">
                      Best Streak
                    </div>
                    <div className="text-xl font-bold text-amber-400 font-mono">
                      {profile.streakBest}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Trophy size={14} className="text-amber-400" />
                  {profile.achievementsUnlocked.length} achievements
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>

      <EcosystemFooter />
    </div>
  );
}
