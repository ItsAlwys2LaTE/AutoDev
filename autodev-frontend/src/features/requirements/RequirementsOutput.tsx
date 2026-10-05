/**
 * AutoDev Requirements Output Island Component
 * 
 * Implements Milestone 1 R1 & R4:
 * - Container matching #outputSection
 * - Badge: "READ-ONLY DOCUMENT" (QUICK mode) vs "RICH TEXT DOCUMENT (CLICK TO EDIT)" (COMPLEX mode)
 * - Formatted rich text view matching formatRequirementsText
 * - COMPLEX mode inline editing with auto-pause countdown on focus/edit
 * - Re-parsing edited text via POST /api/parse-requirements (React Query mutation)
 * - Proceed button (#decomposeBtn) with auto-advance in QUICK mode or 30s countdown in COMPLEX mode
 * - Single-pass transition directly to Blueprint generation
 * - Strictly emoji-free UI per R4
 */

import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  DocumentTextIcon,
  LockClosedIcon,
  ArrowRightIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { persistState } from '../../stores';
import { parseRequirements } from '../../api/endpoints';
import { formatRequirementsText } from '../../utils/formatters';
import type { RequirementsDocument, SystemDesignBlueprint } from '../../types';

export interface RequirementsOutputProps {
  onProceedToDesign?: (blueprint: SystemDesignBlueprint) => void;
  className?: string;
}

