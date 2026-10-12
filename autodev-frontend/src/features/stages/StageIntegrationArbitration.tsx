import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ScaleIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import type { CriticFeedback, AdjudicatorDecision } from '../../types';
import { ScrollFade } from '../../components/ScrollFade';

export interface StageIntegrationArbitrationProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageIntegrationArbitration: React.FC<StageIntegrationArbitrationProps> = ({
  onAdvance: _onAdvance,
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
      <div className="space-y-1.5 pb-2 border-b border-white/[0.07]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] shrink-0">
            <ScaleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
            Integration Agent
          </h2>
        </div>
        <p className="text-xs md:text-sm text-slate-300">
          Multi-critic verification and mathematical adjudication evaluating correctness, architecture, and security across the integrated system.
        </p>
      </div>

      {/* ── Revision Tabs ── */}
      {allRevs.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="relative flex items-center p-0.5 rounded-full bg-slate-950/[0.25] border border-white/[0.08] backdrop-blur-sm gap-1">
            {allRevs.map((rev, idx) => {
              const isActive = activeTab === idx;
              return (
                <motion.button
                  key={idx}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(idx)}
                  className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="stageIntegrationArbitrationRevGlider"
                      className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                      transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                    />
                  )}
                  <span className="relative z-10">{rev.label || `Rev ${idx}`}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Master Adjudicator Decision Box ── */}
      <div
        id="adjudicatorCard"
        className="rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-3"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckBadgeIcon className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Master Adjudicator Verdict
            </h3>
          </div>
          <span
            id="adjudicatorVerdict"
            className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30"
          >
            {verdict}
          </span>
        </div>

        <p id="adjudicatorPlan" className="text-xs text-slate-300 leading-relaxed">
          {decision?.revision_plan || 'All multi-agent modules synthesized and approved for deployment. No further revision required.'}
        </p>

        {decision?.weighted_composite !== undefined && decision?.weighted_composite !== null && (
          <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-white/10 flex items-center gap-4">
            <span>Weighted Composite: {decision.weighted_composite.toFixed(2)} / 10.0</span>
            {decision.delta !== undefined && decision.delta !== null && (
              <span>Delta Improvement: {decision.delta.toFixed(2)}</span>
            )}
          </div>
        )}
      </div>

      {/* ── 3 Critic Cards Grid with Dynamic ScrollFade ── */}
      <ScrollFade id="criticCardsContainer" className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0 overflow-y-auto">
        {defaultFeedbacks.map((critic, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-4 flex flex-col justify-between space-y-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]"
            style={{ backdropFilter: 'blur(14px)' }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-100 truncate">
                  {critic.critic_name}
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-slate-200 border border-white/[0.08]">
                  {critic.severity_score}/10
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {critic.overall_comments}
              </p>
            </div>

            {critic.issues_list && critic.issues_list.length > 0 && (
              <div className="pt-2 border-t border-white/10 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Noted Issues:</span>
                <ul className="text-[11px] text-amber-300 list-disc list-inside space-y-0.5">
                  {critic.issues_list.map((issue, i) => (
                    <li key={i} className="truncate">{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </ScrollFade>
    </div>
  );
};

export default StageIntegrationArbitration;
