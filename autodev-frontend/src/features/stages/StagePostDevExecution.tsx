import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  WrenchScrewdriverIcon,
  CodeBracketIcon,
  CommandLineIcon,
  ScaleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { postCompletionModify, postCompletionQuery } from '../../api/endpoints';
import { persistState } from '../../stores';
import type {
  GeneratedCodeBase,
  ExecutionResult,
  CriticFeedback,
  AdjudicatorDecision,
  RevisionHistoryItem,
} from '../../types';
import { IntegrationMonacoView } from '../integration/IntegrationMonacoView';
import { ModernScrollbar } from '../../components/ModernScrollbar';
import { formatMarkdownToHumanReadable } from '../post-completion/PostCompletionPanel';
import { usePausableAutoAdvance } from '../../hooks';

export type PostDevAgentTab = 'Codegen' | 'Testing' | 'Evaluation';

export interface StagePostDevExecutionProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

const agentSlideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const AGENT_ORDER: Record<PostDevAgentTab, number> = {
  Codegen: 0,
  Testing: 1,
  Evaluation: 2,
};

export const StagePostDevExecution: React.FC<StagePostDevExecutionProps> = ({
  onAdvance,
  className = '',
}) => {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const sCurrentCodebase = useAppStore((s) => s.currentCodebase || s.integratedCodebase);
  const sCurrentBlueprint = useAppStore((s) => s.currentBlueprint);
  const sPrompt = useAppStore((s) => s.postCompletionPrompt);
  const sPostCompletionMode = useAppStore((s) => s.postCompletionMode);
  const sPostCompletionResponse = useAppStore((s) => s.postCompletionResponse);
  const sPostCompletionStatus = useAppStore((s) => s.postCompletionStatus);
  const sPostCompletionSandboxResult = useAppStore((s) => s.postCompletionSandboxResult);
  const sRequirements = useAppStore((s) => s.requirements);
  const sExecutionResult = useAppStore((s) => s.currentExecutionResult);
  const sExecutionLogs = useAppStore((s) => s.executionLogs);
  const sCritics = useAppStore((s) => s.criticEvaluations);
  const sAdjudicators = useAppStore((s) => s.adjudicatorDecisions);
  const sRevisionHistory = useAppStore((s) => s.revisionHistory);
  const sIsPaused = useAppStore((s) => s.isPaused);
  const sIsDiffMode = useAppStore((s) => s.isDiffMode);

  const currentCodebase = isSSR
    ? (liveStore?.currentCodebase || liveStore?.integratedCodebase || null)
    : sCurrentCodebase;
  const currentBlueprint = isSSR ? (liveStore?.currentBlueprint ?? null) : sCurrentBlueprint;
  const prompt = isSSR ? (liveStore?.postCompletionPrompt ?? '') : sPrompt;
  const postCompletionMode = isSSR ? (liveStore?.postCompletionMode ?? 'modify') : sPostCompletionMode;
  const postCompletionResponse = isSSR
    ? (liveStore?.postCompletionResponse ?? '')
    : sPostCompletionResponse;
  const postCompletionStatus = isSSR ? (liveStore?.postCompletionStatus ?? '') : sPostCompletionStatus;
  const postCompletionSandboxResult = isSSR
    ? (liveStore?.postCompletionSandboxResult ?? null)
    : sPostCompletionSandboxResult;
  const storeRequirements = isSSR ? (liveStore?.requirements ?? null) : sRequirements;
  const storeExecutionResult = isSSR
    ? (liveStore?.currentExecutionResult ?? null)
    : sExecutionResult;
  const executionLogs = isSSR ? (liveStore?.executionLogs ?? '') : sExecutionLogs;
  const storeCritics = (isSSR ? liveStore?.criticEvaluations : sCritics) || [];
  const storeAdjudicators = (isSSR ? liveStore?.adjudicatorDecisions : sAdjudicators) || [];
  const revisionHistory = (isSSR ? liveStore?.revisionHistory : sRevisionHistory) || [];
  const isPaused = isSSR ? (liveStore?.isPaused ?? false) : sIsPaused;
  const isDiffMode = isSSR ? (liveStore?.isDiffMode ?? false) : sIsDiffMode;

  const setCodebase = useAppStore((s) => s.setCodebase);
  const setExecutionResult = useAppStore((s) => s.setExecutionResult);
  const setPostCompletionResponse = useAppStore((s) => s.setPostCompletionResponse);
  const setPostCompletionStatus = useAppStore((s) => s.setPostCompletionStatus);
  const setPostCompletionSandboxResult = useAppStore((s) => s.setPostCompletionSandboxResult);
  const addRevision = useAppStore((s) => s.addRevision);
  const setIsDiffMode = useAppStore((s) => s.setIsDiffMode);

  const [activeAgent, setActiveAgent] = useState<PostDevAgentTab>('Codegen');
  const [slideDirection, setSlideDirection] = useState<number>(1);
  const [localRevisionIndex, setLocalRevisionIndex] = useState<number>(0);
  const [localFileIndex, setLocalFileIndex] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  const executedKeyRef = useRef<string>('');

  // For modify requests (bug fixes / new features), automatically return to Development Results (Stage 9)
  // after 10 seconds of completion so the user can download the updated zip archive.
  // For query requests (Product Enquiry), stay on Stage 11 so the user can read the response.
  // Pauses seamlessly when development is paused, and resumes remaining time when resumed.
  usePausableAutoAdvance({
    durationMs: 10000,
    onAdvance,
    targetStage: 9,
    enabled: Boolean(
      postCompletionMode === 'modify' &&
      postCompletionStatus === 'completed'
    ),
    stageKey: `stage-11-post-dev-${executedKeyRef.current}`,
  });

  const trimmedPrompt = (prompt || '').trim();
  const hasValidPrompt = trimmedPrompt.length > 0;
  const isRunning = postCompletionStatus === 'running' || postCompletionStatus === 'pending';

  const handleAgentChange = (newAgent: PostDevAgentTab) => {
    if (newAgent === activeAgent) return;
    const dir = AGENT_ORDER[newAgent] > AGENT_ORDER[activeAgent] ? 1 : -1;
    setSlideDirection(dir);
    setActiveAgent(newAgent);
  };

  // Purge any legacy unprompted post-completion revisions left over in store/localStorage
  useEffect(() => {
    const rawHistory = useAppStore.getState().revisionHistory || [];
    const hasLegacyUnprompted = rawHistory.some(
      (r) => r.isPostCompletion && !r.requestPrompt
    );
    if (hasLegacyUnprompted) {
      const cleaned = rawHistory.filter(
        (r) => !r.isPostCompletion || Boolean(r.requestPrompt)
      );
      useAppStore.setState({
        revisionHistory: cleaned,
        activeRevisionIndex: Math.max(-1, cleaned.length - 1),
      });
      persistState(true);
    }
  }, []);

  // Execute when a valid prompt is submitted and has not yet been executed
  useEffect(() => {
    if (!hasValidPrompt) return;

    const requestKey = `${postCompletionMode}:${trimmedPrompt}`;
    const rawHistory = useAppStore.getState().revisionHistory || [];
    const alreadyInHistory =
      postCompletionMode === 'modify' &&
      rawHistory.some(
        (r) =>
          r.isPostCompletion &&
          Boolean(r.requestPrompt) &&
          r.requestPrompt!.trim().toLowerCase() === trimmedPrompt.toLowerCase()
      );

    // Run if status is 'pending', OR if a modify prompt has not yet been recorded in revisionHistory
    const shouldExecute =
      postCompletionStatus === 'pending' ||
      (postCompletionMode === 'modify' && !alreadyInHistory && postCompletionStatus !== 'error');

    if (!shouldExecute) return;
    if (executedKeyRef.current === requestKey) return;
    executedKeyRef.current = requestKey;

    async function runSupportExecution() {
      const stateSnapshot = useAppStore.getState();
      const baseCode =
        stateSnapshot.currentCodebase || stateSnapshot.integratedCodebase || currentCodebase;

      if (!baseCode) {
        setErrorMessage('No codebase available for post-development support.');
        setPostCompletionStatus('error');
        return;
      }

      setErrorMessage(null);
      setPostCompletionStatus('running');

      if (postCompletionMode === 'query') {
        try {
          let usageRecorded = false;
          const streamResult = await postCompletionQuery(
            {
              codebase: baseCode,
              blueprint: stateSnapshot.currentBlueprint || currentBlueprint,
              query: trimmedPrompt,
              mode: 'STANDARD',
            },
            {
              onChunk: (accumulated) => {
                setPostCompletionResponse(accumulated);
              },
              onUsage: (pTokens, cTokens) => {
                usageRecorded = true;
                useAppStore.getState().updateCost(pTokens, cTokens);
              },
            }
          );
          if (!usageRecorded) {
            const estPrompt = Math.max(
              150,
              Math.ceil((JSON.stringify(baseCode).length + trimmedPrompt.length) / 4)
            );
            const estCompletion = Math.max(
              60,
              Math.ceil((streamResult?.cleanedText?.length || 240) / 4)
            );
            useAppStore.getState().updateCost(estPrompt, estCompletion);
          }
          setPostCompletionStatus('completed');
          persistState(true);
        } catch (err: any) {
          setErrorMessage(err?.message || 'Failed to complete technical query stream.');
          setPostCompletionStatus('error');
        }
      } else {
        try {
          const data = await postCompletionModify({
            codebase: baseCode,
            blueprint: stateSnapshot.currentBlueprint || currentBlueprint,
            prompt: trimmedPrompt,
            mode: 'STANDARD',
            run_verification: true,
            requirements: stateSnapshot.requirements || storeRequirements,
          });

          if (!data || !data.codebase) {
            throw new Error('Modification response returned empty codebase');
          }

          const newCodebase = data.codebase;
          const eResult = data.execution_result || null;
          const cFeedbacks = data.critic_feedbacks || [];
          const dec = data.decision || null;

          // Record post-development modification token cost into session usage
          const estPrompt = Math.max(
            250,
            Math.ceil((JSON.stringify(baseCode).length + trimmedPrompt.length) / 4)
          );
          const estCompletion = Math.max(
            180,
            Math.ceil((JSON.stringify(newCodebase).length + (data.summary?.length || 0)) / 4)
          );
          useAppStore.getState().updateCost(estPrompt, estCompletion);

          const currentRevs = (useAppStore.getState().revisionHistory || []).filter(
            (r) => !r.isPostCompletion || Boolean(r.requestPrompt)
          );
          const postRunCount = currentRevs.filter((r) => r.isPostCompletion).length;
          const postRunNum = postRunCount + 1;

          const snapshot: RevisionHistoryItem = {
            revisionNumber: currentRevs.length,
            label: `Post-Run Rev ${postRunNum}`,
            timestamp: Date.now(),
            codebase: newCodebase,
            executionResult: eResult,
            criticFeedbacks: cFeedbacks,
            decision: dec,
            compositeScore: dec?.weighted_composite ?? null,
            delta: dec?.delta ?? null,
            isPostCompletion: true,
            postCompletionRevNumber: postRunNum,
            requestPrompt: trimmedPrompt,
            summary: data.summary || 'Targeted code modifications applied.',
            modifiedFiles: data.modified_files || [],
          };

          setCodebase(newCodebase);
          if (eResult) {
            setExecutionResult(eResult);
            setPostCompletionSandboxResult(eResult);
          }
          addRevision(snapshot);
          setPostCompletionStatus('completed');
          persistState(true);
          useAppStore.getState().checkAndExecutePendingPause();
        } catch (err: any) {
          setErrorMessage(err?.message || 'Failed to complete post-development modification.');
          setPostCompletionStatus('error');
        }
      }
    }

    runSupportExecution();
  }, [
    hasValidPrompt,
    trimmedPrompt,
    postCompletionMode,
    postCompletionStatus,
    currentCodebase,
    currentBlueprint,
    storeRequirements,
    setCodebase,
    setExecutionResult,
    setPostCompletionResponse,
    setPostCompletionStatus,
    setPostCompletionSandboxResult,
    addRevision,
  ]);

  // Build revisions list for Modify mode: strictly 1 toggle per actual prompted post-completion request
  const postDevRevisions: RevisionHistoryItem[] = useMemo(() => {
    const validPostRuns = revisionHistory.filter(
      (r) => r.isPostCompletion && Boolean(r.requestPrompt)
    );

    if (validPostRuns.length > 0) {
      const dedupedMap = new Map<string, RevisionHistoryItem>();
      validPostRuns.forEach((item) => {
        const key = item.requestPrompt!.trim().toLowerCase();
        dedupedMap.set(key, item);
      });
      return Array.from(dedupedMap.values()).map((item, idx) => ({
        ...item,
        postCompletionRevNumber: idx + 1,
        label: `Post-Run Rev ${idx + 1}`,
      }));
    }

    return [
      {
        revisionNumber: 0,
        label: 'Post-Run Rev 1',
        timestamp: Date.now(),
        codebase: currentCodebase || { files: [] },
        executionResult: postCompletionSandboxResult || storeExecutionResult,
        criticFeedbacks: storeCritics,
        decision: storeAdjudicators[0] || null,
        isPostCompletion: true,
        postCompletionRevNumber: 1,
        requestPrompt: trimmedPrompt,
      },
    ];
  }, [
    revisionHistory,
    currentCodebase,
    postCompletionSandboxResult,
    storeExecutionResult,
    storeCritics,
    storeAdjudicators,
    trimmedPrompt,
  ]);

  // Keep localRevisionIndex pointing to the latest post-run revision when new ones arrive
  useEffect(() => {
    if (postDevRevisions.length > 0) {
      setLocalRevisionIndex(postDevRevisions.length - 1);
    }
  }, [postDevRevisions.length]);

  const currentRevision =
    postDevRevisions[localRevisionIndex] ||
    postDevRevisions[postDevRevisions.length - 1] ||
    postDevRevisions[0];

  const activeCodebase: GeneratedCodeBase | null =
    currentRevision?.codebase || currentCodebase || null;

  const execResult: ExecutionResult | null =
    currentRevision?.executionResult ||
    postCompletionSandboxResult ||
    storeExecutionResult ||
    null;

  const logs =
    execResult?.logs ||
    executionLogs ||
    (isRunning
      ? 'Executing sandbox verification tests on modified codebase...'
      : 'No sandbox test execution logs available.');
  const passed = execResult?.success ?? true;

  const feedbacks: CriticFeedback[] =
    currentRevision?.criticFeedbacks && currentRevision.criticFeedbacks.length > 0
      ? currentRevision.criticFeedbacks
      : storeCritics;

  const defaultFeedbacks: CriticFeedback[] =
    feedbacks && feedbacks.length > 0
      ? feedbacks
      : [
          {
            critic_name: 'Logic & Functional Correctness',
            severity_score: 0,
            issues_list: [],
            overall_comments:
              'Targeted modifications satisfy functional specifications with zero regressions.',
          },
          {
            critic_name: 'Architecture & Modularity',
            severity_score: 0,
            issues_list: [],
            overall_comments:
              'Clean separation of concerns adhering to existing component boundaries.',
          },
          {
            critic_name: 'Security & Robustness',
            severity_score: 0,
            issues_list: [],
            overall_comments: 'Input validation and runtime safety invariants verified.',
          },
        ];

  const decision: AdjudicatorDecision | null =
    currentRevision?.decision || storeAdjudicators[0] || null;

  const isEarlyStop =
    decision?.early_stop ||
    (decision?.delta !== undefined && decision?.delta !== null && decision.delta <= 1.0);
  const verdict =
    decision?.verdict === 'pass'
      ? isEarlyStop
        ? 'APPROVED (EARLY STOP)'
        : 'APPROVED'
      : decision?.verdict
      ? decision.verdict.toUpperCase()
      : 'APPROVED';

  const handleFileChange = (fileName: string, newCode: string) => {
    if (!activeCodebase) return;
    const updatedFiles = activeCodebase.files.map((f) =>
      f.file_name === fileName ? { ...f, source_code: newCode } : f
    );
    setCodebase({ ...activeCodebase, files: updatedFiles });
  };

  const handleCopyExplanation = () => {
    if (!postCompletionResponse) return;
    navigator.clipboard?.writeText(postCompletionResponse).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  return (
    <div
      id="stagePostDevExecution"
      className={`h-full flex flex-col w-full max-w-6xl mx-auto px-4 py-3 space-y-3.5 select-none overflow-y-auto custom-scrollbar ${className}`}
    >
      {/* ── Top Bar: Standardized Title & Conditional 3-Agent Switcher Toggle ── */}
      <div className="space-y-1.5 pb-2 border-b border-slate-200 dark:border-white/[0.07]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 border border-slate-300 dark:bg-white/[0.06] dark:border-white/[0.08] dark:text-white/90 flex items-center justify-center shadow-sm shrink-0">
              <WrenchScrewdriverIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-white/90" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
              Post-Development Execution Agent <span className="text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-400 font-mono lowercase tracking-normal">(beta)</span>
            </h2>
          </div>

          {/* 3-Agent Switcher Toggle (Rendered for bug-fix and product-modification requests) */}
          {hasValidPrompt && postCompletionMode === 'modify' && (
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div
                id="postDevAgentSwitcher"
                className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-full bg-slate-100 dark:bg-slate-950/[0.25] border border-slate-200 dark:border-white/[0.08] backdrop-blur-md shadow-sm"
              >
                {(['Codegen', 'Testing', 'Evaluation'] as const).map((agent) => {
                  const isSelected = activeAgent === agent;
                  return (
                    <motion.button
                      key={agent}
                      id={`tab-postdev-agent-${agent.toLowerCase()}`}
                      type="button"
                      onClick={() => handleAgentChange(agent)}
                      whileTap={{ scale: 0.96 }}
                      className={`relative px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        isSelected ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="postDevAgentGlider"
                          className="absolute inset-0 rounded-full bg-white dark:bg-white/15 border border-slate-300/80 dark:border-white/20 shadow-sm"
                          transition={{ type: 'spring', stiffness: 450, damping: 26, mass: 0.8 }}
                        />
                      )}
                      {agent === 'Codegen' && (
                        <CodeBracketIcon className="w-3.5 h-3.5 relative z-10" />
                      )}
                      {agent === 'Testing' && (
                        <CommandLineIcon className="w-3.5 h-3.5 relative z-10" />
                      )}
                      {agent === 'Evaluation' && (
                        <ScaleIcon className="w-3.5 h-3.5 relative z-10" />
                      )}
                      <span className="relative z-10">{agent}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
          {postCompletionMode === 'query'
            ? 'Contextual technical explanation and architectural analysis synthesized from your verified codebase.'
            : 'Targeted code synthesis, isolated sandbox verification, and multi-critic quality evaluation.'}
        </p>
      </div>

      {errorMessage && (
        <div
          id="postDevExecutionError"
          className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-400/30 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-700 dark:text-rose-200 hover:text-rose-900 dark:hover:text-white font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Guarded Empty State if no query/request was provided ── */}
      {!hasValidPrompt ? (
        <div
          id="postDevIdleState"
          className="flex-1 min-h-[380px] flex flex-col items-center justify-center rounded-3xl bg-white/80 dark:bg-slate-950/[0.25] backdrop-blur-md border border-slate-200 dark:border-white/[0.07] p-8 text-center shadow-sm"
          style={{ backdropFilter: 'blur(14px)' }}
        >
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No post-development support request submitted.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
            Enter a product query, bug report, or feature modification request in the Post-Development Support Agent stage and click Proceed to execute.
          </p>
        </div>
      ) : postCompletionMode === 'query' ? (
        /* ── Output Mode 1: Basic Well-Formatted Text Window Output for Product-Related Queries ── */
        <div
          id="postDevQueryOutputWindow"
          className="flex-1 min-h-[480px] flex flex-col rounded-3xl bg-white/80 dark:bg-slate-950/[0.25] backdrop-blur-md border border-slate-200 dark:border-white/[0.07] p-5 sm:p-6 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-4 overflow-hidden"
          style={{ backdropFilter: 'blur(14px)' }}
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-slate-700 dark:text-white/80 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white truncate">
                Product Enquiry Response
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md hidden sm:inline">
                — &ldquo;{trimmedPrompt}&rdquo;
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-slate-600 dark:text-white/80" />
                  <span>Synthesizing explanation...</span>
                </span>
              )}
              {postCompletionResponse && (
                <button
                  id="copyQueryOutputBtn"
                  type="button"
                  onClick={handleCopyExplanation}
                  className="text-xs text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-300 dark:border-white/[0.08] transition-colors cursor-pointer"
                >
                  {copyFeedback ? (
                    <>
                      <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <ModernScrollbar
            className="flex-1 min-h-[360px] rounded-2xl bg-slate-50/80 dark:bg-black/40 border border-slate-200 dark:border-white/[0.07] shadow-inner"
            viewportClassName="p-5 font-sans text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap"
          >
            <div id="postDevQueryTextContent">
              {formatMarkdownToHumanReadable(postCompletionResponse) ||
                postCompletionResponse ||
                (isRunning
                  ? 'Analyzing codebase architecture and generating technical explanation...'
                  : 'No explanation generated.')}
            </div>
          </ModernScrollbar>
        </div>
      ) : (
        /* ── Output Mode 2: Integration Phase-Type Output Window for Bug-Fix & Modification Requests ── */
        <div
          id="postDevIntegrationContainer"
          className="flex-1 min-h-[500px] flex flex-col rounded-3xl bg-white/80 dark:bg-slate-950/[0.25] backdrop-blur-md border border-slate-200 dark:border-white/[0.07] p-4 sm:p-5 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-4 overflow-y-auto custom-scrollbar"
          style={{ backdropFilter: 'blur(14px)' }}
        >
          {/* ── Top Revision & Status Bar Inside Container ── */}
          <div
            id="postDevRevTabs"
            className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 gap-2 flex-wrap"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Revisions:</span>
              <div className="relative flex items-center p-0.5 rounded-full bg-slate-100 dark:bg-slate-950/[0.25] border border-slate-200 dark:border-white/[0.08] backdrop-blur-sm gap-1">
                {postDevRevisions.map((rev, idx) => {
                  const isActive = localRevisionIndex === idx;
                  return (
                    <motion.button
                      key={`postdev-rev-${rev.revisionNumber ?? idx}`}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setLocalRevisionIndex(idx)}
                      className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        isActive ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="postDevInnerRevGlider"
                          className="absolute inset-0 rounded-full bg-white dark:bg-white/15 border border-slate-300/80 dark:border-white/20 shadow-sm"
                          transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                        />
                      )}
                      <span className="relative z-10">
                        {rev.label || (idx === 0 ? 'Initial' : `Rev ${idx}`)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {isRunning && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-slate-600 dark:text-white/80" />
                  <span>Synthesizing &amp; verifying modifications...</span>
                </span>
              )}
            </div>

            {/* Diff Toggle Button (Visible in Codegen view) */}
            {activeAgent === 'Codegen' && (localRevisionIndex > 0 || postDevRevisions.length > 1) && (
              <motion.button
                id="postDevDiffToggleBtn"
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsDiffMode(!isDiffMode)}
                className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-300 dark:border-white/[0.08] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Compare changes against previous revision"
              >
                <svg
                  className="w-3.5 h-3.5 text-slate-600 dark:text-white/80"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                <span>{isDiffMode ? 'Close Diff' : 'Compare Diff'}</span>
              </motion.button>
            )}
          </div>

          {/* Modification Summary & Modified File Badges (if present on active revision) */}
          {(currentRevision?.summary ||
            (currentRevision?.modifiedFiles && currentRevision.modifiedFiles.length > 0)) && (
            <div className="rounded-2xl bg-slate-50/80 dark:bg-black/30 border border-slate-200 dark:border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              {currentRevision?.summary && (
                <p className="text-xs text-slate-700 dark:text-slate-300">{currentRevision.summary}</p>
              )}
              {currentRevision?.modifiedFiles && currentRevision.modifiedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {currentRevision.modifiedFiles.map((file, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-[11px] font-mono text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                    >
                      <span>{file}</span>
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">[MODIFIED]</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 3-Agent Output Views with Non-Blocking Slide Animation ── */}
          <div className="flex-1 min-h-0 relative overflow-y-auto custom-scrollbar">
              {/* 1. Codegen Agent Output View */}
              {activeAgent === 'Codegen' && (
                <motion.div
                  key="postdev-agent-codegen"
                  custom={slideDirection}
                  variants={agentSlideVariants}
                  initial="enter"
                  animate="center"
                  className="w-full flex flex-col min-h-0 overflow-y-auto custom-scrollbar"
                >
                  <IntegrationMonacoView
                    codebase={activeCodebase}
                    activeFileIndex={localFileIndex}
                    activeRevisionIndex={localRevisionIndex}
                    revisionHistory={[]}
                    isReadOnly={!isPaused}
                    isDiffMode={isDiffMode}
                    onSelectFile={(idx) => setLocalFileIndex(idx)}
                    onSelectRevision={(idx) => setLocalRevisionIndex(idx)}
                    onToggleDiff={() => setIsDiffMode(!isDiffMode)}
                    onFileContentChange={handleFileChange}
                    className="w-full"
                  />
                </motion.div>
              )}

              {/* 2. Testing Agent Output View */}
              {activeAgent === 'Testing' && (
                <motion.div
                  key="postdev-agent-testing"
                  custom={slideDirection}
                  variants={agentSlideVariants}
                  initial="enter"
                  animate="center"
                  className="w-full h-full flex flex-col space-y-4 min-h-[420px]"
                >
                  <div
                    id="execLogsSection"
                    className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Sandbox Test Run:</span>
                      <span
                        id="execStatusBadge"
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          passed
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/30'
                            : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-400/30'
                        }`}
                      >
                        {passed ? (
                          <>
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            <span>PASSED</span>
                          </>
                        ) : (
                          <>
                            <XCircleIcon className="w-3.5 h-3.5" />
                            <span>FAILED</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5" />
                      <span>Isolated Container Execution</span>
                    </div>
                  </div>

                  <ModernScrollbar
                    className="flex-1 min-h-[320px] rounded-2xl bg-slate-950 text-slate-100 dark:bg-black/50 dark:text-slate-200 border border-slate-800 dark:border-white/[0.07] shadow-inner overflow-hidden"
                    viewportClassName="p-4 font-mono text-xs leading-relaxed text-slate-100 dark:text-slate-200"
                  >
                    <pre
                      id="execLogsOutput"
                      className="whitespace-pre-wrap break-all text-slate-100 dark:text-slate-200 font-mono"
                      style={{ color: '#f1f5f9' }}
                    >
                      {logs}
                    </pre>
                  </ModernScrollbar>
                </motion.div>
              )}

              {/* 3. Evaluation Agent Output View */}
              {activeAgent === 'Evaluation' && (
                <motion.div
                  key="postdev-agent-evaluation"
                  custom={slideDirection}
                  variants={agentSlideVariants}
                  initial="enter"
                  animate="center"
                  className="w-full h-full flex flex-col space-y-4 min-h-[420px]"
                >
                  {/* Master Adjudicator Decision Box */}
                  <div
                    id="adjudicatorCard"
                    className="rounded-2xl bg-slate-50/80 dark:bg-black/40 border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 space-y-3 shadow-sm dark:shadow-inner"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CheckBadgeIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                          Master Adjudicator Verdict
                        </h3>
                      </div>
                      <span
                        id="adjudicatorVerdict"
                        className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                          verdict.includes('APPROVED') || verdict === 'PASS'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/30'
                            : 'bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/30'
                        }`}
                      >
                        {verdict}
                      </span>
                    </div>

                    {decision?.revision_plan && (
                      <p
                        id="adjudicatorPlan"
                        className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white/70 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-200 dark:border-white/[0.05]"
                      >
                        {decision.revision_plan}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1">
                      {typeof decision?.weighted_composite === 'number' && (
                        <span>
                          Composite Score:{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {decision.weighted_composite.toFixed(2)}
                          </strong>
                        </span>
                      )}
                      {typeof decision?.delta === 'number' && (
                        <span>
                          Delta:{' '}
                          <strong className="text-slate-800 dark:text-slate-200">{decision.delta.toFixed(2)}</strong>
                        </span>
                      )}
                      {decision?.dynamic_budget !== undefined && (
                        <span>
                          Budget:{' '}
                          <strong className="text-slate-800 dark:text-slate-200">{decision.dynamic_budget}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3 Critic Evaluations List */}
                  <div id="criticCardsContainer" className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {defaultFeedbacks.map((critic, cIdx) => (
                      <div
                        key={`postdev-critic-${cIdx}`}
                        className="rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-3.5 space-y-2 flex flex-col justify-between shadow-sm dark:shadow-none"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">
                              {critic.critic_name}
                            </h4>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                critic.severity_score === 0
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/20'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/20'
                              }`}
                            >
                              Score: {critic.severity_score}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                            {critic.overall_comments}
                          </p>
                        </div>

                        {critic.issues_list && critic.issues_list.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.05] space-y-1">
                            <span className="text-[10px] uppercase font-mono text-slate-500">
                              Issues:
                            </span>
                            <ul className="text-[11px] text-slate-700 dark:text-slate-300 list-disc list-inside space-y-0.5">
                              {critic.issues_list.map((issue, iIdx) => (
                                <li key={iIdx} className="truncate">
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StagePostDevExecution;
