import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CommandLineIcon,
  InformationCircleIcon,
  ArrowRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { classifyIntent } from '../../api/endpoints';
import { persistState } from '../../stores';
import { useApiStream } from '../../hooks/useApiStream';
import { withJsonRetry, JsonParseExhaustedError } from '../../utils/jsonRetry';
import { safeJsonParse } from '../../utils/jsonParser';
import type { RequirementsDocument } from '../../types';

export interface StageProductRequestProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageProductRequest: React.FC<StageProductRequestProps> = ({
  onAdvance,
  className = '',
}) => {
  const storeFeatureRequest = useAppStore((s) => s.featureRequest);
  const setFeatureRequest = useAppStore((s) => s.setFeatureRequest);
  const startPipeline = useAppStore((s) => s.startPipeline);
  const setRequirements = useAppStore((s) => s.setRequirements);
  const setStepper = useAppStore((s) => s.setStepper);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);
  const setIsClassifyingIntent = useAppStore((s) => s.setIsClassifyingIntent);
  const setIntentClassification = useAppStore((s) => s.setIntentClassification);
  const setClarificationState = useAppStore((s) => s.setClarificationState);
  const setDirectAnswer = useAppStore((s) => s.setDirectAnswer);
  const clearIntentGate = useAppStore((s) => s.clearIntentGate);
  const directAnswer = useAppStore((s) => s.directAnswer);

  const [prompt, setPrompt] = useState(storeFeatureRequest || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { startStream } = useApiStream();

  useEffect(() => {
    if (storeFeatureRequest && storeFeatureRequest !== prompt) {
      setPrompt(storeFeatureRequest);
    }
  }, [storeFeatureRequest]);

  const executeRequirementsGeneration = useCallback(
    async (promptText: string) => {
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

            if (
              abortCtrl.signal.aborted ||
              useAppStore.getState().pipelineStatus === 'aborted' ||
              useSessionStore.getState().isAborted
            ) {
              throw new Error('AbortError');
            }
            return rawText;
          },
          (rawText) => {
            const p = safeJsonParse<RequirementsDocument>(rawText);
            if ('error' in p) {
              if ((p as any).json_parse_failure) {
                throw new JsonParseExhaustedError(
                  String((p as any).error),
                  'REQUIREMENTS',
                  (p as any).attempts
                );
              }
              throw new Error(`Invalid requirements specification: ${p.error}`);
            }
            return p as RequirementsDocument;
          },
          {
            phaseName: 'REQUIREMENTS',
            onRetryAttempt: (attempt, max) => {
              setErrorMessage(`JSON parse error. Retrying attempt ${attempt}/${max}...`);
              setJsonRetryState({
                isRetrying: true,
                currentAttempt: attempt,
                maxAttempts: max,
                phaseName: 'REQUIREMENTS',
                usingFallback: attempt > 3,
              });
            },
          }
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
        useAppStore.getState().setJsonRetryState(null);
        useAppStore.getState().completeTimelineInterval(reqIntervalId, { status: 'failed' });
        if (err?.message !== 'AbortError') {
          setErrorMessage(err?.message || 'Failed to generate requirements specification.');
        }
      }
    },
    [startStream, setRequirements, setStepper, setInFlightPhase]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a feature request.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    setFeatureRequest(trimmed);
    setIsClassifyingIntent(true);

    try {
      const classification = await classifyIntent({
        prompt: trimmed,
        mode: 'QUICK',
      });

      setIsClassifyingIntent(false);
      setIntentClassification(classification);

      if (classification.intent === 'software_request') {
        clearIntentGate();
        startPipeline();
        persistState(true);
        onAdvance(3); // Advance directly to Stage 3 (Requirements)
        executeRequirementsGeneration(trimmed);
      } else if (classification.intent === 'ambiguous') {
        const questions = classification.follow_up_questions || [
          'Could you describe what software application you want built?',
          'What platform or framework would you prefer (e.g., React web app or Python CLI)?',
        ];
        setClarificationState({
          originalPrompt: trimmed,
          questions,
          answers: [],
          round: 1,
          classifierResponse: classification,
        });
        onAdvance(2); // Advance to Stage 2 (Product Enquiry Agent)
      } else if (classification.intent === 'not_software') {
        setDirectAnswer(classification.direct_answer || classification.reasoning);
      }
    } catch (err: any) {
      setIsClassifyingIntent(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('400')) {
        setErrorMessage(msg);
        setIsSubmitting(false);
        return;
      }
      // Fallback: proceed directly to requirements on classifier error
      clearIntentGate();
      startPipeline();
      persistState(true);
      onAdvance(3);
      executeRequirementsGeneration(trimmed);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    prompt,
    setFeatureRequest,
    setIsClassifyingIntent,
    setIntentClassification,
    clearIntentGate,
    startPipeline,
    onAdvance,
    executeRequirementsGeneration,
    setClarificationState,
    setDirectAnswer,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleProceedAnyway = () => {
    const trimmed = prompt.trim();
    clearIntentGate();
    startPipeline();
    persistState(true);
    onAdvance(3);
    executeRequirementsGeneration(trimmed);
  };

  return (
    <div
      id="stageProductRequest"
      className={`h-full flex flex-col justify-center max-w-3xl mx-auto px-4 py-6 select-none space-y-6 ${className}`}
    >
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-mono text-blue-700">
          <CommandLineIcon className="w-3.5 h-3.5" />
          <span>SPECIFICATION INGESTION</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
          What are we developing today?
        </h2>
        <p className="text-xs md:text-sm text-slate-600">
          Describe the application, system, or features you want to build. AutoDev will architect, decompose, and generate verified code.
        </p>
      </div>

      {errorMessage && (
        <div
          id="errorSection"
          className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between"
        >
          <span id="errorText">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Non-Software Direct Answer Gate */}
      {directAnswer && (
        <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
            <InformationCircleIcon className="w-4 h-4" />
            <span>Informational Query Response</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{directAnswer}</p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => clearIntentGate()}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs text-slate-700 transition-colors cursor-pointer"
            >
              Rephrase Request
            </button>
            <button
              type="button"
              onClick={handleProceedAnyway}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Build It Anyway
            </button>
          </div>
        </div>
      )}

      {/* Input Surface */}
      <div className="relative rounded-3xl bg-white border border-slate-200 p-5 shadow-lg focus-within:border-blue-500 transition-colors">
        <textarea
          id="featureRequest"
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Build a real-time collaborative task board with drag-and-drop columns, user assignments, and WebSocket sync..."
          rows={5}
          disabled={isSubmitting}
          className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-sm md:text-base outline-none resize-none font-sans leading-relaxed"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-3">
            <span>{prompt.length} characters</span>
            <span className="hidden sm:inline-block">Press Enter to start, Shift+Enter for newline</span>
          </div>

          <button
            id="submitBtn"
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !prompt.trim()}
            className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                <span>ANALYZING REQUEST...</span>
              </>
            ) : (
              <>
                <span>START DEVELOPMENT</span>
                <ArrowRightIcon className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StageProductRequest;
