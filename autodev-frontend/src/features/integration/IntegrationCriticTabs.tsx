/**
 * AutoDev Integration Critic Tabs & Adjudicator Evaluation Component
 * 
 * Implements Milestone 3 R4:
 * - Legacy DOM IDs:
 *   - `#integrationCriticTabs` (`flex gap-1 mb-4 flex-wrap`)
 *   - `#execLogsSection` with `#execStatusBadge` and `#execLogsOutput`
 *   - `#criticCardsContainer` (`grid grid-cols-1 gap-3 mb-6 max-h-60 overflow-y-auto`)
 *   - `#adjudicatorCard`, `#adjudicatorVerdict`, `#adjudicatorPlan`
 * - Evaluates early-stop delta condition:
 *   `(decision?.early_stop || (decision?.delta !== undefined && decision?.delta !== null && decision.delta <= 1.0))`
 *   to render green "APPROVED (EARLY STOP)" badge.
 */
import type {
  ExecutionResult,
  CriticFeedback,
  AdjudicatorDecision,
} from '../../types';
import { ModernScrollbar } from '../../components/ModernScrollbar';

export interface IntegrationCriticHistoryItem {
  exec?: ExecutionResult | null;
  feedbacks?: CriticFeedback[];
  decision?: AdjudicatorDecision | null;
  loading?: boolean;
  error?: string | null;
}

export interface IntegrationCriticTabsProps {
  /** Evaluation history per revision */
  criticHistory?: IntegrationCriticHistoryItem[];
  /** Currently active critic tab index */
  activeCriticIndex?: number;
  /** Current execution result */
  executionResult?: ExecutionResult | null;
  /** Critic feedbacks */
  feedbacks?: CriticFeedback[];
  /** Master Adjudicator decision */
  decision?: AdjudicatorDecision | null;
  /** Loading indicator */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Callback fired when user switches critic tab */
  onSelectCriticTab?: (index: number) => void;
  /** Additional custom class names */
  className?: string;
}

