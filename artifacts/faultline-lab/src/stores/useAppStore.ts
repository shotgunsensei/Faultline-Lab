import { create } from 'zustand';
import type {
  AppView,
  AppSettings,
  InvestigatorProfile,
  CaseState,
  CaseDefinition,
  DiagnosisSubmission,
  ToolOutput,
  Debrief,
  AuthUser,
} from '@/types';
import {
  loadProfile,
  saveProfile,
  loadCaseStates,
  saveCaseState,
  loadCurrentCaseId,
  saveCurrentCaseId,
  loadSettings,
  saveSettings,
} from '@/lib/persistence';
import {
  createCaseState,
  processCommand,
  processEventLogView,
  processTicketNoteView,
  useHint,
  evaluateDiagnosis,
  generateDebrief,
} from '@/lib/simulation';
import { resolveCaseDefinitionByEntryId } from '@/data/caseCatalog';

interface TerminalEntry {
  type: 'input' | 'output';
  content: string;
  timestamp: number;
  evidenceUnlocked?: string[];
}

interface AppState {
  view: AppView;
  profile: InvestigatorProfile;
  settings: AppSettings;
  currentCaseId: string | null;
  currentCaseDef: CaseDefinition | null;
  currentCaseState: CaseState | null;
  terminalHistory: TerminalEntry[];
  activeTool: string;
  showDiagnosisForm: boolean;
  authUser: AuthUser | null;
  isSignedIn: boolean;
  toolUsageSignals: Record<string, number>;
  pendingStoreProduct: { productId: string; reason: string } | null;

  trackToolUsage: (signal: string) => void;
  setView: (view: AppView) => void;
  openStoreWithProduct: (productId: string, reason: string) => void;
  consumePendingStoreProduct: () => { productId: string; reason: string } | null;
  setAuthUser: (user: AuthUser | null) => void;
  startCase: (caseId: string) => void;
  resumeCase: (caseId: string) => void;
  executeCommand: (command: string) => ToolOutput | null;
  viewEventLog: (logId: string) => void;
  viewTicketNote: (noteId: string) => void;
  requestHint: (level: number) => string | null;
  submitDiagnosis: (submission: DiagnosisSubmission) => Debrief | null;
  setActiveTool: (tool: string) => void;
  toggleDiagnosisForm: () => void;
  restartCase: (caseId: string) => void;
  exitCase: () => void;
  updateProfile: (updates: Partial<InvestigatorProfile>) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  initFromStorage: () => void;
  isCaseSolved: (caseId: string) => boolean;
  getCaseScore: (caseId: string) => number | undefined;
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'boot',
  profile: loadProfile(),
  settings: loadSettings(),
  currentCaseId: null,
  currentCaseDef: null,
  currentCaseState: null,
  terminalHistory: [],
  activeTool: 'terminal',
  showDiagnosisForm: false,
  authUser: null,
  isSignedIn: false,
  toolUsageSignals: {},
  pendingStoreProduct: null,

  openStoreWithProduct: (productId, reason) =>
    set({ pendingStoreProduct: { productId, reason }, view: 'store' }),

  consumePendingStoreProduct: () => {
    const pending = get().pendingStoreProduct;
    if (pending) set({ pendingStoreProduct: null });
    return pending;
  },

  trackToolUsage: (signal) =>
    set((state) => ({
      toolUsageSignals: {
        ...state.toolUsageSignals,
        [signal]: (state.toolUsageSignals[signal] || 0) + 1,
      },
    })),

  setView: (view) => set({ view }),

  setAuthUser: (user) => set({
    authUser: user,
    isSignedIn: !!user,
  }),

  startCase: (caseId) => {
    const caseDef = resolveCaseDefinitionByEntryId(caseId);
    if (!caseDef) return;

    const savedStates = loadCaseStates();
    const existingState = savedStates[caseId];

    if (existingState && existingState.status === 'active') {
      set({
        view: 'investigation',
        currentCaseId: caseId,
        currentCaseDef: caseDef,
        currentCaseState: existingState,
        terminalHistory: [],
        activeTool: 'terminal',
        showDiagnosisForm: false,
      });
      saveCurrentCaseId(caseId);
      return;
    }

    const newState = createCaseState(caseId);
    saveCaseState(caseId, newState);
    saveCurrentCaseId(caseId);

    set({
      view: 'investigation',
      currentCaseId: caseId,
      currentCaseDef: caseDef,
      currentCaseState: newState,
      terminalHistory: [],
      activeTool: 'terminal',
      showDiagnosisForm: false,
    });
  },

