/**
 * AutoDev Post-Completion Control Plane Island Component
 * 
 * Implements Milestone 3 R5 & Milestone 4 Post-Completion Complete Development Cycle:
 * - Permanent non-disappearing control plane matching #postCompletionSection
 * - Mode Toggle: "Modify Code" (#postCompToggleModify) vs "Ask Query" (#postCompToggleQuery)
 * - Quick action chips: Theme change (#chipTheme), Add field (#chipField), Fix bug (#chipBug), Explain project (#chipExplain)
 * - Dynamic prompt textarea (#postCompletionPrompt) and submit button (#postCompletionSubmitBtn)
 * - In Modify mode:
 *   - Displays complete multi-phase development cycle for newly requested features/fixes:
 *     1. Stepper tracker (#postCompStepper) showing in-flight and completed phases
 *     2. Phase 1: Targeted Code Generation card (#postCompCodegenCard) with summary and touched files
 *     3. Phase 2: Sandbox Execution card (#postCompSandboxCard, #postCompVerifyBadge, #postCompToggleLogsBtn, #postCompLogsContainer, #postCompLogsOutput)
 *     4. Phase 3: Arbitration Engine card (#postCompArbitrationCard, #postCompCriticCards, #postCompVerdictBox)
 *     5. Phase 4: Revision Snapshot & Live Preview card (#postCompSnapshotCard, #postCompReloadPreviewBtn)
 *   - Appends snapshot to revisionHistory as "Post-Run Rev X", updates active codebase in Monaco,
 *     and hot-reloads Live Preview container
 *   - Post-run revision tabs (#postCompRevTabs) allow inspecting any previous post-run cycle
 * - In Query mode: calls POST /api/post-completion/query, streams technical explanation into #postCompQueryOutput
 *   with copy-to-clipboard functionality and markdown formatting
 * - Zero literal emojis in source or rendered HTML to strictly adhere to design constraints
 * - Bound to Zustand stores (useAppStore) and supports SSR / prop overrides
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  SparklesIcon,
  WrenchScrewdriverIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ShieldCheckIcon,
  XCircleIcon,
  PaintBrushIcon,
  PlusIcon,
  BugAntIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ScaleIcon,
  CodeBracketIcon,
  CpuChipIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { useAppStore, type PostCompletionMode } from '../../stores/appStore';
import { postCompletionModify, postCompletionQuery } from '../../api/endpoints';
import { persistState, resetAllStores } from '../../stores';
import { DevelopmentGanttChart } from '../../components/DevelopmentGanttChart';
import type {
  GeneratedCodeBase,
  ExecutionResult,
  RevisionHistoryItem,
  CriticFeedback,
  AdjudicatorDecision,
} from '../../types';

export interface PostCompletionPanelProps {
  initialMode?: PostCompletionMode;
  codebase?: GeneratedCodeBase | null;
  onModifySuccess?: (newCodebase: GeneratedCodeBase, result?: ExecutionResult | null) => void;
  className?: string;
}

/**
 * Converts raw markdown text to clean, human-readable indented format
 * matching the legacy AutoDev requirements/design format.
 */
