/**
 * AutoDev System Design Blueprint Island Component
 * 
 * Implements Milestone 1 R1 & R5:
 * - Container matching #designOutputSection
 * - Badge: "READ-ONLY BLUEPRINT" (QUICK mode) vs "RICH TEXT BLUEPRINT (CLICK TO EDIT)" (COMPLEX mode)
 * - Formatted blueprint viewer matching formatBlueprintText
 * - COMPLEX mode inline editing with auto-pause countdown on focus/edit
 * - Re-parsing edited text via POST /api/parse-blueprint (React Query mutation)
 * - Proceed button (#codeBtn, #codeBtnText, #codeSpinner) with auto-advance in QUICK mode or 30s countdown in COMPLEX mode
 * - Strictly emoji-free UI per R4
 */

import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Square3Stack3DIcon,
  LockClosedIcon,
  CodeBracketIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { persistState } from '../../stores';
import { parseBlueprint } from '../../api/endpoints';
import { formatBlueprintText } from '../../utils/formatters';
import type { SystemDesignBlueprint } from '../../types';

export interface BlueprintOutputProps {
  onProceedToCode?: (blueprint: SystemDesignBlueprint) => void;
  className?: string;
}

export function BlueprintOutput({
  onProceedToCode,
  className = '',
}: BlueprintOutputProps) {
  const mode = useAppStore((s) => s.mode);
  const generationMode = useAppStore((s) => s.generationMode || s.mode);
  const currentBlueprint = useAppStore((s) => s.currentBlueprint);
  const inFlightPhase = useAppStore((s) => s.inFlightPhase);
  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const isPaused = useAppStore((s) => s.isPaused);
  const resumeEpoch = useAppStore((s) => s.resumeEpoch);

  const setBlueprint = useAppStore((s) => s.setBlueprint);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);
  const setStepper = useAppStore((s) => s.setStepper);

  const countdown = useSessionStore((s) => s.countdown);
  const cancelCountdown = useSessionStore((s) => s.cancelCountdown);

  const [displayText, setDisplayText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isQuickMode = generationMode === 'QUICK' || mode === 'QUICK';
  const isEditable = isPaused || !isQuickMode;
  const contentRef = useRef<HTMLDivElement>(null);
  const hasAutoAdvancedRef = useRef<boolean>(false);

  // React Query mutation for re-parsing edited blueprint
  const parseMutation = useMutation({
    mutationFn: async (rawText: string) => {
      return await parseBlueprint({ text: rawText });
    },
  });

  // Sync formatted blueprint text when currentBlueprint updates
  useEffect(() => {
    if (currentBlueprint) {
      const formatted = formatBlueprintText(currentBlueprint);
      setDisplayText(formatted);
      if (contentRef.current) {
        contentRef.current.innerText = formatted;
      }
    } else {
      setDisplayText('');
      if (contentRef.current) {
        contentRef.current.innerText = '';
      }
    }
  }, [currentBlueprint]);

  // Reset auto-advance guard when blueprint is missing or pipeline is not in codegen
  useEffect(() => {
    if (!currentBlueprint || inFlightPhase !== 'single_codegen' || pipelineStatus !== 'running') {
      hasAutoAdvancedRef.current = false;
    }
  }, [currentBlueprint, inFlightPhase, pipelineStatus]);

  // Re-arm auto-advance on resumption
  useEffect(() => {
    if (!isPaused && resumeEpoch > 0) {
      hasAutoAdvancedRef.current = false;
    }
  }, [isPaused, resumeEpoch]);

  // Auto-advance when blueprint is available
  useEffect(() => {
    if (isPaused || !currentBlueprint || pipelineStatus !== 'running' || inFlightPhase !== 'single_codegen') {
      return;
    }

    if (!hasAutoAdvancedRef.current) {
      hasAutoAdvancedRef.current = true;
      const timer = setTimeout(() => {
        handleProceedToCode();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentBlueprint, pipelineStatus, inFlightPhase, isPaused]);

  // Proceed / Generate Code handler
  const handleProceedToCode = async () => {
    cancelCountdown();
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      let activeBp: SystemDesignBlueprint | null = currentBlueprint;

      // In COMPLEX mode, re-parse edited text if user modified it
      if (!isQuickMode) {
        const textToParse = contentRef.current?.innerText || displayText;
        if (textToParse.trim()) {
          try {
            const parsedBp = await parseMutation.mutateAsync(textToParse);
            if (parsedBp && parsedBp.files) {
              activeBp = parsedBp;
              setBlueprint(parsedBp);
              persistState(false);
            }
          } catch (parseErr: any) {
            console.warn('[BlueprintOutput] Could not parse rich text, using existing blueprint:', parseErr);
          }
        }
      }

      if (!activeBp) {
        throw new Error('System design blueprint is missing. Please generate blueprint first.');
      }

      setInFlightPhase('single_codegen');
      setStepper(3, 'loading');
      persistState(true);

      if (onProceedToCode) {
        onProceedToCode(activeBp);
      } else if (typeof window !== 'undefined' && typeof (window as any).generateCode === 'function') {
        (window as any).generateCode();
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || pipelineStatus === 'aborted') {
        console.info('[BlueprintOutput] Transition to code aborted.');
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Phase 3 Initialization Failed: ${msg}`);
      setStepper(3, 'error');
      persistState(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Window bridge for unmigrated legacy index.html scripts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).generateCodeTrigger = handleProceedToCode;
      (window as any).generateCode = handleProceedToCode;
    }
  }, [handleProceedToCode]);

  // If no blueprint and not in blueprint / single_design phase, stay hidden
  if (!currentBlueprint && inFlightPhase !== 'single_design' && inFlightPhase !== 'single_codegen') {
    return null;
  }

  const isCountdownActive =
    !isQuickMode &&
    countdown.isRunning &&
    countdown.targetAction === 'codegen' &&
    countdown.remainingSeconds > 0;

  return (
    <div
      id="designOutputSection"
      className={`bg-slate-900/95 dark:bg-slate-900/95 rounded-2xl shadow-xl border border-slate-800 p-6 space-y-4 backdrop-blur-xl transition-all duration-300 ${className}`}
    >
      {/* Header & Mode Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Square3Stack3DIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Phase 2: System Design Blueprint
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              SYS.ARCH_MAPPER Artifact (Architecture Specification)
            </p>
          </div>
        </div>

        {/* Dynamic Interactive Badge */}
        <span
          id="designJsonOutputBadge"
          className={`inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full border shadow-sm transition-colors ${
            isPaused
              ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
              : !isQuickMode
              ? 'bg-indigo-950/40 text-indigo-300 border-indigo-800/60'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {isPaused ? (
            <span>EDITABLE BLUEPRINT (PAUSED)</span>
          ) : !isQuickMode ? (
            <span>RICH TEXT BLUEPRINT (CLICK TO EDIT)</span>
          ) : (
            <>
              <LockClosedIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>READ-ONLY BLUEPRINT</span>
            </>
          )}
        </span>
      </div>

      {/* Rich Text Blueprint Viewer */}
      <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 shadow-inner max-h-[500px] overflow-y-auto custom-scrollbar">
        <div
          id="designJsonOutput"
          ref={contentRef}
          contentEditable={isEditable}
          suppressContentEditableWarning
          onInput={() => {
            if (contentRef.current) {
              setDisplayText(contentRef.current.innerText);
            }
          }}
          className={`w-full min-h-[300px] text-sm sm:text-base leading-relaxed whitespace-pre-wrap outline-none select-text transition-colors font-mono text-slate-300 bg-transparent ${
            isEditable ? 'cursor-text focus:ring-1 focus:ring-indigo-500/50 rounded-lg p-1' : 'cursor-default'
          }`}
        >
          {displayText || 'Awaiting architecture design blueprint...'}
        </div>
      </div>

      {isPaused && currentBlueprint && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={async () => {
              const textToParse = contentRef.current?.innerText || displayText;
              if (textToParse.trim()) {
                setIsProcessing(true);
                try {
                  const parsed = await parseMutation.mutateAsync(textToParse);
                  if (parsed && parsed.files) {
                    setBlueprint(parsed);
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
            Save & Re-parse Blueprint
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

      {/* Generate Source Code Button */}
      <button
        id="codeBtn"
        type="button"
        onClick={handleProceedToCode}
        disabled={isProcessing || !currentBlueprint}
        className={`w-full font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 shadow-sm text-white ${
          isProcessing || !currentBlueprint
            ? 'bg-indigo-700/50 cursor-not-allowed text-slate-400'
            : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] cursor-pointer'
        }`}
      >
        <span id="codeBtnText">
          {isProcessing
            ? 'Transitioning to Code Generation...'
            : isCountdownActive
            ? `Generate Source Code (${countdown.remainingSeconds}s)`
            : 'Execute SYS.CODE_GEN (v1.3.0)'}
        </span>
        {isProcessing ? (
          <svg
            id="codeSpinner"
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
          <CodeBracketIcon className="w-4 h-4 text-white" />
        )}
      </button>
    </div>
  );
}

export default BlueprintOutput;
