import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowRightIcon,
  ArrowPathIcon,
  CpuChipIcon,
  DocumentTextIcon,
  ChatBubbleBottomCenterTextIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { productEnquiry } from '../../api/endpoints';
import { persistState } from '../../stores';
import type { ProductEnquiryResponse } from '../../types';
import { ScrollFade } from '../../components/ScrollFade';

export interface StageProductEnquiryProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

const DEFAULT_FRONTEND_QUESTIONS: string[] = [
  'What data storage or persistence mechanism do you prefer (e.g. SQLite, PostgreSQL, local files, or mock in-memory storage)?',
  'Do you require user authentication and account management (e.g. JWT login, role-based access, or open guest access)?',
  'Are there any external third-party APIs, real-time updates (WebSockets), or specific export formats required?',
];

export function deriveProductTitle(
  productEnquiryResult?: ProductEnquiryResponse | null,
  featureRequest?: string,
  projectTitle?: string
): string {
  if (productEnquiryResult?.product_title && productEnquiryResult.product_title.trim()) {
    return productEnquiryResult.product_title.trim();
  }
  if (projectTitle && projectTitle.trim()) {
    return projectTitle.trim();
  }
  if (!featureRequest || !featureRequest.trim()) {
    return 'Product Specification Request';
  }
  const clean = featureRequest.trim();
  const stripped = clean
    .replace(
      /^(please\s+)?(i\s+want\s+(to\s+)?(build|make|create|develop)?\s+(a|an|the)?|can\s+you\s+(build|make|create|develop)\s+(a|an|the)?|(build|create|develop|make)\s+(a|an|the)?)\s+/i,
      ''
    )
    .trim();

  const firstClause =
    stripped.split(/[\.\n\r;]|(?:\s+(?:with|that|where|which|featuring|for)\s+)/i)[0]?.trim() || stripped;
  const words = firstClause.split(/\s+/).filter(Boolean);
  const clampedWords = words.length > 6 ? words.slice(0, 6) : words;
  const combined = clampedWords.join(' ');

  if (combined.length > 0 && combined.length <= 45) {
    return combined
      .split(/\s+/)
      .map((w) =>
        w
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join('-')
      )
      .join(' ');
  } else if (combined.length > 45) {
    const truncated = combined.slice(0, 42).trim();
    return (
      truncated
        .split(/\s+/)
        .map((w) =>
          w
            .split('-')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('-')
        )
        .join(' ') + '...'
    );
  }
  return 'Product Specification Request';
}

