import React, { useState, useEffect } from 'react';
import {
  ChatBubbleLeftRightIcon,
  ArrowRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { classifyIntent } from '../../api/endpoints';
import { persistState } from '../../stores';
import { useApiStream } from '../../hooks/useApiStream';
import { withJsonRetry } from '../../utils/jsonRetry';
import { safeJsonParse } from '../../utils/jsonParser';
import type { RequirementsDocument } from '../../types';

export interface StageProductEnquiryProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageProductEnquiry: React.FC<StageProductEnquiryProps> = ({
  onAdvance,
  className = '',
}) => {
  const clarificationState = useAppStore((s) => s.clarificationState);
  const setClarificationState = useAppStore((s) => s.setClarificationState);
  const clearIntentGate = useAppStore((s) => s.clearIntentGate);
  const startPipeline = useAppStore((s) => s.startPipeline);
  const setRequirements = useAppStore((s) => s.setRequirements);
  const setStepper = useAppStore((s) => s.setStepper);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);

  const { startStream } = useApiStream();

  const questions = clarificationState?.questions || [];
  const [answers, setAnswers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (questions.length > 0 && answers.length !== questions.length) {
      setAnswers(new Array(questions.length).fill(''));
    }
  }, [questions.length]);

  const executeRequirementsGeneration = async (promptText: string) => {
    const abortCtrl = useSessionStore.getState().createAbortController();
    const reqIntervalId = useAppStore.getState().startTimelineInterval({
      phase: 'requirements',
      stageName: 'Requirements Analysis',
      label: 'Requirements',
    });

    try {
      const setJsonRetryState = useAppStore.getState().setJsonRetryState;
      const parsed = await withJsonRetry(
        async (opts) => {
          const bodyPayload: any = { feature_request: promptText, mode: 'QUICK' };
          if (opts?.model) bodyPayload.model = opts.model;

          const response = await fetch('/api/generate-requirements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
            signal: abortCtrl.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
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
      persistState(true);
    } catch (err: any) {
      useAppStore.getState().setRawStreamText('');
      useAppStore.getState().completeTimelineInterval(reqIntervalId, { status: 'failed' });
      setError(err?.message || 'Failed to generate requirements');
    }
  };

  const handleAnswerChange = (index: number, val: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleSubmitClarification = async () => {
    if (!clarificationState) return;
    setIsSubmitting(true);
    setError(null);

    const context = questions
      .map((q, i) => `Q: ${q}\nA: ${answers[i] || '(no answer provided)'}`)
      .join('\n\n');

    try {
      const classification = await classifyIntent({
        prompt: clarificationState.originalPrompt,
        mode: 'QUICK',
        context,
      });

      if (classification.intent === 'software_request' || (clarificationState.round >= 2)) {
        clearIntentGate();
        startPipeline();
        persistState(true);
        onAdvance(3);
        executeRequirementsGeneration(
          `${clarificationState.originalPrompt}\n\nClarifications:\n${context}`
        );
      } else if (classification.intent === 'ambiguous') {
        const nextQuestions = classification.follow_up_questions || questions;
        setClarificationState({
          ...clarificationState,
          questions: nextQuestions,
          answers: [],
          round: clarificationState.round + 1,
          classifierResponse: classification,
        });
        setAnswers(new Array(nextQuestions.length).fill(''));
      }
    } catch {
      // On error, allow proceeding to requirements
      clearIntentGate();
      startPipeline();
      persistState(true);
      onAdvance(3);
      executeRequirementsGeneration(clarificationState.originalPrompt);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProceedAnyway = () => {
    if (!clarificationState) return;
    clearIntentGate();
    startPipeline();
    persistState(true);
    onAdvance(3);
    executeRequirementsGeneration(clarificationState.originalPrompt);
  };

  const handleCancel = () => {
    clearIntentGate();
    onAdvance(1);
  };

  if (!clarificationState) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none">
        <p className="text-slate-500 text-sm mb-4">No clarification questions pending.</p>
        <button
          type="button"
          onClick={() => onAdvance(1)}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          Return to Product Request
        </button>
      </div>
    );
  }

  const isRoundLimitReached = clarificationState.round >= 2;

  return (
    <div
      id="stageProductEnquiry"
      className={`h-full flex flex-col justify-center max-w-2xl mx-auto px-4 py-6 select-none space-y-6 ${className}`}
    >
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-mono text-blue-700">
          <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
          <span>STAGE 2 • PRODUCT ENQUIRY AGENT</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          Product Enquiry Agent
        </h2>
        <p className="text-xs md:text-sm text-slate-600">
          Your initial request is ambiguous. Please answer the clarification questions below so our agents can accurately structure the system architecture.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Questions Card */}
      <div
        id="clarificationCard"
        className="rounded-3xl bg-white border border-slate-200 p-6 shadow-md space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-mono text-slate-500">
            Round {clarificationState.round} of 2
          </span>
          <span className="text-xs text-slate-500 truncate max-w-xs">
            Original: &quot;{clarificationState.originalPrompt}&quot;
          </span>
        </div>

        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={idx} className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                {idx + 1}. {q}
              </label>
              <input
                type="text"
                value={answers[idx] || ''}
                onChange={(e) => handleAnswerChange(idx, e.target.value)}
                placeholder="Type your clarification here..."
                disabled={isSubmitting}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancel / Rephrase
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleProceedAnyway}
              disabled={isSubmitting}
              className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isRoundLimitReached
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Proceed Anyway
            </button>

            <button
              type="button"
              onClick={handleSubmitClarification}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Submit Clarification</span>
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StageProductEnquiry;
