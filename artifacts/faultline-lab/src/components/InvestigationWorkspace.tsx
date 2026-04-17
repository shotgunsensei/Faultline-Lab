import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import TerminalPanel from './investigation/TerminalPanel';
import EventLogPanel from './investigation/EventLogPanel';
import TicketHistoryPanel from './investigation/TicketHistoryPanel';
import EvidenceLocker from './investigation/EvidenceLocker';
import HintPanel from './investigation/HintPanel';
import ActionLog from './investigation/ActionLog';
import SymptomsPanel from './investigation/SymptomsPanel';
import DiagnosisForm from './investigation/DiagnosisForm';
import { categoryLabels, difficultyColors } from '@/data/cases';
import {
  Terminal,
  FileText,
  MessageSquare,
  Send,
  ArrowLeft,
  Save,
  Clock,
  Briefcase,
  X,
  ChevronUp,
  Package,
  Lightbulb,
  Activity,
  Network,
  Gauge,
  Zap,
  FlaskConical,
  BarChart3,
  Lock,
} from 'lucide-react';
import { useState, useEffect, useSyncExternalStore } from 'react';
import {
  hasFeature,
  getRequiredProductForFeature,
  getEntitlements,
  subscribeEntitlements,
} from '@/lib/entitlements';
import { useUpgradePrompt } from './UpgradePrompt';
import { toast } from 'sonner';

const premiumTools = [
  { id: 'wireshark-panel', label: 'Wireshark', icon: Network },
  { id: 'deep-telemetry', label: 'Deep Telemetry', icon: Gauge },
  { id: 'chaos-mode', label: 'Chaos Mode', icon: Zap },
  { id: 'sandbox-pro', label: 'Sandbox', icon: FlaskConical },
  { id: 'pro-analytics', label: 'Analytics', icon: BarChart3 },
];

const toolTabs = [
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'event-log', label: 'Event Logs', icon: FileText },
  { id: 'ticket-history', label: 'Tickets', icon: MessageSquare },
];

const sidebarTabs = [
  { id: 'evidence', label: 'Evidence', icon: Package },
  { id: 'hints', label: 'Hints', icon: Lightbulb },
  { id: 'symptoms', label: 'Symptoms', icon: Activity },
];