  resumeCase: (caseId) => {
    const caseDef = resolveCaseDefinitionByEntryId(caseId);
    if (!caseDef) return;

    const savedStates = loadCaseStates();
    const existingState = savedStates[caseId];
    if (!existingState) return;

    if (existingState.status === 'debriefed' && existingState.debrief) {
      set({
        view: 'debrief',
        currentCaseId: caseId,
        currentCaseDef: caseDef,
        currentCaseState: existingState,
      });
      return;
    }

    set({
      view: 'investigation',
      currentCaseId: caseId,
      currentCaseDef: caseDef,
      currentCaseState: existingState,
      terminalHistory: [],
      activeTool: 'terminal',
      showDiagnosisForm: false,
    });
    saveCurrentCaseId(caseId);
  },

  executeCommand: (command) => {
    const { currentCaseDef, currentCaseState } = get();
    if (!currentCaseDef || !currentCaseState) return null;

    if (command.toLowerCase().trim() === 'help') {
      const helpOutput = currentCaseDef.terminalCommands
        .map(tc => `  ${tc.command.padEnd(45)} ${tc.description}`)
        .join('\n');
      const output: ToolOutput = {
        command,
        output: `Available Commands\n${'='.repeat(60)}\n${helpOutput}\n\nType a command to execute it.`,
        timestamp: Date.now(),
      };
      set((state) => ({
        terminalHistory: [
          ...state.terminalHistory,
          { type: 'input', content: command, timestamp: Date.now() },
          { type: 'output', content: output.output, timestamp: Date.now() },
        ],
      }));
      return output;
    }

    if (command.toLowerCase().trim() === 'clear') {
      set({ terminalHistory: [] });
      return { command, output: '', timestamp: Date.now() };
    }

    const { output, newState } = processCommand(
      currentCaseDef,
      currentCaseState,
      command
    );

    saveCaseState(currentCaseDef.id, newState);

    set((state) => ({
      currentCaseState: newState,
      terminalHistory: [
        ...state.terminalHistory,
        { type: 'input', content: command, timestamp: Date.now() },
        {
          type: 'output',
          content: output.output,
          timestamp: Date.now(),
          evidenceUnlocked: output.evidenceUnlocked,
        },
      ],
    }));

    return output;
  },

  viewEventLog: (logId) => {
    const { currentCaseDef, currentCaseState } = get();
    if (!currentCaseDef || !currentCaseState) return;

    const newState = processEventLogView(
      currentCaseDef,
      currentCaseState,
      logId
    );
    saveCaseState(currentCaseDef.id, newState);
    set({ currentCaseState: newState });
  },

  viewTicketNote: (noteId) => {
    const { currentCaseDef, currentCaseState } = get();
    if (!currentCaseDef || !currentCaseState) return;

    const newState = processTicketNoteView(
      currentCaseDef,
      currentCaseState,
      noteId
    );
    saveCaseState(currentCaseDef.id, newState);
    set({ currentCaseState: newState });
  },

  requestHint: (level) => {
    const { currentCaseDef, currentCaseState } = get();
    if (!currentCaseDef || !currentCaseState) return null;

    const hint = currentCaseDef.hints.find(h => h.level === level);
    if (!hint) return null;

    const newState = useHint(currentCaseState, level);
    saveCaseState(currentCaseDef.id, newState);
    set({ currentCaseState: newState });

    return hint.text;
  },