export const StageProductEnquiry: React.FC<StageProductEnquiryProps> = ({
  onAdvance,
  className = '',
}) => {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const storeFeatureRequest = useAppStore((s) => s.featureRequest);
  const storeGenerationMode = useAppStore((s) => s.generationMode);
  const storeProductEnquiryResult = useAppStore((s) => s.productEnquiryResult);
  const storeProductEnquiryAnswers = useAppStore((s) => s.productEnquiryAnswers);
  const storeProductEnquiryAdditionalNotes = useAppStore((s) => s.productEnquiryAdditionalNotes);
  const storeIsEnquiring = useAppStore((s) => s.isEnquiring);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);
  const storeRequirements = useAppStore((s) => s.requirements);

  const featureRequest = isSSR ? (liveStore?.featureRequest ?? storeFeatureRequest) : storeFeatureRequest;
  const generationMode = isSSR ? (liveStore?.generationMode ?? storeGenerationMode) : storeGenerationMode;
  const productEnquiryResult = isSSR ? (liveStore?.productEnquiryResult ?? storeProductEnquiryResult) : storeProductEnquiryResult;
  const productEnquiryAnswers = isSSR ? (liveStore?.productEnquiryAnswers ?? storeProductEnquiryAnswers) : storeProductEnquiryAnswers;
  const productEnquiryAdditionalNotes = isSSR ? (liveStore?.productEnquiryAdditionalNotes ?? storeProductEnquiryAdditionalNotes) : storeProductEnquiryAdditionalNotes;
  const isEnquiring = isSSR ? (liveStore?.isEnquiring ?? storeIsEnquiring) : storeIsEnquiring;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? storePipelineStatus) : storePipelineStatus;
  const requirements = isSSR ? (liveStore?.requirements ?? storeRequirements) : storeRequirements;

  const productTitle = useMemo(() => {
    return deriveProductTitle(productEnquiryResult, featureRequest, requirements?.project_title);
  }, [productEnquiryResult, featureRequest, requirements?.project_title]);

  const setProductEnquiryResult = useAppStore((s) => s.setProductEnquiryResult);
  const setProductEnquiryAnswers = useAppStore((s) => s.setProductEnquiryAnswers);
  const setProductEnquiryAdditionalNotes = useAppStore((s) => s.setProductEnquiryAdditionalNotes);
  const setIsEnquiring = useAppStore((s) => s.setIsEnquiring);

  const startPipeline = useAppStore((s) => s.startPipeline);


  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAnswers, setLocalAnswers] = useState<string[]>(productEnquiryAnswers || []);
  const [localNotes, setLocalNotes] = useState<string>(productEnquiryAdditionalNotes || '');

  const isDevelopmentStarted = isSubmitting || (pipelineStatus !== 'idle' && pipelineStatus !== 'aborted');

  const rawQuestions = productEnquiryResult?.follow_up_questions || [];

  // Guarantee at least 3 clarifying questions for every valid software product request
  const effectiveQuestions = useMemo(() => {
    if (!productEnquiryResult || !productEnquiryResult.is_valid_software) return [];
    if (rawQuestions.length >= 3) return rawQuestions;
    const combined = [...rawQuestions];
    for (const q of DEFAULT_FRONTEND_QUESTIONS) {
      if (!combined.includes(q)) combined.push(q);
      if (combined.length >= 3) break;
    }
    return combined;
  }, [productEnquiryResult, rawQuestions]);

  const assumptions = useMemo(() => {
    const list = productEnquiryResult?.assumptions || [];
    if (list.length > 0) return list;
    return ['Standard modern modular application architecture will be utilized.'];
  }, [productEnquiryResult]);

  const answeredCount = useMemo(() => {
    return localAnswers.filter((a) => a && a.trim().length > 0).length;
  }, [localAnswers]);

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
        mode: generationMode || 'STANDARD',
        context: enquiryContext,
      });

      // Ensure minimum 3 questions on successful response
      if (result.is_valid_software) {
        const questionsList = result.follow_up_questions || [];
        if (questionsList.length < 3) {
          const padded = [...questionsList];
          for (const dq of DEFAULT_FRONTEND_QUESTIONS) {
            if (!padded.includes(dq)) padded.push(dq);
            if (padded.length >= 3) break;
          }
          result.follow_up_questions = padded;
        }
      }

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
        setLocalAnswers([]);
        setProductEnquiryAnswers([]);
      } else {
        const fallbackResult: ProductEnquiryResponse = {
          understanding_summary: `Software application request: ${promptText}`,
          implementation_strategy: 'AutoDev will analyze requirements, architect modular components, generate full-stack code, and execute verification tests.',
          is_valid_software: true,
          intent: 'ambiguous',
          follow_up_questions: [...DEFAULT_FRONTEND_QUESTIONS],
          assumptions: ['Standard modular software architecture with decoupled frontend and backend layers will be applied.'],
          direct_answer: null,
        };
        setProductEnquiryResult(fallbackResult);
        const fallbackAnswers = new Array(fallbackResult.follow_up_questions.length).fill('');
        setLocalAnswers(fallbackAnswers);
        setProductEnquiryAnswers(fallbackAnswers);
      }
    } finally {
      setIsEnquiring(false);
    }
  }, [generationMode, setIsEnquiring, setProductEnquiryResult, setProductEnquiryAnswers]);

  useEffect(() => {
    if (!productEnquiryResult && featureRequest && !isEnquiring) {
      fetchEnquiry(featureRequest);
    }
  }, [productEnquiryResult, featureRequest, isEnquiring, fetchEnquiry]);

  // Keep local answers synced if effectiveQuestions change
  useEffect(() => {
    if (effectiveQuestions.length > 0 && localAnswers.length !== effectiveQuestions.length) {
      const updated = new Array(effectiveQuestions.length).fill('');
      for (let i = 0; i < Math.min(localAnswers.length, effectiveQuestions.length); i++) {
        updated[i] = localAnswers[i] || '';
      }
      setLocalAnswers(updated);
      setProductEnquiryAnswers(updated);
    }
  }, [effectiveQuestions.length]);

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



  const handleProceedToRequirements = async () => {
    setIsSubmitting(true);
    setError(null);

    setProductEnquiryAnswers(localAnswers);
    setProductEnquiryAdditionalNotes(localNotes);

    startPipeline();
    useAppStore.getState().unlockStage(3);
    persistState(true);
    onAdvance(3);
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
        <div className="w-14 h-14 rounded-2xl bg-white/80 dark:bg-white/[0.08] border border-slate-200 dark:border-white/20 flex items-center justify-center text-slate-800 dark:text-white shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]">
          <ArrowPathIcon className="w-7 h-7 animate-spin" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Product Enquiry Agent Analyzing Request
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto">
            Synthesizing system understanding, outlining the proposed implementation strategy, and identifying potential functional ambiguities.
          </p>
        </div>
      </div>
    );
  }

  if (!featureRequest && !productEnquiryResult) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none space-y-4">
        <p className="text-slate-600 dark:text-slate-400 text-sm">No product request is currently active.</p>
        <button
          type="button"
          onClick={() => onAdvance(1)}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/10 dark:hover:bg-white/20 text-xs font-semibold border border-slate-800 dark:border-white/20 shadow-sm cursor-pointer transition-all"
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
        className={`w-full max-w-5xl mx-auto px-4 pt-2 pb-8 select-none space-y-6 ${className}`}
      >
        {/* Top Header */}
        <div className="space-y-1.5 pb-2 border-b border-slate-200 dark:border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-800 dark:text-white/90 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]">
              <ChatBubbleBottomCenterTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800 dark:text-white/90" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Product Enquiry Agent
            </h2>
          </div>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
            Interactive product discovery, clarifying questions, and strategic implementation planning before synthesizing technical specifications.
          </p>
        </div>

        {/* Executive Query Assessment Hero Card */}
        <div
          className="relative rounded-2xl bg-white/90 dark:bg-slate-950/[0.25] border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden space-y-5"
          style={{ backdropFilter: 'blur(14px)' }}
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-300/60 dark:via-white/20 to-transparent" />

          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.08] border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white font-mono text-xs font-medium">
                STAGE 02 / INTENT AUDIT
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Scope Verification
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-[11px] font-semibold uppercase tracking-wider">
              Non-Software Query
            </span>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Direct Query Response
            </h3>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/25 border border-slate-200 dark:border-white/[0.07] text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans shadow-xs">
              {productEnquiryResult?.direct_answer ||
                productEnquiryResult?.understanding_summary ||
                'The provided prompt appears to be a factual, scientific, or conversational query rather than an actionable software development request.'}
            </div>

            {productEnquiryResult?.understanding_summary &&
              productEnquiryResult?.direct_answer &&
              productEnquiryResult.understanding_summary !== productEnquiryResult.direct_answer && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  <span className="font-semibold text-amber-800 dark:text-amber-300">Technical Context:</span>{' '}
                  {productEnquiryResult.understanding_summary}
                </div>
              )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-white/[0.06]">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AutoDev is an automated software engineering platform designed to architect, generate, and verify software codebases.
            </p>
            <button
              type="button"
              id="rephraseRequestBtn"
              onClick={handleReturnToRequest}
              className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border-white/20 text-xs font-semibold shadow-sm transition-all cursor-pointer shrink-0"
            >
              Rephrase Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="stageProductEnquiry"
      className={`w-full max-w-5xl mx-auto px-4 pt-2 pb-8 select-none space-y-6 ${className}`}
    >
      {/* ── 1. Top Header (Standardized with other stages) ── */}
      <div className="space-y-1.5 pb-2 border-b border-slate-200 dark:border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-800 dark:text-white/90 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]">
            <ChatBubbleBottomCenterTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800 dark:text-white/90" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Product Enquiry Agent
          </h2>
        </div>
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
          Interactive product discovery, clarifying questions, and strategic implementation planning before synthesizing technical specifications.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* ── 2. Executive Product Understanding Hero Card (Full Width) ── */}
      <div
        className="relative rounded-2xl bg-white/90 dark:bg-slate-950/[0.25] border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden space-y-4"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-300/60 dark:via-white/20 to-transparent" />

        {/* Top Status & Discovery Category */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.08] border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white font-mono text-xs font-medium">
              STAGE 02 / ENQUIRY
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Product Discovery & Architecture Alignment
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold uppercase tracking-wider">
              Scope Synthesized
            </span>
          </div>
        </div>

        {/* Request Title & Scope Metrics Bento Chips */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 pt-1">
          <div className="space-y-2.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <CpuChipIcon className="w-5 h-5 text-slate-700 dark:text-white/80 shrink-0" />
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight break-words">
                {productTitle}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-4xl font-sans">
              {productEnquiryResult?.understanding_summary ||
                `Automated software engineering assessment for: ${productTitle}`}
            </p>
          </div>

          {/* Scope Summary Bento Chips */}
          <div className="flex sm:flex-col gap-2 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] text-center sm:text-right min-w-[120px]">
              <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                {effectiveQuestions.length}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
                Clarifying Qs
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] text-center sm:text-right min-w-[120px]">
              <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                {assumptions.length}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
                Assumptions
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Planned Implementation Architecture & Strategy Card (Full Width) ── */}
      <div
        className="relative rounded-2xl bg-white/70 dark:bg-slate-950/[0.22] hover:bg-white/90 dark:hover:bg-slate-950/[0.28] border border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/15 p-5 sm:p-6 transition-all duration-200 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] space-y-4"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.08] border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white font-mono text-xs font-medium">
              ARCHITECTURE
            </span>
            <h4 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
              Planned Implementation Strategy
            </h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Decomposition & Pipeline Blueprint
          </span>
        </div>

        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
          {productEnquiryResult?.implementation_strategy ||
            'AutoDev will analyze requirements, architect modular components, generate full-stack source files, and execute automated sandbox verification tests.'}
        </p>

        {/* Architecture Strategy Pillars Triad */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80 dark:border-white/[0.05]">
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05] space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Phase 1: Architecture
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-snug">
              Component DAG & Isolated Sandboxes
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05] space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Phase 2: Code Synthesis
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-snug">
              Multi-File Full-Stack Code Generation
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05] space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Phase 3: Verification
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-snug">
              Automated Tests & Multi-Critic Arbitration
            </p>
          </div>
        </div>
      </div>

      {/* ── 4. Default Engineering Assumptions Card (Full Width) ── */}
      {assumptions.length > 0 && (
        <div
          className="rounded-2xl bg-white/70 dark:bg-slate-950/[0.22] border border-slate-200 dark:border-white/[0.07] p-5 sm:p-6 space-y-3.5 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          style={{ backdropFilter: 'blur(14px)' }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/[0.05] pb-2.5">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
                Default Engineering Assumptions ({assumptions.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Adopted if unspecified
            </span>
          </div>

          <div className="space-y-2.5">
            {assumptions.map((item, idx) => (
              <div
                key={`assumption-${idx}`}
                className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/[0.06] flex items-start gap-3"
              >
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-slate-200 dark:bg-white/[0.08] border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white font-mono text-xs font-bold shrink-0">
                  {`A-${String(idx + 1).padStart(2, '0')}`}
                </span>
                <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed pt-0.5 flex-1 min-w-0">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Clarifying Questions Matrix (Full Width) ── */}
      <div
        className="rounded-2xl bg-white/90 dark:bg-slate-950/[0.25] border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.12)] space-y-5"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/[0.06] pb-3">
          <div className="flex items-center gap-2.5">
            <ChatBubbleBottomCenterTextIcon className="w-5 h-5 text-slate-700 dark:text-white/80" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {`Clarifying Questions Matrix (${effectiveQuestions.length})`}
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {answeredCount} of {effectiveQuestions.length} answered
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300">
          Answering these questions minimizes assumptions before the Requirements Agent drafts technical acceptance criteria. Leave blank to adopt default assumptions.
        </p>

        <div className="space-y-3.5">
          {effectiveQuestions.map((q, idx) => {
            const hasAnswer = Boolean(localAnswers[idx]?.trim());
            return (
              <div
                key={`q-${idx}`}
                className={`p-4 sm:p-5 rounded-xl bg-slate-50/80 dark:bg-black/20 border border-slate-200 dark:border-white/[0.07] space-y-3 transition-colors ${
                  isDevelopmentStarted ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-slate-200 dark:bg-white/[0.08] border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white font-mono text-xs font-bold shrink-0">
                      {`QUESTION ${String(idx + 1).padStart(2, '0')}`}
                    </span>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-relaxed pt-0.5">
                      {q}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 border ${
                      hasAnswer
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.07] text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {hasAnswer ? 'Custom Value' : 'Default Auto'}
                  </span>
                </div>
                <input
                  type="text"
                  value={localAnswers[idx] || ''}
                  onChange={(e) => handleAnswerChange(idx, e.target.value)}
                  placeholder="Provide your preference or leave blank for default assumption..."
                  disabled={isDevelopmentStarted}
                  className={`w-full bg-white dark:bg-slate-950/[0.35] border border-slate-300 dark:border-white/[0.09] focus:border-slate-500 dark:focus:border-white/25 focus:ring-1 focus:ring-slate-300 dark:focus:ring-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none transition-colors shadow-xs ${
                    isDevelopmentStarted ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-white/[0.03]' : ''
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 6. Custom Development Directives & Preferences Card (Full Width) ── */}
      <div
        className={`rounded-2xl bg-white/70 dark:bg-slate-950/[0.22] border border-slate-200 dark:border-white/[0.07] p-5 sm:p-6 space-y-3 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
          isDevelopmentStarted ? 'opacity-70' : ''
        }`}
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="flex items-center gap-2">
          <AdjustmentsHorizontalIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
            Custom Preferences & Architectural Directives (Optional)
          </span>
        </div>
        <div className={`rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-slate-950/[0.3] p-1 focus-within:border-slate-500 dark:focus-within:border-white/25 focus-within:ring-1 focus-within:ring-slate-300 dark:focus-within:ring-white/10 transition-all overflow-hidden ${
          isDevelopmentStarted ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-white/[0.03]' : ''
        }`}>
          <ScrollFade fadeSize={16} className="w-full">
            <textarea
              value={localNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="e.g. Prefer SQLite database over PostgreSQL; include JWT authentication; keep dependencies minimal..."
              rows={2}
              disabled={isDevelopmentStarted}
              className={`w-full bg-transparent border-none p-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none transition-colors resize-none ${
                isDevelopmentStarted ? 'cursor-not-allowed text-slate-500 dark:text-slate-400' : ''
              }`}
            />
          </ScrollFade>
        </div>
      </div>

      {/* ── 7. Executive Action Bar (Full Width) ── */}
      <div className="flex items-center justify-end gap-4 pt-2 pb-6">
        <button
          type="button"
          onClick={handleProceedToRequirements}
          disabled={isDevelopmentStarted}
          className={`px-7 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 shadow-sm dark:bg-white/15 dark:hover:bg-white/25 dark:text-white dark:border-white/20 text-xs font-semibold transition-all flex items-center gap-2 ${
            isDevelopmentStarted
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
          }`}
        >
          {isSubmitting ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              <span>STARTING DEVELOPMENT...</span>
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
  );
};

export default StageProductEnquiry;
