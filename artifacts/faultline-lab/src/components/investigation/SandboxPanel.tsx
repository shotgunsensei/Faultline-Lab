import { useEffect, useRef, useState } from 'react';
import {
  FlaskConical,
  Plus,
  Trash2,
  Save,
  Copy,
  Play,
  Download,
  Upload,
  Share2,
  X,
  Check,
} from 'lucide-react';
import type { CaseCategory, Difficulty } from '@/types';
import {
  loadSandboxScenarios,
  persistSandboxScenarios,
  SANDBOX_DEFAULT_CATEGORY,
  SANDBOX_DEFAULT_DIFFICULTY,
  SANDBOX_DEFAULT_IMPORTANCE,
  type SandboxCommand,
  type SandboxEvidence,
  type SandboxEvidenceImportance,
  type SandboxHint,
  type SandboxScenario,
} from '@/lib/sandboxScenarios';
import { useAppStore } from '@/stores/useAppStore';

export type { SandboxScenario } from '@/lib/sandboxScenarios';

const load = loadSandboxScenarios;
const persist = persistSandboxScenarios;

const CATEGORY_OPTIONS: { value: CaseCategory; label: string }[] = [
  { value: 'windows-ad', label: 'Windows / AD' },
  { value: 'networking', label: 'Networking' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'servers', label: 'Servers' },
  { value: 'mixed', label: 'Mixed' },
];

const DIFFICULTY_OPTIONS: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'expert'];

const IMPORTANCE_OPTIONS: SandboxEvidenceImportance[] = ['low', 'medium', 'high', 'critical'];

const DEFAULT_HINT_LABELS = ['Nudge', 'Hint', 'Strong hint', 'Spoiler'];
const DEFAULT_HINT_PENALTIES = [3, 6, 10, 20];

function blank(): SandboxScenario {
  const now = Date.now();
  return {
    id: `sandbox-${now}`,
    title: 'Untitled scenario',
    briefing: '',
    rootCause: '',
    category: SANDBOX_DEFAULT_CATEGORY,
    difficulty: SANDBOX_DEFAULT_DIFFICULTY,
    commands: [{ command: '', output: '' }],
    evidence: [
      { title: '', description: '', importance: SANDBOX_DEFAULT_IMPORTANCE, isRedHerring: false },
    ],
    hints: [],
    createdAt: now,
    updatedAt: now,
  };
}

const EXPORT_FORMAT = 'faultline-lab.sandbox-scenario.v1';

interface ScenarioExport {
  format: typeof EXPORT_FORMAT;
  exportedAt: number;
  scenario: Omit<SandboxScenario, 'id' | 'createdAt' | 'updatedAt'>;
}

function toExport(s: SandboxScenario): ScenarioExport {
  return {
    format: EXPORT_FORMAT,
    exportedAt: Date.now(),
    scenario: {
      title: s.title,
      briefing: s.briefing,
      rootCause: s.rootCause,
      category: s.category,
      difficulty: s.difficulty,
      commands: s.commands,
      evidence: s.evidence,
      hints: s.hints,
    },
  };
}