  submitDiagnosis: (submission) => {
    const { currentCaseDef, currentCaseState, profile } = get();
    if (!currentCaseDef || !currentCaseState) return null;

    const scoreBreakdown = evaluateDiagnosis(
      currentCaseDef,
      currentCaseState,
      submission
    );
    const debrief = generateDebrief(currentCaseDef, currentCaseState, scoreBreakdown);

    const completedState: CaseState = {
      ...currentCaseState,
      status: 'debriefed',
      completedAt: Date.now(),
      diagnosis: submission,
      debrief,
    };

    saveCaseState(currentCaseDef.id, completedState);

    const isBetterScore =
      !profile.bestScores[currentCaseDef.id] ||
      scoreBreakdown.total > profile.bestScores[currentCaseDef.id];

    const newAchievements = debrief.achievementsUnlocked.filter(
      a => !profile.achievementsUnlocked.includes(a)
    );

    const wasPreviouslySolved = profile.solvedCaseIds.includes(currentCaseDef.id);

    const updatedProfile: InvestigatorProfile = {
      ...profile,
      casesSolved: wasPreviouslySolved
        ? profile.casesSolved
        : profile.casesSolved + 1,
      bestScores: isBetterScore
        ? { ...profile.bestScores, [currentCaseDef.id]: scoreBreakdown.total }
        : profile.bestScores,
      totalScore: isBetterScore
        ? Object.values({
            ...profile.bestScores,
            [currentCaseDef.id]: scoreBreakdown.total,
          }).reduce((a, b) => a + b, 0)
        : profile.totalScore,
      streakCurrent:
        scoreBreakdown.tier !== 'Misdiagnosed'
          ? profile.streakCurrent + 1
          : 0,
      streakBest: Math.max(
        profile.streakBest,
        scoreBreakdown.tier !== 'Misdiagnosed'
          ? profile.streakCurrent + 1
          : 0
      ),
      achievementsUnlocked: [
        ...profile.achievementsUnlocked,
        ...newAchievements,
      ],
      solvedCaseIds: wasPreviouslySolved
        ? profile.solvedCaseIds
        : [...profile.solvedCaseIds, currentCaseDef.id],
    };

    saveProfile(updatedProfile);

    set({
      currentCaseState: completedState,
      profile: updatedProfile,
      view: 'debrief',
      showDiagnosisForm: false,
    });

    return debrief;
  },

  setActiveTool: (tool) => set({ activeTool: tool }),

  toggleDiagnosisForm: () =>
    set((state) => ({ showDiagnosisForm: !state.showDiagnosisForm })),

  restartCase: (caseId) => {
    const caseDef = resolveCaseDefinitionByEntryId(caseId);
    if (!caseDef) return;

    const newState = createCaseState(caseId);
    saveCaseState(caseId, newState);
    saveCurrentCaseId(caseId);

    set({
      view: 'investigation',
      currentCaseId: caseId,
      currentCaseDef: caseDef,
      currentCaseState: newState,
      terminalHistory: [],
      activeTool: 'terminal',
      showDiagnosisForm: false,
    });
  },

  exitCase: () => {
    saveCurrentCaseId(null);
    set({
      view: 'incident-board',
      currentCaseId: null,
      currentCaseDef: null,
      currentCaseState: null,
      terminalHistory: [],
      showDiagnosisForm: false,
    });
  },

  updateProfile: (updates) => {
    const newProfile = { ...get().profile, ...updates };
    saveProfile(newProfile);
    set({ profile: newProfile });
  },

  updateSettings: (updates) => {
    const newSettings = { ...get().settings, ...updates };
    saveSettings(newSettings);
    set({ settings: newSettings });
  },

  initFromStorage: () => {
    const profile = loadProfile();
    const settings = loadSettings();
    const currentCaseId = loadCurrentCaseId();

    set({ profile, settings });

    if (currentCaseId) {
      const savedStates = loadCaseStates();
      const state = savedStates[currentCaseId];
      const caseDef = resolveCaseDefinitionByEntryId(currentCaseId);

      if (state && caseDef && state.status === 'active') {
        set({
          currentCaseId,
          currentCaseDef: caseDef,
          currentCaseState: state,
        });
      }
    }
  },

  isCaseSolved: (caseId) => {
    return get().profile.solvedCaseIds.includes(caseId);
  },

  getCaseScore: (caseId) => {
    return get().profile.bestScores[caseId];
  },
}));
