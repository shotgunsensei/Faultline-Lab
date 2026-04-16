import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { allCases, categoryLabels, difficultyColors } from '@/data/cases';
import type { CaseDefinition } from '@/types';
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
  LogOut,
} from 'lucide-react';

const categoryIconMap: Record<string, React.ReactNode> = {
  'windows-ad': <Monitor size={20} />,
  networking: <Network size={20} />,
  automotive: <Car size={20} />,
  electronics: <Cpu size={20} />,
  servers: <Server size={20} />,
  mixed: <Layers size={20} />,
};

function CaseCard({ caseDef }: { caseDef: CaseDefinition }) {
  const startCase = useAppStore(s => s.startCase);
  const resumeCase = useAppStore(s => s.resumeCase);
  const restartCase = useAppStore(s => s.restartCase);
  const isSolved = useAppStore(s => s.isCaseSolved(caseDef.id));
  const bestScore = useAppStore(s => s.getCaseScore(caseDef.id));

  const handleClick = () => {
    if (isSolved) {
      resumeCase(caseDef.id);
    } else {
      startCase(caseDef.id);
    }
  };

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    restartCase(caseDef.id);
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="w-full text-left bg-[#111822] border border-zinc-800/60 rounded-lg p-5 hover:border-cyan-500/30 transition-all duration-300 group relative overflow-hidden"
    >
      {isSolved && (
        <div className="absolute top-3 right-3">
          <CheckCircle size={18} className="text-emerald-400" />
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded bg-zinc-800/60 text-cyan-400">
          {categoryIconMap[caseDef.category]}
        </div>
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider">
            {categoryLabels[caseDef.category]}
          </div>
          <h3 className="text-base font-semibold text-zinc-100 group-hover:text-cyan-300 transition-colors">
            {caseDef.title}
          </h3>
        </div>
      </div>

      <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
        {caseDef.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium uppercase tracking-wider ${difficultyColors[caseDef.difficulty]}`}
          >
            {caseDef.difficulty}
          </span>
          <span className="text-xs text-zinc-600">|</span>
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <AlertTriangle size={12} />
            {caseDef.symptoms.filter(s => s.severity === 'critical').length} critical
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isSolved && (
            <span
              onClick={handleReplay}
              className="text-xs text-zinc-600 hover:text-cyan-400 transition-colors cursor-pointer z-10"
            >
              Replay
            </span>
          )}
          {bestScore !== undefined && (
            <div className="flex items-center gap-1 text-xs text-amber-400">
              <Trophy size={12} />
              {bestScore}/{caseDef.maxScore}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/0 group-hover:via-cyan-500/40 to-transparent transition-all duration-500" />
    </motion.button>
  );
}

export default function IncidentBoard() {
  const profile = useAppStore(s => s.profile);
  const setView = useAppStore(s => s.setView);
  const isSignedIn = useAppStore(s => s.isSignedIn);

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

          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded text-xs text-cyan-400 font-mono">
              <Clock size={12} />
              Case Files
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allCases.map((caseDef) => (
              <CaseCard key={caseDef.id} caseDef={caseDef} />
            ))}
          </div>

          {profile.casesSolved > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 p-4 bg-[#111822] border border-zinc-800/40 rounded-lg"
            >
              <div className="flex items-center justify-between">
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
