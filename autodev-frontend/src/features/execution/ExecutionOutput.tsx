/**
 * AutoDev Execution Output Island Component
 * 
 * Implements Milestone 3 R1:
 * - Matches #execOutputSection container
 * - Displays Test Execution Results header with Phase 2c badge
 * - Status badge #execStatusBadge: "Tests Passed" (emerald) or "Tests Failed" (rose)
 * - Coverage badge #covBadge: extracts pytest/jest coverage via regex TOTAL\s+\d+\s+\d+\s+(\d+%)
 * - Execution logs display in #execLogsOutput with auto-scroll and font-mono styling
 * - Transition button #criticBtn ("Execute SYS.ARBITRATION (v1.3.0)") with loading spinner #criticSpinner
 * - Auto-advances in QUICK mode or triggers 30s countdown in COMPLEX mode
 * - Bound to Zustand stores (useAppStore, useSessionStore) and supports prop overrides / SSR
 */

import { useMemo } from 'react';
import {
  CommandLineIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { ModernScrollbar } from '../../components/ModernScrollbar';
import type { ExecutionResult } from '../../types';

export interface ExecutionOutputProps {
  executionResult?: ExecutionResult | null;
  logs?: string;
  isRunning?: boolean;
  onRunCritics?: () => void;
  className?: string;
}

/**
 * Extracts test coverage percentage from raw test logs using standard pytest / coverage.py format.
 * Matches: TOTAL <stmts> <miss> <cov%>
 */
export function extractCoveragePercentage(logs: string | null | undefined): string | null {
  if (!logs) return null;
  const match = logs.match(/TOTAL\s+\d+\s+\d+\s+(\d+%)/);
  return match && match[1] ? match[1] : null;
}

export function ExecutionOutput({
  executionResult: propResult,
  logs: propLogs,
  isRunning: propIsRunning,
  onRunCritics,
  className = '',
}: ExecutionOutputProps) {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // Zustand bindings
  const storeExecutionResult = useAppStore((s) => s.currentExecutionResult);
  const storeExecutionLogs = useAppStore((s) => s.executionLogs);
  const storeInFlightPhase = useAppStore((s) => s.inFlightPhase);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);

  // Countdown state
  const countdown = useSessionStore((s) => s.countdown);

  // Resolved values
  const currentExecutionResult = propResult !== undefined
    ? propResult
    : (isSSR ? (liveStore?.currentExecutionResult ?? storeExecutionResult) : storeExecutionResult);
  
  const logs = propLogs !== undefined
    ? propLogs
    : (currentExecutionResult?.logs || (isSSR ? (liveStore?.executionLogs ?? storeExecutionLogs) : storeExecutionLogs) || '');

  const inFlightPhase = isSSR ? (liveStore?.inFlightPhase ?? storeInFlightPhase) : storeInFlightPhase;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? storePipelineStatus) : storePipelineStatus;

  const isEvaluatingCritics = inFlightPhase === 'single_critics';
  const isExecuting = propIsRunning ?? (inFlightPhase === 'single_execution');

  // Determine coverage
  const coveragePercent = useMemo(() => extractCoveragePercentage(logs), [logs]);

  // Visibility: visible if execution result or logs exist, or if actively executing
  const isVisible = Boolean(
    currentExecutionResult !== null ||
    logs.length > 0 ||
    isExecuting ||
    isEvaluatingCritics
  );

  if (!isVisible) {
    return null;
  }

  const isSuccess = currentExecutionResult ? currentExecutionResult.success : false;

  return (
    <div
      id="execOutputSection"
      className={`rounded-3xl bg-white/80 dark:bg-slate-950/[0.25] backdrop-blur-md border border-slate-200 dark:border-white/[0.07] shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] p-6 fade-in transition-all duration-200 ${className}`}
      style={{ backdropFilter: 'blur(14px)' }}
    >
      {/* Header with Title and Badges */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h2 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-base sm:text-lg">
          <span className="bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white border border-slate-300 dark:border-white/20 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
            2c
          </span>
          <span>Test Execution Results</span>
        </h2>

        <div className="flex items-center gap-2">
          {/* Coverage Badge (#covBadge) */}
          {coveragePercent && (
            <span
              id="covBadge"
              className="px-3 py-1 text-xs sm:text-sm rounded-full font-medium border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 flex items-center gap-1.5"
            >
              <ShieldCheckIcon className="w-3.5 h-3.5" />
              <span>{`Coverage: ${coveragePercent}`}</span>
            </span>
          )}

          {/* Status Badge (#execStatusBadge) */}
          {currentExecutionResult && (
            <span
              id="execStatusBadge"
              className={`px-3 py-1 text-xs sm:text-sm rounded-full font-semibold border flex items-center gap-1.5 ${
                isSuccess
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
                  : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30'
              }`}
            >
              {isSuccess ? (
                <>
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  <span>Tests Passed</span>
                </>
              ) : (
                <>
                  <XCircleIcon className="w-3.5 h-3.5" />
                  <span>Tests Failed</span>
                </>
              )}
            </span>
          )}

          {isExecuting && !currentExecutionResult && (
            <span className="px-3 py-1 text-xs sm:text-sm rounded-full font-medium border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Running Sandbox Tests...</span>
            </span>
          )}
        </div>
      </div>

      {/* Execution Logs Terminal Block (#execLogsOutput) */}
      <ModernScrollbar className="bg-slate-950 dark:bg-black/25 backdrop-blur-md rounded-2xl border border-slate-800 dark:border-white/[0.07] max-h-96 shadow-inner mb-6 overflow-hidden" viewportClassName="p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-400 border-b border-slate-800 dark:border-white/[0.07] pb-2 mb-2 font-mono">
          <span className="flex items-center gap-1.5">
            <CommandLineIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>docker://autodev-sandbox/stdout</span>
          </span>
          <span>{logs.length} bytes</span>
        </div>
        <pre className="m-0 p-0">
          <code
            id="execLogsOutput"
            className="text-slate-100 dark:text-slate-200 text-xs sm:text-sm block whitespace-pre-wrap font-mono leading-relaxed"
            style={{ color: '#f1f5f9' }}
          >
            {logs || (isExecuting ? 'Starting container and executing sandbox test commands...' : 'No logs produced.')}
          </code>
        </pre>
      </ModernScrollbar>

      {/* Phase 3 Action Transition Button (#criticBtn) */}
      <div className="border-t border-slate-200 dark:border-white/[0.07] pt-5">
        <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mb-3 text-center">
          Execution complete. Invoke the parallel Arbitration Engine.
        </p>

        <button
          id="criticBtn"
          type="button"
          onClick={onRunCritics}
          disabled={isEvaluatingCritics || isExecuting || pipelineStatus === 'aborted'}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/20 dark:text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
        >
          <span>
            {countdown.isRunning && (countdown.targetAction === 'critics' || countdown.targetAction === 'criticBtn')
              ? `Execute SYS.ARBITRATION (${countdown.remainingSeconds}s)`
              : 'Execute SYS.ARBITRATION (v1.3.0)'}
          </span>

          <svg
            id="criticSpinner"
            className={`animate-spin h-4 w-4 ${isEvaluatingCritics ? 'inline' : 'hidden'}`}
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

          {!isEvaluatingCritics && <ArrowRightIcon className="w-4 h-4 ml-1" />}
        </button>
      </div>
    </div>
  );
}
