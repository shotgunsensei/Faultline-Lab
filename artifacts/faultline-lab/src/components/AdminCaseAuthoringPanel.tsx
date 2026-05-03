import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
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
  RefreshCw,
} from 'lucide-react';
import {
  adminDeleteCaseDraft,
  adminFetchCaseDrafts,
  adminSaveCaseDraft,
} from '@/lib/api';
import {
  composeCase,
  createTemplate,
  validateDraft,
  type CaseDraft,
  type AuthorEvidence,
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
import {
  FieldIssues,
  Labeled,
  Section,
  inputCls,
  topLevelIssues,
} from './admin/case-authoring/primitives';
import {
  CATEGORY_OPTIONS,
  DIFFICULTY_OPTIONS,
  DOMAIN_OPTIONS,
  TOOL_OPTIONS,
  blankDraft,
  editorLabel,
  recordsToMap,
  type StoredDraft,
} from './admin/case-authoring/draftStorage';
import { SymptomsSection } from './admin/case-authoring/sections/SymptomsSection';
import { EvidenceSection } from './admin/case-authoring/sections/EvidenceSection';
import { HintsSection } from './admin/case-authoring/sections/HintsSection';
import { CommandsSection } from './admin/case-authoring/sections/CommandsSection';
import { EventsSection } from './admin/case-authoring/sections/EventsSection';
import { TicketsSection } from './admin/case-authoring/sections/TicketsSection';

export default function AdminCaseAuthoringPanel() {
  const [draft, setDraft] = useState<CaseDraft>(() => blankDraft());
  const [domain, setDomain] = useState<DomainTemplate>('windows-ad');
  const [storedDrafts, setStoredDrafts] = useState<Record<string, StoredDraft>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);

  const refreshDrafts = useCallback(async (silent = false) => {
    if (!silent) setDraftsLoading(true);
    try {
      const { drafts } = await adminFetchCaseDrafts();
      setStoredDrafts(recordsToMap(drafts));
    } catch (err) {
      toast.error(
        err instanceof Error ? `Failed to load drafts: ${err.message}` : 'Failed to load drafts.'
      );
    } finally {
      if (!silent) setDraftsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDrafts();
  }, [refreshDrafts]);

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

  const saveDraft = async () => {
    if (!draft.id.trim()) {
      toast.error('Draft needs an id before it can be saved.');
      return;
    }
    setSavingDraft(true);
    try {
      await adminSaveCaseDraft(draft.id, draft);
      await refreshDrafts(true);
      toast.success(`Saved draft "${draft.id}" to the team workspace.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? `Save failed: ${err.message}` : 'Failed to save draft.'
      );
    } finally {
      setSavingDraft(false);
    }
  };

  const loadDraft = (id: string) => {
    const stored = storedDrafts[id];
    if (!stored) return;
    setDraft(stored.draft);
    toast.info(`Loaded draft "${id}".`);
  };

  const deleteDraft = async (id: string) => {
    try {
      await adminDeleteCaseDraft(id);
      await refreshDrafts(true);
      toast.info(`Deleted draft "${id}".`);
    } catch (err) {
      toast.error(
        err instanceof Error ? `Delete failed: ${err.message}` : 'Failed to delete draft.'
      );
    }
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

  const storedKeys = Object.keys(storedDrafts).sort(
    (a, b) => (storedDrafts[b]?.savedAt ?? 0) - (storedDrafts[a]?.savedAt ?? 0)
  );

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

        <SymptomsSection
          draft={draft}
          issues={issues}
          updateSymptom={updateSymptom}
          addSymptom={addSymptom}
          removeSymptom={removeSymptom}
        />

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

        <EvidenceSection
          draft={draft}
          issues={issues}
          updateEvidence={updateEvidence}
          addEvidence={addEvidence}
          removeEvidence={removeEvidence}
        />

        <HintsSection draft={draft} issues={issues} updateHint={updateHint} />

        <CommandsSection
          draft={draft}
          issues={issues}
          updateCommand={updateCommand}
          addCommand={addCommand}
          removeCommand={removeCommand}
        />

        <EventsSection
          draft={draft}
          issues={issues}
          updateEvent={updateEvent}
          addEvent={addEvent}
          removeEvent={removeEvent}
        />

        <TicketsSection
          draft={draft}
          issues={issues}
          updateTicket={updateTicket}
          addTicket={addTicket}
          removeTicket={removeTicket}
        />

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
              disabled={savingDraft}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <Save size={12} /> {savingDraft ? 'Saving...' : 'Save draft'}
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
              <FolderOpen size={13} /> Team drafts
            </h3>
            <button
              onClick={() => void refreshDrafts()}
              disabled={draftsLoading}
              className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200 disabled:opacity-50"
              title="Refresh drafts"
            >
              <RefreshCw size={11} className={draftsLoading ? 'animate-spin' : ''} />
              {draftsLoading ? 'Loading' : 'Refresh'}
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 mb-2">
            Drafts are shared across all admins.
          </p>
          {storedKeys.length === 0 ? (
            <p className="text-[11px] text-zinc-500">
              {draftsLoading ? 'Loading drafts…' : 'No drafts saved yet.'}
            </p>
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
                      <p className="text-[10px] text-zinc-600 font-mono truncate">
                        edited by {editorLabel(stored.editor)}
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
                      onClick={() => void deleteDraft(id)}
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
