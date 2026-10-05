/**
 * AutoDev IDE View Island Component
 * 
 * Implements Milestone 2 R1 & R5:
 * - Outer container matching #codeOutputSection & #revisionTabsBar
 * - Header title #codeOutputTitle with active revision label
 * - Pill buttons #revisionTabs for each revision snapshot
 * - Action toolbar with Diff toggle (#diffToggleBtn) and Download ZIP (#downloadZipBtn)
 * - Live streaming container #codeFilesContainer using useApiStream
 * - Code generation execution via POST /api/generate-code
 * - Surgical differential merging for modified_files preserving untouched files 100% byte-identical
 * - Integrated FileExplorer (#fileExplorer), MonacoEditor (#monacoContainer), and DiffViewer (#diffContainer)
 * - Action transition button #execBtn with auto-advance in QUICK mode and 30s countdown in COMPLEX mode
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { persistState } from '../../stores';
import { useApiStream } from '../../hooks/useApiStream';
import { generateCode } from '../../api/endpoints';
import { executeSandboxCode } from '../pipeline/revisionLoop';
import { robustJsonParse } from '../../utils/jsonParser';
import { exportZip } from '../../utils/zipExporter';
import { FileExplorer } from './FileExplorer';
import { MonacoEditor } from './MonacoEditor';
import { DiffViewer } from './DiffViewer';
import { LivePreview } from './LivePreview';
import { mergeDifferentialCodebase, normalizePath } from './merger';
import type { CodeFile, GeneratedCodeBase, RevisionHistoryItem } from '../../types';
import { withJsonRetry, JsonParseExhaustedError } from '../../utils/jsonRetry';

export interface IDEViewProps {
  codebase?: GeneratedCodeBase | null;
  revisionHistory?: RevisionHistoryItem[];
  activeRevisionIndex?: number;
  activeFileIndex?: number;
  isDiffMode?: boolean;
  className?: string;
}

export function IDEView({
  codebase: propCodebase,
  revisionHistory: propRevisionHistory,
  activeRevisionIndex: propActiveRevisionIndex,
  activeFileIndex: propActiveFileIndex,
  isDiffMode: propIsDiffMode,
  className = '',
}: IDEViewProps) {
  // Support both SSR (useAppStore.getState() in Node / renderToString) and client reactivity (useAppStore hook)
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // --- Zustand Store State ---
  const storeMode = useAppStore((s) => s.mode);
  const storeGenerationMode = useAppStore((s) => s.generationMode || s.mode);
  const mode = isSSR ? (liveStore?.mode ?? storeMode) : storeMode;
  const generationMode = isSSR ? (liveStore?.generationMode ?? storeGenerationMode) : storeGenerationMode;
  const isQuickMode = generationMode === 'QUICK' || mode === 'QUICK';

  const storeRequirements = useAppStore((s) => s.requirements);
  const storeBlueprint = useAppStore((s) => s.currentBlueprint);
  const storeCodebase = useAppStore((s) => s.currentCodebase);
  const storeRevisionHistory = useAppStore((s) => s.revisionHistory);
  const storeActiveRevisionIndex = useAppStore((s) => s.activeRevisionIndex);
  const storeCurrentRevisionPlan = useAppStore((s) => s.currentRevisionPlan);

  const storeActiveFileIndex = useAppStore((s) => s.activeFileIndex);
  const storeIsDiffMode = useAppStore((s) => s.isDiffMode);
  const storeIsPreviewOpen = useAppStore((s) => s.isPreviewOpen);

  const storeInFlightPhase = useAppStore((s) => s.inFlightPhase);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);

  // Fallbacks: Props > SSR live state > Hook reactive state
  const currentRequirements = isSSR ? (liveStore?.requirements ?? storeRequirements) : storeRequirements;
  const currentBlueprint = isSSR ? (liveStore?.currentBlueprint ?? storeBlueprint) : storeBlueprint;
  const currentCodebase = propCodebase !== undefined
    ? propCodebase
    : (isSSR ? (liveStore?.currentCodebase ?? storeCodebase) : storeCodebase);
  const revisionHistory = propRevisionHistory !== undefined
    ? propRevisionHistory
    : (isSSR ? (liveStore?.revisionHistory ?? storeRevisionHistory) : storeRevisionHistory);
  const activeRevisionIndex = propActiveRevisionIndex !== undefined
    ? propActiveRevisionIndex
    : (isSSR ? (liveStore?.activeRevisionIndex ?? storeActiveRevisionIndex) : storeActiveRevisionIndex);
  const currentRevisionPlan = isSSR ? (liveStore?.currentRevisionPlan ?? storeCurrentRevisionPlan) : storeCurrentRevisionPlan;

  const activeFileIndex = propActiveFileIndex !== undefined
    ? propActiveFileIndex
    : (isSSR ? (liveStore?.activeFileIndex ?? storeActiveFileIndex) : storeActiveFileIndex);
  const isDiffMode = propIsDiffMode !== undefined
    ? propIsDiffMode
    : (isSSR ? (liveStore?.isDiffMode ?? storeIsDiffMode) : storeIsDiffMode);
  const isPreviewOpen = isSSR ? (liveStore?.isPreviewOpen ?? storeIsPreviewOpen) : storeIsPreviewOpen;

  const inFlightPhase = isSSR ? (liveStore?.inFlightPhase ?? storeInFlightPhase) : storeInFlightPhase;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? storePipelineStatus) : storePipelineStatus;
  
  const storeIsPaused = useAppStore((s) => s.isPaused);
  const isPaused = isSSR ? (liveStore?.isPaused ?? storeIsPaused) : storeIsPaused;
  const storeResumeEpoch = useAppStore((s) => s.resumeEpoch);
  const resumeEpoch = isSSR ? (liveStore?.resumeEpoch ?? storeResumeEpoch) : storeResumeEpoch;

  const currentRevisionCount = useAppStore((s) => s.currentRevisionCount);

  // --- Store Actions ---
  const setCodebase = useAppStore((s) => s.setCodebase);
  const updateCodeFile = useAppStore((s) => s.updateCodeFile);
  const snapshotRevision = useAppStore((s) => s.snapshotRevision);
  const setActiveRevisionIndex = useAppStore((s) => s.setActiveRevisionIndex);
  const setActiveFileIndex = useAppStore((s) => s.setActiveFileIndex);
  const setIsDiffMode = useAppStore((s) => s.setIsDiffMode);
  const setIsPreviewOpen = useAppStore((s) => s.setIsPreviewOpen);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);
  const setStepper = useAppStore((s) => s.setStepper);

  // --- Session Store (Countdown) ---
  const countdown = useSessionStore((s) => s.countdown);
  const cancelCountdown = useSessionStore((s) => s.cancelCountdown);

  // --- Local Component State ---
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasAutoTriggeredRef = useRef<boolean>(false);
  const hasAutoAdvancedExecRef = useRef<boolean>(false);
  const lastProcessedRevRef = useRef<number>(0);

  // --- Streaming Hook ---
  const streamHook = useApiStream();
  const { isStreaming, streamText } = streamHook;

  // Derive active files and active file
  const files: CodeFile[] = currentCodebase?.files || [];
  const activeFile: CodeFile | null =
    activeFileIndex >= 0 && activeFileIndex < files.length ? files[activeFileIndex] : files[0] || null;

  // Previous revision for diff comparison
  const previousRevision =
    activeRevisionIndex > 0 && activeRevisionIndex < revisionHistory.length
      ? revisionHistory[activeRevisionIndex - 1]
      : null;
  const previousFile: CodeFile | null =
    previousRevision && activeFile
      ? previousRevision.codebase.files.find(
          (f) => normalizePath(f.file_name) === normalizePath(activeFile.file_name)
        ) || null
      : null;

  // Active revision title computation
  const getRevisionTitle = useCallback(() => {
    if (activeRevisionIndex < 0 || revisionHistory.length === 0) {
      return 'Generated Codebase';
    }
    const currentRev = revisionHistory[activeRevisionIndex];
    if (currentRev?.label) {
      return `Generated Codebase (${currentRev.label})`;
    }
    if (activeRevisionIndex === 0) {
      return 'Generated Codebase (Initial)';
    }
    return `Generated Codebase (Rev ${activeRevisionIndex})`;
  }, [activeRevisionIndex, revisionHistory]);

  // =========================================================================
  // Code Generation Execution
  // =========================================================================
  const runCodeGeneration = useCallback(
    async (isRevision = false) => {
      cancelCountdown();
      setErrorMsg(null);

      if (!currentRequirements || !currentBlueprint) {
        setErrorMsg('Missing prerequisites: requirements and design blueprint are required.');
        return;
      }

      setInFlightPhase('single_codegen');
      setStepper(3, 'loading');
      persistState(true);

      const codegenIntervalId = useAppStore.getState().startTimelineInterval({
        phase: 'codegen',
        stageName: 'Single-Pass Code Generation',
        label: isRevision ? `Codegen (Rev ${useAppStore.getState().currentRevisionCount})` : 'Codegen',
        revisionIndex: useAppStore.getState().currentRevisionCount,
      });

      try {
        const payload: any = {
          requirements: currentRequirements,
          blueprint: currentBlueprint,
          generation_mode: 'QUICK',
          mode: 'QUICK',
        };

        if (isRevision && currentRevisionPlan && currentCodebase) {
          payload.previous_codebase = currentCodebase;
          payload.revision_plan = currentRevisionPlan;
        }

        // Consume stream using useApiStream
        const setJsonRetryState = useAppStore.getState().setJsonRetryState;
        const parsed = await withJsonRetry(
          async (opts) => {
            if (opts?.model) payload.model = opts.model;
            return await streamHook.startStream(async (callbacks, signal) => {
              return generateCode(payload, callbacks, { signal });
            });
          },
          (raw) => {
            const p: any = robustJsonParse(raw);
            if (p.error && !p.files && !p.modified_files) {
              if (p.json_parse_failure) throw new JsonParseExhaustedError(p.error, 'CODEGEN', p.attempts);
              throw new Error(p.error || 'Failed to parse generated codebase JSON.');
            }
            return p;
          },
          {
            phaseName: 'CODEGEN',
            onRetryAttempt: (attempt, max) => {
              setErrorMsg(`JSON parse error. Retrying attempt ${attempt}/${max}...`);
              setJsonRetryState({
                isRetrying: true,
                currentAttempt: attempt,
                maxAttempts: max,
                phaseName: 'CODEGEN',
                usingFallback: attempt > 3,
              });
            }
          }
        );
        setJsonRetryState(null);

        // Apply surgical differential merging if differential schema was returned
        const mergedCodebase = mergeDifferentialCodebase(currentCodebase, parsed);

        // Update codebase in store
        setCodebase(mergedCodebase);

        // Record revision snapshot in history
        snapshotRevision();

        setStepper(3, 'success');
        setInFlightPhase('single_execution');
        useAppStore.getState().completeTimelineInterval(codegenIntervalId, { status: 'completed' });
        persistState(true);

        // Reset auto-advance ref for execution
        hasAutoAdvancedExecRef.current = false;
      } catch (err: any) {
        useAppStore.getState().setJsonRetryState(null);
        useAppStore.getState().completeTimelineInterval(codegenIntervalId, { status: 'failed' });
        if (err instanceof JsonParseExhaustedError) {
          console.error('[IDEView] JSON Parse Exhausted:', err);
          setStepper(3, 'error');
          setErrorMsg(err.message);
          useAppStore.getState().setPipelineStatus('idle');
          setInFlightPhase(null);
          persistState(true);
          return;
        }
        if (err.name === 'AbortError' || pipelineStatus === 'aborted') {
          console.log('[IDEView] Code generation stream aborted.');
          return;
        }
        console.error('[IDEView] Code generation failed:', err);
        setStepper(3, 'error');
        setErrorMsg(`Code generation failed: ${err.message || String(err)}`);
      }
    },
    [
      cancelCountdown,
      currentRequirements,
      currentBlueprint,
      isQuickMode,
      currentRevisionPlan,
      currentCodebase,
      streamHook,
      setCodebase,
      snapshotRevision,
      setStepper,
      setInFlightPhase,
      pipelineStatus,
    ]
  );

  // Reset auto-trigger guards when not in relevant phase or pipeline restarts
  useEffect(() => {
    if (inFlightPhase !== 'single_codegen' || pipelineStatus !== 'running') {
      hasAutoTriggeredRef.current = false;
    }
    if (inFlightPhase !== 'single_execution' || pipelineStatus !== 'running' || !currentCodebase) {
      hasAutoAdvancedExecRef.current = false;
    }
    if (currentRevisionCount === 0 || pipelineStatus !== 'running') {
      lastProcessedRevRef.current = 0;
    }
  }, [inFlightPhase, pipelineStatus, currentCodebase, currentRevisionCount]);

  // Re-arm auto-trigger guards on resumption
  useEffect(() => {
    if (!isPaused && resumeEpoch > 0) {
      hasAutoTriggeredRef.current = false;
      hasAutoAdvancedExecRef.current = false;
    }
  }, [isPaused, resumeEpoch]);

  // Auto-trigger code generation when entering single_codegen phase without codebase
  useEffect(() => {
    if (isPaused) return; // <-- PAUSE GUARD
    if (
      inFlightPhase === 'single_codegen' &&
      pipelineStatus === 'running' &&
      !currentCodebase &&
      !isStreaming &&
      !hasAutoTriggeredRef.current
    ) {
      hasAutoTriggeredRef.current = true;
      runCodeGeneration(false);
    }
  }, [inFlightPhase, pipelineStatus, currentCodebase, isStreaming, runCodeGeneration, isPaused]);

  // Auto-trigger revision code generation when entering single_codegen with revisionCount > 0
  useEffect(() => {
    if (isPaused) return; // <-- PAUSE GUARD
    if (
      inFlightPhase === 'single_codegen' &&
      pipelineStatus === 'running' &&
      !isStreaming &&
      currentRevisionCount > 0 &&
      currentRevisionCount > lastProcessedRevRef.current
    ) {
      lastProcessedRevRef.current = currentRevisionCount;
      runCodeGeneration(true);
    }
  }, [inFlightPhase, pipelineStatus, isStreaming, currentRevisionCount, runCodeGeneration, isPaused]);

  // Auto-advance to single_execution when entering single_codegen with an already-populated codebase (e.g. post-pause modification)
  useEffect(() => {
    if (isPaused) return; // <-- PAUSE GUARD
    if (
      inFlightPhase === 'single_codegen' &&
      pipelineStatus === 'running' &&
      currentCodebase &&
      !isStreaming &&
      currentRevisionCount === 0
    ) {
      setInFlightPhase('single_execution');
    }
  }, [inFlightPhase, pipelineStatus, currentCodebase, isStreaming, currentRevisionCount, setInFlightPhase, isPaused]);

  // Execute Sandbox Handler — calls the actual API (Bug #1 fix)
  const handleExecuteSandbox = useCallback(async () => {
    cancelCountdown();
    setInFlightPhase('single_execution');
    setStepper(4, 'loading');
    persistState(true);

    try {
      await executeSandboxCode({
        codebase: currentCodebase,
        blueprint: currentBlueprint as any,
        mode: (generationMode || mode || 'QUICK') as any,
        autoAdvance: true,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || useAppStore.getState().pipelineStatus === 'aborted') {
        console.log('[IDEView] Sandbox execution aborted.');
        return;
      }
      console.error('[IDEView] Sandbox execution error:', err);
    }
  }, [cancelCountdown, setInFlightPhase, setStepper, currentCodebase, currentBlueprint, generationMode, mode]);

  // Handle auto-advance or 30s countdown to execution
  useEffect(() => {
    if (isPaused) return; // <-- PAUSE GUARD
    if (
      !currentCodebase ||
      isStreaming ||
      inFlightPhase !== 'single_execution' ||
      pipelineStatus !== 'running'
    ) {
      return;
    }

    if (!hasAutoAdvancedExecRef.current) {
      hasAutoAdvancedExecRef.current = true;
      const timer = setTimeout(() => {
        handleExecuteSandbox();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentCodebase, isStreaming, inFlightPhase, pipelineStatus, handleExecuteSandbox, isPaused]);

  // Switch Active File
  const handleSelectFile = (index: number) => {
    setActiveFileIndex(index);
  };

  // Edit in Monaco Handler
  const handleEditorChange = (newCode: string) => {
    if (activeFile) {
      updateCodeFile(activeFile.file_name, newCode);
    }
  };

  // Focus Monaco Handler
  const handleEditorFocus = () => {};

  // Switch Revision Tab
  const handleSelectRevision = (index: number) => {
    setActiveRevisionIndex(index);
    if (isDiffMode && index === 0) {
      setIsDiffMode(false);
    }
  };

  // Toggle Diff Mode
  const handleToggleDiff = () => {
    if (revisionHistory.length <= 1) return;
    setIsDiffMode(!isDiffMode);
  };

  // Export ZIP Archive
  const handleDownloadZip = async () => {
    if (!currentCodebase || files.length === 0) return;
    setIsExporting(true);
    try {
      const title = currentRequirements?.project_title || 'autodev_project';
      await exportZip(currentCodebase, {
        projectTitle: title,
        downloadFilename: title,
      });
    } catch (err) {
      console.error('[IDEView] ZIP Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle preview handler matching legacy togglePreview behavior
  const handleTogglePreview = useCallback((showPreview: boolean) => {
    setIsPreviewOpen(showPreview);
    if (typeof document !== 'undefined') {
      const tabCode = document.getElementById('tabCode');
      const tabPreview = document.getElementById('tabPreview');
      const monacoContainer = document.getElementById('monacoContainer');
      const previewContainer = document.getElementById('previewContainer');

      if (showPreview) {
        if (tabPreview) tabPreview.className = "text-xs font-semibold px-3 py-1 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 transition-colors";
        if (tabCode) tabCode.className = "text-xs font-semibold px-3 py-1 rounded text-slate-400 hover:text-white transition-colors";
        if (monacoContainer) monacoContainer.classList.add('hidden');
        if (previewContainer) previewContainer.classList.remove('hidden');
        if (typeof (window as any).renderLivePreview === 'function') {
          (window as any).renderLivePreview();
        }
      } else {
        if (tabCode) tabCode.className = "text-xs font-semibold px-3 py-1 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 transition-colors";
        if (tabPreview) tabPreview.className = "text-xs font-semibold px-3 py-1 rounded text-slate-400 hover:text-white transition-colors";
        if (previewContainer) previewContainer.classList.add('hidden');
        if (monacoContainer) monacoContainer.classList.remove('hidden');
      }
    }
  }, [setIsPreviewOpen]);

  // Window bridges for legacy parity and recovery matrix
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).generateSinglePassCode = () => runCodeGeneration(false);
      (window as any).runSinglePassExecution = handleExecuteSandbox;
      (window as any).togglePreview = handleTogglePreview;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).togglePreview;
      }
    };
  }, [runCodeGeneration, handleExecuteSandbox, handleTogglePreview]);

  // Determine visibility: visible if code exists, streaming, or in single_codegen/execution
  const isVisible =
    currentCodebase !== null ||
    isStreaming ||
    inFlightPhase === 'single_codegen' ||
    inFlightPhase === 'single_execution';

  if (!isVisible && revisionHistory.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ===================================================================
       * REVISION TABS BAR (#revisionTabsBar)
       * =================================================================== */}
      {revisionHistory.length > 0 && (
        <div id="revisionTabsBar" className="fade-in">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mr-2 whitespace-nowrap">
              Revisions:
            </span>
            <div id="revisionTabs" className="flex items-center gap-2" role="tablist">
              {revisionHistory.map((rev, index) => {
                const isActive = index === activeRevisionIndex;
                const isPostRun = !!rev.isPostCompletion;
                const label = rev.label || (index === 0 ? 'Rev 0 (Initial)' : `Rev ${index}`);

                return (
                  <button
                    key={`${rev.revisionNumber}-${index}`}
                    type="button"
                    onClick={() => handleSelectRevision(index)}
                    role="tab"
                    aria-selected={isActive}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors border ${
                      isActive
                        ? isPostRun
                          ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 font-bold shadow-sm'
                          : 'bg-purple-500/30 text-purple-300 border-purple-500/50 font-bold shadow-sm'
                        : isPostRun
                        ? 'bg-slate-800 text-emerald-400/80 border-slate-700 hover:bg-slate-700 hover:text-emerald-300'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
       * CODE OUTPUT SECTION (#codeOutputSection)
       * =================================================================== */}
      <section
        id="codeOutputSection"
        className="bg-slate-900 rounded-2xl shadow-glass border border-slate-800 p-6 fade-in text-slate-100"
      >
        {/* Header Bar */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2.5">
            <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold shadow-sm">
              2b
            </span>
            <span id="codeOutputTitle" className="text-base sm:text-lg font-bold">
              {getRevisionTitle()}
            </span>
          </h2>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {/* Diff Mode Toggle Button (#diffToggleBtn) */}
            {revisionHistory.length > 1 && (
              <button
                id="diffToggleBtn"
                type="button"
                onClick={handleToggleDiff}
                className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors flex items-center gap-1.5 ${
                  isDiffMode
                    ? 'bg-purple-600/30 text-purple-300 border-purple-500 font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Toggle side-by-side diff comparing revisions"
              >
                <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                <span>{isDiffMode ? 'Hide Diff' : 'Show Diff'}</span>
              </button>
            )}

            {/* Download ZIP Button */}
            <button
              id="downloadZipBtn"
              type="button"
              onClick={handleDownloadZip}
              disabled={isExporting || files.length === 0}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-full font-medium border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              title="Download project as ZIP archive"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>{isExporting ? 'Exporting...' : 'Download .zip'}</span>
            </button>

            {/* Status Badge */}
            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full font-medium border border-purple-500/30 flex items-center gap-1">
              <CheckCircleIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>{isStreaming ? 'Generating' : 'Ready'}</span>
            </span>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <ExclamationCircleIcon className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ===================================================================
         * STREAMING VIEW CONTAINER (#codeFilesContainer)
         * =================================================================== */}
        {isStreaming && (
          <div
            id="codeFilesContainer"
            className="space-y-4 mb-6 max-h-[500px] overflow-y-auto p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-gray-300"
          >
            <div className="flex items-center gap-2 text-indigo-400 font-medium">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Streaming source code generation...</span>
            </div>
            <pre className="whitespace-pre-wrap text-slate-400 text-xs font-mono break-all">
              <code>{streamText}</code>
            </pre>
          </div>
        )}

        {/* ===================================================================
         * DIFF VIEWER (#diffContainer)
         * =================================================================== */}
        {!isStreaming && isDiffMode && (
          <DiffViewer
            originalFile={previousFile}
            modifiedFile={activeFile}
            previousRevisionLabel={
              previousRevision?.label || `Rev ${Math.max(0, activeRevisionIndex - 1)}`
            }
            currentRevisionLabel={
              revisionHistory[activeRevisionIndex]?.label || `Rev ${activeRevisionIndex}`
            }
            height="500px"
          />
        )}

        {/* ===================================================================
         * MAIN IDE CONTAINER (#ideContainer)
         * =================================================================== */}
        {!isStreaming && !isDiffMode && (
          <div
            id="ideContainer"
            className="flex flex-col sm:flex-row border border-slate-700 rounded-xl overflow-hidden h-[500px] mb-6 bg-[#1e1e1e] shadow-inner"
          >
            {/* Left Sidebar: File Explorer */}
            <FileExplorer
              files={files}
              activeFileIndex={activeFileIndex}
              onSelectFile={handleSelectFile}
            />

            {/* Right Pane: Code Editor & Live Preview */}
            <div className="w-full sm:w-2/3 h-full relative flex flex-col">
              {/* Tab Header Bar */}
              <div className="flex items-center justify-between bg-slate-950 border-b border-slate-700 px-3 py-1.5 h-10">
                <div className="flex gap-2">
                  <button
                    id="tabCode"
                    type="button"
                    onClick={() => handleTogglePreview(false)}
                    className={`text-xs font-semibold px-3 py-1 rounded transition-colors ${
                      !isPreviewOpen
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Code Editor
                  </button>
                  <button
                    id="tabPreview"
                    type="button"
                    onClick={() => handleTogglePreview(true)}
                    className={`text-xs font-semibold px-3 py-1 rounded transition-colors ${
                      isPreviewOpen
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live Preview
                  </button>
                </div>

                {/* Mode Indicator & Active File */}
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span className="truncate max-w-[140px] text-slate-300">
                    {activeFile?.file_name}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Source
                  </span>
                </div>
              </div>

              {/* Monaco Editor Host (#monacoContainer) */}
              <MonacoEditor
                file={activeFile}
                isReadOnly={false}
                onChange={handleEditorChange}
                onFocus={handleEditorFocus}
                height="100%"
                className={isPreviewOpen ? 'hidden' : ''}
              />

              {/* Live Preview Host (#previewContainer & #livePreviewFrame) */}
              <LivePreview
                codebase={currentCodebase}
                blueprint={currentBlueprint}
                className={!isPreviewOpen ? 'hidden' : ''}
              />
            </div>
          </div>
        )}

        {/* ===================================================================
         * ACTION TRANSITION (#execBtn)
         * =================================================================== */}
        <div className="border-t border-slate-700/80 pt-6">
          <p className="text-slate-400 text-xs sm:text-sm mb-3 text-center">
            Source code written. Run tests in isolated sandbox.
          </p>

          <button
            id="execBtn"
            type="button"
            onClick={handleExecuteSandbox}
            disabled={isStreaming || files.length === 0}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <span>
              {countdown.isRunning && countdown.targetAction === 'execution'
                ? `Execute SYS.SANDBOX_EXEC (${countdown.remainingSeconds}s)`
                : 'Execute SYS.SANDBOX_EXEC (v1.3.0)'}
            </span>
            <svg
              id="execSpinner"
              className={`animate-spin h-4 w-4 ${isStreaming ? 'inline' : 'hidden'}`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
}
