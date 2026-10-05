/**
 * AutoDev Persistent Application State Store (Zustand v5)
 * 
 * Manages persistent pipeline state, lifecycle controls, and domain artifacts:
 * - Generation mode ('QUICK' vs 'COMPLEX')
 * - Feature request prompt & pipeline lifecycle status
 * - In-flight phase marker & crash recovery banner
 * - 5-Step pipeline stepper derivation & progression
 * - Phase 1: Requirements document
 * - Phase 1.5 & Multi-Component DAG: Decomposition, component tracks, results, queue, locks
 * - Phase 2: System design blueprint
 * - Phase 3: Generated codebase, file-level editor mutations, diff mode
 * - Phase 4: Docker sandbox execution results, test logs streaming
 * - Phase 5: Critic evaluations & Master Adjudicator decisions
 * - Self-Correction Revision History & historical tab swapping
 * - Multi-Component Integration codebase & integration revision history
 * - Post-Completion Control Plane (code modification & Q&A query)
 * - 100% compliant AutoDevStateV1 serialization (toSnapshot) & hydration (loadSnapshot)
 *
 * Authoritative Sources:
 * - backend/index.html (StateStore autodev_state_v1, lines 748-1390, 1970-2030, 2170-2700)
 * - autodev-frontend/src/types/index.ts (AutoDevStateV1, domain models)
 */

import { create } from 'zustand';
import { useSessionStore } from './sessionStore';
import { clearPersistedState } from './persistence';
import type {
  AppMode,
  PipelineStatus,
  InFlightPhase,
  PipelineStage,
  RequirementsDocument,
  ComponentDecomposition,
  ComponentSpec,
  ComponentResult,
  ComponentTrackState,
  SystemDesignBlueprint,
  GeneratedCodeBase,
  ExecutionResult,
  CriticFeedback,
  AdjudicatorDecision,
  RevisionHistoryItem,
  SinglePassState,
  SessionUsage,
  AutoDevStateV1,
  PauseSnapshot,
  ModificationDetectionResult,
  TimelineInterval,
  PipelineTimelineMetrics,
} from '../types';
import { COMPONENT_DAG_PHASES, SINGLE_PASS_PHASES } from '../types';
import { deepEqual } from '../utils/deepEqual';


// =============================================================================
// STEPPER & RESTORATION TYPES
// =============================================================================

export type StepperStatus = 'idle' | 'loading' | 'success' | 'error';

export interface StepperStateMap {
  1: StepperStatus;
  2: StepperStatus;
  3: StepperStatus;
  4: StepperStatus;
  5: StepperStatus;
  [key: number]: StepperStatus;
}

export interface RestorationBannerState {
  visible: boolean;
  message: string;
  phase: InFlightPhase;
}

export type PostCompletionMode = 'modify' | 'query';

// =============================================================================
// PURE DATA STATE INTERFACE (All 38 Pipeline State Variables + UI State)
// =============================================================================

export interface AppStoreState {
  // --- Pipeline Lifecycle & Mode ---
  mode: AppMode;
  currentMode: AppMode; // Compatibility mirror for AutoDevStateV1
  generationMode: AppMode; // Convenience alias for mode
  featureRequest: string;
  pipelineStatus: PipelineStatus;
  inFlightPhase: InFlightPhase;
  pipelineActive: boolean;

  // --- Stepper Navigation & Restoration ---
  stepperStep: number; // 1 to 5
  stepperStates: StepperStateMap;
  restorationBanner: RestorationBannerState;

  // --- Phase 1: Requirements Analysis ---
  requirements: RequirementsDocument | null;
  rawStreamText: string;

  // --- Phase 1.5: Component Decomposition (Master Architect) ---
  decomposition: ComponentDecomposition | null;

  // --- Multi-Component DAG Mode ---
  isComponentMode: boolean;
  activeComponentId: string | null;
  activeComponentStage: PipelineStage | string | null;
  componentStates: Record<string, ComponentTrackState | any>;
  componentResults: ComponentResult[];
  pipelineQueue: ComponentSpec[];
  pipelineLocks: { design: boolean; code: boolean; critic: boolean };

  // --- Single-Pass Pipeline Artifacts ---
  currentBlueprint: SystemDesignBlueprint | null;
  currentCodebase: GeneratedCodeBase | null;
  currentExecutionResult: ExecutionResult | null;
  executionLogs: string;
  currentRevisionPlan: string | null;
  currentRevisionCount: number;
  currentCompositeScore: number | null;
  currentDynamicBudget: number | null;
  singlePass: SinglePassState;
  singlePassCode: GeneratedCodeBase | null;

  // --- Revision History & Quality Evaluations ---
  revisionHistory: RevisionHistoryItem[];
  activeRevisionIndex: number;
  criticEvaluations: CriticFeedback[];
  adjudicatorDecisions: AdjudicatorDecision[];

  // --- Multi-Component Integration State ---
  integratedCodebase: GeneratedCodeBase | null;
  integrationRevisionCount: number;
  integrationRevisionPlan: string | null;
  integrationDynamicBudget: number | null;
  lastIntegrationComposite: number | null;
  integrationRevisionHistory: RevisionHistoryItem[];
  integrationActiveRevisionIndex: number;
  integrationCriticHistory: any[];
  integrationActiveCriticIndex: number;

  // --- IDE & Workspace Navigation ---
  activeFileIndex: number;
  isDiffMode: boolean;
  isPreviewOpen: boolean;
  isGitHubModalOpen: boolean;

  // --- Post-Completion Control Plane ---
  postCompletionMode: PostCompletionMode;
  postCompletionPrompt: string;
  postCompletionResponse: string;
  postCompletionStatus: string;
  postCompletionSandboxResult: ExecutionResult | null;
  /** Latched to true once pipeline completes. Never resets except via requestNewProduct. */
  postCompletionVisible: boolean;

  // --- Session Token Consumption Mirror ---
  sessionUsage: SessionUsage;

  // --- JSON Parse Retry State ---
  jsonRetryState: {
    isRetrying: boolean;
    currentAttempt: number;
    maxAttempts: number;
    phaseName: string;
    usingFallback: boolean;
  } | null;

  // --- Terminal Reset Counter ---
  terminalResetEpoch: number;

  // --- Pause & Modify System ---
  isPaused: boolean;
  pausedAtPhase: InFlightPhase | null;
  pausedAt: number | null;
  inspectingPhase: InFlightPhase | null;
  pauseSnapshot: PauseSnapshot | null;
  pauseRevisionIndex: number;
  resumeEpoch: number;
  pendingResumeAction: (() => void) | null;

  // --- Intent Classification & Follow-Up Questions ---
  intentClassification: import('../types/api').ClassifyIntentResponse | null;
  isClassifyingIntent: boolean;
  clarificationState: import('../types').ClarificationState | null;
  directAnswer: string | null;

  // --- Timeline Metrics Logging (Milestone 1 / R1) ---
  timelineMetrics: PipelineTimelineMetrics;
}


// =============================================================================
// ATOMIC ACTIONS INTERFACE
// =============================================================================

export interface AppStoreActions {
  // Mode & Configuration
  setMode: (mode: AppMode) => void;
  setGenerationMode: (mode: AppMode) => void;
  setFeatureRequest: (prompt: string) => void;
  setPipelineStatus: (status: PipelineStatus) => void;
  setInFlightPhase: (phase: InFlightPhase) => void;
  setPipelineActive: (active: boolean) => void;
  abortPipeline: (reason?: string) => void;
  updateCost: (promptTokens: number | string, completionTokens: number | string) => void;

  // Steppers & Restoration Banner
  setStepper: (step: number, status: StepperStatus) => void;
  setStepperStep: (step: number) => void;
  resetSteppers: () => void;
  showRestorationBanner: (phase: InFlightPhase, message?: string) => void;
  dismissRestorationBanner: () => void;

  // Requirements & Decomposition
  setRequirements: (req: RequirementsDocument | null) => void;
  setRawStreamText: (rawStreamText: string) => void;
  setDecomposition: (decomp: ComponentDecomposition | null) => void;

  // Multi-Component DAG
  setIsComponentMode: (isComponent: boolean) => void;
  setActiveComponent: (componentId: string | null, stage?: PipelineStage | string | null) => void;
  setComponentStates: (states: Record<string, ComponentTrackState | any>) => void;
  updateComponentState: (componentId: string, patch: Partial<ComponentTrackState | any>) => void;
  setComponentResults: (results: ComponentResult[]) => void;
  addComponentResult: (result: ComponentResult) => void;
  setPipelineQueue: (queue: ComponentSpec[]) => void;
  setPipelineLocks: (locks: Partial<{ design: boolean; code: boolean; critic: boolean }>) => void;

  // Single-Pass Pipeline
  setBlueprint: (blueprint: SystemDesignBlueprint | null) => void;
  setCurrentBlueprint: (blueprint: SystemDesignBlueprint | null) => void;
  setCodebase: (codebase: GeneratedCodeBase | null) => void;
  setCurrentCodebase: (codebase: GeneratedCodeBase | null) => void;
  updateCodeFile: (fileName: string, sourceCode: string) => void;
  updateFileContent: (fileName: string, sourceCode: string) => void;
  setExecutionResult: (result: ExecutionResult | null) => void;
  setExecutionLogs: (logs: string) => void;
  appendExecutionLogs: (chunk: string) => void;
  appendLogs: (chunk: string) => void;
  setRevisionPlan: (plan: string | null) => void;
  setRevisionCount: (count: number) => void;
  setCompositeScore: (score: number | null) => void;
  setDynamicBudget: (budget: number | null) => void;

