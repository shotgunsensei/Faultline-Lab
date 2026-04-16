import { useAppStore } from '@/stores/useAppStore';
import { MessageSquare, User } from 'lucide-react';

export default function TicketHistoryPanel() {
  const currentCaseDef = useAppStore(s => s.currentCaseDef);

  if (!currentCaseDef) return null;

  return (
    <div className="flex flex-col h-full bg-[#0c1017] rounded-lg border border-zinc-800/50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-[#111822] border-b border-zinc-800/50">
        <MessageSquare size={14} className="text-cyan-400" />
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
          Ticket History
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentCaseDef.ticketHistory.map(note => (
          <div
            key={note.id}
            className="border border-zinc-800/40 rounded-lg p-4 bg-[#111822]/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded bg-zinc-800/60">
                <User size={12} className="text-zinc-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-zinc-200">
                  {note.author}
                </span>
                <span className="text-xs text-zinc-600 ml-2">
                  {note.role}
                </span>
              </div>
              <span className="ml-auto text-xs font-mono text-zinc-600">
                {note.timestamp}
              </span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed pl-8">
              {note.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
