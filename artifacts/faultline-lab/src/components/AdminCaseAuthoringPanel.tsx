import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Save,
  FileDown,
  Wand2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Copy,
  FolderOpen,
  Hammer,
} from 'lucide-react';
import {
  composeCase,
  createTemplate,
  validateDraft,
  type CaseDraft,
  type AuthorEvidence,
  type AuthoringIssue,
  type DomainTemplate,
} from '@/data/cases/authoring';
import { categoryLabels, difficultyColors } from '@/data/cases';
import type {
  CaseCategory,
  Difficulty,
  EventLogEntry,
  HintTier,
  Symptom,
  TicketNote,
  ToolCommand,
  ToolType,
} from '@/types';

const DOMAIN_OPTIONS: Array<{ value: DomainTemplate; label: string }> = [
  { value: 'windows-ad', label: 'Windows / Active Directory' },
  { value: 'networking', label: 'Networking / VPN' },
  { value: 'servers', label: 'Servers / Services' },
  { value: 'automotive', label: 'Automotive Diagnostics' },
  { value: 'electronics', label: 'Electronics / Sensor Mesh' },
  { value: 'mixed', label: 'Mixed Systems' },
  { value: 'healthcare-imaging', label: 'Healthcare / Imaging (PACS)' },
];

const CATEGORY_OPTIONS: CaseCategory[] = [
  'windows-ad',
  'networking',
  'automotive',
  'electronics',
  'servers',
  'mixed',
];

const DIFFICULTY_OPTIONS: Difficulty[] = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
];

const TOOL_OPTIONS: ToolType[] = [
  'terminal',
  'event-log',
  'ticket-history',
  'network-map',
  'service-inspector',
  'registry-viewer',
  'sensor-graph',
  'obd-panel',
  'firewall-table',
];

const DRAFT_STORAGE_KEY = 'faultline-lab/admin/case-drafts/v1';

interface StoredDraft {
  draft: CaseDraft;
  savedAt: number;
}

function isCaseDraftShape(value: unknown): value is CaseDraft {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.slug === 'string' &&
    typeof v.title === 'string' &&
    typeof v.category === 'string' &&
    typeof v.difficulty === 'string' &&
    typeof v.description === 'string' &&
    typeof v.briefing === 'string' &&
    Array.isArray(v.symptoms) &&
    Array.isArray(v.evidence) &&
    Array.isArray(v.hints) &&
    Array.isArray(v.terminalCommands) &&
    Array.isArray(v.eventLogs) &&
    Array.isArray(v.ticketHistory) &&
    Array.isArray(v.availableTools) &&
    Array.isArray(v.redHerrings) &&
    Array.isArray(v.preventativeMeasures) &&
    typeof v.remediation === 'string' &&
    !!v.rootCause &&
    typeof v.rootCause === 'object'
  );
}

function loadStoredDrafts(): Record<string, StoredDraft> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, StoredDraft> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const v = value as { draft?: unknown; savedAt?: unknown } | null;
      if (
        v &&
        typeof v === 'object' &&
        isCaseDraftShape(v.draft) &&
        typeof v.savedAt === 'number'
      ) {
        out[key] = { draft: v.draft, savedAt: v.savedAt };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function persistStoredDrafts(map: Record<string, StoredDraft>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota issues silently; the toast layer will surface save failures
  }
}

function blankDraft(): CaseDraft {
  return createTemplate('windows-ad', {
    id: 'new-case',
    slug: 'new-case',
    title: 'Untitled Case',
  });
}

function issuesForPath(issues: AuthoringIssue[], pathPrefix: string): AuthoringIssue[] {
  return issues.filter((i) => i.path === pathPrefix || i.path?.startsWith(`${pathPrefix}`));
}

function topLevelIssues(issues: AuthoringIssue[]): AuthoringIssue[] {
  return issues.filter((i) => !i.path);
}