  // Revision History & Quality
  addRevision: (item: RevisionHistoryItem) => void;
  snapshotRevision: (label?: string) => void;
  updateRevisionMeta: (index: number, feedbacks: CriticFeedback[], decision?: AdjudicatorDecision | null) => void;
  setActiveRevisionIndex: (index: number) => void;
  setCriticEvaluations: (feedbacks: CriticFeedback[]) => void;
  addCriticEvaluations: (feedbacks: CriticFeedback[]) => void;
  addAdjudicatorDecision: (decision: AdjudicatorDecision) => void;

  // Multi-Component Integration
  setIntegratedCodebase: (codebase: GeneratedCodeBase | null) => void;
  setIntegrationRevisionInfo: (
    count: number,
    plan: string | null,
    budget: number | null,
    composite: number | null
  ) => void;
  addIntegrationRevision: (item: RevisionHistoryItem) => void;
  setIntegrationActiveRevisionIndex: (index: number) => void;
  addIntegrationCriticEvaluation: (feedbacks: CriticFeedback[], decision?: AdjudicatorDecision) => void;
  setIntegrationActiveCriticIndex: (index: number) => void;

  // IDE & Workspace Navigation
  setActiveFileIndex: (index: number) => void;
  setIsDiffMode: (isDiff: boolean) => void;
  setIsPreviewOpen: (isOpen: boolean) => void;
  setGitHubModalOpen: (open: boolean) => void;

  // Post-Completion Control Plane
  setPostCompletionMode: (mode: PostCompletionMode) => void;
  setPostCompletionPrompt: (prompt: string) => void;
  setPostCompletionResponse: (response: string) => void;
  appendPostCompletionResponse: (chunk: string) => void;
  setPostCompletionStatus: (status: string) => void;
  setPostCompletionSandboxResult: (result: ExecutionResult | null) => void;
  setPostCompletionVisible: (visible: boolean) => void;

  // Token Usage Mirror
  setSessionUsage: (usage: SessionUsage) => void;

  // Lifecycle & Control Plane Actions
  startPipeline: () => void;
  abortDevelopment: () => void;
  retryDevelopment: () => void;
  requestNewProduct: () => void;
  resetTerminal: () => void;
  resetUI: () => void;
  resetAppStore: () => void;

  // Serialization & Recovery Bridge
  toSnapshot: () => AutoDevStateV1;
  loadSnapshot: (snapshot: Partial<AutoDevStateV1>) => void;

  // JSON Parse Retry State
  setJsonRetryState: (state: AppStoreState['jsonRetryState']) => void;

  // Pause & Modify Actions
  pauseDevelopment: () => void;
  resumeDevelopment: (metadata?: {
    targetStage?: string;
    modificationsDetected?: boolean;
    earliestTarget?: string;
    earliestPhase?: string;
    earliestComponentId?: string;
  }) => void;
  setPendingResumeAction: (action: (() => void) | null) => void;
  setInspectingPhase: (phase: InFlightPhase) => void;
  detectModifications: () => ModificationDetectionResult;
  resumeFromRevision: (revisionIndex: number) => void;
  invalidateDownstreamPhases: (
    fromPhase: InFlightPhase,
    isComponentMode?: boolean,
    restartFromRevision?: number | null,
    modifiedComponentId?: string | null,
    modifiedComponentTargetStage?: 'DESIGN' | 'CODEGEN' | 'CRITICS' | null,
    subsequentComponentIds?: string[] | null
  ) => Partial<AppStoreState>;

  // Intent Classification & Follow-Up Questions
  setIntentClassification: (result: import('../types/api').ClassifyIntentResponse | null) => void;
  setIsClassifyingIntent: (v: boolean) => void;
  setClarificationState: (state: import('../types').ClarificationState | null) => void;
  setDirectAnswer: (answer: string | null) => void;
  resetIntentState: () => void;
  clearIntentGate: () => void;

  // Timeline Metrics Logging & Gantt (Milestone 1 / R1)
  startTimelineInterval: (interval: Omit<TimelineInterval, 'endTime' | 'durationMs' | 'id' | 'startTime' | 'status'> & Partial<Pick<TimelineInterval, 'id' | 'startTime' | 'status'>>) => string;
  completeTimelineInterval: (id: string, patch?: Partial<TimelineInterval>) => void;
  recordTimelineInterval: (interval: TimelineInterval) => void;
  resetTimelineMetrics: () => void;
}

// =============================================================================
// COMBINED STORE TYPE
// =============================================================================

export type AppStore = AppStoreState & AppStoreActions;

// =============================================================================
// INITIAL STATE CONSTANTS
// =============================================================================

export const initialStepperStates: StepperStateMap = {
  1: 'idle',
  2: 'idle',
  3: 'idle',
  4: 'idle',
  5: 'idle',
};

export const initialAppStoreState: AppStoreState = {
  // Pipeline Lifecycle & Mode
  mode: 'QUICK',
  currentMode: 'QUICK',
  generationMode: 'QUICK',
  featureRequest: '',
  pipelineStatus: 'idle',
  inFlightPhase: null,
  pipelineActive: false,

  // Steppers & Restoration Banner
  stepperStep: 1,
  stepperStates: { ...initialStepperStates },
  restorationBanner: {
    visible: false,
    message: '',
    phase: null,
  },

  // Requirements & Decomposition
  requirements: null,
  rawStreamText: '',
  decomposition: null,

  // Multi-Component DAG
  isComponentMode: false,
  activeComponentId: null,
  activeComponentStage: null,
  componentStates: {},
  componentResults: [],
  pipelineQueue: [],
  pipelineLocks: { design: false, code: false, critic: false },

  // Single-Pass Pipeline
  currentBlueprint: null,
  currentCodebase: null,
  currentExecutionResult: null,
  executionLogs: '',
  currentRevisionPlan: null,
  currentRevisionCount: 0,
  currentCompositeScore: null,
  currentDynamicBudget: 3,
  singlePass: {
    blueprint: null,
    codebase: null,
    executionResult: null,
    revisionCount: 0,
    revisionPlan: null,
    compositeScore: null,
    dynamicBudget: 3,
  },
  singlePassCode: null,

  // Revision History & Quality
  revisionHistory: [],
  activeRevisionIndex: -1,
  criticEvaluations: [],
  adjudicatorDecisions: [],

  // Multi-Component Integration
  integratedCodebase: null,
  integrationRevisionCount: 0,
  integrationRevisionPlan: null,
  integrationDynamicBudget: 5,
  lastIntegrationComposite: null,
  integrationRevisionHistory: [],
  integrationActiveRevisionIndex: -1,
  integrationCriticHistory: [],
  integrationActiveCriticIndex: -1,

  // IDE & Workspace Navigation
  activeFileIndex: -1,
  isDiffMode: false,
  isPreviewOpen: false,
  isGitHubModalOpen: false,

  // Post-Completion Control Plane
  postCompletionMode: 'modify',
  postCompletionPrompt: '',
  postCompletionResponse: '',
  postCompletionStatus: '',
  postCompletionSandboxResult: null,
  postCompletionVisible: false,

  // Token Usage Mirror
  sessionUsage: { prompt: 0, completion: 0, cost: 0.0 },

  // JSON Parse Retry State
  jsonRetryState: null,

  // Terminal Reset Counter
  terminalResetEpoch: 0,

  // Pause & Modify System
  isPaused: false,
  pausedAtPhase: null,
  pausedAt: null,
  inspectingPhase: null,
  pauseSnapshot: null,
  pauseRevisionIndex: -1,
  resumeEpoch: 0,
  pendingResumeAction: null,

  // Intent Classification & Follow-Up Questions
  intentClassification: null,
  isClassifyingIntent: false,
  clarificationState: null,
  directAnswer: null,

  // Timeline Metrics Logging (Milestone 1 / R1)
  timelineMetrics: {
    pipelineStartTime: null,
    pipelineEndTime: null,
    totalDurationMs: 0,
    intervals: [],
  },
};

// =============================================================================
// RECOVERY HELPERS: STEPPER & BANNER DERIVATION
// =============================================================================

export function deriveStepperStatesFromSnapshot(snapshot: Partial<AutoDevStateV1>): StepperStateMap {
  const states: StepperStateMap = { ...initialStepperStates };
  if (snapshot.pipelineStatus === 'completed') {
    return { 1: 'success', 2: 'success', 3: 'success', 4: 'success', 5: 'success' };
  }
  if (snapshot.requirements) {
    states[1] = 'success';
  }
  if (snapshot.decomposition || snapshot.currentBlueprint || snapshot.singlePass?.blueprint) {
    states[2] = 'success';
  }
  if (
    snapshot.currentCodebase ||
    snapshot.integratedCodebase ||
    snapshot.singlePassCode ||
    snapshot.singlePass?.codebase
  ) {
    states[3] = 'success';
  }
  if (snapshot.currentExecutionResult || snapshot.singlePass?.executionResult || snapshot.executionLogs) {
    const success =
      snapshot.currentExecutionResult?.success ??
      snapshot.singlePass?.executionResult?.success ??
      true;
    states[4] = success ? 'success' : 'error';
  }
  if (
    (snapshot.adjudicatorDecisions && snapshot.adjudicatorDecisions.length > 0) ||
    snapshot.currentRevisionPlan ||
    snapshot.singlePass?.revisionPlan
  ) {
    states[5] = 'success';
  }
  return states;
}

