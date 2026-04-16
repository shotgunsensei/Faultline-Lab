import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import {
  ArrowLeft,
  Trophy,
  Target,
  Search,
  Wrench,
  Zap,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  XCircle,
  Award,
  Shield,
  Clock,
} from 'lucide-react';

const tierConfig = {
  Surgical: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: <Target size={24} /> },
  Solid: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: <CheckCircle size={24} /> },
  'Sloppy but Correct': { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: <AlertTriangle size={24} /> },
  Misdiagnosed: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: <XCircle size={24} /> },
};

export default function DebriefScreen() {
  const currentCaseDef = useAppStore(s => s.currentCaseDef);
  const currentCaseState = useAppStore(s => s.currentCaseState);
  const exitCase = useAppStore(s => s.exitCase);
  const restartCase = useAppStore(s => s.restartCase);

  if (!currentCaseDef || !currentCaseState?.debrief) return null;

  const debrief = currentCaseState.debrief;
  const score = debrief.scoreBreakdown;
  const config = tierConfig[score.tier];
  const timeMinutes = Math.floor(debrief.totalTime / 60000);

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={exitCase}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Incident Board
          </button>
          <span className="text-xs font-mono text-zinc-600">
            Case Debrief
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={`text-center py-8 mb-8 rounded-lg border ${config.bg} ${config.border}`}>
            <div className={`${config.color} mb-3 flex justify-center`}>
              {config.icon}
            </div>
            <h1 className={`text-3xl font-bold ${config.color} mb-1`}>
              {score.tier}
            </h1>
            <div className="text-5xl font-bold text-zinc-100 font-mono mb-2">
              {score.total}
              <span className="text-xl text-zinc-600">/{score.maxPossible}</span>
            </div>
            <p className="text-sm text-zinc-500">{currentCaseDef.title}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            <ScoreCard icon={<Target size={16} />} label="Diagnosis" value={score.diagnosisAccuracy} max={40} color="text-cyan-400" />
            <ScoreCard icon={<Search size={16} />} label="Evidence" value={score.evidenceQuality} max={25} color="text-blue-400" />
            <ScoreCard icon={<Wrench size={16} />} label="Remediation" value={score.remediationQuality} max={20} color="text-emerald-400" />
            <ScoreCard icon={<Zap size={16} />} label="Efficiency" value={score.efficiency} max={15} color="text-amber-400" />
            <ScoreCard icon={<Lightbulb size={16} />} label="Hint Penalty" value={-score.hintPenalty} max={0} color="text-red-400" negative />
            <ScoreCard icon={<Clock size={16} />} label="Time" value={timeMinutes} max={0} color="text-zinc-400" suffix=" min" />
          </div>

          <div className="space-y-6">
            <Section title="Actual Root Cause" icon={<Target size={16} />}>
              <h3 className="text-base font-semibold text-zinc-100 mb-2">
                {debrief.actualRootCause.title}
              </h3>
              <p className="text-sm text-zinc-400 mb-3">
                {debrief.actualRootCause.description}
              </p>
              <div className="bg-[#0c1017] border border-zinc-800/40 rounded p-3">
                <p className="text-xs font-mono text-zinc-500 leading-relaxed">
                  {debrief.actualRootCause.technicalDetail}
                </p>
              </div>
            </Section>

            <Section title="Key Evidence" icon={<Search size={16} />}>
              <div className="space-y-2">
                {debrief.cluesThatMattered.map(clue => (
                  <div
                    key={clue.id}
                    className="flex items-start gap-2 text-sm"
                  >
                    <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-zinc-200 font-medium">
                        {clue.title}:
                      </span>{' '}
                      <span className="text-zinc-400">{clue.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Red Herrings" icon={<AlertTriangle size={16} />}>
              <div className="space-y-2">
                {debrief.misleadingClues.map((clue, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-zinc-400">{clue}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Recommended Remediation" icon={<Wrench size={16} />}>
              <p className="text-sm text-zinc-400">
                {debrief.recommendedRemediation}
              </p>
            </Section>

            <Section title="Preventative Measures" icon={<Shield size={16} />}>
              <ul className="space-y-1">
                {debrief.preventativeMeasures.map((measure, i) => (
                  <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                    <span className="text-cyan-500 mt-1">-</span>
                    {measure}
                  </li>
                ))}
              </ul>
            </Section>

            {debrief.achievementsUnlocked.length > 0 && (
              <Section title="Achievements Unlocked" icon={<Award size={16} />}>
                <div className="flex flex-wrap gap-2">
                  {debrief.achievementsUnlocked.map(achievement => (
                    <motion.div
                      key={achievement}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', bounce: 0.5 }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs text-amber-400"
                    >
                      <Trophy size={12} />
                      {achievement}
                    </motion.div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={exitCase}
              className="px-8 py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-sm uppercase tracking-widest rounded hover:bg-cyan-500/20 transition-colors"
            >
              Return to Incident Board
            </button>
            <button
              onClick={() => restartCase(currentCaseDef.id)}
              className="px-8 py-3 bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 font-mono text-sm uppercase tracking-widest rounded hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              Replay Case
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function ScoreCard({
  icon,
  label,
  value,
  max,
  color,
  negative,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  max: number;
  color: string;
  negative?: boolean;
  suffix?: string;
}) {
  return (
    <div className="bg-[#111822] border border-zinc-800/40 rounded-lg p-3">
      <div className={`flex items-center gap-1.5 mb-1 ${color}`}>
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold font-mono text-zinc-100">
        {negative && value !== 0 ? value : value}
        {suffix || (max > 0 ? <span className="text-sm text-zinc-600">/{max}</span> : '')}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#111822] border border-zinc-800/40 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3 text-cyan-400">
        {icon}
        <h2 className="text-sm font-mono uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  );
}