function FieldIssues({ issues }: { issues: AuthoringIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {issues.map((i, idx) => (
        <li
          key={`${i.code}-${idx}`}
          className={`text-[11px] font-mono flex items-start gap-1 ${
            i.level === 'error' ? 'text-red-400' : 'text-amber-300'
          }`}
        >
          {i.level === 'error' ? (
            <AlertCircle size={11} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          )}
          <span>{i.message}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          {description && (
            <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
        {label}
        {hint && <span className="ml-2 text-zinc-600 normal-case font-sans">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50';

export default function AdminCaseAuthoringPanel() {
  const [draft, setDraft] = useState<CaseDraft>(() => blankDraft());
  const [domain, setDomain] = useState<DomainTemplate>('windows-ad');
  const [storedDrafts, setStoredDrafts] = useState<Record<string, StoredDraft>>(
    () => loadStoredDrafts()
  );
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    setStoredDrafts(loadStoredDrafts());
  }, []);

  const validation = useMemo(() => validateDraft(draft), [draft]);
  const issues = validation.issues;

  const update = <K extends keyof CaseDraft>(key: K, value: CaseDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const applyTemplate = () => {
    const next = createTemplate(domain, {
      id: draft.id || 'new-case',
      slug: draft.slug || draft.id || 'new-case',
      title: draft.title || 'Untitled Case',
      difficulty: draft.difficulty,
    });
    setDraft(next);
    toast.success(`Applied ${domain} template.`);
  };

  const resetDraft = () => {
    setDraft(blankDraft());
    setDomain('windows-ad');
    toast.info('Draft cleared.');
  };

  const saveDraft = () => {
    if (!draft.id.trim()) {
      toast.error('Draft needs an id before it can be saved.');
      return;
    }
    const next: Record<string, StoredDraft> = {
      ...storedDrafts,
      [draft.id]: { draft, savedAt: Date.now() },
    };
    persistStoredDrafts(next);
    setStoredDrafts(next);
    toast.success(`Saved draft "${draft.id}" locally.`);
  };

  const loadDraft = (id: string) => {
    const stored = storedDrafts[id];
    if (!stored) return;
    setDraft(stored.draft);
    toast.info(`Loaded draft "${id}".`);
  };

  const deleteDraft = (id: string) => {
    const next = { ...storedDrafts };
    delete next[id];
    persistStoredDrafts(next);
    setStoredDrafts(next);
    toast.info(`Deleted draft "${id}".`);
  };

  const exportDraft = async () => {
    if (validation.errorCount > 0) {
      toast.error('Fix validation errors before exporting.');
      return;
    }
    try {
      const composed = composeCase(draft);
      const json = JSON.stringify(composed, null, 2);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(json);
        toast.success('Composed case copied to clipboard as JSON.');
      } else {
        toast.success('Composed case ready (clipboard unavailable).');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Compose failed.');
    }
  };

  // ---- Symptoms ---------------------------------------------------------
  const updateSymptom = (idx: number, patch: Partial<Symptom>) => {
    const next = draft.symptoms.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    update('symptoms', next);
  };
  const addSymptom = () => {
    const id = `s${draft.symptoms.length + 1}`;
    update('symptoms', [
      ...draft.symptoms,
      { id, description: '', severity: 'medium' },
    ]);
  };
  const removeSymptom = (idx: number) => {
    update('symptoms', draft.symptoms.filter((_, i) => i !== idx));
  };

  // ---- Evidence ---------------------------------------------------------
  const updateEvidence = (idx: number, patch: Partial<AuthorEvidence>) => {
    const next = draft.evidence.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    update('evidence', next);
  };
  const addEvidence = () => {
    const id = `e${draft.evidence.length + 1}`;
    update('evidence', [
      ...draft.evidence,
      {
        id,
        title: '',
        description: '',
        category: 'clue',
        importance: 'medium',
      },
    ]);
  };
  const removeEvidence = (idx: number) => {
    update('evidence', draft.evidence.filter((_, i) => i !== idx));
  };

  // ---- Hints ------------------------------------------------------------
  const updateHint = (idx: number, patch: Partial<HintTier>) => {
    const next = draft.hints.map((h, i) => (i === idx ? { ...h, ...patch } : h));
    update('hints', next);
  };

  // ---- Commands ---------------------------------------------------------
  const updateCommand = (idx: number, patch: Partial<ToolCommand>) => {
    const next = draft.terminalCommands.map((c, i) =>
      i === idx ? { ...c, ...patch } : c
    );
    update('terminalCommands', next);
  };
  const addCommand = () =>
    update('terminalCommands', [
      ...draft.terminalCommands,
      { command: '', description: '', output: '', revealsEvidence: [] },
    ]);
  const removeCommand = (idx: number) =>
    update('terminalCommands', draft.terminalCommands.filter((_, i) => i !== idx));

  // ---- Event logs -------------------------------------------------------
  const updateEvent = (idx: number, patch: Partial<EventLogEntry>) => {
    const next = draft.eventLogs.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    update('eventLogs', next);
  };
  const addEvent = () => {
    const id = `el${draft.eventLogs.length + 1}`;
    update('eventLogs', [
      ...draft.eventLogs,
      {
        id,
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        source: draft.category,
        level: 'info',
        message: '',
        revealsEvidence: [],
      },
    ]);
  };
  const removeEvent = (idx: number) =>
    update('eventLogs', draft.eventLogs.filter((_, i) => i !== idx));

  // ---- Tickets ----------------------------------------------------------
  const updateTicket = (idx: number, patch: Partial<TicketNote>) => {
    const next = draft.ticketHistory.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    update('ticketHistory', next);
  };
  const addTicket = () => {
    const id = `th${draft.ticketHistory.length + 1}`;
    update('ticketHistory', [
      ...draft.ticketHistory,
      {
        id,
        author: '',
        role: '',
        timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
        content: '',
        revealsEvidence: [],
      },
    ]);
  };
  const removeTicket = (idx: number) =>
    update('ticketHistory', draft.ticketHistory.filter((_, i) => i !== idx));

  // ---- Tools ------------------------------------------------------------
  const toggleTool = (tool: ToolType) => {
    const has = draft.availableTools.includes(tool);
    update(
      'availableTools',
      has ? draft.availableTools.filter((t) => t !== tool) : [...draft.availableTools, tool]
    );
  };

  const evidenceIds = draft.evidence.map((e) => e.id).filter(Boolean);

  const promote = () => {
    if (validation.errorCount > 0) {
      toast.error('Fix validation errors before promoting.');
      return;
    }
    toast.message('Promotion to the live registry requires a code change.', {
      description:
        'Use Export to copy the composed JSON, then add it to src/data/cases/registry.ts in a follow-up deploy.',
    });
  };

  const storedKeys = Object.keys(storedDrafts).sort();

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4 min-w-0">
        {/* Template / draft management */}
        <Section
          title="Template"
          description="Pick a domain to scaffold a fresh draft. Existing fields are reset."
          action={
            <button
              onClick={resetDraft}
              className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200"
            >
              Reset
            </button>
          }
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value as DomainTemplate)}
              className={inputCls + ' sm:flex-1'}
            >
              {DOMAIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={applyTemplate}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono uppercase tracking-wider hover:bg-cyan-500/20"
            >
              <Wand2 size={12} /> Apply Template
            </button>
          </div>
        </Section>

        {/* Identity */}
        <Section title="Identity">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Labeled label="Case ID">
                <input
                  value={draft.id}
                  onChange={(e) => update('id', e.target.value)}
                  className={inputCls}
                />
              </Labeled>
              <FieldIssues issues={issues.filter((i) => i.code === 'missing-id')} />
            </div>
            <div>
              <Labeled label="Slug">
                <input
                  value={draft.slug}
                  onChange={(e) => update('slug', e.target.value)}
                  className={inputCls}
                />
              </Labeled>
              <FieldIssues issues={issues.filter((i) => i.code === 'missing-slug')} />
            </div>
            <div className="sm:col-span-2">
              <Labeled label="Title">
                <input
                  value={draft.title}
                  onChange={(e) => update('title', e.target.value)}
                  className={inputCls}
                />
              </Labeled>
              <FieldIssues issues={issues.filter((i) => i.code === 'missing-title')} />
            </div>
            <div>
              <Labeled label="Category">
                <select
                  value={draft.category}
                  onChange={(e) => update('category', e.target.value as CaseCategory)}
                  className={inputCls}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabels[c] || c}
                    </option>
                  ))}
                </select>
              </Labeled>
              <FieldIssues issues={issues.filter((i) => i.code === 'invalid-category')} />
            </div>
            <div>
              <Labeled label="Difficulty">
                <select
                  value={draft.difficulty}
                  onChange={(e) => update('difficulty', e.target.value as Difficulty)}
                  className={inputCls}
                >
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Labeled>
              <FieldIssues issues={issues.filter((i) => i.code === 'invalid-difficulty')} />
            </div>
          </div>
          <div>
            <Labeled label="Short description" hint="Shown on the incident card.">
              <input
                value={draft.description}
                onChange={(e) => update('description', e.target.value)}
                className={inputCls}
              />
            </Labeled>
            <FieldIssues issues={issues.filter((i) => i.code === 'missing-description')} />
          </div>
          <div>
            <Labeled label="Briefing" hint="Multi-line operator brief.">
              <textarea
                rows={4}
                value={draft.briefing}
                onChange={(e) => update('briefing', e.target.value)}
                className={inputCls + ' font-mono text-xs'}
              />
            </Labeled>
            <FieldIssues issues={issues.filter((i) => i.code === 'missing-briefing')} />
          </div>
        </Section>

        {/* Symptoms */}
        <Section
          title="Symptoms"
          description="At least 2 required."
          action={
            <button
              onClick={addSymptom}
              className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
            >
              <Plus size={12} /> Add
            </button>
          }
        >
          <FieldIssues issues={issues.filter((i) => i.code === 'too-few-symptoms')} />
          {draft.symptoms.map((s, idx) => (
            <div
              key={idx}
              className="border border-zinc-800/60 rounded-lg p-3 bg-zinc-950/40 space-y-2"
            >
              <div className="grid sm:grid-cols-[120px_1fr_140px_auto] gap-2">
                <input
                  value={s.id}
                  onChange={(e) => updateSymptom(idx, { id: e.target.value })}
                  placeholder="id"
                  className={inputCls + ' font-mono text-xs'}
                />
                <input
                  value={s.description}
                  onChange={(e) => updateSymptom(idx, { description: e.target.value })}
                  placeholder="What the user/system observes"
                  className={inputCls}
                />
                <select
                  value={s.severity}
                  onChange={(e) =>
                    updateSymptom(idx, { severity: e.target.value as Symptom['severity'] })
                  }
                  className={inputCls}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </select>
                <button
                  onClick={() => removeSymptom(idx)}
                  className="p-1.5 rounded hover:bg-zinc-800 text-red-400"
                  title="Remove symptom"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </Section>

        {/* Root cause */}
        <Section title="Root cause">
          <FieldIssues issues={issues.filter((i) => i.code === 'missing-root-cause')} />
          <FieldIssues issues={issues.filter((i) => i.code === 'thin-root-cause')} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Labeled label="Root cause id">
              <input
                value={draft.rootCause.id}
                onChange={(e) =>
                  update('rootCause', { ...draft.rootCause, id: e.target.value })
                }
                className={inputCls + ' font-mono text-xs'}
              />
            </Labeled>
            <Labeled label="Root cause title">
              <input
                value={draft.rootCause.title}
                onChange={(e) =>
                  update('rootCause', { ...draft.rootCause, title: e.target.value })
                }
                className={inputCls}
              />
            </Labeled>
          </div>
          <Labeled label="Description">
            <textarea
              rows={2}
              value={draft.rootCause.description}
              onChange={(e) =>
                update('rootCause', { ...draft.rootCause, description: e.target.value })
              }
              className={inputCls}
            />
          </Labeled>
          <Labeled label="Technical detail">
            <textarea
              rows={3}
              value={draft.rootCause.technicalDetail}
              onChange={(e) =>
                update('rootCause', {
                  ...draft.rootCause,
                  technicalDetail: e.target.value,
                })
              }
              className={inputCls + ' font-mono text-xs'}
            />
          </Labeled>
        </Section>

        {/* Evidence */}
        <Section
          title="Evidence"
          description="At least 4 items. Every clue/critical entry must be revealed by a command, event, or ticket."
          action={
            <button
              onClick={addEvidence}
              className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
            >
              <Plus size={12} /> Add
            </button>
          }
        >
          <FieldIssues issues={issues.filter((i) => i.code === 'too-few-evidence')} />
          {draft.evidence.map((e, idx) => {
            const itemIssues = issuesForPath(issues, `evidence.${e.id}`);
            const missingId =
              !e.id && issues.some((i) => i.code === 'missing-evidence-id');
            return (
              <div
                key={idx}
                className="border border-zinc-800/60 rounded-lg p-3 bg-zinc-950/40 space-y-2"
              >
                <div className="grid sm:grid-cols-[120px_1fr_140px_140px_auto] gap-2">
                  <div>
                    <input
                      value={e.id}
                      onChange={(ev) => updateEvidence(idx, { id: ev.target.value })}
                      placeholder="id"
                      className={
                        inputCls +
                        ' font-mono text-xs' +
                        (missingId ? ' border-red-500/60' : '')
                      }
                    />
                    {missingId && (
                      <p className="text-[11px] font-mono text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle size={11} /> id is required
                      </p>
                    )}
                  </div>
                  <input
                    value={e.title}
                    onChange={(ev) => updateEvidence(idx, { title: ev.target.value })}
                    placeholder="Title"
                    className={inputCls}
                  />
                  <select
                    value={e.category}
                    onChange={(ev) =>
                      updateEvidence(idx, {
                        category: ev.target.value as AuthorEvidence['category'],
                      })
                    }
                    className={inputCls}
                  >
                    <option value="clue">clue</option>
                    <option value="red-herring">red-herring</option>
                    <option value="contextual">contextual</option>
                  </select>
                  <select
                    value={e.importance}
                    onChange={(ev) =>
                      updateEvidence(idx, {
                        importance: ev.target.value as AuthorEvidence['importance'],
                      })
                    }
                    className={inputCls}
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                  <button
                    onClick={() => removeEvidence(idx)}
                    className="p-1.5 rounded hover:bg-zinc-800 text-red-400"
                    title="Remove evidence"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={e.description}
                  onChange={(ev) => updateEvidence(idx, { description: ev.target.value })}
                  placeholder="Description"
                  className={inputCls}
                />
                <FieldIssues issues={itemIssues} />
              </div>
            );
          })}
        </Section>

        {/* Hints */}
        <Section
          title="Hint ladder"
          description="Exactly 4 tiers (levels 1–4) with strictly increasing penalties."
        >
          {issues
            .filter(
              (i) => i.code === 'hint-ladder-length' || i.code === 'hint-penalty-monotonic'
            )
            .map((i, idx) => (
              <div
                key={`hint-issue-${idx}`}
                className="text-[11px] font-mono text-red-400 flex items-center gap-1"
              >
                <AlertCircle size={11} /> {i.message}
              </div>
            ))}
          {draft.hints.map((h, idx) => {
            const itemIssues = issuesForPath(issues, `hints[${idx}]`);
            return (
              <div
                key={idx}
                className="border border-zinc-800/60 rounded-lg p-3 bg-zinc-950/40 space-y-2"
              >
                <div className="grid sm:grid-cols-[60px_1fr_120px] gap-2">
                  <div className="text-xs font-mono text-zinc-500 self-center">
                    L{h.level}
                  </div>
                  <input
                    value={h.label}
                    onChange={(e) => updateHint(idx, { label: e.target.value })}
                    placeholder="Label"
                    className={inputCls}
                  />
                  <input
                    type="number"
                    value={h.scorePenalty}
                    onChange={(e) =>
                      updateHint(idx, { scorePenalty: Number(e.target.value) || 0 })
                    }
                    className={inputCls + ' font-mono text-xs'}
                  />
                </div>
                <textarea
                  rows={2}
                  value={h.text}
                  onChange={(e) => updateHint(idx, { text: e.target.value })}
                  placeholder="Hint text"
                  className={inputCls}
                />
                <FieldIssues issues={itemIssues} />
              </div>
            );
          })}
        </Section>

        {/* Commands */}
        <Section
          title="Terminal commands"
          action={
            <button
              onClick={addCommand}
              className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
            >
              <Plus size={12} /> Add
            </button>
          }
        >
          {draft.terminalCommands.map((c, idx) => {
            const itemIssues = issues.filter((i) =>
              i.path?.startsWith(`command:${c.command}`)
            );
            return (
              <div
                key={idx}
                className="border border-zinc-800/60 rounded-lg p-3 bg-zinc-950/40 space-y-2"
              >
                <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    value={c.command}
                    onChange={(e) => updateCommand(idx, { command: e.target.value })}
                    placeholder="command"
                    className={inputCls + ' font-mono text-xs'}
                  />
                  <input
                    value={c.description}
                    onChange={(e) => updateCommand(idx, { description: e.target.value })}
                    placeholder="Description"
                    className={inputCls}
                  />
                  <button
                    onClick={() => removeCommand(idx)}
                    className="p-1.5 rounded hover:bg-zinc-800 text-red-400"
                    title="Remove command"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={c.output}
                  onChange={(e) => updateCommand(idx, { output: e.target.value })}
                  placeholder="Command output"
                  className={inputCls + ' font-mono text-xs'}
                />
                <input
                  value={(c.revealsEvidence || []).join(', ')}
                  onChange={(e) =>
                    updateCommand(idx, {
                      revealsEvidence: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Reveals evidence ids (comma separated)"
                  className={inputCls + ' font-mono text-xs'}
                />
                <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={!!c.isRisky}
                    onChange={(e) => updateCommand(idx, { isRisky: e.target.checked })}
                  />
                  Risky action (applies score penalty)
                </label>
                <FieldIssues issues={itemIssues} />
              </div>
            );
          })}
        </Section>

        {/* Event logs */}
        <Section
          title="Event log entries"
          action={
            <button
              onClick={addEvent}
              className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
            >
              <Plus size={12} /> Add
            </button>
          }
        >
          {draft.eventLogs.map((e, idx) => {
            const itemIssues = issues.filter((i) => i.path?.startsWith(`eventLog:${e.id}`));
            return (
              <div
                key={idx}
                className="border border-zinc-800/60 rounded-lg p-3 bg-zinc-950/40 space-y-2"
              >
                <div className="grid sm:grid-cols-[120px_180px_120px_120px_auto] gap-2">
                  <input
                    value={e.id}
                    onChange={(ev) => updateEvent(idx, { id: ev.target.value })}
                    placeholder="id"
                    className={inputCls + ' font-mono text-xs'}
                  />
                  <input
                    value={e.timestamp}
                    onChange={(ev) => updateEvent(idx, { timestamp: ev.target.value })}
                    placeholder="YYYY-MM-DD HH:MM:SS"
                    className={inputCls + ' font-mono text-xs'}
                  />
                  <input
                    value={e.source}
                    onChange={(ev) => updateEvent(idx, { source: ev.target.value })}
                    placeholder="source"
                    className={inputCls + ' font-mono text-xs'}
                  />
                  <select
                    value={e.level}
                    onChange={(ev) =>
                      updateEvent(idx, { level: ev.target.value as EventLogEntry['level'] })
                    }
                    className={inputCls}
                  >
                    <option value="info">info</option>
                    <option value="warning">warning</option>
                    <option value="error">error</option>
                    <option value="critical">critical</option>
                  </select>
                  <button
                    onClick={() => removeEvent(idx)}
                    className="p-1.5 rounded hover:bg-zinc-800 text-red-400"
                    title="Remove event"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  value={e.message}
                  onChange={(ev) => updateEvent(idx, { message: ev.target.value })}
                  placeholder="Message"
                  className={inputCls}
                />
                <input
                  value={(e.revealsEvidence || []).join(', ')}
                  onChange={(ev) =>
                    updateEvent(idx, {
                      revealsEvidence: ev.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Reveals evidence ids (comma separated)"
                  className={inputCls + ' font-mono text-xs'}
                />
                <FieldIssues issues={itemIssues} />
              </div>
            );
          })}
        </Section>

        {/* Tickets */}
        <Section
          title="Ticket history"
          action={
            <button
              onClick={addTicket}
              className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
            >
              <Plus size={12} /> Add
            </button>
          }
        >
          {draft.ticketHistory.map((t, idx) => {
            const itemIssues = issues.filter((i) => i.path?.startsWith(`ticket:${t.id}`));
            return (
              <div
                key={idx}
                className="border border-zinc-800/60 rounded-lg p-3 bg-zinc-950/40 space-y-2"
              >
                <div className="grid sm:grid-cols-[100px_1fr_1fr_180px_auto] gap-2">
                  <input
                    value={t.id}
                    onChange={(e) => updateTicket(idx, { id: e.target.value })}
                    placeholder="id"
                    className={inputCls + ' font-mono text-xs'}
                  />
                  <input
                    value={t.author}
                    onChange={(e) => updateTicket(idx, { author: e.target.value })}
                    placeholder="Author"
                    className={inputCls}
                  />
                  <input
                    value={t.role}
                    onChange={(e) => updateTicket(idx, { role: e.target.value })}
                    placeholder="Role"
                    className={inputCls}
                  />
                  <input
                    value={t.timestamp}
                    onChange={(e) => updateTicket(idx, { timestamp: e.target.value })}
                    placeholder="Timestamp"
                    className={inputCls + ' font-mono text-xs'}
                  />
                  <button
                    onClick={() => removeTicket(idx)}
                    className="p-1.5 rounded hover:bg-zinc-800 text-red-400"
                    title="Remove ticket"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={t.content}
                  onChange={(e) => updateTicket(idx, { content: e.target.value })}
                  placeholder="Ticket content"
                  className={inputCls}
                />
                <input
                  value={(t.revealsEvidence || []).join(', ')}
                  onChange={(e) =>
                    updateTicket(idx, {
                      revealsEvidence: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Reveals evidence ids (comma separated)"
                  className={inputCls + ' font-mono text-xs'}
                />
                <FieldIssues issues={itemIssues} />
              </div>
            );
          })}
        </Section>

        {/* Tools */}
        <Section title="Available tools">
          <FieldIssues
            issues={issues.filter(
              (i) => i.code === 'no-tools' || i.code === 'single-tool-advanced'
            )}
          />
          <div className="flex flex-wrap gap-1.5">
            {TOOL_OPTIONS.map((t) => {
              const active = draft.availableTools.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTool(t)}
                  className={`text-[11px] font-mono uppercase px-2 py-1 rounded border transition-colors ${
                    active
                      ? 'bg-cyan-500/10 text-cyan-200 border-cyan-500/40'
                      : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Outcome metadata */}
        <Section title="Outcome">
          <div>
            <Labeled label="Remediation">
              <textarea
                rows={2}
                value={draft.remediation}
                onChange={(e) => update('remediation', e.target.value)}
                className={inputCls}
              />
            </Labeled>
            <FieldIssues issues={issues.filter((i) => i.code === 'missing-remediation')} />
          </div>
          <div>
            <Labeled
              label="Preventative measures"
              hint="One per line."
            >
              <textarea
                rows={3}
                value={draft.preventativeMeasures.join('\n')}
                onChange={(e) =>
                  update(
                    'preventativeMeasures',
                    e.target.value
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                className={inputCls}
              />
            </Labeled>
            <FieldIssues issues={issues.filter((i) => i.code === 'no-preventatives')} />
          </div>
          <div>
            <Labeled
              label="Max score"
              hint="Engine normalized scale — must be 100."
            >
              <input
                type="number"
                value={draft.maxScore ?? 100}
                onChange={(e) =>
                  update('maxScore', e.target.value === '' ? undefined : Number(e.target.value))
                }
                className={inputCls + ' font-mono text-xs'}
              />
            </Labeled>
            <FieldIssues issues={issues.filter((i) => i.code === 'invalid-max-score')} />
          </div>
          <Labeled label="Red herrings (one per line)">
            <textarea
              rows={2}
              value={draft.redHerrings.join('\n')}
              onChange={(e) =>
                update(
                  'redHerrings',
                  e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              className={inputCls}
            />
          </Labeled>
        </Section>
      </div>

      {/* Sidebar: validation + preview + saved drafts */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-100">Validation</h3>
            {validation.errorCount === 0 ? (
              <span className="flex items-center gap-1 text-xs text-emerald-300">
                <CheckCircle2 size={12} /> Ready
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <AlertCircle size={12} /> {validation.errorCount} error
                {validation.errorCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mb-2">
            {validation.errorCount} error{validation.errorCount === 1 ? '' : 's'},{' '}
            {validation.warningCount} warning{validation.warningCount === 1 ? '' : 's'}.
          </p>
          {topLevelIssues(issues).length > 0 ? (
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {topLevelIssues(issues).map((i, idx) => (
                <li
                  key={`tl-${idx}`}
                  className={`text-[11px] font-mono flex items-start gap-1 ${
                    i.level === 'error' ? 'text-red-400' : 'text-amber-300'
                  }`}
                >
                  {i.level === 'error' ? (
                    <AlertCircle size={11} className="mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  )}
                  <span>
                    [{i.code}] {i.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-zinc-500">No top-level issues.</p>
          )}
          <div className="flex flex-col gap-2 mt-3">
            <button
              onClick={saveDraft}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono uppercase tracking-wider hover:bg-emerald-500/20"
            >
              <Save size={12} /> Save draft
            </button>
            <button
              onClick={exportDraft}
              disabled={validation.errorCount > 0}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono uppercase tracking-wider hover:bg-zinc-700 disabled:opacity-50"
              title="Compose and copy JSON"
            >
              <Copy size={12} /> Export JSON
            </button>
            <button
              onClick={promote}
              disabled={validation.errorCount > 0}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono uppercase tracking-wider hover:bg-amber-500/20 disabled:opacity-50"
              title="Promote to live registry (manual deploy)"
            >
              <Hammer size={12} /> Promote
            </button>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
              <Eye size={13} /> Preview
            </h3>
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200"
            >
              {showPreview ? 'Hide' : 'Show'}
            </button>
          </div>
          {showPreview && (
            <div className="bg-[#111822] border border-zinc-800/60 rounded-lg p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">
                {categoryLabels[draft.category] || draft.category}
              </div>
              <h4 className="text-base font-semibold text-zinc-100 mt-1">
                {draft.title || 'Untitled Case'}
              </h4>
              <p className="text-sm text-zinc-400 mt-2 line-clamp-3">
                {draft.description || 'No description set.'}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <span
                  className={`text-xs font-medium uppercase tracking-wider ${
                    difficultyColors[draft.difficulty] || 'text-zinc-400'
                  }`}
                >
                  {draft.difficulty}
                </span>
                <span className="text-xs text-zinc-600">|</span>
                <span className="text-xs text-zinc-500">
                  {draft.symptoms.length} symptom{draft.symptoms.length === 1 ? '' : 's'}
                </span>
                <span className="text-xs text-zinc-600">|</span>
                <span className="text-xs text-zinc-500">
                  {draft.evidence.length} evidence
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-1">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
                  Briefing
                </p>
                <p className="text-[11px] text-zinc-400 whitespace-pre-wrap line-clamp-6 font-mono">
                  {draft.briefing || '—'}
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-800/60">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono mb-1">
                  Tools
                </p>
                <div className="flex flex-wrap gap-1">
                  {draft.availableTools.length === 0 ? (
                    <span className="text-[11px] text-zinc-600">none</span>
                  ) : (
                    draft.availableTools.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                      >
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-800/60">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono mb-1">
                  Evidence reachable from {evidenceIds.length} item
                  {evidenceIds.length === 1 ? '' : 's'}
                </p>
                <p className="text-[11px] text-zinc-400 font-mono break-words">
                  {evidenceIds.join(', ') || '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5 mb-3">
            <FolderOpen size={13} /> Saved drafts
          </h3>
          {storedKeys.length === 0 ? (
            <p className="text-[11px] text-zinc-500">No drafts saved yet.</p>
          ) : (
            <ul className="space-y-1 max-h-72 overflow-y-auto">
              {storedKeys.map((id) => {
                const stored = storedDrafts[id];
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 border border-zinc-800/60 rounded-lg"
                  >
                    <button
                      onClick={() => loadDraft(id)}
                      className="flex-1 min-w-0 text-left"
                      title="Load draft"
                    >
                      <p className="text-xs text-zinc-100 truncate">{id}</p>
                      <p className="text-[10px] text-zinc-500 font-mono truncate">
                        {stored.draft.title || '—'} ·{' '}
                        {new Date(stored.savedAt).toLocaleString()}
                      </p>
                    </button>
                    <button
                      onClick={() => loadDraft(id)}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400"
                      title="Load"
                    >
                      <FileDown size={12} />
                    </button>
                    <button
                      onClick={() => deleteDraft(id)}
                      className="p-1 rounded hover:bg-zinc-800 text-red-400"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
