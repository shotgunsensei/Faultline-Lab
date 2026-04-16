import { AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import { useState, useEffect } from 'react';

const toolTabs = [
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'event-log', label: 'Event Logs', icon: FileText },
  { id: 'ticket-history', label: 'Ticket History', icon: MessageSquare },
];

export default function InvestigationWorkspace() {
  const currentCaseDef = useAppStore(s => s.currentCaseDef);
  const currentCaseState = useAppStore(s => s.currentCaseState);
  const activeTool = useAppStore(s => s.activeTool);
  const setActiveTool = useAppStore(s => s.setActiveTool);
  const showDiagnosisForm = useAppStore(s => s.showDiagnosisForm);
  const toggleDiagnosisForm = useAppStore(s => s.toggleDiagnosisForm);
  const exitCase = useAppStore(s => s.exitCase);
  const [elapsed, setElapsed] = useState('00:00');

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

  return (
    <div className="fixed inset-0 bg-[#0a0e14] flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 bg-[#111822] border-b border-zinc-800/50">
        <div className="flex items-center gap-4">
          <button
            onClick={exitCase}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Exit</span>
          </button>

          <div className="h-4 w-px bg-zinc-800" />

          <div>
            <h1 className="text-sm font-semibold text-zinc-100">
              {currentCaseDef.title}
            </h1>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500">
                {categoryLabels[currentCaseDef.category]}
              </span>
              <span className="text-zinc-700">|</span>
              <span
                className={`uppercase tracking-wider ${
                  difficultyColors[currentCaseDef.difficulty]
                }`}
              >
                {currentCaseDef.difficulty}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
            <Clock size={12} />
            {elapsed}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-600">
            <Save size={12} />
            auto-saved
          </div>

          <button
            onClick={toggleDiagnosisForm}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono uppercase tracking-wider rounded hover:bg-cyan-500/20 transition-colors"
          >
            <Send size={12} />
            Submit Diagnosis
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-1 px-4 py-2 bg-[#0d1219] border-b border-zinc-800/30">
            {toolTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTool(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                    activeTool === tab.id
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                  }`}
                >
                  <Icon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 p-3 overflow-hidden">
            {renderToolPanel()}
          </div>
        </div>

        <div className="w-72 border-l border-zinc-800/50 bg-[#0c1017] flex flex-col overflow-hidden">
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
    </div>
  );
}
