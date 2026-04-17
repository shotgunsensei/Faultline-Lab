import type {
  CaseDefinition,
  EvidenceItem,
  ToolCommand,
} from '@/types';
import type { CaseCatalogEntry } from '@/data/caseCatalog';

export interface SandboxCommand {
  command: string;
  output: string;
}

export interface SandboxEvidence {
  title: string;
  description: string;
}

export interface SandboxScenario {
  id: string;
  title: string;
  briefing: string;
  rootCause: string;
  commands: SandboxCommand[];
  evidence: SandboxEvidence[];
  createdAt: number;
  updatedAt: number;
}

export const SANDBOX_STORAGE_KEY = 'faultline-lab-sandbox-scenarios';
const CHANGE_EVENT = 'faultline-lab:sandbox-scenarios-changed';

export function loadSandboxScenarios(): SandboxScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SANDBOX_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SandboxScenario[]) : [];
  } catch {
    return [];
  }
}

export function persistSandboxScenarios(list: SandboxScenario[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export function subscribeSandboxScenarios(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === SANDBOX_STORAGE_KEY) cb();
  };
  const onCustom = () => cb();
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onCustom);
  };
}

export function isSandboxScenarioId(id: string): boolean {
  return id.startsWith('sandbox-');
}

export function getSandboxScenarioById(id: string): SandboxScenario | undefined {
  return loadSandboxScenarios().find((s) => s.id === id);
}

/**
 * Convert a user-authored sandbox scenario into a runnable CaseDefinition.
 * The mapping is intentionally simple so authors get instant feedback:
 *   - Each authored evidence row becomes an EvidenceItem (medium-importance clue).
 *   - Each authored command becomes a terminal command. Evidence is revealed
 *     index-aligned to commands; any leftover evidence is attached to the last
 *     command so a thorough player can unlock everything.
 *   - With no commands, a synthetic `inspect` command unlocks all evidence so
 *     the case is still completable.
 *   - The author's free-text root cause is treated as the truth.
 */
export function buildCaseDefinitionFromSandbox(s: SandboxScenario): CaseDefinition {
  const evidence: EvidenceItem[] = s.evidence
    .filter((e) => (e.title || '').trim() || (e.description || '').trim())
    .map((e, i) => ({
      id: `ev-${i + 1}`,
      title: (e.title || '').trim() || `Evidence ${i + 1}`,
      description: (e.description || '').trim(),
      category: 'clue',
      importance: 'medium',
      unlocked: false,
    }));
  const evidenceIds = evidence.map((e) => e.id);

  const authoredCmds = s.commands.filter((c) => (c.command || '').trim());

  let terminalCommands: ToolCommand[];
  if (authoredCmds.length === 0) {
    terminalCommands = [
      {
        command: 'inspect',
        description: 'Inspect the system for clues',
        output: 'Inspection complete. Review the evidence locker.',
        revealsEvidence: evidenceIds,
      },
    ];
  } else {
    terminalCommands = authoredCmds.map((c, i) => {
      const isLast = i === authoredCmds.length - 1;
      const own = evidenceIds[i] ? [evidenceIds[i]] : [];
      const trailing = isLast ? evidenceIds.slice(authoredCmds.length) : [];
      return {
        command: c.command.trim(),
        description: `Authored command ${i + 1}`,
        output: c.output || '(no output)',
        revealsEvidence: [...own, ...trailing],
      };
    });
  }

  const rootCauseText = (s.rootCause || '').trim();

  return {
    id: s.id,
    title: (s.title || '').trim() || 'Untitled scenario',
    category: 'mixed',
    difficulty: 'beginner',
    description: s.briefing || 'Author-defined scenario from the Sandbox.',
    briefing: s.briefing || 'Author-defined scenario from the Sandbox.',
    symptoms: [],
    rootCause: {
      id: 'rc-author',
      title: rootCauseText || 'Author-defined root cause',
      description: rootCauseText || 'No root cause text provided.',
      technicalDetail: rootCauseText,
    },
    evidence,
    hints: [],
    terminalCommands,
    eventLogs: [],
    ticketHistory: [],
    availableTools: ['terminal'],
    redHerrings: [],
    remediation: 'Author-defined remediation.',
    preventativeMeasures: [],
    maxScore: 100,
  };
}

export function getSandboxAuthoredCaseDef(id: string): CaseDefinition | undefined {
  if (!isSandboxScenarioId(id)) return undefined;
  const scenario = getSandboxScenarioById(id);
  if (!scenario) return undefined;
  return buildCaseDefinitionFromSandbox(scenario);
}

/**
 * Build a CaseCatalogEntry-compatible row so the IncidentBoard can render
 * authored scenarios alongside catalog cases without bypassing its types.
 * These entries carry an `isAuthored: true` marker via the tags array so the
 * board can pick a different launch path.
 */
export function buildCatalogEntryFromSandbox(s: SandboxScenario): CaseCatalogEntry {
  const cmdCount = s.commands.filter((c) => (c.command || '').trim()).length;
  const evCount = s.evidence.filter(
    (e) => (e.title || '').trim() || (e.description || '').trim()
  ).length;
  return {
    id: s.id,
    slug: s.id,
    title: (s.title || '').trim() || 'Untitled scenario',
    shortSummary:
      (s.briefing || '').trim() ||
      'Author-defined sandbox scenario. Play to test your puzzle end-to-end.',
    mobileSummary: (s.title || '').trim() || 'Authored scenario',
    category: 'mixed',
    difficulty: 'beginner',
    estimatedMinutes: Math.max(2, Math.round((cmdCount + evCount) * 1.5)),
    sourceType: 'starter',
    status: 'playable',
    accessModel: 'free',
    sourceProductId: 'sandbox-authored',
    requiredEntitlements: [],
    requiredToolSlugs: ['terminal'],
    previewSymptoms: [],
    previewSystems: [],
    redHerringLevel: 'low',
    tags: ['sandbox-authored'],
    isStarter: false,
    isFeatured: false,
    isDailyEligible: false,
    isSandboxEligible: false,
    sortOrder: -s.updatedAt,
  };
}

export function getSandboxAuthoredEntries(): CaseCatalogEntry[] {
  return loadSandboxScenarios()
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(buildCatalogEntryFromSandbox);
}

export function isAuthoredEntry(entry: CaseCatalogEntry): boolean {
  return entry.tags.includes('sandbox-authored');
}
