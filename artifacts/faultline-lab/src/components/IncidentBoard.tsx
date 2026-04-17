import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { categoryLabels, difficultyColors } from '@/data/cases';
import { isCaseAccessible, getRequiredProductForCase, getPackForCase, getEntitlements, subscribeEntitlements } from '@/lib/entitlements';
import { useUpgradePrompt } from './UpgradePrompt';
import { useSyncExternalStore } from 'react';
import { getAllCaseEntries } from '@/data/caseCatalog';
import type { CaseCatalogEntry } from '@/data/caseCatalog';
import {
  Monitor,
  Network,
  Car,
  Cpu,
  Server,
  Layers,
  Trophy,
  User,
  Settings,
  CheckCircle,
  Clock,
  AlertTriangle,
  ShoppingBag,
  LogIn,
  Lock,
  Hammer,
  Calendar,
  FlaskConical,
} from 'lucide-react';

const categoryIconMap: Record<string, React.ReactNode> = {
  'windows-ad': <Monitor size={20} />,
  networking: <Network size={20} />,
  automotive: <Car size={20} />,
  electronics: <Cpu size={20} />,
  servers: <Server size={20} />,
  mixed: <Layers size={20} />,
};

function CaseCard({ entry }: { entry: CaseCatalogEntry }) {
  const startCase = useAppStore(s => s.startCase);
  const resumeCase = useAppStore(s => s.resumeCase);
  const restartCase = useAppStore(s => s.restartCase);
  const setView = useAppStore(s => s.setView);
  const isSolved = useAppStore(s => s.isCaseSolved(entry.id));
  const bestScore = useAppStore(s => s.getCaseScore(entry.id));
  const accessible = isCaseAccessible(entry.id);
  const isPlanned = entry.status === 'planned';
  const isPlayable = entry.status === 'playable' && accessible;
  const requiredProduct = !accessible ? getRequiredProductForCase(entry.id) : null;
  const sourcePack = !entry.isStarter ? getPackForCase(entry.id) : null;
  const { prompt } = useUpgradePrompt();

  const handleClick = () => {
    if (isPlanned) {
      // Promote upsell for the owning pack instead of trying to start the case.
      if (requiredProduct) {
        prompt({
          productId: requiredProduct.id,
          contextKey: `case:${entry.id}`,
          reason: `"${entry.title}" is part of ${requiredProduct.name}, which is in development. Reserve your slot to be notified at launch.`,
        });
      } else {
        setView('store');
      }
      return;
    }
    if (!accessible) {
      if (requiredProduct) {
        prompt({
          productId: requiredProduct.id,
          contextKey: `case:${entry.id}`,
          reason: `"${entry.title}" is part of ${requiredProduct.name}. Unlock it to start the investigation.`,
        });
      } else {
        setView('store');
      }
      return;
    }
    if (isSolved) {
      resumeCase(entry.id);
    } else {
      startCase(entry.id);
    }
  };

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    restartCase(entry.id);
  };

  const cardBorderClass = isPlayable
    ? 'border-zinc-800/60 hover:border-cyan-500/30'
    : isPlanned
    ? 'border-zinc-800/30 opacity-70 hover:opacity-90 hover:border-purple-500/30'
    : 'border-zinc-800/30 opacity-70 hover:opacity-90 hover:border-amber-500/30';

  const titleHoverClass = isPlayable
    ? 'text-zinc-100 group-hover:text-cyan-300'
    : isPlanned
    ? 'text-zinc-400 group-hover:text-purple-300'
    : 'text-zinc-400 group-hover:text-amber-300';

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full text-left bg-[#111822] border rounded-lg p-5 transition-all duration-300 group relative overflow-hidden ${cardBorderClass}`}
    >
      {isSolved && isPlayable && (
        <div className="absolute top-3 right-3">
          <CheckCircle size={18} className="text-emerald-400" />
        </div>
      )}
      {isPlanned && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] text-purple-300/80 font-mono uppercase tracking-wider">
          <Hammer size={12} />
          In Development
        </div>
      )}
      {!isPlanned && !accessible && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-amber-400/80">
          <Lock size={14} />
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded shrink-0 ${isPlayable ? 'bg-zinc-800/60 text-cyan-400' : 'bg-zinc-800/40 text-zinc-500'}`}>
          {categoryIconMap[entry.category]}
        </div>
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider">
            {categoryLabels[entry.category]}
          </div>
          <h3 className={`text-base font-semibold transition-colors ${titleHoverClass}`}>
            {entry.title}
          </h3>
        </div>
      </div>

      <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
        {entry.shortSummary}
      </p>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium uppercase tracking-wider ${isPlayable ? difficultyColors[entry.difficulty] : 'text-zinc-600'}`}
          >
            {entry.difficulty}
          </span>
          <span className="text-xs text-zinc-600">|</span>
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <Clock size={12} />
            {entry.estimatedMinutes} min
          </span>
          {entry.previewSymptoms.length > 0 && (
            <>
              <span className="text-xs text-zinc-600">|</span>
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <AlertTriangle size={12} />
                {entry.previewSymptoms.length} signal{entry.previewSymptoms.length === 1 ? '' : 's'}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isPlanned && requiredProduct && (
            <span className="text-[11px] text-purple-300/80 font-mono">
              {requiredProduct.name}
            </span>
          )}
          {!isPlanned && !accessible && requiredProduct && (
            <span className="text-[11px] text-amber-400/70 font-mono">
              {requiredProduct.pricingType === 'free' ? 'Requires upgrade' : `${requiredProduct.name}`}
            </span>
          )}
          {isPlayable && sourcePack && (
            <span className="text-[11px] text-cyan-400/70 font-mono">
              {sourcePack.name}
            </span>
          )}
          {isPlayable && isSolved && (
            <span
              onClick={handleReplay}
              className="text-xs text-zinc-600 hover:text-cyan-400 transition-colors cursor-pointer z-10 px-2 py-1 -my-1"
            >
              Replay
            </span>
          )}
          {bestScore !== undefined && (
            <div className="flex items-center gap-1 text-xs text-amber-400">
              <Trophy size={12} />
              {bestScore}
            </div>
          )}
        </div>
      </div>

      <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent transition-all duration-500 ${
        isPlayable
          ? 'via-cyan-500/0 group-hover:via-cyan-500/40'
          : isPlanned
          ? 'via-purple-500/0 group-hover:via-purple-500/30'
          : 'via-amber-500/0 group-hover:via-amber-500/30'
      }`} />
    </motion.button>
  );
}

export default function IncidentBoard() {
  const profile = useAppStore(s => s.profile);
  const setView = useAppStore(s => s.setView);
  const isSignedIn = useAppStore(s => s.isSignedIn);
  const ent = useSyncExternalStore((cb) => subscribeEntitlements(cb), () => getEntitlements());
  const entries = getAllCaseEntries();
  const playableCount = entries.filter((e) => e.status === 'playable').length;
  const plannedCount = entries.filter((e) => e.status === 'planned').length;

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <header className="border-b border-zinc-800/60 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map((entry) => (
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
    </div>
  );
}
