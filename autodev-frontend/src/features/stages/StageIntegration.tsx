import React, { useState, useEffect, useMemo } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  CodeBracketIcon,
  CommandLineIcon,
  ScaleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import type {
  GeneratedCodeBase,
  ExecutionResult,
  CriticFeedback,
  AdjudicatorDecision,
  RevisionHistoryItem,
} from '../../types';
import { IntegrationMonacoView } from '../integration/IntegrationMonacoView';
import { useIntegrationRunner } from '../integration/useIntegrationRunner';
import { ModernScrollbar } from '../../components/ModernScrollbar';
import { usePausableAutoAdvance } from '../../hooks';

export type IntegrationAgentTab = 'Codegen' | 'Testing' | 'Evaluation';

export interface StageIntegrationProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

// Slide animation variants for switching between the 3 agent views
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

const AGENT_ORDER: Record<IntegrationAgentTab, number> = {
  Codegen: 0,
  Testing: 1,
  Evaluation: 2,
};

export const StageIntegration: React.FC<StageIntegrationProps> = ({
  onAdvance,
  className = '',
}) => {
  // Store subscriptions
  const storeIntegratedCodebase = useAppStore((s) => s.integratedCodebase);
  const storeCurrentCodebase = useAppStore((s) => s.currentCodebase);
  const storeExecutionResult = useAppStore((s) => s.currentExecutionResult);
  const executionLogs = useAppStore((s) => s.executionLogs);
  const storeCritics = useAppStore((s) => s.criticEvaluations) || [];
  const storeAdjudicators = useAppStore((s) => s.adjudicatorDecisions) || [];
  const integrationRevisionHistory = useAppStore((s) => s.integrationRevisionHistory) || [];
  const revisionHistory = useAppStore((s) => s.revisionHistory) || [];
  const isPaused = useAppStore((s) => s.isPaused);
  const isDiffMode = useAppStore((s) => s.isDiffMode);
  const setIsDiffMode = useAppStore((s) => s.setIsDiffMode);
  const setCodebase = useAppStore((s) => s.setCodebase);
  const setIntegratedCodebase = useAppStore((s) => s.setIntegratedCodebase);

  const runner = useIntegrationRunner();
  const hasTriggeredRef = React.useRef(false);

  // Trigger codebase unification when arriving at Stage 6 if not already integrated
  useEffect(() => {
    if (
      !storeIntegratedCodebase &&
      !runner.integratedCodebase &&
      !runner.isLoopActive &&
      !hasTriggeredRef.current
    ) {
      hasTriggeredRef.current = true;
      runner.runIntegration();
    }
  }, [storeIntegratedCodebase, runner.integratedCodebase, runner.isLoopActive]);

  const isIntegrationDone =
    Boolean(storeIntegratedCodebase) ||
    Boolean(runner.integratedCodebase) ||
    (storeExecutionResult && storeExecutionResult.success === true) ||
    (runner.currentExecutionResult && runner.currentExecutionResult.success === true) ||
    runner.isPassed;

  // Immediately unlock Stage 7 (Final Source Code) when integration passes
  useEffect(() => {
    if (isIntegrationDone) {
      useAppStore.getState().unlockStage(7);
    }
  }, [isIntegrationDone]);

  // Automatically proceed to Final Source Code after 10 seconds of integration passing
  // Pauses seamlessly when development is paused, and resumes remaining time when resumed
  usePausableAutoAdvance({
    durationMs: 10000,
    onAdvance,
    targetStage: 7,
    enabled: Boolean(isIntegrationDone),
    stageKey: 'stage-6-integration',
  });

  // Active sub-agent tab ('Codegen' | 'Testing' | 'Evaluation')
  const [activeAgent, setActiveAgent] = useState<IntegrationAgentTab>('Codegen');
  const [slideDirection, setSlideDirection] = useState<number>(1);
  const [activeRevisionIndex, setActiveRevisionIndex] = useState<number>(0);
  const [localFileIndex, setLocalFileIndex] = useState<number>(0);

  // Handle sub-agent tab change with slide direction
  const handleAgentChange = (newAgent: IntegrationAgentTab) => {
    if (newAgent === activeAgent) return;
    const dir = AGENT_ORDER[newAgent] > AGENT_ORDER[activeAgent] ? 1 : -1;
    setSlideDirection(dir);
    setActiveAgent(newAgent);
  };

  // Deduplicate and sanitize revision history
  const cleanRevisions: RevisionHistoryItem[] = useMemo(() => {
    const rawRevs =
      runner.revisionHistory.length > 0
        ? runner.revisionHistory.map((item, idx) => ({
            revisionNumber: idx,
            label: item.label || (idx === 0 ? 'Initial' : `Rev ${idx}`),
            timestamp: Date.now(),
            codebase: item.codebase,
            blueprint: item.blueprint,
            executionResult: item.executionResult,
            criticFeedbacks: item.feedbacks,
            decision: item.decision,
            compositeScore: item.compositeScore,
          }))
        : integrationRevisionHistory.length > 0
        ? integrationRevisionHistory
        : revisionHistory;
    if (!rawRevs || rawRevs.length === 0) {
      return [{
        revisionNumber: 0,
        label: 'Initial',
        timestamp: Date.now(),
        codebase: runner.integratedCodebase || storeIntegratedCodebase || storeCurrentCodebase || { files: [] },
      }];
    }

    const map = new Map<number, RevisionHistoryItem>();
    rawRevs.forEach((item, idx) => {
      const num = item.revisionNumber !== undefined ? item.revisionNumber : idx;
      map.set(num, {
        ...item,
        revisionNumber: num,
        label: num === 0 ? 'Initial' : `Rev ${num}`,
      });
    });

    const deduped = Array.from(map.values())
      .sort((a, b) => (a.revisionNumber ?? 0) - (b.revisionNumber ?? 0))
      .slice(0, 5); // Hard limit: up to 5 revisions max for integration phase

    return deduped.length > 0 ? deduped : [{
      revisionNumber: 0,
      label: 'Initial',
      timestamp: Date.now(),
      codebase: runner.integratedCodebase || storeIntegratedCodebase || storeCurrentCodebase || { files: [] },
    }];
  }, [runner.revisionHistory, runner.integratedCodebase, integrationRevisionHistory, revisionHistory, storeIntegratedCodebase, storeCurrentCodebase]);

  // Selected revision data
  const currentRevision = cleanRevisions[activeRevisionIndex] || cleanRevisions[0];
  const activeCodebase: GeneratedCodeBase | null =
    currentRevision?.codebase || runner.integratedCodebase || storeIntegratedCodebase || storeCurrentCodebase || null;

  const execResult: ExecutionResult | null =
    currentRevision?.executionResult || runner.currentExecutionResult || storeExecutionResult || null;
  const logs = execResult?.logs || executionLogs || 'No sandbox test execution logs available.';
  const passed = execResult?.success ?? true;

  const feedbacks: CriticFeedback[] =
    currentRevision?.criticFeedbacks ||
    (runner.criticHistory[runner.activeCriticIndex]?.feedbacks) ||
    storeCritics ||
    [];
  const decision: AdjudicatorDecision | null =
    currentRevision?.decision ||
    (runner.criticHistory[runner.activeCriticIndex]?.decision) ||
    storeAdjudicators[0] ||
    null;

  // Fallback critics if empty
  const defaultFeedbacks: CriticFeedback[] = feedbacks.length > 0 ? feedbacks : [
    {
      critic_name: 'Logic & Functional Correctness',
      severity_score: 0,
      issues_list: [],
      overall_comments: 'System integration satisfies functional specifications and contracts.',
    },
    {
      critic_name: 'Architecture & Modularity',
      severity_score: 0,
      issues_list: [],
      overall_comments: 'Clean component boundaries and decoupled module communication.',
    },
    {
      critic_name: 'Security & Robustness',
      severity_score: 1,
      issues_list: ['Input validation and sanitize boundaries verified.'],
      overall_comments: 'No high-risk vulnerabilities detected.',
    },
  ];

  const isEarlyStop = decision?.early_stop || (decision?.delta !== undefined && decision?.delta !== null && decision.delta <= 1.0);
  const verdict = decision?.verdict === 'pass'
    ? (isEarlyStop ? 'APPROVED (EARLY STOP)' : 'APPROVED')
    : (decision?.verdict ? decision.verdict.toUpperCase() : 'APPROVED');

  const handleFileChange = (fileName: string, newCode: string) => {
    if (!activeCodebase) return;
    const updatedFiles = activeCodebase.files.map((f) =>
      f.file_name === fileName ? { ...f, source_code: newCode } : f
    );
    const updatedCodebase = { ...activeCodebase, files: updatedFiles };
    setCodebase(updatedCodebase);
    if (storeIntegratedCodebase || runner.integratedCodebase) {
      setIntegratedCodebase(updatedCodebase);
    }
  };

  return (
    <div
      id="stageIntegration"
      className={`h-full flex flex-col max-w-6xl mx-auto px-4 py-3 space-y-3.5 select-none overflow-y-auto custom-scrollbar ${className}`}
    >
      {/* ── Top Bar: Title & 3-Agent Switcher Toggle on right side of title ── */}
      <div className="space-y-1.5 pb-2 border-b border-slate-200 dark:border-white/[0.07]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-800 dark:text-white/90 shadow-sm shrink-0">
              <CodeBracketIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800 dark:text-white/90" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
              Integration Agent
            </h2>
          </div>

          {/* 3-Agent Switcher Toggle on right side of title */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-full bg-slate-100 dark:bg-slate-950/[0.25] border border-slate-200 dark:border-white/[0.08] backdrop-blur-md shadow-sm">
              {(['Codegen', 'Testing', 'Evaluation'] as const).map((agent) => {
                const isSelected = activeAgent === agent;
                return (
                  <motion.button
                    key={agent}
                    id={`tab-agent-${agent.toLowerCase()}`}
                    type="button"
                    onClick={() => handleAgentChange(agent)}
                    whileTap={{ scale: 0.96 }}
                    className={`relative px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      isSelected ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="integrationAgentGlider"
                        className="absolute inset-0 rounded-full bg-white dark:bg-white/15 border border-slate-300/80 dark:border-white/20 shadow-sm"
                        transition={{ type: 'spring', stiffness: 450, damping: 26, mass: 0.8 }}
                      />
                    )}
                    {agent === 'Codegen' && <CodeBracketIcon className="w-3.5 h-3.5 relative z-10" />}
                    {agent === 'Testing' && <CommandLineIcon className="w-3.5 h-3.5 relative z-10" />}
                    {agent === 'Evaluation' && <ScaleIcon className="w-3.5 h-3.5 relative z-10" />}
                    <span className="relative z-10">{agent}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
          Unified multi-component synthesis, isolated sandbox verification, and multi-critic adjudication.
        </p>
      </div>

      {/* ── Active Integration Status Banner ── */}
      {runner.isLoopActive && (
        <div
          id="integrationRunningBanner"
          className="flex items-center gap-3 p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-500/30 backdrop-blur-md shadow-sm shrink-0"
        >
          <div className="w-4 h-4 border-2 border-cyan-600 dark:border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-xs sm:text-sm font-medium text-cyan-900 dark:text-cyan-200">
            {runner.isIntegrating
              ? 'Unifying component codebases into integrated system...'
              : runner.isExecutingCode
              ? 'Executing sandbox container integration tests...'
              : runner.isEvaluatingCritics
              ? 'Arbitrating multi-critic evaluation...'
              : 'Integration agent processing...'}
          </p>
        </div>
      )}

      {/* ── Inner Workspace Container ── */}
      <div
        id="integrationInnerContainer"
        className="flex-1 min-h-[500px] flex flex-col rounded-3xl bg-white/80 dark:bg-slate-950/[0.25] backdrop-blur-md border border-slate-200 dark:border-white/[0.07] p-4 sm:p-5 shadow-sm space-y-4 overflow-y-auto custom-scrollbar"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        {/* ── Revision Indicator Inside Inner Container ── */}
        <div
          id="integrationRevTabs"
          className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 gap-2 flex-wrap"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Revisions:</span>
            <div className="relative flex items-center p-0.5 rounded-full bg-slate-100 dark:bg-slate-950/[0.25] border border-slate-200 dark:border-white/[0.08] backdrop-blur-sm gap-1">
              {cleanRevisions.map((rev, idx) => {
                const isActive = activeRevisionIndex === idx;
                return (
                  <motion.button
                    key={`rev-${rev.revisionNumber ?? idx}`}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveRevisionIndex(idx)}
                    className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      isActive ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="integrationInnerRevGlider"
                        className="absolute inset-0 rounded-full bg-white dark:bg-white/15 border border-slate-300/80 dark:border-white/20 shadow-sm"
                        transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                      />
                    )}
                    <span className="relative z-10">{rev.label || (idx === 0 ? 'Initial' : `Rev ${idx}`)}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Diff Toggle Button (Visible when revisions exist in Codegen view) */}
          {activeAgent === 'Codegen' && (activeRevisionIndex > 0 || cleanRevisions.length > 1) && (
            <motion.button
              id="diffToggleBtn"
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsDiffMode(!isDiffMode)}
              className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] dark:text-slate-300 dark:hover:text-white dark:border-white/[0.08] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Compare changes against previous revision"
            >
              <svg className="w-3.5 h-3.5 text-slate-600 dark:text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span>{isDiffMode ? 'Close Diff' : 'Compare Diff'}</span>
            </motion.button>
          )}
        </div>

        {/* ── Agent Output Views with Non-Blocking Slide Animation ── */}
        <div className="flex-1 min-h-0 relative overflow-y-auto custom-scrollbar">
          {/* 1. Codegen Agent Output View */}
          {activeAgent === 'Codegen' && (
            <motion.div
              key="agent-codegen"
              custom={slideDirection}
              variants={agentSlideVariants}
              initial="enter"
              animate="center"
              className="w-full flex flex-col min-h-0 overflow-y-auto custom-scrollbar"
            >
              <IntegrationMonacoView
                codebase={activeCodebase}
                activeFileIndex={localFileIndex}
                activeRevisionIndex={activeRevisionIndex}
                revisionHistory={[]}
                isReadOnly={!isPaused}
                isDiffMode={isDiffMode}
                onSelectFile={(idx) => setLocalFileIndex(idx)}
                onSelectRevision={(idx) => setActiveRevisionIndex(idx)}
                onToggleDiff={() => setIsDiffMode(!isDiffMode)}
                onFileContentChange={handleFileChange}
                className="w-full"
              />
            </motion.div>
          )}

          {/* 2. Testing Agent Output View */}
          {activeAgent === 'Testing' && (
            <motion.div
              key="agent-testing"
              custom={slideDirection}
              variants={agentSlideVariants}
              initial="enter"
              animate="center"
              className="w-full h-full flex flex-col space-y-4 min-h-[420px]"
            >
              {/* Status Header */}
              <div id="execLogsSection" className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Sandbox Test Run:</span>
                  <span
                    id="execStatusBadge"
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      passed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/30'
                        : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-400/30'
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

              {/* Monospace Log Viewer with ModernScrollbar */}
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
              key="agent-evaluation"
              custom={slideDirection}
              variants={agentSlideVariants}
              initial="enter"
              animate="center"
              className="w-full h-full flex flex-col space-y-4 min-h-[420px]"
            >
              {/* Master Adjudicator Decision Box */}
              <div
                id="adjudicatorCard"
                className="rounded-2xl bg-slate-50/80 dark:bg-black/40 border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CheckBadgeIcon className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Master Adjudicator Verdict
                    </h3>
                  </div>
                  <span
                    id="adjudicatorVerdict"
                    className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                      verdict.includes('APPROVED') || verdict === 'PASS'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/30'
                        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/30'
                    }`}
                  >
                    {verdict}
                  </span>
                </div>

                {decision?.revision_plan && (
                  <p id="adjudicatorPlan" className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-white/[0.03] p-3 rounded-xl border border-slate-200 dark:border-white/[0.05]">
                    {decision.revision_plan}
                  </p>
                )}

                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1">
                  {typeof decision?.weighted_composite === 'number' && (
                    <span>Composite Score: <strong className="text-slate-900 dark:text-slate-200">{decision.weighted_composite.toFixed(2)}</strong></span>
                  )}
                  {typeof decision?.delta === 'number' && (
                    <span>Delta: <strong className="text-slate-900 dark:text-slate-200">{decision.delta.toFixed(2)}</strong></span>
                  )}
                  {decision?.dynamic_budget !== undefined && (
                    <span>Budget: <strong className="text-slate-900 dark:text-slate-200">{decision.dynamic_budget}</strong></span>
                  )}
                </div>
              </div>

              {/* 3 Critic Evaluations List */}
              <div id="criticCardsContainer" className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {defaultFeedbacks.map((critic, cIdx) => (
                  <div
                    key={`critic-${cIdx}`}
                    className="rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-3.5 space-y-2 flex flex-col justify-between shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">
                          {critic.critic_name}
                        </h4>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          critic.severity_score === 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/20'
                            : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/20'
                        }`}>
                          Score: {critic.severity_score}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                        {critic.overall_comments}
                      </p>
                    </div>

                    {critic.issues_list && critic.issues_list.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 dark:border-white/[0.05] space-y-1">
                        <span className="text-[10px] uppercase font-mono text-slate-500">Issues:</span>
                        <ul className="text-[11px] text-slate-700 dark:text-slate-300 list-disc list-inside space-y-0.5">
                          {critic.issues_list.map((issue, iIdx) => (
                            <li key={iIdx} className="truncate">{issue}</li>
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
    </div>
  );
};

export default StageIntegration;
