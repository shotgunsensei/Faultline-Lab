import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  Briefcase,
  Clock,
  FileText,
  Lightbulb,
  Lock,
  MessageSquare,
  Package,
  Save,
  Send,
  Terminal,
  X,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import TerminalPanel from './investigation/TerminalPanel';
import EventLogPanel from './investigation/EventLogPanel';
import TicketHistoryPanel from './investigation/TicketHistoryPanel';
import EvidenceLocker from './investigation/EvidenceLocker';
import HintPanel from './investigation/HintPanel';
import ActionLog from './investigation/ActionLog';
import SymptomsPanel from './investigation/SymptomsPanel';
import DiagnosisForm from './investigation/DiagnosisForm';
import {
  PremiumToolPanel,
  premiumTools,
  type PremiumToolMeta,
} from './investigation/premiumTools';
import { BriefingModal } from './investigation/BriefingModal';
import { categoryLabels, difficultyColors } from '@/data/cases';
import {
  hasFeature,
  getRequiredProductForFeature,
  getEntitlements,
  subscribeEntitlements,
} from '@/lib/entitlements';
import { useUpgradePrompt } from './UpgradePrompt';

// Lazy-load premium investigation panels — they are gated behind entitlements
// and rare in a typical session, so we keep them out of the initial chunk.
const WiresharkPanel = lazy(() => import('./investigation/WiresharkPanel'));
const DeepTelemetryPanel = lazy(() => import('./investigation/DeepTelemetryPanel'));
const ChaosModePanel = lazy(() => import('./investigation/ChaosModePanel'));
const SandboxPanel = lazy(() => import('./investigation/SandboxPanel'));
const ProAnalyticsPanel = lazy(() => import('./investigation/ProAnalyticsPanel'));

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

function PanelLoader({ label }: { label: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs font-mono text-zinc-500">
      Loading {label}…
    </div>
  );
}

