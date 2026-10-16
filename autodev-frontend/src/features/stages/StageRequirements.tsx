import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentTextIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { persistState } from '../../stores';
import { useApiStream } from '../../hooks/useApiStream';
import { withJsonRetry } from '../../utils/jsonRetry';
import { safeJsonParse } from '../../utils/jsonParser';
import type { RequirementsDocument } from '../../types';
import { RequirementsOutput } from '../requirements/RequirementsOutput';
import { ScrollFade } from '../../components/ScrollFade';
import { usePausableAutoAdvance } from '../../hooks';

export interface StageRequirementsProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageRequirements: React.FC<StageRequirementsProps> = ({
  onAdvance,
  className = '',
}) => {
  const requirements = useAppStore((s) => s.requirements);
  const featureRequest = useAppStore((s) => s.featureRequest);
  const generationMode = useAppStore((s) => s.generationMode);
  const productEnquiryResult = useAppStore((s) => s.productEnquiryResult);
  const productEnquiryAnswers = useAppStore((s) => s.productEnquiryAnswers);
  const productEnquiryAdditionalNotes = useAppStore((s) => s.productEnquiryAdditionalNotes);
  const setRequirements = useAppStore((s) => s.setRequirements);
  const setStepper = useAppStore((s) => s.setStepper);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);
  const unlockStage = useAppStore((s) => s.unlockStage);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const hasTriggeredRef = useRef<boolean>(false);
  const { startStream } = useApiStream();

  // If requirements are available, unlock Stage 4 immediately for navigation
  useEffect(() => {
    if (requirements) {
      unlockStage(4);
    }
  }, [requirements, unlockStage]);

  // If reloaded while in Stage 3 before or during output generation, regenerate from requirements agent
  const generateMissingRequirements = useCallback(async () => {
    if (!featureRequest || isGenerating) return;
    setIsGenerating(true);
    setError(null);

    const abortCtrl = useSessionStore.getState().createAbortController();
    const reqIntervalId = useAppStore.getState().startTimelineInterval({
      phase: 'requirements',
      stageName: 'Requirements Analysis',
      label: 'Requirements',
    });

    try {
      const summary = productEnquiryResult
        ? `${productEnquiryResult.understanding_summary}\n\nProposed Implementation Plan:\n${productEnquiryResult.implementation_strategy}`
        : '';
      const questions = productEnquiryResult?.follow_up_questions || [];
      const responses: Array<{ question: string; answer: string }> = [];
      questions.forEach((q, idx) => {
        const ans = productEnquiryAnswers[idx]?.trim();
        if (ans) {
          responses.push({ question: q, answer: ans });
        }
      });
      const contextParts: string[] = [];
      if (responses.length > 0) {
        contextParts.push(
          'User Answers to Clarifying Questions:\n' +
            responses.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n')
        );
      }
      if (productEnquiryAdditionalNotes.trim()) {
        contextParts.push(`Additional User Preferences:\n${productEnquiryAdditionalNotes.trim()}`);
      }
      const enquiryContext = contextParts.join('\n\n');

      const setJsonRetryState = useAppStore.getState().setJsonRetryState;
      const parsed = await withJsonRetry(
        async (opts) => {
          const bodyPayload: any = {
            feature_request: featureRequest,
            mode: generationMode || 'STANDARD',
            product_enquiry_summary: summary,
            user_enquiry_responses: responses,
            enquiry_context: enquiryContext,
          };
          if (opts?.model) bodyPayload.model = opts.model;

          const response = await fetch('/api/generate-requirements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
            signal: abortCtrl.signal,
          });

          if (!response.ok) {
            let errorDetail = `HTTP ${response.status} ${response.statusText}`;
            try {
              const errJson = await response.json();
              if (errJson.detail) errorDetail = errJson.detail;
            } catch {
              const errText = await response.text();
              if (errText) errorDetail = errText;
            }
            throw new Error(errorDetail);
          }

          const rawText = await startStream(response, {
            signal: abortCtrl.signal,
            onChunk: (accText) => {
              useAppStore.getState().setRawStreamText(accText);
            },
          });
          return rawText;
        },
        (rawText) => {
          const p = safeJsonParse<RequirementsDocument>(rawText);
          if ('error' in p) throw new Error(String(p.error));
          return p as RequirementsDocument;
        },
        { phaseName: 'REQUIREMENTS' }
      );
      setJsonRetryState(null);

      const reqDoc = parsed as RequirementsDocument;
      useAppStore.getState().setRawStreamText('');
      setRequirements(reqDoc);
      setStepper(1, 'success');
      setInFlightPhase('decomposition');
      useAppStore.getState().completeTimelineInterval(reqIntervalId, { status: 'completed' });
      unlockStage(4);
      persistState(true);
    } catch (err: any) {
      useAppStore.getState().setRawStreamText('');
      useAppStore.getState().setJsonRetryState(null);
      const isAborted =
        err?.name === 'AbortError' ||
        err?.message === 'AbortError' ||
        String(err?.message || err).includes('aborted') ||
        String(err?.message || err).includes('Superseded') ||
        useAppStore.getState().pipelineStatus === 'aborted' ||
        useSessionStore.getState().isAborted;
      if (isAborted) {
        hasTriggeredRef.current = false;
        return;
      }
      useAppStore.getState().completeTimelineInterval(reqIntervalId, { status: 'failed' });
      const errText = err?.message || 'Failed to generate requirements';
      setError(errText);
      try {
        useSessionStore.getState().showErrorToast(errText, 'Requirements Analysis Failed');
      } catch { /* ignore */ }
    } finally {
      setIsGenerating(false);
    }
  }, [
    featureRequest,
    isGenerating,
    generationMode,
    productEnquiryResult,
    productEnquiryAnswers,
    productEnquiryAdditionalNotes,
    setRequirements,
    setStepper,
    setInFlightPhase,
    unlockStage,
    startStream,
  ]);

  useEffect(() => {
    if (!requirements && featureRequest && !hasTriggeredRef.current && !isGenerating) {
      hasTriggeredRef.current = true;
      generateMissingRequirements();
    }
  }, [requirements, featureRequest, isGenerating, generateMissingRequirements]);

  // Automatically proceed to Decomposition after 10 seconds of requirements being available
  // Pauses seamlessly when development is paused, and resumes remaining time when resumed
  usePausableAutoAdvance({
    durationMs: 10000,
    onAdvance,
    targetStage: 4,
    enabled: Boolean(requirements),
    stageKey: 'stage-3-requirements',
  });

  if (!requirements) {
    return (
      <div
        id="stageRequirementsLoading"
        className={`h-full flex flex-col items-center justify-center max-w-xl mx-auto px-4 py-8 text-center select-none space-y-5 ${className}`}
      >
        <div className="w-14 h-14 rounded-2xl bg-white/80 dark:bg-white/[0.08] border border-slate-200 dark:border-white/20 flex items-center justify-center text-slate-800 dark:text-white shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]">
          <ArrowPathIcon className="w-7 h-7 animate-spin" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Requirements Agent Synthesizing Specifications
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto">
            Structuring system specifications, user stories, and testable acceptance criteria...
          </p>
        </div>
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-300 max-w-md">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <ScrollFade
      id="stageRequirements"
      className={`h-full flex flex-col justify-start max-w-5xl mx-auto px-4 py-4 select-none space-y-6 overflow-y-auto ${className}`}
    >
      {/* Top Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-800 dark:text-white/90 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]">
            <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800 dark:text-white/90" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Requirements Agent
          </h2>
        </div>
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
          Review synthesized system specifications, structured user stories, and testable acceptance criteria derived from your product goals.
        </p>
      </div>

      {/* Main Requirements View */}
      <RequirementsOutput alwaysRender={true} onProceedToDesign={() => onAdvance(4)} />
    </ScrollFade>
  );
};

export default StageRequirements;