export function formatMarkdownToHumanReadable(md: string | null | undefined): string {
  if (!md) return '';
  let text = md.replace(/\r\n/g, '\n');

  // 1. Format headers: # Title, ## Title -> TITLE:
  text = text.replace(/^(?:#{1,6})\s*([^\n\r]+)/gm, (_, p1) => {
    const headerText = p1.trim().replace(/[*_`]/g, '');
    return `\n${headerText.toUpperCase()}:\n`;
  });

  // 2. Format code blocks: ```lang ... ``` -> clean indented block
  text = text.replace(/```[a-zA-Z0-9_\-.]*\n([\s\S]*?)\n```/g, (_, code) => {
    const indented = code.split('\n').map((line: string) => '    ' + line).join('\n');
    return `\n[CODE SNIPPET]:\n${indented}\n`;
  });

  // 3. Strip bold and italic markdown markers
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1$2$3');
  text = text.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, '$1$2$3');

  // 4. Standardize list bullet points to clean circular bullets
  text = text.replace(/^(\s*)[*-]\s+/gm, '$1• ');

  // 5. Inline code literals: `code` -> 'code'
  text = text.replace(/`([^`]+)`/g, "'$1'");

  // 6. Markdown links: [label](url) -> label (url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

  // 7. Horizontal rules: --- -> divider
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, '----------------------------------------');

  // 8. Clean up excessive consecutive blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Severity score badge config matching AutoDev design language.
 */
function getSeverityBadge(score: number): { bg: string; label: string } {
  if (score <= 2) {
    return {
      bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      label: `${score}/10 (Pass)`,
    };
  }
  if (score <= 5) {
    return {
      bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      label: `${score}/10 (Moderate)`,
    };
  }
  return {
    bg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    label: `${score}/10 (Critical)`,
  };
}

export function PostCompletionPanel({
  initialMode = 'modify',
  codebase: propCodebase,
  onModifySuccess,
  className = '',
}: PostCompletionPanelProps) {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // Zustand Store Bindings
  const storeMode = useAppStore((s) => s.postCompletionMode);
  const storePrompt = useAppStore((s) => s.postCompletionPrompt);
  const storeResponse = useAppStore((s) => s.postCompletionResponse);
  const storeStatus = useAppStore((s) => s.postCompletionStatus);
  const storeSandboxResult = useAppStore((s) => s.postCompletionSandboxResult);
  const sCodebase = useAppStore((s) => s.currentCodebase);
  const sBlueprint = useAppStore((s) => s.currentBlueprint);
  const sRevisionHistory = useAppStore((s) => s.revisionHistory);
  const sAppMode = useAppStore((s) => s.mode);
  const sRequirements = useAppStore((s) => s.requirements);

  const currentCodebase = propCodebase !== undefined
    ? propCodebase
    : (isSSR ? (liveStore?.currentCodebase ?? null) : sCodebase);
  const currentBlueprint = isSSR ? (liveStore?.currentBlueprint ?? null) : sBlueprint;
  const revisionHistory = isSSR ? (liveStore?.revisionHistory ?? []) : sRevisionHistory;
  const appMode = isSSR ? (liveStore?.mode ?? 'QUICK') : sAppMode;
  const storeRequirements = isSSR ? (liveStore?.requirements ?? null) : sRequirements;

  const setStoreMode = useAppStore((s) => s.setPostCompletionMode);
  const setStorePrompt = useAppStore((s) => s.setPostCompletionPrompt);
  const setStoreResponse = useAppStore((s) => s.setPostCompletionResponse);
  const setStoreStatus = useAppStore((s) => s.setPostCompletionStatus);
  const setStoreSandboxResult = useAppStore((s) => s.setPostCompletionSandboxResult);
  const setCodebase = useAppStore((s) => s.setCodebase);
  const setExecutionResult = useAppStore((s) => s.setExecutionResult);
  const addRevision = useAppStore((s) => s.addRevision);
  const setActiveRevisionIndex = useAppStore((s) => s.setActiveRevisionIndex);
  const setGitHubModalOpen = useAppStore((s) => s.setGitHubModalOpen);

  const resolvedMode = isSSR ? (liveStore?.postCompletionMode || initialMode) : (storeMode || initialMode);
  const resolvedPrompt = isSSR ? (liveStore?.postCompletionPrompt || '') : (storePrompt || '');
  const resolvedStatus = isSSR ? (liveStore?.postCompletionStatus || '') : (storeStatus || '');
  const resolvedSandboxResult = isSSR ? (liveStore?.postCompletionSandboxResult ?? null) : storeSandboxResult;
  const resolvedResponse = isSSR ? (liveStore?.postCompletionResponse || '') : (storeResponse || '');

  // Local interactive state
  const [mode, setMode] = useState<PostCompletionMode>(resolvedMode);
  const [prompt, setPrompt] = useState<string>(resolvedPrompt);
  const [statusMessage, setStatusMessage] = useState<string>(resolvedStatus);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logsExpanded, setLogsExpanded] = useState<boolean>(false);
  const [sandboxResult, setSandboxResult] = useState<ExecutionResult | null>(resolvedSandboxResult);
  const [queryResponse, setQueryResponse] = useState<string>(resolvedResponse);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // Development cycle tracking state
  const [activePhase, setActivePhase] = useState<'codegen' | 'execution' | 'arbitration' | 'completed' | null>(null);
  const [latestCycle, setLatestCycle] = useState<{
    prompt?: string;
    summary?: string;
    modifiedFiles?: string[];
    executionResult?: ExecutionResult | null;
    criticFeedbacks?: CriticFeedback[];
    decision?: AdjudicatorDecision | null;
    postRunNum?: number;
  } | null>(null);

  const postRunRevisions = revisionHistory.filter((r) => r.isPostCompletion);
  const [selectedRevIndex, setSelectedRevIndex] = useState<number>(() => {
    return postRunRevisions.length > 0 ? postRunRevisions.length - 1 : 0;
  });

  // Sync selected revision when new post-run revisions arrive
  useEffect(() => {
    if (postRunRevisions.length > 0) {
      setSelectedRevIndex(postRunRevisions.length - 1);
    }
  }, [postRunRevisions.length]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper to switch modes
  const handleSetMode = useCallback((newMode: PostCompletionMode) => {
    setMode(newMode);
    setStoreMode(newMode);
    setStatusMessage('');
  }, [setStoreMode]);

  // Request New Product Handler (Clears current product development and resets UI for a new prompt)
  const handleRequestNewProduct = useCallback(() => {
    if (typeof window !== 'undefined' && typeof (window as any).requestNewProduct === 'function') {
      (window as any).requestNewProduct();
    } else {
      resetAllStores();
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Restart Development Handler (Re-executes development cycle from requirements with current prompt)
  const handleRestartDev = useCallback(() => {
    if (typeof window !== 'undefined' && typeof (window as any).restartDevelopment === 'function') {
      (window as any).restartDevelopment();
    } else {
      useAppStore.getState().retryDevelopment();
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Quick Action Chips
  const handleChipClick = useCallback((chipType: 'theme' | 'field' | 'bug' | 'explain') => {
    if (chipType === 'theme') {
      handleSetMode('modify');
      const text = 'Update styling with a modern dark theme, high-contrast borders, refined typography, and responsive spacing.';
      setPrompt(text);
      setStorePrompt(text);
    } else if (chipType === 'field') {
      handleSetMode('modify');
      const text = 'Add a new input field for phone number with validation, formatting helper, and updated state handling.';
      setPrompt(text);
      setStorePrompt(text);
    } else if (chipType === 'bug') {
      handleSetMode('modify');
      const text = 'Identify and fix edge-case bugs in input validation and state updates.';
      setPrompt(text);
      setStorePrompt(text);
    } else if (chipType === 'explain') {
      handleSetMode('query');
      const text = 'Explain the architecture, component interaction, and data flow of this project.';
      setPrompt(text);
      setStorePrompt(text);
    }
    textareaRef.current?.focus();
  }, [handleSetMode, setStorePrompt]);

  // Copy Query Response to Clipboard
  const handleCopyResponse = useCallback(() => {
    const text = queryResponse;
    if (!text) return;

    const onDone = () => {
      setCopyFeedback(true);
      setStatusMessage('Explanation copied to clipboard!');
      setTimeout(() => setCopyFeedback(false), 2000);
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone).catch(() => {
        fallbackCopy(text, onDone);
      });
    } else {
      fallbackCopy(text, onDone);
    }
  }, [queryResponse]);

  const fallbackCopy = (text: string, cb: () => void) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      cb();
    } catch {
      cb();
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setStatusMessage('Please enter a modification prompt or technical question.');
      return;
    }

    if (!currentCodebase || !currentCodebase.files || currentCodebase.files.length === 0) {
      setStatusMessage('No codebase available. Please generate a project first.');
      return;
    }

    setIsLoading(true);

    if (mode === 'modify') {
      setActivePhase('codegen');
      setStatusMessage('Synthesizing targeted modifications (Phase 1: Codegen)...');
      setStoreStatus('Synthesizing targeted modifications (Phase 1: Codegen)...');

      const phaseTimer1 = setTimeout(() => {
        setActivePhase('execution');
        setStatusMessage('Running sandbox verification tests (Phase 2: Execution)...');
        setStoreStatus('Running sandbox verification tests (Phase 2: Execution)...');
      }, 1500);

      const phaseTimer2 = setTimeout(() => {
        setActivePhase('arbitration');
        setStatusMessage('Evaluating quality critics & adjudication (Phase 3: Arbitration)...');
        setStoreStatus('Evaluating quality critics & adjudication (Phase 3: Arbitration)...');
      }, 4000);

      try {
        const data = await postCompletionModify({
          codebase: currentCodebase,
          blueprint: currentBlueprint,
          prompt: trimmedPrompt,
          mode: appMode,
          run_verification: true,
          requirements: storeRequirements,
        });

        clearTimeout(phaseTimer1);
        clearTimeout(phaseTimer2);

        if (!data || !data.codebase) {
          throw new Error('Modification response returned empty codebase');
        }

        const newCodebase = data.codebase;
        const execResult = data.execution_result || null;
        const criticFeedbacks = data.critic_feedbacks || [];
        const decision = data.decision || null;

        // Calculate next post-run revision number
        const postRunCount = revisionHistory.filter((r) => r.isPostCompletion).length;
        const postRunNum = postRunCount + 1;

        const snapshot: RevisionHistoryItem = {
          revisionNumber: revisionHistory.length,
          label: `Post-Run Rev ${postRunNum}`,
          timestamp: Date.now(),
          codebase: JSON.parse(JSON.stringify(newCodebase)),
          blueprint: currentBlueprint ? JSON.parse(JSON.stringify(currentBlueprint)) : null,
          executionResult: execResult ? JSON.parse(JSON.stringify(execResult)) : null,
          criticFeedbacks: criticFeedbacks,
          decision: decision,
          compositeScore: decision?.weighted_composite ?? null,
          delta: decision?.delta ?? null,
          isPostCompletion: true,
          postCompletionRevNumber: postRunNum,
          summary: data.summary,
          modifiedFiles: data.modified_files,
        };

        // Update stores
        setCodebase(newCodebase);
        if (execResult) {
          setExecutionResult(execResult);
        }
        addRevision(snapshot);
        setActiveRevisionIndex(revisionHistory.length);

        setSandboxResult(execResult);
        setStoreSandboxResult(execResult);

        setLatestCycle({
          prompt: trimmedPrompt,
          summary: data.summary,
          modifiedFiles: data.modified_files || [],
          executionResult: execResult,
          criticFeedbacks: criticFeedbacks,
          decision: decision,
          postRunNum: postRunNum,
        });
        setSelectedRevIndex(postRunCount);

        setActivePhase('completed');
        const successMsg = `Applied Post-Run Rev ${postRunNum} successfully. (${data.summary || 'Files updated'})`;
        setStatusMessage(successMsg);
        setStoreStatus(successMsg);

        persistState(true);
        onModifySuccess?.(newCodebase, execResult);

        // Hot-reload Live Preview if container visible
        if (typeof window !== 'undefined' && typeof (window as any).renderLivePreview === 'function') {
          const previewContainer = document.getElementById('previewContainer');
          if (previewContainer && !previewContainer.classList.contains('hidden')) {
            (window as any).renderLivePreview();
          }
        }
      } catch (err: any) {
        clearTimeout(phaseTimer1);
        clearTimeout(phaseTimer2);
        setActivePhase(null);
        const errorText = `Post-Completion Modify Error: ${err.message || String(err)}`;
        console.error(errorText, err);
        setStatusMessage(errorText);
        setStoreStatus(errorText);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Query mode (Streaming)
      setStatusMessage('Analyzing codebase and streaming technical explanation...');
      setStoreStatus('Analyzing codebase and streaming technical explanation...');
      setQueryResponse('Streaming technical explanation...');

      try {
        let fullText = '';
        const streamResult = await postCompletionQuery(
          {
            codebase: currentCodebase,
            blueprint: currentBlueprint,
            query: trimmedPrompt,
            mode: appMode,
          },
          {
            onChunk: (accumulated) => {
              fullText = accumulated;
              setQueryResponse(accumulated);
            },
          }
        );

        const cleanFormatted = formatMarkdownToHumanReadable(streamResult.cleanedText || fullText);
        setQueryResponse(cleanFormatted);
        setStoreResponse(cleanFormatted);
        setStatusMessage('Query response complete.');
        setStoreStatus('Query response complete.');
        persistState(false);
      } catch (err: any) {
        const errorText = `Post-Completion Query Error: ${err.message || String(err)}`;
        console.error(errorText, err);
        setStatusMessage(errorText);
        setStoreStatus(errorText);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Active post-completion revision selection
  const activeRev =
    selectedRevIndex >= 0 && selectedRevIndex < postRunRevisions.length
      ? postRunRevisions[selectedRevIndex]
      : (postRunRevisions[postRunRevisions.length - 1] ?? null);

  const currentSummary =
    latestCycle?.summary ??
    activeRev?.summary ??
    (sandboxResult ? 'Targeted code modifications applied and verified in sandbox.' : '');
  const currentModifiedFiles =
    latestCycle?.modifiedFiles ?? activeRev?.modifiedFiles ?? [];
  const currentExecResult =
    latestCycle?.executionResult ?? activeRev?.executionResult ?? sandboxResult;
  const currentCriticFeedbacks: CriticFeedback[] =
    latestCycle?.criticFeedbacks ?? activeRev?.criticFeedbacks ?? [];
  const currentDecision: AdjudicatorDecision | null =
    latestCycle?.decision ?? activeRev?.decision ?? null;
  const currentPostRunNum =
    latestCycle?.postRunNum ??
    activeRev?.postCompletionRevNumber ??
    (postRunRevisions.length > 0 ? postRunRevisions.length : 1);

  const hasCycleData = Boolean(
    currentExecResult !== null ||
    currentModifiedFiles.length > 0 ||
    currentSummary.length > 0 ||
    currentCriticFeedbacks.length > 0 ||
    currentDecision !== null
  );

  // Verdict style & text resolution
  const verdictRaw = (currentDecision?.verdict || '').toLowerCase();
  const isEarlyStop = Boolean(
    currentDecision?.early_stop ||
      (currentDecision?.delta !== null &&
        currentDecision?.delta !== undefined &&
        currentDecision.delta <= 1.0)
  );
  const composite = currentDecision?.weighted_composite ?? null;
  const isAutoPass = composite !== null && composite <= 2.0;
  const isPass = verdictRaw === 'pass' || isEarlyStop || isAutoPass;

  let headline = 'EVALUATING...';
  let stripColor = 'bg-slate-600';
  let textColor = 'text-slate-300';

  if (currentDecision) {
    if (isPass) {
      if (isEarlyStop) {
        headline = 'APPROVED (EARLY STOP)';
      } else if (isAutoPass && verdictRaw !== 'pass') {
        headline = 'APPROVED (AUTO-PASS)';
      } else {
        headline = 'APPROVED';
      }
      stripColor = 'bg-emerald-500';
      textColor = 'text-emerald-400';
    } else if (verdictRaw === 'revise') {
      headline = 'REVISION REQUIRED';
      stripColor = 'bg-orange-500';
      textColor = 'text-orange-400';
    } else if (verdictRaw === 'error') {
      headline = 'FAILED (TERMINAL)';
      stripColor = 'bg-red-500';
      textColor = 'text-red-400';
    } else {
      headline = currentDecision.verdict.toUpperCase();
      stripColor = 'bg-cyan-500';
      textColor = 'text-cyan-400';
    }
  }

  return (
    <div
      id="postCompletionSection"
      className={`bg-slate-900 rounded-xl shadow-md border border-slate-800 p-6 fade-in space-y-5 transition-all duration-200 ${className}`}
    >
      {/* Endscreen Development Gantt Chart & Timeline Metrics */}
      <DevelopmentGanttChart className="mb-2" />

      {/* Header & Mode Toggle Row */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-200 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              <SparklesIcon className="w-3.5 h-3.5" />
            </span>
            <span>Post-Completion Control Plane</span>
          </h3>
          <p id="postCompHelperText" className="text-xs text-slate-400 font-medium mt-1">
            {mode === 'modify' ? (
              <>
                <WrenchScrewdriverIcon className="w-3.5 h-3.5 text-blue-400 inline mr-1" />
                <span className="font-semibold text-slate-300">Modify Code:</span> Full development cycle with targeted edits, sandbox test execution, critics arbitration, and Live Preview sync.
              </>
            ) : (
              <>
                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-indigo-400 inline mr-1" />
                <span className="font-semibold text-slate-300">Ask Query:</span> Ask technical questions, explain architecture, or clarify code behavior without mutating files.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Upload to GitHub Button */}
          <button
            type="button"
            id="postCompUploadGithubBtn"
            onClick={() => setGitHubModalOpen(true)}
            title="Upload finalized codebase to GitHub"
            className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white text-xs font-semibold rounded-full border border-indigo-500/40 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ArrowUpTrayIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span>Upload to GitHub</span>
          </button>

          {/* Restart Development Button */}
          <button
            type="button"
            id="postCompRestartDevBtn"
            onClick={handleRestartDev}
            title="Restart development of current feature request"
            className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 text-xs font-semibold rounded-full border border-amber-500/30 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ArrowPathIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>Restart Development</span>
          </button>

          {/* Request New Product Button */}
          <button
            type="button"
            id="postCompRequestNewProductBtn"
            onClick={handleRequestNewProduct}
            title="Clear all generated artifacts and start fresh with a new product"
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-full border border-slate-700 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ArrowPathIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Request New Product</span>
          </button>

          {/* Mode Toggle Pill (#postCompModeToggle) */}
          <div
            id="postCompModeToggle"
            role="radiogroup"
            aria-label="Post-Completion Mode"
            className="inline-flex bg-slate-950 p-1 rounded-full border border-slate-700 shadow-inner shrink-0"
          >
            <button
              type="button"
              id="postCompToggleModify"
              onClick={() => handleSetMode('modify')}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-200 flex items-center gap-1.5 focus:outline-none ${
                mode === 'modify'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <WrenchScrewdriverIcon className="w-3.5 h-3.5" />
              <span>Modify Code</span>
            </button>

            <button
              type="button"
              id="postCompToggleQuery"
              onClick={() => handleSetMode('query')}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-200 flex items-center gap-1.5 focus:outline-none ${
                mode === 'query'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
              <span>Ask Query</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
          Quick Actions:
        </span>
        <button
          type="button"
          id="chipTheme"
          onClick={() => handleChipClick('theme')}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded-full font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
        >
          <PaintBrushIcon className="w-3.5 h-3.5 text-amber-400" />
          <span>Theme change</span>
        </button>
        <button
          type="button"
          id="chipField"
          onClick={() => handleChipClick('field')}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded-full font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
        >
          <PlusIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>Add field</span>
        </button>
        <button
          type="button"
          id="chipBug"
          onClick={() => handleChipClick('bug')}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded-full font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
        >
          <BugAntIcon className="w-3.5 h-3.5 text-rose-400" />
          <span>Fix bug</span>
        </button>
        <button
          type="button"
          id="chipExplain"
          onClick={() => handleChipClick('explain')}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded-full font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
        >
          <LightBulbIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Explain project</span>
        </button>
      </div>

      {/* Prompt Input Textarea (#postCompletionPrompt) */}
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          id="postCompletionPrompt"
          rows={3}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setStorePrompt(e.target.value);
          }}
          disabled={isLoading}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-sans resize-y"
          placeholder={
            mode === 'modify'
              ? 'Describe styling changes, feature additions, or bug fixes to apply to the codebase...'
              : 'Ask any technical question about the architecture, components, or APIs...'
          }
        />
      </div>

      {/* Submission Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div id="postCompStatusMessage" className="text-xs text-slate-400 flex items-center gap-2">
          {statusMessage}
        </div>

        <button
          type="button"
          id="postCompletionSubmitBtn"
          onClick={handleSubmit}
          disabled={isLoading || !prompt.trim()}
          className={`font-semibold px-6 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === 'modify'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          <span id="postCompSubmitBtnText">
            {isLoading
              ? (mode === 'modify' ? 'Applying Development Cycle...' : 'Analyzing Codebase...')
              : (mode === 'modify' ? 'Apply Modifications' : 'Submit Query')}
          </span>

          <svg
            id="postCompSpinner"
            className={`animate-spin h-4 w-4 ${isLoading ? 'inline' : 'hidden'}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* Complete Development Cycle View (Modify Mode) (#postCompDevCycle)     */}
      {/* ===================================================================== */}
      {(isLoading || hasCycleData) && mode === 'modify' && (
        <div
          id="postCompDevCycle"
          className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 space-y-5 shadow-inner mt-4"
        >
          {/* Header Row: Title & Revision Tabs */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pb-3 border-b border-slate-800 gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                <CpuChipIcon className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-200">
                  Feature & Fix Development Cycle
                </h4>
                <p className="text-xs text-slate-400">
                  {isLoading
                    ? 'Multi-phase synthesis, sandbox verification, and arbitration in progress...'
                    : `Complete development pipeline for ${activeRev?.label || `Post-Run Rev ${currentPostRunNum}`}`}
                </p>
              </div>
            </div>

            {/* Post-Run Revision Tabs */}
            {postRunRevisions.length > 1 && (
              <div id="postCompRevTabs" className="flex gap-1.5 flex-wrap">
                {postRunRevisions.map((rev, idx) => {
                  const isSelected = selectedRevIndex === idx;
                  return (
                    <button
                      key={rev.revisionNumber}
                      type="button"
                      onClick={() => setSelectedRevIndex(idx)}
                      className={`text-xs font-mono px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600/20 text-blue-300 border-blue-500 font-bold shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {rev.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4-Phase Stepper Tracker (#postCompStepper) */}
          <div id="postCompStepper" className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            {/* Step 1: Codegen */}
            <div
              className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                activePhase === 'codegen'
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                  : (activePhase || hasCycleData)
                  ? 'bg-slate-900 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900/50 border-slate-800 text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                1
              </span>
              <span className="truncate">1. Codegen</span>
              {activePhase === 'codegen' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping ml-auto" />}
              {(activePhase === 'completed' || (!isLoading && hasCycleData)) && (
                <CheckIcon className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" />
              )}
            </div>

            {/* Step 2: Sandbox Execution */}
            <div
              className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                activePhase === 'execution'
                  ? 'bg-purple-500/10 border-purple-500/40 text-purple-300'
                  : (activePhase === 'arbitration' || activePhase === 'completed' || (!isLoading && currentExecResult))
                  ? 'bg-slate-900 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900/50 border-slate-800 text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                2
              </span>
              <span className="truncate">2. Execution</span>
              {activePhase === 'execution' && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping ml-auto" />}
              {(activePhase === 'completed' || (!isLoading && currentExecResult)) && (
                <CheckIcon className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" />
              )}
            </div>

            {/* Step 3: Arbitration & Critics */}
            <div
              className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                activePhase === 'arbitration'
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                  : (activePhase === 'completed' || (!isLoading && (currentDecision || currentCriticFeedbacks.length > 0)))
                  ? 'bg-slate-900 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900/50 border-slate-800 text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-rose-600/30 text-rose-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                3
              </span>
              <span className="truncate">3. Arbitration</span>
              {activePhase === 'arbitration' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping ml-auto" />}
              {(activePhase === 'completed' || (!isLoading && (currentDecision || currentCriticFeedbacks.length > 0))) && (
                <CheckIcon className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" />
              )}
            </div>

            {/* Step 4: Snapshot */}
            <div
              className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                activePhase === 'completed' || (!isLoading && hasCycleData)
                  ? 'bg-slate-900 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900/50 border-slate-800 text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-emerald-600/30 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                4
              </span>
              <span className="truncate">4. Snapshot</span>
              {(activePhase === 'completed' || (!isLoading && hasCycleData)) && (
                <CheckIcon className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" />
              )}
            </div>
          </div>

          {/* Phase 1: Targeted Code Generation & Refactor Card (#postCompCodegenCard) */}
          {(currentSummary || currentModifiedFiles.length > 0 || (isLoading && activePhase === 'codegen')) && (
            <div
              id="postCompCodegenCard"
              className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </span>
                  <h5 className="font-bold text-slate-200 text-xs sm:text-sm">
                    Phase 1: Targeted Code Generation & Refactor
                  </h5>
                </div>
                <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {isLoading && activePhase === 'codegen' ? 'Synthesizing...' : 'Completed'}
                </span>
              </div>

              {currentSummary && (
                <div className="bg-black/40 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                    Refactor Summary:
                  </div>
                  <p className="text-slate-300 text-xs font-mono leading-relaxed">
                    {currentSummary}
                  </p>
                </div>
              )}

              {currentModifiedFiles && currentModifiedFiles.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Modified Files ({currentModifiedFiles.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentModifiedFiles.map((file, fIdx) => (
                      <span
                        key={fIdx}
                        className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/80 text-cyan-300 shadow-sm"
                      >
                        <CodeBracketIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{file}</span>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 ml-1">
                          [MODIFIED]
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase 2: Sandbox Verification Output Card (#postCompSandboxCard) */}
          {(currentExecResult || (isLoading && activePhase === 'execution')) && (
            <div
              id="postCompSandboxCard"
              className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </span>
                  <h5 className="font-bold text-slate-200 text-xs sm:text-sm">
                    Phase 2: Sandbox Build & Test Execution
                  </h5>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    id="postCompVerifyBadge"
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border flex items-center gap-1 ${
                      currentExecResult?.success
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : currentExecResult
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {currentExecResult?.success ? (
                      <>
                        <ShieldCheckIcon className="w-3.5 h-3.5" />
                        <span>PASSED</span>
                      </>
                    ) : currentExecResult ? (
                      <>
                        <XCircleIcon className="w-3.5 h-3.5" />
                        <span>FAILED</span>
                      </>
                    ) : (
                      <span>EXECUTING...</span>
                    )}
                  </span>

                  <button
                    type="button"
                    id="postCompToggleLogsBtn"
                    onClick={() => setLogsExpanded(!logsExpanded)}
                    className="text-xs text-slate-400 hover:text-slate-200 underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{logsExpanded ? 'Hide Execution Logs' : 'View Execution Logs'}</span>
                    {logsExpanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div
                id="postCompLogsContainer"
                className={`${logsExpanded ? 'block' : 'hidden'} bg-black p-3 rounded-lg border border-slate-800 max-h-56 overflow-y-auto`}
              >
                <pre>
                  <code
                    id="postCompLogsOutput"
                    className="text-xs text-slate-300 font-mono whitespace-pre-wrap block"
                  >
                    {currentExecResult?.logs || 'No execution logs available.'}
                  </code>
                </pre>
              </div>
            </div>
          )}

          {/* Phase 3: Arbitration Engine Card (#postCompArbitrationCard) */}
          {(currentDecision || (currentCriticFeedbacks && currentCriticFeedbacks.length > 0) || (isLoading && activePhase === 'arbitration')) && (
            <div
              id="postCompArbitrationCard"
              className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </span>
                  <h5 className="font-bold text-slate-200 text-xs sm:text-sm">
                    Phase 3: Arbitration Engine & Critic Feedback
                  </h5>
                </div>
                <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {isLoading && activePhase === 'arbitration' ? 'Evaluating...' : 'Evaluated'}
                </span>
              </div>

              {/* Critic Cards Grid (#postCompCriticCards) */}
              <div id="postCompCriticCards" className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {currentCriticFeedbacks.map((fb, idx) => {
                  const score = fb.severity_score;
                  const badge = getSeverityBadge(score);
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5 truncate">
                          {score <= 2 ? (
                            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : score <= 5 ? (
                            <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <XCircleIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                          <span className="truncate">{fb.critic_name}</span>
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>

                      {fb.overall_comments && (
                        <p className="text-[11px] text-slate-300 italic leading-relaxed line-clamp-3">
                          "{fb.overall_comments}"
                        </p>
                      )}

                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Issues:
                        </div>
                        {fb.issues_list && fb.issues_list.length > 0 ? (
                          <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-0.5 font-mono">
                            {fb.issues_list.slice(0, 3).map((issue, issueIdx) => (
                              <li key={issueIdx} className="truncate">
                                {issue}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-medium">
                            No issues found.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Master Adjudicator Decision Box (#postCompVerdictBox) */}
              {currentDecision && (
                <div
                  id="postCompVerdictBox"
                  className="p-4 bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden space-y-3"
                >
                  <div
                    id="postCompVerdictStrip"
                    className={`absolute top-0 left-0 w-1.5 h-full ${stripColor}`}
                  />

                  <div className="flex justify-between items-center border-b border-slate-800 pb-2 pl-2">
                    <span className="text-xs uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1.5">
                      <ScaleIcon className="w-4 h-4 text-indigo-400" />
                      <span>Master Adjudicator Verdict</span>
                    </span>
                    <span
                      id="postCompVerdictText"
                      className={`font-black text-sm tracking-tight ${textColor}`}
                    >
                      {headline}
                    </span>
                  </div>

                  {composite !== null && composite !== undefined && (
                    <div className="flex items-center gap-4 text-xs font-mono pl-2 text-slate-400">
                      <span>Composite Score: <strong className="text-slate-200">{`${composite.toFixed(1)} / 10.0`}</strong></span>
                      <span className="text-[10px] text-slate-500">(Correctness 50%, Arch 20%, Comp 30%)</span>
                    </div>
                  )}

                  <div
                    id="postCompVerdictReasoning"
                    className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono bg-black/40 p-3 rounded-lg border border-slate-800/80 ml-2"
                  >
                    {currentDecision.revision_plan || (isPass ? 'All quality gates passed. Modifications approved.' : 'No revision plan provided.')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase 4: Revision Snapshot & Live Preview Card (#postCompSnapshotCard) */}
          {(hasCycleData || activeRev) && (
            <div
              id="postCompSnapshotCard"
              className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                    4
                  </span>
                  <h5 className="font-bold text-slate-200 text-xs sm:text-sm">
                    Phase 4: Revision Snapshot & Live Preview
                  </h5>
                </div>
                <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckIcon className="w-3 h-3 text-emerald-400" />
                  <span>Snapshotted</span>
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 p-3 rounded-lg border border-slate-800/80 text-xs">
                <div>
                  <span className="font-mono font-bold text-emerald-400 mr-2">
                    Post-Run Rev {currentPostRunNum}
                  </span>
                  <span className="text-slate-300">
                    Codebase updated in Monaco Editor. Live Preview hot-reload synced.
                  </span>
                </div>

                <button
                  type="button"
                  id="postCompReloadPreviewBtn"
                  onClick={() => {
                    if (typeof window !== 'undefined' && typeof (window as any).renderLivePreview === 'function') {
                      (window as any).renderLivePreview();
                      setStatusMessage('Live Preview hot-reloaded.');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  <span>Hot-Reload Live Preview</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Technical Q&A Streaming Output Box (Query Mode) (#postCompQueryResponseBox) */}
      {queryResponse && mode === 'query' && (
        <div
          id="postCompQueryResponseBox"
          className="bg-white dark:bg-slate-950 p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative group overflow-y-auto max-h-[600px] fade-in space-y-3"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                READ-ONLY TECHNICAL EXPLANATION
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyResponse}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm border border-indigo-200 dark:border-indigo-800/40"
            >
              {copyFeedback ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                  <span>Copy Text</span>
                </>
              )}
            </button>
          </div>

          <div
            id="postCompQueryOutput"
            className="w-full min-h-[160px] text-slate-800 dark:text-slate-200 text-xs sm:text-sm focus:outline-none leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-black/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800/80 cursor-default select-text font-mono"
          >
            {queryResponse}
          </div>
        </div>
      )}
    </div>
  );
}