export function RequirementsOutput({
  onProceedToDesign,
  className = '',
}: RequirementsOutputProps) {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const storeMode = useAppStore((s) => s.mode);
  const storeGenerationMode = useAppStore((s) => s.generationMode || s.mode);
  const storeRequirements = useAppStore((s) => s.requirements);
  const storeRawStreamText = useAppStore((s) => s.rawStreamText);
  const storeInFlightPhase = useAppStore((s) => s.inFlightPhase);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);
  const storeIsPaused = useAppStore((s) => s.isPaused);

  const mode = isSSR ? (liveStore?.mode ?? storeMode) : storeMode;
  const generationMode = isSSR ? (liveStore?.generationMode ?? storeGenerationMode) : storeGenerationMode;
  const requirements = isSSR ? (liveStore?.requirements ?? storeRequirements) : storeRequirements;
  const rawStreamText = isSSR ? (liveStore?.rawStreamText ?? '') : storeRawStreamText;
  const inFlightPhase = isSSR ? (liveStore?.inFlightPhase ?? storeInFlightPhase) : storeInFlightPhase;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? storePipelineStatus) : storePipelineStatus;
  const isPaused = isSSR ? (liveStore?.isPaused ?? storeIsPaused) : storeIsPaused;

  const setRequirements = useAppStore((s) => s.setRequirements);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);
  const setStepper = useAppStore((s) => s.setStepper);
  const setStepperStep = useAppStore((s) => s.setStepperStep);

  const countdown = useSessionStore((s) => s.countdown);
  const cancelCountdown = useSessionStore((s) => s.cancelCountdown);

  const [displayText, setDisplayText] = useState<string>(() => {
    if (requirements) return formatRequirementsText(requirements);
    if (rawStreamText) return rawStreamText;
    return '';
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isQuickMode = generationMode === 'QUICK' || mode === 'QUICK';
  const isEditable = isPaused || !isQuickMode;
  const contentRef = useRef<HTMLDivElement>(null);

  // React Query mutation for re-parsing edited requirements
  const parseMutation = useMutation({
    mutationFn: async (rawText: string) => {
      return await parseRequirements({ text: rawText });
    },
  });

  // Sync formatted requirements text or streaming text when requirements or stream updates
  useEffect(() => {
    if (requirements) {
      const formatted = formatRequirementsText(requirements);
      setDisplayText(formatted);
      if (contentRef.current) {
        contentRef.current.innerText = formatted;
      }
    } else if (rawStreamText) {
      setDisplayText(rawStreamText);
      if (contentRef.current) {
        contentRef.current.innerText = rawStreamText;
      }
    } else {
      setDisplayText('');
      if (contentRef.current) {
        contentRef.current.innerText = '';
      }
    }
  }, [requirements, rawStreamText]);

  // Master Architect decomposition is auto-triggered in autonomous pipeline.
  useEffect(() => {
    // No-op: autonomous pipeline manages transition via DecompositionOutput
  }, [requirements, pipelineStatus, inFlightPhase]);

  // Proceed / Decompose handler
  const handleProceed = async () => {
    cancelCountdown();
    setErrorMsg(null);
    setIsProcessing(true);
    setStepper(2, 'loading');
    setStepperStep(2);
    setInFlightPhase('decomposition');
    persistState(true);

    try {
      let activeReqs: RequirementsDocument | null = requirements;

      // In COMPLEX mode, re-parse edited text if user modified it
      if (!isQuickMode) {
        const textToParse = contentRef.current?.innerText || displayText;
        if (textToParse.trim()) {
          try {
            const parsedReqs = await parseMutation.mutateAsync(textToParse);
            if (parsedReqs && parsedReqs.project_title) {
              activeReqs = parsedReqs;
              setRequirements(parsedReqs);
              persistState(false);
            }
          } catch (parseErr: any) {
            console.warn('[RequirementsOutput] Could not parse rich text, using existing requirements:', parseErr);
          }
        }
      }

      if (!activeReqs) {
        throw new Error('Requirements document is missing. Please re-run SYS.REQ_COMPILER.');
      }

      // Hand off to Master Architect decomposition in DecompositionOutput
      if (
        typeof window !== 'undefined' &&
        typeof (window as any).runDecomposition === 'function' &&
        (window as any).runDecomposition !== handleProceed
      ) {
        await (window as any).runDecomposition();
      }

      if (onProceedToDesign) {
        onProceedToDesign(null as any);
      }
    } catch (err: any) {
      const isAborted =
        err?.name === 'AbortError' ||
        useAppStore.getState().pipelineStatus === 'aborted' ||
        useSessionStore.getState().isAborted;
      if (isAborted) {
        console.info('[RequirementsOutput] Transition to decomposition aborted.');
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Decomposition Initialization Failed: ${msg}`);
      setStepper(2, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Window bridge for unmigrated legacy index.html scripts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).proceedFromRequirements = handleProceed;
      if (!(window as any).runDecomposition) {
        (window as any).runDecomposition = handleProceed;
      }
    }
  }, [handleProceed]);

  // If no requirements and not running requirements phase, stay hidden
  if (!requirements && inFlightPhase !== 'requirements' && inFlightPhase !== 'decomposition') {
    return null;
  }

  const isCountdownActive =
    !isQuickMode &&
    countdown.isRunning &&
    countdown.targetAction === 'decomposition' &&
    countdown.remainingSeconds > 0;

  return (
    <div
      id="outputSection"
      className={`bg-slate-900/95 dark:bg-slate-900/95 rounded-2xl shadow-xl border border-slate-800 p-6 space-y-4 backdrop-blur-xl transition-all duration-300 ${className}`}
    >
      {/* Header & Mode Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <DocumentTextIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Phase 1: Requirements Analysis
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              SYS.REQ_COMPILER Artifact (Specification v1.3)
            </p>
          </div>
        </div>

        {/* Dynamic Interactive Badge */}
        <span
          id="jsonOutputBadge"
          className={`inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full border shadow-sm transition-colors ${
            isPaused
              ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
              : !isQuickMode
              ? 'bg-cyan-950/40 text-cyan-300 border-cyan-800/60'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {isPaused ? (
            <span>EDITABLE DOCUMENT (PAUSED)</span>
          ) : !isQuickMode ? (
            <span>RICH TEXT DOCUMENT (CLICK TO EDIT)</span>
          ) : (
            <>
              <LockClosedIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>READ-ONLY DOCUMENT</span>
            </>
          )}
        </span>
      </div>

      {/* Rich Text Requirements Viewer */}
      <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 shadow-inner max-h-[500px] overflow-y-auto custom-scrollbar">
        <div
          id="jsonOutput"
          ref={contentRef}
          contentEditable={isEditable}
          suppressContentEditableWarning
          onInput={() => {
            if (contentRef.current) {
              setDisplayText(contentRef.current.innerText);
            }
          }}
          className={`w-full min-h-[300px] text-sm sm:text-base leading-relaxed whitespace-pre-wrap outline-none select-text transition-colors font-mono text-slate-300 bg-transparent ${
            isEditable ? 'cursor-text focus:ring-1 focus:ring-cyan-500/50 rounded-lg p-1' : 'cursor-default'
          }`}
        >
          {displayText ||
            (inFlightPhase === 'requirements' && pipelineStatus === 'running'
              ? 'Streaming specification...'
              : 'Awaiting specification...')}
        </div>
      </div>

      {isPaused && requirements && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={async () => {
              const textToParse = contentRef.current?.innerText || displayText;
              if (textToParse.trim()) {
                setIsProcessing(true);
                try {
                  const parsed = await parseMutation.mutateAsync(textToParse);
                  if (parsed && parsed.project_title) {
                    setRequirements(parsed);
                    persistState(true);
                  }
                } catch (e: any) {
                  setErrorMsg(`Parse failed: ${e.message || String(e)}`);
                } finally {
                  setIsProcessing(false);
                }
              }
            }}
            className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-800 hover:bg-amber-900/50 rounded-lg transition-colors cursor-pointer"
          >
            Save & Re-parse Requirements
          </button>
        </div>
      )}

      {/* Error Display */}
      {errorMsg && (
        <div className="bg-red-950/50 border border-red-800/80 p-3.5 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <ExclamationCircleIcon className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Proceed / Decompose Button */}
      <button
        id="decomposeBtn"
        type="button"
        onClick={handleProceed}
        disabled={isProcessing || !requirements}
        className={`w-full font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 shadow-sm text-white ${
          isProcessing || !requirements
            ? 'bg-cyan-700/50 cursor-not-allowed text-slate-400'
            : 'bg-cyan-600 hover:bg-cyan-500 active:scale-[0.99] cursor-pointer'
        }`}
      >
        <span>
          {isProcessing
            ? 'Synthesizing Architecture Blueprint...'
            : isCountdownActive
            ? `Proceed to System Design (${countdown.remainingSeconds}s)`
            : 'Run Decomposition & Proceed to Design'}
        </span>
        {isProcessing ? (
          <svg
            id="decomposeSpinner"
            className="animate-spin h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <ArrowRightIcon className="w-4 h-4 text-white" />
        )}
      </button>
    </div>
  );
}

export default RequirementsOutput;