export function deriveStepperStepFromSnapshot(snapshot: Partial<AutoDevStateV1>): number {
  if (snapshot.pipelineStatus === 'completed') return 5;
  if (
    (snapshot.adjudicatorDecisions && snapshot.adjudicatorDecisions.length > 0) ||
    snapshot.currentRevisionPlan ||
    snapshot.singlePass?.revisionPlan
  ) {
    return 5;
  }
  if (snapshot.currentExecutionResult || snapshot.executionLogs) return 4;
  if (snapshot.currentCodebase || snapshot.integratedCodebase || snapshot.singlePassCode) return 3;
  if (snapshot.decomposition || snapshot.currentBlueprint || snapshot.singlePass?.blueprint) return 2;
  if (snapshot.requirements) return 1;
  return 1;
}

export function formatPhaseLabel(phase: InFlightPhase): string {
  const phaseLabels: Record<string, string> = {
    requirements: 'Requirements Modeling',
    decomposition: 'Component Decomposition',
    single_design: 'Architectural Blueprint',
    single_codegen: 'Code Generation',
    single_execution: 'Sandbox Execution',
    single_critics: 'Arbitration & Critics',
    component_dag: 'Component Pipeline',
    integration: 'Integration Phase',
    documentation: 'Documentation Generation',
  };
  return (phase && phaseLabels[phase]) || phase || 'Pipeline';
}

// =============================================================================
// ZUSTAND v5 STORE CREATION (Curried syntax)
// =============================================================================

