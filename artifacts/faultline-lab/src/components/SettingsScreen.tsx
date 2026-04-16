import { useAppStore } from '@/stores/useAppStore';
import { ArrowLeft, Volume2, VolumeX, Sparkles, Type, Trash2 } from 'lucide-react';
import { clearAllData } from '@/lib/persistence';
import { useState } from 'react';

export default function SettingsScreen() {
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const setView = useAppStore(s => s.setView);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    clearAllData();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setView('incident-board')}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <span className="text-xs font-mono text-zinc-600 uppercase tracking-wider">
            Settings
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div className="bg-[#111822] border border-zinc-800/40 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.soundEnabled ? (
                <Volume2 size={16} className="text-cyan-400" />
              ) : (
                <VolumeX size={16} className="text-zinc-500" />
              )}
              <div>
                <p className="text-sm text-zinc-200">Sound Effects</p>
                <p className="text-xs text-zinc-600">
                  Toggle audio feedback (placeholder)
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                updateSettings({ soundEnabled: !settings.soundEnabled })
              }
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.soundEnabled ? 'bg-cyan-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="bg-[#111822] border border-zinc-800/40 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles size={16} className="text-cyan-400" />
              <div>
                <p className="text-sm text-zinc-200">Animations</p>
                <p className="text-xs text-zinc-600">
                  Toggle motion and transitions
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                updateSettings({
                  animationsEnabled: !settings.animationsEnabled,
                })
              }
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.animationsEnabled ? 'bg-cyan-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  settings.animationsEnabled
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="bg-[#111822] border border-zinc-800/40 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Type size={16} className="text-cyan-400" />
              <div>
                <p className="text-sm text-zinc-200">Terminal Font Size</p>
                <p className="text-xs text-zinc-600">
                  {settings.terminalFontSize}px
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  updateSettings({
                    terminalFontSize: Math.max(10, settings.terminalFontSize - 1),
                  })
                }
                className="w-8 h-8 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors text-sm"
              >
                -
              </button>
              <span className="w-8 text-center text-sm font-mono text-zinc-300">
                {settings.terminalFontSize}
              </span>
              <button
                onClick={() =>
                  updateSettings({
                    terminalFontSize: Math.min(20, settings.terminalFontSize + 1),
                  })
                }
                className="w-8 h-8 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors text-sm"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#111822] border border-red-500/20 rounded-lg p-4 mt-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trash2 size={16} className="text-red-400" />
              <div>
                <p className="text-sm text-zinc-200">Reset All Data</p>
                <p className="text-xs text-zinc-600">
                  Clear all progress, scores, and settings
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className={`px-4 py-1.5 rounded text-xs font-mono uppercase transition-colors ${
                confirmReset
                  ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-red-400'
              }`}
            >
              {confirmReset ? 'Confirm Reset' : 'Reset'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
