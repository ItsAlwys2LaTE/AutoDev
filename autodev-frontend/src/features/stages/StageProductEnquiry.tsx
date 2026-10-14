import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRightIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  CpuChipIcon,
  DocumentTextIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { productEnquiry } from '../../api/endpoints';
import { persistState } from '../../stores';
import { useApiStream } from '../../hooks/useApiStream';
import { withJsonRetry } from '../../utils/jsonRetry';
import { safeJsonParse } from '../../utils/jsonParser';
import type { RequirementsDocument, ProductEnquiryResponse } from '../../types';
import { ScrollFade } from '../../components/ScrollFade';

export interface StageProductEnquiryProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageProductEnquiry: React.FC<StageProductEnquiryProps> = ({
  onAdvance,
  className = '',
}) => {
  const featureRequest = useAppStore((s) => s.featureRequest);
  const generationMode = useAppStore((s) => s.generationMode);
  const productEnquiryResult = useAppStore((s) => s.productEnquiryResult);
  const setProductEnquiryResult = useAppStore((s) => s.setProductEnquiryResult);
  const productEnquiryAnswers = useAppStore((s) => s.productEnquiryAnswers);
  const setProductEnquiryAnswers = useAppStore((s) => s.setProductEnquiryAnswers);
  const productEnquiryAdditionalNotes = useAppStore((s) => s.productEnquiryAdditionalNotes);
  const setProductEnquiryAdditionalNotes = useAppStore((s) => s.setProductEnquiryAdditionalNotes);
  const isEnquiring = useAppStore((s) => s.isEnquiring);
  const setIsEnquiring = useAppStore((s) => s.setIsEnquiring);

  const startPipeline = useAppStore((s) => s.startPipeline);
  const setRequirements = useAppStore((s) => s.setRequirements);
  const setStepper = useAppStore((s) => s.setStepper);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);

  const { startStream } = useApiStream();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAnswers, setLocalAnswers] = useState<string[]>(productEnquiryAnswers || []);
  const [localNotes, setLocalNotes] = useState<string>(productEnquiryAdditionalNotes || '');

  const questions = productEnquiryResult?.follow_up_questions || [];

  // Fetch product enquiry when stage loads or featureRequest is present
  const fetchEnquiry = useCallback(async (promptText: string) => {
    if (!promptText.trim()) return;
    setIsEnquiring(true);
    let enquiryContext: string | undefined;
    try {
      const { useAuthStore } = await import('../../stores/authStore');
      const auth = useAuthStore.getState();
      if (auth.isAuthenticated && auth.user) {
        const parts: string[] = [];
        const personalizedPrompt = auth.user.dev_preferences?.personalized_prompt?.trim();
        if (personalizedPrompt) {
          parts.push(`User Persistent Development Preferences:\n${personalizedPrompt}`);
        }
        const defaultFramework = auth.user.dev_preferences?.default_framework;
        if (defaultFramework && defaultFramework !== 'auto') {
          parts.push(`Preferred Tech Stack: ${defaultFramework}`);
        }
        if (parts.length > 0) {
          enquiryContext = parts.join('\n\n');
        }
      }
    } catch {
      // Non-blocking fallback
    }

    try {
      const result = await productEnquiry({
        prompt: promptText.trim(),
        mode: generationMode || 'QUICK',
        context: enquiryContext,
      });
      setProductEnquiryResult(result);
      const initialAnswers = new Array((result.follow_up_questions || []).length).fill('');
      setLocalAnswers(initialAnswers);
      setProductEnquiryAnswers(initialAnswers);
    } catch (err: any) {
      console.warn('[StageProductEnquiry] Failed to fetch product enquiry:', err);
      const isLikelyNonSoftware = /^(what|who|where|when|why|how|distance|difference|capital|weather|temperature|tell me|calculate|convert)\b/i.test(promptText.trim());
      if (isLikelyNonSoftware) {
        const nonSwResult: ProductEnquiryResponse = {
          understanding_summary: `Non-software query detected: ${promptText}`,
          implementation_strategy: 'AutoDev is an automated software engineering platform and cannot develop non-software queries.',
          is_valid_software: false,
          intent: 'not_software',
          follow_up_questions: [],
          assumptions: [],
          direct_answer: 'Factual or conversational query detected. AutoDev is designed to build software applications. Please describe a software tool or application to develop.',
        };
        setProductEnquiryResult(nonSwResult);
      } else {
        const fallbackResult: ProductEnquiryResponse = {
          understanding_summary: `Software application request: ${promptText}`,
          implementation_strategy: 'AutoDev will analyze requirements, architect components, generate full-stack code, and execute verification tests.',
          is_valid_software: true,
          intent: 'software_request',
          follow_up_questions: [],
          assumptions: ['Standard modular software architecture will be applied.'],
          direct_answer: null,
        };
        setProductEnquiryResult(fallbackResult);
      }
      setLocalAnswers([]);
      setProductEnquiryAnswers([]);
    } finally {
      setIsEnquiring(false);
    }
  }, [generationMode, setIsEnquiring, setProductEnquiryResult, setProductEnquiryAnswers]);

  useEffect(() => {
    if (!productEnquiryResult && featureRequest && !isEnquiring) {
      fetchEnquiry(featureRequest);
    }
  }, [productEnquiryResult, featureRequest, isEnquiring, fetchEnquiry]);

  // Keep local answers synced if questions change
  useEffect(() => {
    if (questions.length > 0 && localAnswers.length !== questions.length) {
      const updated = new Array(questions.length).fill('');
      for (let i = 0; i < Math.min(localAnswers.length, questions.length); i++) {
        updated[i] = localAnswers[i];
      }
      setLocalAnswers(updated);
    }
  }, [questions.length]);

  const handleAnswerChange = (index: number, val: string) => {
    setLocalAnswers((prev) => {
      const next = [...prev];
      next[index] = val;
      setProductEnquiryAnswers(next);
      return next;
    });
  };

  const handleNotesChange = (val: string) => {
    setLocalNotes(val);
    setProductEnquiryAdditionalNotes(val);
  };

  // Execution handoff to Requirements Agent (Stage 3)
  const executeRequirementsGeneration = async (
    promptText: string,
    enquirySummary: string,
    responses: Array<{ question: string; answer: string }>,
    enquiryContext: string
  ) => {
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
          const bodyPayload: any = {
            feature_request: promptText,
            mode: generationMode || 'QUICK',
            product_enquiry_summary: enquirySummary,
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
      useAppStore.getState().unlockStage(4);
      persistState(true);
    } catch (err: any) {
      useAppStore.getState().setRawStreamText('');
      useAppStore.getState().setJsonRetryState(null);
      useAppStore.getState().completeTimelineInterval(reqIntervalId, { status: 'failed' });
      const errText = err?.message || 'Failed to generate requirements';
      setError(errText);
      try {
        useSessionStore.getState().showErrorToast(errText, 'Requirements Analysis Failed');
      } catch { /* ignore */ }
    }
  };

  const handleProceedToRequirements = async () => {
    setIsSubmitting(true);
    setError(null);

    const promptText = featureRequest || '';
    const summary = productEnquiryResult
      ? `${productEnquiryResult.understanding_summary}\n\nProposed Implementation Plan:\n${productEnquiryResult.implementation_strategy}`
      : '';

    const responses: Array<{ question: string; answer: string }> = [];
    questions.forEach((q, idx) => {
      const ans = localAnswers[idx]?.trim();
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
    if (localNotes.trim()) {
      contextParts.push(`Additional User Preferences:\n${localNotes.trim()}`);
    }
    const enquiryContext = contextParts.join('\n\n');

    startPipeline();
    useAppStore.getState().unlockStage(3);
    persistState(true);
    onAdvance(3);

    executeRequirementsGeneration(promptText, summary, responses, enquiryContext);
  };

  const handleReturnToRequest = () => {
    setProductEnquiryResult(null);
    setProductEnquiryAnswers([]);
    setProductEnquiryAdditionalNotes('');
    onAdvance(1);
  };

  if (isEnquiring) {
    return (
      <div
        id="stageProductEnquiryLoading"
        className={`h-full flex flex-col items-center justify-center max-w-xl mx-auto px-4 py-8 text-center select-none space-y-5 ${className}`}
      >
        <div className="w-14 h-14 rounded-2xl bg-white/[0.08] border border-white/20 flex items-center justify-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]">
          <ArrowPathIcon className="w-7 h-7 animate-spin" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold text-white tracking-tight">
            Product Enquiry Agent Analyzing Request
          </h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            Synthesizing system understanding, outlining the proposed implementation strategy, and identifying potential functional ambiguities.
          </p>
        </div>
      </div>
    );
  }

  if (!featureRequest && !productEnquiryResult) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none space-y-4">
        <p className="text-slate-400 text-sm">No product request is currently active.</p>
        <button
          type="button"
          onClick={() => onAdvance(1)}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 shadow-sm cursor-pointer transition-all"
        >
          Return to Product Request
        </button>
      </div>
    );
  }

  const isInvalidSoftware = Boolean(
    productEnquiryResult &&
    (!productEnquiryResult.is_valid_software || productEnquiryResult.intent === 'not_software')
  );

  if (isInvalidSoftware) {
    return (
      <div
        id="stageProductEnquiryInvalid"
        className={`h-full flex flex-col justify-center max-w-xl mx-auto px-4 py-6 select-none space-y-6 ${className}`}
      >
        <div className="space-y-2 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight text-center">
            Non-Software Query Detected
          </h2>
          <p className="text-xs md:text-sm text-slate-300 text-center max-w-xl mx-auto">
            AutoDev is an automated software engineering platform designed exclusively to architect, generate, and verify software codebases. Non-software queries cannot proceed to development.
          </p>
        </div>

        <div
          className="rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-4"
          style={{ backdropFilter: 'blur(14px)' }}
        >
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
              Query Response & Reason
            </h4>
            <div className="p-4 rounded-2xl bg-black/25 backdrop-blur-xl border border-white/[0.07] text-sm text-slate-200 leading-relaxed font-sans">
              {productEnquiryResult?.direct_answer ||
                productEnquiryResult?.understanding_summary ||
                'The provided prompt appears to be a factual, scientific, or conversational query rather than an actionable software development request.'}
            </div>
            {productEnquiryResult?.understanding_summary &&
              productEnquiryResult?.direct_answer &&
              productEnquiryResult.understanding_summary !== productEnquiryResult.direct_answer && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed">
                  <span className="font-semibold text-amber-300">Reason:</span>{' '}
                  {productEnquiryResult.understanding_summary}
                </div>
              )}
          </div>

          <div className="flex items-center justify-center pt-4 border-t border-white/[0.07]">
            <button
              type="button"
              id="rephraseRequestBtn"
              onClick={handleReturnToRequest}
              className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              Rephrase Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollFade
      id="stageProductEnquiry"
      className={`h-full flex flex-col justify-start max-w-3xl mx-auto px-4 py-6 select-none space-y-6 overflow-y-auto ${className}`}
    >
      {/* Top Header */}
      <div className="space-y-1.5">
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Product Enquiry & Architecture Scope
        </h2>
        <p className="text-xs md:text-sm text-slate-300">
          Review our understanding of your software request, our planned implementation strategy, and answer clarifying questions before engineering begins.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Grid of Understanding & Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Understanding Card */}
        <div
          className="rounded-2xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-2"
          style={{ backdropFilter: 'blur(14px)' }}
        >
          <div className="flex items-center gap-2 text-white">
            <CpuChipIcon className="w-4 h-4" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Product Understanding
            </h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {productEnquiryResult?.understanding_summary ||
              `Automated software development for: ${featureRequest}`}
          </p>
        </div>

        {/* Implementation Strategy Card */}
        <div
          className="rounded-2xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-2"
          style={{ backdropFilter: 'blur(14px)' }}
        >
          <div className="flex items-center gap-2 text-white">
            <LightBulbIcon className="w-4 h-4" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Planned Implementation Strategy
            </h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {productEnquiryResult?.implementation_strategy ||
              'AutoDev will architect modular components, synthesize backend and frontend files, and execute automated verification tests.'}
          </p>
        </div>
      </div>

      {/* Assumptions List (if any) */}
      {productEnquiryResult?.assumptions && productEnquiryResult.assumptions.length > 0 && (
        <div
          className="rounded-2xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-2"
          style={{ backdropFilter: 'blur(14px)' }}
        >
          <div className="flex items-center gap-2 text-slate-400">
            <DocumentTextIcon className="w-3.5 h-3.5" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Default Engineering Assumptions
            </h4>
          </div>
          <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
            {productEnquiryResult.assumptions.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Questions Section */}
      <div
        className="rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-5"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="border-b border-white/[0.07] pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">
              {questions.length > 0
                ? `Clarifying Questions (${questions.length})`
                : 'Specification Completeness'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {questions.length > 0
                ? 'Answering these questions minimizes assumptions before the Requirements Agent drafts technical acceptance criteria.'
                : 'Your prompt contains sufficient clarity. No clarifying questions required.'}
            </p>
          </div>
        </div>

        {questions.length > 0 ? (
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={idx} className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200">
                  {idx + 1}. {q}
                </label>
                <input
                  type="text"
                  value={localAnswers[idx] || ''}
                  onChange={(e) => handleAnswerChange(idx, e.target.value)}
                  placeholder="Provide your preference or leave blank for default assumption..."
                  disabled={isSubmitting}
                  className="w-full bg-slate-950/[0.25] border border-white/[0.07] focus:border-white/20 focus:ring-1 focus:ring-white/10 rounded-xl p-3 text-xs md:text-sm text-white placeholder-white/40 focus:outline-none transition-colors"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center gap-3 text-slate-200 text-xs">
            <CheckCircleIcon className="w-5 h-5 text-slate-300 shrink-0" />
            <span>
              Your product request has been clearly comprehended. No critical ambiguities detected. You can proceed directly to requirements analysis.
            </span>
          </div>
        )}

        {/* Additional Custom Instructions / Preferences */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-semibold text-slate-200">
            Additional Preferences or Custom Instructions (Optional)
          </label>
          <div className="rounded-xl border border-white/[0.07] bg-slate-950/[0.25] backdrop-blur-md p-1 focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all overflow-hidden">
            <ScrollFade fadeSize={16} className="w-full">
              <textarea
                value={localNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="e.g. Prefer SQLite database over PostgreSQL; include JWT authentication; keep dependencies minimal..."
                rows={2}
                disabled={isSubmitting}
                className="w-full bg-transparent border-none p-2 text-xs md:text-sm text-white placeholder-white/40 focus:outline-none transition-colors resize-none"
              />
            </ScrollFade>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-white/[0.07]">
          <button
            type="button"
            onClick={handleProceedToRequirements}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs font-semibold border border-white/20 transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            {isSubmitting ? (
              <>
                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                <span>STARTING DEVELOPMENT...</span>
              </>
            ) : (
              <>
                <span>START DEVELOPMENT</span>
                <ArrowRightIcon className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </ScrollFade>
  );
};

export default StageProductEnquiry;
