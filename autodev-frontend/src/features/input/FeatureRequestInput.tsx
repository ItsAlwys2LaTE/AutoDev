/**
 * AutoDev Feature Request Input Island Component
 * 
 * Implements Milestone 1 R1:
 * - Feature request prompt input with character counter
 * - QUICK vs COMPLEX mode toggle with dynamic helper caption
 * - Primary submit button ("Execute SYS.REQ_COMPILER") with animated spinner
 * - Dual pipeline control group (#pipelineControlGroup): Abort Pipeline & Request New Product
 * - Error notification banner (#errorSection, #errorText)
 * - Bound to Zustand stores (useAppStore, useSessionStore)
 * - Streaming requirements generation via useApiStream & POST /api/generate-requirements
 * - Strictly emoji-free professional UI per R4
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StopCircleIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  CommandLineIcon,
  ChatBubbleLeftRightIcon,
  InformationCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { persistState, resetAllStores } from '../../stores';
import { useApiStream } from '../../hooks/useApiStream';
import { safeJsonParse } from '../../utils/jsonParser';
import type { AppMode, RequirementsDocument } from '../../types';
import { withJsonRetry, JsonParseExhaustedError } from '../../utils/jsonRetry';
import { classifyIntent } from '../../api/endpoints';

export interface FeatureRequestInputProps {
  onRequirementsGenerated?: (requirements: RequirementsDocument) => void;
  className?: string;
}

export function FeatureRequestInput({
  onRequirementsGenerated,
  className = '',
}: FeatureRequestInputProps) {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // Store bindings
  const storeMode = useAppStore((s) => s.mode);
  const storeGenerationMode = useAppStore((s) => s.generationMode || s.mode);
  const storeFeatureRequest = useAppStore((s) => s.featureRequest);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);
  const storePipelineActive = useAppStore((s) => s.pipelineActive);
  const storeInFlightPhase = useAppStore((s) => s.inFlightPhase);
  const storeIsPaused = useAppStore((s) => s.isPaused);

  const mode = isSSR ? (liveStore?.mode ?? storeMode) : storeMode;
  const generationMode = isSSR ? (liveStore?.generationMode ?? liveStore?.mode ?? storeGenerationMode) : storeGenerationMode;
  const featureRequest = isSSR ? (liveStore?.featureRequest ?? storeFeatureRequest) : storeFeatureRequest;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? storePipelineStatus) : storePipelineStatus;
  const pipelineActive = isSSR ? (liveStore?.pipelineActive ?? storePipelineActive) : storePipelineActive;
  const inFlightPhase = isSSR ? (liveStore?.inFlightPhase ?? storeInFlightPhase) : storeInFlightPhase;
  const isPaused = isSSR ? (liveStore?.isPaused ?? storeIsPaused) : storeIsPaused;

  const setMode = useAppStore((s) => s.setMode);
  const setGenerationMode = useAppStore((s) => s.setGenerationMode);
  const setFeatureRequest = useAppStore((s) => s.setFeatureRequest);
  const setPipelineStatus = useAppStore((s) => s.setPipelineStatus);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);
  const setRequirements = useAppStore((s) => s.setRequirements);
  const setStepper = useAppStore((s) => s.setStepper);
  const startPipeline = useAppStore((s) => s.startPipeline);
  const abortPipeline = useAppStore((s) => s.abortPipeline);
  const retryDevelopment = useAppStore((s) => s.retryDevelopment);
  const isClassifyingIntent = useAppStore((s) => s.isClassifyingIntent);
  const setIsClassifyingIntent = useAppStore((s) => s.setIsClassifyingIntent);
  const clarificationState = useAppStore((s) => s.clarificationState);
  const setClarificationState = useAppStore((s) => s.setClarificationState);
  const directAnswer = useAppStore((s) => s.directAnswer);
  const setDirectAnswer = useAppStore((s) => s.setDirectAnswer);
  const clearIntentGate = useAppStore((s) => s.clearIntentGate);
  const resetIntentState = useAppStore((s) => s.resetIntentState);
  const setIntentClassification = useAppStore((s) => s.setIntentClassification);

  // Local state
  const [inputText, setInputText] = useState<string>(featureRequest || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAbortModal, setShowAbortModal] = useState<boolean>(false);
  const [clarificationAnswers, setClarificationAnswers] = useState<string[]>([]);
  const MAX_CLARIFICATION_ROUNDS = 2;

  // Stream hook for requirements generation
  const { isStreaming, startStream, abort } = useApiStream();

  // Sync external featureRequest changes to local state
  useEffect(() => {
    if (featureRequest !== inputText) {
      setInputText(featureRequest || '');
    }
  }, [featureRequest]);

  // Mode change handler
  const handleModeChange = useCallback(
    (newMode: AppMode) => {
      if (pipelineActive || pipelineStatus === 'aborted') return; // Disallow mode change while pipeline is active or aborted
      setMode(newMode);
      setGenerationMode(newMode);
    },
    [pipelineActive, pipelineStatus, setMode, setGenerationMode]
  );

  // Reset / Request New Product handler
  const handleNewProduct = useCallback(() => {
    try {
      abort();
    } catch {
      // ignore
    }
    resetAllStores();
    resetIntentState();
    clearIntentGate();
    setClarificationAnswers([]);
    setInputText('');
    setErrorMessage(null);
  }, [abort, resetIntentState, clearIntentGate]);

  // Abort execution logic
  const handleConfirmAbort = useCallback(() => {
    setShowAbortModal(false);
    try {
      abort();
      useSessionStore.getState().cancelCountdown();
    } catch {
      // ignore
    }
    abortPipeline('User clicked Abort Development');
    persistState(true);
  }, [abort, abortPipeline]);

  // Core requirements generation execution
  const executeRequirementsGeneration = useCallback(
    async (promptText: string) => {
      // Create and bind AbortController in sessionStore
      const abortCtrl = useSessionStore.getState().createAbortController();

      const reqIntervalId = useAppStore.getState().startTimelineInterval({
        phase: 'requirements',
        stageName: 'Requirements Analysis',
        label: 'Requirements',
      });

      try {
        const activeMode = generationMode || mode || 'QUICK';
        const setJsonRetryState = useAppStore.getState().setJsonRetryState;
        const parsed = await withJsonRetry(
          async (opts) => {
            const bodyPayload: any = { feature_request: promptText, mode: activeMode };
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

        // Trigger callback if provided
        if (onRequirementsGenerated) {
          onRequirementsGenerated(reqDoc);
        }
      } catch (err: any) {
        useAppStore.getState().setRawStreamText('');
        useAppStore.getState().setJsonRetryState(null);
        useAppStore.getState().completeTimelineInterval(reqIntervalId, { status: 'failed' });
        if (err instanceof JsonParseExhaustedError) {
          setErrorMessage(err.message);
          setStepper(1, 'error');
          setPipelineStatus('idle');
          useAppStore.getState().setPipelineActive(false);
          persistState(true);
          return;
        }
        const isAbortedCleanly =
          err?.name === 'AbortError' ||
          abortCtrl.signal.aborted ||
          useAppStore.getState().pipelineStatus === 'aborted' ||
          useSessionStore.getState().isAborted;

        if (isAbortedCleanly) {
          console.info('[FeatureRequestInput] Requirements generation aborted.');
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(`Phase 1 Failed: ${msg}`);
        setStepper(1, 'error');
        setPipelineStatus('idle');
        useAppStore.getState().setPipelineActive(false);
        persistState(true);
      }
    },
    [
      generationMode,
      mode,
      startStream,
      setRequirements,
      setStepper,
      setInFlightPhase,
      setPipelineStatus,
      onRequirementsGenerated,
    ]
  );

  // Submit & Requirements generation handler (with Intent Gate)
  const handleGenerateRequirements = useCallback(async () => {
    const trimmedInput = inputText.trim();
    if (!trimmedInput) {
      setErrorMessage('Please enter a feature request.');
      return;
    }

    setErrorMessage(null);
    setFeatureRequest(trimmedInput);
    setIsClassifyingIntent(true);

    try {
      // Build context from any previous clarification answers
      let context: string | null = null;
      if (clarificationState && clarificationState.answers.some((a) => a.trim())) {
        context = clarificationState.questions
          .map((q, i) => `Q: ${q}\nA: ${clarificationState.answers[i] || '(no answer)'}`)
          .join('\n\n');
      }

      const classification = await classifyIntent({
        prompt: trimmedInput,
        mode: generationMode || mode || 'QUICK',
        context,
      });

      setIsClassifyingIntent(false);
      setIntentClassification(classification);

      if (classification.intent === 'software_request') {
        clearIntentGate();
        setClarificationAnswers([]);
        startPipeline();
        persistState(true);
        await executeRequirementsGeneration(trimmedInput);
      } else if (classification.intent === 'ambiguous') {
        const currentRound = clarificationState?.round ?? 0;
        const questions = classification.follow_up_questions || [
          'Could you describe what software application you want built?',
          'What platform or framework would you prefer (e.g., React web app or Python CLI)?',
        ];
        setClarificationState({
          originalPrompt: trimmedInput,
          questions,
          answers: [],
          round: currentRound + 1,
          classifierResponse: classification,
        });
        setClarificationAnswers(new Array(questions.length).fill(''));
      } else if (classification.intent === 'not_software') {
        setDirectAnswer(classification.direct_answer || classification.reasoning);
      }
    } catch (err: any) {
      setIsClassifyingIntent(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('400')) {
        setErrorMessage(msg);
        return;
      }
      console.warn('[FeatureRequestInput] Intent classifier fallback, proceeding:', msg);
      clearIntentGate();
      setClarificationAnswers([]);
      startPipeline();
      persistState(true);
      await executeRequirementsGeneration(trimmedInput);
    }
  }, [
    inputText,
    clarificationState,
    generationMode,
    mode,
    setFeatureRequest,
    startPipeline,
    executeRequirementsGeneration,
    setIsClassifyingIntent,
    setIntentClassification,
    setClarificationState,
    setDirectAnswer,
    clearIntentGate,
  ]);

  // Proceed anyway handler (bypasses intent gate)
  const handleProceedAnyway = useCallback(async () => {
    const prompt = clarificationState?.originalPrompt || inputText.trim();
    clearIntentGate();
    setClarificationAnswers([]);
    setFeatureRequest(prompt);
    startPipeline();
    persistState(true);
    await executeRequirementsGeneration(prompt);
  }, [
    clarificationState,
    inputText,
    clearIntentGate,
    setFeatureRequest,
    startPipeline,
    executeRequirementsGeneration,
  ]);

  // Submit clarification handler (submits answers back to classifier)
  const handleSubmitClarification = useCallback(async () => {
    if (!clarificationState) return;

    setIsClassifyingIntent(true);
    try {
      const context = clarificationState.questions
        .map((q, i) => `Q: ${q}\nA: ${clarificationAnswers[i] || '(not answered)'}`)
        .join('\n\n');

      const classification = await classifyIntent({
        prompt: clarificationState.originalPrompt,
        mode: generationMode || mode || 'QUICK',
        context,
      });

      setIsClassifyingIntent(false);
      setIntentClassification(classification);

      if (classification.intent === 'software_request') {
        clearIntentGate();
        setClarificationAnswers([]);
        setFeatureRequest(clarificationState.originalPrompt);
        startPipeline();
        persistState(true);
        await executeRequirementsGeneration(clarificationState.originalPrompt);
      } else if (classification.intent === 'ambiguous') {
        const nextRound = clarificationState.round + 1;
        const questions = classification.follow_up_questions || clarificationState.questions;
        setClarificationState({
          ...clarificationState,
          round: nextRound,
          answers: [...clarificationAnswers],
          classifierResponse: classification,
          questions,
        });
        setClarificationAnswers(new Array(questions.length).fill(''));
      } else if (classification.intent === 'not_software') {
        setClarificationState(null);
        setClarificationAnswers([]);
        setDirectAnswer(classification.direct_answer || classification.reasoning);
      }
    } catch {
      setIsClassifyingIntent(false);
      handleProceedAnyway();
    }
  }, [
    clarificationState,
    clarificationAnswers,
    generationMode,
    mode,
    handleProceedAnyway,
    setIsClassifyingIntent,
    setIntentClassification,
    setClarificationState,
    setDirectAnswer,
    clearIntentGate,
    setFeatureRequest,
    startPipeline,
    executeRequirementsGeneration,
  ]);

  const handleDismissDirectAnswer = useCallback(() => {
    clearIntentGate();
  }, [clearIntentGate]);

  const handleCancelClarification = useCallback(() => {
    clearIntentGate();
    setClarificationAnswers([]);
  }, [clearIntentGate]);

  // Restart Development handler (Reimplements legacy retryDevelopment)
  const isRestartingRef = useRef<boolean>(false);
  const handleRestartDevelopment = useCallback(async (alreadyReset: boolean = false) => {
    if (isRestartingRef.current) return;
    const promptToUse = (
      inputText ||
      featureRequest ||
      useAppStore.getState().featureRequest ||
      ''
    ).trim();
    if (!promptToUse) {
      setErrorMessage('Please enter a feature request to restart development.');
      return;
    }

    isRestartingRef.current = true;
    setErrorMessage(null);
    setInputText(promptToUse);

    // Cleanly abort background listeners & cancel any running countdown
    try {
      abort();
    } catch {
      // ignore
    }
    try {
      useSessionStore.getState().cancelCountdown();
    } catch {
      // ignore
    }

    // Reset store state while preserving prompt and mode if not already reset by event dispatcher
    if (!alreadyReset) {
      useAppStore.getState().resetTimelineMetrics();
      retryDevelopment();
      persistState(true);
    }

    try {
      // Re-execute pipeline starting from requirements
      await executeRequirementsGeneration(promptToUse);
    } finally {
      isRestartingRef.current = false;
    }
  }, [
    inputText,
    featureRequest,
    abort,
    retryDevelopment,
    executeRequirementsGeneration,
  ]);

  // Event listener for autodev:restart-development
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRestartEvent = () => {
      handleRestartDevelopment(true);
    };
    window.addEventListener('autodev:restart-development', onRestartEvent);
    return () => {
      window.removeEventListener('autodev:restart-development', onRestartEvent);
    };
  }, [handleRestartDevelopment]);

  // Click handler for Abort / Restart button
  const handleAbortBtnClick = useCallback(() => {
    if (pipelineStatus === 'aborted' || pipelineStatus === 'completed') {
      handleRestartDevelopment();
    } else {
      setShowAbortModal(true);
    }
  }, [pipelineStatus, handleRestartDevelopment]);

  // Window bridge for legacy script blocks in backend/index.html & automated tests
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).generateRequirements = handleGenerateRequirements;
      (window as any).abortDevelopment = handleConfirmAbort;
      (window as any).requestNewProduct = handleNewProduct;
      (window as any).retryDevelopment = handleRestartDevelopment;
      (window as any).restartDevelopment = handleRestartDevelopment;
      (window as any).setGenerationMode = handleModeChange;
    }
  }, [
    handleGenerateRequirements,
    handleConfirmAbort,
    handleNewProduct,
    handleRestartDevelopment,
    handleModeChange,
  ]);

  const isSubmitting = isStreaming || isClassifyingIntent || (pipelineStatus === 'running' && inFlightPhase === 'requirements');
  const isAborted = pipelineStatus === 'aborted';
  const isCompleted = pipelineStatus === 'completed';
  const showClarification = clarificationState !== null;
  const showDirectAnswer = directAnswer !== null;
  const showControlGroup = pipelineActive || isAborted || isCompleted;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Outer Input Card */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-6 space-y-4 backdrop-blur-xl transition-colors">
        {/* Top Header with Generation Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pb-4 border-b border-slate-100 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <CommandLineIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <label
                htmlFor="featureRequest"
                className="font-bold text-slate-800 dark:text-slate-100 text-base"
              >
                Enter Feature Request:
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                ({inputText.length} characters)
              </span>
            </div>
            <p
              id="modeHelperText"
              className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1"
            >
              <span>
                <strong className="font-semibold text-slate-700 dark:text-slate-200">
                  Autonomous Engine:
                </strong>{' '}
                Powered by Gemini 3.5 Flash Lite with 3.1 Flash Lite secondary fallback.
              </span>
            </p>
          </div>
        </div>

        {/* Feature Request Textarea */}
        <textarea
          id="featureRequest"
          rows={4}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            if (errorMessage) setErrorMessage(null);
            if (showClarification) {
              setClarificationState(null);
              setClarificationAnswers([]);
            }
            if (showDirectAnswer) {
              setDirectAnswer(null);
            }
          }}
          disabled={pipelineActive || isSubmitting}
          className={`w-full rounded-xl border border-slate-300 dark:border-white/10 p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-indigo-500 dark:focus:border-indigo-500 outline-none transition-all bg-slate-50/50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm leading-relaxed ${
            isClassifyingIntent ? 'ring-2 ring-blue-400/50 animate-pulse' : ''
          }`}
          placeholder="E.g., Build an email notification system for successful purchases with user preferences, SMTP integration, and scheduled digest reports..."
        />

        {/* Intent Classification: Clarification Card */}
        {showClarification && (
          <div
            id="clarificationCard"
            className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-700/50 rounded-xl p-5 space-y-4 animate-fadeIn"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-700/40">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                  Clarification Required
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  I want to make sure I build exactly what you need. Could you clarify a few details?
                  {clarificationState!.round > MAX_CLARIFICATION_ROUNDS && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">
                      (Maximum clarification rounds reached. You can proceed directly.)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {clarificationState!.questions.map((question, idx) => (
                <div key={idx} className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
                    {question}
                  </label>
                  <input
                    type="text"
                    value={clarificationAnswers[idx] || ''}
                    onChange={(e) => {
                      const updated = [...clarificationAnswers];
                      updated[idx] = e.target.value;
                      setClarificationAnswers(updated);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmitClarification();
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 dark:border-white/10 px-3.5 py-2 text-sm bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                    placeholder="Provide additional details..."
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                type="button"
                id="submitClarificationBtn"
                onClick={handleSubmitClarification}
                disabled={isClassifyingIntent}
                className="w-full sm:flex-1 font-semibold py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors flex justify-center items-center gap-2 shadow-sm cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClassifyingIntent ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Classifying...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightIcon className="w-4 h-4" />
                    <span>Submit Clarification</span>
                  </>
                )}
              </button>
              <button
                type="button"
                id="proceedAnywayBtn"
                onClick={handleProceedAnyway}
                className={`w-full sm:w-auto font-medium py-2.5 px-4 rounded-xl border transition-colors cursor-pointer active:scale-[0.99] ${
                  clarificationState!.round >= MAX_CLARIFICATION_ROUNDS
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-md ring-2 ring-blue-500/50 font-semibold'
                    : 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/10'
                }`}
              >
                Proceed Anyway
              </button>
              <button
                type="button"
                id="cancelClarificationBtn"
                onClick={handleCancelClarification}
                className="w-full sm:w-auto font-medium py-2.5 px-4 rounded-xl bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer active:scale-[0.99]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Intent Classification: Direct Answer Card */}
        {showDirectAnswer && (
          <div
            id="directAnswerCard"
            className="bg-sky-50/60 dark:bg-sky-950/30 border border-sky-300/80 dark:border-sky-700/50 rounded-xl p-5 space-y-3 animate-fadeIn"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center shrink-0 border border-sky-200 dark:border-sky-700/40">
                <InformationCircleIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                  Non-Software Query Answer
                </h4>
                <div className="text-sm text-slate-800 dark:text-slate-100 mt-2 p-3 bg-white/80 dark:bg-slate-900/60 rounded-lg border border-sky-200/50 dark:border-sky-800/40 leading-relaxed font-mono text-xs">
                  {directAnswer}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5">
                  AutoDev builds complete software systems. To build an application for this, describe the software tool or feature you want created.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                id="dismissDirectAnswerBtn"
                onClick={handleDismissDirectAnswer}
                className="font-medium text-xs py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer active:scale-[0.99] shadow-sm"
              >
                Got it, let me rephrase
              </button>
              <button
                type="button"
                id="buildAnywayBtn"
                onClick={() => {
                  const prompt = inputText.trim();
                  clearIntentGate();
                  setClarificationAnswers([]);
                  setFeatureRequest(prompt);
                  startPipeline();
                  persistState(true);
                  executeRequirementsGeneration(prompt);
                }}
                className="font-medium text-xs py-2 px-4 rounded-xl bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-white/10 transition-colors cursor-pointer active:scale-[0.99]"
              >
                Build it anyway
              </button>
            </div>
          </div>
        )}

        {/* Primary Submit Button (Shown when pipeline is NOT active/aborted) */}
        {!showControlGroup && (
          <button
            type="button"
            id="submitBtn"
            onClick={handleGenerateRequirements}
            disabled={isSubmitting || !inputText.trim() || showClarification || showDirectAnswer}
            className={`w-full font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 shadow-sm text-white ${
              isSubmitting || !inputText.trim() || showClarification || showDirectAnswer
                ? 'bg-blue-600/60 dark:bg-blue-600/40 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] cursor-pointer'
            }`}
          >
            <span>
              {isClassifyingIntent
                ? 'Analyzing request...'
                : 'Execute SYS.REQ_COMPILER (v1.3.0)'}
            </span>
            {isSubmitting && (
              <svg
                id="spinner"
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
          </button>
        )}

        {/* Dual Pipeline Control Group (Shown when pipeline IS active, aborted, or completed) */}
        {showControlGroup && (
          <div
            id="pipelineControlGroup"
            className={`w-full flex flex-col gap-3 animate-fadeIn ${
              ((pipelineActive || pipelineStatus === 'running' || isPaused) && !isAborted && !isCompleted) ? 'hidden' : ''
            }`}
          >
            {/* Aborted State Banner */}
            {isAborted && (
              <div
                id="abortedStatusBanner"
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>Development Aborted</span>
                </div>
                <span className="text-slate-400 dark:text-slate-500 font-normal">
                  Click Restart Development to resume from requirements.
                </span>
              </div>
            )}

            {/* Completed State Banner */}
            {isCompleted && (
              <div
                id="completedStatusBanner"
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Product Development Completed</span>
                </div>
                <span className="text-slate-400 dark:text-slate-500 font-normal">
                  Click Restart Development to re-run or Request New Product to start fresh.
                </span>
              </div>
            )}

            <div className="w-full flex flex-col sm:flex-row items-center gap-3">
              {/* Abort / Restart Development Button */}
              <button
                id="abortDevBtn"
                type="button"
                onClick={handleAbortBtnClick}
                className={`w-full sm:w-1/2 font-semibold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-sm focus:outline-none cursor-pointer active:scale-[0.99] text-white ${
                  isAborted || isCompleted
                    ? 'bg-amber-500 hover:bg-amber-600 focus:ring-2 focus:ring-amber-400'
                    : 'bg-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-500'
                }`}
              >
                {isAborted || isCompleted ? (
                  <ArrowPathIcon className="w-5 h-5 text-white" />
                ) : (
                  <StopCircleIcon className="w-5 h-5 text-white" />
                )}
                <span id="abortDevBtnText">
                  {isAborted || isCompleted ? 'Restart Development' : 'Abort Development'}
                </span>
              </button>

              {/* Request New Product Button */}
              <button
                id="requestNewProductBtn"
                type="button"
                onClick={handleNewProduct}
                className="w-full sm:w-1/2 bg-slate-700 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold py-3 px-4 rounded-xl border border-slate-600 transition-colors flex justify-center items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 active:scale-[0.99] cursor-pointer"
              >
                <ArrowPathIcon className="w-5 h-5 text-slate-300" />
                <span>Request New Product</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Abort Confirmation Dialog Modal */}
      {showAbortModal && (
        <div
          id="abortConfirmModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="abortConfirmTitle"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
        >
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                <StopCircleIcon className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3
                  id="abortConfirmTitle"
                  className="text-lg font-bold text-white leading-tight"
                >
                  Abort Development?
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Action requires confirmation
                </p>
              </div>
            </div>

            <p id="abortConfirmMessage" className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to abort the current development process? All in-progress generation will be halted immediately. You can restart development or request a new product at any time.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                id="cancelAbortBtn"
                type="button"
                onClick={() => setShowAbortModal(false)}
                className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-600"
              >
                Cancel
              </button>
              <button
                id="confirmAbortBtn"
                type="button"
                onClick={handleConfirmAbort}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <StopCircleIcon className="w-4 h-4" />
                <span>Yes, Abort Development</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMessage && (
        <div
          id="errorSection"
          className="bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3 transition-colors"
        >
          <ExclamationCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p id="errorText" className="text-red-700 dark:text-red-300 font-medium text-sm">
            {errorMessage}
          </p>
        </div>
      )}
    </div>
  );
}

export default FeatureRequestInput;