export function IntegrationCriticTabs({
  criticHistory = [],
  activeCriticIndex = 0,
  executionResult,
  feedbacks,
  decision,
  isLoading = false,
  error = null,
  onSelectCriticTab,
  className = '',
}: IntegrationCriticTabsProps) {
  // Resolve active item from history if available, else fallback to props
  const activeItem: IntegrationCriticHistoryItem =
    criticHistory.length > 0 && criticHistory[activeCriticIndex]
      ? criticHistory[activeCriticIndex]
      : {
          exec: executionResult || null,
          feedbacks: feedbacks || [],
          decision: decision || null,
          loading: isLoading,
          error: error,
        };

  const activeExec = activeItem.exec ?? executionResult ?? null;
  const activeFeedbacks = activeItem.feedbacks ?? feedbacks ?? [];
  const activeDecision = activeItem.decision ?? decision ?? null;
  const activeLoading = Boolean(activeItem.loading ?? isLoading);
  const activeError = activeItem.error ?? error ?? null;

  // Evaluate early stop condition as mandated in R4:
  // (decision?.early_stop || (decision?.delta !== undefined && decision?.delta <= 1.0))
  const isEarlyStop = Boolean(
    activeDecision?.early_stop ||
      (activeDecision?.delta !== undefined &&
        activeDecision?.delta !== null &&
        activeDecision.delta <= 1.0)
  );

  const isAutoPass = Boolean(
    activeDecision?.weighted_composite !== undefined &&
      activeDecision?.weighted_composite !== null &&
      activeDecision.weighted_composite <= 2.0
  );

  const rawVerdict = (activeDecision?.verdict || '').toLowerCase();
  const isPass = isEarlyStop || isAutoPass || rawVerdict === 'pass';

  let verdictLabel = 'APPROVED';
  let verdictBadgeCls =
    'px-3 py-1 rounded-full text-xs font-bold uppercase border bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
  let cardBgCls =
    'p-5 rounded-2xl border border-white/[0.07] bg-slate-950/[0.25] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]';

  if (isEarlyStop) {
    verdictLabel = 'APPROVED (EARLY STOP)';
    verdictBadgeCls =
      'px-3 py-1 rounded-full text-xs font-bold uppercase border bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
    cardBgCls =
      'p-5 rounded-2xl border border-white/[0.07] bg-slate-950/[0.25] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]';
  } else if (isPass) {
    verdictLabel = 'APPROVED';
    verdictBadgeCls =
      'px-3 py-1 rounded-full text-xs font-bold uppercase border bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
    cardBgCls =
      'p-5 rounded-2xl border border-white/[0.07] bg-slate-950/[0.25] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]';
  } else if (rawVerdict === 'revise') {
    verdictLabel = 'REVISION REQUIRED';
    verdictBadgeCls =
      'px-3 py-1 rounded-full text-xs font-bold uppercase border bg-amber-500/15 text-amber-300 border-amber-400/30';
    cardBgCls =
      'p-5 rounded-2xl border border-white/[0.07] bg-slate-950/[0.25] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]';
  } else {
    verdictLabel = rawVerdict ? rawVerdict.toUpperCase() : 'REJECTED';
    verdictBadgeCls =
      'px-3 py-1 rounded-full text-xs font-bold uppercase border bg-rose-500/15 text-rose-300 border-rose-400/30';
    cardBgCls =
      'p-5 rounded-2xl border border-white/[0.07] bg-slate-950/[0.25] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]';
  }

  const defaultPlan = isPass
    ? isEarlyStop
      ? 'Early stop triggered: score improvement threshold met.'
      : 'Integration verified and passed by Adjudicator.'
    : 'Adjudicator requested fixes for integration issues.';

  return (
    <div
      id="criticOutputSection"
      className={`mt-6 space-y-6 ${className}`}
    >
      {/* ── Critic Revision History Tabs ───────────────────────────── */}
      <div
        id="integrationCriticTabs"
        className={`flex gap-1 mb-4 flex-wrap ${
          criticHistory.length <= 1 ? 'hidden' : ''
        }`}
      >
        {criticHistory.map((_, i) => {
          const isSelected = activeCriticIndex === i;
          return (
            <button
              key={`critic-tab-${i}`}
              type="button"
              onClick={() => onSelectCriticTab?.(i)}
              className={`px-3 py-1 rounded-t-lg transition-colors border-b-2 text-xs sm:text-sm font-medium cursor-pointer ${
                isSelected
                  ? 'bg-white/15 text-white border-white/40 font-bold shadow-xs'
                  : 'bg-white/[0.04] text-slate-400 border-transparent hover:bg-white/[0.08] hover:text-slate-200'
              }`}
            >
              {i === 0 ? 'Initial Eval' : `Rev ${i} Eval`}
            </button>
          );
        })}
      </div>

      {/* ── Execution Logs Section ─────────────────────────────────── */}
      <div
        id="execLogsSection"
        className="bg-slate-950/[0.25] backdrop-blur-md rounded-2xl border border-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-white/80"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h4 className="text-sm font-semibold text-slate-200">
              Sandbox Test Execution
            </h4>
          </div>
          {activeExec && (
            <span
              id="execStatusBadge"
              className={
                activeExec.success
                  ? 'px-3 py-1 bg-emerald-500/15 text-emerald-300 text-xs rounded-full font-semibold border border-emerald-400/30'
                  : 'px-3 py-1 bg-rose-500/15 text-rose-300 text-xs rounded-full font-semibold border border-rose-400/30'
              }
            >
              {activeExec.success ? 'Passed' : 'Failed'}
            </span>
          )}
        </div>

        <ModernScrollbar className="max-h-48" viewportClassName="p-0">
          <pre
            id="execLogsOutput"
            className="p-3.5 bg-black/25 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed border border-white/[0.07]"
          >
            {activeExec?.logs || 'No execution logs available.'}
          </pre>
        </ModernScrollbar>
      </div>

      {/* ── Critic Feedback Cards Container with ModernScrollbar ── */}
      <ModernScrollbar
        id="criticCardsContainer"
        className="mb-6 max-h-60"
        viewportClassName="grid grid-cols-1 gap-3 pr-1"
      >
        {activeLoading ? (
          <div className="text-sm text-slate-400 font-mono animate-pulse p-4 text-center">
            Arbitration Engine analyzing execution results...
          </div>
        ) : activeError ? (
          <div className="text-rose-300 font-mono text-xs p-4 bg-rose-950/20 border border-rose-500/30 rounded-xl">
            Critics API Failed: {activeError}
          </div>
        ) : activeFeedbacks.length === 0 ? (
          <div className="text-xs text-slate-400 font-mono p-4 text-center">
            No critic feedback recorded for this revision.
          </div>
        ) : (
          activeFeedbacks.map((f, idx) => {
            const isFeedbackPass = f.severity_score === 0;
            return (
              <div
                key={`critic-fb-${f.critic_name}-${idx}`}
                className="bg-slate-950/[0.25] backdrop-blur-md p-4 rounded-xl border border-white/[0.07] shadow-sm relative overflow-hidden"
                style={{ backdropFilter: 'blur(14px)' }}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isFeedbackPass ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                <div className="flex justify-between items-center mb-2">
                  <span
                    className={`font-bold uppercase tracking-wider text-xs ${
                      isFeedbackPass ? 'text-emerald-300' : 'text-rose-300'
                    } flex items-center gap-2`}
                  >
                    {isFeedbackPass ? (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                    {f.critic_name}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      isFeedbackPass
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20'
                        : 'bg-rose-500/10 text-rose-300 border border-rose-400/20'
                    }`}
                  >
                    Sev: {f.severity_score}/10
                  </span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-2">
                  {f.overall_comments}
                </p>
                {f.issues_list && f.issues_list.length > 0 && (
                  <ul className="list-disc pl-5 text-xs text-slate-400 space-y-1">
                    {f.issues_list.map((issue, i) => (
                      <li key={`issue-${i}`}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </ModernScrollbar>

      {/* ── Master Adjudicator Decision Card ──────────────────────── */}
      <div
        id="adjudicatorCard"
        className={cardBgCls}
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-white/80"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Master Adjudicator Arbitration
            </h4>
          </div>
          <span
            id="adjudicatorVerdict"
            className={verdictBadgeCls}
          >
            {verdictLabel}
          </span>
        </div>

        {activeDecision?.weighted_composite !== undefined &&
          activeDecision.weighted_composite !== null && (
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400 mb-3">
              <span>
                Composite Score:{' '}
                <strong className="text-slate-200">
                  {activeDecision.weighted_composite.toFixed(2)}
                </strong>
              </span>
              {activeDecision.delta !== undefined && activeDecision.delta !== null && (
                <span>
                  Delta:{' '}
                  <strong className="text-slate-200">
                    {activeDecision.delta.toFixed(2)}
                  </strong>
                </span>
              )}
              {activeDecision.dynamic_budget !== undefined &&
                activeDecision.dynamic_budget !== null && (
                  <span>
                    Budget:{' '}
                    <strong className="text-slate-200">
                      {activeDecision.dynamic_budget}
                    </strong>
                  </span>
                )}
            </div>
          )}

        <p
          id="adjudicatorPlan"
          className="text-slate-200 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed bg-black/40 p-3.5 rounded-xl border border-white/[0.07] font-mono"
        >
          {activeDecision?.revision_plan || defaultPlan}
        </p>
      </div>
    </div>
  );
}

export default IntegrationCriticTabs;
