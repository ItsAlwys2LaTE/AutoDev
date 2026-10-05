/**
 * AutoDev Critics Output Island Component
 * 
 * Implements Milestone 3 R2:
 * - Matches #criticOutputSection & #criticCardsContainer
 * - Renders feedback cards for Correctness, Completeness, and Architecture
 * - Severity score badges (0-10 scale) with color coding:
 *   (score > 5: red, score > 0: amber, score == 0: green)
 * - Lists identified issues as bullet points or displays "No issues found."
 * - Displays overall qualitative evaluation comments
 * - Optional integration tab bar #integrationCriticTabs for multi-component DAG
 * - Bound to Zustand stores (useAppStore) and supports prop overrides / SSR
 */

import {
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import type { CriticFeedback } from '../../types';

export interface CriticsOutputProps {
  feedbacks?: CriticFeedback[];
  className?: string;
  hideHeader?: boolean;
}

export function CriticsOutput({
  feedbacks: propFeedbacks,
  className = '',
  hideHeader = false,
}: CriticsOutputProps) {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // Zustand bindings
  const storeFeedbacks = useAppStore((s) => s.criticEvaluations);
  const inFlightPhase = useAppStore((s) => s.inFlightPhase);

  // Resolved feedbacks: Props > SSR live store > Hook state
  const feedbacks = propFeedbacks !== undefined
    ? propFeedbacks
    : (isSSR ? (liveStore?.criticEvaluations ?? storeFeedbacks) : storeFeedbacks);

  const isEvaluating = inFlightPhase === 'single_critics';

  // Visible if feedbacks exist or actively evaluating
  if (feedbacks.length === 0 && !isEvaluating) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {!hideHeader && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2 text-base sm:text-lg">
            <span className="bg-rose-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
              3
            </span>
            <span>Arbitration Engine Feedback</span>
          </h2>
          <span className="px-3 py-1 bg-rose-500/20 text-rose-400 text-xs sm:text-sm rounded-full font-medium border border-rose-500/30 flex items-center gap-1.5">
            <ShieldCheckIcon className="w-3.5 h-3.5" />
            <span>Evaluated</span>
          </span>
        </div>
      )}

      {/* Multi-Component Critic Tabs (#integrationCriticTabs) */}
      <div id="integrationCriticTabs" className="flex gap-1 mb-4 flex-wrap hidden" />

      {/* Critic Cards Container (#criticCardsContainer) */}
      <div
        id="criticCardsContainer"
        className="space-y-4 max-h-[600px] overflow-y-auto pr-1"
      >
        {isEvaluating && feedbacks.length === 0 && (
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center space-y-2">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-rose-500 border-t-transparent rounded-full" />
            <p className="text-slate-300 text-sm font-medium">
              Running parallel Correctness, Completeness, and Architecture critics...
            </p>
          </div>
        )}

        {feedbacks.map((fb, idx) => {
          const score = fb.severity_score;
          const isFailing = score > 5;
          const isWarning = score > 0 && score <= 5;
          const isPassing = score === 0;

          const scoreBadgeBg = isFailing
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            : isWarning
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

          return (
            <div
              key={`${fb.critic_name}-${idx}`}
              className="bg-slate-950 p-5 rounded-lg border border-slate-800 shadow-sm transition-all hover:border-slate-700"
            >
              {/* Card Header */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  {isPassing && <CheckCircleIcon className="w-5 h-5 text-emerald-400" />}
                  {isWarning && <ExclamationTriangleIcon className="w-5 h-5 text-amber-400" />}
                  {isFailing && <XCircleIcon className="w-5 h-5 text-rose-400" />}
                  <h3 className="font-bold text-slate-200 text-base sm:text-lg">
                    {fb.critic_name}
                  </h3>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${scoreBadgeBg}`}>
                  {`Severity: ${score}/10`}
                </span>
              </div>

              {/* Overall Comments */}
              <p className="text-slate-400 text-sm mb-4 italic leading-relaxed">
                {`"${fb.overall_comments}"`}
              </p>

              {/* Issues Identified */}
              <h4 className="text-xs text-slate-500 uppercase font-bold mb-2 tracking-wider">
                Issues Identified:
              </h4>

              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                {fb.issues_list && fb.issues_list.length > 0 ? (
                  fb.issues_list.map((issue, issueIdx) => (
                    <li key={issueIdx} className="leading-relaxed">
                      {issue}
                    </li>
                  ))
                ) : (
                  <li className="text-emerald-400 font-medium">
                    No issues found.
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
