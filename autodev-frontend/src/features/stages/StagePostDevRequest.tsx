import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  BugAntIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { postCompletionQuery } from '../../api/endpoints';
import { ScrollFade } from '../../components/ScrollFade';

export type PostDevOption = 'feature' | 'bug' | 'enquiry';

export interface StagePostDevRequestProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StagePostDevRequest: React.FC<StagePostDevRequestProps> = ({
  onAdvance,
  className = '',
}) => {
  const [selectedOption, setSelectedOption] = useState<PostDevOption>('feature');
  const [prompt, setPrompt] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResponse, setQueryResponse] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentCodebase = useAppStore((s) => s.currentCodebase || s.integratedCodebase);
  const currentBlueprint = useAppStore((s) => s.currentBlueprint);
  const setStorePrompt = useAppStore((s) => s.setPostCompletionPrompt);
  const setPostCompletionMode = useAppStore((s) => s.setPostCompletionMode);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic placeholders and helper copies
  const getPlaceholder = () => {
    switch (selectedOption) {
      case 'feature':
        return 'Describe the new feature or functional capability you want to add to this application...';
      case 'bug':
        return 'Describe the bug, broken behavior, or unexpected error you want resolved in the codebase...';
      case 'enquiry':
        return 'Ask any technical question regarding the architecture, components, APIs, or data flow...';
    }
  };

  const getHelperText = () => {
    switch (selectedOption) {
      case 'feature':
        return 'Full SDLC cycle: Targeted code generation, sandbox verification tests, quality critics evaluation, and live preview update.';
      case 'bug':
        return 'Defect resolution: Targeted fix synthesis, sandbox test execution, critics arbitration, and regression verification.';
      case 'enquiry':
        return 'Read-only technical explanation: Deep architectural inspection and conversational Q&A without modifying source files.';
    }
  };

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setErrorMessage('Please enter your request or technical question.');
      return;
    }

    setErrorMessage(null);
    setStorePrompt(trimmed);

    if (selectedOption === 'feature' || selectedOption === 'bug') {
      setPostCompletionMode('modify');
      onAdvance(12); // Advance to Stage 12 (Execution View)
    } else {
      // Product Enquiry: In-place streaming technical answer
      if (!currentCodebase) {
        setErrorMessage('No codebase available for architectural enquiry.');
        return;
      }
      setIsQuerying(true);
      setQueryResponse('');
      try {
        await postCompletionQuery(
          {
            codebase: currentCodebase,
            blueprint: currentBlueprint,
            query: trimmed,
            mode: 'QUICK',
          },
          {
            onChunk: (accumulated) => setQueryResponse(accumulated),
          }
        );
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to complete technical query stream.');
      } finally {
        setIsQuerying(false);
      }
    }
  };

  const handleCopyExplanation = () => {
    if (!queryResponse) return;
    navigator.clipboard?.writeText(queryResponse).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  return (
    <div
      id="stagePostDevRequest"
      className={`h-full flex flex-col max-w-4xl mx-auto px-4 py-4 space-y-6 select-none ${className}`}
    >
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onAdvance(10)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Return to Results"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              POST-DEVELOPMENT REQUEST
            </h2>
            <p className="text-[11px] text-slate-400">
              Select a request type and describe your updates or technical questions
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAdvance(10)}
          className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs transition-colors cursor-pointer"
        >
          Back to Results
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* ── 3-Option Pill Toggle ── */}
      <div className="flex justify-center">
        <div className="inline-flex items-center p-1 rounded-full bg-slate-950/[0.25] border border-white/[0.08] backdrop-blur-md relative">
          <motion.button
            id="pillFeatureRequest"
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedOption('feature')}
            className={`relative px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-colors duration-150 cursor-pointer ${
              selectedOption === 'feature'
                ? 'text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {selectedOption === 'feature' && (
              <motion.div
                layoutId="stagePostDevOptionGlider"
                className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
              />
            )}
            <SparklesIcon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Feature Request</span>
          </motion.button>

          <motion.button
            id="pillBugFixes"
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedOption('bug')}
            className={`relative px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-colors duration-150 cursor-pointer ${
              selectedOption === 'bug'
                ? 'text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {selectedOption === 'bug' && (
              <motion.div
                layoutId="stagePostDevOptionGlider"
                className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
              />
            )}
            <BugAntIcon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Bug Fixes</span>
          </motion.button>

          <motion.button
            id="pillProductEnquiry"
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedOption('enquiry')}
            className={`relative px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-colors duration-150 cursor-pointer ${
              selectedOption === 'enquiry'
                ? 'text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {selectedOption === 'enquiry' && (
              <motion.div
                layoutId="stagePostDevOptionGlider"
                className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
              />
            )}
            <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Product Enquiry</span>
          </motion.button>
        </div>
      </div>

      {/* Guidance Helper Note */}
      <div className="text-center">
        <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
          {getHelperText()}
        </p>
      </div>

      {/* Input Surface */}
      <div
        className="rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-4"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="rounded-2xl border border-white/[0.08] bg-black/25 focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 overflow-hidden">
          <ScrollFade fadeSize={24} className="w-full">
            <textarea
              id="postDevTextarea"
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={getPlaceholder()}
              rows={5}
              disabled={isQuerying}
              className="w-full bg-transparent border-none p-4 text-white placeholder:text-white/40 text-sm outline-none resize-y min-h-[120px] focus:outline-none leading-relaxed font-sans"
            />
          </ScrollFade>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="text-[11px] font-mono text-slate-400">
            {prompt.length} characters
          </span>

          <button
            id="postDevSubmitBtn"
            type="button"
            onClick={handleSubmit}
            disabled={isQuerying || !prompt.trim()}
            className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-semibold text-xs tracking-wide border border-white/20 transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            {isQuerying ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                <span>STREAMING EXPLANATION...</span>
              </>
            ) : (
              <>
                <span>
                  {selectedOption === 'enquiry' ? 'ASK QUESTION' : 'START DEVELOPMENT'}
                </span>
                <ArrowRightIcon className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Technical Enquiry Streaming Answer Box */}
      {queryResponse && (
        <div
          className="rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-3"
          style={{ backdropFilter: 'blur(14px)' }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-white/80" />
              <span>Technical Architectural Explanation</span>
            </h4>
            <button
              type="button"
              onClick={handleCopyExplanation}
              className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] transition-colors cursor-pointer"
            >
              {copyFeedback ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <ScrollFade className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto font-sans p-3 bg-black/25 border border-white/[0.07] rounded-xl">
            {queryResponse}
          </ScrollFade>
        </div>
      )}
    </div>
  );
};

export default StagePostDevRequest;
