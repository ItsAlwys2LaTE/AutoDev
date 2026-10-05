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
    'px-3 py-1 rounded-full text-sm font-bold uppercase border bg-green-500/20 text-green-400 border-green-500/30';
  let cardBgCls = 'p-5 rounded-lg border shadow-sm bg-green-950/20 border-green-800';

  if (isEarlyStop) {
    verdictLabel = 'APPROVED (EARLY STOP)';
    verdictBadgeCls =
      'px-3 py-1 rounded-full text-sm font-bold uppercase border bg-green-500/20 text-green-400 border-green-500/30';
    cardBgCls = 'p-5 rounded-lg border shadow-sm bg-green-950/20 border-green-800';
  } else if (isPass) {
    verdictLabel = 'APPROVED';
    verdictBadgeCls =
      'px-3 py-1 rounded-full text-sm font-bold uppercase border bg-green-500/20 text-green-400 border-green-500/30';
    cardBgCls = 'p-5 rounded-lg border shadow-sm bg-green-950/20 border-green-800';
  } else if (rawVerdict === 'revise') {
    verdictLabel = 'REVISION REQUIRED';
    verdictBadgeCls =
      'px-3 py-1 rounded-full text-sm font-bold uppercase border bg-orange-500/20 text-orange-400 border-orange-500/30';
    cardBgCls = 'p-5 rounded-lg border shadow-sm bg-orange-950/20 border-orange-800';
  } else {
    verdictLabel = rawVerdict ? rawVerdict.toUpperCase() : 'REJECTED';
    verdictBadgeCls =
      'px-3 py-1 rounded-full text-sm font-bold uppercase border bg-red-500/20 text-red-400 border-red-500/30';
    cardBgCls = 'p-5 rounded-lg border shadow-sm bg-red-950/20 border-red-800';
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
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500 font-bold'
                  : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-700'
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
        className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-cyan-400"
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
                  ? 'px-3 py-1 bg-emerald-500/20 text-emerald-400 text-sm rounded-full font-medium border border-emerald-500/20'
                  : 'px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded-full font-medium border border-red-500/20'
              }
            >
              {activeExec.success ? 'Passed' : 'Failed'}
            </span>
          )}
        </div>

        <pre
          id="execLogsOutput"
          className="p-3.5 bg-black/60 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed border border-slate-800"
        >
          {activeExec?.logs || 'No execution logs available.'}
        </pre>
      </div>

      {/* ── Critic Feedback Cards Container ───────────────────────── */}
      <div
        id="criticCardsContainer"
        className="grid grid-cols-1 gap-3 mb-6 max-h-60 overflow-y-auto pr-1"
      >
        {activeLoading ? (
          <div className="text-sm text-slate-500 font-mono animate-pulse p-4 text-center">
            Arbitration Engine analyzing execution results...
          </div>
        ) : activeError ? (
          <div className="text-red-400 font-mono text-xs p-4 bg-red-950/20 border border-red-800/60 rounded-lg">
            Critics API Failed: {activeError}
          </div>
        ) : activeFeedbacks.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono p-4 text-center">
            No critic feedback recorded for this revision.
          </div>
        ) : (
          activeFeedbacks.map((f, idx) => {
            const isFeedbackPass = f.severity_score === 0;
            return (
              <div
                key={`critic-fb-${f.critic_name}-${idx}`}
                className={`bg-slate-900/80 p-4 rounded-lg border ${
                  isFeedbackPass ? 'border-emerald-500/30' : 'border-red-500/30'
                } shadow-sm relative overflow-hidden`}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isFeedbackPass ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <div className="flex justify-between items-center mb-2">
                  <span
                    className={`font-bold uppercase tracking-wider text-xs ${
                      isFeedbackPass ? 'text-emerald-400' : 'text-red-400'
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
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
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
      </div>

      {/* ── Master Adjudicator Decision Card ──────────────────────── */}
      <div
        id="adjudicatorCard"
        className={cardBgCls}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-purple-400"
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
          className="text-slate-300 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed bg-black/30 p-3.5 rounded-lg border border-slate-800/80 font-mono"
        >
          {activeDecision?.revision_plan || defaultPlan}
        </p>
      </div>
    </div>
  );
}

export default IntegrationCriticTabs;
