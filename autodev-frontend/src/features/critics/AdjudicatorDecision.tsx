/**
 * AutoDev Adjudicator Decision & Documentation Component
 * 
 * Implements Milestone 3 R3 & Phase 3.5:
 * - Matches #adjudicatorSection & #adjudicatorCard
 * - Verdict badge #adjudicatorVerdict:
 *   PASS, REVISE, PASSED (EARLY STOP), PASSED (FORCED QUICK MODE), MAX REVISIONS (X/X)
 * - Revision plan text in #adjudicatorPlan
 * - Weighted composite score display (Correctness 50%, Architecture 20%, Completeness 30%)
 * - Dynamic budget calculation display: min(5, ceil(composite / 3))
 * - Early stop delta check indicator (delta <= 1.0)
 * - Phase 3.5 Documentation button #docBtn with loading spinner #docSpinner and countdown
 * - Final download button #finalDownloadBtn calling zipExporter
 * - Bound to Zustand stores (useAppStore, useSessionStore) and supports SSR / prop overrides
 */

import { useState } from 'react';
import {
  ScaleIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { exportZip } from '../../utils/zipExporter';
import { generateDocumentationPhase } from '../pipeline/revisionLoop';
import type { AdjudicatorDecision as IAdjudicatorDecision } from '../../types';

export interface AdjudicatorDecisionProps {
  decision?: IAdjudicatorDecision | null;
  mode?: string;
  revisionCount?: number;
  dynamicBudget?: number | null;
  compositeScore?: number | null;
  isGeneratingDocs?: boolean;
  docsGenerated?: boolean;
  onGenerateDocs?: () => void;
  onDownloadZip?: () => void;
  className?: string;
}

export function AdjudicatorDecision({
  decision: propDecision,
  mode: _propMode,
  revisionCount: propRevisionCount,
  dynamicBudget: propDynamicBudget,
  compositeScore: propCompositeScore,
  isGeneratingDocs: propIsGeneratingDocs,
  docsGenerated: propDocsGenerated,
  onGenerateDocs,
  onDownloadZip,
  className = '',
}: AdjudicatorDecisionProps) {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // Store bindings
  const sDecisions = useAppStore((s) => s.adjudicatorDecisions);
  const sRevisionCount = useAppStore((s) => s.currentRevisionCount);
  const sDynamicBudget = useAppStore((s) => s.currentDynamicBudget);
  const sCompositeScore = useAppStore((s) => s.currentCompositeScore);
  const sRevisionPlan = useAppStore((s) => s.currentRevisionPlan);
  const sCodebase = useAppStore((s) => s.currentCodebase);
  const sRequirements = useAppStore((s) => s.requirements);
  const sPipelineStatus = useAppStore((s) => s.pipelineStatus);
  const sInFlightPhase = useAppStore((s) => s.inFlightPhase);
  const setGitHubModalOpen = useAppStore((s) => s.setGitHubModalOpen);

  const storeDecisions = isSSR ? (liveStore?.adjudicatorDecisions ?? []) : sDecisions;
  const storeRevisionCount = isSSR ? (liveStore?.currentRevisionCount ?? 0) : sRevisionCount;
  const storeDynamicBudget = isSSR ? (liveStore?.currentDynamicBudget ?? null) : sDynamicBudget;
  const storeCompositeScore = isSSR ? (liveStore?.currentCompositeScore ?? null) : sCompositeScore;
  const storeRevisionPlan = isSSR ? (liveStore?.currentRevisionPlan ?? null) : sRevisionPlan;
  const storeCodebase = isSSR ? (liveStore?.currentCodebase ?? null) : sCodebase;
  const storeRequirements = isSSR ? (liveStore?.requirements ?? null) : sRequirements;
  const storePipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? 'idle') : sPipelineStatus;
  const storeInFlightPhase = isSSR ? (liveStore?.inFlightPhase ?? null) : sInFlightPhase;

  // Session Store (Countdown)
  const countdown = useSessionStore((s) => s.countdown);

  // Fallbacks: Props > Store
  const decision = propDecision !== undefined
    ? propDecision
    : (storeDecisions.length > 0 ? storeDecisions[storeDecisions.length - 1] : null);

  const revisionCount = propRevisionCount ?? storeRevisionCount;

  const compositeScore = propCompositeScore !== undefined
    ? propCompositeScore
    : (decision?.weighted_composite ?? storeCompositeScore);

  const isIntegration = storeInFlightPhase === 'integration';
  const defaultBudget = isIntegration ? 5 : 3;
  const dynamicBudget: number = (propDynamicBudget !== undefined && propDynamicBudget !== null)
    ? propDynamicBudget
    : ((decision?.dynamic_budget ?? null) || (isIntegration ? (useAppStore.getState().integrationDynamicBudget || 5) : (storeDynamicBudget ?? 3)) || defaultBudget);

  const [internalGeneratingDocs, setInternalGeneratingDocs] = useState(false);
  const isGeneratingDocs =
    propIsGeneratingDocs ?? (internalGeneratingDocs || storeInFlightPhase === 'documentation');
  const isDocCountdownRunning = countdown.isRunning && countdown.targetAction === 'docBtn';

  // Check if docs already exist in currentCodebase
  const hasDocFiles = Boolean(
    storeCodebase?.files.some(
      (f) =>
        f.file_name.toLowerCase().includes('readme') ||
        f.file_name.toLowerCase().includes('user_guide') ||
        f.file_name.toLowerCase().includes('architecture')
    )
  );
  const docsGenerated = propDocsGenerated ?? hasDocFiles;

  const handleGenerateDocs = async () => {
    if (onGenerateDocs) {
      onGenerateDocs();
      return;
    }
    if (isGeneratingDocs || docsGenerated) return;
    try {
      setInternalGeneratingDocs(true);
      await generateDocumentationPhase();
    } catch (err) {
      console.error('[AdjudicatorDecision] Doc generation error:', err);
    } finally {
      setInternalGeneratingDocs(false);
    }
  };

  if (!decision && !storeRevisionPlan) {
    return null;
  }

  const rawVerdict = (decision?.verdict || '').toLowerCase();
  const isEarlyStop = Boolean(decision?.early_stop || (decision?.delta !== null && decision?.delta !== undefined && decision.delta <= 1.0));
  const isPassed = rawVerdict === 'pass' || isEarlyStop || (compositeScore !== null && compositeScore !== undefined && compositeScore <= 2.0);
  const isMaxRevisions = !isPassed && revisionCount >= dynamicBudget;

  // Format verdict display string and styling
  let verdictDisplay = 'EVALUATING';
  let verdictClass = 'bg-white/10 text-slate-300 border-white/20';
  let cardClass = 'bg-slate-950/[0.25] backdrop-blur-md p-5 rounded-2xl border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]';

  if (isEarlyStop) {
    verdictDisplay = 'PASSED (EARLY STOP)';
    verdictClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    cardClass = 'bg-emerald-950/20 backdrop-blur-md p-5 rounded-2xl border border-emerald-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]';
  } else if (isPassed) {
    verdictDisplay = 'PASS';
    verdictClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    cardClass = 'bg-emerald-950/20 backdrop-blur-md p-5 rounded-2xl border border-emerald-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]';
  } else if (isMaxRevisions) {
    verdictDisplay = `MAX REVISIONS (${dynamicBudget}/${dynamicBudget})`;
    verdictClass = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    cardClass = 'bg-rose-950/20 backdrop-blur-md p-5 rounded-2xl border border-rose-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]';
  } else if (rawVerdict === 'revise') {
    verdictDisplay = revisionCount > 0
      ? `REVISE (Attempt ${revisionCount}/${dynamicBudget} starting...)`
      : 'REVISE';
    verdictClass = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    cardClass = 'bg-rose-950/20 backdrop-blur-md p-5 rounded-2xl border border-rose-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]';
  } else if (rawVerdict === 'error') {
    verdictDisplay = 'ERROR';
    verdictClass = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    cardClass = 'bg-rose-950/20 backdrop-blur-md p-5 rounded-2xl border border-rose-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]';
  }

  // Handle final download zip
  const handleDownload = async () => {
    if (onDownloadZip) {
      onDownloadZip();
      return;
    }
    if (!storeCodebase || storeCodebase.files.length === 0) return;
    const title = storeRequirements?.project_title || 'autodev_project';
    await exportZip(storeCodebase, {
      projectTitle: title,
      downloadFilename: title,
    });
  };

  return (
    <div
      id="adjudicatorSection"
      className={`mt-8 border-t border-white/10 pt-6 space-y-6 ${className}`}
    >
      {/* Title */}
      <h3 className="text-lg sm:text-xl font-bold text-slate-200 flex items-center gap-2">
        <ScaleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white/90 shrink-0" />
        <span>Adjudicator Decision</span>
      </h3>

      {/* Main Decision Card (#adjudicatorCard) */}
      <div id="adjudicatorCard" className={cardClass}>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4 border-b border-white/10 pb-3">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
            Adjudication Verdict
          </span>
          <span
            id="adjudicatorVerdict"
            className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold uppercase border ${verdictClass}`}
          >
            {verdictDisplay}
          </span>
        </div>

        {/* Scoring & Budget Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-xs font-mono">
          {/* Composite Score */}
          <div className="p-3 rounded-xl bg-slate-950/[0.3] border border-white/[0.08]">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-semibold">
              Weighted Composite
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-200 mt-0.5">
              {compositeScore !== null && compositeScore !== undefined
                ? `${compositeScore.toFixed(1)} / 10.0`
                : 'N/A'}
            </div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5">
              Correctness 50%, Arch 20%, Comp 30%
            </div>
          </div>

          {/* Dynamic Budget */}
          <div className="p-3 rounded-xl bg-slate-950/[0.3] border border-white/[0.08]">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-semibold">
              Dynamic Budget
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-100 mt-0.5">
              {`${dynamicBudget} ${dynamicBudget === 1 ? 'Revision' : 'Revisions'}`}
            </div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5">
              Attempt {revisionCount} of {dynamicBudget}
            </div>
          </div>

          {/* Score Delta & Early Stop Check */}
          <div className="p-3 rounded-xl bg-slate-950/[0.3] border border-white/[0.08]">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-semibold">
              Delta Early-Stop
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-200 mt-0.5">
              {decision?.delta !== null && decision?.delta !== undefined
                ? `Δ = ${decision.delta.toFixed(1)}`
                : 'Initial Run'}
            </div>
            <div className={`text-[10px] font-sans mt-0.5 font-medium ${isEarlyStop ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isEarlyStop ? 'Diminishing Returns (Δ <= 1.0)' : 'Tolerance: Δ <= 1.0'}
            </div>
          </div>
        </div>

        {/* Action Plan Text (#adjudicatorPlan) */}
        <div>
          <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-1.5">
            Revision Plan / Summary
          </h4>
          <p
            id="adjudicatorPlan"
            className="text-slate-300 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed bg-slate-950/[0.3] p-3.5 rounded-xl border border-white/[0.08] font-mono"
          >
            {decision?.revision_plan || storeRevisionPlan || 'No revision plan required.'}
          </p>
        </div>
      </div>

      {/* Phase 3.5 Documentation Generation Section (#docGenerationSection) */}
      {(isPassed || isMaxRevisions || storePipelineStatus === 'completed' || docsGenerated) && (
        <div id="docGenerationSection" className="space-y-3">
          <button
            id="docBtn"
            type="button"
            onClick={handleGenerateDocs}
            disabled={isGeneratingDocs || docsGenerated}
            className={`w-full font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 shadow-sm text-sm ${
              docsGenerated
                ? 'bg-white/[0.06] text-slate-300 border border-white/[0.1] cursor-default'
                : 'bg-white/10 hover:bg-white/20 border border-white/20 text-white hover:shadow-md cursor-pointer'
            }`}
          >
            <DocumentTextIcon className="w-4 h-4 shrink-0" />
            <span>
              {docsGenerated
                ? 'Documentation Generated & Added to Explorer'
                : isDocCountdownRunning
                ? `Phase 3.5: Generate Documentation (${countdown.remainingSeconds}s)`
                : isGeneratingDocs
                ? 'Generating Documentation (README & Architecture)...'
                : 'Phase 3.5: Generate Documentation'}
            </span>

            <svg
              id="docSpinner"
              className={`animate-spin h-4 w-4 ${isGeneratingDocs ? 'inline' : 'hidden'}`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </button>
        </div>
      )}

      {/* Final Download & GitHub Export Buttons */}
      {(isPassed || isMaxRevisions || storePipelineStatus === 'completed' || docsGenerated) && (
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            id="finalDownloadBtn"
            type="button"
            onClick={handleDownload}
            className="w-full flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 shadow-md hover:shadow-lg text-sm sm:text-base cursor-pointer"
          >
            <ArrowDownTrayIcon className="w-5 h-5 shrink-0" />
            <span>Download Final Project (.zip)</span>
          </button>
          <button
            id="uploadGithubBtn"
            type="button"
            onClick={() => setGitHubModalOpen(true)}
            className="w-full sm:w-auto bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-slate-200 hover:text-white font-bold py-3.5 px-5 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 shadow-md hover:shadow-lg text-sm sm:text-base cursor-pointer shrink-0"
          >
            <ArrowUpTrayIcon className="w-5 h-5 shrink-0" />
            <span>Upload to GitHub</span>
          </button>
        </div>
      )}
    </div>
  );
}
