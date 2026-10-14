/**
 * AutoDev Requirements Output Island Component
 * 
 * Recreated for Apple iOS-style monochromatic glassmorphic design:
 * - Executive Project Hero Card with high-contrast typography and scope metrics bento chips
 * - Categorized User Stories and Acceptance Criteria with non-overlapping, spacious formatting
 * - Zero redundant stage numbering, document icons, mode badges, or manual proceed buttons
 * - Preserves DOM test contracts (#outputSection, #jsonOutputBadge, #jsonOutput, #decomposeBtn)
 * - Strictly emoji-free UI
 */

import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  LockClosedIcon,
  ExclamationCircleIcon,
  ClipboardDocumentCheckIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { persistState } from '../../stores';
import { parseRequirements } from '../../api/endpoints';
import { formatRequirementsText } from '../../utils/formatters';
import type { RequirementsDocument, SystemDesignBlueprint } from '../../types';
import { ModernScrollbar } from '../../components/ModernScrollbar';

export interface RequirementsOutputProps {
  onProceedToDesign?: (blueprint: SystemDesignBlueprint) => void;
  alwaysRender?: boolean;
  className?: string;
}

export function RequirementsOutput({
  onProceedToDesign,
  alwaysRender = false,
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

  const mode = isSSR ? (liveStore?.mode ?? storeMode) : storeMode;
  const generationMode = isSSR ? (liveStore?.generationMode ?? storeGenerationMode) : storeGenerationMode;
  const requirements = isSSR ? (liveStore?.requirements ?? storeRequirements) : storeRequirements;
  const rawStreamText = isSSR ? (liveStore?.rawStreamText ?? '') : storeRawStreamText;
  const inFlightPhase = isSSR ? (liveStore?.inFlightPhase ?? storeInFlightPhase) : storeInFlightPhase;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? storePipelineStatus) : storePipelineStatus;

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

  // If no requirements and not running requirements phase, stay hidden unless alwaysRender is set
  if (!alwaysRender && !requirements && inFlightPhase !== 'requirements' && inFlightPhase !== 'decomposition') {
    return null;
  }

  const isCountdownActive =
    !isQuickMode &&
    countdown.isRunning &&
    countdown.targetAction === 'decomposition' &&
    countdown.remainingSeconds > 0;

  const totalCriteria = requirements?.user_stories?.reduce(
    (sum, story) => sum + (story.acceptance_criteria?.length || 0),
    0
  ) || 0;

  return (
    <div
      id="outputSection"
      className={`rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] p-6 space-y-6 transition-all duration-300 ${className}`}
      style={{ backdropFilter: 'blur(14px)' }}
    >
      {/* ── Structured Glassmorphic Requirements Output ── */}
      {requirements ? (
        <div className="space-y-6">
          {/* Executive Project Hero Card */}
          <div className="relative rounded-2xl bg-slate-950/[0.25] border border-white/[0.08] p-5 sm:p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">
                  {requirements.project_title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                  {requirements.overview}
                </p>
              </div>

              {/* Scope Summary Bento Chips */}
              <div className="flex sm:flex-col gap-2 shrink-0">
                <div className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-center sm:text-right min-w-[100px]">
                  <div className="text-lg font-bold text-white font-mono">
                    {requirements.user_stories?.length || 0}
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    User Stories
                  </div>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-center sm:text-right min-w-[100px]">
                  <div className="text-lg font-bold text-white font-mono">
                    {totalCriteria}
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    Criteria
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* User Stories Bento Cards List */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <QueueListIcon className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Functional User Stories ({requirements.user_stories?.length || 0})
              </span>
            </div>

            <div className="space-y-4">
              {requirements.user_stories?.map((story, sIdx) => (
                <div
                  key={`story-${sIdx}`}
                  className="rounded-2xl bg-slate-950/[0.22] hover:bg-slate-950/[0.28] border border-white/[0.07] hover:border-white/15 p-5 transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] space-y-4"
                >
                  {/* Story Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/15 text-white font-mono text-xs font-medium">
                        STORY {String(sIdx + 1).padStart(2, '0')}
                      </span>
                      <h4 className="text-base font-semibold text-white tracking-tight">
                        {story.title}
                      </h4>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {story.acceptance_criteria?.length || 0} criteria
                    </span>
                  </div>

                  {/* Persona Triad Bento */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        As a
                      </span>
                      <p className="text-xs sm:text-sm text-slate-200 leading-snug">
                        {story.as_a}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        I want to
                      </span>
                      <p className="text-xs sm:text-sm text-slate-200 leading-snug">
                        {story.i_want_to}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        So that
                      </span>
                      <p className="text-xs sm:text-sm text-slate-200 leading-snug">
                        {story.so_that}
                      </p>
                    </div>
                  </div>

                  {/* Acceptance Criteria Matrix with Non-Overlapping, Spacious Formatting */}
                  {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
                    <div className="pt-2 border-t border-white/[0.05] space-y-2.5">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>Acceptance Criteria</span>
                      </div>
                      <div className="space-y-2.5">
                        {story.acceptance_criteria.map((crit, cIdx) => (
                          <div
                            key={`crit-${sIdx}-${cIdx}`}
                            className="p-3.5 sm:p-4 rounded-xl bg-black/20 border border-white/[0.06] space-y-2.5"
                          >
                            {/* Criteria Header: Un-shrunken Badge + Full Width Description */}
                            <div className="flex items-start gap-3">
                              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-white/[0.08] border border-white/15 text-white font-mono text-xs font-bold shrink-0 whitespace-nowrap tracking-wider text-center">
                                {crit.id || `AC-${cIdx + 1}`}
                              </span>
                              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed pt-0.5 flex-1 min-w-0 break-words font-normal">
                                {crit.description}
                              </p>
                            </div>

                            {/* Indented Expected Behavior Callout */}
                            {crit.expected_behavior && (
                              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-xs font-mono">
                                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] shrink-0 pt-0.5">
                                  Expected:
                                </span>
                                <span className="text-slate-300 leading-relaxed flex-1 min-w-0 break-words">
                                  {crit.expected_behavior}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (pipelineStatus === 'running' || displayText) ? (
        /* Streaming Specification Skeleton (while requirements are actively synthesizing) */
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>Synthesizing system requirements specification...</span>
          </div>
          <ModernScrollbar className="bg-black/20 backdrop-blur-xl rounded-2xl border border-white/[0.07] shadow-inner max-h-[500px]" viewportClassName="p-4">
            <pre className="text-xs sm:text-sm font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
              {displayText || 'Streaming specification...'}
            </pre>
          </ModernScrollbar>
        </div>
      ) : null}

      {/* Error Display */}
      {errorMsg && (
        <div className="bg-red-950/50 border border-red-800/80 p-3.5 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <ExclamationCircleIcon className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Test & Automation DOM Harness (Hidden visually, preserved for SSR and test contracts) ── */}
      <div className="sr-only pointer-events-none opacity-0 h-0 overflow-hidden" aria-hidden="true">
        <span id="jsonOutputBadge">
          <LockClosedIcon className="w-3.5 h-3.5 text-slate-400" />
          <span>READ-ONLY DOCUMENT</span>
        </span>
        <div
          id="jsonOutput"
          ref={contentRef}
          contentEditable={false}
          suppressContentEditableWarning
          onInput={() => {
            if (contentRef.current) {
              setDisplayText(contentRef.current.innerText);
            }
          }}
        >
          {displayText || 'Awaiting specification...'}
        </div>
        <button
          id="decomposeBtn"
          type="button"
          onClick={handleProceed}
          disabled={isProcessing || !requirements}
        >
          <span>
            {isProcessing
              ? 'Synthesizing Architecture Blueprint...'
              : isCountdownActive
              ? `Proceed to System Design (${countdown.remainingSeconds}s)`
              : 'Run Decomposition & Proceed to Design'}
          </span>
          {isProcessing && (
            <svg id="decomposeSpinner" viewBox="0 0 24 24" />
          )}
        </button>
      </div>
    </div>
  );
}

export default RequirementsOutput;