export const useAppStore = create<AppStore>()((set, get) => ({
  ...initialAppStoreState,

  // --- Mode & Configuration ---
  setMode: (mode: AppMode) => {
    if (get().pipelineActive) return; // Prevent mid-flight mode modification
    set({ mode, currentMode: mode, generationMode: mode });
  },

  setGenerationMode: (mode: AppMode) => get().setMode(mode),

  setFeatureRequest: (prompt: string) => set({ featureRequest: prompt }),

  setPipelineStatus: (status: PipelineStatus) =>
    set((state) => ({
      pipelineStatus: status,
      // Latch: once completed, the Post-Completion Control Plane is permanently visible.
      // This flag never goes back to false except via requestNewProduct() full reset.
      postCompletionVisible:
        status === 'completed' ? true : state.postCompletionVisible,
    })),

  setInFlightPhase: (phase: InFlightPhase) => set({ inFlightPhase: phase }),

  setPipelineActive: (active: boolean) => set({ pipelineActive: active }),

  abortPipeline: (reason = 'Pipeline aborted by user') => {
    try {
      useSessionStore.getState().abortCurrentPipeline(reason);
    } catch (err) {
      console.warn('[AppStore] Error aborting session store controller:', err);
    }
    get().abortDevelopment();
  },

  updateCost: (promptTokens: number | string, completionTokens: number | string) => {
    try {
      useSessionStore.getState().updateCost(promptTokens, completionTokens);
      set({ sessionUsage: useSessionStore.getState().sessionUsage });
    } catch (err) {
      console.warn('[AppStore] Error updating cost in session store:', err);
    }
  },

  // --- Stepper Navigation & Restoration ---
  setStepper: (step: number, status: StepperStatus) =>
    set((state) => ({
      stepperStep: Math.max(1, Math.min(5, step)),
      stepperStates: { ...state.stepperStates, [step]: status },
    })),

  setStepperStep: (step: number) => set({ stepperStep: Math.max(1, Math.min(5, step)) }),

  resetSteppers: () =>
    set({
      stepperStep: 1,
      stepperStates: { ...initialStepperStates },
    }),

  showRestorationBanner: (phase: InFlightPhase, message?: string) => {
    const label = formatPhaseLabel(phase);
    const bannerMessage = message || `Restored previous development session. Resuming ${label}...`;
    set({
      restorationBanner: {
        visible: true,
        message: bannerMessage,
        phase,
      },
    });
  },

  dismissRestorationBanner: () =>
    set({
      restorationBanner: {
        visible: false,
        message: '',
        phase: null,
      },
    }),

  // --- Requirements & Decomposition ---
  setRequirements: (requirements) =>
    set((state) => ({
      requirements,
      rawStreamText: requirements ? '' : state.rawStreamText,
      stepperStates: requirements
        ? { ...state.stepperStates, 1: 'success' }
        : state.stepperStates,
    })),

  setRawStreamText: (rawStreamText) => set({ rawStreamText }),

  setDecomposition: (decomposition) =>
    set((state) => {
      const isComplex = Boolean(decomposition?.is_complex);
      return {
        decomposition,
        isComponentMode: isComplex,
        stepperStates: decomposition
          ? { ...state.stepperStates, 2: 'success' }
          : state.stepperStates,
      };
    }),

  // --- Multi-Component DAG ---
  setIsComponentMode: (isComponentMode: boolean) => set({ isComponentMode }),

  setActiveComponent: (activeComponentId, activeComponentStage = null) =>
    set({ activeComponentId, activeComponentStage }),

  setComponentStates: (componentStates) => set({ componentStates }),

  updateComponentState: (componentId, patch) =>
    set((state) => ({
      componentStates: {
        ...state.componentStates,
        [componentId]: {
          ...(state.componentStates[componentId] || {}),
          ...patch,
        },
      },
    })),

  setComponentResults: (componentResults) => set({ componentResults }),

  addComponentResult: (result) =>
    set((state) => {
      const filtered = state.componentResults.filter(
        (r) => r.component_id !== result.component_id
      );
      return { componentResults: [...filtered, result] };
    }),

  setPipelineQueue: (pipelineQueue) => set({ pipelineQueue }),

  setPipelineLocks: (locks) =>
    set((state) => ({
      pipelineLocks: { ...state.pipelineLocks, ...locks },
    })),

  // --- Single-Pass Pipeline ---
  setBlueprint: (currentBlueprint) =>
    set((state) => ({
      currentBlueprint,
      singlePass: { ...state.singlePass, blueprint: currentBlueprint },
      stepperStates: currentBlueprint
        ? { ...state.stepperStates, 2: 'success' }
        : state.stepperStates,
    })),

  setCurrentBlueprint: (currentBlueprint) => get().setBlueprint(currentBlueprint),

  setCodebase: (currentCodebase) =>
    set((state) => {
      const activeFileIndex =
        currentCodebase?.files && currentCodebase.files.length > 0
          ? (state.activeFileIndex >= 0 && state.activeFileIndex < currentCodebase.files.length
              ? state.activeFileIndex
              : 0)
          : -1;
      return {
        currentCodebase,
        singlePassCode: currentCodebase,
        singlePass: { ...state.singlePass, codebase: currentCodebase },
        activeFileIndex,
        stepperStates: currentCodebase
          ? { ...state.stepperStates, 3: 'success' }
          : state.stepperStates,
      };
    }),

  setCurrentCodebase: (currentCodebase) => get().setCodebase(currentCodebase),

  updateCodeFile: (fileName: string, sourceCode: string) =>
    set((state) => {
      if (!state.currentCodebase || !state.currentCodebase.files) return state;
      let matched = false;
      const files = state.currentCodebase.files.map((file) => {
        const isMatch =
          file.file_name === fileName ||
          file.path === fileName ||
          (file as any).filePath === fileName ||
          (file as any).fileName === fileName;
        if (isMatch) {
          matched = true;
          return { ...file, source_code: sourceCode };
        }
        return file;
      });
      if (!matched) return state;

      const updatedCodebase: GeneratedCodeBase = { files };

      return {
        currentCodebase: updatedCodebase,
        singlePassCode: updatedCodebase,
        singlePass: { ...state.singlePass, codebase: updatedCodebase },
      };
    }),

  updateFileContent: (fileName: string, sourceCode: string) =>
    get().updateCodeFile(fileName, sourceCode),

  setExecutionResult: (currentExecutionResult) =>
    set((state) => ({
      currentExecutionResult,
      executionLogs: currentExecutionResult?.logs || state.executionLogs,
      singlePass: { ...state.singlePass, executionResult: currentExecutionResult },
      stepperStates: currentExecutionResult
        ? {
            ...state.stepperStates,
            4: currentExecutionResult.success ? 'success' : 'error',
          }
        : state.stepperStates,
    })),

  setExecutionLogs: (executionLogs: string) => set({ executionLogs }),

  appendExecutionLogs: (chunk: string) =>
    set((state) => ({ executionLogs: state.executionLogs + chunk })),

  appendLogs: (chunk: string) => get().appendExecutionLogs(chunk),

  setRevisionPlan: (currentRevisionPlan) =>
    set((state) => ({
      currentRevisionPlan,
      singlePass: { ...state.singlePass, revisionPlan: currentRevisionPlan },
    })),

  setRevisionCount: (currentRevisionCount) =>
    set((state) => ({
      currentRevisionCount,
      singlePass: { ...state.singlePass, revisionCount: currentRevisionCount },
    })),

  setCompositeScore: (currentCompositeScore) =>
    set((state) => ({
      currentCompositeScore,
      singlePass: { ...state.singlePass, compositeScore: currentCompositeScore },
    })),

  setDynamicBudget: (currentDynamicBudget) =>
    set((state) => ({
      currentDynamicBudget,
      singlePass: { ...state.singlePass, dynamicBudget: currentDynamicBudget },
    })),

  // --- Revision History & Quality ---
  addRevision: (item) =>
    set((state) => ({
      revisionHistory: [...state.revisionHistory, item],
      activeRevisionIndex: state.revisionHistory.length,
    })),

  snapshotRevision: (label) =>
    set((state) => {
      if (!state.currentCodebase) return state;
      const revNumber = state.revisionHistory.length;
      const defaultLabel = revNumber === 0 ? 'Rev 0 (Initial)' : `Rev ${revNumber}`;
      const snapshot: RevisionHistoryItem = {
        revisionNumber: revNumber,
        label: label || defaultLabel,
        timestamp: Date.now(),
        codebase: JSON.parse(JSON.stringify(state.currentCodebase)),
        blueprint: state.currentBlueprint ? JSON.parse(JSON.stringify(state.currentBlueprint)) : null,
        executionResult: state.currentExecutionResult
          ? JSON.parse(JSON.stringify(state.currentExecutionResult))
          : null,
        criticFeedbacks: state.criticEvaluations.length > 0 ? [...state.criticEvaluations] : undefined,
        decision:
          state.adjudicatorDecisions.length > 0
            ? state.adjudicatorDecisions[state.adjudicatorDecisions.length - 1]
            : null,
        compositeScore: state.currentCompositeScore,
      };
      return {
        revisionHistory: [...state.revisionHistory, snapshot],
        activeRevisionIndex: state.revisionHistory.length,
      };
    }),

  updateRevisionMeta: (index, feedbacks, decision = null) =>
    set((state) => {
      if (index < 0 || index >= state.revisionHistory.length) return state;
      const updated = state.revisionHistory.map((rev, i) => {
        if (i !== index) return rev;
        return {
          ...rev,
          criticFeedbacks: feedbacks,
          decision: decision || rev.decision,
          executionResult: state.currentExecutionResult || rev.executionResult,
        };
      });
      return { revisionHistory: updated };
    }),

  setActiveRevisionIndex: (index: number) =>
    set((state) => {
      if (index < 0 || index >= state.revisionHistory.length) {
        return { activeRevisionIndex: index };
      }
      const targetRev = state.revisionHistory[index];
      return {
        activeRevisionIndex: index,
        currentCodebase: targetRev.codebase,
        currentExecutionResult: targetRev.executionResult || null,
        executionLogs: targetRev.executionResult?.logs || state.executionLogs,
        activeFileIndex: targetRev.codebase.files.length > 0 ? 0 : -1,
      };
    }),

  setCriticEvaluations: (criticEvaluations) => set({ criticEvaluations }),

  addCriticEvaluations: (criticEvaluations) => set({ criticEvaluations }),

  addAdjudicatorDecision: (decision) =>
    set((state) => ({
      adjudicatorDecisions: [...state.adjudicatorDecisions, decision],
      currentRevisionPlan: decision.revision_plan,
      stepperStates: { ...state.stepperStates, 5: 'success' },
    })),

  // --- Multi-Component Integration ---
  setIntegratedCodebase: (integratedCodebase) =>
    set((state) => ({
      integratedCodebase,
      currentCodebase: integratedCodebase || state.currentCodebase,
      activeFileIndex:
        integratedCodebase?.files && integratedCodebase.files.length > 0 ? 0 : state.activeFileIndex,
      stepperStates: integratedCodebase
        ? { ...state.stepperStates, 5: 'success' }
        : state.stepperStates,
    })),

  setIntegrationRevisionInfo: (
    integrationRevisionCount,
    integrationRevisionPlan,
    integrationDynamicBudget,
    lastIntegrationComposite
  ) =>
    set({
      integrationRevisionCount,
      integrationRevisionPlan,
      integrationDynamicBudget,
      lastIntegrationComposite,
    }),

  addIntegrationRevision: (item) =>
    set((state) => ({
      integrationRevisionHistory: [...state.integrationRevisionHistory, item],
      integrationActiveRevisionIndex: state.integrationRevisionHistory.length,
    })),

  setIntegrationActiveRevisionIndex: (index: number) =>
    set({ integrationActiveRevisionIndex: index }),

  addIntegrationCriticEvaluation: (feedbacks, decision) =>
    set((state) => ({
      integrationCriticHistory: [...state.integrationCriticHistory, { feedbacks, decision }],
      integrationActiveCriticIndex: state.integrationCriticHistory.length,
    })),

  setIntegrationActiveCriticIndex: (index: number) =>
    set({ integrationActiveCriticIndex: index }),

  // --- IDE & Workspace Navigation ---
  setActiveFileIndex: (activeFileIndex: number) => set({ activeFileIndex }),

  setIsDiffMode: (isDiffMode: boolean) => set({ isDiffMode }),

  setIsPreviewOpen: (isPreviewOpen: boolean) => set({ isPreviewOpen }),

  setGitHubModalOpen: (isGitHubModalOpen: boolean) => set({ isGitHubModalOpen }),

  // --- Post-Completion Control Plane ---
  setPostCompletionMode: (postCompletionMode) => set({ postCompletionMode }),

  setPostCompletionPrompt: (postCompletionPrompt) => set({ postCompletionPrompt }),

  setPostCompletionResponse: (postCompletionResponse) => set({ postCompletionResponse }),

  appendPostCompletionResponse: (chunk) =>
    set((state) => ({ postCompletionResponse: state.postCompletionResponse + chunk })),

  setPostCompletionStatus: (postCompletionStatus) => set({ postCompletionStatus }),

  setPostCompletionSandboxResult: (postCompletionSandboxResult) =>
    set({ postCompletionSandboxResult }),

  setPostCompletionVisible: (postCompletionVisible) =>
    set((state) => ({
      // Latch only allows setting to true, never back to false mid-session.
      // Full reset happens via requestNewProduct() which restores initialAppStoreState.
      postCompletionVisible: postCompletionVisible ? true : state.postCompletionVisible,
    })),

  // --- Token Usage Mirror ---
  setSessionUsage: (sessionUsage) => set({ sessionUsage }),

  // --- JSON Parse Retry State ---
  setJsonRetryState: (jsonRetryState) => set({ jsonRetryState }),

  // --- Pause & Modify Actions ---
  pauseDevelopment: () => {
    const state = get();
    
    // 1. Cancel any in-flight abort controllers without marking destructive abort
    try {
      useSessionStore.getState().abortInFlightForPause('User paused development');
    } catch { /* ignore */ }
    
    // 2. Cancel any active countdowns
    try {
      useSessionStore.getState().cancelCountdown();
    } catch { /* ignore */ }
    
    // 3. Take snapshot of current state for change detection
    const safeClone = <T>(val: T): T => {
      if (val === null || val === undefined) return val;
      try {
        return JSON.parse(JSON.stringify(val));
      } catch {
        try {
          return structuredClone(val);
        } catch {
          return val;
        }
      }
    };

    const snapshot: PauseSnapshot = {
      requirements: safeClone(state.requirements),
      decomposition: safeClone(state.decomposition),
      blueprint: safeClone(state.currentBlueprint),
      codebase: safeClone(state.currentCodebase),
      executionResult: safeClone(state.currentExecutionResult),
      criticEvaluations: safeClone(state.criticEvaluations) || [],
      adjudicatorDecisions: safeClone(state.adjudicatorDecisions) || [],
      revisionCount: state.currentRevisionCount,
      componentStates: safeClone(state.componentStates) || {},
      integratedCodebase: safeClone(state.integratedCodebase),
      integrationRevisionCount: state.integrationRevisionCount,
    };
    
    let activePhase: string = state.inFlightPhase || 'requirements';
    let activeComp = state.activeComponentId;
    if (!activeComp && state.componentStates) {
      const activeEntry = Object.entries(state.componentStates).find(
        ([_, s]: [string, any]) =>
          ['designing', 'coding', 'executing', 'critiquing', 'waiting_design', 'waiting_code', 'waiting_critic'].includes(s?.status)
      );
      if (activeEntry) {
        activeComp = activeEntry[0];
        activePhase = 'component_dag';
      }
    }
    const compDisplay = activeComp || 'none';

    // 4. Update state
    set({
      isPaused: true,
      pausedAtPhase: state.inFlightPhase,
      pausedAt: Date.now(),
      inspectingPhase: state.inFlightPhase, // Start inspecting the currently active phase
      pauseSnapshot: snapshot,
      pauseRevisionIndex: state.currentRevisionCount,
      pipelineActive: false,
    });
    
    // 5. Live Console Terminal Logging
    const pauseMsg = `[PAUSE] Development paused. Active phase: ${activePhase}, active component: ${compDisplay}`;
    if (typeof window !== 'undefined') {
      try {
        (window as any).appendTerminalLog?.(pauseMsg, 'warn');
      } catch { /* ignore */ }
    }

    try {
      useSessionStore.getState().showInfoToast('Development paused.');
    } catch { /* ignore */ }

    // 6. Backend Lease Scheduler Pause Sync
    if (typeof fetch !== 'undefined') {
      try {
        fetch('/api/pipeline/pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            active_phase: activePhase,
            active_component_id: activeComp || undefined,
          }),
        }).catch(() => {});
      } catch { /* ignore */ }
    }
  },

  resumeDevelopment: (metadata?: {
    targetStage?: string;
    modificationsDetected?: boolean;
    earliestTarget?: string;
    earliestPhase?: string;
    earliestComponentId?: string;
  }) => {
    const state = get();
    const pendingAction = state.pendingResumeAction;
    const targetPhase = metadata?.targetStage || state.pausedAtPhase || state.inFlightPhase || 'component_dag';
    const modsStr = metadata?.modificationsDetected ? 'yes' : 'no';
    const earliestStr = metadata?.earliestTarget || 'none';

    set({
      isPaused: false,
      inFlightPhase: ((metadata?.earliestPhase as InFlightPhase) || state.pausedAtPhase || state.inFlightPhase || 'component_dag') as InFlightPhase,
      pausedAtPhase: null,
      pausedAt: null,
      inspectingPhase: null,
      pauseSnapshot: null,
      pauseRevisionIndex: -1,
      pipelineActive: true,
      pendingResumeAction: null,
      resumeEpoch: ((state as any).resumeEpoch || 0) + 1,
    });
    
    try {
      useSessionStore.getState().createAbortController();
    } catch { /* ignore */ }

    // Live Console Terminal Logging
    const resumeMsg = `[RESUME] Development resumed. Target phase/stage: ${targetPhase}, modifications detected: ${modsStr}, earliest rewind target: ${earliestStr}`;
    if (typeof window !== 'undefined') {
      try {
        (window as any).appendTerminalLog?.(resumeMsg, 'success');
      } catch { /* ignore */ }
    }

    // Backend Lease Scheduler Resume Sync
    if (typeof fetch !== 'undefined') {
      try {
        fetch('/api/pipeline/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_phase: targetPhase,
            target_stage: targetPhase,
            modifications_detected: Boolean(metadata?.modificationsDetected),
            earliest_phase: metadata?.earliestPhase,
            earliest_component_id: metadata?.earliestComponentId,
            earliest_target: metadata?.earliestTarget,
          }),
        }).catch(() => {});
      } catch { /* ignore */ }
    }

    if (typeof pendingAction === 'function') {
      try {
        pendingAction();
      } catch (err) {
        console.error('[AppStore] Error executing pendingResumeAction on resume:', err);
      }
    }
  },

  setPendingResumeAction: (pendingResumeAction) => set({ pendingResumeAction }),

  setInspectingPhase: (phase) => set({ inspectingPhase: phase }),

  detectModifications: () => {
    const state = get();
    const snap = state.pauseSnapshot;
    
    if (!snap) {
      return { 
        earliestModifiedPhase: null, 
        earliestModifiedComponentId: null,
        modifiedPhases: [], 
        modifiedComponents: [],
        restartFromRevision: null, 
        changeDescription: 'No snapshot available' 
      };
    }

    const hasCodebaseChanged = (cb1?: GeneratedCodeBase | null, cb2?: GeneratedCodeBase | null): boolean => {
      const f1 = cb1?.files || [];
      const f2 = cb2?.files || [];
      if (f1.length === 0 && f2.length === 0) return false;
      if (f1.length !== f2.length) return true;
      const nameOf = (f: any) => f?.file_name || f?.path || f?.fileName || f?.filePath;
      for (let i = 0; i < f1.length; i++) {
        const file1 = f1[i];
        const name1 = nameOf(file1);
        const file2 = f2.find((f) => nameOf(f) === name1);
        if (!file2) return true;
        if ((file1.source_code ?? '').trim() !== (file2.source_code ?? '').trim()) return true;
      }
      return false;
    };

    const hasRevisionHistoryChanged = (
      h1?: Array<{ codebase?: GeneratedCodeBase }> | null,
      h2?: Array<{ codebase?: GeneratedCodeBase }> | null
    ): boolean => {
      // Compare only revisions that existed at pause time; growth from in-flight work is not a user edit
      const a = h1 || [];
      const b = h2 || [];
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) {
        if (hasCodebaseChanged(a[i]?.codebase, b[i]?.codebase)) return true;
      }
      return false;
    };


    const hasBlueprintChanged = (
      bp1?: SystemDesignBlueprint | null,
      bp2?: SystemDesignBlueprint | null
    ): boolean => {
      if (!bp1 && !bp2) return false;
      if (!bp1 || !bp2) return true;
      if ((bp1.architecture_overview || '').trim() !== (bp2.architecture_overview || '').trim()) return true;
      if (JSON.stringify(bp1.tech_stack || []) !== JSON.stringify(bp2.tech_stack || [])) return true;
      if (JSON.stringify(bp1.files || []) !== JSON.stringify(bp2.files || [])) return true;
      return !deepEqual(bp1, bp2);
    };
    
    const modifiedPhases: InFlightPhase[] = [];
    const modifiedComponents: string[] = [];
    
    if (!deepEqual(snap.requirements, state.requirements)) {
      modifiedPhases.push('requirements');
    }
    if (!deepEqual(snap.decomposition, state.decomposition)) {
      modifiedPhases.push('decomposition');
    }
    
    if (state.isComponentMode) {
      // Determine chronological order of components:
      // 1. Completed components from componentResults
      // 2. Scheduled components from pipelineQueue
      // 3. Components in componentStates
      const completedIds = (state.componentResults || []).map((r: any) => r.component_id);
      const queueIds = (state.pipelineQueue || []).map((c: any) => c.component_id);
      const stateIds = Object.keys(state.componentStates || {});
      const chronologicalComponentIds = Array.from(new Set([...completedIds, ...queueIds, ...stateIds]));

      for (const cId of chronologicalComponentIds) {
        const snapTrack = snap.componentStates?.[cId];
        const currentTrack = state.componentStates?.[cId];
        const bpChanged = hasBlueprintChanged(snapTrack?.blueprint, currentTrack?.blueprint);
        const codeChanged =
          hasCodebaseChanged(snapTrack?.codebase, currentTrack?.codebase) ||
          hasRevisionHistoryChanged(snapTrack?.revisionHistory, currentTrack?.revisionHistory);
        if (bpChanged || codeChanged) {
          modifiedComponents.push(cId);
        }
      }

      if (modifiedComponents.length > 0) {
        modifiedPhases.push('component_dag');
      }

      if (hasCodebaseChanged(snap.integratedCodebase, state.integratedCodebase)) {
        modifiedPhases.push('integration');
      }
    } else {
      if (hasBlueprintChanged(snap.blueprint, state.currentBlueprint)) {
        modifiedPhases.push('single_design');
      }
      if (hasCodebaseChanged(snap.codebase, state.currentCodebase)) {
        modifiedPhases.push('single_codegen');
      }
    }
    
    const phaseOrder = state.isComponentMode ? COMPONENT_DAG_PHASES : SINGLE_PASS_PHASES;
    const earliest = phaseOrder.find(p => modifiedPhases.includes(p)) || null;

    let earliestModifiedComponentId: string | null = null;
    let modifiedComponentTargetStage: 'DESIGN' | 'CODEGEN' | 'CRITICS' | undefined = undefined;
    let subsequentComponentIds: string[] = [];
    if (state.isComponentMode && modifiedComponents.length > 0) {
      const completedIds = (state.componentResults || []).map((r: any) => r.component_id);
      const queueIds = (state.pipelineQueue || []).map((c: any) => c.component_id);
      const stateIds = Object.keys(state.componentStates || {});
      const chronologicalComponentIds = Array.from(new Set([...completedIds, ...queueIds, ...stateIds]));
      earliestModifiedComponentId = chronologicalComponentIds.find(id => modifiedComponents.includes(id)) || modifiedComponents[0];

      const modIdx = chronologicalComponentIds.indexOf(earliestModifiedComponentId);
      subsequentComponentIds = modIdx >= 0 ? chronologicalComponentIds.slice(modIdx + 1) : [];

      if (earliestModifiedComponentId) {
        const snapTrack = snap.componentStates?.[earliestModifiedComponentId];
        const currentTrack = state.componentStates?.[earliestModifiedComponentId];
        const bpChanged = hasBlueprintChanged(snapTrack?.blueprint, currentTrack?.blueprint);
        const codeChanged =
          hasCodebaseChanged(snapTrack?.codebase, currentTrack?.codebase) ||
          hasRevisionHistoryChanged(snapTrack?.revisionHistory, currentTrack?.revisionHistory);
        if (bpChanged) {
          modifiedComponentTargetStage = 'CODEGEN';
        } else if (codeChanged) {
          modifiedComponentTargetStage = 'CRITICS';
        } else {
          modifiedComponentTargetStage = 'DESIGN';
        }
      }
    }
    
    let restartFromRevision: number | null = null;
    if (modifiedPhases.length === 1 && modifiedPhases[0] === 'single_codegen' && state.currentRevisionCount > 0) {
      restartFromRevision = state.pauseRevisionIndex;
    }
    
    let changeDescription = 'No modifications detected';
    if (earliestModifiedComponentId) {
      changeDescription = `Modifications detected in component ${earliestModifiedComponentId} (${modifiedComponents.join(', ')})`;
    } else if (modifiedPhases.length > 0) {
      changeDescription = `Modifications detected in ${modifiedPhases.join(', ')}`;
    }

    return {
      earliestModifiedPhase: earliest,
      earliestModifiedComponentId,
      modifiedComponentTargetStage,
      subsequentComponentIds,
      modifiedPhases,
      modifiedComponents,
      restartFromRevision,
      changeDescription,
    };
  },

  resumeFromRevision: (revisionIndex: number) => {
    const state = get();
    const truncatedHistory = state.revisionHistory.slice(0, revisionIndex);
    const truncatedDecisions = state.adjudicatorDecisions.slice(0, revisionIndex);
    
    set({
      isPaused: false,
      pausedAtPhase: null,
      pausedAt: null,
      inspectingPhase: null,
      pauseSnapshot: null,
      pauseRevisionIndex: -1,
      pipelineActive: true,
      
      currentRevisionCount: revisionIndex,
      revisionHistory: truncatedHistory,
      activeRevisionIndex: truncatedHistory.length > 0 ? truncatedHistory.length - 1 : -1,
      
      currentExecutionResult: null,
      executionLogs: '',
      criticEvaluations: [],
      adjudicatorDecisions: truncatedDecisions,
      currentCompositeScore: revisionIndex > 0 ? truncatedDecisions[truncatedDecisions.length - 1]?.weighted_composite ?? null : null,
      currentRevisionPlan: null,
      
      inFlightPhase: 'single_execution',
      pipelineStatus: 'running',
      resumeEpoch: ((state as any).resumeEpoch || 0) + 1,
      stepperStates: {
        ...state.stepperStates,
        4: 'loading',
        5: 'idle',
      },
    });
    
    try {
      useSessionStore.getState().createAbortController();
    } catch { /* ignore */ }

    // Live Console Terminal Logging for revision resume
    const targetStage = 'single_execution';
    const earliestTarget = `revision ${revisionIndex}`;
    const resumeMsg = `[RESUME] Development resumed. Target phase/stage: ${targetStage}, modifications detected: yes, earliest rewind target: ${earliestTarget}`;
    if (typeof window !== 'undefined') {
      try {
        (window as any).appendTerminalLog?.(resumeMsg, 'success');
      } catch { /* ignore */ }
    }

    // Backend Lease Scheduler Resume Sync
    if (typeof fetch !== 'undefined') {
      try {
        fetch('/api/pipeline/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_phase: targetStage,
            target_stage: targetStage,
            modifications_detected: true,
            earliest_target: earliestTarget,
          }),
        }).catch(() => {});
      } catch { /* ignore */ }
    }
  },

  invalidateDownstreamPhases: (
    fromPhase,
    isComponentMode,
    restartFromRevision = null,
    modifiedComponentId = null,
    modifiedComponentTargetStage = null,
    subsequentComponentIds = null
  ) => {
    const patch: Partial<AppStoreState> = {};
    const useComponent = isComponentMode !== undefined ? isComponentMode : get().isComponentMode;
    const phases = useComponent ? COMPONENT_DAG_PHASES : SINGLE_PASS_PHASES;
    const idx = phases.indexOf(fromPhase);
    if (idx === -1) {
      return patch;
    }

    // Clear stale pre-pause phase so resumption starts from the rewound phase
    patch.pausedAtPhase = null;
    patch.inFlightPhase = fromPhase;

    // Downstream phases are strictly those AFTER fromPhase
    const downstream = phases.slice(idx + 1);

    if (downstream.includes('decomposition')) {
      patch.decomposition = null;
    }
    if (downstream.includes('single_design')) {
      patch.currentBlueprint = null;
      patch.singlePass = { ...get().singlePass, blueprint: null };
    }
    if (downstream.includes('single_codegen')) {
      if (restartFromRevision === null) {
        patch.currentCodebase = null;
        patch.singlePassCode = null;
        patch.currentRevisionCount = 0;
        patch.revisionHistory = [];
        patch.activeRevisionIndex = -1;
        patch.activeFileIndex = -1;
        patch.singlePass = { ...get().singlePass, codebase: null, revisionCount: 0, revisionPlan: null };
      }
    }
    if (downstream.includes('single_execution')) {
      if (restartFromRevision === null) {
        patch.currentExecutionResult = null;
        patch.executionLogs = '';
        patch.singlePass = { ...get().singlePass, executionResult: null };
      }
    }
    if (downstream.includes('single_critics')) {
      if (restartFromRevision === null) {
        patch.criticEvaluations = [];
        patch.adjudicatorDecisions = [];
        patch.currentCompositeScore = null;
        patch.currentRevisionPlan = null;
        patch.singlePass = { ...get().singlePass, compositeScore: null, dynamicBudget: 3 };
      }
    }

    // Component DAG granular invalidation
    if (fromPhase === 'component_dag' && modifiedComponentId) {
      const completedIds = (get().componentResults || []).map((r: any) => r.component_id);
      const queueIds = (get().pipelineQueue || []).map((c: any) => c.component_id);
      const stateIds = Object.keys(get().componentStates || {});
      const chronologicalComponentIds = Array.from(new Set([...completedIds, ...queueIds, ...stateIds]));

      const modIdx = chronologicalComponentIds.indexOf(modifiedComponentId);
      const computedSubsequentIds = modIdx >= 0 ? chronologicalComponentIds.slice(modIdx + 1) : [];
      const effectiveSubsequentIds = subsequentComponentIds || computedSubsequentIds;

      // Check DAG dependencies to invalidate any dependents as well
      const decompComponents = get().decomposition?.components || [];
      const isDependentOn = (cId: string, targetId: string): boolean => {
        const comp = decompComponents.find((c: any) => c.component_id === cId);
        if (!comp) return false;
        const deps: string[] = (comp as any).dependencies_on || (comp as any).dependencies || [];
        if (deps.includes(targetId)) return true;
        return deps.some((dep: string) => isDependentOn(dep, targetId));
      };

      const invalidatedSet = new Set<string>([modifiedComponentId, ...effectiveSubsequentIds]);
      for (const cId of chronologicalComponentIds) {
        if (!invalidatedSet.has(cId)) {
          for (const invId of Array.from(invalidatedSet)) {
            if (isDependentOn(cId, invId)) {
              invalidatedSet.add(cId);
              break;
            }
          }
        }
      }

      // Preserve all chronologically prior components untouched in componentResults
      patch.componentResults = (get().componentResults || []).filter(
        (r: any) => !invalidatedSet.has(r.component_id)
      );

      // Mutate componentStates:
      // Prior components remain completely untouched (status remains 'passed', results intact)
      const updatedStates = { ...get().componentStates };
      for (const invId of invalidatedSet) {
        if (invId === modifiedComponentId) {
          // Preserve modified blueprint/codebase, reset execution and critic state
          const existing = updatedStates[invId] || {};
          const targetStage: 'DESIGN' | 'CODEGEN' | 'CRITICS' =
            modifiedComponentTargetStage || 'DESIGN';
          const targetStatus =
            modifiedComponentTargetStage === 'CRITICS'
              ? 'critic_queued'
              : modifiedComponentTargetStage === 'CODEGEN'
              ? 'coding_queued'
              : 'queued';

          updatedStates[invId] = {
            ...existing,
            status: targetStatus,
            currentStage: targetStage,
            executionResult: null,
            criticEvaluations: [],
            criticHistory: [],
            epoch: ((existing.epoch || 0) + 1),
          };
        } else {
          // Reset subsequent/dependent components to queued
          const existing = updatedStates[invId] || {};
          updatedStates[invId] = {
            ...existing,
            status: 'queued',
            currentStage: null,
            blueprint: null,
            codebase: null,
            executionResult: null,
            criticEvaluations: [],
            criticHistory: [],
            revisionHistory: [],
            epoch: ((existing.epoch || 0) + 1),
          };
        }
      }
      patch.componentStates = updatedStates;
      patch.activeComponentId = modifiedComponentId;

      // Invalidate integration and downstream documentation
      patch.integratedCodebase = null;
      patch.integrationRevisionCount = 0;
      patch.integrationRevisionHistory = [];
      patch.integrationCriticHistory = [];
      patch.integrationActiveRevisionIndex = -1;
      patch.integrationActiveCriticIndex = -1;
      (patch as any).generatedDocs = null;
    } else if (downstream.includes('component_dag')) {
      patch.componentStates = {};
      patch.componentResults = [];
      patch.activeComponentId = null;
    }

    if (fromPhase === 'integration') {
      // Integration modified: preserve all component states and results;
      // clear only integrated codebase, integration revisions, and documentation.
      patch.integratedCodebase = null;
      patch.integrationRevisionCount = 0;
      patch.integrationRevisionHistory = [];
      patch.integrationCriticHistory = [];
      patch.integrationActiveRevisionIndex = -1;
      patch.integrationActiveCriticIndex = -1;
      (patch as any).generatedDocs = null;
    } else if (downstream.includes('integration')) {
      patch.integratedCodebase = null;
      patch.integrationRevisionCount = 0;
      patch.integrationRevisionHistory = [];
      patch.integrationCriticHistory = [];
      patch.integrationActiveRevisionIndex = -1;
      patch.integrationActiveCriticIndex = -1;
      (patch as any).generatedDocs = null;
    }

    // Stepper updates
    const currentSteppers = { ...get().stepperStates };
    if (fromPhase === 'requirements') {
      currentSteppers[1] = 'loading';
      currentSteppers[2] = 'idle';
      currentSteppers[3] = 'idle';
      currentSteppers[4] = 'idle';
      currentSteppers[5] = 'idle';
      patch.stepperStep = 1;
      patch.inFlightPhase = 'requirements';
    } else if (fromPhase === 'decomposition' || fromPhase === 'single_design') {
      currentSteppers[1] = 'success';
      currentSteppers[2] = 'loading';
      currentSteppers[3] = 'idle';
      currentSteppers[4] = 'idle';
      currentSteppers[5] = 'idle';
      patch.stepperStep = 2;
      patch.inFlightPhase = fromPhase;
    } else if (fromPhase === 'component_dag') {
      currentSteppers[1] = 'success';
      currentSteppers[2] = 'success';
      if (!modifiedComponentTargetStage || modifiedComponentTargetStage === 'DESIGN') {
        currentSteppers[3] = 'loading';
        currentSteppers[4] = 'idle';
        currentSteppers[5] = 'idle';
        patch.stepperStep = 3;
      } else {
        currentSteppers[3] = 'success';
        currentSteppers[4] = 'loading';
        currentSteppers[5] = 'idle';
        patch.stepperStep = 4;
      }
      patch.inFlightPhase = fromPhase;
    } else if (fromPhase === 'single_codegen') {
      currentSteppers[1] = 'success';
      currentSteppers[2] = 'success';
      currentSteppers[3] = 'loading';
      currentSteppers[4] = 'idle';
      currentSteppers[5] = 'idle';
      patch.stepperStep = 3;
      patch.inFlightPhase = fromPhase;
    } else if (fromPhase === 'single_execution') {
      currentSteppers[1] = 'success';
      currentSteppers[2] = 'success';
      currentSteppers[3] = 'success';
      currentSteppers[4] = 'loading';
      currentSteppers[5] = 'idle';
      patch.stepperStep = 4;
      patch.inFlightPhase = fromPhase;
    } else if (fromPhase === 'integration') {
      currentSteppers[1] = 'success';
      currentSteppers[2] = 'success';
      currentSteppers[3] = 'success';
      currentSteppers[4] = 'success';
      currentSteppers[5] = 'loading';
      patch.stepperStep = 5;
      patch.inFlightPhase = 'integration';
    }
    patch.stepperStates = currentSteppers;

    // Apply patch directly to the store
    set(patch);
    return patch;
  },

  // --- Lifecycle & Transformation Actions ---
  startPipeline: () =>
    set({
      pipelineStatus: 'running',
      pipelineActive: true,
      inFlightPhase: 'requirements',
      stepperStep: 1,
      stepperStates: { ...initialStepperStates, 1: 'loading' },
      restorationBanner: { visible: false, message: '', phase: null },
    }),

  abortDevelopment: () => {
    try {
      useSessionStore.getState().abortCurrentPipeline();
    } catch (err) {
      console.warn('[AppStore] Error aborting session store controller:', err);
    }
    set({
      pipelineStatus: 'aborted',
      pipelineActive: false,
    });
  },

  resetTerminal: () => {
    if (typeof window !== 'undefined') {
      try {
        (window as any).clearTerminal?.();
        window.dispatchEvent?.(new CustomEvent('autodev:terminal-reset'));
      } catch {
        // ignore
      }
    }
    set((state) => ({ terminalResetEpoch: (state.terminalResetEpoch || 0) + 1 }));
  },

  retryDevelopment: () => {
    // 1. Cancel active countdowns and in-flight requests
    try {
      useSessionStore.getState().cancelCountdown();
      useSessionStore.getState().abortCurrentPipeline('Restarting development');
    } catch {
      // ignore
    }

    // 2. Clear terminal and log restart explicitly
    if (typeof window !== 'undefined') {
      try {
        (window as any).clearTerminal?.();
        window.dispatchEvent?.(new CustomEvent('autodev:terminal-reset'));
      } catch {
        // ignore
      }
    }

    const restartMsg = '[RESTART] Development restarted. Restarting development from requirements phase.';
    if (typeof window !== 'undefined') {
      try {
        (window as any).appendTerminalLog?.(restartMsg, 'system');
      } catch {
        // ignore
      }
    }

    if (typeof fetch !== 'undefined') {
      try {
        fetch('/api/pipeline/restart', { method: 'POST' }).catch(() => {});
      } catch {
        // ignore
      }
    }
    try {
      clearPersistedState();
      useSessionStore.getState().resetSessionStore();
    } catch {
      // ignore
    }
    set((state) => ({
      ...initialAppStoreState,
      featureRequest: state.featureRequest,
      mode: state.mode,
      currentMode: state.mode,
      generationMode: state.mode,
      
      // Clear pause state explicitly
      isPaused: false,
      pausedAtPhase: null,
      pausedAt: null,
      inspectingPhase: null,
      pauseSnapshot: null,
      pauseRevisionIndex: -1,
      
      pipelineStatus: 'running',
      pipelineActive: true,
      inFlightPhase: 'requirements',
      stepperStep: 1,
      stepperStates: { ...initialStepperStates, 1: 'loading' },
      restorationBanner: { visible: false, message: '', phase: null },
      terminalResetEpoch: (state.terminalResetEpoch || 0) + 1,
      timelineMetrics: {
        pipelineStartTime: null,
        pipelineEndTime: null,
        totalDurationMs: 0,
        intervals: [],
      },
    }));

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent?.(new CustomEvent('autodev:restart-development'));
      } catch {
        // ignore
      }
    }
  },

  requestNewProduct: () => {
    if (typeof window !== 'undefined') {
      try {
        (window as any).clearTerminal?.();
        window.dispatchEvent?.(new CustomEvent('autodev:terminal-reset'));
      } catch {
        // ignore
      }
    }
    try {
      clearPersistedState();
      useSessionStore.getState().resetSessionStore();
    } catch {
      // ignore
    }
    set((state) => ({
      ...initialAppStoreState,
      terminalResetEpoch: (state.terminalResetEpoch || 0) + 1,
      timelineMetrics: {
        pipelineStartTime: null,
        pipelineEndTime: null,
        totalDurationMs: 0,
        intervals: [],
      },
    }));
  },

  resetUI: () =>
    set((state) => ({
      ...initialAppStoreState,
      featureRequest: state.featureRequest,
      mode: state.mode,
      currentMode: state.mode,
      generationMode: state.mode,
    })),

  resetAppStore: () => set(() => ({ ...initialAppStoreState })),

  // --- Intent Classification & Follow-Up Questions ---
  setIntentClassification: (result) => set({ intentClassification: result }),
  setIsClassifyingIntent: (v) => set({ isClassifyingIntent: v }),
  setClarificationState: (state) => set({ clarificationState: state }),
  setDirectAnswer: (answer) => set({ directAnswer: answer }),
  resetIntentState: () => set({
    intentClassification: null,
    isClassifyingIntent: false,
    clarificationState: null,
    directAnswer: null,
  }),
  clearIntentGate: () => set({
    intentClassification: null,
    isClassifyingIntent: false,
    clarificationState: null,
    directAnswer: null,
  }),

  // ===========================================================================
  // TIMELINE METRICS ACTIONS (MILESTONE 1 / R1)
  // ===========================================================================

  startTimelineInterval: (interval) => {
    const id = interval.id || `interval-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const startTime = interval.startTime !== undefined && interval.startTime > 0 ? interval.startTime : Date.now();
    const status = interval.status || 'in_progress';
    const newInterval: TimelineInterval = {
      ...interval,
      id,
      startTime,
      endTime: 0,
      durationMs: 0,
      status,
    };
    set((s) => {
      const pipelineStartTime = s.timelineMetrics.pipelineStartTime === null
        ? startTime
        : Math.min(s.timelineMetrics.pipelineStartTime, startTime);
      return {
        timelineMetrics: {
          ...s.timelineMetrics,
          pipelineStartTime,
          intervals: [...s.timelineMetrics.intervals, newInterval],
        },
      };
    });
    return id;
  },

  completeTimelineInterval: (id, patch) => {
    set((s) => {
      const targetInterval = s.timelineMetrics.intervals.find((item) => item.id === id);
      if (!targetInterval) {
        // Unknown interval ID: return state unmodified without mutating boundaries
        return s;
      }

      const now = Date.now();
      const targetEndTime = (patch && patch.endTime !== undefined) ? patch.endTime : now;

      const intervals = s.timelineMetrics.intervals.map((item) => {
        if (item.id !== id) return item;
        const endTime = targetEndTime;
        const durationMs = Math.max(0, endTime - item.startTime);
        const status = patch?.status || 'completed';
        return {
          ...item,
          ...patch,
          endTime,
          durationMs,
          status,
        };
      });

      const pipelineStartTime = s.timelineMetrics.pipelineStartTime === null
        ? targetInterval.startTime
        : Math.min(s.timelineMetrics.pipelineStartTime, targetInterval.startTime);

      const pipelineEndTime = s.timelineMetrics.pipelineEndTime === null
        ? targetEndTime
        : Math.max(s.timelineMetrics.pipelineEndTime, targetEndTime);

      const totalDurationMs = pipelineStartTime !== null && pipelineEndTime !== null
        ? Math.max(0, pipelineEndTime - pipelineStartTime)
        : 0;

      return {
        timelineMetrics: {
          pipelineStartTime,
          pipelineEndTime,
          totalDurationMs,
          intervals,
        },
      };
    });
  },

  recordTimelineInterval: (interval) => {
    set((s) => {
      const existingIdx = s.timelineMetrics.intervals.findIndex((i) => i.id === interval.id);
      let intervals: TimelineInterval[];
      if (existingIdx >= 0) {
        intervals = [...s.timelineMetrics.intervals];
        intervals[existingIdx] = interval;
      } else {
        intervals = [...s.timelineMetrics.intervals, interval];
      }

      const pipelineStartTime = s.timelineMetrics.pipelineStartTime === null
        ? interval.startTime
        : Math.min(s.timelineMetrics.pipelineStartTime, interval.startTime);
      const pipelineEndTime = s.timelineMetrics.pipelineEndTime === null
        ? interval.endTime
        : Math.max(s.timelineMetrics.pipelineEndTime, interval.endTime);
      const totalDurationMs = pipelineStartTime !== null && pipelineEndTime !== null
        ? Math.max(0, pipelineEndTime - pipelineStartTime)
        : interval.durationMs;

      return {
        timelineMetrics: {
          pipelineStartTime,
          pipelineEndTime,
          totalDurationMs,
          intervals,
        },
      };
    });
  },

  resetTimelineMetrics: () =>
    set({
      timelineMetrics: {
        pipelineStartTime: null,
        pipelineEndTime: null,
        totalDurationMs: 0,
        intervals: [],
      },
    }),

  // ===========================================================================
  // SERIALIZATION & RECOVERY BRIDGE
  // ===========================================================================

  toSnapshot: (): AutoDevStateV1 => {
    const s = get();
    return {
      version: 1,
      timestamp: Date.now(),
      pipelineStatus: s.pipelineStatus,
      inFlightPhase: s.inFlightPhase,
      currentMode: s.mode,
      featureRequest: s.featureRequest,
      isComponentMode: s.isComponentMode,
      activeComponentId: s.activeComponentId,
      activeComponentStage: s.activeComponentStage,
      requirements: s.requirements,
      decomposition: s.decomposition,
      componentStates: s.componentStates,
      componentResults: s.componentResults,
      singlePass: {
        blueprint: s.currentBlueprint,
        codebase: s.currentCodebase,
        executionResult: s.currentExecutionResult,
        revisionCount: s.currentRevisionCount,
        revisionPlan: s.currentRevisionPlan,
        compositeScore: s.currentCompositeScore,
        dynamicBudget: s.currentDynamicBudget,
      },
      singlePassCode: s.singlePassCode || s.currentCodebase,
      integratedCodebase: s.integratedCodebase,
      executionLogs: s.executionLogs,
      revisionHistory: s.revisionHistory,
      integrationRevisionHistory: s.integrationRevisionHistory,
      criticEvaluations: s.criticEvaluations,
      adjudicatorDecisions: s.adjudicatorDecisions,
      sessionUsage: s.sessionUsage,
      currentBlueprint: s.currentBlueprint,
      currentCodebase: s.currentCodebase,
      currentExecutionResult: s.currentExecutionResult,
      currentRevisionPlan: s.currentRevisionPlan,
      currentRevisionCount: s.currentRevisionCount,
      currentCompositeScore: s.currentCompositeScore,
      currentDynamicBudget: s.currentDynamicBudget,
      pipelineActive: s.pipelineActive,
      pipelineQueue: s.pipelineQueue,
      activeRevisionIndex: s.activeRevisionIndex,
      activeFileIndex: s.activeFileIndex,
      integrationRevisionCount: s.integrationRevisionCount,
      integrationRevisionPlan: s.integrationRevisionPlan,
      integrationDynamicBudget: s.integrationDynamicBudget,
      lastIntegrationComposite: s.lastIntegrationComposite,
      integrationActiveRevisionIndex: s.integrationActiveRevisionIndex,
      integrationCriticHistory: s.integrationCriticHistory,
      integrationActiveCriticIndex: s.integrationActiveCriticIndex,
      isPreviewOpen: s.isPreviewOpen,
      isPaused: s.isPaused,
      pausedAtPhase: s.pausedAtPhase,
      pausedAt: s.pausedAt,
      inspectingPhase: s.inspectingPhase,
      pauseRevisionIndex: s.pauseRevisionIndex,
      pauseSnapshot: s.pauseSnapshot,
      resumeEpoch: s.resumeEpoch || 0,
      timelineMetrics: s.timelineMetrics,
    };
  },

  loadSnapshot: (snapshot: Partial<AutoDevStateV1>) => {
    const mode = snapshot.currentMode || 'QUICK';
    const codebase =
      snapshot.integratedCodebase ||
      snapshot.singlePassCode ||
      snapshot.singlePass?.codebase ||
      snapshot.currentCodebase ||
      null;
    const blueprint =
      snapshot.currentBlueprint || snapshot.singlePass?.blueprint || null;
    const executionResult =
      snapshot.currentExecutionResult ||
      snapshot.singlePass?.executionResult ||
      (snapshot.executionLogs ? { logs: snapshot.executionLogs, success: true } : null);
    const isComponentMode = Boolean(
      snapshot.isComponentMode || (snapshot.decomposition && snapshot.decomposition.is_complex)
    );

    const derivedStates = deriveStepperStatesFromSnapshot(snapshot);
    const derivedStep = deriveStepperStepFromSnapshot(snapshot);

    let restorationBanner: RestorationBannerState = {
      visible: false,
      message: '',
      phase: null,
    };
    if (snapshot.pipelineStatus === 'running' && snapshot.inFlightPhase) {
      const label = formatPhaseLabel(snapshot.inFlightPhase);
      restorationBanner = {
        visible: true,
        message: `Restored previous development session. Resuming ${label}...`,
        phase: snapshot.inFlightPhase,
      };
    }

    set({
      mode,
      currentMode: mode,
      generationMode: mode,
      featureRequest: snapshot.featureRequest || '',
      pipelineStatus: snapshot.pipelineStatus || 'idle',
      inFlightPhase: snapshot.inFlightPhase || null,
      pipelineActive: snapshot.pipelineStatus === 'running',
      requirements: snapshot.requirements || null,
      rawStreamText: '',
      decomposition: snapshot.decomposition || null,
      isComponentMode,
      activeComponentId: snapshot.activeComponentId || null,
      activeComponentStage: snapshot.activeComponentStage || null,
      componentStates: snapshot.componentStates || {},
      componentResults: snapshot.componentResults || [],
      pipelineQueue: snapshot.pipelineQueue || [],
      currentBlueprint: blueprint,
      currentCodebase: codebase,
      currentExecutionResult: executionResult,
      executionLogs: (executionResult && executionResult.logs) || snapshot.executionLogs || '',
      currentRevisionPlan: snapshot.currentRevisionPlan || snapshot.singlePass?.revisionPlan || null,
      currentRevisionCount: snapshot.currentRevisionCount || snapshot.singlePass?.revisionCount || 0,
      currentCompositeScore:
        snapshot.currentCompositeScore || snapshot.singlePass?.compositeScore || null,
      currentDynamicBudget:
        snapshot.currentDynamicBudget || snapshot.singlePass?.dynamicBudget || null,
      singlePass: snapshot.singlePass || {
        blueprint,
        codebase,
        executionResult,
        revisionCount: snapshot.currentRevisionCount || 0,
        revisionPlan: snapshot.currentRevisionPlan || null,
        compositeScore: snapshot.currentCompositeScore || null,
        dynamicBudget: snapshot.currentDynamicBudget || null,
      },
      singlePassCode: snapshot.singlePassCode || codebase,
      integratedCodebase: snapshot.integratedCodebase || null,
      revisionHistory: snapshot.revisionHistory || [],
      activeRevisionIndex:
        snapshot.activeRevisionIndex !== undefined ? snapshot.activeRevisionIndex : -1,
      activeFileIndex:
        snapshot.activeFileIndex !== undefined
          ? snapshot.activeFileIndex
          : (codebase?.files && codebase.files.length > 0 ? 0 : -1),
      criticEvaluations: snapshot.criticEvaluations || [],
      adjudicatorDecisions: snapshot.adjudicatorDecisions || [],
      integrationRevisionCount: snapshot.integrationRevisionCount || 0,
      integrationRevisionPlan: snapshot.integrationRevisionPlan || null,
      integrationDynamicBudget: snapshot.integrationDynamicBudget || null,
      lastIntegrationComposite: snapshot.lastIntegrationComposite || null,
      integrationRevisionHistory: snapshot.integrationRevisionHistory || [],
      integrationActiveRevisionIndex:
        snapshot.integrationActiveRevisionIndex !== undefined
          ? snapshot.integrationActiveRevisionIndex
          : -1,
      integrationCriticHistory: snapshot.integrationCriticHistory || [],
      integrationActiveCriticIndex:
        snapshot.integrationActiveCriticIndex !== undefined
          ? snapshot.integrationActiveCriticIndex
          : -1,
      sessionUsage: snapshot.sessionUsage || { prompt: 0, completion: 0, cost: 0.0 },
      isPreviewOpen: Boolean(snapshot.isPreviewOpen),
      stepperStep: derivedStep,
      stepperStates: derivedStates,
      restorationBanner,
      
      isPaused: Boolean(snapshot.isPaused),
      pausedAtPhase: snapshot.pausedAtPhase || null,
      pausedAt: snapshot.pausedAt || null,
      inspectingPhase: snapshot.inspectingPhase || null,
      pauseSnapshot: snapshot.pauseSnapshot !== undefined ? snapshot.pauseSnapshot : null,
      pauseRevisionIndex: snapshot.pauseRevisionIndex !== undefined ? snapshot.pauseRevisionIndex : -1,
      resumeEpoch: snapshot.resumeEpoch || 0,
      
      // Restore latch: if pipeline was completed, the panel must remain visible after page reload.
      postCompletionVisible: snapshot.pipelineStatus === 'completed',

      // Restore timeline metrics if present in snapshot
      timelineMetrics: snapshot.timelineMetrics || {
        pipelineStartTime: null,
        pipelineEndTime: null,
        totalDurationMs: 0,
        intervals: [],
      },
    });
  },
}));
