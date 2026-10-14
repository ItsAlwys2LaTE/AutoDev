/**
 * AutoDev Component Critic Tabs & Arbitration Display
 *
 * Implements Milestone 2 R2:
 * - Revision / Critic evaluation history tabs matching #critic-tabs-${cId} (and #rev-tabs-${cId})
 * - Docker sandbox execution logs view matching #exec-logs-${cId}
 * - Critic severity cards matching #critic-cards-${cId}
 * - Master Adjudicator decision box matching #verdict-box-${cId}
 *   (#verdict-strip, #verdict-text, #verdict-reasoning)
 */

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline';
import type {
  ExecutionResult,
  CriticFeedback,
  AdjudicatorDecision,
} from '../../types';
import { ModernScrollbar } from '../../components/ModernScrollbar';

export interface CriticHistoryEntry {
  exec?: ExecutionResult | null;
  feedbacks?: CriticFeedback[];
  decision?: AdjudicatorDecision | null;
  loading?: boolean;
  error?: string;
}

export interface ComponentCriticTabsProps {
  componentId: string;
  criticHistory?: CriticHistoryEntry[];
  activeCriticIndex?: number;
  onSelectCriticTab?: (index: number) => void;
  // Fallbacks if history array not provided
  currentExecResult?: ExecutionResult | null;
  currentFeedbacks?: CriticFeedback[];
  currentDecision?: AdjudicatorDecision | null;
  isMaxRevisions?: boolean;
  className?: string;
}