function fromExport(raw: string): SandboxScenario {
  const parsed = JSON.parse(raw) as Partial<ScenarioExport> & Partial<SandboxScenario>;
  const payload =
    parsed && typeof parsed === 'object' && 'scenario' in parsed && parsed.scenario
      ? (parsed.scenario as SandboxScenario)
      : (parsed as SandboxScenario);

  if (!payload || typeof payload !== 'object') {
    throw new Error('File is not a valid scenario.');
  }
  if (typeof payload.title !== 'string' || typeof payload.briefing !== 'string' || typeof payload.rootCause !== 'string') {
    throw new Error('Scenario is missing title, briefing, or root cause.');
  }
  if (!Array.isArray(payload.commands) || !Array.isArray(payload.evidence)) {
    throw new Error('Scenario is missing commands or evidence arrays.');
  }
  const commands: SandboxCommand[] = payload.commands.map((c) => ({
    command: String((c as SandboxCommand)?.command ?? ''),
    output: String((c as SandboxCommand)?.output ?? ''),
  }));
  const evidence: SandboxEvidence[] = payload.evidence.map((e) => {
    const src = e as SandboxEvidence;
    const importance = src?.importance;
    return {
      title: String(src?.title ?? ''),
      description: String(src?.description ?? ''),
      importance: IMPORTANCE_OPTIONS.includes(importance as SandboxEvidenceImportance)
        ? (importance as SandboxEvidenceImportance)
        : undefined,
      isRedHerring: Boolean(src?.isRedHerring),
    };
  });
  const hints: SandboxHint[] | undefined = Array.isArray(payload.hints)
    ? (payload.hints as SandboxHint[]).map((h) => ({
        label: String(h?.label ?? ''),
        text: String(h?.text ?? ''),
        scorePenalty: Number.isFinite(Number(h?.scorePenalty)) ? Number(h.scorePenalty) : 0,
      }))
    : undefined;
  const now = Date.now();
  return {
    id: `sandbox-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: payload.title || 'Imported scenario',
    briefing: payload.briefing,
    rootCause: payload.rootCause,
    category: payload.category,
    difficulty: payload.difficulty,
    commands: commands.length ? commands : [{ command: '', output: '' }],
    evidence: evidence.length
      ? evidence
      : [{ title: '', description: '', importance: SANDBOX_DEFAULT_IMPORTANCE, isRedHerring: false }],
    hints,
    createdAt: now,
    updatedAt: now,
  };
}

function safeFilename(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48);
  return `${slug || 'scenario'}.faultline.json`;
}

type ShareMode = 'export' | 'import';

export default function SandboxPanel() {
  const [scenarios, setScenarios] = useState<SandboxScenario[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState<ShareMode | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startSandboxRun = useAppStore((s) => s.startSandboxRun);

  const playScenario = (s: SandboxScenario) => {
    // Persist the very latest edits before launching so the runner picks up
    // exactly what the author sees on screen.
    persist(scenarios);
    startSandboxRun(s.id);
  };

  useEffect(() => {
    const list = load();
    setScenarios(list);
    if (list.length > 0) setActiveId(list[0].id);
  }, []);

  const active = scenarios.find((s) => s.id === activeId) || null;

  const update = (next: SandboxScenario) => {
    const list = scenarios.map((s) => (s.id === next.id ? { ...next, updatedAt: Date.now() } : s));
    setScenarios(list);
    persist(list);
  };

  const create = () => {
    const s = blank();
    const list = [s, ...scenarios];
    setScenarios(list);
    setActiveId(s.id);
    persist(list);
  };

  const remove = (id: string) => {
    const list = scenarios.filter((s) => s.id !== id);
    setScenarios(list);
    persist(list);
    if (activeId === id) setActiveId(list[0]?.id || null);
  };

  const importScenario = (raw: string) => {
    try {
      const next = fromExport(raw);
      const list = [next, ...scenarios];
      setScenarios(list);
      persist(list);
      setActiveId(next.id);
      setShareMode(null);
      setImportText('');
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not parse scenario JSON.');
    }
  };

  const downloadScenario = (s: SandboxScenario) => {
    const json = JSON.stringify(toExport(s), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename(s.title);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyScenario = async (s: SandboxScenario) => {
    const json = JSON.stringify(toExport(s), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const onPickFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importScenario(String(reader.result || ''));
    reader.onerror = () => setImportError('Could not read file.');
    reader.readAsText(file);
  };

  const duplicate = (s: SandboxScenario) => {
    const copy: SandboxScenario = {
      ...JSON.parse(JSON.stringify(s)),
      id: `sandbox-${Date.now()}`,
      title: `${s.title} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const list = [copy, ...scenarios];
    setScenarios(list);
    setActiveId(copy.id);
    persist(list);
  };

  return (
    <div className="relative flex flex-col h-full bg-[#0c1017] rounded-lg border border-fuchsia-900/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#111822] border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="text-fuchsia-400" />
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Sandbox · scenario authoring
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setImportText('');
              setImportError(null);
              setShareMode('import');
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-200 border border-zinc-700/60 rounded hover:bg-zinc-800/50"
          >
            <Upload size={12} /> Import
          </button>
          <button
            onClick={create}
            className="flex items-center gap-1 px-2 py-1 text-xs text-fuchsia-200 border border-fuchsia-500/40 rounded hover:bg-fuchsia-500/10"
          >
            <Plus size={12} /> New
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <aside className="col-span-4 border-r border-zinc-800/60 overflow-y-auto">
          {scenarios.length === 0 && (
            <div className="p-4 text-xs text-zinc-500">
              No scenarios yet. Click <strong>New</strong> to author your first puzzle.
            </div>
          )}
          {scenarios.map((s) => (
            <div
              key={s.id}
              className={`flex items-stretch border-b border-zinc-900/50 ${
                activeId === s.id ? 'bg-fuchsia-500/10' : 'hover:bg-zinc-800/30'
              }`}
            >
              <button
                onClick={() => setActiveId(s.id)}
                className="flex-1 text-left px-3 py-2 min-w-0"
              >
                <div className="text-sm text-zinc-200 truncate">{s.title || 'Untitled'}</div>
                <div className="text-[10px] font-mono text-zinc-500">
                  {s.commands.length} cmd · {s.evidence.length} evidence
                  {s.hints && s.hints.length > 0 ? ` · ${s.hints.length} hint` : ''}
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playScenario(s);
                }}
                title="Play this scenario"
                aria-label={`Play ${s.title || 'scenario'}`}
                className="px-2 text-fuchsia-300 hover:text-fuchsia-200 hover:bg-fuchsia-500/10"
              >
                <Play size={14} />
              </button>
            </div>
          ))}
        </aside>

        <main className="col-span-8 overflow-y-auto p-3">
          {!active && (
            <div className="text-sm text-zinc-500 text-center mt-12">
              Select or create a scenario to start authoring.
            </div>
          )}
          {active && (
            <div className="space-y-3 text-sm">
              <Field label="Title">
                <input
                  className="w-full bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1.5 text-zinc-100 focus:outline-none focus:border-fuchsia-500/50"
                  value={active.title}
                  onChange={(e) => update({ ...active, title: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Category">
                  <select
                    className="w-full bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1.5 text-zinc-100 focus:outline-none focus:border-fuchsia-500/50"
                    value={active.category ?? SANDBOX_DEFAULT_CATEGORY}
                    onChange={(e) =>
                      update({ ...active, category: e.target.value as CaseCategory })
                    }
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Difficulty">
                  <select
                    className="w-full bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1.5 text-zinc-100 focus:outline-none focus:border-fuchsia-500/50"
                    value={active.difficulty ?? SANDBOX_DEFAULT_DIFFICULTY}
                    onChange={(e) =>
                      update({ ...active, difficulty: e.target.value as Difficulty })
                    }
                  >
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Briefing">
                <textarea
                  rows={3}
                  className="w-full bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1.5 text-zinc-100 focus:outline-none focus:border-fuchsia-500/50"
                  value={active.briefing}
                  onChange={(e) => update({ ...active, briefing: e.target.value })}
                />
              </Field>
              <Field label="Root cause (truth)">
                <input
                  className="w-full bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1.5 text-zinc-100 focus:outline-none focus:border-fuchsia-500/50"
                  value={active.rootCause}
                  onChange={(e) => update({ ...active, rootCause: e.target.value })}
                />
              </Field>

              <Section
                title="Terminal commands"
                onAdd={() =>
                  update({ ...active, commands: [...active.commands, { command: '', output: '' }] })
                }
              >
                {active.commands.map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                    <input
                      className="col-span-4 bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-100"
                      placeholder="command"
                      value={c.command}
                      onChange={(e) => {
                        const arr = [...active.commands];
                        arr[i] = { ...c, command: e.target.value };
                        update({ ...active, commands: arr });
                      }}
                    />
                    <input
                      className="col-span-7 bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-100"
                      placeholder="output"
                      value={c.output}
                      onChange={(e) => {
                        const arr = [...active.commands];
                        arr[i] = { ...c, output: e.target.value };
                        update({ ...active, commands: arr });
                      }}
                    />
                    <button
                      onClick={() => {
                        const arr = active.commands.filter((_, idx) => idx !== i);
                        update({ ...active, commands: arr.length ? arr : [{ command: '', output: '' }] });
                      }}
                      className="col-span-1 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </Section>

              <Section
                title="Evidence"
                onAdd={() =>
                  update({
                    ...active,
                    evidence: [
                      ...active.evidence,
                      {
                        title: '',
                        description: '',
                        importance: SANDBOX_DEFAULT_IMPORTANCE,
                        isRedHerring: false,
                      },
                    ],
                  })
                }
              >
                {active.evidence.map((e, i) => (
                  <div key={i} className="border border-zinc-900/60 rounded p-2 mb-2 space-y-2">
                    <div className="grid grid-cols-12 gap-2">
                      <input
                        className="col-span-4 bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                        placeholder="title"
                        value={e.title}
                        onChange={(ev) => {
                          const arr = [...active.evidence];
                          arr[i] = { ...e, title: ev.target.value };
                          update({ ...active, evidence: arr });
                        }}
                      />
                      <input
                        className="col-span-7 bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                        placeholder="description"
                        value={e.description}
                        onChange={(ev) => {
                          const arr = [...active.evidence];
                          arr[i] = { ...e, description: ev.target.value };
                          update({ ...active, evidence: arr });
                        }}
                      />
                      <button
                        onClick={() => {
                          const arr = active.evidence.filter((_, idx) => idx !== i);
                          update({
                            ...active,
                            evidence: arr.length
                              ? arr
                              : [
                                  {
                                    title: '',
                                    description: '',
                                    importance: SANDBOX_DEFAULT_IMPORTANCE,
                                    isRedHerring: false,
                                  },
                                ],
                          });
                        }}
                        className="col-span-1 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 pl-1">
                      <label className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                        Importance
                        <select
                          className="bg-[#0a0e14] border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 normal-case tracking-normal"
                          value={e.importance ?? SANDBOX_DEFAULT_IMPORTANCE}
                          onChange={(ev) => {
                            const arr = [...active.evidence];
                            arr[i] = {
                              ...e,
                              importance: ev.target.value as SandboxEvidenceImportance,
                            };
                            update({ ...active, evidence: arr });
                          }}
                        >
                          {IMPORTANCE_OPTIONS.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-amber-300/90">
                        <input
                          type="checkbox"
                          checked={Boolean(e.isRedHerring)}
                          onChange={(ev) => {
                            const arr = [...active.evidence];
                            arr[i] = { ...e, isRedHerring: ev.target.checked };
                            update({ ...active, evidence: arr });
                          }}
                        />
                        Red herring
                      </label>
                    </div>
                  </div>
                ))}
              </Section>

              <Section
                title="Hint tiers (up to 4)"
                onAdd={() => {
                  const current = active.hints ?? [];
                  if (current.length >= 4) return;
                  const i = current.length;
                  const next: SandboxHint = {
                    label: DEFAULT_HINT_LABELS[i],
                    text: '',
                    scorePenalty: DEFAULT_HINT_PENALTIES[i],
                  };
                  update({ ...active, hints: [...current, next] });
                }}
              >
                {(active.hints ?? []).length === 0 && (
                  <div className="text-[11px] text-zinc-500 italic">
                    No hints — add a tier to give players a graduated nudge ladder.
                  </div>
                )}
                {(active.hints ?? []).map((h, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                    <input
                      className="col-span-3 bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                      placeholder="label"
                      value={h.label}
                      onChange={(ev) => {
                        const arr = [...(active.hints ?? [])];
                        arr[i] = { ...h, label: ev.target.value };
                        update({ ...active, hints: arr });
                      }}
                    />
                    <input
                      className="col-span-6 bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                      placeholder="hint text"
                      value={h.text}
                      onChange={(ev) => {
                        const arr = [...(active.hints ?? [])];
                        arr[i] = { ...h, text: ev.target.value };
                        update({ ...active, hints: arr });
                      }}
                    />
                    <input
                      type="number"
                      min={0}
                      className="col-span-2 bg-[#0a0e14] border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                      placeholder="penalty"
                      value={h.scorePenalty}
                      onChange={(ev) => {
                        const arr = [...(active.hints ?? [])];
                        const n = Number(ev.target.value);
                        arr[i] = { ...h, scorePenalty: Number.isFinite(n) ? n : 0 };
                        update({ ...active, hints: arr });
                      }}
                    />
                    <button
                      onClick={() => {
                        const arr = (active.hints ?? []).filter((_, idx) => idx !== i);
                        update({ ...active, hints: arr });
                      }}
                      className="col-span-1 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </Section>

              <div className="flex gap-2 pt-2 border-t border-zinc-800/50">
                <button
                  onClick={() => playScenario(active)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-fuchsia-100 border border-fuchsia-500/50 bg-fuchsia-500/10 rounded hover:bg-fuchsia-500/20"
                >
                  <Play size={12} /> Play scenario
                </button>
                <button
                  onClick={() => duplicate(active)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-200 border border-zinc-800/60 rounded hover:border-zinc-700"
                >
                  <Copy size={12} /> Duplicate
                </button>
                <button
                  onClick={() => {
                    setCopied(false);
                    setShareMode('export');
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-fuchsia-200 border border-fuchsia-500/40 rounded hover:bg-fuchsia-500/10"
                >
                  <Share2 size={12} /> Share
                </button>
                <button
                  onClick={() => remove(active.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-300 border border-red-900/40 rounded hover:bg-red-500/10"
                >
                  <Trash2 size={12} /> Delete
                </button>
                <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-400">
                  <Save size={12} /> Auto-saved locally
                </span>
              </div>
            </div>
          )}
        </main>
      </div>

      {shareMode && (
        <div
          className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShareMode(null)}
        >
          <div
            className="w-full max-w-xl bg-[#0c1017] border border-fuchsia-900/40 rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-fuchsia-300">
                {shareMode === 'export' ? <Share2 size={13} /> : <Upload size={13} />}
                {shareMode === 'export' ? 'Share scenario' : 'Import scenario'}
              </div>
              <button
                onClick={() => setShareMode(null)}
                className="text-zinc-500 hover:text-zinc-200"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            {shareMode === 'export' && active && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-zinc-400">
                  Send this scenario to another player by downloading the file or copying the JSON
                  below. They can paste or upload it from their own Sandbox panel.
                </p>
                <textarea
                  readOnly
                  rows={10}
                  className="w-full bg-[#0a0e14] border border-zinc-800 rounded p-2 text-[11px] font-mono text-zinc-200 focus:outline-none"
                  value={JSON.stringify(toExport(active), null, 2)}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadScenario(active)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-fuchsia-200 border border-fuchsia-500/40 rounded hover:bg-fuchsia-500/10"
                  >
                    <Download size={12} /> Download JSON
                  </button>
                  <button
                    onClick={() => copyScenario(active)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-200 border border-zinc-800/60 rounded hover:border-zinc-700"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy to clipboard'}
                  </button>
                </div>
                <p className="text-[11px] text-amber-300/80 border-t border-zinc-800/50 pt-2">
                  Heads up: shared cases run with the same ephemeral semantics as authored ones.
                  They live only in the recipient's browser, won't sync across devices, and will
                  disappear if they clear local storage.
                </p>
              </div>
            )}

            {shareMode === 'import' && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-zinc-400">
                  Paste a scenario JSON below, or upload a <code>.json</code> file an author shared
                  with you.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    onPickFile(e.target.files?.[0] || null);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-200 border border-zinc-800/60 rounded hover:border-zinc-700"
                >
                  <Upload size={12} /> Choose file…
                </button>
                <textarea
                  rows={10}
                  placeholder="Paste scenario JSON here…"
                  className="w-full bg-[#0a0e14] border border-zinc-800 rounded p-2 text-[11px] font-mono text-zinc-200 focus:outline-none focus:border-fuchsia-500/50"
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    if (importError) setImportError(null);
                  }}
                />
                {importError && (
                  <div className="text-[11px] text-red-300 border border-red-900/40 rounded px-2 py-1.5 bg-red-500/5">
                    {importError}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    disabled={!importText.trim()}
                    onClick={() => importScenario(importText)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-fuchsia-200 border border-fuchsia-500/40 rounded hover:bg-fuchsia-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} /> Add to my sandbox
                  </button>
                </div>
                <p className="text-[11px] text-amber-300/80 border-t border-zinc-800/50 pt-2">
                  Heads up: imported cases run with the same ephemeral semantics as authored ones.
                  They live only in this browser, won't sync across devices, and will disappear if
                  you clear local storage.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Section({
  title,
  children,
  onAdd,
}: {
  title: string;
  children: React.ReactNode;
  onAdd: () => void;
}) {
  return (
    <div className="border border-zinc-800/50 rounded p-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">{title}</span>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-[11px] text-fuchsia-300 hover:text-fuchsia-200"
        >
          <Plus size={11} /> Add
        </button>
      </div>
      {children}
    </div>
  );
}
