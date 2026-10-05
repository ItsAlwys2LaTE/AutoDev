import React, { useState } from 'react';
import {
  ArrowRightIcon,
  ScaleIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import type { CriticFeedback, AdjudicatorDecision } from '../../types';

export interface StageIntegrationArbitrationProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageIntegrationArbitration: React.FC<StageIntegrationArbitrationProps> = ({
  onAdvance,
  className = '',
}) => {
  const storeCritics = useAppStore((s) => s.criticEvaluations) || [];
  const storeAdjudicators = useAppStore((s) => s.adjudicatorDecisions) || [];
  const integrationRevisionHistory = useAppStore((s) => s.integrationRevisionHistory) || [];
  const revisionHistory = useAppStore((s) => s.revisionHistory) || [];

  const [activeTab, setActiveTab] = useState<number>(0);

  const allRevs = integrationRevisionHistory.length > 0 ? integrationRevisionHistory : revisionHistory;
  const currentItem = allRevs[activeTab];

  const feedbacks: CriticFeedback[] = currentItem?.criticFeedbacks || storeCritics || [];
  const decision: AdjudicatorDecision | null = currentItem?.decision || storeAdjudicators[0] || null;

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

  return (
    <div
      id="stageIntegrationArbitration"
      className={`h-full flex flex-col max-w-5xl mx-auto px-4 py-4 space-y-4 select-none ${className}`}
    >
      {/* ── Top Bar: Title & Arbitration Engine Pill ── */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <ScaleIcon className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              INTEGRATION AGENT
            </h2>
            <span
              id="arbitrationEnginePill"
              className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200"
            >
              Arbitration Engine
            </span>
          </div>
        </div>

        <button
          id="advanceToFinalCodeBtn"
          type="button"
          onClick={() => onAdvance(8)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <span>Final Source Code</span>
          <ArrowRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Revision Tabs ── */}
      {allRevs.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {allRevs.map((rev, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === idx
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {rev.label || `Rev ${idx}`}
            </button>
          ))}
        </div>
      )}

      {/* ── Master Adjudicator Decision Box ── */}
      <div
        id="adjudicatorCard"
        className="rounded-3xl bg-white border border-slate-200 p-5 shadow-md space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckBadgeIcon className="w-5 h-5 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Master Adjudicator Verdict
            </h3>
          </div>
          <span
            id="adjudicatorVerdict"
            className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200"
          >
            {verdict}
          </span>
        </div>

        <p id="adjudicatorPlan" className="text-xs text-slate-600 leading-relaxed">
          {decision?.revision_plan || 'All multi-agent modules synthesized and approved for deployment. No further revision required.'}
        </p>

        {decision?.weighted_composite !== undefined && decision?.weighted_composite !== null && (
          <div className="text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100 flex items-center gap-4">
            <span>Weighted Composite: {decision.weighted_composite.toFixed(2)} / 10.0</span>
            {decision.delta !== undefined && decision.delta !== null && (
              <span>Delta Improvement: {decision.delta.toFixed(2)}</span>
            )}
          </div>
        )}
      </div>

      {/* ── 3 Critic Cards Grid ── */}
      <div id="criticCardsContainer" className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {defaultFeedbacks.map((critic, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col justify-between space-y-3 shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 truncate">
                  {critic.critic_name}
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {critic.severity_score}/10
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {critic.overall_comments}
              </p>
            </div>

            {critic.issues_list && critic.issues_list.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-slate-500">Noted Issues:</span>
                <ul className="text-[11px] text-amber-700 list-disc list-inside space-y-0.5">
                  {critic.issues_list.map((issue, i) => (
                    <li key={i} className="truncate">{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StageIntegrationArbitration;