export function ComponentCriticTabs({
  componentId,
  criticHistory = [],
  activeCriticIndex = 0,
  onSelectCriticTab,
  currentExecResult,
  currentFeedbacks = [],
  currentDecision,
  isMaxRevisions = false,
  className = '',
}: ComponentCriticTabsProps) {
  // Determine current active item from history or fallbacks
  const activeEntry = criticHistory[activeCriticIndex];
  const exec = activeEntry?.exec ?? currentExecResult;
  const feedbacks = activeEntry?.feedbacks ?? currentFeedbacks;
  const decision = activeEntry?.decision ?? currentDecision;
  const isLoading = activeEntry?.loading;
  const entryError = activeEntry?.error;

  // Verdict style & text resolution
  const verdictRaw = (decision?.verdict || '').toLowerCase();
  const isEarlyStop = Boolean(
    decision?.early_stop ||
      (decision?.delta !== null &&
        decision?.delta !== undefined &&
        decision.delta <= 1.0)
  );
  const composite = decision?.weighted_composite ?? null;
  const isAutoPass = composite !== null && composite <= 2.0;
  const isPass = verdictRaw === 'pass' || isEarlyStop || isAutoPass;

  let headline = 'EVALUATING...';
  let stripColor = 'bg-slate-600';
  let textColor = 'text-slate-300';

  if (decision) {
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
      if (isMaxRevisions) {
        headline = 'MAX REVISIONS REACHED';
        stripColor = 'bg-rose-500';
        textColor = 'text-rose-400';
      } else {
        headline = 'REVISION REQUIRED';
        stripColor = 'bg-orange-500';
        textColor = 'text-orange-400';
      }
    } else if (verdictRaw === 'error') {
      headline = 'FAILED (TERMINAL)';
      stripColor = 'bg-red-500';
      textColor = 'text-red-400';
    } else {
      headline = decision.verdict.toUpperCase();
      stripColor = 'bg-white/60';
      textColor = 'text-slate-200';
    }
  }

  // Critic severity badge styling
  const getSeverityBadge = (score: number) => {
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
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ── Critic Evaluation History Tabs ──────────────────────────────────── */}
      {criticHistory.length > 0 && (
        <div id={`critic-tabs-${componentId}`} className="flex gap-1.5 mb-4 flex-wrap">
          {criticHistory.map((_, idx) => {
            const isActive = idx === activeCriticIndex;
            const tabLabel = idx === 0 ? 'Initial Eval' : `Rev ${idx} Eval`;
            return (
              <button
                key={idx}
                id={`critic-tab-${componentId}-${idx}`}
                type="button"
                onClick={() => onSelectCriticTab?.(idx)}
                className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white/15 text-white border border-white/20 font-semibold shadow-sm'
                    : 'bg-white/[0.04] text-slate-400 border border-white/[0.07] hover:bg-white/[0.08] hover:text-slate-200'
                }`}
              >
                {tabLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Execution Logs View ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
            <span>Execution Logs</span>
          </h5>
          <span className="text-[11px] font-mono text-slate-500">
            {exec ? (exec.success ? 'passed (exit 0)' : 'failed (exit 1)') : 'sandbox runtime'}
          </span>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/[0.3] backdrop-blur-md overflow-hidden shadow-inner">
          <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="w-2 h-2 rounded-full bg-white/10" />
              <span className="w-2 h-2 rounded-full bg-white/10" />
              <span className="font-mono text-xs text-slate-400 ml-1">sandbox.log</span>
            </div>
          </div>
          <ModernScrollbar className="h-48 w-full">
            <div className="p-4">
              <pre
                id={`exec-logs-${componentId}`}
                className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-text"
              >
                {isLoading
                  ? 'Executing sandbox tests in container...'
                  : exec?.logs || 'No execution logs recorded yet.'}
              </pre>
            </div>
          </ModernScrollbar>
        </div>
      </div>

      {/* ── Critic Severity Cards ───────────────────────────────────────────── */}
      <div>
        <h5 className="text-xs uppercase font-bold text-slate-400 mb-2 tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
          <span>Critic Reports</span>
        </h5>

        <ModernScrollbar
          id={`critic-cards-${componentId}`}
          className="max-h-72 w-full pr-1"
          viewportClassName="grid grid-cols-1 gap-3"
        >
          {entryError ? (
            <div className="p-4 bg-rose-950/40 border border-rose-800/50 rounded-2xl text-rose-300 text-xs font-mono">
              Error executing critics: {entryError}
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="p-5 bg-slate-950/[0.15] border border-white/[0.07] rounded-2xl text-slate-400 text-xs italic text-center">
              {isLoading
                ? 'Evaluating code against criteria...'
                : 'No critic feedback available yet.'}
            </div>
          ) : (
            feedbacks.map((f, i) => {
              const badge = getSeverityBadge(f.severity_score);
              return (
                <div
                  key={i}
                  id={`critic-card-${componentId}-${i}`}
                  className="bg-slate-950/[0.2] border border-white/[0.08] backdrop-blur-md rounded-2xl p-4 space-y-2.5 shadow-sm"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                      {f.severity_score <= 2 ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : f.severity_score <= 5 ? (
                        <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span>{f.critic_name}</span>
                    </span>
                    <span
                      className={`text-xs font-mono px-2.5 py-0.5 rounded-full border font-medium ${badge.bg}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {f.overall_comments && (
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {f.overall_comments}
                    </p>
                  )}

                  {f.issues_list && f.issues_list.length > 0 && (
                    <ul className="text-xs text-slate-400 list-disc list-inside space-y-1 font-mono pl-1">
                      {f.issues_list.map((issue, idx) => (
                        <li key={idx} className="truncate">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </ModernScrollbar>
      </div>

      {/* ── Master Adjudicator Decision Box ─────────────────────────────────── */}
      <div
        id={`verdict-box-${componentId}`}
        className={`p-5 bg-slate-950/[0.25] backdrop-blur-md rounded-2xl border border-white/[0.08] mb-2 shadow-lg relative overflow-hidden transition-all duration-200 ${
          decision ? 'block' : 'hidden'
        }`}
      >
        {/* Color-coded indicator strip */}
        <div
          id={`verdict-strip-${componentId}`}
          data-testid="verdict-strip"
          className={`absolute top-0 left-0 w-1.5 h-full ${stripColor}`}
        />

        <div className="flex justify-between items-center mb-3 border-b border-white/[0.07] pb-3 pl-2">
          <span className="text-xs uppercase font-bold text-slate-300 tracking-wider flex items-center gap-2">
            <ScaleIcon className="w-4 h-4 text-slate-200" />
            <span>Master Adjudicator</span>
          </span>
          <span
            id={`verdict-text-${componentId}`}
            data-testid="verdict-text"
            className={`font-black text-lg tracking-tight ${textColor}`}
          >
            {headline}
          </span>
        </div>

        {/* Actionable reasoning or revision plan */}
        <div
          id={`verdict-reasoning-${componentId}`}
          data-testid="verdict-reasoning"
          className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono bg-slate-950/[0.2] p-3.5 rounded-xl border border-white/[0.07] ml-2"
        >
          {decision?.revision_plan || (isPass ? 'All criteria satisfied. Approved for integration.' : 'No revision plan provided.')}
        </div>
      </div>
    </div>
  );
}