export default function InvestigationWorkspace() {
  const currentCaseDef = useAppStore((s) => s.currentCaseDef);
  const currentCaseState = useAppStore((s) => s.currentCaseState);
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const trackToolUsage = useAppStore((s) => s.trackToolUsage);
  const showDiagnosisForm = useAppStore((s) => s.showDiagnosisForm);
  useSyncExternalStore((cb) => subscribeEntitlements(cb), () => getEntitlements());
  const { prompt } = useUpgradePrompt();

  useEffect(() => {
    if (activeTool) trackToolUsage(activeTool);
  }, [activeTool, trackToolUsage]);

  const openUpgradeForFeature = (tool: PremiumToolMeta) => {
    const required = getRequiredProductForFeature(tool.id);
    if (!required) return;
    prompt({
      productId: required.id,
      contextKey: `feature:${tool.id}`,
      reason: `${tool.label} is part of ${required.name}. ${tool.description}`,
    });
  };

  const handlePremiumTool = (tool: PremiumToolMeta) => {
    trackToolUsage(tool.id);
    setActiveTool(tool.id);
  };
  const toggleDiagnosisForm = useAppStore((s) => s.toggleDiagnosisForm);
  const exitCase = useAppStore((s) => s.exitCase);
  const [elapsed, setElapsed] = useState('00:00');
  const [countdown, setCountdown] = useState<{ label: string; overtime: boolean } | null>(null);
  const [showBriefing, setShowBriefing] = useState(true);
  const [mobileDrawer, setMobileDrawer] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCaseState) return;
    const tick = () => {
      const ms = Date.now() - currentCaseState.startedAt;
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      setElapsed(
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );

      if (currentCaseState.chaos?.timePressure && currentCaseState.timeLimitMs) {
        const remainingMs = currentCaseState.timeLimitMs - ms;
        const overtime = remainingMs < 0;
        const absMs = Math.abs(remainingMs);
        const m = Math.floor(absMs / 60000).toString().padStart(2, '0');
        const s = Math.floor((absMs % 60000) / 1000).toString().padStart(2, '0');
        setCountdown({ label: `${overtime ? '+' : ''}${m}:${s}`, overtime });
      } else {
        setCountdown(null);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
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
      default: {
        const premium = premiumTools.find((t) => t.id === activeTool);
        if (premium) {
          if (hasFeature(premium.id)) {
            const Lazy = (() => {
              switch (premium.id) {
                case 'wireshark-panel':
                  return WiresharkPanel;
                case 'deep-telemetry':
                  return DeepTelemetryPanel;
                case 'chaos-mode':
                  return ChaosModePanel;
                case 'sandbox-pro':
                  return SandboxPanel;
                case 'pro-analytics':
                  return ProAnalyticsPanel;
                default:
                  return null;
              }
            })();
            if (Lazy) {
              return (
                <Suspense fallback={<PanelLoader label={premium.label} />}>
                  <Lazy />
                </Suspense>
              );
            }
          }
          return (
            <PremiumToolPanel
              tool={premium}
              unlocked={false}
              onUpgrade={() => openUpgradeForFeature(premium)}
            />
          );
        }
        return <TerminalPanel />;
      }
    }
  };

  const handleMobilePremiumTap = (tool: PremiumToolMeta) => {
    setMobileDrawer(null);
    handlePremiumTool(tool);
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
      case 'tools':
        return (
          <div className="p-3 space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 px-1">
              Premium investigation tools
            </p>
            {premiumTools.map((tool) => {
              const Icon = tool.icon;
              const unlocked = hasFeature(tool.id);
              const required = unlocked ? null : getRequiredProductForFeature(tool.id);
              return (
                <button
                  key={tool.id}
                  onClick={() => handleMobilePremiumTap(tool)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    unlocked
                      ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                      : 'border-zinc-800/60 bg-black/20 hover:border-cyan-500/40 hover:bg-cyan-500/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-md shrink-0 ${
                        unlocked
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-cyan-500/10 text-cyan-300'
                      }`}
                    >
                      {unlocked ? <Icon size={16} /> : <Lock size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-100">
                          {tool.label}
                        </span>
                        <span
                          className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            unlocked
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-cyan-500/10 text-cyan-300'
                          }`}
                        >
                          {unlocked ? 'Unlocked' : 'Locked'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-snug mt-1">
                        {tool.description}
                      </p>
                      {required && (
                        <p className="text-[11px] text-cyan-300/80 mt-1.5">
                          Included in {required.name}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div data-tour="investigation-workspace" className="fixed inset-0 bg-[#0a0e14] flex flex-col">
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
              <span
                className={`uppercase tracking-wider ${difficultyColors[currentCaseDef.difficulty]}`}
              >
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

          {countdown && (
            <div
              className={`flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded border ${
                countdown.overtime
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              }`}
              title={
                countdown.overtime
                  ? 'Overtime — losing efficiency points'
                  : 'Chaos Mode time pressure'
              }
            >
              <Zap size={12} />
              {countdown.label}
            </div>
          )}

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
            {toolTabs.map((tab) => {
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
                const isActive = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => handlePremiumTool(tool)}
                    className={`flex items-center gap-1 px-2 py-1.5 text-xs font-mono rounded border transition-colors ${
                      isActive
                        ? unlocked
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                        : unlocked
                          ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                          : 'border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700/60'
                    }`}
                    title={
                      unlocked ? `${tool.label} (unlocked)` : `${tool.label} (upgrade to unlock)`
                    }
                  >
                    {unlocked ? <Icon size={11} /> : <Lock size={11} />}
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1" />

            <div className="flex lg:hidden items-center gap-1">
              <button
                onClick={() => setMobileDrawer(mobileDrawer === 'tools' ? null : 'tools')}
                className={`md:hidden relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg transition-colors ${
                  mobileDrawer === 'tools'
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
                title="Premium tools"
                aria-label="Premium tools"
              >
                <Lock size={18} />
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-cyan-500/80 text-[9px] font-mono font-semibold text-white flex items-center justify-center">
                  {premiumTools.length}
                </span>
              </button>
              {sidebarTabs.map((tab) => {
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
                      {mobileDrawer === 'tools'
                        ? 'Premium Tools'
                        : sidebarTabs.find((t) => t.id === mobileDrawer)?.label}
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

      <AnimatePresence>{showDiagnosisForm && <DiagnosisForm />}</AnimatePresence>

      <AnimatePresence>
        {showBriefing && (
          <BriefingModal caseDef={currentCaseDef} onClose={() => setShowBriefing(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