export default function InvestigationWorkspace() {
  const currentCaseDef = useAppStore(s => s.currentCaseDef);
  const currentCaseState = useAppStore(s => s.currentCaseState);
  const activeTool = useAppStore(s => s.activeTool);
  const setActiveTool = useAppStore(s => s.setActiveTool);
  const trackToolUsage = useAppStore(s => s.trackToolUsage);
  const showDiagnosisForm = useAppStore(s => s.showDiagnosisForm);
  useSyncExternalStore((cb) => subscribeEntitlements(cb), () => getEntitlements());
  const { prompt } = useUpgradePrompt();

  useEffect(() => {
    if (activeTool) trackToolUsage(activeTool);
  }, [activeTool, trackToolUsage]);

  const handlePremiumTool = (featureId: string, label: string) => {
    trackToolUsage(featureId);
    if (hasFeature(featureId)) {
      toast.success(`${label} unlocked — opening soon.`);
      return;
    }
    const required = getRequiredProductForFeature(featureId);
    if (required) {
      prompt({
        productId: required.id,
        contextKey: `feature:${featureId}`,
        reason: `${label} is part of ${required.name}. Unlock it to use this tool during investigations.`,
      });
    }
  };
  const toggleDiagnosisForm = useAppStore(s => s.toggleDiagnosisForm);
  const exitCase = useAppStore(s => s.exitCase);
  const [elapsed, setElapsed] = useState('00:00');
  const [showBriefing, setShowBriefing] = useState(true);
  const [mobileDrawer, setMobileDrawer] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCaseState) return;
    const interval = setInterval(() => {
      const ms = Date.now() - currentCaseState.startedAt;
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      setElapsed(
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [currentCaseState]);

  if (!currentCaseDef || !currentCaseState) return null;

  const renderToolPanel = () => {
    switch (activeTool) {
      case 'terminal':
        return <TerminalPanel />;
      case 'event-log':
        return <EventLogPanel />;
      case 'ticket-history':
        return <TicketHistoryPanel />;
      default:
        return <TerminalPanel />;
    }
  };

  const renderDrawerContent = () => {
    switch (mobileDrawer) {
      case 'evidence':
        return <EvidenceLocker />;
      case 'hints':
        return <HintPanel />;
      case 'symptoms':
        return (
          <>
            <SymptomsPanel />
            <div className="border-t border-zinc-800/30">
              <ActionLog />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0e14] flex flex-col">
      <header className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#111822] border-b border-zinc-800/50 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={exitCase}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Exit</span>
          </button>

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
              {currentCaseDef.title}
            </h1>
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-zinc-500">
                {categoryLabels[currentCaseDef.category]}
              </span>
              <span className="text-zinc-700">|</span>
              <span className={`uppercase tracking-wider ${difficultyColors[currentCaseDef.difficulty]}`}>
                {currentCaseDef.difficulty}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => setShowBriefing(true)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Briefcase size={12} />
            <span className="hidden md:inline">Briefing</span>
          </button>

          <div className="flex items-center gap-1 text-xs font-mono text-zinc-500">
            <Clock size={12} />
            {elapsed}
          </div>

          <div className="hidden sm:flex items-center gap-1 text-xs font-mono text-zinc-600">
            <Save size={12} />
            saved
          </div>

          <button
            onClick={toggleDiagnosisForm}
            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono uppercase tracking-wider rounded hover:bg-cyan-500/20 transition-colors"
          >
            <Send size={12} />
            <span className="hidden sm:inline">Submit Diagnosis</span>
            <span className="sm:hidden">Submit</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-4 py-1.5 sm:py-2 bg-[#0d1219] border-b border-zinc-800/30">
            {toolTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTool(tab.id)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                    activeTool === tab.id
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                  }`}
                >
                  <Icon size={12} />
                  <span className="hidden xs:inline">{tab.label}</span>
                </button>
              );
            })}

            <div className="hidden md:flex items-center gap-1 ml-2 pl-2 border-l border-zinc-800/50">
              {premiumTools.map((tool) => {
                const Icon = tool.icon;
                const unlocked = hasFeature(tool.id);
                return (
                  <button
                    key={tool.id}
                    onClick={() => handlePremiumTool(tool.id, tool.label)}
                    className={`flex items-center gap-1 px-2 py-1.5 text-xs font-mono rounded border transition-colors ${
                      unlocked
                        ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                        : 'border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700/60'
                    }`}
                    title={unlocked ? `${tool.label} (unlocked)` : `${tool.label} (upgrade to unlock)`}
                  >
                    {unlocked ? <Icon size={11} /> : <Lock size={11} />}
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1" />

            <div className="flex lg:hidden items-center gap-1">
              {sidebarTabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setMobileDrawer(mobileDrawer === tab.id ? null : tab.id)}
                    className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg transition-colors ${
                      mobileDrawer === tab.id
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                    title={tab.label}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 p-2 sm:p-3 overflow-hidden relative">
            {renderToolPanel()}

            <AnimatePresence>
              {mobileDrawer && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="absolute inset-x-0 bottom-0 z-30 bg-[#0c1017] border-t border-zinc-800/50 rounded-t-xl max-h-[60%] overflow-y-auto lg:hidden"
                >
                  <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-[#0c1017] border-b border-zinc-800/30">
                    <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                      {sidebarTabs.find(t => t.id === mobileDrawer)?.label}
                    </span>
                    <button
                      onClick={() => setMobileDrawer(null)}
                      className="p-1 text-zinc-500 hover:text-zinc-300"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {renderDrawerContent()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="hidden lg:flex w-72 border-l border-zinc-800/50 bg-[#0c1017] flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <SymptomsPanel />

            <div className="border-t border-zinc-800/30">
              <EvidenceLocker />
            </div>

            <div className="border-t border-zinc-800/30">
              <HintPanel />
            </div>

            <div className="border-t border-zinc-800/30">
              <ActionLog />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDiagnosisForm && <DiagnosisForm />}
      </AnimatePresence>

      <AnimatePresence>
        {showBriefing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#111822] border border-zinc-800/60 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <Briefcase size={16} className="text-cyan-400" />
                  <h2 className="font-mono text-sm uppercase tracking-wider text-zinc-200">
                    Case Briefing
                  </h2>
                </div>
                <button
                  onClick={() => setShowBriefing(false)}
                  className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                  {currentCaseDef.title}
                </h3>
                <div className="flex items-center gap-2 mb-4 text-xs">
                  <span className="text-zinc-500">
                    {categoryLabels[currentCaseDef.category]}
                  </span>
                  <span className="text-zinc-700">|</span>
                  <span className={`uppercase tracking-wider ${difficultyColors[currentCaseDef.difficulty]}`}>
                    {currentCaseDef.difficulty}
                  </span>
                </div>

                <pre className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap font-sans mb-6">
                  {currentCaseDef.briefing}
                </pre>

                <p className="text-sm text-zinc-500 mb-4">
                  {currentCaseDef.description}
                </p>

                <button
                  onClick={() => setShowBriefing(false)}
                  className="w-full py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-xs uppercase tracking-widest rounded hover:bg-cyan-500/20 transition-colors"
                >
                  Begin Investigation
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
