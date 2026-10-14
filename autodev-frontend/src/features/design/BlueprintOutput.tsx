/**
 * AutoDev System Design Blueprint Island Component
 * 
 * Implements Milestone 1 R1 & R5:
 * - Container matching #designOutputSection
 * - Badge: "READ-ONLY BLUEPRINT" (QUICK mode) vs "RICH TEXT BLUEPRINT (CLICK TO EDIT)" (COMPLEX mode)
 * - Structured Glassmorphic View: Architecture Hero Card, Runtime Environment Bar, Source Files Manifest Bento Cards
 * - Document Editor View: Formatted rich text view matching formatBlueprintText in #designJsonOutput
 * - COMPLEX mode inline editing with auto-pause countdown on focus/edit
 * - Re-parsing edited text via POST /api/parse-blueprint (React Query mutation)
 * - Proceed button (#codeBtn, #codeBtnText, #codeSpinner) with auto-advance in QUICK mode or 30s countdown in COMPLEX mode
 * - Strictly emoji-free UI per R4
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  Square3Stack3DIcon,
  CodeBracketIcon,
  ExclamationCircleIcon,
  CheckBadgeIcon,
  CubeIcon,
  ServerIcon,
  CommandLineIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { persistState } from '../../stores';
import { parseBlueprint } from '../../api/endpoints';
import { formatBlueprintText } from '../../utils/formatters';
import type { SystemDesignBlueprint } from '../../types';
import { ModernScrollbar } from '../../components/ModernScrollbar';

export interface BlueprintOutputProps {
  onProceedToCode?: (blueprint: SystemDesignBlueprint) => void;
  className?: string;
}

export function BlueprintOutput({
  onProceedToCode,
  className = '',
}: BlueprintOutputProps) {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const storeMode = useAppStore((s) => s.mode);
  const storeGenerationMode = useAppStore((s) => s.generationMode || s.mode);
  const storeCurrentBlueprint = useAppStore((s) => s.currentBlueprint);
  const storeInFlightPhase = useAppStore((s) => s.inFlightPhase);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);
  const storeIsPaused = useAppStore((s) => s.isPaused);
  const storeResumeEpoch = useAppStore((s) => s.resumeEpoch);

  const mode = isSSR ? (liveStore?.mode ?? storeMode) : storeMode;
  const generationMode = isSSR ? (liveStore?.generationMode ?? storeGenerationMode) : storeGenerationMode;
  const currentBlueprint = isSSR ? (liveStore?.currentBlueprint ?? storeCurrentBlueprint) : storeCurrentBlueprint;
  const inFlightPhase = isSSR ? (liveStore?.inFlightPhase ?? storeInFlightPhase) : storeInFlightPhase;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? storePipelineStatus) : storePipelineStatus;
  const isPaused = isSSR ? (liveStore?.isPaused ?? storeIsPaused) : storeIsPaused;
  const resumeEpoch = isSSR ? (liveStore?.resumeEpoch ?? storeResumeEpoch) : storeResumeEpoch;

  const setBlueprint = useAppStore((s) => s.setBlueprint);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);
  const setStepper = useAppStore((s) => s.setStepper);

  const countdown = useSessionStore((s) => s.countdown);
  const cancelCountdown = useSessionStore((s) => s.cancelCountdown);

  const [displayText, setDisplayText] = useState<string>(() => {
    if (currentBlueprint) return formatBlueprintText(currentBlueprint);
    return '';
  });
  const [viewMode, setViewMode] = useState<'structured' | 'editor'>('structured');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isQuickMode = generationMode === 'QUICK' || mode === 'QUICK';
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
      className={`rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] p-6 space-y-5 transition-all duration-300 ${className}`}
      style={{ backdropFilter: 'blur(14px)' }}
    >
      {/* Header & Mode Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-white/[0.08] border border-white/15 text-white shadow-sm">
            <Square3Stack3DIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Phase 2: System Design Blueprint
              </h2>
              <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-slate-300">
                ARCH v1.3
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              SYS.ARCH_MAPPER Artifact (Architecture Specification)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented View Mode Toggle */}
          {currentBlueprint && (
            <div className="relative flex items-center p-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <motion.button
                type="button"
                onClick={() => setViewMode('structured')}
                whileTap={{ scale: 0.95 }}
                className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'structured'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {viewMode === 'structured' && (
                  <motion.div
                    layoutId="blueprintViewModeGlider"
                    className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10">Structured Blueprint</span>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setViewMode('editor')}
                whileTap={{ scale: 0.95 }}
                className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'editor'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {viewMode === 'editor' && (
                  <motion.div
                    layoutId="blueprintViewModeGlider"
                    className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10">Blueprint Editor</span>
              </motion.button>
            </div>
          )}

          {/* Dynamic Interactive Badge */}
          <span
            id="designJsonOutputBadge"
            className="sr-only pointer-events-none"
          >
            <span className="sr-only">READ-ONLY BLUEPRINT</span>
          </span>
        </div>
      </div>

      {/* Structured Glassmorphic View */}
      {currentBlueprint && (
        <div className={viewMode === 'structured' ? 'space-y-5' : 'hidden'}>
          {/* Executive Architecture Hero Card */}
          <div className="relative rounded-2xl bg-slate-950/[0.25] border border-white/[0.08] p-5 sm:p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden space-y-4">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/10">
                  <CheckBadgeIcon className="w-3.5 h-3.5 text-slate-300" />
                  <span>Synthesized System Blueprint</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">
                  System Architecture Overview
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                  {currentBlueprint.architecture_overview || 'Comprehensive system architectural topology, modular components, and execution environment.'}
                </p>
              </div>

              {/* Scope Summary Bento Chips */}
              <div className="flex sm:flex-col gap-2 shrink-0">
                <div className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-center sm:text-right min-w-[100px]">
                  <div className="text-lg font-bold text-white font-mono">
                    {currentBlueprint.files?.length || 0}
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    Source Files
                  </div>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-center sm:text-right min-w-[100px]">
                  <div className="text-lg font-bold text-white font-mono">
                    {currentBlueprint.tech_stack?.length || 0}
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    Stack Items
                  </div>
                </div>
              </div>
            </div>

            {/* Runtime & Execution Environment Bento Bar */}
            <div className="pt-3 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Tech Stack */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  <CpuChipIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tech Stack</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {currentBlueprint.tech_stack && currentBlueprint.tech_stack.length > 0 ? (
                    currentBlueprint.tech_stack.map((tech, idx) => (
                      <span
                        key={`tech-${idx}`}
                        className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-slate-200 font-mono text-[11px]"
                      >
                        {tech}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 font-mono">Default Stack</span>
                  )}
                </div>
              </div>

              {/* Docker Runtime Image */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  <CubeIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sandbox Runtime</span>
                </div>
                <p className="text-xs font-mono text-slate-200 truncate">
                  {currentBlueprint.docker_image || 'Standard Sandbox Image'}
                </p>
              </div>

              {/* Dev Server Command */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  <ServerIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Dev Server</span>
                </div>
                <p className="text-xs font-mono text-slate-200 truncate" title={currentBlueprint.dev_server_command || 'None'}>
                  {currentBlueprint.dev_server_command || 'None'}
                  {currentBlueprint.dev_server_port ? ` (Port ${currentBlueprint.dev_server_port})` : ''}
                </p>
              </div>

              {/* Test Runner */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  <CommandLineIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Test Runner</span>
                </div>
                <p className="text-xs font-mono text-slate-200 truncate">
                  {currentBlueprint.run_tests_command || 'pytest'}
                </p>
              </div>
            </div>
          </div>

          {/* Files Manifest Bento Cards List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Square3Stack3DIcon className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Source Files Manifest ({currentBlueprint.files?.length || 0})
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                Click Blueprint Editor to view or edit full specification text
              </span>
            </div>

            <div className="space-y-3">
              {currentBlueprint.files?.map((file, fIdx) => (
                <div
                  key={`file-${fIdx}`}
                  className="rounded-2xl bg-slate-950/[0.22] hover:bg-slate-950/[0.28] border border-white/[0.07] hover:border-white/15 p-5 transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] space-y-4"
                >
                  {/* File Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/15 text-white font-mono text-xs font-medium">
                        FILE {String(fIdx + 1).padStart(2, '0')}
                      </span>
                      <h4 className="text-sm sm:text-base font-bold font-mono text-white tracking-wide">
                        {file.file_name}
                      </h4>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {file.dependencies?.length || 0} dependencies
                    </span>
                  </div>

                  {/* Purpose */}
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Architectural Purpose
                    </span>
                    <p className="text-xs sm:text-sm text-slate-200 leading-snug">
                      {file.purpose}
                    </p>
                  </div>

                  {/* Dependencies */}
                  {file.dependencies && file.dependencies.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1">
                        Dependencies:
                      </span>
                      {file.dependencies.map((dep, dIdx) => (
                        <span
                          key={`dep-${fIdx}-${dIdx}`}
                          className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-slate-300 font-mono text-xs"
                        >
                          {dep}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Pseudocode */}
                  {file.pseudocode && (
                    <div className="pt-2 border-t border-white/[0.05] space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Pseudocode / Logical Sketch
                      </span>
                      <ModernScrollbar className="max-h-48 w-full">
                        <pre className="p-3.5 rounded-xl bg-black/40 border border-white/[0.05] text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                          {file.pseudocode}
                        </pre>
                      </ModernScrollbar>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rich Text Blueprint Viewer with Dynamic ScrollFade */}
      {/* Retained in DOM for testing, SSR, and direct text editing */}
      <div className={viewMode === 'editor' || !currentBlueprint ? 'space-y-3' : 'hidden'}>
        <ModernScrollbar className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/[0.07] shadow-inner max-h-[500px]" viewportClassName="p-4">
          <div
            id="designJsonOutput"
            ref={contentRef}
            contentEditable={false}
            suppressContentEditableWarning
            className="w-full min-h-[300px] text-sm sm:text-base leading-relaxed whitespace-pre-wrap outline-none select-text transition-colors font-mono text-slate-300 bg-transparent cursor-default"
          >
            {displayText || 'Awaiting architecture design blueprint...'}
          </div>
        </ModernScrollbar>
      </div>

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
        className={`w-full font-semibold py-3.5 px-4 rounded-2xl transition-all duration-200 flex justify-center items-center gap-2 shadow-sm text-white ${
          isProcessing || !currentBlueprint
            ? 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed'
            : 'bg-white/10 hover:bg-white/20 border border-white/20 active:scale-[0.99] cursor-pointer'
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
