import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { allCases, categoryLabels } from '@/data/cases';
import {
  ArrowLeft,
  User,
  Trophy,
  Target,
  Flame,
  Award,
  CheckCircle,
} from 'lucide-react';

export default function ProfileScreen() {
  const profile = useAppStore(s => s.profile);
  const setView = useAppStore(s => s.setView);
  const updateProfile = useAppStore(s => s.updateProfile);
  const resumeCase = useAppStore(s => s.resumeCase);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);

  const handleSaveName = () => {
    if (nameInput.trim()) {
      updateProfile({ name: nameInput.trim() });
    }
    setEditingName(false);
  };

  const solvedCases = allCases.filter(c =>
    profile.solvedCaseIds.includes(c.id)
  );

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setView('incident-board')}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <span className="text-xs font-mono text-zinc-600 uppercase tracking-wider">
            Investigator Profile
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <User size={28} className="text-cyan-400" />
            </div>
            <div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    className="bg-[#111822] border border-zinc-700 rounded px-2 py-1 text-lg text-zinc-100 font-semibold focus:outline-none focus:border-cyan-500/30"
                    autoFocus
                  />
                </div>
              ) : (
                <h1
                  className="text-xl font-bold text-zinc-100 cursor-pointer hover:text-cyan-300 transition-colors"
                  onClick={() => setEditingName(true)}
                >
                  {profile.name}
                </h1>
              )}
              <p className="text-sm text-zinc-500">
                Active since {new Date(profile.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard icon={<CheckCircle size={16} />} label="Cases Solved" value={profile.casesSolved} color="text-emerald-400" />
            <StatCard icon={<Trophy size={16} />} label="Total Score" value={profile.totalScore} color="text-cyan-400" />
            <StatCard icon={<Flame size={16} />} label="Best Streak" value={profile.streakBest} color="text-amber-400" />
            <StatCard icon={<Award size={16} />} label="Achievements" value={profile.achievementsUnlocked.length} color="text-purple-400" />
          </div>

          {profile.achievementsUnlocked.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-wider mb-3">
                Achievements
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.achievementsUnlocked.map(a => (
                  <div
                    key={a}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs text-amber-400"
                  >
                    <Trophy size={12} />
                    {a}
                  </div>
                ))}
              </div>
            </div>
          )}

          {solvedCases.length > 0 && (
            <div>
              <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-wider mb-3">
                Solved Cases
              </h2>
              <div className="space-y-2">
                {solvedCases.map(c => (
                  <button
                    key={c.id}
                    onClick={() => resumeCase(c.id)}
                    className="w-full text-left flex items-center justify-between p-3 bg-[#111822] border border-zinc-800/40 rounded-lg hover:border-cyan-500/20 transition-colors"
                  >
                    <div>
                      <span className="text-sm text-zinc-200">{c.title}</span>
                      <span className="text-xs text-zinc-600 ml-2">
                        {categoryLabels[c.category]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 font-mono">
                      <Target size={12} />
                      {profile.bestScores[c.id]}/{c.maxScore}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-[#111822] border border-zinc-800/40 rounded-lg p-4">
      <div className={`flex items-center gap-1.5 mb-2 ${color}`}>
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono text-zinc-100">{value}</div>
    </div>
  );
}
