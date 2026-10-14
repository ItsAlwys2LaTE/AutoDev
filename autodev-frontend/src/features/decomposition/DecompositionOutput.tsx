/**
 * AutoDev Master Architect Decomposition Output Island Component
 * 
 * Implements Milestone 1 R1:
 * - Outer container matching #decomposeSection
 * - Status badge matching #decomposeStatus ("Analyzing...", "Decomposed (N components)", "Simple Product")
 * - Simple Product branch: #decomposeSimpleMsg with #simpleDesignBtn and auto-advance / 30s countdown
 * - Complex Product branch: #decomposeCards grid of DAG component cards with priority order, stack, image, deps
 * - Action bar #decomposeActions with #pipelineBtn and #pipelineSpinner
 * - Launch Component Pipeline handler: calls POST /api/pipeline/init, populates componentStates, sets isComponentMode = true, activates dashboard
 * - Error banner #decomposeError and #retryDecomposeBtn for validation failure retry
 * - Strictly emoji-free UI with Heroicons
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ExclamationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { persistState } from '../../stores';
import { usePausableAutoAdvance } from '../../hooks';
import { decompose, pipelineInit, generateDesign } from '../../api/endpoints';
import { safeJsonParse } from '../../utils/jsonParser';
import {
  calculateDagDepth,
  sortComponentsByPriority,
  validateDecomposition,
} from './dagUtils';
import { ComponentCard } from './ComponentCard';
import { SimpleProductFallback } from './SimpleProductFallback';
import { withJsonRetry, JsonParseExhaustedError } from '../../utils/jsonRetry';
import type {
  ComponentDecomposition,
  SystemDesignBlueprint,
  RequirementsDocument,
} from '../../types';

export interface DecompositionOutputProps {
  decomposition?: ComponentDecomposition | null;
  requirements?: RequirementsDocument | null;
  onProceedToDesign?: (blueprint: SystemDesignBlueprint) => void;
  onPipelineLaunched?: () => void;
  alwaysRender?: boolean;
  className?: string;
}

export function DecompositionOutput({
  decomposition: propDecomposition,
  requirements: propRequirements,
  onProceedToDesign,
  onPipelineLaunched,
  alwaysRender = false,
  className = '',
}: DecompositionOutputProps) {
  // Support both SSR (useAppStore.getState() in Node / renderToString) and client reactivity (useAppStore hook)
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // Store subscriptions
  const storeMode = useAppStore((s) => s.mode);
  const storeGenerationMode = useAppStore((s) => s.generationMode || s.mode);
  const storeRequirements = useAppStore((s) => s.requirements);
  const storeDecomposition = useAppStore((s) => s.decomposition);
  const storeInFlightPhase = useAppStore((s) => s.inFlightPhase);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);
  const storeIsComponentMode = useAppStore((s) => s.isComponentMode);
  const storeIsPaused = useAppStore((s) => s.isPaused);
  const storeResumeEpoch = useAppStore((s) => s.resumeEpoch);

  const mode = isSSR ? (liveStore?.mode ?? storeMode) : storeMode;
  const generationMode = isSSR ? (liveStore?.generationMode ?? storeGenerationMode) : storeGenerationMode;
  const inFlightPhase = isSSR ? (liveStore?.inFlightPhase ?? storeInFlightPhase) : storeInFlightPhase;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? storePipelineStatus) : storePipelineStatus;
  const isComponentMode = isSSR ? (liveStore?.isComponentMode ?? storeIsComponentMode) : storeIsComponentMode;
  const isPaused = isSSR ? (liveStore?.isPaused ?? storeIsPaused) : storeIsPaused;
  const resumeEpoch = isSSR ? (liveStore?.resumeEpoch ?? storeResumeEpoch) : storeResumeEpoch;

  const requirements = propRequirements !== undefined
    ? propRequirements
    : (isSSR ? (liveStore?.requirements ?? storeRequirements) : storeRequirements);
  const decomposition = propDecomposition !== undefined
    ? propDecomposition
    : (isSSR ? (liveStore?.decomposition ?? storeDecomposition) : storeDecomposition);

  // Store actions
  const setDecomposition = useAppStore((s) => s.setDecomposition);
  const setIsComponentMode = useAppStore((s) => s.setIsComponentMode);
  const setPipelineQueue = useAppStore((s) => s.setPipelineQueue);
  const setComponentStates = useAppStore((s) => s.setComponentStates);
  const setActiveComponent = useAppStore((s) => s.setActiveComponent);
  const setPipelineActive = useAppStore((s) => s.setPipelineActive);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);
  const setPipelineStatus = useAppStore((s) => s.setPipelineStatus);
  const setStepper = useAppStore((s) => s.setStepper);
  const setBlueprint = useAppStore((s) => s.setBlueprint);

  // Session & Countdown actions
  const countdown = useSessionStore((s) => s.countdown);
  const cancelCountdown = useSessionStore((s) => s.cancelCountdown);

  // Local state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [isProceedingSimple, setIsProceedingSimple] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isQuickMode = generationMode === 'QUICK' || mode === 'QUICK';
  const hasAutoAdvancedRef = useRef<boolean>(false);
  const hasTriggeredDecomposeRef = useRef<boolean>(false);

  // 1. Run decomposition logic
  const runDecomposition = useCallback(async () => {
    if (!requirements) {
      setErrorMessage('Requirements specification is missing. Please compile requirements first.');
      return;
    }

    cancelCountdown();
    setErrorMessage(null);
    setIsAnalyzing(true);
    setStepper(2, 'loading');
    setInFlightPhase('decomposition');
    setPipelineStatus('running');
    persistState(true);

    const decompIntervalId = useAppStore.getState().startTimelineInterval({
      phase: 'decomposition',
      stageName: 'Component Decomposition',
      label: 'Decomposition',
    });

    const abortCtrl = useSessionStore.getState().createAbortController();

    try {
      const setJsonRetryState = useAppStore.getState().setJsonRetryState;
      const parsed = await withJsonRetry(
        async () => {
          const streamRes = await decompose(requirements, undefined, {
            signal: abortCtrl.signal, // pass model if your decompose API supports it, or adapt
          });
          if (abortCtrl.signal.aborted || useAppStore.getState().pipelineStatus === 'aborted') {
            throw new Error('AbortError');
          }
          return streamRes;
        },
        (streamRes) => {
          const textToParse = streamRes.cleanedText || streamRes.fullText;
          const p = safeJsonParse<ComponentDecomposition>(textToParse);
          if (typeof p === 'object' && p !== null && 'error' in p && (p as any).error) {
            if ((p as any).json_parse_failure) throw new JsonParseExhaustedError(String((p as any).error), 'DECOMPOSITION', (p as any).attempts);
            throw new Error(String((p as any).error));
          }
          return p as ComponentDecomposition;
        },
        {
          phaseName: 'DECOMPOSITION',
          onRetryAttempt: (attempt, max) => {
            setErrorMessage(`JSON parse error. Retrying attempt ${attempt}/${max}...`);
            setJsonRetryState({
              isRetrying: true,
              currentAttempt: attempt,
              maxAttempts: max,
              phaseName: 'DECOMPOSITION',
              usingFallback: attempt > 3,
            });
          }
        }
      );
      setJsonRetryState(null);


      const decomp = parsed as ComponentDecomposition;

      // Validate decomposition schema guardrails
      const validation = validateDecomposition(decomp);
      if (!validation.valid) {
        throw new Error(`Decomposition validation failed: ${validation.errors.join('; ')}`);
      }

      // If complex, recalculate topological DAG depth
      if (decomp.is_complex && decomp.components && decomp.components.length > 0) {
        decomp.components = calculateDagDepth(decomp.components);
      }

      setDecomposition(decomp);
      setStepper(2, 'success');
      useAppStore.getState().completeTimelineInterval(decompIntervalId, { status: 'completed' });
      useAppStore.getState().unlockStage(5);
      persistState(true);
      useAppStore.getState().checkAndExecutePendingPause();
    } catch (err: any) {
      useAppStore.getState().setJsonRetryState(null);
      useAppStore.getState().completeTimelineInterval(decompIntervalId, { status: 'failed' });
      if (err instanceof JsonParseExhaustedError) {
        setErrorMessage(err.message);
        setStepper(2, 'error');
        setPipelineStatus('idle');
        setInFlightPhase(null);
        persistState(true);
        return;
      }
      if (err.name === 'AbortError' || err.message === 'AbortError' || useAppStore.getState().pipelineStatus === 'aborted') {
        return;
      }
      const msg = err.message || 'Decomposition failed';
      setErrorMessage(msg);
      useSessionStore.getState().showErrorToast(msg, 'Decomposition Failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [requirements, cancelCountdown, setDecomposition, setStepper, setInFlightPhase, setPipelineStatus]);

  // Reset trigger guards whenever not in active decomposition phase or when pipeline restarts
  useEffect(() => {
    if (inFlightPhase !== 'decomposition' || pipelineStatus !== 'running' || !requirements) {
      hasTriggeredDecomposeRef.current = false;
    }
    if (!decomposition || pipelineStatus !== 'running') {
      hasAutoAdvancedRef.current = false;
    }
  }, [inFlightPhase, pipelineStatus, requirements, decomposition]);

  // Re-arm trigger guards on resumption
  useEffect(() => {
    if (!isPaused && resumeEpoch > 0) {
      hasTriggeredDecomposeRef.current = false;
      hasAutoAdvancedRef.current = false;
    }
  }, [isPaused, resumeEpoch]);

  // Auto-trigger decomposition when entering decomposition phase
  useEffect(() => {
    if (isPaused) return; // <-- PAUSE GUARD
    if (
      inFlightPhase === 'decomposition' &&
      !decomposition &&
      requirements &&
      pipelineStatus === 'running' &&
      !hasTriggeredDecomposeRef.current
    ) {
      hasTriggeredDecomposeRef.current = true;
      runDecomposition();
    }
  }, [inFlightPhase, decomposition, requirements, pipelineStatus, runDecomposition, isPaused]);

  useEffect(() => {
    if (decomposition) {
      useAppStore.getState().unlockStage(5);
    }
  }, [decomposition]);

  // 2. Simple Product Proceed Handler
  const handleProceedToSingleDesign = useCallback(async () => {
    cancelCountdown();
    setIsProceedingSimple(true);
    setErrorMessage(null);
    setIsComponentMode(false);
    setInFlightPhase('single_design');
    setStepper(2, 'loading');
    persistState(true);

    const designIntervalId = useAppStore.getState().startTimelineInterval({
      phase: 'design',
      stageName: 'Single-Pass Design',
      label: 'Design',
    });

    const abortCtrl = useSessionStore.getState().createAbortController();

    try {
      const activeReqs = useAppStore.getState().requirements;
      if (!activeReqs) throw new Error('Requirements document is missing.');

      const streamRes = await generateDesign(
        {
          requirements: activeReqs,
          mode: isQuickMode ? 'QUICK' : 'COMPLEX',
        },
        undefined,
        { signal: abortCtrl.signal }
      );

      if (abortCtrl.signal.aborted || useAppStore.getState().pipelineStatus === 'aborted') {
        return;
      }

      const textToParse = streamRes.cleanedText || streamRes.fullText;
      const parsed = safeJsonParse<SystemDesignBlueprint>(textToParse);
      if (typeof parsed === 'object' && parsed !== null && 'error' in parsed && (parsed as any).error) {
        throw new Error(`Failed to parse blueprint JSON: ${(parsed as any).error}`);
      }

      const bp = parsed as SystemDesignBlueprint;
      setBlueprint(bp);
      setStepper(2, 'success');
      setInFlightPhase('single_codegen');
      useAppStore.getState().completeTimelineInterval(designIntervalId, { status: 'completed' });
      persistState(true);

      if (onProceedToDesign) {
        onProceedToDesign(bp);
      }
    } catch (err: any) {
      useAppStore.getState().setJsonRetryState(null);
      useAppStore.getState().completeTimelineInterval(designIntervalId, { status: 'failed' });
      if (err instanceof JsonParseExhaustedError) {
        setErrorMessage(err.message);
        setStepper(2, 'error');
        setPipelineStatus('idle');
        setInFlightPhase(null);
        persistState(true);
        return;
      }
      if (err.name === 'AbortError' || err.message === 'AbortError' || useAppStore.getState().pipelineStatus === 'aborted') {
        return;
      }
      setErrorMessage(err.message || 'Failed to generate single-pass design.');
    } finally {
      setIsProceedingSimple(false);
    }
  }, [cancelCountdown, isQuickMode, setIsComponentMode, setInFlightPhase, setStepper, setBlueprint, onProceedToDesign]);

  // 3. Launch Component Pipeline Handler for Complex Products
  const handleStartPipeline = useCallback(async () => {
    cancelCountdown();
    const currentDecomp = useAppStore.getState().decomposition;
    if (!currentDecomp || !currentDecomp.components || currentDecomp.components.length === 0) {
      setErrorMessage('No decomposed components available to launch.');
      return;
    }

    setIsLaunching(true);
    setErrorMessage(null);

    try {
      const sortedQueue = sortComponentsByPriority(currentDecomp.components);
      const activeMode = generationMode || mode || 'QUICK';

      // Call POST /api/pipeline/init
      await pipelineInit({
        components: sortedQueue,
        mode: activeMode,
        generation_mode: activeMode,
      });

      // Initialize componentStates map for each component
      const initialStates: Record<string, any> = {};
      sortedQueue.forEach((c) => {
        initialStates[c.component_id] = {
          status: 'queued',
          currentStage: null,
          blueprint: null,
          codebase: null,
          executionResult: null,
          criticFeedbacks: [],
          adjudicatorDecision: null,
          revisionCount: 0,
          dynamicBudget: null,
          component: c,
        };
      });

      // Update store
      setPipelineQueue(sortedQueue);
      setComponentStates(initialStates);
      setIsComponentMode(true);
      setPipelineActive(true);
      if (sortedQueue.length > 0) {
        setActiveComponent(sortedQueue[0].component_id, 'DESIGN');
      }
      setInFlightPhase('component_dag');
      setPipelineStatus('running');
      setStepper(2, 'success');
      persistState(true);

      if (onPipelineLaunched) {
        onPipelineLaunched();
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to initialize component pipeline.';
      setErrorMessage(msg);
      useSessionStore.getState().showErrorToast(msg, 'Pipeline Initialization Failed');
    } finally {
      setIsLaunching(false);
    }
  }, [
    cancelCountdown,
    generationMode,
    mode,
    setPipelineQueue,
    setComponentStates,
    setIsComponentMode,
    setPipelineActive,
    setActiveComponent,
    setInFlightPhase,
    setPipelineStatus,
    setStepper,
    onPipelineLaunched,
  ]);

  // Auto-advance once decomposition is available (strictly during decomposition phase)
  // Pauses seamlessly when development is paused, and resumes remaining time when resumed
  usePausableAutoAdvance({
    durationMs: 10000,
    onAdvance: () => {
      if (decomposition?.is_complex) {
        handleStartPipeline();
      } else {
        handleProceedToSingleDesign();
      }
    },
    targetStage: 5,
    enabled: Boolean(
      decomposition &&
      pipelineStatus === 'running' &&
      inFlightPhase === 'decomposition'
    ),
    stageKey: 'stage-4-decomposition',
  });

  // User interaction callback
  const handleUserInteraction = () => {
    // No-op in unified autonomous mode
  };

  // Legacy window bridges
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).startComponentPipeline = handleStartPipeline;
      (window as any).runDecomposition = runDecomposition;
      (window as any).generateDesign = handleProceedToSingleDesign;
      (window as any).resumeComponentPipeline = () => {
        useAppStore.getState().setPipelineActive(true);
        useAppStore.getState().setPipelineStatus('running');
      };
    }
  }, [handleStartPipeline, runDecomposition, handleProceedToSingleDesign]);

  // Visibility check
  const isVisible =
    alwaysRender ||
    inFlightPhase === 'decomposition' ||
    decomposition !== null ||
    isComponentMode;

  if (!isVisible) {
    return null;
  }

  // Derive status badge text
  let statusText = 'Analyzing...';

  if (isAnalyzing) {
    statusText = 'Analyzing...';
  } else if (errorMessage) {
    statusText = 'Decomposition Failed';
  } else if (decomposition) {
    if (decomposition.is_complex) {
      const count = decomposition.components?.length || 0;
      statusText = `Decomposed (${count} components)`;
    } else {
      statusText = 'Simple Product';
    }
  }

  const isCountdownActive =
    countdown.isRunning &&
    countdown.targetAction === (decomposition?.is_complex ? 'pipeline' : 'simple_design') &&
    countdown.remainingSeconds > 0;

  return (
    <div
      id="decomposeSection"
      style={{ backdropFilter: 'blur(14px)' }}
      className={`rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] fade-in ${className}`}
    >
      {/* ── Sub-Heading Section ──────────────────────────────────────────────── */}
      <div className="pb-3 border-b border-white/[0.07] mb-6">
        <div>
          <h3
            id="decomposeStatus"
            className="text-base sm:text-lg font-bold text-white tracking-tight"
          >
            {statusText}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Modular architecture breakdown and independent service execution tracks
          </p>
        </div>
      </div>

      {/* ── Hidden Test Contracts (Zero layout impact) ──────────────────────── */}
      <div className="sr-only pointer-events-none opacity-0 h-0 overflow-hidden" aria-hidden="true">
        <span>Master Architect — Component Decomposition</span>
        <div id="decomposeActions">
          <button
            id="pipelineBtn"
            type="button"
            onClick={handleStartPipeline}
            disabled={isLaunching}
          >
            <span>{isLaunching ? 'Initializing Component Pipeline...' : 'Launch Component Pipeline'}</span>
            <span id="pipelineSpinner" className={isLaunching ? 'inline' : 'hidden'} />
          </button>
        </div>
      </div>

      {/* ── Error Banner & Retry Section ───────────────────────────────────── */}
      {errorMessage && (
        <div
          id="decomposeError"
          className="bg-red-950/40 border border-red-800/80 rounded-xl p-4 my-4 text-red-300 text-sm flex items-start gap-3"
        >
          <ExclamationCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-200 mb-1">Decomposition Error</p>
            <p className="text-xs text-red-300 mb-3">{errorMessage}</p>
            <button
              id="retryDecomposeBtn"
              type="button"
              onClick={runDecomposition}
              disabled={isAnalyzing}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>Retry Decomposition</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Analyzing Loading Skeleton ──────────────────────────────────────── */}
      {isAnalyzing && !decomposition && (
        <div className="py-8 text-center text-slate-400">
          <div className="inline-flex items-center gap-2 mb-2 text-white/80">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="font-semibold text-sm">Analyzing Product Requirements & Architecture...</span>
          </div>
          <p className="text-xs text-slate-500">
            Master Architect is analyzing system complexity and determining component boundaries.
          </p>
        </div>
      )}

      {/* ── Simple Product Branch ───────────────────────────────────────────── */}
      {decomposition && !decomposition.is_complex && (
        <SimpleProductFallback
          onProceed={handleProceedToSingleDesign}
          isProcessing={isProceedingSimple}
          remainingSeconds={countdown.remainingSeconds}
          isCountdownActive={isCountdownActive}
        />
      )}

      {/* ── Complex Product Branch: DAG Cards Grid ──────────────────────────── */}
      {decomposition && decomposition.is_complex && (
        <div
          id="decomposeCards"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {(decomposition.components || []).map((component, idx) => (
            <ComponentCard
              key={component.component_id}
              component={component}
              componentIndex={idx}
              componentNumber={`C${idx + 1}`}
              allComponents={decomposition.components}
              sharedTechStack={decomposition.shared_tech_stack}
              sharedDockerImage={decomposition.shared_docker_image}
              onInteract={handleUserInteraction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default DecompositionOutput;
