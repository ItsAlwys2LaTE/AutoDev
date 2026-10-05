import React, { useState, useEffect, useRef } from 'react';
import {
  CodeBracketIcon,
  CommandLineIcon,
  ScaleIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { postCompletionModify } from '../../api/endpoints';
import { persistState } from '../../stores';
import type {
  ExecutionResult,
  CriticFeedback,
  AdjudicatorDecision,
  RevisionHistoryItem,
} from '../../types';

export interface StagePostDevExecutionProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export type ExecutionStep = 'codegen' | 'testing' | 'arbitration' | 'completed';

export const StagePostDevExecution: React.FC<StagePostDevExecutionProps> = ({
  onAdvance,
  className = '',
}) => {
  const currentCodebase = useAppStore((s) => s.currentCodebase || s.integratedCodebase);
  const currentBlueprint = useAppStore((s) => s.currentBlueprint);
  const prompt = useAppStore((s) => s.postCompletionPrompt);
  const storeRequirements = useAppStore((s) => s.requirements);
  const setCodebase = useAppStore((s) => s.setCodebase);
  const setExecutionResult = useAppStore((s) => s.setExecutionResult);
  const addRevision = useAppStore((s) => s.addRevision);
  const setActiveRevisionIndex = useAppStore((s) => s.setActiveRevisionIndex);
  const revisionHistory = useAppStore((s) => s.revisionHistory) || [];

  const [currentStep, setCurrentStep] = useState<ExecutionStep>('codegen');
  const [summary, setSummary] = useState<string>('');
  const [modifiedFiles, setModifiedFiles] = useState<string[]>([]);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [criticFeedbacks, setCriticFeedbacks] = useState<CriticFeedback[]>([]);
  const [decision, setDecision] = useState<AdjudicatorDecision | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasExecutedRef = useRef(false);
  const autoReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;

    async function runModification() {
      if (!currentCodebase) {
        setErrorMessage('No codebase available for modification.');
        return;
      }

      setCurrentStep('codegen');

      const timer1 = setTimeout(() => {
        setCurrentStep('testing');
      }, 1500);

      const timer2 = setTimeout(() => {
        setCurrentStep('arbitration');
      }, 3500);

      try {
        const data = await postCompletionModify({
          codebase: currentCodebase,
          blueprint: currentBlueprint,
          prompt: prompt || 'Enhance application features and resolve edge case issues',
          mode: 'QUICK',
          run_verification: true,
          requirements: storeRequirements,
        });

        clearTimeout(timer1);
        clearTimeout(timer2);

        if (!data || !data.codebase) {
          throw new Error('Modification response returned empty codebase');
        }

        const newCodebase = data.codebase;
        const eResult = data.execution_result || null;
        const cFeedbacks = data.critic_feedbacks || [];
        const dec = data.decision || null;

        setSummary(data.summary || 'Code modifications applied.');
        setModifiedFiles(data.modified_files || []);
        setExecResult(eResult);
        setCriticFeedbacks(cFeedbacks);
        setDecision(dec);

        // Update stores & history
        const postRunCount = revisionHistory.filter((r) => r.isPostCompletion).length;
        const postRunNum = postRunCount + 1;

        const snapshot: RevisionHistoryItem = {
          revisionNumber: revisionHistory.length,
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
          summary: data.summary,
          modifiedFiles: data.modified_files,
        };

        setCodebase(newCodebase);
        if (eResult) setExecutionResult(eResult);
        addRevision(snapshot);
        setActiveRevisionIndex(revisionHistory.length);
        persistState(true);

        setCurrentStep('completed');

        // Automatic return to Stage 10 (Development Results) after 2.5 seconds
        autoReturnTimerRef.current = setTimeout(() => {
          onAdvance(10);
        }, 2500);
      } catch (err: any) {
        clearTimeout(timer1);
        clearTimeout(timer2);
        setErrorMessage(err?.message || 'Failed to complete post-development modification.');
      }
    }

    runModification();

    return () => {
      if (autoReturnTimerRef.current) clearTimeout(autoReturnTimerRef.current);
    };
  }, []);

  const handleManualReturn = () => {
    if (autoReturnTimerRef.current) clearTimeout(autoReturnTimerRef.current);
    onAdvance(10);
  };

  return (
    <div
      id="stagePostDevExecution"
      className={`h-full flex flex-col max-w-5xl mx-auto px-4 py-4 space-y-6 select-none ${className}`}
    >
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            FEATURE REQUEST / BUG FIX EXECUTION
          </h2>
          <p className="text-[11px] text-slate-500">
            Multi-phase modification pipeline: Codegen, Sandbox Testing, and Quality Arbitration
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualReturn}
          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
        >
          Return to Results Now
        </button>
      </div>

      {/* ── 4-Phase Stepper Tracker ── */}
      <div id="postCompStepper" className="grid grid-cols-4 gap-2">
        <div
          className={`p-3 rounded-2xl border text-center transition-all ${
            currentStep === 'codegen'
              ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-400'
          }`}
        >
          <div className="text-[10px] font-mono uppercase">Phase 1</div>
          <div className="text-xs font-semibold">1. Codegen</div>
        </div>

        <div
          className={`p-3 rounded-2xl border text-center transition-all ${
            currentStep === 'testing'
              ? 'bg-purple-50 border-purple-400 text-purple-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-400'
          }`}
        >
          <div className="text-[10px] font-mono uppercase">Phase 2</div>
          <div className="text-xs font-semibold">2. Testing</div>
        </div>

        <div
          className={`p-3 rounded-2xl border text-center transition-all ${
            currentStep === 'arbitration'
              ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-400'
          }`}
        >
          <div className="text-[10px] font-mono uppercase">Phase 3</div>
          <div className="text-xs font-semibold">3. Arbitration</div>
        </div>

        <div
          className={`p-3 rounded-2xl border text-center transition-all ${
            currentStep === 'completed'
              ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-400'
          }`}
        >
          <div className="text-[10px] font-mono uppercase">Phase 4</div>
          <div className="text-xs font-semibold">4. Completed</div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {errorMessage}
        </div>
      )}

      {/* ── Auto-Return Latch Banner ── */}
      {currentStep === 'completed' && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between text-xs text-emerald-800 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckBadgeIcon className="w-5 h-5 text-emerald-600" />
            <span>
              Modifications successfully synthesized and approved! Returning to Development Results...
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualReturn}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
          >
            Return to Results Now
          </button>
        </div>
      )}

      {/* ── Phase Output Cards ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4">
        {/* Codegen Card */}
        <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <CodeBracketIcon className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Phase 1: Targeted Code Generation
            </h4>
          </div>
          <p className="text-xs text-slate-600">
            {summary || 'Synthesizing targeted modifications based on user request...'}
          </p>
          {modifiedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {modifiedFiles.map((file, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-mono text-blue-700 flex items-center gap-1.5"
                >
                  <span>{file}</span>
                  <span className="text-[9px] text-amber-600 font-bold">[MODIFIED]</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Testing Card */}
        <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CommandLineIcon className="w-4 h-4 text-purple-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Phase 2: Sandbox Verification Tests
              </h4>
            </div>
            {execResult && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  execResult.success
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {execResult.success ? 'PASSED' : 'FAILED'}
              </span>
            )}
          </div>
          {execResult?.logs && (
            <pre className="p-3 rounded-xl bg-slate-900 font-mono text-[11px] text-slate-200 whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
              {execResult.logs}
            </pre>
          )}
        </div>

        {/* Arbitration Card */}
        <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScaleIcon className="w-4 h-4 text-rose-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Phase 3: Arbitration &amp; Critic Consensus
              </h4>
            </div>
            {decision && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {decision.verdict?.toUpperCase() || 'APPROVED'}
              </span>
            )}
          </div>
          {decision?.revision_plan && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {decision.revision_plan}
            </p>
          )}
          {criticFeedbacks.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              {criticFeedbacks.map((c, i) => (
                <div key={i} className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                  <span className="font-semibold text-slate-800 block truncate">{c.critic_name}</span>
                  <span className="text-slate-500 font-mono">{c.severity_score}/10 score</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StagePostDevExecution;
